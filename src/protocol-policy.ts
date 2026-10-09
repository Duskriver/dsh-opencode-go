import { LlmError } from '@deepseek-ai/dsh-llm'
import type { Api, Model } from './sdk-types.ts'
import type { OpencodeGoConfig } from './config-contract.ts'
import { modelBaseURL, responsesCompatibility } from './model-metadata.ts'
import { assertProtocolOverrides, RESPONSES_OVERRIDE_MODEL } from './protocol-contract.ts'

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
