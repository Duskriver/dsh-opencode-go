/**
 * Fold one persisted session into request facts for the usage dashboard.
 *
 * The fold is range-independent: it records when each model call started and
 * what it reported, so later queries can filter by any date range and timezone
 * without reading the session again. It never returns session ids, titles or
 * message content.
 *
 * @module dsh-opencode-go/analytics-scan
 */
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
