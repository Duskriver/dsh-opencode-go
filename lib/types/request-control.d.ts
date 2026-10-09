/** Cancel a wait even when an external service does not observe its signal. */
export declare function waitWithSignal<T>(work: () => PromiseLike<T>, signal?: AbortSignal): Promise<T>;
