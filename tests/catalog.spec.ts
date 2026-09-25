import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import {
  OpencodeGoCatalog,
  discoverCatalogModels,
  discoverSettingsModels,
  readLiveModelIds,
} from '../src/catalog.ts'
import { closeMockGateways, fullLiveListing, listingBody, mockGateway } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

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

  it('avoids undecoded compression by requesting identity from both JSON endpoints', async () => {
    // Reproduce bytes delivered after the host loses the encoding header.
    // Respecting identity keeps the response plain, before decoding is involved.
    const responseBodyTransform = (body: Buffer, request: import('node:http').IncomingMessage) =>
      request.headers['accept-encoding'] === 'identity' ? body : brotliCompressSync(body)
    const gateway = await mockGateway({ status: 200, body: listingBody([metadataOnlyId]), responseBodyTransform })
    const metadataGateway = await mockGateway({ status: 200, body: metadataOnlyDocument(), responseBodyTransform })
    routeMetadataTo(metadataGateway.url)
    const snapshot = await new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}).snapshot()
    expect(snapshot.live).toBe(true)
    expect(snapshot.models.has(metadataOnlyId)).toBe(true)
    expect(gateway.headers[0]['accept-encoding']).toBe('identity')
    expect(metadataGateway.headers[0]['accept-encoding']).toBe('identity')
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
