import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { GoUsage } from '../usage-contract.ts'
import css from './UsagePill.module.css'

export interface UsagePillProps {
  directory: SnapshotStore<ModelDirectoryState>
  readUsage: () => Promise<GoUsage>
  t: (key: string) => string
}

/** Only the selected Go provider mounts a poller, so other models send no usage traffic. */
export function UsagePill({ directory, ...props }: UsagePillProps) {
  const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot, directory.getSnapshot)
  return state.current?.provider === 'opencode-go' ? <ActiveUsage {...props} /> : null
}

function ActiveUsage({ readUsage, t }: Omit<UsagePillProps, 'directory'>) {
  const [usage, setUsage] = useState<GoUsage | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let alive = true
    let busy = false
    const refresh = async () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const value = await readUsage()
        if (alive) { setUsage(value); setFailed(false) }
      } catch {
        if (alive) { setUsage(null); setFailed(true) }
      } finally { busy = false }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60_000)
    const visible = () => { void refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [readUsage])
  useEffect(() => {
    if (!open) return
    const click = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])
  const label = usage ? `Go · 5h ${usage.rolling.percent}% · ${t('usageWeekShort')} ${usage.weekly.percent}%` : `Go · ${failed ? t('usageUnavailable') : '…'}`
  return <span className={css.root} ref={root}>
    <button type="button" className={css.trigger} aria-expanded={open} aria-haspopup="dialog"
      aria-label={`${t('usageTitle')}: ${label}`} onClick={() => { setOpen(!open) }}>{label}</button>
    {open && <div className={css.panel} role="dialog" aria-label={t('usageTitle')}>
      <strong>{t('usageTitle')}</strong>
      <p className={css.hint}>{t('usageHint')}</p>
      {usage ? (['rolling', 'weekly', 'monthly'] as const).map(key => <div className={css.window} key={key}>
        <div className={css.row}><span>{t(`usage_${key}`)}</span><strong>{usage[key].percent}%</strong></div>
        <progress aria-label={t(`usage_${key}`)} max={100} value={Math.min(100, usage[key].percent)} />
        <div className={css.hint}>{t('usageResets')} {new Date(usage[key].resetsAt).toLocaleString()}</div>
        {usage[key].status === 'rate-limited' && <div>{t('usageLimited')}</div>}
      </div>) : <p>{failed ? t('usageUnavailable') : t('usageLoading')}</p>}
    </div>}
  </span>
}
