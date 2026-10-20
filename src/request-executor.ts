/** Execute one captured account request; the adapter owns dispatch and fallback. */
import { normalizeContext } from 'opencode-go-pi-ai'
import { LlmError, attributionHeaders, contentHasImage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, ImageAttachmentAccess, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { deadline, idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'
import type { Api, Model, Provider } from './sdk-types.ts'
import type { OpencodeGoConfig } from './config.ts'
import { DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS } from './config.ts'
import { toPiContext, toStreamChunks } from './conversion/index.ts'
import type { PiImageRequestContext } from './conversion/index.ts'
import { ImagePayloadLease } from './conversion/image-pool.ts'
import { GatewayDiagnostics } from './gateway-diagnostics.ts'
import { reasoningChoices, reasoningIntent, reasoningRequest } from './reasoning.ts'
import { requestMaxTokens } from './request-budget.ts'
import { waitWithSignal } from './request-control.ts'
import type { ProxyTransport } from './proxy.ts'
import type { CallTrace } from './call-trace.ts'

/**
 * The attachment-service bridges one image request reads. Construction-time
 * (context-dependent); the config-dependent policy numbers are merged per
 * request from the current configuration.
 */
export interface OpencodeGoImageAccess {
  /** Resolve the optional durable attachment service at request time. */
  resolveAttachments: () => AttachmentStore | undefined
  /** Bridge one attachment reference into the current model-tool execution world. */
  resolveImageAccess: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined
}

/** Host dependencies used by a single attempt, independent of account selection. */
export interface OpencodeGoRequestExecutorOptions {
  /** Resolve the credential reference captured with this call's endpoint; missing must fail loud. */
  resolveApiKey: (config: OpencodeGoConfig, signal?: AbortSignal) => Promise<string | undefined>
  /**
   * Image input machinery; absent refuses image content, which is the posture
   * for direct construction without a durable attachment service behind it.
   */
  imageAccess?: OpencodeGoImageAccess
  /** Optional directory for bounded HTTP error evidence; request contents are omitted. */
  debugDirectory?: () => string | undefined
  /** Observe assistant history degrading to provider-neutral conversion. */
  onReplayDegrade?: (reason: string) => void
}

/** Inputs already resolved by the adapter, including one account and the wire session ID. */
export interface OpencodeGoRequestSnapshot {
  config: OpencodeGoConfig
  model: Model<Api>
  provider: Provider
  sessionId: string
}

/** Validate an explicit effort against the model's own levels, without clamping. */
function resolveReasoningLevel(
  model: Model<Api>,
  effort: GenerateOptions['reasoningEffort'],
): string | undefined {
  if (effort === undefined) return undefined
  const supported = reasoningChoices(model).map(choice => choice.id)
  if (supported.some(level => level === effort)) return effort
  throw new LlmError(
    `opencode-go model "${model.id}" does not support reasoning effort "${effort}"`,
    'UNSUPPORTED_REASONING_EFFORT',
  )
}

/** Shares the adapter's transport without owning its lifetime or retrying accounts. */
export class OpencodeGoRequestExecutor {
  constructor(
    private readonly options: OpencodeGoRequestExecutorOptions,
    private readonly transport: ProxyTransport,
  ) {}

  /** One account, one SDK attempt; host recovery still owns failures after output. */
  async *stream(options: GenerateOptions, snapshot: OpencodeGoRequestSnapshot, trace: CallTrace): AsyncIterable<StreamChunk> {
    if (options.stop !== undefined) {
      throw new LlmError('llm-opencode-go does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION')
    }
    const { config, provider, model, sessionId } = snapshot
    const maxTokens = requestMaxTokens(model, config.modelLimits, options.maxTokens)
    const reasoning = resolveReasoningLevel(model, options.reasoningEffort)

    const consumer = new AbortController()
    const upstream = options.signal === undefined
      ? consumer.signal
      : AbortSignal.any([options.signal, consumer.signal])
    using watchdog = idleWatchdog(upstream, config.streamIdleTimeoutMs, 'LLM_STREAM_IDLE_TIMEOUT')
    using preparation = deadline(watchdog.signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, 'LLM_PREPARATION_TIMEOUT')
    using payloadLease = new ImagePayloadLease(trace.imagePool)

    try {
      const apiKey = await trace.measure('credential', () => waitWithSignal(
        () => this.options.resolveApiKey(config, preparation.signal), preparation.signal,
      ))
      if (!apiKey) throw new LlmError('llm-opencode-go: no credential resolved for the route', 'MISSING_CREDENTIAL')
      // Image gate before any provider I/O: only catalog models declaring the
      // image modality accept one, and converting an attachment requires the
      // durable attachment service this executor was constructed with. The gate
      // rides inside the try so a concurrent caller abort classifies a
      // conversion failure as aborted, like every other conversion fault.
      const containsImage = options.messages.some(message => contentHasImage(message.content))
      if (containsImage && !model.input.includes('image')) {
        throw new LlmError(`opencode-go model "${model.id}" does not support image input`, 'UNSUPPORTED_CONTENT')
      }
      let imageRequest: PiImageRequestContext | undefined
      if (containsImage) {
        const access = this.options.imageAccess
        const store = access?.resolveAttachments()
        if (access === undefined || store === undefined) {
          throw new LlmError('llm-opencode-go image input requires the durable attachment service', 'UNSUPPORTED_CONTENT')
        }
        imageRequest = {
          attachments: store,
          resolveImageAccess: ref => access.resolveImageAccess(store, ref),
          maxImages: config.maxImages ?? undefined,
          maxRequestImageBytes: config.maxRequestImageBytes,
          requestImagePolicy: {
            maxPixels: config.requestImagePixelBudget,
            maxBytes: config.requestImageMaxBytes,
          },
          payloadLease,
          onImagePool: trace.imagePool,
        }
      }
      // The sync overload converts every message from the session log; the
      // images overload additionally converts attachment references through
      // the mounted attachment service.
      const context = await trace.measure('images', () => waitWithSignal(() => imageRequest === undefined
        ? Promise.resolve(toPiContext(options, undefined, this.options.onReplayDegrade))
        : toPiContext({ ...options, signal: preparation.signal }, imageRequest, this.options.onReplayDegrade), preparation.signal))
      preparation[Symbol.dispose]()
      watchdog.signal.throwIfAborted()
      // Direct providers accept a transcript, unlike Models which normalizes
      // Context itself. Preserve prompts and tool declarations on every host.
      const diagnostics = new GatewayDiagnostics({
        provider: String(options.provider), model: model.id, apiKey, proxyURL: config.proxyURL,
        fetch: this.transport.forProxy(config.proxyURL),
        directory: this.options.debugDirectory ? this.options.debugDirectory() : process.env.DSH_OPENCODE_GO_DEBUG_DIR,
        callId: trace.callId, attempt: trace.attempts,
        contextWindow: model.contextWindow,
        onResponse: (status, requestId) => trace.response(status, requestId),
      })
      const events = provider.streamSimple(model, normalizeContext(context), {
        apiKey,
        fetch: diagnostics.fetch,
        ...reasoningRequest(reasoningIntent(model, reasoning)),
        ...options.temperature === undefined ? {} : { temperature: options.temperature },
        ...maxTokens === undefined ? {} : { maxTokens },
        sessionId,
        signal: watchdog.signal,
        // Harness-owned request identity: the gateway refuses requests without
        // `x-opencode-session` and profiles clients by User-Agent, and
        // attribution merges last in pi-ai's client.
        headers: {
          'x-opencode-session': sessionId,
          ...attributionHeaders(),
        },
        // The agent recovery layer owns visible attempts; one adapter call is
        // one SDK attempt.
        maxRetries: 0,
      })
      const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id, options.provider, maxTokens)[Symbol.asyncIterator]()
      let exhausted = false
      try {
        while (true) {
          const result = await trace.measure('stream', () => waitWithSignal(() => watchdog.next(iterator), watchdog.signal))
          if (timeoutOf(watchdog.signal, 'LLM_REQUEST_TIMEOUT')) throw new LlmError('opencode-go whole request timeout', 'TIMEOUT')
          if (timeoutOf(watchdog.signal, 'LLM_STREAM_IDLE_TIMEOUT') !== undefined) {
            throw new LlmError('opencode-go stream idle timeout', 'TIMEOUT')
          }
          if (result.done) {
            exhausted = true
            return
          }
          const chunk = result.value
          if ((chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') && chunk.text.length > 0
            || chunk.type === 'tool-call-delta' && chunk.argumentsDelta.length > 0) trace.firstOutput()
          if (chunk.type === 'finish' && chunk.reason.kind === 'error') {
            const failure = chunk.reason.failure
            const message = await waitWithSignal(() => diagnostics.failureMessage(failure.message), watchdog.signal)
            const code = await waitWithSignal(() => diagnostics.failureCode(failure.code), watchdog.signal)
            yield { ...chunk, reason: options.signal?.aborted
              ? { kind: 'aborted', failure: { code: 'ABORTED', message: 'opencode-go request aborted by caller' } }
              : { ...chunk.reason, failure: { ...chunk.reason.failure, message, code } } }
          } else yield chunk
        }
      } finally {
        if (!exhausted) {
          consumer.abort('opencode-go stream consumer stopped')
          try {
            void iterator.return(undefined).catch(() => {})
          } catch (_abortedSdkTeardown) {
            // The stable signal already owns SDK termination; return-time abort cannot add an outcome.
          }
        }
      }
    } catch (error: unknown) {
      if (timeoutOf(preparation.signal, 'LLM_PREPARATION_TIMEOUT')) {
        throw new LlmError('opencode-go credential/image preparation timeout', 'TIMEOUT', { cause: error })
      }
      if (timeoutOf(watchdog.signal, 'LLM_REQUEST_TIMEOUT')) {
        throw new LlmError('opencode-go whole request timeout', 'TIMEOUT', { cause: error })
      }
      if (timeoutOf(watchdog.signal, 'LLM_STREAM_IDLE_TIMEOUT') !== undefined) {
        throw new LlmError('opencode-go stream idle timeout', 'TIMEOUT', { cause: error })
      }
      if (options.signal?.aborted) {
        throw new LlmError('opencode-go request aborted by caller', 'ABORTED', { cause: error })
      }
      throw error
    }
  }
}
