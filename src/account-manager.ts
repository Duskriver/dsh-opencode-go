import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { ACCOUNT_REF_PREFIX, accountRefOf, accountsOf, MAX_ACCOUNTS, type AccountSettings } from './accounts.ts'
import { accountOperationPatch, assertAccountOperations, ownsAccountCredential, visibleAccountsOf, type GoAccountOperation } from './account-operations.ts'
import { accountSettingsRow, isSettingsConflict, settingsWriteResult, type AccountSettingsWriter, type SettingsWriteResult } from './settings-bridge.ts'
import { parseAccountCommand, type AccountCommand } from './accounts-contract.ts'
import { randomUUID } from 'node:crypto'
import { deadline } from '@deepseek-ai/dsh-timeout'
import { waitWithSignal } from './request-control.ts'

export const ACCOUNT_RECOVERY_TIMEOUT_MS = 30_000

/** Serialize account commands and recover the same durable operations for one profile. */
export class GoAccountManager {
  private connection: { settings: AccountSettingsWriter; credentials: Pick<CredentialProvider, 'describe' | 'unset'> & Partial<Pick<CredentialProvider, 'set'>>; cancel: AbortController } | undefined
  private pending: Promise<void> | undefined
  private again = false
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly logger: { warn(message: string): void }) {}

  connect(settings: AccountSettingsWriter, credentials: Pick<CredentialProvider, 'describe' | 'unset'> & Partial<Pick<CredentialProvider, 'set'>>): () => void {
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
    this.pending = this.enqueue(() => this.run()).finally(() => {
      this.pending = undefined
      // A dependency/section can appear between run() settling and this cleanup.
      if (this.again) this.trigger()
    })
    return this.pending
  }

  private row(connection: NonNullable<GoAccountManager['connection']>) {
    return accountSettingsRow(connection.settings)
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

  private async complete(connection: NonNullable<GoAccountManager['connection']>, operation: GoAccountOperation, keyConfirmed = false, signal?: AbortSignal): Promise<SettingsWriteResult> {
    using timeout = deadline(signal ? AbortSignal.any([connection.cancel.signal, signal]) : connection.cancel.signal, ACCOUNT_RECOVERY_TIMEOUT_MS, 'OPENCODE_ACCOUNT_RECOVERY_TIMEOUT')
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
    if (!state) return 'unknown'
    const ref = operation.account.apiKeyEnv
    const info = keyConfirmed ? { configured: true, writable: true } : await wait(() => connection.credentials.describe(credentialRef(ref)))
    state = get()
    if (!state) return 'unknown'
    const occupied = accountsOf(state.value).find(account => account.apiKeyEnv === ref || account.id === operation.account.id)
    if (occupied && (occupied.id !== operation.account.id || occupied.apiKeyEnv !== ref)) {
      throw new Error('Account identity changed while recovery was pending')
    }
    if (operation.kind === 'add' && !info.configured) return 'unknown' // Value is unrecoverable; the visible row allows key replacement.
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
    if (!state) return 'unknown'
    timeout.signal.throwIfAborted()
    const target = state
    const result = await wait(() => connection.settings.mutate(target.row.ns,
      accountOperationPatch(target.value, operation, dropLegacyRef), target.row.revision))
    timeout.signal.throwIfAborted()
    if (this.connection !== connection) throw new Error('Account connection changed')
    const status = settingsWriteResult(result, () => !get())
    if (status !== 'applied') { this.again = true; throw new Error('Account settings have not committed') }
    return status
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(work)
    this.queue = pending.catch(() => {})
    return pending
  }

  execute(raw: AccountCommand): Promise<SettingsWriteResult> {
    const command = parseAccountCommand(raw)
    const connection = this.connection
    return this.enqueue(async () => {
      if (!connection || this.connection !== connection) return 'rejected'
      using timeout = deadline(connection.cancel.signal, ACCOUNT_RECOVERY_TIMEOUT_MS, 'OPENCODE_ACCOUNT_COMMAND_TIMEOUT')
      const wait = <T>(work: () => Promise<T>) => waitWithSignal(work, timeout.signal)
      const read = () => {
        timeout.signal.throwIfAborted()
        if (this.connection !== connection) throw new Error('Account connection changed')
        const row = this.row(connection)
        if (!row) throw new Error('Account settings are unavailable')
        const value = row.value as AccountSettings
        assertAccountOperations(value.accountOperations)
        return { row, value }
      }
      const write = async (ops: Parameters<AccountSettingsWriter['mutate']>[1], committed: (value: AccountSettings) => boolean, target = read()) => {
        const { row } = target
        read()
        const verdict = await wait(() => connection.settings.mutate(row.ns, ops, row.revision))
        read()
        return settingsWriteResult(verdict, () => committed(read().value))
      }
      const describe = async (ref: string) => {
        try { return await wait(() => connection.credentials.describe(credentialRef(ref))) }
        catch { read(); return undefined }
      }
      const begin = async (operation: GoAccountOperation): Promise<SettingsWriteResult> => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const target = read()
          const { value } = target
          const operations = value.accountOperations ?? []
          if (operations.some(entry => JSON.stringify(entry) === JSON.stringify(operation))) return 'applied'
          const next = [...operations.filter(entry => entry.account.apiKeyEnv !== operation.account.apiKeyEnv), operation]
          assertAccountOperations(next)
          try {
            const status = await write([{ op: 'set', path: ['accountOperations'], value: next }],
              value => value.accountOperations?.some(entry => entry.id === operation.id) === true, target)
            return status
          } catch (error) { if (attempt === 2 || !isSettingsConflict(error)) throw error }
        }
        return 'unknown'
      }
      try {
        let target = read()
        let { value } = target
        if (command.kind === 'add') {
          const resumed = value.accountOperations?.find(entry => entry.kind === 'add' && entry.account.name === command.name.trim())
          const id = resumed?.account.id ?? command.id
          const ref = ACCOUNT_REF_PREFIX + id.toUpperCase()
          // A retried RPC with the same ID is idempotent after its journal has cleared.
          if (value.accounts?.some(account => account.id === id) && !value.accountOperations?.some(entry => entry.id === id)) return 'applied'
          const visible = visibleAccountsOf(value).filter(account => account.apiKeyEnv !== ref)
          const infos = await Promise.all(visible.map(async account => [account.apiKeyEnv, await describe(account.apiKeyEnv)] as const))
          read()
          const configured = new Map(infos)
          const retained = visible.filter(account => !(value.accounts == null && !account.name && configured.get(account.apiKeyEnv)?.configured === false))
          if (retained.length >= MAX_ACCOUNTS) return 'rejected'
          const operation: GoAccountOperation = resumed ?? { id, kind: 'add', account: { id, apiKeyEnv: ref, name: command.name.trim() },
            previousRef: accountRefOf(value), select: visible.every(account => configured.get(account.apiKeyEnv)?.configured === false) }
          const started = await begin(operation)
          if (started !== 'applied') return started
          if (!connection.credentials.set) return 'rejected'
          await wait(() => connection.credentials.set!(credentialRef(ref), command.key.trim()))
          read()
          for (let attempt = 0; attempt < 3; attempt++) {
            try { return await this.complete(connection, operation, true, timeout.signal) }
            catch (error) { if (attempt === 2 || !isSettingsConflict(error)) throw error }
          }
          return 'unknown'
        }
        if (command.kind === 'auto-switch') {
          return await write([{ op: 'set', path: ['autoSwitch'], value: command.value }], value => value.autoSwitch === command.value, read())
        }
        const account = visibleAccountsOf(value).find(account => account.apiKeyEnv === command.ref)
        if (!account) return 'rejected'
        if (command.kind === 'replace-key') {
          if (!connection.credentials.set || value.accountOperations?.some(entry => entry.kind === 'remove' && entry.account.apiKeyEnv === command.ref)) return 'rejected'
          const info = await describe(command.ref)
          if (info?.writable === false) return 'rejected'
          await wait(() => connection.credentials.set!(credentialRef(command.ref), command.key.trim()))
          read()
          this.trigger()
          return 'applied'
        }
        if (command.kind === 'remove') {
          if (ownsAccountCredential(account)) {
            const info = await describe(command.ref)
            if (!info || info.configured && !info.writable) return 'rejected'
            const operation: GoAccountOperation = value.accountOperations?.find(entry => entry.kind === 'remove' && entry.account.apiKeyEnv === command.ref)
              ?? { id: randomUUID().replaceAll('-', ''), kind: 'remove', account: { ...account } }
            const started = await begin(operation)
            if (started !== 'applied') return started
            return await this.complete(connection, operation, false, timeout.signal)
          }
          target = read()
          value = target.value
          const operation: GoAccountOperation = { id: randomUUID().replaceAll('-', ''), kind: 'remove', account }
          return await write(accountOperationPatch(value, operation), value => !visibleAccountsOf(value).some(entry => entry.apiKeyEnv === command.ref), target)
        }
        target = read()
        value = target.value
        const accounts = [...accountsOf(value)]
        if (command.kind === 'select') {
          if (!accounts.some(account => account.apiKeyEnv === command.ref)) return 'rejected'
          return await write([{ op: 'set', path: ['apiKeyEnv'], value: command.ref }], value => accountRefOf(value) === command.ref, target)
        }
        if (command.kind === 'rename') {
          if (!accounts.some(account => account.apiKeyEnv === command.ref)) return 'rejected'
          const next = accounts.map(account => account.apiKeyEnv === command.ref ? { ...account, name: command.name.trim() } : account)
          return await write([{ op: 'set', path: ['accounts'], value: next }], value => value.accounts?.some(account => account.apiKeyEnv === command.ref && account.name === command.name.trim()) === true, target)
        }
        const from = accounts.findIndex(account => account.apiKeyEnv === command.ref)
        if (from < 0 || command.toIndex >= accounts.length || from === command.toIndex) return 'rejected'
        const [moved] = accounts.splice(from, 1)
        accounts.splice(command.toIndex, 0, moved!)
        return await write([{ op: 'set', path: ['accounts'], value: accounts }, { op: 'set', path: ['apiKeyEnv'], value: accounts[0]!.apiKeyEnv }],
          value => value.accounts?.[command.toIndex]?.apiKeyEnv === command.ref && accountRefOf(value) === accounts[0]!.apiKeyEnv, target)
      } catch { return 'unknown' }
    })
  }
}
