/** Conversation and sidebar quota indicators, account selection and analytics. */
import css from './UsagePill.module.css'
import { Fragment, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import {
  parseAccountSwitch,
  type GoUsage,
  type UsageWindow,
  PROVIDER_ID,
  DEFAULT_USAGE_DISPLAY,
  DEFAULT_USAGE_PILL_STYLE,
  DEFAULT_OPENCODE_GO_THEME,
  type OpencodeGoTheme,
  type UsagePillStyle,
  accountsOf,
  accountRefOf,
  type GoAccount,
  type GoAccountSwitch,
  type AnalyticsQuery,
  type AnalyticsReport,
  type AnalyticsExport,
} from '../contracts.ts'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { OpencodeGoSettings } from './controller.ts'
import { AnalyticsDialog } from './AnalyticsDialog.tsx'
import { formatDateTime, themeStyle, useGoThemeTokens } from './presentation.ts'

export interface UsagePillProps {
  directory: SnapshotStore<ModelDirectoryState>
  settings: ConfigForm<OpencodeGoSettings>
  readUsage: () => Promise<GoUsage>
  readAccountUsage?: (ref: string) => Promise<GoUsage>
  /** Optional so an embedded/test render can omit the dashboard. */
  readAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>
  exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>
  t: (key: string) => string
  getLocale?: () => string
  credentialChanges?: SnapshotStore<number>
  selectAccount?: (ref: string) => Promise<boolean>
  /**
   * Open the console page instead of the in-place dialog. Set by the client
   * registration once the host declares a sidebar panel; omitted hosts (and
   * tests) keep the self-contained dialog. Returns whether navigation happened,
   * so a page withdrawn since the face was built still opens the dialog.
   */
  openUsagePage?: () => boolean
}

/** A root sidebar entry receives its width mode from the host slot owner. */
export type SidebarQuotaProps = Omit<UsagePillProps, 'directory'> & {
  wide: boolean
}

type UsageVariant = 'pill' | 'sidebar' | 'sidebar-icon'

const sidebarAccountStorageKey = 'dsh-opencode-go.sidebar-account'

const unchanged = () => 0

const noSubscription = () => () => {}

interface UsageFailure {
  message?: string
  retainPrevious: boolean
  source?: string
  lastSwitch?: GoAccountSwitch
}

/** Only the Host's domain failure message is approved for display. */
function usageFailure(error: unknown): UsageFailure {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'opencode-go/usage-unavailable'
    && 'details' in error && error.details && typeof error.details === 'object') {
    const details = error.details as Record<string, unknown>
    let lastSwitch: GoAccountSwitch | undefined
    try { if (details.lastSwitch) lastSwitch = parseAccountSwitch(details.lastSwitch) } catch { /* Ignore malformed notices. */ }
    return {
      ...('message' in error && typeof error.message === 'string' ? { message: error.message } : {}),
      retainPrevious: details.retryable === true && details.retainPrevious === true,
      ...(typeof details.source === 'string' ? { source: details.source } : {}),
      ...(lastSwitch ? { lastSwitch } : {}),
    }
  }
  return { retainPrevious: false }
}

/** A hung readUsage must not hold the refresh latch forever: after this long the
 *  cycle gives up, keeping the last reading but flagging it stale, so the minute
 *  timer and visibility refreshes regain their turn. */
const usageRefreshTimeoutMs = 30_000

const refreshTimedOut = Symbol('usage-refresh-timed-out')

/** Descendants a non-modal popover may hand focus to when it opens. */
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function withRefreshTimeout(read: () => Promise<GoUsage>): Promise<GoUsage> {
  return new Promise<GoUsage>((resolve, reject) => {
    const timeout = setTimeout(() => reject(refreshTimedOut), usageRefreshTimeoutMs)
    read().then(
      value => { clearTimeout(timeout); resolve(value) },
      error => { clearTimeout(timeout); reject(error) },
    )
  })
}

/** Panel timestamps keep the date and minutes: seconds only add noise at this size. */
function panelDateTime(value: string | number, locale?: string): string {
  return formatDateTime(value, locale, {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Bars turn amber near the limit and red once the window is exhausted. */
function usageLevel(window: UsageWindow): string | undefined {
  if (window.status === 'rate-limited' || window.percent >= 100) return css.limited
  return window.percent >= 80 ? css.high : undefined
}

/** The panel's own glyphs: no host icon set is required, and each one carries its meaning in text. */
function ChevronLeft() {
  return <svg className={css.icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M10 4 6 8l4 4" /></svg>
}

function ChevronRight() {
  return <svg className={css.icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 4l4 4-4 4" /></svg>
}

function ChevronDown() {
  return <svg className={css.icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
}

function ChartIcon() {
  return <svg className={css.icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M2.5 13.5h11M4.5 11V8M8 11V4M11.5 11V6" /></svg>
}

function Tick() {
  return <svg className={css.tick} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
}

/** Only a visible, enabled input indicator mounts the usage poller. */
export function UsagePill({ directory, ...props }: UsagePillProps) {
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot, directory.getSnapshot)
  return <UsageSurface {...props} variant="pill" provider={state.current?.provider} />
}

export function SidebarQuota({ wide, ...props }: SidebarQuotaProps) {
  return <UsageSurface {...props} variant={wide ? 'sidebar' : 'sidebar-icon'} />
}

/** The sidebar's viewed account is independent of the profile's request order. */
function UsageSurface({ settings, credentialChanges, variant, provider, readAccountUsage, openUsagePage, ...props }:
  Omit<UsagePillProps, 'directory'> & {
    variant: UsageVariant; provider?: string
  }) {
  // The Host scope is a class instance whose methods read their own state, so
  // React has to reach them through this receiver: a reference handed over as a
  // plain value loses it and throws on the pill's first render.
  const readSettings = useCallback(() => settings.getSnapshot(), [settings])
  const subscribeSettings = useCallback((listener: () => void) => settings.subscribe(listener), [settings])
  const config = useSyncExternalStore(subscribeSettings, readSettings, readSettings)
  const readChanges = useCallback(() => credentialChanges?.getSnapshot() ?? unchanged(), [credentialChanges])
  const subscribeChanges = useCallback((listener: () => void) => credentialChanges?.subscribe(listener) ?? noSubscription(), [credentialChanges])
  const credentialRevision = useSyncExternalStore(subscribeChanges, readChanges, readChanges)
  // The dashboard's open state lives above the remount key: a credential, account,
  // endpoint or roster change remounts the polling subtree, and that must not close
  // an open dashboard or drop its in-flight report.
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  /** Open the console page when the host offers one; otherwise the local dialog. */
  const openAnalytics = useCallback((next: boolean): void => {
    if (next && openUsagePage?.() === true) return
    setAnalyticsOpen(next)
  }, [openUsagePage])
  const [viewedAccountId, setViewedAccountId] = useState<string | null>(() => {
    if (variant === 'pill') return null
    try { return globalThis.localStorage?.getItem(sidebarAccountStorageKey) ?? null } catch { return null }
  })
  const mode = config.value?.usageDisplay ?? DEFAULT_USAGE_DISPLAY
  const appearanceTheme = config.value?.appearanceTheme ?? DEFAULT_OPENCODE_GO_THEME
  const visible = config.status === 'ready' && config.value?.enabled !== false
    && (variant === 'pill'
      ? mode === 'always' || mode === 'auto' && provider === PROVIDER_ID
      : config.value?.showSidebarQuota === true)
  const accounts = accountsOf(config.value ?? {})
  const viewedAccount = variant !== 'pill' && readAccountUsage
    ? accounts.find(account => account.id === viewedAccountId) ?? accounts[0] : undefined
  const viewedRef = viewedAccount?.apiKeyEnv
  const callingRef = accountRefOf(config.value ?? {})
  const activeRef = viewedRef ?? callingRef
  const readSidebarUsage = useCallback(() => viewedRef && readAccountUsage
    ? readAccountUsage(viewedRef) : props.readUsage(), [viewedRef, readAccountUsage, props.readUsage])
  const readDialogQuota = useCallback((ref: string): Promise<GoUsage> => {
    if (readAccountUsage) return readAccountUsage(ref)
    if (ref === callingRef) return props.readUsage()
    return Promise.reject(new Error('Quota is unavailable for the selected account'))
  }, [readAccountUsage, callingRef, props.readUsage])
  useEffect(() => {
    if (!visible || !viewedAccount) return
    setViewedAccountId(viewedAccount.id)
    try { globalThis.localStorage?.setItem(sidebarAccountStorageKey, viewedAccount.id) } catch { /* In-memory viewing still works. */ }
  }, [visible, viewedAccount?.id])
  const nextAccount = () => {
    setViewedAccountId(previous => {
      const index = Math.max(0, accounts.findIndex(account => account.id === previous))
      return accounts[(index + 1) % accounts.length]!.id
    })
  }
  return visible ? <>
    <ActiveUsage key={JSON.stringify([activeRef, config.value?.baseURL, config.value?.proxyURL, credentialRevision, accounts.map(a => [a.id, a.apiKeyEnv])])}
      {...props} readUsage={variant === 'pill' ? props.readUsage : readSidebarUsage}
      accounts={accounts} activeRef={activeRef} writable={config.writable}
      onNextAccount={viewedAccount && accounts.length > 1 ? nextAccount : undefined}
      variant={variant} pillStyle={config.value?.usagePillStyle ?? DEFAULT_USAGE_PILL_STYLE}
      appearanceTheme={appearanceTheme} analyticsOpen={analyticsOpen} onAnalyticsOpenChange={openAnalytics} />
    {/* Mounted outside the keyed subtree so remounts cannot unmount it; it paints
        its own theme tokens, so leaving the pill's themed span costs no styling.
        It must stay mounted even when the console page offers itself: a page
        withdrawn after this face was built reports the miss from openUsagePage()
        and falls back to this dialog, which could not appear if it were absent. */}
    {props.readAnalytics ? <AnalyticsDialog open={analyticsOpen} onClose={() => { setAnalyticsOpen(false) }}
      readAnalytics={props.readAnalytics} exportAnalytics={props.exportAnalytics} readQuota={readDialogQuota}
      accounts={accounts} activeRef={callingRef}
      contextKey={JSON.stringify([credentialRevision, config.value?.baseURL, config.value?.proxyURL])}
      theme={appearanceTheme} t={props.t} getLocale={props.getLocale} /> : null}
  </> : null
}

function ActiveUsage({ readUsage, readAnalytics, t, getLocale, accounts, activeRef, writable, selectAccount, analyticsOpen, onAnalyticsOpenChange, onNextAccount, variant, pillStyle, appearanceTheme }:
  Omit<UsagePillProps, 'directory' | 'settings'> & {
    accounts: readonly GoAccount[]; activeRef: string; writable: boolean
    analyticsOpen: boolean; onAnalyticsOpenChange: (open: boolean) => void
    onNextAccount?: () => void
    variant: UsageVariant; pillStyle: UsagePillStyle; appearanceTheme: OpencodeGoTheme
  }) {
  const sidebar = variant !== 'pill'
  const [snapshot, setSnapshot] = useState<{ reader: typeof readUsage; usage: GoUsage; updatedAt: number } | null>(null)
  const [failed, setFailed] = useState<{ reader: typeof readUsage; failure: UsageFailure } | null>(null)
  const [stale, setStale] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchFailed, setSwitchFailed] = useState(false)
  const [view, setView] = useState<'usage' | 'accounts'>('usage')
  const [rovingIndex, setRovingIndex] = useState(0)
  const tokens = useGoThemeTokens(appearanceTheme)
  const root = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const retry = useRef<() => void>(() => {})
  const focusTrigger = useCallback(() => { triggerRef.current?.focus() }, [])
  const current = snapshot?.reader === readUsage ? snapshot : null
  const usage = current?.usage
  const failure = failed?.reader === readUsage ? failed.failure : null
  const notice = usage?.lastSwitch ?? failure?.lastSwitch
  const accountName = accounts.find(account => account.apiKeyEnv === activeRef)?.name || t('accountDefault')
  // The account list is the user's own choice of which account to spend, not the
  // fallback order the Settings page owns: it stays a drill-down inside the panel.
  const accountsView = view === 'accounts' && accounts.length > 1
  const selectedIndex = Math.max(0, accounts.findIndex(account => account.apiKeyEnv === activeRef))
  const roving = Math.min(rovingIndex, Math.max(0, accounts.length - 1))
  useEffect(() => {
    let alive = true
    let busy = false
    setSnapshot(null)
    setFailed(null)
    setStale(false)
    setRefreshing(false)
    const refresh = async (manual = false) => {
      if (busy || !manual && document.visibilityState === 'hidden') return
      busy = true
      setRefreshing(true)
      try {
        const value = await withRefreshTimeout(readUsage)
        if (alive) {
          setSnapshot({ reader: readUsage, usage: value, updatedAt: Date.now() })
          setFailed(null)
          setStale(false)
        }
      } catch (error: unknown) {
        if (alive) {
          if (error === refreshTimedOut) {
            // A timed-out read is not a failure: keep the last successful reading
            // (when there is one) and mark it stale until a later read succeeds.
            setStale(true)
          } else {
            const failure = usageFailure(error)
            setFailed({ reader: readUsage, failure })
            setSnapshot(previous => !sidebar && previous?.reader === readUsage && failure.retainPrevious
              && typeof previous.usage.source === 'string' && previous.usage.source.length > 0
              && previous.usage.source === failure.source ? previous : null)
            setStale(false)
          }
        }
      } finally {
        busy = false
        if (alive) setRefreshing(false)
      }
    }
    retry.current = () => { void refresh(true) }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60_000)
    const visible = () => { void refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => {
      alive = false
      retry.current = () => {}
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [readUsage, sidebar])
  useEffect(() => {
    if (!open) return
    const click = (event: MouseEvent) => {
      if (root.current?.contains(event.target as Node)) return
      setOpen(false)
      focusTrigger()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      focusTrigger()
    }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open, focusTrigger])
  // The popover is non-modal, but opening it must land focus inside: on the first
  // action of the reading view, or on the current account of the drill-down list.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>(focusableSelector)
    ;(first ?? panel).focus()
  }, [open])
  useEffect(() => {
    if (!open || !accountsView) return
    const panel = panelRef.current
    if (!panel) return
    const options = Array.from(panel.querySelectorAll<HTMLElement>('[role="option"]'))
    const index = Math.max(0, Math.min(selectedIndex, options.length - 1))
    setRovingIndex(index)
    ;(options[index] ?? panel).focus()
  }, [open, accountsView, selectedIndex])
  const switchable = accounts.length > 1 && writable && selectAccount !== undefined
  const switchTo = (ref: string): void => {
    if (ref === activeRef) { setView('usage'); focusTrigger(); return }
    setSwitching(true)
    setSwitchFailed(false)
    void selectAccount?.(ref).then(accepted => {
      setSwitchFailed(!accepted)
      if (accepted) setView('usage')
      // The activated option is unmounted (success) or busy (failure); a keyboard
      // user goes back to the trigger instead of losing focus to the document.
      focusTrigger()
    }).catch(() => { setSwitchFailed(true); focusTrigger() }).finally(() => { setSwitching(false) })
  }
  /** A timed-out refresh keeps the last reading but must say when it was taken.
   *  Existing copy only: the panel's own `usageLastUpdated` label plus a clock time. */
  const staleUpdated = stale && !failure && current
    ? ` · ${t('usageLastUpdated')} ${formatDateTime(current.updatedAt, getLocale?.(), { hour: '2-digit', minute: '2-digit' })}`
    : ''
  const label = usage
    ? `${t('usageRollingShort')} ${usage.rolling.percent}% · ${t('usageWeekShort')} ${usage.weekly.percent}%${sidebar ? ` · ${t('usage_monthly')} ${usage.monthly.percent}%` : ''}${failure || stale ? ` · ${t('usageStaleShort')}` : ''}${staleUpdated}${notice ? ` · ${t('usageFallbackShort')}` : ''}${accounts.length > 1 ? ` · ${accountName}` : ''}`
    : `${failure ? t('usageUnavailable') : '…'}${notice ? ` · ${t('usageFallbackShort')}` : ''}${accounts.length > 1 ? ` · ${accountName}` : ''}`
  /** The pill's segments concatenate to exactly `label`: the two readings, the optional stale and
   *  fallback wording, and the active account's full name once a second account exists. The
   *  @container tiers in UsagePill.module.css can hide the unit words and the stale/fallback
   *  wording, while the account name truncates with an ellipsis instead of pushing the readings
   *  out. jsdom does not evaluate container queries, so the tests below exercise the full label
   *  in every tier. */
  const segments = usage
    ? <>
      <span className={css.reading} data-stale={failure || stale ? '' : undefined}>
        <span className={css.unit}>{t('usageRollingShort')} </span>{usage.rolling.percent}%
        {' · '}
        <span className={css.unit}>{t('usageWeekShort')} </span>{usage.weekly.percent}%
      </span>
      {failure || stale ? <span className={css.stale}> · {t('usageStaleShort')}</span> : null}
      {notice ? <span className={css.fallback}> · {t('usageFallbackShort')}</span> : null}
      {accounts.length > 1 ? <>{' · '}<span className={css.account}>{accountName}</span></> : null}
    </>
    : <>
      {failure ? t('usageUnavailable') : '…'}
      {notice ? <span className={css.fallback}> · {t('usageFallbackShort')}</span> : null}
      {accounts.length > 1 ? <>{' · '}<span className={css.account}>{accountName}</span></> : null}
    </>
  const triggerClass = variant === 'sidebar' ? css.sidebarCard : variant === 'sidebar-icon' ? css.sidebarIcon
    : [css.trigger, pillStyle === 'plain' ? css.plain : undefined].filter(Boolean).join(' ')
  const iconOpensHistory = variant === 'sidebar-icon' && readAnalytics !== undefined
  const Trigger = !sidebar || iconOpensHistory ? 'button' : 'span'
  return <span className={[css.root, sidebar ? css.sidebarRoot : undefined].filter(Boolean).join(' ')}
    data-wide={sidebar ? String(variant === 'sidebar') : undefined} ref={root} style={themeStyle(tokens)}>
    <Trigger type={!sidebar || iconOpensHistory ? 'button' : undefined} role={sidebar && !iconOpensHistory ? 'group' : undefined}
      ref={!sidebar ? triggerRef : undefined} className={triggerClass}
      aria-expanded={iconOpensHistory ? analyticsOpen : sidebar ? undefined : open}
      aria-controls={!sidebar ? panelId : undefined}
      aria-haspopup={!sidebar || iconOpensHistory ? 'dialog' : undefined} data-fallback={notice ? '' : undefined}
      data-stale={failure || stale ? '' : undefined}
      aria-label={iconOpensHistory ? t('sidebarAnalytics') : `${t('usageTitle')}: ${label}`} title={label}
      onClick={iconOpensHistory ? () => { onAnalyticsOpenChange(true) } : sidebar ? undefined : () => {
        if (open) { setOpen(false); focusTrigger() } else { setView('usage'); setOpen(true) }
      }}>
      {variant === 'sidebar' ? <>
        <span className={css.sidebarHead}>
          <strong>OpenCode Go</strong>
          {onNextAccount ? <button type="button" className={`${css.sidebarBadge} ${css.sidebarAccountButton}`}
            aria-label={`${t('sidebarNextAccount')}: ${accountName}`} title={`${accountName} · ${t('sidebarNextAccount')}`}
            onClick={onNextAccount}>{accountName}</button>
            : <span className={css.sidebarBadge} title={accountName}>{accounts.length ? accountName : 'Go'}</span>}
        </span>
        {(['rolling', 'weekly', 'monthly'] as const).map(key => <span className={css.sidebarWindow} key={key}>
          <span>{t(`usage_${key}`)}</span>
          <progress aria-label={t(`usage_${key}`)} max={100} value={usage ? Math.min(100, Math.max(0, usage[key].percent)) : 0}
            className={[key === 'rolling' ? css.progressRolling : key === 'weekly' ? css.progressWeekly : css.progressMonthly, usage ? usageLevel(usage[key]) : undefined].filter(Boolean).join(' ')} />
          <strong>{usage ? `${usage[key].percent}%` : failure ? '—' : '…'}</strong>
        </span>)}
        {failure ? <span className={css.sidebarStatus} role="status" title={failure.message}>{t('usageUnavailable')}</span> : null}
        {!failure && stale && current ? <span className={css.sidebarStatus} data-stale="">{t('usageStaleShort')}</span> : null}
        {readAnalytics ? <button type="button" className={css.sidebarHistory} aria-label={t('sidebarAnalytics')} aria-haspopup="dialog"
          onClick={() => { onAnalyticsOpenChange(true) }}>
          <ChartIcon /><span>{t('analyticsOpen')}</span><ChevronRight />
        </button> : null}
      </> : variant === 'sidebar-icon' ? <ChartIcon /> : <>
        <span className={css.pillStatus} data-warning={failure || stale || notice ? '' : undefined} aria-hidden="true" />{segments}
      </>}
    </Trigger>
    {!sidebar && open && <div className={css.panel} id={panelId} ref={panelRef} role="dialog"
      aria-label={t('usageTitle')} aria-busy={refreshing} tabIndex={-1}>
      {/* Keep the surface separate from the scroller so its border stays fixed. */}
      <div className={css.material} aria-hidden="true" />
      <div className={css.body}>
      {accountsView ? <>
        <div className={css.panelHead}>
          <button type="button" className={css.back} aria-label={t('accountSwitchBack')}
            onClick={() => { setView('usage'); focusTrigger() }}>
            <ChevronLeft />
          </button>
          <strong>{t('accountSwitchTitle')}</strong>
        </div>
        <div className={css.list} role="listbox" aria-label={t('accountSwitchTitle')} aria-orientation="vertical"
          onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); setView('usage'); focusTrigger(); return }
            const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'))
            if (!options.length) return
            const focused = options.findIndex(option => option === document.activeElement)
            const at = focused >= 0 ? focused : Math.min(roving, options.length - 1)
            const next = event.key === 'ArrowDown' ? (at + 1) % options.length
              : event.key === 'ArrowUp' ? (at - 1 + options.length) % options.length
              : event.key === 'Home' ? 0
              : event.key === 'End' ? options.length - 1
              : -1
            if (next < 0) return
            event.preventDefault()
            setRovingIndex(next)
            options[next]?.focus()
          }}>
          {accounts.map((account, index) => <Fragment key={account.id}>
            {index ? <div className={css.divider} /> : null}
            <button type="button" role="option" aria-selected={account.apiKeyEnv === activeRef}
              data-selected={account.apiKeyEnv === activeRef ? '' : undefined}
              className={css.option} disabled={switching}
              tabIndex={index === roving ? 0 : -1}
              onFocus={() => { setRovingIndex(index) }}
              onClick={() => { switchTo(account.apiKeyEnv) }}>
              <span className={css.optionName}>{account.name || t('accountDefault')}</span>
              {account.apiKeyEnv === activeRef ? <Tick /> : null}
            </button>
          </Fragment>)}
        </div>
        {switchFailed ? <p className={css.warning} role="alert">{t('accountSwitchFailed')}</p> : null}
        <p className={css.hint}>{t('accountSwitchHint')}</p>
      </> : <>
        <div className={css.panelHead}>
          <strong>{t('usageTitle')}</strong>
          {accounts.length ? (switchable
            ? <button type="button" className={css.accChip} aria-haspopup="listbox" disabled={switching}
              aria-label={`${t('accountSwitchAction')} · ${accountName} · ${t('accountPreferredTag')}`}
              onClick={() => { setView('accounts') }}>
              <span className={css.dot} />
              <span className={css.accChipName}>{accountName}</span>
              {accounts.length > 1 ? <span className={css.tag}>{t('accountPreferredTag')}</span> : null}
              <ChevronDown />
            </button>
            : <span className={css.accChip}>
              <span className={css.dot} />
              <span className={css.accChipName}>{accountName}</span>
              {accounts.length > 1 ? <span className={css.tag}>{t('accountPreferredTag')}</span> : null}
            </span>)
            : null}
        </div>
        {switchFailed ? <p className={css.warning} role="alert">{t('accountSwitchFailed')}</p> : null}
        {notice ? <p className={css.warning} role="status">
          {t(notice.reason === 'quota' ? 'accountFallbackQuota' : 'accountFallbackCredential')}{' '}
          {accounts.find(account => account.apiKeyEnv === notice.toRef)?.name || t('accountDefault')}
          {' · '}{panelDateTime(notice.at, getLocale?.())}
        </p> : null}
        {failure ? <div className={css.warning} role="alert">
          <strong>{t('usageRefreshFailed')}</strong>
          <p>{failure.message ?? t('usageUnavailable')}</p>
          {usage ? <p>{t('usageStaleHint')}</p> : null}
        </div> : null}
        {failure ? <button type="button" className={css.retry} disabled={refreshing}
          onClick={() => { retry.current() }}>{t(refreshing ? 'usageRefreshing' : 'usageRetry')}</button> : null}
        {usage ? <div className={css.windows}>
          {(['rolling', 'weekly', 'monthly'] as const).map(key => <div className={css.win} key={key}>
            <div className={css.meta}>
              <span className={css.winLabel}>{t(`usage_${key}`)}</span>
              <span className={css.winReset}>{t('usageResets')} {panelDateTime(usage[key].resetsAt, getLocale?.())}</span>
              <strong className={css.winPercent}>{usage[key].percent}%</strong>
            </div>
            <progress className={[usageLevel(usage[key]), key === 'rolling' ? css.progressRolling : key === 'weekly' ? css.progressWeekly : css.progressMonthly].filter(Boolean).join(' ')}
              aria-label={t(`usage_${key}`)} max={100} value={Math.min(100, usage[key].percent)} />
            {usage[key].status === 'rate-limited' && <div className={css.limitedText}>{t('usageLimited')}</div>}
          </div>)}
        </div> : failure ? null : <p className={css.hint}>{t('usageLoading')}</p>}
        {readAnalytics || current ? <div className={css.actions}>
          {readAnalytics ? <button type="button" className={css.hist} aria-haspopup="dialog"
            onClick={() => { setOpen(false); onAnalyticsOpenChange(true) }}>
            <ChartIcon />
            <span>{t('analyticsOpen')}</span>
          </button> : null}
          {current
            ? <span className={css.updated}>{t('usageLastUpdated')} {panelDateTime(current.updatedAt, getLocale?.())}</span>
            : <span className={css.updated} />}
          {current && !failure ? <button type="button" className={css.refresh} disabled={refreshing}
            onClick={() => { retry.current() }}>{t(refreshing ? 'usageRefreshing' : 'usageRefresh')}</button> : null}
        </div> : null}
      </>}
      </div>
    </div>}
  </span>
}
