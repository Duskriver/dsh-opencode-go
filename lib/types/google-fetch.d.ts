export declare function withGoogleFetch<T>(options: {
    fetch?: typeof globalThis.fetch;
    headers?: Record<string, string | null>;
} | undefined, request: () => T): T;
/** The pinned Google SDK's HTTP call uses this binding in builds and tests. */
export declare const googleFetch: typeof globalThis.fetch;
