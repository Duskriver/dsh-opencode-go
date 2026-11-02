import type { StreamChunk } from '@deepseek-ai/dsh-llm';
import type { Api, Context, Model } from './sdk-types.ts';
/** One report per attempt, including successes needed to inspect the next continuation. */
export declare class ResponsesDiagnostics {
    private readonly options;
    private readonly report;
    private readonly deltas;
    private truncated;
    private inspectionFailed;
    constructor(options: {
        directory: string;
        callId: string;
        attempt: number;
        model: Model<Api>;
        sessionId: string;
    });
    /** Observation failures must not change the provider's request or stream outcome. */
    private observe;
    private tail;
    private append;
    private parts;
    private item;
    private signature;
    context(context: Context): void;
    payload(payload: unknown): void;
    providerEvent(value: unknown): void;
    http(status: number, requestId?: string): void;
    chunk(chunk: StreamChunk): void;
    end(termination: 'completed' | 'caller-aborted' | 'timeout' | 'exception' | 'consumer-stopped'): void;
    /** Bounded optional disk I/O; never rejects or indefinitely delays stream cleanup. */
    save(): Promise<void>;
}
