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
/** The four billable rates, in USD per one million tokens. */
export interface CostRates {
    readonly input: number;
    readonly output: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
}
/** One context-length tier; the highest matching threshold prices the attempt. */
export interface CostTier extends CostRates {
    readonly inputTokensAbove: number;
}
/** Structural face of the catalog's ModelCost. */
export interface ModelCostLike extends CostRates {
    readonly tiers?: readonly CostTier[];
}
/** The token components one request reported. */
export interface UsageCounts {
    readonly input: number;
    readonly output: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
}
/**
 * Billed input tokens: reported input plus cache reads and writes.
 * @param usage - one request's token components.
 * @returns the total the tier threshold is compared against.
 */
export declare function billedInput(usage: UsageCounts): number;
/**
 * Whether every rate of a model is zero (a free row).
 * @param cost - the model's catalog cost.
 * @returns true when no component could ever charge.
 */
export declare function isFreeCost(cost: ModelCostLike): boolean;
/**
 * Price one settled request.
 * @param model - the model id that served the request.
 * @param usage - its token components.
 * @param cost - the catalog cost for that model.
 * @param at - request start time, used for the DeepSeek peak window.
 * @returns the estimated cost in integer micro-USD.
 */
export declare function priceUsage(model: string, usage: UsageCounts, cost: ModelCostLike, at: number): number;
