import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import {
  OpencodeGoCatalog,
  discoverCatalogModels,
  readLiveModelIds,
} from '../src/catalog.ts'
import { closeMockGateways, fullLiveListing, listingBody, mockGateway } from './mock-gateway.ts'

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

  it('serves the curated table when the live listing is unreachable', async () => {
    const gateway = await mockGateway({ status: 503, body: {} })
    const fallbacks: unknown[] = []
    const catalog = new OpencodeGoCatalog(gateway.url, 60_000, detail => fallbacks.push(detail.error), () => {})

    const snapshot = await catalog.snapshot()

    expect(snapshot.live).toBe(false)
    expect(snapshot.models.has('deepseek-v4.1-flash')).toBe(true)
    expect(snapshot.models.size).toBeGreaterThan(20)
    expect(fallbacks).toHaveLength(1)
  })

  it('treats a malformed listing as unreachable', async () => {
    const gateway = await mockGateway({ status: 200, body: { unexpected: true } })
    const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})

    const snapshot = await catalog.snapshot()

    expect(snapshot.live).toBe(false)
    expect(snapshot.models.has('deepseek-v4.1-flash')).toBe(true)
  })

  it('serves the curated table when the listing cannot be reached at all', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down')
    }))
    const fallbacks: unknown[] = []
    const catalog = new OpencodeGoCatalog(gateway.url, 60_000, detail => fallbacks.push(detail.error), () => {})

    const snapshot = await catalog.snapshot()

    expect(snapshot.live).toBe(false)
    expect(snapshot.models.has('deepseek-v4-flash')).toBe(true)
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

  describe('configured model caps', () => {
    function builtinOf(id: string): { contextWindow: number; maxTokens: number } {
      const model = (getBuiltinModels('opencode-go') as { id: string; contextWindow: number; maxTokens: number }[])
        .find(candidate => candidate.id === id)
      if (model === undefined) throw new Error(`expected builtin ${id}`)
      return model
    }

    it('applies a configured override over the advertised capacities', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
      const limits = { 'deepseek-v4-flash': { contextWindow: 262_144, maxTokens: 32_768 } }
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}, () => limits)

      const snapshot = await catalog.snapshot()

      expect(snapshot.models.get('deepseek-v4-flash')).toMatchObject({
        contextWindow: 262_144,
        maxTokens: 32_768,
      })
    })

    it('moves only the declared field and leaves an undeclared model alone', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
      const advertised = builtinOf('deepseek-v4-flash')
      const untouched = builtinOf('deepseek-v4-flash-vision-exp')
      const limits = { 'deepseek-v4-flash': { contextWindow: advertised.contextWindow - 1 } }
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}, () => limits)

      const snapshot = await catalog.snapshot()

      expect(snapshot.models.get('deepseek-v4-flash')).toMatchObject({
        contextWindow: advertised.contextWindow - 1,
        maxTokens: advertised.maxTokens,
      })
      expect(snapshot.models.get('deepseek-v4-flash-vision-exp')).toMatchObject({
        contextWindow: untouched.contextWindow,
        maxTokens: untouched.maxTokens,
      })
    })

    it('re-reads caps and restores the advertised value when an override is removed', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      let limits: Record<string, { contextWindow?: number; maxTokens?: number }> = {
        'deepseek-v4-flash': { contextWindow: 262_144 },
      }
      const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}, () => limits)

      const advertised = (await catalog.snapshot()).models.get('deepseek-v4-flash')?.contextWindow
      expect(advertised).toBeGreaterThan(0)

      limits = { 'deepseek-v4-flash': { contextWindow: 524_288 } }
      expect((await catalog.snapshot(true)).models.get('deepseek-v4-flash')?.contextWindow).toBe(524_288)

      limits = {}
      expect((await catalog.snapshot(true)).models.get('deepseek-v4-flash')?.contextWindow).toBe(advertised)
    })
  })
})

describe('discoverCatalogModels', () => {
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
})
