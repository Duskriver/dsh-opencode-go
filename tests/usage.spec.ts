import { createServer } from 'node:http'
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
  const requests: Array<{ url?: string; auth?: string }> = []
  let status = 200
  const server = createServer((req, res) => {
    requests.push({ url: req.url, auth: req.headers.authorization })
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(status === 200 ? { usage } : { error: 'secret response must not enter UI' }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing address')
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  let key = 'first-key'
  await ctx.plugin(GoUsageService, {
    baseURL: () => `http://127.0.0.1:${address.port}/v1`, resolveApiKey: async () => key,
  })
  const read = () => ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} })
  expect(await read()).toEqual(usage)
  key = 'second-key'
  expect(await read()).toEqual(usage)
  expect(requests).toEqual([
    { url: '/v1/usage', auth: 'Bearer first-key' }, { url: '/v1/usage', auth: 'Bearer second-key' },
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
