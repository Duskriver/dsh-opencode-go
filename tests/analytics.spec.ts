import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import { registerGoRemotes } from '../src/remotes.ts'
import { GoAnalyticsService, type AnalyticsSessionQuery } from '../src/analytics.ts'
import { parseAnalyticsQuery, parseAnalyticsReport, type AnalyticsQuery } from '../src/analytics-contract.ts'

const T1 = Date.UTC(2026, 9, 19, 0, 30)
const LEGACY = Date.UTC(2026, 8, 25, 8, 0)
const SUMMARY = Date.UTC(2026, 9, 19, 1, 0)
const RANGE = { from: Date.UTC(2026, 8, 1), to: Date.UTC(2026, 9, 20) }
const event = (type: string, seq: number, time: number, data?: unknown) => ({ type, seq, time, data })
const header = (provider: string, seq: number, at: number) =>
  event('request/header', seq, at, { header: { config: { provider, model: 'deepseek-v4.1-flash' } }, reason: 'initial' })
const message = (seq: number, at: number, usage: unknown) => event('assistant/message', seq, at, {
  turn: 1, step: 1, message: { model: 'deepseek-v4.1-flash' }, usage,
})
const big = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 }
const pricing = {
  models: new Map([
    ['deepseek-v4.1-flash', {
      id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash',
      cost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 },
    }],
  ]),
}
const query = (overrides: Partial<AnalyticsQuery> = {}): AnalyticsQuery =>
  ({ ...RANGE, timeZone: 'Asia/Shanghai', ...overrides })

function records() {
  return [
    { header: { id: 'session-secret-a', createdAt: T1 - 1000 }, live: false, persisted: true },
    { header: { id: 'session-secret-b', createdAt: LEGACY - 1000 }, live: false, persisted: true },
    { header: { id: 'session-secret-c', createdAt: SUMMARY - 1000 }, live: true, persisted: true },
  ]
}

const snapshots: Record<string, { inheritedEventCount: number; events: unknown[] }> = {
  'session-secret-a': { inheritedEventCount: 0, events: [header('dsh-opencode-go', 1, T1), message(2, T1, big)] },
  'session-secret-b': { inheritedEventCount: 0, events: [header('opencode-go', 1, LEGACY), message(2, LEGACY, { inputTokens: 1000, outputTokens: 500 })] },
  'session-secret-c': { inheritedEventCount: 0, events: [event('compaction/summary', 1, SUMMARY, { provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', usage: { inputTokens: 1000, outputTokens: 1000 } })] },
}

async function harness(options: { query?: () => AnalyticsSessionQuery | undefined; reads?: string[]; records?: ReturnType<typeof records> } = {}) {
  const ctx = new Context()
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  const reads = options.reads ?? []
  const queryService: AnalyticsSessionQuery = {
    listSessions: async () => options.records ?? records(),
    readSession: async id => {
      reads.push(id)
      const value = snapshots[id]
      if (value === undefined) throw new Error('missing fixture')
      return value as never
    },
  }
  await ctx.plugin(GoAnalyticsService, {
    query: options.query ?? (() => queryService),
    pricing: async () => pricing,
    now: () => Date.UTC(2026, 9, 20, 0, 0),
  })
  const read = (value: AnalyticsQuery = query()) =>
    ctx.typertGateway.invoke({ namespace: 'opencodeGoAnalytics', method: 'read', args: { query: value } })
  return { ctx, read, reads }
}

it('returns priced tokens, limits, summaries and legacy records through the RPC gateway', async () => {
  const { ctx, read } = await harness()
  try {
    const report = await read()
    parseAnalyticsReport(report)
    expect(report.totals).toMatchObject({
      requests: 3, summaries: 1, missingUsage: 0,
      inputTokens: 1_002_000, outputTokens: 1_001_500, cacheReadTokens: 1_000_000,
      pricedRequests: 3, unpricedRequests: 0, estimatedMicroUsd: 755_400,
    })
    expect(report.coverage).toMatchObject({
      listedSessions: 3, scannedSessions: 3, matchedSessions: 3, legacyRequests: 1, summaries: 1,
    })
    expect(report.byModel).toHaveLength(1)
    expect(report.byModel[0]).toMatchObject({
      model: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash',
      limitGoUsd: 80, limitGoPlusUsd: 160, estimatedMicroUsd: 755_400,
    })
    expect(report.byDay.map(row => row.day)).toEqual(['2026-09-25', '2026-10-19'])
    expect(JSON.stringify(report)).not.toContain('session-secret')
  } finally { await ctx.fiber.dispose() }
})

it('caches closed sessions and re-reads live ones', async () => {
  const { ctx, read, reads } = await harness()
  try {
    await read()
    await read()
    expect(reads.filter(id => id === 'session-secret-a')).toHaveLength(1)
    expect(reads.filter(id => id === 'session-secret-c')).toHaveLength(2)
  } finally { await ctx.fiber.dispose() }
})

it('reports truncation when the session cap stops the scan', async () => {
  const { ctx, read } = await harness()
  try {
    const report = await read(query({ maxSessions: 1 }))
    expect(report.coverage).toMatchObject({
      listedSessions: 3, scannedSessions: 1, truncated: true, truncation: 'sessions',
    })
  } finally { await ctx.fiber.dispose() }
})

it('refuses a Host without session history', async () => {
  const { ctx, read } = await harness({ query: () => undefined })
  try {
    await expect(read()).rejects.toMatchObject({
      code: 'opencode-go/analytics-unavailable',
      details: { reason: 'no-session-query', retryable: false },
    })
  } finally { await ctx.fiber.dispose() }
})

it('rejects malformed queries and reports instead of trusting the wire', () => {
  expect(parseAnalyticsQuery(query())).toEqual(query())
  for (const value of [null, {}, { from: 10, to: 10, timeZone: 'UTC' }, { ...query(), timeZone: 'bad zone' }]) {
    expect(() => parseAnalyticsQuery(value)).toThrow('Invalid analytics')
  }
  expect(() => parseAnalyticsQuery(query({ maxSessions: 5000 }))).toThrow('Invalid analytics')
  expect(() => parseAnalyticsReport({})).toThrow('Invalid analytics')
})
