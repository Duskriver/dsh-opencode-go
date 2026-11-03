import { afterEach, beforeEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeMockGateways } from './support/gateway.ts'
import { metadataDocument, MODELS_METADATA_URL } from './support/data.ts'

const networkFetch = globalThis.fetch
let testHome: string

beforeEach(async () => {
  testHome = await mkdtemp(join(tmpdir(), 'opencode-go-test-'))
  vi.stubEnv('DSH_HOME', testHome)
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.href === MODELS_METADATA_URL) return Promise.resolve(Response.json(metadataDocument()))
    const throughLocalFixtureProxy = url.hostname.endsWith('.invalid') && (init as RequestInit & { dispatcher?: unknown })?.dispatcher
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !throughLocalFixtureProxy) {
      throw new Error(`Unexpected external test request: ${url.origin}${url.pathname}`)
    }
    return networkFetch(input, init)
  })
})

afterEach(async () => {
  await closeMockGateways()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(testHome, { recursive: true, force: true })
})
