import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { discoverCatalogModels } from '../src/catalog.ts'
import { PlainConfig } from '../src/config.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { MODELS_METADATA_URL } from './support/model-metadata.ts'

afterEach(closeMockGateways)

it('keeps original catalog references when runtime capacities are overridden', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  const config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 123456, maxTokens: 5432 } } })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  expect((await adapter.resolveModel('opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow).toBe(123456)
  expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({
    id: 'deepseek-v4.1-flash', contextWindow: 262144, maxTokens: 131072,
  }))
})

it.each([undefined, 8192, 512])('caps explicit and default request output (%s)', async (requested) => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { maxTokens: 1024 } } })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  for await (const chunk of adapter.stream({ provider: 'opencode-go', model: 'deepseek-v4.1-flash', messages: [],
    ...(requested === undefined ? {} : { maxTokens: requested }),
  })) void chunk
  const body = gateway.bodies[0] as Record<string, number>
  expect(body.max_tokens ?? body.max_completion_tokens).toBe(Math.min(requested ?? 1024, 1024))
})

it('retains last known online metadata when limits change during an outage', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
  let config = configOf(gateway.url)
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  expect((await adapter.resolveModel('opencode-go', 'union-alpha')).context?.contextWindow).toBe(262144)
  const priorFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
    String(input) === MODELS_METADATA_URL ? Promise.resolve(new Response('', { status: 503 })) : priorFetch(input, init))
  config = { ...config, modelLimits: { 'union-alpha': { contextWindow: 123456 } } }
  await expect(adapter.resolveModel('opencode-go', 'union-alpha')).resolves.toMatchObject({ context: { contextWindow: 123456 } })
  // An explicit refresh must preserve the learned model too, not just the TTL hit.
  await adapter.listModels('opencode-go')
  config = { ...config, modelLimits: {} }
  expect((await adapter.resolveModel('opencode-go', 'union-alpha')).context?.contextWindow).toBe(262144)
})

it('keeps capacities captured before an in-flight fetch across a settings change', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  let config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 123456 } } })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  const priorFetch = globalThis.fetch
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === MODELS_METADATA_URL) await gate
    return priorFetch(input, init)
  })
  const pending = adapter.resolveModel('opencode-go', 'deepseek-v4.1-flash')
  config = { ...config, modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 42 } } }
  release()
  expect((await pending).context?.contextWindow).toBe(123456)
  expect((await adapter.resolveModel('opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow).toBe(42)
})

it('can explicitly return inherited profile capacities to the catalog', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-inherited-limits-'))
  const ctx = new Context()
  try {
    const path = join(dir, 'settings.yaml')
    await writeFile(path, '')
    await ctx.plugin(FileSettingsProvider, { path, watch: false })
    let current = () => PlainConfig({})
    ctx.settings.installSection(ctx, 'llm-opencode-go', PlainConfig, PlainConfig({
      modelLimits: { example: { contextWindow: 123456, maxTokens: 1024 } },
    }), { setSource: source => { current = source }, onChange: () => {} })
    await ctx.settings.mutate('llm-opencode-go', [{ op: 'set', path: ['modelLimits'], value: { example: { contextWindow: null } } }])
    expect(current().modelLimits).toEqual({ example: { contextWindow: null, maxTokens: 1024 } })
    await ctx.settings.mutate('llm-opencode-go', [{ op: 'set', path: ['modelLimits'], value: { example: null } }])
    expect(current().modelLimits).toEqual({ example: null })
  } finally {
    await ctx.fiber.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})
