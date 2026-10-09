/** Durable, client-safe intentions. Never put a credential value in this document. */
import { ACCOUNT_REF_PATTERN, ACCOUNT_REF_PREFIX, MAX_ACCOUNTS, accountsOf, assertAccounts, type AccountSettings, type GoAccount } from './accounts.ts'

export type GoAccountOperation =
  | { id: string; kind: 'add'; account: GoAccount; previousRef: string; select: boolean }
  | { id: string; kind: 'remove'; account: GoAccount }

export function ownsAccountCredential(account: GoAccount): boolean {
  return /^[a-f0-9]{32}$/.test(account.id) && account.apiKeyEnv === ACCOUNT_REF_PREFIX + account.id.toUpperCase()
}

export function assertAccountOperations(value: readonly GoAccountOperation[] | undefined): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > MAX_ACCOUNTS) throw new Error('Too many pending OpenCode Go account operations')
  const ids = new Set<string>(), refs = new Set<string>()
  for (const operation of value) {
    if (!operation || typeof operation.id !== 'string' || !/^[a-f0-9]{32}$/.test(operation.id) || ids.has(operation.id)
      || !['add', 'remove'].includes(operation.kind)) throw new Error('Invalid OpenCode Go account operation')
    const fields = operation.kind === 'add' ? ['id', 'kind', 'account', 'previousRef', 'select'] : ['id', 'kind', 'account']
    if (Object.keys(operation).some(key => !fields.includes(key))
      || !operation.account || Object.keys(operation.account).some(key => !['id', 'name', 'apiKeyEnv'].includes(key))) {
      throw new Error('Unexpected OpenCode Go account operation fields')
    }
    assertAccounts([operation.account])
    if (refs.has(operation.account.apiKeyEnv)) throw new Error('Duplicate OpenCode Go account operation')
    if (operation.kind === 'add' && (!ownsAccountCredential(operation.account)
      || typeof operation.select !== 'boolean' || !ACCOUNT_REF_PATTERN.test(operation.previousRef))) {
      throw new Error('Invalid OpenCode Go account addition')
    }
    ids.add(operation.id); refs.add(operation.account.apiKeyEnv)
  }
}

/** Pending additions remain visible so a lost key write can be repaired or removed. */
export function visibleAccountsOf(settings: AccountSettings): readonly GoAccount[] {
  const entries = [...accountsOf(settings)]
  for (const operation of settings.accountOperations ?? []) {
    if (!entries.some(account => account.apiKeyEnv === operation.account.apiKeyEnv)) entries.push(operation.account)
  }
  return entries
}
