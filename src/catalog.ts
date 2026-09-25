/** Runtime discovery: gateway availability plus online protocol and capability metadata. */
import { createProvider } from '@earendil-works/pi-ai'
import type { Api, Model, Provider } from '@earendil-works/pi-ai'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import { attributionHeaders, LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import { MODEL_METADATA_URL, modelBaseURL, readModelMetadata } from './model-metadata.ts'
import { sortModels, type GoModelCatalog } from './models-contract.ts'
import type { ModelMetadata } from './model-metadata.ts'
import { diagnosticURL, fetchJsonResponse, transportFailure } from './json-response.ts'

export const PROVIDER_ID = 'opencode-go'
export const DISPLAY_NAME = 'OpenCode Go'
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'
const MODELS_FETCH_TIMEOUT_MS = 10_000
const METADATA_FETCH_TIMEOUT_MS = 30_000
const STALE_WHILE_REVALIDATE_MS = 5 * 60_000
const MODEL_LISTING_MAX_BYTES = 1024 * 1024
const MODEL_METADATA_MAX_BYTES = 16 * 1024 * 1024
const RETRY_MIN_MS = 5_000
const RETRY_MAX_MS = 60_000

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
  return new Map((getBuiltinModels('opencode-go') as Model<Api>[]).map(model => [model.id, {
    ...model, provider: PROVIDER_ID, baseUrl: modelBaseURL(model.api, baseURL),
  }]))
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

async function fetchLiveModelIds(baseURL: string): Promise<readonly string[]> {
  const url = `${baseURL.replace(/\/+$/, '')}/models`
  const endpoint = diagnosticURL(url)
  let result: Awaited<ReturnType<typeof fetchJsonResponse>>
  try {
    result = await fetchJsonResponse(url, {
      method: 'GET', cache: 'no-cache',
      headers: { ...attributionHeaders(), accept: 'application/json' },
      signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS),
    }, MODEL_LISTING_MAX_BYTES)
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
    id: PROVIDER_ID, name: DISPLAY_NAME, baseUrl: baseURL,
    auth: harnessApiKeyAuth(), models: [...models],
    api: {
      'anthropic-messages': anthropicMessagesApi(),
      'openai-completions': openAICompletionsApi(),
      'openai-responses': openAIResponsesApi(),
    },
  })
}

/** Runtime requests reuse a snapshot; discovery revalidates it. Concurrent reads coalesce. */
export class OpencodeGoCatalog {
  private served: CatalogSnapshot | undefined
  private pending: Promise<CatalogSnapshot> | undefined
  private metadata: ModelMetadata | undefined
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
  ) {}

  snapshot(force = false, signal?: AbortSignal): Promise<CatalogSnapshot> {
    if (signal?.aborted) {
      return Promise.reject(new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason }))
    }
    if (!force && this.served !== undefined && Date.now() < this.refreshAtMs) {
      return Promise.resolve(this.served)
    }
    this.pending ??= this.build()
      .then((snapshot) => {
        this.served = snapshot
        this.failures = snapshot.live && snapshot.metadataLive ? 0 : Math.min(this.failures + 1, 5)
        const lifetime = this.failures === 0 ? this.refreshMs
          : Math.min(this.refreshMs, RETRY_MIN_MS * 2 ** (this.failures - 1), RETRY_MAX_MS)
        this.refreshAtMs = snapshot.fetchedAtMs + lifetime
        return snapshot
      })
      .finally(() => { this.pending = undefined })
    return waitForSnapshot(this.pending, signal)
  }

  /** Conditional HTTP requests save bandwidth while still checking for updated metadata. */
  private async refreshMetadata(builtin: ReadonlyMap<string, Model<Api>>): Promise<ModelMetadata> {
    const { response, body } = await fetchJsonResponse(MODEL_METADATA_URL, {
      headers: { ...attributionHeaders(), accept: 'application/json',
        ...(this.metadataETag === undefined ? {} : { 'if-none-match': this.metadataETag }) },
      cache: 'no-cache', signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
    }, MODEL_METADATA_MAX_BYTES)
    if (response.status === 304 && this.metadata !== undefined) {
      this.metadataUpdatedAtMs = Date.now()
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
    this.metadataETag = response.headers.get('etag') ?? undefined
    this.metadataUpdatedAtMs = Date.now()
    return metadata
  }

  /** Gateway ids decide membership; online metadata decides how to call each model. */
  private async build(): Promise<CatalogSnapshot> {
    const builtin = builtinModels(this.baseURL)
    const [listing, metadataResult] = await Promise.allSettled([
      fetchLiveModelIds(this.baseURL).then(ids => ({ ids, updatedAtMs: Date.now() })), this.refreshMetadata(builtin),
    ])
    const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : this.metadata
    const metadataStatus = {
      metadataLive: metadataResult.status === 'fulfilled',
      ...this.metadataUpdatedAtMs === undefined ? {} : { metadataUpdatedAtMs: this.metadataUpdatedAtMs },
      ...metadataResult.status === 'rejected' ? { metadataFailure: metadataResult.reason } : {},
    }
    const known = new Map([...builtin, ...(this.served?.models ?? []), ...(metadata?.models ?? [])])
    if (metadataResult.status === 'rejected') {
      this.onFallback({ url: MODEL_METADATA_URL, error: metadataResult.reason, kept: known.size })
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
    if (unavailable.size > 0) this.onOmitted([...unavailable.keys()])
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
    if (!snapshot.models.has(id) && snapshot === cached) snapshot = await this.snapshot(true, signal)
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
