/** Pure OpenCode Go allowance, multiplier and per-model request budget estimation. */
import type { GoModel, GoModelPrice, GoPlan, GoUsage } from './contracts.ts';
/** Official Go window caps expressed as fractions of the monthly allowance. */
export declare const GO_ROLLING_SHARE = 0.2;
export declare const GO_WEEKLY_SHARE = 0.5;
export declare const GO_MONTHLY_SHARE = 1;
/**
 * Typical OpenCode Go coding-agent request profile (per call) used to convert
 * per-model dollar allowances into estimated request counts.
 */
export declare const TYPICAL_REQUEST_TOKENS: {
    readonly input: 1000;
    readonly cacheRead: 44000;
    readonly output: 450;
};
export type QuotaWindowKey = 'rolling' | 'weekly' | 'monthly';
export interface EffectiveRemainingQuota {
    /** Remaining fraction of the monthly allowance immediately spendable (0..0.2). */
    readonly ratio: number;
    /** Which window currently caps immediate usage. */
    readonly bottleneck: QuotaWindowKey;
    readonly limited: boolean;
}
export interface WindowRequestEstimate {
    readonly rolling: number;
    readonly weekly: number;
    readonly monthly: number;
}
export type ModelQuotaEstimate = {
    readonly kind: 'free';
} | {
    readonly kind: 'go';
    readonly plan: GoPlan;
    readonly monthlyUsd: number;
    readonly requestUsd: number;
    /** Base 1× full-capacity request estimates across the 5h, weekly and monthly windows. */
    readonly fullRequests: WindowRequestEstimate;
    /** Highest scheduled peak multiplier (> 1) when the model has peak-hour pricing, else undefined. */
    readonly peakFactor?: number;
    /** Active rate multiplier at `nowMs` (`1` when off-peak or unscheduled). */
    readonly multiplier: number;
    readonly bottleneck?: QuotaWindowKey;
    readonly limited: boolean;
    /** Immediately remaining estimated calls under live `usage` and active `multiplier`. */
    readonly remainingRequests?: number;
};
/** True when every published base and context-tier rate is zero. */
export declare function isFreePrice(price: GoModelPrice | undefined): boolean;
/**
 * Compute the immediately spendable fraction of the monthly Go allowance across
 * the 5-hour (20%), weekly (50%) and monthly (100%) windows.
 */
export declare function effectiveUsageRemainingRatio(usage: GoUsage): EffectiveRemainingQuota;
/**
 * Dollar cost of one typical cached coding request at base 1× rates.
 * Models without a published cache-read tariff fall back to their input rate for cached tokens.
 */
export declare function estimateRequestCostUsd(price: GoModelPrice | undefined): number | undefined;
/**
 * Compute full-capacity (5h / weekly / monthly) and optional live remaining
 * estimated request counts for one Go model under `plan`.
 */
export declare function estimateModelQuota(input: {
    model: GoModel;
    plan: GoPlan;
    usage?: GoUsage;
    nowMs?: number;
}): ModelQuotaEstimate | undefined;
