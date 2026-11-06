/** Official workspace history, built from a single Console snapshot. */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AnalyticsDayRow, AnalyticsExport, AnalyticsModelRow, AnalyticsQuery, AnalyticsRange, AnalyticsReport, AnalyticsTotals, GoAccount, GoUsage } from '../contracts.ts'
import { themeStyle, useGoThemeTokens, type en } from './presentation.ts'
import { historyCopy, type HistoryCopy } from './dashboard-copy.ts'
import css from './AnalyticsDialog.module.css'

type Metric = 'tokens' | 'requests' | 'costMicroCents'
const RANGES: AnalyticsRange[] = ['today', '7d', '30d', '90d']
const RANGE_LABELS = { today: 'analyticsRangeToday', '7d': 'analyticsRange7d', '30d': 'analyticsRange30d', '90d': 'analyticsRange90d' } as const
const PARTS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const
const LABELS = { inputTokens: 'input', outputTokens: 'output', cacheReadTokens: 'cacheRead', cacheWriteTokens: 'cacheWrite' } as const

export function historyNumber(value: string, locale?: string, compact = false): string {
  return new Intl.NumberFormat(locale, compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(BigInt(value))
}

/** Keep micro-cents exact through rounding: one dollar is 100,000,000 units. */
export function historyMoney(value: string, locale?: string): string {
  const raw = BigInt(value), digits = raw < 10_000_000n ? 4 : 2
  const unit = 10n ** BigInt(8 - digits), base = 10n ** BigInt(digits)
  const rounded = (raw + unit / 2n) / unit
  const fraction = String(rounded % base).padStart(digits, '0')
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
    .formatToParts(rounded / base).map(part => part.type === 'fraction' ? fraction : part.value).join('')
}

function percent(part: string, total: string): number { return BigInt(total) === 0n ? 0 : Number(BigInt(part) * 100_000n / BigInt(total)) / 1000 }
function metricText(row: AnalyticsTotals, metric: Metric, locale?: string): string { return metric === 'costMicroCents' ? historyMoney(row[metric], locale) : historyNumber(row[metric], locale, true) }
function dayText(day: string, locale?: string): string { return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z')) }
function errorDetails(error: unknown): Record<string, unknown> {
  return error && typeof error === 'object' && 'code' in error && error.code === 'opencode-go/analytics-unavailable' && 'details' in error && error.details && typeof error.details === 'object' ? error.details as Record<string, unknown> : {}
}
function errorText(error: unknown, copy: HistoryCopy): string {
  const reason = errorDetails(error).reason
  if (reason === 'permission-denied') return copy.permission
  if (reason === 'missing-credential' || reason === 'credential-unavailable' || reason === 'unknown-account') return copy.credentials
  if (reason === 'unsupported-gateway') return copy.unsupported
  if (reason === 'invalid-response') return copy.invalid
  return copy.failed
}
function Icon({ name }: { name: 'close' | 'refresh' | 'download' | 'chart' }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'close' ? <path d="m5 5 10 10M15 5 5 15" /> : name === 'refresh' ? <><path d="M16.5 9A6.5 6.5 0 1 1 14 4.8" /><path d="M16.5 3v4h-4" /></> : name === 'download' ? <><path d="M10 3v9m-3-3 3 3 3-3M4 13v4h12v-4" /></> : <><path d="M3 3v14h14M6 13V9m4 4V5m4 8V7" /></>}</svg>
}
export interface AnalyticsDialogProps {
  open: boolean; onClose: () => void
  readAnalytics: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>
  exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>
  readQuota?: (ref: string) => Promise<GoUsage>
  accounts: readonly GoAccount[]; activeRef: string; contextKey?: string | number
  t: (key: keyof typeof en) => string; getLocale?: () => string
}
export function AnalyticsDialog(props: AnalyticsDialogProps) {
  return <Modal open={props.open} onClose={props.onClose} title={props.t('analyticsTitle')} headless className={css.shell}>{props.open ? <Dashboard key={props.contextKey} {...props} /> : null}</Modal>
}
function Dashboard({ activeRef, accounts, readAnalytics, exportAnalytics, readQuota, onClose, t, getLocale }: AnalyticsDialogProps) {
  const [selected, setSelected] = useState(activeRef)
  const accountRef = accounts.some(a => a.apiKeyEnv === selected) ? selected : accounts.find(a => a.apiKeyEnv === activeRef)?.apiKeyEnv ?? accounts[0]?.apiKeyEnv ?? ''
  const [range, setRange] = useState<AnalyticsRange>('30d'), [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<{ key: string; value: AnalyticsReport } | null>(null)
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null)
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<{ ref: string; value: GoUsage } | null>(null), [quotaFailed, setQuotaFailed] = useState(false)
  const [exporting, setExporting] = useState(false), [exportFailed, setExportFailed] = useState(false)
  const force = useRef(false), exporter = useRef<AbortController | null>(null)
  const readers = useRef({ readAnalytics, readQuota, exportAnalytics }); readers.current = { readAnalytics, readQuota, exportAnalytics }
  const tokens = useGoThemeTokens(), locale = getLocale?.(), copy = historyCopy(locale)
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
  useEffect(() => { setExporting(false); setExportFailed(false); return () => { exporter.current?.abort() } }, [accountRef, range])
  const refresh = (): void => { force.current = true; setRevision(value => value + 1) }
  const download = async (): Promise<void> => {
    if (!readers.current.exportAnalytics || exporting || !accountRef) return
    const controller = new AbortController(); exporter.current = controller; setExporting(true); setExportFailed(false)
    try {
      const result = await readers.current.exportAnalytics({ accountRef, range }, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a')
      anchor.href = url; anchor.download = result.filename; document.body.append(anchor); anchor.click(); anchor.remove()
      setTimeout(() => { URL.revokeObjectURL(url) }, 1000)
    } catch { if (!controller.signal.aborted) setExportFailed(true) }
    finally { if (!controller.signal.aborted) setExporting(false) }
  }
  return <div className={css.dashboard} style={themeStyle(tokens)} aria-busy={loading}>
    <header className={css.header}><div className={css.brand}><span className={css.brandIcon}><Icon name="chart" /></span><span>OPENCODE <b>CONSOLE</b></span></div><button type="button" className={css.iconButton} onClick={onClose} aria-label={t('analyticsClose')}><Icon name="close" /></button></header>
    <div className={css.heading}><div><span className={css.eyebrow}>WORKSPACE / USAGE</span><h1>{t('analyticsTitle')}</h1><p>{copy.scope}</p></div><span className={css.source}><i />OpenCode Console</span></div>
    <div className={css.toolbar}>
      <label className={css.accountSelect}><span>{copy.account}</span><select aria-label={copy.account} value={accountRef} onChange={event => { setSelected(event.target.value) }} disabled={!accounts.length}>{accounts.map(a => <option key={a.apiKeyEnv} value={a.apiKeyEnv}>{a.name || t('accountDefault')}</option>)}</select></label>
      <div className={css.rangeGroup} role="group" aria-label={t('analyticsRange')}>{RANGES.map(value => <button type="button" key={value} aria-pressed={value === range} onClick={() => { setRange(value) }}>{t(RANGE_LABELS[value])}</button>)}</div><span className={css.utc}>UTC</span>
      <div className={css.toolbarActions}><button type="button" className={css.iconButton} onClick={refresh} disabled={loading || !accountRef} aria-label={copy.refresh} title={copy.refresh}><Icon name="refresh" /></button>{exportAnalytics ? <button type="button" className={css.exportButton} onClick={() => { void download() }} disabled={exporting || !report} title={copy.exportHint}><Icon name="download" />{exporting ? copy.exporting : copy.export}</button> : null}</div>
    </div>
    <div className={css.statusRow} aria-live="polite"><span>{report ? `${copy.refreshed} ${new Date(report.generatedAt).toLocaleTimeString(locale, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC` : ''}</span>{loading && report ? <span>{copy.refreshing}</span> : null}</div>
    {exportFailed ? <p className={css.notice} role="alert">{copy.exportFailed}</p> : null}
    {!accountRef ? <div className={css.state}><Icon name="chart" /><p>{copy.noAccounts}</p></div> : null}
    {error ? <div className={css.notice} role="alert"><span>{report ? copy.stale : errorText(error, copy)}</span><button type="button" onClick={refresh} disabled={loading}>{copy.retry}</button></div> : null}
    {loading && !report && accountRef ? <div className={css.state} role="status"><span className={css.spinner} /><p>{copy.loading}</p></div> : null}
    {report ? <Kpis report={report} copy={copy} locale={locale} /> : null}
    {quota?.ref === accountRef ? <QuotaStrip quota={quota.value} copy={copy} locale={locale} /> : quotaFailed ? <p className={css.quotaUnavailable}>{copy.quotaUnavailable}</p> : null}
    {report ? <>
      {report.totals.requests === '0' ? <div className={css.empty}><Icon name="chart" /><p>{copy.empty}</p></div> : null}<Trend key={key} days={report.byDay} copy={copy} locale={locale} /><Models rows={report.byModel} totals={report.totals} copy={copy} locale={locale} /></> : null}
    <footer className={css.footer}><span>OpenCode Console · {copy.lagHint}</span><span>{copy.amountHint}</span></footer>
  </div>
}
function Kpis({ report, copy, locale }: { report: AnalyticsReport; copy: HistoryCopy; locale?: string }) {
  const c = report.totals, days = Math.max(1, report.byDay.length), input = String(BigInt(c.inputTokens) + BigInt(c.cacheReadTokens) + BigInt(c.cacheWriteTokens))
  return <section className={css.kpis} aria-label={copy.scope}>
    <div><span>{copy.requests}</span><strong>{historyNumber(c.requests, locale)}</strong><small>{copy.dailyAverage} {historyNumber(String(BigInt(c.requests) / BigInt(days)), locale)} / {locale?.startsWith('zh') ? '天' : 'day'}</small></div>
    <div><span>{copy.tokens}</span><strong title={historyNumber(c.tokens, locale)}>{historyNumber(c.tokens, locale, true)}</strong><small>{report.byModel.length} {copy.models} · {report.byDay.filter(d => d.requests !== '0').length} {copy.activeDays}</small></div>
    <div><span>{copy.cacheHit}</span><strong>{percent(c.cacheReadTokens, input).toFixed(1)}<em>%</em></strong><small>{historyNumber(c.cacheReadTokens, locale, true)} {copy.cacheRead}</small></div>
    <div className={css.amountKpi}><span>{copy.amount}</span><strong>{historyMoney(c.costMicroCents, locale)}</strong><small>USD · OpenCode Console</small></div>
  </section>
}
function QuotaStrip({ quota, copy, locale }: { quota: GoUsage; copy: HistoryCopy; locale?: string }) {
  return <section className={css.quotaStrip} aria-label={copy.quota}><span className={css.quotaTitle}>{copy.quota}</span>{(['rolling', 'weekly', 'monthly'] as const).map(key => { const item = quota[key]; return <div key={key} className={css.quotaWindow} data-level={item.status === 'rate-limited' || item.percent >= 100 ? 'limited' : item.percent >= 80 ? 'high' : 'ok'} title={`${copy.resets} ${new Date(item.resetsAt).toLocaleString(locale, { timeZone: 'UTC' })} UTC`}><span>{copy[key]}<b>{item.percent}%</b></span><progress max={100} value={item.percent} aria-label={copy[key]} /></div> })}</section>
}
function Trend({ days, copy, locale }: { days: AnalyticsDayRow[]; copy: HistoryCopy; locale?: string }) {
  const [mode, setMode] = useState<'tokens' | 'requests'>('tokens'), [active, setActive] = useState<number | null>(null), [pinned, setPinned] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const maximum = days.reduce((max, day) => BigInt(day[mode]) > max ? BigInt(day[mode]) : max, 0n), selected = days[active ?? pinned ?? -1]
  const focusDay = (index: number): void => { const next = Math.max(0, Math.min(days.length - 1, index)); setActive(next); buttons.current[next]?.focus() }
  const keyboard = (event: KeyboardEvent, index: number): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); focusDay(index + (event.key === 'ArrowLeft' ? -1 : 1)) }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); focusDay(event.key === 'Home' ? 0 : days.length - 1) }
    if (event.key === 'Escape') { event.stopPropagation(); setPinned(null); setActive(null) }
  }
  return <section className={css.trend}><div className={css.sectionHead}><div><h2>{copy.trend}</h2><p>{copy.trendHint}</p></div><div className={css.segmented} role="group" aria-label={copy.trend}><button type="button" aria-pressed={mode === 'tokens'} onClick={() => { setMode('tokens') }}>{copy.tokensMode}</button><button type="button" aria-pressed={mode === 'requests'} onClick={() => { setMode('requests') }}>{copy.requestsMode}</button></div></div>
    <div className={css.legend}>{mode === 'tokens' ? PARTS.map(part => <span key={part}><i data-part={part} />{copy[LABELS[part]]}</span>) : <span><i data-part="requests" />{copy.requests}</span>}</div>
    <div className={css.chartScroll}><div className={css.chart} style={{ minWidth: `${Math.max(380, days.length * 11)}px` }}><div className={css.yAxis}><span>{historyNumber(String(maximum), locale, true)}</span><span>{historyNumber(String(maximum / 2n), locale, true)}</span><span>0</span></div>
      <div className={css.plot} role="group" aria-label={copy.chartHelp} style={{ gridTemplateColumns: `repeat(${Math.max(1, days.length)}, minmax(3px, 1fr))` }} onPointerLeave={() => { setActive(pinned) }}><div className={css.gridlines} aria-hidden="true"><i /><i /><i /></div>
        {days.map((day, index) => <button type="button" key={day.day} ref={node => { buttons.current[index] = node }} className={css.dayBar} data-day={day.day} data-selected={selected?.day === day.day || undefined} aria-pressed={pinned === index} tabIndex={index === (active ?? pinned ?? days.length - 1) ? 0 : -1}
          aria-label={`${day.day} · ${historyNumber(day.requests, locale)} ${copy.requests} · ${historyNumber(day.tokens, locale)} ${copy.tokens}`} onPointerEnter={() => { setActive(index) }} onFocus={() => { setActive(index) }} onKeyDown={event => { keyboard(event, index) }} onClick={() => { setPinned(pinned === index ? null : index); setActive(index) }}>
          <span className={css.barStack} style={{ height: `${Math.max(day[mode] === '0' ? 0 : 0.6, percent(day[mode], String(maximum)))}%` }}>{mode === 'requests' ? <i data-part="requests" style={{ flex: 1 }} /> : PARTS.map(part => <i key={part} data-part={part} style={{ flex: percent(day[part], day.tokens) }} />)}</span><span className={css.zeroDot} />
        </button>)}
      </div><div className={css.xAxis}><span>{days[0] ? dayText(days[0].day, locale) : '—'}</span><span>{days.length > 2 ? dayText(days[Math.floor(days.length / 2)].day, locale) : ''}</span><span>{days.length > 1 ? dayText(days.at(-1)!.day, locale) : ''}</span></div></div></div>
    <div className={css.dayDetail} aria-live="polite">{selected ? <><div><strong>{dayText(selected.day, locale)}</strong><small>UTC</small></div><span>{copy.requests}<b>{historyNumber(selected.requests, locale)}</b></span>{PARTS.map(part => <span key={part}>{copy[LABELS[part]]}<b>{historyNumber(selected[part], locale, true)}</b></span>)}<span>{copy.amount}<b>{historyMoney(selected.costMicroCents, locale)}</b></span></> : <p>{copy.selectDay}</p>}</div>
  </section>
}
function Models({ rows, totals, copy, locale }: { rows: AnalyticsModelRow[]; totals: AnalyticsTotals; copy: HistoryCopy; locale?: string }) {
  const [metric, setMetric] = useState<Metric>('tokens'), [expanded, setExpanded] = useState(false), [sort, setSort] = useState<{ field: keyof AnalyticsTotals; ascending: boolean }>({ field: 'tokens', ascending: false })
  const compare = (a: AnalyticsModelRow, b: AnalyticsModelRow, field: keyof AnalyticsTotals, asc = false): number => { const left = BigInt(a[field]), right = BigInt(b[field]); return (left === right ? a.model.localeCompare(b.model) || a.provider.localeCompare(b.provider) : left > right ? -1 : 1) * (asc ? -1 : 1) }
  const ranked = [...rows].sort((a, b) => compare(a, b, metric)), visible = expanded ? ranked : ranked.slice(0, 6)
  const fields = [['requests', 'requests'], ['tokens', 'tokens'], ['inputTokens', 'input'], ['outputTokens', 'output'], ['cacheReadTokens', 'cacheRead'], ['cacheWriteTokens', 'cacheWrite'], ['costMicroCents', 'amount']] as const
  return <><section className={css.models}><div className={css.sectionHead}><div><h2>{copy.ranking}</h2><p>{copy.rankingHint}</p></div><div className={css.segmented} role="group" aria-label={copy.ranking}>{(['tokens', 'requests', 'costMicroCents'] as const).map(value => <button type="button" key={value} aria-pressed={metric === value} onClick={() => { setMetric(value) }}>{value === 'costMicroCents' ? copy.amount : copy[value]}</button>)}</div></div>
    <div className={css.rankList}>{visible.map((row, index) => <div key={JSON.stringify([row.provider, row.model])} className={css.rankRow}><span className={css.rankIndex}>{String(index + 1).padStart(2, '0')}</span><div className={css.rankIdentity}><span>{row.model}</span><small>{row.provider}</small></div><div className={css.rankTrack}><i style={{ width: `${percent(row[metric], ranked[0]?.[metric] ?? '0')}%` }} /></div><b>{metricText(row, metric, locale)}</b><small>{percent(row[metric], totals[metric]).toFixed(1)}%</small></div>)}</div>
    {rows.length > 6 ? <button type="button" className={css.expandButton} onClick={() => { setExpanded(value => !value) }}>{expanded ? copy.fewerModels : `${copy.allModels} (${rows.length})`}</button> : null}
  </section><section className={css.details}><div className={css.sectionHead}><h2>{copy.details}</h2><span>{rows.length} {copy.models}</span></div><div className={css.tableScroll} tabIndex={0} role="region" aria-label={copy.details}><table><thead><tr><th>{copy.model}</th>{fields.map(([field, label]) => <th key={field} aria-sort={sort.field === field ? sort.ascending ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => { setSort({ field, ascending: sort.field === field ? !sort.ascending : false }) }}>{copy[label]}{sort.field === field ? sort.ascending ? ' ↑' : ' ↓' : ''}</button></th>)}<th>{copy.share}</th></tr></thead><tbody>
    {[...rows].sort((a, b) => compare(a, b, sort.field, sort.ascending)).map(row => <tr key={JSON.stringify([row.provider, row.model])}><td><strong>{row.model}</strong><small>{row.provider}</small></td>{fields.map(([field]) => <td key={field} title={field === 'costMicroCents' ? undefined : historyNumber(row[field], locale)}>{field === 'costMicroCents' ? historyMoney(row[field], locale) : historyNumber(row[field], locale, true)}</td>)}<td>{percent(row.tokens, totals.tokens).toFixed(1)}%</td></tr>)}
    </tbody></table></div></section></>
}
