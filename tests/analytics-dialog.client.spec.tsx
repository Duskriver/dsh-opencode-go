// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GoUsage } from '../src/usage-contract.ts'
import { afterEach, expect, it, vi } from 'vitest'
import { AnalyticsDialog } from '../src/client/AnalyticsDialog.tsx'
import { en } from '../src/client/locales.ts'
import type { AnalyticsReport } from '../src/analytics-contract.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
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
  expect(screen.getByText(new RegExp(en.analyticsNotInvoice))).toBeTruthy()
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
