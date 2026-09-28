import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
export interface UsageWindow {
    status: 'ok' | 'rate-limited';
    percent: number;
    resetsAt: string;
}
export interface GoUsage {
    /** Opaque Host identity for this endpoint/account; never a credential or its hash. */
    source?: string;
    rolling: UsageWindow;
    weekly: UsageWindow;
    monthly: UsageWindow;
}
/** Reject missing statistics rather than turning unavailable data into zero. */
export declare function parseGoUsage(value: unknown): GoUsage;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'opencode-go/usage-unavailable': {
            readonly retryable: boolean;
            readonly retainPrevious: boolean;
            readonly source?: string;
        };
    }
    interface TypertRemoteNamespaceMap {
        opencodeGoUsage: {
            read(): Promise<RemoteResult<GoUsage>>;
        };
    }
}
export declare const usageRemote: TypertRemoteContribution;
