import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type GoUsage } from './usage-contract.ts';
interface UsageOptions {
    baseURL: () => string;
    resolveApiKey: () => Promise<string | undefined>;
}
/** Account statistics are fetched on the Host; credentials never enter the browser. */
export declare class GoUsageService extends TypertRemoteService {
    private readonly options;
    private identity?;
    constructor(ctx: Context, options: UsageOptions);
    read(): Promise<GoUsage>;
}
export {};
