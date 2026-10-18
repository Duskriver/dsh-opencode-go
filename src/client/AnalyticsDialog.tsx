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

/** The scan cap persists under the plugin's own namespace (review P16/S9). */
const MAX_SESSIONS_STORAGE_KEY = 'opencode-go:analytics:maxSessions'
const DEFAULT_MAX_SESSIONS = 500
const MAX_SESSIONS_CEILING = 2000

function loadMaxSessions(): number {
  try {
    const raw = globalThis.localStorage?.getItem(MAX_SESSIONS_STORAGE_KEY)
    if (raw === null || raw === undefined) return DEFAULT_MAX_SESSIONS
    const value = Number(raw)
    if (!Number.isSafeInteger(value)) return DEFAULT_MAX_SESSIONS
    return Math.min(MAX_SESSIONS_CEILING, Math.max(1, value))
  } catch {
    return DEFAULT_MAX_SESSIONS
  }
}

function saveMaxSessions(value: number): void {
  try { globalThis.localStorage?.setItem(MAX_SESSIONS_STORAGE_KEY, String(value)) } catch { /* private mode */ }
}

function startOfLocalDay(now: Date): number {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

function resolvedTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** The window end is frozen once per open (review P5/S5) and passed in here. */
function queryFor(range: RangeKey, maxSessions: number, to: number): AnalyticsQuery {
  const now = new Date(to)
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

/** An abort-caused rejection must never render as an error banner (review M4). */
function isCancellation(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false
  if ((error as { name?: unknown }).name === 'AbortError') return true
  return (error as { code?: unknown }).code === 'gateway/cancelled'
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

export interface AnalyticsDialogProps {
  open: boolean
  onClose: () => void
  /** The signal reaches the Host's cancellation parameter (review M4). */
  readAnalytics: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>
  readQuota?: () => Promise<GoUsage>
  t: (key: AnalyticsKey) => string
  getLocale?: () => string
}

/**
 * Shared usage dashboard, opened from the composer pill and the settings card.
 * It scans only when opened or when the range asks for it; closing the modal
 * aborts the request. The window end is frozen once per open, so repeated
 * requests inside one open share the Host's dedup key (review P5/S5), a range
 * already seen in this open renders instantly and revalidates in the
 * background (review P17), and while a scan runs the previous results stay
 * visible under the newly selected range with an explicit annotation
 * (review P19). Every number shown here comes from the same Host report as
 * before; only the presentation and the palette are new.
 */
export function AnalyticsDialog({ open, onClose, readAnalytics, readQuota, t, getLocale }: AnalyticsDialogProps) {
  const [range, setRange] = useState<RangeKey>('30d')
  const [maxSessions, setMaxSessions] = useState(loadMaxSessions)
  const [revision, setRevision] = useState(0)
  const [chartMode, setChartMode] = useState<ChartMode>('spend')
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [quota, setQuota] = useState<GoUsage | null>(null)
  const [quotaFailed, setQuotaFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const generation = useRef(0)
  // The window end is frozen once per open and only moves on refresh (P5/S5);
  // refs so the effects read the freshest value without re-render loops.
  const toRef = useRef(0)
  const forceRef = useRef(false)
  // Reports this open already fetched, keyed by the exact query (P17).
  const reportsRef = useRef(new Map<string, AnalyticsReport>())
  const analyticsRef = useRef(readAnalytics)
  const quotaRef = useRef(readQuota)
  analyticsRef.current = readAnalytics
  quotaRef.current = readQuota
  const tokens = useGoThemeTokens()
  const locale = getLocale?.()

  // Declared before the scan effect so the same-commit open transition freezes
  // the window end and clears the per-open cache before the scan reads them.
  useEffect(() => {
    if (!open) return
    toRef.current = Date.now()
    reportsRef.current.clear()
  }, [open])

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
    const controller = new AbortController()
    const id = ++generation.current
    const force = forceRef.current
    forceRef.current = false
    const query = queryFor(range, maxSessions, toRef.current)
    const key = JSON.stringify(query)
    const cached = reportsRef.current.get(key)
    // P17: a range this open already fetched renders immediately, then the RPC
    // below revalidates it; the refresh button skips the cached copy.
    if (cached !== undefined && !force) setReport(cached)
    setError(null)
    setLoading(true)
    void analyticsRef.current(query, controller.signal)
      .then(next => {
        if (stopped || id !== generation.current) return
        reportsRef.current.set(key, next)
        setReport(next)
      })
      .catch((reason: unknown) => {
        if (stopped || id !== generation.current) return
        if (controller.signal.aborted || isCancellation(reason)) return
        setError(reason)
      })
      .finally(() => {
        if (!stopped && id === generation.current) setLoading(false)
      })
    return () => { stopped = true; controller.abort() }
  }, [open, range, maxSessions, revision])

  const applyMaxSessions = (value: number): void => {
    setMaxSessions(value)
    saveMaxSessions(value)
  }

  const counts = report?.totals
  const tokenTotal = counts === undefined ? 0
    : counts.inputTokens + counts.outputTokens + counts.cacheReadTokens + counts.cacheWriteTokens
  const maxModelSpend = report === null ? 0 : Math.max(0, ...report.byModel.map(row => row.estimatedMicroUsd))
  const maxDayValue = report === null ? 0 : Math.max(0, ...report.byDay.map(row =>
    chartMode === 'spend' ? row.estimatedMicroUsd : row.tokens))
  const unsupported = error !== null && isUnsupported(error)
  const empty = report !== null && report.totals.requests === 0
  // P19: the range note follows the current selection, also while a scan for
  // it is still running, so the old report never relabels itself as new.
  const selected = queryFor(range, maxSessions, toRef.current)
  const rangeText = new Date(selected.from).toLocaleDateString(locale) + ' – '
    + new Date(selected.to - 1).toLocaleDateString(locale)
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
            disabled={loading}
            onClick={() => { forceRef.current = true; toRef.current = Date.now(); setRevision(value => value + 1) }}>
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
        {toRef.current > 0 ? <span className={css.rangeNote}>{rangeText}</span> : null}
        {loading && report !== null ? <span className={css.rangeNote}>{t('analyticsStaleResults')}</span> : null}
      </div>

      <div className={css.scroll}>
        {error !== null && <div className={css.error} role="alert">
          <p>{unsupported ? t('analyticsUnsupported') : t('analyticsFailed')}</p>
          {!unsupported && <button type="button" className={css.action} onClick={() => {
            forceRef.current = true; toRef.current = Date.now(); setRevision(value => value + 1)
          }}>
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
            {report.coverage.unattributedRequests !== undefined && report.coverage.unattributedRequests > 0
              ? <p>{t('analyticsUnattributed')} {number(report.coverage.unattributedRequests, locale)}</p> : null}
            {report.coverage.unreadSessions !== undefined && report.coverage.unreadSessions > 0
              ? <p>{t('analyticsUnread')} {number(report.coverage.unreadSessions, locale)}</p> : null}
            {report.coverage.listMs !== undefined && report.coverage.pricingMs !== undefined
              ? <p>{t('analyticsScanSegments')} {number(report.coverage.listMs, locale)} / {number(report.coverage.scanMs, locale)} / {number(report.coverage.pricingMs, locale)} ms</p> : null}
            {report.coverage.truncated ? <div className={css.notice}>
              <span>{t('analyticsTruncated')}</span>
              {maxSessions < MAX_SESSIONS_CEILING ? <button type="button" className={css.action} disabled={loading}
                onClick={() => { applyMaxSessions(Math.min(maxSessions * 2, MAX_SESSIONS_CEILING)) }}>
                {t('analyticsScanMore')}
              </button> : null}
            </div> : null}
          </footer>
        </>}
      </div>
    </div>
  </Modal>
}
