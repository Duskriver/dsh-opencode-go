import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { ACCOUNT_REF_PREFIX, MAX_ACCOUNTS, accountsOf, accountRefOf, type AccountSettings, type GoAccount } from '../accounts.ts'
import type { GoUsage } from '../usage-contract.ts'
import type { SettingsScope } from './settings.ts'

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

/** The settings service rejects a stale-revision write this way; an add can
 * re-read and re-apply instead of stranding the credential it just stored. */
function isSettingsConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown }
  return /conflict/i.test(`${String(name ?? '')} ${String(code ?? '')} ${String(message ?? '')}`)
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

  constructor(
    private readonly scope: SettingsScope<AccountSettings & { baseURL?: string; proxyURL?: string }>,
    private readonly ctx: Context,
    private readonly readUsage: (ref: string) => Promise<GoUsage>,
    private readonly publish: () => void,
    private readonly blocked: () => boolean,
    /**
     * Server-side confirmation for a settings write whose settlement carries
     * no verdict: legacy scopes resolve `mutate` without saying whether the
     * write committed, and a concurrent write can keep a committed account out
     * of the local snapshot. `true`/`false` answer from the settings document;
     * `undefined` means the answer is unavailable and callers stay conservative.
     */
    private readonly probeServerAccount: (id: string) => Promise<boolean | undefined> = async () => undefined,
  ) { this.sync() }

  snapshot(): GoAccountsState {
    const config = this.scope.getSnapshot().value ?? {}
    return {
      entries: accountsOf(config).map(account => ({ ...this.rows.get(account.apiKeyEnv), ...account })),
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
      accountsOf(config).map(account => [account.id, account.apiKeyEnv])
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
    if (!accountsOf(this.scope.getSnapshot().value ?? {}).some(account => account.apiKeyEnv === ref)) return
    this.epoch++
    this.rows.delete(ref)
    if (this.loaded) void this.refresh()
  }

  async refresh(): Promise<void> {
    this.loaded = true
    const epoch = ++this.epoch
    const accounts = [...accountsOf(this.scope.getSnapshot().value ?? {})]
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
    return {
      loadAccounts: () => { void this.refresh() },
      addAccount: (name, key) => this.add(name, key),
      renameAccount: (ref, name) => this.rename(ref, name),
      removeAccount: ref => this.remove(ref),
      selectAccount: ref => this.select(ref),
      setAutoSwitch: next => this.run(async () => {
        await this.scope.set('autoSwitch', next)
        return this.scope.getSnapshot().value?.autoSwitch === next
      }),
      replaceAccountKey: (ref, key) => this.run(async () => {
        if (!key.trim() || !this.account(ref) || this.rows.get(ref)?.writable === false) return false
        const response = await this.ctx.remote.credentials.set(ref, key.trim())
        if (!response.ok) return false
        this.invalidate(ref)
        return true
      }, false),
      moveAccount: (ref, toIndex) => this.move(ref, toIndex),
    }
  }

  /**
   * Reorder the visible accounts and keep the preferred reference on the first row.
   * The adapter tries the preferred reference first and the rest in array order, so
   * one write is what makes top-to-bottom the real call order. A placeholder row the
   * settings never stored is materialized here, which its `legacy:` id admits.
   */
  private move(ref: string, toIndex: number): Promise<boolean> {
    return this.run(async () => {
      const snapshot = this.scope.getSnapshot()
      const entries = [...accountsOf(snapshot.value ?? {})]
      const from = entries.findIndex(account => account.apiKeyEnv === ref)
      if (from < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= entries.length || toIndex === from) return false
      const [moved] = entries.splice(from, 1)
      entries.splice(toIndex, 0, moved!)
      await this.mutate([
        { op: 'set', path: ['accounts'], value: entries },
        { op: 'set', path: ['apiKeyEnv'], value: entries[0]!.apiKeyEnv },
      ], snapshot.revision)
      const after = this.scope.getSnapshot().value
      return after?.apiKeyEnv === entries[0]!.apiKeyEnv && after.accounts?.[toIndex]?.apiKeyEnv === ref
    })
  }

  private account(ref: string): GoAccount | undefined {
    return accountsOf(this.scope.getSnapshot().value ?? {}).find(account => account.apiKeyEnv === ref)
  }

  private async mutate(ops: readonly SettingsPathOpView[], revision = this.scope.getSnapshot().revision): Promise<void | boolean> {
    return this.scope.mutate(ops, revision)
  }

  private add(name: string, key: string): Promise<boolean> {
    return this.run(async () => {
      if (!name.trim() || name.trim().length > 80 || !key.trim()) return false
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
      const ref = ACCOUNT_REF_PREFIX + id.replaceAll('-', '').toUpperCase()
      const account = { id, name: name.trim(), apiKeyEnv: ref }
      const response = await this.ctx.remote.credentials.set(ref, key.trim())
      if (!response.ok) return false
      for (let attempt = 0; attempt < 3; attempt++) {
        const snapshot = this.scope.getSnapshot()
        const existing = accountsOf(snapshot.value ?? {})
        // An earlier ambiguous attempt may already have committed this account.
        if (existing.some(entry => entry.id === id)) return true
        // Persist an existing legacy account before selection can move away
        // from it. Only a confirmed empty placeholder can be dropped; an
        // unanswered describe must not lose an account that may hold a key.
        const configured = await this.configuredOf(existing.map(entry => entry.apiKeyEnv))
        const accounts = existing.filter(entry => !(snapshot.value?.accounts == null && !entry.name
          && configured.get(entry.apiKeyEnv) === false))
        if (accounts.length >= MAX_ACCOUNTS) break
        // The new account becomes preferred only when every account the page
        // already shows — placeholder included — is known to hold no key.
        const first = existing.length === 0 || existing.every(entry => configured.get(entry.apiKeyEnv) === false)
        let accepted: void | boolean
        try {
          accepted = await this.mutate([
            { op: 'set', path: ['accounts'], value: [...accounts, account] },
            ...(first ? [{ op: 'set' as const, path: ['apiKeyEnv'], value: ref }] : []),
          ], snapshot.revision)
        } catch (error) {
          // A concurrent settings write moved the revision: re-read and re-apply
          // the same account rather than stranding the credential just stored.
          if (attempt < 2 && isSettingsConflict(error)) continue
          // A transport failure may follow a committed metadata write. Keep the key
          // rather than removing a credential a late accepted response could name.
          return false
        }
        // 0.1.7 forms settle true/false, and the snapshot folds only the latest
        // write, so the settlement outranks the snapshot.
        if (accepted === true) return true
        if (this.scope.getSnapshot().value?.accounts?.some(entry => entry.id === id)) return true
        if (accepted === false) break // The host refused the value: roll the fresh key back.
        // A legacy scope settles void whether the write committed or was
        // refused, and a concurrent write (the usage pill's account switch, any
        // other surface) can keep a committed account out of the snapshot. Only
        // a server-side absence justifies deleting the fresh key; an unanswered
        // probe keeps it, like the transport branch above.
        const committed = await this.probeServerAccount(id)
        if (committed === true) return true
        if (committed === false) break
        return false
      }
      try { if (!(await this.ctx.remote.credentials.unset(ref)).ok) this.failure = 'cleanup' }
      catch { this.failure = 'cleanup' }
      return false
    })
  }

  /** Loaded rows answer from cache; anything they do not know is described on
   * the spot, so a placeholder decision never races the page's first describe. */
  private async configuredOf(refs: readonly string[]): Promise<Map<string, boolean>> {
    const configured = new Map<string, boolean>()
    const unknown = refs.filter(ref => {
      const known = this.rows.get(ref)?.configured
      if (known === undefined) return true
      configured.set(ref, known)
      return false
    })
    if (unknown.length === 0) return configured
    try {
      const described = await this.ctx.remote.credentials.describe(unknown)
      if (described.ok) for (const ref of unknown) configured.set(ref, described.value[ref]?.configured ?? false)
    } catch { /* An unanswered describe keeps the preference decision conservative. */ }
    return configured
  }

  private rename(ref: string, name: string): Promise<boolean> {
    return this.run(async () => {
      if (!this.account(ref) || !name.trim() || name.trim().length > 80) return false
      const accounts = accountsOf(this.scope.getSnapshot().value ?? {}).map(account =>
        account.apiKeyEnv === ref ? { ...account, name: name.trim() } : account)
      await this.mutate([{ op: 'set', path: ['accounts'], value: accounts }])
      return this.scope.getSnapshot().value?.accounts?.find(account => account.apiKeyEnv === ref)?.name === name.trim()
    })
  }

  private select(ref: string): Promise<boolean> {
    return this.run(async () => {
      if (!this.account(ref)) return false
      await this.mutate([{ op: 'set', path: ['apiKeyEnv'], value: ref }])
      return accountRefOf(this.scope.getSnapshot().value ?? {}) === ref
    })
  }

  private remove(ref: string): Promise<boolean> {
    return this.run(async () => {
      if (!this.account(ref)) return false
      // The stored key goes first so a failure can never strand an orphan
      // credential: a refused unset keeps the row — retryable — while a refused
      // settings write leaves a row without its key, which stays visible and
      // fixable instead of becoming a dangling secret.
      if (ref.startsWith(ACCOUNT_REF_PREFIX)) {
        const described = await this.ctx.remote.credentials.describe([ref]).catch(() => undefined)
        if (!described?.ok || described.value[ref] === undefined) {
          this.failure = 'remove'
          return false
        }
        if (described.value[ref].configured === true) {
          let removed = false
          try { removed = (await this.ctx.remote.credentials.unset(ref)).ok }
          catch { /* A refused unset keeps the row; the remove stays retryable. */ }
          if (!removed) { this.failure = 'remove'; return false }
        }
      }
      const config = this.scope.getSnapshot().value ?? {}
      const remaining = accountsOf(config).filter(account => account.apiKeyEnv !== ref)
      await this.mutate([
        { op: 'set', path: ['accounts'], value: remaining },
        ...(accountRefOf(config) === ref && remaining.length ? [{ op: 'set' as const, path: ['apiKeyEnv'], value: remaining[0]!.apiKeyEnv }] : []),
      ])
      return !this.account(ref)
    })
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
