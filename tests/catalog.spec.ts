import { expect, it, vi, beforeEach, describe } from 'vitest'
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { getSupportedThinkingLevels } from 'opencode-go-pi-ai'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import {
  GoModelsService, GoCatalogManager, discoverSettingsModels, OpencodeGoCatalog,
  discoverCatalogModels, readLiveModelIds, readModelDirectory, reasoningChoices, modelBaseURL,
  reasoningBudgetRange, reasoningIntent,
  catalogCachePath, catalogETag, readCatalogCache, writeCatalogCache, MODEL_LISTING_MAX_BYTES,
} from '../src/catalog.ts'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { ProxyTransport } from '../src/transport.ts'
import { PlainConfig, validateGoConfig } from '../src/config.ts'
import { DEFAULT_BASE_URL, DEFAULT_FREE_BASE_URL, isModelEnabled, isNewModel, sortModels, parseGoModelCatalog, modelSettingsKey } from '../src/contracts.ts'
import { listingBody, mockGateway, textEvents } from './support/gateway.ts'
import { modelsDocument, modelEntry, protocolEntry, zeroCost } from './support/data.ts'
import { configOf, context, mountRemotes, invokeRemote } from './support/host.ts'

const catalog = (url: string, options: { fetcher?: typeof fetch; source?: 'go' | 'free'; onRefresh?: () => void; onFallback?: ReturnType<typeof vi.fn>; onWarning?: ReturnType<typeof vi.fn> } = {}) =>
  new OpencodeGoCatalog(url, 60_000, options.onFallback, undefined, options.onRefresh, options.fetcher, options.onWarning, options.source)
const url = 'https://gateway.example/v1'
const model = (id: string, entry: Record<string, unknown> = modelEntry()) => readModelDirectory(modelsDocument({ [id]: entry }), url).models.get(id)!

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.UTC(2026, 10, 2)) })

describe('gateway directory parsing', () => {
  it('selects only declared chat rows and deduplicates within a source', () => {
    const body = { data: [{ id: 'chat', ...modelEntry() }, { id: 'chat', ...modelEntry() },
      { id: 'image', type: 'image' }, { id: 'embedding', type: 'embedding' }, { id: 'legacy' }] }
    expect(readLiveModelIds(body)).toEqual(['chat'])
    expect([...readModelDirectory(body, url).models.keys()]).toEqual(['chat'])
  })
  it('reports bounded invalid row positions without copying row content', () => {
    const warning = vi.fn()
    expect(readLiveModelIds({ data: [{ id: 'a', type: 'chat' }, ...Array(12).fill({ secret: 'private-row' })] }, warning)).toEqual(['a'])
    expect(warning.mock.calls[0]?.[0]).toContain('12 of 13')
    expect(warning.mock.calls[0]?.[0]).toContain('rows 2, 3, 4, 5, 6, 7, 8, 9, …')
    expect(warning.mock.calls[0]?.[0]).not.toContain('private-row')
  })
  it.each([{}, { data: {} }, { data: [null, { id: '' }] }])('rejects malformed documents %j', body => {
    expect(() => readModelDirectory(body, url)).toThrow()
  })
  it('accepts confirmed empty and entirely non-chat listings', () => {
    for (const data of [[], [{ id: 'image', type: 'image' }]]) expect(readModelDirectory({ data }, url).models.size).toBe(0)
  })
  it.each([
    ['chat-completions', 'openai-completions'], ['responses', 'openai-responses'],
    ['messages', 'anthropic-messages'], ['generate-content', 'google-generative-ai'],
  ])('configures an arbitrary future %s model without a static entry', (protocol, api) => {
    const result = model('never-seen-before', modelEntry({ api: protocolEntry(protocol) }))
    expect(result).toMatchObject({ id: 'never-seen-before', api, contextWindow: 262144, maxTokens: 131072,
      input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })
    expect(result.baseUrl).toBe(api === 'anthropic-messages' ? 'https://gateway.example' : url)
  })
  it.each([
    { limit: { context: 0, output: 100 } }, { limit: { context: 100, output: '100' } },
    { api: { unknown: {} } }, { modalities: { input: ['audio/wav'] } },
    { capabilities: { reasoning: { supported: true, budget: { min: 4096, max: 1024 } } }, api: protocolEntry('messages') },
  ])('isolates invalid model declarations %j', invalid => {
    const result = readModelDirectory(modelsDocument({ valid: modelEntry(), invalid: modelEntry(invalid) }), url)
    expect([...result.models.keys()]).toEqual(['valid'])
    expect(result.errors.get('invalid')).toEqual(expect.any(String))
  })
  it('drops unusable configured thinking budgets instead of making the model unresolvable', () => {
    const budgetModel = model('budget-model', modelEntry({ api: protocolEntry('messages'), limit: { context: 10000, output: 5000 },
      capabilities: { reasoning: { supported: true, toggle: true, budget: { min: 1500, max: 4500 } } } }))
    expect(reasoningBudgetRange(budgetModel)).toEqual({ min: 1500, max: 3976 })
    // Out-of-range, non-integer and oversized values are user data: drop them.
    expect(reasoningChoices({ ...budgetModel, reasoningBudgetPresets: [1, 1024, 3977, 6000, 1.5, NaN, 2048] }))
      .toEqual([{ id: 'off', name: 'Off' }, { id: 'low', name: '2,048 tokens' }])
    expect(() => reasoningChoices({ ...budgetModel, reasoningBudgetPresets: [Number.MAX_SAFE_INTEGER] })).not.toThrow()
    expect(reasoningChoices({ ...budgetModel, reasoningBudgetPresets: [3000, 3000] })).toEqual([
      { id: 'off', name: 'Off' }, { id: 'low', name: '2,048 tokens' }, { id: 'budget:3000', name: '3,000 tokens' },
    ])
    // A model too small for the declared floor loses the control but survives.
    const tooSmall = { ...budgetModel, maxTokens: 1024 }
    expect(reasoningBudgetRange(tooSmall)).toBeUndefined()
    expect(() => reasoningChoices(tooSmall)).not.toThrow()
  })
  it('clamps stale budget selections into the usable range', () => {
    const budgetModel = model('budget-model', modelEntry({ api: protocolEntry('messages'), limit: { context: 10000, output: 5000 },
      capabilities: { reasoning: { supported: true, toggle: true, budget: { min: 1500, max: 4500 } } } }))
    expect(reasoningIntent(budgetModel, 'budget:2048')).toEqual({ kind: 'budget', min: 1500, tokens: 2048 })
    expect(reasoningIntent(budgetModel, 'budget:6000')).toEqual({ kind: 'budget', min: 1500, tokens: 3976 })
    expect(reasoningIntent(budgetModel, 'budget:1')).toEqual({ kind: 'budget', min: 1500, tokens: 1500 })
    expect(reasoningIntent(budgetModel, 'budget:not-a-number')).toEqual({ kind: 'budget', min: 1500, tokens: 1500 })
  })
  it('normalizes MIME and short modalities, preserving all display modalities in stable order', () => {
    const result = readModelDirectory(modelsDocument({ mime: modelEntry({ modalities: {
      input: ['video/*', 'image/jpeg', 'audio/wav', 'application/pdf', 'text/plain', 'IMAGE', 'audio/*', 'other'],
    }, status: 'deprecated', release_date: '2026-11-01' }) }), url)
    expect(result.details.get('mime')).toEqual({ deprecated: true, releaseDate: '2026-11-01', inputModalities: ['text', 'image', 'audio', 'video', 'pdf'] })
    expect(result.models.get('mime')?.input).toEqual(['text', 'image'])
  })
  it('takes official protocol URLs from the listing and keeps custom prefixes', () => {
    const entry = modelEntry({ api: protocolEntry('messages', { base_url: 'https://opencode.ai/new/anthropic/v1/' }) })
    expect(readModelDirectory(modelsDocument({ a: entry }), DEFAULT_BASE_URL).models.get('a')?.baseUrl).toBe('https://opencode.ai/new/anthropic')
    expect(readModelDirectory(modelsDocument({ a: entry }), 'https://custom.example/prefix/v1/').models.get('a')?.baseUrl).toBe('https://custom.example/prefix')
    expect(modelBaseURL('openai-responses', DEFAULT_FREE_BASE_URL, 'https://opencode.ai/platform/openai/v1', 'free')).toBe('https://opencode.ai/platform/openai/v1')
    expect(modelBaseURL('google-generative-ai', DEFAULT_FREE_BASE_URL, undefined, 'free')).toBe('https://opencode.ai/inference/google/v1beta')
  })
  it('does not use listing credentials or headers for inference', () => {
    const result = model('future', modelEntry({ headers: { authorization: 'secret' }, api: protocolEntry('chat-completions', { headers: { 'x-key': 'secret' } }) }))
    expect(result).not.toHaveProperty('headers')
    expect(result.baseUrl).toBe(url)
  })
  it('derives compatibility from endpoint capabilities and canonical family identity', () => {
    const result = model('future', modelEntry({ canonical_id: 'deepseek/future', capabilities: {
      reasoning: { supported: true, effort: ['low'] }, system_updates: true,
      tools: { strict: false, updates: false },
    }, api: protocolEntry('chat-completions', { compatibility: { reasoning_field: 'reasoning_content' }, capabilities: { tools: { strict: true, updates: true } } }) }))
    expect(result.compat).toMatchObject({ supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens',
      thinkingFormat: 'deepseek', requiresReasoningContentOnAssistantMessages: true, supportsStrictMode: true,
      supportsMidConvoSystemMessages: true, supportsMidConvoToolAdditions: true })
    const responses = model('future', modelEntry({ capabilities: { system_updates: true }, api: protocolEntry('responses', { capabilities: { tools: { updates: true } } }) }))
    expect(responses.compat).toMatchObject({ sessionAffinityFormat: 'openai-nosession', supportsAdditionalTools: true, supportsMidConvoSystemMessages: true })
  })
  it.each(['chat-completions', 'responses', 'messages'])('preserves inherited strict tools with partial %s capabilities', protocol => {
    const result = model('future', modelEntry({ capabilities: { tools: { strict: true, updates: false } },
      api: protocolEntry(protocol, { capabilities: { tools: { updates: true } } }) }))
    expect(result.compat).toMatchObject(protocol === 'messages'
      ? { supportsStrictTools: true, supportsMidConvoToolChanges: true }
      : protocol === 'responses' ? { supportsStrictMode: true, supportsAdditionalTools: true }
        : { supportsStrictMode: true, supportsMidConvoToolAdditions: true })
  })
  it.each(['mimo-v2.6-flash', 'arbitrary-new-name'])('never invents reasoning levels for %s', id => {
    const result = model(id, modelEntry({ family: 'mimo', capabilities: { reasoning: { supported: true } } }))
    expect(result.reasoning).toBe(true)
    expect(getSupportedThinkingLevels(result)).toEqual([])
    expect(result.thinkingLevelMap?.off).toBeNull()
  })
  it('honors a protocol capability override of reasoning support', () => {
    const result = model('future', modelEntry({ api: protocolEntry('chat-completions', { capabilities: { reasoning: { supported: false } } }) }))
    expect(result.reasoning).toBe(false)
    expect(getSupportedThinkingLevels(result)).toEqual(['off'])
    expect(reasoningChoices(result)).toEqual([])
  })
  it('marks absent or invalid prices unpriced in Go and excludes them from Free', () => {
    const body = modelsDocument({ absent: modelEntry({ cost: undefined }), invalid: modelEntry({ cost: { text: { input: { price: -1 }, output: { price: 0 } } } }), valid: modelEntry() })
    const go = readModelDirectory(body, url)
    expect([...go.models.keys()]).toEqual(['absent', 'invalid', 'valid'])
    expect(go.details.get('absent')?.costKnown).toBe(false)
    expect(go.details.get('invalid')?.costKnown).toBe(false)
    expect(go.details.get('valid')?.costKnown).toBeUndefined()
    expect([...readModelDirectory(body, url, 'free').models.keys()]).toEqual(['valid'])
  })
  it('keeps only truly free chat models, checking output, both caches and every context tier', () => {
    const body = modelsDocument({
      free: modelEntry(), paid: modelEntry({ cost: { text: { input: { price: 0.1 }, output: { price: 0 } } } }),
      output: modelEntry({ cost: { text: { input: { price: 0 }, output: { price: 1 } } } }),
      cacheRead: modelEntry({ cost: { text: { input: { price: 0, cache: { read: 0.1 } }, output: { price: 0 } } } }),
      cacheWrite: modelEntry({ cost: { text: { input: { price: 0, cache: { write: 0.1 } }, output: { price: 0 } } } }),
      tier: modelEntry({ cost: { text: { input: { price: 0, overrides: [{ when: { context: { gt: 200000 } }, price: 1 }] }, output: { price: 0 } } } }),
      image: modelEntry({ type: 'image' }),
    })
    expect([...readModelDirectory(body, url, 'free').models.keys()]).toEqual(['free'])
  })
})

describe('cache freshness and degradation', () => {
  it('reuses snapshots during the TTL and coalesces concurrent forced refreshes', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['future']) })
    const instance = catalog(gateway.url)
    const first = await instance.snapshot()
    expect(await instance.snapshot()).toBe(first)
    expect(gateway.modelListings).toBe(1)
    const snapshots = await Promise.all(Array.from({ length: 8 }, () => instance.snapshot(true)))
    expect(snapshots.every(snapshot => snapshot === snapshots[0])).toBe(true)
    expect(gateway.modelListings).toBe(2)
    gateway.setModelListing(200, listingBody(['new']))
    vi.setSystemTime(Date.now() + 60_000)
    expect([...(await instance.snapshot()).models.keys()]).toEqual(['new'])
    expect(gateway.modelListings).toBe(3)
  })
  it('serves known models during a background refresh, while manual and unknown calls wait', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['old']) })
    const release = Promise.withResolvers<Response>()
    let delayed = false
    const fetcher = vi.fn((input, init) => delayed ? release.promise : fetch(input, init)) as typeof fetch
    const instance = catalog(gateway.url, { fetcher })
    const first = await instance.snapshot()
    vi.setSystemTime(Date.now() + 60_000)
    delayed = true
    const known = instance.forModel('old')
    const manual = instance.snapshot(true)
    const unknown = instance.forModel('new')
    const completed = vi.fn()
    void manual.then(completed); void unknown.then(completed)
    expect(await known).toBe(first)
    expect(completed).not.toHaveBeenCalled()
    release.resolve(Response.json(listingBody(['new'])))
    expect((await unknown).models.has('new')).toBe(true)
    await manual
    expect(fetcher).toHaveBeenCalledTimes(2)
    delayed = false; gateway.setModelListing(200, listingBody(['new']))
    expect((await instance.forModel('old')).models.has('old')).toBe(false)
  })
  it('waits beyond the stale grace window even after a failed refresh', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['old']) })
    const release = Promise.withResolvers<Response>(); let delayed = false
    const instance = catalog(gateway.url, { fetcher: (input, init) => delayed ? release.promise : fetch(input, init) })
    await instance.snapshot()
    gateway.setModelListing(503, {})
    await instance.snapshot(true)
    vi.setSystemTime(Date.now() + 360_001)
    delayed = true
    const completed = vi.fn()
    const pending = instance.forModel('old').then(completed)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(completed).not.toHaveBeenCalled()
    release.resolve(Response.json(listingBody(['old'])))
    await pending
    expect(completed).toHaveBeenCalledOnce()
  })
  it('revalidates unknown and previously unconfigured ids within a fresh TTL', async () => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ bad: modelEntry({ api: {} }) }) })
    const instance = catalog(gateway.url)
    await instance.snapshot()
    await expect(instance.forModel('bad')).rejects.toMatchObject({ code: 'MODEL_METADATA_UNAVAILABLE' })
    gateway.setModelListing(200, listingBody(['new', 'bad']))
    expect((await instance.forModel('new')).models.has('new')).toBe(true)
    expect((await instance.forModel('bad')).models.has('bad')).toBe(true)
    expect(gateway.modelListings).toBe(3)
  })
  it.each([{}, { data: [null, { id: 1 }] }, '{broken'])('retains the last verified snapshot on malformed data %j', async body => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['kept']) })
    const instance = catalog(gateway.url)
    await instance.snapshot()
    gateway.setModelListing(200, body)
    const failed = await instance.snapshot(true)
    expect(failed.live).toBe(false)
    expect([...failed.models.keys()]).toEqual(['kept'])
    await expect(discoverCatalogModels(instance)).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' })
  })
  it('uses a verified empty listing across memory, disk and subsequent outages', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['retired']) })
    const instance = catalog(gateway.url)
    await instance.snapshot()
    gateway.setModelListing(200, { data: [] })
    expect((await instance.snapshot(true)).models.size).toBe(0)
    gateway.setModelListing(503, {})
    expect((await instance.snapshot(true)).models.size).toBe(0)
    expect((await catalog(gateway.url).snapshot(true)).models.size).toBe(0)
  })
  it('distinguishes a cold unreachable listing from a confirmed unknown model', async () => {
    const gateway = await mockGateway({ status: 503, body: {} })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'key' })
    await expect(adapter.resolveModel('dsh-opencode-go', 'missing')).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' })
    gateway.setModelListing(200, { data: [] })
    await adapter.catalogOf(configOf(gateway.url)).snapshot(true)
    await expect(adapter.resolveModel('dsh-opencode-go', 'missing')).rejects.toMatchObject({ code: 'UNKNOWN_MODEL' })
  })
  it('keeps endpoint and HTTP diagnostics in settings and clears them after recovery', async () => {
    const gateway = await mockGateway({ status: 503, body: {} })
    const instance = catalog(gateway.url)
    const failed = await discoverSettingsModels(instance)
    expect(failed).toMatchObject({ stale: true, models: [], sources: { go: { error: expect.stringContaining('HTTP 503') }, free: {} } })
    expect(failed.error).toContain(`${gateway.url}/models`)
    gateway.setModelListing(200, listingBody(['recovered']))
    expect(await discoverSettingsModels(instance)).toMatchObject({ stale: false, sources: { go: { updatedAt: expect.any(Number) } } })
  })
  it('backs off failed sources independently and caps retries at one minute', async () => {
    const gateway = await mockGateway({ status: 503, body: {} })
    const instance = catalog(gateway.url)
    await instance.snapshot()
    for (const delay of [5000, 10000, 20000, 40000, 60000, 60000]) {
      const calls = gateway.modelListings
      vi.setSystemTime(Date.now() + delay - 1)
      await instance.snapshot()
      expect(gateway.modelListings).toBe(calls)
      vi.setSystemTime(Date.now() + 1)
      await instance.snapshot()
      expect(gateway.modelListings).toBe(calls + 1)
    }
    gateway.setModelListing(200, listingBody(['ready']))
    expect((await instance.snapshot(true)).live).toBe(true)
    vi.setSystemTime(Date.now() + 59_999)
    await instance.snapshot()
    expect(gateway.modelListings).toBe(8)
  })
  it('preserves mixed-row warnings and clears them on a clean refresh', async () => {
    const body = modelsDocument({ valid: modelEntry() }); body.data.push(null as never)
    const gateway = await mockGateway({ status: 200, body })
    const onWarning = vi.fn(), instance = catalog(gateway.url, { onWarning })
    expect((await discoverSettingsModels(instance)).sources?.go.warning).toContain('1 of 2')
    expect(onWarning).toHaveBeenCalledOnce()
    gateway.setModelListing(200, listingBody(['valid']))
    expect((await discoverSettingsModels(instance)).sources?.go.warning).toBeUndefined()
  })
  it('cancels one waiter without aborting the shared transport or other waiter', async () => {
    const release = Promise.withResolvers<Response>(), started = Promise.withResolvers<void>()
    let signal: AbortSignal | null | undefined
    const instance = catalog(url, { fetcher: async (_input, init) => { signal = init?.signal; started.resolve(); return release.promise } })
    const controller = new AbortController()
    const cancelled = instance.snapshot(true, controller.signal).catch(error => error)
    const other = instance.snapshot(true)
    await started.promise
    controller.abort()
    expect(await cancelled).toMatchObject({ code: 'ABORTED' })
    expect(signal?.aborted).toBe(false)
    release.resolve(Response.json(listingBody(['ready'])))
    expect((await other).models.has('ready')).toBe(true)
  })
})

describe('persistent source caches', () => {
  it('persists raw declarations and safe ETags, revalidates 304 and preserves timestamps on failure', async () => {
    const requests: Headers[] = []
    const responses = [Response.json(listingBody(['saved']), { headers: { etag: '"v1"' } }),
      new Response(null, { status: 304, headers: { etag: 'W/"v2"' } }), new Response(null, { status: 503 })]
    const instance = catalog(url, { fetcher: async (_input, init) => { requests.push(new Headers(init?.headers)); return responses.shift()! } })
    await instance.snapshot(true)
    vi.setSystemTime(Date.now() + 1000)
    const verified = await instance.snapshot(true)
    const saved = await readCatalogCache(catalogCachePath(), `${url}/models`)
    expect(saved).toMatchObject({ etag: 'W/"v2"', savedAtMs: verified.updatedAtMs, body: listingBody(['saved']) })
    expect(requests[0].has('authorization')).toBe(false)
    expect(requests[1].get('if-none-match')).toBe('"v1"')
    expect(requests[0].get('user-agent')).toMatch(/^deepseek-harness\//)
    // Windows reports compatibility mode bits, not POSIX file permissions.
    if (process.platform !== 'win32') expect((await stat(catalogCachePath())).mode & 0o777).toBe(0o600)
    vi.setSystemTime(Date.now() + 1000)
    expect((await instance.snapshot(true)).updatedAtMs).toBe(verified.updatedAtMs)
    expect((await readCatalogCache(catalogCachePath(), `${url}/models`))?.savedAtMs).toBe(saved?.savedAtMs)
  })
  it('restores offline models immediately, shares refreshes, and publishes the committed catalog', async () => {
    await catalog(url, { fetcher: async () => Response.json(listingBody(['saved']), { headers: { etag: '"saved"' } }) }).snapshot(true)
    const release = Promise.withResolvers<Response>(), onRefresh = vi.fn(), fetcher = vi.fn(() => release.promise)
    const instance = catalog(url, { fetcher, onRefresh })
    const early = await instance.snapshot()
    expect(early).toMatchObject({ live: false, updatedAtMs: expect.any(Number) })
    expect([...early.models.keys()]).toEqual(['saved'])
    const manual = instance.snapshot(true), unknown = instance.forModel('new')
    release.resolve(Response.json(listingBody(['new'])))
    expect([...(await manual).models.keys()]).toEqual(['new'])
    expect((await unknown).models.has('new')).toBe(true)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('retains disk data through offline refreshes without advertising a cold static table', async () => {
    await catalog(url, { fetcher: async () => Response.json(listingBody(['saved'])) }).snapshot(true)
    const offline = catalog(url, { fetcher: async () => { throw new Error('offline') } })
    const snapshot = await offline.snapshot(true)
    expect(snapshot.live).toBe(false)
    expect([...snapshot.models.keys()]).toEqual(['saved'])
    await expect(discoverCatalogModels(offline)).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' })
    expect((await catalog('https://other.example/v1', { fetcher: async () => { throw new Error('offline') } }).snapshot(true)).models.size).toBe(0)
  })
  it('keeps independent Go/Free disk files, validators and outages even with overlapping ids', async () => {
    const go = await mockGateway({ status: 200, body: listingBody(['beam-free', 'go-only']), responseHeaders: { etag: '"go"' } })
    const free = await mockGateway({ status: 200, body: listingBody(['beam-free', 'free-only']), responseHeaders: { etag: '"free"' } })
    const first = catalog(go.url), second = catalog(free.url, { source: 'free' })
    const fresh = await discoverSettingsModels(first, second)
    expect(fresh.models.map(model => [model.source, model.id])).toEqual([['go', 'beam-free'], ['go', 'go-only'], ['free', 'beam-free'], ['free', 'free-only']])
    expect(catalogCachePath('go')).not.toBe(catalogCachePath('free'))
    const disk = await Promise.all([readCatalogCache(catalogCachePath('go'), `${go.url}/models`), readCatalogCache(catalogCachePath('free'), `${free.url}/models`)])
    expect(disk.map(value => value?.etag)).toEqual(['"go"', '"free"'])
    go.setModelListing(503, {}); free.setModelListing(200, listingBody(['beam-free', 'new-free']))
    const degraded = await discoverSettingsModels(first, second)
    expect(degraded.sources?.go.error).toContain('HTTP 503')
    expect(degraded.sources?.free.error).toBeUndefined()
    expect(degraded.models.map(model => [model.source, model.id])).toEqual([['go', 'beam-free'], ['go', 'go-only'], ['free', 'beam-free'], ['free', 'new-free']])
    expect(go.headers.at(-1)?.['if-none-match']).toBe('"go"')
    expect(free.headers.at(-1)?.['if-none-match']).toBe('"free"')
    free.setModelListing(503, {})
    expect((await catalog(free.url, { source: 'free' }).snapshot(true)).models.has('new-free')).toBe(true)
  })
  it.each(['broken JSON', 'wrong version', 'wrong source', 'future timestamp', 'bad etag', 'invalid body', 'oversized'])('ignores corrupt caches: %s', async mode => {
    const path = catalogCachePath()
    await mkdir(dirname(path), { recursive: true })
    const saved = { version: 1, sourceURL: `${url}/models`, savedAtMs: Date.now(), body: listingBody(['poison']) }
    const content = mode === 'broken JSON' ? '{broken' : mode === 'oversized' ? ' '.repeat(MODEL_LISTING_MAX_BYTES + 5000)
      : JSON.stringify({ ...saved, ...mode === 'wrong version' ? { version: 0 } : mode === 'wrong source' ? { sourceURL: 'elsewhere' }
        : mode === 'future timestamp' ? { savedAtMs: Date.now() + 1000 } : mode === 'bad etag' ? { etag: 'x\r\nsecret' } : { body: {} } })
    await writeFile(path, content)
    const requests: Headers[] = []
    const instance = catalog(url, { fetcher: async (_input, init) => { requests.push(new Headers(init?.headers)); return Response.json(listingBody(['clean'])) } })
    expect([...(await instance.snapshot()).models.keys()]).toEqual(['clean'])
    expect(requests[0].has('if-none-match')).toBe(false)
  })
  it('keeps the last valid file when an online response is malformed', async () => {
    await catalog(url, { fetcher: async () => Response.json(listingBody(['saved'])) }).snapshot(true)
    const before = await readFile(catalogCachePath(), 'utf8')
    const result = await catalog(url, { fetcher: async () => Response.json({}) }).snapshot(true)
    expect(result.models.has('saved')).toBe(true)
    expect(await readFile(catalogCachePath(), 'utf8')).toBe(before)
  })
  it('keeps successful online discovery when persistence is unavailable', async () => {
    await mkdir(dirname(catalogCachePath()), { recursive: true })
    await mkdir(catalogCachePath())
    expect((await catalog(url, { fetcher: async () => Response.json(listingBody(['online'])) }).snapshot(true)).live).toBe(true)
  })
  it('writes complete files atomically under concurrent writers and removes temporary files', async () => {
    const snapshots = await Promise.all(Array.from({ length: 8 }, () => catalog(url, { fetcher: async () => Response.json(listingBody(['complete'])) }).snapshot(true)))
    expect(snapshots.every(snapshot => snapshot.live)).toBe(true)
    expect((await readCatalogCache(catalogCachePath(), `${url}/models`))?.body).toEqual(listingBody(['complete']))
    expect(await readdir(dirname(catalogCachePath()))).toEqual(['go.models.json'])
    expect(await writeCatalogCache(catalogCachePath(), `${url}/models`, { savedAtMs: Date.now(), body: 'x'.repeat(MODEL_LISTING_MAX_BYTES + 5000) })).toBe(false)
  })
  it.each(['"safe"', 'W/"safe"', 'bad', '"bad\r\n"', 'x'.repeat(1025)])('validates HTTP ETags %j', value => {
    expect(catalogETag(value)).toBe(['"safe"', 'W/"safe"'].includes(value) ? value : undefined)
  })
})

describe('directory transport and manager', () => {
  it.each([
    { name: 'identity', compress: (body: Buffer) => body, headers: {} },
    { name: 'gzip', compress: gzipSync, headers: { 'content-encoding': 'gzip' } },
    { name: 'deflate', compress: deflateSync, headers: { 'content-encoding': 'deflate' } },
    { name: 'brotli', compress: brotliCompressSync, headers: { 'content-encoding': 'br' } },
    { name: 'lost gzip header', compress: gzipSync, headers: {} },
  ])('reads full declarations over real HTTP with $name', async ({ compress, headers }) => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['dynamic']), responseBodyTransform: body => compress(body), responseHeaders: headers })
    const snapshot = await catalog(gateway.url).snapshot(true)
    expect(snapshot.live).toBe(true)
    expect(snapshot.models.get('dynamic')).toMatchObject({ id: 'dynamic', contextWindow: 262144, maxTokens: 131072 })
    expect(gateway.headers[0]['accept-encoding']).toBe('gzip')
  })
  it.each(['json', 'size', 'timeout', 'connection'])('retains data on a transport %s failure with useful diagnostics', async mode => {
    let failing = false
    const instance = catalog(url, { fetcher: async () => {
      if (!failing) return Response.json(listingBody(['saved']))
      if (mode === 'json') return new Response('{broken')
      if (mode === 'size') return new Response('x'.repeat(MODEL_LISTING_MAX_BYTES + 1))
      if (mode === 'timeout') throw new DOMException('timed out', 'TimeoutError')
      throw Object.assign(new Error('connection failed'), { code: 'ECONNRESET' })
    } })
    await instance.snapshot(true); failing = true
    const result = await discoverSettingsModels(instance)
    expect(result.stale).toBe(true)
    expect(result.models.map(model => model.id)).toEqual(['saved'])
    expect(result.error).toContain(mode === 'json' ? 'invalid JSON' : mode === 'size' ? 'byte limit' : mode === 'timeout' ? 'timed out' : 'ECONNRESET')
  })
  it('uses a bounded 30-second discovery deadline', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    await catalog(url, { fetcher: async () => Response.json({ data: [] }) }).snapshot(true)
    expect(timeout).toHaveBeenCalledWith(30_000)
  })
  it('refuses directory redirects, reports the diagnostic URL and does not follow them', async () => {
    const requests: (RequestInit | undefined)[] = []
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(init)
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:1/models' } })
    }) as typeof fetch
    const onFallback = vi.fn()
    const snapshot = await catalog(url, { fetcher, onFallback }).snapshot(true)
    expect(snapshot.live).toBe(false)
    expect(snapshot.failure).toMatchObject({ code: 'DISCOVERY_FAILED', message: expect.stringContaining('HTTP 302') })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(requests[0]?.redirect).toBe('error')
    expect(onFallback).toHaveBeenCalledOnce()
    expect(onFallback.mock.calls[0]?.[0]?.url).toBe(`${url}/models`)
  })
  it('never reports a credential-bearing directory URL through the fallback channel', async () => {
    const onFallback = vi.fn()
    // Base URL validation rejects embedded credentials before any request.
    expect(() => catalog('https://user:directory-secret@gateway.example/v1')).toThrow(/must not embed credentials/)
    try { catalog('https://user:directory-secret@gateway.example/v1') } catch (error) {
      expect(String(error)).not.toContain('directory-secret')
    }
    await catalog(url, { fetcher: async () => { throw Object.assign(new Error('offline'), { code: 'ECONNRESET' }) }, onFallback }).snapshot(true)
    expect(onFallback.mock.calls[0]?.[0]?.url).toBe(`${url}/models`)
    expect(onFallback.mock.calls[0]?.[0]?.url).not.toContain('@')
  })
  it('rebuilds only the changed source and ignores late refresh notifications from replaced catalogs', async () => {
    const release = Promise.withResolvers<Response>(), onRefresh = vi.fn()
    let calls = 0
    const transport = { forProxy: () => async () => ++calls === 1 ? Response.json(listingBody(['old'])) : release.promise } as unknown as ProxyTransport
    const manager = new GoCatalogManager({ transport, onRefresh })
    const config = configOf(url)
    const old = manager.forConfig(config), free = manager.forConfig(config, 'free')
    await old.snapshot()
    vi.setSystemTime(Date.now() + 60_000)
    await old.forModel('old')
    const next = manager.forConfig({ ...config, baseURL: 'https://new.example/v1' })
    expect(next).not.toBe(old)
    expect(manager.forConfig(config, 'free')).toBe(free)
    release.resolve(Response.json(listingBody(['late'])))
    await old.snapshot(true)
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

describe('settings RPC and lifecycle', () => {
  it('returns both source declarations and isolated failures through the real Host RPC codec', async () => {
    const go = await mockGateway({ status: 200, body: modelsDocument({ same: modelEntry(), bad: modelEntry({ api: {} }) }) })
    const free = await mockGateway({ status: 200, body: listingBody(['same']) })
    const ctx = context(); await mountRemotes(ctx)
    const first = catalog(go.url), second = catalog(free.url, { source: 'free' })
    await ctx.plugin(GoModelsService, { catalog: () => first, freeCatalog: () => second })
    const read = () => invokeRemote(ctx, { namespace: 'opencodeGoModels', method: 'read', args: {} })
    const result = parseGoModelCatalog(await read())
    expect(result.models.map(model => [model.source, model.id, model.configurationMissing])).toEqual([['go', 'same', undefined], ['go', 'bad', true], ['free', 'same', undefined]])
    expect(result.sources).toEqual({ go: { updatedAt: expect.any(Number) }, free: { updatedAt: expect.any(Number) } })
    free.setModelListing(503, {})
    const failed = parseGoModelCatalog(await read())
    expect(failed.models).toEqual(result.models)
    expect(failed.sources?.free.error).toContain('HTTP 503')
    expect(failed.sources?.go.error).toBeUndefined()
  })
  it('validates source status timestamps and modality/reasoning fields in the wire contract', () => {
    const value = { models: [{ id: 'same', source: 'free', inputModalities: ['application/pdf', 'image/png', 'text'], reasoningBudget: { min: 1024, max: 8192 } }], stale: false,
      sources: { go: { updatedAt: Date.now(), warning: 'partial' }, free: { error: 'offline' } } }
    expect(parseGoModelCatalog(value)).toMatchObject({ models: [{ source: 'free', inputModalities: ['text', 'image', 'pdf'], reasoningBudget: { min: 1024, max: 8192 } }], sources: value.sources })
    for (const updatedAt of [-1, NaN, Infinity, 1.5, '1', 8_640_000_000_000_001]) expect(() => parseGoModelCatalog({ ...value, sources: { go: { updatedAt }, free: {} } })).toThrow(/timestamp/)
    expect(() => parseGoModelCatalog({ ...value, models: [{ id: 'same', source: 'other' }] })).toThrow(/source/)
    expect(() => parseGoModelCatalog({ ...value, sources: { go: { warning: 3 }, free: {} } })).toThrow(/warning/)
  })
  it('keeps original Go keys and separate Free keys for picker visibility and capacities', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const config = configOf(gateway.url, { freeBaseURL: gateway.url,
      modelVisibility: { 'beam-free': false, 'dsh-opencode-free/beam-free': true },
      modelLimits: { 'beam-free': { contextWindow: 10000 }, 'dsh-opencode-free/beam-free': { contextWindow: 20000 } } })
    const go = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'key' })
    const free = new OpencodeGoAdapter({ source: 'free', config: () => config, resolveApiKey: async () => undefined })
    expect(await go.listModels('dsh-opencode-go')).toEqual([])
    expect(await free.listModels('dsh-opencode-free')).toEqual([{ provider: 'dsh-opencode-free', id: 'beam-free', name: 'beam-free', inputModalities: ['text', 'image'] }])
    expect((await go.resolveModel('dsh-opencode-go', 'beam-free')).context?.contextWindow).toBe(10000)
    expect((await free.resolveModel('dsh-opencode-free', 'beam-free')).context?.contextWindow).toBe(20000)
    expect(modelSettingsKey({ id: 'beam-free', source: 'go' })).toBe('beam-free')
    expect(modelSettingsKey({ id: 'beam-free', source: 'free' })).toBe('dsh-opencode-free/beam-free')
    gateway.pushCompletions({ events: textEvents })
    expect((await Array.fromAsync(free.stream({ provider: 'dsh-opencode-free', model: 'beam-free', messages: [] }))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer public')
  })
  it('keeps unconfigured rows in settings/discovery and out of the Host picker until repaired', async () => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ bad: modelEntry({ api: {} }), valid: modelEntry() }) })
    const config = configOf(gateway.url), adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'key' })
    const ctx = context(); await ctx.plugin(LlmRuntime); ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
    expect((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['valid'])
    expect((await discoverSettingsModels(adapter.catalogOf(config))).models).toContainEqual(expect.objectContaining({ id: 'bad', configurationMissing: true }))
    expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({ id: 'bad' }))
    await expect(ctx.llm.resolveModelInfo('dsh-opencode-go', 'bad')).rejects.toMatchObject({ code: 'MODEL_METADATA_UNAVAILABLE' })
    gateway.setModelListing(200, listingBody(['bad', 'valid']))
    expect((await adapter.resolveModel('dsh-opencode-go', 'bad')).id).toBe('bad')
  })
  it('uses own boolean overrides and lifecycle defaults without confusing the two routes', () => {
    expect(isModelEnabled({ id: 'a', deprecated: true })).toBe(false)
    expect(isModelEnabled({ id: 'a', deprecated: true }, { a: true })).toBe(true)
    expect(isModelEnabled({ id: 'a' }, Object.create({ a: false }))).toBe(true)
    expect(isModelEnabled({ id: 'a', configurationMissing: true }, { a: true })).toBe(false)
    expect(isModelEnabled({ id: 'a', source: 'free' }, { a: false })).toBe(true)
    expect(() => PlainConfig({ modelVisibility: { a: 'false' } })).toThrow()
  })
  it('uses real UTC calendar dates for the seven-day badge and sorts deprecated models last', () => {
    const now = Date.parse('2026-11-02T23:59:59Z')
    expect(isNewModel({ id: 'a', releaseDate: '2026-10-27' }, now)).toBe(true)
    expect(isNewModel({ id: 'a', releaseDate: '2026-10-26' }, now)).toBe(false)
    expect(isNewModel({ id: 'a', releaseDate: '2026-11-03' }, now)).toBe(false)
    expect(isNewModel({ id: 'a', releaseDate: '2026-02-30' }, now)).toBe(false)
    expect(sortModels([{ id: 'old' }, { id: 'retired', deprecated: true }, { id: 'new', releaseDate: '2026-11-02' }], now).map(model => model.id)).toEqual(['new', 'old', 'retired'])
  })
  it.each(['ftp://gateway.example', 'invalid', 'https://gateway.example/v1?key=1', 'https://gateway.example/v1#x'])('validates freeBaseURL at configuration time: %s', freeBaseURL => {
    expect(() => validateGoConfig(PlainConfig({ freeBaseURL }))).toThrow(/freeBaseURL/)
  })
  it('defaults the two gateway URLs independently', () => {
    expect(PlainConfig({})).toMatchObject({ baseURL: DEFAULT_BASE_URL, freeBaseURL: DEFAULT_FREE_BASE_URL })
  })
})
