import { expect, it } from 'vitest'
import { foldSession, isPluginRoute, LEGACY_ROUTE_CUTOFF_MS } from '../src/analytics-scan.ts'

const base = Date.UTC(2026, 9, 18, 9, 0)
const event = (type: string, seq: number, time: number, data?: unknown) => ({ type, seq, time, data })
const snapshot = (events: unknown[], inheritedEventCount = 0) => ({ inheritedEventCount, events: events as never[] })
const header = (provider: string, seq: number, model = 'deepseek-v4.1-flash') =>
  event('request/header', seq, base, { header: { config: { provider, model } }, reason: 'initial' })
const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1 }
const message = (seq: number, time = base, extra: Record<string, unknown> = {}) => event('assistant/message', seq, time, {
  turn: 1, step: 1, message: { model: 'deepseek-v4.1-flash' }, usage, ...extra,
})

it('associates a message with the latest header and its step start', () => {
  const folded = foldSession(snapshot([
    event('step/start', 1, base, { turn: 1, step: 1 }),
    header('dsh-opencode-go', 2),
    message(3, base + 5_000),
  ]))
  expect(folded.facts).toEqual([{
    at: base, model: 'deepseek-v4.1-flash', kind: 'message', legacy: false, missingUsage: false,
    input: 10, output: 5, cacheRead: 2, cacheWrite: 1,
  }])
  expect(folded.events).toBe(3)
})

it('keeps the pre-0.1.16 route only before the cutoff', () => {
  expect(isPluginRoute('opencode-go', LEGACY_ROUTE_CUTOFF_MS - 1)).toBe(true)
  expect(isPluginRoute('opencode-go', LEGACY_ROUTE_CUTOFF_MS)).toBe(false)
  expect(isPluginRoute('dsh-opencode-go', LEGACY_ROUTE_CUTOFF_MS)).toBe(true)
  const folded = foldSession(snapshot([
    header('opencode-go', 1),
    message(2, LEGACY_ROUTE_CUTOFF_MS - 1),
    message(3, LEGACY_ROUTE_CUTOFF_MS + 1),
  ]))
  expect(folded.facts).toHaveLength(1)
  expect(folded.facts[0]).toMatchObject({ legacy: true })
})

it('ignores other providers', () => {
  const folded = foldSession(snapshot([
    header('deepseek-account', 1),
    message(2),
    header('dsh-opencode-go', 3),
    message(4),
  ]))
  expect(folded.facts).toHaveLength(1)
  expect(folded.facts[0]).toMatchObject({ model: 'deepseek-v4.1-flash', legacy: false })
})

it('excludes the fork-inherited prefix', () => {
  const folded = foldSession(snapshot([
    header('dsh-opencode-go', 1),
    message(2),
    header('dsh-opencode-go', 3),
    message(4),
  ], 2))
  expect(folded.facts).toHaveLength(1)
})

it('records missing usage without inventing tokens', () => {
  const folded = foldSession(snapshot([
    header('dsh-opencode-go', 1),
    message(2, base, { usage: undefined }),
  ]))
  expect(folded.facts[0]).toMatchObject({ missingUsage: true, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
})

it('counts compaction summaries and unsettled attempts', () => {
  const folded = foldSession(snapshot([
    header('dsh-opencode-go', 1),
    event('assistant/attempt', 2, base, { turn: 1, step: 1, stream: [] }),
    event('compaction/summary', 3, base + 10, { provider: 'dsh-opencode-go', model: 'm', usage }),
  ]))
  expect(folded.attempts).toEqual([base])
  expect(folded.facts).toEqual([expect.objectContaining({ kind: 'summary', model: 'm', at: base + 10 })])
})

it('counts a message without any header as unattributed', () => {
  const folded = foldSession(snapshot([message(1)]))
  expect(folded.facts).toHaveLength(0)
  expect(folded.unattributed).toEqual([base])
})

// P8: usage degrades per component; only input AND output missing together is missingUsage.

it('keeps partially valid usage when only inputTokens is missing', () => {
  const folded = foldSession(snapshot([
    header('dsh-opencode-go', 1),
    message(2, base, { usage: { outputTokens: 500, cacheReadTokens: 30, cacheWriteTokens: 0 } }),
  ]))
  expect(folded.facts[0]).toMatchObject({
    missingUsage: false, input: 0, output: 500, cacheRead: 30, cacheWrite: 0,
  })
})

it('degrades a present-but-malformed cache component to zero', () => {
  const folded = foldSession(snapshot([
    header('dsh-opencode-go', 1),
    message(2, base, { usage: { inputTokens: 1200, outputTokens: 500, cacheReadTokens: null } }),
  ]))
  expect(folded.facts[0]).toMatchObject({
    missingUsage: false, input: 1200, output: 500, cacheRead: 0, cacheWrite: 0,
  })
})

it('still records missingUsage when input and output are both unusable', () => {
  const folded = foldSession(snapshot([
    header('dsh-opencode-go', 1),
    message(2, base, { usage: { cacheReadTokens: 5 } }),
  ]))
  expect(folded.facts[0]).toMatchObject({ missingUsage: true, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
})

it('rejects degraded usage whose sum overflows the safe-integer range', () => {
  const folded = foldSession(snapshot([
    header('dsh-opencode-go', 1),
    message(2, base, {
      usage: { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: Number.MAX_SAFE_INTEGER },
    }),
  ]))
  expect(folded.facts[0]).toMatchObject({ missingUsage: true, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
})

// P10: at resolves per-key start → latest start (by seq, malformed keys count) → completion time.

it('uses the latest start when step keys are malformed (peak window, E3a)', () => {
  const start = Date.UTC(2026, 9, 14, 0, 50) // Wednesday 00:50Z — outside the 01-04 UTC peak window
  const done = Date.UTC(2026, 9, 14, 1, 30) // 01:30Z — inside it; completion time would double the rate
  const folded = foldSession(snapshot([
    event('step/start', 1, start, {}),
    header('dsh-opencode-go', 2),
    event('assistant/message', 3, done, { message: { model: 'deepseek-v4.1-flash' }, usage }),
  ]))
  expect(folded.facts).toEqual([expect.objectContaining({ at: start, legacy: false, missingUsage: false })])
})

it('keeps the start time across a local midnight for day bucketing (E3b)', () => {
  const start = Date.parse('2026-10-05T23:59:30+08:00')
  const done = Date.parse('2026-10-06T00:00:30+08:00')
  const folded = foldSession(snapshot([
    event('step/start', 1, start, {}),
    header('dsh-opencode-go', 2),
    event('assistant/message', 3, done, { message: { model: 'deepseek-v4.1-flash' }, usage }),
  ]))
  expect(folded.facts[0]).toMatchObject({ at: start })
})

it('keeps a legacy request whose start predates the cutoff (E3c)', () => {
  const folded = foldSession(snapshot([
    header('opencode-go', 1),
    event('step/start', 2, LEGACY_ROUTE_CUTOFF_MS - 10_000, {}),
    event('assistant/message', 3, LEGACY_ROUTE_CUTOFF_MS, { message: { model: 'deepseek-v4.1-flash' }, usage }),
  ]))
  expect(folded.facts).toEqual([expect.objectContaining({ at: LEGACY_ROUTE_CUTOFF_MS - 10_000, legacy: true })])
})

it('prefers the per-key start over the latest start and only falls back with no start at all', () => {
  const first = base - 60_000
  const second = base - 30_000
  const folded = foldSession(snapshot([
    event('step/start', 1, first, { turn: 1, step: 1 }),
    event('step/end', 2, first + 10_000, { turn: 1, step: 1 }),
    event('step/start', 3, second, { turn: 2, step: 1 }),
    header('dsh-opencode-go', 4),
    event('assistant/message', 5, base, { turn: 2, step: 1, message: { model: 'deepseek-v4.1-flash' }, usage }),
    event('assistant/message', 6, base + 1_000, { message: { model: 'deepseek-v4.1-flash' }, usage }),
  ]))
  expect(folded.facts.map((fact) => fact.at)).toEqual([second, second])
})

// P13: ownership is half-open like the host's isOwnSeq — the boundary slot is own.

it('reads a real request/header sitting in the boundary slot', () => {
  const folded = foldSession(snapshot([
    message(0, base - 5_000),
    message(1, base - 4_000),
    header('dsh-opencode-go', 2),
    message(3, base),
  ], 2))
  expect(folded.facts).toHaveLength(1)
  expect(folded.unattributed).toEqual([])
})

it('ignores a fork end-seed in the boundary slot without polluting header state', () => {
  const folded = foldSession(snapshot([
    message(0, base - 5_000),
    message(1, base - 4_000),
    event('session/end-seed', 2, base - 3_000, { inherited: true }),
    header('dsh-opencode-go', 3),
    message(4, base),
  ], 2))
  expect(folded.facts).toHaveLength(1)
  expect(folded.unattributed).toEqual([])
  expect(folded.facts[0]).toMatchObject({ model: 'deepseek-v4.1-flash' })
})

// P11: the events count only covers events past the inherited prefix.

it('counts only events past the inherited prefix in the events budget', () => {
  const prefix = Array.from({ length: 9 }, (_, index) => event('assistant/message', index, base, {
    message: { model: 'parent' }, usage,
  }))
  const folded = foldSession(snapshot([
    ...prefix,
    header('dsh-opencode-go', 9),
    message(10),
    event('step/end', 11, base + 1, { turn: 1, step: 1 }),
  ], 9))
  expect(folded.events).toBe(3)
  expect(folded.facts).toHaveLength(1)
})

// U14: a headless attempt is unattributed, never silently dropped nor an attempt.

it('records a headless attempt as unattributed without counting it as an attempt', () => {
  const folded = foldSession(snapshot([
    event('assistant/attempt', 1, base, { turn: 1, step: 1, stream: [] }),
  ]))
  expect(folded.attempts).toEqual([])
  expect(folded.unattributed).toEqual([base])
})
