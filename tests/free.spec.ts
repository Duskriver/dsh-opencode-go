import { describe, expect, it, vi } from 'vitest'
import LlmRuntime, { LlmError } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { apply } from '../src/index.ts'
import { context, configOf, requestOf, drain } from './support/host.ts'
import { mockGateway, listingBody, textEvents } from './support/gateway.ts'
import { modelsDocument, modelEntry } from './support/data.ts'

const accounts = [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' }, { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' }]
const freeRequest = () => requestOf({ provider: 'dsh-opencode-free', model: 'beam-free' })

describe('dual route registration', () => {
  it.each([undefined, ' ', 'bad\nkey'])('keeps Free active with no usable Go key (%j) and sends public Bearer authorization', async key => {
    if (key === undefined) vi.stubEnv('OPENCODE_API_KEY', undefined)
    else vi.stubEnv('OPENCODE_API_KEY', key)
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const ctx = context(); await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url, { freeBaseURL: gateway.url }))
    expect(ctx.llm.listProviders()).toEqual([{ id: 'dsh-opencode-free', name: 'DSH OpenCode Free' }])
    gateway.pushCompletions({ events: textEvents })
    expect((await drain(ctx.llm.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer public')
    expect(gateway.headers[0]?.authorization).toBeUndefined()
  })
  it('withdraws both routes while disabled even when credentials exist', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'key')
    const ctx = context(); await ctx.plugin(LlmRuntime)
    apply(ctx, configOf('https://gateway.example/v1', { enabled: false }))
    expect(ctx.llm.listProviders()).toEqual([])
  })
  it('keeps overlapping ids under both route identities and shares configured credentials', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'configured-key')
    const go = await mockGateway({ status: 200, body: listingBody(['beam-free', 'go-only']) })
    const free = await mockGateway({ status: 200, body: modelsDocument({ 'beam-free': modelEntry(), paid: modelEntry({ cost: { text: { input: { price: 1 }, output: { price: 0 } } } }) }) })
    const ctx = context(); await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(go.url, { freeBaseURL: free.url }))
    expect(ctx.llm.listProviders()).toEqual(expect.arrayContaining([
      { id: 'dsh-opencode-go', name: 'DSH OpenCode Go' }, { id: 'dsh-opencode-free', name: 'DSH OpenCode Free' },
    ]))
    expect((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['beam-free', 'go-only'])
    expect(await ctx.llm.listModels('dsh-opencode-free')).toEqual([expect.objectContaining({ provider: 'dsh-opencode-free', id: 'beam-free' })])
    free.pushCompletions({ events: textEvents }); go.pushCompletions({ events: textEvents })
    await drain(ctx.llm.stream(freeRequest()))
    await drain(ctx.llm.stream({ ...freeRequest(), provider: 'dsh-opencode-go' }))
    expect(free.headers.at(-1)?.authorization).toBe('Bearer configured-key')
    expect(go.headers.at(-1)?.authorization).toBe('Bearer configured-key')
    expect((await ctx.llm.discoverModels('llm-opencode-go', { provider: 'dsh-opencode-free' })).map(model => model.id)).toEqual(['beam-free'])
  })
  it('activates Go when any configured account is usable even if automatic retry is off', async () => {
    vi.stubEnv('ACCOUNT_A', undefined); vi.stubEnv('ACCOUNT_B', 'backup-key')
    const ctx = context(); await ctx.plugin(LlmRuntime)
    apply(ctx, configOf('https://gateway.example/v1', { apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: false }))
    expect(ctx.llm.listProviders().map(provider => provider.id).sort()).toEqual(['dsh-opencode-free', 'dsh-opencode-go'])
  })
})

describe('Free credential selection and multi-account retry', () => {
  it.each([false, true].flatMap(autoSwitch => ['unreadable', 'pending'].map(backup => ({ autoSwitch, backup }))))(
    'uses the primary without reading an unused $backup backup, autoSwitch=$autoSwitch', async ({ autoSwitch, backup }) => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
      gateway.pushCompletions({ events: textEvents })
      const config = configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch, requestPreparationTimeoutMs: 50 })
      const resolveApiKey = vi.fn(async (current: typeof config): Promise<string | undefined> => {
        if (current.apiKeyEnv === 'ACCOUNT_A') return 'primary-key'
        if (backup === 'unreadable') throw new Error('backup storage unavailable')
        return new Promise(() => {})
      })
      const adapter = new OpencodeGoAdapter({ source: 'free', config: () => config, resolveApiKey })
      await adapter.catalogOf(config).snapshot(true)
      expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      expect(resolveApiKey.mock.calls.map(([current]) => current.apiKeyEnv)).toEqual(['ACCOUNT_A'])
      expect(gateway.headers.at(-1)?.authorization).toBe('Bearer primary-key')
    },
  )
  it.each([false, true])('uses an available saved account before public when preferred key is absent, autoSwitch=%s', async autoSwitch => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ events: textEvents })
    const settled = vi.fn()
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch }),
      resolveApiKey: async config => config.apiKeyEnv === 'ACCOUNT_B' ? 'backup-key' : undefined, onAccountSettled: settled })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer backup-key')
    expect(settled).toHaveBeenCalledOnce()
    expect(settled.mock.calls[0][0]).toMatchObject({ ref: 'ACCOUNT_B', notice: { fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B' } })
  })
  it('uses public for an explicit empty account roster without settling or changing account selection', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ events: textEvents })
    const resolveApiKey = vi.fn(async () => 'unused-key'), onAccountSettled = vi.fn()
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, accounts: [] }), resolveApiKey, onAccountSettled })
    await drain(adapter.stream(freeRequest()))
    expect(resolveApiKey).not.toHaveBeenCalled()
    expect(onAccountSettled).not.toHaveBeenCalled()
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer public')
  })
  it('retries quota failures with the next saved key and remembers rejection on this gateway', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status: 401, body: '{"error":{"type":"GoUsageLimitError","message":"usage limit"}}' })
    gateway.pushCompletions({ events: textEvents }); gateway.pushCompletions({ events: textEvents })
    const resolveApiKey = vi.fn(async (current: { apiKeyEnv: string }) => {
      if (current.apiKeyEnv === 'ACCOUNT_A') return 'key-a'
      expect(gateway.bodies.length).toBeGreaterThan(0)
      return 'key-b'
    })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: true }),
      resolveApiKey })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    await drain(adapter.stream(freeRequest()))
    expect(gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions').map(headers => headers.authorization)).toEqual(['Bearer key-a', 'Bearer key-b', 'Bearer key-b'])
    expect(resolveApiKey.mock.calls.map(([current]) => current.apiKeyEnv)).toEqual(['ACCOUNT_A', 'ACCOUNT_B', 'ACCOUNT_B'])
  })
  it('preserves a gateway failure when backups have no key and retries the cooled key on the next request', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status: 401, body: '{"error":{"message":"invalid key"}}' })
    gateway.pushCompletions({ events: textEvents })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: true }),
      resolveApiKey: async current => current.apiKeyEnv === 'ACCOUNT_A' ? 'primary-key' : undefined })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'INVALID_CREDENTIAL' } } })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions').map(headers => headers.authorization))
      .toEqual(['Bearer primary-key', 'Bearer primary-key'])
  })
  it('does not retry a configured key as public or switch accounts when automatic retry is off', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status: 401, body: '{"error":{"message":"invalid key"}}' })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: false }), resolveApiKey: async () => 'saved-key' })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error' } })
    expect(gateway.bodies).toHaveLength(1)
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer saved-key')
  })
  it('does not mistake a credential-service failure for an unconfigured public account', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url }), resolveApiKey: async () => { throw new Error('storage unavailable') } })
    await expect(drain(adapter.stream(freeRequest()))).rejects.toThrow('storage unavailable')
    expect(gateway.bodies).toEqual([])
  })
  it('bounds credential preparation and preserves caller cancellation', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const config = configOf(gateway.url, { freeBaseURL: gateway.url, requestPreparationTimeoutMs: 20 })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => config, resolveApiKey: async () => new Promise(() => {}) })
    await adapter.catalogOf(config).snapshot(true)
    await expect(drain(adapter.stream(freeRequest()))).rejects.toMatchObject({ code: 'TIMEOUT' })
    const controller = new AbortController(); controller.abort()
    expect((await drain(adapter.stream({ ...freeRequest(), signal: controller.signal }))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'aborted' } })
    expect(gateway.bodies).toEqual([])
  })
  it('falls back to public after missing/invalid credential validation, without accepting malformed keys', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) }); gateway.pushCompletions({ events: textEvents })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts }),
      resolveApiKey: async config => { throw new LlmError('no usable key', config.apiKeyEnv === 'ACCOUNT_A' ? 'INVALID_CREDENTIAL' : 'MISSING_CREDENTIAL') } })
    await drain(adapter.stream(freeRequest()))
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer public')
  })
})
