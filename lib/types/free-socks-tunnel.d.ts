/** Restrictions for one loopback relay instance. */
export interface SocksTunnelOptions {
    /**
     * The only target host the relay may reach. Omitted keeps the unconstrained
     * behavior used by direct tests; Free always passes the request hostname so a
     * local process that learns the port and password cannot use it as an open
     * proxy to arbitrary destinations.
     */
    allowedHost?: string;
    /** Overridable idle limit for tests; defaults to two minutes. */
    idleTimeoutMs?: number;
}
export declare function openSocksTunnel(raw: string, signal: AbortSignal, options?: SocksTunnelOptions): Promise<{
    url: string;
    close(): Promise<void>;
}>;
