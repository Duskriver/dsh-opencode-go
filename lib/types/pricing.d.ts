/** Strict gateway tariff validation for model discovery and Free eligibility. */
import type { ModelCost } from './sdk-types.ts';
export declare function validReleaseDate(value: unknown): value is string;
type Comparison<T> = {
    in?: T[];
    eq?: T;
    gt?: T;
    gte?: T;
    lt?: T;
    lte?: T;
};
export interface PricingCondition {
    all?: PricingCondition[];
    any?: PricingCondition[];
    utc_days?: Comparison<string>;
    utc_hours?: Comparison<string>;
    date?: Comparison<string>;
}
export interface PriceMultiplier {
    when: PricingCondition;
    factor: number;
}
/** Validate a gateway multiplier schedule, throwing on malformed rules. */
export declare function parsePricingMultipliers(value: unknown): PriceMultiplier[];
/** True when a pricing condition tree depends on recurring UTC day/hour windows. */
export declare function isRecurringMultiplierCondition(node: PricingCondition): boolean;
export interface MultiplierBreakdown {
    readonly total: number;
    readonly recurring: number;
    readonly dated: number;
    readonly maxRecurringPeak?: number;
    readonly upcomingDateChange?: {
        readonly date: string;
        readonly factor: number;
    };
}
/**
 * Evaluate recurring peak rules separately from date-based tariff changes so
 * scheduled effective-date changes (like a permanent rate step-up) are not
 * mislabeled as daily peak hours.
 */
export declare function evaluateMultiplierBreakdown(multipliers: readonly PriceMultiplier[] | undefined, nowMs?: number): MultiplierBreakdown;
/**
 * Evaluate the active tariff multiplier at a UTC instant (`nowMs`).
 * Unmatched or absent schedules resolve to `1`.
 */
export declare function evaluatePriceMultiplier(multipliers: readonly PriceMultiplier[] | undefined, nowMs?: number): number;
/**
 * Find the earliest UTC timestamp strictly after `nowMs` at which any rule in
 * `schedules` can transition state. Returns `undefined` when no transitions exist.
 */
export declare function nextCatalogMultiplierTransitionMs(schedules: Iterable<readonly PriceMultiplier[] | undefined>, nowMs?: number): number | undefined;
export interface ParsedCost {
    cost: ModelCost;
    multipliers?: PriceMultiplier[];
    free: boolean;
}
/** Missing base prices or malformed optional components invalidate the entire tariff. */
export declare function readModelCost(value: unknown): ParsedCost | undefined;
export {};
