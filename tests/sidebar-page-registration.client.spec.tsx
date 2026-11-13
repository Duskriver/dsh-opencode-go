// @vitest-environment jsdom
/**
 * Host-slot contract tests for the OpenCode Go console page.
 *
 * The rendering tests live in sidebar-page.client.spec.tsx; this file owns the
 * registration half: the opt-in pair of slots, their metadata, the no-slot
 * downgrade, the dynamic register/unregister contract and the two navigation
 * entry points (settings button and composer pill).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject as clientInject, PAGE_PANEL_ID, PAGE_SIDEBAR_ORDER } from '../src/client/index.ts'
import { pageTabStore, resetPageTab } from '../src/client/pages/nav.ts'
import { GoPage } from '../src/client/pages/Page.tsx'
import { GoRowIcon } from '../src/client/GoMark.tsx'
import { createConfigForm, defaultClientSettings } from './support/client.tsx'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { AnalyticsQuery } from '../src/contracts.ts'
import type { OpencodeGoSettings } from '../src/client/controller.ts'
import type { UsagePillProps } from '../src/client/UsagePill.tsx'
import { createAnalyticsReport } from './support/analytics.ts'
import { en } from '../src/client/presentation.ts'

afterEach(() => { resetPageTab() })

type AnyContext = Record<string, unknown>

interface Registered {
  options: Record<string, unknown>
  component: unknown
  disposed: boolean
  dispose: ReturnType<typeof vi.fn>
}

interface Harness {
  ctx: AnyContext
  settings: ReturnType<typeof createConfigForm<OpencodeGoSettings>>
  slotsRegister: ReturnType<typeof vi.fn>
  slotsInject: ReturnType<typeof vi.fn>
  selectPanel: ReturnType<typeof vi.fn>
  panelInfo: { activePanelId: string | null }
  /** Every registration call, in call order (pair re-registrations included). */
  registrations(): Registered[]
  /** The latest registration for one slot name, disposed or not. */
  registration(name: string): Registered | undefined
  /** Names of the registrations still mounted right now. */
  liveRegistrationNames(): string[]
  /** selectPanel calls and pair disposals, in call order. */
  events: string[]
  /** Flip the opt-in through the Host form, as the Settings switch does. */
  setSidebarEntry(on: boolean): void
  dispose(): Promise<void>
}

/**
 * A client harness with a layout service and a recording slot ledger.
 * @param options - installSidebar: whether the host declares sidebar.panellist;
 *   sidebarEntry: the opt-in setting the form starts with (on by default);
 *   usage: whether the usage remote is served.
 * @returns the harness.
 */
function harness(options: { installSidebar?: boolean; sidebarEntry?: boolean; usage?: boolean } = {}): Harness {
  const installSidebar = options.installSidebar !== false
  const initial = { ...defaultClientSettings, sidebarEntry: options.sidebarEntry ?? true }
  const settings = createConfigForm<OpencodeGoSettings>(initial)
  settings.publish({ status: 'ready', writable: true, value: initial, base: {}, user: {} })
  const effects: unknown[] = []
  const events: string[] = []
  const listeners = new Set<(ref: string) => void>()
  const calls: Registered[] = []
  const panelInfo = { activePanelId: null as string | null }
  const selectPanel = vi.fn((id: string | null) => {
    events.push('select:' + String(id))
    panelInfo.activePanelId = id
  })
  const layout = { panelInfo: { getSnapshot: () => ({ activePanelId: panelInfo.activePanelId }), subscribe: () => () => {} }, selectPanel }
  const slotsRegister = vi.fn((opts: Record<string, unknown>, component: unknown) => {
    const record: Registered = { options: opts, component, disposed: false, dispose: vi.fn() }
    record.dispose.mockImplementation(() => {
      record.disposed = true
      events.push('dispose:' + String(opts.name))
    })
    calls.push(record)
    return record.dispose
  })
  const slotsInject = vi.fn((slot: string, install: () => unknown) => {
    // This harness models a pre-0.2.2 host: no settings nav icon seat. The seat
    // path and the older-host stand-in have their own spec
    // (tests/settings-nav-icon.client.spec.tsx), so the pair lifecycle here stays
    // focused on the sidebar slots.
    if (slot === 'settings.section.icon') return () => {}
    if (slot === 'sidebar.panellist' && !installSidebar) return () => {}
    return install()
  })
  const analyticsRead = vi.fn(async (query: AnalyticsQuery) => ({ ok: true, value: createAnalyticsReport(query) }))
  const analyticsExport = vi.fn(async () => ({ ok: true, value: { filename: 'usage.csv', csv: 'date,requests\n2026-11-05,12\n' } }))
  const directory = createSnapshotStore<ModelDirectoryState>({
    current: { provider: 'dsh-opencode-go', model: 'alpha' }, routable: true,
    groups: [], failures: [], status: 'ready', error: null,
  })
  const window = { status: 'ok' as const, percent: 0, resetsAt: '2026-11-13T08:00:00Z' }
  const usage = { rolling: window, weekly: window, monthly: window }
  const ctx: AnyContext = {
    layout,
    configForms: { get: vi.fn(() => settings.form) },
    inject: (services: string[], install: (ready: unknown) => void) => {
      const ready = services.every(path => path.split('.').reduce<unknown>((value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, ctx))
      if (ready) install(ctx)
    },
    effect: (install: () => unknown) => { effects.push(install()); return () => {} },
    locale: { register: vi.fn(() => () => {}), getLocale: () => ({ active: 'en' }), bind: () => (key: keyof typeof en) => en[key] },
    remote: {
      $mount: vi.fn(async () => () => {}),
      $on: vi.fn((_event: string, listener: (ref: string) => void) => { listeners.add(listener); return () => listeners.delete(listener) }),
      opencodeGoModels: { read: vi.fn(async () => ({ ok: true, value: { models: [], stale: false } })) },
      opencodeGoAccounts: { execute: vi.fn(async () => ({ ok: true, value: 'applied' })) },
      opencodeGoAnalytics: { read: analyticsRead, exportCsv: analyticsExport },
      credentials: { describe: vi.fn(async () => ({ ok: true, value: {} })) },
      llm: { discoverModels: vi.fn(async () => ({ ok: true, value: [] })) },
      ...options.usage === false ? {} : {
        opencodeGoUsage: {
          read: vi.fn(async () => ({ ok: true, value: usage })),
          readAccount: vi.fn(async () => ({ ok: true, value: usage })),
        },
      },
    },
    slots: { inject: slotsInject, register: slotsRegister },
    modelDirectories: { directoryFor: () => ({ store: directory }) },
  }
  const registration = (name: string): Registered | undefined =>
    [...calls].reverse().find(entry => entry.options.name === name)
  const harness: Harness = {
    ctx, settings, slotsRegister, slotsInject, selectPanel, panelInfo, events,
    registrations: () => calls,
    registration,
    liveRegistrationNames: () => calls.filter(entry => !entry.disposed).map(entry => String(entry.options.name)),
    setSidebarEntry: on => {
      const value = settings.form.getSnapshot().value ?? {}
      settings.publish({ value: { ...value, sidebarEntry: on } })
    },
    dispose: async () => {
      for (const effect of effects.splice(0).reverse()) {
        const dispose = await effect
        if (typeof dispose === 'function') dispose()
      }
    },
  }
  return harness
}

/** The composer pill face as the host builds it for one session. */
function pillProps(host: Harness): UsagePillProps {
  const pill = host.registration('conversation.input.right')
  expect(pill?.options.id).toBe('opencode-go-usage')
  return (pill!.options.inject as (session: string) => UsagePillProps)('session-a')
}

/** The settings section inject face, rebuilt the way a render occurrence builds it. */
function sectionFace(host: Harness): { openPage?: (tab?: 'overview' | 'models' | 'usage') => void } {
  const section = host.registration('settings.section')
  expect(section?.options.id).toBe('opencode-go')
  return (section!.options.inject as () => { openPage?: (tab?: 'overview' | 'models' | 'usage') => void })()
}

describe('console page slot contract', () => {
  it('keeps the top-level client inject list unchanged', () => {
    expect(clientInject).toEqual(['slots', 'locale', 'remote', 'remote.credentials'])
  })

  it('registers the sidebar row and the main panel as one pair under the same id', async () => {
    const host = harness()
    try {
      apply(host.ctx as never)
      expect(host.slotsInject).toHaveBeenCalledWith('sidebar.panellist', expect.any(Function))
      const main = host.registration('main')
      const row = host.registration('sidebar.panellist')
      expect(main?.options.key).toBe(PAGE_PANEL_ID)
      expect(row?.options.id).toBe(PAGE_PANEL_ID)
      expect(row?.options.order).toBe(PAGE_SIDEBAR_ORDER)
      expect(typeof row?.options.label).toBe('function')
      expect((row!.options.label as () => string)()).toBe(en.navLabel)
      expect(typeof row?.options.locale).toBe('string')
      // Both halves receive their own component: the page shell and the
      // hand-drawn sidebar mark. The mark is the sidebar icon, not the wave
      // brand mark the page tile keeps.
      expect(main?.component).toBe(GoPage)
      expect(row?.component).toBe(GoRowIcon)
      const injected = (main!.options.inject as () => Record<string, unknown>)()
      expect(typeof (injected.readers as { readAnalytics?: unknown }).readAnalytics).toBe('function')
      expect(typeof injected.openPage).toBe('function')
      expect(host.liveRegistrationNames()).toEqual(expect.arrayContaining(['main', 'sidebar.panellist', 'settings.section']))
    } finally { await host.dispose() }
  })

  it('leaves the pair out by default while the settings section and the pill stay', async () => {
    const host = harness({ sidebarEntry: false })
    try {
      apply(host.ctx as never)
      const live = host.liveRegistrationNames()
      expect(live).not.toContain('main')
      expect(live).not.toContain('sidebar.panellist')
      expect(live).toContain('settings.section')
      // The pill exists on its own and reports that there is no page to open.
      expect(pillProps(host).openUsagePage!()).toBe(false)
      expect(host.selectPanel).not.toHaveBeenCalled()
      expect(pageTabStore.getSnapshot()).toBe('overview')
      // The settings section must not offer a page that is not registered.
      expect(sectionFace(host).openPage).toBeUndefined()
    } finally { await host.dispose() }
  })

  it('registers both halves when the opt-in is switched on', async () => {
    const host = harness({ sidebarEntry: false })
    try {
      apply(host.ctx as never)
      expect(host.liveRegistrationNames()).not.toContain('main')
      host.setSidebarEntry(true)
      const main = host.registration('main')
      const row = host.registration('sidebar.panellist')
      expect(main?.options.key).toBe(PAGE_PANEL_ID)
      expect(row?.options.id).toBe(PAGE_PANEL_ID)
      expect(main?.disposed).toBe(false)
      expect(row?.disposed).toBe(false)
      expect(host.registrations().filter(entry => entry.options.name === 'main')).toHaveLength(1)
      // The link back from the settings section appears with the pair.
      expect(typeof sectionFace(host).openPage).toBe('function')
    } finally { await host.dispose() }
  })

  it('leaves the active page and disposes both halves when the opt-in is switched off', async () => {
    const host = harness()
    try {
      apply(host.ctx as never)
      expect(host.registration('main')).toBeTruthy()
      host.panelInfo.activePanelId = PAGE_PANEL_ID
      host.events.splice(0)
      host.setSidebarEntry(false)
      expect(host.selectPanel).toHaveBeenCalledWith(null)
      expect(host.liveRegistrationNames()).not.toContain('main')
      expect(host.liveRegistrationNames()).not.toContain('sidebar.panellist')
      expect(host.liveRegistrationNames()).toContain('settings.section')
      // Leave the panel before its key disappears: the selection comes first.
      expect(host.events).toEqual(['select:null', 'dispose:sidebar.panellist', 'dispose:main'])
    } finally { await host.dispose() }
  })

  it('does not touch the panel selection when another panel is open on switch-off', async () => {
    const host = harness()
    try {
      apply(host.ctx as never)
      host.panelInfo.activePanelId = 'settings'
      host.events.splice(0)
      host.setSidebarEntry(false)
      expect(host.selectPanel).not.toHaveBeenCalled()
      expect(host.liveRegistrationNames()).not.toContain('main')
      expect(host.events).toEqual(['dispose:sidebar.panellist', 'dispose:main'])
    } finally { await host.dispose() }
  })

  it('offers openPage from the settings section only while the pair is registered', async () => {
    const host = harness()
    try {
      apply(host.ctx as never)
      const face = sectionFace(host)
      expect(typeof face.openPage).toBe('function')
      face.openPage!('models')
      expect(host.selectPanel).toHaveBeenCalledWith(PAGE_PANEL_ID)
      expect(pageTabStore.getSnapshot()).toBe('models')
      host.setSidebarEntry(false)
      expect(sectionFace(host).openPage).toBeUndefined()
    } finally { await host.dispose() }
  })

  it('reports the pill navigation miss when the page is unregistered and true when it is', async () => {
    const host = harness({ sidebarEntry: false })
    try {
      apply(host.ctx as never)
      const off = pillProps(host)
      expect(typeof off.openUsagePage).toBe('function')
      expect(off.openUsagePage!()).toBe(false)
      expect(host.selectPanel).not.toHaveBeenCalled()
      expect(pageTabStore.getSnapshot()).toBe('overview')
      host.setSidebarEntry(true)
      const on = pillProps(host)
      expect(on.openUsagePage!()).toBe(true)
      expect(host.selectPanel).toHaveBeenCalledExactlyOnceWith(PAGE_PANEL_ID)
      expect(pageTabStore.getSnapshot()).toBe('usage')
      // Withdrawing the entry again restores the in-place fallback signal.
      host.setSidebarEntry(false)
      expect(pillProps(host).openUsagePage!()).toBe(false)
    } finally { await host.dispose() }
  })

  it('never registers the pair when the host lacks the sidebar.panellist slot', async () => {
    const host = harness({ installSidebar: false, sidebarEntry: false })
    try {
      apply(host.ctx as never)
      host.setSidebarEntry(true)
      const live = host.liveRegistrationNames()
      expect(live).not.toContain('main')
      expect(live).not.toContain('sidebar.panellist')
      // The settings section still registers: an old host keeps its section.
      expect(live).toContain('settings.section')
      expect(sectionFace(host).openPage).toBeUndefined()
      expect(pillProps(host).openUsagePage!()).toBe(false)
      expect(host.selectPanel).not.toHaveBeenCalled()
    } finally { await host.dispose() }
  })

  it('opens the usage tab from the composer pill and from the settings section', async () => {
    const host = harness()
    try {
      apply(host.ctx as never)
      const pill = pillProps(host)
      expect(typeof pill.openUsagePage).toBe('function')
      expect(pill.openUsagePage!()).toBe(true)
      expect(pageTabStore.getSnapshot()).toBe('usage')
      expect(host.selectPanel).toHaveBeenCalledWith(PAGE_PANEL_ID)

      host.selectPanel.mockClear()
      resetPageTab()
      sectionFace(host).openPage!()
      expect(host.selectPanel).toHaveBeenCalledWith(PAGE_PANEL_ID)
      expect(pageTabStore.getSnapshot()).toBe('overview')
    } finally { await host.dispose() }
  })

  it('leaves the page before disposing the panel and the row on fiber teardown', async () => {
    const host = harness()
    apply(host.ctx as never)
    host.panelInfo.activePanelId = PAGE_PANEL_ID
    host.events.splice(0)
    await host.dispose()
    expect(host.selectPanel).toHaveBeenCalledWith(null)
    expect(host.events).toEqual(['select:null', 'dispose:sidebar.panellist', 'dispose:main'])
  })
})
