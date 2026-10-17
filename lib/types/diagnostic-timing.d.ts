/** Content-free stage timings. Observer failures must not affect the operation. */
export interface DiagnosticTiming {
    readonly stage: string;
    readonly phase: 'start' | 'success' | 'failure';
    readonly elapsedMs: number;
    readonly attempt?: number;
    readonly status?: number;
    /** Bytes delivered to the reader, or produced by explicit gzip recovery. */
    readonly bytes?: number;
    readonly cacheHit?: boolean;
    readonly persisted?: boolean;
}
export type TimingObserver = (event: DiagnosticTiming) => void;
type TimingDetails = Pick<DiagnosticTiming, 'status' | 'bytes' | 'cacheHit' | 'persisted'>;
export declare function measureTiming<T>(observer: TimingObserver | undefined, stage: string, work: () => T | PromiseLike<T>, details?: (value: T) => TimingDetails): Promise<T>;
export {};
