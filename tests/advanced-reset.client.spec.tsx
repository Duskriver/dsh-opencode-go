// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { OpencodeGoSection } from '../src/client/Section.tsx'
import { OpencodeGoSectionController, type OpencodeGoSettings } from '../src/client/section-controller.ts'
import { en } from '../src/client/locales.ts'
import { acceptSettingsWrites, bindSnapshotSelector, stubSettingsScope } from './support/client.ts'

afterEach(cleanup)

async function mount(user: Partial<OpencodeGoSettings> = {}) {
  const host = stubSettingsScope<OpencodeGoSettings>()
  acceptSettingsWrites(host)
  const base = { proxyURL: '', refreshMinutes: 60, maxImages: 10 }
  host.publish({ status: 'ready', writable: true, value: { ...base, ...user }, base, user })
  const controller = new OpencodeGoSectionController(host.scope, { remote: {
    credentials: { describe: async () => ({ ok: true, value: {} }) },
    llm: { discoverModels: async () => ({ ok: true, value: [] }) },
  } } as never)
  render(<OpencodeGoSection {...controller.inject()} t={key => en[key]}
    useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
  await act(async () => { await Promise.resolve() })
  fireEvent.click(screen.getByText(en.advancedLabel))
  return { host, controller }
}

it.each([{}, { proxyURL: 'http://localhost:7890' }])(
  'resets an invalid proxy draft to its inherited value with user settings %j', async user => {
    const { host, controller } = await mount(user)
    try {
      const proxy = screen.getByLabelText<HTMLInputElement>(en.proxyURLLabel)
      fireEvent.change(proxy, { target: { value: 'not-a-proxy-url' } })
      expect(proxy.getAttribute('aria-invalid')).toBe('true')
      const reset = screen.getByRole<HTMLButtonElement>('button', { name: en.advancedResetAll })
      expect(reset.disabled).toBe(false)
      fireEvent.click(reset)
      expect(proxy.value).toBe('')
      expect(proxy.hasAttribute('aria-invalid')).toBe(false)
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.scope.getSnapshot().user).toEqual({})
      expect(reset.disabled).toBe(true)
    } finally { controller.dispose() }
  },
)

it('resets an invalid numeric draft even when no advanced value is overridden', async () => {
  const { host, controller } = await mount()
  try {
    const count = screen.getByLabelText<HTMLInputElement>(en.maxImagesLabel)
    fireEvent.change(count, { target: { value: '-1' } })
    expect(count.getAttribute('aria-invalid')).toBe('true')
    const reset = screen.getByRole<HTMLButtonElement>('button', { name: en.advancedResetAll })
    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    expect(count.value).toBe('10')
    expect(count.hasAttribute('aria-invalid')).toBe(false)
    expect(reset.disabled).toBe(true)
    expect(host.mutate).not.toHaveBeenCalled()
  } finally { controller.dispose() }
})

it('resets invalid drafts together with saved overrides and permits saving the reset', async () => {
  const { host, controller } = await mount({ refreshMinutes: 15 })
  try {
    const proxy = screen.getByLabelText<HTMLInputElement>(en.proxyURLLabel)
    fireEvent.change(proxy, { target: { value: 'not-a-proxy-url' } })
    fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
    expect(screen.getByLabelText<HTMLInputElement>(en.refreshMinutesLabel).value).toBe('60')
    expect(proxy.value).toBe('')
    expect(proxy.hasAttribute('aria-invalid')).toBe(false)
    expect(screen.getByText<HTMLButtonElement>(en.save).disabled).toBe(false)
    await act(async () => { screen.getByText(en.save).click() })
    expect(host.mutate).toHaveBeenCalledWith([{ op: 'unset', path: ['refreshMinutes'] }], expect.any(Number))
    expect(host.scope.getSnapshot().user).toEqual({})
  } finally { controller.dispose() }
})
