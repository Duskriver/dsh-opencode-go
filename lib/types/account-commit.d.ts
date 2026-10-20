import type { GoAccount } from './accounts.ts';
import { type AccountSettingsWriter } from './settings-bridge.ts';
export interface AccountCommitRevision {
    ns: string;
    revision: number;
}
export declare const ACCOUNT_COMMIT_ATTEMPTS = 3;
/** Persist ordering and selection together; callers decide the account order. */
export declare function accountSelectionPatch(accounts: readonly GoAccount[], ref: string): Parameters<AccountSettingsWriter['mutate']>[1];
/** Forward the original promise so callers retain their guards and await timing. */
export declare function commitAccountSettings(settings: AccountSettingsWriter, target: AccountCommitRevision, ops: Parameters<AccountSettingsWriter['mutate']>[1]): Promise<unknown>;
/** An intervening write or a different settings row cannot confirm this commit. */
export declare function accountCommitMatches(target: AccountCommitRevision, committed: AccountCommitRevision | undefined): boolean;
/** Only callers already allowed to rebase should retry; attempt is zero-based. */
export declare function canRetryAccountCommit(error: unknown, attempt: number): boolean;
