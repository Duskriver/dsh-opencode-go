import { describe, afterEach, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import { GoStatusService } from '../src/status.ts'
import { parseGoStatusReport } from '../src/contracts.ts'
import { mountRemotes, invokeRemote } from './support/host.ts'

describe('public status feed RPC', () => {
  const components = [
    { service: 'go', status: 'degraded', reason: 'upstream', since: 1792028534694, models: [{ id: 'deepseek-v4.1-flash', reason: 'upstream' }],
      breakdown: [
        { id: 'glm-5.3-flash', status: 'operational', reason: 'none', speed: { ttft: 2453, tps: 71 } },
        { id: 'deepseek-v4.1-flash', status: 'degraded', reason: 'upstream', speed: { ttft: 2827, tps: 125 } },
      ], speed: { ttft: 2688, tps: 93 } },
    { service: 'console', status: 'operational', reason: 'none', speed: {} },
  ]
  const feed = { updatedAt: 1793951848549, stale: false, status: 'degraded', components }

  const cleanups: Array<() => Promise<unknown>> = []

  afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

  it('reads the public feed through the Host RPC gateway without credentials and parses the Go component', async () => {
    const requests: Array<{ url?: string; auth?: string; accept?: string; encoding?: string }> = []
    const server = createServer((req, res) => {
      requests.push({ url: req.url, auth: req.headers.authorization, accept: req.headers.accept, encoding: req.headers['accept-encoding'] })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(feed))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    await ctx.plugin(GoStatusService, { statusURL: () => `http://127.0.0.1:${address.port}/api/status` })
    const report = await invokeRemote(ctx, { namespace: 'opencodeGoStatus', method: 'read', args: {} }) as ReturnType<typeof parseGoStatusReport>
    expect(report.updatedAt).toBe(feed.updatedAt)
    expect(report.stale).toBe(false)
    expect(report.status).toBe('degraded')
    expect(report.services).toEqual(components.map(component => expect.objectContaining({ service: component.service, status: component.status })))
    expect(requests).toEqual([{ url: '/api/status', auth: undefined, accept: 'application/json', encoding: 'identity' }])
  })

  it('coalesces concurrent reads into one shared fetch', async () => {
    let requests = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const server = createServer((_req, res) => {
      requests++
      void gate.then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(feed))
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    const service = new GoStatusService(ctx, { statusURL: () => `http://127.0.0.1:${address.port}/api/status` })
    const first = service.read()
    const second = service.read()
    release?.()
    const report = await first
    expect(await second).toBe(report)
    expect(requests).toBe(1)
  })

  it('expires the cache window by the clock, not by call count', async () => {
    let requests = 0
    const server = createServer((_req, res) => {
      requests++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(feed))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    const now = vi.spyOn(Date, 'now')
    await ctx.plugin(GoStatusService, {
      statusURL: () => `http://127.0.0.1:${address.port}/api/status`,
      ttlMs: 1_000,
    })
    const read = () => invokeRemote(ctx, { namespace: 'opencodeGoStatus', method: 'read', args: {} })
    now.mockReturnValue(1_000_000)
    await read()
    now.mockReturnValue(1_000_000 + 999)
    await read()
    now.mockReturnValue(1_000_000 + 1_001)
    await read()
    // Two fetches: the in-window read reused the cache, the third fell outside it.
    expect(requests).toBe(2)
    now.mockRestore()
  })

  it('keeps HTTP and transport failures retryable while a malformed feed is not', async () => {
    let status = 500
    let body = JSON.stringify(feed)
    const server = createServer((_req, res) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(body)
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    await ctx.plugin(GoStatusService, {
      statusURL: () => `http://127.0.0.1:${address.port}/api/status`,
      ttlMs: 0,
    })
    const read = () => invokeRemote(ctx, { namespace: 'opencodeGoStatus', method: 'read', args: {} })
    await expect(read()).rejects.toThrow('HTTP 500')
    status = 200
    body = '{"updatedAt": "not-a-number"}'
    await expect(read()).rejects.toThrow('Invalid OpenCode status response')
    body = JSON.stringify(feed)
    await expect(read()).resolves.toMatchObject({ status: 'degraded' })
  })

  it('rejects a malformed feed at the parse layer before it can reach the UI', () => {
    const report = parseGoStatusReport(feed)
    expect(report.services[0].breakdown?.[1]).toMatchObject({ id: 'deepseek-v4.1-flash', status: 'degraded' })
    expect(parseGoStatusReport({ ...feed, stale: true }).stale).toBe(true)
    expect(parseGoStatusReport({ ...feed, components: [] }).services).toEqual([])
    // Unknown health spellings parse through: the feed owns the vocabulary.
    expect(parseGoStatusReport({ ...feed, components: [{ ...components[0], status: 'fine' }] }).services[0].status).toBe('fine')
    // The feed marks services without speed readings with an empty speed object.
    const noSpeed = parseGoStatusReport({ ...feed, components: [{ service: 'logs', status: 'operational', reason: 'none', speed: {} }] })
    expect(noSpeed.services[0].speed).toBeUndefined()
    for (const value of [null, {}, [], { ...feed, updatedAt: 'x' }, { ...feed, stale: 'yes' },
      { ...feed, components: {} }, { ...feed, components: [{}] },
      { ...feed, components: [{ ...components[0], breakdown: [{ id: 'm', status: 'degraded', speed: { ttft: -1, tps: 1 } }] }] },
      { ...feed, components: [{ service: 'logs', status: 'operational', reason: 'none', speed: { ttft: 10 } }] }]) {
      expect(() => parseGoStatusReport(value)).toThrow()
    }
  })
})
