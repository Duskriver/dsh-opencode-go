import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import LlmRuntime, { createUserMessage, LlmError } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { accountsOf, assertAccounts } from '../src/accounts.ts'
import { Config, PlainConfig, type LiveConfig, type OpencodeGoConfig } from '../src/config.ts'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { apply } from '../src/index.ts'
import { configOf } from './config-of.ts'
import { mockGateway, listingBody, textEvents, closeMockGateways } from './mock-gateway.ts'

const accounts = [
  { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
  { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
]
const request = () => ({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', sessionId: 'account-session' as never,
  messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })] })
const drain = async (stream: AsyncIterable<StreamChunk>) => { const chunks: StreamChunk[] = []; for await (const chunk of stream) chunks.push(chunk); return chunks }
afterEach(closeMockGateways)

it('preserves legacy credential configuration and distinguishes explicitly removing every account', () => {
  expect(PlainConfig().accounts).not.toEqual([])
  expect(accountsOf(PlainConfig())).toEqual([{ id: 'legacy:OPENCODE_API_KEY', name: '', apiKeyEnv: 'OPENCODE_API_KEY' }])
  expect(accountsOf({ accounts: [], apiKeyEnv: 'ACCOUNT_A' })).toEqual([])
  expect(accountsOf({ accounts, apiKeyEnv: 'ACCOUNT_A' })).toEqual(accounts)
  expect(() => assertAccounts([...accounts, { ...accounts[0]!, id: 'duplicate' }])).toThrow(/duplicate/)
  expect(() => assertAccounts([{ ...accounts[0]!, apiKeyEnv: 'not a reference' }])).toThrow(/Invalid/)
  expect(() => assertAccounts(Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: String(i), apiKeyEnv: `KEY_${i}` })))).toThrow(/20/)
})

it.each([
  { status: 401, message: 'Invalid API key', reason: 'credential' },
  { status: 429, message: 'Monthly usage limit exceeded', reason: 'quota' },
])('tries the next account before output after $message, preserving model, transcript and session identity', async failure => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ status: failure.status, body: JSON.stringify({ error: { message: failure.message } }) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const switched = vi.fn()
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => `${config.apiKeyEnv}-secret`, onAccountSwitch: switched })
  const chunks = await drain(adapter.stream(request()))
  expect(chunks.filter(chunk => chunk.type === 'finish')).toEqual([expect.objectContaining({ reason: { kind: 'stop' } })])
  expect(chunks.filter(chunk => chunk.type === 'usage')).toHaveLength(1)
  const headers = gateway.headers.filter(header => header.authorization)
  expect(headers.map(header => header.authorization)).toEqual(['Bearer ACCOUNT_A-secret', 'Bearer ACCOUNT_B-secret'])
  expect(headers.map(header => header['x-opencode-session'])).toEqual(['account-session', 'account-session'])
  expect(gateway.bodies[0]).toEqual(gateway.bodies[1])
  expect(config.apiKeyEnv).toBe('ACCOUNT_A')
  expect(switched).toHaveBeenCalledWith({ fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: failure.reason, at: expect.any(Number) }, expect.any(Object), expect.any(Number))
  expect(JSON.stringify(switched.mock.calls)).not.toContain('secret')
})

it.each([
  { status: 429, message: 'Rate limit exceeded' },
  { status: 403, message: 'Forbidden' },
  { status: 503, message: 'Service unavailable' },
  { status: 400, message: 'Invalid request' },
])('keeps $status $message in host recovery instead of trying another account', async failure => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ status: failure.status, body: JSON.stringify({ error: { message: failure.message } }) })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }),
    resolveApiKey: async config => config.apiKeyEnv })
  const chunks = await drain(adapter.stream(request()))
  expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error' } })
  expect(gateway.bodies).toHaveLength(1)
})

it('leaves automatic fallback off by default and bounds all-rejected attempts to the number of accounts', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  const rejection = { status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) }
  gateway.pushCompletions(rejection)
  let config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A' })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => config.apiKeyEnv })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error' } })
  expect(gateway.bodies).toHaveLength(1)
  config = { ...config, autoSwitch: true }
  gateway.pushCompletions(rejection)
  gateway.pushCompletions(rejection)
  const chunks = await drain(adapter.stream(request()))
  expect(gateway.bodies).toHaveLength(3)
  expect(chunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1)
})

it('does not replay a partially emitted response on another account', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ events: textEvents.slice(0, 2) })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }),
    resolveApiKey: async config => config.apiKeyEnv })
  const chunks = await drain(adapter.stream(request()))
  expect(chunks.some(chunk => chunk.type === 'text-delta')).toBe(true)
  expect(chunks.at(-1)).toMatchObject({ reason: { kind: 'error' } })
  expect(gateway.bodies).toHaveLength(1)
})

it('attributes a multi-hop fallback notice to the first account that failed', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ status: 429, body: JSON.stringify({ error: { message: 'Monthly usage limit exceeded' } }) })
  gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
  gateway.pushCompletions({ events: textEvents })
  const three = [...accounts, { id: 'c', name: 'Third', apiKeyEnv: 'ACCOUNT_C' }]
  const config = configOf(gateway.url, { accounts: three, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const switched = vi.fn()
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => config.apiKeyEnv, onAccountSwitch: switched })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(switched).toHaveBeenCalledWith({ fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_C', reason: 'quota', at: expect.any(Number) }, expect.any(Object), expect.any(Number))
})

it('skips a gateway-rejected key on later requests until the credential changes', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  const rejection = { status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) }
  gateway.pushCompletions(rejection)
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => config.apiKeyEnv })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(gateway.bodies).toHaveLength(2)
  gateway.pushCompletions({ events: textEvents })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  // The rejected preferred key is not re-sent; the backup answers directly.
  expect(gateway.bodies).toHaveLength(3)
  expect(gateway.headers.filter(header => header.authorization).at(-1)!.authorization).toBe('Bearer ACCOUNT_B')
  // A stored change to the reference outranks the remembered rejection.
  adapter.forgetRejectedKey('ACCOUNT_A')
  gateway.pushCompletions(rejection)
  gateway.pushCompletions({ events: textEvents })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(gateway.bodies).toHaveLength(5)
})

it('isolates rejected credentials by gateway while retaining each gateway rejection', async () => {
  const first = await mockGateway({ status: 200, body: listingBody([request().model]) })
  const second = await mockGateway({ status: 200, body: listingBody([request().model]) })
  first.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
  first.pushCompletions({ events: textEvents })
  let config = configOf(first.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => config.apiKeyEnv })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })

  config = { ...config, baseURL: second.url }
  second.pushCompletions({ events: textEvents })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(second.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual(['Bearer ACCOUNT_A'])

  // An equivalent URL must still remember this gateway's rejection.
  config = { ...config, baseURL: first.url + '/' }
  first.pushCompletions({ events: textEvents })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(first.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual([
    'Bearer ACCOUNT_A', 'Bearer ACCOUNT_B', 'Bearer ACCOUNT_B',
  ])
})

it('invalidates a changed credential on every gateway where it was rejected', async () => {
  const gateways = await Promise.all([0, 1].map(() => mockGateway({ status: 200, body: listingBody([request().model]) })))
  let config = configOf(gateways[0]!.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => config.apiKeyEnv })
  for (const gateway of gateways) {
    config = { ...config, baseURL: gateway.url }
    gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
    gateway.pushCompletions({ events: textEvents })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  }
  adapter.forgetRejectedKey('ACCOUNT_A')
  for (const gateway of gateways) {
    config = { ...config, baseURL: gateway.url }
    gateway.pushCompletions({ events: textEvents })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    expect(gateway.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual([
      'Bearer ACCOUNT_A', 'Bearer ACCOUNT_B', 'Bearer ACCOUNT_A',
    ])
  }
})

it('can use a backup when the preferred credential is missing and stops fallback on cancellation', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ events: textEvents })
  const signal = new AbortController()
  let cancel = false
  const resolve = vi.fn(async (config: OpencodeGoConfig) => {
    if (cancel) signal.abort()
    if (config.apiKeyEnv === 'ACCOUNT_A') throw new LlmError('missing', 'MISSING_CREDENTIAL')
    return 'backup-secret'
  })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }), resolveApiKey: resolve })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  cancel = true
  resolve.mockClear()
  await expect(drain(adapter.stream({ ...request(), signal: signal.signal }))).rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })
  expect(resolve).toHaveBeenCalledTimes(1)
})

it('keeps the newest request\'s switch outcome when an older request announces late', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  ctx.provide('credentials', {
    describe: async () => ({ configured: true, writable: true }),
    resolve: async ref => ({ value: `${ref}-secret`, source: 'test' }),
  } as never)
  apply(ctx, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    await vi.waitFor(() => { expect(ctx.llm.listProviders().some(provider => provider.id === 'dsh-opencode-go')).toBe(true) })
    // R1: the preferred account is over quota, and the backup's content is slow.
    gateway.pushCompletions({ status: 429, body: JSON.stringify({ error: { message: 'Monthly usage limit exceeded' } }) })
    gateway.pushCompletions({ events: textEvents, delayMs: 120 })
    const first = drain(ctx.llm.stream(request()))
    await vi.waitFor(() => { expect(gateway.bodies).toHaveLength(2) })
    // R2 starts later and succeeds on the preferred account immediately; its
    // outcome must survive R1's fallback notice arriving after it.
    gateway.pushCompletions({ events: textEvents })
    await drain(ctx.llm.stream(request()))
    await first
    const okWindow = { status: 'ok', percent: 10, resetsAt: '2026-09-21T00:00:00Z' }
    gateway.pushCompletions({ status: 200, body: JSON.stringify({ usage: { rolling: okWindow, weekly: okWindow, monthly: okWindow } }) })
    const read = await ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} })
    expect(read.lastSwitch).toBeUndefined()
  } finally { await ctx.fiber.dispose() }
})

it('ignores an old credential check after the user switches the active reference', async () => {
  let config = configOf('https://example.test/v1', { accounts, apiKeyEnv: 'ACCOUNT_A' })
  const oldChecks: Array<(value: { configured: boolean; writable: boolean }) => void> = []
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  ctx.provide('credentials', {
    describe: (ref: string) => ref === 'ACCOUNT_A' ? new Promise(resolve => { oldChecks.push(resolve) }) : Promise.resolve({ configured: true, writable: true }),
    resolve: async () => ({ value: 'test', source: 'test' }),
  })
  const live = Object.fromEntries(Object.keys(Config()).map(key => [key, { get: () => config[key as keyof OpencodeGoConfig] }])) as LiveConfig
  apply(ctx, live)
  try {
    config = { ...config, apiKeyEnv: 'ACCOUNT_B' }
    ctx.emit('loader/volatile-update', [])
    await vi.waitFor(() => { expect(ctx.llm.listProviders().some(provider => provider.id === 'dsh-opencode-go')).toBe(true) })
    for (const settle of oldChecks) settle({ configured: false, writable: true })
    await Promise.resolve()
    expect(ctx.llm.listProviders().some(provider => provider.id === 'dsh-opencode-go')).toBe(true)
  } finally { await ctx.fiber.dispose() }
})

it('settles a pre-output fallback once with its captured identity and notice', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ status: 429, body: JSON.stringify({ error: { message: 'Monthly usage limit exceeded' } }) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const settled = vi.fn()
  const adapter = new OpencodeGoAdapter({
    config: () => config, accountGeneration: () => 7,
    resolveApiKey: async config => config.apiKeyEnv, onAccountSettled: settled,
  })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(settled).toHaveBeenCalledExactlyOnceWith({
    seq: 1, generation: 7, config, ref: 'ACCOUNT_B',
    notice: { fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: 'quota', at: expect.any(Number) },
  })
})

it('settles a preferred-account success once without a fallback notice', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const settled = vi.fn()
  const adapter = new OpencodeGoAdapter({
    config: () => config, accountGeneration: () => 7,
    resolveApiKey: async config => config.apiKeyEnv, onAccountSettled: settled,
  })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(settled).toHaveBeenCalledExactlyOnceWith({
    seq: 1, generation: 7, config, ref: 'ACCOUNT_A', notice: undefined,
  })
})

it('settles no account when every account fails before output', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  const rejection = { status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) }
  gateway.pushCompletions(rejection)
  gateway.pushCompletions(rejection)
  const settled = vi.fn()
  const adapter = new OpencodeGoAdapter({
    config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }),
    resolveApiKey: async config => config.apiKeyEnv, onAccountSettled: settled,
  })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error' } })
  expect(settled).not.toHaveBeenCalled()
})

it('keeps the first-output settlement when the response later fails', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ events: textEvents.slice(0, 2) })
  const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const settled = vi.fn()
  const adapter = new OpencodeGoAdapter({
    config: () => config, accountGeneration: () => 7,
    resolveApiKey: async config => config.apiKeyEnv, onAccountSettled: settled,
  })
  const chunks = await drain(adapter.stream(request()))
  expect(chunks.some(chunk => chunk.type === 'text-delta')).toBe(true)
  expect(chunks.at(-1)).toMatchObject({ reason: { kind: 'error' } })
  expect(settled).toHaveBeenCalledExactlyOnceWith({
    seq: 1, generation: 7, config, ref: 'ACCOUNT_A', notice: undefined,
  })
})

it('settles the backup even when a remembered rejection made it the first candidate', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  const settled = vi.fn()
  const adapter = new OpencodeGoAdapter({
    config: () => config, accountGeneration: () => 7,
    resolveApiKey: async config => config.apiKeyEnv, onAccountSettled: settled,
  })
  // Request 1: the preferred key is rejected and the backup serves it.
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(settled).toHaveBeenCalledExactlyOnceWith({
    seq: 1, generation: 7, config, ref: 'ACCOUNT_B',
    notice: { fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: 'credential', at: expect.any(Number) },
  })
  settled.mockClear()
  // Request 2: the rejection is remembered, so the backup is attempted first —
  // its settlement still names the skipped preferred account in the notice.
  gateway.pushCompletions({ events: textEvents })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(settled).toHaveBeenCalledExactlyOnceWith({
    seq: 2, generation: 7, config, ref: 'ACCOUNT_B',
    notice: { fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: 'credential', at: expect.any(Number) },
  })
})
