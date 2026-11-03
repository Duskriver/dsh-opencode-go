import { gzipSync } from 'node:zlib'
import { createServer, type RequestListener } from 'node:http'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  diagnosticURL,
  fetchJsonResponse,
  readJsonResponse,
  transportFailure,
  GatewayDiagnostics,
  ProxyTransport,
} from '../src/transport.ts'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { assertProxyURL } from '../src/contracts.ts'
import { GoUsageService } from '../src/accounts.ts'
import { configOf } from './support/host.ts'
import { mockProxy } from './support/proxy.ts'
import { closeMockGateways, googleTextEvents, listingBody, mockGateway, textEvents } from './support/gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/data.ts'
import { matchesGoogleModuleId } from '../scripts/google-fetch-bridge.mjs'

describe("bounded HTTP", () => {
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

    it('rejects an oversized body without waiting for stream cancellation', async () => {
      const cancelled = Promise.withResolvers<void>()
      const response = new Response(new ReadableStream({
        start(stream) { stream.enqueue(new TextEncoder().encode('{"ok":true}')) },
        cancel() { return cancelled.promise },
      }))
      const pending = readJsonResponse(response, 1).catch(error => error)
      try {
        expect(await Promise.race([pending, delay(200, 'still waiting')])).toBeInstanceOf(RangeError)
        expect(response.body!.locked).toBe(false)
      } finally { cancelled.resolve(); await pending }
    })
  })

  describe('fetchJsonResponse', () => {
    it('bounds a fetcher that ignores cancellation and cancels its late response', async () => {
      const headers = Promise.withResolvers<Response>()
      const started = Promise.withResolvers<void>()
      const cancel = vi.fn()
      const fetcher = vi.fn(() => { started.resolve(); return headers.promise })
      const controller = new AbortController()
      const reason = new DOMException('fixture deadline', 'TimeoutError')
      const pending = fetchJsonResponse('https://fixture.invalid/models', { signal: controller.signal }, 1024, 'identity', fetcher)
      const outcome = pending.catch(error => error)
      await started.promise
      controller.abort(reason)
      try {
        expect(await Promise.race([outcome, delay(200, 'still waiting')])).toBe(reason)
      } finally {
        let stream!: ReadableStreamDefaultController<Uint8Array>
        headers.resolve(new Response(new ReadableStream({
          start(controller) { stream = controller; controller.enqueue(new TextEncoder().encode('{"ok":true}')) }, cancel,
        })))
        await Promise.race([outcome, delay(50)])
        if (cancel.mock.calls.length === 0) stream.close()
        await outcome
      }
      await expect.poll(() => cancel.mock.calls.length).toBe(1)
      expect(fetcher).toHaveBeenCalledOnce()
    })

    it('bounds a stalled body even when stream cancellation never settles', async () => {
      const reading = Promise.withResolvers<void>()
      const cancelled = Promise.withResolvers<void>()
      let stream!: ReadableStreamDefaultController<Uint8Array>
      const cancel = vi.fn(() => cancelled.promise)
      const response = new Response(new ReadableStream<Uint8Array>({
        start(controller) { stream = controller; controller.enqueue(new TextEncoder().encode('{"ok":true}')) },
        pull() { reading.resolve() }, cancel,
      }, { highWaterMark: 0 }))
      const controller = new AbortController()
      const reason = new DOMException('fixture deadline', 'TimeoutError')
      const fetcher = vi.fn().mockResolvedValue(response)
      const pending = fetchJsonResponse('https://fixture.invalid/models', { signal: controller.signal }, 1024, 'identity', fetcher)
      const outcome = pending.catch(error => error)
      await reading.promise
      controller.abort(reason)
      try {
        expect(await Promise.race([outcome, delay(200, 'still waiting')])).toBe(reason)
        expect(cancel).toHaveBeenCalledOnce()
        expect(response.body!.locked).toBe(false)
        expect(fetcher).toHaveBeenCalledOnce()
      } finally {
        if (cancel.mock.calls.length === 0) stream.close()
        cancelled.resolve()
        await outcome
      }
    })

    it('does not wait for a failed HTTP response to finish cancellation', async () => {
      const cancelled = Promise.withResolvers<void>()
      const cancel = vi.fn(() => cancelled.promise)
      const response = new Response(new ReadableStream({ cancel }), { status: 503 })
      const fetcher = vi.fn().mockResolvedValue(response)
      const pending = fetchJsonResponse('https://fixture.invalid/models', {}, 1024, 'identity', fetcher)
      try {
        expect(await Promise.race([pending, delay(200, 'still waiting')])).toEqual({ response, body: undefined })
        expect(cancel).toHaveBeenCalledOnce()
        expect(fetcher).toHaveBeenCalledOnce()
      } finally { cancelled.resolve(); await pending }
    })

    it('bounds an error-body reader that ignores the request signal', async () => {
      const reading = Promise.withResolvers<void>()
      const body = Promise.withResolvers<unknown>()
      const response = new Response(new ReadableStream(), { status: 403 })
      const controller = new AbortController()
      const reason = new DOMException('fixture deadline', 'TimeoutError')
      const fetcher = vi.fn().mockResolvedValue(response)
      const pending = fetchJsonResponse('https://fixture.invalid/usage', { signal: controller.signal }, 1024, 'identity', fetcher,
        () => { reading.resolve(); return body.promise })
      const outcome = pending.catch(error => error)
      await reading.promise
      controller.abort(reason)
      try {
        expect(await Promise.race([outcome, delay(200, 'still waiting')])).toBe(reason)
        expect(fetcher).toHaveBeenCalledOnce()
      } finally { body.resolve(undefined); await outcome }
    })

    it('accepts gzip already decoded by Fetch without decompressing it twice', async () => {
      const document = { data: [{ id: 'compressed-model' }] }
      const endpoint = await localEndpoint((request, response) => {
        expect(request.headers['accept-encoding']).toBe('gzip')
        response.writeHead(200, { 'content-encoding': 'gzip', etag: '"compressed-version"' })
        response.end(gzipSync(Buffer.from(JSON.stringify(document))))
      })
      const result = await fetchJsonResponse(endpoint, { signal: AbortSignal.timeout(2000) }, 1024, 'gzip')
      expect(result.body).toEqual(document)
      expect(result.response.headers.get('etag')).toBe('"compressed-version"')
    })

    it.each([undefined, { 'content-encoding': 'gzip' }])('bounds recovered gzip output with headers %j', async (headers) => {
      const document = { data: 'x'.repeat(4096) }
      const plain = Buffer.from(JSON.stringify(document))
      const compressed = gzipSync(plain)
      expect(compressed.length).toBeLessThan(plain.length - 1)
      const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(compressed, { headers })))
      vi.stubGlobal('fetch', fetch)
      expect((await fetchJsonResponse('https://fixture.invalid/metadata', {}, plain.length, 'gzip')).body).toEqual(document)
      await expect(fetchJsonResponse('https://fixture.invalid/metadata', {}, plain.length - 1, 'gzip'))
        .rejects.toBeInstanceOf(RangeError)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('bounds the raw gzip input before decompression', async () => {
      const compressed = gzipSync(Buffer.from('{"ok":true}'))
      const fetch = vi.fn().mockResolvedValue(new Response(compressed))
      vi.stubGlobal('fetch', fetch)
      await expect(fetchJsonResponse('https://fixture.invalid/metadata', {}, compressed.length - 1, 'gzip'))
        .rejects.toBeInstanceOf(RangeError)
      expect(fetch).toHaveBeenCalledOnce()
    })

    it.each([
      { description: 'truncated gzip', body: gzipSync(Buffer.from('{"private":"upstream text"}')).subarray(0, 12), message: 'Response is not valid gzip' },
      { description: 'gzip containing invalid JSON', body: gzipSync(Buffer.from('{"private":invalid}')), message: 'Response is not valid JSON' },
    ])('does not retry or expose $description', async ({ body, message }) => {
      const fetch = vi.fn().mockResolvedValue(new Response(body))
      vi.stubGlobal('fetch', fetch)
      await expect(fetchJsonResponse('https://fixture.invalid/metadata', {}, 1024, 'gzip'))
        .rejects.toMatchObject({ name: 'SyntaxError', message })
      expect(fetch).toHaveBeenCalledOnce()
    })

    it('cancels raw gzip recovery with the original request signal', async () => {
      const compressed = gzipSync(Buffer.from(JSON.stringify({ data: 'x'.repeat(8 * 1024 * 1024) })))
      const fetch = vi.fn().mockResolvedValue(new Response(compressed))
      vi.stubGlobal('fetch', fetch)
      const controller = new AbortController()
      const reason = new DOMException('fixture cancellation', 'AbortError')
      const pending = fetchJsonResponse('https://fixture.invalid/metadata', { signal: controller.signal }, 16 * 1024 * 1024, 'gzip')
      const result = expect(pending).rejects.toBe(reason)
      // gzip recovery is asynchronous, so a caller can cancel while it is decoding.
      setImmediate(() => controller.abort(reason))
      await result
      expect(fetch).toHaveBeenCalledOnce()
    })

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

    it.each(['throw', 'reject'])('keeps the HTTP status and cancels the body when an error reader fails by %s', async mode => {
      const cancel = vi.fn()
      const response = new Response(new ReadableStream({ cancel }), { status: 403 })
      const fetcher = vi.fn().mockResolvedValue(response)
      const failure = Object.assign(new Error('private diagnostic failure'), { code: 'ECONNRESET' })
      const readError = () => { if (mode === 'throw') throw failure; return Promise.reject(failure) }
      expect(await fetchJsonResponse('https://fixture.invalid/usage', {}, 1024, 'identity', fetcher, readError))
        .toEqual({ response, body: undefined })
      expect(fetcher).toHaveBeenCalledOnce()
      expect(cancel).toHaveBeenCalledOnce()
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
})

describe("HTTP classification", () => {
  it.each([
    [500, { error: { message: 'upstream request 401 did not complete' } }, 'AUTH', 'SERVER'],
    [500, { error: { message: 'Diagnostic: previous request had insufficient credits' } }, 'QUOTA', 'SERVER'],
    [502, 'insufficient credits', 'QUOTA', 'SERVER'],
    [504, { error: { message: 'insufficient credits' } }, 'QUOTA', 'TIMEOUT'],
    [400, { error: { message: 'insufficient credits' } }, 'QUOTA', 'INVALID_REQUEST'],
    [500, { error: { type: 'CreditsError', message: 'Limit reached' } }, 'SERVER', 'QUOTA'],
    [402, { error: { message: 'insufficient credits' } }, 'AUTH', 'QUOTA'],
    [401, { error: { type: 'ModelError', message: 'invalid API key for this model' } }, 'AUTH', 'UNKNOWN_MODEL'],
    [401, { error: { type: 'AuthError', message: 'Access denied' } }, 'PI_AI_ERROR', 'INVALID_CREDENTIAL'],
    [403, { error: { type: 'RegionError', message: 'Unavailable in region' } }, 'PI_AI_ERROR', 'AUTH'],
    [401, { error: { message: 'insufficient credits' } }, 'AUTH', 'QUOTA'],
    [401, {}, 'AUTH', 'AUTH'],
    [429, { error: { type: 'RateLimitError' } }, 'PI_AI_ERROR', 'RATE_LIMIT'],
    [400, {}, 'CONTEXT_WINDOW_EXCEEDED', 'CONTEXT_WINDOW_EXCEEDED'],
    [400, { error: { code: 'context_length_exceeded', message: 'Limit reached' } }, 'INVALID_REQUEST', 'CONTEXT_WINDOW_EXCEEDED'],
    [422, { error: { type: 'context_window_exceeded', message: 'Limit reached' } }, 'INVALID_REQUEST', 'CONTEXT_WINDOW_EXCEEDED'],
    [400, { message: 'Prompt exceeds the model context window' }, 'INVALID_REQUEST', 'CONTEXT_WINDOW_EXCEEDED'],
    [413, 'request body too large', 'INVALID_REQUEST', 'INVALID_REQUEST'],
    [400, { model: 'deepseek-v4.1-flash' }, 'INVALID_REQUEST', 'INVALID_REQUEST'],
    [502, { error: { message: 'previous request: context_length_exceeded' } }, 'CONTEXT_WINDOW_EXCEEDED', 'SERVER'],
    [504, {}, 'SERVER', 'TIMEOUT'],
  ] as const)('classifies HTTP %s from captured response evidence', async (status, body, fallback, expected) => {
    const diagnostics = new GatewayDiagnostics({ provider: 'test', model: 'test', apiKey: 'fixture-key',
      fetch: async () => Response.json(body, { status }) })
    await diagnostics.fetch('https://gateway.example/v1')
    expect(await diagnostics.failureCode(fallback)).toBe(expected)
  })
})

describe("proxy dispatch", () => {
  const cleanups: Array<() => Promise<unknown>> = []

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
    await closeMockGateways()
  })

  const anthropicEvents = [
    { type: 'message_start', message: { id: 'msg', type: 'message', role: 'assistant', model: 'future', content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ].map(event => JSON.stringify(event))

  const responseMessage = { id: 'msg', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'hello', annotations: [] }] }

  const responseEvents = [
    { type: 'response.created', response: { id: 'resp' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...responseMessage, content: [] } },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'hello' },
    { type: 'response.output_item.done', output_index: 0, item: responseMessage },
    { type: 'response.completed', response: { id: 'resp', status: 'completed', output: [responseMessage], usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 } } },
  ].map(event => JSON.stringify(event))

  async function generate(adapter: OpencodeGoAdapter) {
    return Array.fromAsync(adapter.stream({
      provider: 'dsh-opencode-go', model: 'future', sessionId: 'proxy-session' as never,
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'plugin', plugin: 'test' } })],
    }))
  }

  describe('proxy address validation', () => {
    it('accepts supported addresses and blank, and never echoes credentials in errors', () => {
      expect(assertProxyURL('  ')).toBe('')
      expect(assertProxyURL(' http://localhost:7890 ')).toBe('http://localhost:7890/')
      expect(assertProxyURL('https://localhost')).toBe('https://localhost/')
      expect(assertProxyURL('socks5://user:password@localhost:1080')).toContain('socks5:')
      for (const value of ['localhost:7890', 'socks4://localhost', 'http://localhost:0', 'socks5://',
        'http://user:private-password@localhost/path', 'http://localhost?x=1', 'http://localhost#x', 'http://%zz:password@localhost']) {
        expect(() => assertProxyURL(value)).toThrow()
        try { assertProxyURL(value) } catch (error) { expect(String(error)).not.toContain('private-password') }
      }
    })
  })

  describe.each(['http', 'socks5'] as const)('%s proxy', protocol => {

    it.each([
      { npm: '@ai-sdk/openai-compatible', path: '/v1/chat/completions', events: textEvents, namedEvents: false },
      { npm: '@ai-sdk/anthropic', path: '/v1/messages', events: anthropicEvents, namedEvents: true },
      { npm: '@ai-sdk/openai', path: '/v1/responses', events: responseEvents, namedEvents: false },
      { npm: '@ai-sdk/google', path: '/v1/models/future:streamGenerateContent', events: googleTextEvents, namedEvents: false },
    ])('streams $path and discovers models through an authenticated proxy', async ({ npm, path, events, namedEvents }) => {
      const original = globalThis.fetch
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
        ? Promise.resolve(Response.json(metadataDocument({ future: modelMetadata({ provider: { npm }, reasoning_options: [] }) })))
        : original(input, init))
      const gateway = await mockGateway({ status: 200, body: listingBody(['future']) })
      gateway.pushCompletions({ events, namedEvents })
      const proxy = await mockProxy(protocol, { target: gateway.url, username: 'user', password: 'p@ss' })
      cleanups.push(proxy.close)
      const adapter = new OpencodeGoAdapter({
        config: () => configOf('http://gateway.invalid:4321/v1', { proxyURL: proxy.url.replace('://', '://user:p%40ss@') }),
        resolveApiKey: async () => 'test-key',
        onFallback: ({ error }) => { throw error },
      })
      cleanups.push(() => adapter.dispose())
      const chunks = await generate(adapter)
      expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
      expect(gateway.paths.map(path => path.split('?')[0])).toEqual(['/v1/models', path])
      expect(proxy.destinations.length).toBeGreaterThan(0)
      expect(proxy.destinations.every(destination => destination === 'gateway.invalid:4321')).toBe(true)
      expect(proxy.authorizations).toContain(protocol === 'http' ? `Basic ${Buffer.from('user:p@ss').toString('base64')}` : 'user:p@ss')
      expect(gateway.headers[1]?.['x-opencode-session']).toBe('proxy-session')
      expect(gateway.headers[1]?.['proxy-authorization']).toBeUndefined()
      expect(JSON.stringify(gateway.headers)).not.toContain('p@ss')
    })

    it('routes usage and model metadata through the proxy, and resets usage identity on change', async () => {
      const window = { status: 'ok', percent: 10, resetsAt: '2026-10-07T00:00:00Z' }
      const usage = { rolling: window, weekly: window, monthly: window }
      const paths: string[] = []
      const server = createServer((req, res) => {
        paths.push(req.url!)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(req.url === '/api.json' ? metadataDocument() : { usage }))
      })
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
      const address = server.address() as { port: number }
      const proxy = await mockProxy(protocol, { target: `http://127.0.0.1:${address.port}` })
      cleanups.push(proxy.close)
      const transport = new ProxyTransport()
      cleanups.push(() => transport.dispose())
      const original = globalThis.fetch
      // A loopback HTTP metadata endpoint keeps the transfer real without an external service.
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
        original(String(input) === MODELS_METADATA_URL ? 'http://metadata.invalid:4321/api.json' : input, init))
      const ctx = new Context()
      cleanups.push(() => ctx.fiber.dispose())
      let proxyURL = proxy.url
      const service = new GoUsageService(ctx, {
        baseURL: () => 'http://gateway.invalid:4321/v1', proxyURL: () => proxyURL,
        transport, resolveApiKey: async () => 'test-key',
      })
      const first = await service.read()
      expect(first.rolling.percent).toBe(10)
      // Exercise the same catalog metadata fetch path as the adapter.
      const { OpencodeGoCatalog } = await import('../src/catalog.ts')
      await new OpencodeGoCatalog('http://gateway.invalid:4321/v1', 60_000,
        () => {}, () => {}, () => {}, transport.forProxy(proxyURL)).snapshot(true)
      expect(paths).toContain('/api.json')
      expect(proxy.destinations).toContain('metadata.invalid:4321')
      const secondProxy = await mockProxy(protocol, { target: `http://127.0.0.1:${address.port}` })
      cleanups.push(secondProxy.close)
      proxyURL = secondProxy.url
      const second = await service.read()
      expect(second.source).not.toBe(first.source)
      expect(secondProxy.destinations).toContain('gateway.invalid:4321')
    })

    it('does not fall back to a direct connection when the proxy is unavailable', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['future']) })
      const proxy = await mockProxy(protocol)
      await proxy.close()
      const transport = new ProxyTransport()
      cleanups.push(() => transport.dispose())
      await expect(transport.forProxy(proxy.url)!(gateway.url)).rejects.toThrow()
      expect(gateway.paths).toEqual([])
    })

    it('preserves an active response when switching proxies and cancels stream reads on abort', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['future']) })
      const first = await mockProxy(protocol)
      const second = await mockProxy(protocol)
      cleanups.push(first.close, second.close)
      const transport = new ProxyTransport()
      cleanups.push(() => transport.dispose())
      gateway.pushCompletions({ events: ['hello'], delayMs: 20 })
      const response = await transport.forProxy(first.url)!(gateway.url + '/chat/completions', { method: 'POST', body: '{}' })
      await (await transport.forProxy(second.url)!(gateway.url + '/models')).json()
      expect(await response.text()).toBe('data: hello\n\n')
      gateway.pushCompletions({ events: ['started'], hangOpen: true })
      const controller = new AbortController()
      const pending = await transport.forProxy(first.url)!(gateway.url + '/chat/completions', {
        method: 'POST', body: '{}', signal: controller.signal,
      })
      const reader = pending.body!.getReader()
      await reader.read()
      const read = reader.read()
      controller.abort()
      await expect(read).rejects.toMatchObject({ name: 'AbortError' })
    })
  })

  it('switches proxies and clears the address without a restart, while preserving captured calls', async () => {
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? Promise.resolve(Response.json(metadataDocument({ future: modelMetadata({ reasoning_options: [] }) })))
      : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody(['future']) })
    const first = await mockProxy('http')
    const second = await mockProxy('socks5')
    cleanups.push(first.close, second.close)
    let config = configOf(gateway.url, { proxyURL: first.url })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    cleanups.push(() => adapter.dispose())
    for (const proxyURL of [first.url, second.url, '']) {
      config = { ...config, proxyURL }
      gateway.pushCompletions({ events: textEvents })
      expect(await generate(adapter)).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
    }
    expect(gateway.modelListings).toBe(3)
    expect(first.destinations.length).toBeGreaterThan(0)
    expect(second.destinations.length).toBeGreaterThan(0)
    const transport = new ProxyTransport()
    cleanups.push(() => transport.dispose())
    const captured = transport.forProxy(first.url)!
    await (await captured(gateway.url + '/models')).json()
    await (await transport.forProxy(second.url)!(gateway.url + '/models')).json()
    const before = first.destinations.length
    await (await captured(gateway.url + '/models')).json()
    expect(first.destinations.length).toBeGreaterThan(before)
    expect(transport.forProxy('')).toBeUndefined()
  })
})

describe("guarded SDK bridge", () => {
  const sdk = String.raw`C:\work\node_modules\@google\genai\dist\node\index.mjs`

  const adapter = String.raw`C:\work\node_modules\opencode-go-pi-ai\dist\api\google-generative-ai.js`

  it.each([
    ['C:/work/node_modules/@google/genai/dist/node/index.mjs', sdk],
    ['/C:/work/node_modules/@google/genai/dist/node/index.mjs?v=hash', sdk],
    ['C:/work/node_modules/opencode-go-pi-ai/dist/api/google-generative-ai.js', adapter],
    ['/project/node_modules/@google/genai/dist/node/index.mjs?import', '/project/node_modules/@google/genai/dist/node/index.mjs'],
    ['//server/share/node_modules/@google/genai/dist/node/index.mjs', String.raw`\\server\share\node_modules\@google\genai\dist\node\index.mjs`],
  ])('binds normalized loader ID %s to its native module path', (id, filename) => {
    expect(matchesGoogleModuleId(id, filename)).toBe(true)
  })

  it.each([
    'C:/other/node_modules/@google/genai/dist/node/index.mjs',
    'D:/work/node_modules/@google/genai/dist/node/index.mjs',
    'C:/work/node_modules/@google/genai/dist/web/index.mjs',
  ])('leaves other Google SDK modules untouched: %s', id => {
    expect(matchesGoogleModuleId(id, sdk)).toBe(false)
  })
})
