import type { GoAccount } from './accounts.ts'
import { isSettingsConflict, type AccountSettingsWriter } from './settings-bridge.ts'

export interface AccountCommitRevision { ns: string; revision: number }

export const ACCOUNT_COMMIT_ATTEMPTS = 3

/** Persist ordering and selection together; callers decide the account order. */
export function accountSelectionPatch(accounts: readonly GoAccount[], ref: string): Parameters<AccountSettingsWriter['mutate']>[1] {
  return [
    { op: 'set', path: ['accounts'], value: accounts },
    { op: 'set', path: ['apiKeyEnv'], value: ref },
  ]
}

/** Forward the original promise so callers retain their guards and await timing. */
export function commitAccountSettings(settings: AccountSettingsWriter, target: AccountCommitRevision, ops: Parameters<AccountSettingsWriter['mutate']>[1]): Promise<unknown> {
  return settings.mutate(target.ns, ops, target.revision)
}

/** An intervening write or a different settings row cannot confirm this commit. */
export function accountCommitMatches(target: AccountCommitRevision, committed: AccountCommitRevision | undefined): boolean {
  return committed?.ns === target.ns && committed.revision === target.revision + 1
}

/** Only callers already allowed to rebase should retry; attempt is zero-based. */
export function canRetryAccountCommit(error: unknown, attempt: number): boolean {
  return attempt + 1 < ACCOUNT_COMMIT_ATTEMPTS && isSettingsConflict(error)
}
