// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { GoUsage } from '../src/usage-contract.ts'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UsagePill } from '../src/client/UsagePill.tsx'
import { en } from '../src/client/locales.ts'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const t = (key: string) => en[key as keyof typeof en]
const usageWindow = { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' }
const usage = { source: 'account-a', rolling: { ...usageWindow, percent: 0 }, weekly: usageWindow, monthly: { ...usageWindow, percent: 7 } }
const updated = { ...usage, rolling: { ...usageWindow, percent: 25 }, weekly: { ...usageWindow, percent: 30 } }
const transientMessage = 'usage request failed: network error (ECONNRESET)'
const directory = (provider = 'deepseek') => createSnapshotStore<ModelDirectoryState>({
  current: { provider, model: provider === 'opencode-go' ? 'deepseek-v4-flash' : 'deepseek-chat' }, routable: true,
  groups: [], failures: [], status: 'ready', error: null,
})
const usageError = (options: { retainPrevious?: boolean; retryable?: boolean; source?: string | null; message?: string } = {}) =>
  Object.assign(new Error(options.message ?? transientMessage), {
    code: 'opencode-go/usage-unavailable',
    details: {
      retryable: options.retryable ?? true,
      retainPrevious: options.retainPrevious ?? true,
      ...(options.source === null ? {} : { source: options.source ?? 'account-a' }),
    },
  })
const trigger = () => screen.getByRole<HTMLButtonElement>('button', { name: new RegExp(en.usageTitle) })
const percentageLabel = (value: GoUsage) => `Go · ${en.usageRollingShort} ${value.rolling.percent}% · ${en.usageWeekShort} ${value.weekly.percent}%`
const tick = async (milliseconds = 60_000) => { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) }) }
const showDetails = () => { fireEvent.click(trigger()) }

it('appears only for Go, shows all account windows, and stops polling when switching away', async () => {
  const store = directory()
  const read = vi.fn().mockResolvedValue(usage)
  render(<UsagePill directory={store} readUsage={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  await act(async () => { store.set({ ...store.getSnapshot(), current: { provider: 'opencode-go', model: 'deepseek-v4-flash' } }) })
  expect(trigger().textContent).toContain(percentageLabel(usage))
  showDetails()
  expect(screen.getByRole('progressbar', { name: en.usage_monthly }).getAttribute('value')).toBe('7')
  await tick()
  expect(read).toHaveBeenCalledTimes(2)
  await act(async () => { store.set({ ...store.getSnapshot(), current: { provider: 'deepseek', model: 'deepseek-chat' } }) })
  expect(screen.queryByRole('button')).toBeNull()
  await tick()
  expect(read).toHaveBeenCalledTimes(2)
})

it('retains same-account percentages after a temporary failure and recovers through a single manual retry', async () => {
  const store = directory('opencode-go')
  let finishRetry!: (value: GoUsage) => void
  const read = vi.fn().mockResolvedValueOnce(usage).mockRejectedValueOnce(usageError())
    .mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finishRetry = resolve }))
    .mockResolvedValue(updated)
  await act(async () => { render(<UsagePill directory={store} readUsage={read} t={t} />) })
  showDetails()
  const lastUpdated = () => screen.getByText(new RegExp(`^${en.usageLastUpdated}`)).textContent
  const firstUpdated = lastUpdated()
  await tick()
  expect(trigger().textContent).toContain(percentageLabel(usage))
  expect(trigger().textContent).toContain(en.usageStaleShort)
  expect(lastUpdated()).toBe(firstUpdated)
  expect(screen.getAllByRole('progressbar')).toHaveLength(3)
  expect(screen.getByText(en.usageRefreshFailed)).toBeTruthy()
  expect(screen.getByText(en.usageStaleHint)).toBeTruthy()
  expect(screen.getByText(transientMessage)).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: en.usageRetry }))
  const retry = screen.getByRole<HTMLButtonElement>('button', { name: en.usageRefreshing })
  expect(retry.disabled).toBe(true)
  fireEvent.click(retry)
  await tick(120_000)
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(read).toHaveBeenCalledTimes(3)

  await act(async () => { finishRetry(updated) })
  expect(trigger().textContent).toContain(percentageLabel(updated))
  expect(trigger().textContent).not.toContain(en.usageStaleShort)
  expect(screen.queryByText(en.usageStaleHint)).toBeNull()
  expect(screen.queryByText(transientMessage)).toBeNull()
  expect(lastUpdated()).not.toBe(firstUpdated)
  expect(screen.getByRole('progressbar', { name: en.usage_rolling }).getAttribute('value')).toBe('25')
  await tick()
  expect(read).toHaveBeenCalledTimes(4)
})

it.each([
  { reason: 'HTTP 401', cached: usage, error: usageError({ retainPrevious: false, retryable: false, message: 'usage request failed: HTTP 401' }) },
  { reason: 'HTTP 403', cached: usage, error: usageError({ retainPrevious: false, retryable: false, message: 'usage request failed: HTTP 403' }) },
  { reason: 'an explicit account reset', cached: usage, error: usageError({ retainPrevious: false, source: 'account-b' }) },
  { reason: 'a different source despite a retain hint', cached: usage, error: usageError({ source: 'account-b' }) },
  { reason: 'an error without source identity', cached: usage, error: usageError({ source: null }) },
  { reason: 'a cached result without source identity', cached: { rolling: usage.rolling, weekly: usage.weekly, monthly: usage.monthly }, error: usageError() },
])('clears previous percentages after $reason', async ({ cached, error }) => {
  const read = vi.fn().mockResolvedValueOnce(cached).mockRejectedValue(error)
  await act(async () => { render(<UsagePill directory={directory('opencode-go')} readUsage={read} t={t} />) })
  expect(trigger().textContent).toContain(percentageLabel(cached))
  await tick()
  expect(trigger().textContent).toContain(en.usageUnavailable)
  expect(trigger().textContent).not.toContain('%')
  expect(trigger().textContent).not.toContain(en.usageStaleShort)
  showDetails()
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(screen.queryByText(en.usageStaleHint)).toBeNull()
  expect(screen.getByText(error.message)).toBeTruthy()
})

it('shows the reason for the first failure without inventing cached usage and allows retry', async () => {
  const read = vi.fn().mockRejectedValueOnce(usageError()).mockResolvedValue(usage)
  await act(async () => { render(<UsagePill directory={directory('opencode-go')} readUsage={read} t={t} />) })
  expect(trigger().textContent).toContain(en.usageUnavailable)
  expect(trigger().textContent).not.toContain(en.usageStaleShort)
  showDetails()
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(screen.getByText(transientMessage)).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.usageRetry })) })
  expect(read).toHaveBeenCalledTimes(2)
  expect(trigger().textContent).toContain(percentageLabel(usage))
  expect(screen.queryByText(transientMessage)).toBeNull()
})

it('clears cached usage for an unclassified error and does not display its raw message', async () => {
  const privateMessage = 'upstream rejected private-token=secret'
  const read = vi.fn().mockResolvedValueOnce(usage).mockRejectedValue(new Error(privateMessage))
  await act(async () => { render(<UsagePill directory={directory('opencode-go')} readUsage={read} t={t} />) })
  await tick()
  expect(trigger().textContent).toContain(en.usageUnavailable)
  expect(trigger().textContent).not.toContain('%')
  showDetails()
  expect(screen.getByRole('alert').textContent).toContain(en.usageRefreshFailed)
  expect(screen.getByRole('alert').textContent).toContain(en.usageUnavailable)
  expect(screen.queryByText(privateMessage)).toBeNull()
  expect(screen.queryByRole('progressbar')).toBeNull()
})

it('resumes polling when visible and avoids concurrent timer and visibility reads', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  let finish!: (value: GoUsage) => void
  const read = vi.fn().mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finish = resolve })).mockResolvedValue(usage)
  await act(async () => { render(<UsagePill directory={directory('opencode-go')} readUsage={read} t={t} />) })
  await tick()
  expect(read).not.toHaveBeenCalled()
  visibility.mockReturnValue('visible')
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  await tick()
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(read).toHaveBeenCalledTimes(1)
  await act(async () => { finish(usage) })
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(read).toHaveBeenCalledTimes(2)
})

it('clears usage when its source reader changes and ignores the previous reader’s late response', async () => {
  const store = directory('opencode-go')
  let finishOld!: (value: GoUsage) => void
  let finishNew!: (value: GoUsage) => void
  const readOld = vi.fn().mockResolvedValueOnce(usage)
    .mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finishOld = resolve }))
  const readNew = vi.fn().mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finishNew = resolve }))
  const view = render(<UsagePill directory={store} readUsage={readOld} t={t} />)
  await act(async () => { await Promise.resolve() })
  await tick()
  expect(readOld).toHaveBeenCalledTimes(2)

  await act(async () => { view.rerender(<UsagePill directory={store} readUsage={readNew} t={t} />) })
  expect(trigger().textContent).not.toContain('%')
  expect(readNew).toHaveBeenCalledTimes(1)
  const otherAccount = { ...updated, source: 'account-b' }
  await act(async () => { finishNew(otherAccount) })
  expect(trigger().textContent).toContain(percentageLabel(otherAccount))
  await act(async () => { finishOld(usage) })
  expect(trigger().textContent).toContain(percentageLabel(otherAccount))
})
