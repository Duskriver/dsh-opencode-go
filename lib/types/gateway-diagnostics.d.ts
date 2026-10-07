/** One SDK attempt owns its capture; simultaneous requests cannot share evidence. */
export declare class GatewayDiagnostics {
    private readonly options;
    private evidence;
    private readonly secrets;
    constructor(options: {
        provider: string;
        model: string;
        apiKey: string;
        proxyURL?: string;
        fetch?: typeof globalThis.fetch;
        directory?: string;
    });
    private redact;
    readonly fetch: typeof globalThis.fetch;
    failureMessage(original: string): Promise<string>;
}
