// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index.ts'
import { ModelLabel } from '../src/client/ModelLabel.tsx'
import { createSharedModelCatalog } from '../src/client/model-catalog-store.ts'
import { en, translator } from './support/client.tsx'
import { createConfigForm } from './support/client.tsx'
import { FREE_PROVIDER_ID, PROVIDER_ID, type GoModel, type GoModelCatalog } from '../src/contracts.ts'
import type { OpencodeGoSettings } from '../src/client/controller.ts'

describe('composer model-label slot and multiplier rendering', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const t = translator('en')

  const deepseekFlash: GoModel = {
    id: 'deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    source: 'go',
    price: { input: 0.27, output: 1.08, cacheRead: 0.027, cacheWrite: 0, multipliers: true },
    goMonthlyUsage: { go: 100, 'go-plus': 200, 'go-teams': 105 },
    pricingMultipliers: [{
      when: { utc_days: { in: ['mon'] }, utc_hours: { gte: '01:00', lt: '04:00' } },
      factor: 2,
    }],
  }

  const deepseekPro: GoModel = {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    source: 'go',
    price: { input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: 0, multipliers: true },
    goMonthlyUsage: { go: 15, 'go-plus': 60, 'go-teams': 20 },
    pricingMultipliers: [{
      when: { utc_days: { in: ['mon'] }, utc_hours: { gte: '01:00', lt: '04:00' } },
      factor: 2,
    }],
  }

  const goFree: GoModel = {
    id: 'beam-free',
    name: 'Beam Free',
    source: 'go',
    price: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }

  const unpriced: GoModel = {
    id: 'unpriced',
    name: 'Unpriced Model',
    source: 'go',
  }

  function harness(options: { initial?: OpencodeGoSettings; models?: GoModel[]; failRegister?: boolean } = {}) {
    const settings = createConfigForm<OpencodeGoSettings>({
      enabled: true,
      showModelMultiplier: true,
      apiKeyEnv: 'ACCOUNT_A',
      accounts: [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A', plan: 'go' }],
      ...(options.initial ?? {}),
    })
    const effects: unknown[] = []
    const slotsRegister = vi.fn((opts: Record<string, unknown>, component: unknown) => {
      if (options.failRegister && opts.name === 'conversation.input.model.label') {
        throw new Error('single slot occupied')
      }
      const dispose = vi.fn()
      registrations.push({ opts, component, dispose })
      return dispose
    })
    const registrations: Array<{ opts: Record<string, unknown>; component: unknown; dispose: ReturnType<typeof vi.fn> }> = []
    const read = vi.fn(async (): Promise<{ ok: true; value: GoModelCatalog }> => ({
      ok: true,
      value: { models: options.models ?? [deepseekFlash, deepseekPro, goFree, unpriced], stale: false },
    }))
    const ctx = {
      configForms: { get: () => settings.form },
      inject: (services: string[], install: (ready: unknown) => void) => {
        if (services.every(path => path.split('.').reduce<unknown>((v, k) => v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined, ctx))) {
          install(ctx)
        }
      },
      effect: (install: () => unknown) => { effects.push(install()); return () => {} },
      locale: { register: () => () => {}, getLocale: () => ({ active: 'en' }), bind: () => (key: string) => key },
      remote: {
        $mount: async () => () => {},
        $on: () => () => {},
        opencodeGoModels: { read },
        opencodeGoAccounts: { execute: async () => ({ ok: true, value: 'applied' }) },
        credentials: { describe: async () => ({ ok: true, value: {} }) },
      },
      slots: {
        inject: (_slot: string, install: () => unknown) => install(),
        register: slotsRegister,
      },
    }
    return {
      ctx,
      settings,
      read,
      slotsRegister,
      registrations,
      dispose: async () => {
        for (const effect of effects.splice(0).reverse()) {
          const cleanupFn = await effect
          if (typeof cleanupFn === 'function') cleanupFn()
        }
      },
    }
  }

  it('renders multiplier badges for Go option rows, deduplicates catalog reads, and preserves plain names elsewhere', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-11-16T00:59:30Z')) // Monday 00:59:30 UTC (off-peak)
    const host = createConfigForm<OpencodeGoSettings>({
      enabled: true,
      showModelMultiplier: true,
      apiKeyEnv: 'ACCOUNT_A',
      accounts: [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A', plan: 'go' }],
    })
    const readModels = vi.fn(async (): Promise<GoModelCatalog> => ({
      models: [deepseekPro, goFree, unpriced],
      stale: false,
    }))
    const catalog = createSharedModelCatalog(readModels)
    const provider = { id: PROVIDER_ID, name: 'DSH OpenCode Go' }
    const freeProvider = { id: FREE_PROVIDER_ID, name: 'DSH OpenCode Free' }
    const otherProvider = { id: 'deepseek', name: 'DeepSeek' }

    await act(async () => {
      render(
        <div>
          <span data-testid="go-option-paid">
            <ModelLabel provider={provider} model={{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }}
              placement="option" selected={false} settings={host.form} catalog={catalog} t={t} />
          </span>
          <span data-testid="go-option-free">
            <ModelLabel provider={provider} model={{ id: 'beam-free', name: 'Beam Free' }}
              placement="option" selected={false} settings={host.form} catalog={catalog} t={t} />
          </span>
          <span data-testid="go-option-unpriced">
            <ModelLabel provider={provider} model={{ id: 'unpriced', name: 'Unpriced Model' }}
              placement="option" selected={false} settings={host.form} catalog={catalog} t={t} />
          </span>
          <span data-testid="go-trigger">
            <ModelLabel provider={provider} model={{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }}
              placement="trigger" selected={true} settings={host.form} catalog={catalog} t={t} />
          </span>
          <span data-testid="go-menu">
            <ModelLabel provider={provider} model={{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }}
              placement="menu" selected={true} settings={host.form} catalog={catalog} t={t} />
          </span>
          <span data-testid="free-option">
            <ModelLabel provider={freeProvider} model={{ id: 'beam-free', name: 'Beam Free' }}
              placement="option" selected={false} settings={host.form} catalog={catalog} t={t} />
          </span>
          <span data-testid="other-option">
            <ModelLabel provider={otherProvider} model={{ id: 'deepseek-chat', name: 'DeepSeek Chat' }}
              placement="option" selected={false} settings={host.form} catalog={catalog} t={t} />
          </span>
        </div>,
      )
      await Promise.resolve()
    })

    // All concurrent option rows share one catalog RPC.
    expect(readModels).toHaveBeenCalledTimes(1)

    // Option row shows multiplier badge; trigger and menu keep plain text only.
    expect(screen.getByText('8.40×').getAttribute('data-tone')).toBe('normal')
    expect(screen.getByText('Free').getAttribute('data-tone')).toBe('free')
    expect(screen.getByTestId('go-trigger').textContent).toBe('DeepSeek V4 Pro')
    expect(screen.getByTestId('go-menu').textContent).toBe('DeepSeek V4 Pro')
    expect(screen.getByTestId('go-option-unpriced').textContent).toBe('Unpriced Model')
    expect(screen.getByTestId('other-option').textContent).toBe('DeepSeek Chat')
    // Free provider option stays plain without a redundant Free badge.
    expect(screen.getByTestId('free-option').textContent).toBe('Beam Free')

    // Crossing UTC 01:00 updates open option rows live to peak multiplier and tone.
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000) })
    const peakBadge = screen.getByText('16.8×')
    expect(peakBadge.getAttribute('data-tone')).toBe('peak')

    // Switching active account to Go Plus recalculates live without extra catalog RPCs.
    await act(async () => {
      host.publish({
        value: {
          enabled: true,
          showModelMultiplier: true,
          apiKeyEnv: 'ACCOUNT_A',
          accounts: [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A', plan: 'go-plus' }],
        },
      })
    })
    expect(screen.getByText('4.20×')).toBeTruthy()
    expect(readModels).toHaveBeenCalledTimes(1)

    // Changing endpoint invalidates the cache and triggers one fresh read.
    await act(async () => {
      host.publish({
        value: {
          enabled: true,
          showModelMultiplier: true,
          baseURL: 'https://gateway.example/v1',
          apiKeyEnv: 'ACCOUNT_A',
          accounts: [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A', plan: 'go' }],
        },
      })
      await Promise.resolve()
    })
    expect(readModels).toHaveBeenCalledTimes(2)
  })

  it('registers conversation.input.model.label at yielding priority, disposes when toggled off, and survives collisions', async () => {
    const h = harness()
    try {
      apply(h.ctx as never)
      const reg = h.registrations.find(entry => entry.opts.name === 'conversation.input.model.label')
      expect(reg).toBeTruthy()
      expect(reg?.opts.priority).toBe(100)
      expect(reg?.component).toBe(ModelLabel)

      // Turning showModelMultiplier off disposes the slot registration immediately.
      h.settings.publish({ value: { enabled: true, showModelMultiplier: false } })
      expect(reg?.dispose).toHaveBeenCalledOnce()

      // Turning it back on re-registers the slot.
      h.settings.publish({ value: { enabled: true, showModelMultiplier: true } })
      expect(h.registrations.filter(entry => entry.opts.name === 'conversation.input.model.label')).toHaveLength(2)
    } finally {
      await h.dispose()
    }

    // Slot collision at the same priority is absorbed gracefully without breaking plugin mount.
    const colliding = harness({ failRegister: true })
    try {
      expect(() => apply(colliding.ctx as never)).not.toThrow()
      expect(colliding.registrations.some(entry => entry.opts.name === 'settings.section')).toBe(true)
    } finally {
      await colliding.dispose()
    }
  })
})
