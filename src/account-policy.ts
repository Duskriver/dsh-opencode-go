import type { GoAccountSwitch } from './accounts.ts'

export interface AttemptOutcome {
  failure?: { code: string }
  emitted: boolean
  totalTokens: number
  aborted: boolean
  hasNext: boolean
}

/** Switching accounts must never replay output or already charged work. */
export function accountFallback(outcome: AttemptOutcome): GoAccountSwitch['reason'] | undefined {
  if (outcome.emitted || outcome.totalTokens > 0 || outcome.aborted || !outcome.hasNext) return undefined
  switch (outcome.failure?.code) {
    case 'QUOTA': return 'quota'
    case 'MISSING_CREDENTIAL':
    case 'INVALID_CREDENTIAL': return 'credential'
    default: return undefined
  }
}

/** Missing local credentials and exhausted quota do not blacklist a gateway key. */
export function isGatewayKeyRejection(failure: { code: string }): boolean {
  return failure.code === 'INVALID_CREDENTIAL'
}
