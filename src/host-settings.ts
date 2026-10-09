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
    settingsCtx.settings.installSection(ctx, SETTINGS_NAMESPACE, PlainConfig, entry, {
      validate: validateGoConfig, setSource: options.setSource, onChange: options.onChange,
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
