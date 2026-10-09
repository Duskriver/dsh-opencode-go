/** Convert OpenCode's online models.dev metadata into the SDK's three wire protocols. */
import type { Api, Model, ModelCost, ModelThinkingLevel } from './sdk-types.ts'

import { normalizeInputModalities, validReleaseDate, type GoModel } from './models-contract.ts'
import { NATIVE_THINKING_FLAGS, THINKING_LEVELS, supportsThinkingBudget, unsupportedThinkingLevels, withGatewayReasoning } from './reasoning.ts'

export const MODEL_METADATA_URL = 'https://models.dev/api.json'

/** Lifecycle and capability data the online catalog adds to a gateway listing. */
export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'>

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

/** Anthropic's SDK appends /v1/messages; the OpenAI SDKs append paths below /v1. */
export function modelBaseURL(api: Api, baseURL: string): string {
  const base = baseURL.replace(/\/+$/, '')
  return api === 'anthropic-messages' ? base.replace(/\/v1$/, '') : base
}

/** Shared Responses defaults for declared models and explicit protocol overrides. */
export function responsesCompatibility(): NonNullable<Model<'openai-responses'>['compat']> {
  return { sessionAffinityFormat: 'openai-nosession' }
}

/**
 * Only read the opencode-go record. Online endpoints, headers and credentials
 * are deliberately ignored: model traffic always stays on the configured gateway.
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
      ...(inputModalities === undefined ? {} : { inputModalities }) })
    try {
      const metadata = record(value)
      const npm = record(metadata.provider).npm ?? provider.npm
      const api = npm === '@ai-sdk/anthropic' ? 'anthropic-messages'
        : npm === '@ai-sdk/openai' ? 'openai-responses'
          : npm === '@ai-sdk/openai-compatible' ? 'openai-completions' : undefined
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
