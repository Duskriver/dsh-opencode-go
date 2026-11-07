/** Request history, durable images, provider replay and stream conversion. */
import { type Message as HistoryMessage, type ReplayEnvelope, type RequestMessage as Message, type GenerateOptions, type ImageAttachmentAccessResolver, type FinishReason, type StreamChunk, type TokenUsage } from '@deepseek-ai/dsh-llm';
import type { Api, AssistantMessage, Usage as PiUsage, Context as PiContext, AssistantMessageEvent } from './sdk-types.ts';
import { type ImageAttachmentRef, type AttachmentStore, type ImageRequestTarget } from '@deepseek-ai/dsh-attachment';
/** Per-block half of the pi-ai replay envelope, one entry per content block. */
export type PiAiReplayBlock = {
    type: 'text';
    textSignature?: string;
} | {
    type: 'reasoning';
    thinkingSignature?: string;
    redacted?: boolean;
} | {
    type: 'tool-call';
    thoughtSignature?: string;
};
/** Versioned response-level half of the pi-ai replay envelope. */
export interface PiAiReplayResponse {
    kind: 'pi-ai';
    version: 2;
    api: Api;
    /** Requested DSH provider identity, matching the durable assistant source. */
    provider: string;
    /** Native SDK provider when it differs from the DSH route. */
    sdkProvider?: string;
    /** Requested model identity, matching the durable assistant source. */
    model: string;
    /** Provider-reported model; informational only, so requested identity still matches replay signatures. */
    responseModel?: string;
    responseId?: string;
    /** Provider-native effort for historical replay; absence is preserved. */
    providerThinkingLevel?: string;
    stopReason: AssistantMessage['stopReason'];
    /** Measured context footprint for the next turn's SDK output-token clamp. */
    usage?: Pick<PiUsage, 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'totalTokens'>;
    /** Fingerprint of the request prefix and this reply that the usage measured. */
    usageContext?: string;
}
/** Capture one converted request before the SDK can mutate it while streaming. */
export declare function piContextUsageKey(context: PiContext, provider: string, model: string): string;
/**
 * Project a successful pi-ai response into the minimal durable replay state.
 * The per-block half is index-aligned with the streamed blocks (pi-ai content
 * order), so `BlockAssembler` prunes an entry with its block whenever assembly
 * removes one.
 * @param message - completed native pi-ai assistant response.
 * @param requestedModel - request identity stored in the assistant source; defaults to the native model.
 * @param requestedProvider - DSH route stored in the assistant source; defaults to the native provider.
 * @param usageContext - fingerprint of the request that produced this response.
 * @returns the versioned lossless-JSON replay projection.
 */
export declare function toPiReplayState(message: AssistantMessage, requestedModel?: string, requestedProvider?: string, usageContext?: string): ReplayEnvelope;
/**
 * Convert one durable Harness assistant message into pi-ai history.
 *
 * Durable content is the authoritative record; replay metadata only restores
 * native fidelity (ids, signatures). A replay state this build cannot use —
 * another adapter's kind, another version, a malformed value, or metadata that
 * no longer matches the content — therefore degrades the one message to
 * provider-neutral history instead of failing the request.
 * @param message - assistant content with required source and optional adapter-owned replay metadata.
 * @param onDegrade - called with the diagnostic reason when an unusable replay
 *   state falls back to provider-neutral conversion.
 * @returns a native pi-ai assistant message reconstructed from durable content.
 */
export declare function toPiAssistant(message: HistoryMessage, onDegrade?: (reason: string) => void): AssistantMessage;
interface ImageProjectionPolicy {
    maxImages?: number;
    maxBytes?: number;
    byteLength: (ref: ImageAttachmentRef) => number;
    placeholder: (ref: ImageAttachmentRef) => string;
    exact: boolean;
}
export declare function projectRequestImages(messages: readonly Message[], policy: ImageProjectionPolicy): readonly Message[];
/** Inputs that bind deterministic request images to one current tool execution world. */
export interface PiImageRequestContext {
    /** Durable provider that resolves request-image bytes and provider-owned host objects. */
    attachments: AttachmentStore;
    /** Resolve current tool access separately from deterministic request-image versions. */
    resolveImageAccess: ImageAttachmentAccessResolver;
    /** Maximum retained image occurrences across request history; omission leaves the count unlimited. */
    maxImages?: number;
    /** Request-level bound on the base64-encoded payload of retained images; omission leaves the bound unchecked. */
    maxRequestImageBytes?: number;
    /** Route pixel and raw encoded-byte budgets. */
    requestImagePolicy?: PiImageRequestBudget;
}
/** Per-route budgets from which each request image's target is derived. */
export interface PiImageRequestBudget {
    /** Total-pixel budget; larger sources are downscaled proportionally. */
    maxPixels: number;
    /** Encoded-byte target for one request image. */
    maxBytes: number;
}
/**
 * Deterministic request target for one source under the route budgets.
 *
 * The single projection both request serialization and the adapter's
 * `LlmAdapter.imageRequestTarget` report use: the token meter must price the
 * exact dimensions and encoded-byte target this route sends, not the
 * normalized source image.
 * @param ref - durable normalized image reference.
 * @param budget - route pixel and encoded-byte budgets.
 * @returns the target width, height and encoded-byte cap, plus the budgets.
 */
export declare function requestImageTargetFor(ref: ImageAttachmentRef, budget: PiImageRequestBudget): ImageRequestTarget & PiImageRequestBudget;
/**
 * Convert text-only harness history to a synchronous pi-ai Context. Tool
 * result names are recovered from preceding assistant tool calls.
 * @param options - the harness request; `options.system`, else a leading `system` message, maps to pi-ai's single `systemPrompt` slot.
 * @param images - absent; selects the synchronous conversion.
 * @param onReplayDegrade - forwarded to {@link toPiAssistant} for each assistant message.
 * @returns the pi-ai context; `tools` is omitted when the request declares none.
 * @throws {LlmError} `UNSUPPORTED_CONTENT` for a `developer` history message, a tool-change block, a deferred tool, or an image in any history role, including a leading system message.
 */
export declare function toPiContext(options: GenerateOptions, images?: undefined, onReplayDegrade?: (reason: string) => void): PiContext;
/**
 * Convert harness history to a pi-ai Context while resolving durable images.
 * Tool result names are recovered from preceding assistant tool calls.
 * Occurrences the surface marks offloaded become placeholders; when the
 * retained occurrences exceed `maxImages` or their exact base64 payload exceeds
 * `maxRequestImageBytes`, the call fails with `IMAGE_OFFLOAD_REQUIRED` naming
 * how many more oldest occurrences must be offloaded.
 * @param options - the harness request; `options.system`, else a leading `system` message, maps to pi-ai's single `systemPrompt` slot.
 * @param images - attachment provider, current path resolver, and request limits.
 * @param onReplayDegrade - forwarded to {@link toPiAssistant} for each assistant message.
 * @returns the asynchronously resolved pi-ai context.
 */
export declare function toPiContext(options: GenerateOptions, images: PiImageRequestContext, onReplayDegrade?: (reason: string) => void): Promise<PiContext>;
/**
 * Map pi-ai usage (reasoning folded into output by pi-ai).
 * @param usage - cumulative usage from the terminal pi-ai event.
 * @returns harness counts with pi-ai's exact total; cache fields appear only
 *   when non-zero (pi-ai reports zeros, not absence).
 */
export declare function mapUsage(usage: PiUsage): TokenUsage;
/**
 * Map a terminal pi-ai event to the harness finish reason.
 * @param message - the assistant message carried by the `done` or `error` event.
 * @param contextWindow - resolved catalog capacity for usage-based overflow detection.
 * @param reservedMaxTokens - requested output allowance before SDK context clamping.
 * @returns the mapped harness reason. Recognized error text, `stop` usage above
 *   `contextWindow`, and zero-output `length` usage that fills the window map
 *   to `CONTEXT_WINDOW_EXCEEDED`; a `stop` with no content blocks maps to an
 *   `EMPTY_RESPONSE` error. Other empty `length` responses map to `INVALID_REQUEST`
 *   with output-limit or compaction guidance. Terminal `pending` and `deferred`
 *   states map to non-retryable `PI_AI_ERROR` failures.
 */
export declare function mapStopReason(message: AssistantMessage, contextWindow?: number, reservedMaxTokens?: number): FinishReason;
/**
 * Translate the pi-ai event stream into StreamChunks. pi-ai never throws
 * mid-stream — failures arrive as `error` events, which become error/aborted
 * `finish` chunks (the harness protocol's other error-delivery style).
 * @param events - one assistant turn's pi-ai event stream.
 * @param contextWindow - resolved catalog capacity for usage-based overflow detection.
 * @param callerSignal - caller cancellation state; an aborted caller makes any
 *   in-band terminal error an aborted finish.
 * @param requestedModel - request model identity recorded for durable replay.
 * @param requestedProvider - DSH provider identity recorded for durable replay.
 * @param reservedMaxTokens - requested output allowance before SDK context clamping.
 * @param usageContext - fingerprint of the request whose usage may budget a later turn.
 * @returns the harness chunks, ending with measured `usage` then `finish`;
 *   failures with no measured tokens omit usage to preserve context pressure. Throws
 *   `LlmError` (`STREAM_CLOSED`) if the source ends without a terminal event.
 */
export declare function toStreamChunks(events: AsyncIterable<AssistantMessageEvent>, contextWindow?: number, callerSignal?: AbortSignal, requestedModel?: string, requestedProvider?: string, reservedMaxTokens?: number, usageContext?: string): AsyncGenerator<StreamChunk>;
export { DEFAULT_MAX_REQUEST_IMAGE_BYTES, DEFAULT_REQUEST_IMAGE_MAX_BYTES, DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET, } from './contracts.ts';
