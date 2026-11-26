/** Shared client-side Go catalog cache to prevent N+1 RPCs when pickers render. */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { GoModel, GoModelCatalog } from '../contracts.ts'

const DEFAULT_CACHE_TTL_MS = 5 * 60_000
const FAILURE_COOLDOWN_MS = 15_000

export interface SharedModelCatalog {
  readonly store: SnapshotStore<readonly GoModel[] | null>
  /** Record a catalog read performed by another surface (Settings, UsagePill). */
  publish(catalog: GoModelCatalog, endpointKey: string): void
  /** Deduplicated lazy load; returns cached entries while fresh and on the same endpoint. */
  ensureLoaded(endpointKey: string, ttlMs?: number): Promise<readonly GoModel[] | null>
  /** Drop cached entries when connection endpoints change. */
  syncEndpoint(endpointKey: string): void
}

export function createSharedModelCatalog(readModels: () => Promise<GoModelCatalog>): SharedModelCatalog {
  const store = createSnapshotStore<readonly GoModel[] | null>(null)
  let currentEndpoint = ''
  let fetchedAt = 0
  let failedAt = 0
  let inflight: { endpoint: string; promise: Promise<readonly GoModel[] | null> } | undefined

  const syncEndpoint = (endpointKey: string): void => {
    if (endpointKey === currentEndpoint) return
    currentEndpoint = endpointKey
    fetchedAt = 0
    failedAt = 0
    inflight = undefined
    if (store.getSnapshot() !== null) store.set(null)
  }

  const publish = (catalog: GoModelCatalog, endpointKey: string): void => {
    currentEndpoint = endpointKey
    fetchedAt = Date.now()
    failedAt = 0
    store.set(catalog.models)
  }

  const ensureLoaded = (endpointKey: string, ttlMs = DEFAULT_CACHE_TTL_MS): Promise<readonly GoModel[] | null> => {
    syncEndpoint(endpointKey)
    const now = Date.now()
    const current = store.getSnapshot()
    if (current !== null && now - fetchedAt < ttlMs) return Promise.resolve(current)
    if (current === null && failedAt > 0 && now - failedAt < FAILURE_COOLDOWN_MS) return Promise.resolve(null)
    if (inflight && inflight.endpoint === endpointKey) return inflight.promise

    const request = readModels()
      .then(catalog => {
        if (currentEndpoint === endpointKey) publish(catalog, endpointKey)
        return catalog.models
      })
      .catch(() => {
        if (currentEndpoint === endpointKey) failedAt = Date.now()
        return store.getSnapshot()
      })
      .finally(() => {
        if (inflight?.promise === request) inflight = undefined
      })
    inflight = { endpoint: endpointKey, promise: request }
    return request
  }

  return { store, publish, ensureLoaded, syncEndpoint }
}
