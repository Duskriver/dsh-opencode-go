import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import LlmRuntime, { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { discoverCatalogModels, discoverSettingsModels } from '../src/catalog.ts'
import { PlainConfig } from '../src/config.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

afterEach(closeMockGateways)

it.each([
  { configured: undefined, requested: undefined, expected: 65_536 },
  { configured: 131_072, requested: undefined, expected: 131_072 },
  { configured: undefined, requested: 98_304, expected: 98_304 },
  { configured: 32_768, requested: 98_304, expected: 32_768 },
])('aligns the host reservation with the wire allowance ($configured, $requested)', async ({ configured, requested, expected }) => {
  const model = 'deepseek-v4.1-flash'
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { modelLimits: configured === undefined ? {} : { [model]: { maxTokens: configured } } })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
  try {
    const info = await adapter.resolveModel('dsh-opencode-go', model)
    expect(info.defaultMaxTokens).toBe(configured ?? 65_536)
    const prepared = await ctx.llm.prepareCall({ provider: 'dsh-opencode-go', model,
      ...requested === undefined ? {} : { maxTokens: requested } })
    expect(prepared.config.maxTokens).toBe(requested ?? info.defaultMaxTokens)
    for await (const chunk of prepared.stream({ provider: 'dsh-opencode-go', model, messages: [], ...prepared.config })) void chunk
    expect(gateway.bodies[0]).toMatchObject({ max_tokens: expected })
  } finally { await ctx.fiber.dispose() }
})

it('bounds the DeepSeek V4.1 Flash default by a smaller declared output capacity without changing the catalog', async () => {
  const model = 'deepseek-v4.1-flash'
  const original = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
    ? Promise.resolve(Response.json(metadataDocument({ [model]: modelMetadata({ limit: { context: 262144, output: 8192 } }) })))
    : original(input, init))
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url)
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  expect((await adapter.resolveModel('dsh-opencode-go', model)).defaultMaxTokens).toBe(8192)
  for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model, messages: [] })) void chunk
  expect(gateway.bodies[0]).toMatchObject({ max_tokens: 8192 })
  expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({ id: model, maxTokens: 8192 }))
})

it.each(['deepseek-v4-flash', 'deepseek-v4.1-flash-vision-exp', 'kimi-k3', 'future-model'])(
  'preserves the SDK default and explicit caller allowance for other models: %s', async model => {
  const original = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
    ? Promise.resolve(Response.json(metadataDocument({ [model]: modelMetadata() })))
    : original(input, init))
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ events: textEvents })
  gateway.pushCompletions({ events: textEvents })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
  try {
    expect(await adapter.resolveModel('dsh-opencode-go', model)).not.toHaveProperty('defaultMaxTokens')
    const prepared = await ctx.llm.prepareCall({ provider: 'dsh-opencode-go', model })
    expect(prepared.config.maxTokens).toBeUndefined()
    for await (const chunk of prepared.stream({ provider: 'dsh-opencode-go', model, messages: [], ...prepared.config })) void chunk
    expect(gateway.bodies[0]).toMatchObject({ max_tokens: 131_072 })
    for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model, messages: [], maxTokens: 196_608 })) void chunk
    expect(gateway.bodies[1]).toMatchObject({ max_tokens: 196_608 })
  } finally { await ctx.fiber.dispose() }
})

it('preserves an explicit output override for other models', async () => {
  const model = 'deepseek-v4-flash'
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ events: textEvents })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, {
    modelLimits: { [model]: { maxTokens: 98_304 } },
  }), resolveApiKey: async () => 'test-key' })
  for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model, messages: [] })) void chunk
  expect(gateway.bodies[0]).toMatchObject({ max_tokens: 98_304 })
})

it.each([undefined, 'high'])('preserves the Anthropic SDK output default with reasoning=%s', async effort => {
  const model = 'minimax-m3'
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ status: 400, body: '{"message":"fixture rejection"}' })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
  const prepared = await adapter.prepareCall('dsh-opencode-go', model)
  expect(prepared.model).not.toHaveProperty('defaultMaxTokens')
  for await (const chunk of prepared.stream({ provider: 'dsh-opencode-go', model, messages: [],
    ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
  })) void chunk
  expect(gateway.paths.at(-1)).toMatch(/\/messages(?:\?|$)/)
  expect(gateway.bodies[0]).toMatchObject({ max_tokens: 131_072 })
})

it('keeps original catalog references when runtime capacities are overridden', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  const config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 123456, maxTokens: 5432 } } })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  expect((await adapter.resolveModel('dsh-opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow).toBe(123456)
  expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({
    id: 'deepseek-v4.1-flash', contextWindow: 262144, maxTokens: 131072,
  }))
})

it.each([undefined, 8192, 512])('caps explicit and default request output (%s)', async (requested) => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  gateway.pushCompletions({ events: textEvents })
  const config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { maxTokens: 1024 } } })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', messages: [],
    ...(requested === undefined ? {} : { maxTokens: requested }),
  })) void chunk
  const body = gateway.bodies[0] as Record<string, number>
  expect(body.max_tokens ?? body.max_completion_tokens).toBe(Math.min(requested ?? 1024, 1024))
})

it('retains last known online metadata when limits change during an outage', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
  let config = configOf(gateway.url)
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  expect((await adapter.resolveModel('dsh-opencode-go', 'union-alpha')).context?.contextWindow).toBe(262144)
  const priorFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
    String(input) === MODELS_METADATA_URL ? Promise.resolve(new Response('', { status: 503 })) : priorFetch(input, init))
  config = { ...config, modelLimits: { 'union-alpha': { contextWindow: 123456 } } }
  await expect(adapter.resolveModel('dsh-opencode-go', 'union-alpha')).resolves.toMatchObject({ context: { contextWindow: 123456 } })
  // An explicit refresh must preserve the learned model too, not just the TTL hit.
  expect((await discoverSettingsModels(adapter.catalogOf(config))).models).toContainEqual(expect.objectContaining({
    id: 'union-alpha', contextWindow: 262144,
  }))
  expect(gateway.modelListings).toBe(2)
  config = { ...config, modelLimits: {} }
  expect((await adapter.resolveModel('dsh-opencode-go', 'union-alpha')).context?.contextWindow).toBe(262144)
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
  const pending = adapter.resolveModel('dsh-opencode-go', 'deepseek-v4.1-flash')
  // Keep the nested object shared: model reads still need an owned config snapshot.
  config.modelLimits['deepseek-v4.1-flash']!.contextWindow = 42
  config = { ...config }
  release()
  expect((await pending).context?.contextWindow).toBe(123456)
  expect((await adapter.resolveModel('dsh-opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow).toBe(42)
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
