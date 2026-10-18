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
