/** Conversation and sidebar quota indicators, account selection and analytics. */
import css from './UsagePill.module.css'
import { Fragment, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import {
  parseAccountSwitch,
  accountPlanOf,
  DEFAULT_GO_PLAN,
  GO_PLANS,
  type GoModel,
  type GoModelCatalog,
  type GoPlan,
  type GoUsage,
  type UsageWindow,
  PROVIDER_ID,
  DEFAULT_USAGE_DISPLAY,
  resolveUsagePillAppearance,
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
import type { SharedModelCatalog } from './model-catalog-store.ts'
import { formatDateTime, formatTokenCount, themeStyle, useGoThemeTokens } from './presentation.ts'
import { estimateModelQuota } from '../quota-estimate.ts'

export interface UsagePillProps {
  directory: SnapshotStore<ModelDirectoryState>
  settings: ConfigForm<OpencodeGoSettings>
  readUsage: (force?: boolean) => Promise<GoUsage>
  readAccountUsage?: (ref: string, force?: boolean) => Promise<GoUsage>
  readModels?: () => Promise<GoModelCatalog>
  /** Shared client-side model catalog cache; falls back to `readModels` when omitted. */
  catalog?: SharedModelCatalog
  /** Optional so an embedded/test render can omit the dashboard. */
  readAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>
  exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>
  t: (key: string, params?: Record<string, unknown>) => string
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

/** Clamp quota percentage into [0, 100] for SVG arcs and progress elements. */
function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/** Semantic severity tone for rings, fills and bars. */
function windowTone(window: UsageWindow): 'normal' | 'high' | 'limited' {
  if (window.status === 'rate-limited' || window.percent >= 100) return 'limited'
  return window.percent >= 80 ? 'high' : 'normal'
}

/** Bars turn amber near the limit and red once the window is exhausted. */
function usageLevel(window: UsageWindow): string | undefined {
  const tone = windowTone(window)
  return tone === 'limited' ? css.limited : tone === 'high' ? css.high : undefined
}

/** Compute SVG stroke dash parameters; nonzero values keep a 12-o'clock starter cap. */
function ringArc(radius: number, percent: number): { c: string; offset: string } {
  const circumference = 2 * Math.PI * radius
  const clamped = clampPercent(percent)
  const dash = clamped === 0 ? 0 : Math.max(circumference * 0.045, (clamped / 100) * circumference)
  return { c: circumference.toFixed(2), offset: (circumference - dash).toFixed(2) }
}

function MiniRing({ window, role, size = 14, stroke = 2 }: {
  window: UsageWindow; role: 'rolling' | 'weekly'; size?: number; stroke?: number
}) {
  const radius = (size - stroke) / 2
  const center = size / 2
  const tone = windowTone(window)
  const { c, offset } = ringArc(radius, window.percent)
  return <svg className={css.ring} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    <circle cx={center} cy={center} r={radius} className={css.ringTrack} strokeWidth={stroke} />
    {window.percent > 0 || window.status === 'rate-limited'
      ? <circle cx={center} cy={center} r={radius} className={css.ringArc} data-role={role}
        data-level={tone} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={offset} />
      : null}
  </svg>
}

function ConcentricRings({ rolling, weekly, size = 18 }: {
  rolling: UsageWindow; weekly: UsageWindow; size?: number
}) {
  const center = size / 2
  const outerR = center - 2
  const innerR = outerR - 3.1
  const outer = ringArc(outerR, rolling.percent)
  const inner = ringArc(innerR, weekly.percent)
  return <svg className={css.ring} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    <circle cx={center} cy={center} r={outerR} className={css.ringTrack} strokeWidth={2} />
    {rolling.percent > 0 || rolling.status === 'rate-limited'
      ? <circle cx={center} cy={center} r={outerR} className={css.ringArc} data-role="rolling"
        data-level={windowTone(rolling)} strokeWidth={2} strokeDasharray={outer.c} strokeDashoffset={outer.offset} />
      : null}
    <circle cx={center} cy={center} r={innerR} className={css.ringTrack} strokeWidth={2} />
    {weekly.percent > 0 || weekly.status === 'rate-limited'
      ? <circle cx={center} cy={center} r={innerR} className={css.ringArc} data-role="weekly"
        data-level={windowTone(weekly)} strokeWidth={2} strokeDasharray={inner.c} strokeDashoffset={inner.offset} />
      : null}
  </svg>
}

interface UsageTriggerContentProps {
  style: UsagePillStyle
  rolling: UsageWindow
  weekly: UsageWindow
  monthly?: UsageWindow
  rollingShort: string
  weekShort: string
  monthShort?: string
  accountName?: string
  stale?: boolean
  staleLabel?: string
  fallback?: boolean
  fallbackLabel?: string
}

function UsageTriggerSuffix({ monthly, monthShort, stale, staleLabel, fallback, fallbackLabel, accountName }: Pick<
  UsageTriggerContentProps, 'monthly' | 'monthShort' | 'stale' | 'staleLabel' | 'fallback' | 'fallbackLabel' | 'accountName'
>) {
  const monthlyTone = monthly ? windowTone(monthly) : 'normal'
  return <>
    {monthly && monthlyTone !== 'normal' && monthShort
      ? <span className={css.monthAlert} data-level={monthlyTone}>
        {' · '}{monthShort} {monthly.percent}%<LimitMark window={monthly} />
      </span>
      : null}
    {stale && staleLabel ? <span className={css.stale}> · {staleLabel}</span> : null}
    {fallback && fallbackLabel ? <span className={css.fallback}> · {fallbackLabel}</span> : null}
    {accountName ? <>{' · '}<span className={css.account}>{accountName}</span></> : null}
  </>
}

function LimitMark({ window }: { window: UsageWindow }) {
  return window.status === 'rate-limited' ? <span className={css.limitMark} aria-hidden="true">!</span> : null
}

function UsageTriggerContent(props: UsageTriggerContentProps) {
  const { style, rolling, weekly, monthly, rollingShort, weekShort, stale, fallback } = props
  const monthlyAlert = monthly ? windowTone(monthly) !== 'normal' : false
  const warning = Boolean(stale || fallback || monthlyAlert)
  const suffix = <UsageTriggerSuffix {...props} />
  if (style === 'concentric') {
    return <>
      <ConcentricRings rolling={rolling} weekly={weekly} />
      <span className={css.reading} data-stale={stale ? '' : undefined}>
        <span className={css.valTone} data-level={windowTone(rolling)}>{rolling.percent}%<LimitMark window={rolling} /></span>
        <span className={css.sep}> / </span>
        <span className={css.valTone} data-level={windowTone(weekly)}>{weekly.percent}%<LimitMark window={weekly} /></span>
      </span>
      {suffix}
    </>
  }
  if (style === 'rings') {
    return <>
      <span className={css.ringsGroup} data-stale={stale ? '' : undefined}>
        <span className={css.ringItem}>
          <MiniRing window={rolling} role="rolling" />
          <span className={`${css.reading} ${css.valTone}`} data-level={windowTone(rolling)}>
            {rolling.percent}%<LimitMark window={rolling} />
          </span>
        </span>
        <span className={css.sep}>·</span>
        <span className={css.ringItem}>
          <MiniRing window={weekly} role="weekly" />
          <span className={`${css.reading} ${css.valTone}`} data-level={windowTone(weekly)}>
            {weekly.percent}%<LimitMark window={weekly} />
          </span>
        </span>
      </span>
      {suffix}
    </>
  }
  if (style === 'bars') {
    return <>
      <span className={css.barsGroup} data-stale={stale ? '' : undefined}>
        <span className={css.barItem}>
          <span className={css.barMeta}>
            <span className={css.unit}>{rollingShort}</span>
            <span className={`${css.barVal} ${css.valTone}`} data-level={windowTone(rolling)}>
              {rolling.percent}%<LimitMark window={rolling} />
            </span>
          </span>
          <progress className={[css.miniProgress, css.progressRolling, usageLevel(rolling)].filter(Boolean).join(' ')}
            max={100} value={clampPercent(rolling.percent)} aria-hidden="true" />
        </span>
        <span className={css.barItem} data-kind="weekly">
          <span className={css.barMeta}>
            <span className={css.unit}>{weekShort}</span>
            <span className={`${css.barVal} ${css.valTone}`} data-level={windowTone(weekly)}>
              {weekly.percent}%<LimitMark window={weekly} />
            </span>
          </span>
          <progress className={[css.miniProgress, css.progressWeekly, usageLevel(weekly)].filter(Boolean).join(' ')}
            max={100} value={clampPercent(weekly.percent)} aria-hidden="true" />
        </span>
      </span>
      {suffix}
    </>
  }
  const reading = <>
    <span className={css.pillStatus} data-warning={warning ? '' : undefined} aria-hidden="true" />
    <span className={css.reading} data-stale={stale ? '' : undefined}>
      <span className={css.unit}>{rollingShort} </span>{rolling.percent}%
      {' · '}
      <span className={css.unit}>{weekShort} </span>{weekly.percent}%
    </span>
    {suffix}
  </>
  if (style === 'fill') {
    return <>
      <span className={css.fillTrack} aria-hidden="true">
        <span className={css.fillBar} data-level={windowTone(rolling)} style={{ width: `${clampPercent(rolling.percent)}%` }} />
      </span>
      <span className={css.fillBottom} data-level={windowTone(weekly)} style={{ width: `${clampPercent(weekly.percent)}%` }} aria-hidden="true" />
      <span className={css.fillContent}>{reading}</span>
    </>
  }
  return reading
}

const PREVIEW_WINDOWS = {
  rolling: { status: 'ok' as const, percent: 24, resetsAt: '2026-11-17T00:00:00Z' },
  weekly: { status: 'ok' as const, percent: 48, resetsAt: '2026-11-24T00:00:00Z' },
}

/** Render a live, non-interactive quota trigger sample for Settings and Console appearance cards. */
export function UsageTriggerPreview({
  style, border, rollingShort, weekShort, monthShort, rolling, weekly, monthly, accountName, className,
}: {
  style: UsagePillStyle
  border: boolean
  rollingShort: string
  weekShort: string
  monthShort?: string
  rolling?: UsageWindow
  weekly?: UsageWindow
  monthly?: UsageWindow
  accountName?: string
  className?: string
}) {
  return <span className={[css.trigger, !border ? css.plain : undefined, className].filter(Boolean).join(' ')}
    data-pill-style={style} data-pill-border={String(border)}>
    <UsageTriggerContent
      style={style}
      rolling={rolling ?? PREVIEW_WINDOWS.rolling}
      weekly={weekly ?? PREVIEW_WINDOWS.weekly}
      monthly={monthly}
      rollingShort={rollingShort}
      weekShort={weekShort}
      monthShort={monthShort}
      accountName={accountName}
    />
  </span>
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

function RefreshIcon() {
  return <svg className={css.icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 7.5A5 5 0 1 1 11.2 4" /><path d="M13 3v3.5H9.5" /></svg>
}

function CycleIcon() {
  return <svg className={css.cycleIcon} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5h9L9.2 2.2M11.5 9.5h-9l2.3 2.3" /></svg>
}

/** Only a visible, enabled input indicator mounts the usage poller. */
export function UsagePill({ directory, ...props }: UsagePillProps) {
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot, directory.getSnapshot)
  return <UsageSurface {...props} variant="pill" provider={state.current?.provider} selectedModel={state.current?.model} />
}

export function SidebarQuota({ wide, ...props }: SidebarQuotaProps) {
  return <UsageSurface {...props} variant={wide ? 'sidebar' : 'sidebar-icon'} />
}

/** The sidebar's viewed account is independent of the profile's request order. */
function UsageSurface({ settings, credentialChanges, variant, provider, selectedModel, readAccountUsage, openUsagePage, ...props }:
  Omit<UsagePillProps, 'directory'> & {
    variant: UsageVariant; provider?: string; selectedModel?: string
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
  const readSidebarUsage = useCallback((force?: boolean) => viewedRef && readAccountUsage
    ? (force ? readAccountUsage(viewedRef, true) : readAccountUsage(viewedRef))
    : (force ? props.readUsage(true) : props.readUsage()), [viewedRef, readAccountUsage, props.readUsage])
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
  const hasExplicitBorder = config.user
    ? Object.hasOwn(config.user, 'usagePillBorder')
    : config.value?.usagePillBorder !== undefined
  const pillAppearance = resolveUsagePillAppearance(
    config.value?.usagePillStyle,
    config.value?.usagePillBorder,
    hasExplicitBorder,
  )
  const configPlan: GoPlan = (GO_PLANS as readonly string[]).includes(config.value?.goPlan ?? '')
    ? (config.value!.goPlan as GoPlan) : DEFAULT_GO_PLAN
  const goPlan = accountPlanOf(accounts.find(account => account.apiKeyEnv === activeRef), configPlan)
  const endpointKey = JSON.stringify([config.value?.baseURL ?? '', config.value?.freeBaseURL ?? '', config.value?.proxyURL ?? ''])
  const isSidebarPreview = variant === 'sidebar' && Boolean(viewedRef && callingRef && viewedRef !== callingRef)
  return visible ? <>
    <ActiveUsage key={JSON.stringify([activeRef, config.value?.baseURL, config.value?.proxyURL, credentialRevision, accounts.map(a => [a.id, a.apiKeyEnv])])}
      {...props} readUsage={variant === 'pill' ? props.readUsage : readSidebarUsage}
      readAccountUsage={readAccountUsage}
      accounts={accounts} activeRef={activeRef} callingRef={callingRef} writable={config.writable}
      isSidebarPreview={isSidebarPreview}
      onNextAccount={viewedAccount && accounts.length > 1 ? nextAccount : undefined}
      variant={variant} pillStyle={pillAppearance.style} pillBorder={pillAppearance.border}
      appearanceTheme={appearanceTheme} analyticsOpen={analyticsOpen} onAnalyticsOpenChange={openAnalytics}
      goPlan={goPlan} endpointKey={endpointKey} activeModelId={provider === PROVIDER_ID ? selectedModel : undefined} />
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

function formatTranslated(t: UsagePillProps['t'], key: string, params: Record<string, unknown>): string {
  let text = t(key, params)
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

function ActiveUsage({ readUsage, readAccountUsage, readModels, catalog, readAnalytics, t, getLocale, accounts, activeRef, callingRef, isSidebarPreview, writable, selectAccount, analyticsOpen, onAnalyticsOpenChange, onNextAccount, variant, pillStyle, pillBorder, appearanceTheme, goPlan, endpointKey, activeModelId }:
  Omit<UsagePillProps, 'directory' | 'settings'> & {
    accounts: readonly GoAccount[]; activeRef: string; callingRef: string; isSidebarPreview: boolean; writable: boolean
    analyticsOpen: boolean; onAnalyticsOpenChange: (open: boolean) => void
    onNextAccount?: () => void
    variant: UsageVariant; pillStyle: UsagePillStyle; pillBorder: boolean; appearanceTheme: OpencodeGoTheme
    goPlan: GoPlan; endpointKey: string; activeModelId?: string
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
  const [accountQuotas, setAccountQuotas] = useState<Readonly<Record<string, GoUsage | 'failed'>>>({})
  const [panelShiftX, setPanelShiftX] = useState(0)
  const [localCatalogModels, setLocalCatalogModels] = useState<readonly GoModel[] | null>(null)
  const readSharedCatalog = useCallback(() => catalog?.store.getSnapshot() ?? null, [catalog])
  const subscribeSharedCatalog = useCallback(
    (listener: () => void) => catalog?.store.subscribe(listener) ?? noSubscription(),
    [catalog],
  )
  const sharedCatalogModels = useSyncExternalStore(subscribeSharedCatalog, readSharedCatalog, readSharedCatalog)
  const catalogModels = catalog ? sharedCatalogModels : localCatalogModels
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
        const value = await withRefreshTimeout(() => (manual ? readUsage(true) : readUsage()))
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
      const target = event.target as HTMLElement | null
      const clickedFocusable = target?.closest?.(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [contenteditable=""], [tabindex]:not([tabindex="-1"])',
      ) != null
      setOpen(false)
      // Clicking inert backdrop returns focus so focus is not stranded on body;
      // clicking another interactive target (e.g. composer textarea) must keep focus there.
      if (!clickedFocusable) focusTrigger()
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
  useEffect(() => {
    if (sidebar || !open || !activeModelId) return
    if (catalog) {
      catalog.syncEndpoint(endpointKey)
      void catalog.ensureLoaded(endpointKey)
      return
    }
    if (!readModels || localCatalogModels) return
    let alive = true
    void readModels().then(result => { if (alive) setLocalCatalogModels(result.models) }).catch(() => {})
    return () => { alive = false }
  }, [sidebar, open, catalog, endpointKey, readModels, activeModelId, localCatalogModels])
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
  // Keep the non-modal popover inside viewport bounds on narrow windows so it
  // never clips past the left/right viewport edges.
  useEffect(() => {
    if (sidebar || !open) { setPanelShiftX(0); return }
    const clamp = (): void => {
      const panel = panelRef.current
      if (!panel || typeof window === 'undefined') return
      const rect = panel.getBoundingClientRect()
      if (rect.width === 0) return
      const margin = 12
      let shift = 0
      if (rect.left < margin) shift = margin - rect.left
      else if (rect.right > window.innerWidth - margin) shift = (window.innerWidth - margin) - rect.right
      setPanelShiftX(previous => (Math.abs(previous - shift) < 1 ? previous : Math.round(shift)))
    }
    clamp()
    window.addEventListener('resize', clamp)
    return () => { window.removeEventListener('resize', clamp) }
  }, [sidebar, open, accountsView])
  // Lazily load per-account quota previews when opening the switcher drill-down
  // so the user can compare backup headroom before switching accounts.
  useEffect(() => {
    if (sidebar || !open || !accountsView || !readAccountUsage) return
    let alive = true
    for (const account of accounts) {
      const ref = account.apiKeyEnv
      if (ref === activeRef && usage) {
        setAccountQuotas(previous => (previous[ref] === usage ? previous : { ...previous, [ref]: usage }))
        continue
      }
      void readAccountUsage(ref).then(
        result => { if (alive) setAccountQuotas(previous => ({ ...previous, [ref]: result })) },
        () => { if (alive) setAccountQuotas(previous => ({ ...previous, [ref]: 'failed' })) },
      )
    }
    return () => { alive = false }
  }, [sidebar, open, accountsView, readAccountUsage, accounts, activeRef, usage])
  const switchable = accounts.length > 1 && writable && selectAccount !== undefined
  const switchTo = (ref: string): void => {
    if (ref === callingRef) { setView('usage'); focusTrigger(); return }
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
  const monthlyAlert = Boolean(usage && windowTone(usage.monthly) !== 'normal')
  const label = usage
    ? `${t('usageRollingShort')} ${usage.rolling.percent}% · ${t('usageWeekShort')} ${usage.weekly.percent}%${sidebar ? ` · ${t('usage_monthly')} ${usage.monthly.percent}%` : monthlyAlert ? ` · ${t('usageMonthShort')} ${usage.monthly.percent}%` : ''}${failure || stale ? ` · ${t('usageStaleShort')}` : ''}${staleUpdated}${notice ? ` · ${t('usageFallbackShort')}` : ''}${accounts.length > 1 ? ` · ${accountName}` : ''}`
    : `${failure ? t('usageUnavailable') : '…'}${notice ? ` · ${t('usageFallbackShort')}` : ''}${accounts.length > 1 ? ` · ${accountName}` : ''}`
  /** The pill's segments concatenate to exactly `label`: the two readings, the optional stale and
   *  fallback wording, and the active account's full name once a second account exists. The
   *  @container tiers in UsagePill.module.css can hide the unit words and the stale/fallback
   *  wording, while the account name truncates with an ellipsis instead of pushing the readings
   *  out. jsdom does not evaluate container queries, so the tests below exercise the full label
   *  in every tier. */
  const unavailableSegments = <>
    <span className={css.pillStatus} data-warning={failure || stale || notice ? '' : undefined} aria-hidden="true" />
    {failure ? t('usageUnavailable') : '…'}
    {notice ? <span className={css.fallback}> · {t('usageFallbackShort')}</span> : null}
    {accounts.length > 1 ? <>{' · '}<span className={css.account}>{accountName}</span></> : null}
  </>
  const triggerClass = variant === 'sidebar' ? css.sidebarCard : variant === 'sidebar-icon' ? css.sidebarIcon
    : [css.trigger, !pillBorder ? css.plain : undefined].filter(Boolean).join(' ')
  const iconOpensHistory = variant === 'sidebar-icon' && readAnalytics !== undefined
  const Trigger = !sidebar || iconOpensHistory ? 'button' : 'span'
  return <span className={[css.root, sidebar ? css.sidebarRoot : undefined].filter(Boolean).join(' ')}
    data-wide={sidebar ? String(variant === 'sidebar') : undefined} ref={root} style={themeStyle(tokens)}>
    <Trigger type={!sidebar || iconOpensHistory ? 'button' : undefined} role={sidebar && !iconOpensHistory ? 'group' : undefined}
      ref={!sidebar ? triggerRef : undefined} className={triggerClass}
      data-pill-style={!sidebar ? pillStyle : undefined}
      data-pill-border={!sidebar ? String(pillBorder) : undefined}
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
          <span className={css.sidebarHeadRight}>
            {onNextAccount ? <button type="button" className={`${css.sidebarBadge} ${css.sidebarAccountButton}`}
              aria-label={`${t('sidebarNextAccount')}: ${accountName}`} title={`${accountName} · ${t('sidebarNextAccount')}`}
              onClick={onNextAccount}>
              <span className={css.sidebarBadgeText}>{accountName}</span>
              <CycleIcon />
            </button>
              : <span className={css.sidebarBadge} title={accountName}>{accounts.length ? accountName : 'Go'}</span>}
            <button type="button" className={css.sidebarRefresh} disabled={refreshing}
              aria-label={t(refreshing ? 'usageRefreshing' : 'usageRefresh')}
              title={t(refreshing ? 'usageRefreshing' : 'usageRefresh')}
              onClick={() => { retry.current() }}>
              <RefreshIcon />
            </button>
          </span>
        </span>
        {isSidebarPreview ? <span className={css.sidebarPreviewRow}>
          <span className={css.sidebarPreviewTag}>{t('sidebarPreviewTag')}</span>
          {writable && selectAccount ? <button type="button" className={css.sidebarUseBtn} disabled={switching}
            onClick={() => { switchTo(activeRef) }}>{t('sidebarUseAccount')}</button> : null}
        </span> : null}
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
      </> : variant === 'sidebar-icon' ? <ChartIcon />
        : usage ? <UsageTriggerContent style={pillStyle} rolling={usage.rolling} weekly={usage.weekly} monthly={usage.monthly}
          rollingShort={t('usageRollingShort')} weekShort={t('usageWeekShort')} monthShort={t('usageMonthShort')}
          accountName={accounts.length > 1 ? accountName : undefined}
          stale={Boolean(failure || stale)} staleLabel={t('usageStaleShort')}
          fallback={Boolean(notice)} fallbackLabel={t('usageFallbackShort')} />
        : unavailableSegments}
    </Trigger>
    {!sidebar && open && <div className={css.panel} id={panelId} ref={panelRef} role="dialog"
      style={panelShiftX !== 0 ? { transform: `translateX(${panelShiftX}px)` } : undefined}
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
          {accounts.map((account, index) => {
            const preview = accountQuotas[account.apiKeyEnv]
            const rowUsage = preview && preview !== 'failed' ? preview : undefined
            const rowTone = rowUsage
              ? (windowTone(rowUsage.rolling) === 'limited' || windowTone(rowUsage.weekly) === 'limited' || windowTone(rowUsage.monthly) === 'limited'
                ? 'limited'
                : windowTone(rowUsage.rolling) === 'high' || windowTone(rowUsage.weekly) === 'high' || windowTone(rowUsage.monthly) === 'high'
                  ? 'high' : 'normal')
              : undefined
            return <Fragment key={account.id}>
              {index ? <div className={css.divider} /> : null}
              <button type="button" role="option" aria-selected={account.apiKeyEnv === activeRef}
                data-selected={account.apiKeyEnv === activeRef ? '' : undefined}
                className={css.option} disabled={switching}
                tabIndex={index === roving ? 0 : -1}
                onFocus={() => { setRovingIndex(index) }}
                onClick={() => { switchTo(account.apiKeyEnv) }}>
                <span className={css.optionName}>{account.name || t('accountDefault')}</span>
                {rowUsage ? <span className={css.optionQuota} data-level={rowTone}>
                  {t('usageRollingShort')} {rowUsage.rolling.percent}% · {t('usageWeekShort')} {rowUsage.weekly.percent}%
                </span> : preview === 'failed' ? <span className={css.optionQuotaFailed}>{t('usageUnavailable')}</span> : null}
                {account.apiKeyEnv === activeRef ? <Tick /> : null}
              </button>
            </Fragment>
          })}
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
          {t(notice.reason === 'quota' ? 'accountFallbackQuota'
            : notice.reason === 'rate-limit' ? 'accountFallbackRateLimit'
              : notice.reason === 'region' ? 'accountFallbackRegion' : 'accountFallbackCredential')}{' '}
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
        {usage && catalogModels && activeModelId ? (() => {
          const activeEntry = catalogModels.find(entry => entry.id === activeModelId && (entry.source ?? 'go') === 'go')
          if (!activeEntry) return null
          const estimate = estimateModelQuota({ model: activeEntry, plan: goPlan, usage, nowMs: Date.now() })
          if (estimate?.kind !== 'go' || estimate.remainingRequests === undefined) return null
          const locale = getLocale?.()
          const callText = estimate.limited
            ? t('quotaPillModelLimited')
            : formatTranslated(t, 'quotaPillRemainingCalls', {
              count: formatTokenCount(estimate.remainingRequests, locale),
            })
          return <div className={css.modelSection}>
            <div className={css.modelEstimateRow} data-active="">
              <span className={css.modelEstimateName} title={activeEntry.name ?? activeEntry.id}>
                {activeEntry.name ?? activeEntry.id}
              </span>
              {estimate.isPeak
                ? <span className={css.modelEstimatePeak}
                  title={formatTranslated(t, 'quotaPillPeakTitle', { factor: estimate.peakFactor ?? estimate.multiplier })}>
                  {t('quotaPillPeakBadge')}
                </span>
                : estimate.peakFactor !== undefined
                  ? <span className={css.modelEstimateOffPeak} title={t('quotaPillOffPeakTitle')}>
                    {t('quotaPillOffPeakBadge')}
                  </span>
                  : null}
              <strong className={css.modelEstimateVal}>{callText}</strong>
            </div>
            {estimate.bottleneck ? <div className={css.modelBottleneck}>
              {t(`quotaBottleneck_${estimate.bottleneck}`)}
            </div> : null}
          </div>
        })() : null}
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
