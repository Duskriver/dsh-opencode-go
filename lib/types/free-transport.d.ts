export declare const OPENCODE_FREE_USER_AGENT = "opencode/latest/2.2.5/cli";
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
    });
    forProxy(raw?: string): typeof globalThis.fetch;
    private acquire;
    private fetchRequest;
    private response;
    dispose(): Promise<void>;
}
