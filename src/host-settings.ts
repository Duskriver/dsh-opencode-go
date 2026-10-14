import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { PlainConfig, assertApiKeyEnv, assertBaseURL } from './config.ts'
import type { OpencodeGoConfig } from './config-contract.ts'
import { SETTINGS_NAMESPACE } from './config-contract.ts'
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
    if ('configure' in settingsCtx.settings) {
      const settings = settingsCtx.settings as unknown as {
        configure(policy: { auto: boolean }, owner: typeof ctx.fiber): () => void
      }
      settingsCtx.effect(() => {
        const dispose = settings.configure({ auto: false }, ctx.fiber)
        options.recover()
        return dispose
      })
      return
    }
    // Legacy providers persist raw user edits rather than schema transforms.
    // Rewrite their saved alias too; requests already use the migrated value.
    let migrating = false
    const migrateSavedGateway = (): void => {
      if (migrating || !settingsCtx.settings.writable) return
      migrating = true
      void (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const row = settingsCtx.settings.describe().find(row => row.ns === SETTINGS_NAMESPACE)
          const raw = (row?.user as { baseURL?: unknown } | undefined)?.baseURL
          if (typeof raw !== 'string' || migrateGatewayBaseURL(raw) === raw) return
          try {
            await settingsCtx.settings.mutate(SETTINGS_NAMESPACE,
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
      if (ns === SETTINGS_NAMESPACE) migrateSavedGateway()
    })
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, PlainConfig, entry, {
      validate: validateGoConfig, setSource: options.setSource,
      onChange: () => { options.onChange(); migrateSavedGateway() },
    })
    options.recover()
  })
  ctx.on('internal/config', function (_raw, next) {
    const value = next()
    if (this === ctx.fiber) {
      const raw = value as { apiKeyEnv?: unknown }
      if (typeof raw.apiKeyEnv === 'string') assertApiKeyEnv(raw.apiKeyEnv)
      validateGoConfig(PlainConfig(value))
    }
    return value
  })
}
