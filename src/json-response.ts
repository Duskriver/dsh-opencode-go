/** Bounded JSON reads with a compatibility fallback for missing compression headers. */
import { promisify } from 'node:util'
import { brotliDecompress, gunzip, inflate } from 'node:zlib'

const decoders = [
  { name: 'Brotli', decode: promisify(brotliDecompress) },
  { name: 'gzip', decode: promisify(gunzip) },
  { name: 'deflate', decode: promisify(inflate) },
]

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

/** The limit applies both to bytes delivered by fetch and to any fallback decoder's output. */
export async function readJsonResponse(response: Response, maxBytes: number): Promise<unknown> {
  const bytes = await readBoundedBody(response, maxBytes)
  const parse = (data: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(data))
  const errors: unknown[] = []
  try {
    // Fetch already decodes correctly labeled responses, even if it retains the encoding header.
    return parse(bytes)
  } catch (error) {
    errors.push(error)
  }
  for (const { name, decode } of decoders) {
    try {
      return parse(await decode(bytes, { maxOutputLength: maxBytes }))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ERR_BUFFER_TOO_LARGE') {
        throw new RangeError(`${name} decoded response exceeds ${maxBytes} byte limit`, { cause: error })
      }
      errors.push(new Error(`${name} response decoding or JSON parsing failed`, { cause: error }))
    }
  }
  throw new AggregateError(errors, 'Response is not valid JSON, including after Brotli, gzip, or deflate decoding')
}
