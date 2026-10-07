/** Capture HTTP failure evidence before the provider SDK reduces it to a message. */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const MAX_BODY_BYTES = 16 * 1024
const BODY_READ_TIMEOUT_MS = 1000
// Unknown headers, cookies and authentication values are never persisted.
const RESPONSE_HEADERS = [
  'content-type', 'content-length', 'server', 'via', 'x-request-id', 'request-id',
  'cf-ray', 'x-amzn-requestid', 'x-vercel-id', 'traceparent', 'retry-after',
]

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

function requestSummary(input: RequestInfo | URL, init?: RequestInit): Record<string, unknown> {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  const session = headers.get('x-opencode-session')
  const result: Record<string, unknown> = {
    url: `${url.origin}${url.pathname}`, method: init?.method ?? (input instanceof Request ? input.method : 'GET'),
    sessionHash: session ? createHash('sha256').update(session).digest('hex').slice(0, 16) : undefined,
    userAgent: headers.get('user-agent')?.slice(0, 512),
  }
  if (typeof init?.body === 'string') {
    result.bodyBytes = Buffer.byteLength(init.body)
    try {
      const body = JSON.parse(init.body)
      result.messageCount = Array.isArray(body?.messages) ? body.messages.length : undefined
      result.toolCount = Array.isArray(body?.tools) ? body.tools.length : undefined
      const maxTokens = body?.max_tokens ?? body?.max_completion_tokens ?? body?.max_output_tokens
      if (typeof maxTokens === 'number') result.maxTokens = maxTokens
      const effort = body?.reasoning_effort ?? body?.reasoning?.effort
      if (typeof effort === 'string') result.reasoningEffort = effort.slice(0, 128)
      if (typeof body?.thinking?.type === 'string') result.thinking = body.thinking.type.slice(0, 128)
    } catch { /* Request content is never recorded, even when it is not JSON. */ }
  }
  return result
}

interface HttpEvidence {
  time: string
  provider: string
  model: string
  request: Record<string, unknown>
  response: { status: number; headers: Record<string, string>; body: BodyPreview }
}

/** One SDK attempt owns its capture; simultaneous requests cannot share evidence. */
export class GatewayDiagnostics {
  private evidence: Promise<HttpEvidence> | undefined
  private readonly secrets: string[]

  constructor(private readonly options: {
    provider: string
    model: string
    apiKey: string
    proxyURL?: string
    fetch?: typeof globalThis.fetch
    directory?: string
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
    const response = await (this.options.fetch ?? globalThis.fetch)(input, init)
    if (!response.ok) {
      const headers: Record<string, string> = {}
      for (const name of RESPONSE_HEADERS) {
        const value = response.headers.get(name)
        if (value !== null) headers[name] = this.redact(value).slice(0, 512)
      }
      const request = requestSummary(input, init)
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
      const time = new Date().toISOString()
      this.evidence = previewBody(response, signal).then(body => ({
        time, provider: this.options.provider, model: this.options.model,
        request, response: { status: response.status, headers, body: {
          ...body, text: this.redact(body.text, body.truncated || body.readFailed),
        } },
      }))
    }
    return response
  }

  async failureMessage(original: string): Promise<string> {
    let message = this.redact(original)
    const evidence = await this.evidence
    if (!evidence) return `${this.options.provider}/${this.options.model}: ${message}`
    const { status, body } = evidence.response
    // `(no body)` is also the SDK fallback for JSON without its expected error envelope.
    if (body.bytes > 0 && message.includes('status code (no body)')) {
      message = `${status} ${body.text.slice(0, 1024)}`
    }
    const presence = body.bytes > 0 ? 'nonempty' : body.readFailed ? 'unavailable' : 'empty'
    message += ` [HTTP ${status}; response body: ${presence}${body.truncated ? ', truncated' : ''}${body.readFailed ? ', incomplete read' : ''}]`
    if (this.options.directory?.trim()) {
      try {
        const directory = resolve(this.options.directory)
        await mkdir(directory, { recursive: true, mode: 0o700 })
        const file = join(directory, `http-error-${randomUUID()}.json`)
        // Apply redaction to every selected field, including endpoint and header summaries.
        await writeFile(file, JSON.stringify(evidence, (_key, value) => typeof value === 'string' ? this.redact(value) : value, 2)
          + '\n', { flag: 'wx', mode: 0o600 })
        message += ` [diagnostic file: ${this.redact(file)}]`
      } catch {
        message += ' [diagnostic file could not be written]'
      }
    }
    return `${this.options.provider}/${this.options.model}: ${message}`
  }
}
