/** Client-safe account metadata. Secrets stay in the host credential service. */
export type GoAccount = {
  id: string
  name: string
  apiKeyEnv: string
}

export const MAX_ACCOUNTS = 20
export const ACCOUNT_REF_PREFIX = 'DSH_OPENCODE_GO_ACCOUNT_'
export const DEFAULT_ACCOUNT_REF = 'OPENCODE_API_KEY'

export interface AccountSettings {
  apiKeyEnv?: string
  /** Omission/null preserves legacy credentials; an explicit empty list removes all accounts. */
  accounts?: readonly GoAccount[] | null
  autoSwitch?: boolean
}

export function accountRefOf(settings: AccountSettings): string {
  return settings.apiKeyEnv || DEFAULT_ACCOUNT_REF
}

/** Include an externally selected reference without rewriting existing configuration. */
export function accountsOf(settings: AccountSettings): readonly GoAccount[] {
  const ref = accountRefOf(settings)
  if (settings.accounts?.length === 0) return []
  const accounts = settings.accounts ?? []
  return accounts.some(account => account.apiKeyEnv === ref) ? accounts : [
    { id: `legacy:${ref}`, name: '', apiKeyEnv: ref }, ...accounts,
  ]
}

export function assertAccounts(accounts: readonly GoAccount[] | null | undefined, selectedRef?: string): void {
  if (accounts == null) return
  if (!Array.isArray(accounts) || accounts.length > MAX_ACCOUNTS
    || accounts.length === MAX_ACCOUNTS && selectedRef && !accounts.some(account => account.apiKeyEnv === selectedRef)) {
    throw new Error(`OpenCode Go supports at most ${MAX_ACCOUNTS} accounts, including the selected reference`)
  }
  const ids = new Set<string>()
  const refs = new Set<string>()
  for (const account of accounts) {
    if (!account || typeof account.id !== 'string' || !account.id || account.id.length > 128
      || account.id.startsWith('legacy:') && account.id !== `legacy:${account.apiKeyEnv}`
      || typeof account.name !== 'string' || (!account.name.trim() && account.id !== `legacy:${account.apiKeyEnv}`) || account.name.length > 80
      || typeof account.apiKeyEnv !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(account.apiKeyEnv)
      || ids.has(account.id) || refs.has(account.apiKeyEnv)) throw new Error('Invalid or duplicate OpenCode Go account')
    ids.add(account.id)
    refs.add(account.apiKeyEnv)
  }
}

/** Safe UI notice for a successful request using a fallback account. */
export interface GoAccountSwitch {
  fromRef: string
  toRef: string
  reason: 'quota' | 'credential'
  at: number
}
