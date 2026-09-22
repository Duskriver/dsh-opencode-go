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
import { sortModels, type GoModel } from './models-contract.ts'
import type { ModelMetadata } from './model-metadata.ts'

export const PROVIDER_ID = 'opencode-go'
export const DISPLAY_NAME = 'OpenCode Go'
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'
const MODELS_FETCH_TIMEOUT_MS = 10_000

export interface CatalogSnapshot {
  readonly details: ModelMetadata['details']
  readonly models: ReadonlyMap<string, Model<Api>>
  /** Advertised ids with missing/unsupported metadata stay visible with a diagnostic. */
  readonly unavailable: ReadonlyMap<string, string>
  readonly provider: Provider
  readonly live: boolean
  readonly fetchedAtMs: number
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
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET', cache: 'no-cache',
      headers: { accept: 'application/json', ...attributionHeaders() },
      signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS),
    })
  } catch (error: unknown) {
    throw new LlmError(`could not reach ${url}`, 'DISCOVERY_FAILED', { cause: error })
  }
  if (!response.ok) throw new LlmError(`${url} answered ${response.status}`, 'DISCOVERY_FAILED')
  return readLiveModelIds(await response.json())
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

  constructor(
    private readonly baseURL: string,
    private readonly refreshMs: number,
    private readonly onFallback: (detail: { url: string; error: unknown; kept: number }) => void,
    /** Kept for API compatibility; now reports unconfigured ids rather than hiding them. */
    private readonly onOmitted: (ids: readonly string[]) => void,
  ) {}

  snapshot(force = false): Promise<CatalogSnapshot> {
    if (!force && this.served !== undefined && Date.now() - this.served.fetchedAtMs < this.refreshMs) {
      return Promise.resolve(this.served)
    }
    this.pending ??= this.build()
      .then((snapshot) => { this.served = snapshot; return snapshot })
      .finally(() => { this.pending = undefined })
    return this.pending
  }

  /** Conditional HTTP requests save bandwidth while still checking for updated metadata. */
  private async refreshMetadata(builtin: ReadonlyMap<string, Model<Api>>): Promise<ModelMetadata> {
    const response = await fetch(MODEL_METADATA_URL, {
      headers: { accept: 'application/json', ...attributionHeaders(),
        ...(this.metadataETag === undefined ? {} : { 'if-none-match': this.metadataETag }) },
      cache: 'no-cache', signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS),
    })
    if (response.status === 304 && this.metadata !== undefined) return this.metadata
    if (!response.ok) throw new Error(`models.dev answered ${response.status}`)
    const metadata = readModelMetadata(await response.json(), this.baseURL, builtin)
    this.metadata = metadata
    this.metadataETag = response.headers.get('etag') ?? undefined
    return metadata
  }

  /** Gateway ids decide membership; online metadata decides how to call each model. */
  private async build(): Promise<CatalogSnapshot> {
    const builtin = builtinModels(this.baseURL)
    const [listing, metadataResult] = await Promise.allSettled([
      fetchLiveModelIds(this.baseURL), this.refreshMetadata(builtin),
    ])
    const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : this.metadata
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
      }
    }
    const models = new Map<string, Model<Api>>()
    const unavailable = new Map<string, string>()
    for (const id of listing.value) {
      const error = metadata?.errors.get(id)
      const model = known.get(id)
      if (error !== undefined || model === undefined) {
        unavailable.set(id, error ?? 'model metadata has not been published on models.dev yet')
      } else {
        models.set(id, model)
      }
    }
    if (unavailable.size > 0) this.onOmitted([...unavailable.keys()])
    return {
      details: new Map(listing.value.map(id => [id, metadata?.details.get(id) ?? {}])),
      models, unavailable, provider: buildProvider(this.baseURL, [...models.values()]),
      live: true, fetchedAtMs: Date.now(),
    }
  }

  /** New or previously unconfigured ids get a fresh lookup even during the runtime TTL. */
  async forModel(id: string): Promise<CatalogSnapshot> {
    const cached = this.served
    let snapshot = await this.snapshot()
    if (!snapshot.models.has(id) && snapshot === cached) snapshot = await this.snapshot(true)
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
  if (!snapshot.live) {
    throw new LlmError('llm-opencode-go: the live model listing is unreachable; try again later', 'DISCOVERY_FAILED')
  }
  return describeCatalog(snapshot)
}

function describeCatalog(snapshot: CatalogSnapshot): readonly LlmDiscoveredModel[] {
  return [
    ...[...snapshot.models.values()].map(model => ({
      id: model.id, name: model.name, contextWindow: model.contextWindow, maxTokens: model.maxTokens,
    })),
    ...[...snapshot.unavailable].map(([id, reason]) => ({ id, name: `${id} (metadata unavailable: ${reason})` })),
  ]
}

/** Settings retain deprecated gateway entries regardless of picker visibility. */
export async function discoverSettingsModels(catalog: OpencodeGoCatalog): Promise<readonly GoModel[]> {
  const snapshot = await catalog.snapshot(true)
  if (!snapshot.live) throw new LlmError('llm-opencode-go: the live model listing is unreachable; try again later', 'DISCOVERY_FAILED')
  return sortModels(describeCatalog(snapshot).map(model => ({ ...model, ...snapshot.details.get(model.id) })))
}
