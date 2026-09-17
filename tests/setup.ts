import { afterEach, beforeEach, vi } from 'vitest'
import { metadataDocument, MODELS_METADATA_URL } from './support/model-metadata.ts'

const networkFetch = globalThis.fetch

beforeEach(() => {
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url === MODELS_METADATA_URL) {
      return Promise.resolve(Response.json(metadataDocument()))
    }
    return networkFetch(input, init)
  })
})

afterEach(() => { vi.unstubAllGlobals() })
