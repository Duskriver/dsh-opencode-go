import { context, mountRemotes, invokeRemote } from './support/host.ts'
import {
  GoAnalyticsService,
  analyticsPriceBook,
  type AnalyticsOptions,
  type AnalyticsPriceBook,
  type AnalyticsSessionQuery,
  type AnalyticsSessionRecord,
  type AnalyticsSnapshotLike,
  type AnalyticsQuery,
  type AnalyticsReport,
  foldSession,
  isPluginRoute,
  LEGACY_ROUTE_CUTOFF_MS,
  billedInput,
  isFreeCost,
  priceUsage,
} from '../src/analytics.ts'
import { parseAnalyticsReport } from '../src/contracts.ts'
import { expect, it, describe } from 'vitest'
import { readModelMetadata } from '../src/catalog.ts'
import { metadataDocument, modelMetadata } from './support/data.ts'

describe("session event folding", () => {
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

  it('records a headless attempt as unattributed without counting it as an attempt', () => {
    const folded = foldSession(snapshot([
      event('assistant/attempt', 1, base, { turn: 1, step: 1, stream: [] }),
    ]))
    expect(folded.attempts).toEqual([])
    expect(folded.unattributed).toEqual([base])
  })
})

describe("plan pricing", () => {
  const flash = { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 }

  const mondayOffPeak = Date.UTC(2026, 9, 19, 0, 30)

  const mondayPeak = Date.UTC(2026, 9, 19, 2, 0)

  const saturdayPeakHours = Date.UTC(2026, 9, 17, 2, 0)

  const oneMillionEach = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0 }

  it('prices tokens at catalog rates in micro-USD', () => {
    expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, mondayOffPeak)).toBe(753_000)
    expect(billedInput(oneMillionEach)).toBe(2_000_000)
  })

  it('doubles DeepSeek only inside the documented UTC peak windows', () => {
    expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, mondayPeak)).toBe(1_506_000)
    expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, Date.UTC(2026, 9, 19, 4, 0))).toBe(753_000)
    expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, saturdayPeakHours)).toBe(753_000)
    expect(priceUsage('glm-5.3', oneMillionEach, flash, mondayPeak)).toBe(753_000)
  })

  it('uses the highest matching context tier for the whole request', () => {
    const qwen = {
      input: 0.4, output: 1.6, cacheRead: 0.04, cacheWrite: 0.5,
      tiers: [{ inputTokensAbove: 256_000, input: 1.2, output: 4.8, cacheRead: 0.12, cacheWrite: 1.5 }],
    }
    const usage = { input: 300_000, output: 1_000, cacheRead: 0, cacheWrite: 0 }
    expect(priceUsage('qwen3.7-plus', usage, qwen, mondayOffPeak)).toBe(364_800)
    expect(priceUsage('qwen3.7-plus', { ...usage, input: 256_000 }, qwen, mondayOffPeak))
      .toBe(104_000)
  })

  it('treats an all-zero cost as free and never charges past it', () => {
    const free = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
    expect(isFreeCost(free)).toBe(true)
    expect(isFreeCost({ ...free, tiers: [{ inputTokensAbove: 1, ...free }] })).toBe(true)
    expect(priceUsage('longcat-2.5-preview-free', oneMillionEach, free, mondayPeak)).toBe(0)
    expect(isFreeCost(flash)).toBe(false)
  })

  describe('catalog metadata distinguishes unknown prices from genuinely free ones', () => {
    const base = 'https://gateway.example/v1'

    it('marks a missing or non-object cost block instead of reading it as free', () => {
      const result = readModelMetadata(metadataDocument({
        'no-cost-block': modelMetadata({ cost: undefined }),
        'non-object-cost': modelMetadata({ cost: 'free' }),
      }), base, new Map())
      expect(result.details.get('no-cost-block')?.costKnown).toBe(false)
      expect(result.details.get('non-object-cost')?.costKnown).toBe(false)
      // Neither route may make the model unavailable or drop its required cost:
      // the unpriced decision belongs to the analytics price book, not the catalog.
      for (const id of ['no-cost-block', 'non-object-cost']) {
        expect(result.errors.get(id)).toBeUndefined()
        expect(result.models.get(id)?.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
      }
    })

    it('marks a malformed rate component while the surviving components still parse', () => {
      const result = readModelMetadata(metadataDocument({
        'half-cost-model': modelMetadata({ cost: { input: 0.15, output: 'n/a', cache_read: 0.003, cache_write: 0 } }),
        'negative-cost': modelMetadata({ cost: { input: -1, output: 0.6, cache_read: 0, cache_write: 0 } }),
        'null-component': modelMetadata({ cost: { input: 0.15, output: 0.6, cache_read: null, cache_write: 0 } }),
      }), base, new Map())
      expect(result.details.get('half-cost-model')?.costKnown).toBe(false)
      expect(result.details.get('negative-cost')?.costKnown).toBe(false)
      expect(result.details.get('null-component')?.costKnown).toBe(false)
      for (const id of ['half-cost-model', 'negative-cost', 'null-component']) {
        expect(result.errors.get(id)).toBeUndefined()
        expect(result.models.get(id)).toHaveProperty('cost')
      }
      // Existing folding is unchanged: legal components keep their values, bad ones read 0.
      expect(result.models.get('half-cost-model')?.cost).toMatchObject({ input: 0.15, output: 0, cacheRead: 0.003 })
    })

    it('keeps a published all-zero block unmarked so free models stay unlimited', () => {
      const result = readModelMetadata(metadataDocument({
        // cache_write absent: an absent component folds to 0 and stays legal.
        'free-partial': modelMetadata({}),
        'free-explicit': modelMetadata({ cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } }),
      }), base, new Map())
      for (const id of ['free-partial', 'free-explicit']) {
        expect(result.details.get(id)?.costKnown).toBeUndefined()
        expect(result.errors.get(id)).toBeUndefined()
        // The documented free path survives: analytics keeps pricing these at 0.
        expect(isFreeCost(result.models.get(id)!.cost)).toBe(true)
      }
    })
  })
})

describe('local aggregate reports and memory cache', () => {
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
    const ctx = context()
    await mountRemotes(ctx)
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
      await invokeRemote(ctx, {
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

  it('reuses live and closed sessions for five seconds and re-reads both after expiry', async () => {
    let clock = NOW
    const { ctx, read, reads } = await harness({ now: () => clock,
    })
    try {
      await read()
      await read()
      expect(reads.filter(id => id === 'session-secret-a')).toHaveLength(1)
      expect(reads.filter(id => id === 'session-secret-c')).toHaveLength(1)
      clock = NOW + 5001
      await read()
      expect(reads.filter(id => id === 'session-secret-a')).toHaveLength(2)
      expect(reads.filter(id => id === 'session-secret-c')).toHaveLength(2)
    } finally { await ctx.fiber.dispose() }
  })

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

  it('serves the second run entirely from the cache when it fits', async () => {
    const { records: bulk, snapshots: tables } = corpus(5, 2)
    const { ctx, read, reads } = await harness({ records: bulk, snapshots: tables, limits: { maxFacts: 100 } })
    try {
      await read()
      await read()
      expect(reads).toHaveLength(5)
    } finally { await ctx.fiber.dispose() }
  })

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
})
