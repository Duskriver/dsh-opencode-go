/**
 * Wire contract for the usage dashboard. The Host scans local session history,
 * prices each request, and returns aggregate numbers only: no session ids,
 * titles, working directories, message content or credentials cross this seam.
 *
 * @module dsh-opencode-go/analytics-contract
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
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
/** How complete the scan was. */
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
}
/** Where the prices came from. */
export interface AnalyticsPricing {
    source: 'models.dev';
    updatedAt?: number;
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
/**
 * Validate one query. Unknown fields are ignored so a newer client can add
 * optional knobs without breaking an older Host.
 * @param value - raw RPC argument.
 * @returns the validated query.
 */
export declare function parseAnalyticsQuery(value: unknown): AnalyticsQuery;
/**
 * Validate one dashboard response.
 * @param value - raw RPC result.
 * @returns the validated report.
 */
export declare function parseAnalyticsReport(value: unknown): AnalyticsReport;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'opencode-go/analytics-unavailable': {
            readonly reason: AnalyticsFailureReason;
            readonly retryable: boolean;
        };
    }
    interface TypertRemoteNamespaceMap {
        opencodeGoAnalytics: {
            read(query: AnalyticsQuery): Promise<RemoteResult<AnalyticsReport>>;
        };
    }
}
/** The dashboard endpoint, mounted with the other plugin remotes. */
export declare const analyticsRemote: TypertRemoteContribution;
