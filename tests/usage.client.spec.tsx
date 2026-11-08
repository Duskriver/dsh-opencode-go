// @vitest-environment jsdom
import { describe, afterEach, beforeEach, expect, it, vi } from 'vitest'
import css from '../src/client/UsagePill.module.css'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { GoUsage, AnalyticsQuery, OpencodeGoTheme } from '../src/contracts.ts'
import { UsagePill, SidebarQuota } from '../src/client/UsagePill.tsx'
import {
  en,
  GO_THEME_TOKENS,
  themeStyle,
  useGoThemeTokens,
} from '../src/client/presentation.ts'
import { createConfigForm, defaultClientSettings } from './support/client.tsx'
import type { OpencodeGoSettings } from '../src/client/controller.ts'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { createAnalyticsReport } from './support/analytics.ts'

describe("conversation usage", () => {
  const usageSettings = (value: OpencodeGoSettings = {}) => {
    const host = createConfigForm<OpencodeGoSettings>()
    host.publish({ status: 'ready', value: { ...defaultClientSettings, ...value } })
    return host
  }

  let settings: ConfigForm<OpencodeGoSettings>

  beforeEach(() => { vi.useFakeTimers(); settings = usageSettings().form; localStorage.clear() })

  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

  const t = (key: string) => en[key as keyof typeof en]

  const usageWindow = { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' }

  const usage = { source: 'account-a', rolling: { ...usageWindow, percent: 0 }, weekly: usageWindow, monthly: { ...usageWindow, percent: 7 } }

  const updated = { ...usage, rolling: { ...usageWindow, percent: 25 }, weekly: { ...usageWindow, percent: 30 } }

  const transientMessage = 'usage request failed: network error (ECONNRESET)'

  const directory = (provider = 'deepseek') => createSnapshotStore<ModelDirectoryState>({
    current: { provider, model: provider === 'dsh-opencode-go' ? 'deepseek-v4-pro' : 'deepseek-chat' }, routable: true,
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

  const sidebarQuota = () => screen.getByRole('group', { name: new RegExp(en.usageTitle) })

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

  it.each([undefined, 'badge', 'plain'] as const)('applies input quota style %s and changes it without restarting polling or closing details', async usagePillStyle => {
    const host = usageSettings({ usageDisplay: 'always', usagePillStyle })
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={host.form} directory={directory()} readUsage={read} t={t} />) })
    expect(trigger().classList.contains(css.plain)).toBe(usagePillStyle === 'plain')
    showDetails()
    const next = usagePillStyle === 'plain' ? 'badge' : 'plain'
    await act(async () => { host.publish({ value: { usageDisplay: 'always', usagePillStyle: next } }) })
    expect(trigger().classList.contains(css.plain)).toBe(next === 'plain')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(read).toHaveBeenCalledOnce()
  })

  it.each([
    { enabled: true, showSidebarQuota: undefined },
    { enabled: true, showSidebarQuota: false },
    { enabled: false, showSidebarQuota: true },
  ])('keeps sidebar quota hidden and idle unless explicitly enabled: %j', async value => {
    const host = usageSettings({ usageDisplay: 'always', ...value })
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<SidebarQuota wide settings={host.form} readUsage={read} t={t} />) })
    expect(screen.queryByRole('group', { name: new RegExp(en.usageTitle) })).toBeNull()
    await tick()
    expect(read).not.toHaveBeenCalled()
  })

  it('opens sidebar history independently of the viewed quota and the calling account', async () => {
    const host = usageSettings({ usageDisplay: 'off', showSidebarQuota: true, accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_A' })
    const original = host.form.getSnapshot()
    const selectAccount = vi.fn(async () => true)
    const readAccountUsage = vi.fn(async (ref: string) => ({ ...usage, source: ref }))
    const readAnalytics = vi.fn(async (query: AnalyticsQuery) => createAnalyticsReport(query))
    await act(async () => { render(<SidebarQuota wide settings={host.form} readUsage={vi.fn().mockResolvedValue(usage)}
      readAccountUsage={readAccountUsage} readAnalytics={readAnalytics} selectAccount={selectAccount} t={t} getLocale={() => 'en'} />) })
    await act(async () => { fireEvent.click(within(sidebarQuota()).getByRole('button', { name: new RegExp(en.sidebarNextAccount) })) })
    const quota = sidebarQuota()
    expect(within(quota).getByText('Backup')).toBeTruthy()
    fireEvent.click(quota)
    expect(readAnalytics).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(within(quota).getByRole('button', { name: en.sidebarAnalytics })) })
    const dialog = screen.getByRole('dialog', { name: en.analyticsTitle })
    const account = within(dialog).getByRole<HTMLSelectElement>('combobox', { name: en.analyticsAccount })
    expect(account.value).toBe('ACCOUNT_A')
    expect(readAnalytics).toHaveBeenCalledExactlyOnceWith({ accountRef: 'ACCOUNT_A', range: '30d' }, expect.any(AbortSignal))
    expect(readAccountUsage).toHaveBeenLastCalledWith('ACCOUNT_A')
    await act(async () => { fireEvent.change(account, { target: { value: 'ACCOUNT_B' } }) })
    expect(readAnalytics).toHaveBeenLastCalledWith({ accountRef: 'ACCOUNT_B', range: '30d' }, expect.any(AbortSignal))
    expect(selectAccount).not.toHaveBeenCalled()
    expect(host.form.getSnapshot()).toBe(original)
    expect(host.set).not.toHaveBeenCalled()
    expect(host.mutate).not.toHaveBeenCalled()
    expect(host.unset).not.toHaveBeenCalled()
  })

  it('offers a keyboard-focusable native history button when the sidebar is collapsed', async () => {
    const host = usageSettings({ showSidebarQuota: true, accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_A' })
    const selectAccount = vi.fn(async () => true)
    const readAnalytics = vi.fn(async (query: AnalyticsQuery) => createAnalyticsReport(query))
    await act(async () => { render(<SidebarQuota wide={false} settings={host.form} readUsage={vi.fn().mockResolvedValue(usage)}
      readAnalytics={readAnalytics} selectAccount={selectAccount} t={t} />) })
    const history = screen.getByRole<HTMLButtonElement>('button', { name: en.sidebarAnalytics })
    expect(history.tagName).toBe('BUTTON')
    expect(history.type).toBe('button')
    expect(history.tabIndex).toBe(0)
    expect(history.getAttribute('aria-haspopup')).toBe('dialog')
    expect(history.getAttribute('aria-expanded')).toBe('false')
    history.focus()
    expect(document.activeElement).toBe(history)
    await act(async () => {
      fireEvent.keyDown(history, { key: 'Enter', code: 'Enter' })
      // jsdom does not synthesize a native button's keyboard click default action.
      fireEvent.click(history, { detail: 0 })
      fireEvent.keyUp(history, { key: 'Enter', code: 'Enter' })
    })
    expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
    expect(history.getAttribute('aria-expanded')).toBe('true')
    expect(readAnalytics).toHaveBeenCalledExactlyOnceWith({ accountRef: 'ACCOUNT_A', range: '30d' }, expect.any(AbortSignal))
    expect(selectAccount).not.toHaveBeenCalled()
  })

  it('keeps sidebar quota bars passive and leaves the collapsed icon passive when no history reader is available', async () => {
    const host = usageSettings({ usageDisplay: 'off', showSidebarQuota: true, accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_B' })
    const refreshed = { ...updated, monthly: { ...usageWindow, percent: 45 } }
    const read = vi.fn().mockResolvedValueOnce(usage).mockResolvedValue(refreshed)
    const props = { settings: host.form, readUsage: read, t }
    let view!: ReturnType<typeof render>
    await act(async () => { view = render(<SidebarQuota {...props} wide />) })
    expect(sidebarQuota().classList.contains(css.sidebarCard)).toBe(true)
    expect(within(sidebarQuota()).getByText('OpenCode Go')).toBeTruthy()
    expect(within(sidebarQuota()).getByText('Backup')).toBeTruthy()
    expect(within(sidebarQuota()).getAllByRole('progressbar')).toHaveLength(3)
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_rolling }).getAttribute('value')).toBe('0')
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_weekly }).getAttribute('value')).toBe('10')
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_monthly }).getAttribute('value')).toBe('7')
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_monthly }).classList.contains(css.progressMonthly)).toBe(true)
    expect(sidebarQuota().getAttribute('aria-label')).toContain(`${en.usage_monthly} 7%`)
    expect(screen.queryByRole('button')).toBeNull()
    expect(sidebarQuota().tabIndex).toBe(-1)
    expect(sidebarQuota().hasAttribute('aria-haspopup')).toBe(false)
    expect(sidebarQuota().hasAttribute('aria-expanded')).toBe(false)
    fireEvent.click(sidebarQuota())
    fireEvent.keyDown(sidebarQuota(), { key: 'Enter' })
    fireEvent.keyDown(sidebarQuota(), { key: ' ' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await tick()
    expect(read).toHaveBeenCalledTimes(2)
    expect(sidebarQuota().getAttribute('aria-label')).toContain(percentageLabel(updated))
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_monthly }).getAttribute('value')).toBe('45')
    expect(sidebarQuota().getAttribute('aria-label')).toContain(`${en.usage_monthly} 45%`)
    await act(async () => { view.rerender(<SidebarQuota {...props} wide={false} />) })
    expect(sidebarQuota().classList.contains(css.sidebarIcon)).toBe(true)
    expect(sidebarQuota().querySelector('svg')).toBeTruthy()
    expect(sidebarQuota().textContent).toBe('')
    expect(sidebarQuota().getAttribute('title')).toContain(`${en.usage_monthly} 45%`)
    expect(screen.queryByRole('button')).toBeNull()
    expect(sidebarQuota().tabIndex).toBe(-1)
    fireEvent.click(sidebarQuota())
    fireEvent.keyDown(sidebarQuota(), { key: 'Enter' })
    fireEvent.keyDown(sidebarQuota(), { key: ' ' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('follows account selections made elsewhere and refreshes its account badge', async () => {
    const host = usageSettings({ showSidebarQuota: true, accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_A' })
    const read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<SidebarQuota wide settings={host.form} readUsage={read} t={t} />) })
    expect(within(sidebarQuota()).getByText('Primary')).toBeTruthy()
    await act(async () => { host.publish({ value: { ...host.form.getSnapshot().value, apiKeyEnv: 'ACCOUNT_B' } }) })
    expect(within(sidebarQuota()).getByText('Backup')).toBeTruthy()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('cycles viewed accounts without changing requests or settings and remembers the view after remounting', async () => {
    const host = usageSettings({ usageDisplay: 'always', showSidebarQuota: true, accounts: threeAccounts, apiKeyEnv: 'ACCOUNT_A' })
    const original = host.form.getSnapshot()
    const read = vi.fn().mockResolvedValue(usage)
    const selectAccount = vi.fn(async () => true)
    const readAccountUsage = vi.fn(async (ref: string) => ({ ...usage, source: ref,
      monthly: { ...usageWindow, percent: ref === 'ACCOUNT_B' ? 35 : ref === 'ACCOUNT_C' ? 55 : 7 },
    }))
    const props = { settings: host.form, readUsage: read, readAccountUsage, selectAccount, t }
    let view!: ReturnType<typeof render>
    await act(async () => { view = render(<>
      <SidebarQuota {...props} wide />
      <UsagePill {...props} directory={directory()} />
    </>) })
    expect(original.writable).toBe(false)
    expect(readAccountUsage).toHaveBeenCalledExactlyOnceWith('ACCOUNT_A')
    fireEvent.click(sidebarQuota())
    expect(readAccountUsage).toHaveBeenCalledOnce()
    for (const [name, ref, percent] of [
      ['Backup', 'ACCOUNT_B', '35'], ['Travel', 'ACCOUNT_C', '55'],
      ['Primary', 'ACCOUNT_A', '7'], ['Backup', 'ACCOUNT_B', '35'],
    ] as const) {
      await act(async () => { fireEvent.click(within(sidebarQuota()).getByRole('button', { name: new RegExp(en.sidebarNextAccount) })) })
      expect(within(sidebarQuota()).getByRole('button', { name: `${en.sidebarNextAccount}: ${name}` })).toBeTruthy()
      expect(readAccountUsage).toHaveBeenLastCalledWith(ref)
      expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_monthly }).getAttribute('value')).toBe(percent)
      expect(trigger().textContent).toContain(percentageLabel(usage) + accountSuffix('Primary'))
      expect(screen.queryByRole('dialog')).toBeNull()
    }
    expect(read).toHaveBeenCalledOnce()
    expect(selectAccount).not.toHaveBeenCalled()
    expect(host.form.getSnapshot()).toBe(original)
    expect(host.set).not.toHaveBeenCalled()
    expect(host.mutate).not.toHaveBeenCalled()
    expect(host.unset).not.toHaveBeenCalled()
    view.unmount()
    await act(async () => { render(<SidebarQuota {...props} wide />) })
    expect(within(sidebarQuota()).getByText('Backup')).toBeTruthy()
    expect(readAccountUsage).toHaveBeenLastCalledWith('ACCOUNT_B')
    await tick()
    expect(readAccountUsage).toHaveBeenLastCalledWith('ACCOUNT_B')
    expect(readAccountUsage).toHaveBeenCalledTimes(7)
  })

  it.each(['success', 'failure'] as const)('keeps the viewed account on failure and ignores a previous account’s late %s', async outcome => {
    const host = usageSettings({ showSidebarQuota: true, accounts: threeAccounts, apiKeyEnv: 'ACCOUNT_A' })
    let resolveOld!: (value: GoUsage) => void
    let rejectOld!: (reason: Error) => void
    const old = new Promise<GoUsage>((resolve, reject) => { resolveOld = resolve; rejectOld = reject })
    const readPrimary = vi.fn().mockResolvedValueOnce(usage).mockResolvedValueOnce(usage)
      .mockRejectedValueOnce(usageError()).mockResolvedValue(usage)
    const readAccountUsage = vi.fn((ref: string) => ref === 'ACCOUNT_A' ? readPrimary()
      : ref === 'ACCOUNT_B' ? old : Promise.reject(usageError({ source: 'account-c' })))
    await act(async () => { render(<SidebarQuota wide settings={host.form} readUsage={vi.fn()} readAccountUsage={readAccountUsage} t={t} />) })
    const next = () => fireEvent.click(within(sidebarQuota()).getByRole('button', { name: new RegExp(en.sidebarNextAccount) }))
    await act(async () => { next() })
    expect(within(sidebarQuota()).getByText('Backup')).toBeTruthy()
    expect(within(sidebarQuota()).getAllByText('…')).toHaveLength(3)
    await act(async () => { next() })
    expect(within(sidebarQuota()).getByText('Travel')).toBeTruthy()
    expect(within(sidebarQuota()).getAllByText('—')).toHaveLength(3)
    expect(within(sidebarQuota()).getByRole('status').textContent).toBe(en.usageUnavailable)
    await act(async () => { outcome === 'success' ? resolveOld(updated) : rejectOld(usageError()) })
    expect(within(sidebarQuota()).getByText('Travel')).toBeTruthy()
    expect(within(sidebarQuota()).getAllByText('—')).toHaveLength(3)
    await act(async () => { next() })
    expect(within(sidebarQuota()).getByText('Primary')).toBeTruthy()
    expect(within(sidebarQuota()).queryByRole('status')).toBeNull()
    await tick()
    expect(within(sidebarQuota()).getAllByText('—')).toHaveLength(3)
    expect(within(sidebarQuota()).getByRole('status').textContent).toBe(en.usageUnavailable)
    await tick()
    expect(within(sidebarQuota()).getByText('7%')).toBeTruthy()
    expect(within(sidebarQuota()).queryByRole('status')).toBeNull()
  })

  it('falls back to the first remaining account when the viewed account is removed and leaves a single account non-interactive', async () => {
    const host = usageSettings({ showSidebarQuota: true, accounts: threeAccounts, apiKeyEnv: 'ACCOUNT_A' })
    const readAccountUsage = vi.fn(async () => usage)
    await act(async () => { render(<SidebarQuota wide settings={host.form} readUsage={vi.fn()} readAccountUsage={readAccountUsage} t={t} />) })
    await act(async () => { fireEvent.click(within(sidebarQuota()).getByRole('button', { name: new RegExp(en.sidebarNextAccount) })) })
    expect(within(sidebarQuota()).getByText('Backup')).toBeTruthy()
    await act(async () => { host.publish({ value: { ...host.form.getSnapshot().value, accounts: [threeAccounts[0]!, threeAccounts[2]!] } }) })
    expect(within(sidebarQuota()).getByText('Primary')).toBeTruthy()
    expect(readAccountUsage).toHaveBeenLastCalledWith('ACCOUNT_A')
    await act(async () => { fireEvent.click(within(sidebarQuota()).getByRole('button', { name: new RegExp(en.sidebarNextAccount) })) })
    expect(within(sidebarQuota()).getByText('Travel')).toBeTruthy()
    await act(async () => { host.publish({ value: { ...host.form.getSnapshot().value, accounts: [threeAccounts[2]!], apiKeyEnv: 'ACCOUNT_C' } }) })
    expect(within(sidebarQuota()).getByText('Travel')).toBeTruthy()
    expect(within(sidebarQuota()).queryByRole('button')).toBeNull()
    const calls = readAccountUsage.mock.calls.length
    fireEvent.click(sidebarQuota())
    expect(readAccountUsage).toHaveBeenCalledTimes(calls)
  })

  it('keeps account viewing available when browser preference storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const host = usageSettings({ showSidebarQuota: true, accounts: twoAccounts, apiKeyEnv: 'ACCOUNT_A' })
    const readAccountUsage = vi.fn(async () => usage)
    await act(async () => { render(<SidebarQuota wide settings={host.form} readUsage={vi.fn()} readAccountUsage={readAccountUsage} t={t} />) })
    await act(async () => { fireEvent.click(within(sidebarQuota()).getByRole('button', { name: new RegExp(en.sidebarNextAccount) })) })
    expect(within(sidebarQuota()).getByText('Backup')).toBeTruthy()
    expect(readAccountUsage).toHaveBeenLastCalledWith('ACCOUNT_B')
  })

  it('stops sidebar polling on disable and restarts it after live settings and credential changes', async () => {
    const host = usageSettings({ usageDisplay: 'off', showSidebarQuota: true, accounts: [] })
    const changes = createSnapshotStore(0), read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<SidebarQuota wide settings={host.form} credentialChanges={changes} readUsage={read} t={t} />) })
    expect(within(sidebarQuota()).getByText('Go')).toBeTruthy()
    expect(read).toHaveBeenCalledOnce()
    await act(async () => { changes.set(1) })
    expect(read).toHaveBeenCalledTimes(2)
    await act(async () => { host.publish({ value: { showSidebarQuota: false } }) })
    expect(screen.queryByRole('group', { name: new RegExp(en.usageTitle) })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    await tick()
    expect(read).toHaveBeenCalledTimes(2)
    await act(async () => { host.publish({ value: { showSidebarQuota: true, enabled: false } }) })
    expect(screen.queryByRole('group', { name: new RegExp(en.usageTitle) })).toBeNull()
    await act(async () => { host.publish({ value: { showSidebarQuota: true, enabled: true } }) })
    expect(read).toHaveBeenCalledTimes(3)
    expect(within(sidebarQuota()).getAllByRole('progressbar')).toHaveLength(3)
  })

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

  it('hides auto usage for Free, shows it for Go, and stops polling when switching back to Free', async () => {
    const host = usageSettings({ usageDisplay: 'auto' })
    const selected = directory('dsh-opencode-free'), read = vi.fn().mockResolvedValue(usage)
    await act(async () => { render(<UsagePill settings={host.form} directory={selected} readUsage={read} t={t} />) })
    await tick()
    expect(screen.queryByRole('button')).toBeNull()
    expect(read).not.toHaveBeenCalled()
    await act(async () => { selected.set({ ...selected.getSnapshot(), current: { provider: 'dsh-opencode-go', model: 'same' } }) })
    expect(trigger()).toBeTruthy()
    expect(read).toHaveBeenCalledOnce()
    await act(async () => { selected.set({ ...selected.getSnapshot(), current: { provider: 'dsh-opencode-free', model: 'same' } }) })
    await tick()
    expect(screen.queryByRole('button')).toBeNull()
    expect(read).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
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
    await act(async () => { store.set({ ...store.getSnapshot(), current: { provider: 'dsh-opencode-go', model: 'deepseek-v4-pro' } }) })
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

  it('releases the busy latch when a usage read never settles and recovers on a later timer cycle without a fabricated failure', async () => {
    const read = vi.fn().mockImplementationOnce(() => new Promise<GoUsage>(() => {})).mockResolvedValue(updated)
    await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    expect(read).toHaveBeenCalledTimes(1)
    expect(trigger().textContent).toBe('…')
    // Just before the sentinel, the minute timer stays latched out behind the hung read.
    await tick(29_000)
    expect(read).toHaveBeenCalledTimes(1)
    // The ~30s sentinel frees the latch. No reading ever arrived, so the pill keeps its
    // loading glyph, marks itself stale internally and does not invent a failure; the
    // next minute cycle can recover.
    await tick(1_000)
    expect(read).toHaveBeenCalledTimes(1)
    expect(trigger().textContent).toBe('…')
    expect(trigger().hasAttribute('data-stale')).toBe(true)
    expect(screen.queryByText(en.usageUnavailable)).toBeNull()
    await tick(30_000)
    expect(read).toHaveBeenCalledTimes(2)
    expect(trigger().textContent).toBe(percentageLabel(updated))
    expect(trigger().hasAttribute('data-stale')).toBe(false)
  })

  it('keeps the last percentages and marks them stale when a refresh times out, clearing the mark on success', async () => {
    const read = vi.fn().mockResolvedValueOnce(usage)
      .mockImplementationOnce(() => new Promise<GoUsage>(() => {}))
      .mockResolvedValue(updated)
    await act(async () => { render(<UsagePill settings={settings} directory={directory('dsh-opencode-go')} readUsage={read} t={t} />) })
    expect(read).toHaveBeenCalledTimes(1)
    expect(trigger().textContent).toBe(percentageLabel(usage))
    // The minute cycle's read hangs; the 30s sentinel must flag the retained data stale
    // instead of leaving it indistinguishable from a fresh reading.
    await tick(60_000)
    expect(read).toHaveBeenCalledTimes(2)
    await tick(30_000)
    expect(read).toHaveBeenCalledTimes(2)
    expect(trigger().textContent).toBe(`${percentageLabel(usage)} · ${en.usageStaleShort}`)
    expect(trigger().title).toContain(en.usageStaleShort)
    expect(trigger().title).toContain(en.usageLastUpdated)
    expect(trigger().title).toMatch(/\d{1,2}:\d{2}/)
    expect(trigger().querySelector(`.${css.reading}`)?.getAttribute('data-stale')).toBe('')
    expect(trigger().hasAttribute('data-stale')).toBe(true)
    // A stale mark is not an error: no red failure copy and no cleared percentages.
    expect(screen.queryByText(en.usageUnavailable)).toBeNull()
    showDetails()
    expect(screen.getAllByRole('progressbar')).toHaveLength(3)
    expect(screen.getByRole('progressbar', { name: en.usage_weekly }).getAttribute('value')).toBe('10')
    expect(screen.getByText(new RegExp(`^${en.usageLastUpdated}`))).toBeTruthy()
    // The next minute cycle succeeds: fresh percentages replace the stale ones.
    await tick(30_000)
    expect(read).toHaveBeenCalledTimes(3)
    expect(trigger().textContent).toBe(percentageLabel(updated))
    expect(trigger().title).toBe(percentageLabel(updated))
    expect(trigger().hasAttribute('data-stale')).toBe(false)
    expect(trigger().querySelector(`.${css.stale}`)).toBeNull()
  })

  it('marks the sidebar quota stale instead of unavailable when a refresh times out, then recovers', async () => {
    const host = usageSettings({ showSidebarQuota: true })
    const read = vi.fn().mockResolvedValueOnce(usage)
      .mockImplementationOnce(() => new Promise<GoUsage>(() => {}))
      .mockResolvedValue(updated)
    await act(async () => { render(<SidebarQuota wide settings={host.form} readUsage={read} t={t} />) })
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_weekly }).getAttribute('value')).toBe('10')
    await tick(60_000)
    expect(read).toHaveBeenCalledTimes(2)
    await tick(30_000)
    expect(read).toHaveBeenCalledTimes(2)
    // The old percentages stay, flagged stale: a timeout is not a red failure.
    expect(within(sidebarQuota()).getByText(en.usageStaleShort)).toBeTruthy()
    expect(within(sidebarQuota()).queryByText(en.usageUnavailable)).toBeNull()
    expect(within(sidebarQuota()).queryByRole('status')).toBeNull()
    expect(sidebarQuota().getAttribute('aria-label')).toContain(en.usageStaleShort)
    expect(sidebarQuota().getAttribute('title')).toContain(en.usageLastUpdated)
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_rolling }).getAttribute('value')).toBe('0')
    expect(within(sidebarQuota()).getByText('7%')).toBeTruthy()
    await tick(30_000)
    expect(read).toHaveBeenCalledTimes(3)
    expect(within(sidebarQuota()).queryByText(en.usageStaleShort)).toBeNull()
    expect(within(sidebarQuota()).getByRole('progressbar', { name: en.usage_weekly }).getAttribute('value')).toBe('30')
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
    // The activated option is gone; focus must land back on the trigger.
    expect(document.activeElement).toBe(trigger())
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
    expect(document.activeElement).toBe(trigger())
  })

  it('walks the account list with the arrow keys, Home and End, and restores the trigger on Escape', async () => {
    const host = writableSettings()
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)} t={t} selectAccount={vi.fn()} />) })
    showDetails()
    fireEvent.click(switchButton())
    const list = screen.getByRole('listbox', { name: en.accountSwitchTitle })
    const options = within(list).getAllByRole('option')
    // Roving tabindex: the selected account is the list's single Tab stop.
    expect(options[0]!.tabIndex).toBe(0)
    expect(options[1]!.tabIndex).toBe(-1)
    options[0]!.focus()
    expect(document.activeElement).toBe(options[0])
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(options[1])
    expect(options[1]!.tabIndex).toBe(0)
    expect(options[0]!.tabIndex).toBe(-1)
    fireEvent.keyDown(list, { key: 'End' })
    expect(document.activeElement).toBe(options[options.length - 1])
    fireEvent.keyDown(list, { key: 'Home' })
    expect(document.activeElement).toBe(options[0])
    fireEvent.keyDown(list, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(options[options.length - 1])
    fireEvent.keyDown(list, { key: 'Escape' })
    // Escape steps back to the reading; the panel itself stays open but focus returns
    // to the trigger instead of falling to the document body.
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(openPanel()).toBeTruthy()
    expect(document.activeElement).toBe(trigger())
    expect(within(openPanel()).getAllByRole('progressbar')).toHaveLength(3)
  })

  it('moves focus into the panel and wires the trigger to it with aria-controls', async () => {
    const host = writableSettings()
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)} t={t} selectAccount={vi.fn()} />) })
    const button = trigger()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    const controls = button.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    showDetails()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const dialog = openPanel()
    expect(dialog.getAttribute('id')).toBe(controls)
    expect(dialog.getAttribute('tabindex')).toBe('-1')
    // The first action of the reading view (the account drill-down) takes focus.
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: new RegExp(en.accountSwitchAction) }))
  })

  it('returns focus to the trigger when the panel closes from Escape or an outside click', async () => {
    const host = usageSettings({ usageDisplay: 'always' })
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)} t={t} />) })
    showDetails()
    expect(openPanel()).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger())
    showDetails()
    expect(openPanel()).toBeTruthy()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('focuses the current account when the drill-down opens and restores the trigger from its back button', async () => {
    const host = writableSettings('ACCOUNT_B')
    await act(async () => { render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)} t={t} selectAccount={vi.fn()} />) })
    showDetails()
    fireEvent.click(switchButton())
    const options = within(openPanel()).getAllByRole('option')
    const selected = options.find(option => option.getAttribute('aria-selected') === 'true')!
    expect(selected.textContent).toBe('Backup')
    expect(document.activeElement).toBe(selected)
    expect(selected.tabIndex).toBe(0)
    for (const option of options) if (option !== selected) expect(option.tabIndex).toBe(-1)
    fireEvent.click(within(openPanel()).getByRole('button', { name: en.accountSwitchBack }))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(within(openPanel()).getAllByRole('progressbar')).toHaveLength(3)
    expect(document.activeElement).toBe(trigger())
  })

  it('opens the shared analytics dialog from the expanded panel', async () => {
    const host = usageSettings({ usageDisplay: 'always' })
    const analytics = vi.fn(async (query: AnalyticsQuery) => createAnalyticsReport(query))
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
    const analytics = vi.fn(async (query: AnalyticsQuery) => createAnalyticsReport(query))
    await act(async () => {
      render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')} readUsage={vi.fn().mockResolvedValue(usage)}
        readAnalytics={analytics} t={t} credentialChanges={credentials} />)
    })
    showDetails()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsOpen })) })
    expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
    expect(analytics).toHaveBeenCalledTimes(1)
    // Keep the modal open, but replace its content identity so the new key cannot
    // continue showing the previous credential's workspace report.
    await act(async () => { credentials.set(1) })
    expect(screen.getByRole('dialog', { name: en.analyticsTitle })).toBeTruthy()
    expect(analytics).toHaveBeenCalledTimes(2)
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

  it('uses the Native Host-following palette by default in the pill and its popover', async () => {
    document.body.removeAttribute('data-ds-dark-theme')
    const host = usageSettings({ usageDisplay: 'always' })
    await act(async () => {
      render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')}
        readUsage={vi.fn().mockResolvedValue(usage)} t={t} />)
    })
    const root = trigger().parentElement as HTMLElement
    expect(root.style.getPropertyValue('--go-bg')).toBe(GO_THEME_TOKENS.native.light.bg)
    showDetails()
    expect(within(openPanel()).queryByRole('group', { name: /^(Theme|主题)$/ })).toBeNull()
    expect(openPanel().querySelector('[data-theme]')).toBeNull()
    await act(async () => {
      document.body.setAttribute('data-ds-dark-theme', '')
      await Promise.resolve()
    })
    expect(root.style.getPropertyValue('--go-bg')).toBe(GO_THEME_TOKENS.native.dark.bg)
    expect(openPanel()).toBeTruthy()
    document.body.removeAttribute('data-ds-dark-theme')
  })

  it('uses the saved Classic selection in the pill instead of the Native default', async () => {
    document.body.removeAttribute('data-ds-dark-theme')
    const host = usageSettings({ usageDisplay: 'always', appearanceTheme: 'classic' })
    await act(async () => {
      render(<UsagePill settings={host.form} directory={directory('dsh-opencode-go')}
        readUsage={vi.fn().mockResolvedValue(usage)} t={t} />)
    })
    const root = trigger().parentElement as HTMLElement
    expect(root.style.getPropertyValue('--go-bg')).toBe(GO_THEME_TOKENS.classic.light.bg)
    expect(root.style.getPropertyValue('--go-display-font')).toContain('Anthropic Serif')
    showDetails()
    expect(openPanel()).toBeTruthy()
  })
})

describe('Native and Classic presentation', () => {
  beforeEach(() => { localStorage.clear(); document.body.removeAttribute('data-ds-dark-theme') })

  afterEach(() => { cleanup(); localStorage.clear(); document.body.removeAttribute('data-ds-dark-theme') })

  it('exposes two visual themes in two Host schemes and carries every token into the style', () => {
    expect(Object.keys(GO_THEME_TOKENS).sort()).toEqual(['classic', 'native'])
    const style = themeStyle(GO_THEME_TOKENS.native.dark) as Record<string, string>
    const properties = {
      bg: '--go-bg', surface: '--go-surface', surface2: '--go-surface-2', border: '--go-border',
      text: '--go-text', muted: '--go-muted', accent: '--go-accent', accent2: '--go-accent-2',
      success: '--go-success', warning: '--go-warning', danger: '--go-danger',
    } as const
    for (const [key, property] of Object.entries(properties)) {
      expect(style[property]).toBe(GO_THEME_TOKENS.native.dark[key as keyof typeof properties])
    }
    expect(style['--go-number-font']).toContain('monospace')
  })

  function Probe({ theme }: { theme?: OpencodeGoTheme }) {
    const tokens = useGoThemeTokens(theme)
    return <span data-testid="probe" data-bg={tokens.bg} data-accent={tokens.accent} data-display-font={tokens.displayFont} />
  }

  it('ignores a legacy skin preference and follows the Host light/dark attribute in both directions', async () => {
    localStorage.setItem('dsh-opencode-go.theme', 'warm-sand')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    render(<Probe />)
    const probe = screen.getByTestId('probe')
    expect(probe.getAttribute('data-bg')).toBe(GO_THEME_TOKENS.native.light.bg)
    await act(async () => {
      document.body.setAttribute('data-ds-dark-theme', '')
      await Promise.resolve()
    })
    expect(probe.getAttribute('data-bg')).toBe(GO_THEME_TOKENS.native.dark.bg)
    expect(probe.getAttribute('data-accent')).toBe(GO_THEME_TOKENS.native.dark.accent)
    await act(async () => {
      document.body.removeAttribute('data-ds-dark-theme')
      await Promise.resolve()
    })
    expect(probe.getAttribute('data-bg')).toBe(GO_THEME_TOKENS.native.light.bg)
    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })

  it('selects Classic explicitly without reading or writing a legacy local preference', async () => {
    render(<Probe theme="classic" />)
    const probe = screen.getByTestId('probe')
    expect(probe.getAttribute('data-bg')).toBe(GO_THEME_TOKENS.classic.light.bg)
    expect(probe.getAttribute('data-display-font')).toContain('Anthropic Serif')
    await act(async () => {
      document.body.setAttribute('data-ds-dark-theme', '')
      await Promise.resolve()
    })
    expect(probe.getAttribute('data-bg')).toBe(GO_THEME_TOKENS.classic.dark.bg)
    expect(probe.getAttribute('data-accent')).toBe(GO_THEME_TOKENS.classic.dark.accent)
  })
})
