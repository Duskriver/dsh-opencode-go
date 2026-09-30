import { createServer } from 'node:http'
import { once } from 'node:events'
import { gzipSync } from 'node:zlib'
import { afterEach, expect, it, vi } from 'vitest'
import { OpencodeGoCatalog } from '../src/catalog.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

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
