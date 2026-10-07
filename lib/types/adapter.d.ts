/**
 * The OpenCode Go adapter: one route, one catalog, per-request routing header.
 *
 * Every request to the gateway carries two Harness-owned headers: the
 * attribution User-Agent (`deepseek-harness/<version>`), which pi-ai's client
 * lets request headers override, and `x-opencode-session`, which the gateway
 * requires and uses to route a conversation and share its prompt cache. The
 * header value is the request's session id, stable across continuation and
 * restore. Actual cache reads remain an upstream usage fact. A request with no
 * session id gets a fresh random value rather than a shared constant, because
 * a constant would merge unrelated traffic into one cache bucket.
 *
 * Multi-turn correctness rides on the shared pi-ai conversion machinery
 * (`toPiContext` reconstructs provider-native replay state from the session
 * log; `toStreamChunks` maps events to seam chunks), so assistant history,
 * tool calls, and usage land in the session log exactly as the generic pi-ai
 * adapter records them. Image content rides the same machinery: models whose
 * catalog entry declares the image modality convert attachments through the
 * durable attachment service, and every other model refuses image content
 * before any provider I/O.
 *
 * @module dsh-llm-opencode-go/adapter
 */
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, ImageAttachmentAccess, LlmModelInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { OpencodeGoCatalog } from './catalog.ts';
import { ProxyTransport } from './proxy.ts';
import type { OpencodeGoConfig } from './config.ts';
import { type GoAccountSwitch } from './accounts.ts';
/**
 * The attachment-service bridges one image request reads. Construction-time
 * (context-dependent); the config-dependent policy numbers are merged per
 * request from the current configuration.
 */
export interface OpencodeGoImageAccess {
    /** Resolve the optional durable attachment service at request time. */
    resolveAttachments: () => AttachmentStore | undefined;
    /** Bridge one attachment reference into the current model-tool execution world. */
    resolveImageAccess: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined;
}
/** Constructor inputs for {@link OpencodeGoAdapter}. */
export interface OpencodeGoAdapterOptions {
    /** Shared with Host usage reads for this plugin mount. */
    transport?: ProxyTransport;
    /** Optional directory for bounded HTTP error evidence; request contents are omitted. */
    debugDirectory?: () => string | undefined;
    /**
     * The current configuration, re-read at every operation: a settings write
     * reaches the next request without a restart, and one operation never mixes
     * two configuration generations.
     */
    config: () => OpencodeGoConfig;
    /** Resolve the credential reference captured with this call's endpoint; missing must fail loud. */
    resolveApiKey: (config: OpencodeGoConfig) => Promise<string | undefined>;
    /**
     * Image input machinery; absent refuses image content, which is the posture
     * for direct construction without a durable attachment service behind it.
     */
    imageAccess?: OpencodeGoImageAccess;
    /** Observe the catalog falling back to the curated table. */
    onFallback?: (detail: {
        url: string;
        error: unknown;
        kept: number;
    }) => void;
    /** Observe live ids the curated table cannot route. */
    onOmitted?: (ids: readonly string[]) => void;
    /** Observe assistant history degrading to provider-neutral conversion. */
    onReplayDegrade?: (reason: string) => void;
    /** Re-read picker models after a background catalog refresh commits. */
    onCatalogRefresh?: () => void;
    onAccountSwitch?: (notice: GoAccountSwitch | undefined, config: OpencodeGoConfig) => void;
}
/**
 * The single route's adapter. The catalog snapshot freezes at each operation,
 * so a refresh between two requests never mixes model generations inside one
 * call.
 */
export declare class OpencodeGoAdapter extends LlmAdapter {
    private readonly options;
    /**
     * One catalog instance per endpoint/refresh pair. A settings write that
     * changes either gets a fresh resolver (and a fresh live-listing fetch) on
     * the next operation; an unchanged configuration keeps its cached snapshot
     * for the whole refresh interval.
     */
    private catalogCache;
    private readonly transport;
    /** Per-reference rejection deadlines, isolated by the gateway that rejected it. */
    private readonly rejectedKeys;
    constructor(options: OpencodeGoAdapterOptions);
    dispose(): Promise<void>;
    /**
     * The catalog resolver for one configuration, rebuilding on the facts it
     * owns. Public for the plugin's discovery registration, which resolves the
     * current configuration the same way the adapter does.
     * @param config - the endpoint and refresh interval for the raw catalog.
     * @returns the resolver caching catalog values, independent of deployment limits.
     */
    catalogOf(config: OpencodeGoConfig): OpencodeGoCatalog;
    providerInfo(provider: string): {
        id: string;
        name: string;
    };
    listModels(_provider: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(_provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    /** Copy nested limits before discovery can yield to a settings update. */
    private callSnapshot;
    /** Keep capability resolution and eventual dispatch on the same configuration. */
    prepareCall(_provider: string, model: string, signal?: AbortSignal): Promise<{
        model: LlmResolvedModelInfo;
        stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>;
    }>;
    /** Describe one model: capacities plus the reasoning levels it actually offers. */
    private modelInfo;
    /** Validate an explicit effort against the model's own levels, without clamping. */
    private resolveReasoningLevel;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private streamWithSnapshot;
    private rememberRejectedKey;
    /** A stored change to a reference outranks the gateway's last rejection of it. */
    forgetRejectedKey(ref: string): void;
    /** One account, one SDK attempt; host recovery still owns failures after output. */
    private streamAttempt;
}
