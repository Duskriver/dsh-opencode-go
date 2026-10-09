/**
 * Configuration schema for the OpenCode Go adapter plugin. The section is
 * installed under the `llm-opencode-go` settings namespace on DSH 0.1.5/0.1.6.
 * DSH 0.1.7 edits the `opencode-go` profile entry through live references.
 * Both paths update field by field without a restart. Self-contained constraints
 * (URL shape, numeric bounds) fail at load for the composition layer and
 * refuse the write for the settings layer.
 *
 * @module dsh-llm-opencode-go/config
 */
import z from '@deepseek-ai/schemastery';
import type { OpencodeGoConfig } from './config-contract.ts';
export type { OpencodeGoConfig, OpencodeGoModelLimit, OpencodeGoModelLimits } from './config-contract.ts';
/** Environment variable resolving the OpenCode API key. */
export declare const DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
/** Successful refresh lifetime; failed refreshes retry sooner and explicit discovery revalidates immediately. */
export declare const DEFAULT_REFRESH_MINUTES = 60;
/** Default maximum idle interval while a stream read is outstanding. */
export declare const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
export declare const DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS = 60000;
export declare const DEFAULT_REQUEST_TIMEOUT_MS: number;
/** Plain values used by the adapter and by pre-0.1.7 settings documents. */
export declare const PlainConfig: z<OpencodeGoConfig>;
/** 0.1.7's Loader retains these references when profile fields change. */
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
 * @returns the normalized base URL without trailing slashes.
 */
export declare function assertBaseURL(raw: string): string;
/**
 * Reject a selected credential reference that is not a bare environment
 * variable name. The schema pattern above fails the composition layer and the
 * settings write; this assert gives the load and validate paths a message that
 * names the field, instead of schemastery's generic regexp complaint.
 * @param raw - the configured credential reference.
 */
export declare function assertApiKeyEnv(raw: string): void;
