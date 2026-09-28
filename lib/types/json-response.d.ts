/** Describe transport failures without echoing credentials or upstream response text. */
export declare function transportFailure(error: unknown): string;
/** Keep the endpoint useful in diagnostics without user information or query secrets. */
export declare function diagnosticURL(raw: string): string;
/** The caller's signal covers both attempts, the retry delay, and all response reads. */
export declare function fetchJsonResponse(url: string, init: RequestInit, maxBytes: number): Promise<{
    response: Response;
    body: unknown;
}>;
/** Fetch handles HTTP decoding; this reader bounds the bytes it delivers. */
export declare function readJsonResponse(response: Response, maxBytes: number): Promise<unknown>;
