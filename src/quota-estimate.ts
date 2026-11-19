/** Pure OpenCode Go allowance, multiplier and per-model request budget estimation. */
import type {
  GoModel,
  GoModelPrice,
  GoPlan,
  GoUsage,
} from './contracts.ts'
import { evaluatePriceMultiplier } from './pricing.ts'

/** Official Go window caps expressed as fractions of the monthly allowance. */
export const GO_ROLLING_SHARE = 0.2
export const GO_WEEKLY_SHARE = 0.5
export const GO_MONTHLY_SHARE = 1.0

/**
 * Typical OpenCode Go coding-agent request profile (per call) used to convert
 * per-model dollar allowances into estimated request counts.
 */
export const TYPICAL_REQUEST_TOKENS = {
  input: 1_000,
  cacheRead: 44_000,
  output: 450,
} as const

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
    /** Highest scheduled peak multiplier (> 1) when the model has peak-hour pricing, else undefined. */
    readonly peakFactor?: number
    /** Active rate multiplier at `nowMs` (`1` when off-peak or unscheduled). */
    readonly multiplier: number
    readonly bottleneck?: QuotaWindowKey
    readonly limited: boolean
    /** Immediately remaining estimated calls under live `usage` and active `multiplier`. */
    readonly remainingRequests?: number
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
 * Dollar cost of one typical cached coding request at base 1× rates.
 * Models without a published cache-read tariff fall back to their input rate for cached tokens.
 */
export function estimateRequestCostUsd(price: GoModelPrice | undefined): number | undefined {
  if (!price) return undefined
  const cacheReadRate = price.cacheRead > 0 ? price.cacheRead : price.input
  const usd = (
    TYPICAL_REQUEST_TOKENS.input * price.input
    + TYPICAL_REQUEST_TOKENS.cacheRead * cacheReadRate
    + TYPICAL_REQUEST_TOKENS.output * price.output
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
}): ModelQuotaEstimate | undefined {
  const { model, plan, usage, nowMs = Date.now() } = input
  if (isFreePrice(model.price) || model.source === 'free') return { kind: 'free' }
  const monthlyUsd = model.goMonthlyUsage?.[plan]
  if (monthlyUsd === undefined || !Number.isFinite(monthlyUsd) || monthlyUsd <= 0) return undefined
  const requestUsd = estimateRequestCostUsd(model.price)
  if (requestUsd === undefined) return undefined

  const peakFactors = (model.pricingMultipliers ?? [])
    .map(rule => rule.factor)
    .filter(factor => Number.isFinite(factor) && factor > 1)
  const peakFactor = peakFactors.length > 0 ? Math.max(...peakFactors) : undefined
  const multiplier = evaluatePriceMultiplier(model.pricingMultipliers, nowMs)
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
      rolling: usdToRequests(monthlyUsd * GO_ROLLING_SHARE, requestUsd, 1),
      weekly: usdToRequests(monthlyUsd * GO_WEEKLY_SHARE, requestUsd, 1),
      monthly: usdToRequests(monthlyUsd * GO_MONTHLY_SHARE, requestUsd, 1),
    },
    ...(peakFactor === undefined ? {} : { peakFactor }),
    multiplier,
    ...(remaining === undefined ? {} : { bottleneck: remaining.bottleneck }),
    limited,
    ...(remainingRequests === undefined ? {} : { remainingRequests }),
  }
}
