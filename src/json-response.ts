/** Bounded JSON GET requests with one retry for transient transport failures. */
import { setTimeout as delay } from 'node:timers/promises'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

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
): Promise<{ response: Response; body: unknown }> {
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') throw new TypeError('JSON requests must use GET')
  const headers = new Headers(init.headers)
  // Small responses retain the #7 workaround; metadata opts into recoverable gzip.
  headers.set('accept-encoding', encoding)
  const options = { ...init, method: 'GET', headers }
  for (let attempt = 0; ; attempt += 1) {
    init.signal?.throwIfAborted()
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        await response.body?.cancel().catch(() => {})
        return { response, body: undefined }
      }
      return { response, body: await readJsonResponse(response, maxBytes, { gzip: encoding === 'gzip', signal: init.signal }) }
    } catch (error) {
      init.signal?.throwIfAborted()
      if (attempt > 0 || !retryableTransportFailure(error)) throw error
      await delay(150, undefined, { signal: init.signal ?? undefined })
    }
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (response.body === null) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return Buffer.concat(chunks, size)
      // Count actual bytes: Content-Length may be missing, wrong, or refer to compressed bytes.
      if (value.byteLength > maxBytes - size) {
        const error = new RangeError(`Response body exceeds ${maxBytes} byte limit`)
        await reader.cancel(error).catch(() => {})
        throw error
      }
      size += value.byteLength
      chunks.push(value)
    }
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
  let bytes = await readBoundedBody(response, maxBytes)
  if (options.gzip && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      bytes = await readGzipBody(bytes, maxBytes, options.signal)
    } catch (error) {
      options.signal?.throwIfAborted()
      if (error instanceof RangeError) throw error
      throw new SyntaxError('Response is not valid gzip', { cause: error })
    }
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch (error) {
    // Native JSON errors may echo response text. Keep it in the cause, outside the public message.
    throw new SyntaxError('Response is not valid JSON', { cause: error })
  }
}
