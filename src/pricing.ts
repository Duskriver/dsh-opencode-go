/** Strict gateway tariff validation for model discovery and Free eligibility. */
import type { ModelCost } from './sdk-types.ts'

export function validReleaseDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

type Comparison<T> = { in?: T[]; eq?: T; gt?: T; gte?: T; lt?: T; lte?: T }

export interface PricingCondition {
  all?: PricingCondition[]
  any?: PricingCondition[]
  utc_days?: Comparison<string>
  utc_hours?: Comparison<string>
  date?: Comparison<string>
}

export interface PriceMultiplier { when: PricingCondition; factor: number }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid pricing object')
  return value as Record<string, unknown>
}

function rate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('invalid price')
  return value
}

const TTL_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }

function ttlSeconds(key: string): number {
  const match = /^(\d+)([smhd])$/.exec(key)
  if (!match) throw new Error('invalid cache write TTL')
  const count = Number(match[1])
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error('invalid cache write TTL')
  return count * TTL_SECONDS[match[2]!]!
}

/** Accept either a flat rate or a TTL-keyed map (such as `{ "5m": 1.875, "1h": 3 }`), keeping the shortest TTL as base rate. */
function cacheWriteRate(value: unknown): { rate: number; allZero: boolean } {
  if (typeof value === 'number') {
    const flat = rate(value)
    return { rate: flat, allZero: flat === 0 }
  }
  const map = object(value)
  const entries = Object.entries(map)
  if (entries.length === 0) throw new Error('empty cache write map')
  let shortestSeconds = Number.POSITIVE_INFINITY
  let shortestRate = 0
  let allZero = true
  for (const [ttl, raw] of entries) {
    const seconds = ttlSeconds(ttl)
    const price = rate(raw)
    if (price !== 0) allZero = false
    if (seconds < shortestSeconds) {
      shortestSeconds = seconds
      shortestRate = price
    }
  }
  return { rate: shortestRate, allZero }
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const OPERATORS = ['in', 'eq', 'gt', 'gte', 'lt', 'lte']

function condition(value: unknown, depth = 0): PricingCondition {
  if (depth > 16) throw new Error('pricing condition is too deep')
  const row = object(value)
  if (Object.keys(row).length === 0) throw new Error('empty pricing condition')
  for (const [key, raw] of Object.entries(row)) {
    if (key === 'all' || key === 'any') {
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > 64) throw new Error('invalid pricing condition list')
      raw.forEach(item => condition(item, depth + 1))
      continue
    }
    if (!['utc_days', 'utc_hours', 'date'].includes(key)) throw new Error('unknown pricing condition')
    const values = object(raw)
    if (Object.keys(values).length === 0) throw new Error('empty pricing comparison')
    const valid = (v: unknown): boolean => typeof v === 'string' && (key === 'utc_days' ? DAYS.includes(v)
      : key === 'utc_hours' ? /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(v) : validReleaseDate(v))
    for (const [op, arg] of Object.entries(values)) {
      if (!OPERATORS.includes(op) || key === 'utc_days' && !['in', 'eq'].includes(op)
        || (op === 'in' ? !Array.isArray(arg) || arg.length === 0 || !arg.every(valid) : !valid(arg))) {
        throw new Error('invalid pricing comparison')
      }
    }
  }
  return row as PricingCondition
}

/** Validate a gateway multiplier schedule, throwing on malformed rules. */
export function parsePricingMultipliers(value: unknown): PriceMultiplier[] {
  if (!Array.isArray(value)) throw new Error('invalid multipliers')
  return value.map(item => {
    const row = object(item)
    return { when: condition(row.when), factor: rate(row.factor) }
  })
}

function compareValue(actual: string, comparison: Comparison<string>): boolean {
  if (comparison.in !== undefined && !comparison.in.includes(actual)) return false
  if (comparison.eq !== undefined && actual !== comparison.eq) return false
  if (comparison.gt !== undefined && !(actual > comparison.gt)) return false
  if (comparison.gte !== undefined && !(actual >= comparison.gte)) return false
  if (comparison.lt !== undefined && !(actual < comparison.lt)) return false
  if (comparison.lte !== undefined && !(actual <= comparison.lte)) return false
  return true
}

function matchesCondition(node: PricingCondition, utcDay: string, utcHour: string, utcDate: string): boolean {
  if (node.all !== undefined && !node.all.every(child => matchesCondition(child, utcDay, utcHour, utcDate))) return false
  if (node.any !== undefined && !node.any.some(child => matchesCondition(child, utcDay, utcHour, utcDate))) return false
  if (node.utc_days !== undefined && !compareValue(utcDay, node.utc_days)) return false
  if (node.utc_hours !== undefined && !compareValue(utcHour, node.utc_hours)) return false
  if (node.date !== undefined && !compareValue(utcDate, node.date)) return false
  return true
}

/** True when a pricing condition tree depends on recurring UTC day/hour windows. */
export function isRecurringMultiplierCondition(node: PricingCondition): boolean {
  if (node.utc_days !== undefined || node.utc_hours !== undefined) return true
  if (node.all?.some(isRecurringMultiplierCondition)) return true
  if (node.any?.some(isRecurringMultiplierCondition)) return true
  return false
}

export interface MultiplierBreakdown {
  readonly total: number
  readonly recurring: number
  readonly dated: number
  readonly maxRecurringPeak?: number
  readonly upcomingDateChange?: { readonly date: string; readonly factor: number }
}

function collectConditionDates(node: PricingCondition, out: string[]): void {
  if (node.date !== undefined) {
    if (node.date.eq !== undefined) out.push(node.date.eq)
    if (node.date.gte !== undefined) out.push(node.date.gte)
    if (node.date.gt !== undefined) out.push(addUtcDays(node.date.gt, 1))
    if (node.date.in !== undefined) out.push(...node.date.in)
  }
  node.all?.forEach(child => collectConditionDates(child, out))
  node.any?.forEach(child => collectConditionDates(child, out))
}

function addUtcDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`)
  if (!Number.isFinite(ms)) return isoDate
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10)
}

function utcClockParts(nowMs: number): { utcDay: string; utcHour: string; utcDate: string } {
  const now = new Date(nowMs)
  return {
    utcDay: DAYS[now.getUTCDay()]!,
    utcHour: `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`,
    utcDate: now.toISOString().slice(0, 10),
  }
}

/**
 * True when a condition tree can match on `utcDate` for at least some UTC
 * day/hour window (ignoring `utc_days` and `utc_hours` leaves).
 */
function matchesDateConstraint(node: PricingCondition, utcDate: string): boolean {
  if (node.all !== undefined && !node.all.every(child => matchesDateConstraint(child, utcDate))) return false
  if (node.any !== undefined && !node.any.some(child => matchesDateConstraint(child, utcDate))) return false
  if (node.date !== undefined && !compareValue(utcDate, node.date)) return false
  return true
}

/**
 * Evaluate recurring peak rules separately from date-based tariff changes so
 * scheduled effective-date changes (like a permanent rate step-up) are not
 * mislabeled as daily peak hours.
 */
export function evaluateMultiplierBreakdown(
  multipliers: readonly PriceMultiplier[] | undefined,
  nowMs = Date.now(),
): MultiplierBreakdown {
  if (!multipliers || multipliers.length === 0 || !Number.isFinite(nowMs)) {
    return { total: 1, recurring: 1, dated: 1 }
  }
  const { utcDay, utcHour, utcDate } = utcClockParts(nowMs)
  let recurring = 1
  let dated = 1
  let maxRecurringPeak: number | undefined
  let upcomingDateChange: { date: string; factor: number } | undefined
  const recordUpcomingDate = (node: PricingCondition, factor: number): void => {
    const candidates: string[] = []
    collectConditionDates(node, candidates)
    for (const date of candidates) {
      if (date > utcDate && (upcomingDateChange === undefined || date < upcomingDateChange.date)) {
        upcomingDateChange = { date, factor }
      }
    }
  }
  for (const rule of multipliers) {
    const isRecurring = isRecurringMultiplierCondition(rule.when)
    const matched = matchesCondition(rule.when, utcDay, utcHour, utcDate)
    if (isRecurring) {
      const dateActive = matchesDateConstraint(rule.when, utcDate)
      if (dateActive && rule.factor > 1 && (maxRecurringPeak === undefined || rule.factor > maxRecurringPeak)) {
        maxRecurringPeak = rule.factor
      }
      if (matched) {
        recurring *= rule.factor
      } else if (!dateActive && rule.factor !== 1) {
        recordUpcomingDate(rule.when, rule.factor)
      }
    } else if (matched) {
      dated *= rule.factor
    } else if (rule.factor !== 1) {
      recordUpcomingDate(rule.when, rule.factor)
    }
  }
  return {
    total: recurring * dated,
    recurring,
    dated,
    ...(maxRecurringPeak === undefined ? {} : { maxRecurringPeak }),
    ...(upcomingDateChange === undefined ? {} : { upcomingDateChange }),
  }
}

/**
 * Evaluate the active tariff multiplier at a UTC instant (`nowMs`).
 * Unmatched or absent schedules resolve to `1`.
 */
export function evaluatePriceMultiplier(multipliers: readonly PriceMultiplier[] | undefined, nowMs = Date.now()): number {
  return evaluateMultiplierBreakdown(multipliers, nowMs).total
}

function collectBoundaryMinutes(comparison: Comparison<string>, minutes: Set<number>): void {
  const pushClock = (clock: string, plusOne: boolean): void => {
    const [hRaw, mRaw] = clock.split(':')
    const total = Number(hRaw) * 60 + Number(mRaw) + (plusOne ? 1 : 0)
    if (Number.isFinite(total)) minutes.add(total)
  }
  if (comparison.gte !== undefined) pushClock(comparison.gte, false)
  if (comparison.lt !== undefined) pushClock(comparison.lt, false)
  if (comparison.gt !== undefined) pushClock(comparison.gt, true)
  if (comparison.lte !== undefined) pushClock(comparison.lte, true)
  if (comparison.eq !== undefined) { pushClock(comparison.eq, false); pushClock(comparison.eq, true) }
  for (const clock of comparison.in ?? []) { pushClock(clock, false); pushClock(clock, true) }
}

function collectRuleBoundaries(
  node: PricingCondition,
  minutes: Set<number>,
  dates: Set<string>,
  hasDays: { value: boolean },
): void {
  if (node.utc_days !== undefined) hasDays.value = true
  if (node.utc_hours !== undefined) collectBoundaryMinutes(node.utc_hours, minutes)
  if (node.date !== undefined) {
    for (const key of ['eq', 'gte', 'lt'] as const) {
      const value = node.date[key]
      if (value !== undefined) dates.add(value)
    }
    for (const key of ['gt', 'lte'] as const) {
      const value = node.date[key]
      if (value !== undefined) dates.add(addUtcDays(value, 1))
    }
    for (const value of node.date.in ?? []) {
      dates.add(value)
      dates.add(addUtcDays(value, 1))
    }
  }
  node.all?.forEach(child => collectRuleBoundaries(child, minutes, dates, hasDays))
  node.any?.forEach(child => collectRuleBoundaries(child, minutes, dates, hasDays))
}

/**
 * Find the earliest UTC timestamp strictly after `nowMs` at which any rule in
 * `schedules` can transition state. Returns `undefined` when no transitions exist.
 */
export function nextCatalogMultiplierTransitionMs(
  schedules: Iterable<readonly PriceMultiplier[] | undefined>,
  nowMs = Date.now(),
): number | undefined {
  if (!Number.isFinite(nowMs)) return undefined
  const minutes = new Set<number>()
  const dates = new Set<string>()
  const hasDays = { value: false }
  for (const schedule of schedules) {
    if (!schedule) continue
    for (const rule of schedule) collectRuleBoundaries(rule.when, minutes, dates, hasDays)
  }
  if (minutes.size === 0 && dates.size === 0 && !hasDays.value) return undefined
  const now = new Date(nowMs)
  const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  let earliest: number | undefined
  const consider = (ts: number): void => {
    if (ts > nowMs && (earliest === undefined || ts < earliest)) earliest = ts
  }
  if (hasDays.value) consider(dayStartMs + 86_400_000)
  for (const offsetDay of [0, 1]) {
    const base = dayStartMs + offsetDay * 86_400_000
    for (const minute of minutes) consider(base + minute * 60_000)
  }
  for (const date of dates) {
    const ts = Date.parse(`${date}T00:00:00Z`)
    if (Number.isFinite(ts)) consider(ts)
  }
  return earliest
}

export interface ParsedCost { cost: ModelCost; multipliers?: PriceMultiplier[]; free: boolean }

/** Missing base prices or malformed optional components invalidate the entire tariff. */
export function readModelCost(value: unknown): ParsedCost | undefined {
  try {
    const raw = object(value), text = object(raw.text)
    const input = object(text.input), output = object(text.output)
    let hasNonZeroWrite = false
    const cache = (raw: unknown): { cacheRead?: number; cacheWrite?: number } => {
      if (raw === undefined) return {}
      const row = object(raw)
      const write = row.write === undefined ? undefined : cacheWriteRate(row.write)
      if (write && !write.allZero) hasNonZeroWrite = true
      return { ...(row.read === undefined ? {} : { cacheRead: rate(row.read) }),
        ...(write === undefined ? {} : { cacheWrite: write.rate }) }
    }
    const cost: ModelCost = { input: rate(input.price), output: rate(output.price), cacheRead: 0, cacheWrite: 0, ...cache(input.cache) }
    // A cache declaration on output is not a supported text tariff.
    if (output.cache !== undefined) throw new Error('invalid output cache')
    type Patch = { threshold: number; rates: Partial<ModelCost> }
    const overrides = (raw: unknown, side: 'input' | 'output'): Patch[] => {
      if (raw === undefined) return []
      if (!Array.isArray(raw)) throw new Error('invalid context overrides')
      return raw.map(value => {
        const row = object(value), when = object(row.when), context = object(when.context)
        const keys = Object.keys(context)
        if (Object.keys(when).length !== 1 || keys.length !== 1 || !['gt', 'gte'].includes(keys[0]!)) throw new Error('invalid context threshold')
        const threshold = context[keys[0]!]
        if (typeof threshold !== 'number' || !Number.isSafeInteger(threshold) || threshold <= 0) throw new Error('invalid context threshold')
        if (side === 'output' && row.cache !== undefined) throw new Error('invalid output cache')
        if (row.price === undefined && row.cache === undefined) throw new Error('empty context tariff')
        return { threshold: threshold - (keys[0] === 'gte' ? 1 : 0),
          rates: { ...(row.price === undefined ? {} : { [side]: rate(row.price) }), ...cache(row.cache) } }
      })
    }
    const patches = [...overrides(input.overrides, 'input'), ...overrides(output.overrides, 'output')]
      .sort((a, b) => a.threshold - b.threshold)
    let current = { ...cost }
    for (const patch of patches) {
      current = { ...current, ...patch.rates }
      const tier = { ...current, inputTokensAbove: patch.threshold }
      cost.tiers ??= []
      if (cost.tiers.at(-1)?.inputTokensAbove === patch.threshold) cost.tiers[cost.tiers.length - 1] = tier
      else cost.tiers.push(tier)
    }
    const multipliers = raw.multipliers === undefined ? undefined : parsePricingMultipliers(raw.multipliers)
    const zero = (rates: ModelCost): boolean => rates.input === 0 && rates.output === 0 && rates.cacheRead === 0 && rates.cacheWrite === 0
    return { cost, ...(multipliers === undefined ? {} : { multipliers }), free: !hasNonZeroWrite && zero(cost) && (cost.tiers ?? []).every(zero) }
  } catch { return undefined }
}
