/**
 * Host-side usage analytics: scan the live-preferred session corpus through
 * ctx.sessionQuery, fold each log into request facts, price them with the
 * catalog's rates, and return aggregate numbers only.
 *
 * Closed sessions are cached for the process lifetime; live sessions are
 * re-read on every query. A scan stops at a session/event/time budget and says
 * so rather than silently reporting a partial total as complete.
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
/** Construction options; tests inject fakes for every seam. */
export interface AnalyticsOptions {
    query: () => AnalyticsSessionQuery | undefined;
    pricing: () => Promise<AnalyticsPriceBook | undefined>;
    now?: () => number;
    budgetMs?: number;
    maxSessions?: number;
    maxEvents?: number;
    maxFacts?: number;
}
/** One mount owns the scan cache; multiple dashboard opens share it. */
export declare class GoAnalyticsService extends TypertRemoteService {
    private readonly options;
    private readonly cache;
    private readonly pending;
    private factTotal;
    constructor(ctx: Context, options: AnalyticsOptions);
    /**
     * Read one aggregate report.
     * @param raw - the validated query from the RPC codec.
     * @returns the report; failures carry a reason in the domain error details.
     */
    read(raw: AnalyticsQuery): Promise<AnalyticsReport>;
    private now;
    private limitOf;
    private run;
    private remember;
}
