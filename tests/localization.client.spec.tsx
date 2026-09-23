// @vitest-environment jsdom

/** Real installed Host locale resolution drives both plugin surfaces without persisting automatic choices. */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as store from '@deepseek-ai/dsh-client-store'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { LocaleRuntime as HostLocaleRuntime, LocaleSettings } from '@deepseek-ai/dsh-client-locale/client'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { OpencodeGoSection } from '../src/client/Section.tsx'
import { OpencodeGoSectionController, type OpencodeGoSettings } from '../src/client/section-controller.ts'
import { UsagePill } from '../src/client/UsagePill.tsx'
import { en, zh, type OpencodeGoKey } from '../src/client/locales.ts'
import { bindSnapshotSelector, stubSettingsScope } from './support/client.ts'

const require = createRequire(import.meta.url)
const localeBundle = readFileSync(require.resolve('@deepseek-ai/dsh-client-locale/client'), 'utf8')
const namespace = 'settings.opencode-go'
const cleanups: Array<() => void | Promise<void>> = []
let originalStyles: Set<HTMLStyleElement>

beforeEach(() => {
  originalStyles = new Set(document.head.querySelectorAll('style'))
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-23T12:00:00Z'))
})
afterEach(async () => {
  cleanup()
  for (const dispose of cleanups.splice(0).reverse()) await dispose()
  for (const style of document.head.querySelectorAll('style')) if (!originalStyles.has(style)) style.remove()
  vi.useRealTimers()
})

function createLocale(languages: string[], preference?: string) {
  vi.stubGlobal('navigator', { languages, language: languages[0] ?? '' })
  const table = new Map<string, unknown>([
    ['react', React], ['react/jsx-runtime', jsx],
    ['@deepseek-ai/dsh-client-store', store],
    ['@deepseek-ai/dsh-client-ui-primitives', primitives],
  ])
  type Exports = { LocaleRuntime: typeof HostLocaleRuntime }
  let registration: { factory: (require: (id: string) => unknown) => Exports } | undefined
  // Published browser packages use the Host module table, not Node's ESM loader.
  runInNewContext(localeBundle, {
    document, navigator, console,
    window: { __ModuleLoader__: { load: (entry: typeof registration) => { registration = entry } } },
  })
  if (!registration) throw new Error('installed locale bundle did not register')
  const { LocaleRuntime } = registration.factory(id => {
    if (!table.has(id)) throw new Error(`Unprovided locale dependency: ${id}`)
    return table.get(id)
  })
  const host = stubSettingsScope<LocaleSettings>()
  host.publish({ status: 'ready', writable: true, value: preference ? { preference } : {}, base: {}, user: {} })
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  const locale = new LocaleRuntime(ctx, host.scope)
  locale.register(namespace, 'zh', zh)
  locale.register(namespace, 'en', en)
  return { locale, host }
}

const windowUsage = { status: 'ok' as const, percent: 10, resetsAt: '2026-09-24T13:05:00Z' }
const usage = { rolling: { ...windowUsage, percent: 0 }, weekly: windowUsage, monthly: windowUsage }

async function mountSurfaces(locale: HostLocaleRuntime) {
  const settings = stubSettingsScope<OpencodeGoSettings>()
  settings.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
  const readModels = vi.fn(async () => ({ ok: true as const, value: { stale: false, models: [
    { id: 'alpha', name: 'Alpha', releaseDate: '2026-09-23', contextWindow: 123456, maxTokens: 8192 },
    { id: 'missing', name: 'missing', configurationMissing: true },
  ] } }))
  const controller = new OpencodeGoSectionController(settings.scope, { remote: {
    credentials: { describe: async () => ({ ok: true, value: {} }) },
  } } as never, readModels)
  cleanups.push(() => controller.dispose())
  const face = controller.inject()
  const useOpencodeGo = bindSnapshotSelector(face.hooks.opencodeGo)
  const t = locale.bind(namespace)
  const directory = store.createSnapshotStore<ModelDirectoryState>({
    current: { provider: 'opencode-go', model: 'alpha' }, routable: true,
    groups: [], failures: [], status: 'ready', error: null,
  })
  const readUsage = vi.fn(async () => usage)
  const subscribe = (listener: () => void) => locale.subscribe(listener)
  const getSnapshot = () => locale.getSnapshot()
  const getLocale = () => locale.getSnapshot().active
  const usageTranslate = (key: string) => t(key as OpencodeGoKey)
  // Host slot injection caches these faces; getters must remain live without rebuilding them.
  const sectionProps = { ...face, t, getLocale, useOpencodeGo }
  const usageProps = { directory, readUsage, t: usageTranslate, getLocale }
  function Surfaces() {
    // The real Host SlotOutlet subscribes to this same locale revision source.
    React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    return <>
      <OpencodeGoSection {...sectionProps} />
      <UsagePill {...usageProps} />
    </>
  }
  await act(async () => { render(<Surfaces />) })
  return { snapshot: face.hooks.opencodeGo.getSnapshot, readModels, readUsage }
}

function expectCopy(active: 'zh' | 'en'): void {
  const copy = active === 'zh' ? zh : en
  expect(screen.getByText(copy.intro)).toBeTruthy()
  expect(screen.getAllByText(copy.newBadge).length).toBeGreaterThan(0)
  expect(screen.getByText(copy.configurationMissing)).toBeTruthy()
  expect(screen.getByRole('button', { name: copy.modelsRefresh })).toBeTruthy()
  expect(screen.getByText(`Go · ${copy.usageRollingShort} 0% · ${copy.usageWeekShort} 10%`)).toBeTruthy()
}

it.each([
  { language: 'zh-CN', active: 'zh' },
  { language: 'zh-TW', active: 'zh' },
  { language: 'en-US', active: 'en' },
  { language: 'fr-FR', active: 'en' },
] as const)('uses the Host browser-language resolution for $language, displaying $active without saving a preference', async ({ language, active }) => {
  const { locale, host } = createLocale([language])
  expect(locale.getLocale().active).toBe(active)
  await mountSurfaces(locale)
  expectCopy(active)
  expect(host.set).not.toHaveBeenCalled()
  const copy = active === 'zh' ? zh : en
  fireEvent.click(screen.getByRole('button', { name: `${copy.usageTitle}: Go · ${copy.usageRollingShort} 0% · ${copy.usageWeekShort} 10%` }))
  expect(screen.getByRole('dialog', { name: copy.usageTitle })).toBeTruthy()
  expect(screen.getByRole('progressbar', { name: copy.usage_monthly })).toBeTruthy()
  expect(screen.getAllByText(`${copy.usageResets} ${new Date(windowUsage.resetsAt).toLocaleString(active)}`)).toHaveLength(3)
})

it('honors an explicit Host English preference over a Chinese browser', async () => {
  const { locale, host } = createLocale(['zh-CN'], 'en')
  expect(locale.getLocale().active).toBe('en')
  await mountSurfaces(locale)
  expectCopy('en')
  expect(host.set).not.toHaveBeenCalled()
})

it('updates mounted plugin surfaces when the Host locale changes while preserving the form draft and open usage panel', async () => {
  const { locale, host } = createLocale(['zh-CN'])
  const { snapshot, readModels, readUsage } = await mountSurfaces(locale)
  const t = locale.bind(namespace)
  const keyInput = screen.getByLabelText(zh.keyLabel)
  fireEvent.change(keyInput, { target: { value: 'unsaved-fixture-key' } })
  fireEvent.click(screen.getByRole('button', { name: `${zh.usageTitle}: Go · ${zh.usageRollingShort} 0% · ${zh.usageWeekShort} 10%` }))
  expect(snapshot().dirty).toBe(true)

  await act(async () => { locale.setLocale('en') })

  expect(locale.bind(namespace)).toBe(t)
  expectCopy('en')
  expect(screen.getByLabelText(en.keyLabel)).toBe(keyInput)
  expect(keyInput).toHaveProperty('value', 'unsaved-fixture-key')
  expect(snapshot().dirty).toBe(true)
  expect(screen.getByRole('dialog', { name: en.usageTitle })).toBeTruthy()
  expect(screen.getAllByText(`${en.usageResets} ${new Date(windowUsage.resetsAt).toLocaleString('en')}`)).toHaveLength(3)
  expect(host.set).toHaveBeenCalledExactlyOnceWith('preference', 'en')
  expect(readModels).toHaveBeenCalledTimes(1)
  expect(readUsage).toHaveBeenCalledTimes(1)
})
