/** Google SDK serialization with a request-local transport binding. */
import * as google from 'opencode-go-pi-ai/api/google-generative-ai'
import type { Model, SimpleStreamOptions, StreamFunction } from './sdk-types.ts'
import { withGoogleFetch } from './transport.ts'

export const stream: StreamFunction<'google-generative-ai'> = (model, context, options) =>
  withGoogleFetch(options, () => google.stream(model, context, { ...options, fetch: undefined }))

export const streamSimple: StreamFunction<'google-generative-ai', SimpleStreamOptions> = (model, context, options) =>
  withGoogleFetch(options, () => google.streamSimple(model, context, {
    ...options, fetch: undefined,
    async onPayload(payload, wireModel) {
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
