export declare const OPENCODE_FREE_USER_AGENT = "opencode/latest/2.2.5/cli";
export declare class FreeBunTransport {
    private readonly options;
    private readonly shutdown;
    private readonly workers;
    private readonly requests;
    private readonly waiters;
    private active;
    constructor(options?: {
        executable?: () => string;
        workerPath?: () => string;
        maxConcurrent?: number;
    });
    forProxy(raw?: string): typeof globalThis.fetch;
    private acquire;
    private fetchRequest;
    private response;
    dispose(): Promise<void>;
}
