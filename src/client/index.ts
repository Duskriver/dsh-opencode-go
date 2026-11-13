/** Browser registration for settings, the sidebar page, conversation usage and quota. */
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { Context as ClientContext, Context } from '@deepseek-ai/cordis'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  PROFILE_ENTRY_ID,
  type GoUsage,
  type AnalyticsQuery,
  type AnalyticsReport,
  type AnalyticsExport,
  goRemote,
  accountsOf,
} from '../contracts.ts'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import { OpencodeGoSection, type OpencodeGoSectionInjected } from './Section.tsx'
import { GoRowIcon } from './GoMark.tsx'
import { GoPage } from './pages/Page.tsx'
import { setPageTab } from './pages/nav.ts'
import type { PageInjected, PageReaders, PageTab } from './pages/types.ts'
import { PAGE_PANEL_ID, PAGE_SIDEBAR_ORDER, type GoLayoutService } from './host-slots.ts'
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
    /** The OpenCode Go settings page and console page copy. */
    'settings.opencode-go': keyof typeof en
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.opencode-go'

export type { OpencodeGoSectionProps } from './Section.tsx'

export type { OpencodeGoSectionState, OpencodeGoSettings } from './controller.ts'

export { OPENCODE_GO_NS } from './controller.ts'

export type { OpencodeGoKey } from './presentation.ts'

export { PAGE_PANEL_ID, PAGE_SIDEBAR_ORDER } from './host-slots.ts'

export type { PageTab } from './pages/types.ts'

/** Re-exported so the host page id and the navigation helper stay discoverable. */
export { setPageTab } from './pages/nav.ts'

/**
 * Required top-level services (cordis fiber inject): the slot ledger, the locale
 * registry, the remote transport and the credential describe namespace. The
 * settings/model/analytics namespaces, \`layout\` and \`configForms\` are mounted
 * later with their own \`ctx.inject\` waits, and every target slot is reached
 * through \`slots.inject()\`, whose declaration order relative to this one is not
 * constrained.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials']

/**
 * Register the settings section and the console page once their slots are on
 * the ledger, and keep the credential badge fresh on Host-reported key changes
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
  // One reader set feeds every surface: the composer pill, the sidebar quota
  // card and the console page must agree on definitions and error shapes.
  const readers = createPageReaders(ctx)
  // The layout service arrives with the shell plugin; the page's navigation is
  // a no-op until it does (and on hosts that never compose a sidebar).
  let layout: GoLayoutService | undefined
  ctx.inject(['layout'], child => { layout = (child as unknown as { layout: GoLayoutService }).layout })
  ctx.effect(() => () => { layout = undefined }, 'llm-opencode-go: layout release')
  const openPage = (tab: PageTab = 'overview'): void => {
    setPageTab(tab)
    try {
      layout?.selectPanel(PAGE_PANEL_ID)
    } catch {
      // The host rejects ids that are not registered yet (for example while the
      // page's slot is still declaring). The tab choice is kept for the next open.
    }
  }
  const selectAccount = async (ref: string): Promise<boolean> =>
    (await executeAccountCommand({ kind: 'select', ref })) === 'applied'
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
  const localeOf = (): string => ctx.locale.getLocale().active
  // The page's own slot face always offers navigation: it only mounts while the
  // host already shows the page.
  const pageInjected = (): PageInjected => ({ ...controller.inject(), t, getLocale: localeOf, readers, openPage })
  // The settings dialog keeps its full section; the extra openPage seat lets it
  // hand the user to the console page without coupling Section to the layout.
  // It is only offered while the opt-in sidebar entry is registered, so the
  // button and every other shortcut disappear together with the entry.
  let pageRegistered: () => boolean = () => false
  const injected = (): OpencodeGoSectionInjected => ({
    ...controller.inject(), t, getLocale: localeOf,
    ...(pageRegistered() ? { openPage } : {}),
  })
  pageRegistered = registerSidebarPage(ctx, pageInjected, () => layout, scope)
  registerUsagePill(ctx, scope, selectAccount, readers, openPage, pageRegistered)

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

/**
 * Bind the usage/analytics readers once for every surface. A missing namespace
 * leaves the matching reader undefined, so the page and the pill degrade to
 * their own unavailable notices instead of failing registration.
 * @param ctx - client root context.
 * @returns the mutable reader set (filled when the namespaces mount).
 */
function createPageReaders(ctx: ClientContext): PageReaders {
  const readers: PageReaders = {}
  ctx.inject(['remote.opencodeGoUsage'], usageScope => {
    const remote = (usageScope as ClientContext).remote
    readers.readUsage = async () => {
      const result = await remote.opencodeGoUsage.read()
      if (!result.ok) throw result.error
      return result.value
    }
    readers.readAccountUsage = async (ref: string) => {
      const result = await remote.opencodeGoUsage.readAccount(ref)
      if (!result.ok) throw result.error
      return result.value
    }
    usageScope.inject(['remote.opencodeGoAnalytics'], analyticsScope => {
      readers.readAnalytics = async (query: AnalyticsQuery, signal?: AbortSignal) => {
        const result = await (analyticsScope as ClientContext).remote.opencodeGoAnalytics.read(query, signal)
        if (!result.ok) throw result.error
        return result.value
      }
      readers.exportAnalytics = async (query: AnalyticsQuery, signal?: AbortSignal) => {
        const result = await (analyticsScope as ClientContext).remote.opencodeGoAnalytics.exportCsv(query, signal)
        if (!result.ok) throw result.error
        return result.value
      }
    })
  })
  return readers
}

/**
 * Keep the sidebar row and its main panel registered as one pair, and only
 * while the opt-in `sidebarEntry` setting asks for them and the host declares
 * the list slot. The host owns the click, the label, the active state and the
 * column geometry; this function publishes the two halves under one id and
 * removes them together.
 * @param ctx - client root context.
 * @param pageInjected - injected face for the page slot (rebuilt per entry render).
 * @param readLayout - current layout service, or undefined before it mounts.
 * @param readSettings - the profile form that owns the opt-in setting.
 * @returns whether the pair is registered right now (read at click time).
 */
function registerSidebarPage(
  ctx: ClientContext,
  pageInjected: () => PageInjected,
  readLayout: () => GoLayoutService | undefined,
  readSettings: ConfigForm<OpencodeGoSettings>,
): () => boolean {
  const t = ctx.locale.bind(NS) as OpencodeGoSectionInjected['t']
  let slotReady = false
  let disposePair: (() => void) | undefined
  const teardown = (): void => {
    const dispose = disposePair
    disposePair = undefined
    if (dispose !== undefined) dispose()
  }
  // `slotReady` and the setting are two independent gates: the host may declare
  // the list slot at any time, and the reader may flip the switch at any time.
  // Either one going away withdraws the pair.
  const sync = (): void => {
    if (readSettings.getSnapshot().value?.sidebarEntry !== true) { teardown(); return }
    if (!slotReady || disposePair !== undefined) return
    const disposeMain = ctx.slots.register({
      name: 'main',
      key: PAGE_PANEL_ID,
      locale: NS,
      inject: pageInjected,
    }, GoPage)
    const disposeRow = ctx.slots.register({
      name: 'sidebar.panellist',
      id: PAGE_PANEL_ID,
      order: PAGE_SIDEBAR_ORDER,
      label: () => t('navLabel'),
      locale: NS,
    }, GoRowIcon)
    disposePair = () => {
      // Leave the page before its panel goes: a selection pointing at a key
      // that no longer exists would strand the central column on nothing.
      try {
        const current = readLayout()
        if (current?.panelInfo.getSnapshot().activePanelId === PAGE_PANEL_ID) current.selectPanel(null)
      } catch {
        // The panel may already be gone with the host column.
      }
      if (typeof disposeRow === 'function') disposeRow()
      if (typeof disposeMain === 'function') disposeMain()
    }
  }
  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => {
    slotReady = true
    sync()
    return () => { slotReady = false; teardown() }
  }), 'llm-opencode-go: sidebar page slot')
  ctx.effect(() => {
    const unsubscribe = readSettings.subscribe(sync)
    sync()
    return () => { unsubscribe(); teardown() }
  }, 'llm-opencode-go: sidebar page opt-in')
  return () => disposePair !== undefined
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

/**
 * @param ctx - client root context.
 * @param settings - the profile ConfigForm backing every account surface.
 * @param selectAccount - switch the profile's preferred account.
 * @param readers - shared usage/analytics readers (page and pill share one set).
 * @param openPage - open the console page, or undefined on hosts without it.
 * @param canOpenPage - whether the opt-in console page is registered right now;
 * read at click time so withdrawing the entry restores the in-place dialog.
 */
export function registerUsagePill(
  ctx: Context,
  settings: ConfigForm<OpencodeGoSettings>,
  selectAccount?: (ref: string) => Promise<boolean>,
  readers?: PageReaders,
  openPage?: (tab?: PageTab) => void,
  canOpenPage: () => boolean = () => false,
): void {
  ctx.inject(['remote.opencodeGoUsage'], ready => {
    const credentialChanges = createSnapshotStore(0)
    ready.effect(() => ready.remote.$on('credentials/reference-updated', ref => {
      if (accountsOf(settings.getSnapshot().value ?? {}).some(account => account.apiKeyEnv === ref)) {
        credentialChanges.set(credentialChanges.getSnapshot() + 1)
      }
    }))
    // Fallbacks keep the pill and the quota card working even if the shared
    // reader set has not bound yet (the two inject callbacks race on hosts that
    // declare the namespace late).
    const fallbackUsage = async (): Promise<GoUsage> => {
      const result = await (ready as ClientContext).remote.opencodeGoUsage.read()
      if (!result.ok) throw result.error
      return result.value
    }
    const fallbackAccountUsage = async (ref: string): Promise<GoUsage> => {
      const result = await (ready as ClientContext).remote.opencodeGoUsage.readAccount(ref)
      if (!result.ok) throw result.error
      return result.value
    }
    const readAccountUsage = readers?.readAccountUsage ?? fallbackAccountUsage
    const unavailableAnalytics = async (): Promise<AnalyticsReport> => {
      throw Object.assign(new Error('OpenCode Go analytics is unavailable in this session'), {
        code: 'opencode-go/analytics-unavailable', details: { reason: 'unavailable', retryable: false },
      })
    }
    const unavailableExport = async (): Promise<AnalyticsExport> => {
      throw new Error('OpenCode Console export is unavailable in this session')
    }
    const translate = ready.locale.bind('settings.opencode-go')
    const usageProps = (): Omit<UsagePillProps, 'directory'> => ({
      settings,
      credentialChanges,
      selectAccount: async ref => {
        const snapshot = settings.getSnapshot()
        if (!snapshot.writable || !accountsOf(snapshot.value ?? {}).some(account => account.apiKeyEnv === ref)) return false
        return selectAccount ? selectAccount(ref).catch(() => false) : false
      },
      readUsage: readers?.readUsage ?? fallbackUsage,
      readAccountUsage,
      readAnalytics: readers?.readAnalytics ?? unavailableAnalytics,
      exportAnalytics: readers?.exportAnalytics ?? unavailableExport,
      // The page may have been withdrawn since this face was built: report the
      // miss so the pill falls back to its own dialog instead of doing nothing.
      ...(openPage ? {
        openUsagePage: (): boolean => {
          if (!canOpenPage()) return false
          openPage('usage')
          return true
        },
      } : {}),
      getLocale: () => ready.locale.getLocale().active,
      t: (key: string) => translate(key as OpencodeGoKey),
    })
    ready.slots.inject('sidebar.footer.action', () => ready.slots.register({
      name: 'sidebar.footer.action', id: 'opencode-go-sidebar-quota', order: 1000,
      inject: () => ({ ...usageProps(), readAccountUsage }),
    }, SidebarQuota))
    // The session id and the composer slot contract are already available at
    // registration; only the model-directory service is read from this scope.
    ready.inject(['modelDirectories'], scope => {
      scope.slots.inject('conversation.input.right', () => scope.slots.register({
        name: 'conversation.input.right', id: 'opencode-go-usage', order: 1000,
        inject: sessionId => ({ ...usageProps(), directory: scope.modelDirectories.directoryFor(sessionId as SessionId).store }),
      }, UsagePill))
    })
  })
}
