/** Cancel a wait even when an external service does not observe its signal. */
export declare function waitWithSignal<T>(work: () => PromiseLike<T>, signal?: AbortSignal): Promise<T>;
/** Per-mount transport. Fetch closures retain their address across settings changes. */
export declare class ProxyTransport {
    private current;
    private readonly retired;
    private disposed;
    forProxy(raw?: string): typeof globalThis.fetch | undefined;
    /** Close replaced pools after their in-flight response bodies have finished. */
    private retire;
    /** Unloading the mount cancels remaining requests and releases every pool. */
    dispose(): Promise<void>;
}
/** Describe transport failures without echoing credentials or upstream response text. */
export declare function transportFailure(error: unknown): string;
/** Keep the endpoint useful in diagnostics without user information or query secrets. */
export declare function diagnosticURL(raw: string): string;
/** The caller's signal covers both attempts, the retry delay, and all response reads. */
export declare function fetchJsonResponse(url: string, init: RequestInit, maxBytes: number, encoding?: 'identity' | 'gzip', fetcher?: typeof globalThis.fetch, readError?: (response: Response) => Promise<unknown>): Promise<{
    response: Response;
    body: unknown;
}>;
/** Fetch normally decodes HTTP; only negotiated gzip may recover a raw gzip body (#7). */
export declare function readJsonResponse(response: Response, maxBytes: number, options?: {
    gzip?: boolean;
    signal?: AbortSignal | null;
}): Promise<unknown>;
interface GatewayContextBudget {
    contextWindow?: number;
    maxTokens?: number;
    estimatedContextTokens?: number;
}
/** Gateway status codes cover several domains; model permissions do not reject a key. */
export declare function classifyGatewayError(status: number, body: string, fallback: string, budget?: GatewayContextBudget): string;
export declare class GatewayDiagnostics {
    private readonly options;
    private evidence;
    private code;
    private readonly secrets;
    constructor(options: GatewayContextBudget & {
        provider: string;
        model: string;
        apiKey: string;
        proxyURL?: string;
        fetch?: typeof globalThis.fetch;
    });
    private redact;
    readonly fetch: typeof globalThis.fetch;
    failureCode(fallback: string): Promise<string>;
    failureMessage(original: string): Promise<string>;
}
interface UsageErrorOptions {
    apiKey: string;
    baseURL: string;
    proxyURL: string;
    signal: AbortSignal;
}
/** Read only diagnostic text; a slow/broken error body cannot hide its HTTP status. */
export declare function readUsageError(response: Response, options: UsageErrorOptions): Promise<string | undefined>;
export declare function withGoogleFetch<T>(options: {
    fetch?: typeof globalThis.fetch;
    headers?: Record<string, string | null>;
} | undefined, request: () => T): T;
/** The pinned Google SDK's HTTP call uses this binding in builds and tests. */
export declare const googleFetch: typeof globalThis.fetch;
export {};
