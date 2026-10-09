import type { GoAccountSwitch } from './accounts.ts';
export interface AttemptOutcome {
    failure?: {
        code: string;
    };
    emitted: boolean;
    totalTokens: number;
    aborted: boolean;
    hasNext: boolean;
}
/** Switching accounts must never replay output or already charged work. */
export declare function accountFallback(outcome: AttemptOutcome): GoAccountSwitch['reason'] | undefined;
/** Missing local credentials and exhausted quota do not blacklist a gateway key. */
export declare function isGatewayKeyRejection(failure: {
    code: string;
}): boolean;
