/** Google SDK serialization with a request-local transport binding. */
import { lazyStream } from 'opencode-go-pi-ai/api/lazy'
import type { Model, SimpleStreamOptions, StreamFunction } from './sdk-types.ts'
import { withGoogleFetch } from './transport.ts'

type GoogleApi = typeof import('opencode-go-pi-ai/api/google-generative-ai')

let cached: Promise<GoogleApi> | undefined
// A failed import must not poison every later request: drop the rejected
// promise so the next call retries.
const load = (): Promise<GoogleApi> => (cached ??= import('opencode-go-pi-ai/api/google-generative-ai').catch(error => {
  cached = undefined
  throw error
}))

const SKIP_THOUGHT_SIGNATURE = 'skip_thought_signature_validator'

/** Gemini 3+ rejects wholly unsigned tool history; preserve signed parallel turns exactly. */
function addUnsignedToolCallFallbacks(payload: unknown, modelId: string): void {
  const major = /^gemini(?:-live)?-(\d+)(?:-|$)/i.exec(modelId)
  if (major === null || Number(major[1]) < 3 || !payload || typeof payload !== 'object') return
  const contents = (payload as { contents?: unknown }).contents
  if (!Array.isArray(contents)) return
  for (const content of contents) {
    if (!content || typeof content !== 'object') continue
    const parts = (content as { parts?: unknown }).parts
    if (!Array.isArray(parts)) continue
    const calls = parts.filter((part): part is { functionCall: unknown; thoughtSignature?: string } =>
      !!part && typeof part === 'object' && (part as { functionCall?: unknown }).functionCall !== undefined)
    // A native parallel turn signs its first call and can intentionally leave
    // secondary calls bare. Only a wholly unsigned turn needs the public
    // Gemini API's documented validation-bypass sentinel.
    if (calls.some(part => part.thoughtSignature !== undefined)) continue
    for (const part of calls) part.thoughtSignature = SKIP_THOUGHT_SIGNATURE
  }
}

export const stream: StreamFunction<'google-generative-ai'> = (model, context, options) =>
  lazyStream(model, async () => {
    const google = await load()
    return withGoogleFetch(options, () => google.stream(model, context, { ...options, fetch: undefined }))
  })

export const streamSimple: StreamFunction<'google-generative-ai', SimpleStreamOptions> = (model, context, options) =>
  lazyStream(model, async () => {
    const google = await load()
    return withGoogleFetch(options, () => google.streamSimple(model, context, {
      ...options, fetch: undefined,
      async onPayload(payload, wireModel) {
        addUnsignedToolCallFallbacks(payload, model.id)
        const control = (model as Model<'google-generative-ai'>).reasoningControl
        if (!control || !payload || typeof payload !== 'object') return options?.onPayload?.(payload, wireModel)
        const body = payload as { config?: { maxOutputTokens?: number; thinkingConfig?: unknown } }
        const level = options?.reasoning
        const budget = level === 'minimal' || level === 'low' || level === 'medium' || level === 'high'
          ? options?.thinkingBudgets?.[level] : undefined
        // The gateway's declarations own the wire format, including for new IDs
        // or aliases the SDK's model-name heuristics have never seen.
        const thinkingConfig = level === undefined ? { thinkingBudget: 0 }
          : budget !== undefined ? { includeThoughts: true,
              thinkingBudget: Math.min(budget, Math.max(0, (body.config?.maxOutputTokens ?? model.maxTokens) - 1024)) }
            : control === 'toggle' ? { includeThoughts: true }
              : control === 'effort' ? { includeThoughts: true, thinkingLevel: String(model.thinkingLevelMap?.[level] ?? level).toUpperCase() }
                : body.config?.thinkingConfig
        const next = { ...body, config: { ...body.config, thinkingConfig } }
        return await options?.onPayload?.(next, wireModel) ?? next
      },
    }))
  })
