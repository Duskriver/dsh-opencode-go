import { gzipSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { OpencodeGoCatalog, type CatalogDiagnostic } from '../src/catalog.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

const id = 'timed-model'
const baseURL = 'https://fixture.invalid/v1'
const document = () => metadataDocument({ [id]: modelMetadata({ description: 'private-metadata-description' }) })
const listing = () => Response.json({ data: [{ id }] })
const createCatalog = (fetcher: typeof fetch, observer: (event: CatalogDiagnostic) => void, url = baseURL) =>
  new OpencodeGoCatalog(url, 60_000, () => {}, () => {}, () => {}, fetcher, undefined, observer)

afterEach(() => { vi.restoreAllMocks() })

it('shows the active network stage before it finishes and times gzip recovery separately', async () => {
  const headers = Promise.withResolvers<Response>()
  const requested = Promise.withResolvers<void>()
  const reading = Promise.withResolvers<void>()
  const events: CatalogDiagnostic[] = []
  const plain = Buffer.from(JSON.stringify(document()))
  const compressed = gzipSync(plain)
  const fetcher: typeof fetch = async url => {
    if (String(url) !== MODELS_METADATA_URL) return listing()
    requested.resolve()
    return headers.promise
  }
  const pending = createCatalog(fetcher, event => events.push(event)).snapshot()
  await requested.promise
  expect(events).toContainEqual(expect.objectContaining({ stage: 'metadata.headers', phase: 'start', attempt: 1 }))
  expect(events.some(event => event.stage === 'metadata.headers' && event.phase === 'success')).toBe(false)
  await delay(25)
  let stream!: ReadableStreamDefaultController<Uint8Array>
  headers.resolve(new Response(new ReadableStream<Uint8Array>({
    start(controller) { stream = controller; controller.enqueue(compressed.subarray(0, 8)) },
    pull() { reading.resolve() },
  }, { highWaterMark: 0 })))
  await reading.promise
  expect(events).toContainEqual(expect.objectContaining({ stage: 'metadata.body', phase: 'start' }))
  expect(events.some(event => event.stage === 'metadata.body' && event.phase === 'success')).toBe(false)
  await delay(25)
  stream.enqueue(compressed.subarray(8))
  stream.close()
  const result = await pending
  expect(result.models.has(id)).toBe(true)
  expect(new Set(events.map(event => event.catalogId)).size).toBe(1)
  expect(events.filter(event => event.refresh === 0)).toContainEqual(expect.objectContaining({ stage: 'cache.restore', phase: 'success', cacheHit: false }))
  for (const stage of ['refresh', 'listing', 'listing.headers', 'listing.body', 'listing.parse',
    'metadata', 'metadata.headers', 'metadata.body', 'metadata.decompress', 'metadata.parse',
    'metadata.configure', 'metadata.cache-write', 'build']) {
    expect(events.filter(event => event.stage === stage).map(event => event.phase)).toEqual(['start', 'success'])
  }
  expect(events.find(event => event.stage === 'metadata.headers' && event.phase === 'success')?.elapsedMs).toBeGreaterThanOrEqual(20)
  expect(events.find(event => event.stage === 'metadata.body' && event.phase === 'success')).toMatchObject({ bytes: compressed.length, elapsedMs: expect.any(Number) })
  expect(events.find(event => event.stage === 'metadata.body' && event.phase === 'success')?.elapsedMs).toBeGreaterThanOrEqual(20)
  expect(events).toContainEqual(expect.objectContaining({ stage: 'metadata.decompress', phase: 'success', bytes: plain.length }))
  expect(events).toContainEqual(expect.objectContaining({ stage: 'metadata.cache-write', phase: 'success', persisted: true }))
  expect(JSON.stringify(events)).not.toContain('private-metadata-description')
})

it('records body timeout failures without waiting for cancellation or starting parsing', async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => timeout(ms === 30_000 ? 50 : ms))
  const cancel = vi.fn(() => new Promise<void>(() => {}))
  const fetcher: typeof fetch = async url => String(url) !== MODELS_METADATA_URL ? listing()
    : new Response(new ReadableStream({
      start(stream) { stream.enqueue(new TextEncoder().encode('{"partial":')) }, cancel,
    }))
  const events: CatalogDiagnostic[] = []
  const snapshot = await createCatalog(fetcher, event => events.push(event)).snapshot()
  expect(snapshot.metadataLive).toBe(false)
  expect(snapshot.metadataFailure).toMatchObject({ name: 'TimeoutError' })
  expect(cancel).toHaveBeenCalledOnce()
  expect(events.filter(event => event.stage === 'metadata.body').map(event => event.phase)).toEqual(['start', 'failure'])
  expect(events).toContainEqual(expect.objectContaining({ stage: 'metadata', phase: 'failure' }))
  expect(events.some(event => event.stage === 'metadata.parse')).toBe(false)
  expect(events).toContainEqual(expect.objectContaining({ stage: 'refresh', phase: 'success' }))
})

it('distinguishes cache startup from a pending revalidation and numbers later refreshes', async () => {
  const seed: typeof fetch = async url => String(url) === MODELS_METADATA_URL ? Response.json(document()) : listing()
  await createCatalog(seed, () => {}).snapshot(true)
  const headers = Promise.withResolvers<Response>()
  const events: CatalogDiagnostic[] = []
  const fetcher: typeof fetch = async url => String(url) === MODELS_METADATA_URL ? headers.promise : listing()
  const catalog = createCatalog(fetcher, event => events.push(event))
  try {
    const early = await catalog.snapshot()
    expect(early.models.has(id)).toBe(true)
    expect(early.metadataLive).toBe(false)
    expect(events).toContainEqual(expect.objectContaining({ stage: 'cache.restore', phase: 'success', cacheHit: true }))
    expect(events).toContainEqual(expect.objectContaining({ stage: 'cache.convert', phase: 'success' }))
    expect(events).toContainEqual(expect.objectContaining({ stage: 'cache.snapshot', phase: 'success', refresh: 1 }))
    expect(events.some(event => event.stage === 'refresh' && event.phase === 'success')).toBe(false)
  } finally {
    headers.resolve(new Response(null, { status: 304 }))
    await catalog.snapshot(true)
  }
  await catalog.snapshot(true)
  expect(events.filter(event => event.stage === 'refresh' && event.phase === 'start').map(event => event.refresh)).toEqual([1, 2])
  expect(events).toContainEqual(expect.objectContaining({ stage: 'metadata.headers', phase: 'success', status: 304 }))
  expect(new Set(events.map(event => event.catalogId)).size).toBe(1)
})

it('reports a failed cache write without treating online metadata as failed', async () => {
  await writeFile(join(process.env.DSH_HOME!, 'cache'), 'blocked')
  const events: CatalogDiagnostic[] = []
  const fetcher: typeof fetch = async url => String(url) === MODELS_METADATA_URL ? Response.json(document()) : listing()
  const result = await createCatalog(fetcher, event => events.push(event)).snapshot()
  expect(result.metadataLive).toBe(true)
  expect(result.models.has(id)).toBe(true)
  expect(events).toContainEqual(expect.objectContaining({ stage: 'metadata.cache-write', phase: 'success', persisted: false }))
})

it('correlates concurrent catalogs and retries while redacting endpoint credentials and query strings', async () => {
  const events: CatalogDiagnostic[] = []
  let attempts = 0
  const fetcher: typeof fetch = async url => {
    if (String(url) === MODELS_METADATA_URL) return Response.json(document())
    if (++attempts === 1) throw Object.assign(new Error('private-transport-message'), { code: 'ECONNRESET' })
    return listing()
  }
  const observe = (event: CatalogDiagnostic) => events.push(event)
  const url = 'https://private-user:private-password@fixture.invalid/v1?private-query#private-fragment'
  const catalogs = [createCatalog(fetcher, observe, url), createCatalog(fetcher, observe)]
  const results = await Promise.all(catalogs.map(catalog => catalog.snapshot()))
  expect(results.every(result => result.models.has(id))).toBe(true)
  expect(new Set(events.map(event => event.catalogId)).size).toBe(2)
  expect(events).toContainEqual(expect.objectContaining({ stage: 'listing.headers', phase: 'failure', attempt: 1 }))
  expect(events).toContainEqual(expect.objectContaining({ stage: 'listing.retry-delay', phase: 'success', attempt: 1 }))
  expect(events).toContainEqual(expect.objectContaining({ stage: 'listing.headers', phase: 'success', attempt: 2, status: 200 }))
  expect(JSON.stringify(events)).not.toMatch(/private-/)
})

it('keeps observer exceptions from affecting catalog results', async () => {
  const fetcher: typeof fetch = async url => String(url) === MODELS_METADATA_URL ? Response.json(document()) : listing()
  const catalog = createCatalog(fetcher, () => { throw new Error('observer failed') })
  expect((await catalog.snapshot()).models.has(id)).toBe(true)
  expect((await catalog.snapshot(true)).metadataLive).toBe(true)
})
