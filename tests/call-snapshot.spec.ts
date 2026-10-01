import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { OpencodeGoAdapter } from '../src/adapter.ts'
import { Config } from '../src/config.ts'
import type { LiveConfig, OpencodeGoConfig } from '../src/config.ts'
import { apply } from '../src/index.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, MODELS_METADATA_URL } from './support/model-metadata.ts'

const provider = 'dsh-opencode-go'
const model = 'deepseek-v4.1-flash'
const request = (): GenerateOptions => ({ provider, model, messages: [createUserMessage({
  content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'snapshot-test' },
})] })
const drain = async (stream: AsyncIterable<StreamChunk>): Promise<void> => {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
}
const liveConfig = (read: () => OpencodeGoConfig): LiveConfig => Object.fromEntries(
  Object.keys(Config()).map(key => [key, { get: () => read()[key as keyof OpencodeGoConfig] }]),
) as LiveConfig

afterEach(async () => {
  vi.restoreAllMocks()
  await closeMockGateways()
})

it.each(['during discovery', 'after preparation'])('keeps a prepared call on its endpoint, credential and capacities when settings change %s', async timing => {
  vi.stubEnv('SNAPSHOT_KEY_A', 'fixture-key-A')
  vi.stubEnv('SNAPSHOT_KEY_B', 'fixture-key-B')
  const first = await mockGateway({ status: 200, body: listingBody([model]) })
  const second = await mockGateway({ status: 200, body: listingBody([model]) })
  first.pushCompletions({ events: textEvents })
  second.pushCompletions({ events: textEvents })
  let config = configOf(first.url, { apiKeyEnv: 'SNAPSHOT_KEY_A', modelLimits: { [model]: { contextWindow: 50000, maxTokens: 128 } } })
  const originalFetch = globalThis.fetch
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  if (timing === 'during discovery') vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) !== MODELS_METADATA_URL) return originalFetch(input, init)
    started.resolve()
    return release.promise.then(() => Response.json(metadataDocument()))
  })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  apply(ctx, liveConfig(() => config))
  try {
    const pending = ctx.llm.prepareCall({ provider, model })
    if (timing === 'during discovery') await started.promise
    const prepared = timing === 'after preparation' ? await pending : undefined
    // Keep the nested limits object shared: the request must own its captured values.
    config.modelLimits[model]!.contextWindow = 60000
    config.modelLimits[model]!.maxTokens = 256
    config = { ...config, baseURL: second.url, apiKeyEnv: 'SNAPSHOT_KEY_B' }
    release.resolve()
    const captured = prepared ?? await pending
    expect(captured.context?.contextWindow).toBe(50000)
    await drain(captured.stream({ ...request(), ...captured.config }))
    expect(first.bodies).toHaveLength(1)
    expect(first.headers.at(-1)?.authorization).toBe('Bearer fixture-key-A')
    expect(first.bodies[0]).toMatchObject({ max_tokens: 128 })
    expect(second.bodies).toHaveLength(0)

    await drain(ctx.llm.stream(request()))
    expect(second.headers.at(-1)?.authorization).toBe('Bearer fixture-key-B')
    expect(second.bodies[0]).toMatchObject({ max_tokens: 256 })
    expect((await ctx.llm.resolveModelInfo(provider, model)).context?.contextWindow).toBe(60000)
  } finally {
    release.resolve()
    await ctx.fiber.dispose()
  }
})

it('keeps the credential reference paired with the endpoint while a direct stream waits for discovery', async () => {
  vi.stubEnv('SNAPSHOT_KEY_A', 'fixture-key-A')
  vi.stubEnv('SNAPSHOT_KEY_B', 'fixture-key-B')
  const first = await mockGateway({ status: 200, body: listingBody([model]) })
  const second = await mockGateway({ status: 200, body: listingBody([model]) })
  first.pushCompletions({ events: textEvents })
  let config = configOf(first.url, { apiKeyEnv: 'SNAPSHOT_KEY_A' })
  const originalFetch = globalThis.fetch
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) !== MODELS_METADATA_URL) return originalFetch(input, init)
    started.resolve()
    return release.promise.then(() => Response.json(metadataDocument()))
  })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  const registration = vi.spyOn(ctx.llm, 'registerAdapter')
  apply(ctx, liveConfig(() => config))
  try {
    const adapter = registration.mock.calls.find(([providers]) => providers.includes(provider))?.[1] as OpencodeGoAdapter
    expect(adapter).toBeDefined()
    const pending = drain(adapter.stream(request()))
    await started.promise
    config = { ...config, baseURL: second.url, apiKeyEnv: 'SNAPSHOT_KEY_B' }
    release.resolve()
    await pending
    expect(first.bodies).toHaveLength(1)
    expect(first.headers.at(-1)?.authorization).toBe('Bearer fixture-key-A')
    expect(second.bodies).toHaveLength(0)
  } finally {
    release.resolve()
    await ctx.fiber.dispose()
  }
})
