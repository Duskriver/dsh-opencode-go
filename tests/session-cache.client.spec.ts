import { expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { sessionCacheSource, sessionEventSource, summarizeSessionCache } from '../src/client/session-cache.ts'

const event = (seq: number, type: string, data: unknown) => ({ type: 'event', event: { seq, type, data } })
const header = (seq: number, provider = 'opencode-go') => event(seq, 'request/header', { header: { config: { provider } } })
const response = (seq: number, usage?: unknown) => event(seq, 'assistant/message', { usage })
const cached = { inputTokens: 20, cacheReadTokens: 70, cacheWriteTokens: 10, outputTokens: 5, totalTokens: 105 }

it('counts only durable Go responses and weights cache reads by total input including cache writes', () => {
  const sample = response(1, cached)
  const stats = summarizeSessionCache({ hasMore: true, entries: [
    header(0), sample, sample, response(2, { inputTokens: 300 }),
    { type: 'transient', event: { seq: 2.5, type: 'assistant/live-chunk', data: { chunk: { type: 'usage', usage: cached } } } },
    event(3, 'assistant/attempt', { stream: [{ chunk: { type: 'usage', usage: cached } }] }),
    header(4, 'deepseek'), response(5, cached),
  ] })
  expect(stats).toEqual({ responses: 2, missingUsage: 0, unattributed: 0,
    inputTokens: 400, cacheReadTokens: 70, cacheWriteTokens: 10, hasMore: true })
})

it('reports missing accounting and attribution without turning them into cache misses', () => {
  expect(summarizeSessionCache({ entries: [
    response(0, cached), header(1), response(2), response(3, { inputTokens: -1 }),
    response(4, { inputTokens: 100, cacheReadTokens: '80' }),
    response(5, { inputTokens: 100, cacheWriteTokens: null }),
    response(6, { inputTokens: Number.MAX_SAFE_INTEGER, cacheReadTokens: 1 }),
    response(7, { inputTokens: 0 }),
  ] })).toMatchObject({ responses: 1, missingUsage: 5, unattributed: 1, inputTokens: 0, cacheReadTokens: 0 })
})

it('excludes inherited fork responses while retaining the inherited request route', () => {
  expect(summarizeSessionCache({ entries: [
    header(0), response(1, cached), event(2, 'session/end-seed', { inherited: true }),
    response(3, cached), event(4, 'session/end-seed', { inherited: true }),
    event(5, 'session/end-seed', {}), response(6, { inputTokens: 5 }),
  ] })).toMatchObject({ responses: 1, inputTokens: 5, cacheReadTokens: 0 })
})

it('recomputes on restored history, pagination and settlement, but preserves snapshots on transient chunks', () => {
  const entries = [header(0), response(1, cached)]
  const events = createSnapshotStore<unknown>({ entries, hasMore: true, revision: 1 })
  const source = sessionCacheSource(events)
  const first = source.getSnapshot()
  expect(source.getSnapshot()).toBe(first)
  const transient = { type: 'transient', event: { seq: 1.5 } }
  events.set({ entries: [...entries, transient], hasMore: true, revision: 2, change: { kind: 'append', entries: [transient] } })
  expect(source.getSnapshot()).toBe(first)
  const next = [...entries, response(2, { inputTokens: 100 })]
  events.set({ entries: next, hasMore: true, revision: 3, change: { kind: 'settle-assistant' } })
  expect(source.getSnapshot()).toMatchObject({ responses: 2, inputTokens: 200 })
  const restored = JSON.parse(JSON.stringify({ entries: next, hasMore: false, revision: 4, change: { kind: 'replace' } }))
  events.set(restored)
  expect(source.getSnapshot()).toEqual({ ...first, responses: 2, inputTokens: 200, hasMore: false })
  expect(sessionCacheSource(events).getSnapshot()).toEqual(source.getSnapshot())
  // Losing the header after window replacement must not attribute a different window's usage to Go.
  events.set({ entries: [response(4, cached)], hasMore: true, revision: 5, change: { kind: 'replace' } })
  expect(source.getSnapshot()).toMatchObject({ responses: 0, unattributed: 1, inputTokens: 0 })
})

it('borrows an existing feed with method receivers intact and tolerates hosts without the feed', () => {
  const listener = vi.fn()
  const stop = vi.fn()
  const source = {
    state: { entries: [], hasMore: false },
    getSnapshot() { return this.state },
    subscribe(callback: () => void) { expect(this).toBe(source); callback(); return stop },
  }
  const service = { binding(id: string) { expect(this).toBe(service); expect(id).toBe('s'); return { eventSource: source } } }
  const borrowed = sessionEventSource(service, 's')!
  expect(borrowed.getSnapshot()).toBe(source.state)
  borrowed.subscribe(listener)()
  expect(listener).toHaveBeenCalledOnce()
  expect(stop).toHaveBeenCalledOnce()
  for (const sessions of [undefined, {}, { binding: () => undefined }, { binding: () => ({ eventSource: {} }) }]) {
    expect(sessionEventSource(sessions, 's')).toBeUndefined()
  }
})
