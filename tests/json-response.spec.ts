import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readJsonResponse } from '../src/json-response.ts'

const encodings = [
  { name: 'Brotli', compress: brotliCompressSync },
  { name: 'gzip', compress: gzipSync },
  { name: 'deflate', compress: deflateSync },
]

describe('readJsonResponse', () => {
  it('accepts ordinary UTF-8 JSON, including a leading BOM', async () => {
    const document = { name: '模型', data: ['a', 'b'] }
    const body = Buffer.from(JSON.stringify(document))

    await expect(readJsonResponse(new Response(body), 1024)).resolves.toEqual(document)
    await expect(readJsonResponse(new Response(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])), 1024))
      .resolves.toEqual(document)
  })

  it('allows the exact input byte limit and counts UTF-8 bytes', async () => {
    const document = { name: '模型' }
    const body = Buffer.from(JSON.stringify(document))

    await expect(readJsonResponse(new Response(body), body.byteLength)).resolves.toEqual(document)
    await expect(readJsonResponse(new Response(body), body.byteLength - 1))
      .rejects.toThrow(/exceeds.*byte limit/i)
  })

  it.each([
    { description: 'missing Content-Length', headers: undefined },
    { description: 'dishonest Content-Length', headers: { 'content-length': '1' } },
  ])('cancels an oversized stream early with $description', async ({ headers }) => {
    let reads = 0
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1
        controller.enqueue(Buffer.from('0123456789'))
        if (reads === 3) controller.close()
      },
      cancel() { cancelled = true },
    }, { highWaterMark: 0 })

    const result = readJsonResponse(new Response(body, { headers }), 16)

    await expect(result).rejects.toBeInstanceOf(RangeError)
    await expect(result).rejects.toThrow(/exceeds.*byte limit/i)
    expect(cancelled).toBe(true)
    expect(reads).toBe(2)
  })

  it.each(encodings)('recovers $name JSON without a Content-Encoding header', async ({ compress }) => {
    const document = { data: [{ id: 'model-from-gateway' }] }
    const body = compress(Buffer.from(JSON.stringify(document)))

    await expect(readJsonResponse(new Response(body, {
      headers: { 'content-type': 'application/json' },
    }), 1024)).resolves.toEqual(document)
  })

  it.each(encodings)('allows $name output exactly at the decoded byte limit', async ({ compress }) => {
    const document = { data: 'x'.repeat(2048) }
    const plain = Buffer.from(JSON.stringify(document))
    const body = compress(plain)

    await expect(readJsonResponse(new Response(body), plain.byteLength)).resolves.toEqual(document)
  })

  it.each(encodings)('rejects oversized $name output and retains its decoder error', async ({ compress }) => {
    const body = compress(Buffer.from(JSON.stringify({ data: 'x'.repeat(4096) })))
    expect(body.byteLength).toBeLessThan(1024)

    const error: unknown = await readJsonResponse(new Response(body), 1024).catch(error => error)

    expect(error).toBeInstanceOf(RangeError)
    expect((error as Error).message).toMatch(/exceeds.*byte limit/i)
    expect((error as Error).cause).toBeInstanceOf(Error)
  })

  it.each([
    { description: 'malformed JSON', body: Buffer.from('{not JSON}') },
    { description: 'an HTML error page', body: Buffer.from('<html>upstream error</html>') },
    { description: 'truncated gzip data', body: gzipSync(Buffer.from('{"data":[]}')).subarray(0, -8) },
  ])('preserves useful diagnostics for $description', async ({ body }) => {
    const error: unknown = await readJsonResponse(new Response(body), 1024).catch(error => error)

    expect(error).toBeInstanceOf(AggregateError)
    expect((error as Error).message).toMatch(/valid JSON/i)
    const failures = (error as AggregateError).errors as Error[]
    expect(failures.some(failure => failure instanceof SyntaxError)).toBe(true)
    for (const encoding of encodings) {
      const failure = failures.find(failure => failure.message.toLowerCase().includes(encoding.name.toLowerCase()))
      expect(failure, `missing ${encoding.name} diagnostic`).toBeInstanceOf(Error)
      expect(failure?.cause, `missing ${encoding.name} original error`).toBeInstanceOf(Error)
    }
  })

  it('retains the JSON parse error when decompression succeeds but its content is invalid', async () => {
    const body = gzipSync(Buffer.from('{not JSON}'))
    const error: unknown = await readJsonResponse(new Response(body), 1024).catch(error => error)

    expect(error).toBeInstanceOf(AggregateError)
    const failures = (error as AggregateError).errors as Error[]
    const gzipFailure = failures.find(failure => failure.message.toLowerCase().includes('gzip'))
    expect(gzipFailure?.cause).toBeInstanceOf(SyntaxError)
  })
})
