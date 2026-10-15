import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { PlainConfig, assertApiKeyEnv, assertBaseURL } from './config.ts'
import type { OpencodeGoConfig } from './config-contract.ts'
import { PROFILE_ENTRY_ID, SETTINGS_NAMESPACE } from './config-contract.ts'
import { assertProxyURL } from './proxy-url.ts'
import { assertAccounts } from './accounts.ts'
import { assertAccountOperations } from './account-operations.ts'
import { assertProtocolOverrides } from './protocol-contract.ts'
import type { AccountSettingsWriter } from './settings-bridge.ts'
import { isSettingsConflict } from './settings-bridge.ts'
import { migrateGatewayBaseURL } from './gateway-url.ts'

export function validateGoConfig(value: OpencodeGoConfig): void {
  assertBaseURL(value.baseURL)
  assertProxyURL(value.proxyURL)
  assertApiKeyEnv(value.apiKeyEnv)
  assertAccounts(value.accounts, value.apiKeyEnv)
  assertAccountOperations(value.accountOperations)
  assertProtocolOverrides(value.protocolOverrides)
}

/** Version-specific settings attachment and validation stay at the host boundary. */
export function installHostSettings(ctx: Context, entry: OpencodeGoConfig, options: {
  connect: (settings: AccountSettingsWriter) => () => void
  setSource: (source: () => OpencodeGoConfig) => void
  onChange: () => void
  recover: () => void
}): void {
  ctx.inject(['settings'], settingsCtx => {
    settingsCtx.effect(() => options.connect(settingsCtx.settings as unknown as AccountSettingsWriter))
    const modern = 'configure' in settingsCtx.settings
    const namespace = modern ? PROFILE_ENTRY_ID : SETTINGS_NAMESPACE
    // Migrate persisted aliases on the Host; settings schemas must remain
    // serializable through both generations of the desktop settings service.
    let migrating = false
    const migrateSavedGateway = (): void => {
      if (migrating || !settingsCtx.settings.writable) return
      migrating = true
      void (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const row = settingsCtx.settings.describe().find(row => row.ns === namespace)
          const raw = (row?.user as { baseURL?: unknown } | undefined)?.baseURL
          if (typeof raw !== 'string' || migrateGatewayBaseURL(raw) === raw) return
          try {
            await settingsCtx.settings.mutate(namespace,
              [{ op: 'set', path: ['baseURL'], value: migrateGatewayBaseURL(raw) }], row!.revision)
            return
          } catch (error) {
            if (!isSettingsConflict(error) || attempt === 2) throw error
          }
        }
      })().catch((error: unknown) => {
        ctx.logger.warn(`llm-opencode-go: could not save the migrated gateway address (${String(error)})`)
      }).finally(() => { migrating = false })
    }
    settingsCtx.on('settings/document-updated', (ns: string) => {
      if (ns === namespace) migrateSavedGateway()
    })
    if (modern) {
      const settings = settingsCtx.settings as unknown as {
        configure(policy: { auto: boolean }, owner: typeof ctx.fiber): () => void
      }
      settingsCtx.effect(() => {
        const dispose = settings.configure({ auto: false }, ctx.fiber)
        options.recover()
        migrateSavedGateway()
        return dispose
      })
      return
    }
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, PlainConfig, entry, {
      validate: validateGoConfig,
      setSource: source => options.setSource(() => {
        const value = source()
        return { ...value, baseURL: migrateGatewayBaseURL(value.baseURL) }
      }),
      onChange: () => { options.onChange(); migrateSavedGateway() },
    })
    options.recover()
  })
  ctx.on('internal/config', function (_raw, next) {
    const value = next()
    if (this === ctx.fiber) {
      const raw = value as { apiKeyEnv?: unknown; baseURL?: unknown }
      if (typeof raw.apiKeyEnv === 'string') assertApiKeyEnv(raw.apiKeyEnv)
      validateGoConfig(PlainConfig(value))
      // The profile editor persists this validated result. Canonicalize before
      // its schema parse so a live write saves the current gateway address.
      if (typeof raw.baseURL === 'string') return { ...value, baseURL: migrateGatewayBaseURL(raw.baseURL) }
    }
    return value
  })
}
