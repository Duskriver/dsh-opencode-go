import { gzipSync } from 'node:zlib'
import { createServer, type RequestListener } from 'node:http'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { diagnosticURL, fetchJsonResponse, readJsonResponse, transportFailure } from '../src/json-response.ts'

const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function localEndpoint(listener: RequestListener): Promise<string> {
  const server = createServer(listener)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections()
    server.close(error => error ? reject(error) : resolve())
  }))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing server address')
  return `http://127.0.0.1:${address.port}/models`
}

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

  it.each([
    { description: 'malformed JSON', body: Buffer.from('{"private-token": broken}') },
    { description: 'an HTML error page', body: Buffer.from('<html>upstream error</html>') },
    { description: 'unlabeled compressed bytes', body: gzipSync(Buffer.from('{"data":[]}')) },
  ])('reports $description without echoing the response body', async ({ body }) => {
    const error: unknown = await readJsonResponse(new Response(body), 1024).catch(error => error)
    expect(error).toBeInstanceOf(SyntaxError)
    expect((error as Error).message).toBe('Response is not valid JSON')
    expect((error as Error).cause).toBeInstanceOf(SyntaxError)
  })
})

describe('fetchJsonResponse', () => {
  it('recovers a GET when the first connection closes before headers arrive', async () => {
    let requests = 0
    const endpoint = await localEndpoint((request, response) => {
      requests += 1
      expect(request.headers['accept-encoding']).toBe('identity')
      expect(request.headers.authorization).toBe('Bearer fixture-key')
      if (requests === 1) { response.destroy(); return }
      response.setHeader('content-type', 'application/json')
      response.setHeader('etag', '"fixture-version"')
      response.end('{"data":[{"id":"recovered"}]}')
    })
    const headers = new Headers({ authorization: 'Bearer fixture-key', 'accept-encoding': 'gzip' })
    const result = await fetchJsonResponse(endpoint, { method: 'GET', headers, signal: AbortSignal.timeout(2000) }, 1024)
    expect(result.body).toEqual({ data: [{ id: 'recovered' }] })
    expect(result.response.headers.get('etag')).toBe('"fixture-version"')
    expect(requests).toBe(2)
    expect(headers.get('accept-encoding')).toBe('gzip')
  })

  it('retries a connection lost during the response body, after headers have arrived', async () => {
    let requests = 0
    let receivedHeaders = 0
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const response = await originalFetch(input, init)
      receivedHeaders += 1
      return response
    })
    const endpoint = await localEndpoint((_request, response) => {
      requests += 1
      response.writeHead(200, { 'content-type': 'application/json' })
      if (requests === 1) {
        response.write('{"data":')
        setTimeout(() => response.destroy(), 20)
      } else response.end('{"data":[]}')
    })
    expect((await fetchJsonResponse(endpoint, { signal: AbortSignal.timeout(2000) }, 1024)).body).toEqual({ data: [] })
    expect(receivedHeaders).toBe(2)
    expect(requests).toBe(2)
  })

  it('stops after two attempts when the endpoint keeps disconnecting', async () => {
    let requests = 0
    const endpoint = await localEndpoint((_request, response) => { requests += 1; response.destroy() })
    await expect(fetchJsonResponse(endpoint, { signal: AbortSignal.timeout(2000) }, 1024)).rejects.toBeInstanceOf(Error)
    expect(requests).toBe(2)
  })

  it.each([304, 401, 503])('returns HTTP %i without retrying or parsing the error body', async (status) => {
    const cancel = vi.fn()
    const response = new Response(status === 304 ? null : new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('upstream private text')) },
      cancel,
    }), { status })
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    expect(await fetchJsonResponse('https://fixture.invalid/models', {}, 1024)).toEqual({ response, body: undefined })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(status === 304 ? 0 : 1)
  })

  it.each([
    { body: '{"private":invalid}', maxBytes: 1024, error: SyntaxError },
    { body: '{"data":"oversized"}', maxBytes: 2, error: RangeError },
  ])('does not retry JSON parsing or response limits: $error.name', async ({ body, maxBytes, error }) => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(body)))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchJsonResponse('https://fixture.invalid/models', {}, maxBytes)).rejects.toBeInstanceOf(error)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each(['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET', 'EAI_AGAIN'])('recovers the nested transient transport code %s', async (code) => {
    const cause = new Error('private upstream detail', { cause: Object.assign(new Error('private transport detail'), { code }) })
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed', { cause })).mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetch)
    const signal = AbortSignal.timeout(2000)
    expect((await fetchJsonResponse('https://fixture.invalid/models', { signal }, 1024)).body).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.every(([, options]) => options.signal === signal)).toBe(true)
  })

  it.each(['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ENOTFOUND', 'ECONNREFUSED'])('does not retry %s', async (code) => {
    const error = new TypeError('fetch failed', { cause: Object.assign(new Error('private transport detail'), { code }) })
    const fetch = vi.fn().mockRejectedValue(error)
    vi.stubGlobal('fetch', fetch)
    await expect(fetchJsonResponse('https://fixture.invalid/models', {}, 1024)).rejects.toBe(error)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not follow more than five error objects in a cause chain', async () => {
    let error = Object.assign(new Error('socket closed'), { code: 'ECONNRESET' }) as Error
    for (let depth = 0; depth < 5; depth += 1) error = new Error('wrapped', { cause: error })
    const fetch = vi.fn().mockRejectedValue(error)
    vi.stubGlobal('fetch', fetch)
    await expect(fetchJsonResponse('https://fixture.invalid/models', {}, 1024)).rejects.toBe(error)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cancels the backoff without starting a second request when the caller aborts', async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockRejectedValue(Object.assign(new Error('closed'), { code: 'ECONNRESET' }))
    vi.stubGlobal('fetch', fetch)
    const pending = fetchJsonResponse('https://fixture.invalid/models', { signal: controller.signal }, 1024)
    const result = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await delay(20)
    controller.abort()
    await result
    await delay(170)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('uses the original deadline while reading the retried response body', async () => {
    let requests = 0
    const endpoint = await localEndpoint((_request, response) => {
      requests += 1
      if (requests === 1) { response.destroy(); return }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{"data":')
    })
    const signal = AbortSignal.timeout(500)
    const error: unknown = await fetchJsonResponse(endpoint, { signal }, 1024).catch(error => error)
    expect(signal.aborted).toBe(true)
    expect(error).toBe(signal.reason)
    expect(requests).toBe(2)
  })

  it('rejects methods other than GET before issuing any request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(fetchJsonResponse('https://fixture.invalid/models', { method: 'POST' }, 1024)).rejects.toThrow('must use GET')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('safe transport diagnostics', () => {
  it('keeps nested error codes but never includes the original error message', () => {
    const error = new TypeError('private fetch detail', { cause: new Error('private wrapper', {
      cause: Object.assign(new Error('secret credential'), { code: 'ECONNRESET' }),
    }) })
    expect(transportFailure(error)).toBe('network error (ECONNRESET)')
    expect(transportFailure(new Error('secret credential'))).toBe('network request failed')
    expect(transportFailure(new DOMException('secret credential', 'TimeoutError'))).toBe('request timed out or was aborted')
  })

  it('strips credentials, query strings and fragments from diagnostic URLs', () => {
    expect(diagnosticURL('https://user:password@example.invalid/v1/models?key=secret#private'))
      .toBe('https://example.invalid/v1/models')
  })
})
