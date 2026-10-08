/** Runtime discovery: gateway availability plus online protocol and capability metadata. */
import { createProvider } from 'opencode-go-pi-ai'
import type { Api, Model, Provider } from './sdk-types.ts'
import { OPENCODE_GO_MODELS } from 'opencode-go-pi-ai/providers/opencode-go.models'
import * as anthropicMessagesApi from 'opencode-go-pi-ai/api/anthropic-messages'
import * as openAICompletionsApi from 'opencode-go-pi-ai/api/openai-completions'
import * as openAIResponsesApi from 'opencode-go-pi-ai/api/openai-responses'
import { attributionHeaders, LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import { MODEL_METADATA_URL, modelBaseURL, readModelMetadata } from './model-metadata.ts'
import { sortModels, type GoModelCatalog } from './models-contract.ts'
import type { ModelMetadata } from './model-metadata.ts'
import { diagnosticURL, fetchJsonResponse, transportFailure } from './json-response.ts'
import { MODEL_METADATA_MAX_BYTES, metadataCachePath, metadataETag, readMetadataCache, writeMetadataCache } from './metadata-cache.ts'
import { DISPLAY_NAME, SDK_PROVIDER_ID } from './provider-identity.ts'
import { withGatewayReasoning } from './reasoning.ts'

export { PROVIDER_ID, DISPLAY_NAME } from './provider-identity.ts'
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'
const MODELS_FETCH_TIMEOUT_MS = 10_000
const METADATA_FETCH_TIMEOUT_MS = 30_000
const STALE_WHILE_REVALIDATE_MS = 5 * 60_000
const MODEL_LISTING_MAX_BYTES = 1024 * 1024
const RETRY_MIN_MS = 5_000
const RETRY_MAX_MS = 60_000

type ListingResult = PromiseSettledResult<{ ids: readonly string[]; updatedAtMs: number }>
type MetadataStatus = Pick<CatalogSnapshot, 'metadataLive' | 'metadataUpdatedAtMs' | 'metadataFailure'>

async function settled<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  const [result] = await Promise.allSettled([promise])
  return result!
}

export interface CatalogSnapshot {
  readonly details: ModelMetadata['details']
  readonly models: ReadonlyMap<string, Model<Api>>
  /** Advertised ids with missing/unsupported metadata stay visible with a diagnostic. */
  readonly unavailable: ReadonlyMap<string, string>
  readonly provider: Provider
  readonly live: boolean
  readonly metadataLive: boolean
  /** Retained for explicit discovery; runtime callers may still use the last catalog. */
  readonly listingFailure?: unknown
  readonly metadataFailure?: unknown
  /** Last successful fetch or revalidation, not the time of a failed attempt. */
  readonly listingUpdatedAtMs?: number
  readonly metadataUpdatedAtMs?: number
  readonly fetchedAtMs: number
}

/** Cancelling one waiter must not cancel a catalog refresh shared with other calls. */
function waitForSnapshot(pending: Promise<CatalogSnapshot>, signal?: AbortSignal): Promise<CatalogSnapshot> {
  if (signal === undefined) return pending
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      signal.removeEventListener('abort', abort)
      reject(new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason }))
    }
    pending.then(value => {
      signal.removeEventListener('abort', abort)
      resolve(value)
    }, error => {
      signal.removeEventListener('abort', abort)
      reject(error)
    })
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

/** Built-ins are outage fallbacks and compatibility hints, never a membership whitelist. */
function builtinModels(baseURL: string): Map<string, Model<Api>> {
  return new Map(Object.values(OPENCODE_GO_MODELS).map(model => [model.id, withGatewayReasoning({
    ...model, provider: SDK_PROVIDER_ID, baseUrl: modelBaseURL(model.api, baseURL),
  })]))
}

/** A valid empty listing means the gateway serves nothing; malformed replies are failures. */
export function readLiveModelIds(body: unknown): readonly string[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) throw new Error('the model listing has no "data" array')
  const ids: string[] = []
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id
    if (typeof id === 'string' && id.length > 0) ids.push(id)
  }
  return [...new Set(ids)]
}

async function fetchLiveModelIds(baseURL: string, fetcher?: typeof globalThis.fetch): Promise<readonly string[]> {
  const url = `${baseURL.replace(/\/+$/, '')}/models`
  const endpoint = diagnosticURL(url)
  let result: Awaited<ReturnType<typeof fetchJsonResponse>>
  try {
    result = await fetchJsonResponse(url, {
      method: 'GET', cache: 'no-cache',
      headers: { ...attributionHeaders(), accept: 'application/json' },
      signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS),
    }, MODEL_LISTING_MAX_BYTES, 'identity', fetcher)
  } catch (error: unknown) {
    const detail = error instanceof SyntaxError
      ? 'invalid JSON response'
      : error instanceof RangeError ? `response exceeds the ${MODEL_LISTING_MAX_BYTES} byte limit`
        : transportFailure(error)
    const action = error instanceof SyntaxError || error instanceof RangeError ? 'read' : 'reach'
    throw new LlmError(`could not ${action} ${endpoint}: ${detail}`, 'DISCOVERY_FAILED', { cause: error })
  }
  const { response, body } = result
  if (!response.ok) throw new LlmError(`${endpoint} answered HTTP ${response.status}`, 'DISCOVERY_FAILED')
  try {
    return readLiveModelIds(body)
  } catch (error: unknown) {
    throw new LlmError(`${endpoint} returned an invalid model listing: expected a "data" array`, 'DISCOVERY_FAILED', { cause: error })
  }
}

/** The adapter resolves and passes credentials for each generation request. */
function harnessApiKeyAuth(): Provider['auth'] {
  return { apiKey: {
    name: 'OpenCode API key',
    resolve: () => Promise.resolve({ auth: {}, source: 'OpenCode API key' }),
  } }
}

function buildProvider(baseURL: string, models: readonly Model<Api>[]): Provider {
  return createProvider({
    id: SDK_PROVIDER_ID, name: DISPLAY_NAME, baseUrl: baseURL,
    auth: harnessApiKeyAuth(), models: [...models],
    api: {
      'anthropic-messages': anthropicMessagesApi,
      'openai-completions': openAICompletionsApi,
      'openai-responses': openAIResponsesApi,
    },
  })
}

/** Runtime requests reuse a snapshot; discovery revalidates it. Concurrent reads coalesce. */
export class OpencodeGoCatalog {
  private served: CatalogSnapshot | undefined
  private pending: Promise<CatalogSnapshot> | undefined
  /** A cold runtime read can use disk metadata while the shared online refresh runs. */
  private cachedPending: Promise<CatalogSnapshot> | undefined
  private initialized: Promise<void> | undefined
  private readonly cachePath = metadataCachePath()
  private metadata: ModelMetadata | undefined
  private metadataBody: unknown
  private metadataETag: string | undefined
  private metadataUpdatedAtMs: number | undefined
  private failures = 0
  private refreshAtMs = 0

  constructor(
    private readonly baseURL: string,
    private readonly refreshMs: number,
    private readonly onFallback: (detail: { url: string; error: unknown; kept: number }) => void,
    /** Kept for API compatibility; now reports unconfigured ids rather than hiding them. */
    private readonly onOmitted: (ids: readonly string[]) => void,
    // Notify consumers after a background refresh commits its complete snapshot.
    private readonly onRefresh: () => void = () => {},
    private readonly fetcher?: typeof globalThis.fetch,
  ) {}

  snapshot(force = false, signal?: AbortSignal): Promise<CatalogSnapshot> {
    if (signal?.aborted) {
      return Promise.reject(new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason }))
    }
    return waitForSnapshot(this.served === undefined ? this.readSnapshot(force) : this.currentSnapshot(force), signal)
  }

  private async restoreMetadata(): Promise<void> {
    const saved = await readMetadataCache(this.cachePath)
    if (saved === undefined) return
    try {
      // Re-convert raw public metadata for this gateway and the currently installed SDK.
      this.metadata = readModelMetadata(saved.body, this.baseURL, builtinModels(this.baseURL))
      this.metadataBody = saved.body
      this.metadataETag = saved.etag
      this.metadataUpdatedAtMs = saved.savedAtMs
    } catch {
      // A document from an incompatible or corrupt cache must not send its validator.
    }
  }

  private async readSnapshot(force: boolean): Promise<CatalogSnapshot> {
    await (this.initialized ??= this.restoreMetadata())
    return this.currentSnapshot(force)
  }

  private currentSnapshot(force: boolean): Promise<CatalogSnapshot> {
    if (!force && this.served !== undefined && Date.now() < this.refreshAtMs) return Promise.resolve(this.served)
    if (this.pending === undefined) this.startRefresh(force)
    return !force && this.cachedPending !== undefined ? this.cachedPending : this.pending!
  }

  private startRefresh(force: boolean): void {
    const builtin = builtinModels(this.baseURL)
    const listing = settled(fetchLiveModelIds(this.baseURL, this.fetcher).then(ids => ({ ids, updatedAtMs: Date.now() })))
    const restored = this.metadata
    if (!force && this.served === undefined && restored !== undefined) {
      const status: MetadataStatus = { metadataLive: false, metadataUpdatedAtMs: this.metadataUpdatedAtMs }
      this.cachedPending = listing.then(result => {
        const snapshot = this.build(builtin, result, restored, status)
        this.served = snapshot
        return snapshot
      })
    }
    const notify = this.cachedPending !== undefined || (!force && this.served !== undefined)
    // Wait for the early snapshot before committing, even if the metadata response is faster.
    this.pending = Promise.all([listing, settled(this.refreshMetadata(builtin)), this.cachedPending])
      .then(([listing, result]) => this.build(builtin, listing,
        result.status === 'fulfilled' ? result.value : this.metadata, {
          metadataLive: result.status === 'fulfilled',
          ...this.metadataUpdatedAtMs === undefined ? {} : { metadataUpdatedAtMs: this.metadataUpdatedAtMs },
          ...result.status === 'rejected' ? { metadataFailure: result.reason } : {},
        }))
      .then((snapshot) => {
        this.served = snapshot
        this.failures = snapshot.live && snapshot.metadataLive ? 0 : Math.min(this.failures + 1, 5)
        const lifetime = this.failures === 0 ? this.refreshMs
          : Math.min(this.refreshMs, RETRY_MIN_MS * 2 ** (this.failures - 1), RETRY_MAX_MS)
        this.refreshAtMs = snapshot.fetchedAtMs + lifetime
        if (notify) this.onRefresh()
        return snapshot
      })
      .finally(() => { this.pending = undefined; this.cachedPending = undefined })
    // Runtime callers may already have received cached data; manual callers still observe errors.
    void this.pending.catch(() => {})
  }

  /** Conditional HTTP requests save bandwidth while still checking for updated metadata. */
  private async refreshMetadata(builtin: ReadonlyMap<string, Model<Api>>): Promise<ModelMetadata> {
    const { response, body } = await fetchJsonResponse(MODEL_METADATA_URL, {
      headers: { ...attributionHeaders(), accept: 'application/json',
        ...(this.metadataETag === undefined ? {} : { 'if-none-match': this.metadataETag }) },
      cache: 'no-cache', signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
    }, MODEL_METADATA_MAX_BYTES, 'gzip', this.fetcher)
    if (response.status === 304 && this.metadata !== undefined) {
      this.metadataUpdatedAtMs = Date.now()
      this.metadataETag = metadataETag(response.headers.get('etag')) ?? this.metadataETag
      await this.persistMetadata()
      return this.metadata
    }
    if (!response.ok) throw new LlmError(`${MODEL_METADATA_URL} answered HTTP ${response.status}`, 'DISCOVERY_FAILED')
    let metadata: ModelMetadata
    try {
      metadata = readModelMetadata(body, this.baseURL, builtin)
    } catch (error) {
      throw new LlmError(`${MODEL_METADATA_URL} returned invalid model configuration`, 'DISCOVERY_FAILED', { cause: error })
    }
    this.metadata = metadata
    this.metadataBody = body
    this.metadataETag = metadataETag(response.headers.get('etag'))
    this.metadataUpdatedAtMs = Date.now()
    await this.persistMetadata()
    return metadata
  }

  private async persistMetadata(): Promise<void> {
    await writeMetadataCache(this.cachePath, {
      body: this.metadataBody, etag: this.metadataETag, savedAtMs: this.metadataUpdatedAtMs!,
    })
  }

  /** Gateway ids decide membership; online metadata decides how to call each model. */
  private build(
    builtin: ReadonlyMap<string, Model<Api>>, listing: ListingResult,
    metadata: ModelMetadata | undefined, metadataStatus: MetadataStatus,
  ): CatalogSnapshot {
    const known = new Map([...builtin, ...(this.served?.models ?? []), ...(metadata?.models ?? [])])
    if (metadataStatus.metadataFailure !== undefined) {
      this.onFallback({ url: MODEL_METADATA_URL, error: metadataStatus.metadataFailure, kept: known.size })
    }
    if (listing.status === 'rejected') {
      // Once observed, an outage must not resurrect retired models.
      const models = this.served?.models ?? new Map<string, Model<Api>>()
      this.onFallback({ url: `${this.baseURL.replace(/\/+$/, '')}/models`, error: listing.reason, kept: models.size })
      return {
        details: this.served?.details ?? new Map(),
        models, unavailable: this.served?.unavailable ?? new Map(),
        provider: buildProvider(this.baseURL, [...models.values()]), live: false, fetchedAtMs: Date.now(),
        ...metadataStatus,
        ...this.served?.listingUpdatedAtMs === undefined ? {} : { listingUpdatedAtMs: this.served.listingUpdatedAtMs },
        listingFailure: listing.reason,
      }
    }
    const models = new Map<string, Model<Api>>()
    const unavailable = new Map<string, string>()
    for (const id of listing.value.ids) {
      const error = metadata?.errors.get(id)
      const model = known.get(id)
      if (error !== undefined || model === undefined) {
        unavailable.set(id, error ?? 'no usable configuration was found for this OpenCode Go model')
      } else {
        models.set(id, model)
      }
    }
    if (unavailable.size > 0 && (metadataStatus.metadataLive || metadataStatus.metadataFailure !== undefined)) {
      this.onOmitted([...unavailable.keys()])
    }
    return {
      details: new Map(listing.value.ids.map(id => [id, metadata?.details.get(id) ?? {}])),
      models, unavailable, provider: buildProvider(this.baseURL, [...models.values()]),
      live: true, fetchedAtMs: Date.now(), listingUpdatedAtMs: listing.value.updatedAtMs, ...metadataStatus,
    }
  }

  /** New or previously unconfigured ids get a fresh lookup even during the runtime TTL. */
  async forModel(id: string, signal?: AbortSignal): Promise<CatalogSnapshot> {
    const cached = this.served
    if (signal?.aborted) throw new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason })
    // Only previously verified configurations may bypass a due/in-flight refresh.
    // Failed attempts never extend this window; explicit discovery still waits.
    if (cached?.models.has(id) && cached.listingUpdatedAtMs !== undefined && cached.metadataUpdatedAtMs !== undefined
      && Date.now() < Math.min(cached.listingUpdatedAtMs, cached.metadataUpdatedAtMs) + this.refreshMs + STALE_WHILE_REVALIDATE_MS) {
      void this.snapshot().catch(() => {})
      return cached
    }
    let snapshot = await this.snapshot(false, signal)
    if (!snapshot.models.has(id) && (snapshot === cached || this.cachedPending !== undefined)) {
      snapshot = await this.snapshot(true, signal)
    }
    if (signal?.aborted) throw new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason })
    if (snapshot.unavailable.has(id)) {
      throw new LlmError(
        `opencode-go model "${id}" is advertised but cannot be configured: ${snapshot.unavailable.get(id)}; refresh the model list to retry`,
        'MODEL_METADATA_UNAVAILABLE',
      )
    }
    return snapshot
  }
}

/** Explicit discovery always revalidates both sources, including during the runtime TTL. */
export async function discoverCatalogModels(catalog: OpencodeGoCatalog): Promise<readonly LlmDiscoveredModel[]> {
  const snapshot = await catalog.snapshot(true)
  requireLiveListing(snapshot)
  return describeCatalog(snapshot)
}

function requireLiveListing(snapshot: CatalogSnapshot): void {
  if (snapshot.live) return
  throw listingError(snapshot)
}

function listingError(snapshot: CatalogSnapshot): LlmError {
  const detail = snapshot.listingFailure instanceof LlmError
    ? snapshot.listingFailure.message : 'the live model listing is unreachable'
  return new LlmError(`llm-opencode-go: ${detail}; refresh the model list to retry`, 'DISCOVERY_FAILED', { cause: snapshot.listingFailure })
}

function describeConfiguredModels(snapshot: CatalogSnapshot): readonly LlmDiscoveredModel[] {
  return [...snapshot.models.values()].map(model => ({
    id: model.id, name: model.name, contextWindow: model.contextWindow, maxTokens: model.maxTokens,
  }))
}

function describeCatalog(snapshot: CatalogSnapshot): readonly LlmDiscoveredModel[] {
  return [
    ...describeConfiguredModels(snapshot),
    ...[...snapshot.unavailable].map(([id, reason]) => ({ id, name: `${id} (metadata unavailable: ${reason})` })),
  ]
}

/** Settings expose the same retained catalog as requests, with a failed-refresh diagnostic. */
export async function discoverSettingsModels(catalog: OpencodeGoCatalog): Promise<GoModelCatalog> {
  const snapshot = await catalog.snapshot(true)
  const metadataError = snapshot.metadataLive ? undefined : metadataFailureMessage(snapshot.metadataFailure)
  const errors = [snapshot.live ? undefined : listingError(snapshot).message, metadataError]
    .filter((message): message is string => message !== undefined)
  return {
    models: sortModels([
      ...describeConfiguredModels(snapshot),
      ...[...snapshot.unavailable.keys()].map(id => ({ id, name: id, configurationMissing: true })),
    ].map(model => ({ ...model, ...snapshot.details.get(model.id) }))),
    stale: errors.length > 0,
    ...(errors.length === 0 ? {} : { error: errors.join('; ') }),
    sources: {
      listing: {
        ...snapshot.listingUpdatedAtMs === undefined ? {} : { updatedAt: snapshot.listingUpdatedAtMs },
        ...snapshot.live ? {} : { error: listingError(snapshot).message },
      },
      metadata: {
        ...snapshot.metadataUpdatedAtMs === undefined ? {} : { updatedAt: snapshot.metadataUpdatedAtMs },
        ...metadataError === undefined ? {} : { error: metadataError },
      },
    },
  }
}

function metadataFailureMessage(error: unknown): string {
  const detail = error instanceof LlmError ? error.message
    : `${MODEL_METADATA_URL}: ${error instanceof SyntaxError ? 'invalid JSON response'
      : error instanceof RangeError ? `response exceeds the ${MODEL_METADATA_MAX_BYTES} byte limit`
        : transportFailure(error)}`
  return `could not refresh model configuration (${detail}); using previously fetched or built-in configuration where available`
}
