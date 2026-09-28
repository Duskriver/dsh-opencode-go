import type { Message } from '@deepseek-ai/dsh-llm';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
interface ImageProjectionPolicy {
    maxImages?: number;
    maxBytes?: number;
    byteLength: (ref: ImageAttachmentRef) => number;
    placeholder: (ref: ImageAttachmentRef) => string;
    /** False before preparing image bytes, true once encoded sizes are known. */
    exact: boolean;
}
/** Preserve the host generation's image policy, using estimates first and exact sizes second. */
export declare function projectRequestImages(messages: readonly Message[], policy: ImageProjectionPolicy): readonly Message[];
export {};
