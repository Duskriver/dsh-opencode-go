/** Gateway text tariffs and UTC multiplier conditions, shared with analytics. */
import type { ModelCost } from './sdk-types.ts'
import { validReleaseDate } from './contracts.ts'

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

function compare(value: string, rule: Comparison<string>): boolean {
  return Object.entries(rule).every(([op, expected]) => op === 'in' ? (expected as string[]).includes(value)
    : op === 'eq' ? value === expected : op === 'gt' ? value > expected : op === 'gte' ? value >= expected
      : op === 'lt' ? value < expected : value <= expected)
}

export function matchesPricingCondition(rule: PricingCondition, at: number): boolean {
  if (!Number.isFinite(at)) return false
  const date = new Date(at)
  if (!Number.isFinite(date.getTime())) return false
  return (!rule.all || rule.all.every(item => matchesPricingCondition(item, at)))
    && (!rule.any || rule.any.some(item => matchesPricingCondition(item, at)))
    && (!rule.utc_days || compare(DAYS[date.getUTCDay()]!, rule.utc_days))
    && (!rule.utc_hours || compare(date.toISOString().slice(11, 16), rule.utc_hours))
    && (!rule.date || compare(date.toISOString().slice(0, 10), rule.date))
}

export function priceMultiplierAt(multipliers: readonly PriceMultiplier[] | undefined, at: number): number {
  return (multipliers ?? []).reduce((factor, item) => matchesPricingCondition(item.when, at) ? factor * item.factor : factor, 1)
}

export interface ParsedCost { cost: ModelCost; multipliers?: PriceMultiplier[]; free: boolean }

/** Missing base prices or malformed optional components invalidate the entire tariff. */
export function readModelCost(value: unknown): ParsedCost | undefined {
  try {
    const raw = object(value), text = object(raw.text)
    const input = object(text.input), output = object(text.output)
    const cache = (raw: unknown): { cacheRead?: number; cacheWrite?: number } => {
      if (raw === undefined) return {}
      const row = object(raw)
      return { ...(row.read === undefined ? {} : { cacheRead: rate(row.read) }),
        ...(row.write === undefined ? {} : { cacheWrite: rate(row.write) }) }
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
    let multipliers: PriceMultiplier[] | undefined
    if (raw.multipliers !== undefined) {
      if (!Array.isArray(raw.multipliers)) throw new Error('invalid multipliers')
      multipliers = raw.multipliers.map(item => {
        const row = object(item)
        return { when: condition(row.when), factor: rate(row.factor) }
      })
    }
    const zero = (rates: ModelCost): boolean => rates.input === 0 && rates.output === 0 && rates.cacheRead === 0 && rates.cacheWrite === 0
    return { cost, ...(multipliers === undefined ? {} : { multipliers }), free: zero(cost) && (cost.tiers ?? []).every(zero) }
  } catch { return undefined }
}
