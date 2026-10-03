// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { GoUsage } from '../src/usage-contract.ts'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UsagePill } from '../src/client/UsagePill.tsx'
import { en } from '../src/client/locales.ts'
import { stubSettingsScope } from './support/settings-scope.ts'
import type { OpencodeGoSettings } from '../src/client/section-controller.ts'
import type { SettingsScope } from '../src/client/settings.ts'
import css from '../src/client/UsagePill.module.css'

const usageSettings = (value: OpencodeGoSettings = {}) => {
  const host = stubSettingsScope<OpencodeGoSettings>()
  host.publish({ status: 'ready', value })
  return host
}
let settings: SettingsScope<OpencodeGoSettings>
beforeEach(() => { vi.useFakeTimers(); settings = usageSettings().scope })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const t = (key: string) => en[key as keyof typeof en]
const usageWindow = { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' }
const usage = { source: 'account-a', rolling: { ...usageWindow, percent: 0 }, weekly: usageWindow, monthly: { ...usageWindow, percent: 7 } }
const updated = { ...usage, rolling: { ...usageWindow, percent: 25 }, weekly: { ...usageWindow, percent: 30 } }
const transientMessage = 'usage request failed: network error (ECONNRESET)'
const directory = (provider = 'deepseek') => createSnapshotStore<ModelDirectoryState>({
  current: { provider, model: provider === 'dsh-opencode-go' ? 'deepseek-v4-flash' : 'deepseek-chat' }, routable: true,
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
/** The multi-account label suffix the pill appends whenever more than one account is configured. */
const accountSuffix = (name: string) => ` · ${name}`
const twoAccounts = [
  { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
  { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
]
const tick = async (milliseconds = 60_000) => { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) }) }
const showDetails = () => { fireEvent.click(trigger()) }

it.each(['deepseek', 'opencode-go', 'dsh-opencode-go'])('keeps usage visible in always mode while using %s', async provider => {
  const host = usageSettings({ usageDisplay: 'always' })
  const store = directory(provider)
  const read = vi.fn().mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={host.scope} directory={store} readUsage={read} t={t} />) })
  expect(trigger().textContent).toContain(percentageLabel(usage))
  expect(trigger().getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('dialog')).toBeNull()
  await act(async () => { store.set({ ...store.getSnapshot(), current: null }) })
  expect(trigger().textContent).toContain(percentageLabel(usage))
  await tick()
  expect(read).toHaveBeenCalledTimes(2)
  showDetails()
  expect(screen.getAllByRole('progressbar')).toHaveLength(3)
})

it('reads a class-shaped host scope through its own receiver', async () => {
  const host = usageSettings({ usageDisplay: 'always' })
  // The real Host scope keeps getSnapshot/subscribe on the prototype, so a
  // reference handed over as a value loses `this`; the pill must call them on
  // the instance instead.
  expect(Object.hasOwn(host.scope, 'getSnapshot')).toBe(false)
  expect(Object.hasOwn(host.scope, 'subscribe')).toBe(false)
  const read = vi.fn().mockResolvedValue(usage)
  let unmount: () => void
  await act(async () => { ({ unmount } = render(<UsagePill settings={host.scope} directory={directory('deepseek')} readUsage={read} t={t} />)) })
  expect(trigger().textContent).toContain(percentageLabel(usage))
  expect(host.listenerCount()).toBe(1)
  await act(async () => { host.publish({ value: { usageDisplay: 'off' } }) })
  expect(screen.queryByRole('button')).toBeNull()
  expect(host.listenerCount()).toBe(1)
  unmount!()
  expect(host.listenerCount()).toBe(0)
})

it('applies live display changes and tears down polling and visibility refreshes while off', async () => {
  const host = usageSettings()
  const read = vi.fn().mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={host.scope} directory={directory()} readUsage={read} t={t} />) })
  expect(screen.queryByRole('button')).toBeNull()
  expect(read).not.toHaveBeenCalled()
  await act(async () => { host.publish({ value: { usageDisplay: 'always' } }) })
  expect(trigger().textContent).toContain(percentageLabel(usage))
  await act(async () => { host.publish({ value: { usageDisplay: 'off' } }) })
  expect(screen.queryByRole('button')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
  await tick()
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(read).toHaveBeenCalledTimes(1)
  await act(async () => { host.publish({ value: { usageDisplay: 'always' } }) })
  expect(read).toHaveBeenCalledTimes(2)
  await act(async () => { host.publish({ value: {} }) })
  expect(screen.queryByRole('button')).toBeNull()
  await tick()
  expect(read).toHaveBeenCalledTimes(2)
})

it('sends no usage requests in off mode even when this plugin model is selected', async () => {
  const host = usageSettings({ usageDisplay: 'off' })
  const read = vi.fn().mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={host.scope} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  await tick()
  expect(screen.queryByRole('button')).toBeNull()
  expect(read).not.toHaveBeenCalled()
})

it.each(['auto', 'always'] as const)('hides usage and stops polling when the plugin is disabled in %s mode', async usageDisplay => {
  const host = usageSettings({ usageDisplay, enabled: true })
  const read = vi.fn().mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={host.scope} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  showDetails()
  await act(async () => { host.publish({ value: { usageDisplay, enabled: false } }) })
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  await tick()
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(read).toHaveBeenCalledTimes(1)
  await act(async () => { host.publish({ value: { usageDisplay, enabled: true } }) })
  expect(read).toHaveBeenCalledTimes(2)
  expect(trigger().getAttribute('aria-expanded')).toBe('false')
})

it.each(['loading', 'unavailable'] as const)('waits for available settings before polling (%s)', async status => {
  const host = usageSettings({ usageDisplay: 'always' })
  host.publish({ status })
  const read = vi.fn().mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={host.scope} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  await tick()
  expect(read).not.toHaveBeenCalled()
  expect(screen.queryByRole('button')).toBeNull()
  await act(async () => { host.publish({ status: 'ready' }) })
  expect(read).toHaveBeenCalledTimes(1)
})

it.each(['deepseek', 'opencode-go'])('shows plugin usage only on its route and stops polling when switching to %s', async otherProvider => {
  const store = directory(otherProvider)
  const read = vi.fn().mockResolvedValue(usage)
  render(<UsagePill settings={settings} directory={store} readUsage={read} t={t} />)
  expect(read).not.toHaveBeenCalled()
  await act(async () => { store.set({ ...store.getSnapshot(), current: { provider: 'dsh-opencode-go', model: 'deepseek-v4-flash' } }) })
  expect(trigger().textContent).toContain(percentageLabel(usage))
  // The label stays one string for accessibility and for textContent, but renders as addressable spans
  // for the narrow-composer tiers: brand, reading (with a stale flag) and two unit words. No stale or
  // account segment while a single account is configured.
  expect(trigger().title).toBe(percentageLabel(usage))
  expect(trigger().querySelector(`.${css.brand}`)?.textContent).toBe('Go · ')
  expect(trigger().querySelectorAll(`.${css.unit}`)).toHaveLength(2)
  expect(trigger().querySelector(`.${css.reading}`)?.hasAttribute('data-stale')).toBe(false)
  expect(trigger().querySelector(`.${css.stale}`)).toBeNull()
  expect(trigger().querySelector(`.${css.account}`)).toBeNull()
  showDetails()
  expect(screen.getByRole('progressbar', { name: en.usage_monthly }).getAttribute('value')).toBe('7')
  await tick()
  expect(read).toHaveBeenCalledTimes(2)
  await act(async () => { store.set({ ...store.getSnapshot(), current: { provider: otherProvider, model: 'deepseek-chat' } }) })
  expect(screen.queryByRole('button')).toBeNull()
  await tick()
  expect(read).toHaveBeenCalledTimes(2)
})

it('retains same-account percentages after a temporary failure and recovers through a single manual retry', async () => {
  const store = directory('dsh-opencode-go')
  let finishRetry!: (value: GoUsage) => void
  const read = vi.fn().mockResolvedValueOnce(usage).mockRejectedValueOnce(usageError())
    .mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finishRetry = resolve }))
    .mockResolvedValue(updated)
  await act(async () => { render(<UsagePill settings={settings} directory={store} readUsage={read} t={t} />) })
  showDetails()
  const lastUpdated = () => screen.getByText(new RegExp(`^${en.usageLastUpdated}`)).textContent
  const firstUpdated = lastUpdated()
  await tick()
  expect(trigger().textContent).toContain(percentageLabel(usage))
  expect(trigger().textContent).toContain(en.usageStaleShort)
  expect(trigger().title).toBe(`${percentageLabel(usage)} · ${en.usageStaleShort}`)
  expect(trigger().querySelector(`.${css.reading}`)?.getAttribute('data-stale')).toBe('')
  expect(trigger().querySelector(`.${css.stale}`)?.textContent).toContain(en.usageStaleShort)
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
  expect(trigger().title).toBe(percentageLabel(updated))
  expect(trigger().querySelector(`.${css.stale}`)).toBeNull()
  expect(trigger().querySelector(`.${css.reading}`)?.hasAttribute('data-stale')).toBe(false)
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
  await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  expect(trigger().textContent).toContain(percentageLabel(cached))
  await tick()
  expect(trigger().textContent).toContain(en.usageUnavailable)
  expect(trigger().textContent).not.toContain('%')
  expect(trigger().textContent).not.toContain(en.usageStaleShort)
  // The non-usage state keeps the brand span so the <=460px tier can drop it, but carries no reading,
  // no unit words and no stale segment.
  expect(trigger().querySelector(`.${css.brand}`)?.textContent).toBe('Go · ')
  expect(trigger().querySelector(`.${css.reading}`)).toBeNull()
  expect(trigger().querySelector(`.${css.unit}`)).toBeNull()
  expect(trigger().querySelector(`.${css.stale}`)).toBeNull()
  showDetails()
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(screen.queryByText(en.usageStaleHint)).toBeNull()
  expect(screen.getByText(error.message)).toBeTruthy()
})

it('shows the reason for the first failure without inventing cached usage and allows retry', async () => {
  const read = vi.fn().mockRejectedValueOnce(usageError()).mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  expect(trigger().textContent).toContain(en.usageUnavailable)
  expect(trigger().textContent).not.toContain(en.usageStaleShort)
  expect(trigger().title).toBe(trigger().textContent)
  expect(trigger().querySelector(`.${css.account}`)).toBeNull()
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
  await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  await tick()
  expect(trigger().textContent).toContain(en.usageUnavailable)
  expect(trigger().textContent).not.toContain('%')
  expect(trigger().title).toBe(trigger().textContent)
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
  await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
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
  const store = directory('dsh-opencode-go')
  let finishOld!: (value: GoUsage) => void
  let finishNew!: (value: GoUsage) => void
  const readOld = vi.fn().mockResolvedValueOnce(usage)
    .mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finishOld = resolve }))
  const readNew = vi.fn().mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finishNew = resolve }))
  const view = render(<UsagePill settings={settings} directory={store} readUsage={readOld} t={t} />)
  await act(async () => { await Promise.resolve() })
  await tick()
  expect(readOld).toHaveBeenCalledTimes(2)

  await act(async () => { view.rerender(<UsagePill settings={settings} directory={store} readUsage={readNew} t={t} />) })
  expect(trigger().textContent).not.toContain('%')
  expect(readNew).toHaveBeenCalledTimes(1)
  const otherAccount = { ...updated, source: 'account-b' }
  await act(async () => { finishNew(otherAccount) })
  expect(trigger().textContent).toContain(percentageLabel(otherAccount))
  await act(async () => { finishOld(usage) })
  expect(trigger().textContent).toContain(percentageLabel(otherAccount))
})

it('marks windows near or at their limit so the bars are not all shown as healthy', async () => {
  const levels = { ...usage, rolling: { ...usageWindow, percent: 20 }, weekly: { ...usageWindow, percent: 85 }, monthly: { ...usageWindow, status: 'rate-limited' as const, percent: 60 } }
  await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(levels)} t={t} />) })
  showDetails()
  const bar = (name: string) => screen.getByRole('progressbar', { name }).className
  expect(bar(en.usage_rolling)).toBe('')
  expect(bar(en.usage_weekly)).not.toBe('')
  expect(bar(en.usage_monthly)).not.toBe('')
  expect(bar(en.usage_monthly)).not.toBe(bar(en.usage_weekly))
  expect(screen.getByText(en.usageLimited)).toBeTruthy()
})

it('renders the account segment as a hideable span and keeps the label string unchanged with more than one account', async () => {
  const host = usageSettings({ usageDisplay: 'always', accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_B' })
  const read = vi.fn().mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={host.scope} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  expect(trigger().textContent).toBe(`${percentageLabel(usage)}${accountSuffix('Backup')}`)
  expect(trigger().title).toBe(trigger().textContent)
  expect(trigger().querySelector(`.${css.account}`)?.textContent).toBe(accountSuffix('Backup'))
  expect(trigger().querySelectorAll(`.${css.unit}`)).toHaveLength(2)
})

it('keeps the account segment in the non-usage state with more than one account', async () => {
  const host = usageSettings({ usageDisplay: 'always', accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_B' })
  const read = vi.fn().mockRejectedValue(usageError())
  await act(async () => { render(<UsagePill settings={host.scope} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  expect(trigger().textContent).toBe(`Go · ${en.usageUnavailable}${accountSuffix('Backup')}`)
  expect(trigger().title).toBe(trigger().textContent)
  expect(trigger().querySelector(`.${css.account}`)?.textContent).toBe(accountSuffix('Backup'))
  expect(trigger().querySelector(`.${css.reading}`)).toBeNull()
  expect(trigger().querySelector(`.${css.unit}`)).toBeNull()
})

it('omits the account segment when at most one account is configured', async () => {
  const host = usageSettings({ usageDisplay: 'always', apiKeyEnv: 'OPENCODE_API_KEY' })
  const read = vi.fn().mockResolvedValue(usage)
  await act(async () => { render(<UsagePill settings={host.scope} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
  expect(trigger().textContent).toBe(percentageLabel(usage))
  expect(trigger().querySelector(`.${css.account}`)).toBeNull()
})
