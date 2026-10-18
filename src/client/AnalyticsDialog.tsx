import { useEffect, useRef, useState } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AnalyticsQuery, AnalyticsReport, AnalyticsModelRow } from '../analytics-contract.ts'
import type { GoUsage } from '../usage-contract.ts'
import { GO_PLAN_AS_OF } from '../go-plan.ts'
import type { en } from './locales.ts'
import { themeStyle, useGoThemeTokens } from './theme.ts'
import css from './AnalyticsDialog.module.css'

type AnalyticsKey = keyof typeof en
type RangeKey = 'today' | '7d' | '30d' | '90d'
type ChartMode = 'spend' | 'tokens'

const RANGES: readonly { key: RangeKey; label: AnalyticsKey; days: number }[] = [
  { key: 'today', label: 'analyticsRangeToday', days: 0 },
  { key: '7d', label: 'analyticsRange7d', days: 7 },
  { key: '30d', label: 'analyticsRange30d', days: 30 },
  { key: '90d', label: 'analyticsRange90d', days: 90 },
]

export interface AnalyticsDialogProps {
  open: boolean
  onClose: () => void
  readAnalytics: (query: AnalyticsQuery) => Promise<AnalyticsReport>
  readQuota?: () => Promise<GoUsage>
  t: (key: AnalyticsKey) => string
  getLocale?: () => string
}

function startOfLocalDay(now: Date): number {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

function resolvedTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function queryFor(range: RangeKey, maxSessions: number): AnalyticsQuery {
  const now = new Date()
  const to = now.getTime()
  if (range === 'today') return { from: startOfLocalDay(now), to, timeZone: resolvedTimeZone(), maxSessions }
  const days = RANGES.find(item => item.key === range)?.days ?? 30
  const from = new Date(startOfLocalDay(now))
  from.setDate(from.getDate() - (days - 1))
  return { from: from.getTime(), to, timeZone: resolvedTimeZone(), maxSessions }
}

function compact(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function number(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

function usd(micro: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'USD', maximumFractionDigits: micro < 100_000 ? 4 : 2,
  }).format(micro / 1e6)
}

function planUsd(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function isUnsupported(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || !('code' in error) || !('details' in error)) return false
  const details = error.details
  return error.code === 'opencode-go/analytics-unavailable'
    && details !== null && typeof details === 'object' && 'reason' in details
    && details.reason === 'no-session-query'
}

function limitLabel(row: AnalyticsModelRow, t: (key: AnalyticsKey) => string, locale?: string): string {
  if (row.limitNote === 'unlimited') return t('analyticsLimitUnlimited')
  if (row.limitGoUsd === null && row.limitGoPlusUsd === null) return t('analyticsLimitUnknown')
  const go = row.limitGoUsd === null ? '-' : planUsd(row.limitGoUsd, locale)
  const plus = row.limitGoPlusUsd === null ? '-' : planUsd(row.limitGoPlusUsd, locale)
  const base = t('analyticsLimitGo') + ' ' + go + ' / ' + t('analyticsLimitPlus') + ' ' + plus
  return row.limitNote === 'limited-time' ? base + ' (' + t('analyticsLimitLimited') + ')' : base
}

function RefreshIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13.2 8.4A5.2 5.2 0 1 1 11.6 4.3" />
    <path d="M13.4 2.6v2.6h-2.6" />
  </svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
}

/**
 * Shared usage dashboard, opened from the composer pill and the settings card.
 * It scans only when opened or when the range asks for it; closing the modal
 * stops the request. Every number shown here comes from the same Host report
 * as before; only the presentation and the palette are new.
 */
export function AnalyticsDialog({ open, onClose, readAnalytics, readQuota, t, getLocale }: AnalyticsDialogProps) {
  const [range, setRange] = useState<RangeKey>('30d')
  const [maxSessions, setMaxSessions] = useState(500)
  const [revision, setRevision] = useState(0)
  const [chartMode, setChartMode] = useState<ChartMode>('spend')
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [quota, setQuota] = useState<GoUsage | null>(null)
  const [quotaFailed, setQuotaFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const generation = useRef(0)
  const analyticsRef = useRef(readAnalytics)
  const quotaRef = useRef(readQuota)
  analyticsRef.current = readAnalytics
  quotaRef.current = readQuota
  const tokens = useGoThemeTokens()
  const locale = getLocale?.()

  useEffect(() => {
    if (!open || quotaRef.current === undefined) return
    let stopped = false
    setQuotaFailed(false)
    void quotaRef.current().then(usage => {
      if (!stopped) setQuota(usage)
    }, () => {
      if (!stopped) { setQuota(null); setQuotaFailed(true) }
    })
    return () => { stopped = true }
  }, [open, revision])

  useEffect(() => {
    if (!open) return
    let stopped = false
    const id = ++generation.current
    setLoading(true)
    setError(null)
    void analyticsRef.current(queryFor(range, maxSessions))
      .then(next => {
        if (stopped || id !== generation.current) return
        setReport(next)
      })
      .catch((reason: unknown) => {
        if (stopped || id !== generation.current) return
        setError(reason)
      })
      .finally(() => {
        if (!stopped && id === generation.current) setLoading(false)
      })
    return () => { stopped = true }
  }, [open, range, maxSessions, revision])

  const counts = report?.totals
  const tokenTotal = counts === undefined ? 0
    : counts.inputTokens + counts.outputTokens + counts.cacheReadTokens + counts.cacheWriteTokens
  const maxModelSpend = report === null ? 0 : Math.max(0, ...report.byModel.map(row => row.estimatedMicroUsd))
  const maxDayValue = report === null ? 0 : Math.max(0, ...report.byDay.map(row =>
    chartMode === 'spend' ? row.estimatedMicroUsd : row.tokens))
  const unsupported = error !== null && isUnsupported(error)
  const empty = report !== null && report.totals.requests === 0
  const rangeText = report === null ? ''
    : new Date(report.range.from).toLocaleDateString(locale) + ' – ' + new Date(report.range.to - 1).toLocaleDateString(locale)
  const labelStep = report === null ? 1 : Math.max(1, Math.ceil(report.byDay.length / (report.byDay.length > 30 ? 6 : 8)))

  return <Modal open={open} onClose={onClose} title={t('analyticsTitle')} headless className={css.shell}>
    <div className={css.card} style={themeStyle(tokens)} aria-busy={loading}>
      <header className={css.head}>
        <div className={css.headMain}>
          <div className={css.titleRow}>
            <h2 className={css.title}>{t('analyticsTitle')}</h2>
            <span className={css.badge}>OpenCode Go</span>
          </div>
          <p className={css.sub}>{t('analyticsSubtitle')}</p>
        </div>
        <div className={css.headActions}>
          {report !== null ? <span className={css.updated}>{t('usageLastUpdated')} {new Date(report.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span> : null}
          <button type="button" className={css.iconButton} aria-label={t('analyticsRefresh')} title={t('analyticsRefresh')}
            disabled={loading} onClick={() => { setRevision(value => value + 1) }}>
            <RefreshIcon />
          </button>
          <button type="button" className={css.iconButton} aria-label={t('analyticsClose')} title={t('analyticsClose')}
            onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className={css.toolbar}>
        <div className={css.seg} role="group" aria-label={t('analyticsRange')}>
          {RANGES.map(item => <button
            key={item.key}
            type="button"
            aria-pressed={range === item.key}
            onClick={() => { setRange(item.key) }}
          >{t(item.label)}</button>)}
        </div>
        {rangeText !== '' ? <span className={css.rangeNote}>{rangeText}</span> : null}
        {loading && report !== null ? <span className={css.rangeNote}>{t('analyticsLoading')}</span> : null}
      </div>

      <div className={css.scroll}>
        {error !== null && <div className={css.error} role="alert">
          <p>{unsupported ? t('analyticsUnsupported') : t('analyticsFailed')}</p>
          {!unsupported && <button type="button" className={css.action} onClick={() => { setRevision(value => value + 1) }}>
            {t('analyticsRetry')}
          </button>}
        </div>}

        {loading && report === null && error === null && <p className={css.loading} role="status">{t('analyticsLoading')}</p>}

        {quota !== null ? <section className={css.block}>
          <div className={css.blockHead}>
            <h3>{t('analyticsQuota')}</h3>
            <span>{t('analyticsQuotaHint')}</span>
          </div>
          <div className={css.quotaGrid}>
            {(['rolling', 'weekly', 'monthly'] as const).map(key => {
              const window = quota[key]
              const color = window.status === 'rate-limited' || window.percent >= 100
                ? 'var(--go-danger)'
                : key === 'rolling' ? 'var(--go-accent)' : key === 'weekly' ? 'var(--go-success)' : 'var(--go-warning)'
              const label = t(key === 'rolling' ? 'usage_rolling' : key === 'weekly' ? 'usage_weekly' : 'usage_monthly')
              return <div className={css.quotaCard} key={key}>
                <div className={css.quotaTop}><span>{label}</span><b>{window.percent}%</b></div>
                <div className={css.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={Math.round(window.percent)}>
                  <i style={{ width: Math.min(100, Math.max(0, window.percent)) + '%', background: color }} />
                </div>
                <div className={css.quotaFoot}>{t('usageResets')} {new Date(window.resetsAt).toLocaleString(locale)}</div>
                {window.status === 'rate-limited' ? <div className={css.quotaWarn}>{t('usageLimited')}</div> : null}
              </div>
            })}
          </div>
        </section> : quotaFailed ? <p className={css.quotaFailed}>{t('analyticsQuotaFailed')}</p> : null}

        {report !== null && counts !== undefined && <>
          <div className={css.metrics}>
            <div className={css.metric}>
              <b>{number(counts.requests, locale)}</b>
              <span>{t('analyticsRequests')}</span>
              <small>{t('analyticsSummaries')} {number(counts.summaries, locale)} · {t('analyticsUnsettled')} {number(counts.unsettledAttempts, locale)}</small>
            </div>
            <div className={css.metric}>
              <b>{compact(tokenTotal, locale)}</b>
              <span>{t('analyticsTokens')}</span>
              <small>{t('analyticsInput')} {compact(counts.inputTokens, locale)} · {t('analyticsOutput')} {compact(counts.outputTokens, locale)} · {t('analyticsCacheRead')} {compact(counts.cacheReadTokens, locale)}</small>
            </div>
            <div className={css.metric}>
              <b>{counts.pricedRequests === 0 ? '-' : usd(counts.estimatedMicroUsd, locale)}</b>
              <span>{t('analyticsSpend')}</span>
              <small>{t('analyticsPriced')} {number(counts.pricedRequests, locale)} · {t('analyticsUnpriced')} {number(counts.unpricedRequests, locale)}</small>
            </div>
            <div className={css.metric}>
              <b>{number(report.coverage.scannedSessions, locale)} / {number(report.coverage.listedSessions, locale)}</b>
              <span>{t('analyticsCoverage')}</span>
              <small>{t('analyticsSessions')} · {t('analyticsSeconds')} {(report.coverage.scanMs / 1000).toFixed(1)}
                {report.coverage.failedSessions > 0 ? ' · ' + t('analyticsFailedSessions') + ' ' + number(report.coverage.failedSessions, locale) : ''}</small>
            </div>
          </div>

          {empty ? <p className={css.empty}>{t('analyticsEmpty')}</p> : null}

          {report.byModel.length > 0 ? <section className={css.block}>
            <div className={css.blockHead}>
              <h3>{t('analyticsByModel')}</h3>
              <span>{number(report.byModel.length, locale)}</span>
            </div>
            <div className={css.modelList}>
              {report.byModel.map(row => {
                const share = maxModelSpend === 0 ? 0 : row.estimatedMicroUsd / maxModelSpend * 100
                return <article className={css.model} key={row.model}>
                  <div className={css.modelTop}>
                    <div className={css.modelName}>
                      <b>{row.name ?? row.model}</b>
                      {row.name !== undefined ? <span>{row.model}</span> : null}
                    </div>
                    <strong className={css.modelSpend}>{row.pricedRequests === 0 ? '-' : usd(row.estimatedMicroUsd, locale)}</strong>
                  </div>
                  <div className={css.modelFacts}>
                    <span>{t('analyticsRequests')} {number(row.requests, locale)}</span>
                    <span>{t('analyticsInput')} {compact(row.inputTokens, locale)}</span>
                    <span>{t('analyticsOutput')} {compact(row.outputTokens, locale)}</span>
                    <span>{t('analyticsCacheRead')} {compact(row.cacheReadTokens, locale)}</span>
                    {row.missingUsage > 0 ? <span>{t('analyticsMissing')} {number(row.missingUsage, locale)}</span> : null}
                    {row.unpricedRequests > 0 ? <span>{t('analyticsUnpriced')} {number(row.unpricedRequests, locale)}</span> : null}
                    <em className={css.modelLimit}>{limitLabel(row, t, locale)}</em>
                  </div>
                  <div className={css.modelBar} aria-hidden="true"><i style={{ width: share + '%' }} /></div>
                </article>
              })}
            </div>
          </section> : null}

          {report.byDay.length > 0 ? <section className={css.block}>
            <div className={css.blockHead}>
              <h3>{t('analyticsByDay')}</h3>
              <div className={css.segSmall} role="group" aria-label={t('analyticsByDay')}>
                <button type="button" aria-pressed={chartMode === 'spend'} onClick={() => { setChartMode('spend') }}>
                  {t('analyticsChartSpend')}
                </button>
                <button type="button" aria-pressed={chartMode === 'tokens'} onClick={() => { setChartMode('tokens') }}>
                  {t('analyticsChartTokens')}
                </button>
              </div>
            </div>
            <div className={css.chart} role="img" aria-label={t('analyticsByDay')}>
              <div className={css.bars}>
                {report.byDay.map((row, index) => {
                  const value = chartMode === 'spend' ? row.estimatedMicroUsd : row.tokens
                  const height = maxDayValue === 0 ? 0 : Math.max(2, value / maxDayValue * 100)
                  const showLabel = index === 0 || index === report.byDay.length - 1 || index % labelStep === 0
                  const title = row.day + ' · ' + t('analyticsRequests') + ' ' + number(row.requests, locale)
                    + ' · ' + compact(row.tokens, locale) + ' · ' + usd(row.estimatedMicroUsd, locale)
                  return <div className={css.bar} key={row.day} title={title}>
                    <i style={{ height: height + '%' }} />
                    {showLabel ? <b>{row.day.slice(5).replace('-', '/')}</b> : null}
                  </div>
                })}
              </div>
            </div>
          </section> : null}

          <footer className={css.foot}>
            <div className={css.footLine}>
              <span>{t('analyticsPriceSource')} models.dev{report.pricing.updatedAt === undefined ? '' : ' · ' + new Date(report.pricing.updatedAt).toLocaleString(locale)}</span>
              <span>{t('analyticsLimitSnapshot')} {GO_PLAN_AS_OF}</span>
            </div>
            <p>{t('analyticsNotInvoice')}</p>
            {report.pricing.unavailable === true ? <p>{t('analyticsPricingUnavailable')}</p> : null}
            {report.coverage.legacyRequests > 0 ? <p>{t('analyticsLegacy')} {number(report.coverage.legacyRequests, locale)}</p> : null}
            {report.coverage.truncated ? <div className={css.notice}>
              <span>{t('analyticsTruncated')}</span>
              {maxSessions < 2000 ? <button type="button" className={css.action} disabled={loading}
                onClick={() => { setMaxSessions(value => Math.min(value * 2, 2000)) }}>
                {t('analyticsScanMore')}
              </button> : null}
            </div> : null}
          </footer>
        </>}
      </div>
    </div>
  </Modal>
}
