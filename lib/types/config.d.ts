/** Live profile configuration, validation and settings presentation. */
import z from '@deepseek-ai/schemastery';
import { type OpencodeGoConfig } from './contracts.ts';
import type { Context } from '@deepseek-ai/cordis';
export type { OpencodeGoConfig, OpencodeGoModelLimit, OpencodeGoModelLimits } from './contracts.ts';
/** Environment variable resolving the OpenCode API key. */
export declare const DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
/** Successful refresh lifetime; failed refreshes retry sooner and explicit discovery revalidates immediately. */
export declare const DEFAULT_REFRESH_MINUTES = 60;
/** Default maximum idle interval while a stream read is outstanding. */
export declare const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
export declare const DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS = 60000;
export declare const DEFAULT_REQUEST_TIMEOUT_MS: number;
/** Plain configuration values used by validation and direct adapter consumers. */
export declare const PlainConfig: z<OpencodeGoConfig>;
/** The Loader retains these references when profile fields change. */
export type LiveConfig = {
    [K in keyof OpencodeGoConfig]-?: {
        get(): OpencodeGoConfig[K];
    };
};
export declare const Config: z<Partial<OpencodeGoConfig>, LiveConfig>;
/** Keep the Loader's references: reparsing them would detach live updates. */
export declare function readConfig(config: LiveConfig): OpencodeGoConfig;
/**
 * Accept only an http(s) base without a query or fragment. Runs at load for
 * the composition layer and as the settings section's write validator, so a
 * bad URL fails where it is written, never at first request.
 * @param raw - the configured base URL.
 * @returns the current gateway base URL without trailing slashes.
 */
export declare function assertBaseURL(raw: string, field?: 'baseURL' | 'freeBaseURL'): string;
/**
 * Reject a selected credential reference that is not a bare environment
 * variable name. The schema pattern above fails the composition layer and the
 * settings write; this assert gives the load and validate paths a message that
 * names the field, instead of schemastery's generic regexp complaint.
 * @param raw - the configured credential reference.
 */
export declare function assertApiKeyEnv(raw: string): void;
export declare function validateGoConfig(value: OpencodeGoConfig): void;
/** DSH profile forms edit the plugin's live Config fields directly. */
export declare function installHostSettings(ctx: Context): void;
