/**
 * The browser-half entry: locale registration, the bound settings scope, the
 * credential invalidation subscription, and the `settings.section`
 * registration for the OpenCode Go page.
 */

import { describe, expect, it, vi } from 'vitest'
import { stubSettingsScope } from './support/client.ts'
import { apply } from '../src/client/index.ts'
import { OpencodeGoSection } from '../src/client/Section.tsx'
import { en } from '../src/client/locales.ts'

interface ClientHarness {
  ctx: Record<string, unknown>
  slotsInject: ReturnType<typeof vi.fn>
  slotsRegister: ReturnType<typeof vi.fn>
  localeRegister: ReturnType<typeof vi.fn>
  credentialListeners: Array<(ref: string) => void>
  emitCredential: (ref: string) => void
  runInjectCallback: () => unknown
}

/** A client root context scripted down to the services the entry reaches. */
function clientHarness(): ClientHarness {
  const scope = stubSettingsScope().scope
  const slotsInject = vi.fn()
  const slotsRegister = vi.fn(() => () => {})
  const localeRegister = vi.fn(() => () => {})
  const credentialListeners: Array<(ref: string) => void> = []
  let injectCallback: (() => unknown) | undefined
  const ctx = {
    inject: vi.fn((services: string[], callback: (child: unknown) => void) => {
      if (services.includes('settingsScope')) callback(ctx)
    }),
    effect: (fn: () => unknown) => {
      fn()
      return () => {}
    },
    locale: {
      register: localeRegister,
      bind: () => (key: string) => en[key as keyof typeof en] ?? key,
    },
    settingsScope: {
      bind: vi.fn((spec: { decode?: (section: unknown) => unknown }) => {
        // Exercise the decoder both ways so the entry's narrowing is covered.
        spec.decode?.({ baseURL: 'https://opencode.ai/zen/go/v1' })
        spec.decode?.('not-an-object')
        return scope
      }),
    },
    remote: {
      $mount: vi.fn(async () => () => {}),
      opencodeGoModels: { read: async () => ({ ok: true, value: [] }) },
      credentials: {
        describe: vi.fn(() => Promise.resolve({ ok: true, value: {} })),
        set: vi.fn(() => Promise.resolve({ ok: true, value: undefined })),
      },
      llm: {
        discoverModels: vi.fn(() => Promise.resolve({ ok: true, value: [] })),
      },
      $on: vi.fn((_key: string, listener: (ref: string) => void) => {
        credentialListeners.push(listener)
        return () => {}
      }),
    },
    slots: {
      inject: (slot: string, callback: () => unknown) => {
        slotsInject(slot)
        injectCallback = callback
      },
      register: slotsRegister,
    },
  }
  return {
    ctx,
    slotsInject,
    slotsRegister,
    localeRegister,
    credentialListeners,
    emitCredential: (ref) => {
      for (const listener of credentialListeners) listener(ref)
    },
    runInjectCallback: () => {
      if (injectCallback === undefined) throw new Error('no inject callback registered')
      return injectCallback()
    },
  }
}

describe('client entry', () => {
  it('registers the copy dictionaries, the scope, and the section slot', () => {
    const harness = clientHarness()

    apply(harness.ctx as never)

    expect(harness.localeRegister).toHaveBeenCalledWith('settings.opencode-go', expect.objectContaining({
      en,
      zh: expect.any(Object) as Record<string, string>,
    }))
    expect(harness.slotsInject).toHaveBeenCalledWith('settings.section')

    harness.runInjectCallback()
    const registration = harness.slotsRegister.mock.calls[0]?.[0] as {
      name: string
      id: string
      label: () => string
      inject: () => { t: (key: string) => string; loadModels: () => void }
    }
    expect(registration).toMatchObject({ name: 'settings.section', id: 'opencode-go' })
    expect(registration.label()).toBe(en.nav)
    expect(registration.inject().t('nav')).toBe(en.nav)
    expect(registration.inject().loadModels).toBeTypeOf('function')
    expect(harness.slotsRegister.mock.calls[0]?.[1]).toBe(OpencodeGoSection)
  })

  it('subscribes to credential invalidations for the page controller', () => {
    const harness = clientHarness()
    apply(harness.ctx as never)

    expect(harness.credentialListeners).toHaveLength(1)
    // The listener delegates to the controller; exercising it must not throw
    // for any reference name.
    harness.emitCredential('OPENCODE_API_KEY')
    harness.emitCredential('SOMEWHERE_ELSE')
  })
})
