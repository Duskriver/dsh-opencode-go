/** Request snapshots, SDK dispatch, deadlines and seamless account fallback. */
import { type OpencodeGoModelLimits, type GoAccountSwitch, type ModelSource } from './contracts.ts';
import { type GenerateOptions, type ImageAttachmentAccess, type StreamChunk, LlmAdapter, type LlmModelInfo, type LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore, ImageAttachmentRef, ImageRequestTarget } from '@deepseek-ai/dsh-attachment';
import type { Api, Model, Provider } from './sdk-types.ts';
import { type OpencodeGoConfig } from './config.ts';
import { ProxyTransport } from './transport.ts';
import { OpencodeGoCatalog } from './catalog.ts';
import { FreeBunTransport } from './free-transport.ts';
import { FreeChannelState } from './free-channel.ts';
/**
 * Whether the Free route may reuse saved Go credentials. A saved key is bound
 * to the endpoint it was configured for: the official platform gateway over
 * HTTPS on its default port, or a free base sharing the Go gateway's origin
 * (one self-hosted or reverse-proxy deployment serving both routes). Any other
 * `freeBaseURL` gets public access only, so pointing it at a third party cannot
 * forward a stored paid key. The official hostname alone is not enough: a
 * plain-text or re-ported `opencode.ai` URL could be intercepted or served by
 * an unknown listener, so it must not receive saved credentials either.
 * This is a local decision: no network probe is made and no credential is read.
 * @param config - the mount configuration captured for this request.
 * @returns true when Free may send saved account credentials.
 */
export declare function freeReusesSavedKeys(config: Pick<OpencodeGoConfig, 'baseURL' | 'freeBaseURL'>): boolean;
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
    /** Free-only passive backoff; never consulted by the Go executor. */
    freeChannel?: FreeChannelState;
    /** Resolve the credential reference captured with this call's endpoint; missing must fail loud. */
    resolveApiKey: (config: OpencodeGoConfig, signal?: AbortSignal) => Promise<string | undefined>;
    /**
     * Image input machinery; absent refuses image content, which is the posture
     * for direct construction without a durable attachment service behind it.
     */
    imageAccess?: OpencodeGoImageAccess;
    /** Observe assistant history degrading to provider-neutral conversion. */
    onReplayDegrade?: (reason: string) => void;
    /**
     * Observe a configured thinking budget that was ignored or clamped for one
     * model. Configured budgets never fail resolution; this is the only visible
     * signal that a stale setting was dropped.
     */
    onModelWarning?: (detail: {
        model: string;
        reason: string;
    }) => void;
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
    private readonly freeTransport;
    private readonly ownsFreeTransport;
    constructor(options: OpencodeGoRequestExecutorOptions, transport: ProxyTransport, freeTransport?: FreeBunTransport);
    /**
     * Release a Free transport this executor created itself. An injected
     * transport is released by its owner, so a direct construction is the only
     * caller for which this performs work.
     */
    dispose(): Promise<void>;
    /** One account, one SDK attempt; host recovery still owns failures after output. */
    stream(options: GenerateOptions, snapshot: OpencodeGoRequestSnapshot): AsyncIterable<StreamChunk>;
    private attempt;
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
    /**
     * Transport shared with the Host composition (usage reads, analytics and the
     * other route). Injected ownership stays with the caller: {@link OpencodeGoAdapter.dispose}
     * releases only this adapter's Free transport in that case.
     */
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
    /**
     * Observe one Free request refusing to reuse saved credentials because its
     * `freeBaseURL` is not bound to them. The detail carries origins only, never a
     * credential; the Host may log it at info/debug level.
     */
    onFreeCredentialWithheld?: (detail: {
        reason: 'unbound-free-endpoint';
        freeBaseURL: string;
    }) => void;
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
    /** An injected transport is shared with the Host and must not be disposed here. */
    private readonly ownsTransport;
    private readonly requestExecutor;
    private readonly freeTransport;
    private readonly freeChannel;
    /** Per-reference rejection deadlines, isolated by the gateway that rejected it. */
    private readonly rejectedKeys;
    /**
     * Reference updates invalidate rejections from attempts using an older key.
     * Values are globally monotonic epochs, so pruning never reuses a version.
     */
    private readonly credentialVersions;
    private credentialEpoch;
    /** Monotonic sequence of the latest request this adapter started. */
    private callSeq;
    private nextCallSequence;
    constructor(options: OpencodeGoAdapterOptions);
    /**
     * Release this adapter's own resources. The Host composition shares one
     * ProxyTransport across both adapters and its services, so only an
     * adapter-created transport is disposed here; the per-adapter Free transport
     * (Bun workers and SOCKS tunnels) always is.
     */
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
    /**
     * Report the exact request-image projection this route serializes: the
     * configured pixel budget decides the dimensions and the configured
     * encoded-byte target caps the bytes, matching conversion.ts's per-request
     * target. The token meter must price what is sent, not the normalized source.
     * Synchronous by contract; the live configuration is readable without I/O.
     */
    imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): ImageRequestTarget;
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
    /** Drop expired rejections so the maps stay bounded by the recent window. */
    private pruneRejectedKeys;
    private rememberRejectedKey;
    /** A stored change to a reference outranks the gateway's last rejection of it. */
    forgetRejectedKey(ref: string): void;
    /**
     * Keep the version map bounded: account rosters are at most MAX_ACCOUNTS, so
     * only references that are not current accounts can push it over the cap.
     * Those are evicted first; the roster entries are kept. A pruned entry reads
     * as version 0 (unchanged), which cannot falsely match an attempt that saw a
     * real epoch (>= 1); requests started before a reference's first change keep
     * their 0 and are only reachable in the artificial overflow/rename window.
     */
    private pruneCredentialVersions;
}
