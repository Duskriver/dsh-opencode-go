/** Describe transport failures without echoing credentials or upstream response text. */
export declare function transportFailure(error: unknown): string;
/** Keep the endpoint useful in diagnostics without user information or query secrets. */
export declare function diagnosticURL(raw: string): string;
/** The caller's signal covers both attempts, the retry delay, and all response reads. */
export declare function fetchJsonResponse(url: string, init: RequestInit, maxBytes: number, encoding?: 'identity' | 'gzip', fetcher?: typeof globalThis.fetch): Promise<{
    response: Response;
    body: unknown;
}>;
/** Fetch normally decodes HTTP; only negotiated gzip may recover a raw gzip body (#7). */
export declare function readJsonResponse(response: Response, maxBytes: number, options?: {
    gzip?: boolean;
    signal?: AbortSignal | null;
}): Promise<unknown>;
