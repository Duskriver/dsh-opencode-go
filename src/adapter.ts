/**
 * The OpenCode Go adapter: one route, one catalog, per-request routing header.
 *
 * Every request to the gateway carries two Harness-owned headers: the
 * attribution User-Agent (`deepseek-harness/<version>`), which pi-ai's client
 * lets request headers override, and `x-opencode-session`, which the gateway
 * requires and uses to route a conversation and share its prompt cache. The
 * header value is the request's session id — stable per conversation, so
 * caching and billing attribution stay correct; a request arriving with no
 * session id gets a fresh random value rather than a shared constant, because
 * a constant would merge unrelated traffic into one cache bucket.
 *
 * Multi-turn correctness rides on the shared pi-ai conversion machinery
 * (`toPiContext` reconstructs provider-native replay state from the session
 * log; `toStreamChunks` maps events to seam chunks), so assistant history,
 * tool calls, and usage land in the session log exactly as the generic pi-ai
 * adapter records them. Image content rides the same machinery: models whose
 * catalog entry declares the image modality convert attachments through the
 * durable attachment service, and every other model refuses image content
 * before any provider I/O.
 *
 * @module dsh-llm-opencode-go/adapter
 */

import { randomUUID } from 'node:crypto'
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai'
import type { Api, Model, ModelThinkingLevel } from '@earendil-works/pi-ai'
import {
  LlmAdapter,
  LlmError,
  ReasoningEffortId,
  attributionHeaders,
  contentHasImage,
} from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  ImageAttachmentAccess,
  LlmModelInfo,
  LlmResolvedModelInfo,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { toPiContext, toStreamChunks } from './conversion/index.ts'
import type { PiImageRequestContext } from './conversion/index.ts'
import { idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'
import { PROVIDER_ID, DISPLAY_NAME, OpencodeGoCatalog } from './catalog.ts'
import { assertBaseURL } from './config.ts'
import type { OpencodeGoConfig, OpencodeGoModelLimits } from './config.ts'

/** Apply one request's capacities without changing the shared catalog or its fallbacks. */
function withModelLimit(model: Model<Api>, limits: OpencodeGoModelLimits): Model<Api> {
  const limit = limits[model.id]
  if (limit == null) return model
  return {
    ...model,
    contextWindow: limit.contextWindow ?? model.contextWindow,
    maxTokens: limit.maxTokens ?? model.maxTokens,
  }
}

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

/** Constructor inputs for {@link OpencodeGoAdapter}. */
export interface OpencodeGoAdapterOptions {
  /**
   * The current configuration, re-read at every operation: a settings write
   * reaches the next request without a restart, and one operation never mixes
   * two configuration generations.
   */
  config: () => OpencodeGoConfig
  /** Resolve the route's credential per call; missing must fail loud. */
  resolveApiKey: () => Promise<string | undefined>
  /**
   * Image input machinery; absent refuses image content, which is the posture
   * for direct construction without a durable attachment service behind it.
   */
  imageAccess?: OpencodeGoImageAccess
  /** Observe the catalog falling back to the curated table. */
  onFallback?: (detail: { url: string; error: unknown; kept: number }) => void
  /** Observe live ids the curated table cannot route. */
  onOmitted?: (ids: readonly string[]) => void
  /** Observe assistant history degrading to provider-neutral conversion. */
  onReplayDegrade?: (reason: string) => void
}

/**
 * The `x-opencode-session` value for one request. The gateway accepts any
 * non-empty value but routes and caches by it, so the conversation's stable
 * session id is the value whenever one exists; otherwise a random id keeps
 * unrelated header-only requests out of each other's cache bucket.
 */
function opencodeSessionValue(sessionId: string | undefined): string {
  return sessionId !== undefined && sessionId.length > 0 ? sessionId : randomUUID()
}

/**
 * The single route's adapter. The catalog snapshot freezes at each operation,
 * so a refresh between two requests never mixes model generations inside one
 * call.
 */
export class OpencodeGoAdapter extends LlmAdapter {
  /**
   * One catalog instance per endpoint/refresh pair. A settings write that
   * changes either gets a fresh resolver (and a fresh live-listing fetch) on
   * the next operation; an unchanged configuration keeps its cached snapshot
   * for the whole refresh interval.
   */
  private catalogCache: { key: string; catalog: OpencodeGoCatalog } | undefined

  constructor(private readonly options: OpencodeGoAdapterOptions) {
    super()
  }

  /**
   * The catalog resolver for one configuration, rebuilding on the facts it
   * owns. Public for the plugin's discovery registration, which resolves the
   * current configuration the same way the adapter does.
   * @param config - the endpoint and refresh interval for the raw catalog.
   * @returns the resolver caching catalog values, independent of deployment limits.
   */
  catalogOf(config: OpencodeGoConfig): OpencodeGoCatalog {
    const key = `${config.baseURL}|${String(config.refreshMinutes)}`
    if (this.catalogCache?.key !== key) {
      this.catalogCache = {
        key,
        catalog: new OpencodeGoCatalog(
          assertBaseURL(config.baseURL),
          config.refreshMinutes * 60_000,
          /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
          this.options.onFallback ?? (() => {}),
          /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
          this.options.onOmitted ?? (() => {}),
        ),
      }
    }
    return this.catalogCache.catalog
  }

  override providerInfo(provider: string): { id: string; name: string } {
    return { id: provider, name: DISPLAY_NAME }
  }

  override async listModels(_provider: string): Promise<readonly LlmModelInfo[]> {
    const config = this.options.config()
    const snapshot = await this.catalogOf(config).snapshot(true)
    // DSH resolves every listed model before showing the provider. Unconfigured
    // ids belong in settings discovery diagnostics, not this selectable list.
    return [...snapshot.models.values()]
      .filter(model => config.showDeprecatedModels || !snapshot.details.get(model.id)?.deprecated)
      .map(model => ({
        provider: PROVIDER_ID,
        id: model.id,
        name: model.name,
        inputModalities: [...model.input],
      }))
  }

  override async resolveModel(
    _provider: string,
    model: string,
    _signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    const config = this.options.config()
    const snapshot = await this.catalogOf(config).forModel(model)
    const resolved = snapshot.models.get(model)
    if (resolved === undefined) {
      throw new LlmError(`opencode-go has no model "${model}"`, 'UNKNOWN_MODEL')
    }
    return this.modelInfo(withModelLimit(resolved, config.modelLimits))
  }

  /** Describe one model: capacities plus the reasoning levels it actually offers. */
  private modelInfo(model: Model<Api>): LlmResolvedModelInfo {
    const reasoning: Pick<LlmResolvedModelInfo, 'reasoning'> = {}
    const levels = model.reasoning ? getSupportedThinkingLevels(model) : []
    // Intrinsic reasoning does not imply adjustable efforts. DSH requires a
    // nonempty choices list whenever reasoning controls are exposed.
    if (levels.length > 0) {
      reasoning.reasoning = {
        efforts: levels.map(level => ({
          id: ReasoningEffortId(level),
          name: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
        })),
      }
    }
    return {
      provider: PROVIDER_ID,
      id: model.id,
      name: model.name,
      inputModalities: [...model.input],
      context: { contextWindow: model.contextWindow },
      ...reasoning,
    }
  }

  /** Validate an explicit effort against the model's own levels, without clamping. */
  private resolveReasoningLevel(
    model: Model<Api>,
    effort: GenerateOptions['reasoningEffort'],
  ): ModelThinkingLevel | undefined {
    if (effort === undefined) return undefined
    const supported = getSupportedThinkingLevels(model)
    if (supported.some(level => level === effort)) return effort as ModelThinkingLevel
    throw new LlmError(
      `opencode-go model "${model.id}" does not support reasoning effort "${effort}"`,
      'UNSUPPORTED_REASONING_EFFORT',
    )
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.stop !== undefined) {
      throw new LlmError('llm-opencode-go does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION')
    }
    const config = this.options.config()
    const snapshot = await this.catalogOf(config).forModel(options.model)
    const advertised = snapshot.models.get(options.model)
    if (advertised === undefined) {
      throw new LlmError(`opencode-go has no model "${options.model}"`, 'UNKNOWN_MODEL')
    }
    const model = withModelLimit(advertised, config.modelLimits)
    const outputLimit = config.modelLimits[model.id]?.maxTokens
    const maxTokens = outputLimit == null ? options.maxTokens : Math.min(options.maxTokens ?? outputLimit, outputLimit)
    const apiKey = await this.options.resolveApiKey()
    if (apiKey === undefined || apiKey.length === 0) {
      throw new LlmError('llm-opencode-go: no credential resolved for the route', 'MISSING_CREDENTIAL')
    }
    const reasoning = this.resolveReasoningLevel(model, options.reasoningEffort)

    const consumer = new AbortController()
    const upstream = options.signal === undefined
      ? consumer.signal
      : AbortSignal.any([options.signal, consumer.signal])
    using watchdog = idleWatchdog(upstream, config.streamIdleTimeoutMs, 'LLM_STREAM_IDLE_TIMEOUT')

    try {
      // Image gate before any provider I/O: only catalog models declaring the
      // image modality accept one, and converting an attachment requires the
      // durable attachment service this adapter was constructed with. The gate
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
          maxRequestImageBytes: config.maxRequestImageBytes,
          requestImagePolicy: {
            maxPixels: config.requestImagePixelBudget,
            maxBytes: config.requestImageMaxBytes,
          },
        }
      }
      // The sync overload converts every message from the session log; the
      // images overload additionally converts attachment references through
      // the mounted attachment service.
      const context = imageRequest === undefined
        ? toPiContext(options, undefined, this.options.onReplayDegrade)
        : await toPiContext({ ...options, signal: watchdog.signal }, imageRequest, this.options.onReplayDegrade)
      const events = snapshot.provider.streamSimple(model, context, {
        apiKey,
        ...reasoning === undefined || reasoning === 'off' ? {} : { reasoning },
        ...options.temperature === undefined ? {} : { temperature: options.temperature },
        ...maxTokens === undefined ? {} : { maxTokens },
        ...options.sessionId === undefined ? {} : { sessionId: String(options.sessionId) },
        signal: watchdog.signal,
        // Harness-owned request identity: the gateway refuses requests without
        // `x-opencode-session` and profiles clients by User-Agent, and
        // attribution merges last in pi-ai's client.
        headers: {
          'x-opencode-session': opencodeSessionValue(options.sessionId === undefined ? undefined : String(options.sessionId)),
          ...attributionHeaders(),
        },
        // The agent recovery layer owns visible attempts; one adapter call is
        // one SDK attempt.
        maxRetries: 0,
      })
      const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id)[Symbol.asyncIterator]()
      let exhausted = false
      try {
        while (true) {
          const result = await watchdog.next(iterator)
          if (timeoutOf(watchdog.signal, 'LLM_STREAM_IDLE_TIMEOUT') !== undefined) {
            throw new LlmError('opencode-go stream idle timeout', 'TIMEOUT')
          }
          if (result.done) {
            exhausted = true
            return
          }
          yield result.value
        }
      } finally {
        if (!exhausted) {
          consumer.abort('opencode-go stream consumer stopped')
          try {
            await iterator.return(undefined)
          } catch (_abortedSdkTeardown) {
            // The stable signal already owns SDK termination; return-time abort cannot add an outcome.
          }
        }
      }
    } catch (error: unknown) {
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
