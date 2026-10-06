/**
 * The OpenCode Go adapter: one route, one catalog, per-request routing header.
 *
 * Every request to the gateway carries two Harness-owned headers: the
 * attribution User-Agent (`deepseek-harness/<version>`), which pi-ai's client
 * lets request headers override, and `x-opencode-session`, which the gateway
 * requires and uses to route a conversation and share its prompt cache. The
 * header value is the request's session id, stable across continuation and
 * restore. Actual cache reads remain an upstream usage fact. A request with no
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
import { getSupportedThinkingLevels, normalizeContext } from 'opencode-go-pi-ai'
import type { Api, Model, ModelThinkingLevel } from 'opencode-go-pi-ai'
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
import { PROVIDER_ID, DISPLAY_NAME, OpencodeGoCatalog, type CatalogSnapshot } from './catalog.ts'
import { assertBaseURL } from './config.ts'
import { assertProxyURL } from './proxy-url.ts'
import { ProxyTransport } from './proxy.ts'
import type { OpencodeGoConfig, OpencodeGoModelLimits } from './config.ts'
import { isModelEnabled } from './models-contract.ts'
import { NATIVE_THINKING_FLAGS, withRequestReasoning } from './reasoning.ts'
import { accountsOf, accountRefOf, type GoAccountSwitch } from './accounts.ts'

/** A generic 403/rate limit is not proof that another subscription can help. */
function accountFailureReason(failure: { code: string; message: string }): GoAccountSwitch['reason'] | undefined {
  if (failure.code === 'QUOTA') return 'quota'
  if (failure.code === 'MISSING_CREDENTIAL' || failure.code === 'INVALID_CREDENTIAL'
    || failure.code === 'AUTH' && (/\b401\b/.test(failure.message)
      || /invalid[ _-]?(?:api[ _-]?)?key|incorrect[ _-]?(?:api[ _-]?)?key|expired[ _-]?(?:api[ _-]?)?key/i.test(failure.message))) return 'credential'
  return undefined
}

/** How long the adapter remembers a gateway key rejection before re-checking. */
const REJECTED_KEY_TTL_MS = 5 * 60_000

/** The gateway itself refused the key — a fact worth remembering for a while.
 * A locally missing credential is re-checked for free on every request. */
function isGatewayKeyRejection(failure: { code: string }): boolean {
  return failure.code === 'INVALID_CREDENTIAL' || failure.code === 'AUTH'
}

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
  /** Shared with Host usage reads for this plugin mount. */
  transport?: ProxyTransport
  /**
   * The current configuration, re-read at every operation: a settings write
   * reaches the next request without a restart, and one operation never mixes
   * two configuration generations.
   */
  config: () => OpencodeGoConfig
  /** Resolve the credential reference captured with this call's endpoint; missing must fail loud. */
  resolveApiKey: (config: OpencodeGoConfig) => Promise<string | undefined>
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
  /** Re-read picker models after a background catalog refresh commits. */
  onCatalogRefresh?: () => void
  /**
   * Observe the account a request settled on. `seq` is the request's monotonic
   * sequence, taken when its stream began, so a consumer can tell a late notice
   * from an older request apart from a newer request's outcome.
   */
  onAccountSwitch?: (notice: GoAccountSwitch | undefined, config: OpencodeGoConfig, seq: number) => void
}

/** Configuration, model and provider captured together before dispatch. */
interface OpencodeGoCallSnapshot {
  config: OpencodeGoConfig
  catalog: CatalogSnapshot
  model: Model<Api>
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
  private readonly transport: ProxyTransport

  /** Per-reference rejection deadlines, isolated by the gateway that rejected it. */
  private readonly rejectedKeys = new Map<string, Map<string, number>>()

  /** Monotonic sequence of the latest request this adapter started. */
  private callSeq = 0

  constructor(private readonly options: OpencodeGoAdapterOptions) {
    super()
    this.transport = options.transport ?? new ProxyTransport()
  }

  dispose(): Promise<void> { return this.transport.dispose() }

  /**
   * The catalog resolver for one configuration, rebuilding on the facts it
   * owns. Public for the plugin's discovery registration, which resolves the
   * current configuration the same way the adapter does.
   * @param config - the endpoint and refresh interval for the raw catalog.
   * @returns the resolver caching catalog values, independent of deployment limits.
   */
  catalogOf(config: OpencodeGoConfig): OpencodeGoCatalog {
    const key = JSON.stringify([config.baseURL, config.refreshMinutes, assertProxyURL(config.proxyURL)])
    if (this.catalogCache?.key !== key) {
      const catalog = new OpencodeGoCatalog(
        assertBaseURL(config.baseURL),
        config.refreshMinutes * 60_000,
        /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
        this.options.onFallback ?? (() => {}),
        /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
        this.options.onOmitted ?? (() => {}),
        () => {
          // Late results from a replaced configuration cannot invalidate the current picker.
          if (this.catalogCache?.catalog === catalog) this.options.onCatalogRefresh?.()
        },
        this.transport.forProxy(config.proxyURL),
      )
      this.catalogCache = { key, catalog }
    }
    return this.catalogCache.catalog
  }

  override providerInfo(provider: string): { id: string; name: string } {
    return { id: provider, name: DISPLAY_NAME }
  }

  override async listModels(_provider: string): Promise<readonly LlmModelInfo[]> {
    const config = this.options.config()
    // Picker notifications only change local visibility. Settings discovery
    // explicitly refreshes this same catalog before notifying open pickers.
    const snapshot = await this.catalogOf(config).snapshot()
    // DSH resolves every listed model before showing the provider. Unconfigured
    // ids belong in settings discovery diagnostics, not this selectable list.
    return [...snapshot.models.values()]
      .filter(model => isModelEnabled({ id: model.id, ...snapshot.details.get(model.id) }, config.modelVisibility))
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
    signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    return this.modelInfo((await this.callSnapshot(model, signal)).model)
  }

  /** Copy nested limits before discovery can yield to a settings update. */
  private async callSnapshot(model: string, signal?: AbortSignal): Promise<OpencodeGoCallSnapshot> {
    const config = structuredClone(this.options.config())
    const catalog = await this.catalogOf(config).forModel(model, signal)
    const resolved = catalog.models.get(model)
    if (resolved === undefined) {
      throw new LlmError(`opencode-go has no model "${model}"`, 'UNKNOWN_MODEL')
    }
    return { config, catalog, model: withModelLimit(resolved, config.modelLimits) }
  }

  /** Keep capability resolution and eventual dispatch on the same configuration. */
  override async prepareCall(_provider: string, model: string, signal?: AbortSignal): Promise<{
    model: LlmResolvedModelInfo
    stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>
  }> {
    const snapshot = await this.callSnapshot(model, signal)
    return {
      model: this.modelInfo(snapshot.model),
      stream: options => this.streamWithSnapshot(options, snapshot),
    }
  }

  /** Describe one model: capacities plus the reasoning levels it actually offers. */
  private modelInfo(model: Model<Api>): LlmResolvedModelInfo {
    const reasoning: Pick<LlmResolvedModelInfo, 'reasoning'> = {}
    const levels = model.reasoning ? getSupportedThinkingLevels(model) : []
    // Intrinsic reasoning does not imply adjustable efforts. DSH requires a
    // nonempty choices list whenever reasoning controls are exposed.
    if (levels.length > 0) {
      // DSH resolves an unset effort through `defaultEffort` (`dsh-llm`'s
      // resolveCallWithInfo). Formats listed above would otherwise send an
      // explicit disable for exactly that case, so a model offering levels
      // would silently lose its reasoning — and its thinking would land in the
      // normal content instead of a reasoning block. `high` mirrors the
      // fallback @deepseek-ai/dsh-llm-deepseek uses. Formats that leave the
      // choice to the provider keep no default: there is nothing to correct.
      const format = (model.compat as { thinkingFormat?: string } | undefined)?.thinkingFormat
      const fallback = format !== undefined && NATIVE_THINKING_FLAGS.has(format)
        ? levels.includes('high') ? 'high' : levels.findLast(level => level !== 'off')
        : undefined
      reasoning.reasoning = {
        efforts: levels.map(level => ({
          id: ReasoningEffortId(level),
          name: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
        })),
        ...fallback === undefined ? {} : { defaultEffort: ReasoningEffortId(fallback) },
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
    let snapshot: OpencodeGoCallSnapshot
    try {
      snapshot = await this.callSnapshot(options.model, options.signal)
    } catch (error) {
      if (!options.signal?.aborted) throw error
      yield { type: 'finish', reason: {
        kind: 'aborted', failure: { code: 'ABORTED', message: 'opencode-go request aborted by caller' },
      } }
      return
    }
    yield* this.streamWithSnapshot(options, snapshot)
  }

  /** Latest started request's sequence; a consumer fences late switch notices against it. */
  accountSwitchWatermark(): number { return this.callSeq }

  private async *streamWithSnapshot(options: GenerateOptions, snapshot: OpencodeGoCallSnapshot): AsyncIterable<StreamChunk> {
    const seq = ++this.callSeq
    const accounts = accountsOf(snapshot.config)
    if (accounts.length === 0) throw new LlmError('OpenCode Go has no accounts', 'MISSING_CREDENTIAL')
    // The preferred reference resolves through accountRefOf: an empty string
    // keeps the default reference's semantics rather than naming no account.
    const preferred = accountRefOf(snapshot.config)
    const ordered = snapshot.config.autoSwitch
      ? [...new Set([preferred, ...accounts.map(account => account.apiKeyEnv)])]
      : [preferred]
    // Keys the gateway rejected lately are skipped for a bounded window:
    // re-sending a full transcript to a rejected key is pure waste. If every
    // candidate is in that window the original order stands, so the gateway's
    // own error — not a synthetic local one — reaches the caller.
    const now = Date.now()
    const gateway = assertBaseURL(snapshot.config.baseURL)
    const usable = ordered.filter(ref => {
      const rejected = this.rejectedKeys.get(ref)
      const until = rejected?.get(gateway)
      if (until === undefined) return true
      if (now >= until) {
        rejected!.delete(gateway)
        if (rejected!.size === 0) this.rejectedKeys.delete(ref)
        return true
      }
      return false
    })
    const refs = usable.length > 0 ? usable : ordered
    const skippedRef = ordered.find(ref => !refs.includes(ref))
    let switchReason: GoAccountSwitch['reason'] | undefined
    let failedRef: string | undefined
    for (let attempt = 0; attempt < refs.length; attempt++) {
      let emitted = false
      let usage: Extract<StreamChunk, { type: 'usage' }> | undefined
      let retry = false
      const announce = (): void => {
        if (emitted) return
        const serving = refs[attempt]!
        if (serving === preferred) this.options.onAccountSwitch?.(undefined, snapshot.config, seq)
        else this.options.onAccountSwitch?.({
          // The notice names the account the journey left: the first one that
          // failed this request, else the first one skipped for a remembered
          // rejection.
          fromRef: failedRef ?? skippedRef ?? preferred,
          toRef: serving,
          reason: switchReason ?? 'credential',
          at: Date.now(),
        }, snapshot.config, seq)
      }
      try {
        for await (const chunk of this.streamAttempt(options, {
          ...snapshot, config: { ...snapshot.config, apiKeyEnv: refs[attempt]! },
        })) {
          if (chunk.type === 'usage') { usage = chunk; continue }
          if (chunk.type === 'finish') {
            const failure = chunk.reason.kind === 'error' ? chunk.reason.failure : undefined
            const reason = failure === undefined ? undefined : accountFailureReason(failure)
            if (reason && failure !== undefined && !emitted && !options.signal?.aborted && !((usage?.usage.totalTokens ?? 0) > 0)
              && attempt + 1 < refs.length) {
              if (isGatewayKeyRejection(failure)) this.rememberRejectedKey(refs[attempt]!, gateway)
              switchReason ??= reason
              failedRef ??= refs[attempt]!
              retry = true
              break
            }
            if (chunk.reason.kind === 'stop' || chunk.reason.kind === 'tool-calls' || chunk.reason.kind === 'max-tokens') announce()
            if (usage) yield usage
            yield chunk
            return
          }
          announce()
          emitted = true
          yield chunk
        }
        if (!retry) return
      } catch (error) {
        const reason = error instanceof LlmError ? accountFailureReason(error) : undefined
        if (!reason || emitted || options.signal?.aborted || attempt + 1 >= refs.length) throw error
        if (error instanceof LlmError && isGatewayKeyRejection(error)) this.rememberRejectedKey(refs[attempt]!, gateway)
        switchReason ??= reason
        failedRef ??= refs[attempt]!
      }
    }
  }

  private rememberRejectedKey(ref: string, gateway: string): void {
    const rejected = this.rejectedKeys.get(ref) ?? new Map<string, number>()
    rejected.set(gateway, Date.now() + REJECTED_KEY_TTL_MS)
    this.rejectedKeys.set(ref, rejected)
  }

  /** A stored change to a reference outranks the gateway's last rejection of it. */
  forgetRejectedKey(ref: string): void {
    this.rejectedKeys.delete(ref)
  }

  /** One account, one SDK attempt; host recovery still owns failures after output. */
  private async *streamAttempt(options: GenerateOptions, snapshot: OpencodeGoCallSnapshot): AsyncIterable<StreamChunk> {
    if (options.stop !== undefined) {
      throw new LlmError('llm-opencode-go does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION')
    }
    const { config, catalog, model } = snapshot
    const outputLimit = config.modelLimits[model.id]?.maxTokens
    const maxTokens = outputLimit == null ? options.maxTokens : Math.min(options.maxTokens ?? outputLimit, outputLimit)
    const apiKey = await this.options.resolveApiKey(config)
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
          maxImages: config.maxImages ?? undefined,
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
      // Direct providers accept a transcript, unlike Models which normalizes
      // Context itself. Preserve prompts and tool declarations on every host.
      const events = catalog.provider.streamSimple(withRequestReasoning(model, reasoning), normalizeContext(context), {
        apiKey,
        fetch: this.transport.forProxy(config.proxyURL),
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
      const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id, options.provider)[Symbol.asyncIterator]()
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
