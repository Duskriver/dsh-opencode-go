/** Request snapshots, SDK dispatch, deadlines and seamless account fallback. */
import { type OpencodeGoModelLimits, type GoAccountSwitch, type ModelSource } from './contracts.ts';
import { type GenerateOptions, type ImageAttachmentAccess, type StreamChunk, LlmAdapter, type LlmModelInfo, type LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { Api, Model, Provider } from './sdk-types.ts';
import { type OpencodeGoConfig } from './config.ts';
import { ProxyTransport } from './transport.ts';
import { OpencodeGoCatalog } from './catalog.ts';
/**
 * Cap large models at 64k unless the caller or settings specify an allowance.
 * Per-model settings continue to cap explicit caller values.
 */
export declare function requestMaxTokens(model: {
    id: string;
    maxTokens: number;
    source?: ModelSource;
}, limits: OpencodeGoModelLimits, requested?: number): number | undefined;
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
/** Host dependencies used by a single attempt, independent of account selection. */
export interface OpencodeGoRequestExecutorOptions {
    /** Resolve the credential reference captured with this call's endpoint; missing must fail loud. */
    resolveApiKey: (config: OpencodeGoConfig, signal?: AbortSignal) => Promise<string | undefined>;
    /**
     * Image input machinery; absent refuses image content, which is the posture
     * for direct construction without a durable attachment service behind it.
     */
    imageAccess?: OpencodeGoImageAccess;
    /** Observe assistant history degrading to provider-neutral conversion. */
    onReplayDegrade?: (reason: string) => void;
}
/** Inputs already resolved by the adapter, including one account and the wire session ID. */
export interface OpencodeGoRequestSnapshot {
    config: OpencodeGoConfig;
    model: Model<Api>;
    provider: Provider;
    sessionId: string;
    apiKey?: string;
}
/** Shares the adapter's transport without owning its lifetime or retrying accounts. */
export declare class OpencodeGoRequestExecutor {
    private readonly options;
    private readonly transport;
    constructor(options: OpencodeGoRequestExecutorOptions, transport: ProxyTransport);
    /** One account, one SDK attempt; host recovery still owns failures after output. */
    stream(options: GenerateOptions, snapshot: OpencodeGoRequestSnapshot): AsyncIterable<StreamChunk>;
}
/** One request's serving account, with the identity captured before discovery. */
export interface GoAccountSettlement {
    seq: number;
    generation: number;
    config: OpencodeGoConfig;
    ref: string;
    notice?: GoAccountSwitch;
}
/** Constructor inputs for {@link OpencodeGoAdapter}. */
export interface OpencodeGoAdapterOptions extends OpencodeGoRequestExecutorOptions {
    source?: ModelSource;
    /** Shared with Host usage reads for this plugin mount. */
    transport?: ProxyTransport;
    /** Mount-owned discovery; direct construction supplies its own manager. */
    catalog?: (config: OpencodeGoConfig) => OpencodeGoCatalog;
    /**
     * The current configuration, re-read at every operation: a settings write
     * reaches the next request without a restart, and one operation never mixes
     * two configuration generations.
     */
    config: () => OpencodeGoConfig;
    /** Observe discovery retaining its last successful directory. */
    onFallback?: (detail: {
        url: string;
        error: unknown;
        kept: number;
    }) => void;
    /** Observe chat rows with invalid or unsupported declarations. */
    onOmitted?: (ids: readonly string[]) => void;
    onCatalogWarning?: (warning: string) => void;
    /** Re-read picker models after a background catalog refresh commits. */
    onCatalogRefresh?: () => void;
    /** Host account-state version for actual requests, captured before asynchronous model discovery. */
    accountGeneration?: () => number;
    /** Shared by both adapters so account settlement ordering spans both routes. */
    nextCallSequence?: () => number;
    /** One outcome for both the displayed notice and the persisted selection. */
    onAccountSettled?: (event: GoAccountSettlement) => void;
    /** Legacy notice observer. Hosts that persist selection should use onAccountSettled. */
    onAccountSwitch?: (notice: GoAccountSwitch | undefined, config: OpencodeGoConfig, seq: number) => void;
}
/**
 * One source's route adapter. The catalog snapshot freezes at each operation,
 * so a refresh between two requests never mixes model generations inside one
 * call.
 */
export declare class OpencodeGoAdapter extends LlmAdapter {
    private readonly options;
    private readonly source;
    private readonly resolveCatalog;
    private readonly transport;
    private readonly requestExecutor;
    /** Per-reference rejection deadlines, isolated by the gateway that rejected it. */
    private readonly rejectedKeys;
    /** Reference updates invalidate rejections from attempts using an older key. */
    private readonly credentialVersions;
    /** Monotonic sequence of the latest request this adapter started. */
    private callSeq;
    private nextCallSequence;
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
    /** Capture limits and protocol before discovery can yield to a settings update. */
    private modelSnapshot;
    /** Keep capability resolution and eventual dispatch on the same configuration. */
    prepareCall(_provider: string, model: string, signal?: AbortSignal): Promise<{
        model: LlmResolvedModelInfo;
        stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>;
    }>;
    /** Report the same default allowance used by dispatch so the host can budget compaction. */
    private modelInfo;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private streamWithSnapshot;
    private dispatch;
    private streamAccounts;
    /** Resolve Free keys only when selecting an account or retrying a failed attempt. */
    private accountCandidates;
    private rememberRejectedKey;
    /** A stored change to a reference outranks the gateway's last rejection of it. */
    forgetRejectedKey(ref: string): void;
}
