/** Pure OpenCode Go allowance, multiplier and per-model request budget estimation. */
import type {
  GoModel,
  GoModelPrice,
  GoPlan,
  GoUsage,
} from './contracts.ts'
import { evaluateMultiplierBreakdown } from './pricing.ts'

/** Official Go window caps expressed as fractions of the monthly allowance. */
export const GO_ROLLING_SHARE = 0.2
export const GO_WEEKLY_SHARE = 0.5
export const GO_MONTHLY_SHARE = 1.0

/**
 * Standard 1.0× reference quota share per typical request: 1/50,000 of the
 * active plan's monthly allowance (= 1/10,000 of the 5-hour rolling window).
 */
export const STANDARD_QUOTA_SHARE = 1 / 50_000

/** Selectable workload profiles for per-model quota request estimation. */
export const QUOTA_WORKLOAD_PROFILES = ['chat', 'coding', 'agent'] as const

export type QuotaWorkloadProfile = typeof QUOTA_WORKLOAD_PROFILES[number]

/**
 * Representative per-call token profiles (input / cacheRead / output) used to
 * convert per-model dollar allowances into estimated request counts.
 */
export const QUOTA_WORKLOAD_TOKENS: Record<QuotaWorkloadProfile, {
  readonly input: number
  readonly cacheRead: number
  readonly output: number
}> = {
  chat: { input: 800, cacheRead: 4_000, output: 350 },
  coding: { input: 1_000, cacheRead: 44_000, output: 450 },
  agent: { input: 2_000, cacheRead: 120_000, output: 900 },
}

/**
 * Typical OpenCode Go coding-agent request profile (per call) used to convert
 * per-model dollar allowances into estimated request counts.
 */
export const TYPICAL_REQUEST_TOKENS = QUOTA_WORKLOAD_TOKENS.coding

export type QuotaWindowKey = 'rolling' | 'weekly' | 'monthly'

export interface EffectiveRemainingQuota {
  /** Remaining fraction of the monthly allowance immediately spendable (0..0.2). */
  readonly ratio: number
  /** Which window currently caps immediate usage. */
  readonly bottleneck: QuotaWindowKey
  readonly limited: boolean
}

export interface WindowRequestEstimate {
  readonly rolling: number
  readonly weekly: number
  readonly monthly: number
}

export type ModelQuotaEstimate =
  | { readonly kind: 'free' }
  | {
    readonly kind: 'go'
    readonly plan: GoPlan
    readonly monthlyUsd: number
    readonly requestUsd: number
    /** Base 1× full-capacity request estimates across the 5h, weekly and monthly windows. */
    readonly fullRequests: WindowRequestEstimate
    /** Highest scheduled recurring peak multiplier (> 1) when the model has peak-hour pricing, else undefined. */
    readonly peakFactor?: number
    /** True when a recurring peak-hour multiplier (> 1) is active at `nowMs`. */
    readonly isPeak: boolean
    /** Active rate multiplier at `nowMs` (`1` when off-peak or unscheduled). */
    readonly multiplier: number
    /** Normalized quota consumption multiplier at `nowMs` (1.0× = STANDARD_QUOTA_SHARE of monthly cap per typical request). */
    readonly quotaMultiplier: number
    /** Off-peak normalized quota consumption multiplier (incorporating active date rules, excluding recurring peak). */
    readonly baseQuotaMultiplier: number
    /** Peak-hour normalized quota consumption multiplier when `peakFactor` is present. */
    readonly peakQuotaMultiplier?: number
    /** True when the model has higher-context price tiers (`cost.text.*.overrides`). */
    readonly hasContextTiers: boolean
    /** Lowest context threshold (tokens) that triggers a higher tariff tier, when `hasContextTiers` is true. */
    readonly minTierThreshold?: number
    /** Earliest future effective-date multiplier change, if scheduled in `cost.multipliers`. */
    readonly upcomingDateChange?: {
      readonly date: string
      readonly factor: number
      readonly quotaMultiplier: number
    }
    readonly bottleneck?: QuotaWindowKey
    readonly limited: boolean
    /** Immediately remaining estimated calls under live `usage` and active `multiplier`. */
    readonly remainingRequests?: number
  }

/** Format a normalized quota consumption multiplier for compact list display. */
export function formatQuotaMultiplier(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 0.01) return '<0.01×'
  if (value < 9.995) return `${value.toFixed(2)}×`
  if (value < 99.95) return `${value.toFixed(1)}×`
  return `${Math.round(value)}×`
}

/** True when every published base and context-tier rate is zero. */
export function isFreePrice(price: GoModelPrice | undefined): boolean {
  if (price === undefined) return false
  return [price, ...price.tiers ?? []].every(rates =>
    rates.input === 0 && rates.output === 0 && rates.cacheRead === 0 && rates.cacheWrite === 0)
}

/**
 * Compute the immediately spendable fraction of the monthly Go allowance across
 * the 5-hour (20%), weekly (50%) and monthly (100%) windows.
 */
export function effectiveUsageRemainingRatio(usage: GoUsage): EffectiveRemainingQuota {
  const candidates: Array<{ key: QuotaWindowKey; ratio: number; limited: boolean }> = (
    [
      ['rolling', GO_ROLLING_SHARE],
      ['weekly', GO_WEEKLY_SHARE],
      ['monthly', GO_MONTHLY_SHARE],
    ] as const
  ).map(([key, share]) => {
    const win = usage[key]
    const limited = win.status === 'rate-limited' || win.percent >= 100
    const remaining = limited ? 0 : Math.max(0, 100 - win.percent) / 100
    return { key, ratio: share * remaining, limited }
  })

  let chosen = candidates[0]!
  for (const candidate of candidates.slice(1)) {
    if (candidate.ratio < chosen.ratio || (candidate.ratio === chosen.ratio && candidate.limited && !chosen.limited)) {
      chosen = candidate
    }
  }
  return {
    ratio: chosen.ratio,
    bottleneck: chosen.key,
    limited: chosen.limited || chosen.ratio <= 0,
  }
}

/**
 * Dollar cost of one representative cached request at base 1× rates.
 * Models without a published cache-read tariff fall back to their input rate for cached tokens.
 * Context tiers apply automatically when the profile's total input exceeds a published threshold.
 */
export function estimateRequestCostUsd(
  price: GoModelPrice | undefined,
  profile: QuotaWorkloadProfile = 'coding',
): number | undefined {
  if (!price) return undefined
  const tokens = QUOTA_WORKLOAD_TOKENS[profile]
  const totalInput = tokens.input + tokens.cacheRead
  let rates: Pick<GoModelPrice, 'input' | 'output' | 'cacheRead'> = price
  if (price.tiers && price.tiers.length > 0) {
    for (const tier of price.tiers) {
      if (totalInput > tier.inputTokensAbove) rates = tier
    }
  }
  const cacheReadRate = rates.cacheRead > 0 ? rates.cacheRead : rates.input
  const usd = (
    tokens.input * rates.input
    + tokens.cacheRead * cacheReadRate
    + tokens.output * rates.output
  ) / 1_000_000
  if (!Number.isFinite(usd) || usd <= 0) return undefined
  return usd
}

function usdToRequests(budgetUsd: number, requestUsd: number, multiplier: number): number {
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || !Number.isFinite(multiplier) || multiplier <= 0) return 0
  return Math.floor(budgetUsd / (requestUsd * multiplier))
}

/**
 * Compute full-capacity (5h / weekly / monthly) and optional live remaining
 * estimated request counts for one Go model under `plan`.
 */
export function estimateModelQuota(input: {
  model: GoModel
  plan: GoPlan
  usage?: GoUsage
  nowMs?: number
  profile?: QuotaWorkloadProfile
}): ModelQuotaEstimate | undefined {
  const { model, plan, usage, nowMs = Date.now(), profile = 'coding' } = input
  if (isFreePrice(model.price) || model.source === 'free') return { kind: 'free' }
  const monthlyUsd = model.goMonthlyUsage?.[plan]
  if (monthlyUsd === undefined || !Number.isFinite(monthlyUsd) || monthlyUsd <= 0) return undefined
  const requestUsd = estimateRequestCostUsd(model.price, profile)
  if (requestUsd === undefined) return undefined

  const breakdown = evaluateMultiplierBreakdown(model.pricingMultipliers, nowMs)
  const multiplier = breakdown.total
  const peakFactor = breakdown.maxRecurringPeak
  const baseQuotaMultiplier = (requestUsd * breakdown.dated) / (monthlyUsd * STANDARD_QUOTA_SHARE)
  const quotaMultiplier = baseQuotaMultiplier * breakdown.recurring
  const peakQuotaMultiplier = peakFactor === undefined ? undefined : baseQuotaMultiplier * peakFactor
  const tiers = model.price?.tiers
  const minTierThreshold = tiers && tiers.length > 0
    ? Math.min(...tiers.map(tier => tier.inputTokensAbove))
    : undefined
  const remaining = usage ? effectiveUsageRemainingRatio(usage) : undefined
  const limited = remaining?.limited ?? false
  const remainingRequests = remaining
    ? (limited ? 0 : usdToRequests(monthlyUsd * remaining.ratio, requestUsd, multiplier))
    : undefined

  return {
    kind: 'go',
    plan,
    monthlyUsd,
    requestUsd,
    fullRequests: {
      rolling: usdToRequests(monthlyUsd * GO_ROLLING_SHARE, requestUsd, breakdown.dated),
      weekly: usdToRequests(monthlyUsd * GO_WEEKLY_SHARE, requestUsd, breakdown.dated),
      monthly: usdToRequests(monthlyUsd * GO_MONTHLY_SHARE, requestUsd, breakdown.dated),
    },
    ...(peakFactor === undefined ? {} : { peakFactor }),
    isPeak: breakdown.recurring > 1,
    multiplier,
    quotaMultiplier,
    baseQuotaMultiplier,
    ...(peakQuotaMultiplier === undefined ? {} : { peakQuotaMultiplier }),
    hasContextTiers: minTierThreshold !== undefined,
    ...(minTierThreshold === undefined ? {} : { minTierThreshold }),
    ...(breakdown.upcomingDateChange === undefined ? {} : {
      upcomingDateChange: {
        date: breakdown.upcomingDateChange.date,
        factor: breakdown.upcomingDateChange.factor,
        quotaMultiplier: baseQuotaMultiplier * breakdown.upcomingDateChange.factor,
      },
    }),
    ...(remaining === undefined ? {} : { bottleneck: remaining.bottleneck }),
    limited,
    ...(remainingRequests === undefined ? {} : { remainingRequests }),
  }
}
