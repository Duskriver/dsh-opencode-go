/** Gateway text tariffs and UTC multiplier conditions, shared with analytics. */
import type { ModelCost } from './sdk-types.ts';
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
export declare function matchesPricingCondition(rule: PricingCondition, at: number): boolean;
export declare function priceMultiplierAt(multipliers: readonly PriceMultiplier[] | undefined, at: number): number;
export interface ParsedCost {
    cost: ModelCost;
    multipliers?: PriceMultiplier[];
    free: boolean;
}
/** Missing base prices or malformed optional components invalidate the entire tariff. */
export declare function readModelCost(value: unknown): ParsedCost | undefined;
export {};
