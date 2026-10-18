/**
 * OpenCode Go plan snapshot: monthly limits and the one peak-pricing window the
 * official tariff defines. Prices themselves stay on models.dev (the catalog's
 * model.cost); this file only carries what models.dev does not publish.
 *
 * Source: https://opencode.ai/v2/docs/console/go/ (Go and Go Plus tables).
 * The snapshot is reviewed when the model list or the plan changes; the report
 * shows {@link GO_PLAN_AS_OF}, so a stale table is visible rather than silent.
 *
 * @module dsh-opencode-go/go-plan
 */
/** Date the limits below were read from the official plan page. */
export declare const GO_PLAN_AS_OF = "2026-10-18";
/** Human-readable source for the limit snapshot. */
export declare const GO_PLAN_SOURCE = "https://opencode.ai/v2/docs/console/go/";
/** Why a row has no numeric limit. */
export type GoLimitNote = 'unlimited' | 'limited-time';
/** One model's monthly allowance on each plan (USD), or a note instead. */
export interface GoMonthlyLimit {
    /** Go plan monthly limit in USD; null when the row is unlimited. */
    readonly go: number | null;
    /** Go Plus plan monthly limit in USD; null when the row is unlimited. */
    readonly goPlus: number | null;
    readonly note?: GoLimitNote;
}
/**
 * Monthly limits by model id. Promo rows use the effective (post-strike-through)
 * value and carry {@link GoLimitNote} 'limited-time'; free rows are unlimited.
 */
export declare const GO_MONTHLY_LIMITS: Readonly<Record<string, GoMonthlyLimit>>;
/**
 * Read one model's limit snapshot.
 * @param model - catalog model id.
 * @returns the row, or undefined when the plan page lists no such model.
 */
export declare function goMonthlyLimit(model: string): GoMonthlyLimit | undefined;
/** Models with a documented peak/off-peak tariff (DeepSeek V4.1 Flash and V4 Pro). */
export declare const PEAK_PRICED_MODELS: ReadonlySet<string>;
/**
 * Whether a request started inside the documented DeepSeek peak window:
 * 01:00-04:00 and 06:00-10:00 UTC, Monday through Friday. All other hours,
 * including weekends, are off-peak.
 * @param at - request start time in Unix epoch milliseconds.
 * @returns true when the peak multiplier applies.
 */
export declare function isPeakPricedAt(at: number): boolean;
