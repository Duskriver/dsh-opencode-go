import { registerGoRemotes } from '../src/remotes.ts'
import { createServer } from 'node:http'
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import { afterEach, expect, it } from 'vitest'
import { GoUsageService } from '../src/usage.ts'
import { parseGoUsage } from '../src/usage-contract.ts'

const window = { status: 'ok', percent: 10, resetsAt: '2026-09-21T00:00:00Z' }
const usage = { rolling: { ...window, percent: 0 }, weekly: window, monthly: { ...window, percent: 7 } }
const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

it('queries authenticated account usage through the actual Host RPC gateway and follows credential changes', async () => {
  const requests: Array<{ url?: string; auth?: string; encoding?: string }> = []
  let status = 200
  const server = createServer((req, res) => {
    requests.push({ url: req.url, auth: req.headers.authorization, encoding: req.headers['accept-encoding'] })
    res.writeHead(status, { 'Content-Type': 'application/json' })
    const body = Buffer.from(JSON.stringify(status === 200 ? { usage } : { error: 'secret response must not enter UI' }))
    // Simulate a host that loses Content-Encoding, with an upstream honoring identity.
    res.end(req.headers['accept-encoding'] === 'identity' ? body : brotliCompressSync(body))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing address')
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  let key = 'first-key'
  await ctx.plugin(GoUsageService, {
    baseURL: () => `http://127.0.0.1:${address.port}/v1`, resolveApiKey: async () => key,
  })
  const read = () => ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} })
  const first = await read()
  expect(first).toEqual({ ...usage, source: expect.any(String) })
  key = 'second-key'
  const second = await read()
  expect(second).toEqual({ ...usage, source: expect.any(String) })
  expect(second.source).not.toBe(first.source)
  expect(requests).toEqual([
    { url: '/v1/usage', auth: 'Bearer first-key', encoding: 'identity' },
    { url: '/v1/usage', auth: 'Bearer second-key', encoding: 'identity' },
  ])
  status = 401
  await expect(read()).rejects.toThrow('HTTP 401')
})

it('keeps unavailable or malformed usage distinct from zero', () => {
  expect(parseGoUsage(usage).rolling.percent).toBe(0)
  for (const value of [null, {}, { ...usage, weekly: {} }, { ...usage, weekly: { ...window, percent: NaN } }]) {
    expect(() => parseGoUsage(value)).toThrow('Invalid OpenCode Go usage response')
  }
})

async function usageReader(body: Buffer, headers: Record<string, string> = {}) {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', ...headers })
    res.end(body)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing address')
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  await ctx.plugin(GoUsageService, {
    baseURL: () => `http://127.0.0.1:${address.port}/v1`, resolveApiKey: async () => 'fixture-key',
  })
  return () => ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} })
}

it.each([
  { encoding: 'br', compress: brotliCompressSync },
  { encoding: 'gzip', compress: gzipSync },
  { encoding: 'deflate', compress: deflateSync },
])('reads $encoding usage decoded by fetch through Host RPC', async ({ encoding, compress }) => {
  const read = await usageReader(compress(Buffer.from(JSON.stringify({ usage }))),
    { 'content-encoding': encoding })
  expect(await read()).toEqual({ ...usage, source: expect.any(String) })
})

it.each([false, true])('bounds usage response bytes, compressed=%s', async (compressed) => {
  const body = Buffer.from(JSON.stringify({ usage, padding: 'x'.repeat(1024 * 1024) }))
  const read = await usageReader(compressed ? gzipSync(body) : body,
    compressed ? { 'content-encoding': 'gzip' } : {})
  await expect(read()).rejects.toThrow(/exceeds.*byte limit/)
})

it('keeps safe network diagnostics and account identity through Host RPC without retaining another account', async () => {
  let mode: 'ok' | 'reset' | 'reset-once' | 'unauthorized' = 'ok'
  let requests = 0
  const server = createServer((req, res) => {
    requests++
    if (mode === 'reset' || mode === 'reset-once') {
      if (mode === 'reset-once') mode = 'ok'
      req.socket.destroy()
      return
    }
    res.writeHead(mode === 'unauthorized' ? 401 : 200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(mode === 'unauthorized' ? { error: 'private account response' } : { usage }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing address')
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  let key: string | undefined = 'private-account-one'
  let credentialError = false
  let baseURL = `http://127.0.0.1:${address.port}/v1`
  await ctx.plugin(GoUsageService, { baseURL: () => baseURL, resolveApiKey: async () => {
    if (credentialError) throw Object.assign(new Error('private account credential detail'), { code: 'MISSING_CREDENTIAL' })
    return key
  } })
  const read = () => ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} })
  const first = await read()
  expect(first.source).toEqual(expect.any(String))
  expect(await read()).toEqual(first)
  mode = 'reset-once'
  expect(await read()).toEqual(first)
  mode = 'reset'
  const failed = await read().catch((error: unknown) => error)
  expect(failed).toMatchObject({ code: 'opencode-go/usage-unavailable',
    message: expect.stringContaining('network error (UND_ERR_SOCKET)'),
    details: { retainPrevious: true, retryable: true, source: first.source } })
  key = 'private-account-two'
  const changed = await read().catch((error: unknown) => error)
  expect(changed).toMatchObject({ details: { source: expect.any(String) } })
  expect((changed as { details: { source: string } }).details.source).not.toBe(first.source)
  mode = 'ok'
  const second = await read()
  baseURL = `http://127.0.0.1:${address.port}/other`
  const other = await read()
  expect(other.source).not.toBe(second.source)
  mode = 'unauthorized'
  const count = requests
  await expect(read()).rejects.toMatchObject({ code: 'opencode-go/usage-unavailable',
    message: 'OpenCode Go usage unavailable (HTTP 401)',
    details: { retainPrevious: false, retryable: false, source: other.source } })
  expect(requests - count).toBe(1)
  key = undefined
  await expect(read()).rejects.toMatchObject({ details: { retainPrevious: false, retryable: false } })
  expect(requests - count).toBe(1)
  credentialError = true
  await expect(read()).rejects.toMatchObject({ code: 'opencode-go/usage-unavailable',
    message: 'OpenCode Go API key is not configured', details: { retainPrevious: false, retryable: false } })
  expect(JSON.stringify([first, second, other, failed, changed])).not.toMatch(/private-account|private account/)
})
