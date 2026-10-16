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
