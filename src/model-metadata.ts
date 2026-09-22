/** Convert OpenCode's online models.dev metadata into the SDK's three wire protocols. */
import type { Api, Model, ModelCost, ModelThinkingLevel, ThinkingLevelMap } from '@earendil-works/pi-ai'

import { validReleaseDate, type GoModel } from './models-contract.ts'

export const MODEL_METADATA_URL = 'https://models.dev/api.json'

export interface ModelMetadata {
  readonly models: ReadonlyMap<string, Model<Api>>
  readonly details: ReadonlyMap<string, Pick<GoModel, 'deprecated' | 'releaseDate'>>
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

const LEVELS: readonly ModelThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/** Missing controls must not turn into SDK-default effort levels the gateway never advertised. */
function thinkingLevels(metadata: Record<string, unknown>, known?: Model<Api>): ThinkingLevelMap {
  if (!Array.isArray(metadata.reasoning_options) && known?.thinkingLevelMap !== undefined) return known.thinkingLevelMap
  const map: ThinkingLevelMap = Object.fromEntries(LEVELS.map(level => [level, null]))
  for (const item of Array.isArray(metadata.reasoning_options) ? metadata.reasoning_options : []) {
    const option = record(item)
    if (option.type === 'toggle' || option.type === 'budget_tokens') {
      map.off = 'off'
      map.high = 'high'
    }
    if (option.type !== 'effort' || !Array.isArray(option.values)) continue
    for (const value of option.values) {
      const level = value === 'none' ? 'off' : value
      if (LEVELS.includes(level as ModelThinkingLevel)) map[level as ModelThinkingLevel] = String(value)
    }
  }
  // An established transport may support disabling thinking in addition to the
  // model's advertised effort levels (e.g. DeepSeek's separate thinking flag).
  if (known?.reasoning && known.thinkingLevelMap?.off !== null) map.off ??= known.thinkingLevelMap?.off ?? 'off'
  return map
}

/** Anthropic's SDK appends /v1/messages; the OpenAI SDKs append paths below /v1. */
export function modelBaseURL(api: Api, baseURL: string): string {
  const base = baseURL.replace(/\/+$/, '')
  return api === 'anthropic-messages' ? base.replace(/\/v1$/, '') : base
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
  const details = new Map<string, Pick<GoModel, 'deprecated' | 'releaseDate'>>()
  for (const [id, value] of Object.entries(entries)) {
    const data = record(value)
    details.set(id, { deprecated: data.status === 'deprecated',
      ...(validReleaseDate(data.release_date) ? { releaseDate: data.release_date } : {}) })
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
          ? { sessionAffinityFormat: 'openai-nosession' as const, ...known?.compat }
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
      models.set(id, {
        id,
        name: typeof metadata.name === 'string' && metadata.name.length > 0 ? metadata.name : id,
        provider: 'opencode-go', api, baseUrl: modelBaseURL(api, baseURL),
        reasoning: metadata.reasoning,
        thinkingLevelMap: thinkingLevels(metadata, known),
        input: input.includes('image') ? ['text', 'image'] : ['text'],
        contextWindow: positiveInteger(limit.context, 'context limit'),
        maxTokens: positiveInteger(limit.output, 'output limit'),
        cost, compat,
      })
    } catch (error) {
      errors.set(id, error instanceof Error ? error.message : String(error))
    }
  }
  return { models, errors, details }
}
