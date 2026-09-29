import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { OpencodeGoCatalog, discoverSettingsModels } from '../src/catalog.ts'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { configOf } from './config-of.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

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
  expect((await adapter.listModels('opencode-go')).map(model => model.id)).toEqual([id])
  const old = adapter.catalogOf(config).snapshot(true)
  config = { ...config, baseURL: 'https://changed.invalid/v1' }
  const current = adapter.catalogOf(config)
  pending.resolve(Response.json(body()))
  await old
  expect(notified).not.toHaveBeenCalled()
  network(() => Response.json(metadataDocument({ [id]: modelMetadata({ name: 'Updated' }) })))
  await adapter.listModels('opencode-go')
  await current.snapshot(true)
  expect(notified).toHaveBeenCalledOnce()
  expect((await adapter.listModels('opencode-go'))[0].name).toBe('Updated')
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
  expect(new Headers(init?.headers).get('accept-encoding')).toBe('identity')
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
