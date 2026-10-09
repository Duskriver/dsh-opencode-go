/** Shared across requests so concurrent conversations cannot multiply image work. */
export declare const IMAGE_PREPARATION_CONCURRENCY = 4;
export declare const IMAGE_PREPARATION_QUEUE_LIMIT = 32;
/** Raw prepared bytes plus base64 payloads, not a bound on native decoder RSS. */
export declare const IMAGE_PAYLOAD_BUDGET_BYTES: number;
export interface ImagePoolObservation {
    queueWaitMs: number;
    active: number;
    queued: number;
    retainedBytes: number;
    rejected?: boolean;
}
export type ImagePoolObserver = (observation: ImagePoolObservation) => void;
/** Held by the adapter until an attempt ends, including streaming and fallback. */
export declare class ImagePayloadLease {
    private readonly observer?;
    private bytes;
    private closed;
    constructor(observer?: ImagePoolObserver | undefined);
    reserve(bytes: number): void;
    [Symbol.dispose](): void;
}
/** Keep the permit until real work settles, even if its caller stops waiting. */
export declare function withImagePermit<T>(work: () => Promise<T>, signal?: AbortSignal, observer?: ImagePoolObserver): Promise<T>;
