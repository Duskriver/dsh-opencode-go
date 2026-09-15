/**
 * The OpenCode Go model catalog: a curated table intersected with the gateway's
 * live model list.
 *
 * The curated table is seeded from pi-ai's installed `opencode-go` catalog —
 * its entries carry the wire protocol, compat quirks, thinking-level spellings,
 * and capacities that the gateway's own listing endpoint does not disclose —
 * plus this package's additions for models the installed catalog has not
 * caught up with. The gateway rotates its list faster than either pi-ai or
 * this package releases, so the served catalog is the curated table **minus**
 * models the live listing no longer advertises: a model the gateway retired
 * must disappear rather than error mid-session. Live ids the curated table
 * does not describe are omitted too, because without a protocol mapping they
 * cannot be routed correctly.
 *
 * The live listing at `{baseURL}/models` is public and answers ids only. A
 * fetch failure never takes the route down: the curated table is served as-is
 * and the failure is reported, on the grounds that a network blip should not
 * deny service, while model discovery — whose whole purpose is the live
 * answer — fails loud instead.
 *
 * @module dsh-llm-opencode-go/catalog
 */

import { createProvider } from '@earendil-works/pi-ai'
import type { Api, Model, Provider } from '@earendil-works/pi-ai'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import { attributionHeaders, LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'

/** Provider route key this plugin registers and every materialized model carries. */
export const PROVIDER_ID = 'opencode-go'

/** Display name for selectors and status labels. */
export const DISPLAY_NAME = 'OpenCode Go'

/** Endpoint serving both model requests and the model listing. */
export const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'

/** One addition to the installed pi-ai catalog: a clone of a shipped sibling. */
interface CatalogAddition {
  /** Model id the gateway serves but the installed catalog does not describe. */
  id: string
  /** Installed catalog entry cloned for protocol, compat, and capacities. */
  siblingId: string
  /**
   * Installed catalog entry whose input modality list the addition takes.
   * Multimodal models inherit vision from their gateway's vision-variant entry
   * rather than from the text sibling that owns the protocol and compat.
   */
  inputSiblingId: string
  /** Display name. */
  name: string
}

/**
 * Models this package adds on top of pi-ai's installed `opencode-go` catalog.
 * `deepseek-v4.1-flash` is served by the gateway (see
 * https://opencode.ai/docs/go/) while pi-ai 0.85.1's catalog stops at
 * `deepseek-v4-flash`; the sibling clone carries the same wire protocol and
 * compat, its capacities are the sibling's documented best estimate, and its
 * modalities come from the gateway's vision variant because V4.1 Flash is
 * multimodal. A deployment may correct any of these once measured values land.
 */
const CATALOG_ADDITIONS: readonly CatalogAddition[] = [
  {
    id: 'deepseek-v4.1-flash',
    siblingId: 'deepseek-v4-flash',
    inputSiblingId: 'deepseek-v4-flash-vision-exp',
    name: 'DeepSeek V4.1 Flash',
  },
]

/** Upper bound on one live-listing fetch; a slow listing falls back to the curated table. */
const MODELS_FETCH_TIMEOUT_MS = 10_000

/** One immutable resolution of the served catalog. */
export interface CatalogSnapshot {
  /** Served models by id: the curated table minus models absent from the live listing. */
  readonly models: ReadonlyMap<string, Model<Api>>
  /** The provider serving exactly these models. */
  readonly provider: Provider
  /** Whether the live listing answered this resolution; `false` on the fallback path. */
  readonly live: boolean
  /** When this resolution completed, for the refresh interval. */
  readonly fetchedAtMs: number
}

/** The curated table plus additions, materialized for this route's endpoint. */
function curatedModels(baseURL: string): Map<string, Model<Api>> {
  const models = new Map<string, Model<Api>>()
  for (const model of getBuiltinModels('opencode-go') as Model<Api>[]) {
    models.set(model.id, { ...model, provider: PROVIDER_ID, baseUrl: baseURL })
  }
  for (const addition of CATALOG_ADDITIONS) {
    /* v8 ignore next -- self-retiring: a pi-ai release that ships the id takes over and the addition becomes a no-op */
    if (models.has(addition.id)) continue
    const sibling = models.get(addition.siblingId)
    /* v8 ignore next -- defensive: pi-ai has shipped the sibling in every release so far */
    if (sibling === undefined) continue
    const inputSibling = models.get(addition.inputSiblingId)
    /* v8 ignore next -- defensive: pi-ai has shipped the vision variant in every release so far */
    if (inputSibling === undefined) continue
    models.set(addition.id, {
      ...sibling,
      id: addition.id,
      name: addition.name,
      input: [...inputSibling.input],
      provider: PROVIDER_ID,
      baseUrl: baseURL,
    })
  }
  /* v8 ignore start -- defensive: pi-ai has shipped the opencode-go catalog in every release so far */
  if (models.size === 0) {
    throw new LlmError(
      'llm-opencode-go: pi-ai\'s installed catalog describes no opencode-go models; cannot seed the curated table',
      'INVALID_CONFIG',
    )
  }
  /* v8 ignore stop */
  return models
}

/**
 * Read one live listing reply. The endpoint answers the standard OpenAI
 * `data` array with entries carrying ids only; anything else is a fault the
 * caller treats as "live unavailable" and falls back. An honest empty array
 * is a valid answer: the gateway says it serves nothing.
 * @param body - the decoded JSON reply.
 * @returns the non-empty ids it advertises, in reply order.
 * @throws {Error} when the reply carries no `data` array.
 */
export function readLiveModelIds(body: unknown): readonly string[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) throw new Error('the model listing has no "data" array')
  const ids: string[] = []
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id
    if (typeof id === 'string' && id.length > 0) ids.push(id)
  }
  return ids
}

/** One live listing fetch; throws on any non-2xx, malformed, or slow answer. */
async function fetchLiveModelIds(baseURL: string): Promise<readonly string[]> {
  const url = `${baseURL.replace(/\/+$/, '')}/models`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...attributionHeaders() },
      signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS),
    })
  } catch (error: unknown) {
    throw new LlmError(`could not reach ${url}`, 'DISCOVERY_FAILED', { cause: error })
  }
  if (!response.ok) {
    throw new LlmError(`${url} answered ${response.status}`, 'DISCOVERY_FAILED')
  }
  return readLiveModelIds(await response.json())
}

/**
 * The api-key auth a request's credential travels through. pi-ai honours a
 * request-level `apiKey` override only when the provider declares an api-key
 * method, so this declaration is what makes the per-request key effective;
 * the adapter always passes that key, so the resolved auth itself stays empty.
 */
function harnessApiKeyAuth(): Provider['auth'] {
  return {
    apiKey: {
      name: 'OpenCode API key',
      /* v8 ignore next -- pi-ai calls resolve only for a request without an apiKey override, and this adapter always passes one */
      resolve: () => Promise.resolve({ auth: {}, source: 'OpenCode API key' }),
    },
  }
}

/** Build the pi-ai provider serving exactly the given models. */
function buildProvider(baseURL: string, models: readonly Model<Api>[]): Provider {
  return createProvider({
    id: PROVIDER_ID,
    name: DISPLAY_NAME,
    baseUrl: baseURL,
    auth: harnessApiKeyAuth(),
    models: [...models],
    api: {
      'anthropic-messages': anthropicMessagesApi(),
      'openai-completions': openAICompletionsApi(),
      'openai-responses': openAIResponsesApi(),
    },
  })
}

/**
 * TTL-cached resolution of the served catalog. Concurrent callers share one
 * in-flight fetch; a completed snapshot serves unchanged until the refresh
 * interval elapses, so one stream call never observes two catalog generations.
 */
export class OpencodeGoCatalog {
  private served: CatalogSnapshot | undefined
  private pending: Promise<CatalogSnapshot> | undefined

  /**
   * @param baseURL - The endpoint the gateway serves; also the listing base.
   * @param refreshMs - How long one live resolution stays authoritative.
   * @param onFallback - Observes a failed live listing and how many curated
   *   models kept serving because of it.
   * @param onOmitted - Observes live ids the curated table cannot route.
   */
  constructor(
    private readonly baseURL: string,
    private readonly refreshMs: number,
    private readonly onFallback: (detail: { url: string; error: unknown; kept: number }) => void,
    private readonly onOmitted: (ids: readonly string[]) => void,
  ) {}

  /**
   * The current catalog, fetching when expired or never fetched.
   * @returns the snapshot now serving, shared by concurrent callers.
   */
  snapshot(): Promise<CatalogSnapshot> {
    if (this.served !== undefined && Date.now() - this.served.fetchedAtMs < this.refreshMs) {
      return Promise.resolve(this.served)
    }
    this.pending ??= this.build()
      .then((snapshot) => {
        this.served = snapshot
        return snapshot
      })
      .finally(() => {
        this.pending = undefined
      })
    return this.pending
  }

  /** One resolution: intersect the curated table with the live listing. */
  private async build(): Promise<CatalogSnapshot> {
    const curated = curatedModels(this.baseURL)
    let liveIds: readonly string[] | undefined
    let failure: unknown
    try {
      liveIds = await fetchLiveModelIds(this.baseURL)
    } catch (error: unknown) {
      failure = error
    }
    if (liveIds === undefined) {
      this.onFallback({ url: `${this.baseURL.replace(/\/+$/, '')}/models`, error: failure, kept: curated.size })
      return {
        models: curated,
        provider: buildProvider(this.baseURL, [...curated.values()]),
        live: false,
        fetchedAtMs: Date.now(),
      }
    }
    const live = new Set(liveIds)
    const omitted = liveIds.filter(id => !curated.has(id))
    if (omitted.length > 0) this.onOmitted(omitted)
    const served = [...curated.values()].filter(model => live.has(model.id))
    return {
      models: new Map(served.map(model => [model.id, model])),
      provider: buildProvider(this.baseURL, served),
      live: true,
      fetchedAtMs: Date.now(),
    }
  }
}

/**
 * Candidate models for the configuration surface's "fetch available models"
 * action: the same live intersection the route would serve, with the curated
 * capacities the listing endpoint does not disclose. Unlike route resolution,
 * discovery fails when the live listing is unreachable: its whole purpose is
 * the live answer, and a stale answer would offer models the gateway retired.
 * @param catalog - The route's catalog resolver.
 * @returns the served models in curated order.
 * @throws LlmError `DISCOVERY_FAILED` when the live listing is unreachable.
 */
export async function discoverCatalogModels(catalog: OpencodeGoCatalog): Promise<readonly LlmDiscoveredModel[]> {
  const snapshot = await catalog.snapshot()
  if (!snapshot.live) {
    throw new LlmError('llm-opencode-go: the live model listing is unreachable; try again later', 'DISCOVERY_FAILED')
  }
  return [...snapshot.models.values()].map(model => ({
    id: model.id,
    name: model.name,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
  }))
}
