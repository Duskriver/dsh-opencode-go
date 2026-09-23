// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GoModel, GoModelCatalog } from '../src/models-contract.ts'
import { OpencodeGoSection } from '../src/client/Section.tsx'
import { en } from '../src/client/locales.ts'
import { OpencodeGoSectionController, type OpencodeGoSettings } from '../src/client/section-controller.ts'
import { bindSnapshotSelector, stubSettingsScope } from './support/client.ts'

const controllers: OpencodeGoSectionController[] = []
afterEach(() => {
  cleanup()
  for (const controller of controllers.splice(0)) controller.dispose()
})
const t = (key: keyof typeof en, params?: Record<string, unknown>): string =>
  Object.entries(params ?? {}).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), en[key])
const models: readonly GoModel[] = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
  { id: 'old', name: 'Old', deprecated: true },
]

async function mount(options: { value?: OpencodeGoSettings; writable?: boolean; catalog?: GoModelCatalog } = {}) {
  const host = stubSettingsScope<OpencodeGoSettings>()
  host.publish({ status: 'ready', writable: options.writable ?? true, value: options.value ?? {}, base: {}, user: {} })
  host.set.mockImplementation((field: string, value: unknown) => {
    host.publish({
      value: { ...host.scope.getSnapshot().value, [field]: structuredClone(value) },
      user: { ...host.scope.getSnapshot().user as object, [field]: structuredClone(value) },
    })
  })
  const read = vi.fn(async () => ({ ok: true as const, value: options.catalog ?? { models, stale: false } }))
  const controller = new OpencodeGoSectionController(host.scope, { remote: {
    credentials: { describe: async () => ({ ok: true, value: {} }) },
  } } as never, read)
  controllers.push(controller)
  const face = controller.inject()
  render(<OpencodeGoSection {...face} t={t} useOpencodeGo={bindSnapshotSelector(face.hooks.opencodeGo)} />)
  await act(async () => { await Promise.resolve() })
  return { host, read, snapshot: face.hooks.opencodeGo.getSnapshot }
}
const toggle = (name: string): HTMLButtonElement => screen.getByRole('switch', { name: t('modelVisibleLabel', { name }) })
const checked = (name: string) => toggle(name).getAttribute('aria-checked') === 'true'
async function flip(name: string) { await act(async () => { fireEvent.click(toggle(name)) }) }
async function refresh() { await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.modelsRefresh })) }) }

describe('per-model switches through the settings controller and component', () => {
  it('defaults normal models on and deprecated models off, applying each switch immediately', async () => {
    const { host, snapshot } = await mount()
    expect(checked('Alpha')).toBe(true)
    expect(checked('Beta')).toBe(true)
    expect(checked('Old')).toBe(false)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getAllByRole('switch')).toHaveLength(4) // provider + one per model

    await flip('Beta')
    expect(host.set).toHaveBeenLastCalledWith('modelVisibility', { beta: false })
    expect(checked('Beta')).toBe(false)
    expect(within(screen.getByRole('region', { name: en.modelDetails })).getByRole('heading').textContent).toBe('Alpha')
    await flip('Old')
    expect(host.set).toHaveBeenLastCalledWith('modelVisibility', { beta: false, old: true })
    expect(checked('Old')).toBe(true)
    expect(snapshot().dirty).toBe(false)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
  })

  it('preserves unrelated drafts and committed switch values when a write fails', async () => {
    const { host, snapshot } = await mount()
    fireEvent.change(screen.getByLabelText(en.keyLabel), { target: { value: 'unsaved-key' } })
    await flip('Old')
    expect(screen.getByLabelText(en.keyLabel)).toHaveProperty('value', 'unsaved-key')
    expect(snapshot().dirty).toBe(true)
    host.set.mockRejectedValueOnce(new Error('write refused'))
    await flip('Old')
    expect(checked('Old')).toBe(true)
    expect(screen.getByRole('alert').textContent).toBe(en.pickerFailed)
    fireEvent.click(screen.getByRole('button', { name: en.discard }))
    expect(checked('Old')).toBe(true)
  })

  it('preserves absent overrides and applies defaults to newly discovered models', async () => {
    const { host, read } = await mount({ value: { modelVisibility: { missing: false, old: true } } })
    await flip('Beta')
    read.mockResolvedValueOnce({ ok: true, value: { models: [...models, { id: 'new', name: 'New' }, { id: 'older', name: 'Older', deprecated: true }], stale: false } })
    await refresh()
    expect(checked('New')).toBe(true)
    expect(checked('Older')).toBe(false)
    expect(checked('Old')).toBe(true)
    expect(checked('Beta')).toBe(false)
    expect(host.scope.getSnapshot().value?.modelVisibility).toEqual({ missing: false, old: true, beta: false })
  })

  it('disables switches while a write is pending and for a read-only profile', async () => {
    const { host } = await mount()
    let finish!: () => void
    host.set.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    fireEvent.change(screen.getByLabelText(en.keyLabel), { target: { value: 'draft' } })
    fireEvent.click(toggle('Alpha'))
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('switch', { name: en.enabledLabel }).disabled).toBe(true)
    expect(toggle('Alpha').disabled).toBe(true)
    expect(toggle('Old').disabled).toBe(true)
    await act(async () => { finish() })
    expect(checked('Alpha')).toBe(true) // unacknowledged write did not change the switch
    expect(screen.getByRole('alert').textContent).toBe(en.pickerFailed)
    await act(async () => { host.publish({ writable: false }) })
    expect(toggle('Beta').disabled).toBe(true)
  })

  it('keeps the catalog and switches visible during refresh and after a transport failure', async () => {
    const { read, snapshot } = await mount()
    let reject!: (error: Error) => void
    read.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    fireEvent.click(screen.getByRole('button', { name: en.modelsRefresh }))
    expect(snapshot().models).toMatchObject({ status: 'ready', refreshing: true })
    expect(screen.getByText(en.modelsRefreshing)).toBeTruthy()
    expect(toggle('Beta').disabled).toBe(false)
    await act(async () => { reject(new Error('request timed out')) })
    expect(snapshot().models).toMatchObject({ status: 'ready', stale: true, count: 3, message: 'request timed out' })
    expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
    expect(checked('Beta')).toBe(true)
    await flip('Old')
    expect(checked('Old')).toBe(true)
    await refresh()
    expect(screen.queryByText(en.modelsStale)).toBeNull()
  })

  it('shows the Host cached list on first opening after a timeout and clears it on a confirmed empty catalog', async () => {
    const { read } = await mount({ catalog: { models, stale: true, error: 'request timed out' } })
    expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
    expect(checked('Alpha')).toBe(true)
    expect(screen.getByText('request timed out')).toBeTruthy()
    read.mockResolvedValueOnce({ ok: true, value: { models: [], stale: false } })
    await refresh()
    expect(screen.getByText(en.modelsEmpty)).toBeTruthy()
    expect(screen.queryByRole('switch', { name: t('modelVisibleLabel', { name: 'Alpha' }) })).toBeNull()
  })
  it('drops the previous gateway cache when the endpoint changes, including late responses', async () => {
    const { host, read, snapshot } = await mount()
    let finishOld!: (value: { ok: true; value: GoModelCatalog }) => void
    read.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    fireEvent.click(screen.getByRole('button', { name: en.modelsRefresh }))
    read.mockResolvedValueOnce({ ok: true, value: { models: [], stale: true, error: 'new gateway unavailable' } })
    await act(async () => { host.publish({ value: { baseURL: 'https://new-gateway.invalid/v1' } }) })
    expect(snapshot().models).toEqual({ status: 'failed', message: 'new gateway unavailable' })
    await act(async () => { finishOld({ ok: true, value: { models, stale: false } }) })
    expect(snapshot().models.status).toBe('failed')
    expect(screen.queryByRole('switch', { name: t('modelVisibleLabel', { name: 'Alpha' }) })).toBeNull()
  })

  it('marks missing configuration and prevents enabling it even with a saved true override', async () => {
    const missing = { id: 'missing-model', name: 'missing-model', configurationMissing: true }
    const { host, read } = await mount({
      value: { modelVisibility: { 'missing-model': true } },
      catalog: { models: [missing], stale: false },
    })
    expect(toggle('missing-model').disabled).toBe(true)
    expect(checked('missing-model')).toBe(false)
    expect(screen.getAllByText('Configuration missing').length).toBeGreaterThan(0)
    const details = screen.getByRole('region', { name: en.modelDetails })
    expect(within(details).getByRole('heading').textContent).toBe('missing-model')
    expect(within(details).queryByRole('spinbutton')).toBeNull()
    await flip('missing-model')
    expect(host.set).not.toHaveBeenCalled()

    read.mockResolvedValueOnce({ ok: true, value: { models: [{ id: 'missing-model', name: 'Ready model', contextWindow: 100000, maxTokens: 4096 }], stale: false } })
    await refresh()
    expect(toggle('Ready model').disabled).toBe(false)
    expect(checked('Ready model')).toBe(true)
    expect(screen.queryByText('Configuration missing')).toBeNull()
  })

})
