import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type RequestListener } from 'node:http'
import { createServer as httpsServer } from 'node:https'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { connect, type Socket } from 'node:net'
import { fileURLToPath } from 'node:url'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { FreeBunTransport } from '../src/free-transport.ts'
import { resolveFreeRuntime } from '../src/free-runtime.ts'
import { mockProxy } from './support/proxy.ts'

// Test-only localhost certificate; never used by production transports.
const certPath = new URL('./fixtures/localhost-cert.pem', import.meta.url)
const tls = { cert: readFileSync(certPath), key: readFileSync(new URL('./fixtures/localhost-key.pem', import.meta.url)) }
const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

async function server(listener: RequestListener, secure = false) {
  const value = secure ? httpsServer(tls, listener) : createServer(listener)
  await new Promise<void>(resolve => value.listen(0, '127.0.0.1', resolve))
  cleanups.push(async () => { value.closeAllConnections(); await new Promise<void>(resolve => value.close(() => resolve())) })
  const bound = value.address()
  if (!bound || typeof bound === 'string') throw new Error('missing fixture port')
  return { value, url: `${secure ? 'https' : 'http'}://127.0.0.1:${bound.port}` }
}

function transport(maxConcurrent?: number) {
  const value = new FreeBunTransport({ maxConcurrent })
  cleanups.push(() => value.dispose())
  return value
}

describe('standalone Bun Free transport', () => {
  it('resolves the pinned official binary without an install script or OpenCode', () => {
    expect(resolveFreeRuntime()).toMatch(/[\\/]node_modules[\\/](?:@oven[\\/]bun-|bun[\\/])/)
    expect(execFileSync(resolveFreeRuntime(), ['--version'], { encoding: 'utf8' }).trim()).toBe('1.4.4')
  })

  it('streams before upstream EOF and preserves binary bytes with backpressure', async () => {
    let finish!: () => void
    const binary = Buffer.from(Array.from({ length: 512 * 1024 }, (_, i) => i % 256))
    const gateway = await server((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'x-fixture': 'stream' })
      response.write('first\n')
      finish = () => response.end(binary)
    })
    const response = await transport().forProxy()(gateway.url)
    expect(response.headers.get('x-fixture')).toBe('stream')
    expect(response.url).toBe(gateway.url + '/')
    const reader = response.body!.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('first\n')
    finish()
    const chunks: Buffer[] = []
    for (;;) { const part = await reader.read(); if (part.done) break; chunks.push(Buffer.from(part.value)) }
    expect(Buffer.concat(chunks)).toEqual(binary)
  })

  it('preserves HTTP errors and empty HTTP statuses', async () => {
    const gateway = await server((request, response) => {
      if (request.url === '/empty') { response.writeHead(204).end(); return }
      response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '12' })
      response.end('{"error":{"type":"FreeUsageLimitError"}}')
    })
    const fetch = transport().forProxy()
    const response = await fetch(gateway.url)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('12')
    expect(await response.json()).toEqual({ error: { type: 'FreeUsageLimitError' } })
    const empty = await fetch(gateway.url + '/empty')
    expect(empty.status).toBe(204)
    expect(empty.body).toBeNull()
  })

  it('sends a large binary request without altering its bytes', async () => {
    const payload = Buffer.from(Array.from({ length: 512 * 1024 }, (_, i) => i % 256))
    const gateway = await server((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', chunk => chunks.push(chunk))
      request.on('end', () => response.end(Buffer.concat(chunks)))
    })
    const response = await transport().forProxy()(gateway.url, { method: 'POST', body: payload })
    expect(Buffer.from(await response.arrayBuffer())).toEqual(payload)
  })

  it.each(['abort', 'cancel', 'dispose'] as const)('%s closes the upstream stream and reaps the worker', async kind => {
    let closed = false
    const gateway = await server((_request, response) => {
      response.writeHead(200); response.write('waiting')
      response.once('close', () => { closed = true })
    })
    const owner = transport()
    const controller = new AbortController()
    const response = await owner.forProxy()(gateway.url, { signal: controller.signal })
    const reader = response.body!.getReader()
    await reader.read()
    if (kind === 'cancel') await reader.cancel()
    else {
      const pending = reader.read()
      const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      if (kind === 'abort') controller.abort()
      else await owner.dispose()
      await rejected
    }
    await owner.dispose()
    await vi.waitFor(() => expect(closed).toBe(true))
    await expect(owner.forProxy()(gateway.url)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('aborts before response headers and aborts a queued request without starting it', async () => {
    let calls = 0
    let arrived!: () => void
    const arrival = new Promise<void>(resolve => { arrived = resolve })
    const gateway = await server((_request, response) => { calls++; arrived(); response.once('close', () => {}) })
    const owner = transport(1)
    const firstAbort = new AbortController()
    const first = owner.forProxy()(gateway.url, { signal: firstAbort.signal }).catch(error => error)
    await arrival
    const queuedAbort = new AbortController()
    const queued = owner.forProxy()(gateway.url, { signal: queuedAbort.signal })
    queuedAbort.abort()
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls).toBe(1)
    firstAbort.abort()
    expect(await first).toMatchObject({ name: 'AbortError' })
    await owner.dispose()
  })

  it('turns worker startup failure into a fetch rejection', async () => {
    const owner = new FreeBunTransport({ executable: () => '/missing/free-bun-runtime' })
    cleanups.push(() => owner.dispose())
    await expect(owner.forProxy()('http://127.0.0.1:1')).rejects.toBeInstanceOf(TypeError)
  })

  it('reports a missing runtime before the SDK can obscure its error code', () => {
    const owner = new FreeBunTransport({ executable: () => { throw new LlmError('runtime missing', 'MISSING_BUN_RUNTIME') } })
    expect(() => owner.forProxy()).toThrowError(expect.objectContaining({ code: 'MISSING_BUN_RUNTIME' }))
  })

  it('uses an HTTPS proxy with authenticated CONNECT and target TLS', async () => {
    vi.stubEnv('NODE_EXTRA_CA_CERTS', fileURLToPath(certPath))
    const gateway = await server((_request, response) => response.end('https-proxy-target'), true)
    const proxy = await server((_request, response) => response.writeHead(500).end(), true)
    const sockets = new Set<Socket>()
    cleanups.push(async () => { for (const socket of sockets) socket.destroy() })
    proxy.value.on('connect', (request, client, head) => {
      expect(request.headers['proxy-authorization']).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`)
      const target = new URL(gateway.url)
      const upstream = connect({ host: '127.0.0.1', port: Number(target.port) })
      sockets.add(upstream); sockets.add(client as Socket)
      upstream.on('error', () => client.destroy())
      client.on('error', () => upstream.destroy())
      upstream.on('connect', () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head); client.pipe(upstream).pipe(client) })
      client.once('close', () => upstream.destroy())
      upstream.once('close', () => client.destroy())
    })
    const fetch = transport().forProxy(proxy.url.replace('://', '://user:pass@'))
    expect(await (await fetch('https://gateway.invalid:4321/path')).text()).toBe('https-proxy-target')
  })

  it.each(['http', 'socks5'] as const)('uses authenticated %s proxy tunnels and validates target TLS', async protocol => {
    vi.stubEnv('NODE_EXTRA_CA_CERTS', fileURLToPath(certPath))
    const gateway = await server((request, response) => {
      expect(request.headers['proxy-authorization']).toBeUndefined()
      response.end('secure-proxied')
    }, true)
    const proxy = await mockProxy(protocol, { target: gateway.url, username: 'user', password: 'p@ss' })
    cleanups.push(proxy.close)
    const fetch = transport().forProxy(proxy.url.replace('://', '://user:p%40ss@'))
    expect(await (await fetch('https://gateway.invalid:4321/path')).text()).toBe('secure-proxied')
    expect(proxy.destinations).toEqual(['gateway.invalid:4321'])
    expect(proxy.authorizations).toContain(protocol === 'http' ? `Basic ${Buffer.from('user:p@ss').toString('base64')}` : 'user:p@ss')
  })

  it('rejects an untrusted TLS certificate', async () => {
    vi.stubEnv('NODE_EXTRA_CA_CERTS', undefined)
    vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', undefined)
    const gateway = await server((_request, response) => response.end('untrusted'), true)
    await expect(transport().forProxy()(gateway.url)).rejects.toBeInstanceOf(TypeError)
  })

  it('uses SOCKS for plain HTTP, including the body, without leaking proxy credentials', async () => {
    const gateway = await server((request, response) => {
      expect(request.headers['proxy-authorization']).toBeUndefined()
      let body = ''; request.on('data', chunk => { body += chunk })
      request.on('end', () => response.end(body))
    })
    const proxy = await mockProxy('socks5', { target: gateway.url, username: 'user', password: 'pass' })
    cleanups.push(proxy.close)
    const response = await transport().forProxy(proxy.url.replace('://', '://user:pass@'))('http://gateway.invalid:4321/path', { method: 'POST', body: 'payload' })
    expect(await response.text()).toBe('payload')
    expect(proxy.destinations).toEqual(['gateway.invalid:4321'])
  })

  it('follows redirects over SOCKS and strips authorization across origins', async () => {
    const gateway = await server((request, response) => {
      if (request.url === '/start') {
        expect(request.headers.authorization).toBe('Bearer fixture-key')
        response.writeHead(302, { location: 'http://second.invalid:4321/final' }).end()
      } else {
        expect(request.headers.authorization).toBeUndefined()
        response.end('redirected')
      }
    })
    const proxy = await mockProxy('socks5', { target: gateway.url })
    cleanups.push(proxy.close)
    const response = await transport().forProxy(proxy.url)('http://first.invalid:4321/start', { headers: { authorization: 'Bearer fixture-key' } })
    expect(await response.text()).toBe('redirected')
    expect(response.redirected).toBe(true)
    expect(response.url).toBe('http://second.invalid:4321/final')
    expect(proxy.destinations).toEqual(['first.invalid:4321', 'second.invalid:4321'])
  })

  it('never connects directly when a configured proxy is unavailable', async () => {
    vi.stubEnv('NO_PROXY', '*')
    vi.stubEnv('no_proxy', '*')
    const gateway = await server((_request, response) => response.end('direct-connection-must-not-happen'))
    const proxy = await mockProxy('socks5')
    await proxy.close()
    await expect(transport().forProxy(proxy.url)(gateway.url)).rejects.toThrow()
  })
})
