import type { GenerateOptions, ImageAttachmentAccess, StreamChunk } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { Api, Model, Provider } from './sdk-types.ts';
import type { OpencodeGoConfig } from './config.ts';
import type { ProxyTransport } from './proxy.ts';
import type { CallTrace } from './call-trace.ts';
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
    /** Optional directory for bounded HTTP error evidence; request contents are omitted. */
    debugDirectory?: () => string | undefined;
    /** Observe assistant history degrading to provider-neutral conversion. */
    onReplayDegrade?: (reason: string) => void;
}
/** Inputs already resolved by the adapter, including one account and the wire session ID. */
export interface OpencodeGoRequestSnapshot {
    config: OpencodeGoConfig;
    model: Model<Api>;
    provider: Provider;
    sessionId: string;
}
/** Shares the adapter's transport without owning its lifetime or retrying accounts. */
export declare class OpencodeGoRequestExecutor {
    private readonly options;
    private readonly transport;
    constructor(options: OpencodeGoRequestExecutorOptions, transport: ProxyTransport);
    /** One account, one SDK attempt; host recovery still owns failures after output. */
    stream(options: GenerateOptions, snapshot: OpencodeGoRequestSnapshot, trace: CallTrace): AsyncIterable<StreamChunk>;
}
