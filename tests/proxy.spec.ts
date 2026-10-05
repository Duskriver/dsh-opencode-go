import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createServer as httpsServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { getCACertificates, setDefaultCACertificates } from 'node:tls'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { assertProxyURL } from '../src/proxy-url.ts'
import { ProxyTransport } from '../src/proxy.ts'
import { GoUsageService } from '../src/usage.ts'
import { configOf } from './config-of.ts'
import { mockProxy } from './support/proxy.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

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
  it('tunnels HTTPS while retaining certificate and hostname verification', async () => {
    const cert = readFileSync(new URL('./fixtures/proxy-tls/cert.pem', import.meta.url), 'utf8')
    const key = readFileSync(new URL('./fixtures/proxy-tls/key.pem', import.meta.url), 'utf8')
    const trusted = getCACertificates('default')
    setDefaultCACertificates([...trusted, cert])
    cleanups.push(async () => { setDefaultCACertificates(trusted) })
    const server = httpsServer({ cert, key }, (_req, res) => { res.end('secure response') })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address() as { port: number }
    const proxy = await mockProxy(protocol, { target: `http://127.0.0.1:${address.port}` })
    cleanups.push(proxy.close)
    const transport = new ProxyTransport()
    cleanups.push(() => transport.dispose())
    const fetcher = transport.forProxy(proxy.url)!
    expect(await (await fetcher('https://gateway.invalid:4321')).text()).toBe('secure response')
    await expect(fetcher('https://wrong-host.invalid:4321')).rejects.toMatchObject({
      cause: { code: 'ERR_TLS_CERT_ALTNAME_INVALID' },
    })
    expect(proxy.destinations).toContain('gateway.invalid:4321')
  })

  it.each([
    { npm: '@ai-sdk/openai-compatible', path: '/v1/chat/completions', events: textEvents, namedEvents: false },
    { npm: '@ai-sdk/anthropic', path: '/v1/messages', events: anthropicEvents, namedEvents: true },
    { npm: '@ai-sdk/openai', path: '/v1/responses', events: responseEvents, namedEvents: false },
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
