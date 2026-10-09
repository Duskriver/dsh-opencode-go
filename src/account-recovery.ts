import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { accountRefOf, accountsOf, assertAccounts, MAX_ACCOUNTS, type AccountSettings } from './accounts.ts'
import { assertAccountOperations, ownsAccountCredential, type GoAccountOperation } from './account-operations.ts'
import type { AccountSettingsWriter } from './account-selection.ts'
import { deadline } from '@deepseek-ai/dsh-timeout'
import { waitWithSignal } from './request-control.ts'

export const ACCOUNT_RECOVERY_TIMEOUT_MS = 30_000

/** Reconcile the current profile only; no secret or process-global journal is stored. */
export class GoAccountRecovery {
  private connection: { settings: AccountSettingsWriter; credentials: Pick<CredentialProvider, 'describe' | 'unset'>; cancel: AbortController } | undefined
  private pending: Promise<void> | undefined
  private again = false

  constructor(private readonly logger: { warn(message: string): void }) {}

  connect(settings: AccountSettingsWriter, credentials: Pick<CredentialProvider, 'describe' | 'unset'>): () => void {
    this.connection?.cancel.abort('Account recovery connection replaced')
    const connection = this.connection = { settings, credentials, cancel: new AbortController() }
    this.trigger()
    return () => {
      if (this.connection !== connection) return
      this.connection = undefined
      connection.cancel.abort('Account recovery connection closed')
    }
  }

  trigger(): void { void this.recover().catch(() => { this.logger.warn('llm-opencode-go: account recovery is waiting for writable settings and credentials') }) }

  recover(): Promise<void> {
    this.again = true
    if (this.pending) return this.pending
    this.pending = Promise.resolve().then(() => this.run()).finally(() => {
      this.pending = undefined
      // A dependency/section can appear between run() settling and this cleanup.
      if (this.again) this.trigger()
    })
    return this.pending
  }

  private row(connection: NonNullable<GoAccountRecovery['connection']>) {
    const rows = connection.settings.describe()
    return rows.find(row => row.ns === 'opencode-go') ?? rows.find(row => row.ns === 'llm-opencode-go')
  }

  private async run(): Promise<void> {
    // A committed write can synchronously trigger another pass. Bound retries
    // so a refused provider cannot create a background retry loop.
    for (let pass = 0; this.again && pass < 4; pass++) {
      this.again = false
      const connection = this.connection
      if (!connection) return
      const row = this.row(connection)
      const value = row?.value as AccountSettings | undefined
      assertAccountOperations(value?.accountOperations)
      for (const operation of value?.accountOperations ?? []) {
        if (this.connection !== connection) return
        try { await this.complete(connection, operation) }
        catch { this.logger.warn(`llm-opencode-go: account operation ${operation.id} remains pending; it will retry on settings/credential reconnect or update`) }
      }
    }
    this.again = false
  }

  private async complete(connection: NonNullable<GoAccountRecovery['connection']>, operation: GoAccountOperation): Promise<void> {
    using timeout = deadline(connection.cancel.signal, ACCOUNT_RECOVERY_TIMEOUT_MS, 'OPENCODE_ACCOUNT_RECOVERY_TIMEOUT')
    const wait = <T>(work: () => Promise<T>): Promise<T> => waitWithSignal(work, timeout.signal)
    const get = () => {
      if (this.connection !== connection) return undefined
      const row = this.row(connection)
      if (!row) return undefined
      const value = row.value as AccountSettings
      assertAccountOperations(value.accountOperations)
      const current = value.accountOperations?.find(entry => entry.id === operation.id)
      if (JSON.stringify(current) !== JSON.stringify(operation)) return undefined
      return { row, value }
    }
    let state = get()
    if (!state) return
    const ref = operation.account.apiKeyEnv
    const info = await wait(() => connection.credentials.describe(credentialRef(ref)))
    state = get()
    if (!state) return
    const occupied = accountsOf(state.value).find(account => account.apiKeyEnv === ref || account.id === operation.account.id)
    if (occupied && (occupied.id !== operation.account.id || occupied.apiKeyEnv !== ref)) {
      throw new Error('Account identity changed while recovery was pending')
    }
    if (operation.kind === 'add' && !info.configured) return // Value is unrecoverable; the visible row allows key replacement.
    if (operation.kind === 'remove' && ownsAccountCredential(operation.account) && info.configured) {
      if (!info.writable) throw new Error('Credential is read-only')
      await wait(() => connection.credentials.unset(credentialRef(ref)))
    }
    let dropLegacyRef: string | undefined
    if (operation.kind === 'add' && state.value.accounts == null) {
      const legacyRef = accountRefOf(state.value)
      try { if (!(await wait(() => connection.credentials.describe(credentialRef(legacyRef)))).configured) dropLegacyRef = legacyRef }
      catch { /* An unknown legacy credential is preserved. */ }
    }
    state = get()
    if (!state) return
    timeout.signal.throwIfAborted()
    let accounts = [...accountsOf(state.value)]
    let selected: string | undefined
    if (operation.kind === 'add') {
      if (!accounts.some(account => account.id === operation.account.id)) {
        if (state.value.accounts == null && dropLegacyRef) accounts = accounts.filter(account => account.apiKeyEnv !== dropLegacyRef)
        if (accounts.length >= MAX_ACCOUNTS) throw new Error('Account limit reached')
        accounts.push(operation.account)
      }
      if (operation.select && accountRefOf(state.value) === operation.previousRef) selected = ref
    } else {
      accounts = accounts.filter(account => account.apiKeyEnv !== ref)
      if (accountRefOf(state.value) === ref && accounts.length) selected = accounts[0]!.apiKeyEnv
    }
    assertAccounts(accounts, selected ?? accountRefOf(state.value))
    const target = state
    const result = await wait(() => connection.settings.mutate(target.row.ns, [
      { op: 'set', path: ['accounts'], value: accounts },
      ...selected ? [{ op: 'set' as const, path: ['apiKeyEnv'], value: selected }] : [],
      { op: 'set', path: ['accountOperations'], value: target.value.accountOperations!.filter(entry => entry.id !== operation.id) },
    ], target.row.revision))
    const committed = get()
    if (result === false || committed) { this.again = true; throw new Error('Account settings have not committed') }
  }
}
