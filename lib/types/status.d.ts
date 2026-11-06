/** Model access status read from the public OpenCode status feed. */
import { type GoStatusReport } from './contracts.ts';
import { ProxyTransport } from './transport.ts';
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
export interface StatusOptions {
    /** Shared proxy transport; the service owns one only when none is given. */
    transport?: ProxyTransport;
    proxyURL?: () => string | undefined;
    /** Overridable for tests and mirrors of the official feed. */
    statusURL?: () => string;
    /** Cache window; the default keeps reads cheap while staying fresh. */
    ttlMs?: number;
}
/**
 * Serves `opencodeGoStatus.read()` from the public status feed with a short
 * shared cache: every conversation pill reads the same report without
 * multiplying requests, and no credential ever reaches the feed.
 */
export declare class GoStatusService extends TypertRemoteService {
    private readonly options;
    private cached;
    private pending;
    private readonly transport;
    constructor(ctx: Context, options: StatusOptions);
    read(): Promise<GoStatusReport>;
    private fetchReport;
}
