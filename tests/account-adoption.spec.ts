// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../src/index.ts'
import { configOf } from './config-of.ts'
import { mockGateway, listingBody, textEvents, closeMockGateways } from './mock-gateway.ts'

/**
 * A fallback that lands on a usable account has to become the current one: the
 * Settings page and the usage pill follow the stored preference, so the write is
 * what makes the next request start from the account that just worked. These
 * tests drive the real route and watch the settings face the plugin writes
 * through.
 */
const accounts = [
  { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
  { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
]
const request = () => ({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', sessionId: 'adopt-session' as never,
  messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })] })
const drain = async (stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> => {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}
afterEach(closeMockGateways)

/** The Host settings face an adoption writes through: editable rows, one path edit. */
function stubSettings(rows: { ns: string; revision: number; value: unknown } | { ns: string; revision: number; value: unknown }[],
  mutate = vi.fn(async () => {})) {
  return { describe: () => Array.isArray(rows) ? rows : [rows], mutate, configure: () => () => {} }
}

async function mount(settings: ReturnType<typeof stubSettings> | undefined, config: ReturnType<typeof configOf>) {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  ctx.provide('credentials', {
    describe: async () => ({ configured: true, writable: true }),
    resolve: async (ref: string) => ({ value: `${ref}-secret`, source: 'test' }),
  } as never)
  if (settings !== undefined) ctx.provide('settings', settings as never)
  apply(ctx, config)
  await vi.waitFor(() => { expect(ctx.llm.listProviders().some(provider => provider.id === 'dsh-opencode-go')).toBe(true) })
  return ctx
}

/** One request whose preferred account is over quota and whose backup answers. */
async function quotaThenText() {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ status: 429, body: JSON.stringify({ error: { message: 'Monthly usage limit exceeded' } }) })
  gateway.pushCompletions({ events: textEvents })
  return gateway
}

it('makes the account a fallback settled on the profile current one', async () => {
  const gateway = await quotaThenText()
  const settings = stubSettings({ ns: 'opencode-go', revision: 7, value: { apiKeyEnv: 'ACCOUNT_A' } })
  const ctx = await mount(settings, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await vi.waitFor(() => { expect(settings.mutate).toHaveBeenCalledTimes(1) })
    expect(settings.mutate).toHaveBeenCalledWith(
      'opencode-go', [{ op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_B' }], 7,
    )
  } finally { await ctx.fiber.dispose() }
})

it('writes through the settings namespace a legacy Host serves', async () => {
  const gateway = await quotaThenText()
  const settings = stubSettings({ ns: 'llm-opencode-go', revision: 4, value: { apiKeyEnv: 'ACCOUNT_A' } })
  const ctx = await mount(settings, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await vi.waitFor(() => { expect(settings.mutate).toHaveBeenCalledTimes(1) })
    expect(settings.mutate).toHaveBeenCalledWith(
      'llm-opencode-go', [{ op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_B' }], 4,
    )
  } finally { await ctx.fiber.dispose() }
})

it('leaves a manual switch alone when it landed first', async () => {
  const gateway = await quotaThenText()
  // The stored preference already moved on: the fallback must not overwrite it.
  const settings = stubSettings({ ns: 'opencode-go', revision: 9, value: { apiKeyEnv: 'ACCOUNT_C' } })
  const ctx = await mount(settings, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(settings.mutate).not.toHaveBeenCalled()
  } finally { await ctx.fiber.dispose() }
})

it('reports a refused adoption without disturbing the request', async () => {
  const gateway = await quotaThenText()
  const mutate = vi.fn(async () => { throw new Error('settings provider is read-only') })
  const settings = stubSettings({ ns: 'opencode-go', revision: 2, value: { apiKeyEnv: 'ACCOUNT_A' } }, mutate)
  const ctx = await mount(settings, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await vi.waitFor(() => { expect(mutate).toHaveBeenCalledTimes(1) })
  } finally { await ctx.fiber.dispose() }
})

it('keeps serving requests on a Host without a settings service', async () => {
  const gateway = await quotaThenText()
  const ctx = await mount(undefined, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  } finally { await ctx.fiber.dispose() }
})

it('never adopts when automatic fallback is off', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  gateway.pushCompletions({ status: 429, body: JSON.stringify({ error: { message: 'Monthly usage limit exceeded' } }) })
  const settings = stubSettings({ ns: 'opencode-go', revision: 3, value: { apiKeyEnv: 'ACCOUNT_A' } })
  const ctx = await mount(settings, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A' }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error' } })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(settings.mutate).not.toHaveBeenCalled()
  } finally { await ctx.fiber.dispose() }
})

it('writes the adopted account into the settings document a legacy Host serves', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-adopt-'))
  const ctx = new Context()
  try {
    const path = join(dir, 'settings.yaml')
    await writeFile(path, '')
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(Registry)
    await ctx.plugin(Gateway)
    await ctx.plugin(FileSettingsProvider, { path, watch: false })
    ctx.provide('credentials', {
      describe: async () => ({ configured: true, writable: true }),
      resolve: async (ref: string) => ({ value: `${ref}-secret`, source: 'test' }),
    } as never)
    const gateway = await quotaThenText()
    apply(ctx, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
    await vi.waitFor(() => { expect(ctx.llm.listProviders().some(provider => provider.id === 'dsh-opencode-go')).toBe(true) })
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await vi.waitFor(() => {
      expect((ctx.settings.get('llm-opencode-go') as { apiKeyEnv?: string } | undefined)?.apiKeyEnv).toBe('ACCOUNT_B')
    })
    expect(await readFile(path, 'utf8')).toContain('apiKeyEnv: ACCOUNT_B')
  } finally {
    await ctx.fiber.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})

it('follows the second hop when the stored preference still names the account the request began with', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
  const rejection = { status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) }
  const quota = { status: 429, body: JSON.stringify({ error: { message: 'Monthly usage limit exceeded' } }) }
  // Request 1: the preferred key is rejected (and remembered), the backup serves.
  gateway.pushCompletions(rejection)
  gateway.pushCompletions({ events: textEvents })
  // Request 2: the preferred is skipped for that rejection, the backup is over
  // quota, and the third account serves.
  gateway.pushCompletions(quota)
  gateway.pushCompletions({ events: textEvents })
  const three = [...accounts, { id: 'c', name: 'Third', apiKeyEnv: 'ACCOUNT_C' }]
  // The stored value never moves off the account both requests begin with — the
  // first adoption was refused — so the second hop is still this request's to
  // make. A guard that named the account the journey *left* instead would see
  // ACCOUNT_B and silently decline to write anything.
  const settings = stubSettings({ ns: 'opencode-go', revision: 11, value: { apiKeyEnv: 'ACCOUNT_A' } })
  const ctx = await mount(settings, configOf(gateway.url, { accounts: three, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await vi.waitFor(() => { expect(settings.mutate).toHaveBeenCalledTimes(2) })
    expect(settings.mutate).toHaveBeenNthCalledWith(
      2, 'opencode-go', [{ op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_C' }], 11,
    )
    // The second request never reached the remembered key: it went B then C.
    expect(gateway.headers.filter(header => header.authorization).map(header => header.authorization))
      .toEqual(['Bearer ACCOUNT_A-secret', 'Bearer ACCOUNT_B-secret', 'Bearer ACCOUNT_B-secret', 'Bearer ACCOUNT_C-secret'])
  } finally { await ctx.fiber.dispose() }
})

it('prefers the profile entry over a legacy row that coexists with it', async () => {
  const gateway = await quotaThenText()
  const settings = stubSettings([
    { ns: 'llm-opencode-go', revision: 5, value: { apiKeyEnv: 'ACCOUNT_A' } },
    { ns: 'opencode-go', revision: 6, value: { apiKeyEnv: 'ACCOUNT_A' } },
  ])
  const ctx = await mount(settings, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
  try {
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await vi.waitFor(() => { expect(settings.mutate).toHaveBeenCalledTimes(1) })
    // Only the profile entry is what the Web page and the pill read.
    expect(settings.mutate).toHaveBeenCalledWith(
      'opencode-go', [{ op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_B' }], 6,
    )
  } finally { await ctx.fiber.dispose() }
})

it('lets a manual switch back to a rejected account serve, and keeps the fallback notice', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-adopt-'))
  const ctx = new Context()
  try {
    const path = join(dir, 'settings.yaml')
    await writeFile(path, '')
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(Registry)
    await ctx.plugin(Gateway)
    await ctx.plugin(FileSettingsProvider, { path, watch: false })
    ctx.provide('credentials', {
      describe: async () => ({ configured: true, writable: true }),
      resolve: async (ref: string) => ({ value: `${ref}-secret`, source: 'test' }),
    } as never)
    const gateway = await mockGateway({ status: 200, body: listingBody([request().model]) })
    gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
    gateway.pushCompletions({ events: textEvents })
    apply(ctx, configOf(gateway.url, { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true }))
    await vi.waitFor(() => { expect(ctx.llm.listProviders().some(provider => provider.id === 'dsh-opencode-go')).toBe(true) })
    // Request 1: the preferred key is rejected, the backup serves it and is adopted.
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    await vi.waitFor(() => {
      expect((ctx.settings.get('llm-opencode-go') as { apiKeyEnv?: string } | undefined)?.apiKeyEnv).toBe('ACCOUNT_B')
    })
    // The adoption's own write must not retire the notice that reports it.
    const window = { status: 'ok', percent: 10, resetsAt: '2026-09-21T00:00:00Z' }
    gateway.pushCompletions({ status: 200, body: JSON.stringify({ usage: { rolling: window, weekly: window, monthly: window } }) })
    const read = await ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} })
    expect(read.lastSwitch).toMatchObject({ fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B' })
    // The reader switches back: a stored selection outranks the remembered
    // rejection, so the next request must start from the chosen account again.
    await ctx.settings.mutate('llm-opencode-go', [{ op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_A' }])
    const before = gateway.bodies.length
    gateway.pushCompletions({ events: textEvents })
    expect((await drain(ctx.llm.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    expect(gateway.bodies).toHaveLength(before + 1)
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer ACCOUNT_A-secret')
  } finally {
    await ctx.fiber.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})
