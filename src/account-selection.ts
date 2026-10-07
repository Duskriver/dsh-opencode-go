import type { GoAccountSettlement } from './adapter.ts'
import { accountRefOf, accountsOf, type GoAccountSwitch } from './accounts.ts'
import type { OpencodeGoConfig } from './config.ts'

/** The common write interface of legacy sections and profile settings forms. */
export interface AccountSettingsWriter {
  describe(): readonly { ns: string; revision: number; value: unknown }[]
  mutate(ns: string, ops: readonly { op: 'set'; path: string[]; value: unknown }[], expectedRevision?: number): Promise<unknown>
}

function identity(config: OpencodeGoConfig): string {
  return JSON.stringify([config.enabled, accountRefOf(config), config.accounts, config.autoSwitch, config.baseURL, config.proxyURL])
}

/** Owns both the fallback notice and its optional persisted account selection. */
export class GoAccountSelection {
  private settings: AccountSettingsWriter | undefined
  private connection = 0
  private credentials = 0
  private version = 0
  private signature = ''
  private latestSeq = -1
  private notice: GoAccountSwitch | undefined

  constructor(
    private readonly config: () => OpencodeGoConfig,
    private readonly logger: { debug(message: string): void; warn(message: string): void },
  ) {}

  connect(settings: AccountSettingsWriter): () => void {
    this.settings = settings
    this.connection++
    this.capture()
    return () => {
      if (this.settings !== settings) return
      this.settings = undefined
      this.connection++
      this.capture()
    }
  }

  private row() {
    try {
      const rows = this.settings?.describe() ?? []
      return rows.find(row => row.ns === 'opencode-go') ?? rows.find(row => row.ns === 'llm-opencode-go')
    } catch { return undefined }
  }

  /** Reading the revision also catches A → C → A before async change watchers run. */
  capture(): number {
    const row = this.row()
    const signature = JSON.stringify([identity(this.config()), this.connection, this.credentials, row?.ns, row?.revision])
    if (signature !== this.signature) {
      this.signature = signature
      this.version++
      this.notice = undefined
    }
    return this.version
  }

  credentialChanged(): void {
    this.credentials++
    this.capture()
  }

  lastSwitch(): GoAccountSwitch | undefined {
    this.capture()
    return this.notice
  }

  /** One freshness decision governs both side effects of a request's outcome. */
  settle(event: GoAccountSettlement): void {
    if (event.generation !== this.capture() || event.seq < this.latestSeq) return
    const config = this.config()
    if (identity(config) !== identity(event.config)
      || !accountsOf(config).some(account => account.apiKeyEnv === event.ref)) return
    this.latestSeq = event.seq
    this.notice = event.notice
    if (event.notice && config.enabled && config.autoSwitch) void this.adopt(event)
  }

  private async adopt(event: GoAccountSettlement): Promise<void> {
    const settings = this.settings
    if (!settings) return
    const connection = this.connection
    const credentials = this.credentials
    try {
      const row = this.row()
      if (!row) {
        this.logger.debug('llm-opencode-go: no editable account settings row; the fallback stays per request')
        return
      }
      const selected = (row.value as { apiKeyEnv?: unknown } | undefined)?.apiKeyEnv
      // describe() may itself publish settings events. Recheck immediately
      // before the revision-guarded write, including the stored selection.
      if (event.generation !== this.capture() || event.seq !== this.latestSeq
        || selected !== accountRefOf(event.config)) return
      const expected = identity({ ...event.config, apiKeyEnv: event.ref })
      const result = await settings.mutate(row.ns, [{ op: 'set', path: ['apiKeyEnv'], value: event.ref }], row.revision)
      // A committed selection invalidates in-flight requests like any settings
      // edit. Restore its notice only after confirming this exact write. No
      // pending reference can leak from a refused write into a later user edit.
      this.capture()
      const committed = this.row()
      if (result !== false && this.connection === connection && this.credentials === credentials
        && event.seq === this.latestSeq && committed?.ns === row.ns && committed.revision === row.revision + 1
        && identity(this.config()) === expected) this.notice = event.notice
    } catch (error: unknown) {
      this.logger.warn(`llm-opencode-go: could not make "${event.ref}" the current account (${String(error)})`)
    }
  }
}
