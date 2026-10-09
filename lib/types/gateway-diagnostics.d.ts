/** One SDK attempt owns its capture; simultaneous requests cannot share evidence. */
export declare class GatewayDiagnostics {
    private readonly options;
    private evidence;
    private code;
    private readonly secrets;
    constructor(options: {
        provider: string;
        model: string;
        apiKey: string;
        proxyURL?: string;
        fetch?: typeof globalThis.fetch;
        directory?: string;
        callId?: string;
        attempt?: number;
        onResponse?: (status: number, requestId?: string) => void;
    });
    private redact;
    readonly fetch: typeof globalThis.fetch;
    failureCode(fallback: string): Promise<string>;
    failureMessage(original: string): Promise<string>;
}
