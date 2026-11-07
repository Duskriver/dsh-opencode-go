import { describe, expect, it, vi } from 'vitest'
import LlmRuntime, { LlmError, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter, OpencodeGoRequestExecutor } from '../src/adapter.ts'
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
    expect(gateway.headers.at(-1)?.['user-agent']).toBe('opencode/latest/2.2.5/cli')
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
    expect(free.headers.at(-1)?.['user-agent']).toBe('opencode/latest/2.2.5/cli')
    expect(go.headers.at(-1)?.['user-agent']).toContain('deepseek-harness/')
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
  it('releases the worker when SSE finishes before the HTTP connection closes', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    let closed = false
    gateway.pushCompletions({ events: textEvents, hangOpen: true, onClose: () => { closed = true } })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url }), resolveApiKey: async () => undefined })
    try {
      expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      await vi.waitFor(() => expect(closed).toBe(true))
    } finally { await adapter.dispose() }
  })
  it('preserves actual tool declarations, streamed calls and token usage through Bun', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url }), resolveApiKey: async () => undefined })
    const tools = [{ name: 'lookup', description: 'Look up a path', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } }]
    gateway.pushCompletions({ events: [
      JSON.stringify({ choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'call_lookup', type: 'function', function: { name: 'lookup', arguments: '{"path":"/tmp/demo"}' } }] }, finish_reason: null }] }),
      JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } }),
      '[DONE]',
    ] })
    const chunks = await drain(adapter.stream({ ...freeRequest(), tools }))
    expect(gateway.bodies[0]).toMatchObject({ tools: [{ type: 'function', function: { name: 'lookup', parameters: tools[0]!.parameters } }] })
    expect((gateway.bodies[0] as { tools: unknown[] }).tools).toHaveLength(1)
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'block-end', block: expect.objectContaining({ type: 'tool-call', name: 'lookup', arguments: '{"path":"/tmp/demo"}' }) }))
    expect(chunks).toContainEqual({ type: 'usage', usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 } })
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'tool-calls' } })
    await adapter.dispose()
  })
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
  it.each(['GoUsageLimitError'])('retries %s with the next saved key and remembers rejection on this gateway', async type => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status: 429, body: JSON.stringify({ error: { type, message: 'usage limit' } }) })
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
  it('does not rotate accounts for a shared Free quota, even when its message mentions OpenCode', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status: 429, body: JSON.stringify({ type: 'error', error: {
      type: 'FreeUsageLimitError',
      message: 'Free usage limit reached. Free models work in OpenCode (https://opencode.ai); subscribe to OpenCode Go to keep going: https://opencode.ai/go',
    } }) })
    gateway.pushCompletions({ events: textEvents })
    gateway.pushCompletions({ events: textEvents })
    const resolveApiKey = vi.fn(async (config: { apiKeyEnv: string }) => config.apiKeyEnv === 'ACCOUNT_A' ? 'primary-key' : 'backup-key')
    const adapter = new OpencodeGoAdapter({ source: 'free',
      config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: true }), resolveApiKey })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'FREE_QUOTA' } } })
    expect(gateway.bodies).toHaveLength(1)
    await expect(drain(adapter.stream(freeRequest()))).rejects.toMatchObject({ code: 'FREE_COOLDOWN' })
    expect(resolveApiKey.mock.calls.map(([current]) => current.apiKeyEnv)).toEqual(['ACCOUNT_A'])
    expect(gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions').map(headers => headers.authorization))
      .toEqual(['Bearer primary-key'])
  })
  it('uses public when backups have no key and revisits the saved key on the next request', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status: 401, body: '{"error":{"message":"invalid key"}}' })
    gateway.pushCompletions({ events: textEvents })
    gateway.pushCompletions({ events: textEvents })
    const onAccountSettled = vi.fn()
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: true }),
      resolveApiKey: async current => current.apiKeyEnv === 'ACCOUNT_A' ? 'primary-key' : undefined, onAccountSettled })
    const chunks = await drain(adapter.stream(freeRequest()))
    expect(chunks.filter(chunk => chunk.type === 'finish')).toEqual([expect.objectContaining({ type: 'finish', reason: { kind: 'stop' } })])
    expect(onAccountSettled).not.toHaveBeenCalled()
    expect(gateway.bodies[0]).toEqual(gateway.bodies[1])
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions').map(headers => headers.authorization))
      .toEqual(['Bearer primary-key', 'Bearer public', 'Bearer primary-key'])
  })
  it.each(['invalid key', 'unauthorized'])('retries a rejected saved key as public once when automatic account switching is off: %s', async message => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message } }) })
    gateway.pushCompletions({ events: textEvents })
    const resolveApiKey = vi.fn(async () => 'saved-key'), onAccountSettled = vi.fn()
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: false }), resolveApiKey, onAccountSettled })
    const chunks = await drain(adapter.stream(freeRequest()))
    expect(chunks.filter(chunk => chunk.type === 'finish')).toEqual([expect.objectContaining({ type: 'finish', reason: { kind: 'stop' } })])
    expect(resolveApiKey.mock.calls).toHaveLength(1)
    expect(onAccountSettled).not.toHaveBeenCalled()
    const attempts = gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions')
    expect(attempts.map(headers => headers.authorization)).toEqual(['Bearer saved-key', 'Bearer public'])
    expect(attempts[0]?.['x-opencode-session']).toBe(attempts[1]?.['x-opencode-session'])
  })
  it('tries all available saved keys before public and returns a public rejection without retrying it', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    for (let i = 0; i < 3; i++) gateway.pushCompletions({ status: 401, body: '{"error":{"message":"invalid key"}}' })
    const onAccountSettled = vi.fn()
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: true }),
      resolveApiKey: async current => current.apiKeyEnv, onAccountSettled })
    const chunks = await drain(adapter.stream(freeRequest()))
    expect(chunks).toEqual([expect.objectContaining({ type: 'finish', reason: { kind: 'error', failure: expect.objectContaining({ code: 'INVALID_CREDENTIAL' }) } })])
    expect(onAccountSettled).not.toHaveBeenCalled()
    const attempts = gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions')
    expect(attempts.map(headers => headers.authorization)).toEqual(['Bearer ACCOUNT_A', 'Bearer ACCOUNT_B', 'Bearer public'])
    expect(new Set(attempts.map(headers => headers['x-opencode-session'])).size).toBe(1)
  })
  it.each([
    { status: 403, error: { type: 'RegionError', message: 'Unavailable in region' }, code: 'PERMISSION_DENIED' },
    { status: 403, error: { type: 'DataPolicyError', message: 'Privacy policy restriction' }, code: 'PERMISSION_DENIED' },
    { status: 402, error: { message: 'Permission required' }, code: 'PERMISSION_DENIED' },
    { status: 429, error: { type: 'FreeUsageLimitError', message: 'Free limit reached' }, code: 'FREE_QUOTA' },
  ])('preserves $code without public retry', async ({ status, error, code }) => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    gateway.pushCompletions({ status, body: JSON.stringify({ error }) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts,
      autoSwitch: code === 'PERMISSION_DENIED' }), resolveApiKey: async current => current.apiKeyEnv })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
      code, message: expect.stringContaining(error.message),
    } } })
    expect(gateway.bodies).toHaveLength(1)
    if (code === 'FREE_QUOTA') await expect(drain(adapter.stream(freeRequest()))).rejects.toMatchObject({ code: 'FREE_COOLDOWN' })
    else await drain(adapter.stream(freeRequest()))
    expect(gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions').map(headers => headers.authorization))
      .toEqual(code === 'FREE_QUOTA' ? ['Bearer ACCOUNT_A'] : ['Bearer ACCOUNT_A', 'Bearer ACCOUNT_A'])
  })
  it.each(['output', 'usage', 'aborted'] as const)('does not retry a rejected key as public after %s', async mode => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const controller = new AbortController()
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: true }),
      resolveApiKey: async () => 'saved-key' })
    const attempt = vi.spyOn(OpencodeGoRequestExecutor.prototype, 'stream').mockImplementation(async function* (): AsyncIterable<StreamChunk> {
      if (mode === 'output') yield { type: 'text-delta', index: 0, text: 'partial' }
      if (mode === 'usage') yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 0, totalTokens: 3 } }
      if (mode === 'aborted') controller.abort()
      yield { type: 'finish', reason: { kind: 'error', failure: { code: 'AUTH', message: 'Rejected' } } }
    })
    await drain(adapter.stream({ ...freeRequest(), signal: controller.signal }))
    expect(attempt).toHaveBeenCalledOnce()
  })
  it.each(['AUTH', 'INVALID_CREDENTIAL'])('uses public once after a thrown %s credential rejection', async code => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const adapter = new OpencodeGoAdapter({ source: 'free', config: () => configOf(gateway.url, { freeBaseURL: gateway.url, apiKeyEnv: 'ACCOUNT_A', accounts, autoSwitch: false }),
      resolveApiKey: async () => 'saved-key' })
    const attempt = vi.spyOn(OpencodeGoRequestExecutor.prototype, 'stream').mockImplementation(async function* (_options, snapshot): AsyncIterable<StreamChunk> {
      if (snapshot.apiKey !== 'public') throw new LlmError('Rejected', code)
      yield { type: 'finish', reason: { kind: 'stop' } }
    })
    expect((await drain(adapter.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(attempt.mock.calls.map(([, snapshot]) => snapshot.apiKey)).toEqual(['saved-key', 'public'])
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
