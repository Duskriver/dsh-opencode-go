/** Serialized account commands, primary selection and official quota reads. */
import {
  type SettingsWriteResult,
  PROFILE_ENTRY_ID,
  type GoAccountSwitch,
  ACCOUNT_REF_PREFIX,
  accountRefOf,
  accountsOf,
  MAX_ACCOUNTS,
  moveAccountFirst,
  type AccountSettings,
  type GoAccount,
  parseAccountCommand,
  type AccountCommand,
  parseGoUsage,
  type GoUsage,
  assertProxyURL,
} from './contracts.ts'
import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { GoAccountSettlement } from './adapter.ts'
import { type OpencodeGoConfig, assertBaseURL } from './config.ts'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { randomUUID } from 'node:crypto'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import {
  diagnosticURL,
  fetchJsonResponse,
  transportFailure,
  ProxyTransport,
  readUsageError,
} from './transport.ts'

export interface AccountSettingsWriter {
  describe(): readonly { ns: string; revision: number; value: unknown }[]
  mutate(ns: string, ops: readonly { op: 'set'; path: string[]; value: unknown }[], expectedRevision?: number): Promise<unknown>
}

/** Locate the profile entry that owns this mount's account metadata. */
export function accountSettingsRow(settings: AccountSettingsWriter) {
  const rows = settings.describe()
  return rows.find(row => row.ns === PROFILE_ENTRY_ID)
}

export interface AttemptOutcome {
  failure?: { code: string }
  emitted: boolean
  totalTokens: number
  aborted: boolean
  hasNext: boolean
}

/** Switching accounts must never replay output, charged work or model permission failures. */
export function accountFallback(outcome: AttemptOutcome): GoAccountSwitch['reason'] | undefined {
  if (outcome.emitted || outcome.totalTokens > 0 || outcome.aborted || !outcome.hasNext) return undefined
  switch (outcome.failure?.code) {
    case 'RATE_LIMIT':
    case 'QUOTA': return 'quota'
    case 'AUTH':
    case 'MISSING_CREDENTIAL':
    case 'INVALID_CREDENTIAL': return 'credential'
    default: return undefined
  }
}

/** Only credential, rate and quota failures cool down a key; PERMISSION_DENIED is model-scoped. */
export function isGatewayKeyRejection(failure: { code: string }): boolean {
  return ['INVALID_CREDENTIAL', 'AUTH', 'RATE_LIMIT', 'QUOTA'].includes(failure.code)
}

type AccountCredentials = Pick<CredentialProvider, 'describe' | 'resolve' | 'set' | 'unset'>

type Connection = { settings: AccountSettingsWriter; credentials: AccountCredentials }

function accountIdentity(config: OpencodeGoConfig): string {
  return JSON.stringify([config.enabled, accountRefOf(config), config.accounts, config.autoSwitch, config.baseURL, config.proxyURL, config.freeBaseURL])
}

function ownsAccountCredential(account: GoAccount): boolean {
  return /^[a-f0-9]{32}$/.test(account.id) && account.apiKeyEnv === ACCOUNT_REF_PREFIX + account.id.toUpperCase()
}

/** One mount serializes account edits, credential writes and fallback promotion in memory. */
export class GoAccountManager {
  private connection: Connection | undefined
  private queue: Promise<unknown> = Promise.resolve()
  private generation = 0
  private signature = ''
  private credentialGeneration = 0
  private settingsGeneration = 0
  private latestSeq = -1
  private notice: GoAccountSwitch | undefined

  constructor(
    private readonly config: () => OpencodeGoConfig,
    private readonly logger: { warn(message: string): void },
  ) {}

  connect(settings: AccountSettingsWriter, credentials: AccountCredentials): () => void {
    const connection = this.connection = { settings, credentials }
    this.signature = ''
    this.capture()
    return () => {
      if (this.connection !== connection) return
      this.connection = undefined
      this.signature = ''
      this.capture()
    }
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(work)
    // Keep the lane occupied until actual writes settle, even if the RPC caller leaves.
    this.queue = pending.catch(() => {})
    return pending
  }

  private read(connection: Connection) {
    if (this.connection !== connection) throw new Error('Account connection changed')
    const row = accountSettingsRow(connection.settings)
    if (!row) throw new Error('Account settings are unavailable')
    return { ...row, value: row.value as AccountSettings }
  }

  private async write(connection: Connection, patch: Partial<AccountSettings>): Promise<SettingsWriteResult> {
    const row = this.read(connection)
    await connection.settings.mutate(row.ns, Object.entries(patch).map(([field, value]) => ({ op: 'set' as const, path: [field], value })), row.revision)
    this.settingsGeneration++
    return 'applied'
  }

  execute(raw: AccountCommand): Promise<SettingsWriteResult> {
    const command = parseAccountCommand(raw)
    const connection = this.connection
    return this.enqueue(async () => {
      if (!connection || this.connection !== connection) return 'rejected'
      try { return await this.executeCommand(connection, command) }
      catch {
        this.logger.warn('llm-opencode-go: account command failed; reload settings and retry')
        return 'unknown'
      }
    })
  }

  private async executeCommand(connection: Connection, command: AccountCommand): Promise<SettingsWriteResult> {
    const { credentials } = connection
    let value = this.read(connection).value
    if (command.kind === 'auto-switch') return this.write(connection, { autoSwitch: command.value })
    if (command.kind === 'add') {
      const ref = ACCOUNT_REF_PREFIX + command.id.toUpperCase()
      if (value.accounts?.some(account => account.id === command.id && account.apiKeyEnv === ref)) return 'applied'
      const previousRef = accountRefOf(value)
      let accounts = [...accountsOf(value)]
      const configured = await Promise.all(accounts.map(account => credentials.describe(credentialRef(account.apiKeyEnv))))
      // The implicit environment reference remains usable for existing profiles.
      // Do not create an empty row for it when adding the first real account.
      if (value.accounts == null) accounts = accounts.filter((account, index) => account.name || configured[index]?.configured)
      if (accounts.length >= MAX_ACCOUNTS || accounts.some(account => account.id === command.id || account.apiKeyEnv === ref)) return 'rejected'
      await credentials.set(credentialRef(ref), command.key.trim())
      try {
        value = this.read(connection).value
        const retained = accountsOf(value).filter(account => value.accounts != null || account.name || accounts.some(saved => saved.apiKeyEnv === account.apiKeyEnv))
        if (retained.length >= MAX_ACCOUNTS || retained.some(account => account.id === command.id || account.apiKeyEnv === ref)) {
          throw new Error('Account list changed while storing the credential')
        }
        const added = { id: command.id, name: command.name.trim(), apiKeyEnv: ref }
        const selected = accountRefOf(value) === previousRef && configured.every(info => !info.configured) ? ref : accountRefOf(value)
        const next = [...moveAccountFirst([...retained, added], selected)]
        return await this.write(connection, { accounts: next, apiKeyEnv: next[0]!.apiKeyEnv })
      } catch (error) {
        // A refused metadata write must not leave the new secret behind.
        await credentials.unset(credentialRef(ref)).catch(() => {
          this.logger.warn('llm-opencode-go: could not clean up an unused account credential')
        })
        throw error
      }
    }
    const account = accountsOf(value).find(account => account.apiKeyEnv === command.ref)
    if (!account) return 'rejected'
    if (command.kind === 'replace-key') {
      const info = await credentials.describe(credentialRef(command.ref))
      if (!info.writable) return 'rejected'
      if (!accountsOf(this.read(connection).value).some(entry => entry.id === account.id && entry.apiKeyEnv === command.ref)) return 'rejected'
      await credentials.set(credentialRef(command.ref), command.key.trim())
      return 'applied'
    }
    if (command.kind === 'remove') {
      let previous: Awaited<ReturnType<AccountCredentials['resolve']>>
      if (ownsAccountCredential(account)) {
        const info = await credentials.describe(credentialRef(command.ref))
        if (info.configured && !info.writable) return 'rejected'
        previous = await credentials.resolve(credentialRef(command.ref))
        if (!accountsOf(this.read(connection).value).some(entry => entry.id === account.id && entry.apiKeyEnv === command.ref)) return 'rejected'
        if (info.configured) await credentials.unset(credentialRef(command.ref))
      }
      try {
        value = this.read(connection).value
        const accounts = accountsOf(value).filter(entry => entry.apiKeyEnv !== command.ref)
        return await this.write(connection, { accounts: [...accounts], apiKeyEnv: accounts[0]?.apiKeyEnv ?? accountRefOf(value) })
      } catch (error) {
        if (previous && this.connection === connection && accountsOf(this.read(connection).value).some(entry => entry.id === account.id && entry.apiKeyEnv === command.ref)) await credentials.set(credentialRef(command.ref), previous.value).catch(() => {
          this.logger.warn('llm-opencode-go: could not restore an account credential after a refused removal')
        })
        throw error
      }
    }
    const accounts = [...accountsOf(this.read(connection).value)]
    if (command.kind === 'rename') return this.write(connection, {
      accounts: accounts.map(account => account.apiKeyEnv === command.ref ? { ...account, name: command.name.trim() } : account),
    })
    if (command.kind === 'select') {
      const next = [...moveAccountFirst(accounts, command.ref)]
      return this.write(connection, { accounts: next, apiKeyEnv: command.ref })
    }
    const from = accounts.findIndex(account => account.apiKeyEnv === command.ref)
    if (from < 0 || command.toIndex >= accounts.length) return 'rejected'
    if (from === command.toIndex) return 'applied'
    const [moved] = accounts.splice(from, 1)
    accounts.splice(command.toIndex, 0, moved!)
    return this.write(connection, { accounts, apiKeyEnv: accounts[0]!.apiKeyEnv })
  }

  /**
   * The Host announces every revision of this profile entry, including edits
   * made outside this manager (forms, native config, `A -> C -> A` round
   * trips). Counting them keeps `capture()` free of `settings.describe()`,
   * which deep-clones every namespace, on request and usage-poll hot paths.
   */
  settingsChanged(): void { this.settingsGeneration++ }

  /** A freshness fence prevents an old request from overriding a later user choice. */
  capture(): number {
    const signature = JSON.stringify([accountIdentity(this.config()), this.credentialGeneration, this.settingsGeneration])
    if (signature !== this.signature) {
      this.signature = signature
      this.generation++
      this.notice = undefined
    }
    return this.generation
  }

  credentialChanged(): void { this.credentialGeneration++; this.capture() }
  lastSwitch(): GoAccountSwitch | undefined { this.capture(); return this.notice }

  settle(event: GoAccountSettlement): void {
    if (event.generation !== this.capture() || event.seq < this.latestSeq) return
    if (accountIdentity(this.config()) !== accountIdentity(event.config)
      || !accountsOf(this.config()).some(account => account.apiKeyEnv === event.ref)) return
    this.latestSeq = event.seq
    this.notice = event.notice
    if (!event.notice || !event.config.enabled || !event.config.autoSwitch) return
    void this.enqueue(async () => {
      const connection = this.connection
      if (!connection || event.generation !== this.capture() || event.seq !== this.latestSeq) return
      try {
        const accounts = [...moveAccountFirst(accountsOf(this.read(connection).value), event.ref)]
        await this.write(connection, { accounts, apiKeyEnv: event.ref })
        this.capture()
        if (this.connection === connection && event.seq === this.latestSeq && accountRefOf(this.config()) === event.ref) this.notice = event.notice
      } catch {
        this.logger.warn(`llm-opencode-go: could not make "${event.ref}" the current account`)
      }
    })
  }
}

/** The browser sends commands; the host owns credentials and metadata writes. */
export class GoAccountsService extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: { manager: GoAccountManager }) {
    super(ctx, 'opencodeGoAccounts')
  }

  execute(command: AccountCommand) {
    return this.options.manager.execute(command)
  }
}

const USAGE_MAX_BYTES = 1024 * 1024

interface UsageOptions {
  baseURL: () => string
  proxyURL?: () => string
  transport?: ProxyTransport
  resolveApiKey: (ref?: string) => Promise<string | undefined>
  activeRef?: () => string
  accountRefs?: () => readonly string[]
  lastSwitch?: () => GoAccountSwitch | undefined
}

/** Account statistics are fetched on the Host; credentials never enter the browser. */
export class GoUsageService extends TypertRemoteService {
  private readonly identities = new Map<string, { baseURL: string; proxyURL: string; key: string; source: string }>()
  private readonly pending = new Map<string, Promise<GoUsage>>()
  private readonly transport: ProxyTransport

  constructor(ctx: Context, private readonly options: UsageOptions) {
    super(ctx, 'opencodeGoUsage')
    this.transport = options.transport ?? new ProxyTransport()
    if (!options.transport) ctx.effect(() => () => this.transport.dispose())
  }

  async read(): Promise<GoUsage> {
    try {
      const usage = await this.readRef(this.options.activeRef?.())
      const lastSwitch = this.options.lastSwitch?.()
      return lastSwitch ? { ...usage, lastSwitch } : usage
    } catch (error) {
      const lastSwitch = this.options.lastSwitch?.()
      if (lastSwitch && error instanceof RemoteError && error.code === 'opencode-go/usage-unavailable') {
        throw new RemoteError('opencode-go/usage-unavailable', error.message,
          { ...error.details as { retryable: boolean; retainPrevious: boolean; source?: string }, lastSwitch }, { cause: error })
      }
      throw error
    }
  }

  async readAccount(ref: string): Promise<GoUsage> {
    if (!this.options.accountRefs?.().includes(ref)) {
      throw new RemoteError('gateway/bad-request', 'Unknown OpenCode Go account', {})
    }
    return this.readRef(ref)
  }

  private async readRef(ref?: string): Promise<GoUsage> {
    const identityKey = ref ?? ''
    // Retire removed accounts, including their secret-bearing identity records.
    const refs = this.options.accountRefs?.()
    if (refs) for (const saved of this.identities.keys()) {
      if (saved && !refs.includes(saved)) this.identities.delete(saved)
    }
    const baseURL = assertBaseURL(this.options.baseURL()).replace(/\/$/, '')
    const proxyURL = assertProxyURL(this.options.proxyURL?.())
    let key: string | undefined
    try {
      key = await this.options.resolveApiKey(ref)
    } catch (error: unknown) {
      this.identities.delete(identityKey)
      const missing = error instanceof Error && 'code' in error && error.code === 'MISSING_CREDENTIAL'
      throw new RemoteError('opencode-go/usage-unavailable', missing
        ? 'OpenCode Go API key is not configured' : 'Could not resolve the OpenCode Go API key', {
        retryable: !missing, retainPrevious: false,
      }, { cause: error })
    }
    if (!key) {
      this.identities.delete(identityKey)
      throw new RemoteError('opencode-go/usage-unavailable', 'OpenCode Go API key is not configured', {
        retryable: false, retainPrevious: false,
      })
    }
    let identity = this.identities.get(identityKey)
    if (identity?.baseURL !== baseURL || identity.proxyURL !== proxyURL || identity.key !== key) {
      identity = { baseURL, proxyURL, key, source: randomUUID() }
      this.identities.set(identityKey, identity)
    }
    const { source } = identity
    const shared = this.pending.get(source)
    if (shared) return shared
    const pending = this.fetchUsage(baseURL, key, source, proxyURL, this.transport.forProxy(proxyURL))
    this.pending.set(source, pending)
    try { return await pending } finally { this.pending.delete(source) }
  }

  private async fetchUsage(baseURL: string, key: string, source: string, proxyURL: string, fetcher?: typeof globalThis.fetch): Promise<GoUsage> {
    const endpoint = diagnosticURL(`${baseURL}/usage`)
    const signal = AbortSignal.timeout(10_000)
    let result: Awaited<ReturnType<typeof fetchJsonResponse>>
    try {
      result = await fetchJsonResponse(`${baseURL}/usage`, {
        headers: { ...attributionHeaders(), Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal,
        redirect: 'error',
      }, USAGE_MAX_BYTES, 'identity', fetcher,
      response => readUsageError(response, { apiKey: key, baseURL, proxyURL, signal }))
    } catch (error: unknown) {
      const invalid = error instanceof SyntaxError || error instanceof RangeError
      const detail = error instanceof SyntaxError ? 'invalid JSON response'
        : error instanceof RangeError ? `response exceeds the ${USAGE_MAX_BYTES} byte limit`
          : transportFailure(error)
      throw new RemoteError('opencode-go/usage-unavailable', `Could not read ${endpoint}: ${detail}`, {
        retryable: true, retainPrevious: !invalid, source,
      }, { cause: error })
    }
    const { response, body } = result
    if (!response.ok) {
      const temporary = response.status === 408 || response.status === 429 || response.status >= 500
      const hint = response.status === 403 ? '. Check your API key and Go subscription permissions.' : ''
      const reason = typeof body === 'string' && body ? ` Upstream: ${body}` : ''
      throw new RemoteError('opencode-go/usage-unavailable', `OpenCode Go usage unavailable (HTTP ${response.status})${hint}${reason}`, {
        retryable: temporary, retainPrevious: temporary, source,
      })
    }
    try {
      const usage = parseGoUsage(body && typeof body === 'object' ? (body as { usage?: unknown }).usage : undefined)
      return { ...usage, source }
    } catch (error: unknown) {
      throw new RemoteError('opencode-go/usage-unavailable', 'Invalid OpenCode Go usage response', {
        retryable: true, retainPrevious: false, source,
      }, { cause: error })
    }
  }
}
