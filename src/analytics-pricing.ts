/**
 * Request pricing for the usage dashboard: the gateway's catalog rates, its
 * context tiers, and the DeepSeek peak multiplier.
 *
 * Catalog rates are USD per one million tokens, so tokens multiplied by a rate
 * are already micro-USD. Components are rounded before summing and the peak
 * multiplier is applied to the rounded total.
 *
 * @module dsh-opencode-go/analytics-pricing
 */

import { PEAK_PRICED_MODELS, isPeakPricedAt } from './go-plan.ts'

/** The four billable rates, in USD per one million tokens. */
export interface CostRates {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
}

/** One context-length tier; the highest matching threshold prices the attempt. */
export interface CostTier extends CostRates {
  readonly inputTokensAbove: number
}

/** Structural face of the catalog's ModelCost. */
export interface ModelCostLike extends CostRates {
  readonly tiers?: readonly CostTier[]
}

/** The token components one request reported. */
export interface UsageCounts {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
}

/**
 * Billed input tokens: reported input plus cache reads and writes.
 * @param usage - one request's token components.
 * @returns the total the tier threshold is compared against.
 */
export function billedInput(usage: UsageCounts): number {
  return usage.input + usage.cacheRead + usage.cacheWrite
}

/**
 * Whether every rate of a model is zero (a free row).
 * @param cost - the model's catalog cost.
 * @returns true when no component could ever charge.
 */
export function isFreeCost(cost: ModelCostLike): boolean {
  const free = (rates: CostRates): boolean =>
    rates.input === 0 && rates.output === 0 && rates.cacheRead === 0 && rates.cacheWrite === 0
  return free(cost) && (cost.tiers === undefined || cost.tiers.every(free))
}

function tierOf(cost: ModelCostLike, billed: number): CostRates {
  let chosen: CostRates = cost
  let threshold = -1
  for (const tier of cost.tiers ?? []) {
    if (billed > tier.inputTokensAbove && tier.inputTokensAbove >= threshold) {
      chosen = tier
      threshold = tier.inputTokensAbove
    }
  }
  return chosen
}

/**
 * Price one settled request.
 * @param model - the model id that served the request.
 * @param usage - its token components.
 * @param cost - the catalog cost for that model.
 * @param at - request start time, used for the DeepSeek peak window.
 * @returns the estimated cost in integer micro-USD.
 */
export function priceUsage(model: string, usage: UsageCounts, cost: ModelCostLike, at: number): number {
  const rates = tierOf(cost, billedInput(usage))
  const micro = Math.round(usage.input * rates.input)
    + Math.round(usage.output * rates.output)
    + Math.round(usage.cacheRead * rates.cacheRead)
    + Math.round(usage.cacheWrite * rates.cacheWrite)
  return PEAK_PRICED_MODELS.has(model) && isPeakPricedAt(at) ? micro * 2 : micro
}
