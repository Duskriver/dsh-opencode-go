/** Gateway reasoning controls shared by live metadata, fallbacks and requests. */
import type { Api, Model, ModelThinkingLevel, ThinkingLevelMap } from 'opencode-go-pi-ai'

export const THINKING_LEVELS: readonly ModelThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
/** Formats that explicitly disable thinking when no SDK effort is supplied. */
export const NATIVE_THINKING_FLAGS: ReadonlySet<string> = new Set(['deepseek', 'zai', 'qwen', 'qwen-chat-template'])

export function unsupportedThinkingLevels(): ThinkingLevelMap {
  return Object.fromEntries(THINKING_LEVELS.map(level => [level, null]))
}

/** Exact model/protocol rules verified against OpenCode Go, never inherited by a family. */
export function withGatewayReasoning(model: Model<Api>): Model<Api> {
  // The gateway's catalog omits these controls. Live probes on 2026-10-02
  // confirmed default reasoning, none to disable, and accepted low/medium/high.
  if (model.id !== 'mimo-v2.6-flash' || model.api !== 'openai-completions' || !model.reasoning) return model
  return { ...model, thinkingLevelMap: {
    ...unsupportedThinkingLevels(), off: 'none', low: 'low', medium: 'medium', high: 'high',
  } }
}

/** An unset OpenAI effort preserves the provider default; explicit Off retains its wire value. */
export function withRequestReasoning(model: Model<Api>, level: ModelThinkingLevel | undefined): Model<Api> {
  const format = (model.compat as { thinkingFormat?: string } | undefined)?.thinkingFormat
  if (level !== undefined || model.api !== 'openai-completions'
    || (format !== undefined && format !== 'openai')
    || typeof model.thinkingLevelMap?.off !== 'string') return model
  // pi-ai reads the Off mapping even when no effort was requested. Suppress it
  // on this request only, keeping the shared picker map and native flags intact.
  return { ...model, thinkingLevelMap: { ...model.thinkingLevelMap, off: null } }
}
