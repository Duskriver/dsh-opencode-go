/** Browser-safe configuration, account metadata and RPC wire contracts. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'

/** Public DSH route and the private SDK transport have separate identities. */
export const PROVIDER_ID = 'dsh-opencode-go'

export const DISPLAY_NAME = 'DSH OpenCode Go'

export const FREE_PROVIDER_ID = 'dsh-opencode-free'

export const FREE_DISPLAY_NAME = 'DSH OpenCode Free'

export type ModelSource = 'go' | 'free'

/** Go keeps its legacy keys; Free owns a separate settings namespace. */
export function modelSettingsKey(model: { id: string; source?: ModelSource }): string {
  return model.source === 'free' ? `${FREE_PROVIDER_ID}/${model.id}` : model.id
}

export const SDK_PROVIDER_ID = 'opencode-go'

/** Public Go discovery/usage base; inference uses the documented protocol-specific siblings. */
export const DEFAULT_BASE_URL = 'https://opencode.ai/inference/go/v1'

export const DEFAULT_FREE_BASE_URL = 'https://opencode.ai/inference/v1'

/**
 * Migrate the legacy official address before any request is constructed.
 */
export function migrateGatewayBaseURL(baseURL: string): string {
  return baseURL.replace(/\/+$/, '') === 'https://opencode.ai/zen/go/v1'
    ? 'https://opencode.ai/inference/go/v1' : baseURL
}

/** Shared by Host validation and the browser form; never echo proxy credentials. */
export function assertProxyURL(raw: string | undefined): string {
  const value = raw?.trim() ?? ''
  if (!value) return ''
  let url: URL
  try { url = new URL(value) }
  catch { throw new Error('OpenCode Go: proxy address must be a valid URL') }
  if (!['http:', 'https:', 'socks5:'].includes(url.protocol)) {
    throw new Error('OpenCode Go: proxy address must use http://, https:// or socks5://')
  }
  if (!url.hostname || url.port === '0' || (url.pathname !== '' && url.pathname !== '/') || url.search || url.hash) {
    throw new Error('OpenCode Go: proxy address must contain a host and optional port, without a path, query or fragment')
  }
  try { decodeURIComponent(url.username); decodeURIComponent(url.password) }
  catch { throw new Error('OpenCode Go: proxy credentials contain invalid URL encoding') }
  return url.href
}

/** Usage visibility shared by the Host schema and the browser settings. */
export const USAGE_DISPLAY_MODES = ['auto', 'always', 'off'] as const

export type UsageDisplayMode = typeof USAGE_DISPLAY_MODES[number]

export const DEFAULT_USAGE_DISPLAY: UsageDisplayMode = 'auto'

export const USAGE_PILL_STYLES = ['badge', 'plain'] as const

export type UsagePillStyle = typeof USAGE_PILL_STYLES[number]

export const DEFAULT_USAGE_PILL_STYLE: UsagePillStyle = 'badge'

/** Global plugin appearance, shared by Host validation and browser settings. */
export const OPENCODE_GO_THEMES = ['native', 'classic'] as const

export type OpencodeGoTheme = typeof OPENCODE_GO_THEMES[number]

export const DEFAULT_OPENCODE_GO_THEME: OpencodeGoTheme = 'native'

/** Client-safe account metadata. Secrets stay in the host credential service. */
export type GoAccount = {
  id: string
  name: string
  apiKeyEnv: string
}

export const MAX_ACCOUNTS = 20

/**
 * Upper bound for one configured thinking budget, in tokens. Shared with the
 * browser form so a stored value always fits a model's advertised ceiling while
 * staying far below any tokenizer/timer limit.
 */
export const MAX_THINKING_BUDGET_TOKENS = 1_000_000

export const ACCOUNT_REF_PREFIX = 'DSH_OPENCODE_GO_ACCOUNT_'

export const DEFAULT_ACCOUNT_REF = 'OPENCODE_API_KEY'

/** A credential reference is a bare environment variable name, never empty or decorated. */
export const ACCOUNT_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface AccountSettings {
  apiKeyEnv?: string
  /** Omission/null preserves legacy credentials; an explicit empty list removes all accounts. */
  accounts?: readonly GoAccount[] | null
  autoSwitch?: boolean
}

export function accountRefOf(settings: AccountSettings): string {
  return settings.apiKeyEnv || DEFAULT_ACCOUNT_REF
}

/** Promote one account while preserving every other account's relative order. */
export function moveAccountFirst(accounts: readonly GoAccount[], ref: string): readonly GoAccount[] {
  const index = accounts.findIndex(account => account.apiKeyEnv === ref)
  return index <= 0 ? accounts : [accounts[index]!, ...accounts.slice(0, index), ...accounts.slice(index + 1)]
}

/** Read legacy selections as the first account until the host persists their order. */
export function accountsOf(settings: AccountSettings): readonly GoAccount[] {
  const ref = accountRefOf(settings)
  if (settings.accounts?.length === 0) return []
  const accounts = settings.accounts ?? []
  return accounts.some(account => account.apiKeyEnv === ref) ? moveAccountFirst(accounts, ref) : [
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
      || typeof account.apiKeyEnv !== 'string' || !ACCOUNT_REF_PATTERN.test(account.apiKeyEnv)
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

export const SETTINGS_NAMESPACE = 'llm-opencode-go'

/**
 * Loader profile entry id this plugin ships in `cordis.patch.yml`.
 *
 * DSH settings addresses rows by Loader profile entry id: `SettingsDescriptor.ns`
 * is `entry.options.id` in `@deepseek-ai/dsh-settings`, so this is NOT an
 * intrinsic plugin namespace — it must match the `insert[].id` of the shipped
 * profile patch. Renaming that patch id requires renaming this constant.
 *
 * A runtime fallback discovery is intentionally not attempted:
 * `settings.describe()` exposes no plugin identity (`ns` is the entry id and
 * `schema` is a per-mount uid/ref graph), so a heuristic match could bind
 * account metadata to another plugin's row. The shipped patch id is the
 * invariant; a renamed entry id is unsupported and fails loudly through the
 * account manager ("Account settings are unavailable") instead of guessing.
 */
export const PROFILE_ENTRY_ID = 'opencode-go'

/**
 * One model's configured capacities. Every field is optional so a deployment
 * can override only the value it needs. Null explicitly selects the catalog
 * value even when a lower profile/settings layer supplies an override.
 */
export interface OpencodeGoModelLimit {
  /** Context window in tokens, overriding what the catalog advertised. */
  contextWindow?: number | null
  /** Output cap per request, overriding what the catalog advertised. */
  maxTokens?: number | null
  /** Additional selectable thinking budgets, in tokens; null keeps the standard presets. */
  thinkingBudgets?: number[] | null
}

/** Per-model capacities; a null entry selects both original catalog values. */
export type OpencodeGoModelLimits = Record<string, OpencodeGoModelLimit | null>

/** Runtime configuration for one plugin mount. */
export interface OpencodeGoConfig {
  /**
   * Master switch for both routes. False withdraws Go and Free and their models
   * without unloading the settings page. Go additionally requires a usable
   * configured key; Free additionally requires {@link freeEnabled}.
   */
  enabled: boolean
  /**
   * Serve the Free provider, its models and its public access. Off by default:
   * enabling it sends requests as the official OpenCode CLI user agent and may
   * violate upstream terms or trigger rate limiting, so it is an explicit
   * opt-in independent of {@link enabled}. While off, the Free route is not
   * registered, its catalog is not fetched and its models are not discovered.
   */
  freeEnabled: boolean
  /** Usage pill visibility; auto follows only the selected Go route. */
  usageDisplay: UsageDisplayMode
  /** Show quota in the sidebar independently of the selected conversation model. */
  showSidebarQuota: boolean
  /** Appearance of the conversation input's quota trigger. */
  usagePillStyle: UsagePillStyle
  /** Global plugin appearance theme. */
  appearanceTheme: OpencodeGoTheme
  /** Per-model picker switches; absent entries default to enabled unless deprecated. */
  modelVisibility?: Record<string, boolean>
  /** Legacy credential reference, kept in sync with the first/current account. */
  apiKeyEnv: string
  /** The first account is current; subsequent accounts are tried in order. */
  accounts?: GoAccount[] | null
  /** Try other saved accounts on quota/credential rejection before any content is emitted. */
  autoSwitch?: boolean
  /** Discovery/usage base; the official Go gateway selects inference endpoints by protocol. */
  baseURL: string
  /** Platform discovery base; only explicitly free chat models are served. */
  freeBaseURL: string
  /** Optional HTTP(S) or SOCKS5 proxy; blank uses the default network transport. */
  proxyURL: string
  /** Request/picker cache lifetime in minutes; explicit discovery bypasses it. */
  refreshMinutes: number
  /** Largest idle gap between stream events before the request fails. */
  streamIdleTimeoutMs: number
  /** Bound discovery and each attempt's credential/image preparation. */
  requestPreparationTimeoutMs?: number
  /** Whole dispatch deadline, including discovery and account fallback. */
  requestTimeoutMs?: number
  /** Optional retained image occurrence cap per request; omission or null leaves the count unlimited. */
  maxImages?: number | null
  /** Request-level bound on base64-encoded image payload, in bytes. */
  maxRequestImageBytes: number
  /** Total-pixel budget for one request image. */
  requestImagePixelBudget: number
  /** Raw encoded-byte target for one request image before base64 expansion. */
  requestImageMaxBytes: number
  /** Per-model capacity overrides; an absent field inherits the catalog value. */
  modelLimits: OpencodeGoModelLimits
}

/** Settings snapshots may omit fields inherited from their base layer. */
export type OpencodeGoSettings = Partial<OpencodeGoConfig>

export interface GoModel {
  id: string
  source?: ModelSource
  name?: string
  contextWindow?: number
  maxTokens?: number
  /** Token budget controls available to this model, including their catalog bounds. */
  reasoningBudget?: ThinkingBudgetRange
  deprecated?: boolean
  releaseDate?: string
  /** Input modalities the gateway declares, in {@link INPUT_MODALITIES} order. */
  inputModalities?: readonly InputModality[]
  /** Advertised by the gateway but lacking a usable protocol and capability configuration. */
  configurationMissing?: boolean
}

export interface ThinkingBudgetRange {
  min: number
  max: number
}

/**
 * Input modalities this page can name; MIME types are normalized to these tokens.
 */
export const INPUT_MODALITIES = ['text', 'image', 'audio', 'video', 'pdf'] as const

export type InputModality = typeof INPUT_MODALITIES[number]

/**
 * Normalize one `modalities.input` array into display order.
 * @param value - the raw gateway declaration or Host response.
 * @returns the declared modalities in {@link INPUT_MODALITIES} order, or
 *   `undefined` when nothing recognizable was declared.
 */
export function normalizeInputModalities(value: unknown): readonly InputModality[] | undefined {
  if (!Array.isArray(value)) return undefined
  const declared = new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toLowerCase().split(';')[0]!)
    .map(item => item.startsWith('image/') ? 'image' : item.startsWith('audio/') ? 'audio'
      : item.startsWith('video/') ? 'video' : item === 'application/pdf' ? 'pdf'
        : item.startsWith('text/') ? 'text' : item))
  const ordered = INPUT_MODALITIES.filter(modality => declared.has(modality))
  return ordered.length === 0 ? undefined : ordered
}

/** Last successful check of one catalog source, plus any current refresh failure. */
export interface GoCatalogSourceStatus {
  readonly updatedAt?: number
  readonly error?: string
  readonly warning?: string
}

/** A failed refresh retains the Host's usable data with an explicit diagnostic. */
export interface GoModelCatalog {
  readonly models: readonly GoModel[]
  readonly stale: boolean
  readonly error?: string
  /** Optional for clients reading an older Host response. Timestamps are Unix milliseconds. */
  readonly sources?: { readonly go: GoCatalogSourceStatus; readonly free: GoCatalogSourceStatus }
}

/** Missing configuration cannot be enabled; configured models follow explicit switches or lifecycle defaults. */
export function isModelEnabled(
  model: Pick<GoModel, 'id' | 'source' | 'deprecated' | 'configurationMissing'>,
  modelVisibility?: Readonly<Record<string, boolean>>,
): boolean {
  if (model.configurationMissing) return false
  const key = modelSettingsKey(model)
  const enabled = modelVisibility && Object.hasOwn(modelVisibility, key) ? modelVisibility[key] : undefined
  return typeof enabled === 'boolean' ? enabled : !model.deprecated
}

export function validReleaseDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

/** Calendar dates are supplied without a timezone; compare UTC dates consistently. */
export function isNewModel(model: GoModel, now = Date.now()): boolean {
  if (model.deprecated || !validReleaseDate(model.releaseDate)) return false
  const days = Math.floor(now / 86_400_000) - Date.parse(model.releaseDate) / 86_400_000
  return days >= 0 && days < 7
}

export function sortModels(models: readonly GoModel[], now = Date.now()): GoModel[] {
  const rank = (model: GoModel): number => model.deprecated ? 2 : isNewModel(model, now) ? 0 : 1
  return [...models].sort((a, b) => rank(a) - rank(b)
    || (isNewModel(a, now) && isNewModel(b, now) ? b.releaseDate!.localeCompare(a.releaseDate!) : 0))
}

export function parseGoModels(value: unknown): GoModel[] {
  if (!Array.isArray(value)) throw new Error('Invalid OpenCode Go model list')
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid OpenCode Go model')
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string' || !row.id) throw new Error('Missing OpenCode Go model id')
    const model: GoModel = { id: row.id }
    if (row.source !== undefined) {
      if (row.source !== 'go' && row.source !== 'free') throw new Error('Invalid OpenCode model source')
      model.source = row.source
    }
    if (typeof row.name === 'string') model.name = row.name
    for (const key of ['contextWindow', 'maxTokens'] as const) {
      if (typeof row[key] === 'number' && Number.isSafeInteger(row[key]) && row[key] > 0) model[key] = row[key]
    }
    if (row.reasoningBudget !== null && typeof row.reasoningBudget === 'object') {
      const { min, max } = row.reasoningBudget as Record<string, unknown>
      if (typeof min === 'number' && Number.isSafeInteger(min) && min > 0
        && typeof max === 'number' && Number.isSafeInteger(max) && max >= min) model.reasoningBudget = { min, max }
    }
    if (typeof row.deprecated === 'boolean') model.deprecated = row.deprecated
    if (typeof row.configurationMissing === 'boolean') model.configurationMissing = row.configurationMissing
    if (validReleaseDate(row.releaseDate)) model.releaseDate = row.releaseDate
    const modalities = normalizeInputModalities(row.inputModalities)
    if (modalities !== undefined) model.inputModalities = modalities
    return model
  })
}

export function parseGoModelCatalog(value: unknown): GoModelCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid OpenCode Go model catalog')
  const catalog = value as Record<string, unknown>
  if (typeof catalog.stale !== 'boolean' || (catalog.error !== undefined && typeof catalog.error !== 'string')) {
    throw new Error('Invalid OpenCode Go model catalog status')
  }
  return {
    models: parseGoModels(catalog.models), stale: catalog.stale,
    ...(catalog.error === undefined ? {} : { error: catalog.error as string }),
    ...(catalog.sources === undefined ? {} : { sources: parseSources(catalog.sources) }),
  }
}

function parseSources(value: unknown): NonNullable<GoModelCatalog['sources']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OpenCode Go catalog sources')
  const sources = value as Record<string, unknown>
  const parse = (value: unknown): GoCatalogSourceStatus => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OpenCode Go catalog source status')
    const source = value as Record<string, unknown>
    if (source.updatedAt !== undefined && (typeof source.updatedAt !== 'number'
      || !Number.isSafeInteger(source.updatedAt) || source.updatedAt < 0 || source.updatedAt > 8_640_000_000_000_000)) {
      throw new Error('Invalid OpenCode Go catalog source timestamp')
    }
    if (source.error !== undefined && typeof source.error !== 'string') throw new Error('Invalid OpenCode Go catalog source error')
    if (source.warning !== undefined && typeof source.warning !== 'string') throw new Error('Invalid OpenCode Go catalog source warning')
    return {
      ...(source.updatedAt === undefined ? {} : { updatedAt: source.updatedAt as number }),
      ...(source.error === undefined ? {} : { error: source.error as string }),
      ...(source.warning === undefined ? {} : { warning: source.warning as string }),
    }
  }
  return { go: parse(sources.go), free: parse(sources.free) }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    opencodeGoModels: { read(): Promise<RemoteResult<GoModelCatalog>> }
  }
}

const codec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#GoModelCatalog',
  schema: { parse: parseGoModelCatalog }, create: () => ({ parse: parseGoModelCatalog }) }

export const modelsRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [{ id: 'dsh-opencode-go#opencodeGoModels/read', service: 'opencodeGoModels',
    namespace: 'opencodeGoModels', method: 'read', invocation: { kind: 'direct' }, parameters: [], result: codec }],
}

export interface UsageWindow {
  status: 'ok' | 'rate-limited'
  percent: number
  resetsAt: string
}

export interface GoUsage {
  /** Opaque Host identity for this endpoint/account; never a credential or its hash. */
  source?: string
  lastSwitch?: GoAccountSwitch
  rolling: UsageWindow
  weekly: UsageWindow
  monthly: UsageWindow
}

export function parseAccountSwitch(value: unknown): GoAccountSwitch {
  const notice = value as Partial<GoAccountSwitch> | null
  if (!notice || typeof notice.fromRef !== 'string' || typeof notice.toRef !== 'string'
    || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(notice.fromRef) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(notice.toRef)
    || (notice.reason !== 'quota' && notice.reason !== 'credential')
    || typeof notice.at !== 'number' || !Number.isSafeInteger(notice.at) || notice.at < 0
    || notice.at > 8_640_000_000_000_000) throw new Error('Invalid account switch notice')
  return { fromRef: notice.fromRef, toRef: notice.toRef, reason: notice.reason, at: notice.at }
}

/** Reject missing statistics rather than turning unavailable data into zero. */
export function parseGoUsage(value: unknown): GoUsage {
  if (!value || typeof value !== 'object') throw new Error('Invalid OpenCode Go usage response')
  const source = value as Record<string, unknown>
  const result = {} as GoUsage
  if (source.source !== undefined) {
    if (typeof source.source !== 'string' || source.source.length === 0 || source.source.length > 128) {
      throw new Error('Invalid OpenCode Go usage source')
    }
    result.source = source.source
  }
  if (source.lastSwitch !== undefined) {
    result.lastSwitch = parseAccountSwitch(source.lastSwitch)
  }
  for (const key of ['rolling', 'weekly', 'monthly'] as const) {
    const row = source[key] as Partial<UsageWindow> | undefined
    if (!row || (row.status !== 'ok' && row.status !== 'rate-limited')
      || typeof row.percent !== 'number' || !Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100
      || typeof row.resetsAt !== 'string' || !Number.isFinite(Date.parse(row.resetsAt))) {
      throw new Error('Invalid OpenCode Go usage response')
    }
    result[key] = { status: row.status, percent: row.percent, resetsAt: row.resetsAt }
  }
  return result
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'opencode-go/usage-unavailable': {
      readonly retryable: boolean
      readonly retainPrevious: boolean
      readonly source?: string
      readonly lastSwitch?: GoAccountSwitch
    }
  }
  interface TypertRemoteNamespaceMap {
    opencodeGoUsage: {
      read(): Promise<RemoteResult<GoUsage>>
      readAccount(ref: string): Promise<RemoteResult<GoUsage>>
    }
  }
}

// Shared host/client descriptors use the host's typed RPC codecs.
const usageCodec = {
  mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#GoUsage',
  schema: { parse: parseGoUsage }, create: () => ({ parse: parseGoUsage }),
}

const parseRef = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Invalid account reference')
  return value
}

const refCodec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#AccountRef',
  schema: { parse: parseRef }, create: () => ({ parse: parseRef }) }

export const usageRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [{
    id: 'dsh-opencode-go#opencodeGoUsage/read',
    service: 'opencodeGoUsage', namespace: 'opencodeGoUsage', method: 'read',
    invocation: { kind: 'direct' }, parameters: [],
    result: usageCodec,
  }, {
    id: 'dsh-opencode-go#opencodeGoUsage/readAccount',
    service: 'opencodeGoUsage', namespace: 'opencodeGoUsage', method: 'readAccount',
    invocation: { kind: 'direct' }, parameters: [{ name: 'ref', wire: 'ref', source: 'json', codec: refCodec }],
    result: usageCodec,
  }],
}

export type AccountCommand =
  | { kind: 'add'; id: string; name: string; key: string }
  | { kind: 'remove'; ref: string }
  | { kind: 'select'; ref: string }
  | { kind: 'rename'; ref: string; name: string }
  | { kind: 'replace-key'; ref: string; key: string }
  | { kind: 'move'; ref: string; toIndex: number }
  | { kind: 'auto-switch'; value: boolean }

export function parseAccountCommand(value: unknown): AccountCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid account command')
  const row = value as Record<string, unknown>
  const fields: Record<string, string[]> = {
    add: ['kind', 'id', 'name', 'key'], remove: ['kind', 'ref'], select: ['kind', 'ref'],
    rename: ['kind', 'ref', 'name'], 'replace-key': ['kind', 'ref', 'key'],
    move: ['kind', 'ref', 'toIndex'], 'auto-switch': ['kind', 'value'],
  }
  if (typeof row.kind !== 'string' || !Object.hasOwn(fields, row.kind)
    || Object.keys(row).some(key => !fields[row.kind as string]!.includes(key))
    || fields[row.kind]!.some(key => !Object.hasOwn(row, key))) throw new Error('Invalid account command')
  if ('ref' in row && (typeof row.ref !== 'string' || !ACCOUNT_REF_PATTERN.test(row.ref))) throw new Error('Invalid account reference')
  if ('name' in row && (typeof row.name !== 'string' || !row.name.trim() || row.name.trim().length > 80)) throw new Error('Invalid account name')
  if ('key' in row && (typeof row.key !== 'string' || !row.key.trim())) throw new Error('Missing account credential')
  if (row.kind === 'add' && (typeof row.id !== 'string' || !/^[a-f0-9]{32}$/.test(row.id))) throw new Error('Invalid account operation ID')
  if (row.kind === 'move' && (!Number.isInteger(row.toIndex) || (row.toIndex as number) < 0)) throw new Error('Invalid account position')
  if (row.kind === 'auto-switch' && typeof row.value !== 'boolean') throw new Error('Invalid account switch')
  return { ...row } as AccountCommand
}

function parseResult(value: unknown): SettingsWriteResult {
  if (value !== 'applied' && value !== 'rejected' && value !== 'unknown') throw new Error('Invalid account command result')
  return value
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    opencodeGoAccounts: { execute(command: AccountCommand): Promise<RemoteResult<SettingsWriteResult>> }
  }
}

const commandCodec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#AccountCommand',
  schema: { parse: parseAccountCommand }, create: () => ({ parse: parseAccountCommand }) }

const resultCodec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#AccountCommandResult',
  schema: { parse: parseResult }, create: () => ({ parse: parseResult }) }

export const accountsRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go', descriptors: [{ id: 'dsh-opencode-go#opencodeGoAccounts/execute',
    service: 'opencodeGoAccounts', namespace: 'opencodeGoAccounts', method: 'execute', invocation: { kind: 'direct' },
    parameters: [{ name: 'command', wire: 'command', source: 'json', codec: commandCodec }], result: resultCodec }],
}

export type SettingsWriteResult = 'applied' | 'rejected' | 'unknown'

export type AnalyticsRange = 'today' | '7d' | '30d' | '90d'

export interface AnalyticsQuery {
  accountRef: string
  range: AnalyticsRange
  refresh?: boolean
}

/** Exact nonnegative integers on the wire; one USD is 100,000,000 micro cents. */
export interface AnalyticsTotals {
  requests: string
  inputTokens: string
  outputTokens: string
  cacheReadTokens: string
  cacheWrite5mTokens: string
  cacheWrite1hTokens: string
  cacheWriteTokens: string
  tokens: string
  costMicroCents: string
}

export interface AnalyticsModelRow extends AnalyticsTotals { provider: string; model: string }

export interface AnalyticsDayRow extends AnalyticsTotals { day: string }

export interface AnalyticsReport {
  accountRef: string
  /** Opaque account, credential and network identity; contains no credential material. */
  source: string
  generatedAt: number
  period: AnalyticsRange
  range: { from: number; to: number }
  timeZone: 'UTC'
  totals: AnalyticsTotals
  byModel: AnalyticsModelRow[]
  byDay: AnalyticsDayRow[]
}

export interface AnalyticsExport { filename: string; csv: string }

export type AnalyticsFailureReason = 'invalid-query' | 'unknown-account' | 'missing-credential'
  | 'credential-unavailable' | 'unsupported-gateway' | 'invalid-proxy' | 'permission-denied'
  | 'upstream' | 'network' | 'timeout' | 'invalid-response'

const ANALYTICS_RANGES: readonly AnalyticsRange[] = ['today', '7d', '30d', '90d']

const ANALYTICS_TOTAL_FIELDS = ['requests', 'inputTokens', 'outputTokens', 'cacheReadTokens',
  'cacheWrite5mTokens', 'cacheWrite1hTokens', 'cacheWriteTokens', 'tokens', 'costMicroCents'] as const

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid analytics ' + field)
  return value as Record<string, unknown>
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) {
    throw new Error('Invalid analytics ' + field)
  }
  return value
}

function text(value: unknown, field: string, max = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Invalid analytics ' + field)
  }
  return value
}

/**
 * Validate one account-scoped official history query.
 * @param value - raw RPC argument.
 * @returns the validated query.
 */
export function parseAnalyticsQuery(value: unknown): AnalyticsQuery {
  const row = object(value, 'query')
  const accountRef = parseRef(row.accountRef)
  if (!ANALYTICS_RANGES.includes(row.range as AnalyticsRange)) throw new Error('Invalid analytics range')
  if (row.refresh !== undefined && typeof row.refresh !== 'boolean') throw new Error('Invalid analytics refresh')
  return { accountRef, range: row.range as AnalyticsRange, ...(row.refresh === undefined ? {} : { refresh: row.refresh }) }
}

function analyticsTotals(value: unknown): AnalyticsTotals {
  const row = object(value, 'totals')
  const totals = {} as AnalyticsTotals
  for (const field of ANALYTICS_TOTAL_FIELDS) {
    if (typeof row[field] !== 'string' || !/^(?:0|[1-9]\d*)$/.test(row[field] as string)) {
      throw new Error('Invalid analytics ' + field)
    }
    totals[field] = row[field] as string
  }
  return totals
}

/** Keep the browser wire response limited to validated aggregate fields. */
export function parseAnalyticsReport(value: unknown): AnalyticsReport {
  const row = object(value, 'report')
  const range = object(row.range, 'range')
  const from = integer(range.from, 'range.from'), to = integer(range.to, 'range.to')
  if (from > to || row.timeZone !== 'UTC' || !ANALYTICS_RANGES.includes(row.period as AnalyticsRange)
    || !Array.isArray(row.byModel) || !Array.isArray(row.byDay)) {
    throw new Error('Invalid analytics report')
  }
  return {
    accountRef: parseRef(row.accountRef), source: text(row.source, 'source'),
    generatedAt: integer(row.generatedAt, 'generatedAt'), period: row.period as AnalyticsRange,
    range: { from, to }, timeZone: 'UTC', totals: analyticsTotals(row.totals),
    byModel: row.byModel.map(value => {
      const model = object(value, 'model')
      return { provider: text(model.provider, 'provider', 1024), model: text(model.model, 'model', 1024), ...analyticsTotals(model) }
    }),
    byDay: row.byDay.map(value => {
      const day = object(value, 'day')
      if (!validReleaseDate(day.day)) throw new Error('Invalid analytics day')
      return { day: day.day, ...analyticsTotals(day) }
    }),
  }
}

export function parseAnalyticsExport(value: unknown): AnalyticsExport {
  const row = object(value, 'export')
  const filename = text(row.filename, 'filename', 256)
  if (!/^[A-Za-z0-9_.-]+\.csv$/.test(filename) || typeof row.csv !== 'string') throw new Error('Invalid analytics export')
  return { filename, csv: row.csv }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'opencode-go/analytics-unavailable': {
      readonly reason: AnalyticsFailureReason
      readonly retryable: boolean
      readonly retainPrevious?: boolean
      readonly source?: string
    }
  }
  interface TypertRemoteNamespaceMap {
    opencodeGoAnalytics: {
      read(query: AnalyticsQuery, signal?: AbortSignal): Promise<RemoteResult<AnalyticsReport>>
      exportCsv(query: AnalyticsQuery, signal?: AbortSignal): Promise<RemoteResult<AnalyticsExport>>
    }
  }
}

const queryCodec = {
  mode: 'strict' as const,
  typeSymbol: 'dsh-opencode-go#AnalyticsQuery',
  schema: { parse: parseAnalyticsQuery },
  create: () => ({ parse: parseAnalyticsQuery }),
}

const reportCodec = {
  mode: 'strict' as const,
  typeSymbol: 'dsh-opencode-go#AnalyticsReport',
  schema: { parse: parseAnalyticsReport },
  create: () => ({ parse: parseAnalyticsReport }),
}

const exportCodec = {
  mode: 'strict' as const,
  typeSymbol: 'dsh-opencode-go#AnalyticsExport',
  schema: { parse: parseAnalyticsExport },
  create: () => ({ parse: parseAnalyticsExport }),
}

/** The dashboard endpoint, mounted with the other plugin remotes. */
export const analyticsRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [{
    id: 'dsh-opencode-go#opencodeGoAnalytics/read',
    service: 'opencodeGoAnalytics',
    namespace: 'opencodeGoAnalytics',
    method: 'read',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'query', wire: 'query', source: 'json', codec: queryCodec }],
    cancellation: { parameter: 'signal' },
    result: reportCodec,
  }, {
    id: 'dsh-opencode-go#opencodeGoAnalytics/exportCsv',
    service: 'opencodeGoAnalytics', namespace: 'opencodeGoAnalytics', method: 'exportCsv',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'query', wire: 'query', source: 'json', codec: queryCodec }],
    cancellation: { parameter: 'signal' }, result: exportCodec,
  }],
}

/** A registry owns one contribution per package; mount all plugin endpoints together. */
export const goRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [...usageRemote.descriptors, ...modelsRemote.descriptors, ...accountsRemote.descriptors, ...analyticsRemote.descriptors],
}

/** Default image budgets, overridable through the adapter configuration. */
export const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024

export const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048

export const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024
