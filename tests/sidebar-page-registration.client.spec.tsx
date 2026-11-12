// @vitest-environment jsdom
/**
 * Host-slot contract tests for the OpenCode Go console page.
 *
 * The rendering tests live in sidebar-page.client.spec.tsx; this file owns the
 * registration half: the pair of slots, their metadata, the no-slot downgrade and
 * the two navigation entry points (settings button and composer pill).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject as clientInject, PAGE_PANEL_ID, PAGE_SIDEBAR_ORDER, setPageTab } from '../src/client/index.ts'
import { pageTabStore, resetPageTab } from '../src/client/pages/nav.ts'
import { createConfigForm, defaultClientSettings, translator } from './support/client.tsx'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { AnalyticsQuery } from '../src/contracts.ts'
import type { OpencodeGoSettings } from '../src/client/controller.ts'
import type { UsagePillProps } from '../src/client/UsagePill.tsx'
import { createAnalyticsReport } from './support/analytics.ts'
import { en } from '../src/client/presentation.ts'

afterEach(() => { resetPageTab() })

type AnyContext = Record<string, unknown>

interface Harness {
  ctx: AnyContext
  settings: ReturnType<typeof createConfigForm<OpencodeGoSettings>>
  slotsRegister: ReturnType<typeof vi.fn>
  slotsInject: ReturnType<typeof vi.fn>
  selectPanel: ReturnType<typeof vi.fn>
  panelInfo: { activePanelId: string | null }
  registrations(): Array<{ options: Record<string, unknown>; component: unknown }>
  effects: unknown[]
  dispose(): Promise<void>
}

/**
 * A client harness with a layout service and a recording slot ledger.
 * @param options - installSidebar: whether the host declares sidebar.panellist.
 * @returns the harness.
 */
function harness(options: { installSidebar?: boolean; usage?: boolean } = {}): Harness {
  const installSidebar = options.installSidebar !== false
  const settings = createConfigForm<OpencodeGoSettings>({ ...defaultClientSettings })
  settings.publish({ status: 'ready', writable: true, value: { ...defaultClientSettings }, base: {}, user: {} })
  const effects: unknown[] = []
  const listeners = new Set<(ref: string) => void>()
  const calls: Array<{ options: Record<string, unknown>; component: unknown }> = []
  const disposers: Array<() => void> = []
  const panelInfo = { activePanelId: null as string | null }
  const selectPanel = vi.fn((id: string | null) => { panelInfo.activePanelId = id })
  const layout = { panelInfo: { getSnapshot: () => ({ activePanelId: panelInfo.activePanelId }), subscribe: () => () => {} }, selectPanel }
  const slotsRegister = vi.fn((opts: Record<string, unknown>, component: unknown) => {
    calls.push({ options: opts, component })
    const dispose = vi.fn()
    disposers.push(dispose)
    return dispose
  })
  const slotsInject = vi.fn((slot: string, install: () => unknown) => {
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
          read: vi.fn(async () => ({ ok: true, value: { rolling: window, weekly: window, monthly: window } })),
          readAccount: vi.fn(async () => ({ ok: true, value: { rolling: window, weekly: window, monthly: window } })),
        },
      },
    },
    slots: { inject: slotsInject, register: slotsRegister },
    modelDirectories: { directoryFor: () => ({ store: directory }) },
  }
  return {
    ctx, settings, slotsRegister, slotsInject, selectPanel, panelInfo,
    registrations: () => calls,
    effects,
    dispose: async () => {
      for (const effect of effects.splice(0).reverse()) {
        const dispose = await effect
        if (typeof dispose === 'function') dispose()
      }
    },
  }
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
      const main = host.registrations().find(entry => entry.options.name === 'main')
      const row = host.registrations().find(entry => entry.options.name === 'sidebar.panellist')
      expect(main?.options.key).toBe(PAGE_PANEL_ID)
      expect(main).toBeTruthy()
      expect(row?.options.id).toBe(PAGE_PANEL_ID)
      expect(row?.options.order).toBe(PAGE_SIDEBAR_ORDER)
      expect(typeof row?.options.label).toBe('function')
      expect((row!.options.label as () => string)()).toBe(en.navLabel)
      expect(typeof row?.options.locale).toBe('string')
      // Both halves receive a component, and the main half carries the readers.
      expect(main?.component).toBeTruthy()
      expect(row?.component).toBeTruthy()
      const injected = (main!.options.inject as () => Record<string, unknown>)()
      expect(typeof (injected.readers as { readAnalytics?: unknown }).readAnalytics).toBe('function')
      expect(typeof injected.openPage).toBe('function')
    } finally { await host.dispose() }
  })

  it('does not register the pair when the host never declares sidebar.panellist', async () => {
    const host = harness({ installSidebar: false })
    try {
      apply(host.ctx as never)
      const names = host.registrations().map(entry => entry.options.name)
      expect(names).not.toContain('main')
      expect(names).not.toContain('sidebar.panellist')
      // The settings section still registers: an old host keeps its section.
      expect(names).toContain('settings.section')
    } finally { await host.dispose() }
  })

  it('leaves the page before disposing the panel and the row', async () => {
    const host = harness()
    try {
      apply(host.ctx as never)
      host.panelInfo.activePanelId = PAGE_PANEL_ID
      host.selectPanel.mockClear()
      const order: string[] = []
      const registrations = host.slotsRegister.mock.results
      registrations.forEach((result, index) => {
        const dispose = result.value as () => void
        if (typeof dispose === 'function' && index > 0) {
          // Wrap the page pair's disposers to observe ordering.
          const wrapped = vi.fn(() => { order.push('dispose:' + String(index)) })
          try { dispose.mockImplementation?.(wrapped) } catch { /* plain disposer */ }
        }
      })
      await host.dispose()
      expect(host.selectPanel).toHaveBeenCalledWith(null)
      const selectIndex = host.selectPanel.mock.invocationCallOrder[0]
      const disposeCalls = host.slotsRegister.mock.results
        .map(result => (result.value as { mock?: { invocationCallOrder?: number[] } }).mock?.invocationCallOrder?.[0])
        .filter((value): value is number => typeof value === 'number')
      for (const disposeOrder of disposeCalls) expect(selectIndex).toBeLessThan(disposeOrder)
    } finally { await host.dispose() }
  })

  it('opens the usage tab from the composer pill and the settings button', async () => {
    const host = harness()
    try {
      apply(host.ctx as never)
      const pill = host.registrations().find(entry => entry.options.id === 'opencode-go-usage')
      expect(pill).toBeTruthy()
      const props = (pill!.options.inject as () => UsagePillProps)()
      expect(typeof props.openUsagePage).toBe('function')
      props.openUsagePage!()
      expect(pageTabStore.getSnapshot()).toBe('usage')
      expect(host.selectPanel).toHaveBeenCalledWith(PAGE_PANEL_ID)

      host.selectPanel.mockClear()
      const section = host.registrations().find(entry => entry.options.name === 'settings.section')
      const sectionProps = (section!.options.inject as () => { openPage?: () => void })()
      expect(typeof sectionProps.openPage).toBe('function')
      setPageTab('overview')
      sectionProps.openPage!()
      expect(host.selectPanel).toHaveBeenCalledWith(PAGE_PANEL_ID)
    } finally { await host.dispose() }
  })
})
