/**
 * Host-side usage analytics: scan the live-preferred session corpus through
 * ctx.sessionQuery, fold each log into request facts, price them with the
 * catalog's rates, and return aggregate numbers only.
 *
 * Closed sessions are cached for the process lifetime under an LRU policy
 * whose eviction runs once, at the end of a scan (review P2/M2/S1); a live
 * session's fold is reused only inside a short window (review P6), and a
 * session that closes is re-read once before its closed cache entry takes
 * over (review P9/S2). Aggregation consumes run-local fold results, so a
 * mid-scan eviction can never subtract a session from the report it was read
 * for (review P3/C3/S1). Reads run through a bounded, configurable pool
 * (review P1/S3), each read carrying its own share of the time budget
 * (review P18/C2), and pricing is fetched in parallel with the scan with a
 * stale-on-error fallback to the last successful table (review P4/S4).
 * A scan stops at a session/event/time budget and says so rather than
 * silently reporting a partial total as complete.
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

/** Structural face of the catalog data the price book builder consumes. */
export interface AnalyticsCatalogSnapshotLike {
  readonly models: ReadonlyMap<string, AnalyticsPricingModel>
  readonly details?: ReadonlyMap<string, { readonly costKnown?: false }>
  readonly metadataUpdatedAtMs?: number
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
  /**
   * Maximum concurrent session reads (review P1/S3). One or less scans
   * serially — the rollback path for a Host whose readSession cannot run
   * concurrently.
   */
  maxConcurrency?: number
}

const DEFAULT_BUDGET_MS = 12_000
const DEFAULT_MAX_SESSIONS = 500
const DEFAULT_MAX_EVENTS = 500_000
const DEFAULT_MAX_FACTS = 200_000
const DEFAULT_MAX_CONCURRENCY = 8
const MAX_CACHE_SESSIONS = 2000
const PRICING_TIMEOUT_MS = 4000
/** A live session's cached fold is reused at most this long (review P6). */
const LIVE_REUSE_MS = 5000

interface CachedSession {
  readonly createdAt: number
  readonly facts: FoldedSession
  readonly live: boolean
  /** When the fold was stored; drives the live reuse window (review P6). */
  readonly storedAt: number
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

/** A budget deadline or caller cancellation beat the wrapped promise. */
class AnalyticsDeadlineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnalyticsDeadlineError'
  }
}

function idOf(record: AnalyticsSessionRecord): string | undefined {
  const id = record.header?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

function createdAtOf(record: AnalyticsSessionRecord): number {
  const createdAt = record.header?.createdAt
  return typeof createdAt === 'number' && Number.isSafeInteger(createdAt) && createdAt >= 0 ? createdAt : 0
}

function abortOf(signal: AbortSignal): unknown {
  return signal.reason ?? new Error('analytics read aborted')
}

/**
 * Reject when `ms` elapses first, and reject as soon as `signal` aborts
 * (review M4). The underlying promise is not cancelled — nothing awaits it
 * after this settles, and the caller's own abort handling stops the scan.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => { settle(new AnalyticsDeadlineError(message)) }, ms)
    const onAbort = (): void => { settle(abortOf(signal!)) }
    const detach = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const settle = (error: unknown): void => {
      if (settled) return
      settled = true
      detach()
      reject(error)
    }
    promise.then(value => {
      if (settled) return
      settled = true
      detach()
      resolve(value)
    }, error => { settle(error) })
    if (signal?.aborted === true) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
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

/**
 * One query timezone's day boundaries over [from, to): the first instant of
 * each local date and its YYYY-MM-DD key (review M3). Built once per query —
 * at most one entry per day of the capped 366-day range — so per-fact
 * formatToParts calls disappear. Local dates are monotone in time (a DST
 * repeat stays inside one date; a gap jumps to the next), so a fact's bucket
 * is exactly what a per-fact formatter call would return.
 */
interface DayBuckets {
  readonly starts: number[]
  readonly keys: string[]
}

function nextDay(day: string): string {
  // Shift the calendar date by one UTC day; the UTC calendar has no DST.
  return new Date(Date.parse(day + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10)
}

/** First instant whose local date is `day`, by binary search (review M3). */
function firstInstantOf(day: string, formatter: Intl.DateTimeFormat): number {
  // Every real zone offset lies in [-12h, +14h], so the first instant of a
  // local date lies in this window around the day's UTC midnight; `low` is
  // always the previous local date and `high` never before `day`.
  const midnight = Date.parse(day + 'T00:00:00Z')
  let low = midnight - 14 * 3_600_000
  let high = midnight + 15 * 3_600_000
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (dayKey(mid, formatter) >= day) high = mid
    else low = mid + 1
  }
  return low
}

function localDayBuckets(from: number, to: number, formatter: Intl.DateTimeFormat): DayBuckets {
  const starts: number[] = []
  const keys: string[] = []
  let day = dayKey(from, formatter)
  while (starts.length < 367) {
    const start = firstInstantOf(day, formatter)
    if (start >= to) break
    starts.push(start)
    keys.push(day)
    day = nextDay(day)
  }
  return { starts, keys }
}

/** The bucket index of `at`; callers only pass instants inside [from, to). */
function bucketIndexOf(buckets: DayBuckets, at: number): number {
  let low = 0
  let high = buckets.starts.length - 1
  let index = 0
  while (low <= high) {
    const mid = (low + high) >> 1
    if (buckets.starts[mid] <= at) { index = mid; low = mid + 1 } else high = mid - 1
  }
  return index
}

/**
 * M3: order a fold's facts by `at` ascending so every query binary-searches
 * its range. The fold order was never contractual and every aggregate output
 * is re-sorted, so the array shared with the cache is sorted in place once.
 */
function sortedFacts(folded: FoldedSession): FoldedSession {
  const facts = folded.facts
  let ordered = true
  for (let index = 1; index < facts.length; index++) {
    if (facts[index].at < facts[index - 1].at) { ordered = false; break }
  }
  if (!ordered) facts.sort((left, right) => left.at - right.at)
  return folded
}

function lowerBound(facts: readonly RequestFact[], from: number): number {
  let low = 0
  let high = facts.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (facts[mid].at < from) low = mid + 1
    else high = mid
  }
  return low
}

function usageOf(fact: RequestFact): UsageCounts {
  return { input: fact.input, output: fact.output, cacheRead: fact.cacheRead, cacheWrite: fact.cacheWrite }
}

/**
 * Build the analytics price book from one catalog snapshot (review P14 core
 * half). A model the metadata marked `costKnown: false` — upstream published
 * no cost block, or a malformed one whose fabricated zeros are
 * indistinguishable from a genuinely free model — is entered without a cost,
 * so its requests land in the unpriced bucket instead of being priced at 0.
 * A published block with legal components stays priced even when all zero.
 */
export function analyticsPriceBook(snapshot: AnalyticsCatalogSnapshotLike): AnalyticsPriceBook {
  const models = new Map<string, AnalyticsPricingModel>()
  for (const [id, model] of snapshot.models) {
    models.set(id, {
      ...(model.id === undefined ? {} : { id: model.id }),
      ...(model.name === undefined ? {} : { name: model.name }),
      ...(snapshot.details?.get(id)?.costKnown === false ? {} : { cost: model.cost }),
    })
  }
  return {
    models,
    ...(snapshot.metadataUpdatedAtMs === undefined ? {} : { updatedAt: snapshot.metadataUpdatedAtMs }),
  }
}

/** One mount owns the scan cache; multiple dashboard opens share it. */
export class GoAnalyticsService extends TypertRemoteService {
  private readonly cache = new Map<string, CachedSession>()
  private readonly pending = new Map<string, Promise<AnalyticsReport>>()
  /** The most recent successful price table; stale-on-error fallback (review P4/S4). */
  private lastPriceBook: AnalyticsPriceBook | undefined
  private factTotal = 0

  constructor(ctx: Context, private readonly options: AnalyticsOptions) {
    super(ctx, 'opencodeGoAnalytics')
  }

  /**
   * Read one aggregate report.
   * @param raw - the validated query from the RPC codec.
   * @param signal - caller cancellation, injected by the gateway after the
   *   business parameters and never carried on the wire.
   * @returns the report; failures carry a reason in the domain error details.
   */
  async read(raw: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsReport> {
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
    // In-flight dedup, not a result cache: the first caller's signal drives the
    // shared run; a caller joining an in-flight read shares its fate.
    const pending = this.run(query, signal).finally(() => { this.pending.delete(key) })
    this.pending.set(key, pending)
    return pending
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  private limitOf(name: 'budgetMs' | 'maxSessions' | 'maxEvents' | 'maxFacts' | 'maxConcurrency', fallback: number): number {
    const value = this.options[name]
    return value === undefined ? fallback : value
  }

  private async run(query: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsReport> {
    const queryService = this.options.query()
    if (queryService === undefined) {
      throw new RemoteError('opencode-go/analytics-unavailable', 'Session history is unavailable on this Host', {
        reason: 'no-session-query', retryable: false,
      })
    }
    const listStarted = this.now()
    let listed: readonly AnalyticsSessionRecord[]
    try {
      listed = await queryService.listSessions(signal)
    } catch (error: unknown) {
      if (signal?.aborted === true) throw abortOf(signal)
      throw new RemoteError('opencode-go/analytics-unavailable', 'Could not list local sessions', {
        reason: 'scan-failed', retryable: true,
      }, { cause: error })
    }
    const listMs = Math.max(0, this.now() - listStarted)

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

    // S1/P3/C3: every fold result this run may report, keyed by session id and
    // including cache hits — aggregation never reads the evictable cache, so a
    // concurrent run's remember()/trim() cannot subtract a session from this
    // report. Keys are unique, which also folds any duplicate host ids (U10).
    const local = new Map<string, FoldedSession>()
    let scanned = 0
    let events = 0
    let newEvents = 0
    let failed = 0
    let stopped: 'time' | 'events' | undefined
    let abortReason: { reason: unknown } | undefined

    // S4/P4: pricing does not depend on the scan — start it now, harvest after
    // the loop, so a cold catalog overlaps the reads instead of extending them.
    const pricingStarted = this.now()
    const pricingPromise = this.options.pricing()
    // A run that aborts before harvesting must not leave an unhandled rejection.
    pricingPromise.catch(() => {})

    const scanRecord = async (record: AnalyticsSessionRecord): Promise<void> => {
      const id = idOf(record)
      if (id === undefined) { scanned++; failed++; return }
      const live = record.live === true
      const cached = this.cache.get(id)
      // S2/P9 + P6: a closed record must not serve a fold captured while the
      // session was live, and a live session's fold is reused only inside the
      // short window; anything else re-reads once and re-folds.
      const reusable = cached !== undefined
        && ((!live && !cached.live)
          || (live && cached.live && this.now() - cached.storedAt < LIVE_REUSE_MS))
      if (reusable && cached !== undefined) {
        // LRU touch (P2/M2): a hit moves the entry to the tail.
        this.cache.delete(id)
        this.cache.set(id, cached)
        scanned++
        events += cached.facts.events
        local.set(id, sortedFacts(cached.facts))
        return
      }
      if (this.now() - started > budgetMs) { stopped = 'time'; return }
      if (newEvents > maxEvents) { stopped = 'events'; return }
      // C2: each read carries its own remaining share of the budget, so one
      // hung read cannot stretch the scan past it.
      const remaining = budgetMs - (this.now() - started)
      try {
        const snapshot = await withTimeout(
          queryService.readSession(id), Math.max(1, remaining), 'session read timed out', signal)
        const facts = foldSession(snapshot)
        scanned++
        events += facts.events
        newEvents += facts.events
        this.remember(id, createdAtOf(record), facts, live, this.now())
        local.set(id, sortedFacts(facts))
      } catch (error: unknown) {
        // Aborted in flight: neither scanned nor failed — the session lands in
        // unreadSessions, and the run rethrows once the pool drains.
        if (signal?.aborted === true) { abortReason = { reason: abortOf(signal) }; return }
        scanned++
        failed++
        if (error instanceof AnalyticsDeadlineError) { stopped = 'time'; return }
      }
    }

    // S3/P1: at most `maxConcurrency` reads in flight; targets are issued in
    // list order. The budget check runs between issues, so it can drift by at
    // most the in-flight window (review S3 premise e).
    const poolSize = Math.max(1, Math.min(
      this.limitOf('maxConcurrency', DEFAULT_MAX_CONCURRENCY), targets.length))
    let cursor = 0
    const worker = async (): Promise<void> => {
      for (;;) {
        if (signal?.aborted === true) {
          abortReason ??= { reason: abortOf(signal) }
          return
        }
        if (stopped !== undefined || abortReason !== undefined) return
        const index = cursor
        if (index >= targets.length) return
        cursor++
        await scanRecord(targets[index])
      }
    }
    const workers: Promise<void>[] = []
    for (let index = 0; index < poolSize; index++) workers.push(worker())
    await Promise.all(workers)
    if (abortReason !== undefined) throw abortReason.reason
    // S6/U2/P4: scanMs measures the scan loop only — the pricing wait and the
    // listing are reported separately.
    const scanMs = Math.max(0, this.now() - started)

    let priceBook: AnalyticsPriceBook | undefined
    let pricingUnavailable = false
    try {
      priceBook = await withTimeout(pricingPromise, PRICING_TIMEOUT_MS, 'pricing request timed out', signal)
      if (priceBook === undefined) pricingUnavailable = true
    } catch (error: unknown) {
      if (signal?.aborted === true) throw abortOf(signal)
      pricingUnavailable = true
    }
    const pricingMs = Math.max(0, this.now() - pricingStarted)
    if (pricingUnavailable && this.lastPriceBook !== undefined) {
      // S4/P4 stale-on-error: price with the last successful table; its own
      // updatedAt keeps the table's age visible to the client.
      priceBook = this.lastPriceBook
      pricingUnavailable = false
    } else if (!pricingUnavailable) {
      this.lastPriceBook = priceBook
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
    let unattributedRequests = 0
    let buckets: DayBuckets | undefined

    // Second pass over run-local results only (S1/P3); M3: each session's
    // facts ascend by `at`, so the range is located by binary search and the
    // day key comes from the precomputed query-timezone bucket table.
    for (const folded of local.values()) {
      const facts = folded.facts
      let matched = false
      for (let index = lowerBound(facts, query.from); index < facts.length; index++) {
        const fact = facts[index]
        if (fact.at >= query.to) break
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
            // P15: the models that actually appeared belong in the list even
            // when the whole table was unavailable — an empty list next to
            // unpricedRequests > 0 must mean "everything was priced or free".
            unpriced.add(model)
          } else {
            micro = priceUsage(model, usageOf(fact), cost, fact.at)
            totals.estimatedMicroUsd += micro
            totals.pricedRequests++
            row.estimatedMicroUsd += micro
            row.pricedRequests++
          }
        }
        buckets ??= localDayBuckets(query.from, query.to, formatter)
        const day = buckets.keys[bucketIndexOf(buckets, fact.at)]
        let bucket = days.get(day)
        if (bucket === undefined) { bucket = { requests: 0, tokens: 0, estimatedMicroUsd: 0 }; days.set(day, bucket) }
        bucket.requests++
        bucket.tokens += tokens
        bucket.estimatedMicroUsd += micro
      }
      for (const at of folded.attempts) {
        if (at < query.from || at >= query.to) continue
        matched = true
        totals.unsettledAttempts++
      }
      for (const at of folded.unattributed) {
        // P12: a visibility counter only — these buckets can hold traffic this
        // plugin skipped (fork prefixes), so nothing enters tokens or cost.
        if (at >= query.from && at < query.to) unattributedRequests++
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

    // S1/P2: the one eviction point — after this run's aggregation is done, so
    // it can never subtract from the report that was just built (the count
    // says how many sessions the next run will have to re-read).
    const evictedSessions = this.trim()
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
        scanMs,
        ...(zone.fallback ? { timeZoneFallback: true as const } : {}),
        // P16/P18/M1: sessions listed but never scanned — the slice cap or a
        // budget stopped first. Observability only: this never implies the
        // range was covered.
        unreadSessions: Math.max(0, listed.length - scanned),
        // P3/S1: entries the end-of-run trim dropped; they were counted in
        // this report from run-local results, but the next run re-reads them.
        evictedSessions,
        // P12: unattributed model calls in range, counted for visibility only.
        unattributedRequests,
        // S6: segmented timing (list / scan / pricing).
        listMs,
        pricingMs,
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

  private remember(id: string, createdAt: number, facts: FoldedSession, live: boolean, storedAt: number): void {
    const previous = this.cache.get(id)
    if (previous !== undefined) this.factTotal -= previous.facts.facts.length
    // Delete-then-set moves an updated entry to the tail: the cache is LRU
    // (review P2/M2), and eviction is deferred to trim() at the end of a run.
    this.cache.delete(id)
    this.cache.set(id, { createdAt, facts, live, storedAt })
    this.factTotal += facts.facts.length
  }

  /** The one eviction point; returns how many entries it dropped (review S1/P2). */
  private trim(): number {
    const maxFacts = this.limitOf('maxFacts', DEFAULT_MAX_FACTS)
    let evicted = 0
    while (this.cache.size > MAX_CACHE_SESSIONS || this.factTotal > maxFacts) {
      const first = this.cache.keys().next().value as string | undefined
      if (first === undefined) break
      const entry = this.cache.get(first)
      if (entry !== undefined) this.factTotal -= entry.facts.facts.length
      this.cache.delete(first)
      evicted++
    }
    return evicted
  }
}
