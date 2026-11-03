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
  ModelCost,
  Provider,
} from './sdk-types.ts'
import {
  type ThinkingBudgetRange,
  normalizeInputModalities,
  validReleaseDate,
  type GoModel,
  DEFAULT_BASE_URL,
  migrateGatewayBaseURL,
  type OpencodeGoConfig,
  assertProtocolOverrides,
  RESPONSES_OVERRIDE_MODEL,
  sortModels,
  type GoModelCatalog,
  DISPLAY_NAME,
  SDK_PROVIDER_ID,
  assertProxyURL,
} from './contracts.ts'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { OPENCODE_GO_MODELS } from 'opencode-go-pi-ai/providers/opencode-go.models'
import { diagnosticURL, fetchJsonResponse, transportFailure, type ProxyTransport } from './transport.ts'
import { assertBaseURL } from './config.ts'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export const THINKING_LEVELS: readonly ModelThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/** Protocol formats whose switch/budget is understood by pi-ai. */
export const NATIVE_THINKING_FLAGS: ReadonlySet<string> = new Set(['deepseek', 'zai', 'qwen', 'qwen-chat-template'])

const BUDGET_PRESETS = { minimal: 1024, low: 2048, medium: 8192, high: 16384 } as const

/** Expose budgets only when the SDK knows where to serialize a numeric limit. */
export function supportsThinkingBudget(api: Api, compat: Model<Api>['compat']): boolean {
  const options = compat as { forceAdaptiveThinking?: boolean; thinkingTokenBudgetField?: string; supportsThinkingTokenBudget?: boolean } | undefined
  return api === 'anthropic-messages' ? options?.forceAdaptiveThinking !== true
    : api === 'openai-completions' && Boolean(options?.thinkingTokenBudgetField || options?.supportsThinkingTokenBudget)
}

export function reasoningBudgetRange(model: Model<Api>): ThinkingBudgetRange | undefined {
  if (!model.reasoning || !model.reasoningBudget) return undefined
  return { min: model.reasoningBudget.min, max: Math.min(model.reasoningBudget.max, model.maxTokens - 1024) }
}

export function unsupportedThinkingLevels(): ThinkingLevelMap {
  return Object.fromEntries(THINKING_LEVELS.map(level => [level, null]))
}

/** Exact model/protocol controls verified against OpenCode Go. */
export function withGatewayReasoning(model: Model<Api>): Model<Api> {
  if (model.reasoning && model.reasoningControl === undefined && model.api === 'anthropic-messages'
    && supportsThinkingBudget(model.api, model.compat)) {
    return { ...model, reasoningControl: 'budget', reasoningBudget: { min: 1024, max: Number.MAX_SAFE_INTEGER } }
  }
  if (model.id !== 'mimo-v2.6-flash' || model.api !== 'openai-completions' || !model.reasoning) return model
  return { ...model, reasoningControl: 'effort', thinkingLevelMap: {
    ...unsupportedThinkingLevels(), off: 'none', low: 'low', medium: 'medium', high: 'high',
  } }
}

export function reasoningChoices(model: Model<Api>): readonly { id: string; name: string }[] {
  if (!model.reasoning) return []
  const range = reasoningBudgetRange(model)
  const presets = model.reasoningBudgetPresets ?? []
  const valid = (tokens: number): boolean => range !== undefined && Number.isSafeInteger(tokens) && tokens >= range.min && tokens <= range.max
  if (range && presets.some(tokens => !valid(tokens))) {
    throw new LlmError(`opencode-go model "${model.id}" thinking budgets must be integers between ${range.min} and ${range.max} tokens`, 'INVALID_REQUEST')
  }
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
  })), ...range === undefined ? [] : [...new Set(presets)].sort((a, b) => a - b)
    .map(tokens => ({ id: `budget:${tokens}`, name: `${tokens.toLocaleString('en-US')} tokens` }))]
}

export type ReasoningIntent =
  | { kind: 'default' }
  | { kind: 'off' }
  | { kind: 'on' }
  | { kind: 'effort'; level: Exclude<ModelThinkingLevel, 'off'> }
  | { kind: 'budget'; tokens: number; min: number }

/** Called after validation against the model's choices. */
export function reasoningIntent(model: Model<Api>, level: string | undefined): ReasoningIntent {
  if (level === undefined) return { kind: 'default' }
  if (level === 'off') return { kind: 'off' }
  const range = reasoningBudgetRange(model)
  if (range && (model.reasoningControl === 'budget' || level.startsWith('budget:'))) return { kind: 'budget', min: range.min,
    tokens: level.startsWith('budget:') ? Number(level.slice(7)) : BUDGET_PRESETS[level as keyof typeof BUDGET_PRESETS] }
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
        const actual = thinking?.budget_tokens ?? body.thinking_token_budget ?? body.thinking_budget ?? body.thinking_budget_tokens
        const ceiling = body.max_tokens ?? body.max_completion_tokens
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

export const MODEL_METADATA_URL = 'https://models.dev/api.json'

/** Lifecycle and capability data the online catalog adds to a gateway listing. */
export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'> & {
  /**
   * Present only when the upstream cost block is missing or carries a malformed
   * component: its zeros are then indistinguishable from a genuinely free model,
   * so analytics must treat the model as unpriced instead of pricing it at 0.
   * A published block with legal components stays unmarked even when all zero.
   */
  readonly costKnown?: false
}

export interface ModelMetadata {
  readonly models: ReadonlyMap<string, Model<Api>>
  readonly details: ReadonlyMap<string, ModelDetails>
  readonly errors: ReadonlyMap<string, string>
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`missing or invalid ${field}`)
  }
  return value
}

function rates(value: unknown): ModelCost {
  const cost = record(value)
  const rate = (key: string): number => {
    const value = cost[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
  }
  return { input: rate('input'), output: rate('output'), cacheRead: rate('cache_read'), cacheWrite: rate('cache_write') }
}

/**
 * Whether upstream published a usable cost block. The block itself must be an
 * object (a fabricated `{}` for a missing or non-object block reads as a free
 * model), and every rate component must be absent — absent folds to 0 so a
 * partially published free row keeps its pricing — or a finite non-negative
 * number. This is the analytics-side "price is known" judgment: a published
 * block with legal components is known even when all of its rates are zero.
 */
function costRatesKnown(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const cost = value as Record<string, unknown>
  const legal = (rate: unknown): boolean =>
    rate === undefined || typeof rate === 'number' && Number.isFinite(rate) && rate >= 0
  return legal(cost.input) && legal(cost.output) && legal(cost.cache_read) && legal(cost.cache_write)
}

/** Missing controls must not turn into SDK-default effort levels the gateway never advertised. */
function reasoningControls(id: string, api: Api, metadata: Record<string, unknown>, known?: Model<Api>): Pick<Model<Api>, 'thinkingLevelMap' | 'reasoningControl' | 'reasoningBudget'> {
  // A family can share wire quirks without sharing selectable effort levels.
  if (!Array.isArray(metadata.reasoning_options) && known?.id === id && known.thinkingLevelMap !== undefined) {
    return { thinkingLevelMap: known.thinkingLevelMap, reasoningControl: known.reasoningControl ?? 'effort',
      ...known.reasoningBudget === undefined ? {} : { reasoningBudget: known.reasoningBudget } }
  }
  const map = unsupportedThinkingLevels()
  const options = (Array.isArray(metadata.reasoning_options) ? metadata.reasoning_options : []).map(record)
  const efforts = options.filter(option => option.type === 'effort' && Array.isArray(option.values))
  for (const option of efforts) {
    for (const value of option.values as unknown[]) {
      const level = value === 'none' ? 'off' : value
      if (THINKING_LEVELS.includes(level as ModelThinkingLevel)) map[level as ModelThinkingLevel] = String(value)
    }
  }
  const format = (known?.compat as { thinkingFormat?: string } | undefined)?.thinkingFormat
  const native = api === 'anthropic-messages' || NATIVE_THINKING_FLAGS.has(format ?? '')
  const toggle = options.some(option => option.type === 'toggle')
  const budget = options.find(option => option.type === 'budget_tokens')
  const tokenBudget = budget !== undefined && supportsThinkingBudget(api, known?.compat)
  // The SDK represents a native switch/budget's enabled state with high. That
  // is not evidence that an OpenAI-compatible endpoint accepts effort "high".
  if (native && efforts.length === 0 && (toggle || budget)) map.high = 'high'
  const enabled = Object.entries(map).some(([level, wire]) => level !== 'off' && typeof wire === 'string')
  if (native && (toggle || (enabled && known?.reasoning)) && known?.thinkingLevelMap?.off !== null && map.off === null) {
    // An absent Off key advertises the native disable flag without inventing
    // an effort spelling. Empty control lists never reach this branch.
    delete map.off
  } else if (enabled && known?.id === id && known.reasoning && typeof known.thinkingLevelMap?.off === 'string') {
    map.off ??= known.thinkingLevelMap.off
  }
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  return { thinkingLevelMap: map,
    reasoningControl: tokenBudget && efforts.length === 0 ? 'budget' : native && efforts.length === 0 && (toggle || budget) ? 'toggle' : 'effort',
    ...tokenBudget ? { reasoningBudget: {
      min: Math.max(api === 'anthropic-messages' ? 1024 : 1, positive(budget.min) ? budget.min : 1),
      max: positive(budget.max) ? budget.max : Number.MAX_SAFE_INTEGER,
    } } : {},
  }
}

/** Select documented official protocol endpoints while preserving custom gateway prefixes. */
export function modelBaseURL(api: Api, baseURL: string): string {
  const base = migrateGatewayBaseURL(baseURL).replace(/\/+$/, '')
  if (base === DEFAULT_BASE_URL) {
    const gateway = base.replace(/\/v1$/, '')
    switch (api) {
      case 'openai-completions':
      case 'openai-responses': return `${gateway}/openai/v1`
      // The Anthropic SDK adds /v1/messages; the other SDKs append only their resource path.
      case 'anthropic-messages': return `${gateway}/anthropic`
      case 'google-generative-ai': return `${gateway}/google/v1beta`
    }
  }
  return api === 'anthropic-messages' ? base.replace(/\/v1$/, '') : base
}

/** Shared Responses defaults for declared models and explicit protocol overrides. */
export function responsesCompatibility(): NonNullable<Model<'openai-responses'>['compat']> {
  return { sessionAffinityFormat: 'openai-nosession' }
}

/**
 * Only read the opencode-go record. Online endpoints, headers and credentials
 * are deliberately ignored: protocol endpoints are selected on the configured gateway.
 * A bad entry is isolated instead of discarding every other model.
 */
export function readModelMetadata(body: unknown, baseURL: string, builtin: ReadonlyMap<string, Model<Api>>): ModelMetadata {
  const provider = record(record(body)['opencode-go'])
  if (provider.models === null || typeof provider.models !== 'object' || Array.isArray(provider.models)) {
    throw new Error('models.dev has no opencode-go models object')
  }
  const entries = record(provider.models)
  const models = new Map<string, Model<Api>>()
  const errors = new Map<string, string>()
  const details = new Map<string, ModelDetails>()
  for (const [id, value] of Object.entries(entries)) {
    const data = record(value)
    const inputModalities = normalizeInputModalities(record(data.modalities).input)
    details.set(id, { deprecated: data.status === 'deprecated',
      ...(validReleaseDate(data.release_date) ? { releaseDate: data.release_date } : {}),
      ...(inputModalities === undefined ? {} : { inputModalities }),
      ...(costRatesKnown(data.cost) ? {} : { costKnown: false }) })
    try {
      const metadata = record(value)
      const npm = record(metadata.provider).npm ?? provider.npm
      const api = npm === '@ai-sdk/anthropic' ? 'anthropic-messages'
        : npm === '@ai-sdk/openai' ? 'openai-responses'
          : npm === '@ai-sdk/openai-compatible' ? 'openai-completions'
            : npm === '@ai-sdk/google' ? 'google-generative-ai' : undefined
      if (api === undefined) throw new Error(`unsupported model protocol ${String(npm)}`)
      const limit = record(metadata.limit)
      const input = record(metadata.modalities).input
      if (!Array.isArray(input) || !input.includes('text')) throw new Error('missing text input modality')
      if (typeof metadata.reasoning !== 'boolean') throw new Error('missing reasoning capability')
      // Retain established wire quirks, including those of a declared family,
      // while taking names, capacities, modalities and protocol from live data.
      const exact = builtin.get(id)
      const family = typeof metadata.family === 'string'
        ? Object.keys(entries).find(key => record(entries[key]).family === metadata.family && builtin.get(key)?.api === api)
        : undefined
      const known = exact?.api === api ? exact : family === undefined ? undefined : builtin.get(family)
      const compat = api === 'openai-completions'
        ? { supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens' as const,
            ...(record(metadata.interleaved).field === 'reasoning_content' ? { requiresReasoningContentOnAssistantMessages: true } : {}),
            ...known?.compat }
        : api === 'openai-responses'
          ? { ...responsesCompatibility(), ...known?.compat }
          : { ...known?.compat }
      const cost = rates(metadata.cost)
      const tiers = record(metadata.cost).tiers
      if (Array.isArray(tiers)) {
        cost.tiers = tiers.flatMap(item => {
          const tier = record(record(item).tier)
          return tier.type === 'context' && typeof tier.size === 'number' && Number.isSafeInteger(tier.size) && tier.size > 0
            ? [{ ...rates(item), inputTokensAbove: tier.size }] : []
        }).sort((a, b) => a.inputTokensAbove - b.inputTokensAbove)
      }
      models.set(id, withGatewayReasoning({
        id,
        name: typeof metadata.name === 'string' && metadata.name.length > 0 ? metadata.name : id,
        provider: 'opencode-go', api, baseUrl: modelBaseURL(api, baseURL),
        reasoning: metadata.reasoning,
        ...reasoningControls(id, api, metadata, known),
        input: input.includes('image') ? ['text', 'image'] : ['text'],
        contextWindow: positiveInteger(limit.context, 'context limit'),
        maxTokens: positiveInteger(limit.output, 'output limit'),
        cost, compat,
      }))
    } catch (error) {
      errors.set(id, error instanceof Error ? error.message : String(error))
    }
  }
  return { models, errors, details }
}

export const MODEL_METADATA_MAX_BYTES = 16 * 1024 * 1024

// The envelope adds a small amount to the bounded HTTP document.
const CACHE_MAX_BYTES = MODEL_METADATA_MAX_BYTES + 4096

export interface CachedMetadata {
  readonly body: unknown
  readonly etag?: string
  /** Last successful download or HTTP 304 verification. */
  readonly savedAtMs: number
}

export function metadataCachePath(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return resolve(home, 'cache', 'dsh-opencode-go', 'models.dev.api.json')
}

/** Only persist validators that can safely become an HTTP request header. */
export function metadataETag(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 1024 && /^(W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(value)
    ? value : undefined
}

export async function readMetadataCache(path: string): Promise<CachedMetadata | undefined> {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size > CACHE_MAX_BYTES) return undefined
    const chunks: Buffer[] = []
    let size = 0
    // Bound actual bytes as well as stat: another process can replace/grow the file.
    for await (const chunk of createReadStream(path)) {
      const bytes = chunk as Buffer
      size += bytes.length
      if (size > CACHE_MAX_BYTES) return undefined
      chunks.push(bytes)
    }
    const value = JSON.parse(Buffer.concat(chunks, size).toString('utf8')) as Record<string, unknown> | null
    if (!value || value.version !== 1 || value.sourceURL !== MODEL_METADATA_URL
      || typeof value.savedAtMs !== 'number' || !Number.isSafeInteger(value.savedAtMs)
      || value.savedAtMs < 0 || value.savedAtMs > Date.now()
      || (value.etag !== undefined && metadataETag(value.etag) === undefined)) return undefined
    return { body: value.body, savedAtMs: value.savedAtMs, etag: metadataETag(value.etag) }
  } catch {
    // Missing, unreadable or corrupt caches behave like the first launch.
    return undefined
  }
}

export async function writeMetadataCache(path: string, value: CachedMetadata): Promise<boolean> {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    const content = JSON.stringify({ version: 1, sourceURL: MODEL_METADATA_URL, ...value })
    if (Buffer.byteLength(content) > CACHE_MAX_BYTES) return false
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 })
    await rename(temporary, path)
    return true
  } catch {
    // Persistence cannot turn a successful online refresh into a catalog failure.
    return false
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

/** Resolve a request's wire model without mutating the shared metadata catalog. */
export function withProtocolOverride(model: Model<Api>, config: OpencodeGoConfig): Model<Api> {
  assertProtocolOverrides(config.protocolOverrides)
  if (model.id !== RESPONSES_OVERRIDE_MODEL || config.protocolOverrides?.[model.id] !== 'openai-responses') return model
  if (model.api === 'openai-responses') return model
  // Only the advertised effort controls are portable between these endpoints.
  // A future native toggle/budget or protocol change needs fresh validation.
  if (model.api !== 'openai-completions' || (model.reasoningControl !== undefined && model.reasoningControl !== 'effort')
    || model.reasoningBudget !== undefined) {
    throw new LlmError(`opencode-go cannot apply the experimental Responses override to ${model.id}'s current protocol/reasoning controls`, 'UNSUPPORTED_OPTION')
  }
  return {
    ...model, api: 'openai-responses', baseUrl: modelBaseURL('openai-responses', config.baseURL),
    // Chat-specific replay and parameter quirks must not cross the protocol boundary.
    compat: responsesCompatibility(),
  }
}

export { PROVIDER_ID, DISPLAY_NAME } from './contracts.ts'

export { DEFAULT_BASE_URL } from './contracts.ts'

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

async function fetchLiveModelIds(baseURL: string, fetcher?: typeof globalThis.fetch): Promise<{ ids: readonly string[]; warning?: string }> {
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
  ) {
    this.baseURL = migrateGatewayBaseURL(baseURL)
  }

  snapshot(force = false, signal?: AbortSignal): Promise<CatalogSnapshot> {
    if (signal?.aborted) {
      return Promise.reject(new LlmError('opencode-go catalog request aborted by caller', 'ABORTED', { cause: signal.reason }))
    }
    return waitForSnapshot(this.served === undefined ? this.readSnapshot(force) : this.currentSnapshot(force), signal)
  }

  private async restoreMetadata(): Promise<void> {
    await (async () => {
      const saved = await readMetadataCache(this.cachePath)
      if (saved === undefined) return false
      try {
        // Re-convert raw public metadata for this gateway and the currently installed SDK.
        this.metadata = await readModelMetadata(saved.body, this.baseURL, builtinModels(this.baseURL))
        this.metadataBody = saved.body
        this.metadataETag = saved.etag
        this.metadataUpdatedAtMs = saved.savedAtMs
        return true
      } catch {
        // A document from an incompatible or corrupt cache must not send its validator.
        return false
      }
    })()
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
    this.pending = (async () => {
      const builtin = builtinModels(this.baseURL)
      const listing = settled((async () => ({
        ...await fetchLiveModelIds(this.baseURL, this.fetcher),
        updatedAtMs: Date.now(),
      }))())
      const restored = this.metadata
      if (!force && this.served === undefined && restored !== undefined) {
        const status: MetadataStatus = { metadataLive: false, metadataUpdatedAtMs: this.metadataUpdatedAtMs }
        this.cachedPending = (async () => {
          const snapshot = this.build(builtin, await listing, restored, status)
          this.served = snapshot
          return snapshot
        })()
      }
      const notify = this.cachedPending !== undefined || (!force && this.served !== undefined)
      // Wait for the early snapshot before committing, even if the metadata response is faster.
      const [listingResult, result] = await Promise.all([
        listing,
        settled(this.refreshMetadata(builtin)),
        this.cachedPending,
      ])
      const snapshot = await this.build(builtin, listingResult,
        result.status === 'fulfilled' ? result.value : this.metadata, {
          metadataLive: result.status === 'fulfilled',
          ...this.metadataUpdatedAtMs === undefined ? {} : { metadataUpdatedAtMs: this.metadataUpdatedAtMs },
          ...result.status === 'rejected' ? { metadataFailure: result.reason } : {},
        })
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
    })().finally(() => { this.pending = undefined; this.cachedPending = undefined })
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
      metadata = await readModelMetadata(body, this.baseURL, builtin)
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

/** One mount owns discovery; inference, settings and pickers share its snapshots. */
export class GoCatalogManager {
  private current: { key: string; catalog: OpencodeGoCatalog } | undefined

  constructor(private readonly options: {
    transport: ProxyTransport
    onFallback?: (detail: { url: string; error: unknown; kept: number }) => void
    onOmitted?: (ids: readonly string[]) => void
    onRefresh?: () => void
    onWarning?: (warning: string) => void
  }) {}

  forConfig(config: OpencodeGoConfig): OpencodeGoCatalog {
    const baseURL = assertBaseURL(config.baseURL)
    const key = JSON.stringify([baseURL, config.refreshMinutes, assertProxyURL(config.proxyURL)])
    if (this.current?.key !== key) {
      const catalog = new OpencodeGoCatalog(
        baseURL, config.refreshMinutes * 60_000,
        this.options.onFallback ?? (() => {}), this.options.onOmitted ?? (() => {}),
        () => {
          if (this.current?.catalog === catalog) this.options.onRefresh?.()
        },
        this.options.transport.forProxy(config.proxyURL), this.options.onWarning,
      )
      this.current = { key, catalog }
    }
    return this.current.catalog
  }
}

/** Uses the same gateway snapshot as the adapter, including models hidden from pickers. */
export class GoModelsService extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: {
    catalog: () => OpencodeGoCatalog
    onRefresh?: () => void
  }) {
    super(ctx, 'opencodeGoModels')
  }

  async read(): Promise<GoModelCatalog> {
    try {
      return await discoverSettingsModels(this.options.catalog())
    } finally {
      // Settings and pickers consume the same freshly committed or retained snapshot.
      this.options.onRefresh?.()
    }
  }
}
