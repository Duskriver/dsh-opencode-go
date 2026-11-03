import type { Context } from '@deepseek-ai/cordis';
import { type LiveConfig, type OpencodeGoConfig } from './config.ts';
declare module '@deepseek-ai/cordis' {
    interface Events {
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
export { OpencodeGoAdapter } from './adapter.ts';
export type { OpencodeGoAdapterOptions, OpencodeGoImageAccess, GoAccountSettlement } from './adapter.ts';
export { DEFAULT_BASE_URL, DEFAULT_FREE_BASE_URL, DISPLAY_NAME, PROVIDER_ID, FREE_DISPLAY_NAME, FREE_PROVIDER_ID, OpencodeGoCatalog, discoverCatalogModels, readLiveModelIds, } from './catalog.ts';
export { Config, PlainConfig, assertBaseURL } from './config.ts';
export { assertProxyURL } from './contracts.ts';
export type { OpencodeGoConfig } from './config.ts';
export declare const name = "llm-opencode-go";
export declare const inject: string[];
/** Settings namespace this plugin installs and the Web page edits. */
export declare const NS = "llm-opencode-go";
/**
 * Register the route, model discovery and settings presentation for one mount.
 * The adapter re-reads live profile fields at every operation.
 */
export declare function apply(ctx: Context, raw?: OpencodeGoConfig | LiveConfig): void;
/** Register once per plugin mount, after either registry activation order. */
export declare function registerGoRemotes(ctx: Context): void;
