import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { readModelMetadata } from '../src/model-metadata.ts'
import { configOf } from './config-of.ts'
import { OpencodeGoCatalog, discoverCatalogModels } from '../src/catalog.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

afterEach(closeMockGateways)

function metadataReplies(reply: (init?: RequestInit) => Response | Promise<Response>): void {
  const originalFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
    String(input) === MODELS_METADATA_URL ? Promise.resolve(reply(init)) : originalFetch(input, init))
}

describe('runtime model metadata', () => {
  it.each(['minimax-m2.7', 'union-alpha'])('resolves %s through the host without inventing reasoning controls', async (id) => {
    metadataReplies(() => Response.json(metadataDocument({
      [id]: modelMetadata({ provider: { npm: '@ai-sdk/anthropic' }, reasoning_options: [] }),
    })))
    const gateway = await mockGateway({ status: 200, body: listingBody([id]) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['opencode-go'], adapter)
    try {
      const models = await ctx.llm.listModels('opencode-go')
      const resolved = await Promise.all(models.map(model => ctx.llm.resolveModelInfo('opencode-go', model.id)))
      expect(resolved).toEqual([expect.objectContaining({ id })])
      expect(resolved[0]).not.toHaveProperty('reasoning')
      expect((await adapter.catalogOf(configOf(gateway.url)).snapshot()).models.get(id)?.reasoning).toBe(true)
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('keeps incomplete metadata from breaking the host model catalog while retaining discovery diagnostics', async () => {
    metadataReplies(() => Response.json(metadataDocument({
      ready: modelMetadata({ reasoning_options: [{ type: 'effort', values: ['low', 'high'] }] }),
    })))
    const gateway = await mockGateway({ status: 200, body: listingBody(['ready', 'not-ready']) })
    const config = configOf(gateway.url)
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['opencode-go'], adapter)
    try {
      // The browser eagerly resolves every listed model; a single rejection hides the provider.
      const models = await ctx.llm.listModels('opencode-go')
      const resolved = await Promise.all(models.map(model => ctx.llm.resolveModelInfo('opencode-go', model.id)))
      expect(resolved.map(model => model.id)).toEqual(['ready'])
      expect(resolved[0]?.reasoning?.efforts.map(effort => effort.id)).toEqual(['low', 'high'])
      expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({
        id: 'not-ready', name: expect.stringContaining('metadata unavailable'),
      }))
      await expect(ctx.llm.resolveModelInfo('opencode-go', 'not-ready')).rejects.toMatchObject({ code: 'MODEL_METADATA_UNAVAILABLE' })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('discovers union-alpha without a pi-ai entry', async () => {
    expect(getBuiltinModels('opencode-go').some(model => model.id === 'union-alpha')).toBe(false)
    const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
    const catalog = new OpencodeGoCatalog(gateway.url, 3600000, () => {}, () => {})
    expect(await discoverCatalogModels(catalog)).toContainEqual({
      id: 'union-alpha', name: 'Union Alpha Free', contextWindow: 262144, maxTokens: 131072,
    })
    expect((await catalog.snapshot()).models.get('union-alpha')).toMatchObject({
      api: 'anthropic-messages', input: ['text', 'image'], baseUrl: gateway.url,
    })
  })

  it('discovers an arbitrary future id and new metadata immediately on refresh', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
    const catalog = new OpencodeGoCatalog(gateway.url, 3600000, () => {}, () => {})
    await discoverCatalogModels(catalog)
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === MODELS_METADATA_URL) return Promise.resolve(Response.json(metadataDocument({
        'future-model-not-in-any-release': modelMetadata({ provider: { npm: '@ai-sdk/openai' } }),
      })))
      return originalFetch(input, init)
    })
    gateway.setModelListing(200, listingBody(['future-model-not-in-any-release']))
    const models = await discoverCatalogModels(catalog)
    expect(models.map(model => model.id)).toEqual(['future-model-not-in-any-release'])
    expect((await catalog.snapshot()).models.get('future-model-not-in-any-release')?.api).toBe('openai-responses')
    expect(gateway.modelListings).toBe(2)
  })

  it('keeps new models usable through a metadata outage without resurrecting retired models', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
    const failures: string[] = []
    const catalog = new OpencodeGoCatalog(gateway.url, 3600000, detail => failures.push(detail.url), () => {})
    await discoverCatalogModels(catalog)
    metadataReplies(() => new Response('unavailable', { status: 503 }))
    expect((await discoverCatalogModels(catalog)).map(model => model.id)).toEqual(['union-alpha'])
    gateway.setModelListing(503, {})
    const fallback = await catalog.snapshot(true)
    expect(fallback.live).toBe(false)
    expect([...fallback.models.keys()]).toEqual(['union-alpha'])
    expect(failures).toContain(MODELS_METADATA_URL)
    await expect(discoverCatalogModels(catalog)).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' })
  })

  it('makes missing metadata visible and retries it on the next direct model request', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['tomorrows-model']) })
    const catalog = new OpencodeGoCatalog(gateway.url, 3600000, () => {}, () => {})
    const models = await discoverCatalogModels(catalog)
    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({ id: 'tomorrows-model', name: expect.stringContaining('metadata unavailable') })
    await expect(catalog.forModel('tomorrows-model')).rejects.toMatchObject({ code: 'MODEL_METADATA_UNAVAILABLE' })
    metadataReplies(() => Response.json(metadataDocument({ 'tomorrows-model': modelMetadata() })))
    expect((await catalog.forModel('tomorrows-model')).models.has('tomorrows-model')).toBe(true)
  })

  it('revalidates ETags without sending generation credentials or losing cached metadata', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
    let calls = 0
    metadataReplies((init) => {
      const headers = new Headers(init?.headers)
      expect(headers.has('authorization')).toBe(false)
      expect(headers.has('x-api-key')).toBe(false)
      if (calls++ === 0) return Response.json(metadataDocument(), { headers: { etag: '"version-1"' } })
      expect(headers.get('if-none-match')).toBe('"version-1"')
      return new Response(null, { status: 304 })
    })
    const catalog = new OpencodeGoCatalog(gateway.url, 3600000, () => {}, () => {})
    const initial = await discoverCatalogModels(catalog)
    expect(await discoverCatalogModels(catalog)).toEqual(initial)
    expect(calls).toBe(2)
  })

  it('coalesces concurrent forced refreshes while preserving an existing request snapshot', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
    const catalog = new OpencodeGoCatalog(gateway.url, 3600000, () => {}, () => {})
    const old = await catalog.snapshot()
    let finish!: (response: Response) => void
    metadataReplies(() => new Promise(resolve => { finish = resolve }))
    gateway.setModelListing(200, listingBody(['new-model']))
    const first = catalog.snapshot(true)
    const second = catalog.snapshot(true)
    expect(first).toBe(second)
    expect(await catalog.snapshot()).toBe(old)
    finish(Response.json(metadataDocument({ 'new-model': modelMetadata() })))
    expect([...(await first).models.keys()]).toEqual(['new-model'])
    expect([...old.models.keys()]).toEqual(['union-alpha'])
  })

  it('rechecks availability on every picker read, independently of the runtime TTL', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['kimi-k3']) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
    expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual(['kimi-k3'])
    gateway.setModelListing(200, listingBody(['union-alpha']))
    expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual(['union-alpha'])
    gateway.setModelListing(200, listingBody([]))
    expect(await adapter.listModels('opencode-go')).toEqual([])
  })

  it('isolates malformed or unsupported entries and never takes the request origin from metadata', () => {
    const result = readModelMetadata(metadataDocument({
      valid: modelMetadata({ provider: { npm: '@ai-sdk/anthropic', api: 'https://untrusted.invalid', headers: { authorization: 'bad' } } }),
      unsupported: modelMetadata({ provider: { npm: '@future/unknown-protocol' } }),
      malformed: modelMetadata({ limit: { context: -1, output: 5 } }),
    }), 'https://gateway.example/v1', new Map())
    expect(result.models.get('valid')).toMatchObject({ baseUrl: 'https://gateway.example', api: 'anthropic-messages' })
    expect(result.models.get('valid')).not.toHaveProperty('headers')
    expect([...result.errors.keys()]).toEqual(['unsupported', 'malformed'])
  })

  it('takes capacities, pricing tiers and supported reasoning controls from current metadata', () => {
    const result = readModelMetadata(metadataDocument({
      future: modelMetadata({
        reasoning_options: [{ type: 'effort', values: ['low', 'high'] }],
        cost: { input: 1, output: 2, tiers: [{ input: 3, output: 4, tier: { type: 'context', size: 200000 } }] },
      }),
      'always-thinking': modelMetadata({ reasoning_options: [] }),
    }), 'https://gateway.example/v1', new Map())
    const model = result.models.get('future')!
    expect(getSupportedThinkingLevels(model)).toEqual(['low', 'high'])
    expect(model.cost.tiers).toEqual([{ input: 3, output: 4, cacheRead: 0, cacheWrite: 0, inputTokensAbove: 200000 }])
    expect(getSupportedThinkingLevels(result.models.get('always-thinking')!)).toEqual([])
  })
})

const anthropicEvents = [
  { type: 'message_start', message: { id: 'msg-test', type: 'message', role: 'assistant', model: 'future', content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
  { type: 'message_stop' },
].map(event => JSON.stringify(event))

const responseMessage = { id: 'msg-test', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'hello', annotations: [] }] }
const responseEvents = [
  { type: 'response.created', response: { id: 'resp-test' } },
  { type: 'response.output_item.added', output_index: 0, item: { ...responseMessage, content: [] } },
  { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'hello' },
  { type: 'response.output_item.done', output_index: 0, item: responseMessage },
  { type: 'response.completed', response: { id: 'resp-test', status: 'completed', output: [responseMessage], usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 } } },
].map(event => JSON.stringify(event))

describe('new models use the declared protocol', () => {
  it.each([
    { npm: '@ai-sdk/anthropic', path: '/v1/messages', events: anthropicEvents, namedEvents: true },
    { npm: '@ai-sdk/openai-compatible', path: '/v1/chat/completions', events: textEvents, namedEvents: false },
    { npm: '@ai-sdk/openai', path: '/v1/responses', events: responseEvents, namedEvents: false },
  ].flatMap(protocol => [undefined, 1024].map(cap => ({ ...protocol, cap }))))('streams a never-seen model via $path with output cap $cap', async ({ npm, path, events, namedEvents, cap }) => {
    metadataReplies(() => Response.json(metadataDocument({ 'future-unseen-model': modelMetadata({ provider: { npm }, reasoning_options: [] }) })))
    const gateway = await mockGateway({ status: 200, body: listingBody(['future-unseen-model']) })
    gateway.pushCompletions({ events, namedEvents })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(`${gateway.url}/v1`, {
      modelLimits: cap === undefined ? {} : { 'future-unseen-model': { maxTokens: cap } },
    }), resolveApiKey: async () => 'test-key' })
    const chunks = []
    for await (const chunk of adapter.stream({
      provider: 'opencode-go', model: 'future-unseen-model', sessionId: 'new-model-session' as never,
      ...(cap === undefined ? {} : { maxTokens: 8192 }),
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })],
    })) chunks.push(chunk)
    expect(gateway.paths.map(value => new URL(value, gateway.url).pathname)).toEqual(['/v1/models', path])
    expect(gateway.bodies[0]).toMatchObject({ model: 'future-unseen-model' })
    if (cap !== undefined) {
      const body = gateway.bodies[0] as Record<string, unknown>
      expect(body.max_tokens ?? body.max_completion_tokens ?? body.max_output_tokens).toBe(cap)
    }
    expect(gateway.headers[1]?.['x-opencode-session']).toBe('new-model-session')
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  })
})
