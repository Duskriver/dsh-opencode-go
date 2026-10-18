import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import { registerGoRemotes } from '../src/remotes.ts'
import {
  GoAnalyticsService,
  analyticsPriceBook,
  type AnalyticsOptions,
  type AnalyticsPriceBook,
  type AnalyticsSessionQuery,
  type AnalyticsSessionRecord,
} from '../src/analytics.ts'
import { parseAnalyticsQuery, parseAnalyticsReport, type AnalyticsQuery, type AnalyticsReport } from '../src/analytics-contract.ts'
import type { AnalyticsSnapshotLike } from '../src/analytics-scan.ts'

const T1 = Date.UTC(2026, 9, 19, 0, 30)
const LEGACY = Date.UTC(2026, 8, 25, 8, 0)
const SUMMARY = Date.UTC(2026, 9, 19, 1, 0)
const NOW = Date.UTC(2026, 9, 20, 0, 0)
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

function records(): AnalyticsSessionRecord[] {
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

/** A synthetic corpus: one closed session per index, `factsPer` requests each. */
function corpus(sessions: number, factsPer: number, base = T1): {
  records: AnalyticsSessionRecord[]
  snapshots: Record<string, { inheritedEventCount: number; events: unknown[] }>
} {
  const records: AnalyticsSessionRecord[] = []
  const snapshots: Record<string, { inheritedEventCount: number; events: unknown[] }> = {}
  for (let index = 0; index < sessions; index++) {
    const id = `session-bulk-${index}`
    const at = base - index * 1000
    const events: unknown[] = [header('dsh-opencode-go', 1, at)]
    for (let fact = 0; fact < factsPer; fact++) {
      events.push(message(2 + fact, at, { inputTokens: 100, outputTokens: 50 }))
    }
    snapshots[id] = { inheritedEventCount: 0, events }
    records.push({ header: { id, createdAt: at }, live: false, persisted: true })
  }
  return { records, snapshots }
}

const delay = (ms: number): Promise<void> => new Promise(resolve => { setTimeout(resolve, ms) })

async function harness(options: {
  query?: () => AnalyticsSessionQuery | undefined
  reads?: string[]
  records?: AnalyticsSessionRecord[] | { current: AnalyticsSessionRecord[] }
  snapshots?: Record<string, { inheritedEventCount: number; events: unknown[] }>
  now?: () => number
  readSession?: (id: string) => Promise<AnalyticsSnapshotLike>
  pricing?: () => Promise<AnalyticsPriceBook | undefined>
  limits?: Partial<Pick<AnalyticsOptions, 'budgetMs' | 'maxSessions' | 'maxEvents' | 'maxFacts' | 'maxConcurrency'>>
  order?: string[]
  listSignals?: (AbortSignal | undefined)[]
} = {}) {
  const ctx = new Context()
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  registerGoRemotes(ctx)
  const reads = options.reads ?? []
  const source = options.records ?? records()
  const tables = options.snapshots ?? snapshots
  const queryService: AnalyticsSessionQuery = {
    listSessions: async signal => {
      options.listSignals?.push(signal)
      return Array.isArray(source) ? source : source.current
    },
    readSession: options.readSession ?? (async id => {
      reads.push(id)
      const value = tables[id]
      if (value === undefined) throw new Error('missing fixture')
      return value as never
    }),
  }
  await ctx.plugin(GoAnalyticsService, {
    query: options.query ?? (() => queryService),
    pricing: options.pricing ?? (async () => pricing),
    now: options.now ?? (() => NOW),
    ...options.limits,
  })
  const read = async (value: AnalyticsQuery = query(), signal?: AbortSignal): Promise<AnalyticsReport> =>
    await ctx.typertGateway.invoke({
      namespace: 'opencodeGoAnalytics', method: 'read', args: { query: value },
      ...(signal === undefined ? {} : { signal }),
    }) as AnalyticsReport
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
      unreadSessions: 0, evictedSessions: 0, unattributedRequests: 0,
    })
    expect(report.coverage.listMs).toBeGreaterThanOrEqual(0)
    expect(report.coverage.pricingMs).toBeGreaterThanOrEqual(0)
    expect(report.coverage.scanMs).toBeGreaterThanOrEqual(0)
    expect(report.byModel).toHaveLength(1)
    expect(report.byModel[0]).toMatchObject({
      model: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash',
      limitGoUsd: 80, limitGoPlusUsd: 160, estimatedMicroUsd: 755_400,
    })
    expect(report.byDay.map(row => row.day)).toEqual(['2026-09-25', '2026-10-19'])
    expect(JSON.stringify(report)).not.toContain('session-secret')
  } finally { await ctx.fiber.dispose() }
})

// Migrated contract for the reuse rules (review P6 + P9/S2; this replaces the
// locked "live sessions always re-read" assertion): a live fold is reused
// inside a short window and re-folded once the window passes.
it('serves live sessions from the cache inside the reuse window and re-folds after it', async () => {
  let clock = NOW
  const { ctx, read, reads } = await harness({ now: () => clock })
  try {
    await read()
    await read()
    expect(reads.filter(id => id === 'session-secret-a')).toHaveLength(1)
    expect(reads.filter(id => id === 'session-secret-c')).toHaveLength(1)
    clock = NOW + 5001
    await read()
    expect(reads.filter(id => id === 'session-secret-a')).toHaveLength(1)
    expect(reads.filter(id => id === 'session-secret-c')).toHaveLength(2)
  } finally { await ctx.fiber.dispose() }
})

// Review P9/S2: a session that closes must be re-read once — its cached fold
// was taken while it was live — and settle on the closed cache afterwards.
it('re-reads a session once when it closes and then settles on the closed cache', async () => {
  const turning = {
    current: [{ header: { id: 'session-turning', createdAt: T1 }, live: true, persisted: true }],
  }
  const tables: Record<string, { inheritedEventCount: number; events: unknown[] }> = {
    'session-turning': { inheritedEventCount: 0, events: [header('dsh-opencode-go', 1, T1), message(2, T1, { inputTokens: 100, outputTokens: 50 })] },
  }
  const { ctx, read, reads } = await harness({ records: turning, snapshots: tables })
  try {
    const first = await read()
    expect(first.totals.requests).toBe(1)
    expect(reads).toEqual(['session-turning'])
    turning.current[0] = { ...turning.current[0], live: false }
    tables['session-turning'].events.push(message(3, T1 + 1000, { inputTokens: 100, outputTokens: 50 }))
    const second = await read()
    expect(second.totals.requests).toBe(2)
    expect(reads).toEqual(['session-turning', 'session-turning'])
    const third = await read()
    expect(third.totals.requests).toBe(2)
    expect(reads).toHaveLength(2)
  } finally { await ctx.fiber.dispose() }
})

it('reports truncation when the session cap stops the scan', async () => {
  const { ctx, read } = await harness()
  try {
    const report = await read(query({ maxSessions: 1 }))
    expect(report.coverage).toMatchObject({
      listedSessions: 3, scannedSessions: 1, truncated: true, truncation: 'sessions', unreadSessions: 2,
    })
  } finally { await ctx.fiber.dispose() }
})

it('reports sessions left unread when the event budget stops the scan', async () => {
  const { records: bulk, snapshots: tables } = corpus(3, 2)
  // Serial pool: the event budget is checked between reads, so a concurrent
  // pool may overshoot by its in-flight window (review S3 premise e).
  const { ctx, read } = await harness({ records: bulk, snapshots: tables, limits: { maxEvents: 2, maxConcurrency: 1 } })
  try {
    const report = await read()
    expect(report.coverage).toMatchObject({
      listedSessions: 3, scannedSessions: 1, truncated: true, truncation: 'events', unreadSessions: 2,
    })
  } finally { await ctx.fiber.dispose() }
})

// Review P3/C3/S1: the report is aggregated from run-local results, so a
// trim that runs at the end of a scan can never subtract sessions.
it('keeps every session in the report even when the cache is oversubscribed', async () => {
  const { records: bulk, snapshots: tables } = corpus(3, 2)
  const { ctx, read } = await harness({ records: bulk, snapshots: tables, limits: { maxFacts: 2 } })
  try {
    const report = await read()
    expect(report.totals.requests).toBe(6)
    expect(report.coverage).toMatchObject({
      scannedSessions: 3, matchedSessions: 3, truncated: false, evictedSessions: 2,
    })
  } finally { await ctx.fiber.dispose() }
})

it('keeps concurrent runs complete when they share the evictable cache', async () => {
  const { records: bulk, snapshots: tables } = corpus(3, 2)
  const { ctx, read } = await harness({ records: bulk, snapshots: tables, limits: { maxFacts: 2 } })
  try {
    const [left, right] = await Promise.all([read(), read(query({ timeZone: 'UTC' }))])
    expect(left.totals.requests).toBe(6)
    expect(right.totals.requests).toBe(6)
    expect(left.coverage.matchedSessions).toBe(3)
    expect(right.coverage.matchedSessions).toBe(3)
  } finally { await ctx.fiber.dispose() }
})

// Review U10: duplicate host ids must fold into one aggregation.
it('aggregates a duplicated session id once', async () => {
  const duplicated = [...records(), ...records()]
  const { ctx, read } = await harness({ records: duplicated })
  try {
    const report = await read()
    expect(report.totals.requests).toBe(3)
    expect(report.coverage.matchedSessions).toBe(3)
    expect(report.coverage.truncated).toBe(false)
  } finally { await ctx.fiber.dispose() }
})

// Review P2/M2: when the cache fits, the second run re-reads nothing.
it('serves the second run entirely from the cache when it fits', async () => {
  const { records: bulk, snapshots: tables } = corpus(5, 2)
  const { ctx, read, reads } = await harness({ records: bulk, snapshots: tables, limits: { maxFacts: 100 } })
  try {
    await read()
    await read()
    expect(reads).toHaveLength(5)
  } finally { await ctx.fiber.dispose() }
})

// Review P2/M2: oversubscribed cache — 10 facts cannot fit a 4-fact budget,
// so the end-of-run trim must evict some sessions; the invariants that matter
// are that no round degrades into the FIFO full rescan (round 1 reads all 5,
// later rounds serve the surviving entries and re-read only the evicted ones)
// and that every round still reports the complete totals.
it('breaks the FIFO full-rescan fixed point when the cache is oversubscribed', async () => {
  const { records: bulk, snapshots: tables } = corpus(5, 2)
  const { ctx, read, reads } = await harness({ records: bulk, snapshots: tables, limits: { maxFacts: 4 } })
  try {
    const perRound: string[][] = []
    for (let round = 0; round < 4; round++) {
      const before = reads.length
      const report = await read()
      perRound.push(reads.slice(before))
      expect(report.totals.requests).toBe(10)
      expect(report.coverage.matchedSessions).toBe(5)
      expect(report.coverage.truncated).toBe(false)
    }
    expect(perRound[0]).toHaveLength(5)
    for (const round of perRound.slice(1)) {
      expect(round.length).toBeGreaterThan(0)
      expect(round.length).toBeLessThanOrEqual(3)
    }
  } finally { await ctx.fiber.dispose() }
})

// Review P1/S3: reads overlap through a bounded pool and the aggregates stay
// identical to the serial scan.
it('reads sessions through a bounded concurrent pool', async () => {
  const { records: bulk, snapshots: tables } = corpus(12, 2)
  let inFlight = 0
  let maxInFlight = 0
  const { ctx, read } = await harness({
    records: bulk,
    snapshots: tables,
    readSession: async id => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await delay(15)
      inFlight--
      const value = tables[id]
      if (value === undefined) throw new Error('missing fixture')
      return value as never
    },
  })
  try {
    const report = await read()
    expect(maxInFlight).toBeGreaterThan(1)
    expect(maxInFlight).toBeLessThanOrEqual(8)
    expect(report.totals.requests).toBe(24)
    expect(report.coverage.scannedSessions).toBe(12)
    expect(report.coverage.failedSessions).toBe(0)
  } finally { await ctx.fiber.dispose() }
})

it('scans serially when the concurrency pool is disabled', async () => {
  const { records: bulk, snapshots: tables } = corpus(6, 2)
  let inFlight = 0
  let maxInFlight = 0
  const { ctx, read } = await harness({
    records: bulk,
    snapshots: tables,
    limits: { maxConcurrency: 1 },
    readSession: async id => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await delay(5)
      inFlight--
      const value = tables[id]
      if (value === undefined) throw new Error('missing fixture')
      return value as never
    },
  })
  try {
    const report = await read()
    expect(maxInFlight).toBe(1)
    expect(report.totals.requests).toBe(12)
  } finally { await ctx.fiber.dispose() }
})

// Review P18/C2: one hung read must hit its own share of the budget instead
// of stretching the scan to the wall clock; the gap is reported.
it('stops a hung read at its budget share and reports the gap', async () => {
  const { records: bulk, snapshots: tables } = corpus(2, 1)
  const started = Date.now()
  const { ctx, read } = await harness({
    records: bulk,
    snapshots: tables,
    now: () => Date.now(),
    limits: { budgetMs: 300, maxConcurrency: 1 },
    readSession: () => new Promise(() => {}),
  })
  try {
    const report = await read()
    expect(Date.now() - started).toBeLessThan(5000)
    expect(report.coverage).toMatchObject({
      listedSessions: 2, scannedSessions: 1, failedSessions: 1,
      truncated: true, truncation: 'time', unreadSessions: 1,
    })
    expect(report.totals.requests).toBe(0)
  } finally { await ctx.fiber.dispose() }
})

// Review P12: unattributed calls in range become a coverage counter only.
it('counts in-range unattributed calls without pricing them', async () => {
  // A message with no routing header at all cannot be attributed; a foreign
  // provider header would be skipped silently instead (isPluginRoute false).
  const orphan = [{
    header: { id: 'session-orphan', createdAt: T1 }, live: false, persisted: true,
  }]
  const tables = {
    'session-orphan': {
      inheritedEventCount: 0,
      events: [message(1, T1, { inputTokens: 500, outputTokens: 250 })],
    },
  }
  const { ctx, read } = await harness({ records: orphan, snapshots: tables })
  try {
    const report = await read()
    expect(report.coverage.unattributedRequests).toBe(1)
    expect(report.totals.requests).toBe(0)
    expect(report.totals.inputTokens).toBe(0)
    expect(report.coverage.matchedSessions).toBe(0)
  } finally { await ctx.fiber.dispose() }
})

// Review P15: an unavailable table must still name the models it failed to price.
it('lists models as unpriced when the whole price table is unavailable', async () => {
  const { ctx, read } = await harness({ pricing: async () => undefined })
  try {
    const report = await read()
    expect(report.pricing.unavailable).toBe(true)
    expect(report.pricing.unpricedModels).toEqual(['deepseek-v4.1-flash'])
    expect(report.totals.unpricedRequests).toBe(3)
    expect(report.totals.pricedRequests).toBe(0)
  } finally { await ctx.fiber.dispose() }
})

// Review P14 (core half): the price book builder drops the cost of models the
// metadata marked `costKnown: false`, while a legal all-zero block stays.
it('omits cost for models the metadata marked as unknown-price', () => {
  const book = analyticsPriceBook({
    models: new Map([
      ['free-known', { id: 'free-known', name: 'Free Known', cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
      ['bad-cost', { id: 'bad-cost', name: 'Bad Cost', cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
      ['priced', { id: 'priced', name: 'Priced', cost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 } }],
    ]),
    details: new Map([
      ['free-known', {}],
      ['bad-cost', { costKnown: false }],
      ['priced', {}],
    ]),
    metadataUpdatedAtMs: 1234,
  })
  expect(book.models.get('free-known')?.cost).toBeDefined()
  expect(book.models.get('bad-cost')?.cost).toBeUndefined()
  expect(book.models.get('priced')?.cost).toBeDefined()
  expect(book.updatedAt).toBe(1234)
})

it('prices metadata-marked models as unpriced end to end', async () => {
  const { ctx, read } = await harness({
    pricing: async () => analyticsPriceBook({
      models: new Map([
        ['deepseek-v4.1-flash', {
          id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash',
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        }],
      ]),
      details: new Map([['deepseek-v4.1-flash', { costKnown: false }]]),
    }),
  })
  try {
    const report = await read()
    expect(report.totals.pricedRequests).toBe(0)
    expect(report.totals.unpricedRequests).toBe(3)
    expect(report.pricing.unavailable).toBeUndefined()
    expect(report.pricing.unpricedModels).toEqual(['deepseek-v4.1-flash'])
  } finally { await ctx.fiber.dispose() }
})

// Review S4/P4: pricing is initiated before the scan loop, not after it.
it('initiates pricing before the scan loop', async () => {
  const { records: bulk, snapshots: tables } = corpus(3, 2)
  const order: string[] = []
  const { ctx, read } = await harness({
    records: bulk,
    snapshots: tables,
    order,
    pricing: async () => { order.push('pricing'); return pricing },
    readSession: async id => {
      order.push('read')
      await delay(5)
      const value = tables[id]
      if (value === undefined) throw new Error('missing fixture')
      return value as never
    },
  })
  try {
    await read()
    expect(order[0]).toBe('pricing')
    expect(order.filter(step => step === 'pricing')).toHaveLength(1)
  } finally { await ctx.fiber.dispose() }
})

// Review S4/P4: a failed pricing refresh prices against the last successful
// table, keeping its own updatedAt visible.
it('falls back to the last successful price table when pricing fails', async () => {
  let mode: 'ok' | 'reject' | 'empty' = 'ok'
  const { ctx, read } = await harness({
    pricing: async () => {
      if (mode === 'reject') throw new Error('models.dev unreachable')
      if (mode === 'empty') return undefined
      return { ...pricing, updatedAt: Date.UTC(2026, 9, 1) }
    },
  })
  try {
    const first = await read()
    expect(first.pricing.updatedAt).toBe(Date.UTC(2026, 9, 1))
    mode = 'reject'
    const second = await read()
    expect(second.pricing.unavailable).toBeUndefined()
    expect(second.pricing.updatedAt).toBe(Date.UTC(2026, 9, 1))
    expect(second.totals.pricedRequests).toBe(3)
    expect(second.totals.estimatedMicroUsd).toBe(755_400)
    mode = 'empty'
    const third = await read()
    expect(third.pricing.unavailable).toBeUndefined()
    expect(third.totals.pricedRequests).toBe(3)
  } finally { await ctx.fiber.dispose() }
})

// Review S6: segmented timing — scanMs excludes the pricing wait.
it('reports segmented timings where the scan excludes the pricing wait', async () => {
  const { ctx, read } = await harness({
    now: () => Date.now(),
    pricing: () => delay(400).then(() => pricing),
  })
  try {
    const report = await read()
    expect(report.coverage.listMs).toBeGreaterThanOrEqual(0)
    expect(report.coverage.pricingMs).toBeGreaterThanOrEqual(350)
    expect(report.coverage.scanMs).toBeLessThanOrEqual(300)
  } finally { await ctx.fiber.dispose() }
})

// Review M4: the listing receives the caller's signal, and an aborted read
// rejects promptly instead of scanning to the end.
it('passes cancellation through the scan and rejects promptly when aborted', async () => {
  const { records: bulk, snapshots: tables } = corpus(50, 1)
  const listSignals: (AbortSignal | undefined)[] = []
  let readCount = 0
  const { ctx, read } = await harness({
    records: bulk,
    snapshots: tables,
    listSignals,
    readSession: async id => {
      readCount++
      await delay(20)
      const value = tables[id]
      if (value === undefined) throw new Error('missing fixture')
      return value as never
    },
  })
  try {
    const controller = new AbortController()
    const pending = read(query(), controller.signal)
    await delay(80)
    expect(readCount).toBeGreaterThan(0)
    controller.abort()
    await expect(pending).rejects.toThrow()
    const atAbort = readCount
    await delay(80)
    expect(readCount).toBe(atAbort)
    expect(readCount).toBeLessThan(50)
    expect(listSignals.every(signal => signal instanceof AbortSignal)).toBe(true)
  } finally { await ctx.fiber.dispose() }
})

it('keeps single-argument reads working next to the cancellation parameter', async () => {
  const { ctx, read } = await harness()
  try {
    const report = await read(query(), new AbortController().signal)
    expect(report.totals.requests).toBe(3)
  } finally { await ctx.fiber.dispose() }
})

// Review M3: day buckets must be value-identical to per-fact formatting in
// every timezone, including half-hour offsets and DST transitions.
it('keeps day buckets identical to per-fact formatting across time zones', async () => {
  const instants = [
    Date.UTC(2026, 9, 31, 23, 0),
    Date.UTC(2026, 10, 1, 5, 0),
    Date.UTC(2026, 10, 1, 9, 0),
    Date.UTC(2026, 10, 2, 0, 30),
    Date.UTC(2026, 10, 2, 12, 0),
  ]
  const dstRecords = [{ header: { id: 'session-dst', createdAt: instants[0] }, live: false, persisted: true }]
  const dstSnapshots = {
    'session-dst': {
      inheritedEventCount: 0,
      events: [header('dsh-opencode-go', 1, instants[0]),
        ...instants.map((at, index) => message(2 + index, at, { inputTokens: 1000, outputTokens: 500 }))],
    },
  }
  const range = query({ from: Date.UTC(2026, 9, 30), to: Date.UTC(2026, 11, 1) })
  const reference = (timeZone: string): Map<string, number> => {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const days = new Map<string, number>()
    for (const at of instants) {
      const parts = formatter.formatToParts(new Date(at))
      const value = (type: string): string => parts.find(part => part.type === type)?.value ?? ''
      const key = value('year') + '-' + value('month') + '-' + value('day')
      days.set(key, (days.get(key) ?? 0) + 1)
    }
    return days
  }
  for (const timeZone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Chatham', 'Australia/Lord_Howe']) {
    const { ctx, read } = await harness({ records: dstRecords, snapshots: dstSnapshots })
    try {
      const report = await read({ ...range, timeZone })
      const expected = reference(timeZone)
      expect(report.byDay.map(row => row.day)).toEqual([...expected.keys()].sort())
      for (const row of report.byDay) {
        expect(row.requests).toBe(expected.get(row.day))
        expect(row.tokens).toBe(1500 * (expected.get(row.day) ?? 0))
      }
    } finally { await ctx.fiber.dispose() }
  }
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
