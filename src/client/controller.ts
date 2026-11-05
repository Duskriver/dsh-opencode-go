/** Typed settings drafts, account actions and remote data for the page. */
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  modelSettingsKey,
  type ModelSource,
  DEFAULT_USAGE_DISPLAY,
  USAGE_DISPLAY_MODES,
  DEFAULT_USAGE_PILL_STYLE,
  USAGE_PILL_STYLES,
  SETTINGS_NAMESPACE,
  type OpencodeGoConfig,
  type OpencodeGoSettings,
  type OpencodeGoModelLimit,
  type OpencodeGoModelLimits,
  assertProxyURL,
  accountsOf,
  accountRefOf,
  type GoAccount,
  type GoModel,
  type GoModelCatalog,
  type GoUsage,
  type AnalyticsQuery,
  type AnalyticsReport,
  type AccountCommand,
  type SettingsWriteResult,
} from '../contracts.ts'

export type { OpencodeGoSettings, OpencodeGoModelLimit, OpencodeGoModelLimits } from '../contracts.ts'

export const OPENCODE_GO_NS = SETTINGS_NAMESPACE

export const TEXT_FIELDS = ['usageDisplay', 'usagePillStyle', 'showSidebarQuota', 'baseURL', 'freeBaseURL', 'proxyURL', 'refreshMinutes',
  'streamIdleTimeoutMs', 'maxImages', 'maxRequestImageBytes', 'requestImagePixelBudget', 'requestImageMaxBytes'] as const

export type TextField = typeof TEXT_FIELDS[number]

export const editableKeys = [...TEXT_FIELDS, 'modelLimits'] as const

export type EditableField = typeof editableKeys[number]

export interface FieldState { text: string; overridden: boolean; invalid: boolean }

export interface FormActions {
  edit(field: TextField, text: string): void
  editModelLimits(value: OpencodeGoModelLimits): void
  resetField(field: EditableField): void
  save(): void
  discard(): void
}

interface FormShell { available: boolean; writable: boolean; dirty: boolean; invalid: boolean; saving: boolean; failed: boolean }

type Draft = { kind: 'text'; text: string } | { kind: 'limits'; value: OpencodeGoModelLimits } | { kind: 'clear' }

interface PlannedWrite { field: EditableField; draft: Draft; write: FieldWrite | undefined }

type FieldWrite = { kind: 'set'; value: OpencodeGoConfig[EditableField] } | { kind: 'clear' }

function formatField(field: TextField, value: unknown): string {
  if (field === 'usageDisplay') return typeof value === 'string' ? value : DEFAULT_USAGE_DISPLAY
  if (field === 'usagePillStyle') return typeof value === 'string' ? value : DEFAULT_USAGE_PILL_STYLE
  if (field === 'showSidebarQuota') return String(value === true)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function parseField(field: TextField, text: string): FieldWrite | undefined {
  if (field === 'usageDisplay') return USAGE_DISPLAY_MODES.some(mode => mode === text) ? { kind: 'set', value: text as OpencodeGoConfig['usageDisplay'] } : undefined
  if (field === 'usagePillStyle') return USAGE_PILL_STYLES.some(style => style === text) ? { kind: 'set', value: text as OpencodeGoConfig['usagePillStyle'] } : undefined
  if (field === 'showSidebarQuota') return text === 'true' || text === 'false' ? { kind: 'set', value: text === 'true' } : undefined
  const trimmed = text.trim()
  if (field === 'proxyURL') {
    try { assertProxyURL(trimmed); return { kind: 'set', value: trimmed } }
    catch { return undefined }
  }
  if (!trimmed) return { kind: 'clear' }
  if (field === 'baseURL' || field === 'freeBaseURL') {
    try {
      const url = new URL(trimmed)
      return ['http:', 'https:'].includes(url.protocol) && !url.search && !url.hash ? { kind: 'set', value: trimmed } : undefined
    } catch { return undefined }
  }
  const value = Number(trimmed)
  return Number.isFinite(value) && (field !== 'maxImages' || Number.isSafeInteger(value) && value > 0)
    ? { kind: 'set', value } : undefined
}

/** Structural comparison keeps model capacities as objects throughout editing and saving. */
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false
  const l = left as Record<string, unknown>, r = right as Record<string, unknown>
  const keys = Object.keys(l)
  return keys.length === Object.keys(r).length && keys.every(key => Object.hasOwn(r, key) && sameValue(l[key], r[key]))
}

/** The gateway's model listing as the page reports it. */
export type OpencodeGoModels =
  /** Not asked for yet; the page asks once it mounts. */
  | { readonly status: 'idle' }
  /** A listing request is outstanding. */
  | { readonly status: 'loading' }
  /**
   * The gateway answered: a count/preview for the compact summary plus every
   * discovered entry used by the capacity editor.
   */
  | {
    readonly status: 'ready'
    readonly count: number
    readonly preview: readonly string[]
    readonly entries: readonly GoModel[]
    readonly stale?: boolean
    readonly message?: string
    readonly refreshing?: boolean
    readonly sources?: GoModelCatalog['sources']
  }
  /** The listing could not be read; `message` is the Host's own diagnostic. */
  | { readonly status: 'failed'; readonly message?: string; readonly sources?: GoModelCatalog['sources'] }

/** A failure on one source must not hide the other source's usable models. */
export function modelsForSource(models: OpencodeGoModels, source: ModelSource): OpencodeGoModels {
  if (models.status !== 'ready') return models
  const entries = models.entries.filter(model => (model.source ?? 'go') === source)
  const status = models.sources?.[source]
  return { ...models, entries, count: entries.length, preview: entries.map(model => model.name ?? model.id),
    ...(status === undefined ? {} : { stale: status.error !== undefined, message: status.error }) }
}

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
  /** A newly opened addition form owns a fresh ID; retries keep its existing ID. */
  resetAddition?: () => void
  renameAccount: (ref: string, name: string) => Promise<boolean>
  removeAccount: (ref: string) => Promise<boolean>
  selectAccount: (ref: string) => Promise<boolean>
  setAutoSwitch: (next: boolean) => Promise<boolean>
  replaceAccountKey: (ref: string, key: string) => Promise<boolean>
  /** Move one account to a new position; the first row becomes the preferred account. */
  moveAccount: (ref: string, toIndex: number) => Promise<boolean>
}

export interface OpencodeGoSectionState extends FormShell {
  accounts: GoAccountsState
  enabled: boolean
  usageDisplay: FieldState
  showSidebarQuota: FieldState
  usagePillStyle: FieldState
  modelVisibility: Readonly<Record<string, boolean>>
  pickerSaving: boolean
  pickerFailed: boolean
  baseURL: FieldState
  freeBaseURL: FieldState
  proxyURL: FieldState
  refreshMinutes: FieldState
  streamIdleTimeoutMs: FieldState
  maxImages: FieldState
  maxRequestImageBytes: FieldState
  requestImagePixelBudget: FieldState
  requestImageMaxBytes: FieldState
  models: OpencodeGoModels
  modelLimits: Omit<FieldState, 'text'>
  modelLimitDraft: OpencodeGoModelLimits
}

export interface OpencodeGoSectionFace extends FormActions, GoAccountsActions {
  hooks: { opencodeGo: SnapshotStore<OpencodeGoSectionState> }
  loadModels(): void
  readAnalytics(query: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsReport>
  readQuota(ref: string): Promise<GoUsage>
  setEnabled(next: boolean): void
  setModelEnabled(id: string, next: boolean): void
}

/** One controller owns the page's typed drafts and immediate account operations. */
export class OpencodeGoSectionController {
  private readonly drafts = new Map<EditableField, Draft>()
  private readonly store: SnapshotStore<OpencodeGoSectionState>
  private readonly unsubscribe: () => void
  private saving = false
  private failed = false
  private pickerSaving = false
  private pickerFailed = false
  private models: OpencodeGoModels = { status: 'idle' }
  private modelsRequest = 0
  private face: OpencodeGoSectionFace | undefined
  private accountRows = new Map<string, GoAccountView>()
  private accountBusy = false
  private accountRefreshing = false
  private accountFailure: GoAccountsState['failure']
  private accountEpoch = 0
  private accountsIdentity = ''
  private accountsLoaded = false
  private disposed = false
  private addition: { name: string; id: string } | undefined

  constructor(
    private readonly scope: ConfigForm<OpencodeGoSettings>,
    private readonly ctx: ClientContext,
    private readonly readModels: () => Promise<RemoteResult<GoModelCatalog>> = async () => {
      return ctx.remote.opencodeGoModels.read()
    },
    private readonly readUsage: (ref: string) => Promise<GoUsage> = async ref => {
      const result = await ctx.remote.opencodeGoUsage.readAccount(ref)
      if (!result.ok) throw result.error
      return result.value
    },
    private readonly executeAccountCommand: ExecuteAccountCommand = async command => {
      const result = await ctx.remote.opencodeGoAccounts.execute(command)
      return result.ok ? result.value : 'unknown'
    },
    private readonly readAnalytics: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport> = async () => {
      throw Object.assign(new Error('OpenCode Go analytics is unavailable in this session'), {
        code: 'opencode-go/analytics-unavailable', details: { reason: 'no-session-query', retryable: false },
      })
    },
  ) {
    this.syncAccounts()
    this.store = createSnapshotStore(this.projection())
    const endpoint = () => [scope.getSnapshot().value?.baseURL, scope.getSnapshot().value?.freeBaseURL, scope.getSnapshot().value?.proxyURL]
    let network = endpoint()
    this.unsubscribe = scope.subscribe(() => {
      this.syncAccounts()
      const next = endpoint()
      if (!sameValue(network, next)) {
        network = next
        this.modelsRequest++
        this.models = { status: 'idle' }
      }
      this.publish()
    })
  }

  dispose(): void {
    this.disposed = true
    this.accountEpoch++
    this.modelsRequest++
    this.unsubscribe()
  }

  private publish(): void { if (!this.disposed) this.store.set(this.projection()) }
  private blocked(): boolean { return this.saving || this.pickerSaving }
  private stored(field: EditableField): boolean {
    const user = this.scope.getSnapshot().user
    return !!user && Object.hasOwn(user, field)
  }

  private value(field: EditableField): unknown {
    const draft = this.drafts.get(field)
    if (draft?.kind === 'limits') return draft.value
    const snapshot = this.scope.getSnapshot()
    return draft?.kind === 'clear' ? (snapshot.base as OpencodeGoSettings | undefined)?.[field] : snapshot.value?.[field]
  }

  private field(field: TextField): FieldState {
    const draft = this.drafts.get(field)
    const text = draft?.kind === 'text' ? draft.text : formatField(field, this.value(field))
    const write = draft?.kind === 'clear' ? { kind: 'clear' as const } : parseField(field, text)
    const changed = draft?.kind === 'text' && text !== formatField(field, this.scope.getSnapshot().value?.[field])
    return { text, overridden: draft?.kind === 'clear' ? false : changed ? write?.kind === 'set' : this.stored(field), invalid: !!draft && !write }
  }

  private plan() {
    const value = this.scope.getSnapshot().value
    return [...this.drafts].flatMap<PlannedWrite>(([field, draft]) => {
      if (draft.kind === 'clear') return this.stored(field) ? [{ field, draft, write: { kind: 'clear' as const } as FieldWrite | undefined }] : []
      if (draft.kind === 'limits') return sameValue(draft.value, value?.modelLimits) ? []
        : [{ field, draft, write: { kind: 'set' as const, value: draft.value } as FieldWrite | undefined }]
      if (field === 'modelLimits' || draft.text === formatField(field, value?.[field])) return []
      return [{ field, draft, write: parseField(field, draft.text) }]
    })
  }

  private projection(): OpencodeGoSectionState {
    const snapshot = this.scope.getSnapshot()
    const plan = this.plan()
    return {
      available: snapshot.status === 'ready', writable: snapshot.writable,
      dirty: plan.length > 0, invalid: plan.some(item => !item.write), saving: this.saving || this.accountBusy, failed: this.failed,
      accounts: this.accountState(), enabled: snapshot.value?.enabled ?? true,
      ...Object.fromEntries(TEXT_FIELDS.map(field => [field, this.field(field)])) as Record<TextField, FieldState>,
      modelVisibility: snapshot.value?.modelVisibility ?? {}, pickerSaving: this.pickerSaving, pickerFailed: this.pickerFailed,
      models: this.models,
      modelLimits: { overridden: this.drafts.get('modelLimits')?.kind === 'limits' || !this.drafts.has('modelLimits') && this.stored('modelLimits'), invalid: false },
      modelLimitDraft: modelLimitsOf(this.value('modelLimits')),
    }
  }

  private edit(field: EditableField, draft: Draft): void {
    this.drafts.set(field, draft)
    this.failed = false
    this.publish()
  }

  async save(): Promise<void> {
    const plan = this.plan()
    if (!plan.length || this.blocked() || this.accountBusy || !this.scope.getSnapshot().writable || plan.some(item => !item.write)) return
    const revision = this.scope.getSnapshot().revision
    this.saving = true
    this.failed = false
    this.publish()
    try {
      const ops = plan.map(({ field, write }): SettingsPathOpView => write!.kind === 'clear'
        ? { op: 'unset', path: [field] }
        : { op: 'set', path: [field], value: write!.value as Extract<SettingsPathOpView, { op: 'set' }>['value'] })
      const accepted = await this.scope.mutate(ops, revision)
      this.failed = !accepted
      if (accepted) for (const { field, draft } of plan) if (this.drafts.get(field) === draft) this.drafts.delete(field)
    } catch { this.failed = true }
    finally { this.saving = false; this.publish() }
  }

  async setEnabled(next: boolean): Promise<void> { await this.writePickerSetting('enabled', next) }
  async setModelEnabled(id: string, next: boolean): Promise<void> {
    if (this.models.status === 'ready' && this.models.entries.some(model => modelSettingsKey(model) === id && model.configurationMissing)) return
    await this.writePickerSetting('modelVisibility', { ...this.scope.getSnapshot().value?.modelVisibility, [id]: next })
  }

  private async writePickerSetting(field: 'enabled' | 'modelVisibility', value: boolean | Record<string, boolean>): Promise<void> {
    if (this.blocked() || this.accountBusy || !this.scope.getSnapshot().writable) return
    this.pickerSaving = true
    this.pickerFailed = false
    this.publish()
    try { this.pickerFailed = !await this.scope.set(field, value) }
    catch { this.pickerFailed = true }
    finally { this.pickerSaving = false; this.publish() }
  }

  inject(): OpencodeGoSectionFace {
    this.face ??= {
      hooks: { opencodeGo: this.store },
      loadModels: () => this.loadModels(), readAnalytics: (query, signal) => this.readAnalytics(query, signal), readQuota: ref => this.readUsage(ref),
      setEnabled: next => { void this.setEnabled(next) }, setModelEnabled: (id, next) => { void this.setModelEnabled(id, next) },
      edit: (field, text) => this.edit(field, { kind: 'text', text }),
      editModelLimits: value => this.edit('modelLimits', { kind: 'limits', value: structuredClone(value) }),
      resetField: field => this.edit(field, { kind: 'clear' }), save: () => { void this.save() },
      discard: () => { this.drafts.clear(); this.failed = false; this.publish() },
      ...this.accountActions(),
    }
    return this.face
  }

  loadModels(): void {
    const request = ++this.modelsRequest
    const previous = this.models.status === 'ready' ? this.models : undefined
    this.models = previous ? { ...previous, refreshing: true } : { status: 'loading' }
    this.publish()
    const failed = (message: string): void => {
      this.models = previous
        ? { ...previous, refreshing: false, stale: true, message, sources: undefined }
        : { status: 'failed', message }
    }
    // A later read owns the page, including its cached entries and diagnostic.
    void this.readModels()
      .then((response) => {
        if (request !== this.modelsRequest) return
        if (!response.ok) failed(response.error.message)
        else if (response.value.stale && response.value.models.length === 0) {
          this.models = { status: 'failed', ...(response.value.error ? { message: response.value.error } : {}),
            ...(response.value.sources ? { sources: response.value.sources } : {}) }
        } else {
          this.models = {
            status: 'ready',
            count: response.value.models.length,
            preview: response.value.models.map(model => model.name ?? model.id),
            entries: response.value.models,
            stale: response.value.stale,
            ...(response.value.sources ? { sources: response.value.sources } : {}),
            ...(response.value.error ? { message: response.value.error } : {}),
          }
        }
        this.publish()
      })
      .catch((error: unknown) => {
        if (request !== this.modelsRequest) return
        failed(error instanceof Error ? error.message : String(error))
        this.publish()
      })
  }

  accountState(): GoAccountsState {
    const config = this.scope.getSnapshot().value ?? {}
    return {
      entries: accountsOf(config).map(account => ({ ...this.accountRows.get(account.apiKeyEnv), ...account })),
      activeRef: accountRefOf(config), autoSwitch: config.autoSwitch === true,
      busy: this.accountBusy, blocked: this.blocked(), refreshing: this.accountRefreshing, failure: this.accountFailure,
    }
  }

  syncAccounts(): void {
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
    if (identity === this.accountsIdentity) return
    this.accountsIdentity = identity
    this.accountEpoch++
    this.accountRows.clear()
    this.accountRefreshing = false
    if (this.accountsLoaded) void this.refreshAccounts()
  }

  refreshCredential(ref: string): void {
    if (!accountsOf(this.scope.getSnapshot().value ?? {}).some(account => account.apiKeyEnv === ref)) return
    this.accountEpoch++
    this.accountRows.delete(ref)
    if (this.accountsLoaded) void this.refreshAccounts()
  }

  async refreshAccounts(): Promise<void> {
    this.accountsLoaded = true
    const epoch = ++this.accountEpoch
    const accounts = [...accountsOf(this.scope.getSnapshot().value ?? {})]
    this.accountRefreshing = true
    this.publish()
    try {
      const described = await this.ctx.remote.credentials.describe(accounts.map(account => account.apiKeyEnv))
      if (this.disposed || epoch !== this.accountEpoch) return
      if (!described.ok) {
        // An unanswered describe leaves every key state unknown; say so on the
        // rows themselves instead of letting them read as eternally loading.
        this.accountFailure = 'read'
        this.markUnreadable(accounts, described.error instanceof Error ? described.error.message : String(described.error))
        return
      }
      this.accountFailure = undefined
      await Promise.all(accounts.map(async account => {
        const ref = account.apiKeyEnv
        const info = described.value[ref]
        const previous = this.accountRows.get(ref)
        this.accountRows.set(ref, { ...previous, ...account, configured: info?.configured ?? false,
          writable: info?.writable ?? true, loading: info?.configured === true, failed: false })
        this.publish()
        if (!info?.configured) { this.accountRows.set(ref, { ...account, configured: false, writable: info?.writable ?? true }); return }
        try {
          const usage = await this.readUsage(ref)
          if (this.disposed || epoch !== this.accountEpoch) return
          this.accountRows.set(ref, { ...account, configured: true, writable: info.writable, usage, updatedAt: Date.now() })
        } catch (error) {
          if (this.disposed || epoch !== this.accountEpoch) return
          const details = error && typeof error === 'object' && 'code' in error && error.code === 'opencode-go/usage-unavailable'
            && 'details' in error && error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : undefined
          const retain = details?.retryable === true && details.retainPrevious === true && previous?.usage?.source
            && previous.usage.source === details.source
          // Keep the Host's bounded, redacted upstream reason and recovery hint
          // together so the row does not truncate the useful part of an HTTP error.
          const message = error instanceof Error ? error.message : String(error)
          this.accountRows.set(ref, { ...account, configured: true, writable: info.writable, failed: true,
            problem: message.length > 512 ? message.slice(0, 512) + '…' : message,
            ...(retain ? { usage: previous.usage, updatedAt: previous.updatedAt, stale: true } : {}) })
        }
        this.publish()
      }))
    } catch (error) {
      if (epoch === this.accountEpoch) {
        this.accountFailure = 'read'
        this.markUnreadable(accounts, error instanceof Error ? error.message : String(error))
      }
    }
    finally { if (!this.disposed && epoch === this.accountEpoch) { this.accountRefreshing = false; this.publish() } }
  }

  /** Mark every account row as unreadable with the Host's own diagnostic. */
  private markUnreadable(accounts: readonly GoAccount[], message: string): void {
    const problem = message.length > 200 ? message.slice(0, 200) + '…' : message
    for (const account of accounts) this.accountRows.set(account.apiKeyEnv, { ...account, failed: true, problem })
    this.publish()
  }

  accountActions(): GoAccountsActions {
    const command = (request: AccountCommand) => this.executeAccountCommand(request).then(status => status === 'applied')
    return {
      loadAccounts: () => { void this.refreshAccounts() },
      resetAddition: () => { this.addition = undefined },
      addAccount: (name, key) => this.runAccountAction(async () => {
        if (!name.trim() || name.trim().length > 80 || !key.trim()) return false
        if (this.addition?.name !== name.trim()) this.addition = { name: name.trim(), id: operationId() }
        const accepted = await command({ kind: 'add', id: this.addition.id, name, key })
        if (accepted) this.addition = undefined
        return accepted
      }),
      renameAccount: (ref, name) => this.runAccountAction(() => command({ kind: 'rename', ref, name })),
      removeAccount: ref => this.runAccountAction(async () => {
        const accepted = await command({ kind: 'remove', ref })
        if (!accepted) this.accountFailure = 'remove'
        return accepted
      }),
      selectAccount: ref => this.runAccountAction(() => command({ kind: 'select', ref })),
      setAutoSwitch: value => this.runAccountAction(() => command({ kind: 'auto-switch', value })),
      replaceAccountKey: (ref, key) => this.runAccountAction(async () => {
        if (!key.trim() || this.accountRows.get(ref)?.writable === false) return false
        const accepted = await command({ kind: 'replace-key', ref, key })
        if (accepted) this.refreshCredential(ref)
        return accepted
      }, false),
      moveAccount: (ref, toIndex) => this.runAccountAction(() => command({ kind: 'move', ref, toIndex })),
    }
  }

  private async runAccountAction(action: () => Promise<boolean>, requiresSettings = true): Promise<boolean> {
    if (this.accountBusy || this.blocked() || requiresSettings && !this.scope.getSnapshot().writable) return false
    this.accountBusy = true
    this.accountFailure = undefined
    this.publish()
    try {
      const accepted = await action()
      if (!accepted && !this.accountFailure) this.accountFailure = 'write'
      return accepted
    } catch { this.accountFailure ??= 'write'; return false }
    finally { this.accountBusy = false; this.publish() }
  }
}

function modelLimitsOf(value: unknown): OpencodeGoModelLimits {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const limits: OpencodeGoModelLimits = {}
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === null) { limits[id] = null; continue }
    if (typeof entry !== 'object' || Array.isArray(entry)) continue
    const fields = entry as Record<string, unknown>
    const limit: OpencodeGoModelLimit = {}
    if (fields.contextWindow === null) limit.contextWindow = null
    if (fields.maxTokens === null) limit.maxTokens = null
    if (fields.thinkingBudgets === null) limit.thinkingBudgets = null
    if (Array.isArray(fields.thinkingBudgets) && fields.thinkingBudgets.length <= 16
      && fields.thinkingBudgets.every(value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0)) {
      limit.thinkingBudgets = fields.thinkingBudgets
    }
    if (typeof fields.contextWindow === 'number' && Number.isSafeInteger(fields.contextWindow) && fields.contextWindow > 0) {
      limit.contextWindow = fields.contextWindow
    }
    if (typeof fields.maxTokens === 'number' && Number.isSafeInteger(fields.maxTokens) && fields.maxTokens > 0) {
      limit.maxTokens = fields.maxTokens
    }
    if (limit.contextWindow !== undefined || limit.maxTokens !== undefined || limit.thinkingBudgets !== undefined) limits[id] = limit
  }
  return limits
}
