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
