// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { afterEach, expect, it, vi } from 'vitest'
import { UsagePill } from '../src/client/UsagePill.tsx'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })
const t = (key: string) => en[key as keyof typeof en]
const window = { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' }
const usage = { rolling: { ...window, percent: 0 }, weekly: window, monthly: { ...window, percent: 7 } }
const directory = () => createSnapshotStore<ModelDirectoryState>({
  current: { provider: 'deepseek', model: 'deepseek-chat' }, routable: true,
  groups: [], failures: [], status: 'ready', error: null,
})

it('appears only for Go, shows all account windows, and stops polling when switching away', async () => {
  vi.useFakeTimers()
  const store = directory()
  const read = vi.fn().mockResolvedValue(usage)
  render(<UsagePill directory={store} readUsage={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  await act(async () => { store.set({ ...store.getSnapshot(), current: { provider: 'opencode-go', model: 'deepseek-v4-flash' } }) })
  fireEvent.click(screen.getByRole('button', { name: /Go · 5h 0% · week 10%/ }))
  expect(screen.getByRole('progressbar', { name: 'Monthly' }).getAttribute('value')).toBe('7')
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(read).toHaveBeenCalledTimes(2)
  await act(async () => { store.set({ ...store.getSnapshot(), current: { provider: 'deepseek', model: 'deepseek-chat' } }) })
  expect(screen.queryByRole('button')).toBeNull()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(read).toHaveBeenCalledTimes(2)
})

it('shows unavailable instead of retaining stale percentages after a failed refresh', async () => {
  vi.useFakeTimers()
  const store = directory()
  store.set({ ...store.getSnapshot(), current: { provider: 'opencode-go', model: 'deepseek-v4-flash' } })
  const read = vi.fn().mockResolvedValueOnce(usage).mockRejectedValue(new Error('offline'))
  await act(async () => { render(<UsagePill directory={store} readUsage={read} t={t} />) })
  expect(screen.getByText('Go · 5h 0% · week 10%')).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(screen.getByText('Go · Unavailable')).toBeTruthy()
})
