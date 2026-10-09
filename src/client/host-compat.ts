import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { PROFILE_ENTRY_ID, SETTINGS_NAMESPACE, type OpencodeGoSettings } from '../config-contract.ts'
import type { SettingsScope } from './settings.ts'
import type { ExecuteAccountCommand } from './accounts-controller.ts'

/** Only the boundary knows whether the host exposes profile forms or legacy scopes. */
export function mountSettingsScopes(ctx: Context, mount: (ctx: Context, scope: SettingsScope<OpencodeGoSettings>) => void): void {
  ctx.inject(['configForms', 'remote.opencodeGoModels'], child => {
    const forms = child.get('configForms') as { get<T>(id: string): SettingsScope<T> }
    mount(child, forms.get<OpencodeGoSettings>(PROFILE_ENTRY_ID))
  })
  ctx.inject(['settingsScope', 'remote.opencodeGoModels'], child => {
    mount(child, child.settingsScope.bind({ namespace: SETTINGS_NAMESPACE,
      decode: (section): OpencodeGoSettings | undefined =>
        typeof section === 'object' && section !== null ? section as OpencodeGoSettings : undefined,
    }))
  })
}

export function accountCommands(ctx: Context): ExecuteAccountCommand {
  const unavailable: ExecuteAccountCommand = async () => 'unknown'
  let execute = unavailable
  ctx.inject(['remote.opencodeGoAccounts'], ready => {
    ready.effect(() => {
      const connected: ExecuteAccountCommand = async command => {
        const result = await ready.remote.opencodeGoAccounts.execute(command)
        return result.ok ? result.value : 'unknown'
      }
      execute = connected
      return () => { if (execute === connected) execute = unavailable }
    })
  })
  return command => execute(command)
}
