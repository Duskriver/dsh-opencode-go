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
/**
 * Evaluate the active tariff multiplier at a UTC instant (`nowMs`).
 * Unmatched or absent schedules resolve to `1`.
 */
export declare function evaluatePriceMultiplier(multipliers: readonly PriceMultiplier[] | undefined, nowMs?: number): number;
export interface ParsedCost {
    cost: ModelCost;
    multipliers?: PriceMultiplier[];
    free: boolean;
}
/** Missing base prices or malformed optional components invalidate the entire tariff. */
export declare function readModelCost(value: unknown): ParsedCost | undefined;
export {};
