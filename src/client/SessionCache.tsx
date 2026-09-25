import { useMemo, useSyncExternalStore } from 'react'
import { sessionCacheSource, type SessionEventSource } from './session-cache.ts'
import css from './UsagePill.module.css'

export function SessionCache({ events, t, getLocale }: {
  events: SessionEventSource
  t: (key: string) => string
  getLocale?: () => string
}) {
  const source = useMemo(() => sessionCacheSource(events), [events])
  const stats = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  const format = new Intl.NumberFormat(getLocale?.())
  const ratio = stats.inputTokens > 0
    ? new Intl.NumberFormat(getLocale?.(), { style: 'percent', maximumFractionDigits: 1 }).format(stats.cacheReadTokens / stats.inputTokens)
    : '—'
  return <section className={css.cache} aria-label={t('cacheTitle')}>
    <strong>{t('cacheTitle')}</strong>
    <div className={css.row}><span>{t('cacheReadRatio')}</span><strong>{ratio}</strong></div>
    <dl className={css.stats}>
      <dt>{t('cacheReadTokens')}</dt><dd>{format.format(stats.cacheReadTokens)}</dd>
      <dt>{t('cacheInputTokens')}</dt><dd>{format.format(stats.inputTokens)}</dd>
      <dt>{t('cacheWriteTokens')}</dt><dd>{format.format(stats.cacheWriteTokens)}</dd>
      <dt>{t('cacheResponses')}</dt><dd>{format.format(stats.responses)}</dd>
    </dl>
    {stats.responses === 0 && <p className={css.hint}>{t('cacheEmpty')}</p>}
    {(stats.missingUsage + stats.unattributed > 0) && <p className={css.hint}>{t('cacheExcluded')} {format.format(stats.missingUsage + stats.unattributed)}</p>}
    <p className={css.hint}>{t('cacheScope')}{stats.hasMore ? ` ${t('cacheMore')}` : ''}</p>
    <p className={css.hint}>{t('cacheRoutingHint')}</p>
  </section>
}
