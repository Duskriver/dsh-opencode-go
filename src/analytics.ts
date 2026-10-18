/**
 * Host-side usage analytics: scan the live-preferred session corpus through
 * ctx.sessionQuery, fold each log into request facts, price them with the
 * catalog's rates, and return aggregate numbers only.
 *
 * Closed sessions are cached for the process lifetime; live sessions are
 * re-read on every query. A scan stops at a session/event/time budget and says
 * so rather than silently reporting a partial total as complete.
 *
 * @module dsh-opencode-go/analytics
 */

import type { Context } from '@deepseek-ai/cordis'
import { RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  parseAnalyticsQuery,
  type AnalyticsDayRow,
  type AnalyticsModelRow,
  type AnalyticsQuery,
  type AnalyticsReport,
  type AnalyticsTotals,
} from './analytics-contract.ts'
import { foldSession, type AnalyticsSnapshotLike, type FoldedSession, type RequestFact } from './analytics-scan.ts'
import { isFreeCost, priceUsage, type ModelCostLike, type UsageCounts } from './analytics-pricing.ts'
import { goMonthlyLimit } from './go-plan.ts'

/** Structural face of one sessionQuery record. */
export interface AnalyticsSessionRecord {
  readonly header?: { readonly id?: string; readonly createdAt?: number }
  readonly live?: boolean
  readonly persisted?: boolean
}

/** The subset of ctx.sessionQuery this service needs. */
export interface AnalyticsSessionQuery {
  listSessions(signal?: AbortSignal): Promise<readonly AnalyticsSessionRecord[]>
  readSession(id: string): Promise<AnalyticsSnapshotLike>
}

/** Structural face of one catalog model. */
export interface AnalyticsPricingModel {
  readonly id?: string
  readonly name?: string
  readonly cost?: ModelCostLike
}

/** Pricing data and its last update, when known. */
export interface AnalyticsPriceBook {
  readonly models: ReadonlyMap<string, AnalyticsPricingModel>
  readonly updatedAt?: number
}

/** Construction options; tests inject fakes for every seam. */
export interface AnalyticsOptions {
  query: () => AnalyticsSessionQuery | undefined
  pricing: () => Promise<AnalyticsPriceBook | undefined>
  now?: () => number
  budgetMs?: number
  maxSessions?: number
  maxEvents?: number
  maxFacts?: number
}

const DEFAULT_BUDGET_MS = 12_000
const DEFAULT_MAX_SESSIONS = 500
const DEFAULT_MAX_EVENTS = 500_000
const DEFAULT_MAX_FACTS = 200_000
const MAX_CACHE_SESSIONS = 2000
const PRICING_TIMEOUT_MS = 4000

interface CachedSession {
  readonly createdAt: number
  readonly facts: FoldedSession
  readonly live: boolean
}

interface ModelAccumulator {
  readonly model: string
  requests: number
  missingUsage: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedMicroUsd: number
  pricedRequests: number
  unpricedRequests: number
}

interface DayAccumulator {
  requests: number
  tokens: number
  estimatedMicroUsd: number
}

function idOf(record: AnalyticsSessionRecord): string | undefined {
  const id = record.header?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

function createdAtOf(record: AnalyticsSessionRecord): number {
  const createdAt = record.header?.createdAt
  return typeof createdAt === 'number' && Number.isSafeInteger(createdAt) && createdAt >= 0 ? createdAt : 0
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('pricing request timed out')) }, ms)
    const clear = (): void => { clearTimeout(timer) }
    promise.then(value => { clear(); resolve(value) }, error => { clear(); reject(error) })
    ;(timer as { unref?: () => void }).unref?.()
  })
}

function resolveTimeZone(value: string): { name: string; fallback: boolean } {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(0)
    return { name: value, fallback: false }
  } catch {
    return { name: 'UTC', fallback: true }
  }
}

function dayKey(at: number, formatter: Intl.DateTimeFormat): string {
  const parts = formatter.formatToParts(new Date(at))
  const value = (type: string): string => parts.find(part => part.type === type)?.value ?? ''
  return value('year') + '-' + value('month') + '-' + value('day')
}

function usageOf(fact: RequestFact): UsageCounts {
  return { input: fact.input, output: fact.output, cacheRead: fact.cacheRead, cacheWrite: fact.cacheWrite }
}

/** One mount owns the scan cache; multiple dashboard opens share it. */
export class GoAnalyticsService extends TypertRemoteService {
  private readonly cache = new Map<string, CachedSession>()
  private readonly pending = new Map<string, Promise<AnalyticsReport>>()
  private factTotal = 0

  constructor(ctx: Context, private readonly options: AnalyticsOptions) {
    super(ctx, 'opencodeGoAnalytics')
  }

  /**
   * Read one aggregate report.
   * @param raw - the validated query from the RPC codec.
   * @returns the report; failures carry a reason in the domain error details.
   */
  async read(raw: AnalyticsQuery): Promise<AnalyticsReport> {
    let query: AnalyticsQuery
    try {
      query = parseAnalyticsQuery(raw)
    } catch (error: unknown) {
      throw new RemoteError('opencode-go/analytics-unavailable', 'Invalid analytics range', {
        reason: 'invalid-range', retryable: false,
      }, { cause: error })
    }
    const key = JSON.stringify(query)
    const shared = this.pending.get(key)
    if (shared !== undefined) return shared
    const pending = this.run(query).finally(() => { this.pending.delete(key) })
    this.pending.set(key, pending)
    return pending
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  private limitOf(name: 'budgetMs' | 'maxSessions' | 'maxEvents' | 'maxFacts', fallback: number): number {
    const value = this.options[name]
    return value === undefined ? fallback : value
  }

  private async run(query: AnalyticsQuery): Promise<AnalyticsReport> {
    const queryService = this.options.query()
    if (queryService === undefined) {
      throw new RemoteError('opencode-go/analytics-unavailable', 'Session history is unavailable on this Host', {
        reason: 'no-session-query', retryable: false,
      })
    }
    let listed: readonly AnalyticsSessionRecord[]
    try {
      listed = await queryService.listSessions()
    } catch (error: unknown) {
      throw new RemoteError('opencode-go/analytics-unavailable', 'Could not list local sessions', {
        reason: 'scan-failed', retryable: true,
      }, { cause: error })
    }

    const zone = resolveTimeZone(query.timeZone)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone.name, year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const started = this.now()
    const budgetMs = this.limitOf('budgetMs', DEFAULT_BUDGET_MS)
    const maxEvents = this.limitOf('maxEvents', DEFAULT_MAX_EVENTS)
    const maxSessionCount = Math.min(query.maxSessions ?? this.limitOf('maxSessions', DEFAULT_MAX_SESSIONS), 2000)
    const ordered = [...listed].sort((left, right) => {
      const live = Number(right.live === true) - Number(left.live === true)
      return live !== 0 ? live : createdAtOf(right) - createdAtOf(left)
    })
    const targets = ordered.slice(0, maxSessionCount)

    let scanned = 0
    let events = 0
    let newEvents = 0
    let failed = 0
    let stopped: 'time' | 'events' | undefined
    for (const record of targets) {
      const id = idOf(record)
      if (id === undefined) { scanned++; failed++; continue }
      const live = record.live === true
      const cached = this.cache.get(id)
      if (cached !== undefined && !live) {
        scanned++
        events += cached.facts.events
        continue
      }
      if (this.now() - started > budgetMs) { stopped = 'time'; break }
      if (newEvents > maxEvents) { stopped = 'events'; break }
      try {
        const snapshot = await queryService.readSession(id)
        const facts = foldSession(snapshot)
        scanned++
        events += facts.events
        newEvents += facts.events
        this.remember(id, createdAtOf(record), facts, live)
      } catch {
        scanned++
        failed++
      }
    }

    let priceBook: AnalyticsPriceBook | undefined
    let pricingUnavailable = false
    try {
      priceBook = await withTimeout(this.options.pricing(), PRICING_TIMEOUT_MS)
      if (priceBook === undefined) pricingUnavailable = true
    } catch {
      pricingUnavailable = true
    }

    const totals: AnalyticsTotals = {
      requests: 0, unsettledAttempts: 0, summaries: 0,
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
      estimatedMicroUsd: 0, pricedRequests: 0, unpricedRequests: 0, missingUsage: 0,
    }
    const models = new Map<string, ModelAccumulator>()
    const days = new Map<string, DayAccumulator>()
    const unpriced = new Set<string>()
    let matchedSessions = 0
    let legacyRequests = 0

    for (const record of targets) {
      const id = idOf(record)
      if (id === undefined) continue
      const cached = this.cache.get(id)
      if (cached === undefined) continue
      let matched = false
      for (const fact of cached.facts.facts) {
        if (fact.at < query.from || fact.at >= query.to) continue
        matched = true
        const model = fact.model
        let row = models.get(model)
        if (row === undefined) {
          row = {
            model, requests: 0, missingUsage: 0, inputTokens: 0, outputTokens: 0,
            cacheReadTokens: 0, cacheWriteTokens: 0, estimatedMicroUsd: 0,
            pricedRequests: 0, unpricedRequests: 0,
          }
          models.set(model, row)
        }
        row.requests++
        totals.requests++
        if (fact.kind === 'summary') totals.summaries++
        if (fact.legacy) legacyRequests++
        let tokens = 0
        let micro = 0
        if (fact.missingUsage) {
          totals.missingUsage++
          row.missingUsage++
        } else {
          tokens = fact.input + fact.output + fact.cacheRead + fact.cacheWrite
          totals.inputTokens += fact.input
          totals.outputTokens += fact.output
          totals.cacheReadTokens += fact.cacheRead
          totals.cacheWriteTokens += fact.cacheWrite
          row.inputTokens += fact.input
          row.outputTokens += fact.output
          row.cacheReadTokens += fact.cacheRead
          row.cacheWriteTokens += fact.cacheWrite
          const cost = priceBook?.models.get(model)?.cost
          if (cost === undefined) {
            totals.unpricedRequests++
            row.unpricedRequests++
            if (priceBook !== undefined) unpriced.add(model)
          } else {
            micro = priceUsage(model, usageOf(fact), cost, fact.at)
            totals.estimatedMicroUsd += micro
            totals.pricedRequests++
            row.estimatedMicroUsd += micro
            row.pricedRequests++
          }
        }
        const day = dayKey(fact.at, formatter)
        let bucket = days.get(day)
        if (bucket === undefined) { bucket = { requests: 0, tokens: 0, estimatedMicroUsd: 0 }; days.set(day, bucket) }
        bucket.requests++
        bucket.tokens += tokens
        bucket.estimatedMicroUsd += micro
      }
      for (const at of cached.facts.attempts) {
        if (at < query.from || at >= query.to) continue
        matched = true
        totals.unsettledAttempts++
      }
      if (matched) matchedSessions++
    }

    const byModel: AnalyticsModelRow[] = [...models.values()].map((row) => {
      const limit = goMonthlyLimit(row.model)
      const priced = priceBook?.models.get(row.model)
      const note: AnalyticsModelRow['limitNote'] = limit?.note
        ?? (limit === undefined
          ? (priced?.cost !== undefined && isFreeCost(priced.cost) ? 'unlimited' : 'unknown')
          : undefined)
      const result: AnalyticsModelRow = {
        model: row.model,
        ...(priced?.name === undefined ? {} : { name: priced.name }),
        requests: row.requests,
        missingUsage: row.missingUsage,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheReadTokens: row.cacheReadTokens,
        cacheWriteTokens: row.cacheWriteTokens,
        estimatedMicroUsd: row.estimatedMicroUsd,
        pricedRequests: row.pricedRequests,
        unpricedRequests: row.unpricedRequests,
        limitGoUsd: limit?.go ?? null,
        limitGoPlusUsd: limit?.goPlus ?? null,
        ...(note === undefined ? {} : { limitNote: note }),
      }
      return result
    }).sort((left, right) => right.estimatedMicroUsd - left.estimatedMicroUsd
      || right.requests - left.requests || left.model.localeCompare(right.model))

    const byDay: AnalyticsDayRow[] = [...days.entries()]
      .map(([day, row]) => ({ day, requests: row.requests, tokens: row.tokens, estimatedMicroUsd: row.estimatedMicroUsd }))
      .sort((left, right) => left.day.localeCompare(right.day))

    const truncation = stopped ?? (ordered.length > targets.length ? 'sessions' as const : undefined)
    const truncated = truncation !== undefined
    const report: AnalyticsReport = {
      generatedAt: this.now(),
      range: { from: query.from, to: query.to },
      timeZone: zone.name,
      totals,
      byModel,
      byDay,
      coverage: {
        listedSessions: listed.length,
        scannedSessions: scanned,
        matchedSessions,
        failedSessions: failed,
        eventsScanned: events,
        summaries: totals.summaries,
        legacyRequests,
        missingUsage: totals.missingUsage,
        truncated,
        ...(truncation === undefined ? {} : { truncation }),
        scanMs: Math.max(0, this.now() - started),
        ...(zone.fallback ? { timeZoneFallback: true as const } : {}),
      },
      pricing: {
        source: 'models.dev',
        ...(priceBook?.updatedAt === undefined ? {} : { updatedAt: priceBook.updatedAt }),
        ...(pricingUnavailable ? { unavailable: true as const } : {}),
        unpricedModels: [...unpriced].sort().slice(0, 64),
      },
    }
    return report
  }

  private remember(id: string, createdAt: number, facts: FoldedSession, live: boolean): void {
    const previous = this.cache.get(id)
    if (previous !== undefined) this.factTotal -= previous.facts.facts.length
    this.cache.set(id, { createdAt, facts, live })
    this.factTotal += facts.facts.length
    const maxFacts = this.limitOf('maxFacts', DEFAULT_MAX_FACTS)
    while (this.cache.size > MAX_CACHE_SESSIONS || this.factTotal > maxFacts) {
      const first = this.cache.keys().next().value as string | undefined
      if (first === undefined) break
      const entry = this.cache.get(first)
      if (entry !== undefined) this.factTotal -= entry.facts.facts.length
      this.cache.delete(first)
    }
  }
}
