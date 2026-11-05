import { accountHarness, requestOf, drain, configOf } from './support/host.ts'
import {
  ACCOUNT_REF_PREFIX,
  MAX_ACCOUNTS,
  parseAccountCommand,
  type AccountCommand,
  accountsOf,
  assertAccounts,
} from '../src/contracts.ts'
import { describe, afterEach, expect, it, vi } from 'vitest'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { createUserMessage, LlmError, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { Context } from '@deepseek-ai/cordis'
import { Config, PlainConfig, type LiveConfig, type OpencodeGoConfig } from '../src/config.ts'
import { OpencodeGoAdapter, OpencodeGoRequestExecutor } from '../src/adapter.ts'
import { accountFallback, isGatewayKeyRejection } from '../src/accounts.ts'
import { apply } from '../src/index.ts'
import { mockGateway, listingBody, textEvents, closeMockGateways } from './support/gateway.ts'

describe("seamless account fallback", () => {
  const accounts = [
    { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
    { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
  ]

  const request = () => ({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', sessionId: 'account-session' as never,
    messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })] })

  const drain = async (stream: AsyncIterable<StreamChunk>) => { const chunks: StreamChunk[] = []; for await (const chunk of stream) chunks.push(chunk); return chunks }

  afterEach(closeMockGateways)

  it('keeps model permission failures out of account fallback and key cooldown', () => {
    const failure = { code: 'PERMISSION_DENIED' }
    expect(accountFallback({ failure, emitted: false, totalTokens: 0, aborted: false, hasNext: true })).toBeUndefined()
    expect(isGatewayKeyRejection(failure)).toBe(false)
  })

  it.each([
    { status: 403, error: { type: 'RegionError', message: 'Unavailable in region' } },
    { status: 403, error: { type: 'DataPolicyError', message: 'Privacy policy restriction' } },
    { status: 403, error: { message: 'permission denied' } },
    { status: 402, error: { message: 'Permission required' } },
  ])('preserves model permissions and reuses the valid key on the next request: %j', async ({ status, error }) => {
    const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
    gateway.pushCompletions({ status, body: JSON.stringify({ error }) })
    gateway.pushCompletions({ events: textEvents })
    const onAccountSettled = vi.fn()
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }),
      resolveApiKey: async config => config.apiKeyEnv, onAccountSettled })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error', failure: {
      code: 'PERMISSION_DENIED', message: expect.stringContaining(error.message),
    } } })
    expect(gateway.bodies).toHaveLength(1)
    expect(onAccountSettled).not.toHaveBeenCalled()
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    expect(gateway.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual(['Bearer ACCOUNT_A', 'Bearer ACCOUNT_A'])
  })

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
    { mode: 'direct', sessionId: undefined },
    { mode: 'direct', sessionId: '' },
    { mode: 'prepared', sessionId: undefined },
    { mode: 'prepared', sessionId: '' },
  ])('keeps one fallback session across account attempts for $mode calls with sessionId=$sessionId', async ({ mode, sessionId }) => {
    const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
    gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
    gateway.pushCompletions({ events: textEvents })
    const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => `${config.apiKeyEnv}-secret` })
    const input = Object.freeze({ ...request(), sessionId: sessionId as GenerateOptions['sessionId'] })
    try {
      const stream = mode === 'prepared'
        ? (await adapter.prepareCall(input.provider, input.model)).stream
        : adapter.stream.bind(adapter)
      expect((await drain(stream(input))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
      const attempts = gateway.headers.filter(header => header.authorization)
      expect(attempts.map(header => header.authorization)).toEqual(['Bearer ACCOUNT_A-secret', 'Bearer ACCOUNT_B-secret'])
      const identity = attempts[0]?.['x-opencode-session']
      expect(identity).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(attempts[1]?.['x-opencode-session']).toBe(identity)

      // Reusing the caller envelope or prepared stream is a new logical call.
      gateway.pushCompletions({ events: textEvents })
      expect((await drain(stream(input))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
      expect(gateway.headers.at(-1)?.['x-opencode-session']).not.toBe(identity)
      expect(input.sessionId).toBe(sessionId)
    } finally { await adapter.dispose() }
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
    adapter.forgetRejectedKey('ACCOUNT_A')
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

  it.each(['finish', 'throw'])('does not retry billed work after usage is received and the attempt fails by %s', async failureMode => {
    const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }),
      resolveApiKey: async config => config.apiKeyEnv })
    const attempt = vi.spyOn(OpencodeGoRequestExecutor.prototype, 'stream').mockImplementation(async function* (): AsyncIterable<StreamChunk> {
      yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 0, totalTokens: 3 } }
      if (failureMode === 'throw') throw new LlmError('Monthly usage limit exceeded', 'QUOTA')
      yield { type: 'finish', reason: { kind: 'error', failure: { code: 'QUOTA', message: 'Monthly usage limit exceeded' } } }
    })
    try {
      if (failureMode === 'throw') await expect(drain(adapter.stream(request()))).rejects.toMatchObject({ code: 'QUOTA' })
      else expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error', failure: { code: 'QUOTA' } } })
      expect(attempt).toHaveBeenCalledTimes(1)
    } finally { attempt.mockRestore() }
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

  it.each(['ACCOUNT_A', 'ACCOUNT_B'] as const)(
    'fences late credential rejections only for the reference that changed (%s)', async changedRef => {
      const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
      gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
      gateway.pushCompletions({ events: textEvents })
      gateway.pushCompletions({ events: textEvents })
      const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      const fetcher = globalThis.fetch
      vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
        if (new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('Authorization') === 'Bearer old-key') {
          started.resolve()
          await release.promise
        }
        return fetcher(input, init)
      })
      let keyA = 'old-key', generation = 0
      const config = configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
      const adapter = new OpencodeGoAdapter({ config: () => config, accountGeneration: () => generation,
        resolveApiKey: async config => config.apiKeyEnv === 'ACCOUNT_A' ? keyA : 'backup-key' })
      const old = drain(adapter.stream(request()))
      try {
        await started.promise
        if (changedRef === 'ACCOUNT_A') keyA = 'new-key'
        generation++
        adapter.forgetRejectedKey(changedRef)
      } finally { release.resolve() }
      expect((await old).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
      try {
        expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
        expect(gateway.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual([
          'Bearer old-key', 'Bearer backup-key', changedRef === 'ACCOUNT_A' ? 'Bearer new-key' : 'Bearer backup-key',
        ])
      } finally { await adapter.dispose() }
    },
  )

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
    expect((await drain(adapter.stream({ ...request(), signal: signal.signal }))).at(-1)).toMatchObject({ reason: { kind: 'aborted', failure: { code: 'ABORTED' } } })
    expect(resolve).toHaveBeenCalledTimes(1)
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

  it('does not switch or remember a key rejection for a 401 ModelError', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
    gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { type: 'ModelError', message: 'Model not supported' } }) })
    gateway.pushCompletions({ events: textEvents })
    const switched = vi.fn()
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }),
      resolveApiKey: async config => config.apiKeyEnv, onAccountSwitch: switched })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error', failure: { code: 'UNKNOWN_MODEL' } } })
    expect(gateway.bodies).toHaveLength(1)
    expect(switched).not.toHaveBeenCalled()
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    expect(gateway.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual(['Bearer ACCOUNT_A', 'Bearer ACCOUNT_A'])
  })

  it('does not switch accounts for an untyped 500 quoting a previous quota failure', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
    gateway.pushCompletions({ status: 500, body: JSON.stringify({ error: { message: 'Previous request had insufficient credits' } }) })
    const switched = vi.fn(), trace = vi.fn()
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }),
      resolveApiKey: async config => config.apiKeyEnv, onAccountSwitch: switched })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error', failure: { code: 'SERVER' } } })
    expect(gateway.bodies).toHaveLength(1)
    expect(switched).not.toHaveBeenCalled()

  })
})

describe('serialized account commands and primary selection', () => {
  const addition = (id = 'a'.repeat(32), name = 'Work'): AccountCommand => ({ kind: 'add', id, name, key: 'synthetic-key-' + id[0] })
  const primary = { id: 'primary', name: 'Primary', apiKeyEnv: 'PRIMARY_KEY' }
  const backup = { id: 'backup', name: 'Backup', apiKeyEnv: 'BACKUP_KEY' }

  it('adds, renames, reorders, selects, rotates and removes accounts without storing keys in settings', async () => {
    const host = accountHarness()
    expect(await host.manager.execute(addition())).toBe('applied')
    expect(await host.manager.execute(addition('b'.repeat(32), 'Backup'))).toBe('applied')
    const [a, b] = host.value().accounts!
    expect(await host.manager.execute(addition())).toBe('applied')
    expect(host.credentials.set).toHaveBeenCalledTimes(2)
    expect(await host.manager.execute({ kind: 'rename', ref: b!.apiKeyEnv, name: ' Personal ' })).toBe('applied')
    expect(await host.manager.execute({ kind: 'move', ref: b!.apiKeyEnv, toIndex: 0 })).toBe('applied')
    expect(host.value().accounts?.map(account => account.name)).toEqual(['Personal', 'Work'])
    expect(host.value().apiKeyEnv).toBe(b!.apiKeyEnv)
    expect(await host.manager.execute({ kind: 'select', ref: a!.apiKeyEnv })).toBe('applied')
    expect(await host.manager.execute({ kind: 'replace-key', ref: a!.apiKeyEnv, key: ' rotated-key ' })).toBe('applied')
    expect(await host.manager.execute({ kind: 'auto-switch', value: true })).toBe('applied')
    expect(host.value().autoSwitch).toBe(true)
    expect(host.secrets.get(a!.apiKeyEnv)).toBe('rotated-key')
    expect(await host.manager.execute({ kind: 'remove', ref: a!.apiKeyEnv })).toBe('applied')
    expect(host.value().accounts).toEqual([{ ...b!, name: 'Personal' }])
    expect(host.value().apiKeyEnv).toBe(b!.apiKeyEnv)
    expect(host.secrets.has(a!.apiKeyEnv)).toBe(false)
    expect(JSON.stringify([host.value(), host.settings.mutate.mock.calls, host.warn.mock.calls])).not.toMatch(/synthetic-key|rotated-key/)
    expect(Object.hasOwn(host.value(), 'accountOperations')).toBe(false)
  })

  it.each([false, true])('keeps an implicit environment account only when it has a key (configured=%s)', async configured => {
    const host = accountHarness({ accounts: null })
    if (configured) host.secrets.set('OPENCODE_API_KEY', 'environment-fixture')
    expect(await host.manager.execute(addition())).toBe('applied')
    expect(host.value().accounts).toHaveLength(configured ? 2 : 1)
    expect(host.value().apiKeyEnv).toBe(configured ? 'OPENCODE_API_KEY' : ACCOUNT_REF_PREFIX + 'A'.repeat(32))
  })

  it('enforces twenty accounts before changing credentials and refuses unknown references', async () => {
    const accounts = Array.from({ length: MAX_ACCOUNTS }, (_, i) => ({ id: String(i), name: `Account ${i}`, apiKeyEnv: `ACCOUNT_${i}` }))
    const host = accountHarness({ accounts, apiKeyEnv: accounts[0]!.apiKeyEnv })
    expect(await host.manager.execute(addition())).toBe('rejected')
    expect(await host.manager.execute({ kind: 'select', ref: 'MISSING_KEY' })).toBe('rejected')
    expect(host.credentials.set).not.toHaveBeenCalled()
    expect(host.settings.mutate).not.toHaveBeenCalled()
  })

  it.each([
    { kind: 'add', id: 'not-an-id', name: 'Work', key: 'key' },
    { kind: 'add', id: 'a'.repeat(32), name: '', key: 'key' },
    { kind: 'replace-key', ref: 'A', key: ' ' },
    { kind: 'select', ref: 'bad reference' },
    { kind: 'move', ref: 'A', toIndex: -1 },
    { kind: 'auto-switch', value: 'yes' },
    { kind: 'remove', ref: 'A', key: 'unexpected' },
  ])('rejects malformed commands before any side effect: %j', command => {
    expect(() => parseAccountCommand(command)).toThrow()
  })

  it('serializes actual storage writes while callers add accounts concurrently', async () => {
    const host = accountHarness()
    const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    host.credentials.set.mockImplementationOnce(async (ref, key) => {
      started.resolve(); await release.promise; host.secrets.set(ref, key)
    })
    const a = host.manager.execute(addition())
    await started.promise
    const b = host.manager.execute(addition('b'.repeat(32)))
    expect(host.settings.mutate).not.toHaveBeenCalled()
    expect(host.credentials.set).toHaveBeenCalledTimes(1)
    release.resolve()
    expect(await Promise.all([a, b])).toEqual(['applied', 'applied'])
    expect(host.value().accounts).toHaveLength(2)
    expect(host.value().accounts?.map(account => account.id)).toEqual(['a'.repeat(32), 'b'.repeat(32)])
  })

  it('keeps the queue occupied through reconnects and rejects commands captured by an old connection', async () => {
    const host = accountHarness()
    const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    host.credentials.set.mockImplementationOnce(async (ref, key) => {
      started.resolve(); await release.promise; host.secrets.set(ref, key)
    })
    const first = host.manager.execute(addition())
    await started.promise
    const queued = host.manager.execute(addition('b'.repeat(32)))
    host.disconnect()
    host.manager.connect(host.settings, host.credentials)
    const next = host.manager.execute(addition('c'.repeat(32)))
    expect(host.credentials.set).toHaveBeenCalledTimes(1)
    release.resolve()
    expect(await Promise.all([first, queued, next])).toEqual(['unknown', 'rejected', 'applied'])
    expect(host.value().accounts?.map(account => account.id)).toEqual(['c'.repeat(32)])
    expect(host.secrets.has(ACCOUNT_REF_PREFIX + 'A'.repeat(32))).toBe(false)
  })

  it('preserves an account and selection edited while a new credential is being stored', async () => {
    const host = accountHarness()
    host.credentials.set.mockImplementationOnce(async (ref, key) => {
      host.secrets.set(ref, key)
      host.externalEdit({ accounts: [backup], apiKeyEnv: backup.apiKeyEnv })
    })
    expect(await host.manager.execute(addition())).toBe('applied')
    expect(host.value().accounts?.[0]).toEqual(backup)
    expect(host.value().accounts).toHaveLength(2)
    expect(host.value().apiKeyEnv).toBe(backup.apiKeyEnv)
  })

  it('cleans up a new key after a refused metadata write and permits an explicit retry', async () => {
    const host = accountHarness()
    host.settings.mutate.mockRejectedValueOnce(new Error('SETTINGS_CONFLICT'))
    expect(await host.manager.execute(addition())).toBe('unknown')
    expect(host.value().accounts).toEqual([])
    expect(host.secrets.size).toBe(0)
    expect(host.settings.mutate).toHaveBeenCalledTimes(1)
    expect(await host.manager.execute(addition())).toBe('applied')
    expect(host.value().accounts).toHaveLength(1)
  })

  it('restores an owned credential if removing its metadata is refused', async () => {
    const host = accountHarness()
    await host.manager.execute(addition())
    const ref = host.value().apiKeyEnv
    host.settings.mutate.mockRejectedValueOnce(new Error('write refused'))
    expect(await host.manager.execute({ kind: 'remove', ref })).toBe('unknown')
    expect(host.value().accounts).toHaveLength(1)
    expect(host.secrets.get(ref)).toBe('synthetic-key-a')
  })

  it('does not delete external credentials, and respects read-only keys during replacement and removal', async () => {
    const host = accountHarness({ accounts: [primary, backup], apiKeyEnv: primary.apiKeyEnv })
    host.secrets.set(primary.apiKeyEnv, 'external-key')
    expect(await host.manager.execute({ kind: 'remove', ref: primary.apiKeyEnv })).toBe('applied')
    expect(host.secrets.get(primary.apiKeyEnv)).toBe('external-key')
    expect(host.credentials.unset).not.toHaveBeenCalled()
    await host.manager.execute(addition())
    const owned = host.value().accounts!.find(account => account.id === 'a'.repeat(32))!
    host.writable.set(owned.apiKeyEnv, false)
    expect(await host.manager.execute({ kind: 'replace-key', ref: owned.apiKeyEnv, key: 'new-key' })).toBe('rejected')
    expect(await host.manager.execute({ kind: 'remove', ref: owned.apiKeyEnv })).toBe('rejected')
    expect(host.secrets.get(owned.apiKeyEnv)).toBe('synthetic-key-a')
  })

  it('cannot recreate a removed account with a late key-replacement check', async () => {
    const host = accountHarness({ accounts: [primary], apiKeyEnv: primary.apiKeyEnv })
    const described = Promise.withResolvers<{ ref: string; configured: boolean; writable: boolean }>()
    host.credentials.describe.mockReturnValueOnce(described.promise)
    const replacing = host.manager.execute({ kind: 'replace-key', ref: primary.apiKeyEnv, key: 'new-key' })
    await vi.waitFor(() => { expect(host.credentials.describe).toHaveBeenCalled() })
    host.externalEdit({ accounts: [] })
    described.resolve({ ref: primary.apiKeyEnv, configured: true, writable: true })
    expect(await replacing).toBe('rejected')
    expect(host.credentials.set).not.toHaveBeenCalled()
  })

  it('promotes a serving backup in the same queue and ignores stale or older request outcomes', async () => {
    const host = accountHarness({ accounts: [primary, backup], apiKeyEnv: primary.apiKeyEnv, autoSwitch: true })
    const notice = { fromRef: primary.apiKeyEnv, toRef: backup.apiKeyEnv, reason: 'quota' as const, at: Date.now() }
    host.manager.settle({ seq: 2, generation: host.manager.capture(), config: host.value(), ref: backup.apiKeyEnv, notice })
    await vi.waitFor(() => { expect(host.value().apiKeyEnv).toBe(backup.apiKeyEnv) })
    expect(host.value().accounts?.[0]).toEqual(backup)
    expect(host.manager.lastSwitch()).toEqual(notice)
    const stale = { seq: 3, generation: host.manager.capture(), config: host.value(), ref: primary.apiKeyEnv, notice: { ...notice, toRef: primary.apiKeyEnv } }
    await host.manager.execute({ kind: 'select', ref: primary.apiKeyEnv })
    await host.manager.execute({ kind: 'select', ref: backup.apiKeyEnv })
    host.manager.settle(stale)
    host.manager.settle({ ...stale, seq: 1, generation: host.manager.capture(), config: host.value() })
    await Promise.resolve()
    expect(host.value().apiKeyEnv).toBe(backup.apiKeyEnv)
  })

  it.each([
    { status: 401, message: 'unauthorized' },
    { status: 403, message: 'invalid API key' },
    { status: 429, message: 'rate limit reached' },
    { status: 403, message: 'Monthly usage limit exceeded' },
  ])('promotes the backup after HTTP $status $message before output', async failure => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    gateway.pushCompletions({ status: failure.status, body: JSON.stringify({ error: { message: failure.message } }) })
    gateway.pushCompletions({ events: textEvents })
    const host = accountHarness({ baseURL: gateway.url, accounts: [primary, backup], apiKeyEnv: primary.apiKeyEnv, autoSwitch: true })
    const adapter = new OpencodeGoAdapter({
      config: host.value, resolveApiKey: async config => config.apiKeyEnv,
      accountGeneration: () => host.manager.capture(), onAccountSettled: event => host.manager.settle(event),
    })
    try {
      const chunks = await drain(adapter.stream(requestOf()))
      expect(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join('')).toBe('hello')
      expect(chunks.at(-1)).toMatchObject({ reason: { kind: 'stop' } })
      await vi.waitFor(() => { expect(host.value().apiKeyEnv).toBe(backup.apiKeyEnv) })
      expect(gateway.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual(['Bearer PRIMARY_KEY', 'Bearer BACKUP_KEY'])
    } finally { await adapter.dispose() }
  })

  it.each([401, 403, 429])('expires the five-minute cooldown for HTTP %s without replaying a rejected key during the window', async status => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const now = Date.now(), clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const config = configOf(gateway.url, { accounts: [primary, backup], apiKeyEnv: primary.apiKeyEnv, autoSwitch: true })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => config.apiKeyEnv })
    try {
      gateway.pushCompletions({ status, body: JSON.stringify({ error: { message: status === 403 ? 'invalid API key' : 'rejected' } }) })
      gateway.pushCompletions({ events: textEvents }); await drain(adapter.stream(requestOf()))
      gateway.pushCompletions({ events: textEvents }); await drain(adapter.stream(requestOf()))
      expect(gateway.headers.filter(header => header.authorization).map(header => header.authorization)).toEqual(['Bearer PRIMARY_KEY', 'Bearer BACKUP_KEY', 'Bearer BACKUP_KEY'])
      clock.mockReturnValue(now + 5 * 60_000 + 1)
      gateway.pushCompletions({ events: textEvents }); await drain(adapter.stream(requestOf()))
      expect(gateway.headers.at(-1)?.authorization).toBe('Bearer PRIMARY_KEY')
    } finally { await adapter.dispose() }
  })
})
