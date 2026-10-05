import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type GoUsage } from './usage-contract.ts';
import type { GoAccountSwitch } from './accounts.ts';
import { ProxyTransport } from './proxy.ts';
interface UsageOptions {
    baseURL: () => string;
    proxyURL?: () => string;
    transport?: ProxyTransport;
    resolveApiKey: (ref?: string) => Promise<string | undefined>;
    activeRef?: () => string;
    accountRefs?: () => readonly string[];
    lastSwitch?: () => GoAccountSwitch | undefined;
}
/** Account statistics are fetched on the Host; credentials never enter the browser. */
export declare class GoUsageService extends TypertRemoteService {
    private readonly options;
    private readonly identities;
    private readonly pending;
    private readonly transport;
    constructor(ctx: Context, options: UsageOptions);
    read(): Promise<GoUsage>;
    readAccount(ref: string): Promise<GoUsage>;
    private readRef;
    private fetchUsage;
}
export {};
