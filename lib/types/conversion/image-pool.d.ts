import { LlmError } from '@deepseek-ai/dsh-llm';
/** Local protection defaults, not limits reported by the upstream gateway. */
export declare const IMAGE_PREPARATION_CONCURRENCY = 100;
export declare const IMAGE_PREPARATION_QUEUE_LIMIT = 300;
/** Raw prepared bytes plus base64 payloads, not a bound on native decoder RSS. */
export declare const IMAGE_PAYLOAD_BUDGET_BYTES: number;
/** A local collision can be retried once an actual competing resource releases. */
declare class ImageResourceBusyError extends LlmError {
    readonly retryAfter: Promise<void>;
    constructor(message: string, retryAfter: Promise<void>);
}
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
    private released;
    constructor(observer?: ImagePoolObserver | undefined);
    reserve(bytes: number): void;
    /** Discard a failed preparation before waiting; partial leases must not deadlock. */
    reset(): void;
    waitForCapacity(error: ImageResourceBusyError, signal?: AbortSignal): Promise<void>;
    [Symbol.dispose](): void;
}
/** Retry only local admission failures, before any provider request is sent. */
export declare function retryImagePreparation<T>(work: () => Promise<T>, lease: ImagePayloadLease, signal?: AbortSignal): Promise<T>;
/** Keep the permit until real work settles, even if its caller stops waiting. */
export declare function withImagePermit<T>(work: () => Promise<T>, signal?: AbortSignal, observer?: ImagePoolObserver): Promise<T>;
export {};
