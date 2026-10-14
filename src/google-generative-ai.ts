/** Keep pi-ai's Google serialization/replay while binding our request transport.
 * The build bridge pins its client to Gemini so host Vertex flags cannot change the gateway API.
 */
import * as google from 'opencode-go-pi-ai/api/google-generative-ai'
import { buildBaseOptions } from 'opencode-go-pi-ai/api/simple-options'
import { resolveGoogleThinkingLevel, toGoogleThinkingLevel } from 'opencode-go-pi-ai/api/google-shared'
import { clampThinkingLevel } from 'opencode-go-pi-ai'
import type { SimpleStreamOptions, StreamFunction } from './sdk-types.ts'
import { withGoogleFetch } from './google-fetch.ts'

export const stream: StreamFunction<'google-generative-ai'> = (model, context, options) =>
  withGoogleFetch(options, () => google.stream(model, context, { ...options, fetch: undefined }))

export const streamSimple: StreamFunction<'google-generative-ai', SimpleStreamOptions> = (model, context, options) => {
  // pi-ai 1.2.0 predates Gemini 4 Argon and otherwise sends a token budget.
  // Gemini 4 uses discrete levels; the supported spellings still come from metadata.
  if (!/^gemini-4(?:\.\d+)?-/.test(model.id)) {
    return withGoogleFetch(options, () => google.streamSimple(model, context, { ...options, fetch: undefined }))
  }
  const apiKey = options?.apiKey
  if (!apiKey) throw new Error(`No API key for provider: ${model.provider}`)
  const level = options?.reasoning ? clampThinkingLevel(model, options.reasoning) : 'off'
  const thinking = level === 'off' ? { enabled: false }
    : { enabled: true, level: toGoogleThinkingLevel(resolveGoogleThinkingLevel(model, level)) }
  return withGoogleFetch(options, () => google.stream(model, context, {
    ...buildBaseOptions(model, context, options, apiKey), fetch: undefined,
    toolChoice: options?.toolChoice, thinking,
  }))
}
