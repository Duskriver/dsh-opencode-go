import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { UsagePill } from './UsagePill.tsx'
import { sessionEventSource } from './session-cache.ts'
import type { OpencodeGoKey } from './locales.ts'

export function registerUsagePill(ctx: Context): void {
  ctx.inject(['modelDirectories', 'sessions', 'remote.session'], scope => {
    scope.inject(['remote.opencodeGoUsage'], ready => {
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
          sessionEvents: sessionEventSource(ready.get('sessions'), sessionId),
          readUsage,
          getLocale: () => ready.locale.getLocale().active,
          t: (key: string) => translate(key as OpencodeGoKey),
        }),
      }, UsagePill))
    })
  })
}
