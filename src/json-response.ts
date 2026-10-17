/** Bounded JSON GET requests with one retry for transient transport failures. */
import { setTimeout as delay } from 'node:timers/promises'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { waitWithSignal } from './request-control.ts'
import { measureTiming, type TimingObserver } from './diagnostic-timing.ts'

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
  onTiming?: TimingObserver,
): Promise<{ response: Response; body: unknown }> {
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') throw new TypeError('JSON requests must use GET')
  const headers = new Headers(init.headers)
  // Small responses retain the #7 workaround; metadata opts into recoverable gzip.
  headers.set('accept-encoding', encoding)
  const options = { ...init, method: 'GET', headers }
  const signal = init.signal ?? undefined
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted()
    const observer: TimingObserver | undefined = onTiming === undefined ? undefined
      : event => onTiming({ ...event, attempt: attempt + 1 })
    try {
      const response = await measureTiming(observer, 'headers', () => waitWithSignal(async () => {
        const response = await fetcher(url, options)
        // An uncooperative fetcher may deliver a response after its waiter timed out.
        if (signal?.aborted) {
          cancelResponse(response, signal.reason)
          signal.throwIfAborted()
        }
        return response
      }, signal), response => ({ status: response.status }))
      if (!response.ok) {
        // An opt-in reader owns consuming/cancelling its bounded error body.
        // Diagnostics must never replace the HTTP failure or cause another GET.
        if (readError) {
          let body: unknown
          try { body = await measureTiming(observer, 'error-body', () => waitWithSignal(() => readError(response), signal)) }
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
      const body = await readJsonResponse(response, maxBytes, { gzip: encoding === 'gzip', signal, onTiming: observer })
      signal?.throwIfAborted()
      return { response, body }
    } catch (error) {
      signal?.throwIfAborted()
      if (attempt > 0 || !retryableTransportFailure(error)) throw error
      await measureTiming(observer, 'retry-delay', () => delay(150, undefined, { signal }))
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
  response: Response, maxBytes: number, options: { gzip?: boolean; signal?: AbortSignal | null; onTiming?: TimingObserver } = {},
): Promise<unknown> {
  const signal = options.signal ?? undefined
  let bytes = await measureTiming(options.onTiming, 'body', () => readBoundedBody(response, maxBytes, signal), bytes => ({ bytes: bytes.length }))
  if (options.gzip && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = await measureTiming(options.onTiming, 'decompress', () => readGzipBody(bytes, maxBytes, signal), bytes => ({ bytes: bytes.length }))
    } catch (error) {
      options.signal?.throwIfAborted()
      if (error instanceof RangeError) throw error
      throw new SyntaxError('Response is not valid gzip', { cause: error })
    }
  }
  const body = await measureTiming(options.onTiming, 'parse', () => {
    signal?.throwIfAborted()
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch (error) {
      // Native JSON errors may echo response text. Keep it in the cause, outside the public message.
      throw new SyntaxError('Response is not valid JSON', { cause: error })
    }
  })
  signal?.throwIfAborted()
  return body
}
