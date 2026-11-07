import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type AnalyticsQuery, type AnalyticsReport, type AnalyticsExport } from './contracts.ts';
import { ProxyTransport } from './transport.ts';
export declare const ANALYTICS_MAX_BYTES: number;
export interface AnalyticsOptions {
    baseURL: () => string;
    proxyURL?: () => string;
    transport?: ProxyTransport;
    resolveApiKey: (ref: string) => Promise<string | undefined>;
    accountRefs: () => readonly string[];
    now?: () => number;
    fetch?: typeof globalThis.fetch;
}
/** The Host retains parsed official rows for export; ordinary reads expose only aggregate numbers. */
export declare class GoAnalyticsService extends TypertRemoteService {
    private readonly options;
    private readonly identities;
    private readonly cache;
    private readonly pending;
    private readonly active;
    private readonly transport;
    constructor(ctx: Context, options: AnalyticsOptions);
    read(raw: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsReport>;
    exportCsv(raw: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsExport>;
    private now;
    private query;
    private failure;
    /** A shared task superseded by an identity/network change is not a caller cancellation. */
    private cancelled;
    private forget;
    private network;
    private assertCurrentNetwork;
    private identity;
    private dataset;
    private fetchDataset;
}
