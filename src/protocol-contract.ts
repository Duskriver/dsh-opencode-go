/** The supported experimental override surface, shared with the settings UI. */
export const RESPONSES_OVERRIDE_MODEL = 'deepseek-v4.1-flash'
export type GoProtocolOverrides = Partial<Record<typeof RESPONSES_OVERRIDE_MODEL, 'openai-responses' | null>>

/** Null selects catalog routing even when a lower settings layer overrides it. */
export function assertProtocolOverrides(value: unknown): asserts value is GoProtocolOverrides | undefined {
  if (value === undefined) return
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('llm-opencode-go: protocolOverrides must be a model-to-protocol object')
  }
  for (const [model, protocol] of Object.entries(value)) {
    if (model !== RESPONSES_OVERRIDE_MODEL || (protocol !== null && protocol !== 'openai-responses')) {
      throw new Error(`llm-opencode-go: protocolOverrides only supports ${RESPONSES_OVERRIDE_MODEL}: openai-responses (or null for automatic routing)`)
    }
  }
}
