/**
 * Harness request-history conversion into pi-ai's Context vocabulary.
 *
 * @module dsh-opencode-go/conversion/context
 */
import type { GenerateOptions, ImageAttachmentAccessResolver } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { Context as PiContext } from '../sdk-types.ts';
import { ImagePayloadLease, type ImagePoolObserver } from './image-pool.ts';
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
    /** Adapter-owned lease retains its charge through provider streaming. */
    payloadLease?: ImagePayloadLease;
    onImagePool?: ImagePoolObserver;
}
/** Per-route budgets from which each request image's target is derived. */
export interface PiImageRequestBudget {
    /** Total-pixel budget; larger sources are downscaled proportionally. */
    maxPixels: number;
    /** Encoded-byte target for one request image. */
    maxBytes: number;
}
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
 * Tool result names are recovered from preceding assistant tool calls. On DSH
 * 0.1.5, oldest images over the request budget become transient placeholders.
 * On newer hosts, occurrences the surface marks offloaded become placeholders; when the
 * retained occurrences exceed `maxImages` or their exact base64 payload exceeds
 * `maxRequestImageBytes`, the call fails with `IMAGE_OFFLOAD_REQUIRED` naming
 * how many more oldest occurrences must be offloaded.
 * @param options - the harness request; `options.system`, else a leading `system` message, maps to pi-ai's single `systemPrompt` slot.
 * @param images - attachment provider, current path resolver, and request limits.
 * @param onReplayDegrade - forwarded to {@link toPiAssistant} for each assistant message.
 * @returns the asynchronously resolved pi-ai context.
 */
export declare function toPiContext(options: GenerateOptions, images: PiImageRequestContext, onReplayDegrade?: (reason: string) => void): Promise<PiContext>;
