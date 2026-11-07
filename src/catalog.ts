/** Shared model discovery, metadata, model capabilities and protocol policy. */
import * as anthropicMessagesApi from 'opencode-go-pi-ai/api/anthropic-messages'
import * as openAICompletionsApi from 'opencode-go-pi-ai/api/openai-completions'
import * as openAIResponsesApi from 'opencode-go-pi-ai/api/openai-responses'
import * as googleGenerativeAI from './google.ts'
import { getSupportedThinkingLevels, createProvider } from 'opencode-go-pi-ai'
import { LlmError, attributionHeaders, type LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import type {
  Api,
  Model,
  ModelThinkingLevel,
  ThinkingBudgets,
  ThinkingLevelMap,
  Provider,
} from './sdk-types.ts'
import {
  type ThinkingBudgetRange,
  normalizeInputModalities,
  validReleaseDate,
  type GoModel,
  DEFAULT_BASE_URL,
  type OpencodeGoConfig,
  DEFAULT_FREE_BASE_URL,
  FREE_DISPLAY_NAME,
  FREE_PROVIDER_ID,
  type ModelSource,
  type GoCatalogSourceStatus,
  sortModels,
  type GoModelCatalog,
  DISPLAY_NAME,
  SDK_PROVIDER_ID,
  MAX_THINKING_BUDGET_TOKENS,
  assertProxyURL,
} from './contracts.ts'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { diagnosticURL, fetchJsonResponse, transportFailure, type ProxyTransport } from './transport.ts'
import { assertBaseURL } from './config.ts'
import { readModelCost } from './pricing.ts'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export const THINKING_LEVELS: readonly ModelThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/** Protocol formats whose switch/budget is understood by pi-ai. */
export const NATIVE_THINKING_FLAGS: ReadonlySet<string> = new Set(['deepseek', 'zai', 'qwen', 'qwen-chat-template'])

const BUDGET_PRESETS = { minimal: 1024, low: 2048, medium: 8192, high: 16384 } as const

/** Expose budgets only when the SDK knows where to serialize a numeric limit. */
export function supportsThinkingBudget(api: Api, compat: Model<Api>['compat']): boolean {
  const options = compat as { forceAdaptiveThinking?: boolean; thinkingTokenBudgetField?: string; supportsThinkingTokenBudget?: boolean } | undefined
  return api === 'google-generative-ai' || (api === 'anthropic-messages' ? options?.forceAdaptiveThinking !== true
    : api === 'openai-completions' && Boolean(options?.thinkingTokenBudgetField || options?.supportsThinkingTokenBudget)
  )
}

export function reasoningBudgetRange(model: Model<Api>): ThinkingBudgetRange | undefined {
  if (!model.reasoning || !model.reasoningBudget) return undefined
  const max = Math.min(model.reasoningBudget.max, model.maxTokens - 1024)
  // A gateway declaring a ceiling below the floor (or a model too small for the
  // floor) has no usable numeric budget; omit the control instead of throwing
  // later, which would make the whole model unresolvable.
  return max >= model.reasoningBudget.min ? { min: model.reasoningBudget.min, max } : undefined
}

export function unsupportedThinkingLevels(): ThinkingLevelMap {
  return Object.fromEntries(THINKING_LEVELS.map(level => [level, null]))
}

/**
 * Selectable reasoning choices, configured budgets included. Configured budgets
 * are user data: unusable entries (outside the model's range, non-integers or
 * above {@link MAX_THINKING_BUDGET_TOKENS}) are dropped rather than throwing,
 * so a stale setting can never make its model unresolvable.
 */
export function reasoningChoices(model: Model<Api>): readonly { id: string; name: string }[] {
  if (!model.reasoning) return []
  const range = reasoningBudgetRange(model)
  const valid = (tokens: number): boolean => range !== undefined && Number.isSafeInteger(tokens)
    && tokens >= range.min && tokens <= range.max && tokens <= MAX_THINKING_BUDGET_TOKENS
  const presets = [...new Set(model.reasoningBudgetPresets ?? [])].filter(valid).sort((a, b) => a - b)
  if (range && model.reasoningControl === 'budget') {
    const choices: { id: string; tokens: number }[] = Object.entries(BUDGET_PRESETS).filter(([, tokens]) => valid(tokens))
      .map(([id, tokens]) => ({ id, tokens }))
    const existing = new Set(choices.map(choice => choice.tokens))
    for (const tokens of new Set(presets.length > 0 || choices.length > 0 ? presets : [range.min])) {
      if (valid(tokens) && !existing.has(tokens)) { choices.push({ id: `budget:${tokens}`, tokens }); existing.add(tokens) }
    }
    const enabled = choices.sort((a, b) => a.tokens - b.tokens)
      .map(({ id, tokens }) => ({ id, name: `${tokens.toLocaleString('en-US')} tokens` }))
    return model.thinkingLevelMap?.off === null ? enabled : [{ id: 'off', name: 'Off' }, ...enabled]
  }
  return [...getSupportedThinkingLevels(model).map(id => ({
    id,
    // Keep the durable high ID of the old switch, but describe its actual meaning.
    name: model.reasoningControl === 'toggle' && id === 'high' ? 'On'
      : `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
  })), ...range === undefined ? [] : presets
    .map(tokens => ({ id: `budget:${tokens}`, name: `${tokens.toLocaleString('en-US')} tokens` }))]
}

export type ReasoningIntent =
  | { kind: 'default' }
  | { kind: 'off' }
  | { kind: 'on' }
  | { kind: 'effort'; level: Exclude<ModelThinkingLevel, 'off'> }
  | { kind: 'budget'; tokens: number; min: number }

/** Clamp a stale or malformed budget selection into the model's usable range. */
function clampThinkingBudget(range: ThinkingBudgetRange, requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return range.min
  return Math.min(Math.max(Math.round(requested), range.min), range.max)
}

/** Called after validation against the model's choices. */
export function reasoningIntent(model: Model<Api>, level: string | undefined): ReasoningIntent {
  if (level === undefined) return { kind: 'default' }
  if (level === 'off') return { kind: 'off' }
  const range = reasoningBudgetRange(model)
  if (range && (model.reasoningControl === 'budget' || level.startsWith('budget:'))) {
    const requested = level.startsWith('budget:') ? Number(level.slice(7))
      : BUDGET_PRESETS[level as keyof typeof BUDGET_PRESETS] as number | undefined
    // A persisted selection can outlive the catalog or its configured presets;
    // degrade to the nearest usable budget instead of failing the request.
    const tokens = requested !== undefined && Number.isSafeInteger(requested) && requested >= range.min && requested <= range.max
      ? requested : clampThinkingBudget(range, requested)
    return { kind: 'budget', min: range.min, tokens }
  }
  return model.reasoningControl === 'toggle' ? { kind: 'on' }
    : { kind: 'effort', level: level as Exclude<ModelThinkingLevel, 'off'> }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

/** Remove only policy fields, keeping SDK rendering/history options and other configuration. */
function withoutKeys(value: unknown, keys: readonly string[]): unknown {
  const source = object(value)
  if (!source) return value
  const result = { ...source }
  for (const key of keys) delete result[key]
  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * The SDK serializes explicit choices. Default must leave all thinking controls
 * to the service; a switch's On must not acquire an invented effort spelling.
 */
export function reasoningRequest(intent: ReasoningIntent): {
  reasoning?: Exclude<ModelThinkingLevel, 'off'>
  thinkingBudgets?: ThinkingBudgets
  onPayload: (payload: unknown) => unknown
} {
  return {
    ...intent.kind === 'effort' ? { reasoning: intent.level }
      : intent.kind === 'budget' ? { reasoning: 'high' as const, thinkingBudgets: { high: intent.tokens } }
        : intent.kind === 'on' ? { reasoning: 'high' as const } : {},
    onPayload(payload) {
      if (intent.kind === 'off' || intent.kind === 'effort') return payload
      const source = object(payload)
      if (!source) return payload
      const body = { ...source }
      if (intent.kind === 'budget') {
        const thinking = object(body.thinking)
        const config = object(body.config)
        const googleThinking = object(config?.thinkingConfig)
        const actual = thinking?.budget_tokens ?? body.thinking_token_budget ?? body.thinking_budget ?? body.thinking_budget_tokens ?? googleThinking?.thinkingBudget
        const ceiling = body.max_tokens ?? body.max_completion_tokens ?? config?.maxOutputTokens
        if (typeof actual !== 'number' || actual < intent.min
          || typeof ceiling === 'number' && actual > ceiling - 1024) {
          throw new LlmError(`opencode-go thinking budget requires at least ${intent.min} tokens of available thinking space`, 'INVALID_REQUEST')
        }
      }
      delete body.reasoning_effort
      body.reasoning = withoutKeys(body.reasoning, ['effort'])
      body.output_config = withoutKeys(body.output_config, ['effort'])
      if (intent.kind === 'default') {
        delete body.thinking
        delete body.enable_thinking
        body.chat_template_kwargs = withoutKeys(body.chat_template_kwargs, ['enable_thinking'])
        // Google's SDK payload nests its policy under config before REST serialization.
        body.config = withoutKeys(body.config, ['thinkingConfig'])
      }
      for (const key of ['reasoning', 'output_config', 'chat_template_kwargs', 'config']) {
        if (body[key] === undefined) delete body[key]
      }
      return body
    },
  }
}

export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'> & { readonly costKnown?: false }

export interface ModelDirectory {
  readonly models: ReadonlyMap<string, Model<Api>>
  readonly details: ReadonlyMap<string, ModelDetails>
  readonly errors: ReadonlyMap<string, string>
  readonly warning?: string
}

function record(value: unknown): Record<string, unknown> { return object(value) ?? {} }

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(`missing or invalid ${field}`)
  return value
}

const PROTOCOLS = {
  'chat-completions': 'openai-completions',
  responses: 'openai-responses',
  messages: 'anthropic-messages',
  'generate-content': 'google-generative-ai',
} as const

/** Official listings own their protocol endpoints; custom gateways keep their prefix. */
export function modelBaseURL(api: Api, baseURL: string, declared?: unknown, source: ModelSource = 'go'): string {
  const base = assertBaseURL(baseURL, source === 'free' ? 'freeBaseURL' : 'baseURL')
  const official = base === (source === 'go' ? DEFAULT_BASE_URL : DEFAULT_FREE_BASE_URL)
  let endpoint = base
  if (official) {
    if (typeof declared === 'string') endpoint = assertBaseURL(declared)
    else {
      const prefix = base.replace(/\/v1$/, '')
      endpoint = api === 'anthropic-messages' ? `${prefix}/anthropic/v1`
        : api === 'google-generative-ai' ? `${prefix}/google/v1beta` : `${prefix}/openai/v1`
    }
  }
  return api === 'anthropic-messages' ? endpoint.replace(/\/v1$/, '') : endpoint
}

function compatibility(api: Api, data: Record<string, unknown>, endpoint: Record<string, unknown>): Model<Api>['compat'] {
  const capabilities = record(data.capabilities)
  const tools = record(capabilities.tools)
  const wire = { ...record(data.compatibility), ...record(endpoint.compatibility) }
  const reasoning = record(capabilities.reasoning)
  const family = `${String(data.family ?? '')} ${String(data.canonical_id ?? '')}`.toLowerCase()
  const system = capabilities.system_updates === true
  const updates = tools.updates === true
  if (api === 'openai-completions') {
    const format = /deepseek|moonshot|kimi|longcat|meituan/.test(family) ? 'deepseek'
      : /zhipu|\bglm/.test(family) ? 'zai' : /qwen|alibaba/.test(family) ? 'qwen' : 'openai'
    const budgetField = ['thinking_budget', 'thinking_budget_tokens', 'thinking_token_budget'].includes(String(wire.thinking_budget_field))
      ? wire.thinking_budget_field as 'thinking_budget' | 'thinking_budget_tokens' | 'thinking_token_budget'
      : object(reasoning.budget) ? 'thinking_token_budget' : undefined
    return {
      supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens',
      supportsReasoningEffort: Array.isArray(reasoning.effort) && reasoning.effort.length > 0,
      supportsStrictMode: tools.strict === true,
      supportsMidConvoSystemMessages: system, supportsMidConvoToolAdditions: updates,
      requiresReasoningContentOnAssistantMessages: wire.reasoning_field === 'reasoning_content',
      thinkingFormat: format,
      ...(budgetField === undefined ? {} : { thinkingTokenBudgetField: budgetField }),
    }
  }
  if (api === 'openai-responses') return {
    sessionAffinityFormat: 'openai-nosession', supportsStrictMode: tools.strict === true,
    supportsMidConvoSystemMessages: system, supportsAdditionalTools: updates,
    supportsMidConvoEffort: capabilities.effort_updates === true,
  }
  if (api === 'anthropic-messages') return {
    forceAdaptiveThinking: reasoning.supported === true && Array.isArray(reasoning.effort) && reasoning.effort.length > 0 && !object(reasoning.budget),
    supportsTemperature: capabilities.temperature !== false,
    supportsStrictTools: tools.strict === true,
    supportsMidConvoSystemMessages: system, supportsMidConvoToolChanges: updates,
    supportsMidConvoEffort: capabilities.effort_updates === true,
    .../qwen|alibaba/.test(family) ? { allowEmptySignature: true } : {},
  }
  return undefined
}

/** Every selectable control must be declared by the gateway and serializable by the SDK. */
function reasoningControls(api: Api, data: Record<string, unknown>, compat: Model<Api>['compat']): Pick<Model<Api>, 'reasoning' | 'thinkingLevelMap' | 'reasoningControl' | 'reasoningBudget'> {
  const reasoning = record(record(data.capabilities).reasoning)
  const map = unsupportedThinkingLevels()
  if (reasoning.supported !== true) return { reasoning: false, thinkingLevelMap: map }
  const efforts = Array.isArray(reasoning.effort) ? reasoning.effort : []
  for (const value of efforts) {
    const level = value === 'none' ? 'off' : value
    if (THINKING_LEVELS.includes(level as ModelThinkingLevel)) map[level as ModelThinkingLevel] = String(value)
  }
  const format = (compat as { thinkingFormat?: string } | undefined)?.thinkingFormat
  const native = api === 'anthropic-messages' || api === 'google-generative-ai' || NATIVE_THINKING_FLAGS.has(format ?? '')
  const budget = object(reasoning.budget)
  const tokenBudget = budget !== undefined && supportsThinkingBudget(api, compat)
  if (efforts.length === 0 && (native && reasoning.toggle === true || tokenBudget)) map.high = 'high'
  if (native && reasoning.toggle === true && map.off === null) delete map.off
  return { reasoning: true, thinkingLevelMap: map,
    reasoningControl: tokenBudget && efforts.length === 0 ? 'budget'
      : native && efforts.length === 0 && reasoning.toggle === true ? 'toggle' : 'effort',
    ...tokenBudget ? { reasoningBudget: {
      min: Math.max(api === 'anthropic-messages' ? 1024 : 1, budget.min === undefined ? 1 : positiveInteger(budget.min, 'reasoning budget minimum')),
      max: budget.max === undefined ? Number.MAX_SAFE_INTEGER : positiveInteger(budget.max, 'reasoning budget maximum'),
    } } : {},
  }
}

/** Valid empty arrays retire models; malformed nonempty documents retain the last snapshot. */
function listingRows(body: unknown, onInvalidRows?: (warning: string) => void): Record<string, unknown>[] {
  const data = record(body).data
  if (!Array.isArray(data)) throw new Error('the model listing has no "data" array')
  const rows: Record<string, unknown>[] = [], invalid: number[] = []
  for (const [index, entry] of data.entries()) {
    const row = record(entry)
    if (typeof row.id === 'string' && row.id.trim().length > 0) rows.push(row)
    else invalid.push(index + 1)
  }
  if (data.length > 0 && rows.length === 0) throw new Error('the nonempty model listing has no valid model ids')
  if (invalid.length > 0) onInvalidRows?.(`Model listing ignored ${invalid.length} of ${data.length} rows with invalid model ids (rows ${invalid.slice(0, 8).join(', ')}${invalid.length > 8 ? ', …' : ''}); the listing may be incomplete`)
  return rows
}

export function readLiveModelIds(body: unknown, onInvalidRows?: (warning: string) => void): readonly string[] {
  return [...new Set(listingRows(body, onInvalidRows).filter(row => row.type === 'chat').map(row => row.id as string))]
}

export function readModelDirectory(body: unknown, baseURL: string, source: ModelSource = 'go'): ModelDirectory {
  const models = new Map<string, Model<Api>>(), details = new Map<string, ModelDetails>(), errors = new Map<string, string>()
  let warning: string | undefined
  for (const data of listingRows(body, value => { warning = value })) {
    if (data.type !== 'chat') continue
    const id = data.id as string, pricing = readModelCost(data.cost)
    if (source === 'free' && !pricing?.free) continue
    if (details.has(id)) continue
    const input = normalizeInputModalities(record(data.modalities).input)
    details.set(id, { deprecated: data.status === 'deprecated' || data.deprecated === true,
      ...validReleaseDate(data.release_date) ? { releaseDate: data.release_date } : {},
      ...input === undefined ? {} : { inputModalities: input },
      ...pricing === undefined ? { costKnown: false } : {},
    })
    try {
      const declaration = record(data.api)
      const selected = Object.keys(declaration).find(key => Object.hasOwn(PROTOCOLS, key) && object(declaration[key])) as keyof typeof PROTOCOLS | undefined
      if (!selected) throw new Error('missing or unsupported model protocol')
      const api = PROTOCOLS[selected], endpoint = record(declaration[selected])
      const modelCapabilities = record(data.capabilities), endpointCapabilities = record(endpoint.capabilities)
      // Controls and request encoding must consume the same normalized capabilities.
      const capabilities = { ...modelCapabilities, ...endpointCapabilities,
        reasoning: { ...record(modelCapabilities.reasoning), ...record(endpointCapabilities.reasoning) },
        tools: { ...record(modelCapabilities.tools), ...record(endpointCapabilities.tools) } }
      const merged = { ...data, capabilities }, compat = compatibility(api, merged, endpoint)
      if (!input?.includes('text')) throw new Error('missing text input modality')
      const controls = reasoningControls(api, merged, compat)
      if (controls.reasoningBudget && controls.reasoningBudget.max < controls.reasoningBudget.min) throw new Error('invalid reasoning budget range')
      models.set(id, {
        id, source, name: typeof data.name === 'string' && data.name.length > 0 ? data.name : id,
        provider: source === 'go' ? SDK_PROVIDER_ID : 'opencode-free', api,
        baseUrl: modelBaseURL(api, baseURL, endpoint.base_url, source), compat,
        ...controls, input: input.filter((modality): modality is 'text' | 'image' => modality === 'text' || modality === 'image'),
        contextWindow: positiveInteger(record(data.limit).context, 'context limit'),
        maxTokens: positiveInteger(record(data.limit).output, 'output limit'),
        cost: pricing?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        ...pricing?.multipliers === undefined ? {} : { multipliers: pricing.multipliers },
      })
    } catch (error) { errors.set(id, error instanceof Error ? error.message : String(error)) }
  }
  return { models, details, errors, ...warning === undefined ? {} : { warning } }
}

export const MODEL_LISTING_MAX_BYTES = 16 * 1024 * 1024
const CACHE_MAX_BYTES = MODEL_LISTING_MAX_BYTES + 4096
const FETCH_TIMEOUT_MS = 30_000
const STALE_WHILE_REVALIDATE_MS = 5 * 60_000

export interface CachedDirectory { readonly body: unknown; readonly etag?: string; readonly savedAtMs: number }

export function catalogCachePath(source: ModelSource = 'go'): string {
  return resolve(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'), 'cache', 'dsh-opencode-go', `${source}.models.json`)
}

export function catalogETag(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 1024 && /^(W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(value) ? value : undefined
}

export async function readCatalogCache(path: string, sourceURL: string): Promise<CachedDirectory | undefined> {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size > CACHE_MAX_BYTES) return undefined
    const chunks: Buffer[] = []; let size = 0
    for await (const chunk of createReadStream(path)) {
      size += (chunk as Buffer).length
      if (size > CACHE_MAX_BYTES) return undefined
      chunks.push(chunk as Buffer)
    }
    const value = record(JSON.parse(Buffer.concat(chunks, size).toString('utf8')))
    if (value.version !== 1 || value.sourceURL !== sourceURL
      || typeof value.savedAtMs !== 'number' || !Number.isSafeInteger(value.savedAtMs) || value.savedAtMs < 0 || value.savedAtMs > Date.now()
      || value.etag !== undefined && catalogETag(value.etag) === undefined) return undefined
    return { body: value.body, savedAtMs: value.savedAtMs, etag: catalogETag(value.etag) }
  } catch { return undefined }
}

export async function writeCatalogCache(path: string, sourceURL: string, value: CachedDirectory): Promise<boolean> {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    const content = JSON.stringify({ version: 1, sourceURL, ...value })
    if (Buffer.byteLength(content) > CACHE_MAX_BYTES) return false
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 })
    await rename(temporary, path)
    return true
  } catch { return false }
  finally { await rm(temporary, { force: true }).catch(() => {}) }
}

export { PROVIDER_ID, DISPLAY_NAME, FREE_PROVIDER_ID, FREE_DISPLAY_NAME, DEFAULT_BASE_URL, DEFAULT_FREE_BASE_URL } from './contracts.ts'

export interface CatalogSnapshot {
  readonly source: ModelSource
  readonly details: ModelDirectory['details']
  readonly models: ReadonlyMap<string, Model<Api>>
  readonly unavailable: ReadonlyMap<string, string>
  readonly provider: Provider
  readonly live: boolean
  readonly failure?: unknown
  readonly warning?: string
  readonly updatedAtMs?: number
  readonly fetchedAtMs: number
}

function waitForSnapshot(pending: Promise<CatalogSnapshot>, signal?: AbortSignal): Promise<CatalogSnapshot> {
  if (!signal) return pending
  return new Promise((resolve, reject) => {
    const abort = (): void => { signal.removeEventListener('abort', abort); reject(new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason })) }
    pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

function buildProvider(baseURL: string, models: readonly Model<Api>[], source: ModelSource): Provider {
  return createProvider({
    id: source === 'go' ? SDK_PROVIDER_ID : 'opencode-free', name: source === 'go' ? DISPLAY_NAME : FREE_DISPLAY_NAME, baseUrl: baseURL,
    auth: { apiKey: { name: 'OpenCode API key', resolve: () => Promise.resolve({ auth: {}, source: 'OpenCode API key' }) } },
    models: [...models], api: {
      'anthropic-messages': anthropicMessagesApi, 'openai-completions': openAICompletionsApi,
      'openai-responses': openAIResponsesApi, 'google-generative-ai': googleGenerativeAI,
    },
  })
}

/** One gateway owns its membership, disk cache, validator, refresh and failure backoff. */
export class OpencodeGoCatalog {
  private served: CatalogSnapshot | undefined
  private pending: Promise<CatalogSnapshot> | undefined
  private initialized: Promise<void> | undefined
  private cached: CachedDirectory | undefined
  private startupCache: CatalogSnapshot | undefined
  private refreshAtMs = 0
  private failures = 0
  private readonly url: string
  private readonly cachePath: string

  constructor(
    private readonly baseURL: string,
    private readonly refreshMs: number,
    private readonly onFallback: (detail: { url: string; error: unknown; kept: number }) => void = () => {},
    private readonly onOmitted: (ids: readonly string[]) => void = () => {},
    private readonly onRefresh: () => void = () => {},
    private readonly fetcher?: typeof globalThis.fetch,
    private readonly onWarning?: (warning: string) => void,
    readonly source: ModelSource = 'go',
  ) {
    this.baseURL = assertBaseURL(baseURL, source === 'go' ? 'baseURL' : 'freeBaseURL')
    this.url = `${this.baseURL}/models`
    this.cachePath = catalogCachePath(source)
  }

  async snapshot(force = false, signal?: AbortSignal): Promise<CatalogSnapshot> {
    if (signal?.aborted) throw new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason })
    await waitForSnapshot((this.initialized ??= this.restore()).then(() => this.served ?? this.empty()), signal)
    if (!force && this.served && Date.now() < this.refreshAtMs) return this.served
    const background = !force && this.startupCache !== undefined && this.served === this.startupCache
    const pending = this.pending ??= this.refresh(!force && this.served !== undefined).finally(() => { this.pending = undefined; this.startupCache = undefined })
    void pending.catch(() => {})
    return background ? this.served! : waitForSnapshot(pending, signal)
  }

  private empty(): CatalogSnapshot {
    return { source: this.source, details: new Map(), models: new Map(), unavailable: new Map(),
      provider: buildProvider(this.baseURL, [], this.source), live: false, fetchedAtMs: Date.now() }
  }

  private build(directory: ModelDirectory, live: boolean, updatedAtMs: number): CatalogSnapshot {
    return { source: this.source, details: directory.details, models: directory.models, unavailable: directory.errors,
      provider: buildProvider(this.baseURL, [...directory.models.values()], this.source), live,
      updatedAtMs, fetchedAtMs: Date.now(), ...directory.warning === undefined ? {} : { warning: directory.warning } }
  }

  private async restore(): Promise<void> {
    const cached = await readCatalogCache(this.cachePath, this.url)
    if (!cached) return
    try {
      this.served = this.build(readModelDirectory(cached.body, this.baseURL, this.source), false, cached.savedAtMs)
      this.startupCache = this.served
      this.cached = cached
    } catch { /* Corrupt or incompatible documents must not send validators. */ }
  }

  private async refresh(notify: boolean): Promise<CatalogSnapshot> {
    let snapshot: CatalogSnapshot
    try {
      const { response, body } = await fetchJsonResponse(this.url, {
        method: 'GET', cache: 'no-cache', headers: { ...attributionHeaders(), accept: 'application/json',
          ...this.cached?.etag === undefined ? {} : { 'if-none-match': this.cached.etag } },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        // Discovery is unauthenticated but must not be steered elsewhere: a
        // redirect to loopback or a metadata address is a failure, not a source.
        redirect: 'error',
      }, MODEL_LISTING_MAX_BYTES, 'gzip', this.fetcher)
      const notModified = response.status === 304 && this.cached !== undefined
      if (!notModified && !response.ok) throw new LlmError(`HTTP ${response.status}`, 'DISCOVERY_FAILED')
      const document = notModified ? this.cached!.body : body
      let directory: ModelDirectory
      try { directory = readModelDirectory(document, this.baseURL, this.source) }
      catch (error) { throw new LlmError(`invalid model listing: ${error instanceof Error ? error.message : 'invalid data'}`, 'DISCOVERY_FAILED', { cause: error }) }
      this.cached = { body: document, savedAtMs: Date.now(),
        etag: catalogETag(response.headers.get('etag')) ?? (notModified ? this.cached?.etag : undefined) }
      snapshot = this.build(directory, true, this.cached.savedAtMs)
      await writeCatalogCache(this.cachePath, this.url, this.cached)
      this.failures = 0
    } catch (error) {
      const detail = error instanceof LlmError ? error.message : error instanceof SyntaxError ? 'invalid JSON response'
        : error instanceof RangeError ? `response exceeds the ${MODEL_LISTING_MAX_BYTES} byte limit` : transportFailure(error)
      const failure = new LlmError(`could not refresh ${diagnosticURL(this.url)}: ${detail}`, 'DISCOVERY_FAILED', { cause: error })
      snapshot = { ...(this.served ?? this.empty()), live: false, failure, fetchedAtMs: Date.now() }
      this.failures = Math.min(this.failures + 1, 5)
      try { this.onFallback({ url: diagnosticURL(this.url), error: failure, kept: snapshot.models.size }) } catch { /* Diagnostics cannot reject discovery. */ }
    }
    this.served = snapshot
    this.refreshAtMs = snapshot.fetchedAtMs + (this.failures === 0 ? this.refreshMs : Math.min(this.refreshMs, 5000 * 2 ** (this.failures - 1), 60_000))
    try {
      if (snapshot.warning && snapshot.live) this.onWarning?.(snapshot.warning)
      if (snapshot.unavailable.size) this.onOmitted([...snapshot.unavailable.keys()])
      if (notify) this.onRefresh()
    } catch { /* Diagnostics cannot reject discovery. */ }
    return snapshot
  }

  async forModel(id: string, signal?: AbortSignal): Promise<CatalogSnapshot> {
    if (signal?.aborted) throw new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason })
    const cached = this.served
    if (cached?.models.has(id) && cached.updatedAtMs !== undefined && Date.now() < cached.updatedAtMs + this.refreshMs + STALE_WHILE_REVALIDATE_MS) {
      void this.snapshot().catch(() => {})
      return cached
    }
    let snapshot = await this.snapshot(false, signal)
    if ((!snapshot.models.has(id) && (snapshot === cached || this.pending !== undefined))
      || this.pending !== undefined && snapshot.updatedAtMs !== undefined && Date.now() >= snapshot.updatedAtMs + this.refreshMs + STALE_WHILE_REVALIDATE_MS) {
      snapshot = await this.snapshot(true, signal)
    }
    if (snapshot.unavailable.has(id)) throw new LlmError(`opencode-go model "${id}" is advertised but cannot be configured: ${snapshot.unavailable.get(id)}; refresh the model list to retry`, 'MODEL_METADATA_UNAVAILABLE')
    if (!snapshot.models.has(id) && !snapshot.live) throw listingError(snapshot)
    return snapshot
  }
}

function listingError(snapshot: CatalogSnapshot): LlmError {
  return new LlmError(`llm-opencode-go: ${snapshot.failure instanceof Error ? snapshot.failure.message : 'the live model listing is unreachable'}; refresh the model list to retry`, 'DISCOVERY_FAILED', { cause: snapshot.failure })
}

function describeCatalog(snapshot: CatalogSnapshot): GoModel[] {
  return sortModels([
    ...[...snapshot.models.values()].map(model => ({ id: model.id, name: model.name, contextWindow: model.contextWindow, maxTokens: model.maxTokens,
      ...reasoningBudgetRange(model) === undefined ? {} : { reasoningBudget: reasoningBudgetRange(model) } })),
    ...[...snapshot.unavailable.keys()].map(id => ({ id, name: id, configurationMissing: true })),
  ].map(model => ({ ...model, source: snapshot.source, ...snapshot.details.get(model.id) })))
}

export async function discoverCatalogModels(catalog: OpencodeGoCatalog): Promise<readonly LlmDiscoveredModel[]> {
  const snapshot = await catalog.snapshot(true)
  if (!snapshot.live) throw listingError(snapshot)
  return describeCatalog(snapshot).map(({ id, name, contextWindow, maxTokens }) => ({ id,
    name: snapshot.unavailable.has(id) ? `${id} (configuration unavailable: ${snapshot.unavailable.get(id)})` : name,
    contextWindow, maxTokens }))
}

export async function discoverSettingsModels(catalog: OpencodeGoCatalog, freeCatalog?: OpencodeGoCatalog): Promise<GoModelCatalog> {
  const snapshots = await Promise.all([catalog.snapshot(true), ...freeCatalog ? [freeCatalog.snapshot(true)] : []])
  const sources: Record<ModelSource, GoCatalogSourceStatus> = { go: {}, free: {} }
  for (const snapshot of snapshots) sources[snapshot.source] = {
    ...snapshot.updatedAtMs === undefined ? {} : { updatedAt: snapshot.updatedAtMs },
    ...snapshot.live ? {} : { error: listingError(snapshot).message },
    ...snapshot.warning === undefined ? {} : { warning: snapshot.warning },
  }
  const errors = snapshots.filter(snapshot => !snapshot.live).map(snapshot => listingError(snapshot).message)
  return { models: snapshots.flatMap(describeCatalog), stale: errors.length > 0, sources,
    ...errors.length > 0 ? { error: errors.join('; ') } : {} }
}

export class GoCatalogManager {
  private readonly current = new Map<ModelSource, { key: string; catalog: OpencodeGoCatalog }>()
  constructor(private readonly options: {
    transport: ProxyTransport
    onFallback?: (detail: { url: string; error: unknown; kept: number }) => void
    onOmitted?: (ids: readonly string[]) => void
    onRefresh?: () => void
    onWarning?: (warning: string) => void
  }) {}

  forConfig(config: OpencodeGoConfig, source: ModelSource = 'go'): OpencodeGoCatalog {
    const baseURL = assertBaseURL(source === 'go' ? config.baseURL : config.freeBaseURL, source === 'go' ? 'baseURL' : 'freeBaseURL')
    const key = JSON.stringify([baseURL, config.refreshMinutes, assertProxyURL(config.proxyURL)])
    if (this.current.get(source)?.key !== key) {
      const catalog = new OpencodeGoCatalog(baseURL, config.refreshMinutes * 60_000, this.options.onFallback, this.options.onOmitted,
        () => { if (this.current.get(source)?.catalog === catalog) this.options.onRefresh?.() },
        this.options.transport.forProxy(config.proxyURL), this.options.onWarning, source)
      this.current.set(source, { key, catalog })
    }
    return this.current.get(source)!.catalog
  }
}

export class GoModelsService extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: {
    catalog: () => OpencodeGoCatalog
    /** Absent while the Free channel is disabled; the directory then omits Free models. */
    freeCatalog?: () => OpencodeGoCatalog | undefined
    onRefresh?: () => void
  }) { super(ctx, 'opencodeGoModels') }

  async read(): Promise<GoModelCatalog> {
    try { return await discoverSettingsModels(this.options.catalog(), this.options.freeCatalog?.()) }
    finally { this.options.onRefresh?.() }
  }
}
