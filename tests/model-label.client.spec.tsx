// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { apply } from '../src/client/index.ts'
import { ModelLabel, type ModelLabelProps } from '../src/client/ModelLabel.tsx'
import { createSharedModelCatalog } from '../src/client/model-catalog-store.ts'
import { resolveModelMultiplierBadge } from '../src/client/quota-badge.ts'
import { resolveModelCatalogBadge } from '../src/model-badge.ts'
import { en as enCopy, zh as zhCopy } from '../src/client/presentation.ts'
import { createConfigForm, translator } from './support/client.tsx'
import { FREE_PROVIDER_ID, PROVIDER_ID, type GoModel, type GoModelCatalog } from '../src/contracts.ts'
import type { OpencodeGoSettings } from '../src/client/controller.ts'

const LABEL_SLOT = 'conversation.input.model.label'

/** One picker row's model as DSH 0.2.2+ hands it over: the catalog entry plus the badge its provider published. */
type PickerModel = ModelLabelProps['model'] & { badge?: unknown }

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

  function harness(options: {
    initial?: OpencodeGoSettings
    models?: GoModel[]
    failRegister?: boolean
    failPriorities?: number[]
    loggerWarn?: ReturnType<typeof vi.fn>
    /** Real slot ledger: label registrations land in it (this plugin as registrant) instead of a bare mock. */
    ledger?: SlotCore
  } = {}) {
    const settings = createConfigForm<OpencodeGoSettings>({
      enabled: true,
      showModelMultiplier: true,
      apiKeyEnv: 'ACCOUNT_A',
      accounts: [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A', plan: 'go' }],
      ...(options.initial ?? {}),
    })
    const effects: unknown[] = []
    const slotsRegister = vi.fn((opts: Record<string, unknown>, component: unknown) => {
      if (opts.name === LABEL_SLOT) {
        const priority = typeof opts.priority === 'number' ? opts.priority : 0
        if (options.failPriorities?.includes(priority)) {
          throw new Error(
            `single slot "${LABEL_SLOT}" already has a registration at priority ${priority} — register at a different priority to shadow it (lowest renders)`,
          )
        }
        if (options.failRegister) {
          throw new Error('single slot occupied')
        }
        if (options.ledger) {
          const dispose = options.ledger.register({ ...opts, registrant: 'dsh-opencode-go' } as never, component as never)
          registrations.push({ opts, component, dispose: vi.fn(dispose as () => void) })
          return dispose
        }
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
      ...(options.loggerWarn ? { logger: { warn: options.loggerWarn } } : {}),
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

  const enabledSettings: OpencodeGoSettings = {
    enabled: true,
    showModelMultiplier: true,
    apiKeyEnv: 'ACCOUNT_A',
    accounts: [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A', plan: 'go' }],
  }

  it('publishes on the catalog exactly what its own label draws', () => {
    const toneOf = { free: 'success', normal: 'neutral', peak: 'warning' } as const
    const moments = [Date.parse('2026-11-16T00:59:30Z'), Date.parse('2026-11-16T02:00:00Z'), Date.parse('2026-11-22T12:00:00Z')]
    for (const model of [deepseekPro, deepseekFlash, goFree, unpriced]) {
      for (const plan of ['go', 'go-plus', 'go-teams'] as const) {
        for (const nowMs of moments) {
          const live = resolveModelMultiplierBadge({ model, plan, t, locale: 'en', nowMs })
          expect(resolveModelCatalogBadge({ model, plan, nowMs })).toEqual(live === undefined ? undefined : {
            tone: toneOf[live.tone],
            text: live.kind === 'free' ? { en: enCopy.modelMultiplierFreeBadge, zh: zhCopy.modelMultiplierFreeBadge } : live.text,
          })
        }
      }
    }
    expect([enCopy.modelMultiplierFreeBadge, zhCopy.modelMultiplierFreeBadge]).toEqual(['Free', '免费'])
  })

  it('reproduces another provider catalog badge while it holds the slot, in the host order, and never throws on a malformed one', async () => {
    const read = vi.fn()
    const catalog = createSharedModelCatalog(read as never)
    const host = createConfigForm<OpencodeGoSettings>(enabledSettings)
    const other = { id: 'deepseek', name: 'DeepSeek' }
    let locale = 'en'
    const literal: PickerModel = { id: 'flash', name: 'DeepSeek V4.1 Flash', badge: { text: 'New', tone: 'info' } }
    const localized: PickerModel = { id: 'tier', name: 'Free Tier', badge: { text: { en: 'Free', zh: '免费' }, tone: 'success' } }
    const oddTone: PickerModel = { id: 'odd-tone', name: 'Odd Tone', badge: { text: 'New', tone: 'sparkle' } }
    const plain: PickerModel = { id: 'plain', name: 'Plain Model' }
    const malformed: Array<[id: string, badge: unknown]> = [
      ['null', null], ['number', 42], ['string', 'New'], ['array', ['New']], ['empty', {}],
      ['numeric-text', { text: 42 }], ['no-english', { text: { zh: '仅中文' } }], ['blank', { text: '   ' }], ['list-text', { text: ['New'] }],
    ]
    const cell = (model: PickerModel, placement: 'trigger' | 'option' = 'option') => (
      <span key={`${model.id}:${placement}`} data-testid={`row:${model.id}:${placement}`}>
        <ModelLabel provider={other} model={model as ModelLabelProps['model']} placement={placement} selected={false}
          settings={host.form} catalog={catalog} t={t} getLocale={() => locale} />
      </span>
    )
    const tree = () => (
      <>
        {cell(literal)}
        {cell(literal, 'trigger')}
        {cell(localized)}
        {cell(oddTone)}
        {cell(plain)}
        {malformed.map(([id, badge]) => cell({ id, name: `Model ${id}`, badge }))}
      </>
    )
    // Every element the label holds, in DOM order, as [text, tone]; a bare name holds none.
    const parts = (id: string, placement: 'trigger' | 'option' = 'option') =>
      [...(screen.getByTestId(`row:${id}:${placement}`).firstElementChild?.children ?? [])]
        .map(node => [node.textContent, (node as HTMLElement).dataset.tone])

    let view!: ReturnType<typeof render>
    await act(async () => { view = render(tree()) })

    // The host's own order: the badge follows the name in a menu row and leads in the composer trigger.
    expect(parts('flash')).toEqual([['DeepSeek V4.1 Flash', undefined], ['New', 'info']])
    expect(parts('flash', 'trigger')).toEqual([['New', 'info'], ['DeepSeek V4.1 Flash', undefined]])
    // A tone the host does not know draws as a plain fact.
    expect(parts('odd-tone')).toEqual([['Odd Tone', undefined], ['New', 'neutral']])

    // A translation table is read for the active locale, then its base tag, then the required `en`.
    for (const [active, text] of [['en', 'Free'], ['zh-CN', '免费'], ['pt-BR', 'Free']] as const) {
      locale = active
      await act(async () => { view.rerender(tree()) })
      expect(screen.getByTestId('row:tier:option').textContent).toBe(`Free Tier${text}`)
    }

    // A row without a badge, or with one that says nothing readable, is the bare name.
    expect(screen.getByTestId('row:plain:option').textContent).toBe('Plain Model')
    for (const [id] of malformed) {
      expect(screen.getByTestId(`row:${id}:option`).textContent).toBe(`Model ${id}`)
    }
    for (const id of ['plain', ...malformed.map(([id]) => id)]) {
      expect(screen.getByTestId(`row:${id}:option`).children).toHaveLength(0)
    }
    // Another provider's row never reaches for this plugin's own catalog.
    expect(read).not.toHaveBeenCalled()
  })

  it('shows a Go row the badge published on the catalog until its live catalog answers', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-11-16T00:59:30Z')) // Monday 00:59:30 UTC (off-peak)
    const answer = Promise.withResolvers<GoModelCatalog>()
    const read = vi.fn(() => answer.promise)
    const catalog = createSharedModelCatalog(read)
    const host = createConfigForm<OpencodeGoSettings>(enabledSettings)
    const provider = { id: PROVIDER_ID, name: 'DSH OpenCode Go' }
    const published: PickerModel = { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', badge: { text: '8.40×', tone: 'neutral' } }
    const cell = (placement: 'trigger' | 'option') => (
      <span data-testid={`row:go:${placement}`}>
        <ModelLabel provider={provider} model={published as ModelLabelProps['model']} placement={placement}
          settings={host.form} catalog={catalog} t={t} />
      </span>
    )
    await act(async () => { render(<>{cell('option')}{cell('trigger')}</>) })

    // The row says what this plugin published, whoever ends up drawing it; the composer trigger keeps its plain name.
    expect(screen.getByTestId('row:go:option').textContent).toBe('DeepSeek V4 Pro8.40×')
    expect(screen.getByTestId('row:go:trigger').textContent).toBe('DeepSeek V4 Pro')

    // The live answer replaces the published capsule with the plugin's own label.
    answer.resolve({ models: [deepseekPro], stale: false })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('8.40×').getAttribute('data-tone')).toBe('normal')
    expect(screen.getByTestId('row:go:trigger').textContent).toBe('DeepSeek V4 Pro')
  })

  it('yields the single label slot to a lower-priority registrant silently, and is next in line once that one leaves', async () => {
    const ledger = new SlotCore()
    const Empty = () => null
    // The shape ui-model-selection registers: the label is a `single` child of the composer model seat.
    ledger.register({ name: 'root', children: { 'conversation.input.model': { kind: 'single', scope: 'session' } } }, Empty)
    ledger.register({ name: 'conversation.input.model', children: { [LABEL_SLOT]: { kind: 'single', scope: 'session', inline: true } } }, Empty)
    const leave = ledger.register({ name: LABEL_SLOT, priority: -105, registrant: 'other-connector' }, Empty)
    const warn = vi.fn()
    const h = harness({ ledger, loggerWarn: warn })
    try {
      expect(() => apply(h.ctx as never)).not.toThrow()
      const registered = () => ledger.entries(LABEL_SLOT).map(entry => [entry.registrant, entry.options.priority])
      const rendering = () => ledger.entriesOfSlot(LABEL_SLOT).map(entry => entry.registrant)
      // Only the lowest priority renders. This plugin's yielding 137 stays registered behind it, and nothing is logged.
      expect(registered()).toEqual([['other-connector', -105], ['dsh-opencode-go', 137]])
      expect(rendering()).toEqual(['other-connector'])
      expect(warn).not.toHaveBeenCalled()
      // The registration is live, not merely accepted: it takes over as soon as the slot is free.
      leave()
      expect(rendering()).toEqual(['dsh-opencode-go'])
    } finally {
      await h.dispose()
    }
    expect(ledger.entries(LABEL_SLOT)).toHaveLength(0)
  })

  it('registers conversation.input.model.label at yielding priority, disposes when toggled off, backs off on collision, and warns on failure', async () => {
    const h = harness()
    try {
      apply(h.ctx as never)
      const reg = h.registrations.find(entry => entry.opts.name === 'conversation.input.model.label')
      expect(reg).toBeTruthy()
      expect(reg?.opts.priority).toBe(137)
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

    // Priority collision backs off to the next yielding priority and logs a warning.
    const backoffWarn = vi.fn()
    const backedOff = harness({ failPriorities: [137], loggerWarn: backoffWarn })
    try {
      expect(() => apply(backedOff.ctx as never)).not.toThrow()
      const reg = backedOff.registrations.find(entry => entry.opts.name === 'conversation.input.model.label')
      expect(reg?.opts.priority).toBe(138)
      expect(backoffWarn).toHaveBeenCalledWith(
        expect.stringContaining('registered at yielding priority 138'),
      )
    } finally {
      await backedOff.dispose()
    }

    // Exhausted priority collisions still keep settings mounted and emit a warning.
    const exhaustedWarn = vi.fn()
    const exhausted = harness({
      failPriorities: [137, 138, 139, 140, 141, 142, 143, 144],
      loggerWarn: exhaustedWarn,
    })
    try {
      expect(() => apply(exhausted.ctx as never)).not.toThrow()
      expect(exhausted.registrations.some(entry => entry.opts.name === 'conversation.input.model.label')).toBe(false)
      expect(exhausted.registrations.some(entry => entry.opts.name === 'settings.section')).toBe(true)
      expect(exhaustedWarn).toHaveBeenCalledWith(
        expect.stringContaining('model multiplier badge disabled'),
        expect.any(Error),
      )
    } finally {
      await exhausted.dispose()
    }

    // Non-collision failure is absorbed without breaking plugin mount and falls back to console.warn.
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const colliding = harness({ failRegister: true })
    try {
      expect(() => apply(colliding.ctx as never)).not.toThrow()
      expect(colliding.registrations.some(entry => entry.opts.name === 'settings.section')).toBe(true)
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('model multiplier badge disabled'),
        expect.any(Error),
      )
    } finally {
      await colliding.dispose()
    }
  })
})
