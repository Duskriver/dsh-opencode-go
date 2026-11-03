import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
/**
 * OpenCode Go plan snapshot: monthly limits and the one peak-pricing window the
 * official tariff defines. Prices themselves stay on models.dev (the catalog's
 * model.cost); this file only carries what models.dev does not publish.
 *
 * Source: https://opencode.ai/v2/docs/console/go/ (Go and Go Plus tables).
 * The snapshot is reviewed when the model list or the plan changes; the report
 * shows {@link GO_PLAN_AS_OF}, so a stale table is visible rather than silent.
 *
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
/** Route id used by this plugin before 0.1.16. */
export declare const LEGACY_PROVIDER_ID = "opencode-go";
/** 0.1.16 isolated the plugin route; later legacy-id records belong to DSH native. */
export declare const LEGACY_ROUTE_CUTOFF_MS: number;
/** Minimal structural event face; the Host owns the real session types. */
export interface AnalyticsEventLike {
    readonly type: string;
    readonly seq: number;
    readonly time: number;
    readonly data?: unknown;
}
/** Minimal structural snapshot returned by readSession. */
export interface AnalyticsSnapshotLike {
    readonly inheritedEventCount: number;
    readonly events: readonly AnalyticsEventLike[];
}
/** One model request that the dashboard can price. */
export interface RequestFact {
    /** Request start, Unix epoch milliseconds. */
    readonly at: number;
    readonly model: string;
    readonly input: number;
    readonly output: number;
    readonly cacheRead: number;
    readonly cacheWrite: number;
    /** The request was recorded under the pre-0.1.16 route id. */
    readonly legacy: boolean;
    readonly kind: 'message' | 'summary';
    /** The request settled without a usable usage report. */
    readonly missingUsage: boolean;
}
/** Everything one session contributes, before date filtering. */
export interface FoldedSession {
    readonly facts: RequestFact[];
    /** Start times of attempts that committed no surface message. */
    readonly attempts: number[];
    /** Model calls with no usable routing header or model id. */
    readonly unattributed: number[];
    /** Events that passed the fork-prefix filter — never the inherited prefix (review P11). */
    readonly events: number;
}
/**
 * Whether a recorded provider id belongs to this plugin.
 * @param provider - the provider id in a request header or summary event.
 * @param at - the request start time.
 * @param cutoff - legacy route cutoff, overridable in tests.
 * @returns true when the request is this plugin's.
 */
export declare function isPluginRoute(provider: unknown, at: number, cutoff?: number): boolean;
/**
 * Fold one session snapshot.
 * @param snapshot - complete raw event log plus its fork-inherited prefix length.
 * @param options - test seams; the cutoff defaults to the 0.1.16 release.
 * @returns the session's priceable facts and counters.
 */
export declare function foldSession(snapshot: AnalyticsSnapshotLike, options?: {
    cutoff?: number;
}): FoldedSession;
/** Why an analytics read failed. */
export type AnalyticsFailureReason = 'no-session-query' | 'invalid-range' | 'scan-failed';
/** One dashboard read. Dates are Unix epoch milliseconds. */
export interface AnalyticsQuery {
    /** Inclusive start. */
    from: number;
    /** Exclusive end. */
    to: number;
    /** IANA timezone used to bucket days. */
    timeZone: string;
    /** Session scan cap, 1..2000; the Host default applies when absent. */
    maxSessions?: number;
}
/** Totals over the requested range. */
export interface AnalyticsTotals {
    requests: number;
    unsettledAttempts: number;
    summaries: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedMicroUsd: number;
    pricedRequests: number;
    unpricedRequests: number;
    missingUsage: number;
}
/** One model's share of the range. */
export interface AnalyticsModelRow {
    model: string;
    name?: string;
    requests: number;
    missingUsage: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedMicroUsd: number;
    pricedRequests: number;
    unpricedRequests: number;
    /** Go monthly limit in USD; null when unlimited or unknown. */
    limitGoUsd: number | null;
    /** Go Plus monthly limit in USD; null when unlimited or unknown. */
    limitGoPlusUsd: number | null;
    limitNote?: 'unlimited' | 'limited-time' | 'unknown';
}
/** One local calendar day. */
export interface AnalyticsDayRow {
    /** YYYY-MM-DD in the query timezone. */
    day: string;
    requests: number;
    tokens: number;
    estimatedMicroUsd: number;
}
/** Coverage and budget limits for this report. */
export interface AnalyticsCoverage {
    listedSessions: number;
    scannedSessions: number;
    matchedSessions: number;
    failedSessions: number;
    eventsScanned: number;
    summaries: number;
    legacyRequests: number;
    missingUsage: number;
    truncated: boolean;
    truncation?: 'sessions' | 'events' | 'time';
    scanMs: number;
    timeZoneFallback?: true;
    /**
     * Sessions listed but never scanned because the slice cap or a budget
     * stopped first (review P16/P18/M1). Observability only — this never
     * implies the requested range was fully covered.
     */
    unreadSessions?: number;
    /**
     * Cache entries the end-of-run trim dropped after this report was computed
     * from run-local results; the next run re-reads them (review P3/S1).
     */
    evictedSessions?: number;
    /**
     * Model calls in range with no usable routing header or model id, counted
     * for visibility only — never in tokens or cost (review P12).
     */
    unattributedRequests?: number;
    /** Session listing wall time; scanMs excludes it (review S6). */
    listMs?: number;
    /** Pricing harvest wall time; scanMs excludes it (review S6/P4). */
    pricingMs?: number;
}
/** Where the prices came from. */
export interface AnalyticsPricing {
    source: 'models.dev';
    updatedAt?: number;
    /**
     * True only when the whole price table was unavailable; unpricedModels then
     * lists every model that actually appeared in the range (review P15). A
     * table that loaded but lacks a model leaves this unset and lists the model.
     */
    unavailable?: true;
    unpricedModels: string[];
}
/** One complete dashboard response. */
export interface AnalyticsReport {
    generatedAt: number;
    range: {
        from: number;
        to: number;
    };
    timeZone: string;
    totals: AnalyticsTotals;
    byModel: AnalyticsModelRow[];
    byDay: AnalyticsDayRow[];
    coverage: AnalyticsCoverage;
    pricing: AnalyticsPricing;
}
/** Structural face of one sessionQuery record. */
export interface AnalyticsSessionRecord {
    readonly header?: {
        readonly id?: string;
        readonly createdAt?: number;
    };
    readonly live?: boolean;
    readonly persisted?: boolean;
}
/** The subset of ctx.sessionQuery this service needs. */
export interface AnalyticsSessionQuery {
    listSessions(signal?: AbortSignal): Promise<readonly AnalyticsSessionRecord[]>;
    readSession(id: string): Promise<AnalyticsSnapshotLike>;
}
/** Structural face of one catalog model. */
export interface AnalyticsPricingModel {
    readonly id?: string;
    readonly name?: string;
    readonly cost?: ModelCostLike;
}
/** Pricing data and its last update, when known. */
export interface AnalyticsPriceBook {
    readonly models: ReadonlyMap<string, AnalyticsPricingModel>;
    readonly updatedAt?: number;
}
/** Structural face of the catalog data the price book builder consumes. */
export interface AnalyticsCatalogSnapshotLike {
    readonly models: ReadonlyMap<string, AnalyticsPricingModel>;
    readonly details?: ReadonlyMap<string, {
        readonly costKnown?: false;
    }>;
    readonly metadataUpdatedAtMs?: number;
}
/** Construction options; tests inject fakes for every seam. */
export interface AnalyticsOptions {
    query: () => AnalyticsSessionQuery | undefined;
    pricing: () => Promise<AnalyticsPriceBook | undefined>;
    now?: () => number;
    budgetMs?: number;
    maxSessions?: number;
    maxEvents?: number;
    maxFacts?: number;
    /**
     * Maximum concurrent session reads (review P1/S3). One or less scans
     * serially — the rollback path for a Host whose readSession cannot run
     * concurrently.
     */
    maxConcurrency?: number;
}
/**
 * Build the analytics price book from one catalog snapshot (review P14 core
 * half). A model the metadata marked `costKnown: false` — upstream published
 * no cost block, or a malformed one whose fabricated zeros are
 * indistinguishable from a genuinely free model — is entered without a cost,
 * so its requests land in the unpriced bucket instead of being priced at 0.
 * A published block with legal components stays priced even when all zero.
 */
export declare function analyticsPriceBook(snapshot: AnalyticsCatalogSnapshotLike): AnalyticsPriceBook;
/** One mount owns the scan cache; multiple dashboard opens share it. */
export declare class GoAnalyticsService extends TypertRemoteService {
    private readonly options;
    private readonly cache;
    private readonly pending;
    /** The most recent successful price table; stale-on-error fallback (review P4/S4). */
    private lastPriceBook;
    private factTotal;
    constructor(ctx: Context, options: AnalyticsOptions);
    /**
     * Read one aggregate report.
     * @param raw - the validated query from the RPC codec.
     * @param signal - caller cancellation, injected by the gateway after the
     *   business parameters and never carried on the wire.
     * @returns the report; failures carry a reason in the domain error details.
     */
    read(raw: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsReport>;
    private now;
    private limitOf;
    private run;
    private remember;
    /** The one eviction point; returns how many entries it dropped (review S1/P2). */
    private trim;
}
