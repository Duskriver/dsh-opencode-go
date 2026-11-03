import { afterEach, beforeEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeMockGateways } from './support/gateway.ts'
import { DEFAULT_FREE_BASE_URL } from '../src/contracts.ts'

const networkFetch = globalThis.fetch
let testHome: string

beforeEach(async () => {
  testHome = await mkdtemp(join(tmpdir(), 'opencode-go-test-'))
  vi.stubEnv('DSH_HOME', testHome)
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.href === `${DEFAULT_FREE_BASE_URL}/models`) return Promise.resolve(Response.json({ data: [] }))
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
  // Startup revalidation may finish an atomic rename while cleanup removes its
  // parent. Retry that filesystem race without changing discovery assertions.
  await rm(testHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 10 })
})
