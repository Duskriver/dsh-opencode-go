// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OpencodeGoSectionController,
  editableKeys,
  type OpencodeGoSettings,
} from '../src/client/controller.ts'
import { acceptFormWrites, createConfigForm } from './support/client.tsx'

const controllers: OpencodeGoSectionController[] = []
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose() })

function setup(initial: { value?: OpencodeGoSettings; base?: OpencodeGoSettings; user?: OpencodeGoSettings } = {}) {
  const host = createConfigForm<OpencodeGoSettings>()
  acceptFormWrites(host)
  host.publish({ status: 'ready', writable: true, value: initial.value ?? {}, base: initial.base ?? {}, user: initial.user ?? {} })
  const controller = new OpencodeGoSectionController(host.form, {} as never)
  controllers.push(controller)
  const actions = controller.inject()
  return { controller, actions, form: host.form, set: host.set, unset: host.unset, mutate: host.mutate,
    snapshot: actions.hooks.opencodeGo.getSnapshot }
}

describe('appearance theme immediate writes', () => {
  it('defaults to native and applies a classic choice as soon as it changes', async () => {
    const { controller, actions, set, mutate, snapshot } = setup()
    expect(editableKeys).toContain('appearanceTheme')
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'native', overridden: false, invalid: false },
      appliedAppearanceTheme: 'native',
      dirty: false,
    })

    actions.edit('appearanceTheme', 'classic')
    // Appearance has no draft: the choice goes straight through the Host form.
    expect(set).toHaveBeenCalledExactlyOnceWith('appearanceTheme', 'classic')
    await vi.waitFor(() => { expect(snapshot().appliedAppearanceTheme).toBe('classic') })
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'classic', overridden: true, invalid: false },
      appliedAppearanceTheme: 'classic',
      dirty: false,
    })
    expect(mutate).not.toHaveBeenCalled()
    // The single save gesture belongs to Advanced and has nothing to write here.
    await controller.save()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('refuses an unsupported theme without writing or creating a draft', async () => {
    const { controller, actions, set, mutate, snapshot } = setup()
    actions.edit('appearanceTheme', 'high-contrast')
    expect(set).not.toHaveBeenCalled()
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'native', invalid: false },
      appliedAppearanceTheme: 'native',
      writeFailed: 'appearanceTheme',
      dirty: false,
      invalid: false,
    })
    await controller.save()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('applies both supported themes immediately', async () => {
    const { actions, set, snapshot } = setup()
    actions.edit('appearanceTheme', 'classic')
    await vi.waitFor(() => { expect(snapshot().appliedAppearanceTheme).toBe('classic') })
    actions.edit('appearanceTheme', 'native')
    await vi.waitFor(() => { expect(snapshot().appliedAppearanceTheme).toBe('native') })
    expect(set.mock.calls).toEqual([['appearanceTheme', 'classic'], ['appearanceTheme', 'native']])
  })

  it('resets to the inherited theme immediately, without waiting for Save', async () => {
    const { actions, form, unset, mutate, snapshot } = setup({
      value: { appearanceTheme: 'native' },
      base: { appearanceTheme: 'classic' },
      user: { appearanceTheme: 'native' },
    })
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'native', overridden: true },
      appliedAppearanceTheme: 'native',
    })

    actions.resetField('appearanceTheme')
    expect(unset).toHaveBeenCalledExactlyOnceWith('appearanceTheme')
    await vi.waitFor(() => { expect(snapshot().appliedAppearanceTheme).toBe('classic') })
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'classic', overridden: false, invalid: false },
      dirty: false,
    })
    expect(form.getSnapshot().user).toEqual({})
    expect(mutate).not.toHaveBeenCalled()
  })

  it('cannot be reverted by the advanced discard gesture', async () => {
    const { actions, form, snapshot } = setup()
    actions.edit('appearanceTheme', 'classic')
    await vi.waitFor(() => { expect(snapshot().appliedAppearanceTheme).toBe('classic') })
    actions.discard()
    // Discard only drops the advanced draft; an applied theme is already saved.
    expect(snapshot()).toMatchObject({ appliedAppearanceTheme: 'classic', dirty: false })
    expect(form.getSnapshot().value?.appearanceTheme).toBe('classic')
  })
})
