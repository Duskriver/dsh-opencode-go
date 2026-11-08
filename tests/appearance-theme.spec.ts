import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  OpencodeGoSectionController,
  editableKeys,
  type OpencodeGoSettings,
} from '../src/client/controller.ts'

type FormSnapshot = ConfigFormSnapshot<OpencodeGoSettings>

const controllers: OpencodeGoSectionController[] = []
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose() })

function setup(initial: { value?: OpencodeGoSettings; base?: OpencodeGoSettings; user?: OpencodeGoSettings } = {}) {
  let snapshot: FormSnapshot = {
    status: 'ready',
    value: initial.value ?? {},
    base: initial.base ?? {},
    user: initial.user ?? {},
    revision: 0,
    writable: true,
  }
  const listeners = new Set<() => void>()
  const publish = (next: Partial<FormSnapshot>): void => {
    snapshot = { ...snapshot, ...next }
    for (const listener of listeners) listener()
  }
  const mutate = vi.fn(async (ops: readonly SettingsPathOpView[], revision?: number): Promise<boolean> => {
    if (!snapshot.writable || revision !== undefined && revision !== snapshot.revision) return false
    const value = { ...snapshot.value } as Record<string, unknown>
    const user = { ...snapshot.user } as Record<string, unknown>
    for (const op of ops) {
      const field = op.path[0]!
      if (op.path.length !== 1) throw new Error('This fixture supports top-level field batches')
      if (op.op === 'set') {
        value[field] = structuredClone(op.value)
        user[field] = structuredClone(op.value)
      } else {
        delete user[field]
        value[field] = (snapshot.base as Record<string, unknown> | undefined)?.[field]
      }
    }
    publish({ value, user, revision: (snapshot.revision ?? 0) + 1 })
    return true
  })
  const form: ConfigForm<OpencodeGoSettings> = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    mutate,
    set: vi.fn<ConfigForm<OpencodeGoSettings>['set']>(),
    unset: vi.fn<ConfigForm<OpencodeGoSettings>['unset']>(),
  }
  const controller = new OpencodeGoSectionController(form, {} as never)
  controllers.push(controller)
  const actions = controller.inject()
  return { controller, actions, form, mutate, snapshot: actions.hooks.opencodeGo.getSnapshot }
}

describe('appearance theme drafts and writes', () => {
  it('defaults to native and applies a classic draft only after it is saved', async () => {
    const { controller, actions, mutate, snapshot } = setup()
    expect(editableKeys).toContain('appearanceTheme')
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'native', overridden: false, invalid: false },
      appliedAppearanceTheme: 'native',
      dirty: false,
    })

    actions.edit('appearanceTheme', 'classic')
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'classic', invalid: false },
      appliedAppearanceTheme: 'native',
      dirty: true,
    })
    await controller.save()
    expect(mutate).toHaveBeenCalledExactlyOnceWith([
      { op: 'set', path: ['appearanceTheme'], value: 'classic' },
    ], 0)
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'classic', invalid: false },
      appliedAppearanceTheme: 'classic',
      dirty: false,
    })

    actions.edit('appearanceTheme', 'native')
    expect(snapshot().appliedAppearanceTheme).toBe('classic')
    actions.discard()
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'classic', invalid: false },
      appliedAppearanceTheme: 'classic',
      dirty: false,
    })
  })

  it('accepts both supported themes and blocks an invalid draft without writing', async () => {
    const { controller, actions, mutate, snapshot } = setup()
    actions.edit('appearanceTheme', 'high-contrast')
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'high-contrast', invalid: true },
      appliedAppearanceTheme: 'native',
      invalid: true,
    })
    await controller.save()
    expect(mutate).not.toHaveBeenCalled()

    actions.edit('appearanceTheme', 'classic')
    await controller.save()
    expect(snapshot().appliedAppearanceTheme).toBe('classic')
    actions.edit('appearanceTheme', 'native')
    await controller.save()
    expect(snapshot().appliedAppearanceTheme).toBe('native')
    expect(mutate).toHaveBeenCalledTimes(2)
  })

  it('previews an inherited reset without switching the applied theme until Save', async () => {
    const { controller, actions, form, mutate, snapshot } = setup({
      value: { appearanceTheme: 'native' },
      base: { appearanceTheme: 'classic' },
      user: { appearanceTheme: 'native' },
    })
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'native', overridden: true },
      appliedAppearanceTheme: 'native',
    })

    actions.resetField('appearanceTheme')
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'classic', overridden: false, invalid: false },
      appliedAppearanceTheme: 'native',
      dirty: true,
    })
    await controller.save()
    expect(mutate).toHaveBeenCalledExactlyOnceWith([{ op: 'unset', path: ['appearanceTheme'] }], 0)
    expect(form.getSnapshot().user).toEqual({})
    expect(snapshot()).toMatchObject({
      appearanceTheme: { text: 'classic', overridden: false, invalid: false },
      appliedAppearanceTheme: 'classic',
      dirty: false,
    })
  })
})
