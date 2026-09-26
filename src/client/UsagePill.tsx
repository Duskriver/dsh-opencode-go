import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { GoUsage, UsageWindow } from '../usage-contract.ts'
import css from './UsagePill.module.css'

export interface UsagePillProps {
  directory: SnapshotStore<ModelDirectoryState>
  readUsage: () => Promise<GoUsage>
  t: (key: string) => string
  getLocale?: () => string
}

interface UsageFailure {
  message?: string
  retainPrevious: boolean
  source?: string
}

/** Only the Host's domain failure message is approved for display. */
function usageFailure(error: unknown): UsageFailure {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'opencode-go/usage-unavailable'
    && 'details' in error && error.details && typeof error.details === 'object') {
    const details = error.details as Record<string, unknown>
    return {
      ...('message' in error && typeof error.message === 'string' ? { message: error.message } : {}),
      retainPrevious: details.retryable === true && details.retainPrevious === true,
      ...(typeof details.source === 'string' ? { source: details.source } : {}),
    }
  }
  return { retainPrevious: false }
}

/** Bars turn amber near the limit and red once the window is exhausted. */
function usageLevel(window: UsageWindow): string | undefined {
  if (window.status === 'rate-limited' || window.percent >= 100) return css.limited
  return window.percent >= 80 ? css.high : undefined
}

/** Only the selected Go provider mounts a poller, so other models send no usage traffic. */
export function UsagePill({ directory, ...props }: UsagePillProps) {
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot, directory.getSnapshot)
  return state.current?.provider === 'opencode-go' ? <ActiveUsage {...props} /> : null
}

function ActiveUsage({ readUsage, t, getLocale }: Omit<UsagePillProps, 'directory'>) {
  const [snapshot, setSnapshot] = useState<{ reader: typeof readUsage; usage: GoUsage; updatedAt: number } | null>(null)
  const [failed, setFailed] = useState<{ reader: typeof readUsage; failure: UsageFailure } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(false)
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
  const label = usage
    ? `Go · ${t('usageRollingShort')} ${usage.rolling.percent}% · ${t('usageWeekShort')} ${usage.weekly.percent}%${failure ? ` · ${t('usageStaleShort')}` : ''}`
    : `Go · ${failure ? t('usageUnavailable') : '…'}`
  return <span className={css.root} ref={root}>
    <button type="button" className={css.trigger} aria-expanded={open} aria-haspopup="dialog"
      aria-label={`${t('usageTitle')}: ${label}`} onClick={() => { setOpen(!open) }}>{label}</button>
    {open && <div className={css.panel} role="dialog" aria-label={t('usageTitle')} aria-busy={refreshing}>
      <strong>{t('usageTitle')}</strong>
      <p className={css.hint}>{t('usageHint')}</p>
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
