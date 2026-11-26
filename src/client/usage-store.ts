/** Shared client-side usage cache with in-flight deduplication across surfaces. */
import type { GoUsage } from '../contracts.ts'

export interface UsageReading {
  readonly usage: GoUsage
  readonly updatedAt: number
}

export interface SharedUsageStore {
  /** Read active-account usage with short-TTL deduplication (bypassed when `force` is true). */
  readActive(force?: boolean): Promise<GoUsage>
  /** Read one account's usage with short-TTL deduplication (bypassed when `force` is true). */
  readAccount(ref: string, force?: boolean): Promise<GoUsage>
  /** Read the most recent cached snapshot for one account without triggering a network call. */
  peek(ref: string): UsageReading | undefined
  /** Drop cached entries after credential, account, or endpoint changes. */
  invalidate(ref?: string): void
}

const DEFAULT_USAGE_TTL_MS = 10_000
const ACTIVE_KEY = '__active__'

export function createSharedUsageStore(
  readers: {
    readActive: () => Promise<GoUsage>
    readAccount: (ref: string) => Promise<GoUsage>
    endpointKey?: () => string
  },
  ttlMs = DEFAULT_USAGE_TTL_MS,
): SharedUsageStore {
  const cache = new Map<string, UsageReading>()
  const inflight = new Map<string, Promise<GoUsage>>()
  let currentEndpoint = readers.endpointKey?.() ?? ''

  const syncEndpoint = (): void => {
    const next = readers.endpointKey?.() ?? ''
    if (next === currentEndpoint) return
    currentEndpoint = next
    cache.clear()
    inflight.clear()
  }

  const fetchKey = (key: string, loader: () => Promise<GoUsage>, force = false): Promise<GoUsage> => {
    syncEndpoint()
    const endpoint = currentEndpoint
    const now = Date.now()
    if (!force) {
      const cached = cache.get(key)
      if (cached !== undefined && now - cached.updatedAt < ttlMs) {
        return Promise.resolve(cached.usage)
      }
      const pending = inflight.get(key)
      if (pending !== undefined) return pending
    }
    const request = loader().then(usage => {
      if (currentEndpoint === endpoint) {
        cache.set(key, { usage, updatedAt: Date.now() })
      }
      return usage
    }).finally(() => {
      if (inflight.get(key) === request) inflight.delete(key)
    })
    inflight.set(key, request)
    return request
  }

  return {
    readActive: (force = false) => fetchKey(ACTIVE_KEY, readers.readActive, force),
    readAccount: (ref: string, force = false) => fetchKey(ref, () => readers.readAccount(ref), force),
    peek: (ref: string) => { syncEndpoint(); return cache.get(ref) },
    invalidate: (ref?: string) => {
      if (ref === undefined) {
        cache.clear()
        inflight.clear()
        return
      }
      cache.delete(ref)
      cache.delete(ACTIVE_KEY)
      inflight.delete(ref)
      inflight.delete(ACTIVE_KEY)
    },
  }
}
