import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { GoAccountSwitch } from './accounts.ts';
export interface UsageWindow {
    status: 'ok' | 'rate-limited';
    percent: number;
    resetsAt: string;
}
export interface GoUsage {
    /** Opaque Host identity for this endpoint/account; never a credential or its hash. */
    source?: string;
    lastSwitch?: GoAccountSwitch;
    rolling: UsageWindow;
    weekly: UsageWindow;
    monthly: UsageWindow;
}
export declare function parseAccountSwitch(value: unknown): GoAccountSwitch;
/** Reject missing statistics rather than turning unavailable data into zero. */
export declare function parseGoUsage(value: unknown): GoUsage;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'opencode-go/usage-unavailable': {
            readonly retryable: boolean;
            readonly retainPrevious: boolean;
            readonly source?: string;
            readonly lastSwitch?: GoAccountSwitch;
        };
    }
    interface TypertRemoteNamespaceMap {
        opencodeGoUsage: {
            read(): Promise<RemoteResult<GoUsage>>;
            readAccount(ref: string): Promise<RemoteResult<GoUsage>>;
        };
    }
}
export declare const usageRemote: TypertRemoteContribution;
