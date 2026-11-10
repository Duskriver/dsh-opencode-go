export declare const OPENCODE_FREE_USER_AGENT = "opencode/latest/2.2.5/cli";
/**
 * Largest accepted request body, in bytes. The bound is checked twice: against a
 * declared Content-Length before reading, and against the bytes actually read
 * once the body arrives. 64 MiB keeps the worker IPC packet bounded after base64
 * (4/3 growth) and JSON framing, so MAX_PACKET_BYTES stays a defense-in-depth
 * backstop instead of the first check to run after the body already occupies
 * memory as an ArrayBuffer, a Buffer, a base64 string and a JSON string.
 */
export declare const MAX_REQUEST_BODY_BYTES: number;
/**
 * Build the standalone worker's environment from an explicit allowlist. Bun is a
 * third-party native runtime, so Host credentials, proxy settings and TLS or
 * dynamic-linker overrides must not cross the process boundary even though the
 * worker only speaks HTTP: only variables Bun needs to start and resolve its
 * resources are forwarded. Windows matches names case-insensitively and keeps
 * the original spelling it finds; everything unlisted is omitted.
 * @param environment - source environment, normally `process.env`.
 * @param platform - target platform deciding the Windows extras.
 * @returns the minimal environment for the Bun child.
 */
export declare function freeWorkerEnvironment(environment?: NodeJS.ProcessEnv, platform?: NodeJS.Platform): NodeJS.ProcessEnv;
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
        maxRequestBodyBytes?: number;
    });
    /**
     * Build a fetch bound to one proxy URL.
     * @param raw - proxy URL; omitted or empty selects a direct connection.
     * @param streamIdleTimeoutMs - request stream idle budget the SOCKS relay must
     * outlive; omitted uses the default request stream budget.
     */
    forProxy(raw?: string, streamIdleTimeoutMs?: number): typeof globalThis.fetch;
    private acquire;
    private fetchRequest;
    private response;
    dispose(): Promise<void>;
}
