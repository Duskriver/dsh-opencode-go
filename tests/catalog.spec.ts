import { afterEach, expect, it, vi, beforeEach, describe } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import {
  GoModelsService,
  discoverSettingsModels,
  OpencodeGoCatalog,
  discoverCatalogModels,
  readLiveModelIds,
  readModelMetadata,
} from '../src/catalog.ts'
import { PlainConfig } from '../src/config.ts'
import { isModelEnabled, isNewModel, sortModels, type GoModelCatalog, parseGoModelCatalog } from '../src/contracts.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents, fullLiveListing } from './support/gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/data.ts'
import { configOf, mountRemotes, invokeRemote } from './support/host.ts'
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { getBuiltinModels } from 'opencode-go-pi-ai/providers/all'
import { getSupportedThinkingLevels } from 'opencode-go-pi-ai'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'

describe("catalog freshness", () => {
  const metadataOnlyId = 'compressed-metadata-only-model'

  const metadataOnlyDocument = () => metadataDocument({
    [metadataOnlyId]: modelMetadata({ name: 'Compressed metadata model', limit: { context: 12345, output: 6789 } }),
  })

  function routeMetadataTo(gatewayURL: string): void {
    const networkFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      return networkFetch(url === MODELS_METADATA_URL ? `${gatewayURL}/models` : input, init)
    })
  }

  const responseFormats = [
    { name: 'plain JSON', responseBodyTransform: undefined, responseHeaders: undefined },
    ...[
      { encoding: 'br', compress: brotliCompressSync },
      { encoding: 'gzip', compress: gzipSync },
      { encoding: 'deflate', compress: deflateSync },
    ].map(({ encoding, compress }) => ({
      name: `${encoding} decoded by fetch`,
      responseBodyTransform: (body: Buffer) => compress(body),
      responseHeaders: { 'content-encoding': encoding },
    })),
  ]

  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await closeMockGateways()
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
  })

  describe('readLiveModelIds', () => {
    it('reports bounded row positions without copying malformed content', () => {
      const warning = vi.fn()
      expect(readLiveModelIds({ data: [{ id: 'a' }, ...Array(12).fill({ secret: 'private-row' })] }, warning)).toEqual(['a'])
      expect(warning.mock.calls[0]?.[0]).toContain('12 of 13')
      expect(warning.mock.calls[0]?.[0]).toContain('rows 2, 3, 4, 5, 6, 7, 8, 9, …')
      expect(warning.mock.calls[0]?.[0]).not.toContain('private-row')
    })
    it('reads ids from the standard data array and skips rows without one', () => {
      expect(readLiveModelIds({ data: [{ id: 'a' }, { id: '' }, { id: 7 }, null, { id: 'b' }] }))
        .toEqual(['a', 'b'])
    })

    it('accepts an honest empty list and refuses anything else', () => {
      expect(readLiveModelIds({ data: [] })).toEqual([])
      expect(() => readLiveModelIds({})).toThrow(/no "data" array/)
      expect(() => readLiveModelIds({ data: {} })).toThrow(/no "data" array/)
    })
  })

  it('exposes mixed-listing warnings and clears them on a clean refresh', async () => {
    const gateway = await mockGateway({ status: 200, body: { data: [{ id: 'deepseek-v4.1-flash' }, null] } })
    const warning = vi.fn()
    const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}, () => {}, undefined, warning)
    const result = await discoverSettingsModels(catalog)
    expect(result).toMatchObject({ stale: false, sources: { listing: { warning: expect.stringContaining('1 of 2') } } })
    expect(warning).toHaveBeenCalledTimes(1)
    gateway.setModelListing(200, listingBody(['deepseek-v4.1-flash']))
    expect((await discoverSettingsModels(catalog)).sources?.listing.warning).toBeUndefined()
  })

  describe('OpencodeGoCatalog', () => {
    it('serves known models while one background refresh runs, but waits for manual and unknown lookups', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      const first = await catalog.snapshot()
      vi.setSystemTime(Date.now() + 60_000)
      const original = globalThis.fetch
      const metadata = Promise.withResolvers<Response>()
      const reads = vi.fn((input: string | URL | Request, init?: RequestInit) =>
        String(input) === MODELS_METADATA_URL ? metadata.promise : original(input, init))
      vi.stubGlobal('fetch', reads)
      gateway.setModelListing(200, listingBody(['kimi-k3']))
      const known = catalog.forModel('union-alpha')
      const manual = catalog.snapshot(true)
      const unknown = catalog.forModel('kimi-k3')
      const completed = vi.fn()
      void manual.then(completed)
      void unknown.then(completed)
      try {
        const beforeRefresh = await Promise.race([known, new Promise<null>(resolve => setTimeout(() => resolve(null), 100))])
        expect(beforeRefresh).toBe(first)
        expect(await catalog.forModel('union-alpha')).toBe(first)
        expect(completed).not.toHaveBeenCalled()
        expect(reads.mock.calls.filter(([url]) => String(url) === MODELS_METADATA_URL)).toHaveLength(1)
      } finally {
        metadata.resolve(Response.json(metadataDocument()))
        await Promise.all([known, manual, unknown])
      }
      expect((await catalog.forModel('union-alpha')).models.has('union-alpha')).toBe(false)
      expect((await unknown).models.has('kimi-k3')).toBe(true)
    })

    it('waits again once the successful catalog is five minutes past its TTL, even after failures', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      await catalog.snapshot()
      const success = Date.now()
      gateway.setModelListing(503, {})
      vi.setSystemTime(success + 359_999)
      await catalog.snapshot(true)
      vi.setSystemTime(success + 365_000)
      const original = globalThis.fetch
      const metadata = Promise.withResolvers<Response>()
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
        String(input) === MODELS_METADATA_URL ? metadata.promise : original(input, init))
      const completed = vi.fn()
      const pending = catalog.forModel('union-alpha').then(completed)
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(completed).not.toHaveBeenCalled()
      metadata.resolve(Response.json(metadataDocument()))
      await pending
      expect(completed).toHaveBeenCalledOnce()
    })

    it('uses independent listing and metadata deadlines', async () => {
      const timeout = vi.spyOn(AbortSignal, 'timeout')
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      await new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}).snapshot()
      expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([10_000, 30_000])
    })

    it('retries failed listings with bounded backoff instead of caching an empty picker for an hour', async () => {
      const gateway = await mockGateway({ status: 503, body: {} })
      const catalog = new OpencodeGoCatalog(gateway.url, 3_600_000, () => {}, () => {})
      const start = Date.now()
      expect((await catalog.snapshot()).models.size).toBe(0)
      vi.setSystemTime(start + 4_999)
      await catalog.snapshot()
      expect(gateway.modelListings).toBe(1)
      vi.setSystemTime(start + 5_000)
      await catalog.snapshot()
      expect(gateway.modelListings).toBe(2)
      gateway.setModelListing(200, listingBody(['union-alpha']))
      vi.setSystemTime(start + 14_999)
      expect((await catalog.snapshot()).models.size).toBe(0)
      vi.setSystemTime(start + 15_000)
      expect((await catalog.snapshot()).models.has('union-alpha')).toBe(true)
      expect(gateway.modelListings).toBe(3)
      // A recovery restores the normal successful cache lifetime.
      vi.setSystemTime(start + 75_000)
      await catalog.snapshot()
      expect(gateway.modelListings).toBe(3)
    })

    it('allows manual refresh during backoff and resets the delay after recovery', async () => {
      const gateway = await mockGateway({ status: 503, body: {} })
      const catalog = new OpencodeGoCatalog(gateway.url, 3_600_000, () => {}, () => {})
      await catalog.snapshot()
      gateway.setModelListing(200, listingBody(['union-alpha']))
      expect((await catalog.snapshot(true)).live).toBe(true)
      gateway.setModelListing(503, {})
      const failed = await catalog.snapshot(true)
      expect(failed.models.has('union-alpha')).toBe(true)
      gateway.setModelListing(200, listingBody(['kimi-k3']))
      vi.setSystemTime(Date.now() + 5_000)
      expect([...(await catalog.snapshot()).models.keys()]).toEqual(['kimi-k3'])
    })

    it('caps repeated failed refresh backoff at one minute', async () => {
      const gateway = await mockGateway({ status: 503, body: {} })
      const catalog = new OpencodeGoCatalog(gateway.url, 3_600_000, () => {}, () => {})
      await catalog.snapshot()
      for (const delay of [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]) {
        const calls = gateway.modelListings
        vi.setSystemTime(Date.now() + delay - 1)
        await catalog.snapshot()
        expect(gateway.modelListings).toBe(calls)
        vi.setSystemTime(Date.now() + 1)
        await catalog.snapshot()
        expect(gateway.modelListings).toBe(calls + 1)
      }
    })

    it('keeps listing identity and recovers metadata gzip when the host loses encoding headers', async () => {
      // Reproduce bytes delivered after the host loses the encoding header.
      const responseBodyTransform = (body: Buffer, request: import('node:http').IncomingMessage) =>
        request.headers['accept-encoding'] === 'gzip' ? gzipSync(body) : body
      const gateway = await mockGateway({ status: 200, body: listingBody([metadataOnlyId]), responseBodyTransform })
      const metadataGateway = await mockGateway({ status: 200, body: metadataOnlyDocument(), responseBodyTransform })
      routeMetadataTo(metadataGateway.url)
      const snapshot = await new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}).snapshot()
      expect(snapshot.live).toBe(true)
      expect(snapshot.models.has(metadataOnlyId)).toBe(true)
      expect(gateway.headers[0]['accept-encoding']).toBe('identity')
      expect(metadataGateway.headers[0]['accept-encoding']).toBe('gzip')
    })

    it.each(responseFormats)('reads $name from both discovery endpoints over HTTP', async ({ name: _name, ...format }) => {
      const gateway = await mockGateway({ status: 200, body: listingBody([metadataOnlyId]), ...format })
      const metadataGateway = await mockGateway({ status: 200, body: metadataOnlyDocument(), ...format })
      routeMetadataTo(metadataGateway.url)
      const fallback = vi.fn()
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, fallback, () => {})

      const snapshot = await catalog.snapshot()

      expect(snapshot.live).toBe(true)
      expect(snapshot.models.get(metadataOnlyId)).toMatchObject({
        name: 'Compressed metadata model', contextWindow: 12345, maxTokens: 6789,
      })
      expect(snapshot.unavailable.size).toBe(0)
      expect(fallback).not.toHaveBeenCalled()
      expect(gateway.modelListings).toBe(1)
      expect(metadataGateway.modelListings).toBe(1)
    })

    it.each(['listing', 'metadata'])('reports a corrupt %s response without configuring an unknown model', async (source) => {
      const corrupt = { responseBodyTransform: (body: Buffer) => gzipSync(body).subarray(0, 8) }
      const gateway = await mockGateway({
        status: 200, body: listingBody([metadataOnlyId]), ...(source === 'listing' ? corrupt : {}),
      })
      const metadataGateway = await mockGateway({
        status: 200, body: metadataOnlyDocument(), ...(source === 'metadata' ? corrupt : {}),
      })
      routeMetadataTo(metadataGateway.url)
      const fallback = vi.fn()
      const snapshot = await new OpencodeGoCatalog(gateway.url, 60_000, fallback, () => {}).snapshot()

      expect(snapshot.live).toBe(source !== 'listing')
      expect(snapshot.models.size).toBe(0)
      expect(snapshot.unavailable.has(metadataOnlyId)).toBe(source === 'metadata')
      expect(fallback).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
        url: source === 'listing' ? `${gateway.url}/models` : MODELS_METADATA_URL,
        error: expect.any(Error),
      }))
    })

    it.each([
      { source: 'listing', maxBytes: 1024 * 1024 },
      { source: 'metadata', maxBytes: 16 * 1024 * 1024 },
    ].flatMap(limit => [false, true].map(compressed => ({ ...limit, compressed }))))(
      'enforces the $source byte limit over HTTP, compressed=$compressed',
      async ({ source, maxBytes, compressed }) => {
        const oversized = source === 'listing'
          ? { data: [{ id: metadataOnlyId }], padding: '' }
          : { ...metadataOnlyDocument(), padding: '' }
        oversized.padding = 'x'.repeat(maxBytes + 1 - Buffer.byteLength(JSON.stringify(oversized)))
        expect(Buffer.byteLength(JSON.stringify(oversized))).toBe(maxBytes + 1)
        const format = {
          responseBodyTransform: compressed ? (body: Buffer) => gzipSync(body) : undefined,
          responseHeaders: compressed ? { 'content-encoding': 'gzip' } : undefined,
        }
        const gateway = await mockGateway({
          status: 200, body: source === 'listing' ? oversized : listingBody([metadataOnlyId]), ...format,
        })
        const metadataGateway = await mockGateway({
          status: 200, body: source === 'metadata' ? oversized : metadataOnlyDocument(), ...format,
        })
        routeMetadataTo(metadataGateway.url)
        const fallback = vi.fn()

        const snapshot = await new OpencodeGoCatalog(gateway.url, 60_000, fallback, () => {}).snapshot()

        expect(snapshot.live).toBe(source !== 'listing')
        expect(snapshot.models.size).toBe(0)
        expect(snapshot.unavailable.has(metadataOnlyId)).toBe(source === 'metadata')
        expect(fallback).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
          url: source === 'listing' ? `${gateway.url}/models` : MODELS_METADATA_URL,
          error: source === 'listing' ? expect.objectContaining({ cause: expect.any(RangeError) }) : expect.any(RangeError),
        }))
        expect(fallback.mock.calls[0][0].error.message).toContain(`${maxBytes} byte limit`)
      },
    )

    it('keeps the last usable snapshot when discovery responses become corrupt', async () => {
      let corrupt = false
      const responseBodyTransform = (body: Buffer): Buffer => corrupt
        ? Buffer.from('{ invalid JSON') : body
      const gateway = await mockGateway({ status: 200, body: listingBody([metadataOnlyId]), responseBodyTransform })
      const metadataGateway = await mockGateway({ status: 200, body: metadataOnlyDocument(), responseBodyTransform })
      routeMetadataTo(metadataGateway.url)
      const fallback = vi.fn()
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, fallback, () => {})
      const first = await catalog.snapshot()
      expect(first.models.has(metadataOnlyId)).toBe(true)

      corrupt = true
      const stale = await catalog.snapshot(true)

      expect(stale.live).toBe(false)
      expect(stale.models).toEqual(first.models)
      expect(stale.details).toEqual(first.details)
      expect(fallback).toHaveBeenCalledTimes(2)
      expect(fallback.mock.calls.map(([detail]) => detail.url)).toEqual(expect.arrayContaining([
        MODELS_METADATA_URL, `${gateway.url}/models`,
      ]))
    })

    it('serves the curated table intersected with the live listing', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4-flash', 'deepseek-v4.1-flash', 'brand-new-model']) })
      const omitted: string[][] = []
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, ids => omitted.push([...ids]))

      const snapshot = await catalog.snapshot()

      expect(snapshot.live).toBe(true)
      // The gateway-only id cannot be routed (no protocol mapping) and is omitted.
      expect(omitted).toEqual([['brand-new-model']])
      expect(snapshot.models.has('deepseek-v4-flash')).toBe(true)
      expect(snapshot.models.has('deepseek-v4.1-flash')).toBe(true)
      // Every curated model absent from the live listing is pruned as retired.
      expect(snapshot.models.has('kimi-k3')).toBe(false)
      expect(gateway.modelListings).toBe(1)
    })

    it('uses online capacities and modalities while preserving established family wire compatibility', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      const snapshot = await catalog.snapshot()
      const addition = snapshot.models.get('deepseek-v4.1-flash')
      const shipped = getBuiltinModels('opencode-go') as { id: string; api: string; contextWindow: number; maxTokens: number; input: readonly string[] }[]
      const sibling = shipped.find(model => model.id === 'deepseek-v4-flash')
      const visionSibling = shipped.find(model => model.id === 'deepseek-v4-flash-vision-exp')
      if (addition === undefined || sibling === undefined || visionSibling === undefined) throw new Error('expected the sibling trio')
      expect(addition.api).toBe(sibling.api)
      expect(addition.baseUrl).toBe(gateway.url)
      expect(addition.contextWindow).toBe(262144)
      expect(addition.maxTokens).toBe(131072)
      expect([...addition.input]).toEqual([...visionSibling.input])
      expect(addition.input).toContain('image')
      expect(addition.name).toBe('DeepSeek V4.1 Flash')
    })

    it('does not advertise unverified models when the initial listing is unreachable', async () => {
      const gateway = await mockGateway({ status: 503, body: {} })
      const fallbacks: unknown[] = []
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, detail => fallbacks.push(detail.error), () => {})

      const snapshot = await catalog.snapshot()

      expect(snapshot.live).toBe(false)
      expect(snapshot.models.size).toBe(0)
      expect(fallbacks).toHaveLength(1)
    })

    it('treats a malformed listing as unreachable', async () => {
      const gateway = await mockGateway({ status: 200, body: { unexpected: true } })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})

      const snapshot = await catalog.snapshot()

      expect(snapshot.live).toBe(false)
      expect(snapshot.models.size).toBe(0)
    })

    it('keeps an empty catalog before any successful gateway response', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      vi.stubGlobal('fetch', vi.fn(async () => {
        throw new Error('network down')
      }))
      const fallbacks: unknown[] = []
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, detail => fallbacks.push(detail.error), () => {})

      const snapshot = await catalog.snapshot()

      expect(snapshot.live).toBe(false)
      expect(snapshot.models.size).toBe(0)
      expect(fallbacks).toHaveLength(2)
    })

    it('caches one resolution for the refresh interval, then refetches', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})

      await catalog.snapshot()
      await catalog.snapshot()
      expect(gateway.modelListings).toBe(1)

      vi.setSystemTime(1_000_000 + 60_000)
      gateway.setModelListing(200, listingBody(['kimi-k3']))
      const refreshed = await catalog.snapshot()
      expect(gateway.modelListings).toBe(2)
      expect(refreshed.models.has('deepseek-v4-flash')).toBe(false)
      expect(refreshed.models.has('kimi-k3')).toBe(true)
    })

    it('shares one in-flight fetch between concurrent snapshots', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})

      const [first, second] = await Promise.all([catalog.snapshot(), catalog.snapshot()])

      expect(first).toBe(second)
      expect(gateway.modelListings).toBe(1)
    })
  })

  describe('discoverCatalogModels', () => {
    it('reports metadata refresh failures separately and retries them before the successful listing TTL', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      const catalog = new OpencodeGoCatalog(gateway.url, 3_600_000, () => {}, () => {})
      const first = await discoverSettingsModels(catalog)
      const initialTime = Date.now()
      const original = globalThis.fetch
      vi.setSystemTime(initialTime + 1_000)
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
        ? Promise.resolve(new Response(null, { status: 503 })) : original(input, init))
      const stale = await discoverSettingsModels(catalog)
      expect(stale.models).toEqual(first.models)
      expect(stale.stale).toBe(true)
      expect(stale.error).toContain('models.dev')
      expect(stale.sources).toEqual({
        listing: { updatedAt: initialTime + 1_000 },
        metadata: { updatedAt: initialTime, error: expect.stringContaining('HTTP 503') },
      })
      vi.stubGlobal('fetch', original)
      vi.setSystemTime(initialTime + 6_000)
      const recovered = await catalog.snapshot()
      expect(recovered.metadataFailure).toBeUndefined()
      expect(gateway.modelListings).toBe(3)
      expect(await discoverSettingsModels(catalog)).toMatchObject({
        stale: false, sources: { listing: { updatedAt: Date.now() }, metadata: { updatedAt: Date.now() } },
      })
    })

    it('keeps settings and runtime on the last successful models after a listing timeout', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      const first = await discoverSettingsModels(catalog)
      const original = globalThis.fetch
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === `${gateway.url}/models`
        ? Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
        : original(input, init))

      const stale = await discoverSettingsModels(catalog)
      expect(stale.models).toEqual(first.models)
      expect(stale.stale).toBe(true)
      expect(stale.error).toContain(`${gateway.url}/models: request timed out or was aborted`)
      expect([...(await catalog.snapshot()).models.keys()]).toEqual(first.models.map(model => model.id))

      vi.stubGlobal('fetch', original)
      gateway.setModelListing(200, listingBody(['kimi-k3']))
      const recovered = await discoverSettingsModels(catalog)
      expect(recovered.stale).toBe(false)
      expect(recovered.error).toBeUndefined()
      expect(recovered.models.map(model => model.id)).toEqual(['kimi-k3'])
    })

    it('answers the live intersection with curated capacities', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})

      const models = await discoverCatalogModels(catalog)

      const flash = models.find(model => model.id === 'deepseek-v4.1-flash')
      expect(flash?.name).toBe('DeepSeek V4.1 Flash')
      expect(flash?.contextWindow).toBeGreaterThan(0)
      expect(flash?.maxTokens).toBeGreaterThan(0)
    })

    it('fails loud when the live answer is unavailable', async () => {
      const gateway = await mockGateway({ status: 503, body: {} })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})

      await expect(discoverCatalogModels(catalog)).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' })
    })

    it('preserves the endpoint and HTTP failure in discovery and the settings catalog', async () => {
      const gateway = await mockGateway({ status: 503, body: { error: 'private upstream response' } })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      const failure = await discoverCatalogModels(catalog).catch(error => error)
      expect(failure).toMatchObject({ code: 'DISCOVERY_FAILED', cause: expect.any(Error) })
      expect(failure.message).toContain(`${gateway.url}/models`)
      expect(failure.message).toContain('HTTP 503')
      expect(failure.message).not.toContain('private upstream response')
      expect(await discoverSettingsModels(catalog)).toEqual({ models: [], stale: true, error: failure.message,
        sources: { listing: { error: failure.message }, metadata: { updatedAt: Date.now() } },
      })
    })

    it.each([
      { body: '{"private-token": broken}', message: /invalid JSON/i },
      { body: '{}', message: /data.*array/i },
    ])('distinguishes invalid JSON from invalid listing structure: $body', async ({ body, message }) => {
      const gateway = await mockGateway({ status: 200, body: {}, responseBodyTransform: () => Buffer.from(body) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      const failed = await discoverSettingsModels(catalog)
      expect(failed).toMatchObject({ models: [], stale: true })
      expect(failed.error).toContain(`${gateway.url}/models`)
      expect(failed.error).toMatch(message)
      expect(failed.error).not.toContain('private-token')
    })

    it('reports a connection error code and clears it after recovery', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const original = globalThis.fetch
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === `${gateway.url}/models`
        ? Promise.reject(new TypeError('fetch failed', { cause: Object.assign(new Error('private transport detail'), { code: 'ECONNREFUSED' }) }))
        : original(input, init))
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      const failed = await discoverSettingsModels(catalog)
      expect(failed.error).toContain('ECONNREFUSED')
      expect(failed.error).toContain(`${gateway.url}/models`)
      expect(failed.error).not.toContain('private transport detail')
      vi.stubGlobal('fetch', original)
      await expect(discoverSettingsModels(catalog)).resolves.toEqual({
        models: expect.arrayContaining([expect.objectContaining({ id: 'deepseek-v4.1-flash' })]), stale: false,
        sources: { listing: { updatedAt: Date.now() }, metadata: { updatedAt: Date.now() } },
      })
    })

    it('does not resurrect models after a verified empty listing becomes unreachable', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
      expect((await discoverSettingsModels(catalog)).models).toHaveLength(1)
      gateway.setModelListing(200, listingBody([]))
      expect(await discoverSettingsModels(catalog)).toMatchObject({ models: [], stale: false })
      gateway.setModelListing(503, {})
      expect(await discoverSettingsModels(catalog)).toMatchObject({ models: [], stale: true, error: expect.stringContaining('HTTP 503') })
    })

    it('recovers a transient connection reset before committing a failed gateway refresh', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      const original = globalThis.fetch
      let listingReads = 0
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
        if (String(input) === `${gateway.url}/models` && ++listingReads === 1) {
          return Promise.reject(new TypeError('fetch failed', {
            cause: Object.assign(new Error('private transport detail'), { code: 'ECONNRESET' }),
          }))
        }
        return original(input, init)
      })
      const fallback = vi.fn()
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, fallback, () => {})
      expect(await discoverSettingsModels(catalog)).toMatchObject({
        models: [expect.objectContaining({ id: 'union-alpha' })], stale: false,
      })
      expect(listingReads).toBe(2)
      expect(fallback).not.toHaveBeenCalledWith(expect.objectContaining({ url: `${gateway.url}/models` }))
    })
  })

  it('retains a served catalog when a nonempty listing contains no valid ids', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
    const good = await catalog.snapshot()
    expect(good.models.has('deepseek-v4.1-flash')).toBe(true)
    gateway.setModelListing(200, { data: [{ name: 'schema drift' }, { id: '   ' }, null] })
    const stale = await catalog.snapshot(true)
    expect(stale.live).toBe(false)
    expect([...stale.models.keys()]).toEqual([...good.models.keys()])
    expect((await discoverSettingsModels(catalog)).error).toMatch(/no valid model ids/)
    gateway.setModelListing(200, { data: [] })
    expect((await catalog.snapshot(true)).models.size).toBe(0)
  })

  it('distinguishes an unverifiable cold catalog from a confirmed unknown model', async () => {
    const gateway = await mockGateway({ status: 503, body: {} })
    const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})
    await expect(catalog.forModel('deepseek-v4.1-flash')).rejects.toMatchObject({ code: 'DISCOVERY_FAILED' })
    gateway.setModelListing(200, { data: [] })
    await catalog.snapshot(true)
    expect((await catalog.forModel('deepseek-v4.1-flash')).models.has('deepseek-v4.1-flash')).toBe(false)
  })
})

describe("online metadata", () => {
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
      ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
      try {
        const models = await ctx.llm.listModels('dsh-opencode-go')
        const resolved = await Promise.all(models.map(model => ctx.llm.resolveModelInfo('dsh-opencode-go', model.id)))
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
      ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
      try {
        // The browser eagerly resolves every listed model; a single rejection hides the provider.
        const models = await ctx.llm.listModels('dsh-opencode-go')
        const resolved = await Promise.all(models.map(model => ctx.llm.resolveModelInfo('dsh-opencode-go', model.id)))
        expect(resolved.map(model => model.id)).toEqual(['ready'])
        expect(resolved[0]?.reasoning?.efforts.map(effort => effort.id)).toEqual(['low', 'high'])
        expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({
          id: 'not-ready', name: expect.stringContaining('metadata unavailable'),
        }))
        await expect(ctx.llm.resolveModelInfo('dsh-opencode-go', 'not-ready')).rejects.toMatchObject({ code: 'MODEL_METADATA_UNAVAILABLE' })
      } finally {
        await ctx.fiber.dispose()
      }
    })

    it.each([
      { values: ['low'] },
      { values: ['low', 'medium'] },
      { values: ['low', 'max'] },
      { values: ['low', 'high', 'max'] },
    ])('preserves the service default when the model offers $values', async ({ values }) => {
      metadataReplies(() => Response.json(metadataDocument({
        'deepseek-v4-flash': modelMetadata({
          name: 'DeepSeek V4 Flash',
          family: 'deepseek-flash',
          modalities: { input: ['text'] },
        }),
        'fallback-model': modelMetadata({
          name: 'Fallback model',
          family: 'deepseek-flash',
          reasoning_options: [{ type: 'effort', values }],
        }),
      })))
      const gateway = await mockGateway({ status: 200, body: listingBody(['fallback-model']) })
      gateway.pushCompletions({ events: textEvents })
      const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
      try {
        const resolved = await ctx.llm.resolveModelInfo('dsh-opencode-go', 'fallback-model')
        expect(resolved.reasoning?.efforts.map(effort => effort.id)).toEqual(['off', ...values])
        expect(resolved.reasoning).not.toHaveProperty('defaultEffort')
        for await (const _chunk of ctx.llm.stream({
          provider: 'dsh-opencode-go', model: 'fallback-model',
          messages: [createUserMessage({
            content: [{ type: 'text', text: 'hi' }], source: { kind: 'plugin', plugin: 'test' },
          })],
        })) { /* Validate the request after DSH resolves its default effort. */ }
        expect(gateway.bodies[0]).not.toHaveProperty('thinking')
        expect(gateway.bodies[0]).not.toHaveProperty('reasoning_effort')
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

    it('reuses the picker catalog during its TTL and reads new and empty catalogs after explicit settings refreshes', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['kimi-k3']) })
      const config = configOf(gateway.url)
      const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['kimi-k3'])
      gateway.setModelListing(200, listingBody(['union-alpha']))
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['kimi-k3'])
      expect(gateway.modelListings).toBe(1)

      expect((await discoverSettingsModels(adapter.catalogOf(config))).models.map(model => model.id)).toEqual(['union-alpha'])
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['union-alpha'])
      expect(gateway.modelListings).toBe(2)
      gateway.setModelListing(200, listingBody([]))
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['union-alpha'])
      expect(await discoverSettingsModels(adapter.catalogOf(config))).toMatchObject({ models: [], stale: false })
      expect(await adapter.listModels('dsh-opencode-go')).toEqual([])
      expect(gateway.modelListings).toBe(3)
    })

    it('revalidates the picker catalog when the configured refresh interval expires', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['kimi-k3']) })
      const config = configOf(gateway.url, { refreshMinutes: 1 })
      const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['kimi-k3'])
      const first = await adapter.catalogOf(config).snapshot()
      gateway.setModelListing(200, listingBody(['union-alpha']))
      const now = vi.spyOn(Date, 'now')
      try {
        now.mockReturnValue(first.fetchedAtMs + 59_999)
        expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['kimi-k3'])
        expect(gateway.modelListings).toBe(1)
        now.mockReturnValue(first.fetchedAtMs + 60_000)
        expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['union-alpha'])
        expect(gateway.modelListings).toBe(2)
      } finally {
        now.mockRestore()
      }
    })

    it('discovers a directly requested unknown model immediately despite a fresh picker cache', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
      const config = configOf(gateway.url)
      const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['union-alpha'])
      metadataReplies(() => Response.json(metadataDocument({ 'future-model': modelMetadata() })))
      gateway.setModelListing(200, listingBody(['future-model']))

      await expect(adapter.resolveModel('dsh-opencode-go', 'future-model')).resolves.toMatchObject({ id: 'future-model' })
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['future-model'])
      expect(gateway.modelListings).toBe(2)
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

    it('keeps the declared input modalities in display order and drops tokens the page cannot name', () => {
      const result = readModelMetadata(metadataDocument({
        omni: modelMetadata({ modalities: { input: ['video', 'text', 'file', 'audio'], output: ['text'] } }),
        image: modelMetadata({ modalities: { input: ['text', 'image'], output: ['text'] } }),
      }), 'https://gateway.example/v1', new Map())
      expect(result.details.get('omni')?.inputModalities).toEqual(['text', 'audio', 'video'])
      expect(result.details.get('image')?.inputModalities).toEqual(['text', 'image'])
      // The display list is informational: the adapter still forwards images only.
      expect(result.models.get('omni')?.input).toEqual(['text'])
      expect(result.models.get('image')?.input).toEqual(['text', 'image'])
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
      { npm: '@ai-sdk/anthropic', events: anthropicEvents, namedEvents: true },
      { npm: '@ai-sdk/openai-compatible', events: textEvents, namedEvents: false },
      { npm: '@ai-sdk/openai', events: responseEvents, namedEvents: false },
    ])('separates service Default from explicit Off and Low for $npm', async ({ npm, events, namedEvents }) => {
      const modelId = 'default-policy'
      metadataReplies(() => Response.json(metadataDocument({ [modelId]: modelMetadata({ provider: { npm },
        reasoning_options: [{ type: 'effort', values: ['none', 'low'] }],
      }) })))
      const gateway = await mockGateway({ status: 200, body: listingBody([modelId]) })
      const adapter = new OpencodeGoAdapter({ config: () => configOf(`${gateway.url}/v1`), resolveApiKey: async () => 'test-key' })
      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
      try {
        const info = await ctx.llm.resolveModelInfo('dsh-opencode-go', modelId)
        expect(info.reasoning).not.toHaveProperty('defaultEffort')
        for (const effort of [undefined, 'off', 'low']) {
          gateway.pushCompletions({ events, namedEvents })
          const chunks = []
          for await (const chunk of ctx.llm.stream({ provider: 'dsh-opencode-go', model: modelId,
            ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
            messages: [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'plugin', plugin: 'test' } })],
          })) chunks.push(chunk)
          expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
          const body = gateway.bodies.at(-1)
          if (effort === undefined) {
            for (const key of ['thinking', 'reasoning', 'reasoning_effort', 'output_config']) expect(body).not.toHaveProperty(key)
          } else if (npm === '@ai-sdk/anthropic') {
            expect(body).toMatchObject({ thinking: { type: effort === 'off' ? 'disabled' : 'enabled' } })
          } else if (npm === '@ai-sdk/openai') {
            expect(body).toMatchObject({ reasoning: { effort: effort === 'off' ? 'none' : effort } })
          } else {
            expect(body).toMatchObject({ reasoning_effort: effort === 'off' ? 'none' : effort })
          }
        }
      } finally { await ctx.fiber.dispose() }
    })

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
        provider: 'dsh-opencode-go', model: 'future-unseen-model', sessionId: 'new-model-session' as never,
        system: 'SYSTEM_PROMPT_SENTINEL',
        tools: [{ name: 'probe_tool', description: 'Probe tool', parameters: {
          type: 'object', properties: { query: { type: 'string' } }, required: ['query'],
        } }],
        ...(cap === undefined ? {} : { maxTokens: 8192 }),
        messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })],
      })) chunks.push(chunk)
      expect(gateway.paths.map(value => new URL(value, gateway.url).pathname)).toEqual(['/v1/models', path])
      expect(gateway.bodies[0]).toMatchObject({ model: 'future-unseen-model' })
      // A successful text stream alone cannot detect pi-ai silently dropping
      // legacy Context fields. Inspect the actual wire prompt and declarations.
      const body = gateway.bodies[0] as Record<string, unknown>
      const serialized = JSON.stringify(body)
      expect(serialized.match(/SYSTEM_PROMPT_SENTINEL/g)).toHaveLength(1)
      if (npm === '@ai-sdk/anthropic') {
        expect(body).toMatchObject({
          system: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'SYSTEM_PROMPT_SENTINEL' })]),
          tools: [expect.objectContaining({ name: 'probe_tool', input_schema: {
            type: 'object', properties: { query: { type: 'string' } }, required: ['query'],
          } })],
        })
      } else if (npm === '@ai-sdk/openai') {
        expect(body).toMatchObject({ tools: [expect.objectContaining({ type: 'function', name: 'probe_tool',
          parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        })] })
      } else {
        expect(body).toMatchObject({
          messages: expect.arrayContaining([expect.objectContaining({ role: 'system', content: 'SYSTEM_PROMPT_SENTINEL' })]),
          tools: [expect.objectContaining({ type: 'function', function: expect.objectContaining({ name: 'probe_tool',
            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
          }) })],
        })
      }
      if (cap !== undefined) {
        expect(body.max_tokens ?? body.max_completion_tokens ?? body.max_output_tokens).toBe(cap)
      }
      expect(gateway.headers[1]?.['x-opencode-session']).toBe('new-model-session')
      expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
      expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
    })
  })
})

describe("persistent public metadata", () => {
  const id = 'disk-cache-only-model'

  const baseURL = 'https://fixture.invalid/v1'

  const body = () => metadataDocument({ [id]: modelMetadata() })

  const cachePath = () => join(process.env.DSH_HOME!, 'cache/dsh-opencode-go/models.dev.api.json')

  const catalog = (onRefresh = () => {}, url = baseURL) => new OpencodeGoCatalog(url, 60_000, () => {}, () => {}, onRefresh)

  function network(metadata: () => Response | Promise<Response>, ids = [id]) {
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      String(url) === MODELS_METADATA_URL ? metadata() : Response.json({ data: ids.map(id => ({ id })) }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  async function seed() {
    network(() => Response.json(body(), { headers: { etag: '"v1"' } }))
    await catalog().snapshot(true)
    return JSON.parse(await readFile(cachePath(), 'utf8'))
  }

  afterEach(() => { vi.useRealTimers() })

  it('keeps previously downloaded configuration across instances while reporting an offline manual refresh', async () => {
    const saved = await seed()
    network(() => { throw new DOMException('fixture timeout', 'TimeoutError') })
    const result = await discoverSettingsModels(catalog())
    expect(result.models).toContainEqual(expect.objectContaining({ id, contextWindow: 262144 }))
    expect(result.models[0].configurationMissing).not.toBe(true)
    expect(result.stale).toBe(true)
    expect(result.sources?.metadata).toEqual({ updatedAt: saved.savedAtMs, error: expect.stringContaining('timed out') })
    expect(JSON.parse(await readFile(cachePath(), 'utf8'))).toEqual(saved)
  })

  it('returns a cached startup before metadata completes, shares revalidation, and publishes its new models', async () => {
    await seed()
    const pending = Promise.withResolvers<Response>()
    const fetch = network(() => pending.promise, [id, 'new-model'])
    const refreshed = vi.fn()
    const instance = catalog(refreshed)
    const startup = instance.snapshot()
    const manualDone = vi.fn()
    const manual = instance.snapshot(true).then(value => { manualDone(); return value })
    try {
      const early = await Promise.race([startup, new Promise<null>(resolve => setTimeout(() => resolve(null), 250))])
      expect(early?.models.has(id)).toBe(true)
      expect(early?.metadataLive).toBe(false)
      expect(early?.metadataFailure).toBeUndefined()
      expect((await instance.forModel(id)).models.has(id)).toBe(true)
      expect(manualDone).not.toHaveBeenCalled()
      expect(refreshed).not.toHaveBeenCalled()
    } finally {
      pending.resolve(Response.json(metadataDocument({ [id]: modelMetadata(), 'new-model': modelMetadata() })))
      await Promise.all([startup, manual])
    }
    const updated = await instance.snapshot()
    expect(updated.metadataLive).toBe(true)
    expect(updated.models.has('new-model')).toBe(true)
    expect(fetch.mock.calls.filter(([url]) => String(url) === MODELS_METADATA_URL)).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => String(url) !== MODELS_METADATA_URL)).toHaveLength(1)
    expect(refreshed).toHaveBeenCalledOnce()
  })

  it('waits for metadata before rejecting a new model absent from the disk cache', async () => {
    await seed()
    const pending = Promise.withResolvers<Response>()
    network(() => pending.promise, [id, 'new-model'])
    const instance = catalog()
    await instance.snapshot()
    const done = vi.fn()
    const lookup = instance.forModel('new-model').then(value => { done(); return value })
    try {
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(done).not.toHaveBeenCalled()
    } finally {
      pending.resolve(Response.json(metadataDocument({ 'new-model': modelMetadata() })))
    }
    expect((await lookup).models.has('new-model')).toBe(true)
  })

  it('retains the success time after a failed background refresh and retries using normal backoff', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
    await seed()
    vi.setSystemTime(1_100_000)
    const pending = Promise.withResolvers<Response>()
    const fetch = network(() => pending.promise)
    const refreshed = vi.fn()
    const instance = catalog(refreshed)
    const cached = await instance.snapshot()
    const completed = instance.snapshot(true)
    pending.resolve(new Response(null, { status: 503 }))
    const failed = await completed
    expect(failed.models.has(id)).toBe(true)
    expect(failed.metadataUpdatedAtMs).toBe(cached.metadataUpdatedAtMs)
    expect(failed.metadataLive).toBe(false)
    expect(failed.metadataFailure).toBeDefined()
    expect(refreshed).toHaveBeenCalledOnce()
    vi.setSystemTime(1_104_999)
    await instance.snapshot()
    expect(fetch.mock.calls.filter(([url]) => String(url) === MODELS_METADATA_URL)).toHaveLength(1)
    vi.setSystemTime(1_105_000)
    const retry = network(() => Response.json(body()))
    expect((await instance.snapshot()).metadataLive).toBe(true)
    expect(retry.mock.calls.filter(([url]) => String(url) === MODELS_METADATA_URL)).toHaveLength(1)
  })

  it('does not commit the early cache after a faster online response', async () => {
    await seed()
    const listing = Promise.withResolvers<Response>()
    vi.stubGlobal('fetch', async (url: string | URL | Request) => String(url) === MODELS_METADATA_URL
      ? Response.json(metadataDocument({ [id]: modelMetadata({ name: 'Updated' }) })) : listing.promise)
    const instance = catalog()
    const startup = instance.snapshot()
    const final = instance.snapshot(true)
    try {
      await expect.poll(async () => JSON.parse(await readFile(cachePath(), 'utf8')).body['opencode-go'].models[id].name).toBe('Updated')
    } finally { listing.resolve(Response.json({ data: [{ id }] })) }
    await Promise.all([startup, final])
    expect((await instance.snapshot()).models.get(id)?.name).toBe('Updated')
  })

  it('cancels a manual waiter without cancelling the background refresh shared with other callers', async () => {
    await seed()
    const pending = Promise.withResolvers<Response>()
    const fetch = network(() => pending.promise)
    const instance = catalog()
    await instance.snapshot()
    const controller = new AbortController()
    const cancelled = instance.snapshot(true, controller.signal)
    const other = instance.snapshot(true)
    controller.abort()
    try {
      await expect(cancelled).rejects.toMatchObject({ code: 'ABORTED' })
    } finally { pending.resolve(new Response(null, { status: 304 })) }
    expect((await other).metadataLive).toBe(true)
    expect(fetch.mock.calls.filter(([url]) => String(url) === MODELS_METADATA_URL)).toHaveLength(1)
  })

  it('notifies adapter consumers with the committed models and ignores late results from a replaced catalog', async () => {
    await seed()
    let config = configOf(baseURL)
    const pending = Promise.withResolvers<Response>()
    network(() => pending.promise)
    const notified = vi.fn()
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => undefined, onCatalogRefresh: notified })
    expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual([id])
    const old = adapter.catalogOf(config).snapshot(true)
    config = { ...config, baseURL: 'https://changed.invalid/v1' }
    const current = adapter.catalogOf(config)
    pending.resolve(Response.json(body()))
    await old
    expect(notified).not.toHaveBeenCalled()
    network(() => Response.json(metadataDocument({ [id]: modelMetadata({ name: 'Updated' }) })))
    await adapter.listModels('dsh-opencode-go')
    await current.snapshot(true)
    expect(notified).toHaveBeenCalledOnce()
    expect((await adapter.listModels('dsh-opencode-go'))[0].name).toBe('Updated')
  })

  it('persists 304 verification time and ETag, and remaps cached metadata to the current gateway', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
    await seed()
    vi.setSystemTime(1_010_000)
    const fetch = network(() => new Response(null, { status: 304, headers: { etag: 'W/"v2"' } }))
    const result = await catalog(() => {}, 'https://other.invalid/api/v1').snapshot(true)
    const init = fetch.mock.calls.find(([url]) => String(url) === MODELS_METADATA_URL)![1]
    expect(new Headers(init?.headers).get('if-none-match')).toBe('"v1"')
    expect(new Headers(init?.headers).get('accept-encoding')).toBe('gzip')
    expect(result.metadataLive).toBe(true)
    expect(result.metadataUpdatedAtMs).toBe(1_010_000)
    expect(result.models.get(id)?.baseUrl).toBe('https://other.invalid/api/v1')
    expect(JSON.parse(await readFile(cachePath(), 'utf8'))).toMatchObject({ savedAtMs: 1_010_000, etag: 'W/"v2"' })
  })

  it.each([
    { name: 'invalid JSON', change: () => '{' },
    { name: 'unknown version', change: (saved: object) => JSON.stringify({ ...saved, version: 99 }) },
    { name: 'different source', change: (saved: object) => JSON.stringify({ ...saved, sourceURL: 'https://unrelated.invalid/api.json' }) },
    { name: 'invalid timestamp', change: (saved: object) => JSON.stringify({ ...saved, savedAtMs: -1 }) },
    { name: 'future timestamp', change: (saved: object) => JSON.stringify({ ...saved, savedAtMs: Date.now() + 86_400_000 }) },
    { name: 'invalid ETag', change: (saved: object) => JSON.stringify({ ...saved, etag: 'bad\r\nheader' }) },
    { name: 'invalid metadata', change: (saved: object) => JSON.stringify({ ...saved, body: {} }) },
    { name: 'oversized file', change: () => ' '.repeat(17 * 1024 * 1024) },
  ])('ignores a cache with $name and recovers from the network', async ({ change }) => {
    const saved = await seed()
    await writeFile(cachePath(), change(saved))
    const fetch = network(() => Response.json(body()))
    const result = await catalog().snapshot(true)
    expect(result.metadataLive).toBe(true)
    expect(result.models.has(id)).toBe(true)
    const init = fetch.mock.calls.find(([url]) => String(url) === MODELS_METADATA_URL)![1]
    expect(new Headers(init?.headers).has('if-none-match')).toBe(false)
  })

  it('keeps a valid disk document when an online response is malformed', async () => {
    const saved = await seed()
    network(() => Response.json({}))
    const result = await catalog().snapshot(true)
    expect(result.models.has(id)).toBe(true)
    expect(result.metadataLive).toBe(false)
    expect(JSON.parse(await readFile(cachePath(), 'utf8'))).toEqual(saved)
  })

  it('uses a successful download even when the cache directory is unwritable', async () => {
    // A file in place of the parent directory works on Windows and as root too.
    await writeFile(join(process.env.DSH_HOME!, 'cache'), 'blocked')
    network(() => Response.json(body()))
    const result = await catalog().snapshot(true)
    expect(result.metadataLive).toBe(true)
    expect(result.models.has(id)).toBe(true)
  })

  it('publishes a complete cache under concurrent writers without leaving temporary files', async () => {
    network(() => Response.json(body(), { headers: { etag: '"v1"' } }))
    const snapshots = await Promise.all(Array.from({ length: 5 }, () => catalog().snapshot(true)))
    expect(snapshots.every(value => value.metadataLive)).toBe(true)
    expect(JSON.parse(await readFile(cachePath(), 'utf8')).body).toEqual(body())
    expect(await readdir(dirname(cachePath()))).toEqual(['models.dev.api.json'])
  })

  it('does not advertise cached models without a successful gateway listing', async () => {
    await seed()
    vi.stubGlobal('fetch', async () => { throw new DOMException('fixture timeout', 'TimeoutError') })
    const instance = catalog()
    expect((await instance.snapshot()).models.size).toBe(0)
    expect((await instance.snapshot(true)).models.size).toBe(0)
  })

  it('does not resurrect cached models after a confirmed empty listing', async () => {
    await seed()
    network(() => new Response(null, { status: 304 }), [])
    const instance = catalog()
    expect((await instance.snapshot(true)).models.size).toBe(0)
    vi.stubGlobal('fetch', async () => { throw new DOMException('fixture timeout', 'TimeoutError') })
    expect((await instance.snapshot(true)).models.size).toBe(0)
  })
})

describe("metadata transport", () => {
  const networkFetch = globalThis.fetch

  const cleanups: Array<() => Promise<void>> = []

  afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup() })

  it('configures a cold catalog within its deadline over a bandwidth-limited metadata connection', async () => {
    const id = 'bandwidth-limited-model'
    const document = metadataDocument({ [id]: modelMetadata({ description: 'x'.repeat(5_230_000) }) })
    const plain = Buffer.from(JSON.stringify(document))
    const compressed = gzipSync(plain)
    const encodings: string[] = []
    const server = createServer((request, response) => {
      if (request.url === '/models') {
        response.end(JSON.stringify({ data: [{ id }] }))
        return
      }
      const encoding = request.headers['accept-encoding'] ?? ''
      encodings.push(encoding)
      const body = encoding === 'gzip' ? compressed : plain
      response.writeHead(200, {
        'content-type': 'application/json', etag: '"metadata-version"',
        ...(encoding === 'gzip' ? { 'content-encoding': 'gzip' } : {}),
      })
      // Both representations get the same 16 KiB per 10 ms transfer budget.
      let offset = 0
      const interval = setInterval(() => {
        response.write(body.subarray(offset, offset += 16 * 1024))
        if (offset >= body.length) { clearInterval(interval); response.end() }
      }, 10)
      response.on('close', () => clearInterval(interval))
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    cleanups.push(() => new Promise((resolve, reject) => {
      server.closeAllConnections()
      server.close(error => error ? reject(error) : resolve())
    }))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing server address')
    const baseURL = `http://127.0.0.1:${address.port}`
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) !== MODELS_METADATA_URL) return networkFetch(input, init)
      // Scale the metadata deadline so the real timeout regression runs in seconds.
      const signal = AbortSignal.any([init!.signal!, AbortSignal.timeout(500)])
      return networkFetch(`${baseURL}/metadata`, { ...init, signal })
    })
    const catalog = new OpencodeGoCatalog(baseURL, 60_000, () => {}, () => {})
    const snapshot = await catalog.snapshot(true)
    expect(snapshot.metadataFailure).toBeUndefined()
    expect(snapshot.metadataLive).toBe(true)
    expect(snapshot.models.has(id)).toBe(true)
    expect(snapshot.unavailable.size).toBe(0)
    expect(encodings).toEqual(['gzip'])
  })

  it('configures metadata when the host loses encoding headers and returns raw gzip bytes', async () => {
    const id = 'host-gzip-model'
    const compressed = gzipSync(Buffer.from(JSON.stringify(metadataDocument({ [id]: modelMetadata() }))))
    const encodings: Array<{ url: string; encoding: string | null }> = []
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      encodings.push({ url, encoding: new Headers(init?.headers).get('accept-encoding') })
      return url === MODELS_METADATA_URL ? new Response(compressed) : Response.json({ data: [{ id }] })
    })
    const catalog = new OpencodeGoCatalog('https://fixture.invalid/v1', 60_000, () => {}, () => {})
    const snapshot = await catalog.snapshot(true)
    expect(snapshot.metadataFailure).toBeUndefined()
    expect(snapshot.models.has(id)).toBe(true)
    expect(encodings).toContainEqual({ url: MODELS_METADATA_URL, encoding: 'gzip' })
    expect(encodings).toContainEqual({ url: 'https://fixture.invalid/v1/models', encoding: 'identity' })
  })
})

describe("model catalog RPC contracts", () => {
  afterEach(closeMockGateways)

  it.each([
    { name: 'HTTP failure', reply: () => new Response(null, { status: 503 }), detail: 'HTTP 503' },
    { name: 'timeout', reply: () => { throw new DOMException('timed out', 'TimeoutError') }, detail: 'timed out' },
    { name: 'invalid JSON', reply: () => new Response('not-json'), detail: 'invalid JSON' },
    { name: 'invalid configuration document', reply: () => Response.json({}), detail: 'invalid model configuration' },
  ])('reports a cold-start metadata $name through the Host RPC and clears it after recovery', async ({ reply, detail }) => {
    // Keep the missing model outside SDK built-ins so fallback cannot mask the failure.
    const id = 'future-metadata-only-model'
    const builtin = 'deepseek-v4-flash'
    const gateway = await mockGateway({ status: 200, body: listingBody([builtin, id]) })
    const config = configOf(gateway.url)
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => undefined })
    const original = globalThis.fetch
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? reply() : original(input, init))
    const ctx = new Context()
    await mountRemotes(ctx)
    await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
    const read = async () => await invokeRemote(ctx, {
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
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual([builtin])

      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
        ? Promise.resolve(Response.json(metadataDocument({ [builtin]: modelMetadata(), [id]: modelMetadata() })))
        : original(input, init))
      const recovered = await read()
      expect(recovered.stale).toBe(false)
      expect(recovered.error).toBeUndefined()
      expect(recovered.sources?.metadata).toEqual({ updatedAt: expect.any(Number) })
      expect(recovered.models.find(model => model.id === id)?.configurationMissing).not.toBe(true)
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual([builtin, id])
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('round-trips source diagnostics, accepts optional source fields, and rejects invalid timestamps', () => {
    const old = { models: [], stale: false }
    expect(parseGoModelCatalog(old)).toEqual(old)
    const catalog = { models: [], stale: true, sources: {
      listing: { updatedAt: 1_000, warning: 'one row ignored' }, metadata: { error: 'HTTP 503' },
    } }
    expect(parseGoModelCatalog(catalog)).toEqual(catalog)
    expect(() => parseGoModelCatalog({ ...catalog, sources: { ...catalog.sources, listing: { warning: 3 } } })).toThrow(/warning/)
    for (const updatedAt of [-1, NaN, Infinity, 'yesterday', 8_640_000_000_000_001]) {
      expect(() => parseGoModelCatalog({ ...catalog, sources: { ...catalog.sources, listing: { updatedAt } } })).toThrow(/timestamp/)
    }
  })

  it('keeps thinking budget bounds through the settings RPC codec', () => {
    const catalog = { models: [{ id: 'budget', reasoningBudget: { min: 1024, max: 20000 } }], stale: false }
    expect(parseGoModelCatalog(catalog)).toEqual(catalog)
    expect(parseGoModelCatalog({ ...catalog, models: [{ id: 'budget', reasoningBudget: { min: 1024, max: 512 } }] }))
      .toEqual({ models: [{ id: 'budget' }], stale: false })
  })

  it('keeps the declared input modalities across the Host RPC result codec', () => {
    const catalog = { models: [{ id: 'm', inputModalities: ['text', 'video'] }], stale: false }
    expect(parseGoModelCatalog(catalog)).toEqual(catalog)
    // An older Host omits the field entirely; the page then reports it as undeclared.
    expect(parseGoModelCatalog({ models: [{ id: 'm' }], stale: false })).toEqual({ models: [{ id: 'm' }], stale: false })
  })

  it('serves the declared input modalities through the Host RPC the settings page reads', async () => {
    const id = 'omni-model'
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? Promise.resolve(Response.json(metadataDocument({
        [id]: modelMetadata({ name: 'Omni', modalities: { input: ['video', 'text', 'image'], output: ['text'] } }),
      })))
      : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody([id]) })
    const config = configOf(gateway.url)
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => undefined })
    const ctx = new Context()
    await mountRemotes(ctx)
    await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
    const read = async () => await invokeRemote(ctx, {
      namespace: 'opencodeGoModels', method: 'read', args: {},
    }) as GoModelCatalog
    try {
      const catalog = await read()
      expect(catalog.models).toEqual([expect.objectContaining({ id, inputModalities: ['text', 'image', 'video'] })])
    } finally {
      vi.stubGlobal('fetch', original)
      await ctx.fiber.dispose()
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
    await mountRemotes(ctx)
    await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
    const read = async () => await invokeRemote(ctx, {
      namespace: 'opencodeGoModels', method: 'read', args: {},
    }) as GoModelCatalog
    try {
      const missing = await read()
      expect(missing).toEqual({ models: [{ id, name: id, configurationMissing: true }], stale: false,
        sources: { listing: { updatedAt: expect.any(Number) }, metadata: { updatedAt: expect.any(Number) } },
      })
      expect(isModelEnabled(missing.models[0], config.modelVisibility)).toBe(false)
      expect(await adapter.listModels('dsh-opencode-go')).toEqual([])
      await expect(adapter.resolveModel('dsh-opencode-go', id)).rejects.toMatchObject({ code: 'MODEL_METADATA_UNAVAILABLE' })

      configured = true
      const available = await read()
      expect(available.models).toEqual([expect.objectContaining({ id, name: 'Configured model' })])
      expect(available.models[0].configurationMissing).not.toBe(true)
      expect(isModelEnabled(available.models[0], config.modelVisibility)).toBe(true)
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual([id])
      await expect(adapter.resolveModel('dsh-opencode-go', id)).resolves.toMatchObject({ id })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('returns retained settings models and the timeout diagnostic through the Host RPC, matching the picker', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
    const config = configOf(gateway.url)
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => undefined })
    const ctx = new Context()
    await mountRemotes(ctx)
    await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
    const read = async () => await invokeRemote(ctx, {
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
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(stale.models.map(model => model.id))

      vi.stubGlobal('fetch', original)
      gateway.setModelListing(200, listingBody(['kimi-k3']))
      const recovered = await read()
      expect(recovered.stale).toBe(false)
      expect(recovered.error).toBeUndefined()
      expect(recovered.models.map(model => model.id)).toEqual(['kimi-k3'])
      expect((await adapter.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['kimi-k3'])
    } finally {
      await ctx.fiber.dispose()
    }
  })
})

describe("model lifecycle and visibility", () => {
  afterEach(closeMockGateways)

  it('uses independent model switches while keeping settings and existing requests available', async () => {
    const original = globalThis.fetch
    let metadataDown = false
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? Promise.resolve(metadataDown ? new Response('', { status: 503 }) : Response.json(metadataDocument({
        current: modelMetadata({ release_date: '2026-09-22' }),
        old: modelMetadata({ status: 'deprecated' }),
        absent: modelMetadata({ status: 'deprecated' }),
      }))) : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody(['current', 'old']) })
    // Old fields can survive a profile update but no longer impose another visibility gate.
    const config = Object.assign(configOf(`${gateway.url}/v1`), { showDeprecatedModels: true, visibleModelIds: [] })
    expect(PlainConfig({}).modelVisibility).toEqual({})
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    const ctx = new Context()
    await mountRemotes(ctx)
    await ctx.plugin(GoModelsService, { catalog: () => adapter.catalogOf(config) })
    try {
      const read = async () => await invokeRemote(ctx, { namespace: 'opencodeGoModels', method: 'read', args: {} }) as GoModelCatalog
      expect(await read()).toMatchObject({ stale: false, models: [
        expect.objectContaining({ id: 'current', releaseDate: '2026-09-22', contextWindow: 262144 }),
        expect.objectContaining({ id: 'old', deprecated: true }),
      ] })
      expect((await adapter.listModels('dsh-opencode-go')).map(m => m.id)).toEqual(['current'])
      config.modelVisibility = { old: true }
      expect((await adapter.listModels('dsh-opencode-go')).map(m => m.id)).toEqual(['current', 'old'])
      config.modelVisibility = { current: false, old: true, absent: true }
      expect((await adapter.listModels('dsh-opencode-go')).map(m => m.id)).toEqual(['old'])
      // The complete settings list stays available for changing the selection.
      expect((await read()).models.map(m => m.id)).toEqual(['current', 'old'])
      config.modelVisibility = { current: false, old: false }
      expect(await adapter.listModels('dsh-opencode-go')).toEqual([])
      // Hiding affects pickers; existing conversations can keep using the served model.
      gateway.pushCompletions({ events: textEvents })
      const chunks = []
      for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model: 'old',
        messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })] })) chunks.push(chunk)
      expect(chunks.length).toBeGreaterThan(0)
      config.modelVisibility = {}
      metadataDown = true
      expect((await adapter.listModels('dsh-opencode-go')).map(m => m.id)).toEqual(['current'])
      config.modelVisibility = { old: true }
      gateway.setModelListing(200, listingBody(['current']))
      expect((await read()).models.map(m => m.id)).toEqual(['current'])
      expect((await adapter.listModels('dsh-opencode-go')).map(m => m.id)).toEqual(['current'])
    } finally { await ctx.fiber.dispose() }
  })

  it('applies lifecycle defaults to new models and retains overrides for returning models', async () => {
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? Promise.resolve(Response.json(metadataDocument({ first: modelMetadata(), second: modelMetadata(),
        old: modelMetadata({ status: 'deprecated' }), returning: modelMetadata({ status: 'deprecated' }),
      })))
      : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody(['first']) })
    const config = configOf(gateway.url, { modelVisibility: { first: false, returning: true } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    expect(await adapter.listModels('dsh-opencode-go')).toEqual([])
    gateway.setModelListing(200, listingBody(['first', 'second', 'old', 'returning']))
    await discoverSettingsModels(adapter.catalogOf(config))
    expect((await adapter.listModels('dsh-opencode-go')).map(m => m.id)).toEqual(['second', 'returning'])
    config.modelVisibility = {}
    expect((await adapter.listModels('dsh-opencode-go')).map(m => m.id)).toEqual(['first', 'second'])
  })

  it('uses only own boolean overrides and rejects non-boolean configuration', () => {
    expect(isModelEnabled({ id: 'normal' })).toBe(true)
    expect(isModelEnabled({ id: 'old', deprecated: true })).toBe(false)
    expect(isModelEnabled({ id: 'toString', deprecated: true }, {})).toBe(false)
    expect(isModelEnabled({ id: 'old', deprecated: true }, Object.create({ old: true }) as Record<string, boolean>)).toBe(false)
    expect(isModelEnabled({ id: '__proto__', deprecated: true }, JSON.parse('{"__proto__":true}') as Record<string, boolean>)).toBe(true)
    expect(() => PlainConfig({ modelVisibility: { normal: 'yes' } } as never)).toThrow()
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
})
