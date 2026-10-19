import { useEffect, useRef, useState } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AnalyticsQuery, AnalyticsReport, AnalyticsDayRow } from '../analytics-contract.ts'
import type { GoUsage } from '../usage-contract.ts'
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
const TREND_FILL_ID = 'opencode-go-analytics-trend-fill'

/** Composition colors: five token-derived hues, then a neutral tail. */
const MODEL_COLORS: readonly string[] = [
  'var(--go-accent)',
  'var(--go-accent-2)',
  'var(--go-success)',
  'var(--go-warning)',
  'color-mix(in srgb, var(--go-accent) 52%, var(--go-accent-2))',
  'color-mix(in srgb, var(--go-accent-2) 52%, var(--go-danger))',
  'color-mix(in srgb, var(--go-accent) 45%, var(--go-success))',
  'color-mix(in srgb, var(--go-muted) 65%, transparent)',
]

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

/** A box only needs these edges to answer "how far is this point". */
interface Edges { left: number; top: number; right: number; bottom: number }

/**
 * Index of the box nearest to a point, or null when even the closest box is
 * farther than `slop`. Distance is 0 inside the box, so gaps and empty
 * calendar pads stop hovering instead of holding the previous selection.
 */
function nearestIndexWithin(boxes: readonly Edges[], x: number, y: number, slop: number): number | null {
  let best = -1
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index]
    const dx = Math.max(box.left - x, 0, x - box.right)
    const dy = Math.max(box.top - y, 0, y - box.bottom)
    const distance = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best >= 0 && bestDistance <= slop ? best : null
}

/** How far outside a calendar cell the pointer may still select it. */
const HEAT_HOVER_SLOP = 5

/** Fill braced placeholders the same way the Host locale does. */
function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match)
}

/** Axis top rounded to 1/2/2.5/5 x 10^n so labels stay readable. */
function niceTop(value: number): number {
  if (!(value > 0)) return 1
  const exponent = Math.pow(10, Math.floor(Math.log10(value)))
  const fraction = value / exponent
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return step * exponent
}

function dayOfWeek(day: string): number {
  return (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7
}

function weekdayHeads(locale?: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2026, 2, 2 + index))))
}

/** Short weekday for one YYYY-MM-DD bucket, e.g. "Tue" / "周二". */
function weekdayLabel(day: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(day + 'T00:00:00Z'))
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

/** One sentence that states what the range cost; numbers stay in one text node. */
function leadFor(report: AnalyticsReport, t: (key: AnalyticsKey) => string, locale?: string): string {
  const totals = report.totals
  const tokenTotal = totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  const base = fill(t('analyticsLead'), {
    requests: number(totals.requests, locale),
    tokens: compact(tokenTotal, locale),
    spend: usd(totals.estimatedMicroUsd, locale),
  })
  if (totals.estimatedMicroUsd <= 0) return base
  const top = [...report.byModel].sort((left, right) => right.estimatedMicroUsd - left.estimatedMicroUsd)[0]
  if (top === undefined || top.estimatedMicroUsd <= 0) return base
  return base + ' ' + fill(t('analyticsLeadTop'), {
    model: top.name ?? top.model,
    share: (top.estimatedMicroUsd / totals.estimatedMicroUsd * 100).toFixed(1) + '%',
  })
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
  const unsupported = error !== null && isUnsupported(error)
  const empty = report !== null && report.totals.requests === 0
  // P19: the range note follows the current selection, also while a scan for
  // it is still running, so the old report never relabels itself as new.
  const selected = queryFor(range, maxSessions, toRef.current)
  const rangeText = new Date(selected.from).toLocaleDateString(locale) + ' – '
    + new Date(selected.to - 1).toLocaleDateString(locale)
  const colorFor = (model: string): string => {
    const index = report === null ? -1 : report.byModel.findIndex(row => row.model === model)
    return MODEL_COLORS[(index < 0 ? 0 : index) % MODEL_COLORS.length]
  }

  return <Modal open={open} onClose={onClose} title={t('analyticsTitle')} headless className={css.shell}>
    <div className={css.card} style={themeStyle(tokens)} aria-busy={loading}>
      <div className={css.scroll}>
        <header>
          <div className={css.top}>
            <span className={css.kicker}>OpenCode Go · {t('analyticsKicker')}</span>
            <span className={css.meta}>
              {report !== null ? t('usageLastUpdated') + ' ' + new Date(report.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div className={css.titleRow}>
            <h1 className={css.title}>{t('analyticsTitle')}</h1>
            <div className={css.actions}>
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
          </div>
          {report !== null ? <p className={css.lead}>{leadFor(report, t, locale)}</p> : null}
          <div className={css.toolbar}>
            <div className={css.tabs} role="group" aria-label={t('analyticsRange')}>
              {RANGES.map(item => <button
                key={item.key}
                type="button"
                aria-pressed={range === item.key}
                onClick={() => { setRange(item.key) }}
              >{t(item.label)}</button>)}
            </div>
            {loading && report !== null ? <span className={css.stale}>{t('analyticsStaleResults')}</span> : null}
            {toRef.current > 0 ? <span className={css.period}>{rangeText}</span> : null}
          </div>
        </header>

        {error !== null && <div className={css.error} role="alert">
          <p>{unsupported ? t('analyticsUnsupported') : t('analyticsFailed')}</p>
          {!unsupported && <button type="button" className={css.action} onClick={() => {
            forceRef.current = true; toRef.current = Date.now(); setRevision(value => value + 1)
          }}>
            {t('analyticsRetry')}
          </button>}
        </div>}

        {loading && report === null && error === null && <p className={css.loading} role="status">{t('analyticsLoading')}</p>}

        {report !== null && counts !== undefined ? <KpiBand report={report} locale={locale} t={t} /> : null}

        {quota !== null
          ? <QuotaSection quota={quota} locale={locale} t={t} />
          : quotaFailed ? <p className={css.quotaFailed}>{t('analyticsQuotaFailed')}</p> : null}

        {report !== null && counts !== undefined && <>
          {empty ? <p className={css.empty}>{t('analyticsEmpty')}</p> : null}
          <Composition report={report} locale={locale} t={t} colorFor={colorFor} />
          <ModelTable report={report} locale={locale} t={t} colorFor={colorFor} />
          <DaySection report={report} mode={chartMode} onMode={setChartMode} locale={locale} t={t} />
          <Footer report={report} locale={locale} t={t} maxSessions={maxSessions}
            loading={loading} onScanMore={() => { applyMaxSessions(Math.min(maxSessions * 2, MAX_SESSIONS_CEILING)) }} />
        </>}
      </div>
    </div>
  </Modal>
}

/* ---------- shared props ---------- */

interface CopyProps {
  locale?: string
  t: (key: AnalyticsKey) => string
}

function KpiBand({ report, locale, t }: CopyProps & { report: AnalyticsReport }) {
  const totals = report.totals
  const coverage = report.coverage
  const tokenTotal = totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  const cacheShare = tokenTotal === 0 ? 0 : totals.cacheReadTokens / tokenTotal * 100
  const spanDays = Math.max(1, Math.ceil((report.range.to - report.range.from) / 86_400_000))
  const daily = Math.round(totals.requests / spanDays)
  return <section className={css.band}>
    <div className={css.kpi}>
      <span className={css.kpiLabel}>{t('analyticsRequests')}</span>
      <b className={css.kpiValue}>{number(totals.requests, locale)}</b>
      <span className={css.kpiNote}>
        {t('analyticsDailyAverage')} {number(daily, locale)} · {t('analyticsSummaries')} {number(totals.summaries, locale)} · {t('analyticsUnsettled')} {number(totals.unsettledAttempts, locale)}
      </span>
    </div>
    <div className={css.kpi}>
      <span className={css.kpiLabel}>{t('analyticsTokens')}</span>
      <b className={css.kpiValue}>{compact(tokenTotal, locale)}</b>
      <span className={css.kpiNote}>
        {t('analyticsInput')} {compact(totals.inputTokens, locale)} · {t('analyticsOutput')} {compact(totals.outputTokens, locale)}<br />
        {t('analyticsCacheRead')} {compact(totals.cacheReadTokens, locale)} · {cacheShare.toFixed(1)}% {t('analyticsCacheHit')}
      </span>
    </div>
    <div className={css.kpi}>
      <span className={css.kpiLabel}>{t('analyticsSpend')}</span>
      <b className={css.kpiValue}>{totals.pricedRequests === 0 ? '-' : usd(totals.estimatedMicroUsd, locale)}</b>
      <span className={css.kpiNote}>
        {t('analyticsPriced')} {number(totals.pricedRequests, locale)} · <span className={css.warn}>{t('analyticsUnpriced')} {number(totals.unpricedRequests, locale)}</span><br />
        {t('analyticsMissing')} {number(totals.missingUsage, locale)}
      </span>
    </div>
    <div className={css.kpi}>
      <span className={css.kpiLabel}>{t('analyticsCoverage')}</span>
      <b className={css.kpiValue}>{number(coverage.scannedSessions, locale)}<em> / {number(coverage.listedSessions, locale)}</em></b>
      <span className={css.kpiNote}>
        {t('analyticsFailedSessions')} {number(coverage.failedSessions, locale)} · {t('analyticsSeconds')} {(coverage.scanMs / 1000).toFixed(1)}s
      </span>
    </div>
  </section>
}

function QuotaSection({ quota, locale, t }: CopyProps & { quota: GoUsage }) {
  const windows = [
    { key: 'rolling', label: t('usage_rolling'), window: quota.rolling },
    { key: 'weekly', label: t('usage_weekly'), window: quota.weekly },
    { key: 'monthly', label: t('usage_monthly'), window: quota.monthly },
  ] as const
  return <section className={css.sec}>
    <div className={css.secHead}>
      <h2>{t('analyticsQuota')}</h2>
      <span className={css.secHint}>{t('analyticsQuotaHint')}</span>
    </div>
    <div className={css.quotaGrid}>
      {windows.map(({ key, label, window }) => {
        const limited = window.status === 'rate-limited'
        const percent = Math.min(100, Math.max(0, window.percent))
        const state = limited || percent >= 100 ? 'full' : percent >= 80 ? 'high' : 'ok'
        return <div className={css.quota} data-state={state} key={key}>
          <div className={css.qTop}><span className={css.qLabel}>{label}</span></div>
          <b className={css.qValue}>{window.percent}%</b>
          <div className={css.qTrack} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(window.percent)}>
            <i className={css.qFill} style={{ width: percent + '%' }} />
            <span className={css.qTick} />
          </div>
          <div className={css.qFoot}>
            <span>{t('usageResets')} {new Date(window.resetsAt).toLocaleString(locale)}</span>
          </div>
          {limited ? <div className={css.qWarn}>{t('usageLimited')}</div> : null}
        </div>
      })}
    </div>
  </section>
}

function Composition({ report, locale, t, colorFor }: CopyProps & { report: AnalyticsReport; colorFor: (model: string) => string }) {
  const total = report.totals.estimatedMicroUsd
  const priced = report.byModel
    .filter(row => row.estimatedMicroUsd > 0)
    .sort((left, right) => right.estimatedMicroUsd - left.estimatedMicroUsd)
  if (total <= 0 || priced.length === 0) return null
  const top = priced.slice(0, 5)
  const rest = priced.slice(5)
  const restValue = rest.reduce((sum, row) => sum + row.estimatedMicroUsd, 0)
  const unpriced = report.byModel.filter(row => row.pricedRequests === 0 && row.requests > 0)
  const unpricedNames = unpriced.slice(0, 4).map(row => row.name ?? row.model)
  return <section className={css.sec}>
    <div className={css.secHead}>
      <h2>{t('analyticsComposition')}</h2>
      <span className={css.secHint}>{t('analyticsCompositionHint')}</span>
    </div>
    <div className={css.compBar} role="img" aria-label={t('analyticsComposition')}>
      {top.map(row => <i key={row.model} className={css.compSeg}
        style={{ width: (row.estimatedMicroUsd / total * 100) + '%', background: colorFor(row.model) }}
        title={(row.name ?? row.model) + ' · ' + usd(row.estimatedMicroUsd, locale) + ' · ' + (row.estimatedMicroUsd / total * 100).toFixed(1) + '%'} />)}
      {rest.length > 0 ? <i className={css.compSeg} style={{ width: (restValue / total * 100) + '%', background: 'var(--go-muted)' }}
        title={fill(t('analyticsCompositionOther'), { count: String(rest.length) }) + ' · ' + usd(restValue, locale)} /> : null}
    </div>
    <div className={css.compLegend}>
      {top.map(row => <div className={css.compItem} key={row.model}>
        <i className={css.compDot} style={{ background: colorFor(row.model) }} />
        <span className={css.compText}>{row.name ?? row.model}<b>{usd(row.estimatedMicroUsd, locale)}<em>{(row.estimatedMicroUsd / total * 100).toFixed(1)}%</em></b></span>
      </div>)}
      {rest.length > 0 ? <div className={css.compItem}>
        <i className={css.compDot} style={{ background: 'var(--go-muted)' }} />
        <span className={css.compText}>{fill(t('analyticsCompositionOther'), { count: String(rest.length) })}<b>{usd(restValue, locale)}<em>{(restValue / total * 100).toFixed(1)}%</em></b></span>
      </div> : null}
    </div>
    {unpriced.length > 0 ? <p className={css.compNote}>
      {t('analyticsCompositionFree')} {unpricedNames.join(' · ')}{unpriced.length > unpricedNames.length ? ' +' + (unpriced.length - unpricedNames.length) : ''}
    </p> : null}
  </section>
}

function ModelTable({ report, locale, t, colorFor }: CopyProps & { report: AnalyticsReport; colorFor: (model: string) => string }) {
  if (report.byModel.length === 0) return null
  const total = report.totals.estimatedMicroUsd
  return <section className={css.sec}>
    <div className={css.secHead}>
      <h2>{t('analyticsByModel')}</h2>
      <span className={css.secHint}>{number(report.byModel.length, locale)}</span>
    </div>
    <table className={css.table}>
      <thead>
        <tr>
          <th>{t('analyticsModel')}</th>
          <th>{t('analyticsRequests')}</th>
          <th>{t('analyticsInput')}</th>
          <th>{t('analyticsOutput')}</th>
          <th>{t('analyticsCacheRead')}</th>
          <th>{t('analyticsCost')}</th>
          <th>{t('analyticsShare')}</th>
        </tr>
      </thead>
      <tbody>
        {report.byModel.map(row => {
          const share = total === 0 ? 0 : row.estimatedMicroUsd / total * 100
          const unpriced = row.pricedRequests === 0 && row.requests > 0
          return <tr key={row.model}>
            <td>
              <span className={css.nameCell}>
                <i className={css.mDot} style={{ background: colorFor(row.model) }} />
                <b className={css.mName}>{row.name ?? row.model}</b>
              </span>
            </td>
            <td>{number(row.requests, locale)}</td>
            <td className={css.dim}>{compact(row.inputTokens, locale)}</td>
            <td className={css.dim}>{compact(row.outputTokens, locale)}</td>
            <td className={css.dim}>{compact(row.cacheReadTokens, locale)}</td>
            <td className={css.spend}>{unpriced ? <span className={css.tag}>{t('analyticsUnpriced')}</span> : usd(row.estimatedMicroUsd, locale)}</td>
            <td>
              <span className={css.shareCell}>
                {unpriced
                  ? <span className={css.dim}>—</span>
                  : <>
                    <span className={css.shareBar}><i style={{ width: share + '%' }} /></span>
                    <span className={css.shareValue}>{share.toFixed(1)}%</span>
                  </>}
              </span>
            </td>
          </tr>
        })}
      </tbody>
    </table>
  </section>
}

function DaySection({ report, mode, onMode, locale, t }: CopyProps & { report: AnalyticsReport; mode: ChartMode; onMode: (mode: ChartMode) => void }) {
  const days = report.byDay
  // Hover state is shared by the calendar and the trend so both highlight the
  // same bucket; the tooltip follows the pointer inside the day wrapper.
  const [hover, setHover] = useState<{ index: number; left: number; top: number; below: boolean } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const heatRef = useRef<HTMLDivElement>(null)
  if (days.length === 0) return null
  const valueOf = (day: AnalyticsDayRow): number => mode === 'spend' ? day.estimatedMicroUsd : day.tokens
  const format = (value: number): string => mode === 'spend' ? usd(value, locale) : compact(value, locale)
  const values = days.map(valueOf)
  const max = Math.max(0, ...values)
  const top = niceTop(max)
  const total = values.reduce((sum, value) => sum + value, 0)
  const average = total / days.length
  const peakIndex = values.indexOf(max)
  const width = 560
  const height = 132
  const padLeft = 50
  const padRight = 4
  const axisY = 106
  const xOf = (index: number): number => days.length === 1
    ? padLeft + (width - padLeft - padRight) / 2
    : padLeft + index / (days.length - 1) * (width - padLeft - padRight)
  const yOf = (value: number): number => axisY - (top === 0 ? 0 : value / top) * (axisY - 12)
  const showHover = (index: number, event: { clientX: number; clientY: number }): void => {
    const box = wrapRef.current?.getBoundingClientRect()
    const wrapWidth = box === undefined ? 0 : box.width
    const x = box === undefined ? 0 : event.clientX - box.left
    const y = box === undefined ? 0 : event.clientY - box.top
    const below = y < 92
    setHover({
      index,
      left: Math.min(Math.max(x + 12, 8), Math.max(wrapWidth - 190, 8)),
      top: below ? y + 18 : y - 12,
      below,
    })
  }
  const showHeatHover = (event: { clientX: number; clientY: number }): void => {
    const heat = heatRef.current
    if (heat === null) {
      setHover(null)
      return
    }
    const boxes = Array.from(heat.querySelectorAll<HTMLElement>('[data-day]'), cell => cell.getBoundingClientRect())
    const index = nearestIndexWithin(boxes, event.clientX, event.clientY, HEAT_HOVER_SLOP)
    if (index === null) setHover(null)
    else showHover(index, event)
  }
  const line = days.map((day, index) => (index === 0 ? 'M' : 'L') + xOf(index).toFixed(1) + ' ' + yOf(valueOf(day)).toFixed(1)).join(' ')
  const area = days.length > 1
    ? line + ' L' + xOf(days.length - 1).toFixed(1) + ' ' + axisY + ' L' + xOf(0).toFixed(1) + ' ' + axisY + ' Z'
    : ''
  const heatHeads = weekdayHeads(locale)
  const offset = dayOfWeek(days[0].day)
  const headCell = heatHeads.map((head, index) => <span className={css.heatDay} key={'h' + index}>{head}</span>)
  const pads = Array.from({ length: offset }, (_, index) => <span className={css.heatPad} key={'p' + index} />)
  const cells = days.map((day, index) => {
    const ratio = max === 0 ? 0 : valueOf(day) / max
    const lightness = Math.round(12 + ratio * 88)
    return <span key={day.day} className={css.heatCell} data-day={day.day}
      data-active={hover?.index === index ? '' : undefined}
      role="img"
      aria-label={day.day + ' · ' + usd(day.estimatedMicroUsd, locale) + ' · ' + compact(day.tokens, locale) + ' tokens'}
      style={{ background: 'color-mix(in srgb, var(--go-accent) ' + lightness + '%, var(--go-surface-2))' }} />
  })
  const labels = [0, 0.5, 1].map(ratio => <text key={ratio} x={padLeft - 8} y={yOf(top * ratio) + 3} textAnchor="end">{format(ratio === 0 ? 0 : Math.round(top * ratio))}</text>)
  const xLabels = days.map((day, index) => {
    if (!(index === 0 || index === days.length - 1 || index % 6 === 0)) return null
    const anchor = index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'
    const x = index === 0 ? padLeft : index === days.length - 1 ? width - padRight : xOf(index)
    return <text key={day.day} x={x} y={height - 4} textAnchor={anchor}>{day.day.slice(5).replace('-', '/')}</text>
  })
  const hovered = hover === null ? undefined : days[hover.index]
  const hitWidth = Math.max((width - padLeft - padRight) / Math.max(days.length, 1), 6)
  const hitRects = days.map((day, index) => {
    const x = Math.min(Math.max(xOf(index) - hitWidth / 2, padLeft), width - padRight - hitWidth)
    return <rect key={'hit-' + day.day} data-day={day.day} className={css.trendHit}
      x={x} y={8} width={hitWidth} height={axisY - 8} onMouseMove={(event) => showHover(index, event)} />
  })
  return <section className={css.sec} style={{ borderBottom: '0', paddingBottom: 0 }}>
    <div className={css.secHead}>
      <h2>{t('analyticsByDay')}</h2>
      <div className={css.seg} role="group" aria-label={t('analyticsByDay')}>
        <button type="button" aria-pressed={mode === 'spend'} onClick={() => onMode('spend')}>{t('analyticsChartSpend')}</button>
        <button type="button" aria-pressed={mode === 'tokens'} onClick={() => onMode('tokens')}>{t('analyticsChartTokens')}</button>
      </div>
    </div>
    <div className={css.daysWrap} ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <div className={css.heat} role="group" aria-label={t('analyticsByDay')} ref={heatRef}
        onMouseMove={showHeatHover} onMouseLeave={() => setHover(null)}>{headCell}{pads}{cells}</div>
      <div className={css.trend}>
        <svg className={css.trendSvg} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={t('analyticsByDay')}
          onMouseMove={(event) => { if ((event.target as Element).closest('[data-day]') === null) setHover(null) }}
          onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={TREND_FILL_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--go-accent)" stopOpacity="0.26" />
              <stop offset="1" stopColor="var(--go-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line className={css.trendGrid} x1={padLeft} x2={width - padRight} y1={yOf(top * 0.5)} y2={yOf(top * 0.5)} />
          <line className={css.trendBase} x1={padLeft} x2={width - padRight} y1={axisY} y2={axisY} />
          {labels}
          {hover !== null ? <line className={css.trendGuide} x1={xOf(hover.index)} x2={xOf(hover.index)} y1={8} y2={axisY} /> : null}
          {area !== '' ? <path className={css.trendArea} d={area} style={{ fill: 'url(#' + TREND_FILL_ID + ')' }} /> : null}
          <path className={css.trendLine} d={line} />
          <circle className={css.trendPeak} cx={xOf(peakIndex)} cy={yOf(max)} r="3" />
          <text x={xOf(peakIndex)} y={yOf(max) - 8} textAnchor="middle" style={{ fill: 'var(--go-text)', fontWeight: 600 }}>{format(max)}</text>
          {hover !== null && hovered !== undefined ? <circle className={css.trendFocus} cx={xOf(hover.index)} cy={yOf(valueOf(hovered))} r="3.2" /> : null}
          {xLabels}
          {hitRects}
        </svg>
        <div className={css.trendFoot}>
          <span>{t('analyticsPeak')} <b>{days[peakIndex].day.slice(5).replace('-', '/')}</b> · {format(max)} · {number(days[peakIndex].requests, locale)} {t('analyticsRequests')}</span>
          <span>{t('analyticsTotal')} <b>{format(total)}</b> · {t('analyticsDailyAverage')} <b>{format(Math.round(average))}</b></span>
        </div>
      </div>
      {hover !== null && hovered !== undefined ? <div className={css.dayTip} role="tooltip"
        style={{ left: hover.left, top: hover.top, transform: hover.below ? 'none' : 'translateY(-100%)' }}>
        <div className={css.dayTipHead}>
          <b>{hovered.day.slice(5).replace('-', '/')}</b>
          <span>{weekdayLabel(hovered.day, locale)}</span>
        </div>
        <div className={css.dayTipValue}>{usd(hovered.estimatedMicroUsd, locale)}</div>
        <div className={css.dayTipMeta}>
          {number(hovered.requests, locale)} {t('analyticsRequests')} · {compact(hovered.tokens, locale)} {t('analyticsTokens')}
        </div>
      </div> : null}
    </div>
  </section>
}

function Footer({ report, locale, t, maxSessions, loading, onScanMore }: CopyProps & {
  report: AnalyticsReport
  maxSessions: number
  loading: boolean
  onScanMore: () => void
}) {
  const coverage = report.coverage
  return <footer className={css.foot}>
    {coverage.truncated ? <div className={css.notice}>
      <span>{t('analyticsTruncated')}</span>
      {maxSessions < MAX_SESSIONS_CEILING ? <button type="button" className={css.action} disabled={loading} onClick={onScanMore}>
        {t('analyticsScanMore')}
      </button> : null}
    </div> : null}
    <div className={css.footCol}>
      <p>{t('analyticsPriceSource')} models.dev{report.pricing.updatedAt === undefined ? '' : ' · ' + new Date(report.pricing.updatedAt).toLocaleString(locale)}</p>
      <p>{t('analyticsNotInvoice')}</p>
      {report.pricing.unavailable === true ? <p>{t('analyticsPricingUnavailable')}</p> : null}
    </div>
    <div className={css.footCol}>
      {coverage.listMs !== undefined && coverage.pricingMs !== undefined
        ? <p>{t('analyticsScanSegments')} {number(coverage.listMs, locale)} / {number(coverage.scanMs, locale)} / {number(coverage.pricingMs, locale)} ms</p>
        : null}
      {coverage.legacyRequests > 0 ? <p>{t('analyticsLegacy')} {number(coverage.legacyRequests, locale)}</p> : null}
      {coverage.unattributedRequests !== undefined && coverage.unattributedRequests > 0
        ? <p>{t('analyticsUnattributed')} {number(coverage.unattributedRequests, locale)}</p> : null}
      {coverage.unreadSessions !== undefined && coverage.unreadSessions > 0
        ? <p>{t('analyticsUnread')} {number(coverage.unreadSessions, locale)}</p> : null}
    </div>
  </footer>
}
