// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GoUsage } from '../src/usage-contract.ts'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AnalyticsDialog } from '../src/client/AnalyticsDialog.tsx'
import { en } from '../src/client/locales.ts'
import type { AnalyticsQuery, AnalyticsReport } from '../src/analytics-contract.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
// Review P16/S9: the dialog persists maxSessions in localStorage, which jsdom
// shares across tests in this file — reset it around every case.
beforeEach(() => { localStorage.clear() })
const t = (key: keyof typeof en) => en[key]
const report = (overrides: Partial<AnalyticsReport> = {}): AnalyticsReport => ({
  generatedAt: Date.UTC(2026, 9, 18, 1, 0),
  range: { from: Date.UTC(2026, 8, 18), to: Date.UTC(2026, 9, 18, 1, 0) },
  timeZone: 'Asia/Shanghai',
  totals: {
    requests: 12, unsettledAttempts: 1, summaries: 2,
    inputTokens: 1000, outputTokens: 2000, cacheReadTokens: 3000, cacheWriteTokens: 0,
    estimatedMicroUsd: 1_234_000, pricedRequests: 10, unpricedRequests: 2, missingUsage: 0,
  },
  byModel: [{
    model: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', requests: 12, missingUsage: 0,
    inputTokens: 1000, outputTokens: 2000, cacheReadTokens: 3000, cacheWriteTokens: 0,
    estimatedMicroUsd: 1_234_000, pricedRequests: 10, unpricedRequests: 2,
    limitGoUsd: 80, limitGoPlusUsd: 160,
  }],
  byDay: [{ day: '2026-10-18', requests: 12, tokens: 6000, estimatedMicroUsd: 1_234_000 }],
  coverage: {
    listedSessions: 20, scannedSessions: 20, matchedSessions: 3, failedSessions: 0,
    eventsScanned: 100, summaries: 2, legacyRequests: 0, missingUsage: 0, truncated: false, scanMs: 1500,
  },
  pricing: { source: 'models.dev', updatedAt: Date.UTC(2026, 9, 18), unpricedModels: [] },
  ...overrides,
})

it('renders totals, model limits and the estimate disclaimer', async () => {
  const read = vi.fn().mockResolvedValue(report())
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
  await screen.findByText('DeepSeek V4.1 Flash')
  expect(screen.getByText('Go $80 / Plus $160')).toBeTruthy()
  expect(screen.getAllByText(/\$1\.23/).length).toBeGreaterThan(0)
  expect(screen.getByText(/Prices: models\.dev/)).toBeTruthy()
  // Review U5: the disclaimer must name the current-price estimate semantics.
  expect(screen.getByText(new RegExp(en.analyticsNotInvoice))).toBeTruthy()
  expect(en.analyticsNotInvoice).toContain('current models.dev prices')
})

it('asks for a shorter range and can scan more history', async () => {
  const read = vi.fn().mockResolvedValue(report())
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d }))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  const sevenDays = read.mock.calls[1][0]
  expect(sevenDays.maxSessions).toBe(500)
  expect(sevenDays.to - sevenDays.from).toBeGreaterThanOrEqual(6 * 86_400_000)
  cleanup()

  const truncated = vi.fn().mockResolvedValue(report({
    coverage: { ...report().coverage, truncated: true, truncation: 'sessions' },
  }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={truncated} t={t} getLocale={() => 'en'} />)
  await screen.findByText(en.analyticsTruncated)
  fireEvent.click(screen.getByRole('button', { name: en.analyticsScanMore }))
  await waitFor(() => expect(truncated.mock.calls.at(-1)?.[0].maxSessions).toBe(1000))
})

it('persists the scan-more choice and clamps the stored value', async () => {
  const truncated = vi.fn().mockResolvedValue(report({
    coverage: { ...report().coverage, truncated: true, truncation: 'sessions' },
  }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={truncated} t={t} getLocale={() => 'en'} />)
  await screen.findByText(en.analyticsTruncated)
  fireEvent.click(screen.getByRole('button', { name: en.analyticsScanMore }))
  await waitFor(() => expect(truncated.mock.calls.at(-1)?.[0].maxSessions).toBe(1000))
  expect(localStorage.getItem('opencode-go:analytics:maxSessions')).toBe('1000')
  cleanup()

  // Reopening keeps the previous choice (review P16/S9).
  const restored = vi.fn().mockResolvedValue(report())
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={restored} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  expect(restored.mock.calls[0][0].maxSessions).toBe(1000)
  cleanup()

  // Stored junk clamps into the 1..2000 contract window.
  localStorage.setItem('opencode-go:analytics:maxSessions', '9999')
  const clampedHigh = vi.fn().mockResolvedValue(report())
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={clampedHigh} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  expect(clampedHigh.mock.calls[0][0].maxSessions).toBe(2000)
  cleanup()

  localStorage.setItem('opencode-go:analytics:maxSessions', 'not-a-number')
  const clampedJunk = vi.fn().mockResolvedValue(report())
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={clampedJunk} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  expect(clampedJunk.mock.calls[0][0].maxSessions).toBe(500)
})

// Review P5/S5: the window end freezes once per open — repeated queries inside
// one open share it, a range switch still makes a new query, and the refresh
// button moves it.
it('freezes the window end for one open and moves it on refresh', async () => {
  let clock = 1_700_000_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)
  const read = vi.fn().mockResolvedValue(report())
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d }))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  expect(read.mock.calls[1][0].to).toBe(read.mock.calls[0][0].to)
  expect(read.mock.calls[1][0].from).not.toBe(read.mock.calls[0][0].from)

  clock = 1_700_000_090_000
  fireEvent.click(screen.getByRole('button', { name: en.analyticsRefresh }))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(3))
  expect(read.mock.calls[2][0].to).toBe(clock)
})

// Review P17: reselecting a range this open already fetched renders it at once
// and revalidates in the background.
it('renders a seen range instantly and revalidates in the background', async () => {
  const read = vi.fn()
    .mockResolvedValueOnce(report())
    .mockResolvedValueOnce(report({ totals: { ...report().totals, requests: 700 } }))
    .mockResolvedValueOnce(report({ totals: { ...report().totals, requests: 990 } }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  expect(screen.getAllByText('12').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d }))
  await screen.findByText('700')
  fireEvent.click(screen.getByRole('button', { name: en.analyticsRange30d }))
  // The cached 30d report renders without waiting for the network.
  expect(screen.getAllByText('12').length).toBeGreaterThan(0)
  expect(screen.getByText(en.analyticsStaleResults)).toBeTruthy()
  await screen.findByText('990')
  expect(screen.queryByText(en.analyticsStaleResults)).toBeNull()
})

// Review P19: during a switch, the annotation shows and the range note follows
// the current selection instead of the old report.
it('labels the previous scan and the selected range while a switch is loading', async () => {
  const clock = Date.UTC(2026, 9, 18, 12, 0)
  vi.spyOn(Date, 'now').mockReturnValue(clock)
  let resolveSecond: (value: AnalyticsReport) => void = () => {}
  const read = vi.fn()
    .mockResolvedValueOnce(report())
    .mockReturnValueOnce(new Promise<AnalyticsReport>(resolve => { resolveSecond = resolve }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d }))
  expect(screen.getByRole('button', { name: en.analyticsRange7d }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByText(en.analyticsStaleResults)).toBeTruthy()
  // The note is computed from the selected 7-day window, not the old report.
  const dayStart = new Date(clock)
  dayStart.setHours(0, 0, 0, 0)
  dayStart.setDate(dayStart.getDate() - 6)
  const expected = dayStart.toLocaleDateString('en') + ' – ' + new Date(clock - 1).toLocaleDateString('en')
  expect(screen.getByText(expected)).toBeTruthy()
  expect(screen.queryByText('9/18/2026 – 10/18/2026')).toBeNull()
  resolveSecond(report({ totals: { ...report().totals, requests: 55 } }))
  await screen.findByText('55')
  expect(screen.queryByText(en.analyticsStaleResults)).toBeNull()
})

// Review M4: closing or superseding the dialog aborts the in-flight request,
// and an abort rejection never renders as an error banner.
it('aborts the in-flight request when the dialog goes away', async () => {
  const signals: (AbortSignal | undefined)[] = []
  const read = vi.fn().mockImplementation((_query: AnalyticsQuery, signal?: AbortSignal) => {
    signals.push(signal)
    return new Promise<AnalyticsReport>(() => {})
  })
  const { unmount } = render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  await waitFor(() => expect(signals).toHaveLength(1))
  unmount()
  expect(signals[0]?.aborted).toBe(true)
})

it('does not render an abort rejection as an error banner', async () => {
  const read = vi.fn().mockImplementation((_query: AnalyticsQuery, signal?: AbortSignal) =>
    new Promise<AnalyticsReport>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { code: 'gateway/cancelled' })))
    }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  await waitFor(() => expect(read).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d }))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  expect(screen.queryByText(en.analyticsFailed)).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('shows the coverage observability lines the Host reports', async () => {
  const read = vi.fn().mockResolvedValue(report({
    coverage: {
      ...report().coverage,
      truncated: true, truncation: 'sessions', unreadSessions: 4,
      unattributedRequests: 2, listMs: 120, scanMs: 900, pricingMs: 40,
    },
  }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
  await screen.findByText(en.analyticsTruncated)
  expect(screen.getByText(en.analyticsUnattributed + ' 2')).toBeTruthy()
  expect(screen.getByText(en.analyticsUnread + ' 4')).toBeTruthy()
  expect(screen.getByText(en.analyticsScanSegments + ' 120 / 900 / 40 ms')).toBeTruthy()
})

it('explains an unsupported host and an empty range', async () => {
  const unsupported = vi.fn().mockRejectedValue(Object.assign(new Error('no history'), {
    code: 'opencode-go/analytics-unavailable',
    details: { reason: 'no-session-query', retryable: false },
  }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={unsupported} t={t} getLocale={() => 'en'} />)
  await screen.findByText(en.analyticsUnsupported)
  cleanup()

  const empty = vi.fn().mockResolvedValue(report({
    totals: { ...report().totals, requests: 0, pricedRequests: 0, unpricedRequests: 0 },
    byModel: [], byDay: [],
  }))
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={empty} t={t} getLocale={() => 'en'} />)
  await screen.findByText(en.analyticsEmpty)
})

it('shows quota cards and switches the daily metric', async () => {
  const quota: GoUsage = {
    rolling: { status: 'ok', percent: 0, resetsAt: '2026-10-18T09:35:00Z' },
    weekly: { status: 'ok', percent: 33, resetsAt: '2026-10-19T00:00:00Z' },
    monthly: { status: 'ok', percent: 85, resetsAt: '2026-11-10T08:32:00Z' },
  }
  render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report())}
    readQuota={async () => quota} t={t} getLocale={() => 'en'} />)
  await screen.findByText('33%')
  expect(screen.getByRole('progressbar', { name: en.usage_weekly }).getAttribute('aria-valuenow')).toBe('33')
  const cost = screen.getByRole('button', { name: en.analyticsChartSpend })
  const tokens = screen.getByRole('button', { name: en.analyticsChartTokens })
  expect(cost.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(tokens)
  expect(tokens.getAttribute('aria-pressed')).toBe('true')
  expect(cost.getAttribute('aria-pressed')).toBe('false')
})

it('closes through the modal close button', async () => {
  const close = vi.fn()
  render(<AnalyticsDialog open onClose={close} readAnalytics={vi.fn().mockResolvedValue(report())} t={t} getLocale={() => 'en'} />)
  await screen.findByText('DeepSeek V4.1 Flash')
  fireEvent.click(screen.getByRole('button', { name: en.analyticsClose }))
  expect(close).toHaveBeenCalled()
})
