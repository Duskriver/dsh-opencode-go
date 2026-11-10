import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { connect, type Socket } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { DEFAULT_STREAM_IDLE_TIMEOUT_MS } from '../src/config.ts'
import { TUNNEL_IDLE_MARGIN_MS, openSocksTunnel, tunnelIdleTimeoutMs, type SocksTunnelOptions } from '../src/free-socks-tunnel.ts'
import { mockProxy } from './support/proxy.ts'

const cleanups: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

async function targetServer(body = 'relayed-ok'): Promise<string> {
  const server = createServer((_request, response) => response.end(body))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) })
  const bound = server.address()
  if (!bound || typeof bound === 'string') throw new Error('missing fixture port')
  return `http://127.0.0.1:${bound.port}`
}

function relayAuthorization(relayURL: string): string {
  const url = new URL(relayURL)
  return `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64')}`
}

async function openRelay(socksURL: string, options: SocksTunnelOptions = {}) {
  const controller = new AbortController()
  const relay = await openSocksTunnel(socksURL, controller.signal, options)
  cleanups.push(async () => { controller.abort(); await relay.close() })
  return relay
}

async function connectRelay(relayURL: string): Promise<{ socket: Socket; authorization: string }> {
  const url = new URL(relayURL)
  const socket = connect({ host: url.hostname, port: Number(url.port) })
  cleanups.push(async () => { socket.destroy() })
  await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject) })
  return { socket, authorization: relayAuthorization(relayURL) }
}

/** Accumulate raw relay bytes and settle when the peer closes the connection. */
function collect(socket: Socket): { text(): string; closed: Promise<void> } {
  const chunks: string[] = []
  socket.on('data', (chunk: Buffer) => { chunks.push(chunk.toString('latin1')) })
  const closed = new Promise<void>((resolve, reject) => {
    socket.once('close', () => resolve())
    socket.once('error', reject)
  })
  return { text: () => chunks.join(''), closed }
}

async function waitForText(text: () => string, needle: string): Promise<void> {
  await vi.waitFor(() => { expect(text()).toContain(needle) }, { timeout: 5000 })
}

describe('loopback SOCKS relay target allowlist', () => {
  it('relays a CONNECT to the allowed host and passes bytes through', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: 'target.invalid' })
    const { socket, authorization } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write(`CONNECT target.invalid:4321 HTTP/1.1\r\nHost: target.invalid:4321\r\nProxy-Authorization: ${authorization}\r\n\r\n`)
    await waitForText(output.text, '200 Connection Established')
    socket.write('GET /fixture HTTP/1.1\r\nHost: target.invalid:4321\r\nConnection: close\r\n\r\n')
    await output.closed
    expect(output.text()).toContain('relayed-ok')
    expect(proxy.destinations).toEqual(['target.invalid:4321'])
  })

  it('matches the allowed host case-insensitively', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: 'TARGET.INVALID' })
    const { socket, authorization } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write(`CONNECT target.invalid:4321 HTTP/1.1\r\nHost: target.invalid:4321\r\nProxy-Authorization: ${authorization}\r\n\r\n`)
    await waitForText(output.text, '200 Connection Established')
    expect(proxy.destinations).toEqual(['target.invalid:4321'])
  })

  it('normalizes IP spellings when matching the allowed host on an absolute URI', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: '127.000.000.001' })
    const { socket, authorization } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write('GET http://127.0.0.1:4321/absolute HTTP/1.1\r\nHost: 127.0.0.1:4321\r\n'
      + `Proxy-Authorization: ${authorization}\r\nConnection: close\r\n\r\n`)
    await output.closed
    expect(output.text()).toContain('relayed-ok')
    expect(proxy.destinations).toEqual(['127.0.0.1:4321'])
  })

  it('refuses a CONNECT outside the allowlist without contacting the SOCKS proxy', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: 'allowed.invalid' })
    const { socket, authorization } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write(`CONNECT forbidden.invalid:4321 HTTP/1.1\r\nHost: forbidden.invalid:4321\r\nProxy-Authorization: ${authorization}\r\n\r\n`)
    await output.closed
    expect(output.text()).toContain('403 Forbidden')
    expect(proxy.destinations).toEqual([])
  })

  it('refuses an absolute-URI request outside the allowlist without contacting the SOCKS proxy', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: 'allowed.invalid' })
    const { socket, authorization } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write('GET http://forbidden.invalid:4321/path HTTP/1.1\r\nHost: forbidden.invalid:4321\r\n'
      + `Proxy-Authorization: ${authorization}\r\nConnection: close\r\n\r\n`)
    await output.closed
    expect(output.text()).toContain('403')
    expect(proxy.destinations).toEqual([])
  })

  it('refuses relay requests without the per-request credentials', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: 'target.invalid' })
    const { socket } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write('CONNECT target.invalid:4321 HTTP/1.1\r\nHost: target.invalid:4321\r\n\r\n')
    await output.closed
    expect(output.text()).toContain('403 Forbidden')
    expect(proxy.destinations).toEqual([])
  })

  it('destroys an idle established tunnel after the injected timeout', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: 'target.invalid', idleTimeoutMs: 120 })
    const { socket, authorization } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write(`CONNECT target.invalid:4321 HTTP/1.1\r\nHost: target.invalid:4321\r\nProxy-Authorization: ${authorization}\r\n\r\n`)
    await waitForText(output.text, '200 Connection Established')
    // No bytes flow afterwards; the relay must tear the idle pair down itself.
    await output.closed
    expect(proxy.destinations).toEqual(['target.invalid:4321'])
  })
})

describe('relay idle budget derivation', () => {
  it('derives the default relay idle limit from the default stream budget', () => {
    expect(tunnelIdleTimeoutMs()).toBe(DEFAULT_STREAM_IDLE_TIMEOUT_MS + TUNNEL_IDLE_MARGIN_MS)
    // Regression for the old hardcoded two-minute limit: the relay must outlive
    // the request stream budget so a silent request fails as a stream idle
    // timeout instead of a network error.
    expect(tunnelIdleTimeoutMs()).toBeGreaterThan(DEFAULT_STREAM_IDLE_TIMEOUT_MS)
  })

  it.each([1, 45_000, 600_000])('adds the margin to a %i ms stream budget', budget => {
    expect(tunnelIdleTimeoutMs(budget)).toBe(budget + TUNNEL_IDLE_MARGIN_MS)
    expect(tunnelIdleTimeoutMs(budget)).toBeGreaterThan(budget)
  })

  it('clamps the derived limit to the Node timer range instead of overflowing to 1 ms', () => {
    // streamIdleTimeoutMs accepts MAX_TIMER_DELAY_MS; an unclamped margin would
    // exceed it and setTimeout would clamp the relay timer to 1 ms.
    expect(tunnelIdleTimeoutMs(MAX_TIMER_DELAY_MS)).toBe(MAX_TIMER_DELAY_MS)
    expect(tunnelIdleTimeoutMs(MAX_TIMER_DELAY_MS - 1_000)).toBe(MAX_TIMER_DELAY_MS)
    expect(tunnelIdleTimeoutMs(MAX_TIMER_DELAY_MS - TUNNEL_IDLE_MARGIN_MS)).toBe(MAX_TIMER_DELAY_MS)
  })

  it('keeps an established tunnel alive while bytes flow and closes it after traffic stops', async () => {
    const target = await targetServer()
    const proxy = await mockProxy('socks5', { target })
    cleanups.push(proxy.close)
    const relay = await openRelay(proxy.url, { allowedHost: 'target.invalid', idleTimeoutMs: 400 })
    const { socket, authorization } = await connectRelay(relay.url)
    const output = collect(socket)
    socket.write(`CONNECT target.invalid:4321 HTTP/1.1\r\nHost: target.invalid:4321\r\nProxy-Authorization: ${authorization}\r\n\r\n`)
    await waitForText(output.text, '200 Connection Established')
    // Keep both directions busy for well past the idle limit: every write
    // re-arms the relay's idle timer, so the tunnel must survive 400 ms of it.
    for (let sent = 0; sent < 10; sent += 1) {
      socket.write('GET /ping HTTP/1.1\r\nHost: target.invalid:4321\r\n\r\n')
      await delay(100)
    }
    expect(socket.destroyed).toBe(false)
    await waitForText(output.text, 'relayed-ok')
    // Traffic stops; the relay must tear the pair down after the idle limit.
    await output.closed
    expect(socket.destroyed).toBe(true)
    expect(proxy.destinations).toEqual(['target.invalid:4321'])
  })
})
