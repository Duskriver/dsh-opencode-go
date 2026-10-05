import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { parseAccountSwitch, type GoUsage, type UsageWindow } from '../usage-contract.ts'
import { PROVIDER_ID } from '../provider-identity.ts'
import { DEFAULT_USAGE_DISPLAY } from '../usage-display.ts'
import type { SettingsScope } from './settings.ts'
import type { OpencodeGoSettings } from './section-controller.ts'
import { accountsOf, accountRefOf, type GoAccount, type GoAccountSwitch } from '../accounts.ts'
import css from './UsagePill.module.css'

export interface UsagePillProps {
  directory: SnapshotStore<ModelDirectoryState>
  settings: SettingsScope<OpencodeGoSettings>
  readUsage: () => Promise<GoUsage>
  t: (key: string) => string
  getLocale?: () => string
  credentialChanges?: SnapshotStore<number>
  selectAccount?: (ref: string) => Promise<boolean>
}

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

/** Bars turn amber near the limit and red once the window is exhausted. */
function usageLevel(window: UsageWindow): string | undefined {
  if (window.status === 'rate-limited' || window.percent >= 100) return css.limited
  return window.percent >= 80 ? css.high : undefined
}

/** Only a visible, enabled pill mounts the usage poller. */
export function UsagePill({ directory, settings, credentialChanges, ...props }: UsagePillProps) {
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot, directory.getSnapshot)
  // The Host scope is a class instance whose methods read their own state, so
  // React has to reach them through this receiver: a reference handed over as a
  // plain value loses it and throws on the pill's first render.
  const readSettings = useCallback(() => settings.getSnapshot(), [settings])
  const subscribeSettings = useCallback((listener: () => void) => settings.subscribe(listener), [settings])
  const config = useSyncExternalStore(subscribeSettings, readSettings, readSettings)
  const readChanges = useCallback(() => credentialChanges?.getSnapshot() ?? unchanged(), [credentialChanges])
  const subscribeChanges = useCallback((listener: () => void) => credentialChanges?.subscribe(listener) ?? noSubscription(), [credentialChanges])
  const credentialRevision = useSyncExternalStore(subscribeChanges, readChanges, readChanges)
  const mode = config.value?.usageDisplay ?? DEFAULT_USAGE_DISPLAY
  const visible = config.status === 'ready' && config.value?.enabled !== false
    && (mode === 'always' || mode === 'auto' && state.current?.provider === PROVIDER_ID)
  const accounts = accountsOf(config.value ?? {})
  const activeRef = accountRefOf(config.value ?? {})
  return visible ? <ActiveUsage key={JSON.stringify([activeRef, config.value?.baseURL, credentialRevision, accounts])}
    {...props} accounts={accounts} activeRef={activeRef} writable={config.writable} /> : null
}

function ActiveUsage({ readUsage, t, getLocale, accounts, activeRef, writable, selectAccount }: Omit<UsagePillProps, 'directory' | 'settings'> & {
  accounts: readonly GoAccount[]; activeRef: string; writable: boolean
}) {
  const [snapshot, setSnapshot] = useState<{ reader: typeof readUsage; usage: GoUsage; updatedAt: number } | null>(null)
  const [failed, setFailed] = useState<{ reader: typeof readUsage; failure: UsageFailure } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchFailed, setSwitchFailed] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const retry = useRef<() => void>(() => {})
  useEffect(() => {
    let alive = true
    let busy = false
    setSnapshot(null)
    setFailed(null)
    setRefreshing(false)
    const refresh = async (manual = false) => {
      if (busy || !manual && document.visibilityState === 'hidden') return
      busy = true
      setRefreshing(true)
      try {
        const value = await readUsage()
        if (alive) {
          setSnapshot({ reader: readUsage, usage: value, updatedAt: Date.now() })
          setFailed(null)
        }
      } catch (error: unknown) {
        if (alive) {
          const failure = usageFailure(error)
          setFailed({ reader: readUsage, failure })
          setSnapshot(previous => previous?.reader === readUsage && failure.retainPrevious
            && typeof previous.usage.source === 'string' && previous.usage.source.length > 0
            && previous.usage.source === failure.source ? previous : null)
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
  }, [readUsage])
  useEffect(() => {
    if (!open) return
    const click = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])
  const current = snapshot?.reader === readUsage ? snapshot : null
  const usage = current?.usage
  const failure = failed?.reader === readUsage ? failed.failure : null
  const notice = usage?.lastSwitch ?? failure?.lastSwitch
  const accountName = accounts.find(account => account.apiKeyEnv === activeRef)?.name || t('accountDefault')
  const label = usage
    ? `Go · ${t('usageRollingShort')} ${usage.rolling.percent}% · ${t('usageWeekShort')} ${usage.weekly.percent}%${failure ? ` · ${t('usageStaleShort')}` : ''}${notice ? ` · ${t('usageFallbackShort')}` : ''}${accounts.length > 1 ? ` · ${accountName}` : ''}`
    : `Go · ${failure ? t('usageUnavailable') : '…'}${notice ? ` · ${t('usageFallbackShort')}` : ''}${accounts.length > 1 ? ` · ${accountName}` : ''}`
  /** The segments concatenate to exactly `label`, so `textContent` — and every assertion built on it —
   * stays unchanged, while the @container tiers in UsagePill.module.css can hide the brand, the unit
   * words, the stale wording, the fallback mark and the account name independently. jsdom does not
   * evaluate container queries, so the tests below exercise the full label in every tier. */
  const segments = usage
    ? <>
      <span className={css.brand}>Go · </span>
      <span className={css.reading} data-stale={failure ? '' : undefined}>
        <span className={css.unit}>{t('usageRollingShort')} </span>{usage.rolling.percent}%
        {' · '}
        <span className={css.unit}>{t('usageWeekShort')} </span>{usage.weekly.percent}%
      </span>
      {failure ? <span className={css.stale}> · {t('usageStaleShort')}</span> : null}
      {notice ? <span className={css.fallback}> · {t('usageFallbackShort')}</span> : null}
      {accounts.length > 1 ? <span className={css.account}> · {accountName}</span> : null}
    </>
    : <>
      <span className={css.brand}>Go · </span>
      {failure ? t('usageUnavailable') : '…'}
      {notice ? <span className={css.fallback}> · {t('usageFallbackShort')}</span> : null}
      {accounts.length > 1 ? <span className={css.account}> · {accountName}</span> : null}
    </>
  return <span className={css.root} ref={root}>
    <button type="button" className={css.trigger} aria-expanded={open} aria-haspopup="dialog" data-fallback={notice ? '' : undefined}
      aria-label={`${t('usageTitle')}: ${label}`} title={label} onClick={() => { setOpen(!open) }}>{segments}</button>
    {open && <div className={css.panel} role="dialog" aria-label={t('usageTitle')} aria-busy={refreshing}>
      <strong>{t('usageTitle')}</strong>
      <p className={css.hint}>{t('usageHint')}</p>
      {accounts.length ? <label className={css.accountSelector}>{t('accountSwitchLabel')}
        <select value={activeRef} disabled={!writable || switching || !selectAccount} onChange={event => {
          const ref = event.target.value
          setSwitching(true)
          setSwitchFailed(false)
          void selectAccount?.(ref).then(accepted => { setSwitchFailed(!accepted) })
            .catch(() => { setSwitchFailed(true) }).finally(() => { setSwitching(false) })
        }}>{accounts.map(account => <option key={account.id} value={account.apiKeyEnv}>{account.name || t('accountDefault')}</option>)}</select>
      </label> : null}
      {switchFailed ? <p className={css.warning} role="alert">{t('accountSwitchFailed')}</p> : null}
      {notice ? <p className={css.warning} role="status">
        {t(notice.reason === 'quota' ? 'accountFallbackQuota' : 'accountFallbackCredential')}{' '}
        {accounts.find(account => account.apiKeyEnv === notice.toRef)?.name || t('accountDefault')}
        {' · '}{new Date(notice.at).toLocaleString(getLocale?.())}
      </p> : null}
      {failure ? <div className={css.warning} role="alert">
        <strong>{t('usageRefreshFailed')}</strong>
        <p>{failure.message ?? t('usageUnavailable')}</p>
        {usage ? <p>{t('usageStaleHint')}</p> : null}
      </div> : null}
      {failure ? <button type="button" className={css.retry} disabled={refreshing}
        onClick={() => { retry.current() }}>{t(refreshing ? 'usageRefreshing' : 'usageRetry')}</button> : null}
      {current ? <p className={css.hint}>{t('usageLastUpdated')} {new Date(current.updatedAt).toLocaleString(getLocale?.())}</p> : null}
      {usage ? (['rolling', 'weekly', 'monthly'] as const).map(key => <div className={css.window} key={key}>
        <div className={css.row}><span>{t(`usage_${key}`)}</span><strong>{usage[key].percent}%</strong></div>
        <progress className={usageLevel(usage[key])} aria-label={t(`usage_${key}`)} max={100} value={Math.min(100, usage[key].percent)} />
        <div className={css.hint}>{t('usageResets')} {new Date(usage[key].resetsAt).toLocaleString(getLocale?.())}</div>
        {usage[key].status === 'rate-limited' && <div className={css.limitedText}>{t('usageLimited')}</div>}
      </div>) : failure ? null : <p>{t('usageLoading')}</p>}
    </div>}
  </span>
}
