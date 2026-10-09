import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import { accountRefOf, type AccountSettings, type GoAccount } from '../accounts.ts'
import { visibleAccountsOf } from '../account-operations.ts'
import type { GoUsage } from '../usage-contract.ts'
import type { SettingsScope } from './settings.ts'
import type { AccountCommand } from '../accounts-contract.ts'
import type { SettingsWriteResult } from '../settings-bridge.ts'

export type ExecuteAccountCommand = (command: AccountCommand) => Promise<SettingsWriteResult>

export interface GoAccountView extends GoAccount {
  configured?: boolean
  writable?: boolean
  usage?: GoUsage
  updatedAt?: number
  stale?: boolean
  loading?: boolean
  failed?: boolean
  /** Why the last quota read failed, safe to show: it carries no credential value. */
  problem?: string
}

export interface GoAccountsState {
  entries: readonly GoAccountView[]
  activeRef: string
  autoSwitch: boolean
  busy: boolean
  blocked: boolean
  refreshing: boolean
  failure?: 'write' | 'cleanup' | 'remove' | 'read'
}

function operationId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
}

export interface GoAccountsActions {
  loadAccounts: () => void
  addAccount: (name: string, key: string) => Promise<boolean>
  renameAccount: (ref: string, name: string) => Promise<boolean>
  removeAccount: (ref: string) => Promise<boolean>
  selectAccount: (ref: string) => Promise<boolean>
  setAutoSwitch: (next: boolean) => Promise<boolean>
  replaceAccountKey: (ref: string, key: string) => Promise<boolean>
  /** Move one account to a new position; the first row becomes the preferred account. */
  moveAccount: (ref: string, toIndex: number) => Promise<boolean>
}

/** Immediate account operations, separate from the page's staged tuning form. */
export class GoAccountsController {
  private rows = new Map<string, GoAccountView>()
  private busy = false
  private refreshing = false
  private failure: GoAccountsState['failure']
  private epoch = 0
  private identity = ''
  private loaded = false
  private disposed = false
  private addition: { name: string; id: string } | undefined

  constructor(
    private readonly scope: SettingsScope<AccountSettings & { baseURL?: string; proxyURL?: string }>,
    private readonly ctx: Context,
    private readonly readUsage: (ref: string) => Promise<GoUsage>,
    private readonly publish: () => void,
    private readonly blocked: () => boolean,
    private readonly execute: ExecuteAccountCommand = async command => {
      const response = await ctx.remote.opencodeGoAccounts.execute(command)
      return response.ok ? response.value : 'unknown'
    },
  ) { this.sync() }

  snapshot(): GoAccountsState {
    const config = this.scope.getSnapshot().value ?? {}
    return {
      entries: visibleAccountsOf(config).map(account => ({ ...this.rows.get(account.apiKeyEnv), ...account })),
      activeRef: accountRefOf(config), autoSwitch: config.autoSwitch === true,
      busy: this.busy, blocked: this.blocked(), refreshing: this.refreshing, failure: this.failure,
    }
  }

  sync(): void {
    const config = this.scope.getSnapshot().value ?? {}
    // Order is presentation, not identity: a reorder keeps every row's quota and
    // status, so the comparison sorts the accounts and a reorder refetches
    // nothing. A name is presentation too: renaming renders from the settings
    // snapshot while the row keeps its quota, so it also refetches nothing.
    const identity = JSON.stringify([
      visibleAccountsOf(config).map(account => [account.id, account.apiKeyEnv])
        .sort((left, right) => left[1]! < right[1]! ? -1 : left[1]! > right[1]! ? 1 : 0),
      config.baseURL,
      config.proxyURL,
    ])
    if (identity === this.identity) return
    this.identity = identity
    this.epoch++
    this.rows.clear()
    this.refreshing = false
    if (this.loaded) void this.refresh()
  }

  dispose(): void { this.disposed = true; this.epoch++ }

  invalidate(ref: string): void {
    if (!visibleAccountsOf(this.scope.getSnapshot().value ?? {}).some(account => account.apiKeyEnv === ref)) return
    this.epoch++
    this.rows.delete(ref)
    if (this.loaded) void this.refresh()
  }

  async refresh(): Promise<void> {
    this.loaded = true
    const epoch = ++this.epoch
    const accounts = [...visibleAccountsOf(this.scope.getSnapshot().value ?? {})]
    this.refreshing = true
    this.publish()
    try {
      const described = await this.ctx.remote.credentials.describe(accounts.map(account => account.apiKeyEnv))
      if (this.disposed || epoch !== this.epoch) return
      if (!described.ok) {
        // An unanswered describe leaves every key state unknown; say so on the
        // rows themselves instead of letting them read as eternally loading.
        this.failure = 'read'
        this.markUnreadable(accounts, described.error instanceof Error ? described.error.message : String(described.error))
        return
      }
      this.failure = undefined
      await Promise.all(accounts.map(async account => {
        const ref = account.apiKeyEnv
        const info = described.value[ref]
        const previous = this.rows.get(ref)
        this.rows.set(ref, { ...previous, ...account, configured: info?.configured ?? false,
          writable: info?.writable ?? true, loading: info?.configured === true, failed: false })
        this.publish()
        if (!info?.configured) { this.rows.set(ref, { ...account, configured: false, writable: info?.writable ?? true }); return }
        try {
          const usage = await this.readUsage(ref)
          if (this.disposed || epoch !== this.epoch) return
          this.rows.set(ref, { ...account, configured: true, writable: info.writable, usage, updatedAt: Date.now() })
        } catch (error) {
          if (this.disposed || epoch !== this.epoch) return
          const details = error && typeof error === 'object' && 'code' in error && error.code === 'opencode-go/usage-unavailable'
            && 'details' in error && error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : undefined
          const retain = details?.retryable === true && details.retainPrevious === true && previous?.usage?.source
            && previous.usage.source === details.source
          // The row reports the failure it saw: the message names the URL and the
          // HTTP status, and never the key.
          const message = error instanceof Error ? error.message : String(error)
          this.rows.set(ref, { ...account, configured: true, writable: info.writable, failed: true,
            problem: message.length > 200 ? message.slice(0, 200) + '…' : message,
            ...(retain ? { usage: previous.usage, updatedAt: previous.updatedAt, stale: true } : {}) })
        }
        this.publish()
      }))
    } catch (error) {
      if (epoch === this.epoch) {
        this.failure = 'read'
        this.markUnreadable(accounts, error instanceof Error ? error.message : String(error))
      }
    }
    finally { if (!this.disposed && epoch === this.epoch) { this.refreshing = false; this.publish() } }
  }

  /** Mark every account row as unreadable with the Host's own diagnostic. */
  private markUnreadable(accounts: readonly GoAccount[], message: string): void {
    const problem = message.length > 200 ? message.slice(0, 200) + '…' : message
    for (const account of accounts) this.rows.set(account.apiKeyEnv, { ...account, failed: true, problem })
    this.publish()
  }

  actions(): GoAccountsActions {
    const command = (request: AccountCommand) => this.execute(request).then(status => status === 'applied')
    return {
      loadAccounts: () => { void this.refresh() },
      addAccount: (name, key) => this.run(async () => {
        if (!name.trim() || name.trim().length > 80 || !key.trim()) return false
        const resumed = this.scope.getSnapshot().value?.accountOperations?.find(entry => entry.kind === 'add' && entry.account.name === name.trim())
        if (this.addition?.name !== name.trim()) this.addition = { name: name.trim(), id: resumed?.account.id ?? operationId() }
        const accepted = await command({ kind: 'add', id: this.addition.id, name, key })
        if (accepted) this.addition = undefined
        return accepted
      }),
      renameAccount: (ref, name) => this.run(() => command({ kind: 'rename', ref, name })),
      removeAccount: ref => this.run(async () => {
        const accepted = await command({ kind: 'remove', ref })
        if (!accepted) this.failure = 'remove'
        return accepted
      }),
      selectAccount: ref => this.run(() => command({ kind: 'select', ref })),
      setAutoSwitch: value => this.run(() => command({ kind: 'auto-switch', value })),
      replaceAccountKey: (ref, key) => this.run(async () => {
        if (!key.trim() || this.rows.get(ref)?.writable === false) return false
        const accepted = await command({ kind: 'replace-key', ref, key })
        if (accepted) this.invalidate(ref)
        return accepted
      }, false),
      moveAccount: (ref, toIndex) => this.run(() => command({ kind: 'move', ref, toIndex })),
    }
  }

  private async run(action: () => Promise<boolean>, requiresSettings = true): Promise<boolean> {
    if (this.busy || this.blocked() || requiresSettings && !this.scope.getSnapshot().writable) return false
    this.busy = true
    this.failure = undefined
    this.publish()
    try {
      const accepted = await action()
      if (!accepted && !this.failure) this.failure = 'write'
      return accepted
    } catch { this.failure ??= 'write'; return false }
    finally { this.busy = false; this.publish() }
  }
}
