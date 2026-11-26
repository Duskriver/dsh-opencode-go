/** Official workspace history, built from a single Console snapshot. */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { DEFAULT_OPENCODE_GO_THEME, type AnalyticsDayRow, type AnalyticsExport, type AnalyticsModelRow, type AnalyticsQuery, type AnalyticsRange, type AnalyticsReport, type AnalyticsTotals, type GoAccount, type GoUsage, type OpencodeGoTheme } from '../contracts.ts'
import { themeStyle, useGoThemeTokens, type en } from './presentation.ts'
import css from './AnalyticsDialog.module.css'

type Metric = 'tokens' | 'requests' | 'costMicroCents'
type TokenPart = typeof PARTS[number]
type SortField = keyof AnalyticsTotals | 'cacheHitRate'
/** The locale translate seat; every visible string in this dialog comes from it. */
type AnalyticsTranslate = (key: keyof typeof en) => string
const RANGES: AnalyticsRange[] = ['today', '7d', '30d', '90d']
const RANGE_LABELS = { today: 'analyticsRangeToday', '7d': 'analyticsRange7d', '30d': 'analyticsRange30d', '90d': 'analyticsRange90d' } as const satisfies Record<AnalyticsRange, keyof typeof en>
const PARTS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const
const LABELS = {
  inputTokens: 'analyticsInput', outputTokens: 'analyticsOutput',
  cacheReadTokens: 'analyticsCacheRead', cacheWriteTokens: 'analyticsCacheWrite',
} as const satisfies Record<TokenPart, keyof typeof en>
const WINDOW_LABELS = { rolling: 'usage_rolling', weekly: 'usage_weekly', monthly: 'usage_monthly' } as const satisfies Record<'rolling' | 'weekly' | 'monthly', keyof typeof en>

const numberFormatters = new Map<string, Intl.NumberFormat>()
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

function getNumberFormat(locale?: string, compact = false): Intl.NumberFormat {
  const key = `${locale ?? ''}:${compact ? 'compact' : 'standard'}`
  let fmt = numberFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, compact ? { notation: 'compact', maximumFractionDigits: 1 } : {})
    numberFormatters.set(key, fmt)
  }
  return fmt
}

function getMoneyFormat(locale?: string, digits = 2): Intl.NumberFormat {
  const key = `${locale ?? ''}:money:${digits}`
  let fmt = numberFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
    numberFormatters.set(key, fmt)
  }
  return fmt
}

function getDateTimeFormat(locale: string | undefined, variant: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ''}:${variant}`
  let fmt = dateTimeFormatters.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    dateTimeFormatters.set(key, fmt)
  }
  return fmt
}

export function historyNumber(value: string, locale?: string, compact = false): string {
  return getNumberFormat(locale, compact).format(BigInt(value))
}

/** Keep micro-cents exact through rounding: one dollar is 100,000,000 units. */
export function historyMoney(value: string, locale?: string): string {
  const raw = BigInt(value), digits = raw < 10_000_000n ? 4 : 2
  const unit = 10n ** BigInt(8 - digits), base = 10n ** BigInt(digits)
  const rounded = (raw + unit / 2n) / unit
  const fraction = String(rounded % base).padStart(digits, '0')
  return getMoneyFormat(locale, digits)
    .formatToParts(rounded / base).map(part => part.type === 'fraction' ? fraction : part.value).join('')
}

function percent(part: string, total: string): number { return BigInt(total) === 0n ? 0 : Number(BigInt(part) * 100_000n / BigInt(total)) / 1000 }
function cacheHitRateOf(row: AnalyticsTotals): number {
  const input = BigInt(row.inputTokens) + BigInt(row.cacheReadTokens) + BigInt(row.cacheWriteTokens)
  return input === 0n ? 0 : Number(BigInt(row.cacheReadTokens) * 100_000n / input) / 1000
}
function metricText(row: AnalyticsTotals, metric: Metric, locale?: string): string { return metric === 'costMicroCents' ? historyMoney(row[metric], locale) : historyNumber(row[metric], locale, true) }
function dayText(day: string, locale?: string): string {
  return getDateTimeFormat(locale, 'dayText', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(day + 'T00:00:00Z'))
}
function errorDetails(error: unknown): Record<string, unknown> {
  return error && typeof error === 'object' && 'code' in error && error.code === 'opencode-go/analytics-unavailable' && 'details' in error && error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : {}
}
function errorText(error: unknown, t: AnalyticsTranslate): string {
  const reason = errorDetails(error).reason
  if (reason === 'permission-denied') return t('analyticsPermission')
  if (reason === 'missing-credential' || reason === 'credential-unavailable' || reason === 'unknown-account') return t('analyticsCredentials')
  if (reason === 'unsupported-gateway') return t('analyticsUnsupported')
  if (reason === 'invalid-response') return t('analyticsInvalid')
  return t('analyticsFailed')
}
function Icon({ name }: { name: 'close' | 'refresh' | 'download' | 'chart' }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'close' ? <path d="m5 5 10 10M15 5 5 15" /> : name === 'refresh' ? <><path d="M16.5 9A6.5 6.5 0 1 1 14 4.8" /><path d="M16.5 3v4h-4" /></> : name === 'download' ? <><path d="M10 3v9m-3-3 3 3 3-3M4 13v4h12v-4" /></> : <><path d="M3 3v14h14M6 13V9m4 4V5m4 8V7" /></>}</svg>
}
/** Data and copy the dashboard reads on every surface it is mounted on. */
interface AnalyticsDashboardDataProps {
  readAnalytics: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>
  exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>
  readQuota?: (ref: string) => Promise<GoUsage>
  accounts: readonly GoAccount[]; activeRef: string
  t: AnalyticsTranslate; getLocale?: () => string
  /** Defaults to Native for embedded callers and older tests. */
  theme?: OpencodeGoTheme
}

/**
 * Props of the reusable dashboard. `variant` picks the surface chrome: the
 * dialog keeps its brand row with the close control, while the sidebar page
 * already has its own title, padding and scroll container.
 */
export interface AnalyticsDashboardProps extends AnalyticsDashboardDataProps {
  variant?: 'dialog' | 'page'
  /** Only the dialog surface owns a close action; the page is left via the host. */
  onClose?: () => void
}

export interface AnalyticsDialogProps extends AnalyticsDashboardDataProps {
  open: boolean; onClose: () => void; contextKey?: string | number
}

/** Modal shell kept for every entry point that still opens history as a dialog. */
export function AnalyticsDialog(props: AnalyticsDialogProps) {
  const { open, onClose, contextKey, ...dashboard } = props
  return <Modal open={open} onClose={onClose} title={props.t('analyticsTitle')} headless className={css.shell}>{open ? <AnalyticsDashboard key={contextKey} {...dashboard} variant="dialog" onClose={onClose} /> : null}</Modal>
}

/**
 * The official workspace history dashboard. State, data reads, CSV export and
 * keyboard handling are shared by both surfaces; only the outer box and the
 * dialog-only chrome come from `variant`.
 */
export function AnalyticsDashboard(props: AnalyticsDashboardProps) {
  const { activeRef, accounts, readAnalytics, exportAnalytics, readQuota, onClose, t, getLocale, theme = DEFAULT_OPENCODE_GO_THEME, variant = 'dialog' } = props
  const [selected, setSelected] = useState(activeRef)
  const accountRef = accounts.some(a => a.apiKeyEnv === selected) ? selected : accounts.find(a => a.apiKeyEnv === activeRef)?.apiKeyEnv ?? accounts[0]?.apiKeyEnv ?? ''
  const [range, setRange] = useState<AnalyticsRange>('30d'), [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<{ key: string; value: AnalyticsReport } | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null)
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<{ ref: string; value: GoUsage } | null>(null), [quotaFailed, setQuotaFailed] = useState(false)
  const [exporting, setExporting] = useState(false), [exported, setExported] = useState(false), [exportFailed, setExportFailed] = useState(false)
  const force = useRef(false), exporter = useRef<AbortController | null>(null)
  const exportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const readers = useRef({ readAnalytics, readQuota, exportAnalytics }); readers.current = { readAnalytics, readQuota, exportAnalytics }
  const tokens = useGoThemeTokens(theme), locale = getLocale?.()
  const key = JSON.stringify([accountRef, range]), report = snapshot?.key === key ? snapshot.value : null, error = failure?.key === key ? failure.error : null
  useEffect(() => {
    if (!accountRef) { setLoading(false); setSnapshot(null); setFailure(null); return }
    const controller = new AbortController(); let stopped = false
    const query: AnalyticsQuery = { accountRef, range, ...(force.current ? { refresh: true } : {}) }; force.current = false
    setLoading(true); setFailure(null)
    void readers.current.readAnalytics(query, controller.signal).then(next => {
      if (stopped) return
      if (next.accountRef !== accountRef || next.period !== range) throw new Error('History identity mismatch')
      setSnapshot({ key, value: next })
    }).catch((reason: unknown) => {
      if (stopped || controller.signal.aborted) return
      const details = errorDetails(reason)
      setSnapshot(previous => details.retryable === true && details.retainPrevious === true && previous?.key === key && previous.value.source === details.source ? previous : null)
      setFailure({ key, error: reason })
    }).finally(() => { if (!stopped) setLoading(false) })
    return () => { stopped = true; controller.abort() }
  }, [accountRef, range, revision, key])
  useEffect(() => {
    setQuota(null); setQuotaFailed(false)
    if (!accountRef || !readers.current.readQuota) return
    let stopped = false
    void readers.current.readQuota(accountRef).then(value => { if (!stopped) setQuota({ ref: accountRef, value }) }, () => { if (!stopped) setQuotaFailed(true) })
    return () => { stopped = true }
  }, [accountRef, revision])
  useEffect(() => {
    setExporting(false)
    setExported(false)
    setExportFailed(false)
    if (exportTimer.current !== undefined) clearTimeout(exportTimer.current)
    return () => {
      exporter.current?.abort()
      if (exportTimer.current !== undefined) clearTimeout(exportTimer.current)
    }
  }, [accountRef, range])
  const refresh = (): void => { force.current = true; setRevision(value => value + 1) }
  const download = async (): Promise<void> => {
    if (!readers.current.exportAnalytics || exporting || !accountRef) return
    const controller = new AbortController(); exporter.current = controller; setExporting(true); setExported(false); setExportFailed(false)
    try {
      const result = await readers.current.exportAnalytics({ accountRef, range }, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a')
      anchor.href = url; anchor.download = result.filename; document.body.append(anchor); anchor.click(); anchor.remove()
      setTimeout(() => { URL.revokeObjectURL(url) }, 1000)
      setExported(true)
      if (exportTimer.current !== undefined) clearTimeout(exportTimer.current)
      exportTimer.current = setTimeout(() => { setExported(false) }, 2500)
    } catch { if (!controller.signal.aborted) setExportFailed(true) }
    finally { if (!controller.signal.aborted) setExporting(false) }
  }
  const HeadingTag = variant === 'page' ? 'h2' : 'h1'
  return <div className={css.dashboard} style={themeStyle(tokens)} aria-busy={loading} data-variant={variant}>
    {/* The page shell titles this surface and owns its padding, so the dialog's brand row (and its close control) is dialog-only chrome; it stays in the tree for layout parity but the page variant hides it. */}
    <header className={css.header}><div className={css.brand}><span className={css.brandIcon}><Icon name="chart" /></span><span>{t('titleLabel')}</span></div>{onClose ? <button type="button" className={css.iconButton} onClick={onClose} aria-label={t('analyticsClose')}><Icon name="close" /></button> : null}</header>
    <div className={css.heading}><div><HeadingTag className={css.headingTitle}>{t('analyticsTitle')}</HeadingTag><p>{t('analyticsSubtitle')}</p></div><span className={css.source}><i />{t('analyticsKicker')}</span></div>
    <div className={css.toolbar}>
      <label className={css.accountSelect}><span>{t('analyticsAccount')}</span><select aria-label={t('analyticsAccount')} value={accountRef} onChange={event => { setSelected(event.target.value) }} disabled={!accounts.length}>{accounts.map(a => <option key={a.apiKeyEnv} value={a.apiKeyEnv}>{a.name || t('accountDefault')}</option>)}</select></label>
      <div className={css.rangeGroup} role="group" aria-label={t('analyticsRange')}>{RANGES.map(value => <button type="button" key={value} aria-pressed={value === range} onClick={() => { setRange(value) }}>{t(RANGE_LABELS[value])}</button>)}</div><span className={css.utc}>UTC</span>
      <div className={css.toolbarActions}><button type="button" className={css.iconButton} onClick={refresh} disabled={loading || !accountRef} aria-label={t('analyticsRefresh')} title={t('analyticsRefresh')}><Icon name="refresh" /></button>{exportAnalytics ? <button type="button" className={css.exportButton} data-exported={exported ? 'true' : undefined} onClick={() => { void download() }} disabled={exporting || !report} title={t('analyticsExportHint')}><Icon name="download" />{exporting ? t('analyticsExporting') : exported ? t('analyticsExported') : t('analyticsExport')}</button> : null}</div>
    </div>
    <div className={css.statusRow} aria-live="polite"><span>{report ? `${t('analyticsRefreshed')} ${getDateTimeFormat(locale, 'utcTime', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }).format(new Date(report.generatedAt))} UTC` : ''}</span>{loading && report ? <span>{t('analyticsRefreshing')}</span> : null}</div>
    {exportFailed ? <p className={css.notice} role="alert">{t('analyticsExportFailed')}</p> : null}
    {!accountRef ? <div className={css.state}><Icon name="chart" /><p>{t('analyticsNoAccounts')}</p></div> : null}
    {error ? <div className={css.notice} role="alert"><span>{report ? t('analyticsStale') : errorText(error, t)}</span><button type="button" onClick={refresh} disabled={loading}>{t('analyticsRetry')}</button></div> : null}
    {loading && !report && accountRef ? <div className={css.state} role="status"><span className={css.spinner} /><p>{t('analyticsLoading')}</p></div> : null}
    {report ? <Kpis report={report} t={t} locale={locale} /> : null}
    {quota?.ref === accountRef ? <QuotaStrip quota={quota.value} t={t} locale={locale} /> : quotaFailed ? <p className={css.quotaUnavailable}>{t('analyticsQuotaFailed')}</p> : null}
    {report ? <>
      {report.totals.requests === '0' ? <div className={css.empty}><Icon name="chart" /><p>{t('analyticsEmpty')}</p></div> : null}<Trend key={key} days={report.byDay} t={t} locale={locale} /><Models key={`${key}:models`} rows={report.byModel} totals={report.totals} t={t} locale={locale} /></> : null}
    <footer className={css.footer}><span>{t('analyticsKicker')} · {t('analyticsLagHint')}</span><span>{t('analyticsAmountHint')}</span></footer>
  </div>
}
function Kpis({ report, t, locale }: { report: AnalyticsReport; t: AnalyticsTranslate; locale?: string }) {
  const c = report.totals, days = Math.max(1, report.byDay.length)
  return <section className={css.kpis} aria-label={t('analyticsSubtitle')}>
    <div><span>{t('analyticsRequests')}</span><strong>{historyNumber(c.requests, locale)}</strong><small>{t('analyticsDailyAverage')} {historyNumber(String(BigInt(c.requests) / BigInt(days)), locale)} / {t('analyticsPerDay')}</small></div>
    <div><span>{t('analyticsTokens')}</span><strong title={historyNumber(c.tokens, locale)}>{historyNumber(c.tokens, locale, true)}</strong><small>{report.byModel.length} {t('analyticsModels')} · {report.byDay.filter(d => d.requests !== '0').length} {t('analyticsActiveDays')}</small></div>
    <div><span>{t('analyticsCacheHit')}</span><strong>{cacheHitRateOf(c).toFixed(1)}<em>%</em></strong><small>{historyNumber(c.cacheReadTokens, locale, true)} {t('analyticsCacheRead')}</small></div>
    <div className={css.amountKpi}><span>{t('analyticsSpend')}</span><strong>{historyMoney(c.costMicroCents, locale)}</strong><small>USD · {t('analyticsKicker')}</small></div>
  </section>
}
function QuotaStrip({ quota, t, locale }: { quota: GoUsage; t: AnalyticsTranslate; locale?: string }) {
  const dateTimeOpts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }
  return <section className={css.quotaStrip} aria-label={t('analyticsQuota')}><span className={css.quotaTitle}>{t('analyticsQuota')}</span>{(['rolling', 'weekly', 'monthly'] as const).map(key => {
    const item = quota[key]
    const date = new Date(item.resetsAt)
    const localTime = getDateTimeFormat(locale, 'localDateTime', dateTimeOpts).format(date)
    const utcTime = getDateTimeFormat(locale, 'utcDateTime', { ...dateTimeOpts, timeZone: 'UTC' }).format(date)
    const tooltip = localTime === utcTime
      ? `${t('usageResets')} ${utcTime} UTC`
      : `${t('usageResets')} ${localTime} (${utcTime} UTC)`
    return <div key={key} className={css.quotaWindow} data-level={item.status === 'rate-limited' || item.percent >= 100 ? 'limited' : item.percent >= 80 ? 'high' : 'ok'} title={tooltip}><span>{t(WINDOW_LABELS[key])}<b>{item.percent}%</b></span><progress max={100} value={item.percent} aria-label={t(WINDOW_LABELS[key])} /></div>
  })}</section>
}
function Trend({ days, t, locale }: { days: AnalyticsDayRow[]; t: AnalyticsTranslate; locale?: string }) {
  const [mode, setMode] = useState<Metric>('tokens'), [active, setActive] = useState<number | null>(null), [pinned, setPinned] = useState<number | null>(null)
  const [hiddenParts, setHiddenParts] = useState<ReadonlySet<TokenPart>>(() => new Set())
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const visibleParts = useMemo(() => PARTS.filter(part => !hiddenParts.has(part)), [hiddenParts])
  const togglePart = (part: TokenPart): void => {
    setHiddenParts(previous => {
      const next = new Set(previous)
      if (next.has(part)) {
        next.delete(part)
      } else if (next.size + 1 >= PARTS.length) {
        // Attempting to hide the last remaining series restores all four.
        next.clear()
      } else {
        next.add(part)
      }
      return next
    })
  }
  const dayValues = useMemo(() => days.map(day => {
    if (mode !== 'tokens') return BigInt(day[mode])
    return visibleParts.reduce((sum, part) => sum + BigInt(day[part]), 0n)
  }), [days, mode, visibleParts])
  const maximum = useMemo(() => dayValues.reduce((max, val) => val > max ? val : max, 0n), [dayValues])
  const selected = days[active ?? pinned ?? -1]
  const focusDay = (index: number): void => { const next = Math.max(0, Math.min(days.length - 1, index)); setActive(next); buttons.current[next]?.focus() }
  const keyboard = (event: KeyboardEvent, index: number): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); focusDay(index + (event.key === 'ArrowLeft' ? -1 : 1)) }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); focusDay(event.key === 'Home' ? 0 : days.length - 1) }
    // Escape first dismisses the chart's own selection; with nothing selected it
    // stays unhandled so the Host's Modal still owns closing the dialog.
    if (event.key === 'Escape' && (pinned !== null || active !== null)) { event.stopPropagation(); setPinned(null); setActive(null) }
  }
  const formatAxis = (val: bigint): string => mode === 'costMicroCents' ? historyMoney(String(val), locale) : historyNumber(String(val), locale, true)
  const dayLabels = useMemo(() => days.map(day => `${day.day} · ${historyNumber(day.requests, locale)} ${t('analyticsRequests')} · ${historyNumber(day.tokens, locale)} ${t('analyticsTokens')} · ${historyMoney(day.costMicroCents, locale)}`), [days, locale, t])
  return <section className={css.trend}><div className={css.sectionHead}><div><h2>{t('analyticsByDay')}</h2><p>{t('analyticsTrendHint')}</p></div><div className={css.segmented} role="group" aria-label={t('analyticsByDay')}><button type="button" aria-pressed={mode === 'tokens'} onClick={() => { setMode('tokens') }}>{t('analyticsTokensMode')}</button><button type="button" aria-pressed={mode === 'requests'} onClick={() => { setMode('requests') }}>{t('analyticsRequestsMode')}</button><button type="button" aria-pressed={mode === 'costMicroCents'} onClick={() => { setMode('costMicroCents') }}>{t('analyticsSpendMode')}</button></div></div>
    <div className={css.legend} title={mode === 'tokens' ? t('analyticsLegendHint') : undefined}>
      {mode === 'tokens'
        ? PARTS.map(part => {
          const visible = !hiddenParts.has(part)
          return <button key={part} type="button" className={css.legendBtn} aria-pressed={visible}
            data-hidden={!visible ? 'true' : undefined}
            onClick={() => { togglePart(part) }}>
            <i data-part={part} />{t(LABELS[part])}
          </button>
        })
        : mode === 'requests'
          ? <span><i data-part="requests" />{t('analyticsRequests')}</span>
          : <span><i data-part="costMicroCents" />{t('analyticsSpend')}</span>}
    </div>
    <div className={css.chartScroll}><div className={css.chart} style={{ minWidth: `${Math.max(380, days.length * 11)}px` }}><div className={css.yAxis}><span>{formatAxis(maximum)}</span><span>{formatAxis(maximum / 2n)}</span><span>{mode === 'costMicroCents' ? historyMoney('0', locale) : '0'}</span></div>
      <div className={css.plot} role="group" aria-label={t('analyticsChartHelp')} style={{ gridTemplateColumns: `repeat(${Math.max(1, days.length)}, minmax(3px, 1fr))` }} onPointerLeave={() => { setActive(pinned) }}><div className={css.gridlines} aria-hidden="true"><i /><i /><i /></div>
        {days.map((day, index) => {
          const value = dayValues[index] ?? 0n
          const valueStr = String(value)
          return <button type="button" key={day.day} ref={node => { buttons.current[index] = node }} className={css.dayBar} data-day={day.day} data-selected={selected?.day === day.day || undefined} aria-pressed={pinned === index} tabIndex={index === (active ?? pinned ?? days.length - 1) ? 0 : -1}
            aria-label={dayLabels[index]} onPointerEnter={() => { setActive(index) }} onFocus={() => { setActive(index) }} onKeyDown={event => { keyboard(event, index) }} onClick={() => { setPinned(pinned === index ? null : index); setActive(index) }}>
            <span className={css.barStack} style={{ height: `${Math.max(value === 0n ? 0 : 0.6, percent(valueStr, String(maximum)))}%` }}>
              {mode === 'requests' ? <i data-part="requests" style={{ flex: 1 }} />
                : mode === 'costMicroCents' ? <i data-part="costMicroCents" style={{ flex: 1 }} />
                  : visibleParts.map(part => <i key={part} data-part={part} style={{ flex: percent(day[part], valueStr) }} />)}
            </span><span className={css.zeroDot} />
          </button>
        })}
      </div><div className={css.xAxis}><span>{days[0] ? dayText(days[0].day, locale) : '—'}</span><span>{days.length > 2 ? dayText(days[Math.floor(days.length / 2)].day, locale) : ''}</span><span>{days.length > 1 ? dayText(days.at(-1)!.day, locale) : ''}</span></div></div></div>
    <div className={css.dayDetail} aria-live={pinned === null ? 'off' : 'polite'}>{selected ? <><div><strong>{dayText(selected.day, locale)}</strong><small>UTC</small></div><span>{t('analyticsRequests')}<b>{historyNumber(selected.requests, locale)}</b></span>{PARTS.map(part => <span key={part} data-dimmed={mode === 'tokens' && hiddenParts.has(part) ? 'true' : undefined}>{t(LABELS[part])}<b>{historyNumber(selected[part], locale, true)}</b></span>)}<span>{t('analyticsSpend')}<b>{historyMoney(selected.costMicroCents, locale)}</b></span></> : <p>{t('analyticsSelectDay')}</p>}</div>
  </section>
}

function compareModels(a: AnalyticsModelRow, b: AnalyticsModelRow, field: SortField, asc = false): number {
  if (field === 'cacheHitRate') {
    const left = cacheHitRateOf(a), right = cacheHitRateOf(b)
    return (left === right ? a.model.localeCompare(b.model) || a.provider.localeCompare(b.provider) : left > right ? -1 : 1) * (asc ? -1 : 1)
  }
  const left = BigInt(a[field]), right = BigInt(b[field])
  return (left === right ? a.model.localeCompare(b.model) || a.provider.localeCompare(b.provider) : left > right ? -1 : 1) * (asc ? -1 : 1)
}

function Models({ rows, totals, t, locale }: { rows: AnalyticsModelRow[]; totals: AnalyticsTotals; t: AnalyticsTranslate; locale?: string }) {
  const [metric, setMetric] = useState<Metric>('tokens'), [expanded, setExpanded] = useState(false), [sort, setSort] = useState<{ field: SortField; ascending: boolean }>({ field: 'tokens', ascending: false })
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const [scrollEdge, setScrollEdge] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const updateScrollEdges = useCallback((): void => {
    const el = tableScrollRef.current
    if (!el) return
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setScrollEdge(previous => previous.left === left && previous.right === right ? previous : { left, right })
  }, [])
  useEffect(() => {
    updateScrollEdges()
    const el = tableScrollRef.current
    if (!el) return
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateScrollEdges)
      observer.observe(el)
      return () => { observer.disconnect() }
    }
    window.addEventListener('resize', updateScrollEdges)
    return () => { window.removeEventListener('resize', updateScrollEdges) }
  }, [updateScrollEdges, rows.length])
  const ranked = useMemo(() => [...rows].sort((a, b) => compareModels(a, b, metric)), [rows, metric])
  const visible = useMemo(() => expanded ? ranked : ranked.slice(0, 6), [expanded, ranked])
  const sortedRows = useMemo(() => {
    if (sort.field === metric && !sort.ascending) return ranked
    return [...rows].sort((a, b) => compareModels(a, b, sort.field, sort.ascending))
  }, [rows, sort.field, sort.ascending, metric, ranked])
  const fields = [
    ['requests', 'analyticsRequests'], ['tokens', 'analyticsTokens'], ['inputTokens', 'analyticsInput'],
    ['outputTokens', 'analyticsOutput'], ['cacheReadTokens', 'analyticsCacheRead'], ['cacheWriteTokens', 'analyticsCacheWrite'],
    ['cacheHitRate', 'analyticsCacheHit'], ['costMicroCents', 'analyticsSpend'],
  ] as const satisfies ReadonlyArray<readonly [SortField, keyof typeof en]>
  const METRIC_LABELS = { tokens: 'analyticsTokens', requests: 'analyticsRequests', costMicroCents: 'analyticsSpend' } as const satisfies Record<Metric, keyof typeof en>
  const selectRankModel = (rowKey: string): void => {
    const next = highlightedKey === rowKey ? null : rowKey
    setHighlightedKey(next)
    if (next !== null) {
      rowRefs.current.get(next)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    }
  }
  return <><section className={css.models}><div className={css.sectionHead}><div><h2>{t('analyticsByModel')}</h2><p>{t('analyticsRankingHint')}</p></div><div className={css.segmented} role="group" aria-label={t('analyticsByModel')}>{(['tokens', 'requests', 'costMicroCents'] as const).map(value => <button type="button" key={value} aria-pressed={metric === value} onClick={() => { setMetric(value) }}>{t(METRIC_LABELS[value])}</button>)}</div></div>
    <div className={css.rankList}>{visible.map((row, index) => {
      const rowKey = JSON.stringify([row.provider, row.model])
      const active = highlightedKey === rowKey
      return <button type="button" key={rowKey} className={css.rankRow} aria-pressed={active}
        data-highlighted={active ? 'true' : undefined}
        onClick={() => { selectRankModel(rowKey) }}>
        <span className={css.rankIndex}>{String(index + 1).padStart(2, '0')}</span>
        <span className={css.rankIdentity}><span>{row.model}</span><small>{row.provider}</small></span>
        <span className={css.rankTrack}><i style={{ width: `${percent(row[metric], ranked[0]?.[metric] ?? '0')}%` }} /></span>
        <b>{metricText(row, metric, locale)}</b>
        <small>{percent(row[metric], totals[metric]).toFixed(1)}%</small>
      </button>
    })}</div>
    {rows.length > 6 ? <button type="button" className={css.expandButton} onClick={() => { setExpanded(value => !value) }}>{expanded ? t('analyticsFewerModels') : `${t('analyticsAllModels')} (${rows.length})`}</button> : null}
  </section><section className={css.details}><div className={css.sectionHead}><h2>{t('analyticsDetails')}</h2><span>{rows.length} {t('analyticsModels')}</span></div>
    <div className={css.tableWrap} data-scroll-left={scrollEdge.left ? 'true' : undefined} data-scroll-right={scrollEdge.right ? 'true' : undefined}>
      <div ref={tableScrollRef} className={css.tableScroll} tabIndex={0} role="region" aria-label={t('analyticsDetails')} onScroll={updateScrollEdges}>
        <table><thead><tr><th scope="col" className={css.stickyCol}>{t('analyticsModel')}</th>{fields.map(([field, label]) => <th key={field} scope="col" aria-sort={sort.field === field ? sort.ascending ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => { setSort({ field, ascending: sort.field === field ? !sort.ascending : false }) }}>{t(label)}{sort.field === field ? sort.ascending ? ' ↑' : ' ↓' : ''}</button></th>)}<th scope="col">{t('analyticsShare')}</th></tr></thead><tbody>
          {sortedRows.map(row => {
            const rowKey = JSON.stringify([row.provider, row.model])
            const active = highlightedKey === rowKey
            return <tr key={rowKey} data-highlighted={active ? 'true' : undefined}
              ref={node => { if (node) rowRefs.current.set(rowKey, node); else rowRefs.current.delete(rowKey) }}
              onClick={() => { setHighlightedKey(current => current === rowKey ? null : rowKey) }}>
              <th scope="row" className={css.stickyCol}><strong>{row.model}</strong><small>{row.provider}</small></th>
              {fields.map(([field]) => {
                if (field === 'cacheHitRate') {
                  return <td key={field}>{cacheHitRateOf(row).toFixed(1)}%</td>
                }
                return <td key={field} title={field === 'costMicroCents' ? undefined : historyNumber(row[field], locale)}>{field === 'costMicroCents' ? historyMoney(row[field], locale) : historyNumber(row[field], locale, true)}</td>
              })}
              <td>{percent(row.tokens, totals.tokens).toFixed(1)}%</td>
            </tr>
          })}
        </tbody></table>
      </div>
    </div>
  </section></>
}
