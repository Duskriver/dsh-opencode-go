/** Runtime discovery: gateway availability plus online protocol and capability metadata. */
import { randomUUID } from 'node:crypto'
import { createProvider } from 'opencode-go-pi-ai'
import type { Api, Model, Provider } from './sdk-types.ts'
import { OPENCODE_GO_MODELS } from 'opencode-go-pi-ai/providers/opencode-go.models'
import * as anthropicMessagesApi from 'opencode-go-pi-ai/api/anthropic-messages'
import * as openAICompletionsApi from 'opencode-go-pi-ai/api/openai-completions'
import * as openAIResponsesApi from 'opencode-go-pi-ai/api/openai-responses'
import * as googleGenerativeAI from './google-generative-ai.ts'
import { attributionHeaders, LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import { MODEL_METADATA_URL, modelBaseURL, readModelMetadata } from './model-metadata.ts'
import { sortModels, type GoModelCatalog } from './models-contract.ts'
import type { ModelMetadata } from './model-metadata.ts'
import { diagnosticURL, fetchJsonResponse, transportFailure } from './json-response.ts'
import { MODEL_METADATA_MAX_BYTES, metadataCachePath, metadataETag, readMetadataCache, writeMetadataCache } from './metadata-cache.ts'
import { DISPLAY_NAME, SDK_PROVIDER_ID } from './provider-identity.ts'
import { reasoningBudgetRange, withGatewayReasoning } from './reasoning.ts'
import { migrateGatewayBaseURL } from './gateway-url.ts'
import { measureTiming, type DiagnosticTiming, type TimingObserver } from './diagnostic-timing.ts'

export { PROVIDER_ID, DISPLAY_NAME } from './provider-identity.ts'
export { DEFAULT_BASE_URL } from './gateway-url.ts'
const MODELS_FETCH_TIMEOUT_MS = 10_000
const METADATA_FETCH_TIMEOUT_MS = 30_000
const STALE_WHILE_REVALIDATE_MS = 5 * 60_000
const MODEL_LISTING_MAX_BYTES = 1024 * 1024
const RETRY_MIN_MS = 5_000
const RETRY_MAX_MS = 60_000

type ListingResult = PromiseSettledResult<{ ids: readonly string[]; warning?: string; updatedAtMs: number }>
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
  readonly listingWarning?: string
  readonly metadataFailure?: unknown
  /** Last successful fetch or revalidation, not the time of a failed attempt. */
  readonly listingUpdatedAtMs?: number
  readonly metadataUpdatedAtMs?: number
  readonly fetchedAtMs: number
}

/** One catalog instance; refresh 0 restores disk state, then online refreshes count from 1. */
export interface CatalogDiagnostic extends DiagnosticTiming {
  readonly catalogId: string
  readonly refresh: number
  readonly url?: string
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
export function readLiveModelIds(body: unknown, onInvalidRows?: (warning: string) => void): readonly string[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) throw new Error('the model listing has no "data" array')
  const ids: string[] = []
  const invalidRows: number[] = []
  let invalidCount = 0
  for (const [index, entry] of data.entries()) {
    const id = (entry as { id?: unknown } | null)?.id
    if (typeof id === 'string' && id.trim().length > 0) ids.push(id)
    else { invalidCount++; if (invalidRows.length < 8) invalidRows.push(index + 1) }
  }
  if (data.length > 0 && ids.length === 0) throw new Error('the nonempty model listing has no valid model ids')
  if (invalidCount > 0) onInvalidRows?.(`Model listing ignored ${invalidCount} of ${data.length} rows with invalid model ids (rows ${invalidRows.join(', ')}${invalidCount > invalidRows.length ? ', …' : ''}); the listing may be incomplete`)
  return [...new Set(ids)]
}

async function fetchLiveModelIds(baseURL: string, fetcher?: typeof globalThis.fetch, onTiming?: TimingObserver): Promise<{ ids: readonly string[]; warning?: string }> {
  const url = `${baseURL.replace(/\/+$/, '')}/models`
  const endpoint = diagnosticURL(url)
  let result: Awaited<ReturnType<typeof fetchJsonResponse>>
  try {
    result = await fetchJsonResponse(url, {
      method: 'GET', cache: 'no-cache',
      headers: { ...attributionHeaders(), accept: 'application/json' },
      signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS),
    }, MODEL_LISTING_MAX_BYTES, 'identity', fetcher, undefined, onTiming)
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
    let warning: string | undefined
    const ids = readLiveModelIds(body, value => { warning = value })
    return { ids, ...warning === undefined ? {} : { warning } }
  } catch (error: unknown) {
    throw new LlmError(`${endpoint} returned an invalid model listing: ${error instanceof Error ? error.message : 'invalid data'}`, 'DISCOVERY_FAILED', { cause: error })
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
      'google-generative-ai': googleGenerativeAI,
    },
  })
}

/** Runtime requests reuse a snapshot; discovery revalidates it. Concurrent reads coalesce. */
export class OpencodeGoCatalog {
  private readonly diagnosticId = randomUUID()
  private refreshSequence = 0
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
    private readonly onWarning?: (warning: string) => void,
    private readonly onDiagnostic?: (event: CatalogDiagnostic) => void,
  ) {
    this.baseURL = migrateGatewayBaseURL(baseURL)
  }

  private observer(refresh: number, prefix = '', url?: string): TimingObserver | undefined {
    const onDiagnostic = this.onDiagnostic
    if (onDiagnostic === undefined) return undefined
    const endpoint = url === undefined ? undefined : diagnosticURL(url)
    return event => onDiagnostic({ ...event, stage: `${prefix}${event.stage}`,
      catalogId: this.diagnosticId, refresh, ...(endpoint === undefined ? {} : { url: endpoint }) })
  }

  snapshot(force = false, signal?: AbortSignal): Promise<CatalogSnapshot> {
    if (signal?.aborted) {
      return Promise.reject(new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason }))
    }
    return waitForSnapshot(this.served === undefined ? this.readSnapshot(force) : this.currentSnapshot(force), signal)
  }

  private async restoreMetadata(): Promise<void> {
    const observer = this.observer(0)
    await measureTiming(observer, 'cache.restore', async () => {
      const saved = await measureTiming(observer, 'cache.read', () => readMetadataCache(this.cachePath))
      if (saved === undefined) return false
      try {
        // Re-convert raw public metadata for this gateway and the currently installed SDK.
        this.metadata = await measureTiming(observer, 'cache.convert', () => readModelMetadata(saved.body, this.baseURL, builtinModels(this.baseURL)))
        this.metadataBody = saved.body
        this.metadataETag = saved.etag
        this.metadataUpdatedAtMs = saved.savedAtMs
        return true
      } catch {
        // A document from an incompatible or corrupt cache must not send its validator.
        return false
      }
    }, cacheHit => ({ cacheHit }))
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
    const refresh = ++this.refreshSequence
    const observer = this.observer(refresh)
    this.pending = measureTiming(observer, 'refresh', async () => {
      const builtin = builtinModels(this.baseURL)
      const listing = settled(measureTiming(observer, 'listing', async () => ({
        ...await fetchLiveModelIds(this.baseURL, this.fetcher, this.observer(refresh, 'listing.', `${this.baseURL.replace(/\/+$/, '')}/models`)),
        updatedAtMs: Date.now(),
      })))
      const restored = this.metadata
      if (!force && this.served === undefined && restored !== undefined) {
        const status: MetadataStatus = { metadataLive: false, metadataUpdatedAtMs: this.metadataUpdatedAtMs }
        this.cachedPending = measureTiming(observer, 'cache.snapshot', async () => {
          const snapshot = this.build(builtin, await listing, restored, status)
          this.served = snapshot
          return snapshot
        })
      }
      const notify = this.cachedPending !== undefined || (!force && this.served !== undefined)
      // Wait for the early snapshot before committing, even if the metadata response is faster.
      const [listingResult, result] = await Promise.all([
        listing,
        settled(measureTiming(observer, 'metadata', () => this.refreshMetadata(builtin, this.observer(refresh, 'metadata.', MODEL_METADATA_URL)))),
        this.cachedPending,
      ])
      const snapshot = await measureTiming(observer, 'build', () => this.build(builtin, listingResult,
        result.status === 'fulfilled' ? result.value : this.metadata, {
          metadataLive: result.status === 'fulfilled',
          ...this.metadataUpdatedAtMs === undefined ? {} : { metadataUpdatedAtMs: this.metadataUpdatedAtMs },
          ...result.status === 'rejected' ? { metadataFailure: result.reason } : {},
        }))
      this.served = snapshot
      this.failures = snapshot.live && snapshot.metadataLive ? 0 : Math.min(this.failures + 1, 5)
      if (snapshot.listingWarning && snapshot.live) {
        try { this.onWarning?.(snapshot.listingWarning) } catch { /* Diagnostics cannot reject a refresh. */ }
      }
      const lifetime = this.failures === 0 ? this.refreshMs
        : Math.min(this.refreshMs, RETRY_MIN_MS * 2 ** (this.failures - 1), RETRY_MAX_MS)
      this.refreshAtMs = snapshot.fetchedAtMs + lifetime
      if (notify) this.onRefresh()
      return snapshot
    }).finally(() => { this.pending = undefined; this.cachedPending = undefined })
    // Runtime callers may already have received cached data; manual callers still observe errors.
    void this.pending.catch(() => {})
  }

  /** Conditional HTTP requests save bandwidth while still checking for updated metadata. */
  private async refreshMetadata(builtin: ReadonlyMap<string, Model<Api>>, observer?: TimingObserver): Promise<ModelMetadata> {
    const { response, body } = await fetchJsonResponse(MODEL_METADATA_URL, {
      headers: { ...attributionHeaders(), accept: 'application/json',
        ...(this.metadataETag === undefined ? {} : { 'if-none-match': this.metadataETag }) },
      cache: 'no-cache', signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
    }, MODEL_METADATA_MAX_BYTES, 'gzip', this.fetcher, undefined, observer)
    if (response.status === 304 && this.metadata !== undefined) {
      this.metadataUpdatedAtMs = Date.now()
      this.metadataETag = metadataETag(response.headers.get('etag')) ?? this.metadataETag
      await this.persistMetadata(observer)
      return this.metadata
    }
    if (!response.ok) throw new LlmError(`${MODEL_METADATA_URL} answered HTTP ${response.status}`, 'DISCOVERY_FAILED')
    let metadata: ModelMetadata
    try {
      metadata = await measureTiming(observer, 'configure', () => readModelMetadata(body, this.baseURL, builtin))
    } catch (error) {
      throw new LlmError(`${MODEL_METADATA_URL} returned invalid model configuration`, 'DISCOVERY_FAILED', { cause: error })
    }
    this.metadata = metadata
    this.metadataBody = body
    this.metadataETag = metadataETag(response.headers.get('etag'))
    this.metadataUpdatedAtMs = Date.now()
    await this.persistMetadata(observer)
    return metadata
  }

  private async persistMetadata(observer?: TimingObserver): Promise<void> {
    await measureTiming(observer, 'cache-write', () => writeMetadataCache(this.cachePath, {
      body: this.metadataBody, etag: this.metadataETag, savedAtMs: this.metadataUpdatedAtMs!,
    }), persisted => ({ persisted }))
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
        ...this.served?.listingWarning === undefined ? {} : { listingWarning: this.served.listingWarning },
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
      ...listing.value.warning === undefined ? {} : { listingWarning: listing.value.warning },
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
    if (!snapshot.models.has(id) && !snapshot.live) throw listingError(snapshot)
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
    ].map(model => {
      const configured = snapshot.models.get(model.id)
      const budget = configured && reasoningBudgetRange(configured)
      return { ...model, ...snapshot.details.get(model.id), ...budget === undefined ? {} : { reasoningBudget: budget } }
    })),
    stale: errors.length > 0,
    ...(errors.length === 0 ? {} : { error: errors.join('; ') }),
    sources: {
      listing: {
        ...snapshot.listingUpdatedAtMs === undefined ? {} : { updatedAt: snapshot.listingUpdatedAtMs },
        ...snapshot.live ? {} : { error: listingError(snapshot).message },
        ...snapshot.listingWarning === undefined ? {} : { warning: snapshot.listingWarning },
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
