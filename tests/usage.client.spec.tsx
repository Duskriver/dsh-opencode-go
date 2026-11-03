// @vitest-environment jsdom
import { describe, afterEach, beforeEach, expect, it, vi } from 'vitest'
import css from '../src/client/UsagePill.module.css'
import pickerCss from '../src/client/ThemePicker.module.css'
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { GoUsage, AnalyticsQuery, AnalyticsReport } from '../src/contracts.ts'
import { UsagePill } from '../src/client/UsagePill.tsx'
import {
  en,
  setGoTheme,
  DEFAULT_GO_THEME,
  GO_THEMES,
  GO_THEME_TOKENS,
  getGoTheme,
  subscribeGoTheme,
  themeStyle,
  useGoThemeTokens,
} from '../src/client/presentation.ts'
import { createConfigForm } from './support/client.tsx'
import type { OpencodeGoSettings } from '../src/client/controller.ts'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { AnalyticsDialog } from '../src/client/AnalyticsDialog.tsx'
import { ThemePicker } from '../src/client/Section.tsx'

describe("conversation usage", () => {
  const usageSettings = (value: OpencodeGoSettings = {}) => {
    const host = createConfigForm<OpencodeGoSettings>()
    host.publish({ status: 'ready', value })
    return host
  }

  let settings: ConfigForm<OpencodeGoSettings>

  beforeEach(() => { vi.useFakeTimers(); settings = usageSettings().form; localStorage.clear(); setGoTheme('graphite') })

  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

  const t = (key: string) => en[key as keyof typeof en]

  const usageWindow = { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' }

  const usage = { source: 'account-a', rolling: { ...usageWindow, percent: 0 }, weekly: usageWindow, monthly: { ...usageWindow, percent: 7 } }

  const updated = { ...usage, rolling: { ...usageWindow, percent: 25 }, weekly: { ...usageWindow, percent: 30 } }

  const transientMessage = 'usage request failed: network error (ECONNRESET)'

  const analyticsReport = {
    generatedAt: Date.UTC(2026, 9, 18), range: { from: Date.UTC(2026, 8, 18), to: Date.UTC(2026, 9, 18) }, timeZone: 'UTC',
    totals: { requests: 1, unsettledAttempts: 0, summaries: 0, inputTokens: 10, outputTokens: 5, cacheReadTokens: 0,
      cacheWriteTokens: 0, estimatedMicroUsd: 100, pricedRequests: 1, unpricedRequests: 0, missingUsage: 0 },
    byModel: [], byDay: [],
    coverage: { listedSessions: 1, scannedSessions: 1, matchedSessions: 1, failedSessions: 0, eventsScanned: 2,
      summaries: 0, legacyRequests: 0, missingUsage: 0, truncated: false, scanMs: 3 },
    pricing: { source: 'models.dev', unpricedModels: [] },
  }

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

  const percentageLabel = (value: GoUsage) => `${en.usageRollingShort} ${value.rolling.percent}% · ${en.usageWeekShort} ${value.weekly.percent}%`

  const accountSuffix = (name: string) => ` · ${name}`

  const twoAccounts = [
    { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
    { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
  ]

  const threeAccounts = [
    ...twoAccounts,
    { id: 'c', name: 'Travel', apiKeyEnv: 'ACCOUNT_C' },
  ]

  const tick = async (milliseconds = 60_000) => { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) }) }

  const showDetails = () => { fireEvent.click(trigger()) }

  it.each(['deepseek', 'opencode-go', 'dsh-opencode-go'])('keeps usage visible in always mode while using %s', async provider => {
    const host = usageSettings({ usageDisplay: 'always' })
    const store = directory(provider)
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={host.form} directory={store} readUsage={read} t={t} />) })
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
    expect(Object.hasOwn(host.form, 'getSnapshot')).toBe(false)
    expect(Object.hasOwn(host.form, 'subscribe')).toBe(false)
    const read = vi.fn().mockResolvedValue(usage)
    let unmount: () => void
    await act(async () => { ({ unmount } = render(<UsagePill settings={host.form} directory={directory('deepseek')} readUsage={read} t={t} />)) })
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
    await act(async () => { render(<UsagePill settings={host.form} directory={directory()} readUsage={read} t={t} />) })
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
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    await tick()
    expect(screen.queryByRole('button')).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it.each(['auto', 'always'] as const)('hides usage and stops polling when the plugin is disabled in %s mode', async usageDisplay => {
    const host = usageSettings({ usageDisplay, enabled: true })
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
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
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
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
    // for the narrow-composer tiers: reading (with a stale flag) and two unit words. No stale or
    // account segment while a single account is configured.
    expect(trigger().title).toBe(percentageLabel(usage))
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
    // The hung retry holds the refresh latch: while it is in flight, visibility changes
    // cannot stack another read onto it (asserted inside the ~30s latch window).
    await tick(29_000)
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
    // The non-usage state carries no reading, no unit words and no stale segment.
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

  it('resumes polling when visible and avoids concurrent reads while one is in flight', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    let finish!: (value: GoUsage) => void
    const read = vi.fn().mockImplementationOnce(() => new Promise<GoUsage>(resolve => { finish = resolve })).mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    await tick()
    expect(read).not.toHaveBeenCalled()
    visibility.mockReturnValue('visible')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    // While that read is in flight, a second visibility change cannot stack another read.
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(read).toHaveBeenCalledTimes(1)
    await act(async () => { finish(usage) })
    expect(trigger().textContent).toContain(percentageLabel(usage))
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(read).toHaveBeenCalledTimes(2)
    await tick()
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('releases the busy latch when a usage read never settles and resumes timer refreshes without a fabricated failure', async () => {
    const read = vi.fn().mockImplementation(() => new Promise<GoUsage>(() => {}))
    await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    expect(read).toHaveBeenCalledTimes(1)
    expect(trigger().textContent).toBe('…')
    // Just before the sentinel, the minute timer stays latched out behind the hung read.
    await tick(29_000)
    expect(read).toHaveBeenCalledTimes(1)
    // The ~30s sentinel frees the latch without reporting a failure, and the next
    // minute cycle regains its turn.
    await tick(31_000)
    expect(read).toHaveBeenCalledTimes(2)
    expect(trigger().textContent).toBe('…')
    expect(screen.queryByText(en.usageUnavailable)).toBeNull()
  })

  it('frees the busy latch when a hung retry never settles so a later manual refresh can fire', async () => {
    const read = vi.fn().mockRejectedValueOnce(usageError())
      .mockImplementationOnce(() => new Promise<GoUsage>(() => {}))
      .mockResolvedValue(updated)
    await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    expect(trigger().textContent).toContain(en.usageUnavailable)
    showDetails()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.usageRetry })) })
    expect(read).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: en.usageRefreshing }).disabled).toBe(true)
    // While the hung retry holds the latch, visibility refreshes cannot stack another read.
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(read).toHaveBeenCalledTimes(2)
    // At ~30s the sentinel frees the latch; the retry control revives and the next
    // manual refresh can be issued and lands.
    await tick(30_000)
    expect(read).toHaveBeenCalledTimes(2)
    const retryButton = screen.getByRole<HTMLButtonElement>('button', { name: en.usageRetry })
    expect(retryButton.disabled).toBe(false)
    await act(async () => { fireEvent.click(retryButton) })
    expect(read).toHaveBeenCalledTimes(3)
    await act(async () => { await Promise.resolve() })
    expect(trigger().textContent).toContain(percentageLabel(updated))
    expect(trigger().textContent).not.toContain(en.usageStaleShort)
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
    const bar = (name: string) => screen.getByRole('progressbar', { name })
    expect(bar(en.usage_rolling).classList.contains(css.high)).toBe(false)
    expect(bar(en.usage_weekly).classList.contains(css.high)).toBe(true)
    expect(bar(en.usage_monthly).classList.contains(css.limited)).toBe(true)
    expect(bar(en.usage_weekly).classList.contains(css.limited)).toBe(false)
    expect(screen.getByText(en.usageLimited)).toBeTruthy()
  })

  it('renders the active account’s full name as a truncatable span with more than one account', async () => {
    const host = usageSettings({ usageDisplay: 'always', accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_B' })
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    // The name is part of the spoken label itself, so visible and accessible strings agree.
    expect(trigger().textContent).toBe(`${percentageLabel(usage)}${accountSuffix('Backup')}`)
    expect(trigger().title).toContain('Backup')
    expect(trigger().querySelectorAll(`.${css.account}`)).toHaveLength(1)
    expect(trigger().querySelector(`.${css.account}`)?.textContent).toBe('Backup')
    expect(trigger().textContent).not.toMatch(/\+\d/)
    expect(trigger().querySelectorAll(`.${css.unit}`)).toHaveLength(2)
  })

  it('keeps the account segment in the non-usage state with more than one account', async () => {
    const host = usageSettings({ usageDisplay: 'always', accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_B' })
    const read = vi.fn().mockRejectedValue(usageError())
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    expect(trigger().textContent).toBe(`${en.usageUnavailable}${accountSuffix('Backup')}`)
    expect(trigger().title).toContain('Backup')
    expect(trigger().querySelector(`.${css.account}`)?.textContent).toBe('Backup')
    expect(trigger().querySelector(`.${css.reading}`)).toBeNull()
    expect(trigger().querySelector(`.${css.unit}`)).toBeNull()
  })

  it('omits the account segment when at most one account is configured', async () => {
    const host = usageSettings({ usageDisplay: 'always', apiKeyEnv: 'OPENCODE_API_KEY' })
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    expect(trigger().textContent).toBe(percentageLabel(usage))
    expect(trigger().querySelector(`.${css.account}`)).toBeNull()
  })

  const openPanel = () => screen.getByRole('dialog', { name: en.usageTitle })

  const writableSettings = (apiKeyEnv = 'ACCOUNT_A') => {
    const host = createConfigForm<OpencodeGoSettings>()
    host.publish({ status: 'ready', writable: true, value: { usageDisplay: 'always', accounts: twoAccounts, apiKeyEnv } })
    return host
  }

  const switchButton = () => screen.getByRole('button', { name: new RegExp(en.accountSwitchAction) })

  it('shows the account on a card row instead of a native picker, and drops the hint line', async () => {
    const host = writableSettings()
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} selectAccount={vi.fn()} />) })
    showDetails()
    expect(within(openPanel()).getByText('Primary')).toBeTruthy()
    expect(within(openPanel()).getByText(en.accountPreferredTag)).toBeTruthy()
    expect(within(openPanel()).getByRole('button', { name: new RegExp(en.accountSwitchAction) })).toBeTruthy()
    // The removed explainer must not come back, and the native <select> is gone with it.
    expect(within(openPanel()).queryByText(/refreshes every minute/)).toBeNull()
    expect(within(openPanel()).queryByRole('combobox')).toBeNull()
    // One account leaves nothing to choose, so no drill-down is offered.
    cleanup()
    const single = usageSettings({ usageDisplay: 'always', accounts: [twoAccounts[0]!], apiKeyEnv: 'ACCOUNT_A' })
    await act(async () => { render(<UsagePill settings={single.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} selectAccount={vi.fn()} />) })
    showDetails()
    expect(within(openPanel()).queryByRole('button', { name: new RegExp(en.accountSwitchAction) })).toBeNull()
  })

  it('switches the spending account through the drill-down list and returns to the reading', async () => {
    const host = writableSettings()
    const read = vi.fn().mockResolvedValue(usage)
    const selectAccount = vi.fn().mockResolvedValue(true)
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={read} t={t} selectAccount={selectAccount} />) })
    showDetails()
    fireEvent.click(switchButton())
    const list = screen.getByRole('listbox', { name: en.accountSwitchTitle })
    const options = within(list).getAllByRole('option')
    expect(options.map(option => option.textContent)).toEqual(['Primary', 'Backup'])
    expect(options[0]!.getAttribute('aria-selected')).toBe('true')
    expect(options[1]!.getAttribute('aria-selected')).toBe('false')
    // The choice is the user's own; the copy says the order still lives in Settings.
    expect(screen.getByText(en.accountSwitchHint)).toBeTruthy()
    await act(async () => { fireEvent.click(options[1]!) })
    expect(selectAccount).toHaveBeenCalledWith('ACCOUNT_B')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(within(openPanel()).getAllByRole('progressbar')).toHaveLength(3)
  })

  it('keeps the list open with the failure notice when the host refuses the switch', async () => {
    const host = writableSettings()
    const selectAccount = vi.fn().mockRejectedValue(new Error('settings are read-only'))
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)} t={t} selectAccount={selectAccount} />) })
    showDetails()
    fireEvent.click(switchButton())
    const options = within(screen.getByRole('listbox', { name: en.accountSwitchTitle })).getAllByRole('option')
    await act(async () => { fireEvent.click(options[1]!) })
    expect(screen.getByRole('alert').textContent).toBe(en.accountSwitchFailed)
    expect(screen.getByRole('listbox', { name: en.accountSwitchTitle })).toBeTruthy()
  })

  it('walks the account list with the arrow keys and leaves it with Escape before the panel', async () => {
    const host = writableSettings()
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)} t={t} selectAccount={vi.fn()} />) })
    showDetails()
    fireEvent.click(switchButton())
    const list = screen.getByRole('listbox', { name: en.accountSwitchTitle })
    const options = within(list).getAllByRole('option')
    options[0]!.focus()
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(options[1])
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(options[0])
    fireEvent.keyDown(list, { key: 'Escape' })
    // Escape steps back to the reading; the panel itself stays open.
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(openPanel()).toBeTruthy()
    expect(within(openPanel()).getAllByRole('progressbar')).toHaveLength(3)
  })

  it('opens the shared analytics dialog from the expanded panel', async () => {
    const host = usageSettings({ usageDisplay: 'always' })
    const analytics = vi.fn().mockResolvedValue(analyticsReport)
    await act(async () => {
      render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)}
        readAnalytics={analytics} t={t} />)
    })
    showDetails()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsOpen })) })
    expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
    expect(analytics).toHaveBeenCalledTimes(1)
  })

  it('keeps the analytics dialog open when a credential revision bump remounts the pill', async () => {
    const host = usageSettings({ usageDisplay: 'always' })
    const credentials = createSnapshotStore<number>(0)
    const analytics = vi.fn().mockResolvedValue(analyticsReport)
    await act(async () => {
      render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)}
        readAnalytics={analytics} t={t} credentialChanges={credentials} />)
    })
    showDetails()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsOpen })) })
    expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
    expect(analytics).toHaveBeenCalledTimes(1)
    // A credential change is part of the pill's remount key; the dashboard lives above
    // that key, so it must stay open with its already-fetched report (no second read).
    await act(async () => { credentials.set(1) })
    expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
    expect(analytics).toHaveBeenCalledTimes(1)
  })

  it('names the active account in full no matter how many accounts follow it', async () => {
    const host = usageSettings({ usageDisplay: 'always', accounts: threeAccounts, apiKeyEnv: 'ACCOUNT_B' })
    await act(async () => {
      render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')}
        readUsage={vi.fn().mockResolvedValue(usage)} t={t} />)
    })
    const account = trigger().querySelector(`.${css.account}`) as HTMLElement
    expect(account.textContent).toBe('Backup')
    expect(trigger().textContent).toContain('Backup')
    expect(trigger().textContent).not.toContain('+2')
  })

  const manyAccounts = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: `account-${index + 1}`, name: `Account ${index + 1}`, apiKeyEnv: `ACCOUNT_${index + 1}`,
  }))

  it('uses the full name instead of an extra-count badge with many accounts', async () => {
    const eleven = usageSettings({ usageDisplay: 'always', accounts: manyAccounts(11), apiKeyEnv: 'ACCOUNT_2' })
    await act(async () => {
      render(<UsagePill settings={eleven.form} directory={directory('dsh-opencode-go')}
        readUsage={vi.fn().mockResolvedValue(usage)} t={t} />)
    })
    expect(trigger().querySelector(`.${css.account}`)?.textContent).toBe('Account 2')
    expect(trigger().textContent).not.toContain('+9')
    expect(trigger().textContent).not.toContain('9+')
  })

  it('keeps the styling choice out of the popover', async () => {
    const host = usageSettings({ usageDisplay: 'always' })
    await act(async () => {
      render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')}
        readUsage={vi.fn().mockResolvedValue(usage)} t={t} />)
    })
    const root = trigger().parentElement as HTMLElement
    expect(['#111214', '#f6f7f9']).toContain(root.style.getPropertyValue('--go-bg'))
    showDetails()
    // The stored style still paints the pill; only the Settings page may change it.
    await act(async () => { setGoTheme('silent-black') })
    expect(['#101010', '#f8f8f8']).toContain(root.style.getPropertyValue('--go-bg'))
    expect(within(openPanel()).queryByRole('group', { name: en.themeLabel })).toBeNull()
    expect(within(openPanel()).queryByRole('button', { name: en.themeSilentBlack })).toBeNull()
  })
})

describe("analytics dashboard", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  beforeEach(() => { localStorage.clear() })

  const t = (key: keyof typeof en) => en[key]

  const rect = (left: number, top: number): DOMRect => ({
    left, top, right: left + 20, bottom: top + 20, width: 20, height: 20, x: left, y: top, toJSON: () => ({}),
  }) as DOMRect

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
    await screen.findAllByText('DeepSeek V4.1 Flash')
    // The simplified table no longer carries the invocation id or the plan limits.
    expect(screen.queryByText('deepseek-v4.1-flash')).toBeNull()
    expect(screen.queryByText(/Go \$80/)).toBeNull()
    expect(screen.getAllByText(/\$1\.23/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Prices: models\.dev/)).toBeTruthy()
    // Review U5: the disclaimer must name the current-price estimate semantics.
    expect(screen.getByText(new RegExp(en.analyticsNotInvoice))).toBeTruthy()
    expect(en.analyticsNotInvoice).toContain('current models.dev prices')
  })

  it('asks for a shorter range and can scan more history', async () => {
    const read = vi.fn().mockResolvedValue(report())
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
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
    await screen.findAllByText('DeepSeek V4.1 Flash')
    expect(restored.mock.calls[0][0].maxSessions).toBe(1000)
    cleanup()

    // Stored junk clamps into the 1..2000 contract window.
    localStorage.setItem('opencode-go:analytics:maxSessions', '9999')
    const clampedHigh = vi.fn().mockResolvedValue(report())
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={clampedHigh} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
    expect(clampedHigh.mock.calls[0][0].maxSessions).toBe(2000)
    cleanup()

    localStorage.setItem('opencode-go:analytics:maxSessions', 'not-a-number')
    const clampedJunk = vi.fn().mockResolvedValue(report())
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={clampedJunk} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
    expect(clampedJunk.mock.calls[0][0].maxSessions).toBe(500)
  })

  it('freezes the window end for one open and moves it on refresh', async () => {
    let clock = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => clock)
    const read = vi.fn().mockResolvedValue(report())
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
    fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(read.mock.calls[1][0].to).toBe(read.mock.calls[0][0].to)
    expect(read.mock.calls[1][0].from).not.toBe(read.mock.calls[0][0].from)

    clock = 1_700_000_090_000
    fireEvent.click(screen.getByRole('button', { name: en.analyticsRefresh }))
    await waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    expect(read.mock.calls[2][0].to).toBe(clock)
  })

  it('renders a seen range instantly and revalidates in the background', async () => {
    const read = vi.fn()
      .mockResolvedValueOnce(report())
      .mockResolvedValueOnce(report({ totals: { ...report().totals, requests: 700 } }))
      .mockResolvedValueOnce(report({ totals: { ...report().totals, requests: 990 } }))
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
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

  it('labels the previous scan and the selected range while a switch is loading', async () => {
    const clock = Date.UTC(2026, 9, 18, 12, 0)
    vi.spyOn(Date, 'now').mockReturnValue(clock)
    let resolveSecond: (value: AnalyticsReport) => void = () => {}
    const read = vi.fn()
      .mockResolvedValueOnce(report())
      .mockReturnValueOnce(new Promise<AnalyticsReport>(resolve => { resolveSecond = resolve }))
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={read} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
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
    // The quota row keeps the number, bar and reset time, but no state label or remainder.
    expect(screen.queryByText('Plenty left')).toBeNull()
    expect(screen.queryByText('67% left')).toBeNull()
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
    await screen.findAllByText('DeepSeek V4.1 Flash')
    fireEvent.click(screen.getByRole('button', { name: en.analyticsClose }))
    expect(close).toHaveBeenCalled()
  })

  it('shows a day summary tooltip from the calendar and the trend', async () => {
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report())} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')

    const cell = document.querySelector('span[data-day="2026-10-18"]') as HTMLElement
    expect(cell).toBeTruthy()
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(rect(100, 50))
    fireEvent.mouseMove(cell, { clientX: 110, clientY: 60 })
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('$1.23')
    expect(tip.textContent).toContain('12')
    expect(tip.textContent).toContain('6K')

    fireEvent.mouseLeave(document.querySelector('[class*="_daysWrap_"]') as HTMLElement)
    expect(screen.queryByRole('tooltip')).toBeNull()

    const hit = document.querySelector('rect[data-day="2026-10-18"]') as Element
    expect(hit).toBeTruthy()
    fireEvent.mouseMove(hit)
    expect((await screen.findByRole('tooltip')).textContent).toContain('6K')
  })

  it('clears the day tooltip once the pointer leaves the nearest cell', async () => {
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report())} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
    // The fixture spans 2026-09-18 → 2026-10-18, so the dense grid has 31 cells.
    const cells = Array.from(document.querySelectorAll('span[data-day]')) as HTMLElement[]
    expect(cells).toHaveLength(31)
    const target = document.querySelector('span[data-day="2026-10-18"]') as HTMLElement
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(100, 50))

    const heat = document.querySelector('[class*="_heat_"]') as HTMLElement
    fireEvent.mouseMove(heat, { clientX: 110, clientY: 60 })
    expect((await screen.findByRole('tooltip')).textContent).toContain('$1.23')

    // 3px outside the cell still counts as "near".
    fireEvent.mouseMove(heat, { clientX: 123, clientY: 60 })
    expect(screen.getByRole('tooltip')).toBeTruthy()

    // Empty pad far from every cell clears it.
    fireEvent.mouseMove(heat, { clientX: 300, clientY: 60 })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('lays sparse activity onto the real calendar dates', async () => {
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report({
      byDay: [
        { day: '2026-10-01', requests: 2, tokens: 2000, estimatedMicroUsd: 2_000_000 },
        { day: '2026-10-18', requests: 3, tokens: 3000, estimatedMicroUsd: 3_000_000 },
      ],
    }))} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')

    const heat = document.querySelector('[class*="_heat_"]') as HTMLElement
    const pads = Array.from(heat.querySelectorAll('[class*="_heatPad_"]'))
    const cells = Array.from(heat.querySelectorAll('span[data-day]')) as HTMLElement[]
    // 2026-09-18 is a Friday, so a Monday-first grid needs four leading pads.
    expect(pads).toHaveLength(4)
    expect(cells).toHaveLength(31)
    const indexOf = (day: string): number => cells.findIndex(cell => cell.dataset.day === day)
    expect(indexOf('2026-10-01')).toBe(13)
    expect(indexOf('2026-10-18')).toBe(30)
    expect((pads.length + indexOf('2026-10-01')) % 7).toBe(3) // Thursday
    expect((pads.length + indexOf('2026-10-18')) % 7).toBe(6) // Sunday

    // A quiet day between them is still a real, hoverable cell.
    const zeroIndex = indexOf('2026-10-10')
    expect(zeroIndex).toBeGreaterThanOrEqual(0)
    const zero = cells[zeroIndex]
    vi.spyOn(zero, 'getBoundingClientRect').mockReturnValue(rect(100, 50))
    fireEvent.mouseMove(zero, { clientX: 110, clientY: 60 })
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('$0.00')
    expect(tip.textContent).toContain('0')
    expect(tip.textContent).toContain('10/10')
  })

  it('reports cache hit share over input and cache tokens only', async () => {
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report())} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
    expect(document.body.textContent).toContain('75.0%')
    expect(document.body.textContent).toContain(en.analyticsCacheHit)
    expect(document.body.textContent).not.toContain('50.0%')
  })

  it('prints a dash instead of a zero estimate when nothing is priced', async () => {
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report({
      totals: { ...report().totals, estimatedMicroUsd: 0, pricedRequests: 0, unpricedRequests: 2 },
      byModel: [], byDay: [],
    }))} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText(/In the selected range/)
    const lead = document.querySelector('[class*="_lead_"]') as HTMLElement
    expect(lead.textContent).toContain('—')
    expect(document.body.textContent).not.toContain('$0.00')
  })

  it('separates unpriced models from models without usage', async () => {
    const base = report()
    const pricedRow = { ...base.byModel[0], model: 'priced-model', name: 'Priced Model', requests: 4, missingUsage: 0, estimatedMicroUsd: 1_000_000, pricedRequests: 4, unpricedRequests: 0 }
    const missingRow = { ...base.byModel[0], model: 'missing-model', name: 'Missing Model', requests: 5, missingUsage: 5, estimatedMicroUsd: 0, pricedRequests: 0, unpricedRequests: 0 }
    const unpricedRow = { ...base.byModel[0], model: 'unpriced-model', name: 'Unpriced Model', requests: 3, missingUsage: 0, estimatedMicroUsd: 0, pricedRequests: 0, unpricedRequests: 3 }
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report({
      totals: { ...base.totals, requests: 12, estimatedMicroUsd: 1_000_000, pricedRequests: 4, unpricedRequests: 3, missingUsage: 5 },
      byModel: [pricedRow, missingRow, unpricedRow],
    }))} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('Priced Model')

    const rowOf = (name: string): HTMLTableRowElement => screen.getByText(name, { selector: 'b' }).closest('tr') as HTMLTableRowElement
    const costOf = (name: string): string => rowOf(name).querySelectorAll('td')[5].textContent ?? ''
    const shareOf = (name: string): string => rowOf(name).querySelectorAll('td')[6].textContent ?? ''

    expect(costOf('Missing Model')).toBe('—')
    expect(shareOf('Missing Model')).toBe('—')
    expect(rowOf('Missing Model').textContent).not.toContain(en.analyticsUnpriced)

    expect(costOf('Unpriced Model')).toBe(en.analyticsUnpriced)
    expect(shareOf('Unpriced Model')).toBe('—')

    expect(costOf('Priced Model')).toContain('$1.00')
    expect(shareOf('Priced Model')).toContain('100.0%')

    const note = screen.getByText(new RegExp(en.analyticsCompositionFree))
    expect(note.textContent).toContain('Unpriced Model')
    expect(note.textContent).not.toContain('Missing Model')
  })

  it('averages the daily footer over the selected calendar days', async () => {
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report({
      totals: { ...report().totals, requests: 31, estimatedMicroUsd: 310_000_000 },
      byDay: [
        { day: '2026-09-18', requests: 1, tokens: 1000, estimatedMicroUsd: 200_000_000 },
        { day: '2026-10-18', requests: 1, tokens: 1000, estimatedMicroUsd: 110_000_000 },
      ],
    }))} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
    const foot = document.querySelector('[class*="_trendFoot_"]') as HTMLElement
    expect(foot.textContent).toContain('$310.00')
    expect(foot.textContent).toContain('$10.00')
  })

  it('handles a single-day range and an unknown timezone', async () => {
    render(<AnalyticsDialog open onClose={() => {}} readAnalytics={vi.fn().mockResolvedValue(report({
      range: { from: Date.UTC(2026, 9, 18), to: Date.UTC(2026, 9, 18, 1) },
      timeZone: 'Not/AZone',
      byDay: [{ day: '2026-10-18', requests: 12, tokens: 6000, estimatedMicroUsd: 1_234_000 }],
    }))} t={t} getLocale={() => 'en'} />)
    await screen.findAllByText('DeepSeek V4.1 Flash')
    const heat = document.querySelector('[class*="_heat_"]') as HTMLElement
    const cells = Array.from(heat.querySelectorAll('span[data-day]')) as HTMLElement[]
    expect(cells).toHaveLength(1)
    expect(cells[0].dataset.day).toBe('2026-10-18')
    // 2026-10-18 is a Sunday, so the one cell starts six pads in.
    expect(heat.querySelectorAll('[class*="_heatPad_"]')).toHaveLength(6)
    expect(document.querySelectorAll('rect[data-day]')).toHaveLength(1)
  })
})

describe("local visual preferences", () => {
  beforeEach(() => { localStorage.clear(); setGoTheme(DEFAULT_GO_THEME) })

  afterEach(() => { cleanup(); localStorage.clear(); document.body.removeAttribute('data-ds-dark-theme') })

  it('defaults to graphite and persists a selection', () => {
    expect(GO_THEMES).toHaveLength(4)
    expect(getGoTheme()).toBe(DEFAULT_GO_THEME)
    const listener = vi.fn()
    const off = subscribeGoTheme(listener)
    setGoTheme('silent-black')
    expect(getGoTheme()).toBe('silent-black')
    expect(localStorage.getItem('dsh-opencode-go.theme')).toBe('silent-black')
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    setGoTheme('graphite')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('carries every token into the inline style', () => {
    const style = themeStyle(GO_THEME_TOKENS.graphite.dark) as Record<string, string>
    expect(style['--go-accent']).toBe('#6e8bff')
    expect(style['--go-bg']).toBe('#111214')
    for (const key of ['--go-surface', '--go-surface-2', '--go-border', '--go-text', '--go-muted',
      '--go-accent-2', '--go-success', '--go-warning', '--go-danger']) {
      expect(style[key]).toBeTruthy()
    }
  })

  it('renders four style previews, each in its own palette, and switches on click', () => {
    const { container } = render(<ThemePicker t={key => en[key]} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: en.themeGraphite }).getAttribute('aria-pressed')).toBe('true')
    // Every tile paints its own accent, so no two previews look alike.
    const accents = GO_THEMES.map(id =>
      (container.querySelector('[data-theme="' + id + '"] .' + pickerCss.swatchDot) as HTMLElement).style.background)
    expect(accents.every(Boolean)).toBe(true)
    expect(new Set(accents).size).toBe(GO_THEMES.length)
    fireEvent.click(screen.getByRole('button', { name: en.themeSilentBlack }))
    expect(getGoTheme()).toBe('silent-black')
    expect(screen.getByRole('button', { name: en.themeSilentBlack }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: en.themeGraphite }).getAttribute('aria-pressed')).toBe('false')
  })

  function Probe() {
    const tokens = useGoThemeTokens()
    return <span data-testid="probe" data-bg={tokens.bg} />
  }

  it('follows the host light/dark attribute', async () => {
    document.body.removeAttribute('data-ds-dark-theme')
    render(<Probe />)
    expect(screen.getByTestId('probe').getAttribute('data-bg')).toBe(GO_THEME_TOKENS.graphite.light.bg)
    await act(async () => {
      document.body.setAttribute('data-ds-dark-theme', '')
      await Promise.resolve()
    })
    expect(screen.getByTestId('probe').getAttribute('data-bg')).toBe(GO_THEME_TOKENS.graphite.dark.bg)
  })
})
