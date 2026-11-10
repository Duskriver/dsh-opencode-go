/** Extra time a relayed connection may stay quiet beyond the request stream budget. */
export declare const TUNNEL_IDLE_MARGIN_MS = 30000;
/**
 * Idle limit for a relayed connection: no bytes in either direction means
 * teardown. The limit is derived from the request stream idle budget, which is
 * user-configurable, so the relay outlives a silent prefill or queued Free
 * request and the request-level watchdog classifies the stall as a stream idle
 * timeout instead of a network failure; the margin only keeps the relay from
 * deciding first. The sum is clamped to Node's timer range: an unclamped
 * overflow of the schema maximum would be clamped to 1 ms by `setTimeout` and
 * tear every relayed request down immediately.
 * @param streamIdleTimeoutMs - request stream idle budget in milliseconds.
 * @returns the idle limit for an established relayed connection.
 */
export declare function tunnelIdleTimeoutMs(streamIdleTimeoutMs?: number): number;
/** Restrictions for one loopback relay instance. */
export interface SocksTunnelOptions {
    /**
     * The only target host the relay may reach. Omitted keeps the unconstrained
     * behavior used by direct tests; Free always passes the request hostname so a
     * local process that learns the port and password cannot use it as an open
     * proxy to arbitrary destinations.
     */
    allowedHost?: string;
    /**
     * Overridable idle limit for tests; production derives it from the request
     * stream budget via {@link tunnelIdleTimeoutMs}. Tests may pin short values.
     */
    idleTimeoutMs?: number;
}
export declare function openSocksTunnel(raw: string, signal: AbortSignal, options?: SocksTunnelOptions): Promise<{
    url: string;
    close(): Promise<void>;
}>;
