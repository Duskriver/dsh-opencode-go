// @vitest-environment jsdom

/**
 * The browser-half entry: locale registration, the bound settings scope, the
 * credential invalidation subscription, and the `settings.section`
 * registration for the OpenCode Go page.
 */

import { createElement } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector, stubSettingsScope } from './support/client.ts'
import { apply } from '../src/client/index.ts'
import { OpencodeGoSection } from '../src/client/Section.tsx'
import { en } from '../src/client/locales.ts'
import { accountCommands } from '../src/client/host-compat.ts'
import type { OpencodeGoSectionFace } from '../src/client/section-controller.ts'
import type { AnalyticsQuery } from '../src/analytics-contract.ts'

interface ClientHarness {
  ctx: Record<string, unknown>
  slotsInject: ReturnType<typeof vi.fn>
  slotsRegister: ReturnType<typeof vi.fn>
  localeRegister: ReturnType<typeof vi.fn>
  credentialListeners: Array<(ref: string) => void>
  emitCredential: (ref: string) => void
  runInjectCallback: () => unknown
  settings: ReturnType<typeof stubSettingsScope>
  analyticsRead: ReturnType<typeof vi.fn>
  dispose: () => Promise<void>
}

/** A client root context scripted down to the services the entry reaches. */
function clientHarness(settingsService: 'settingsScope' | 'configForms' = 'settingsScope'): ClientHarness {
  const settings = stubSettingsScope()
  const { scope } = settings
  const analyticsRead = vi.fn()
  const effects: unknown[] = []
  const configForms = { get: () => scope }
  const slotsInject = vi.fn()
  const slotsRegister = vi.fn(() => () => {})
  const localeRegister = vi.fn(() => () => {})
  const credentialListeners: Array<(ref: string) => void> = []
  let injectCallback: (() => unknown) | undefined
  const ctx = {
    inject: vi.fn((services: string[], callback: (child: unknown) => void) => {
      if (services.includes(settingsService) || services.includes('remote.opencodeGoAnalytics')) callback(ctx)
    }),
    get: (service: string) => service === 'configForms' ? configForms : undefined,
    effect: (fn: () => unknown) => {
      effects.push(fn())
      return () => {}
    },
    locale: {
      register: localeRegister,
      getLocale: () => ({ active: 'en' }),
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
      opencodeGoModels: { read: async () => ({ ok: true, value: { models: [], stale: false } }) },
      opencodeGoAnalytics: { read: analyticsRead },
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
    settings,
    analyticsRead,
    dispose: async () => {
      for (const effect of effects.splice(0).reverse()) {
        const dispose = await effect
        if (typeof dispose === 'function') dispose()
      }
    },
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
  it.each(['settingsScope', 'configForms'] as const)(
    'cancels superseded and closed settings analytics requests through %s', async settingsService => {
      const harness = clientHarness(settingsService)
      harness.settings.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
      const signals: (AbortSignal | undefined)[] = []
      let cancelled = 0
      harness.analyticsRead.mockImplementation((_query: AnalyticsQuery, signal?: AbortSignal) => {
        signals.push(signal)
        return new Promise(resolve => {
          signal?.addEventListener('abort', () => {
            cancelled++
            resolve({ ok: false, error: Object.assign(new Error('cancelled'), { code: 'gateway/cancelled' }) })
          }, { once: true })
        })
      })
      apply(harness.ctx as never)
      harness.runInjectCallback()
      const registration = harness.slotsRegister.mock.calls[0]?.[0] as {
        inject: () => OpencodeGoSectionFace & { t: (key: keyof typeof en) => string }
      }
      const injected = registration.inject()
      const view = render(createElement(OpencodeGoSection, {
        ...injected, useOpencodeGo: bindSnapshotSelector(injected.hooks.opencodeGo),
      }))
      try {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(en.analyticsCardTitle) }))
        fireEvent.click(screen.getByRole('button', { name: en.analyticsOpenBoard }))
        await waitFor(() => expect(signals).toHaveLength(1))
        expect(signals[0]?.aborted).toBe(false)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d })) })
        await waitFor(() => expect(signals).toHaveLength(2))
        expect(signals[0]?.aborted).toBe(true)
        expect(signals[1]?.aborted).toBe(false)
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsClose })) })
        expect(signals[1]?.aborted).toBe(true)
        expect(cancelled).toBe(2)
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(screen.queryByText(en.analyticsFailed)).toBeNull()
      } finally {
        view.unmount()
        await harness.dispose()
      }
    },
  )

  it('uses the injected account service and releases it when its connection closes', async () => {
    let connect!: (ready: unknown) => void
    let disconnect!: () => void
    const execute = vi.fn(async () => ({ ok: true, value: 'applied' }))
    const command = accountCommands({ inject: (_services: unknown, callback: typeof connect) => { connect = callback } } as never)
    await expect(command({ kind: 'auto-switch', value: true })).resolves.toBe('unknown')
    connect({ remote: { opencodeGoAccounts: { execute } }, effect: (install: () => () => void) => { disconnect = install() } })
    await expect(command({ kind: 'auto-switch', value: true })).resolves.toBe('applied')
    expect(execute).toHaveBeenCalledWith({ kind: 'auto-switch', value: true })
    disconnect()
    await expect(command({ kind: 'auto-switch', value: false })).resolves.toBe('unknown')
    expect(execute).toHaveBeenCalledTimes(1)
  })

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
      inject: () => { t: (key: string) => string; loadModels: () => void; getLocale: () => string }
    }
    expect(registration).toMatchObject({ name: 'settings.section', id: 'opencode-go' })
    expect(registration.label()).toBe(en.nav)
    expect(registration.inject().t('nav')).toBe(en.nav)
    expect(registration.inject().getLocale()).toBe('en')
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
