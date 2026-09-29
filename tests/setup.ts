import { afterEach, beforeEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { metadataDocument, MODELS_METADATA_URL } from './support/model-metadata.ts'

const networkFetch = globalThis.fetch
let testHome: string

beforeEach(async () => {
  testHome = await mkdtemp(join(tmpdir(), 'opencode-go-test-'))
  vi.stubEnv('DSH_HOME', testHome)
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url === MODELS_METADATA_URL) {
      return Promise.resolve(Response.json(metadataDocument()))
    }
    return networkFetch(input, init)
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(testHome, { recursive: true, force: true })
})
