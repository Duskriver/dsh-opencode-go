/** Browser registration for settings, conversation usage and sidebar quota. */
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { Context as ClientContext, Context } from '@deepseek-ai/cordis'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  PROFILE_ENTRY_ID,
  type GoUsage,
  type GoStatusReport,
  type AnalyticsQuery,
  type AnalyticsReport,
  type AnalyticsExport,
  goRemote,
  accountsOf,
} from '../contracts.ts'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import { OpencodeGoSection, type OpencodeGoSectionInjected } from './Section.tsx'
import {
  OpencodeGoSectionController,
  type OpencodeGoSettings,
  type ExecuteAccountCommand,
} from './controller.ts'
import { en, zh, type OpencodeGoKey } from './presentation.ts'
import { UsagePill, SidebarQuota, type UsagePillProps } from './UsagePill.tsx'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: { wide: boolean } }
  }

  interface LocaleNamespaceMap {
    /** The OpenCode Go settings page copy. */
    'settings.opencode-go': keyof typeof en
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.opencode-go'

export type { OpencodeGoSectionProps } from './Section.tsx'

export type { OpencodeGoSectionState, OpencodeGoSettings } from './controller.ts'

export { OPENCODE_GO_NS } from './controller.ts'

export type { OpencodeGoKey } from './presentation.ts'

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registration depends on each slot through `slots.inject()`.
 * `remote.llm` is the discovery namespace the page reads the model listing
 * through.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'remote.llm']

/**
 * Register the section once the `settings.section` declaration is on the
 * ledger, and keep the credential badge fresh on Host-reported key changes
 * written from any surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'llm-opencode-go: copy dictionaries')
  const modelsReady = ctx.remote.$mount(goRemote)
  ctx.effect(async () => await modelsReady)
  ctx.inject(['configForms', 'remote.opencodeGoModels'], child => {
    mountSettings(child, child.configForms.get<OpencodeGoSettings>(PROFILE_ENTRY_ID), modelsReady)
  })
}

function mountSettings(ctx: ClientContext, scope: ConfigForm<OpencodeGoSettings>, modelsReady: Promise<unknown>): void {
  const executeAccountCommand = accountCommands(ctx)
  registerUsagePill(ctx, scope, async ref => (await executeAccountCommand({ kind: 'select', ref })) === 'applied')
  let readAccount: ((ref: string) => Promise<GoUsage>) | undefined
  ctx.inject(['remote.opencodeGoUsage'], ready => {
    readAccount = async ref => {
      const result = await (ready as ClientContext).remote.opencodeGoUsage.readAccount(ref)
      if (!result.ok) throw result.error
      return result.value
    }
  })
  const controller = new OpencodeGoSectionController(scope, ctx, async () => {
    await modelsReady
    return ctx.remote.opencodeGoModels.read()
  }, async ref => {
    await modelsReady
    // A session without the usage namespace cannot read a quota; say so instead
    // of reaching for a context that never injected it.
    if (readAccount === undefined) throw new Error('OpenCode Go account usage is unavailable in this session')
    return readAccount(ref)
  }, executeAccountCommand)
  ctx.effect(() => () => controller.dispose())
  const t = ctx.locale.bind(NS) as OpencodeGoSectionInjected['t']
  const injected = (): OpencodeGoSectionInjected => ({ ...controller.inject(), t, getLocale: () => ctx.locale.getLocale().active })

  ctx.effect(() => {
    const refresh = (ref: string): void => { controller.refreshCredential(ref) }
    const dispose = ctx.remote.$on('credentials/reference-updated', refresh)
    /* v8 ignore next -- fiber teardown never runs in unit tests */
    return () => { dispose() }
  }, 'llm-opencode-go: pushed credential invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'opencode-go',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, OpencodeGoSection))
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

export function registerUsagePill(ctx: Context, settings: ConfigForm<OpencodeGoSettings>, selectAccount?: (ref: string) => Promise<boolean>): void {
  ctx.inject(['remote.opencodeGoUsage'], ready => {
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
    const readAccountUsage = async (ref: string) => {
      const result = await ready.remote.opencodeGoUsage.readAccount(ref)
      if (!result.ok) throw result.error
      return result.value
    }
    // Keep both quota placements available while analytics activates.
    // Cancellation is injected by the descriptor, outside the wire arguments.
    let analytics: ((query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>) | undefined
    let exportCsv: ((query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>) | undefined
    ready.inject(['remote.opencodeGoAnalytics'], withAnalytics => {
      analytics = async (query, signal) => {
        const result = await withAnalytics.remote.opencodeGoAnalytics.read(query, signal)
        if (!result.ok) throw result.error
        return result.value
      }
      exportCsv = async (query, signal) => {
        const result = await withAnalytics.remote.opencodeGoAnalytics.exportCsv(query, signal)
        if (!result.ok) throw result.error
        return result.value
      }
    })
    const readAnalytics = async (query: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsReport> => {
      if (analytics === undefined) throw Object.assign(new Error('OpenCode Go analytics is unavailable in this session'), {
        code: 'opencode-go/analytics-unavailable', details: { reason: 'unavailable', retryable: false },
      })
      return analytics(query, signal)
    }
    const exportAnalytics = async (query: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsExport> => {
      if (exportCsv === undefined) throw new Error('OpenCode Console export is unavailable in this session')
      return exportCsv(query, signal)
    }
    // The status feed is public, so its namespace activates independently of
    // credentials; until it does the pill simply omits the status block.
    let readStatus: (() => Promise<GoStatusReport>) | undefined
    ready.inject(['remote.opencodeGoStatus'], withStatus => {
      readStatus = async () => {
        const result = await withStatus.remote.opencodeGoStatus.read()
        if (!result.ok) throw result.error
        return result.value
      }
    })
    const translate = ready.locale.bind('settings.opencode-go')
    const usageProps = (): Omit<UsagePillProps, 'directory' | 'readStatus'> => ({
      settings,
      credentialChanges,
      selectAccount: async ref => {
        const snapshot = settings.getSnapshot()
        if (!snapshot.writable || !accountsOf(snapshot.value ?? {}).some(account => account.apiKeyEnv === ref)) return false
        return selectAccount ? selectAccount(ref).catch(() => false) : false
      },
      readUsage,
      readAccountUsage,
      readAnalytics,
      exportAnalytics,
      getLocale: () => ready.locale.getLocale().active,
      t: (key: string) => translate(key as OpencodeGoKey),
    })
    ready.slots.inject('sidebar.footer.action', () => ready.slots.register({
      name: 'sidebar.footer.action', id: 'opencode-go-sidebar-quota', order: 1000,
      inject: () => ({ ...usageProps(), readAccountUsage }),
    }, SidebarQuota))
    ready.inject(['modelDirectories', 'sessions', 'remote.session'], scope => {
      scope.slots.inject('conversation.input.right', () => scope.slots.register({
        name: 'conversation.input.right', id: 'opencode-go-usage', order: 1000,
        inject: sessionId => ({ ...usageProps(), readStatus, directory: scope.modelDirectories.directoryFor(sessionId as SessionId).store }),
      }, UsagePill))
    })
  })
}
