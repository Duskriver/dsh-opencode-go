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
import { type UsageDisplayMode } from './usage-display.ts';
import { type GoAccount } from './accounts.ts';
/** Environment variable resolving the OpenCode API key. */
export declare const DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
/** Successful refresh lifetime; failed refreshes retry sooner and explicit discovery revalidates immediately. */
export declare const DEFAULT_REFRESH_MINUTES = 60;
/** Default maximum idle interval while a stream read is outstanding. */
export declare const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300000;
/**
 * One model's configured capacities. Every field is optional so a deployment
 * can override only the value it needs. Null explicitly selects the catalog
 * value even when a lower profile/settings layer supplies an override.
 */
export interface OpencodeGoModelLimit {
    /** Context window in tokens, overriding what the catalog advertised. */
    contextWindow?: number | null;
    /** Output cap per request, overriding what the catalog advertised. */
    maxTokens?: number | null;
    /** Additional selectable thinking budgets, in tokens; null keeps the standard presets. */
    thinkingBudgets?: number[] | null;
}
/** Per-model capacities; a null entry selects both original catalog values. */
export type OpencodeGoModelLimits = Record<string, OpencodeGoModelLimit | null>;
/** Runtime configuration for one plugin mount. */
export interface OpencodeGoConfig {
    /**
     * Whether this adapter serves its route at all. False withdraws the
     * `dsh-opencode-go` route and its models from every picker without unloading the
     * plugin, so the settings page that owns this switch stays reachable to turn
     * it back on. Independent of the credential: a key present while this is
     * false registers nothing.
     */
    enabled: boolean;
    /** Usage pill visibility; auto follows this plugin's selected provider. */
    usageDisplay: UsageDisplayMode;
    /** Per-model picker switches; absent entries default to enabled unless deprecated. */
    modelVisibility?: Record<string, boolean>;
    /** Credential reference: the environment variable the key resolves from. */
    apiKeyEnv: string;
    accounts?: GoAccount[] | null;
    /** Try other saved accounts on quota/credential rejection before any content is emitted. */
    autoSwitch?: boolean;
    /** The gateway endpoint; also the base of the live model listing. */
    baseURL: string;
    /** Optional HTTP(S) or SOCKS5 proxy; blank uses the default network transport. */
    proxyURL: string;
    /** Request/picker cache lifetime in minutes; explicit discovery bypasses it. */
    refreshMinutes: number;
    /** Largest idle gap between stream events before the request fails. */
    streamIdleTimeoutMs: number;
    /** Optional retained image occurrence cap per request; omission or null leaves the count unlimited. */
    maxImages?: number | null;
    /** Request-level bound on base64-encoded image payload, in bytes. */
    maxRequestImageBytes: number;
    /** Total-pixel budget for one request image. */
    requestImagePixelBudget: number;
    /** Raw encoded-byte target for one request image before base64 expansion. */
    requestImageMaxBytes: number;
    /** Per-model capacity overrides; an absent field inherits the catalog value. */
    modelLimits: OpencodeGoModelLimits;
}
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
