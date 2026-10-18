/**
 * Host-side usage analytics: scan the live-preferred session corpus through
 * ctx.sessionQuery, fold each log into request facts, price them with the
 * catalog's rates, and return aggregate numbers only.
 *
 * Closed sessions are cached for the process lifetime under an LRU policy
 * whose eviction runs once, at the end of a scan (review P2/M2/S1); a live
 * session's fold is reused only inside a short window (review P6), and a
 * session that closes is re-read once before its closed cache entry takes
 * over (review P9/S2). Aggregation consumes run-local fold results, so a
 * mid-scan eviction can never subtract a session from the report it was read
 * for (review P3/C3/S1). Reads run through a bounded, configurable pool
 * (review P1/S3), each read carrying its own share of the time budget
 * (review P18/C2), and pricing is fetched in parallel with the scan with a
 * stale-on-error fallback to the last successful table (review P4/S4).
 * A scan stops at a session/event/time budget and says so rather than
 * silently reporting a partial total as complete.
 *
 * @module dsh-opencode-go/analytics
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type AnalyticsQuery, type AnalyticsReport } from './analytics-contract.ts';
import { type AnalyticsSnapshotLike } from './analytics-scan.ts';
import { type ModelCostLike } from './analytics-pricing.ts';
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
