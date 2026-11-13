/** Overview tab: the numbers a reader checks first, plus shortcuts into the other tabs. */
import css from './OverviewPage.module.css'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AnalyticsReport, GoUsage } from '../../contracts.ts'
import { historyMoney, historyNumber } from '../AnalyticsDialog.tsx'
import { formatDateTime, type en } from '../presentation.ts'
import type { PageTranslate, PageViewProps } from './types.ts'

/** The three quota windows, in the order the gateway reports them. */
const WINDOWS = ['rolling', 'weekly', 'monthly'] as const

/** Copy key of each window's label. */
const WINDOW_COPY = {
  rolling: 'usage_rolling', weekly: 'usage_weekly', monthly: 'usage_monthly',
} as const satisfies Record<typeof WINDOWS[number], keyof typeof en>

/** Percent of a whole on the dashboard's own scale: three decimals before display. */
function percentOf(part: bigint, total: bigint): number {
  return total === 0n ? 0 : Number(part * 100_000n / total) / 1000
}

/** The bar reading: amber from 80%, red once the window is spent. */
function quotaLevel(window: GoUsage['rolling']): 'ok' | 'high' | 'limited' {
  if (window.status === 'rate-limited' || window.percent >= 100) return 'limited'
  return window.percent >= 80 ? 'high' : 'ok'
}

/**
 * The rolling window's reset as a countdown. The settings section keeps its own
 * copy of this helper private; the overview states the one number beside each bar.
 * @param resetsAt - ISO timestamp the gateway reported.
 * @param t - page translator.
 * @returns the countdown text.
 */
function resetText(resetsAt: string, t: PageTranslate): string {
  const remaining = Date.parse(resetsAt) - Date.now()
  if (!Number.isFinite(remaining)) return t('usageResetUnknown')
  if (remaining <= 0) return t('usageResetDue')
  const minutes = Math.max(1, Math.round(remaining / 60_000))
  if (minutes < 60) return t('usageResetMinutes', { minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('usageResetHours', { hours })
  return t('usageResetDays', { days: Math.round(hours / 24) })
}

/** UTC calendar day, the granularity the official summaries are reported at. */
function dayText(day: string, locale?: string): string {
  return formatDateTime(day + 'T00:00:00Z', locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** One KPI card: label, the big number and its one-line context. */
function Kpi({ label, value, foot, title }: {
  label: string
  value: ReactNode
  foot?: ReactNode
  title?: string
}): ReactNode {
  return <div className={css.kpi}>
    <span className={css.kpiLabel}>{label}</span>
    <strong className={css.kpiValue} title={title}>{value}</strong>
    {foot === undefined ? null : <span className={css.kpiFoot}>{foot}</span>}
  </div>
}

function ChartGlyph(): ReactNode {
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M3.5 16.5v-13m0 13h13" />
    <path d="M6.5 13v-3m3.5 3V6.5m3.5 6.5V8.5" />
  </svg>
}

function AccountsGlyph(): ReactNode {
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="10" cy="7" r="2.6" />
    <path d="M4.6 16.2c.7-2.7 2.9-4.2 5.4-4.2s4.7 1.5 5.4 4.2" />
  </svg>
}

function ModelsGlyph(): ReactNode {
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m10 3 6 3v8l-6 3-6-3V6z" />
    <path d="m4 6 6 3 6-3M10 9v8" />
  </svg>
}

/** One shortcut into a sibling tab: icon, label and the one-line promise. */
function QuickLink({ label, detail, onClick, children }: {
  label: string
  detail: string
  onClick: () => void
  children: ReactNode
}): ReactNode {
  return <button type="button" className={css.quickButton} onClick={onClick}>
    <span className={css.quickIcon} aria-hidden="true">{children}</span>
    <span className={css.quickText}>
      <span className={css.quickTitle}>{label}</span>
      <span className={css.quickSub}>{detail}</span>
    </span>
  </button>
}

/**
 * Render the Overview tab.
 * @param props - the snapshot, the business face, the locale and the tab switcher.
 * @returns the KPI row, the current-account card, the status stack and shortcuts.
 */
export function OverviewPage({ state, actions, locale, go }: PageViewProps): ReactNode {
  const t = actions.t
  const readAnalytics = actions.readers?.readAnalytics
  const readUsage = actions.readers?.readUsage
  const accountRef = state.accounts.activeRef
  const analyticsReady = readAnalytics !== undefined
  const usageReady = readUsage !== undefined
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [reportFailed, setReportFailed] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [quota, setQuota] = useState<GoUsage | null>(null)
  const [quotaFailed, setQuotaFailed] = useState(false)
  // The injected face is rebuilt on some host events (a locale change, for one),
  // so the readers travel through a ref and only the identity of the data being
  // read may restart these requests.
  const readers = useRef({ readAnalytics, readUsage })
  readers.current = { readAnalytics, readUsage }
  useEffect(() => {
    const read = readers.current.readAnalytics
    if (read === undefined || !accountRef) {
      // Nothing to read: a host without the analytics remote, or no account yet.
      // Clear the cards instead of leaving another account's report on screen.
      setReport(null)
      setReportFailed(false)
      setReportLoading(false)
      return
    }
    const controller = new AbortController()
    let stopped = false
    setReport(null)
    setReportFailed(false)
    setReportLoading(true)
    void read({ accountRef, range: '7d' }, controller.signal).then(next => {
      if (stopped) return
      // A report naming another identity cannot describe this card.
      if (next.accountRef !== accountRef || next.period !== '7d') throw new Error('History identity mismatch')
      setReport(next)
    }).catch(() => {
      if (!stopped && !controller.signal.aborted) {
        setReport(null)
        setReportFailed(true)
      }
    }).finally(() => { if (!stopped) setReportLoading(false) })
    return () => { stopped = true; controller.abort() }
  }, [accountRef, analyticsReady])
  useEffect(() => {
    setQuota(null)
    setQuotaFailed(false)
    const read = readers.current.readUsage
    if (read === undefined) return
    let stopped = false
    void read().then(next => { if (!stopped) setQuota(next) }, () => { if (!stopped) setQuotaFailed(true) })
    return () => { stopped = true }
  }, [accountRef, usageReady])
  const loadAccounts = useRef(actions.loadAccounts)
  loadAccounts.current = actions.loadAccounts
  // The overview is the landing tab, so it seeds the account rows the other tabs
  // reuse instead of leaving them empty until the accounts tab is opened.
  useEffect(() => { loadAccounts.current() }, [])
  const accounts = state.accounts.entries
  const active = accounts.find(entry => entry.apiKeyEnv === accountRef)
  const currentName = active === undefined ? '' : (active.name || t('accountDefault'))
  const readyCount = accounts.filter(entry => entry.configured === true).length
  const unreadable = accounts.filter(entry => entry.failed === true).length
  const availability = unreadable > 0
    ? t('accountsAvailabilityFailed', { ready: readyCount, total: accounts.length, failed: unreadable })
    : t('accountsAvailability', { ready: readyCount, total: accounts.length })
  const fallbackOrder = accounts.length === 0
    ? t('accountsSummaryEmpty')
    : accounts.map(entry => entry.name || t('accountDefault')).join(' → ')
  // The gateway answers for the profile's current account; the loaded row is the
  // fallback when that one read is unavailable, so the bars still show last data.
  const usage = quota ?? active?.usage ?? null
  const usageNote = readUsage === undefined || quotaFailed ? t('usageUnavailable') : t('usageLoading')
  const totals = report?.totals
  const dayCount = report === null ? 1 : Math.max(1, report.byDay.length)
  const cacheRead = totals === undefined ? 0n : BigInt(totals.cacheReadTokens)
  const cacheTotal = totals === undefined ? 0n
    : cacheRead + BigInt(totals.inputTokens) + BigInt(totals.cacheWriteTokens)
  const cacheRate = percentOf(cacheRead, cacheTotal)
  const recent = report === null ? [] : report.byDay.slice(-7)
  const maximum = recent.reduce((max, day) => { const tokens = BigInt(day.tokens); return tokens > max ? tokens : max }, 0n)
  // First, middle and last day label the axis; a 2-day range repeats the middle
  // sample, so the Set keeps one span per day (a duplicate React key otherwise).
  const axis = recent.length === 0 ? [] : [...new Set([
    recent[0].day, recent[Math.floor((recent.length - 1) / 2)].day, recent[recent.length - 1].day,
  ])]
  const reportNote = reportLoading ? t('overviewLoading') : reportFailed ? t('analyticsFailed') : t('overviewNoReport')
  return <div className={css.overview}>
    <section className={css.kpis} aria-busy={reportLoading}>
      <Kpi label={t('overviewTodayRequests')}
        value={totals === undefined ? '—' : historyNumber(totals.requests, locale)}
        title={totals === undefined ? undefined : historyNumber(totals.requests, locale)}
        foot={totals === undefined ? undefined
          : t('overviewRequestsFoot', { count: historyNumber(String(BigInt(totals.requests) / BigInt(dayCount)), locale) })} />
      <Kpi label={t('overviewTodayTokens')}
        value={totals === undefined ? '—' : historyNumber(totals.tokens, locale, true)}
        title={totals === undefined ? undefined : historyNumber(totals.tokens, locale)}
        foot={totals === undefined ? undefined
          : t('overviewTokensFoot', { input: historyNumber(totals.inputTokens, locale, true), output: historyNumber(totals.outputTokens, locale, true) })} />
      <Kpi label={t('overviewCacheHitRate')}
        value={totals === undefined ? '—' : <>{cacheRate.toFixed(1)}<em className={css.kpiUnit}>%</em></>}
        foot={totals === undefined ? undefined : t('overviewCacheFoot', { tokens: historyNumber(totals.cacheReadTokens, locale, true) })} />
      <Kpi label={t('overviewTodaySpend')}
        value={totals === undefined ? '—' : historyMoney(totals.costMicroCents, locale)}
        foot={totals === undefined ? undefined : t('overviewSpendFoot')} />
    </section>
    {report === null ? <p className={css.note} role={reportLoading ? 'status' : undefined}>{reportNote}</p> : null}
    <div className={css.mainGrid}>
      <section className={css.card}>
        <div className={css.cardHead}>
          <h2 className={css.cardTitle}>{t('overviewCurrentAccount')}</h2>
          <Button variant="outline" size="sm" onClick={() => { go('accounts') }}>{t('overviewManageAccounts')}</Button>
        </div>
        {active === undefined ? <p className={css.note}>{t('accountsEmpty')}</p> : <>
          <div className={css.accountHead}>
            <span className={css.avatar} aria-hidden="true">
              {(active.name || t('accountDefault')).trim().charAt(0).toUpperCase()}
            </span>
            <div className={css.accountIdentity}>
              <div className={css.accountNameRow}>
                <span className={css.accountName} title={currentName}>{currentName}</span>
                <Tag tone="info">{t('accountPreferredTag')}</Tag>
              </div>
              <span className={css.accountMeta}>
                {availability} · {t(active.configured === undefined ? 'usageLoading'
                  : active.configured ? 'keyConfigured' : 'keyMissing')}
              </span>
            </div>
          </div>
          {usage === null ? <p className={css.note}>{usageNote}</p> : <div className={css.quotas}>
            {WINDOWS.map(window => {
              const item = usage[window]
              const level = quotaLevel(item)
              const percent = Math.min(100, item.percent)
              return <div key={window} className={css.quota}>
                <div className={css.quotaMeta}>
                  <span className={css.quotaName}>{t(WINDOW_COPY[window])}</span>
                  <span className={css.quotaReset}>{resetText(item.resetsAt, t)}</span>
                  <span className={css.quotaPct}>{item.percent}%</span>
                </div>
                <div className={css.bar} data-level={level} role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
                  aria-label={t(WINDOW_COPY[window]) + ' ' + item.percent + '%'}>
                  <span className={css.barFill} style={{ width: percent + '%' }} />
                </div>
              </div>
            })}
          </div>}
        </>}
        <div className={css.divider} />
        <div className={css.switchRow}>
          <div className={css.switchText}>
            <span className={css.switchTitle}>{t('accountAutoSwitch')}</span>
            <span className={css.switchHint}>{t('accountAutoSwitchHint')}</span>
          </div>
          <Switch checked={state.accounts.autoSwitch} label={t('accountAutoSwitch')}
            title={t('accountAutoSwitchHint')}
            disabled={state.accounts.busy || state.accounts.blocked || !state.writable}
            onChange={next => { void actions.setAutoSwitch(next) }} />
        </div>
        <div className={css.cardActions}>
          {active?.updatedAt === undefined ? null : <span className={css.stamp}>
            {t('usageLastUpdated')} {formatDateTime(active.updatedAt, locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>}
          <Button variant="outline" size="sm" disabled={state.accounts.refreshing}
            onClick={actions.loadAccounts}>{t(state.accounts.refreshing ? 'usageRefreshing' : 'usageRefresh')}</Button>
          <Button variant="primary" size="sm" onClick={() => { go('usage') }}>{t('overviewOpenUsage')}</Button>
        </div>
      </section>
      <div className={css.stack}>
        <section className={css.card}>
          <div className={css.cardHead}>
            <h2 className={css.cardTitle}>{t('overviewProviderStatus')}</h2>
            <Tag tone={state.enabled ? 'success' : 'quiet'}>{t(state.enabled ? 'pageStatusOn' : 'pageStatusOff')}</Tag>
          </div>
          <div className={css.switchRow}>
            <div className={css.switchText}>
              <span className={css.switchTitle}>{t('enabledLabel')}</span>
              <span className={css.switchHint}>{state.enabled ? t('enabledHint') : t('enabledOff')}</span>
            </div>
            <Switch checked={state.enabled} label={t('enabledLabel')}
              title={state.enabled ? t('enabledHint') : t('enabledOff')}
              disabled={!state.writable || state.saving || state.pickerSaving}
              onChange={next => { actions.setEnabled(next) }} />
          </div>
          {state.enabledFailed ? <p className={css.failed} role="alert">{t('enabledFailed')}</p> : null}
          <div className={css.switchRow}>
            <div className={css.switchText}>
              <span className={css.switchTitle}>{t('freeEnabledLabel')}</span>
              <span className={css.switchHint}>{t('freeEnabledHint')}</span>
            </div>
            <Switch checked={state.freeEnabled.text === 'true'} label={t('freeEnabledLabel')}
              title={t('freeEnabledHint')} disabled={!state.writable || state.saving}
              onChange={next => { actions.edit('freeEnabled', String(next)) }} />
          </div>
          {/* The free channel writes immediately, so its refusal is reported here
              instead of in the shell's staged-draft save bar. */}
          {state.writeFailed === 'freeEnabled'
            ? <p className={css.failed} role="alert">{t('immediateWriteFailed')}</p> : null}
        </section>
        <section className={css.card}>
          <div className={css.cardHead}>
            <div>
              <h2 className={css.cardTitle}>{t('overviewRecent')}</h2>
              <p className={css.cardSub}>{t('overviewRecentSub')}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { go('usage') }}>
              {t('overviewDetails')}
            </Button>
          </div>
          {recent.length === 0 ? <p className={css.note}>{reportNote}</p> : <>
            <div className={css.spark} role="img" aria-label={t('overviewRecent') + ' · ' + t('overviewRecentSub')}>
              {recent.map(day => {
                const tokens = BigInt(day.tokens)
                return <div key={day.day} className={css.sparkBar}
                  data-hi={tokens === maximum && maximum > 0n ? 'true' : undefined}
                  style={{ height: (maximum === 0n ? 0 : percentOf(tokens, maximum)) + '%' }}
                  title={dayText(day.day, locale) + ' · ' + historyNumber(day.tokens, locale) + ' ' + t('analyticsTokens')} />
              })}
            </div>
            <div className={css.sparkAxis} aria-hidden="true">
              {axis.map(day => <span key={day}>{dayText(day, locale)}</span>)}
            </div>
          </>}
        </section>
        <section className={css.card}>
          <div className={css.cardHead}>
            <h2 className={css.cardTitle}>{t('overviewAccountSummary')}</h2>
            <Tag className={css.headTag} tone="neutral">
              {accounts.length === 0 ? t('accountsSummaryEmpty') : t('accountsSummary', { count: accounts.length, name: currentName })}
            </Tag>
          </div>
          <div className={css.statRow}>
            <span className={css.statLabel}>{t('overviewAvailableAccounts')}</span>
            <span className={css.statValue}>{availability}</span>
          </div>
          <div className={css.statRow}>
            <span className={css.statLabel}>{t('overviewCurrentAccount')}</span>
            <span className={css.statValue}>{currentName || t('accountsSummaryEmpty')}</span>
          </div>
          <div className={css.statRow}>
            <span className={css.statLabel}>{t('overviewFallbackOrder')}</span>
            <span className={css.statValue} title={fallbackOrder}>{fallbackOrder}</span>
          </div>
        </section>
      </div>
    </div>
    <section className={css.quick} aria-label={t('overviewQuickLinks')}>
      <QuickLink label={t('tabUsage')} detail={t('overviewQuickUsageSub')} onClick={() => { go('usage') }}>
        <ChartGlyph />
      </QuickLink>
      <QuickLink label={t('tabAccounts')} detail={t('overviewQuickAccountsSub')} onClick={() => { go('accounts') }}>
        <AccountsGlyph />
      </QuickLink>
      <QuickLink label={t('tabModels')} detail={t('overviewQuickModelsSub')} onClick={() => { go('models') }}>
        <ModelsGlyph />
      </QuickLink>
    </section>
    <p className={css.footnote}>{t('pageDataNote')}</p>
  </div>
}
