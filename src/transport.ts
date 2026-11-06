/** Proxy and HTTP transport, cancellation, bounded reads and redacted errors. */
import { AsyncLocalStorage } from 'node:async_hooks'
import { ProxyAgent, Socks5ProxyAgent, type Dispatcher } from 'undici'
import { assertProxyURL } from './contracts.ts'
import { setTimeout as delay } from 'node:timers/promises'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { isContextWindowExceededError, isQuotaExceededError } from '@deepseek-ai/dsh-llm'
import { classifyFreeGatewayError, retryAfterDeadline } from './free-policy.ts'

/** Cancel a wait even when an external service does not observe its signal. */
export function waitWithSignal<T>(work: () => PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise<T>((resolve, reject) => {
    const cleanup = (): void => { signal?.removeEventListener('abort', abort) }
    const abort = (): void => { cleanup(); reject(signal!.reason) }
    signal?.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(() => {
      signal?.throwIfAborted()
      return work()
    }).then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}

/** Per-mount transport. Fetch closures retain their address across settings changes. */
export class ProxyTransport {
  private current: { address: string; dispatcher: Dispatcher } | undefined
  private readonly retired = new Set<Dispatcher>()
  private disposed = false

  forProxy(raw?: string): typeof globalThis.fetch | undefined {
    const address = assertProxyURL(raw)
    if (!address) { this.retire(); return undefined }
    return (input, init) => {
      if (this.disposed) return Promise.reject(new Error('OpenCode Go proxy transport is disposed'))
      if (this.current?.address !== address) {
        const url = new URL(address)
        const dispatcher = url.protocol === 'socks5:' ? new Socks5ProxyAgent(url) : new ProxyAgent(address)
        this.retire()
        this.current = { address, dispatcher }
      }
      const options: RequestInit & { dispatcher: Dispatcher } = { ...init, dispatcher: this.current.dispatcher }
      return globalThis.fetch(input, options)
    }
  }

  /** Close replaced pools after their in-flight response bodies have finished. */
  private retire(): void {
    if (!this.current) return
    const { dispatcher } = this.current
    this.current = undefined
    this.retired.add(dispatcher)
    void dispatcher.close().catch(() => dispatcher.destroy()).catch(() => {})
      .finally(() => { this.retired.delete(dispatcher) })
  }

  /** Unloading the mount cancels remaining requests and releases every pool. */
  async dispose(): Promise<void> {
    this.disposed = true
    const dispatchers = [...this.retired, ...(this.current ? [this.current.dispatcher] : [])]
    this.current = undefined
    this.retired.clear()
    await Promise.all(dispatchers.map(dispatcher => dispatcher.destroy().catch(() => {})))
  }
}

const RETRYABLE_CODES = new Set(['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET', 'EAI_AGAIN'])

function errorCauses(error: unknown): object[] {
  const causes: object[] = []
  for (let depth = 0; depth < 5 && error !== null && typeof error === 'object'; depth += 1) {
    causes.push(error)
    error = 'cause' in error ? error.cause : undefined
  }
  return causes
}

function retryableTransportFailure(error: unknown): boolean {
  if (error instanceof SyntaxError || error instanceof RangeError) return false
  for (const cause of errorCauses(error)) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) return false
    if ('code' in cause && typeof cause.code === 'string') return RETRYABLE_CODES.has(cause.code)
  }
  return false
}

/** Describe transport failures without echoing credentials or upstream response text. */
export function transportFailure(error: unknown): string {
  const causes = errorCauses(error)
  if (causes.some(cause => cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError'))) {
    return 'request timed out or was aborted'
  }
  for (const cause of causes) {
    if ('code' in cause && typeof cause.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(cause.code)) {
      return `network error (${cause.code})`
    }
  }
  return 'network request failed'
}

/** Keep the endpoint useful in diagnostics without user information or query secrets. */
export function diagnosticURL(raw: string): string {
  const url = new URL(raw)
  url.username = ''
  url.password = ''
  url.search = ''
  url.hash = ''
  return url.href
}

/** The caller's signal covers both attempts, the retry delay, and all response reads. */
export async function fetchJsonResponse(
  url: string, init: RequestInit, maxBytes: number, encoding: 'identity' | 'gzip' = 'identity',
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  readError?: (response: Response) => Promise<unknown>,
): Promise<{ response: Response; body: unknown }> {
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') throw new TypeError('JSON requests must use GET')
  const headers = new Headers(init.headers)
  // Small responses retain the #7 workaround; metadata opts into recoverable gzip.
  headers.set('accept-encoding', encoding)
  const options = { ...init, method: 'GET', headers }
  const signal = init.signal ?? undefined
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted()
    try {
      const response = await waitWithSignal(async () => {
        const response = await fetcher(url, options)
        // An uncooperative fetcher may deliver a response after its waiter timed out.
        if (signal?.aborted) {
          cancelResponse(response, signal.reason)
          signal.throwIfAborted()
        }
        return response
      }, signal)
      if (!response.ok) {
        // An opt-in reader owns consuming/cancelling its bounded error body.
        // Diagnostics must never replace the HTTP failure or cause another GET.
        if (readError) {
          let body: unknown
          try { body = await waitWithSignal(() => readError(response), signal) }
          catch {
            // A failed diagnostic preserves HTTP status; caller cancellation still wins.
            signal?.throwIfAborted()
          }
          finally { cancelResponse(response) }
          signal?.throwIfAborted()
          return { response, body }
        }
        cancelResponse(response)
        signal?.throwIfAborted()
        return { response, body: undefined }
      }
      const body = await readJsonResponse(response, maxBytes, { gzip: encoding === 'gzip', signal })
      signal?.throwIfAborted()
      return { response, body }
    } catch (error) {
      signal?.throwIfAborted()
      if (attempt > 0 || !retryableTransportFailure(error)) throw error
      await delay(150, undefined, { signal })
    }
  }
}

function cancelResponse(response: Response, reason?: unknown): void {
  // Cancellation can wait forever (for example on a tee's other branch).
  void response.body?.cancel(reason).catch(() => {})
}

async function readBoundedBody(response: Response, maxBytes: number, signal?: AbortSignal): Promise<Buffer> {
  if (signal?.aborted) { cancelResponse(response, signal.reason); signal.throwIfAborted() }
  if (response.body === null) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await waitWithSignal(() => reader.read(), signal)
      signal?.throwIfAborted()
      if (done) return Buffer.concat(chunks, size)
      // Count actual bytes: Content-Length may be missing, wrong, or refer to compressed bytes.
      if (value.byteLength > maxBytes - size) {
        throw new RangeError(`Response body exceeds ${maxBytes} byte limit`)
      }
      size += value.byteLength
      chunks.push(value)
    }
  } catch (error) {
    void reader.cancel(error).catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

/** Bound recovered gzip output and let the request deadline cancel decompression too. */
async function readGzipBody(bytes: Buffer, maxBytes: number, signal?: AbortSignal | null): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  await pipeline(Readable.from([bytes]), createGunzip(), new Writable({
    write(chunk: Buffer, _encoding, done) {
      if (chunk.length > maxBytes - size) {
        done(new RangeError(`Response body exceeds ${maxBytes} byte limit`))
        return
      }
      size += chunk.length
      chunks.push(chunk)
      done()
    },
  }), { signal: signal ?? undefined })
  return Buffer.concat(chunks, size)
}

/** Fetch normally decodes HTTP; only negotiated gzip may recover a raw gzip body (#7). */
export async function readJsonResponse(
  response: Response, maxBytes: number, options: { gzip?: boolean; signal?: AbortSignal | null } = {},
): Promise<unknown> {
  const signal = options.signal ?? undefined
  let bytes = await readBoundedBody(response, maxBytes, signal)
  if (options.gzip && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = await readGzipBody(bytes, maxBytes, signal)
    } catch (error) {
      options.signal?.throwIfAborted()
      if (error instanceof RangeError) throw error
      throw new SyntaxError('Response is not valid gzip', { cause: error })
    }
  }
  const body = await (() => {
    signal?.throwIfAborted()
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch (error) {
      // Native JSON errors may echo response text. Keep it in the cause, outside the public message.
      throw new SyntaxError('Response is not valid JSON', { cause: error })
    }
  })()
  signal?.throwIfAborted()
  return body
}

interface GatewayContextBudget {
  contextWindow?: number
  maxTokens?: number
  estimatedContextTokens?: number
}

/** Gateway status codes cover several domains; model permissions do not reject a key. */
export function classifyGatewayError(status: number, body: string, fallback: string, budget: GatewayContextBudget = {}): string {
  let error: { type?: unknown; code?: unknown; message?: unknown } | undefined
  let modelOnly = false
  try {
    const parsed = JSON.parse(body)
    error = parsed?.error && typeof parsed.error === 'object' ? parsed.error : parsed
    modelOnly = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      && typeof parsed.model === 'string' && Object.keys(parsed).length === 1
  } catch { /* Proxies may return plain text or HTML. Status remains authoritative. */ }
  const types = [error?.type, error?.code].filter((value): value is string => typeof value === 'string')
    .map(value => value.replace(/[^a-z0-9]/gi, '').toLowerCase())
  if (types.some(type => ['modelerror', 'modelnotfound', 'unknownmodel'].includes(type))) return 'UNKNOWN_MODEL'
  if (types.some(type => ['creditserror', 'monthlylimiterror', 'userlimiterror', 'gousagelimiterror',
    'freeusagelimiterror', 'insufficientquota', 'quotaexceeded'].includes(type))) return 'QUOTA'
  if (types.some(type => ['autherror', 'authenticationerror', 'invalidapikey', 'invalidkey'].includes(type))) return 'INVALID_CREDENTIAL'
  if (types.some(type => ['regionerror', 'datapolicyerror', 'permissionerror', 'permissiondenied'].includes(type))) return 'PERMISSION_DENIED'
  if (types.some(type => ['ratelimiterror', 'ratelimitexceeded'].includes(type))) return 'RATE_LIMIT'
  const message = typeof error?.message === 'string' ? error.message : body
  // Legacy gateways report subscription limits as untyped 401/402/403/429.
  // A proxy's 5xx diagnostic may quote an earlier quota failure; it cannot
  // authorize switching accounts without structured evidence.
  if ([401, 402, 403, 429].includes(status) && isQuotaExceededError(message)) return 'QUOTA'
  if ([401, 402, 403].includes(status)
    && /(?:invalid|incorrect|expired)[ _-]?(?:api[ _-]?)?key|invalid credential/i.test(message)) return 'INVALID_CREDENTIAL'
  if (status === 401) return 'AUTH'
  if (status === 402 || status === 403) return 'PERMISSION_DENIED'
  if (status === 404) return 'UNKNOWN_MODEL'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 408 || status === 504) return 'TIMEOUT'
  if (status >= 500) return 'SERVER'
  if (status === 400 || status === 413 || status === 422) {
    // Read explicit codes too: the SDK can discard an error envelope's code
    // while flattening it into a message.
    if (isContextWindowExceededError([error?.type, error?.code, message].join(' '))) return 'CONTEXT_WINDOW_EXCEEDED'
    // Some gateways return only the model on overflow. Require request-budget
    // evidence before treating this otherwise opaque rejection as capacity.
    const { contextWindow, estimatedContextTokens, maxTokens = 0 } = budget
    if (status === 400 && modelOnly && contextWindow !== undefined && Number.isFinite(contextWindow) && contextWindow > 0
      && estimatedContextTokens !== undefined && Number.isFinite(estimatedContextTokens) && estimatedContextTokens >= 0
      && Number.isFinite(maxTokens) && maxTokens >= 0
      && estimatedContextTokens + maxTokens >= contextWindow * 0.8) return 'CONTEXT_WINDOW_EXCEEDED'
    return fallback === 'CONTEXT_WINDOW_EXCEEDED' ? fallback : 'INVALID_REQUEST'
  }
  return fallback
}

const MAX_BODY_BYTES = 16 * 1024

const BODY_READ_TIMEOUT_MS = 1000

interface BodyPreview {
  text: string
  /** Bytes captured before redaction; a truncated read is a lower bound. */
  bytes: number
  truncated: boolean
  readFailed?: boolean
}

/** Read a clone concurrently with the SDK, with bounded memory and waiting. */
async function previewBody(response: Response, callerSignal?: AbortSignal | null): Promise<BodyPreview> {
  const chunks: Uint8Array[] = []
  let bytes = 0
  let truncated = false
  let readFailed = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, AbortSignal.timeout(BODY_READ_TIMEOUT_MS)])
    : AbortSignal.timeout(BODY_READ_TIMEOUT_MS)
  const abort = Promise.withResolvers<never>()
  const onAbort = (): void => { abort.reject(signal.reason) }
  try {
    signal.throwIfAborted()
    reader = response.clone().body?.getReader()
    if (reader) {
      signal.addEventListener('abort', onAbort, { once: true })
      while (true) {
        const part = await Promise.race([reader.read(), abort.promise])
        if (part.done) break
        const remaining = MAX_BODY_BYTES - bytes
        chunks.push(part.value.slice(0, remaining))
        bytes += Math.min(part.value.byteLength, remaining)
        if (part.value.byteLength > remaining) { truncated = true; break }
      }
    }
  } catch {
    readFailed = true
  } finally {
    signal.removeEventListener('abort', onAbort)
    // A tee's cancel waits for the SDK branch too; awaiting it can deadlock.
    if (reader) void reader.cancel().catch(() => {})
  }
  return { text: Buffer.concat(chunks, bytes).toString('utf8'), bytes, truncated,
    ...readFailed ? { readFailed: true } : {} }
}

export class GatewayDiagnostics {
  private retryAt: number | undefined
  private transportFailed = false
  private evidence: Promise<{ status: number; body: BodyPreview }> | undefined
  private code: Promise<string> | undefined
  private readonly secrets: string[]

  constructor(private readonly options: GatewayContextBudget & {
    provider: string
    model: string
    apiKey: string
    proxyURL?: string
    fetch?: typeof globalThis.fetch
    free?: boolean
  }) {
    this.secrets = [options.apiKey]
    if (options.proxyURL) {
      const url = new URL(options.proxyURL)
      for (const value of [url.username, url.password]) {
        if (value) this.secrets.push(value, decodeURIComponent(value))
      }
      if (url.username || url.password) {
        this.secrets.push(Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64'))
      }
    }
    // Upstreams can echo a credential inside JSON, where quotes/backslashes are escaped.
    this.secrets = [...new Set(this.secrets.flatMap(secret => [secret, JSON.stringify(secret).slice(1, -1)]))]
      .sort((a, b) => b.length - a.length)
  }

  private redact(text: string, truncated = false): string {
    for (const secret of this.secrets) {
      if (!secret) continue
      text = text.replaceAll(secret, '[REDACTED]')
      // A byte limit can cut through a credential echoed by the upstream.
      if (truncated) for (let length = Math.min(secret.length - 1, text.length); length > 0; length--) {
        if (text.endsWith(secret.slice(0, length))) {
          text = text.slice(0, -length) + '[REDACTED]'
          break
        }
      }
    }
    return text
  }

  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    let response: Response
    try { response = await (this.options.fetch ?? globalThis.fetch)(input, init) }
    catch (error) { this.transportFailed = true; throw error }
    if (!response.ok) {
      this.retryAt = retryAfterDeadline(response.headers.get('retry-after'), Date.now(), response.headers.get('date'))
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
      const preview = previewBody(response, signal)
      this.code = preview.then(body => (this.options.free ? classifyFreeGatewayError(response.status, body.text) : undefined)
        ?? classifyGatewayError(response.status, body.text, 'PI_AI_ERROR', this.options))
      this.evidence = preview.then(body => ({ status: response.status,
        body: { ...body, text: this.redact(body.text, body.truncated || body.readFailed) } }))
    }
    return response
  }

  async failureCode(fallback: string): Promise<string> {
    if (this.options.free && this.transportFailed) return 'NETWORK'
    const code = await this.code
    return code === undefined || code === 'PI_AI_ERROR'
      || code === 'INVALID_REQUEST' && fallback === 'CONTEXT_WINDOW_EXCEEDED' ? fallback : code
  }

  /** Upstream deadline consumed by passive Free backoff. */
  retryDeadline(): number | undefined { return this.retryAt }

  async failureMessage(original: string): Promise<string> {
    let message = this.redact(original)
    const evidence = await this.evidence
    if (!evidence) return `${this.options.provider}/${this.options.model}: ${message}`
    const { status, body } = evidence
    if (body.bytes > 0 && message.includes('status code (no body)')) message = `${status} ${body.text.slice(0, 1024)}`
    const presence = body.bytes > 0 ? 'nonempty' : body.readFailed ? 'unavailable' : 'empty'
    message += ` [HTTP ${status}; response body: ${presence}${body.truncated ? ', truncated' : ''}${body.readFailed ? ', incomplete read' : ''}]`
    if ([400, 413, 422].includes(status)) {
      const { maxTokens, contextWindow } = this.options
      const allowance = typeof maxTokens === 'number' ? `max_tokens=${maxTokens}` : 'output allowance unavailable'
      const window = typeof contextWindow === 'number' ? `; context window=${contextWindow}` : ''
      message += ` [${allowance}${window}. For context capacity failures, compact the conversation (/compact) or lower this model's Max output in OpenCode Go settings, then retry.]`
    }
    return `${this.options.provider}/${this.options.model}: ${message}`
  }
}

/** Bounded, credential-free reasons for usage HTTP failures. */
const MAX_ERROR_BYTES = 16 * 1024

const ERROR_READ_TIMEOUT_MS = 1000

const MAX_REASON_CHARS = 256

interface UsageErrorOptions {
  apiKey: string
  baseURL: string
  proxyURL: string
  signal: AbortSignal
}

function errorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const error = value as Record<string, unknown>
  for (const field of ['message', 'detail', 'reason', 'error_description']) {
    if (typeof error[field] === 'string' && error[field].trim()) return error[field]
  }
  return errorMessage(error.data) ?? (typeof error.type === 'string' ? error.type
    : typeof error.code === 'string' ? error.code : undefined)
}

function redact(text: string, options: UsageErrorOptions, incomplete: boolean): string {
  const secrets = [options.apiKey]
  for (const endpoint of [options.baseURL, options.proxyURL]) {
    if (!endpoint) continue
    const url = new URL(endpoint)
    for (const credential of [url.username, url.password]) {
      if (credential) secrets.push(credential, decodeURIComponent(credential))
    }
    if (url.username || url.password) {
      secrets.push(Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64'))
    }
  }
  const variants = [...new Set(secrets.filter(Boolean).flatMap(secret =>
    [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret)]))]
    .sort((left, right) => right.length - left.length)
  for (const secret of variants) {
    text = text.replaceAll(secret, '[REDACTED]')
    // A capped or interrupted response can end halfway through an echoed key.
    if (incomplete) for (let length = Math.min(secret.length - 1, text.length); length > 0; length--) {
      if (text.endsWith(secret.slice(0, length))) {
        text = text.slice(0, -length) + '[REDACTED]'
        break
      }
    }
  }
  return text
    .replace(/\b(Bearer|Basic)\s+[\w.~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie)\b(["']?\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]+)/gi,
      '$1$2[REDACTED]')
    .replace(/\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|token|password|secret|authorization|cookie)\b(["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;<>]+)/gi,
      '$1$2[REDACTED]')
    .replace(/https?:\/\/[^\s<>"']+/gi, raw => {
      try {
        const url = new URL(raw)
        url.username = ''; url.password = ''; url.search = ''; url.hash = ''
        return url.href
      } catch { return '[REDACTED URL]' }
    })
}

/** Read only diagnostic text; a slow/broken error body cannot hide its HTTP status. */
export async function readUsageError(response: Response, options: UsageErrorOptions): Promise<string | undefined> {
  const reader = response.body?.getReader()
  if (!reader) return undefined
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(ERROR_READ_TIMEOUT_MS)])
  const abort = Promise.withResolvers<never>()
  const onAbort = (): void => { abort.reject(signal.reason) }
  const chunks: Uint8Array[] = []
  let bytes = 0
  let incomplete = false
  try {
    signal.throwIfAborted()
    signal.addEventListener('abort', onAbort, { once: true })
    while (true) {
      const part = await Promise.race([reader.read(), abort.promise])
      if (part.done) break
      const remaining = MAX_ERROR_BYTES - bytes
      chunks.push(part.value.slice(0, remaining))
      bytes += Math.min(part.value.byteLength, remaining)
      if (bytes === MAX_ERROR_BYTES) { incomplete = true; break }
    }
  } catch {
    incomplete = true
  } finally {
    signal.removeEventListener('abort', onAbort)
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  let text = Buffer.concat(chunks, bytes).toString('utf8').replace(/\uFFFD$/, '')
  try {
    const body: unknown = JSON.parse(text)
    text = errorMessage(body && typeof body === 'object' && 'error' in body ? body.error : undefined)
      ?? errorMessage(body) ?? ''
  } catch {
    // Incomplete/malformed JSON must not expose unrelated fields or credentials.
    if (/^\s*[\[{]/.test(text)) return undefined
  }
  text = redact(text, options, incomplete)
    .replace(/<!--[\s\S]*?(?:-->|$)|<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, MAX_REASON_CHARS) + (text.length > MAX_REASON_CHARS || incomplete ? '…' : '') : undefined
}

const requests = new AsyncLocalStorage<{ fetch: typeof globalThis.fetch; userAgent?: string }>()

export function withGoogleFetch<T>(options: {
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string | null>
} | undefined, request: () => T): T {
  const userAgent = Object.entries(options?.headers ?? {}).find(([key]) => key.toLowerCase() === 'user-agent')?.[1]
  return requests.run({ fetch: options?.fetch ?? globalThis.fetch,
    ...typeof userAgent === 'string' ? { userAgent } : {},
  }, request)
}

/** The pinned Google SDK's HTTP call uses this binding in builds and tests. */
export const googleFetch: typeof globalThis.fetch = (input, init) => {
  const request = requests.getStore()
  if (request?.userAgent) {
    // Google's default SDK agent would otherwise be prepended to Harness attribution.
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    headers.set('user-agent', request.userAgent)
    init = { ...init, headers }
  }
  return (request?.fetch ?? globalThis.fetch)(input, init)
}
