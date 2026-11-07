// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnalyticsQuery, AnalyticsReport, GoUsage } from '../src/contracts.ts'
import { AnalyticsDialog, historyMoney, historyNumber, type AnalyticsDialogProps } from '../src/client/AnalyticsDialog.tsx'
import { en } from '../src/client/presentation.ts'
import { historyEn as copy, historyZh } from '../src/client/dashboard-copy.ts'
import css from '../src/client/AnalyticsDialog.module.css'
import { analyticsCounts, createAnalyticsReport } from './support/analytics.ts'
import './support/client.tsx'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
const accounts = [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' }, { id: 'b', name: 'Research', apiKeyEnv: 'ACCOUNT_B' }]
const quota: GoUsage = { rolling: { percent: 3, status: 'ok', resetsAt: '2026-11-07T00:00:00Z' }, weekly: { percent: 25, status: 'ok', resetsAt: '2026-11-09T00:00:00Z' }, monthly: { percent: 82, status: 'ok', resetsAt: '2026-12-01T00:00:00Z' } }
function props(extra: Partial<AnalyticsDialogProps> = {}): AnalyticsDialogProps {
  return { open: true, onClose: vi.fn(), accounts, activeRef: 'ACCOUNT_A', t: key => en[key], getLocale: () => 'en',
    readAnalytics: vi.fn(async query => createAnalyticsReport(query)), readQuota: vi.fn(async () => quota), ...extra }
}
function failure(reason: string, retainPrevious = false, source = 'fixture-identity') {
  return Object.assign(new Error('safe upstream failure'), { code: 'opencode-go/analytics-unavailable', details: { reason, retryable: retainPrevious, retainPrevious, source } })
}

describe('official history dashboard', () => {
  it('shows exact totals, correct currency units, cache hit input denominator and official scope', async () => {
    const p = props(); render(<AnalyticsDialog {...p} />)
    await screen.findAllByText('deepseek-v4.1-flash')
    expect(p.readAnalytics).toHaveBeenCalledWith({ accountRef: 'ACCOUNT_A', range: '30d' }, expect.any(AbortSignal))
    expect(screen.getByText(copy.scope)).toBeTruthy()
    expect(screen.getByText('66.7')).toBeTruthy()
    expect(screen.getAllByText('$1.23').length).toBeGreaterThan(0)
    expect(screen.getByText(copy.amountHint)).toBeTruthy()
    expect(document.querySelectorAll('[data-day]')).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/Scanning|unsettled|unpriced|session coverage/i)
  })

  it('switches viewing account, clears old data immediately and reads that account’s quota', async () => {
    let resolveNext: (report: AnalyticsReport) => void = () => {}
    const read = vi.fn().mockResolvedValueOnce(createAnalyticsReport({ accountRef: 'ACCOUNT_A' }))
      .mockReturnValueOnce(new Promise<AnalyticsReport>(resolve => { resolveNext = resolve }))
    const p = props({ readAnalytics: read }); render(<AnalyticsDialog {...p} />)
    await screen.findAllByText('deepseek-v4.1-flash')
    fireEvent.change(screen.getByRole('combobox', { name: copy.account }), { target: { value: 'ACCOUNT_B' } })
    expect(screen.queryByText('$1.23')).toBeNull()
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ accountRef: 'ACCOUNT_B', range: '30d' }, expect.any(AbortSignal)))
    expect(p.readQuota).toHaveBeenLastCalledWith('ACCOUNT_B')
    await act(async () => { resolveNext(createAnalyticsReport({ accountRef: 'ACCOUNT_B' }, { byModel: [{ ...analyticsCounts, provider: 'opencode', model: 'research-model' }] })) })
    expect(await screen.findAllByText('research-model')).toHaveLength(2)
    expect(accounts[0].apiKeyEnv).toBe('ACCOUNT_A')
  })

  it('cancels superseded requests and ignores their late results', async () => {
    let late: (report: AnalyticsReport) => void = () => {}
    let firstSignal: AbortSignal | undefined
    const read = vi.fn().mockImplementationOnce((_q, signal) => { firstSignal = signal; return new Promise<AnalyticsReport>(resolve => { late = resolve }) })
      .mockImplementation(async query => createAnalyticsReport(query, { byModel: [] }))
    const view = render(<AnalyticsDialog {...props({ readAnalytics: read })} />)
    fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(firstSignal?.aborted).toBe(true)
    await act(async () => { late(createAnalyticsReport({ accountRef: 'ACCOUNT_A' })) })
    expect(screen.queryByText('deepseek-v4.1-flash')).toBeNull()
    const current = read.mock.calls[1][1] as AbortSignal
    view.unmount(); expect(current.aborted).toBe(true)
  })

  it('forces a new snapshot on manual refresh and retains only same-identity results on transient failure', async () => {
    const read = vi.fn().mockResolvedValueOnce(createAnalyticsReport({ accountRef: 'ACCOUNT_A' }))
      .mockRejectedValueOnce(failure('network', true)).mockRejectedValueOnce(failure('network', true, 'new-key-identity'))
    render(<AnalyticsDialog {...props({ readAnalytics: read })} />)
    await screen.findAllByText('deepseek-v4.1-flash')
    fireEvent.click(screen.getByRole('button', { name: copy.refresh }))
    expect(await screen.findByText(copy.stale)).toBeTruthy()
    expect(read.mock.calls[1][0]).toEqual({ accountRef: 'ACCOUNT_A', range: '30d', refresh: true })
    expect(screen.getAllByText('$1.23').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: copy.refresh }))
    await waitFor(() => expect(screen.queryByText(copy.stale)).toBeNull())
    expect(screen.queryByText('$1.23')).toBeNull()
    expect(screen.getByText(copy.failed)).toBeTruthy()
  })

  it('replaces old data with an explicit permission error, never a fabricated zero', async () => {
    const read = vi.fn().mockResolvedValueOnce(createAnalyticsReport({ accountRef: 'ACCOUNT_A' })).mockRejectedValueOnce(failure('permission-denied'))
    render(<AnalyticsDialog {...props({ readAnalytics: read })} />)
    await screen.findAllByText('deepseek-v4.1-flash')
    fireEvent.click(screen.getByRole('button', { name: copy.refresh }))
    expect(await screen.findByText(copy.permission)).toBeTruthy()
    expect(screen.queryByText('$1.23')).toBeNull()
    expect(screen.queryByText('$0.0000')).toBeNull()
  })

  it('keeps history usable when quota fails and localizes the new surface', async () => {
    render(<AnalyticsDialog {...props({ readQuota: async () => { throw new Error('no quota') }, getLocale: () => 'zh-CN' })} />)
    expect(await screen.findByText(historyZh.quotaUnavailable)).toBeTruthy()
    expect(screen.getByText(historyZh.scope)).toBeTruthy()
    expect(screen.getAllByText('deepseek-v4.1-flash')).toHaveLength(2)
  })

  it('still shows official allowance when the key lacks history permission', async () => {
    render(<AnalyticsDialog {...props({ readAnalytics: async () => { throw failure('permission-denied') } })} />)
    expect(await screen.findByText(copy.permission)).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: copy.monthly }).getAttribute('value')).toBe('82')
  })

  it('supports keyboard and pointer/touch selection, including zero-activity days', async () => {
    render(<AnalyticsDialog {...props()} />)
    await screen.findAllByText('deepseek-v4.1-flash')
    const days = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-day]'))
    days[1].focus()
    fireEvent.keyDown(days[1], { key: 'Home' })
    expect(document.activeElement).toBe(days[0])
    fireEvent.keyDown(days[0], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(days[1])
    fireEvent.click(days[1])
    expect(days[1].getAttribute('aria-pressed')).toBe('true')
    fireEvent.pointerLeave(document.querySelector(`.${css.plot}`)!)
    expect(document.querySelector(`.${css.dayDetail}`)?.textContent).toContain('$0.0000')
    fireEvent.keyDown(days[1], { key: 'Escape' })
    expect(screen.getByText(copy.selectDay)).toBeTruthy()
    fireEvent.pointerEnter(days[0])
    expect(document.querySelector(`.${css.dayDetail}`)?.textContent).toContain('$1.23')
  })

  it('switches trend metrics and ranks distinct providers without conflating the same model', async () => {
    const read = vi.fn(async query => createAnalyticsReport(query, { byModel: [
      { ...analyticsCounts, model: 'shared-model', provider: 'opencode-go' },
      { ...analyticsCounts, model: 'shared-model', provider: 'opencode', requests: '500' },
    ] }))
    render(<AnalyticsDialog {...props({ readAnalytics: read })} />)
    await screen.findAllByText('shared-model')
    const trend = screen.getByRole('group', { name: copy.trend })
    fireEvent.click(within(trend).getByRole('button', { name: copy.requestsMode }))
    expect(within(trend).getByRole('button', { name: copy.requestsMode }).getAttribute('aria-pressed')).toBe('true')
    const ranking = screen.getByRole('group', { name: copy.ranking })
    fireEvent.click(within(ranking).getByRole('button', { name: copy.requests }))
    expect(document.querySelector(`.${css.rankIdentity}`)?.textContent).toContain('opencode')
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('shared-model')).toHaveLength(2)
    fireEvent.click(within(table).getByRole('button', { name: copy.requests }))
    expect(within(table).getByRole('columnheader', { name: /Requests/ }).getAttribute('aria-sort')).toBe('descending')
  })

  it('exports only the selected account and period and releases the download URL', async () => {
    const createUrl = vi.fn(() => 'blob:fixture'), revoke = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const exporter = vi.fn(async () => ({ filename: 'official.csv', csv: 'day,requests\r\n2026-11-06,12\r\n' }))
    render(<AnalyticsDialog {...props({ exportAnalytics: exporter })} />)
    await screen.findAllByText('deepseek-v4.1-flash')
    fireEvent.click(screen.getByRole('button', { name: copy.export }))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(exporter).toHaveBeenCalledWith({ accountRef: 'ACCOUNT_A', range: '30d' }, expect.any(AbortSignal))
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:fixture'), { timeout: 2000 })
  })

  it('clears a removed account and resets identity when credentials change while remaining open', async () => {
    const read = vi.fn(async query => createAnalyticsReport(query))
    const p = props({ readAnalytics: read })
    const view = render(<AnalyticsDialog {...p} contextKey={0} />)
    await screen.findAllByText('deepseek-v4.1-flash')
    view.rerender(<AnalyticsDialog {...p} accounts={[accounts[1]]} contextKey={1} />)
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ accountRef: 'ACCOUNT_B', range: '30d' }, expect.any(AbortSignal)))
    expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
  })

  it('does not query without an account or while closed', () => {
    const p = props({ accounts: [] }); const view = render(<AnalyticsDialog {...p} />)
    expect(p.readAnalytics).not.toHaveBeenCalled()
    expect(screen.getByText(copy.noAccounts)).toBeTruthy()
    view.rerender(<AnalyticsDialog {...p} accounts={accounts} open={false} />)
    expect(p.readAnalytics).not.toHaveBeenCalled()
  })

  it('formats quantities above Number.MAX_SAFE_INTEGER and currency rounding without precision loss', () => {
    expect(historyNumber('9007199254740993', 'en')).toBe('9,007,199,254,740,993')
    expect(historyMoney('123400000', 'en')).toBe('$1.23')
    expect(historyMoney('99999999', 'en')).toBe('$1.00')
    expect(historyMoney('900719925474099300000000', 'en')).toBe('$9,007,199,254,740,993.00')
  })
})
