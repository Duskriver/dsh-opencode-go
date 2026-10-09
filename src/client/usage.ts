import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { UsagePill } from './UsagePill.tsx'
import type { OpencodeGoKey } from './locales.ts'
import type { SettingsScope } from './settings.ts'
import type { OpencodeGoSettings } from './section-controller.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { accountsOf } from '../accounts.ts'

export function registerUsagePill(ctx: Context, settings: SettingsScope<OpencodeGoSettings>, selectAccount?: (ref: string) => Promise<boolean>): void {
  ctx.inject(['modelDirectories', 'sessions', 'remote.session'], scope => {
    scope.inject(['remote.opencodeGoUsage'], ready => {
      const credentialChanges = createSnapshotStore(0)
      ready.effect(() => ready.remote.$on('credentials/reference-updated', ref => {
        if (accountsOf(settings.getSnapshot().value ?? {}).some(account => account.apiKeyEnv === ref)) {
          credentialChanges.set(credentialChanges.getSnapshot() + 1)
        }
      }))
      const readUsage = async () => {
        const result = await ready.remote.opencodeGoUsage.read()
        if (!result.ok) throw result.error
        return result.value
      }
      const translate = ready.locale.bind('settings.opencode-go')
      ready.slots.inject('conversation.input.right', () => ready.slots.register({
        name: 'conversation.input.right', id: 'opencode-go-usage', order: 1000,
        inject: sessionId => ({
          directory: ready.modelDirectories.directoryFor(sessionId as SessionId).store,
          settings,
          credentialChanges,
          selectAccount: async ref => {
            const snapshot = settings.getSnapshot()
            if (!snapshot.writable || !accountsOf(snapshot.value ?? {}).some(account => account.apiKeyEnv === ref)) return false
            return selectAccount ? selectAccount(ref).catch(() => false) : false
          },
          readUsage,
          getLocale: () => ready.locale.getLocale().active,
          t: (key: string) => translate(key as OpencodeGoKey),
        }),
      }, UsagePill))
    })
  })
}
