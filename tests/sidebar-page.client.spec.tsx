// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { UsagePage } from '../src/client/pages/UsagePage.tsx'
import { GoPage } from '../src/client/pages/Page.tsx'
import { OverviewPage } from '../src/client/pages/OverviewPage.tsx'
import { AccountsPage } from '../src/client/pages/AccountsPage.tsx'
import { ModelsPage } from '../src/client/pages/ModelsPage.tsx'
import { AppearancePage } from '../src/client/pages/AppearancePage.tsx'
import { AboutPage } from '../src/client/pages/AboutPage.tsx'
import { pageTabStore, resetPageTab, setPageTab } from '../src/client/pages/nav.ts'
import { PAGE_TABS, TAB_COPY } from '../src/client/pages/types.ts'
import { CLIENT_BUILD_INFO } from '../src/client/build-info.ts'
import { en, GO_THEME_TOKENS } from '../src/client/presentation.ts'
import {
  accountsStateOf,
  field,
  modelsOf,
  pagePropsOf,
  pageShellOf,
  pageStateOf,
  readersOf,
} from './support/pages.tsx'
import './support/client.tsx'

const ACCOUNT = { id: 'primary', name: 'Primary', apiKeyEnv: 'OPENCODE_API_KEY' } as const
const RESEARCH = { id: 'research', name: 'Research', apiKeyEnv: 'RESEARCH_KEY' } as const
const GO_MODEL = { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', contextWindow: 128000, maxTokens: 8192 } as const

beforeEach(() => {
  // jsdom implements no Element.scrollTo; the page shell resets its scroller on mount.
  Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, writable: true, value: vi.fn() })
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); resetPageTab() })

describe('console page foundation', () => {
  it('keeps the client build facts in sync with package.json', () => {
    const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      name: string; version: string; engines: { dsh: string }
    }
    expect(CLIENT_BUILD_INFO.packageName).toBe(manifest.name)
    expect(CLIENT_BUILD_INFO.version).toBe(manifest.version)
    expect(manifest.engines.dsh).toContain(CLIENT_BUILD_INFO.minHost)
  })

  it('stores the selected tab outside the mounted page', () => {
    expect(pageTabStore.getSnapshot()).toBe('overview')
    setPageTab('usage')
    expect(pageTabStore.getSnapshot()).toBe('usage')
    setPageTab('accounts')
    expect(pageTabStore.getSnapshot()).toBe('accounts')
    // Unknown tabs are ignored rather than blanking the page.
    setPageTab('nope' as never)
    expect(pageTabStore.getSnapshot()).toBe('accounts')
    resetPageTab()
    expect(pageTabStore.getSnapshot()).toBe('overview')
  })

  it('shows the unavailable notice when the host does not serve analytics', () => {
    render(<UsagePage {...pagePropsOf({ readers: null })} />)
    expect(screen.getByRole('status').textContent).toContain(en.analyticsUnavailable)
  })

  it('mounts the shared dashboard as a page surface, not a dialog', async () => {
    const state = pageStateOf({ appliedAppearanceTheme: 'classic' })
    state.accounts = { ...state.accounts, entries: [{ id: 'primary', name: 'Primary', apiKeyEnv: 'OPENCODE_API_KEY' }] }
    const props = pagePropsOf({ state })
    const { container } = render(<UsagePage {...props} />)
    await waitFor(() => { expect(screen.getAllByText('deepseek-v4.1-flash').length).toBeGreaterThan(0) })
    expect(screen.queryByRole('dialog')).toBeNull()
    const dashboard = container.querySelector('[data-variant="page"]') as HTMLElement
    expect(dashboard).not.toBeNull()
    expect(dashboard.style.getPropertyValue('--go-bg')).toBe(GO_THEME_TOKENS.classic.light.bg)
    expect(props.actions.readers!.readAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ accountRef: 'OPENCODE_API_KEY', range: '30d' }),
      expect.any(AbortSignal),
    )
  })
})

describe('console page shell', () => {
  const renderShell = (overrides: Parameters<typeof pageShellOf>[0] = {}) => {
    const shell = pageShellOf(overrides)
    const view = render(<GoPage {...shell} />)
    return { shell, view }
  }

  it('renders the brand header and the six tabs with Overview selected', () => {
    renderShell()
    expect(screen.getByRole('heading', { level: 1, name: en.pageTitle })).toBeTruthy()
    expect(screen.getByText(en.pageSubtitle)).toBeTruthy()
    expect(screen.getByTitle(en.pageStatusOn)).toBeTruthy()
    const tablist = screen.getByRole('tablist', { name: en.pageTabsLabel })
    const tabs = within(tablist).getAllByRole('tab') as HTMLButtonElement[]
    expect(tabs).toHaveLength(PAGE_TABS.length)
    expect(tabs.map(tab => tab.textContent)).toEqual(PAGE_TABS.map(tab => en[TAB_COPY[tab]]))
    expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false'])
    expect(tabs.map(tab => tab.tabIndex)).toEqual([0, -1, -1, -1, -1, -1])
    const panel = screen.getByRole('tabpanel')
    expect(panel.id).toBe(tabs[0].getAttribute('aria-controls'))
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id)
    expect(screen.getByRole('heading', { level: 2, name: en.overviewCurrentAccount })).toBeTruthy()
  })

  it('switches the mounted page when a tab is clicked', () => {
    renderShell({ state: { models: modelsOf([GO_MODEL]), accounts: accountsStateOf([ACCOUNT]) } })
    fireEvent.click(screen.getByRole('tab', { name: en.tabAbout }))
    expect(pageTabStore.getSnapshot()).toBe('about')
    expect(screen.getByRole('tab', { name: en.tabOverview }).getAttribute('aria-selected')).toBe('false')
    const aboutTab = screen.getByRole('tab', { name: en.tabAbout })
    expect(aboutTab.getAttribute('aria-selected')).toBe('true')
    expect(aboutTab.tabIndex).toBe(0)
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(aboutTab.id)
    expect(screen.getByRole('heading', { level: 2, name: en.aboutTitle })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: en.tabModels }))
    expect(pageTabStore.getSnapshot()).toBe('models')
    expect(screen.getByRole('heading', { level: 3, name: GO_MODEL.name })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: en.tabAccounts }))
    expect(pageTabStore.getSnapshot()).toBe('accounts')
    expect(screen.getByText(en.accountsPageHint)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: en.tabAppearance }))
    expect(pageTabStore.getSnapshot()).toBe('appearance')
    expect(screen.getByText(en.appearanceThemeLabel)).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: en.tabUsage }))
    expect(pageTabStore.getSnapshot()).toBe('usage')
    expect(screen.getByRole('heading', { level: 1, name: en.analyticsTitle })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: en.tabOverview }))
    expect(screen.getByRole('heading', { level: 2, name: en.overviewCurrentAccount })).toBeTruthy()
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      screen.getByRole('tab', { name: en.tabOverview }).id,
    )
  })

  it('moves the selection with the arrow/Home/End keys and focuses the new tab', () => {
    renderShell()
    const overview = screen.getByRole('tab', { name: en.tabOverview })
    overview.focus()
    fireEvent.keyDown(overview, { key: 'ArrowRight' })
    expect(pageTabStore.getSnapshot()).toBe('usage')
    const usage = screen.getByRole('tab', { name: en.tabUsage })
    expect(usage.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(usage)
    fireEvent.keyDown(screen.getByRole('tab', { name: en.tabAccounts }), { key: 'End' })
    expect(pageTabStore.getSnapshot()).toBe('about')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: en.tabAbout }))
    fireEvent.keyDown(screen.getByRole('tab', { name: en.tabOverview }), { key: 'ArrowLeft' })
    expect(pageTabStore.getSnapshot()).toBe('about')
    fireEvent.keyDown(screen.getByRole('tab', { name: en.tabAbout }), { key: 'Home' })
    expect(pageTabStore.getSnapshot()).toBe('overview')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: en.tabOverview }))
    // Keys the tab strip does not own leave the selection alone.
    fireEvent.keyDown(screen.getByRole('tab', { name: en.tabOverview }), { key: 'PageDown' })
    expect(pageTabStore.getSnapshot()).toBe('overview')
  })

  it('restores the tab the host asked to open', () => {
    setPageTab('models')
    renderShell({ state: { models: modelsOf([GO_MODEL]) } })
    const modelsTab = screen.getByRole('tab', { name: en.tabModels })
    expect(modelsTab.getAttribute('aria-selected')).toBe('true')
    expect(modelsTab.tabIndex).toBe(0)
    const pagePanel = screen.getAllByRole('tabpanel').find(node => node.getAttribute('aria-labelledby') === modelsTab.id)
    expect(pagePanel).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: GO_MODEL.name })).toBeTruthy()
  })

  it('shows the loading notice and keeps the tab strip unmounted', () => {
    renderShell({ state: { status: 'loading' } })
    expect(screen.getByRole('status').textContent).toBe(en.pageLoading)
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: en.pageTitle })).toBeTruthy()
  })

  it('shows the unavailable notice on a host without the page', () => {
    renderShell({ state: { status: 'unavailable' } })
    expect(screen.getByText(en.pageUnavailable)).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  it('runs Save and Discard from the staged-changes bar', () => {
    const { shell } = renderShell({ state: { dirty: true } })
    const save = screen.getByRole('button', { name: en.save }) as HTMLButtonElement
    const discard = screen.getByRole('button', { name: en.discard }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    expect(discard.disabled).toBe(false)
    fireEvent.click(save)
    fireEvent.click(discard)
    expect(shell.save).toHaveBeenCalledTimes(1)
    expect(shell.discard).toHaveBeenCalledTimes(1)
  })

  it('refuses to save an invalid draft and labels an in-flight save', () => {
    const invalid = renderShell({ state: { dirty: true, invalid: true } })
    const save = screen.getByRole('button', { name: en.save }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.discard }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save)
    expect(invalid.shell.save).not.toHaveBeenCalled()
    invalid.view.unmount()
    renderShell({ state: { dirty: true, saving: true } })
    expect((screen.getByRole('button', { name: en.saving }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.discard }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the read-only and failed-save notes without enabling Save', () => {
    renderShell({ state: { dirty: true, writable: false, failed: true } })
    expect(screen.getByRole('alert').textContent).toBe(en.savedFailed)
    expect(screen.getByText(en.readOnly)).toBeTruthy()
    expect((screen.getByRole('button', { name: en.save }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.discard }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the failed-save note even with a clean draft', () => {
    const { shell } = renderShell({ state: { failed: true } })
    expect(screen.getByText(en.savedFailed)).toBeTruthy()
    expect((screen.getByRole('button', { name: en.save }) as HTMLButtonElement).disabled).toBe(true)
    expect(shell.save).not.toHaveBeenCalled()
  })

  it('keeps the save bar to the staged advanced draft', () => {
    const { shell } = renderShell()
    // Immediate surfaces (overview switches, appearance, models) never stage a
    // draft, so there is no Save gesture until the Advanced tab edits something.
    expect(screen.queryByRole('button', { name: en.save })).toBeNull()
    act(() => {
      shell.store.set(pageStateOf({
        usageDisplay: field('off'),
        appearanceTheme: field('classic'),
        freeEnabled: field('true'),
        modelVisibility: { [GO_MODEL.id]: false },
      }))
    })
    expect(screen.queryByRole('button', { name: en.save })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: en.tabAppearance }))
    expect(screen.getByText(en.advancedSaveHint)).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.save })).toBeNull()
    // A staged advanced draft is what summons the one Save gesture.
    act(() => { shell.store.set(pageStateOf({ dirty: true })) })
    expect(screen.getByRole('button', { name: en.save })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: en.tabOverview }))
    expect(screen.getByRole('button', { name: en.save })).toBeTruthy()
    act(() => { shell.store.set(pageStateOf()) })
    expect(screen.queryByRole('button', { name: en.save })).toBeNull()
  })

  it('does not offer the sidebar-entry opt-in from the console page', () => {
    renderShell()
    expect(screen.queryByText(en.sidebarEntryLabel)).toBeNull()
    expect(screen.queryByRole('switch', { name: en.sidebarEntryLabel })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: en.tabAbout }))
    // About reports the entry state; switching it stays a Settings action.
    expect(screen.queryByRole('switch', { name: en.sidebarEntryLabel })).toBeNull()
    expect(screen.getByText(en.aboutEntryHidden)).toBeTruthy()
  })

  it('names the refused immediate write on the overview, appearance and models surfaces', () => {
    const shell = pageShellOf({ state: { models: modelsOf([GO_MODEL]), accounts: accountsStateOf([ACCOUNT]) } })
    render(<GoPage {...shell} />)
    act(() => {
      shell.store.set(pageStateOf({ accounts: accountsStateOf([ACCOUNT]), writeFailed: 'freeEnabled' }))
    })
    expect(screen.getByRole('alert').textContent).toBe(en.immediateWriteFailed)
    fireEvent.click(screen.getByRole('tab', { name: en.tabAppearance }))
    act(() => { shell.store.set(pageStateOf({ writeFailed: 'appearanceTheme' })) })
    expect(screen.getByRole('alert').textContent).toBe(en.immediateWriteFailed)
    fireEvent.click(screen.getByRole('tab', { name: en.tabModels }))
    act(() => { shell.store.set(pageStateOf({ models: modelsOf([GO_MODEL]), writeFailed: 'modelLimits' })) })
    expect(screen.getByRole('alert').textContent).toBe(en.immediateWriteFailed)
  })

  it('renders nothing when one required inject seat is missing', () => {
    const required = [
      'useOpencodeGo', 't', 'edit', 'editModelLimits', 'resetField', 'save', 'discard',
      'loadModels', 'setEnabled', 'setSidebarEntry', 'setModelEnabled', 'loadAccounts', 'addAccount',
      'renameAccount', 'removeAccount', 'selectAccount', 'setAutoSwitch',
      'replaceAccountKey', 'moveAccount',
    ]
    const shell = pageShellOf()
    for (const seat of required) {
      const partial: Record<string, unknown> = { ...shell }
      delete partial[seat]
      const view = render(<GoPage {...(partial as never)} />)
      expect(view.container.innerHTML, 'missing ' + seat).toBe('')
      view.unmount()
    }
  })

  it('paints the theme tokens and names the disabled service', () => {
    const { view } = renderShell({ state: { enabled: false, appliedAppearanceTheme: 'classic' } })
    const root = view.container.querySelector('[data-opencode-go-page]') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.style.getPropertyValue('--go-bg')).toBe(GO_THEME_TOKENS.classic.light.bg)
    expect(screen.getByTitle(en.pageStatusOff)).toBeTruthy()
  })

  it('contains a crashing tab and returns to Overview on retry', () => {
    const shell = pageShellOf({ state: { accounts: undefined as never } })
    render(<GoPage {...shell} />)
    expect(screen.getByRole('alert').textContent).toContain(en.pageCrashTitle)
    act(() => { shell.store.set(pageStateOf()) })
    fireEvent.click(screen.getByRole('button', { name: en.pageRetry }))
    expect(pageTabStore.getSnapshot()).toBe('overview')
    expect(screen.queryByText(en.pageCrashTitle)).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: en.overviewCurrentAccount })).toBeTruthy()
  })
})

describe('console sub-pages', () => {
  it('shows the overview KPIs and the three quota windows from the readers', async () => {
    const props = pagePropsOf({ state: { accounts: accountsStateOf([ACCOUNT]) } })
    render(<OverviewPage {...props} />)
    await waitFor(() => { expect(screen.getByTitle('12')).toBeTruthy() })
    expect(screen.getByTitle('12').textContent).toBe('12')
    expect(screen.getByTitle('6,500').textContent).toBe('6.5K')
    expect(screen.getByText('66.7')).toBeTruthy()
    expect(screen.getByText('$1.23')).toBeTruthy()
    expect(screen.getByText('6 per day on average')).toBeTruthy()
    expect(screen.getByText('Input 1K · Output 2K')).toBeTruthy()
    expect(props.actions.readers!.readAnalytics).toHaveBeenCalledWith(
      { accountRef: 'OPENCODE_API_KEY', range: '7d' },
      expect.any(AbortSignal),
    )
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: en.usage_rolling + ' 0%' })).toBeTruthy()
    })
    expect(screen.getByRole('progressbar', { name: en.usage_rolling + ' 0%' }).getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByRole('progressbar', { name: en.usage_weekly + ' 18%' }).getAttribute('aria-valuenow')).toBe('18')
    expect(screen.getByRole('progressbar', { name: en.usage_monthly + ' 21%' }).getAttribute('aria-valuenow')).toBe('21')
    expect(screen.getByText(en.pageStatusOn)).toBeTruthy()
  })

  it('routes the overview shortcuts into the sibling tabs', () => {
    const go = vi.fn()
    render(<OverviewPage {...pagePropsOf({ state: { accounts: accountsStateOf([ACCOUNT]) }, go })} />)
    const quick = screen.getByRole('region', { name: en.overviewQuickLinks })
    expect(within(quick).getAllByRole('button')).toHaveLength(3)
    fireEvent.click(within(quick).getByRole('button', { name: new RegExp('^' + en.tabUsage) }))
    fireEvent.click(within(quick).getByRole('button', { name: new RegExp('^' + en.tabAccounts) }))
    fireEvent.click(within(quick).getByRole('button', { name: new RegExp('^' + en.tabModels) }))
    fireEvent.click(screen.getByRole('button', { name: en.overviewManageAccounts }))
    fireEvent.click(screen.getByRole('button', { name: en.overviewOpenUsage }))
    fireEvent.click(screen.getByRole('button', { name: en.overviewDetails }))
    expect(go.mock.calls.map(call => call[0])).toEqual(['usage', 'accounts', 'models', 'accounts', 'usage', 'usage'])
  })

  it('wires the provider, free-channel and fallback switches', () => {
    const props = pagePropsOf({ state: { accounts: accountsStateOf([ACCOUNT]) } })
    render(<OverviewPage {...props} />)
    expect(props.actions.loadAccounts).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('switch', { name: en.enabledLabel }))
    expect(props.actions.setEnabled).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole('switch', { name: en.freeEnabledLabel }))
    expect(props.actions.edit).toHaveBeenCalledWith('freeEnabled', 'true')
    fireEvent.click(screen.getByRole('switch', { name: en.accountAutoSwitch }))
    expect(props.actions.setAutoSwitch).toHaveBeenCalledWith(true)
  })

  it('degrades the overview when the host has no history readers', () => {
    render(<OverviewPage {...pagePropsOf({ state: { accounts: accountsStateOf([ACCOUNT]) }, readers: null })} />)
    expect(screen.getAllByText(en.usageUnavailable).length).toBeGreaterThan(0)
    expect(screen.getAllByText(en.overviewNoReport).length).toBeGreaterThan(0)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('renders the account rows with the page surface opened', () => {
    const props = pagePropsOf({
      state: { accounts: accountsStateOf([{ ...ACCOUNT, configured: true }, { ...RESEARCH, configured: false }]) },
    })
    render(<AccountsPage {...props} />)
    expect(screen.getByText(en.accountsTitle)).toBeTruthy()
    const trigger = screen.getByRole('button', { name: new RegExp('^' + en.accountsTitle) })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Primary')).toBeTruthy()
    expect(screen.getByText('Research')).toBeTruthy()
    expect(screen.getByText(en.accountsPageHint)).toBeTruthy()
    expect(props.actions.loadAccounts).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: en.accountsRefresh }))
    expect(props.actions.loadAccounts).toHaveBeenCalledTimes(2)
  })

  it('opens the card editor from the page add action and submits it', async () => {
    const props = pagePropsOf({ state: { accounts: accountsStateOf([ACCOUNT]) } })
    render(<AccountsPage {...props} />)
    fireEvent.click(screen.getByRole('button', { name: en.accountAdd }))
    expect(screen.getByLabelText(en.accountName)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(en.accountName), { target: { value: 'Backup' } })
    fireEvent.change(screen.getByLabelText(en.keyLabel), { target: { value: 'sk-fixture' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.accountConfirm })) })
    expect(props.actions.addAccount).toHaveBeenCalledWith('Backup', 'sk-fixture')
    expect(screen.queryByLabelText(en.accountName)).toBeNull()
  })

  it('renders the models card, its visibility switch and the catalog note', () => {
    const props = pagePropsOf({ state: { models: modelsOf([GO_MODEL]) } })
    render(<ModelsPage {...props} />)
    expect(screen.getByRole('tablist', { name: en.modelSourcesLabel })).toBeTruthy()
    expect(screen.getAllByText(GO_MODEL.name)).toHaveLength(2)
    expect(screen.getByText('0 customized')).toBeTruthy()
    expect(screen.getByText(en.modelsPageHint)).toBeTruthy()
    expect(screen.getByText(en.visibilityHint)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.modelsRefresh }))
    expect(props.actions.loadModels).toHaveBeenCalledTimes(1)
    const visible = en.modelVisibleLabel.replace('{name}', GO_MODEL.name)
    fireEvent.click(screen.getByRole('switch', { name: visible }))
    expect(props.actions.setModelEnabled).toHaveBeenCalledWith(GO_MODEL.id, false)
  })

  it('renders the appearance and advanced controls with their live actions', () => {
    const props = pagePropsOf({
      state: {
        appearanceTheme: field('native', { overridden: true }),
        baseURL: field('https://opencode.ai/zen/go/v1', { overridden: true }),
      },
    })
    render(<AppearancePage {...props} />)
    expect(screen.getByText(en.appearanceThemeLabel)).toBeTruthy()
    expect(screen.getByText(en.appearanceTheme_native)).toBeTruthy()
    expect(screen.getByText(en.showSidebarQuotaLabel)).toBeTruthy()
    expect(screen.getByText(en.usagePillStyleLabel)).toBeTruthy()
    expect(screen.getByText(en.usageDisplayLabel)).toBeTruthy()
    expect(screen.getByText(en.groupConnection)).toBeTruthy()
    expect(screen.getByText(en.groupCacheTimeouts)).toBeTruthy()
    expect(screen.getByText(en.groupImages)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: en.appearanceTheme_classic }))
    expect(props.actions.edit).toHaveBeenCalledWith('appearanceTheme', 'classic')
    const usageModes = screen.getByRole('radiogroup', { name: en.usageDisplayLabel })
    fireEvent.click(within(usageModes).getByRole('radio', { name: en.usageDisplay_off }))
    expect(props.actions.edit).toHaveBeenCalledWith('usageDisplay', 'off')
    fireEvent.click(screen.getByRole('radio', { name: en.usagePillStyle_plain }))
    expect(props.actions.edit).toHaveBeenCalledWith('usagePillStyle', 'plain')
    fireEvent.click(screen.getByRole('button', { name: en.usageAppearanceReset }))
    expect(props.actions.resetField).toHaveBeenCalledWith('appearanceTheme')
    fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
    expect(props.actions.resetField).toHaveBeenCalledWith('baseURL')
    // The shell owns the staged save bar; this page never renders one.
    expect(screen.queryByRole('button', { name: en.save })).toBeNull()
    expect(screen.queryByRole('button', { name: en.discard })).toBeNull()
  })

  it('locks the page fields when the settings document is read-only', () => {
    render(<AppearancePage {...pagePropsOf({ state: { writable: false } })} />)
    expect((screen.getByRole('radio', { name: en.appearanceTheme_native }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText(en.baseURLLabel) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.usageAppearanceReset }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: en.advancedResetAll }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(en.readOnly)).toBeNull()
  })

  it('renders the build facts, project links and diagnostics', () => {
    const props = pagePropsOf({
      state: { accounts: accountsStateOf([ACCOUNT, RESEARCH]), freeEnabled: field('true'), sidebarEntry: true },
    })
    render(<AboutPage {...props} />)
    expect(screen.getByRole('heading', { level: 2, name: en.aboutTitle })).toBeTruthy()
    expect(screen.getAllByText('v' + CLIENT_BUILD_INFO.version)).toHaveLength(2)
    expect(screen.getByText(CLIENT_BUILD_INFO.packageName)).toBeTruthy()
    expect(screen.getByText(CLIENT_BUILD_INFO.minHost)).toBeTruthy()
    expect(screen.getByText(en.aboutEntryValue)).toBeTruthy()
    expect(screen.getByText(CLIENT_BUILD_INFO.build)).toBeTruthy()
    expect(screen.getByRole('link', { name: en.aboutRepo }).getAttribute('href'))
      .toBe('https://github.com/Duskriver/dsh-opencode-go')
    expect(screen.getByRole('link', { name: en.aboutDocs }).getAttribute('href'))
      .toBe('https://github.com/Duskriver/dsh-opencode-go/blob/main/docs/development.md')
    expect(screen.getByRole('link', { name: en.aboutChangelog }).getAttribute('href'))
      .toBe('https://github.com/Duskriver/dsh-opencode-go/blob/main/CHANGELOG.md')
    expect(screen.getByText(en.pageStatusOn)).toBeTruthy()
    expect(screen.getAllByText(en.aboutOk)).toHaveLength(2)
    expect(screen.getByText(en.aboutNa)).toBeTruthy()
    const countRow = screen.getByText(en.accountsTitle).closest('div') as HTMLElement
    expect(within(countRow).getByText('2')).toBeTruthy()
  })

  it('reports unavailable diagnostics on a bare host', () => {
    render(<AboutPage {...pagePropsOf({ state: { enabled: false }, readers: null })} />)
    expect(screen.getByText(en.aboutEntryHidden)).toBeTruthy()
    expect(screen.getByText(en.pageStatusOff)).toBeTruthy()
    expect(screen.getAllByText(en.aboutOff)).toHaveLength(2)
    expect(screen.getByText(en.aboutNa)).toBeTruthy()
    expect(screen.queryByText(en.pageStatusOn)).toBeNull()
  })

  it('mounts the usage dashboard inside the shell tab', async () => {
    const readers = readersOf()
    const shell = pageShellOf({ state: { accounts: accountsStateOf([ACCOUNT]) }, readers })
    render(<GoPage {...shell} />)
    fireEvent.click(screen.getByRole('tab', { name: en.tabUsage }))
    expect(screen.getByRole('heading', { level: 1, name: en.analyticsTitle })).toBeTruthy()
    await waitFor(() => {
      expect(readers.readAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ accountRef: 'OPENCODE_API_KEY', range: '30d' }),
        expect.any(AbortSignal),
      )
    })
    expect(document.querySelector('[data-variant="page"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
