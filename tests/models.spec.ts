import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { GoModelsService } from '../src/models.ts'
import { registerGoRemotes } from '../src/remotes.ts'
import { isModelEnabled, parseGoModelCatalog, type GoModelCatalog } from '../src/models-contract.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

afterEach(closeMockGateways)

it.each([
  { name: 'HTTP failure', reply: () => new Response(null, { status: 503 }), detail: 'HTTP 503' },
  { name: 'timeout', reply: () => { throw new DOMException('timed out', 'TimeoutError') }, detail: 'timed out' },
  { name: 'invalid JSON', reply: () => new Response('not-json'), detail: 'invalid JSON' },
  { name: 'invalid configuration document', reply: () => Response.json({}), detail: 'invalid model configuration' },
])('reports a cold-start metadata $name through the Host RPC and clears it after recovery', async ({ reply, detail }) => {
  const id = 'deepseek-v4.1-flash'
  const builtin = 'deepseek-v4-flash'
  const gateway = await mockGateway({ status: 200, body: listingBody([builtin, id]) })
  const config = configOf(gateway.url)
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => undefined })
  const original = globalThis.fetch
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
    ? reply() : original(input, init))
  const ctx = new Context()
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
  const read = async () => await ctx.typertGateway.invoke({
    namespace: 'opencodeGoModels', method: 'read', args: {},
  }) as GoModelCatalog
  try {
    const failed = await read()
    expect(failed.stale).toBe(true)
    expect(failed.error).toContain(detail)
    expect(failed.sources).toEqual({
      listing: { updatedAt: expect.any(Number) }, metadata: { error: expect.stringContaining(detail) },
    })
    expect(failed.models.find(model => model.id === id)?.configurationMissing).toBe(true)
    expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual([builtin])

    vi.stubGlobal('fetch', original)
    const recovered = await read()
    expect(recovered.stale).toBe(false)
    expect(recovered.error).toBeUndefined()
    expect(recovered.sources?.metadata).toEqual({ updatedAt: expect.any(Number) })
    expect(recovered.models.find(model => model.id === id)?.configurationMissing).not.toBe(true)
    expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual([builtin, id])
  } finally {
    await ctx.fiber.dispose()
  }
})

it('round-trips source diagnostics, accepts older responses, and rejects invalid timestamps', () => {
  const old = { models: [], stale: false }
  expect(parseGoModelCatalog(old)).toEqual(old)
  const catalog = { models: [], stale: true, sources: {
    listing: { updatedAt: 1_000 }, metadata: { error: 'HTTP 503' },
  } }
  expect(parseGoModelCatalog(catalog)).toEqual(catalog)
  for (const updatedAt of [-1, NaN, Infinity, 'yesterday', 8_640_000_000_000_001]) {
    expect(() => parseGoModelCatalog({ ...catalog, sources: { ...catalog.sources, listing: { updatedAt } } })).toThrow(/timestamp/)
  }
})

it('marks missing configuration in the Host RPC and only enables the model after metadata becomes usable', async () => {
  const id = 'unconfigured-model'
  let configured = false
  const original = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
    ? Promise.resolve(Response.json(metadataDocument(configured ? { [id]: modelMetadata({ name: 'Configured model' }) } : {})))
    : original(input, init))
  const gateway = await mockGateway({ status: 200, body: listingBody([id]) })
  const config = configOf(gateway.url, { modelVisibility: { [id]: true } })
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => undefined })
  const ctx = new Context()
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
  const read = async () => await ctx.typertGateway.invoke({
    namespace: 'opencodeGoModels', method: 'read', args: {},
  }) as GoModelCatalog
  try {
    const missing = await read()
    expect(missing).toEqual({ models: [{ id, name: id, configurationMissing: true }], stale: false,
      sources: { listing: { updatedAt: expect.any(Number) }, metadata: { updatedAt: expect.any(Number) } },
    })
    expect(isModelEnabled(missing.models[0], config.modelVisibility)).toBe(false)
    expect(await adapter.listModels('opencode-go')).toEqual([])
    await expect(adapter.resolveModel('opencode-go', id)).rejects.toMatchObject({ code: 'MODEL_METADATA_UNAVAILABLE' })

    configured = true
    const available = await read()
    expect(available.models).toEqual([expect.objectContaining({ id, name: 'Configured model' })])
    expect(available.models[0].configurationMissing).not.toBe(true)
    expect(isModelEnabled(available.models[0], config.modelVisibility)).toBe(true)
    expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual([id])
    await expect(adapter.resolveModel('opencode-go', id)).resolves.toMatchObject({ id })
  } finally {
    await ctx.fiber.dispose()
  }
})

it('returns retained settings models and the timeout diagnostic through the Host RPC, matching the picker', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
  const config = configOf(gateway.url)
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => undefined })
  const ctx = new Context()
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
  const read = async () => await ctx.typertGateway.invoke({
    namespace: 'opencodeGoModels', method: 'read', args: {},
  }) as GoModelCatalog
  try {
    const first = await read()
    expect(first.stale).toBe(false)
    expect(first.models.map(model => model.id)).toEqual(['union-alpha'])
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === `${gateway.url}/models`
      ? Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      : original(input, init))

    const stale = await read()
    expect(stale.models).toEqual(first.models)
    expect(stale.stale).toBe(true)
    expect(stale.error).toContain(`${gateway.url}/models: request timed out or was aborted`)
    expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual(stale.models.map(model => model.id))

    vi.stubGlobal('fetch', original)
    gateway.setModelListing(200, listingBody(['kimi-k3']))
    const recovered = await read()
    expect(recovered.stale).toBe(false)
    expect(recovered.error).toBeUndefined()
    expect(recovered.models.map(model => model.id)).toEqual(['kimi-k3'])
    expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual(['kimi-k3'])
  } finally {
    await ctx.fiber.dispose()
  }
})
