/** Request snapshots, SDK dispatch, deadlines and seamless account fallback. */
import {
  type OpencodeGoModelLimits,
  isModelEnabled,
  accountsOf,
  accountRefOf,
  type GoAccountSwitch,
  type ModelSource,
  FREE_PROVIDER_ID,
  FREE_DISPLAY_NAME,
  modelSettingsKey,
} from './contracts.ts'
import { normalizeContext } from 'opencode-go-pi-ai'
import { estimateContextTokens } from 'opencode-go-pi-ai/utils/estimate'
import {
  LlmError,
  attributionHeaders,
  contentHasImage,
  type GenerateOptions,
  type ImageAttachmentAccess,
  type StreamChunk,
  LlmAdapter,
  ReasoningEffortId,
  type LlmModelInfo,
  type LlmResolvedModelInfo,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef, ImageRequestTarget } from '@deepseek-ai/dsh-attachment'
import { deadline, idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'
import type { Api, Model, Provider } from './sdk-types.ts'
import {
  type OpencodeGoConfig,
  DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS,
  assertBaseURL,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from './config.ts'
import { toPiContext, toStreamChunks, piContextUsageKey, requestImageTargetFor, type PiImageRequestContext } from './conversion.ts'
import { GatewayDiagnostics, waitWithSignal, ProxyTransport } from './transport.ts'
import {
  reasoningChoices,
  reasoningIntent,
  reasoningRequest,
  PROVIDER_ID,
  DISPLAY_NAME,
  OpencodeGoCatalog,
  type CatalogSnapshot,
  GoCatalogManager,
} from './catalog.ts'
import { createHash, randomUUID } from 'node:crypto'
import { accountFallback, isGatewayKeyRejection } from './accounts.ts'
import { FreeBunTransport, OPENCODE_FREE_USER_AGENT } from './free-transport.ts'
import { FreeChannelState } from './free-channel.ts'

const DEFAULT_MAX_TOKENS = 65_536

/**
 * Bound for the per-reference rejection map. Only account references are ever
 * attempted (the roster is capped at MAX_ACCOUNTS), so this cap is defensive:
 * expired entries are pruned first, and the cap only evicts under artificial
 * reference churn.
 */
const MAX_REJECTED_KEY_REFS = 64

/**
 * Bound for {@link OpencodeGoAdapter.credentialVersions}. Account rosters are
 * capped at MAX_ACCOUNTS, so the map only exceeds this under credential events
 * for references that are not current accounts.
 */
const MAX_CREDENTIAL_VERSIONS = 64

/** Diagnostics observers must never turn a working request into a failure. */
function observe(observer: (() => void) | undefined): void {
  if (observer === undefined) return
  try { observer() } catch { /* Diagnostics cannot fail a request. */ }
}

/** Origin of a configured endpoint for diagnostics; never includes credentials. */
function endpointOrigin(raw: string): string {
  try { return new URL(raw).origin } catch { return '[invalid URL]' }
}

/**
 * Whether the Free route may reuse saved Go credentials. A saved key is bound
 * to the endpoint it was configured for: the official platform gateway over
 * HTTPS on its default port, or a free base sharing the Go gateway's origin
 * (one self-hosted or reverse-proxy deployment serving both routes). Any other
 * `freeBaseURL` gets public access only, so pointing it at a third party cannot
 * forward a stored paid key. The official hostname alone is not enough: a
 * plain-text or re-ported `opencode.ai` URL could be intercepted or served by
 * an unknown listener, so it must not receive saved credentials either.
 * This is a local decision: no network probe is made and no credential is read.
 * @param config - the mount configuration captured for this request.
 * @returns true when Free may send saved account credentials.
 */
export function freeReusesSavedKeys(config: Pick<OpencodeGoConfig, 'baseURL' | 'freeBaseURL'>): boolean {
  let free: URL
  try { free = new URL(config.freeBaseURL) } catch { return false }
  // WHATWG URL removes the default port, so an empty `port` is the only
  // spelling of the official HTTPS endpoint.
  if (free.hostname.toLowerCase() === 'opencode.ai') return free.protocol === 'https:' && free.port === ''
  try { return free.origin === new URL(config.baseURL).origin } catch { return false }
}

/**
 * Cap large models at 64k unless the caller or settings specify an allowance.
 * Per-model settings continue to cap explicit caller values.
 */
export function requestMaxTokens(
  model: { id: string; maxTokens: number; source?: ModelSource },
  limits: OpencodeGoModelLimits,
  requested?: number,
): number | undefined {
  const configured = limits[modelSettingsKey(model)]?.maxTokens ?? undefined
  const allowance = configured === undefined ? requested : Math.min(requested ?? configured, configured)
  return allowance ?? (model.maxTokens > DEFAULT_MAX_TOKENS ? DEFAULT_MAX_TOKENS : undefined)
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

/** Host dependencies used by a single attempt, independent of account selection. */
export interface OpencodeGoRequestExecutorOptions {
  /** Free-only passive backoff; never consulted by the Go executor. */
  freeChannel?: FreeChannelState
  /** Resolve the credential reference captured with this call's endpoint; missing must fail loud. */
  resolveApiKey: (config: OpencodeGoConfig, signal?: AbortSignal) => Promise<string | undefined>
  /**
   * Image input machinery; absent refuses image content, which is the posture
   * for direct construction without a durable attachment service behind it.
   */
  imageAccess?: OpencodeGoImageAccess
  /** Observe assistant history degrading to provider-neutral conversion. */
  onReplayDegrade?: (reason: string) => void
  /**
   * Observe a configured thinking budget that was ignored or clamped for one
   * model. Configured budgets never fail resolution; this is the only visible
   * signal that a stale setting was dropped.
   */
  onModelWarning?: (detail: { model: string; reason: string }) => void
}

/** Inputs already resolved by the adapter, including one account and the wire session ID. */
export interface OpencodeGoRequestSnapshot {
  config: OpencodeGoConfig
  model: Model<Api>
  provider: Provider
  sessionId: string
  apiKey?: string
}

/** Validate an explicit effort against the model's own levels, without clamping. */
function resolveReasoningLevel(
  model: Model<Api>,
  effort: GenerateOptions['reasoningEffort'],
  onWarning?: (reason: string) => void,
): string | undefined {
  if (effort === undefined) return undefined
  const supported = reasoningChoices(model, onWarning).map(choice => choice.id)
  if (supported.some(level => level === effort)) return effort
  throw new LlmError(
    `opencode-go model "${model.id}" does not support reasoning effort "${effort}"`,
    'UNSUPPORTED_REASONING_EFFORT',
  )
}

/** Shares the adapter's transport without owning its lifetime or retrying accounts. */
export class OpencodeGoRequestExecutor {
  private readonly freeTransport: FreeBunTransport
  private readonly ownsFreeTransport: boolean

  constructor(
    private readonly options: OpencodeGoRequestExecutorOptions,
    private readonly transport: ProxyTransport,
    freeTransport?: FreeBunTransport,
  ) {
    // An injected transport belongs to its caller (the adapter or the Host);
    // only the executor's own default has no other owner to release it.
    this.ownsFreeTransport = freeTransport === undefined
    this.freeTransport = freeTransport ?? new FreeBunTransport()
  }

  /**
   * Release a Free transport this executor created itself. An injected
   * transport is released by its owner, so a direct construction is the only
   * caller for which this performs work.
   */
  async dispose(): Promise<void> {
    if (this.ownsFreeTransport) await this.freeTransport.dispose()
  }

  /** One account, one SDK attempt; host recovery still owns failures after output. */
  async *stream(options: GenerateOptions, snapshot: OpencodeGoRequestSnapshot): AsyncIterable<StreamChunk> {
    const state = snapshot.model.source === 'free' ? this.options.freeChannel : undefined
    if (!state) { yield* this.attempt(options, snapshot); return }
    options.signal?.throwIfAborted()
    state.assertReady(snapshot.config)
    const ticket = state.begin(snapshot.config)
    let diagnostics: GatewayDiagnostics | undefined
    let finished = false
    const record = async (outcome: 'success' | 'error' | 'aborted', code?: string): Promise<void> => {
      if (finished) return
      finished = true
      const failureCode = code === 'TIMEOUT' ? code
        : diagnostics ? await diagnostics.failureCode(code ?? 'PI_AI_ERROR') : code ?? 'UNKNOWN'
      state.finish(ticket, { outcome,
        code: outcome === 'error' ? failureCode : undefined, retryAt: diagnostics?.retryDeadline() })
    }
    try {
      for await (const chunk of this.attempt(options, snapshot, value => { diagnostics = value })) {
        if (chunk.type === 'finish') {
          await record(chunk.reason.kind === 'error' ? 'error' : chunk.reason.kind === 'aborted' ? 'aborted' : 'success',
            chunk.reason.kind === 'error' ? chunk.reason.failure.code : undefined)
        }
        yield chunk
      }
      if (!finished) await record('error', 'PI_AI_ERROR')
    } catch (error) {
      await record(options.signal?.aborted && !(error instanceof LlmError && error.code === 'TIMEOUT') ? 'aborted' : 'error',
        error instanceof LlmError ? error.code : 'UNKNOWN')
      throw error
    } finally {
      if (!finished) await record('aborted')
    }
  }

  private async *attempt(options: GenerateOptions, snapshot: OpencodeGoRequestSnapshot,
    onDiagnostics?: (diagnostics: GatewayDiagnostics) => void,
  ): AsyncIterable<StreamChunk> {
    if (options.stop !== undefined) {
      throw new LlmError('llm-opencode-go does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION')
    }
    const { config, provider, model, sessionId } = snapshot
    const maxTokens = requestMaxTokens(model, config.modelLimits, options.maxTokens)
    const reasoning = resolveReasoningLevel(model, options.reasoningEffort, reason => observe(() => this.options.onModelWarning?.({ model: model.id, reason })))

    const consumer = new AbortController()
    const upstream = options.signal === undefined
      ? consumer.signal
      : AbortSignal.any([options.signal, consumer.signal])
    using watchdog = idleWatchdog(upstream, config.streamIdleTimeoutMs, 'LLM_STREAM_IDLE_TIMEOUT')
    using preparation = deadline(watchdog.signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, 'LLM_PREPARATION_TIMEOUT')

    try {
      const apiKey = snapshot.apiKey ?? await waitWithSignal(
        () => this.options.resolveApiKey(config, preparation.signal), preparation.signal,
      )
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
        }
      }
      // The sync overload converts every message from the session log; the
      // images overload additionally converts attachment references through
      // the mounted attachment service. The degrade observer is isolated: a
      // throwing diagnostic callback must not fail the conversion.
      const onReplayDegrade = this.options.onReplayDegrade === undefined ? undefined
        : (reason: string): void => { observe(() => this.options.onReplayDegrade?.(reason)) }
      const context = await waitWithSignal(() => imageRequest === undefined
        ? Promise.resolve(toPiContext(options, undefined, onReplayDegrade))
        : toPiContext({ ...options, signal: preparation.signal }, imageRequest, onReplayDegrade), preparation.signal)
      preparation[Symbol.dispose]()
      watchdog.signal.throwIfAborted()
      // Direct providers accept a transcript, unlike Models which normalizes
      // Context itself. Preserve prompts and tool declarations on every host.
      const transcript = normalizeContext(context)
      const usageContext = piContextUsageKey(context, options.provider, model.id)
      const diagnostics = new GatewayDiagnostics({
        provider: String(options.provider), model: model.id, apiKey, proxyURL: config.proxyURL,
        free: model.source === 'free',
        // Free's SOCKS relay must outlive this request's own stream idle budget:
        // the budget is user-configurable and the relay must not classify the
        // stall as a network error before the stream watchdog fires.
        fetch: model.source === 'free'
          ? this.freeTransport.forProxy(config.proxyURL, config.streamIdleTimeoutMs)
          : this.transport.forProxy(config.proxyURL),
        contextWindow: model.contextWindow, maxTokens: maxTokens ?? model.maxTokens,
        estimatedContextTokens: estimateContextTokens(transcript).tokens,
      })
      onDiagnostics?.(diagnostics)
      // GatewayDiagnostics classifies the HTTP response, but the finish failure
      // contract also carries the provider status and Retry-After. Observe the
      // non-ok status here; retryDeadline() already carries the parsed delay.
      const diagnosticsFetch = diagnostics.fetch
      let httpStatus: number | undefined
      const observedFetch: typeof globalThis.fetch = async (input, init) => {
        const response = await diagnosticsFetch(input, init)
        if (!response.ok) httpStatus = response.status
        return response
      }
      const failureFacts = (): { status?: number; providerRetryAfterMs?: number } => {
        const retryAt = diagnostics.retryDeadline()
        const retryAfterMs = retryAt === undefined ? undefined : retryAt - Date.now()
        return {
          ...httpStatus === undefined ? {} : { status: httpStatus },
          ...retryAfterMs === undefined || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0
            ? {} : { providerRetryAfterMs: retryAfterMs },
        }
      }
      const reasoningOptions = reasoningRequest(reasoningIntent(model, reasoning, reason => observe(() => this.options.onModelWarning?.({ model: model.id, reason }))))
      const events = provider.streamSimple(model, transcript, {
        apiKey,
        fetch: observedFetch,
        ...reasoningOptions,
        ...options.temperature === undefined ? {} : { temperature: options.temperature },
        ...maxTokens === undefined ? {} : { maxTokens },
        sessionId,
        signal: watchdog.signal,
        headers: model.source === 'free' ? {
          'x-opencode-session': sessionId,
          'user-agent': OPENCODE_FREE_USER_AGENT,
          authorization: `Bearer ${apiKey}`,
        } : {
          'x-opencode-session': sessionId,
          ...attributionHeaders(),
        },
        // The agent recovery layer owns visible attempts; one adapter call is
        // one SDK attempt.
        maxRetries: 0,
      })
      const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id, options.provider, maxTokens, usageContext)[Symbol.asyncIterator]()
      let exhausted = false
      try {
        while (true) {
          const result = await waitWithSignal(() => watchdog.next(iterator), watchdog.signal)
          if (timeoutOf(watchdog.signal, 'LLM_REQUEST_TIMEOUT')) throw new LlmError('opencode-go whole request timeout', 'TIMEOUT')
          if (timeoutOf(watchdog.signal, 'LLM_STREAM_IDLE_TIMEOUT') !== undefined) {
            throw new LlmError('opencode-go stream idle timeout', 'TIMEOUT')
          }
          if (result.done) {
            exhausted = true
            return
          }
          const chunk = result.value
          if (chunk.type === 'finish' && chunk.reason.kind === 'error') {
            const failure = chunk.reason.failure
            const message = await waitWithSignal(() => diagnostics.failureMessage(failure.message), watchdog.signal)
            const code = await waitWithSignal(() => diagnostics.failureCode(failure.code), watchdog.signal)
            const finished: StreamChunk = { ...chunk, reason: options.signal?.aborted
              ? { kind: 'aborted', failure: { code: 'ABORTED', message: 'opencode-go request aborted by caller' } }
              : { ...chunk.reason, failure: { ...chunk.reason.failure, message, code, ...failureFacts() } } }
            yield finished
          } else {
            yield chunk
          }
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

/** Recheck a gateway-rejected key after a bounded window. */
const REJECTED_KEY_TTL_MS = 5 * 60_000

/** Apply one request's capacities without changing the shared catalog or its fallbacks. */
function withModelLimit(model: Model<Api>, limits: OpencodeGoModelLimits): Model<Api> {
  const limit = limits[modelSettingsKey(model)]
  if (limit == null) return model
  return {
    ...model,
    contextWindow: limit.contextWindow ?? model.contextWindow,
    maxTokens: limit.maxTokens ?? model.maxTokens,
    reasoningBudgetPresets: limit.thinkingBudgets ?? undefined,
  }
}

/** One request's serving account, with the identity captured before discovery. */
export interface GoAccountSettlement {
  seq: number
  generation: number
  config: OpencodeGoConfig
  ref: string
  notice?: GoAccountSwitch
}

/** Constructor inputs for {@link OpencodeGoAdapter}. */
export interface OpencodeGoAdapterOptions extends OpencodeGoRequestExecutorOptions {
  source?: ModelSource
  /**
   * Transport shared with the Host composition (usage reads, analytics and the
   * other route). Injected ownership stays with the caller: {@link OpencodeGoAdapter.dispose}
   * releases only this adapter's Free transport in that case.
   */
  transport?: ProxyTransport
  /** Mount-owned discovery; direct construction supplies its own manager. */
  catalog?: (config: OpencodeGoConfig) => OpencodeGoCatalog
  /**
   * The current configuration, re-read at every operation: a settings write
   * reaches the next request without a restart, and one operation never mixes
   * two configuration generations.
   */
  config: () => OpencodeGoConfig
  /** Observe discovery retaining its last successful directory. */
  onFallback?: (detail: { url: string; error: unknown; kept: number }) => void
  /** Observe chat rows with invalid or unsupported declarations. */
  onOmitted?: (ids: readonly string[]) => void
  onCatalogWarning?: (warning: string) => void
  /** Re-read picker models after a background catalog refresh commits. */
  onCatalogRefresh?: () => void
  /** Host account-state version for actual requests, captured before asynchronous model discovery. */
  accountGeneration?: () => number
  /** Shared by both adapters so account settlement ordering spans both routes. */
  nextCallSequence?: () => number
  /** One outcome for both the displayed notice and the persisted selection. */
  onAccountSettled?: (event: GoAccountSettlement) => void
  /** Legacy notice observer. Hosts that persist selection should use onAccountSettled. */
  onAccountSwitch?: (notice: GoAccountSwitch | undefined, config: OpencodeGoConfig, seq: number) => void
  /**
   * Observe one Free request refusing to reuse saved credentials because its
   * `freeBaseURL` is not bound to them. The detail carries origins only, never a
   * credential; the Host may log it at info/debug level.
   */
  onFreeCredentialWithheld?: (detail: { reason: 'unbound-free-endpoint'; freeBaseURL: string }) => void
}

/** Configuration, model and provider captured together before discovery yields. */
interface OpencodeGoModelSnapshot {
  config: OpencodeGoConfig
  catalog: CatalogSnapshot
  model: Model<Api>
}

/** Only a request that can settle an account needs an account-state fence. */
interface OpencodeGoCallSnapshot extends OpencodeGoModelSnapshot {
  generation: number
}

/** One logical call's wire identity, shared by all account attempts and SDK cache keys. */
interface OpencodeGoDispatchSnapshot extends OpencodeGoCallSnapshot {
  sessionId: string
}

interface AccountCandidate {
  ref: string
  apiKey?: string
  credentialVersion: number
  skippedRef?: string
}

/** Reserved output namespace; literal IDs in this namespace must be mapped too. */
const SESSION_HEADER_PREFIX = 'dsh-go-session-v1-'

/**
 * Keep visible ASCII IDs unless they occupy the mapped namespace. Hash every
 * other non-empty string without trimming or Unicode normalization, so special
 * IDs survive HTTP serialization without merging distinct conversations.
 * UTF-16LE preserves lone surrogates too; base64url keeps the result under the
 * SDK's 64-character prompt-cache-key limit. Missing IDs get a per-call UUID.
 */
function opencodeSessionValue(sessionId: string | undefined): string {
  if (sessionId === undefined || sessionId.length === 0) return randomUUID()
  if (!/[^\x21-\x7e]/.test(sessionId) && !sessionId.startsWith(SESSION_HEADER_PREFIX)) return sessionId
  return SESSION_HEADER_PREFIX + createHash('sha256').update(sessionId, 'utf16le').digest('base64url')
}

/**
 * One source's route adapter. The catalog snapshot freezes at each operation,
 * so a refresh between two requests never mixes model generations inside one
 * call.
 */
export class OpencodeGoAdapter extends LlmAdapter {
  private readonly source: ModelSource
  private readonly resolveCatalog: (config: OpencodeGoConfig) => OpencodeGoCatalog
  private readonly transport: ProxyTransport
  /** An injected transport is shared with the Host and must not be disposed here. */
  private readonly ownsTransport: boolean
  private readonly requestExecutor: OpencodeGoRequestExecutor
  private readonly freeTransport = new FreeBunTransport()
  private readonly freeChannel: FreeChannelState

  /** Per-reference rejection deadlines, isolated by the gateway that rejected it. */
  private readonly rejectedKeys = new Map<string, Map<string, number>>()
  /**
   * Reference updates invalidate rejections from attempts using an older key.
   * Values are globally monotonic epochs, so pruning never reuses a version.
   */
  private readonly credentialVersions = new Map<string, number>()
  private credentialEpoch = 0

  /** Monotonic sequence of the latest request this adapter started. */
  private callSeq = 0

  private nextCallSequence(): number { return this.options.nextCallSequence?.() ?? ++this.callSeq }

  constructor(private readonly options: OpencodeGoAdapterOptions) {
    super()
    this.source = options.source ?? 'go'
    this.freeChannel = options.freeChannel ?? new FreeChannelState()
    this.ownsTransport = options.transport === undefined
    this.transport = options.transport ?? new ProxyTransport()
    this.requestExecutor = new OpencodeGoRequestExecutor({ ...options, freeChannel: this.freeChannel }, this.transport, this.freeTransport)
    const catalogs = options.catalog ? undefined : new GoCatalogManager({
      transport: this.transport, onFallback: options.onFallback, onOmitted: options.onOmitted,
      onRefresh: options.onCatalogRefresh, onWarning: options.onCatalogWarning,
    })
    this.resolveCatalog = options.catalog ?? (config => catalogs!.forConfig(config, this.source))
  }

  /**
   * Release this adapter's own resources. The Host composition shares one
   * ProxyTransport across both adapters and its services, so only an
   * adapter-created transport is disposed here; the per-adapter Free transport
   * (Bun workers and SOCKS tunnels) always is.
   */
  async dispose(): Promise<void> {
    await Promise.all([
      this.ownsTransport ? this.transport.dispose() : Promise.resolve(),
      this.freeTransport.dispose(),
    ])
  }

  /**
   * The catalog resolver for one configuration, rebuilding on the facts it
   * owns. Public for the plugin's discovery registration, which resolves the
   * current configuration the same way the adapter does.
   * @param config - the endpoint and refresh interval for the raw catalog.
   * @returns the resolver caching catalog values, independent of deployment limits.
   */
  catalogOf(config: OpencodeGoConfig): OpencodeGoCatalog {
    return this.resolveCatalog(config)
  }

  override providerInfo(provider: string): { id: string; name: string } {
    return { id: provider, name: this.source === 'go' ? DISPLAY_NAME : FREE_DISPLAY_NAME }
  }

  /**
   * Report the exact request-image projection this route serializes: the
   * configured pixel budget decides the dimensions and the configured
   * encoded-byte target caps the bytes, matching conversion.ts's per-request
   * target. The token meter must price what is sent, not the normalized source.
   * Synchronous by contract; the live configuration is readable without I/O.
   */
  override imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): ImageRequestTarget {
    const config = this.options.config()
    const target = requestImageTargetFor(image, {
      maxPixels: config.requestImagePixelBudget,
      maxBytes: config.requestImageMaxBytes,
    })
    return { width: target.width, height: target.height, maxBytes: target.maxBytes }
  }

  override async listModels(_provider: string): Promise<readonly LlmModelInfo[]> {
    const config = this.options.config()
    // Picker notifications only change local visibility. Settings discovery
    // explicitly refreshes this same catalog before notifying open pickers.
    const snapshot = await this.catalogOf(config).snapshot()
    // DSH resolves every listed model before showing the provider. Unconfigured
    // ids belong in settings discovery diagnostics, not this selectable list.
    return [...snapshot.models.values()]
      .filter(model => isModelEnabled({ id: model.id, source: this.source, ...snapshot.details.get(model.id) }, config.modelVisibility))
      .map(model => ({
        provider: this.source === 'go' ? PROVIDER_ID : FREE_PROVIDER_ID,
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
    const snapshot = await this.modelSnapshot(model, signal)
    return this.modelInfo(snapshot.model, snapshot.config.modelLimits)
  }

  /** Capture limits and protocol before discovery can yield to a settings update. */
  private async modelSnapshot(model: string, signal?: AbortSignal,
    config = structuredClone(this.options.config()),
  ): Promise<OpencodeGoModelSnapshot> {
    using preparation = deadline(signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, 'LLM_PREPARATION_TIMEOUT')
    let catalog: CatalogSnapshot
    try { catalog = await this.catalogOf(config).forModel(model, preparation.signal) }
    catch (error) {
      if (timeoutOf(preparation.signal, 'LLM_PREPARATION_TIMEOUT')) throw new LlmError('opencode-go discovery preparation timeout', 'TIMEOUT', { cause: error })
      throw error
    }
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
    const seq = this.nextCallSequence()
    const generation = this.options.accountGeneration?.() ?? 0
    const snapshot = { generation, ...await this.modelSnapshot(model, signal) }
    return {
      model: this.modelInfo(snapshot.model, snapshot.config.modelLimits),
      stream: options => this.streamWithSnapshot(options, snapshot, seq),
    }
  }

  /** Report the same default allowance used by dispatch so the host can budget compaction. */
  private modelInfo(model: Model<Api>, limits: OpencodeGoModelLimits): LlmResolvedModelInfo {
    const defaultMaxTokens = requestMaxTokens(model, limits)
    const reasoning: Pick<LlmResolvedModelInfo, 'reasoning'> = {}
    const choices = reasoningChoices(model, reason => observe(() => this.options.onModelWarning?.({ model: model.id, reason })))
    if (choices.length > 0) {
      reasoning.reasoning = {
        efforts: choices.map(choice => ({ ...choice, id: ReasoningEffortId(choice.id) })),
      }
    }
    return {
      provider: this.source === 'go' ? PROVIDER_ID : FREE_PROVIDER_ID,
      id: model.id,
      name: model.name,
      inputModalities: [...model.input],
      context: { contextWindow: model.contextWindow },
      ...defaultMaxTokens === undefined ? {} : { defaultMaxTokens },
      ...reasoning,
    }
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.stop !== undefined) {
      throw new LlmError('llm-opencode-go does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION')
    }
    yield* this.dispatch(options, this.nextCallSequence())
  }

  private async *streamWithSnapshot(options: GenerateOptions, snapshot: OpencodeGoCallSnapshot, seq: number): AsyncIterable<StreamChunk> {
    yield* this.dispatch(options, seq, snapshot)
  }

  private async *dispatch(options: GenerateOptions, seq: number, prepared?: OpencodeGoCallSnapshot): AsyncIterable<StreamChunk> {
    const captured = prepared ?? { generation: this.options.accountGeneration?.() ?? 0, config: structuredClone(this.options.config()) }
    const sessionId = opencodeSessionValue(options.sessionId === undefined ? undefined : String(options.sessionId))
    using whole = deadline(options.signal, captured.config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, 'LLM_REQUEST_TIMEOUT')
    try {
      if (this.source === 'free') {
        whole.signal.throwIfAborted()
        this.freeChannel.assertReady(captured.config)
      }
      const snapshot = prepared ?? {
        generation: captured.generation,
        ...await this.modelSnapshot(options.model, whole.signal, captured.config),
      }
      for await (const chunk of this.streamAccounts({ ...options, signal: whole.signal }, { ...snapshot, sessionId }, seq)) {
        yield chunk
      }
    } catch (error) {
      if (timeoutOf(whole.signal, 'LLM_REQUEST_TIMEOUT')) {
        throw new LlmError('opencode-go whole request timeout', 'TIMEOUT', { cause: error })
      }
      if (options.signal?.aborted) {
        yield { type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: 'opencode-go request aborted by caller' } } }
        return
      }
      throw error
    }
  }

  private async *streamAccounts(options: GenerateOptions, snapshot: OpencodeGoDispatchSnapshot, seq: number): AsyncIterable<StreamChunk> {
    const streamPublic = () => this.requestExecutor.stream(options, { config: snapshot.config, model: snapshot.model,
      provider: snapshot.catalog.provider, sessionId: snapshot.sessionId, apiKey: 'public' })
    if (this.source === 'free' && !freeReusesSavedKeys(snapshot.config)) {
      // A Free endpoint that is neither official nor the Go gateway's own origin
      // must never receive saved account credentials: send public access only,
      // and report why without reading or echoing any key.
      observe(() => this.options.onFreeCredentialWithheld?.({
        reason: 'unbound-free-endpoint',
        freeBaseURL: endpointOrigin(snapshot.config.freeBaseURL),
      }))
      yield* streamPublic()
      return
    }
    const accounts = accountsOf(snapshot.config)
    if (this.source === 'go' && accounts.length === 0) throw new LlmError('OpenCode Go has no accounts', 'MISSING_CREDENTIAL')
    // The preferred reference resolves through accountRefOf: an empty string
    // keeps the default reference's semantics rather than naming no account.
    const preferred = accountRefOf(snapshot.config)
    const ordered = this.source === 'free' ? accounts.map(account => account.apiKeyEnv)
      : snapshot.config.autoSwitch ? [...new Set([preferred, ...accounts.map(account => account.apiKeyEnv)])] : [preferred]
    // Keys the gateway rejected lately are skipped for a bounded window:
    // re-sending a full transcript to a rejected key is pure waste. If every
    // candidate is in that window the original order stands, so the gateway's
    // own error — not a synthetic local one — reaches the caller.
    const now = Date.now()
    const gateway = assertBaseURL(this.source === 'go' ? snapshot.config.baseURL : snapshot.config.freeBaseURL,
      this.source === 'go' ? 'baseURL' : 'freeBaseURL')
    // Expired rejections are pruned before every attempt, so the map stays
    // bounded by recently rejected references instead of growing with history.
    this.pruneRejectedKeys(now)
    const usable = ordered.filter(ref => {
      const until = this.rejectedKeys.get(ref)?.get(gateway)
      return until === undefined || now >= until
    })
    const candidates = this.accountCandidates(snapshot.config, ordered, usable, options.signal)
    let candidate = await candidates.next()
    if (candidate.done) {
      if (this.source === 'free') yield* streamPublic()
      return
    }
    let switchReason: GoAccountSwitch['reason'] | undefined
    let failedRef: string | undefined
    let publicFallback = false
    while (!candidate.done && !publicFallback) {
      const { ref, apiKey, credentialVersion, skippedRef } = candidate.value
      let emitted = false
      let usage: Extract<StreamChunk, { type: 'usage' }> | undefined
      let retry = false
      const retryFailure = async (failure: { code: string } | undefined): Promise<boolean> => {
        const reason = accountFallback({ failure, emitted, totalTokens: usage?.usage.totalTokens ?? 0,
          aborted: options.signal?.aborted === true, hasNext: snapshot.config.autoSwitch === true || this.source === 'free' })
        if (!emitted && !options.signal?.aborted && !usage?.usage.totalTokens && failure && isGatewayKeyRejection(failure)
          && credentialVersion === (this.credentialVersions.get(ref) ?? 0)) this.rememberRejectedKey(ref, gateway)
        if (!reason || !failure) return false
        if (snapshot.config.autoSwitch) {
          const next = await candidates.next()
          if (!next.done) {
            switchReason ??= reason
            failedRef ??= ref
            candidate = next
            return true
          }
        }
        // Public Free access remains available when saved credentials are
        // rejected, including when switching between saved accounts is off.
        publicFallback = this.source === 'free' && ['INVALID_CREDENTIAL', 'AUTH'].includes(failure.code)
        return publicFallback
      }
      const announce = (): void => {
        if (emitted) return
        const serving = ref
        const replaced = failedRef ?? skippedRef ?? preferred
        const notice: GoAccountSwitch | undefined = serving === preferred ? undefined : {
          // The notice names the account the journey left: the first one that
          // failed this request, else the first one skipped for a remembered
          // rejection.
          fromRef: replaced,
          toRef: serving,
          reason: switchReason ?? 'credential',
          at: Date.now(),
        }
        // Account observers persist selection and drive UI notices; a throwing
        // observer must not turn an already-successful stream into a failure.
        observe(() => this.options.onAccountSettled?.({ seq, generation: snapshot.generation, config: snapshot.config, ref: serving, notice }))
        observe(() => this.options.onAccountSwitch?.(notice, snapshot.config, seq))
      }
      try {
        for await (const chunk of this.requestExecutor.stream(options, {
          config: { ...snapshot.config, apiKeyEnv: ref },
          model: snapshot.model, provider: snapshot.catalog.provider, sessionId: snapshot.sessionId,
          ...apiKey === undefined ? {} : { apiKey },
        })) {
          if (chunk.type === 'usage') { usage = chunk; continue }
          if (chunk.type === 'finish') {
            const failure = chunk.reason.kind === 'error' ? chunk.reason.failure : undefined
            if (await retryFailure(failure)) { retry = true; break }
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
        if (!await retryFailure(error instanceof LlmError ? error : undefined)) throw error
      }
    }
    if (publicFallback) yield* streamPublic()
  }

  /** Resolve Free keys only when selecting an account or retrying a failed attempt. */
  private async *accountCandidates(config: OpencodeGoConfig, ordered: readonly string[], usable: readonly string[], signal?: AbortSignal): AsyncGenerator<AccountCandidate> {
    if (this.source === 'go') {
      const refs = usable.length > 0 ? usable : ordered
      const skippedRef = ordered.find(ref => !refs.includes(ref))
      for (const ref of refs) yield { ref, skippedRef, credentialVersion: this.credentialVersions.get(ref) ?? 0 }
      return
    }
    const groups = config.autoSwitch ? [usable, ordered.filter(ref => !usable.includes(ref))] : [ordered]
    for (const refs of groups) {
      let found = false
      const skippedRef = refs === usable ? ordered.find(ref => !usable.includes(ref)) : undefined
      for (const ref of refs) {
        const credentialVersion = this.credentialVersions.get(ref) ?? 0
        let apiKey: string | undefined
        {
          // Dispose before yielding: inference must not consume a backup's preparation budget.
          using preparation = deadline(signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, 'LLM_PREPARATION_TIMEOUT')
          try {
            apiKey = await waitWithSignal(() => this.options.resolveApiKey({ ...config, apiKeyEnv: ref }, preparation.signal), preparation.signal)
          } catch (error) {
            if (timeoutOf(preparation.signal, 'LLM_PREPARATION_TIMEOUT')) throw new LlmError('opencode-free credential preparation timeout', 'TIMEOUT', { cause: error })
            if (!(error instanceof LlmError) || !['MISSING_CREDENTIAL', 'INVALID_CREDENTIAL'].includes(error.code)) throw error
          }
        }
        if (!apiKey?.trim()) continue
        found = true
        yield { ref, apiKey, credentialVersion, skippedRef }
        if (!config.autoSwitch) return
      }
      // Revisit rejected keys only when every other saved key is unavailable.
      if (found) return
    }
  }

  /** Drop expired rejections so the maps stay bounded by the recent window. */
  private pruneRejectedKeys(now: number): void {
    for (const [ref, gateways] of this.rejectedKeys) {
      for (const [gateway, until] of gateways) if (now >= until) gateways.delete(gateway)
      if (gateways.size === 0) this.rejectedKeys.delete(ref)
    }
  }

  private rememberRejectedKey(ref: string, gateway: string): void {
    const now = Date.now()
    this.pruneRejectedKeys(now)
    const rejected = this.rejectedKeys.get(ref) ?? new Map<string, number>()
    rejected.set(gateway, now + REJECTED_KEY_TTL_MS)
    this.rejectedKeys.set(ref, rejected)
    // Defensive cap: only account references are attempted, so this can only
    // evict under artificial reference churn. Expired entries were pruned first,
    // which keeps the normal working set at the live roster size.
    while (this.rejectedKeys.size > MAX_REJECTED_KEY_REFS) {
      const oldest = this.rejectedKeys.keys().next().value
      if (oldest === undefined || oldest === ref) break
      this.rejectedKeys.delete(oldest)
    }
  }

  /** A stored change to a reference outranks the gateway's last rejection of it. */
  forgetRejectedKey(ref: string): void {
    // Globally monotonic epochs: pruning the map can never reuse a version, so
    // a request that captured a stale version still fails the guard.
    this.credentialEpoch += 1
    this.credentialVersions.set(ref, this.credentialEpoch)
    this.rejectedKeys.delete(ref)
    this.pruneCredentialVersions()
  }

  /**
   * Keep the version map bounded: account rosters are at most MAX_ACCOUNTS, so
   * only references that are not current accounts can push it over the cap.
   * Those are evicted first; the roster entries are kept. A pruned entry reads
   * as version 0 (unchanged), which cannot falsely match an attempt that saw a
   * real epoch (>= 1); requests started before a reference's first change keep
   * their 0 and are only reachable in the artificial overflow/rename window.
   */
  private pruneCredentialVersions(): void {
    if (this.credentialVersions.size <= MAX_CREDENTIAL_VERSIONS) return
    const roster = new Set(accountsOf(this.options.config()).map(account => account.apiKeyEnv))
    for (const ref of this.credentialVersions.keys()) {
      if (this.credentialVersions.size <= MAX_CREDENTIAL_VERSIONS) return
      if (!roster.has(ref)) this.credentialVersions.delete(ref)
    }
    while (this.credentialVersions.size > MAX_CREDENTIAL_VERSIONS) {
      const oldest = this.credentialVersions.keys().next().value
      if (oldest === undefined) return
      this.credentialVersions.delete(oldest)
    }
  }
}
