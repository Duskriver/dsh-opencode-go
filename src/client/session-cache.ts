import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/** Small structural face of the optional Host session event feed, across Host versions. */
export type SessionEventSource = ObservableSnapshot<unknown>

export interface SessionCacheStats {
  responses: number
  missingUsage: number
  unattributed: number
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  hasMore: boolean
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

function tokens(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Use only already-loaded history; never open a session or fetch more pages for diagnostics. */
export function sessionEventSource(sessions: unknown, sessionId: string): SessionEventSource | undefined {
  const service = record(sessions)
  if (typeof service?.binding !== 'function') return undefined
  const source = record(record(service.binding(sessionId))?.eventSource)
  if (typeof source?.getSnapshot !== 'function' || typeof source.subscribe !== 'function') return undefined
  const getSnapshot = source.getSnapshot.bind(source)
  const subscribe = source.subscribe.bind(source)
  return {
    getSnapshot: () => getSnapshot(),
    subscribe: listener => subscribe(listener),
  }
}

/** Aggregate settled Go responses. Pi-ai's input excludes cache reads AND writes. */
export function summarizeSessionCache(window: unknown): SessionCacheStats {
  const snapshot = record(window)
  let stats: SessionCacheStats = { responses: 0, missingUsage: 0, unattributed: 0,
    inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, hasMore: snapshot?.hasMore === true }
  let provider: unknown
  const seen = new Set<number>()
  for (const entry of Array.isArray(snapshot?.entries) ? snapshot.entries : []) {
    const row = record(entry)
    const event = record(row?.event)
    if (row?.type !== 'event' || !event || !tokens(event.seq) || seen.has(event.seq)) continue
    seen.add(event.seq)
    const data = record(event.data)
    if (event.type === 'request/header') provider = record(record(data?.header)?.config)?.provider
    // A fork's inherited responses were generated under its parent's routing identity.
    // Retain the request header, but count only responses after the latest inherited cut.
    if (event.type === 'session/end-seed' && data?.inherited === true) {
      stats = { ...stats, responses: 0, missingUsage: 0, unattributed: 0,
        inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    }
    if (event.type !== 'assistant/message') continue
    if (provider === undefined) { stats.unattributed++; continue }
    if (provider !== 'opencode-go') continue
    const usage = record(data?.usage)
    const input = usage?.inputTokens
    const read = usage?.cacheReadTokens === undefined ? 0 : usage.cacheReadTokens
    const write = usage?.cacheWriteTokens === undefined ? 0 : usage.cacheWriteTokens
    if (!tokens(input) || !tokens(read) || !tokens(write)
      || !Number.isSafeInteger(stats.inputTokens + input + read + write)) {
      stats.missingUsage++
      continue
    }
    stats.responses++
    stats.inputTokens += input + read + write
    stats.cacheReadTokens += read
    stats.cacheWriteTokens += write
  }
  return stats
}

/** Stable snapshots avoid rendering on unrelated live chunks; history replacement recomputes. */
export function sessionCacheSource(events: SessionEventSource): ObservableSnapshot<SessionCacheStats> {
  let window: unknown
  let value: SessionCacheStats | undefined
  return {
    subscribe: listener => events.subscribe(listener),
    getSnapshot: () => {
      const next = events.getSnapshot()
      if (value !== undefined && next === window) return value
      const previous = record(window)
      window = next
      const current = record(next)
      const change = record(current?.change)
      if (value !== undefined && typeof previous?.revision === 'number'
        && current?.revision === previous.revision + 1 && change?.kind === 'append'
        && Array.isArray(change.entries) && change.entries.every(entry => record(entry)?.type === 'transient')) return value
      const stats = summarizeSessionCache(next)
      if (value === undefined || (Object.keys(stats) as (keyof SessionCacheStats)[]).some(key => stats[key] !== value![key])) value = stats
      return value
    },
  }
}
