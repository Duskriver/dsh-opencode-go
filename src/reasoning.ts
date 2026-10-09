/** Reasoning controls, user intent, and the boundary to SDK request payloads. */
import { getSupportedThinkingLevels } from 'opencode-go-pi-ai'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { Api, Model, ModelThinkingLevel, ThinkingBudgets, ThinkingLevelMap } from './sdk-types.ts'
import type { ThinkingBudgetRange } from './models-contract.ts'

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
      }
      for (const key of ['reasoning', 'output_config', 'chat_template_kwargs']) {
        if (body[key] === undefined) delete body[key]
      }
      return body
    },
  }
}
