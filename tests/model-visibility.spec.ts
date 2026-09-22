import { registerGoRemotes } from '../src/remotes.ts'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { GoModelsService } from '../src/models.ts'
import { PlainConfig } from '../src/config.ts'
import { isNewModel, sortModels } from '../src/models-contract.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'
import { configOf } from './config-of.ts'

afterEach(closeMockGateways)

it('keeps settings gateway-only and filters deprecated picker entries without disabling their requests', async () => {
  const original = globalThis.fetch
  let metadataDown = false
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
    ? Promise.resolve(metadataDown ? new Response('', { status: 503 }) : Response.json(metadataDocument({
      current: modelMetadata({ release_date: '2026-09-22' }),
      old: modelMetadata({ status: 'deprecated' }),
      absent: modelMetadata({ status: 'deprecated' }),
    }))) : original(input, init))
  const gateway = await mockGateway({ status: 200, body: listingBody(['current', 'old']) })
  const config = configOf(`${gateway.url}/v1`)
  expect(PlainConfig({}).showDeprecatedModels).toBe(false)
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
  const ctx = new Context()
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
  try {
    const read = () => ctx.typertGateway.invoke({ namespace: 'opencodeGoModels', method: 'read', args: {} })
    expect(await read()).toEqual([
      expect.objectContaining({ id: 'current', releaseDate: '2026-09-22', contextWindow: 262144 }),
      expect.objectContaining({ id: 'old', deprecated: true }),
    ])
    expect((await adapter.listModels('opencode-go')).map(m => m.id)).toEqual(['current'])
    config.showDeprecatedModels = true
    expect((await adapter.listModels('opencode-go')).map(m => m.id)).toEqual(['current', 'old'])
    config.showDeprecatedModels = false
    // Hiding affects pickers; existing conversations can keep using the served model.
    gateway.pushCompletions({ events: textEvents })
    const chunks = []
    for await (const chunk of adapter.stream({ provider: 'opencode-go', model: 'old',
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })] })) chunks.push(chunk)
    expect(chunks.length).toBeGreaterThan(0)
    metadataDown = true
    expect((await adapter.listModels('opencode-go')).map(m => m.id)).toEqual(['current'])
    config.showDeprecatedModels = true
    gateway.setModelListing(200, listingBody(['current']))
    expect((await read() as Array<{ id: string }>).map(m => m.id)).toEqual(['current'])
    expect((await adapter.listModels('opencode-go')).map(m => m.id)).toEqual(['current'])
  } finally { await ctx.fiber.dispose() }
})

it('uses actual release dates for the seven-day badge and sorts deprecated models last', () => {
  const now = Date.parse('2026-09-22T12:00:00Z')
  expect(isNewModel({ id: 'a', releaseDate: '2026-09-16' }, now)).toBe(true)
  for (const releaseDate of ['2026-09-15', '2026-09-23', '2026-02-30', undefined]) {
    expect(isNewModel({ id: 'a', releaseDate }, now)).toBe(false)
  }
  expect(sortModels([
    { id: 'old', deprecated: true, releaseDate: '2026-09-22' },
    { id: 'normal' }, { id: 'new', releaseDate: '2026-09-22' },
  ], now).map(m => m.id)).toEqual(['new', 'normal', 'old'])
})
