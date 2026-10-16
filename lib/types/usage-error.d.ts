interface UsageErrorOptions {
    apiKey: string;
    baseURL: string;
    proxyURL: string;
    signal: AbortSignal;
}
/** Read only diagnostic text; a slow/broken error body cannot hide its HTTP status. */
export declare function readUsageError(response: Response, options: UsageErrorOptions): Promise<string | undefined>;
export {};
