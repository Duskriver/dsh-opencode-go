// @vitest-environment jsdom
import { apply, accountCommands, inject as clientInject } from '../src/client/index.ts'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { bindSnapshotSelector, createConfigForm, acceptFormWrites, defaultClientSettings, translator } from './support/client.tsx'
import * as store from '@deepseek-ai/dsh-client-store'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { OpencodeGoSection, type OpencodeGoSectionProps, type OpencodeGoSectionState } from '../src/client/Section.tsx'
import {
  NUMERIC_FIELD_LIMITS,
  OpencodeGoSectionController,
  editableKeys,
  type OpencodeGoSettings,
  type TextField,
} from '../src/client/controller.ts'
import { en, zh, type OpencodeGoKey } from '../src/client/presentation.ts'
import { MAX_THINKING_BUDGET_TOKENS, type AnalyticsQuery } from '../src/contracts.ts'
import { createAnalyticsReport } from './support/analytics.ts'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { Context } from '@deepseek-ai/cordis'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type { LocaleRuntime as HostLocaleRuntime, LocaleSettings } from '@deepseek-ai/dsh-client-locale/client'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { UsagePill, SidebarQuota, type UsagePillProps, type SidebarQuotaProps } from '../src/client/UsagePill.tsx'

describe("settings page and typed capacity editing", () => {

  const t = (key: keyof typeof en, params?: Record<string, unknown>): string =>
    Object.entries(params ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      en[key],
    )

  function field(text: string, rest: Partial<OpencodeGoSectionState['baseURL']> = {}): OpencodeGoSectionState['baseURL'] {
    return { text, overridden: false, invalid: false, ...rest }
  }

  type SectionField = 'baseURL' | 'freeBaseURL' | 'proxyURL' | 'refreshMinutes' | 'streamIdleTimeoutMs'
    | 'requestPreparationTimeoutMs' | 'requestTimeoutMs'
    | 'usageDisplay' | 'usagePillStyle' | 'appearanceTheme' | 'showSidebarQuota' | 'freeEnabled'
    | 'maxImages'
    | 'maxRequestImageBytes' | 'requestImagePixelBudget' | 'requestImageMaxBytes' | 'models'
    | 'modelLimits' | 'modelLimitDraft'

  const settled: Omit<OpencodeGoSectionState, SectionField> = {
    status: 'ready',
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    enabled: true,
    appliedAppearanceTheme: 'native',
    modelVisibility: {},
    pickerSaving: false,
    pickerFailed: false,
    enabledFailed: false,
    accounts: { entries: [], activeRef: 'OPENCODE_API_KEY', autoSwitch: false, busy: false, blocked: false, refreshing: false },
  }

  type ModelEntry = import('../src/contracts.ts').GoModel

  function listing(entries: readonly ModelEntry[]) {
    return {
      status: 'ready' as const,
      count: entries.length,
      preview: entries.map(entry => entry.name ?? entry.id),
      entries,
    }
  }

  function stateOf(overrides: Partial<OpencodeGoSectionState> = {}): OpencodeGoSectionState {
    return {
      ...settled,
      usageDisplay: field('auto'),
      usagePillStyle: field('badge'),
      appearanceTheme: field('native'),
      showSidebarQuota: field('false'),
      freeEnabled: field('false'),
      freeBaseURL: field('https://opencode.ai/inference/v1'),
      baseURL: field('https://opencode.ai/zen/go/v1'),
      proxyURL: field(''),
      refreshMinutes: field('60'),
      streamIdleTimeoutMs: field('300000'),
      requestPreparationTimeoutMs: field('60000'),
      requestTimeoutMs: field('1800000'),
      maxImages: field(''),
      maxRequestImageBytes: field('20971520'),
      requestImagePixelBudget: field('4194304'),
      requestImageMaxBytes: field('1048576'),
      modelLimits: { overridden: false, invalid: false },
      modelLimitDraft: {},
      models: { status: 'idle' },
      ...overrides,
    }
  }

  function actions() {
    return {
      edit: vi.fn(),
      editModelLimits: vi.fn(),
      loadAccounts: vi.fn(),
      addAccount: vi.fn(async () => true),
      renameAccount: vi.fn(async () => true),
      removeAccount: vi.fn(async () => true),
      selectAccount: vi.fn(async () => true),
      setAutoSwitch: vi.fn(async () => true),
      replaceAccountKey: vi.fn(async () => true),
      moveAccount: vi.fn(async () => true),
      resetField: vi.fn(),
      save: vi.fn(),
      discard: vi.fn(),
      loadModels: vi.fn(),
      setEnabled: vi.fn(),
      setModelEnabled: vi.fn(),
    }
  }

  function renderSection(
    state: OpencodeGoSectionState,
    overrides: Partial<ReturnType<typeof actions>> = {},
    options: { foldedModels?: boolean; locale?: 'en' | 'zh' } = {},
  ) {
    const store = createSnapshotStore(state)
    const props = {
      ...actions(),
      ...overrides,
      t: options.locale ? translator(options.locale) : t,
      getLocale: () => options.locale === 'zh' ? 'zh-CN' : 'en-US',
      useOpencodeGo: bindSnapshotSelector(store),
    } as unknown as OpencodeGoSectionProps
    render(<OpencodeGoSection {...props} />)
    // The page ships with the model card folded; most of these tests are about what
    // is inside it, so they open it the way a reader would.
    if (options.foldedModels !== true) openModelLimits()
    return store
  }

  type SettingsTabId = 'overview' | 'models' | 'appearance' | 'advanced'

  /** Select a settings tab by id so the helper works in either locale. */
  function selectTab(tab: SettingsTabId): void {
    const button = document.getElementById(`opencode-go-tab-${tab}`)
    if (button !== null) fireEvent.click(button)
  }

  /** Tuning fields live in the advanced tab. */
  function openAdvanced(): void {
    selectTab('advanced')
  }

  /** Model list and capacities live in the models tab. */
  function openModelLimits(): void {
    // Nothing is served in the unavailable posture, and then there is no tab strip.
    const trigger = document.getElementById('opencode-go-tab-models')
    if (trigger !== null) fireEvent.click(trigger)
  }

  describe('OpencodeGoSection', () => {
    it('keeps appearance on its own tab and stages all three edits', () => {
      const reading = actions()
      renderSection(stateOf(), reading, { foldedModels: true })
      expect(screen.queryByRole('switch', { name: en.showSidebarQuotaLabel })).toBeNull()
      expect(screen.queryByRole('radiogroup', { name: en.appearanceThemeLabel })).toBeNull()
      expect(screen.queryByRole('radiogroup', { name: en.usagePillStyleLabel })).toBeNull()
      selectTab('appearance')
      const panel = document.getElementById('opencode-go-panel-appearance') as HTMLElement
      expect(panel.textContent).toContain(en.usageDisplayLabel)
      const theme = screen.getByRole('radiogroup', { name: en.appearanceThemeLabel })
      expect(panel.contains(theme)).toBe(true)
      expect(within(theme).getByRole<HTMLInputElement>('radio', { name: en.appearanceTheme_native }).checked).toBe(true)
      fireEvent.click(within(theme).getByRole('radio', { name: en.appearanceTheme_classic }))
      expect(reading.edit).toHaveBeenCalledWith('appearanceTheme', 'classic')
      const toggle = screen.getByRole('switch', { name: en.showSidebarQuotaLabel })
      expect(toggle.getAttribute('aria-checked')).toBe('false')
      fireEvent.click(toggle)
      expect(reading.edit).toHaveBeenCalledWith('showSidebarQuota', 'true')
      const group = screen.getByRole('radiogroup', { name: en.usagePillStyleLabel })
      expect(within(group).getByRole<HTMLInputElement>('radio', { name: en.usagePillStyle_badge }).checked).toBe(true)
      fireEvent.click(within(group).getByRole('radio', { name: en.usagePillStyle_plain }))
      expect(reading.edit).toHaveBeenCalledWith('usagePillStyle', 'plain')
      expect(reading.save).not.toHaveBeenCalled()
    })

    it('keeps the applied page theme Native while a Classic draft is only previewed', () => {
      renderSection(stateOf({ appearanceTheme: field('classic'), appliedAppearanceTheme: 'native' }), {}, { foldedModels: true })
      const page = document.querySelector('[style*="--go-bg"]') as HTMLElement
      expect(page.style.getPropertyValue('--go-display-font')).toContain('--dsw-font-family')
      selectTab('appearance')
      const theme = screen.getByRole('radiogroup', { name: en.appearanceThemeLabel })
      expect(within(theme).getByRole<HTMLInputElement>('radio', { name: en.appearanceTheme_classic }).checked).toBe(true)
      const previews = within(theme).getAllByText(`${en.usageRollingShort} 24% · ${en.usageWeekShort} 48%`)
      expect(previews.some(sample => sample.parentElement?.style.getPropertyValue('--go-display-font').includes('Anthropic Serif'))).toBe(true)
      expect(page.style.getPropertyValue('--go-display-font')).toContain('--dsw-font-family')
    })

    it('disables appearance changes for read-only settings and resets saved appearance overrides', () => {
      const reading = actions()
      const state = stateOf({ appearanceTheme: field('classic', { overridden: true }), showSidebarQuota: field('true', { overridden: true }), usagePillStyle: field('plain', { overridden: true }) })
      const store = renderSection(state, reading)
      selectTab('appearance')
      fireEvent.click(screen.getByRole('button', { name: en.usageAppearanceReset }))
      expect(reading.resetField.mock.calls).toEqual([['appearanceTheme'], ['showSidebarQuota'], ['usagePillStyle']])
      act(() => { store.set({ ...state, writable: false }) })
      expect(screen.getByRole<HTMLButtonElement>('switch', { name: en.showSidebarQuotaLabel }).disabled).toBe(true)
      for (const radio of within(screen.getByRole('radiogroup', { name: en.appearanceThemeLabel })).getAllByRole<HTMLInputElement>('radio')) {
        expect(radio.disabled).toBe(true)
      }
      for (const radio of within(screen.getByRole('radiogroup', { name: en.usagePillStyleLabel })).getAllByRole<HTMLInputElement>('radio')) {
        expect(radio.disabled).toBe(true)
      }
    })

    it.each((['en', 'zh'] as const).flatMap(locale => [384_000, 65_536, 32_768, undefined].map(maxTokens => ({ locale, maxTokens }))))(
      'shows the effective output default and catalog maximum in $locale for $maxTokens tokens', ({ locale, maxTokens }) => {
        const translate = translator(locale)
        renderSection(stateOf({ models: listing([{ id: 'capacity', name: 'Capacity', contextWindow: 1_000_000, maxTokens }]) }), {}, { locale })
        const output = screen.getByRole<HTMLInputElement>('spinbutton', { name: translate('limitsOutputLabel', { name: 'Capacity' }) })
        expect(output.value).toBe('')
        expect(output.placeholder).toBe(maxTokens === undefined ? translate('capacityMissing') : String(Math.min(maxTokens, 65_536)))
        expect(output.getAttribute('max')).toBe(maxTokens === undefined ? null : String(maxTokens))
        const hint = document.getElementById(output.getAttribute('aria-describedby')!)!.textContent
        const expected = maxTokens !== undefined && maxTokens > 65_536
          ? locale === 'zh' ? '默认：65,536 tokens（模型上限：384,000 tokens）' : 'Default: 65,536 tokens (catalog max: 384,000 tokens)'
          : translate('capacityDefault', { value: maxTokens?.toLocaleString(locale) ?? translate('capacityMissing') })
        expect(hint).toBe(expected)
        const context = screen.getByRole<HTMLInputElement>('spinbutton', { name: translate('limitsContextLabel', { name: 'Capacity' }) })
        expect(context.placeholder).toBe('1000000')
        expect(document.getElementById(context.getAttribute('aria-describedby')!)?.textContent)
          .toBe(translate('capacityDefault', { value: (1_000_000).toLocaleString(locale) }))
      },
    )

    it('keeps an explicit max output override and a two-column model row with its override indicator', () => {
      renderSection(stateOf({ models: listing([{ id: 'wide', name: 'A very long model name', maxTokens: 384_000 }]),
        modelLimitDraft: { wide: { maxTokens: 98_304 } } }))
      const output = screen.getByRole<HTMLInputElement>('spinbutton', { name: t('limitsOutputLabel', { name: 'A very long model name' }) })
      expect(output.value).toBe('98304')
      expect(output.placeholder).toBe('65536')
      const choose = screen.getByRole('button', { name: 'A very long model name' })
      expect(choose.querySelector('[title="' + en.overridden + '"]')).toBeTruthy()
      expect(Array.from(choose.parentElement!.children).map(child => child.getAttribute('role'))).toEqual([null, 'switch'])
      expect(screen.getByRole('tabpanel', { name: en.settingsTabModels }).contains(choose)).toBe(true)
    })

    it('stages the independent Free gateway URL in advanced settings and offers reset', () => {
      const reading = actions()
      renderSection(stateOf({ freeBaseURL: field('https://free.example/v1', { overridden: true }) }), reading)
      openAdvanced()
      const input = screen.getByRole('textbox', { name: en.freeBaseURLLabel })
      expect((input as HTMLInputElement).value).toBe('https://free.example/v1')
      fireEvent.change(input, { target: { value: 'https://new-free.example/v1' } })
      expect(reading.edit).toHaveBeenCalledWith('freeBaseURL', 'https://new-free.example/v1')
      expect(reading.save).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
      expect(reading.resetField).toHaveBeenCalledWith('freeBaseURL')
      expect(screen.queryByText('DeepSeek V4.1 Flash protocol')).toBeNull()
    })

    it('stages the three usage display modes in advanced settings and offers reset', () => {
      const reading = actions()
      renderSection(stateOf({ usageDisplay: field('always', { overridden: true }) }), reading)
      expect(screen.queryByRole('radiogroup', { name: en.usageDisplayLabel })).toBeNull()
      selectTab('appearance')
      const group = screen.getByRole('radiogroup', { name: en.usageDisplayLabel })
      const choices = within(group).getAllByRole('radio')
      expect(choices.map(choice => choice.textContent))
        .toEqual([en.usageDisplay_auto, en.usageDisplay_always, en.usageDisplay_off])
      expect(choices[1].getAttribute('aria-checked')).toBe('true')
      fireEvent.click(choices[2])
      expect(reading.edit).toHaveBeenCalledWith('usageDisplay', 'off')
      expect(reading.save).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: en.usageAppearanceReset }))
      expect(reading.resetField).toHaveBeenCalledWith('usageDisplay')
    })

    it('disables usage display editing in a read-only deployment', () => {
      renderSection(stateOf({ writable: false }))
      selectTab('appearance')
      const choices = within(screen.getByRole('radiogroup', { name: en.usageDisplayLabel })).getAllByRole('radio')
      expect(choices.every(choice => (choice as HTMLButtonElement).disabled)).toBe(true)
    })

    it('stages the Free channel opt-in from the overview, next to the provider switch', () => {
      const reading = actions()
      renderSection(stateOf({ freeEnabled: field('true', { overridden: true }) }), reading, { foldedModels: true })
      const free = screen.getByRole<HTMLButtonElement>('switch', { name: en.freeEnabledLabel })
      expect(free.getAttribute('aria-checked')).toBe('true')
      expect(free.title).toBe(en.freeEnabledHint)
      fireEvent.click(free)
      expect(reading.edit).toHaveBeenCalledExactlyOnceWith('freeEnabled', 'false')
      expect(reading.save).not.toHaveBeenCalled()

      // The tuning reset no longer owns the Free channel.
      selectTab('advanced')
      fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
      expect(reading.resetField).not.toHaveBeenCalledWith('freeEnabled')
      expect(screen.queryByText(en.groupFree)).toBeNull()
    })

    it('disables the Free channel switch in a read-only deployment', () => {
      renderSection(stateOf({ writable: false }), {}, { foldedModels: true })
      expect(screen.getByRole<HTMLButtonElement>('switch', { name: en.freeEnabledLabel }).disabled).toBe(true)
    })

    it('moves the segmented selection with the arrow keys', () => {
      const reading = actions()
      renderSection(stateOf({ usageDisplay: field('auto') }), reading)
      selectTab('appearance')
      const group = screen.getByRole('radiogroup', { name: en.usageDisplayLabel })
      within(group).getAllByRole('radio')[0].focus()
      fireEvent.keyDown(group, { key: 'ArrowRight' })
      expect(reading.edit).toHaveBeenLastCalledWith('usageDisplay', 'always')
      fireEvent.keyDown(group, { key: 'ArrowLeft' })
      expect(reading.edit).toHaveBeenLastCalledWith('usageDisplay', 'off')
    })

    it('hangs each hint off its field description, not a visible line', () => {
      renderSection(stateOf())
      openAdvanced()
      const input = screen.getByLabelText<HTMLInputElement>(en.baseURLLabel)
      const hint = document.getElementById(input.getAttribute('aria-describedby') ?? '')
      expect(hint?.textContent).toBe(en.baseURLHint)
      // The sentence lives in the description only; the row shows the hint mark.
      expect(screen.getAllByText(en.baseURLHint)).toHaveLength(1)
    })

    it('opens hints with keyboard focus and closes them when focus moves to the field', () => {
      renderSection(stateOf())
      openAdvanced()
      const input = screen.getByLabelText<HTMLInputElement>(en.baseURLLabel)
      const trigger = screen.getByRole<HTMLButtonElement>('button', { name: en.baseURLHint })
      expect(trigger.type).toBe('button')
      expect(trigger.tabIndex).toBe(0)
      expect(trigger.getAttribute('aria-hidden')).not.toBe('true')
      expect(screen.queryByRole('tooltip')).toBeNull()
      act(() => { trigger.focus() })
      expect(document.activeElement).toBe(trigger)
      expect(screen.getByRole('tooltip').textContent).toBe(en.baseURLHint)
      act(() => { input.focus() })
      expect(screen.queryByRole('tooltip')).toBeNull()
      expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe(en.baseURLHint)
    })

    it('keeps quota display above the appearance controls and out of the advanced tab', () => {
      renderSection(stateOf())
      selectTab('appearance')
      const appearance = document.getElementById('opencode-go-panel-appearance')?.textContent ?? ''
      expect(appearance).toContain(en.usageDisplayLabel)
      expect(appearance).toContain(en.showSidebarQuotaLabel)
      expect(appearance.indexOf(en.usageDisplayLabel)).toBeLessThan(appearance.indexOf(en.showSidebarQuotaLabel))

      selectTab('advanced')
      const advanced = document.getElementById('opencode-go-panel-advanced')?.textContent ?? ''
      const order: [string, string][] = [
        [en.groupConnection, en.baseURLLabel],
        [en.groupCacheTimeouts, en.refreshMinutesLabel],
        [en.groupImages, en.maxImagesLabel],
      ]
      for (const [heading, firstRow] of order) {
        expect(advanced).toContain(heading)
        expect(advanced.indexOf(heading)).toBeLessThan(advanced.indexOf(firstRow))
      }
      expect(advanced).not.toContain(en.usageDisplayLabel)
    })

    it('renders nothing until every injected seat is present', () => {
      const { container } = render(<OpencodeGoSection t={t} />)
      expect(container.innerHTML).toBe('')
    })

    it('shows the loading posture instead of the unavailable one while the Host is answering', () => {
      const reading = actions()
      renderSection(stateOf({ status: 'loading' }), reading)
      expect(screen.getByRole('status').textContent).toBe(en.settingsLoading)
      expect(screen.queryByText(en.unavailable)).toBeNull()
      // Nothing is known yet, so there is no listing to ask the gateway for.
      expect(reading.loadModels).not.toHaveBeenCalled()
    })

    it('shows the unavailable posture while the namespace is not served', () => {
      const reading = actions()
      renderSection(stateOf({ status: 'unavailable' }), reading)
      expect(screen.getByText(en.unavailable)).toBeTruthy()
      // Nothing is served, so there is no listing to ask the gateway for.
      expect(reading.loadModels).not.toHaveBeenCalled()
    })

    it('reads the model listing once on mount, and not again when one is already held', () => {
      const reading = actions()
      renderSection(stateOf(), reading)
      expect(reading.loadModels).toHaveBeenCalledTimes(1)

      cleanup()
      const held = actions()
      renderSection(stateOf({ models: listing([{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' }]) }), held)
      expect(held.loadModels).not.toHaveBeenCalled()
    })

    it('reflects the switch state and writes the flip straight through', () => {
      const reading = actions()
      renderSection(stateOf({ enabled: true }), reading, { foldedModels: true })

      const control = screen.getByRole('switch', { name: en.enabledLabel })
      expect(control.getAttribute('aria-checked')).toBe('true')
      // The sentence is the switch's description, not a paragraph under it.
      expect(control.getAttribute('title')).toBe(en.enabledHint)

      // The toggle writes on the click: no save gesture stands between the user
      // and the route leaving the pickers.
      fireEvent.click(control)
      expect(reading.setEnabled).toHaveBeenCalledWith(false)
      expect(reading.save).not.toHaveBeenCalled()
    })

    it('explains the withdrawn state while the switch is off', () => {
      renderSection(stateOf({ enabled: false }), {}, { foldedModels: true })

      const control = screen.getByRole('switch', { name: en.enabledLabel })
      expect(control.getAttribute('aria-checked')).toBe('false')
      expect(control.getAttribute('title')).toBe(en.enabledOff)
    })

    it('locks the switch with the same read-only document that locks the form', () => {
      renderSection(stateOf({ writable: false }), {}, { foldedModels: true })

      expect(screen.getByRole('switch', { name: en.enabledLabel }).hasAttribute('disabled')).toBe(true)
    })

    it('keeps deprecated gateway models configurable and changes picker visibility immediately', () => {
      const acts = actions()
      renderSection(stateOf({ models: listing([{ id: 'old', name: 'Old model', deprecated: true }]),
        modelLimitDraft: { absent: { maxTokens: 10 } },
      }), acts)
      expect(screen.queryByRole('button', { name: /absent/ })).toBeNull()
      expect(screen.getByLabelText(t('limitsOutputLabel', { name: 'Old model' })).hasAttribute('disabled')).toBe(false)
      const toggle = screen.getByRole('switch', { name: t('modelVisibleLabel', { name: 'Old model' }) })
      expect(toggle.getAttribute('aria-checked')).toBe('false')
      fireEvent.click(toggle)
      expect(acts.setModelEnabled).toHaveBeenCalledWith('old', true)
      expect(acts.save).not.toHaveBeenCalled()
    })

    it('shows new models first, deprecated models last, and retains search within status filters', () => {
      renderSection(stateOf({ models: listing([
        { id: 'old', name: 'Old', deprecated: true }, { id: 'normal', name: 'Normal' },
        { id: 'new', name: 'New', releaseDate: new Date().toISOString().slice(0, 10) },
      ]) }))
      const list = () => screen.getByRole('group', { name: en.modelsLabel })
      expect(within(list()).getAllByRole('button').map(button => button.textContent?.split(' ')[0])).toEqual(['New', 'Normal', 'Old'])
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.filterDeprecated + ' 1') }))
      expect(within(list()).getAllByRole('button')).toHaveLength(1)
      fireEvent.change(screen.getByLabelText(en.limitsFilterLabel), { target: { value: 'new' } })
      expect(screen.queryByRole('group', { name: en.modelsLabel })).toBeNull()
    })

    it('shows one selected model editor immediately alongside the searchable list', () => {
      renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
      expect(screen.getByRole('group', { name: en.modelsLabel })).toBeTruthy()
      expect(screen.getByLabelText(t('limitsContextLabel', { name: 'Model' }))).toBeTruthy()
      expect(screen.queryByRole('button', { name: en.limitsLabel })).toBeNull()
    })

    it('names every input modality in catalog order, including the ones the model does not accept', () => {
      renderSection(stateOf({ models: listing([
        { id: 'omni', name: 'Omni', contextWindow: 1_000_000, maxTokens: 131_072, inputModalities: ['text', 'image', 'video'] },
      ]) }))
      const text = screen.getByRole('region', { name: en.modelDetails }).textContent ?? ''
      const labels = [en.modalityText, en.modalityImage, en.modalityAudio, en.modalityVideo, en.modalityPdf]
      labels.forEach(label => { expect(text).toContain(label) })
      const positions = labels.map(label => text.indexOf(label))
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    })

    it('falls back to an undeclared posture when the catalog carries no modalities', () => {
      renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
      const pane = screen.getByRole('region', { name: en.modelDetails })
      expect(within(pane).getByText(en.modalityUnknown)).toBeTruthy()
      expect(within(pane).queryByText(en.modalityVideo)).toBeNull()
    })

    it('marks a model carrying a capacity override in the compact list', () => {
      renderSection(stateOf({
        models: listing([{ id: 'm', name: 'Model' }]),
        modelLimitDraft: { m: { contextWindow: 1024 } },
      }))
      const nav = screen.getByRole('group', { name: en.modelsLabel })
      expect(nav.querySelector('[title="' + en.overridden + '"]')).toBeTruthy()
      expect(screen.getByText(t('limitsSummary', { count: 1 }))).toBeTruthy()
    })

    it('keeps the compact row to the model name and its badges', () => {
      const today = new Date().toISOString().slice(0, 10)
      renderSection(stateOf({ models: listing([{ id: 'fresh-model', name: 'Fresh', releaseDate: today }]) }))
      const row = within(screen.getByRole('group', { name: en.modelsLabel })).getByRole('button')
      expect(row.textContent).toContain('Fresh')
      expect(row.textContent).toContain(en.newBadge)
      // The model id and the release date are the parameter card's job.
      expect(row.textContent).not.toContain('fresh-model')
      expect(row.textContent).not.toContain(today)
      expect(screen.getByRole('region', { name: en.modelDetails }).textContent).toContain('fresh-model')
    })

    it('shares one line between the model id and its release date', () => {
      const today = new Date().toISOString().slice(0, 10)
      renderSection(stateOf({ models: listing([{ id: 'fresh-model', name: 'Fresh', releaseDate: today }]) }))
      const pane = screen.getByRole('region', { name: en.modelDetails })
      const id = pane.querySelector('code')
      const date = within(pane).getByText(today)
      // The date rides the id's line instead of taking a provenance row of its own.
      expect(date.parentElement).toBe(id?.parentElement)
      // The full provenance stays one hover away, without spending a line on it.
      expect(date.getAttribute('title')).toBe(t('releaseSource', { date: today }))
    })

    it('adds the forwarding caveat only where a model declares inputs beyond text and images', () => {
      renderSection(stateOf({ models: listing([{ id: 'omni', name: 'Omni', inputModalities: ['text', 'video'] }]) }))
      expect(screen.getByRole('region', { name: en.modelDetails }).textContent).toContain(en.modalitiesForwarding)

      cleanup()
      renderSection(stateOf({ models: listing([{ id: 'vision', name: 'Vision', inputModalities: ['text', 'image'] }]) }))
      expect(screen.getByRole('region', { name: en.modelDetails }).textContent).not.toContain(en.modalitiesForwarding)
    })

    it('makes model capacities searchable and stages numeric edits', () => {
      const edits = actions()
      renderSection(stateOf({
        models: listing([
          { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', contextWindow: 262_144, maxTokens: 32_768 },
          { id: 'kimi-k2', name: 'Kimi K2', contextWindow: 131_072, maxTokens: 16_384 },
        ]),
        modelLimitDraft: { 'deepseek-v4.1-flash': { contextWindow: 131_072 } },
      }), edits)

      expect(screen.getByRole('region', { name: en.modelDetails })).toBeTruthy()
      const context = screen.getByLabelText(t('limitsContextLabel', { name: 'DeepSeek V4.1 Flash' })) as HTMLInputElement
      expect(context.type).toBe('number')
      expect(context.value).toBe('131072')

      fireEvent.change(context, { target: { value: '262144' } })
      expect(edits.editModelLimits).toHaveBeenCalledWith({"deepseek-v4.1-flash":{"contextWindow":262144}})

      const filter = screen.getByLabelText(en.limitsFilterLabel)
      fireEvent.change(filter, { target: { value: 'kimi' } })
      expect(screen.queryByRole('button', { name: /DeepSeek V4\.1 Flash/ })).toBeNull()
      expect(screen.getByRole('button', { name: /Kimi K2/ })).toBeTruthy()

      fireEvent.change(filter, { target: { value: 'not-there' } })
      expect(screen.getByText(t('limitsNoMatches', { query: 'not-there' }))).toBeTruthy()
    })

    it('offers a clear action that returns a model to its catalog capacities', () => {
      const edits = actions()
      renderSection(stateOf({
        models: listing([{ id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', contextWindow: 262_144 }]),
        modelLimitDraft: { 'deepseek-v4.1-flash': { contextWindow: 131_072 } },
      }), edits)

      fireEvent.click(screen.getByRole('button', { name: en.limitsResetModel }))
      expect(edits.editModelLimits).toHaveBeenCalledWith({"deepseek-v4.1-flash":null})
    })

    it('stages clearing one field without dropping the other or restoring an inherited value', () => {
      const edits = actions()
      renderSection(stateOf({
        models: listing([{ id: 'm', name: 'Model' }]),
        modelLimitDraft: { m: { contextWindow: 123456, maxTokens: 1024 }, previous: null },
      }), edits)
      fireEvent.change(screen.getByLabelText(t('limitsContextLabel', { name: 'Model' })), { target: { value: '' } })
      expect(edits.editModelLimits).toHaveBeenCalledWith({"m":{"contextWindow":null,"maxTokens":1024},"previous":null})
      fireEvent.click(screen.getByRole('button', { name: en.limitsResetAll }))
      expect(edits.editModelLimits).toHaveBeenCalledWith({"m":null,"previous":null})
    })

    it('does not count explicit catalog resets as customized models', () => {
      renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]), modelLimitDraft: { m: null } }))
      expect(screen.getByText(t('limitsSummary', { count: 0 }))).toBeTruthy()
      expect(screen.queryByRole('button', { name: en.limitsResetModel })).toBeNull()
      expect(screen.queryByRole('button', { name: en.limitsResetAll })).toBeNull()
    })

    it('keeps the model editor on its own tab', () => {
      renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }), {}, { foldedModels: true })
      expect(document.getElementById('opencode-go-models')).toBeNull()
      expect(screen.queryByRole('group', { name: en.modelsLabel })).toBeNull()
      const modelsTab = () => screen.getByRole('tab', { name: en.settingsTabModels })
      expect(modelsTab().getAttribute('aria-selected')).toBe('false')

      selectTab('models')
      expect(modelsTab().getAttribute('aria-selected')).toBe('true')
      expect(document.getElementById('opencode-go-models')).not.toBeNull()
      expect(screen.getByRole('group', { name: en.modelsLabel })).toBeTruthy()

      selectTab('overview')
      expect(document.getElementById('opencode-go-models')).toBeNull()
    })

    it('marks the models tab when the list has something to report', () => {
      // A notice behind another tab is a notice nobody reads: the tab carries a mark,
      // and the notice itself lives on the models tab.
      renderSection(stateOf({ pickerFailed: true, models: listing([{ id: 'm', name: 'Model' }]) }), {}, { foldedModels: true })
      const modelsTab = () => screen.getByRole('tab', { name: en.settingsTabModels })
      expect(modelsTab().hasAttribute('data-marked')).toBe(true)
      expect(screen.queryByText(en.pickerFailed)).toBeNull()
      selectTab('models')
      expect(screen.getByText(en.pickerFailed)).toBeTruthy()

      cleanup()
      renderSection(stateOf({ models: { status: 'failed', message: 'offline' } }), {}, { foldedModels: true })
      expect(screen.getByRole('tab', { name: en.settingsTabModels }).hasAttribute('data-marked')).toBe(true)
      selectTab('models')
      expect(screen.getByText(en.modelsFailed)).toBeTruthy()
      expect(screen.getByText('offline')).toBeTruthy()

      // A healthy listing still leaves the tab unmarked.
      cleanup()
      renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }), {}, { foldedModels: true })
      expect(screen.getByRole('tab', { name: en.settingsTabModels }).hasAttribute('data-marked')).toBe(false)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('keeps the header compact and groups refresh with the source controls', () => {
      renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
      expect(screen.getByRole('heading', { level: 3, name: en.modelsLabel })).toBeTruthy()

      const refresh = screen.getByRole('button', { name: en.modelsRefresh })
      const sources = screen.getByRole('tablist', { name: en.modelSourcesLabel })
      const filters = screen.getByRole('group', { name: en.filterLabel })
      const toolbar = document.getElementById('opencode-go-models')?.firstElementChild
      expect(toolbar?.contains(sources)).toBe(true)
      expect(toolbar?.contains(refresh)).toBe(true)
      expect(filters.contains(refresh)).toBe(false)
    })

    it('closes the model card with the tally on its own row beside the clear action', () => {
      renderSection(stateOf({
        models: listing([{ id: 'm', name: 'Model' }]),
        modelLimitDraft: { m: { contextWindow: 1024 } },
      }))
      const tally = screen.getByText(t('limitsSummary', { count: 1 }))
      const action = screen.getByRole('button', { name: en.limitsResetAll })
      // One row of its own, under the model area, tally left of the action.
      expect(tally.parentElement).toBe(action.parentElement)
      expect(tally.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // The action is a control, not decoration: live while the document is.
      expect(action.hasAttribute('disabled')).toBe(false)

      cleanup()
      renderSection(stateOf({
        writable: false,
        models: listing([{ id: 'm', name: 'Model' }]),
        modelLimitDraft: { m: { contextWindow: 1024 } },
      }))
      expect(screen.getByRole('button', { name: en.limitsResetAll }).hasAttribute('disabled')).toBe(true)
    })

    it('never invents gateway membership from offline saved overrides, but permits clearing them', () => {
      const edits = actions()
      renderSection(stateOf({ models: { status: 'failed', message: 'offline' },
        modelLimitDraft: { retired: { maxTokens: 1024 }, reset: null },
      }), edits)
      expect(screen.queryByRole('button', { name: /retired/ })).toBeNull()
      expect(screen.getByText(t('limitsSummary', { count: 0 }))).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: en.limitsResetAll }))
      expect(edits.editModelLimits).toHaveBeenCalledWith({"retired":null,"reset":null})
    })

    it('reports a reading listing, an empty listing, and a failed one', () => {
      renderSection(stateOf())
      expect(screen.getByRole('status', { name: en.modelsLoading })).toBeTruthy()

      cleanup()
      renderSection(stateOf({ models: listing([]) }))
      expect(screen.getByText(en.modelsEmpty)).toBeTruthy()

      cleanup()
      renderSection(stateOf({ models: { status: 'failed', message: 'the live model listing is unreachable' } }))
      expect(screen.getByText(en.modelsFailed)).toBeTruthy()
      expect(screen.getByText('the live model listing is unreachable')).toBeTruthy()
    })

    it('re-reads the listing on demand, and refuses a second read while one is outstanding', () => {
      const reading = actions()
      renderSection(stateOf({ models: listing([{ id: 'a' }]) }), reading)
      fireEvent.click(screen.getByText(en.modelsRefresh))
      expect(reading.loadModels).toHaveBeenCalledTimes(1)

      cleanup()
      const pending = actions()
      renderSection(stateOf({ models: { status: 'loading' } }), pending)
      expect(screen.getByText<HTMLButtonElement>(en.modelsRefresh).disabled).toBe(true)
    })

    it('keeps the tuning fields on the advanced tab, which is marked when customized', () => {
      renderSection(stateOf({ refreshMinutes: field('30', { overridden: true }) }))

      expect(screen.queryByLabelText(en.baseURLLabel)).toBeNull()
      expect(screen.getByRole('tab', { name: en.settingsTabAdvanced }).hasAttribute('data-marked')).toBe(true)

      openAdvanced()
      expect(screen.getByLabelText(en.baseURLLabel)).toHaveProperty('value', 'https://opencode.ai/zen/go/v1')
      expect(screen.getByLabelText(en.refreshMinutesLabel)).toHaveProperty('value', '30')
    })

    it('gives each tab a plain heading without a summary line', () => {
      renderSection(stateOf())
      openAdvanced()
      const heading = screen.getByRole('heading', { level: 3, name: en.advancedLabel })
      expect(heading.textContent).toBe(en.advancedLabel)
    })

    it('wires each tab to the panel it controls', () => {
      renderSection(stateOf())
      const advancedTab = screen.getByRole('tab', { name: en.settingsTabAdvanced })
      expect(advancedTab.getAttribute('aria-selected')).toBe('false')
      expect(advancedTab.getAttribute('aria-controls')).toBe('opencode-go-panel-advanced')
      expect(document.getElementById('opencode-go-panel-advanced')).toBeNull()

      fireEvent.click(advancedTab)
      expect(screen.getByRole('tab', { name: en.settingsTabAdvanced }).getAttribute('aria-selected')).toBe('true')
      expect(document.getElementById('opencode-go-panel-advanced')).not.toBeNull()
    })

    it('orders the tabs as overview, models, appearance and advanced', () => {
      renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(en.titleLabel)
      const labels = within(screen.getByRole('tablist', { name: en.settingsTabsLabel }))
        .getAllByRole('tab').map(tab => tab.textContent)
      expect(labels).toEqual([en.settingsTabOverview, en.settingsTabModels, en.settingsTabAppearance, en.settingsTabAdvanced])

      // The overview keeps the provider switch and account management together.
      selectTab('overview')
      const enabledSwitch = screen.getByRole('switch', { name: en.enabledLabel })
      const accountsButton = screen.getByRole('button', { name: new RegExp(en.accountsTitle) })
      expect(enabledSwitch.compareDocumentPosition(accountsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('stages edits through the injected actions and resets on demand', () => {
      const edits = actions()
      renderSection(stateOf({ refreshMinutes: field('60', { overridden: true }) }), edits)
      openAdvanced()

      fireEvent.change(screen.getByLabelText(en.baseURLLabel), { target: { value: 'https://other.test/v1' } })
      expect(edits.edit).toHaveBeenCalledWith('baseURL', 'https://other.test/v1')

      fireEvent.click(screen.getByText(en.advancedResetAll))
      expect(edits.resetField).toHaveBeenCalledWith('refreshMinutes')
    })

    it('enables save only for a dirty, valid form and shows the failure note', () => {
      const acts = actions()
      const { rerender } = render((
        <OpencodeGoSection {...{
          ...acts,
          t,
          useOpencodeGo: bindSnapshotSelector(createSnapshotStore(stateOf({ dirty: true }))),
        }}
        />
      ))
      const save = screen.getByText(en.save) as HTMLButtonElement
      const discard = screen.getByText(en.discard) as HTMLButtonElement
      expect(save.disabled).toBe(false)
      expect(discard.disabled).toBe(false)
      fireEvent.click(save)
      expect(acts.save).toHaveBeenCalled()

      rerender((
        <OpencodeGoSection {...{
          ...acts,
          t,
          useOpencodeGo: bindSnapshotSelector(createSnapshotStore(stateOf({ dirty: true, failed: true }))),
        }}
        />
      ))
      expect(screen.getByText(en.savedFailed)).toBeTruthy()
    })

    it('exercises every field control: edits, resets, invalid and numeric states', () => {
      const edits = actions()
      renderSection(stateOf({
        baseURL: field('https://opencode.ai/zen/go/v1', { overridden: true }),
        refreshMinutes: field('not-a-number', { overridden: true, invalid: true }),
        streamIdleTimeoutMs: field('300000', { overridden: true }),
        maxImages: field('30', { overridden: true }),
        maxRequestImageBytes: field('20971520', { overridden: true }),
        requestImagePixelBudget: field('4194304', { overridden: true }),
        requestImageMaxBytes: field('1048576', { overridden: true }),
      }), edits)

      openAdvanced()
      const fields: readonly (readonly [label: string, name: string, numeric: boolean])[] = [
        [en.baseURLLabel, 'baseURL', false],
        [en.refreshMinutesLabel, 'refreshMinutes', true],
        [en.streamIdleTimeoutMsLabel, 'streamIdleTimeoutMs', true],
        [en.maxImagesLabel, 'maxImages', true],
        [en.maxRequestImageBytesLabel, 'maxRequestImageBytes', true],
        [en.requestImagePixelBudgetLabel, 'requestImagePixelBudget', true],
        [en.requestImageMaxBytesLabel, 'requestImageMaxBytes', true],
      ]
      fields.forEach(([label, name, numeric]) => {
        const input = screen.getByLabelText(label) as HTMLInputElement
        expect(input.inputMode).toBe(numeric ? 'numeric' : '')
        expect(input.type).toBe(numeric ? 'number' : 'text')
        const nextValue = numeric ? '123' : `edited-${name}`
        fireEvent.change(input, { target: { value: nextValue } })
        expect(edits.edit).toHaveBeenCalledWith(name, nextValue)
      })
      // The card owns one reset, and it returns every customized row at once.
      fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
      expect(edits.resetField.mock.calls.map(call => call[0]).sort()).toEqual(fields.map(([, name]) => name).sort())

      // The invalid refresh draft renders the invalid style and copy.
      expect(screen.getByText(en.invalidValue)).toBeTruthy()
    })

    it('mirrors the Host schema bounds on every numeric input', () => {
      renderSection(stateOf())
      openAdvanced()
      const fields: readonly (readonly [label: string, name: TextField])[] = [
        [en.refreshMinutesLabel, 'refreshMinutes'],
        [en.streamIdleTimeoutMsLabel, 'streamIdleTimeoutMs'],
        [en.requestPreparationTimeoutMsLabel, 'requestPreparationTimeoutMs'],
        [en.requestTimeoutMsLabel, 'requestTimeoutMs'],
        [en.maxImagesLabel, 'maxImages'],
        [en.maxRequestImageBytesLabel, 'maxRequestImageBytes'],
        [en.requestImagePixelBudgetLabel, 'requestImagePixelBudget'],
        [en.requestImageMaxBytesLabel, 'requestImageMaxBytes'],
      ]
      for (const [label, name] of fields) {
        const limit = NUMERIC_FIELD_LIMITS[name]!
        expect(limit).toBeDefined()
        const input = screen.getByLabelText(label) as HTMLInputElement
        expect(input.type).toBe('number')
        expect(input.step).toBe(limit.integer ? '1' : 'any')
        expect(input.min).toBe(String(limit.min))
        expect(input.max).toBe(limit.max === undefined ? '' : String(limit.max))
      }
    })

    it('returns only the customized rows from each reset', () => {
      const edits = actions()
      renderSection(stateOf({
        usageDisplay: field('always', { overridden: true }),
        baseURL: field('https://other.test/v1', { overridden: true }),
        showSidebarQuota: field('true', { overridden: true }),
        usagePillStyle: field('plain', { overridden: true }),
      }), edits)
      openAdvanced()
      fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
      expect(edits.resetField.mock.calls.map(call => call[0]).sort()).toEqual(['baseURL'])

      selectTab('appearance')
      fireEvent.click(screen.getByRole('button', { name: en.usageAppearanceReset }))
      expect(edits.resetField.mock.calls.map(call => call[0]).sort())
        .toEqual(['baseURL', 'showSidebarQuota', 'usageDisplay', 'usagePillStyle'])
    })

    it('keeps the card reset out of reach while every row inherits its value', () => {
      renderSection(stateOf())
      openAdvanced()
      expect(screen.getByRole('button', { name: en.advancedResetAll }).hasAttribute('disabled')).toBe(true)
    })

    it('carries the provider hint as the switch description, behind its mark', () => {
      renderSection(stateOf(), {}, { foldedModels: true })
      // The Switch primitive forwards no aria-describedby, so the sentence rides the
      // one channel it does forward while the mark opens it in the Host's bubble.
      expect(screen.getByRole('switch', { name: en.enabledLabel }).getAttribute('title')).toBe(en.enabledHint)
      expect(screen.queryByText(en.enabledHint)).toBeNull()
    })

    it('describes an invalid draft with its error, and a valid one with its hint', () => {
      renderSection(stateOf({ proxyURL: field('not-a-url', { overridden: true, invalid: true }) }))
      openAdvanced()
      const invalid = screen.getByLabelText<HTMLInputElement>(en.proxyURLLabel)
      const described = (invalid.getAttribute('aria-describedby') ?? '').split(' ')
      // The alert announces the failure once; the description keeps it available
      // every time the control is focused again.
      expect(described).toHaveLength(2)
      const error = document.getElementById(described[0]!)
      expect(error?.textContent).toBe(en.proxyURLInvalid)
      expect(error?.getAttribute('role')).toBe('alert')
      expect(document.getElementById(described[1]!)?.textContent).toBe(en.proxyURLHint)

      cleanup()
      renderSection(stateOf())
      openAdvanced()
      expect(screen.getByLabelText(en.baseURLLabel).getAttribute('aria-describedby'))
        .toBe('opencode-go-base-url-hint')
    })

    it('shows the saving state while a save crosses the wire', () => {
      renderSection(stateOf({ dirty: true, saving: true }))
      expect(screen.getByText<HTMLButtonElement>(en.saving).disabled).toBe(true)
      expect(screen.getByText<HTMLButtonElement>(en.discard).disabled).toBe(true)
    })

  })

  describe('OpencodeGoSectionController through the component', () => {
    it('adds, saves, discards, and removes a custom budget without changing capacities', async () => {
      const host = createConfigForm<OpencodeGoSettings>()
      acceptFormWrites(host)

      const controller = new OpencodeGoSectionController(host.form, { remote: {
        credentials: { describe: async () => ({ ok: true, value: {} }) },
      } } as never, async () => ({ ok: true, value: { stale: false, models: [
        { id: 'budget', name: 'Budget Model', maxTokens: 32768, reasoningBudget: { min: 1024, max: 20000 } },
        { id: 'effort', name: 'Effort Model' },
      ] } }))
      host.publish({ status: 'ready', writable: true, value: { modelLimits: { budget: { contextWindow: 100000 } } }, user: {} })
      render(<OpencodeGoSection {...controller.inject()} t={t}
        useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
      try {
        await act(async () => { await Promise.resolve() })
        openModelLimits()
        fireEvent.click(screen.getByText(en.thinkingBudgets))
        const input = () => screen.getByLabelText<HTMLInputElement>(t('thinkingBudgetAddLabel', { name: 'Budget Model' }))
        const add = () => screen.getByRole<HTMLButtonElement>('button', { name: en.thinkingBudgetAdd })
        for (const value of ['512', '1.5', '20001']) {
          fireEvent.change(input(), { target: { value } })
          expect(input().getAttribute('aria-invalid')).toBe('true')
          expect(add().disabled).toBe(true)
        }
        fireEvent.change(input(), { target: { value: '4096' } })
        fireEvent.click(add())
        expect(host.set).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: t('thinkingBudgetRemove', { value: 4096 }) })).toBeTruthy()
        fireEvent.click(screen.getByText(en.discard))
        expect(screen.queryByRole('button', { name: t('thinkingBudgetRemove', { value: 4096 }) })).toBeNull()
        fireEvent.change(input(), { target: { value: '6000' } })
        fireEvent.click(add())
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.form.getSnapshot().value?.modelLimits).toEqual({ budget: { contextWindow: 100000, thinkingBudgets: [6000] } })
        fireEvent.click(screen.getByRole('button', { name: t('thinkingBudgetRemove', { value: 6000 }) }))
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.form.getSnapshot().value?.modelLimits).toEqual({ budget: { contextWindow: 100000, thinkingBudgets: null } })
        fireEvent.click(screen.getByRole('button', { name: 'Effort Model' }))
        expect(screen.queryByText(en.thinkingBudgets)).toBeNull()
      } finally { controller.dispose() }
    })

    it('caps a thinking budget by the Host schema ceiling', async () => {
      const host = createConfigForm<OpencodeGoSettings>()
      acceptFormWrites(host)
      const controller = new OpencodeGoSectionController(host.form, { remote: {
        credentials: { describe: async () => ({ ok: true, value: {} }) },
      } } as never, async () => ({ ok: true, value: { stale: false, models: [
        { id: 'big', name: 'Big Budget', maxTokens: 4_000_000, reasoningBudget: { min: 1024, max: 2_000_000 } },
      ] } }))
      host.publish({ status: 'ready', writable: true, value: {}, user: {} })
      render(<OpencodeGoSection {...controller.inject()} t={t}
        useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
      try {
        await act(async () => { await Promise.resolve() })
        openModelLimits()
        fireEvent.click(screen.getByText(en.thinkingBudgets))
        const input = screen.getByLabelText<HTMLInputElement>(t('thinkingBudgetAddLabel', { name: 'Big Budget' }))
        const add = () => screen.getByRole<HTMLButtonElement>('button', { name: en.thinkingBudgetAdd })
        expect(input.max).toBe(String(MAX_THINKING_BUDGET_TOKENS))
        fireEvent.change(input, { target: { value: String(MAX_THINKING_BUDGET_TOKENS + 1) } })
        expect(input.getAttribute('aria-invalid')).toBe('true')
        expect(add().disabled).toBe(true)
        fireEvent.change(input, { target: { value: String(MAX_THINKING_BUDGET_TOKENS) } })
        expect(input.getAttribute('aria-invalid')).toBe('false')
        expect(add().disabled).toBe(false)
      } finally { controller.dispose() }
    })

    it('preserves the current account when resetting advanced settings', async () => {
      const host = createConfigForm<OpencodeGoSettings>()
      acceptFormWrites(host)
      const accounts = [
        { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
        { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
      ]
      const base = { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true, baseURL: 'https://opencode.ai/zen/go/v1' }
      const user = { accounts: [accounts[1]!, accounts[0]!], apiKeyEnv: 'ACCOUNT_B', baseURL: 'https://other.test/v1' }
      host.publish({ status: 'ready', writable: true, value: { ...base, ...user }, base, user })
      const controller = new OpencodeGoSectionController(host.form, { remote: {
        credentials: { describe: async () => ({ ok: true, value: {} }) },
        opencodeGoModels: { read: async () => ({ ok: true, value: { models: [], stale: false } }) },
      } } as never)
      render(<OpencodeGoSection {...controller.inject()} t={t}
        useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
      try {
        await act(async () => { await Promise.resolve() })
        openAdvanced()
        expect(screen.queryByDisplayValue('ACCOUNT_B')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.mutate).toHaveBeenCalledWith([{ op: 'unset', path: ['baseURL'] }], expect.any(Number))
        expect(host.form.getSnapshot().value).toEqual({ ...base, accounts: user.accounts, apiKeyEnv: 'ACCOUNT_B' })
        expect(host.form.getSnapshot().user).toEqual({ accounts: user.accounts, apiKeyEnv: 'ACCOUNT_B' })
        expect(screen.getByRole<HTMLButtonElement>('button', { name: en.advancedResetAll }).disabled).toBe(true)
      } finally { controller.dispose() }
    })

    it('validates, saves, clears and resets the proxy address in advanced settings', async () => {
      const host = createConfigForm<OpencodeGoSettings>()
      acceptFormWrites(host)
      const base = { proxyURL: 'http://localhost:7890' }

      host.publish({ status: 'ready', writable: true, value: base, base, user: {} })
      const controller = new OpencodeGoSectionController(host.form, { remote: {
        credentials: { describe: async () => ({ ok: true, value: {} }) },
        opencodeGoModels: { read: async () => ({ ok: true, value: { models: [], stale: false } }) },
      } } as never)
      render(<OpencodeGoSection {...controller.inject()} t={t}
        useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
      try {
        await act(async () => { await Promise.resolve() })
        openAdvanced()
        const input = () => screen.getByLabelText<HTMLInputElement>(en.proxyURLLabel)
        expect(input().value).toBe(base.proxyURL)
        for (const value of ['127.0.0.1:7890', 'socks4://localhost:1080', 'http://localhost:7890/path']) {
          fireEvent.change(input(), { target: { value } })
          expect(input().getAttribute('aria-invalid')).toBe('true')
          expect(screen.getByText(en.proxyURLInvalid)).toBeTruthy()
          expect(screen.getByText<HTMLButtonElement>(en.save).disabled).toBe(true)
        }
        fireEvent.change(input(), { target: { value: 'socks5://localhost:1080' } })
        expect(host.set).not.toHaveBeenCalled()
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.mutate).toHaveBeenCalledWith([{ op: 'set', path: ['proxyURL'], value: 'socks5://localhost:1080' }], expect.any(Number))
        fireEvent.change(input(), { target: { value: '' } })
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.mutate).toHaveBeenCalledWith([{ op: 'set', path: ['proxyURL'], value: '' }], expect.any(Number))
        expect(input().value).toBe('')
        fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.mutate).toHaveBeenCalledWith([{ op: 'unset', path: ['proxyURL'] }], expect.any(Number))
        expect(input().value).toBe(base.proxyURL)
      } finally { controller.dispose() }
    })

    it('saves an optional image count, rejects invalid counts, and clears or resets the override', async () => {
      const host = createConfigForm<OpencodeGoSettings>()
      acceptFormWrites(host)

      const controller = new OpencodeGoSectionController(host.form, { remote: {
        credentials: { describe: async () => ({ ok: true, value: {} }) },
        opencodeGoModels: { read: async () => ({ ok: true, value: { models: [], stale: false } }) },
      } } as never)
      host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
      render(<OpencodeGoSection {...controller.inject()} t={t}
        useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
      try {
        await act(async () => { await Promise.resolve() })
        openAdvanced()
        const input = () => screen.getByLabelText<HTMLInputElement>(en.maxImagesLabel)
        expect(input().value).toBe('')
        expect(document.getElementById(input().getAttribute('aria-describedby') ?? '')?.textContent)
          .toBe(en.maxImagesHint)
        for (const value of ['0', '-1', '1.5', '9007199254740992']) {
          fireEvent.change(input(), { target: { value } })
          expect(input().getAttribute('aria-invalid')).toBe('true')
          expect(screen.getByText<HTMLButtonElement>(en.save).disabled).toBe(true)
        }
        fireEvent.change(input(), { target: { value: '30' } })
        fireEvent.click(screen.getByText(en.discard))
        expect(input().value).toBe('')
        expect(host.set).not.toHaveBeenCalled()
        fireEvent.change(input(), { target: { value: '30' } })
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.mutate).toHaveBeenCalledWith([{ op: 'set', path: ['maxImages'], value: 30 }], expect.any(Number))
        expect(input().value).toBe('30')
        fireEvent.change(input(), { target: { value: '' } })
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.mutate).toHaveBeenCalledWith([{ op: 'unset', path: ['maxImages'] }], expect.any(Number))
        expect(host.form.getSnapshot().value?.maxImages).toBeUndefined()
        expect(input().value).toBe('')

        // Reset follows the shared settings convention, including inherited caps.
        act(() => { host.publish({ value: { maxImages: 30 }, base: { maxImages: 60 }, user: { maxImages: 30 } }) })
        fireEvent.click(screen.getByRole('button', { name: en.advancedResetAll }))
        expect(input().value).toBe('60')
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.form.getSnapshot().value?.maxImages).toBe(60)
        expect(host.form.getSnapshot().user).toEqual({})
      } finally {
        controller.dispose()
      }
    })

    it('saves, discards, and resets capacities while preserving explicit catalog choices', async () => {
      const host = createConfigForm<OpencodeGoSettings>()
      acceptFormWrites(host)

      const controller = new OpencodeGoSectionController(host.form, { remote: {
        credentials: { describe: async () => ({ ok: true, value: {} }) },
        opencodeGoModels: { read: async () => ({ ok: true, value: { models: [{ id: 'm', name: 'Model', contextWindow: 262144, maxTokens: 32768 }], stale: false } }) },
      } } as never)
      host.publish({ status: 'ready', writable: true,
        value: { modelLimits: { m: { contextWindow: 100000, maxTokens: 1024 } } }, user: {} })
      render(<OpencodeGoSection {...controller.inject()} t={t}
        useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
      try {
        await act(async () => { await Promise.resolve() })
        openModelLimits()
        const input = () => screen.getByLabelText<HTMLInputElement>(t('limitsContextLabel', { name: 'Model' }))
        fireEvent.change(input(), { target: { value: '200000' } })
        expect(host.set).not.toHaveBeenCalled()
        fireEvent.click(screen.getByText(en.discard))
        expect(input().value).toBe('100000')
        fireEvent.change(input(), { target: { value: '200000' } })
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.form.getSnapshot().value?.modelLimits?.m?.contextWindow).toBe(200000)
        expect(screen.getByText(t('capacityDefault', { value: '262,144' }) + ' · ' + en.overridden)).toBeTruthy()
        expect(screen.getByText<HTMLButtonElement>(en.save).disabled).toBe(true)

        fireEvent.click(screen.getByRole('button', { name: en.limitsResetModel }))
        expect(input().value).toBe('')
        fireEvent.click(screen.getByText(en.discard))
        expect(input().value).toBe('200000')
        fireEvent.click(screen.getByRole('button', { name: en.limitsResetAll }))
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.form.getSnapshot().value?.modelLimits).toEqual({ m: null })
        expect(screen.getByText(t('limitsSummary', { count: 0 }))).toBeTruthy()
        fireEvent.change(input(), { target: { value: '150000' } })
        await act(async () => { screen.getByText(en.save).click() })
        expect(host.form.getSnapshot().value?.modelLimits).toEqual({ m: { contextWindow: 150000, maxTokens: null, thinkingBudgets: null } })
      } finally {
        controller.dispose()
      }
    })

    it('drives a staged edit end to end against the ConfigForm', async () => {
      const host = createConfigForm<OpencodeGoSettings>()
      acceptFormWrites(host)

      const ctx = {
        remote: {
          credentials: { describe: vi.fn(() => Promise.resolve({ ok: true, value: {} })), set: vi.fn() },
          llm: { discoverModels: vi.fn(() => Promise.resolve({ ok: true, value: [] })) },
        },
      } as never
      const controller = new OpencodeGoSectionController(host.form, ctx)
      host.publish({ status: 'ready', writable: true, value: { baseURL: 'https://opencode.ai/zen/go/v1' }, user: {} })

      render((
        <OpencodeGoSection
          {...{
            ...controller.inject(),
            t,
            useOpencodeGo: bindSnapshotSelector(controller.inject().hooks.opencodeGo),
          }}
        />
      ))

      openAdvanced()
      fireEvent.change(screen.getByLabelText(en.baseURLLabel), { target: { value: 'https://edited.test/v1' } })
      await act(async () => { screen.getByText(en.save).click() })

      await vi.waitFor(() => { expect(host.mutate).toHaveBeenCalledWith([{ op: 'set', path: ['baseURL'], value: 'https://edited.test/v1' }], expect.any(Number)) })
    })
  })

  it('keeps the usage history dashboard out of the settings page', () => {
    renderSection(stateOf())
    expect(screen.queryByRole('heading', { name: en.analyticsTitle })).toBeNull()
    expect(screen.queryByRole('button', { name: /Open dashboard|打开看板/ })).toBeNull()
  })
})

describe("advanced settings reset", () => {

  async function mount(user: Partial<OpencodeGoSettings> = {}) {
    const host = createConfigForm<OpencodeGoSettings>()
    acceptFormWrites(host)
    const base = { proxyURL: '', refreshMinutes: 60, maxImages: 10 }
    host.publish({ status: 'ready', writable: true, value: { ...base, ...user }, base, user })
    const controller = new OpencodeGoSectionController(host.form, { remote: {
      credentials: { describe: async () => ({ ok: true, value: {} }) },
      opencodeGoModels: { read: async () => ({ ok: true, value: { models: [], stale: false } }) },
    } } as never)
    render(<OpencodeGoSection {...controller.inject()} t={key => en[key]}
      useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(document.getElementById('opencode-go-tab-advanced') as HTMLElement)
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
        expect(host.form.getSnapshot().user).toEqual({})
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
      expect(host.form.getSnapshot().user).toEqual({})
    } finally { controller.dispose() }
  })
})

describe("installed Host localization", () => {

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
    const host = createConfigForm<LocaleSettings>()
    host.publish({ status: 'ready', writable: true, value: preference ? { preference } : {}, base: {}, user: {} })
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    const locale = new LocaleRuntime(ctx, host.form)
    locale.register(namespace, 'zh', zh)
    locale.register(namespace, 'en', en)
    return { locale, host }
  }

  const windowUsage = { status: 'ok' as const, percent: 10, resetsAt: '2026-09-24T13:05:00Z' }

  const usage = { rolling: { ...windowUsage, percent: 0 }, weekly: windowUsage, monthly: windowUsage }

  async function mountSurfaces(locale: HostLocaleRuntime) {
    const settings = createConfigForm<OpencodeGoSettings>()
    settings.publish({ status: 'ready', writable: true, value: defaultClientSettings, base: {}, user: {} })
    const readModels = vi.fn(async () => ({ ok: true as const, value: { stale: false, models: [
      { id: 'alpha', name: 'Alpha', releaseDate: '2026-09-23', contextWindow: 123456, maxTokens: 8192 },
      { id: 'missing', name: 'missing', configurationMissing: true },
    ] } }))
    const controller = new OpencodeGoSectionController(settings.form, { remote: {
      credentials: { describe: async () => ({ ok: true, value: {} }) },
    } } as never, readModels)
    cleanups.push(() => controller.dispose())
    const face = controller.inject()
    const useOpencodeGo = bindSnapshotSelector(face.hooks.opencodeGo)
    const t = locale.bind(namespace)
    const directory = store.createSnapshotStore<ModelDirectoryState>({
      current: { provider: 'dsh-opencode-go', model: 'alpha' }, routable: true,
      groups: [], failures: [], status: 'ready', error: null,
    })
    const readUsage = vi.fn(async () => usage)
    const subscribe = (listener: () => void) => locale.subscribe(listener)
    const getSnapshot = () => locale.getSnapshot()
    const getLocale = () => locale.getSnapshot().active
    const usageTranslate = (key: string) => t(key as OpencodeGoKey)
    // Host slot injection caches these faces; getters must remain live without rebuilding them.
    const sectionProps = { ...face, t, getLocale, useOpencodeGo }
    const usageProps = { directory, settings: settings.form, readUsage, t: usageTranslate, getLocale }
    function Surfaces() {
      // The real Host SlotOutlet subscribes to this same locale revision source.
      React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
      return <>
        <OpencodeGoSection {...sectionProps} />
        <UsagePill {...usageProps} />
      </>
    }
    await act(async () => { render(<Surfaces />) })
    // The copy checks read the model tab; select it the way a reader would.
    await act(async () => { fireEvent.click(document.getElementById('opencode-go-tab-models') as HTMLElement) })
    return { snapshot: face.hooks.opencodeGo.getSnapshot, readModels, readUsage }
  }

  function expectCopy(active: 'zh' | 'en'): void {
    const copy = active === 'zh' ? zh : en
    expect(screen.getByText(copy.intro)).toBeTruthy()
    expect(screen.getAllByText(copy.newBadge).length).toBeGreaterThan(0)
    expect(screen.getByText(copy.configurationMissing)).toBeTruthy()
    expect(screen.getByRole('button', { name: copy.modelsRefresh })).toBeTruthy()
    // UsagePill renders this label as segmented spans (reading/unit/stale/account) so the narrow-composer
    // container queries can hide them independently; the label text is therefore no longer a single text node
    // and getByText's own-text match no longer applies. Match the trigger's textContent instead, which still
    // concatenates to exactly this string.
    expect(screen.getByRole('button', { name: `${copy.usageTitle}: ${copy.usageRollingShort} 0% · ${copy.usageWeekShort} 10%` }).textContent)
      .toBe(`${copy.usageRollingShort} 0% · ${copy.usageWeekShort} 10%`)
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
    fireEvent.click(screen.getByRole('button', { name: `${copy.usageTitle}: ${copy.usageRollingShort} 0% · ${copy.usageWeekShort} 10%` }))
    expect(screen.getByRole('dialog', { name: copy.usageTitle })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: copy.usage_monthly })).toBeTruthy()
    // Panel timestamps stop at minutes: seconds only add noise at this size.
    expect(screen.getAllByText(`${copy.usageResets} ${new Date(windowUsage.resetsAt).toLocaleString(active, {
      year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`)).toHaveLength(3)
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
    fireEvent.click(document.getElementById('opencode-go-tab-advanced') as HTMLElement)
    const refreshInput = screen.getByLabelText(zh.refreshMinutesLabel)
    fireEvent.change(refreshInput, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: `${zh.usageTitle}: ${zh.usageRollingShort} 0% · ${zh.usageWeekShort} 10%` }))
    expect(snapshot().dirty).toBe(true)

    await act(async () => { locale.setLocale('en') })

    expect(locale.bind(namespace)).toBe(t)
    // The advanced tab keeps its staged draft across the locale change.
    expect(screen.getByLabelText(en.refreshMinutesLabel)).toBe(refreshInput)
    expect(refreshInput).toHaveProperty('value', '30')
    expect(snapshot().dirty).toBe(true)
    // Translated model copy lives on the models tab; select it to read it.
    await act(async () => { fireEvent.click(document.getElementById('opencode-go-tab-models') as HTMLElement) })
    expectCopy('en')
    expect(screen.getByRole('dialog', { name: en.usageTitle })).toBeTruthy()
    expect(screen.getAllByText(`${en.usageResets} ${new Date(windowUsage.resetsAt).toLocaleString('en', {
      year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`)).toHaveLength(3)
    expect(host.set).toHaveBeenCalledExactlyOnceWith('preference', 'en')
    expect(readModels).toHaveBeenCalledTimes(1)
    expect(readUsage).toHaveBeenCalledTimes(1)
  })
})

describe('typed ConfigForm drafts and writes', () => {
  const controllers: OpencodeGoSectionController[] = []
  afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose() })
  function setup(value: OpencodeGoSettings = defaultClientSettings) {
    const host = createConfigForm(value)
    const controller = new OpencodeGoSectionController(host.form, {} as never)
    controllers.push(controller)
    const actions = controller.inject()
    return { host, controller, actions, snapshot: actions.hooks.opencodeGo.getSnapshot }
  }

  it('defaults, validates and persists sidebar visibility and pill style as typed values', async () => {
    const { host, controller, actions, snapshot } = setup()
    expect(editableKeys).toEqual(expect.arrayContaining(['showSidebarQuota', 'usagePillStyle']))
    expect(snapshot()).toMatchObject({ showSidebarQuota: { text: 'false' }, usagePillStyle: { text: 'badge' } })
    actions.edit('showSidebarQuota', 'true')
    actions.edit('usagePillStyle', 'plain')
    await controller.save()
    expect(host.mutate).toHaveBeenCalledWith([
      { op: 'set', path: ['showSidebarQuota'], value: true },
      { op: 'set', path: ['usagePillStyle'], value: 'plain' },
    ], expect.any(Number))
    expect(host.form.getSnapshot().user).toMatchObject({ showSidebarQuota: true, usagePillStyle: 'plain' })
    expect(snapshot().dirty).toBe(false)
    actions.edit('usagePillStyle', 'neon')
    actions.edit('showSidebarQuota', '1')
    expect(snapshot()).toMatchObject({ invalid: true, showSidebarQuota: { invalid: true }, usagePillStyle: { invalid: true } })
    await controller.save()
    expect(host.mutate).toHaveBeenCalledTimes(1)
  })

  it('stages and saves the visual theme without changing the applied theme early', async () => {
    const { host, controller, actions, snapshot } = setup()
    expect(snapshot()).toMatchObject({ appearanceTheme: { text: 'native' }, appliedAppearanceTheme: 'native' })
    actions.edit('appearanceTheme', 'classic')
    expect(snapshot()).toMatchObject({ appearanceTheme: { text: 'classic' }, appliedAppearanceTheme: 'native', dirty: true })
    await controller.save()
    expect(host.mutate).toHaveBeenCalledExactlyOnceWith([{ op: 'set', path: ['appearanceTheme'], value: 'classic' }], expect.any(Number))
    expect(snapshot()).toMatchObject({ appearanceTheme: { text: 'classic' }, appliedAppearanceTheme: 'classic', dirty: false })
    actions.edit('appearanceTheme', 'system')
    expect(snapshot()).toMatchObject({ appearanceTheme: { invalid: true }, appliedAppearanceTheme: 'classic', invalid: true })
    await controller.save()
    expect(host.mutate).toHaveBeenCalledTimes(1)
  })

  it('defaults, persists and resets the Free channel opt-in as an independent typed value', async () => {
    const { host, controller, actions, snapshot } = setup()
    expect(editableKeys).toEqual(expect.arrayContaining(['freeEnabled']))
    expect(snapshot()).toMatchObject({ freeEnabled: { text: 'false', overridden: false, invalid: false } })
    actions.edit('freeEnabled', 'true')
    await controller.save()
    expect(host.mutate).toHaveBeenCalledExactlyOnceWith([{ op: 'set', path: ['freeEnabled'], value: true }], 0)
    expect(host.form.getSnapshot().user).toMatchObject({ freeEnabled: true })
    expect(snapshot()).toMatchObject({ freeEnabled: { text: 'true' }, dirty: false, usageDisplay: { text: 'auto' } })
    actions.edit('freeEnabled', 'false')
    await controller.save()
    expect(host.form.getSnapshot().user).toMatchObject({ freeEnabled: false })
    actions.resetField('freeEnabled')
    expect(snapshot().freeEnabled).toMatchObject({ text: 'false', overridden: false })
  })

  it('keeps the Free channel draft and reports a refused opt-in without touching other fields', async () => {
    const { host, controller, actions, snapshot } = setup()
    host.mutate.mockResolvedValueOnce(false)
    actions.edit('refreshMinutes', '30')
    actions.edit('freeEnabled', 'true')
    await controller.save()
    expect(snapshot()).toMatchObject({ failed: true, dirty: true, saving: false,
      freeEnabled: { text: 'true' }, refreshMinutes: { text: '30' } })
    expect(host.form.getSnapshot().user).toEqual({})
    await controller.save()
    expect(host.mutate).toHaveBeenLastCalledWith([
      { op: 'set', path: ['refreshMinutes'], value: 30 },
      { op: 'set', path: ['freeEnabled'], value: true },
    ], 0)
    expect(snapshot()).toMatchObject({ failed: false, dirty: false })
  })

  it('resets appearance to inherited values without changing the selected account', async () => {
    const value = { apiKeyEnv: 'ACCOUNT_A', showSidebarQuota: false, usagePillStyle: 'badge' as const }
    const { host, controller, actions, snapshot } = setup(value)
    host.publish({ base: { showSidebarQuota: true, usagePillStyle: 'plain' }, user: value })
    actions.resetField('showSidebarQuota')
    actions.resetField('usagePillStyle')
    await controller.save()
    expect(snapshot()).toMatchObject({ showSidebarQuota: { text: 'true' }, usagePillStyle: { text: 'plain' } })
    expect(host.form.getSnapshot().value?.apiKeyEnv).toBe('ACCOUNT_A')
    expect(host.form.getSnapshot().user).toEqual({ apiKeyEnv: 'ACCOUNT_A' })
  })

  it.each(['baseURL', 'freeBaseURL'] as const)('validates %s drafts before saving', async field => {
    const { host, controller, actions, snapshot } = setup()
    for (const value of ['invalid', 'ftp://gateway.example', 'https://gateway.example/v1?key=x', 'https://gateway.example/v1#fragment',
      'https://gateway-user:gateway-super-secret@gateway.example/v1']) {
      actions.edit(field, value)
      expect(snapshot()[field].invalid).toBe(true)
      await controller.save()
      expect(host.mutate).not.toHaveBeenCalled()
    }
    actions.edit(field, 'https://gateway.example/prefix/v1')
    expect(snapshot()[field].invalid).toBe(false)
    await controller.save()
    expect(host.form.getSnapshot().value?.[field]).toBe('https://gateway.example/prefix/v1')
  })

  it('sends typed capacity objects and text fields together at one revision', async () => {
    const { host, controller, actions, snapshot } = setup({ refreshMinutes: 60 })
    const limits = { m: { contextWindow: 131072, maxTokens: 8192, thinkingBudgets: [4096] } }
    actions.editModelLimits(limits)
    limits.m.maxTokens = 1
    actions.edit('refreshMinutes', '30')
    expect(snapshot()).toMatchObject({ dirty: true, modelLimitDraft: { m: { maxTokens: 8192 } } })
    await controller.save()
    expect(host.mutate).toHaveBeenCalledExactlyOnceWith([
      { op: 'set', path: ['modelLimits'], value: { m: { contextWindow: 131072, maxTokens: 8192, thinkingBudgets: [4096] } } },
      { op: 'set', path: ['refreshMinutes'], value: 30 },
    ], 0)
    expect(snapshot().dirty).toBe(false)
    expect(typeof host.form.getSnapshot().value?.modelLimits).toBe('object')
  })

  it.each(['refused', 'rejected'] as const)('preserves every draft after a %s batch', async outcome => {
    const { host, controller, actions, snapshot } = setup()
    actions.edit('baseURL', 'https://new.invalid/v1')
    actions.editModelLimits({ m: null })
    if (outcome === 'refused') host.mutate.mockResolvedValueOnce(false)
    else host.mutate.mockRejectedValueOnce(new Error('SETTINGS_CONFLICT'))
    await controller.save()
    expect(snapshot()).toMatchObject({ failed: true, dirty: true, saving: false,
      baseURL: { text: 'https://new.invalid/v1' }, modelLimitDraft: { m: null } })
    await controller.save()
    expect(snapshot()).toMatchObject({ failed: false, dirty: false })
  })

  it('preserves a newer draft while the accepted older save completes', async () => {
    const { host, controller, actions, snapshot } = setup({ refreshMinutes: 60 })
    const pending = Promise.withResolvers<boolean>()
    host.mutate.mockReturnValueOnce(pending.promise)
    actions.edit('refreshMinutes', '30')
    const saving = controller.save()
    actions.edit('refreshMinutes', '15')
    await controller.save()
    expect(host.mutate).toHaveBeenCalledTimes(1)
    pending.resolve(true)
    await saving
    expect(snapshot()).toMatchObject({ dirty: true, saving: false, refreshMinutes: { text: '15' } })
    await controller.save()
    expect(host.form.getSnapshot().value?.refreshMinutes).toBe(15)
  })

  it.each(['-1', '0', '1.5', 'Infinity', 'abc'])('blocks an invalid image count %s without writing', async text => {
    const { host, controller, actions, snapshot } = setup()
    actions.edit('maxImages', text)
    expect(snapshot()).toMatchObject({ dirty: true, invalid: true })
    await controller.save()
    expect(host.mutate).not.toHaveBeenCalled()
    actions.discard()
    expect(snapshot()).toMatchObject({ dirty: false, invalid: false })
  })

  const invalidNumericDrafts: ReadonlyArray<readonly [TextField, string]> = [
    ['refreshMinutes', '0'], ['refreshMinutes', '-1'], ['refreshMinutes', '1.5'], ['refreshMinutes', '10081'], ['refreshMinutes', 'abc'],
    ['streamIdleTimeoutMs', '0'], ['streamIdleTimeoutMs', '-1'], ['streamIdleTimeoutMs', '2147483648'], ['streamIdleTimeoutMs', 'Infinity'],
    ['requestPreparationTimeoutMs', '0'], ['requestPreparationTimeoutMs', '-1'], ['requestPreparationTimeoutMs', '1.5'],
    ['requestPreparationTimeoutMs', '2147483648'],
    ['requestTimeoutMs', '0'], ['requestTimeoutMs', '-1'], ['requestTimeoutMs', '1.5'], ['requestTimeoutMs', '2147483648'],
    ['maxImages', '0'], ['maxImages', '-1'], ['maxImages', '1.5'], ['maxImages', '9007199254740992'],
    ['maxRequestImageBytes', '0'], ['maxRequestImageBytes', '1.5'],
    ['requestImagePixelBudget', '0'], ['requestImagePixelBudget', '1.5'],
    ['requestImageMaxBytes', '0'], ['requestImageMaxBytes', '1.5'],
  ]

  it.each(invalidNumericDrafts)('marks %s=%s invalid and blocks Save', async (field, text) => {
    const { host, controller, actions, snapshot } = setup()
    actions.edit(field, text)
    expect(snapshot()[field]).toMatchObject({ invalid: true })
    expect(snapshot()).toMatchObject({ dirty: true, invalid: true })
    await controller.save()
    expect(host.mutate).not.toHaveBeenCalled()
    actions.discard()
    expect(snapshot()[field].invalid).toBe(false)
  })

  const validNumericDrafts: ReadonlyArray<readonly [TextField, string, number]> = [
    ['refreshMinutes', '1', 1], ['refreshMinutes', '10080', 10080],
    ['streamIdleTimeoutMs', '0.5', 0.5], ['streamIdleTimeoutMs', '2147483647', 2147483647],
    ['requestPreparationTimeoutMs', '1', 1], ['requestTimeoutMs', '2147483647', 2147483647],
    ['maxImages', '1', 1], ['maxImages', '9007199254740991', Number.MAX_SAFE_INTEGER],
    ['maxRequestImageBytes', '1', 1], ['requestImagePixelBudget', '1', 1], ['requestImageMaxBytes', '1', 1],
  ]

  it.each(validNumericDrafts)('accepts the in-range draft %s=%s', async (field, text, expected) => {
    const { host, controller, actions, snapshot } = setup()
    actions.edit(field, text)
    expect(snapshot()[field].invalid).toBe(false)
    await controller.save()
    expect(host.form.getSnapshot().value?.[field]).toBe(expected)
  })

  it('projects the Host namespace status through loading, ready and unavailable', () => {
    const host = createConfigForm<OpencodeGoSettings>()
    const controller = new OpencodeGoSectionController(host.form, {} as never)
    controllers.push(controller)
    const snapshot = controller.inject().hooks.opencodeGo.getSnapshot
    expect(snapshot()).toMatchObject({ status: 'loading' })
    host.publish({ status: 'ready', writable: true, value: {} })
    expect(snapshot()).toMatchObject({ status: 'ready' })
    host.publish({ status: 'unavailable' })
    expect(snapshot()).toMatchObject({ status: 'unavailable' })
  })

  it('reports a refused provider switch separately from a refused model visibility', async () => {
    const host = createConfigForm(defaultClientSettings)
    const controller = new OpencodeGoSectionController(host.form, {} as never,
      async () => ({ ok: true, value: { stale: false, models: [] } }))
    controllers.push(controller)
    const face = controller.inject()
    host.set.mockResolvedValueOnce(false)
    render(<OpencodeGoSection {...face} t={translator('en')} useOpencodeGo={bindSnapshotSelector(face.hooks.opencodeGo)} />)
    const provider = screen.getByRole<HTMLButtonElement>('switch', { name: en.enabledLabel })
    await act(async () => { fireEvent.click(provider) })
    expect(host.set).toHaveBeenCalledExactlyOnceWith('enabled', false)
    expect(face.hooks.opencodeGo.getSnapshot()).toMatchObject({ enabledFailed: true, pickerFailed: false })
    expect(screen.getByRole('alert').textContent).toBe(en.enabledFailed)
    expect(screen.queryByText(en.pickerFailed)).toBeNull()
  })

  it('previews inherited resets, and treats structurally equal capacity maps as clean', async () => {
    const { host, controller, actions, snapshot } = setup({ refreshMinutes: 15, modelLimits: { m: { maxTokens: 8192 } } })
    host.publish({ base: { refreshMinutes: 60 }, user: { refreshMinutes: 15 } })
    actions.editModelLimits({ m: { maxTokens: 8192 } })
    expect(snapshot().dirty).toBe(false)
    actions.resetField('refreshMinutes')
    expect(snapshot().refreshMinutes).toMatchObject({ text: '60', overridden: false })
    await controller.save()
    expect(host.mutate).toHaveBeenCalledExactlyOnceWith([{ op: 'unset', path: ['refreshMinutes'] }], 0)
    expect(host.form.getSnapshot().value?.refreshMinutes).toBe(60)
  })

  it('keeps drafts while read-only and binds ConfigForm prototype methods correctly', async () => {
    const { host, controller, actions, snapshot } = setup()
    expect(host.listenerCount()).toBe(1)
    host.publish({ writable: false })
    actions.edit('proxyURL', 'socks5://127.0.0.1:1080')
    await controller.save()
    await controller.setEnabled(false)
    expect(host.mutate).not.toHaveBeenCalled()
    expect(host.set).not.toHaveBeenCalled()
    expect(snapshot().dirty).toBe(true)
    host.publish({ writable: true })
    await controller.save()
    expect(host.form.getSnapshot().value?.proxyURL).toBe('socks5://127.0.0.1:1080')
    controller.dispose()
    expect(host.listenerCount()).toBe(0)
  })

  it('resets Free gateway and usage mode to inherited values while preserving account selection', async () => {
    const value = { apiKeyEnv: 'ACCOUNT_A', usageDisplay: 'always' as const, freeBaseURL: 'https://free.example/v1' }
    const { host, controller, actions, snapshot } = setup(value)
    host.publish({ base: { usageDisplay: 'auto', freeBaseURL: 'https://opencode.ai/inference/v1' }, user: value })
    actions.edit('usageDisplay', 'off')
    actions.edit('freeBaseURL', 'https://new-free.example/v1')
    await controller.save()
    expect(host.form.getSnapshot().value).toMatchObject({ apiKeyEnv: 'ACCOUNT_A', usageDisplay: 'off', freeBaseURL: 'https://new-free.example/v1' })
    actions.resetField('usageDisplay')
    actions.resetField('freeBaseURL')
    await controller.save()
    expect(snapshot().usageDisplay.text).toBe('auto')
    expect(snapshot().freeBaseURL.text).toBe('https://opencode.ai/inference/v1')
    expect(host.form.getSnapshot().value?.apiKeyEnv).toBe('ACCOUNT_A')
  })
})

describe('client registration and remote lifecycle', () => {
  function clientHarness() {
    const settings = createConfigForm<OpencodeGoSettings>({})
    const effects: unknown[] = []
    const listeners = new Set<(ref: string) => void>()
    const slotsRegister = vi.fn(() => () => {})
    const slotsInject = vi.fn((_slot: string, install: () => void) => install())
    const localeRegister = vi.fn(() => () => {})
    const analyticsRead = vi.fn(async (query: AnalyticsQuery, _signal?: AbortSignal) => ({ ok: true, value: createAnalyticsReport(query) }))
    const analyticsExport = vi.fn(async (_query: AnalyticsQuery, _signal?: AbortSignal) => ({ ok: true, value: { filename: 'usage.csv', csv: 'date,requests\n2026-11-05,12\n' } }))
    const configForms = { get: vi.fn(() => settings.form) }
    const serviceRequests: string[][] = []
    const ctx = {
      configForms,
      inject: (services: string[], install: (ready: unknown) => void) => {
        serviceRequests.push([...services])
        if (services.every(path => path.split('.').reduce<unknown>((value, key) =>
          value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, ctx))) install(ctx)
      },
      effect: (install: () => unknown) => { effects.push(install()); return () => {} },
      locale: { register: localeRegister, getLocale: () => ({ active: 'en' }), bind: () => (key: keyof typeof en) => en[key] },
      remote: {
        $mount: vi.fn(async () => () => {}),
        $on: vi.fn((_event: string, listener: (ref: string) => void) => { listeners.add(listener); return () => listeners.delete(listener) }),
        opencodeGoModels: { read: vi.fn(async () => ({ ok: true, value: { models: [], stale: false } })) },
        opencodeGoAccounts: { execute: vi.fn(async () => ({ ok: true, value: 'applied' })) },
        opencodeGoAnalytics: { read: analyticsRead, exportCsv: analyticsExport },
        credentials: { describe: vi.fn(async () => ({ ok: true, value: {} })) },
        llm: { discoverModels: vi.fn(async () => ({ ok: true, value: [] })) },
      },
      slots: { inject: slotsInject, register: slotsRegister },
    }
    return { ctx, settings, slotsRegister, slotsInject, localeRegister, configForms, analyticsRead, analyticsExport, listeners, serviceRequests,
      dispose: async () => { for (const effect of effects.splice(0).reverse()) { const dispose = await effect; if (typeof dispose === 'function') dispose() } },
    }
  }

  function conversationHarness() {
    const harness = clientHarness()
    harness.settings.publish({ status: 'ready', writable: true, value: { usageDisplay: 'always', apiKeyEnv: 'ACCOUNT_A', accounts: [
      { id: 'primary', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
    ] } })
    const directory = createSnapshotStore<ModelDirectoryState>({ current: { provider: 'dsh-opencode-go', model: 'alpha' }, routable: true,
      groups: [], failures: [], status: 'ready', error: null })
    const window = { status: 'ok', percent: 10, resetsAt: '2026-12-01T00:00:00Z' }
    const read = vi.fn(async () => ({ ok: true, value: { rolling: window, weekly: window, monthly: window } }))
    // Only the model directory is read from this scope: the slot itself supplies the
    // session id, so the session and session-remote services are not dependencies.
    Object.assign(harness.ctx, { modelDirectories: { directoryFor: () => ({ store: directory }) } })
    Object.assign(harness.ctx.remote, { opencodeGoUsage: { read, readAccount: read } })
    apply(harness.ctx as never)
    const entries = harness.slotsRegister.mock.calls as unknown as Array<[{ id: string; inject: (session: string) => UsagePillProps }]>
    const props = entries.find(([entry]) => entry.id === 'opencode-go-usage')![0].inject('session-a')
    return { ...harness, props }
  }

  it('mounts the current ConfigForm and dictionaries, registers the page and releases its subscriptions', async () => {
    const harness = clientHarness()
    apply(harness.ctx as never)
    expect(harness.configForms.get).toHaveBeenCalledExactlyOnceWith('opencode-go')
    expect(harness.localeRegister).toHaveBeenCalledWith('settings.opencode-go', { en, zh })
    expect(harness.slotsInject).toHaveBeenCalledWith('settings.section', expect.any(Function))
    const [registration, component] = harness.slotsRegister.mock.calls[0] as unknown as [
      { id: string; label: () => string; inject: () => { getLocale: () => string } }, unknown,
    ]
    expect(registration.id).toBe('opencode-go')
    expect(registration.label()).toBe(en.nav)
    expect(registration.inject().getLocale()).toBe('en')
    expect(component).toBe(OpencodeGoSection)
    expect(harness.listeners.size).toBe(1)
    expect(harness.settings.listenerCount()).toBe(1)
    await harness.dispose()
    expect(harness.listeners.size).toBe(0)
    expect(harness.settings.listenerCount()).toBe(0)
  })

  it('declares only the client services the browser half actually uses', async () => {
    const harness = conversationHarness()
    try {
      // Top-level fiber inject: every name here stops apply() until the host provides
      // it, so it must stay at the services apply() itself reads.
      expect(clientInject).toEqual(['slots', 'locale', 'remote', 'remote.credentials'])
      const nested = [...new Set(harness.serviceRequests.map(services => [...services].sort().join(',')))].sort()
      expect(nested).toEqual([
        'configForms,remote.opencodeGoModels',
        'modelDirectories',
        'remote.opencodeGoAccounts',
        'remote.opencodeGoAnalytics',
        'remote.opencodeGoUsage',
      ].sort())
      // Anti-drift guard: a declared service that is never read anywhere else only
      // gates the whole surface on a dependency nobody needs.
      const declared = new Set<string>([...clientInject, ...harness.serviceRequests.flat()])
      const sources = ['index.ts', 'controller.ts', 'Section.tsx', 'UsagePill.tsx', 'AnalyticsDialog.tsx', 'presentation.ts']
        .map(name => readFileSync(resolve('src/client', name), 'utf8'))
        .map(text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))
        .join('\n')
      for (const service of declared) {
        expect(sources.split(service).length - 1, `${service} must be read, not only injected`).toBeGreaterThanOrEqual(2)
      }
    } finally { await harness.dispose() }
  })

  it('forwards account-scoped history and CSV queries with cancellation through the conversation pill', async () => {
    const harness = conversationHarness()
    const face = harness.props
    const query: AnalyticsQuery = { accountRef: 'ACCOUNT_A', range: '7d' }
    const controller = new AbortController()
    try {
      await expect(face.readAnalytics!(query, controller.signal)).resolves.toMatchObject({ accountRef: 'ACCOUNT_A', period: '7d' })
      await expect(face.exportAnalytics!(query, controller.signal)).resolves.toMatchObject({ filename: 'usage.csv' })
      expect(harness.analyticsRead).toHaveBeenCalledExactlyOnceWith(query, controller.signal)
      expect(harness.analyticsExport).toHaveBeenCalledExactlyOnceWith(query, controller.signal)
    } finally { await harness.dispose() }
  })

  it('opens history from the conversation pill and cancels superseded or closed queries', async () => {
    const harness = conversationHarness()
    const signals: (AbortSignal | undefined)[] = []
    harness.analyticsRead.mockImplementation((_query: AnalyticsQuery, signal?: AbortSignal) => {
      signals.push(signal)
      return new Promise(resolve => signal?.addEventListener('abort', () => resolve({ ok: false,
        error: Object.assign(new Error('cancelled'), { code: 'gateway/cancelled' }) }), { once: true }))
    })
    const view = render(<UsagePill {...harness.props} />)
    try {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: new RegExp(en.usageTitle) })) })
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsOpen })) })
      expect(signals).toHaveLength(1)
      expect(signals[0]?.aborted).toBe(false)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsRange7d })) })
      expect(signals).toHaveLength(2)
      expect(signals[0]?.aborted).toBe(true)
      expect(signals[1]?.aborted).toBe(false)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.analyticsClose })) })
      expect(signals[1]?.aborted).toBe(true)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByText(en.analyticsFailed)).toBeNull()
    } finally { view.unmount(); await harness.dispose() }
  })

  it('uses the account service only for its live connection', async () => {
    let connect!: (ready: unknown) => void
    let disconnect!: () => void
    const execute = vi.fn(async () => ({ ok: true, value: 'applied' }))
    const command = accountCommands({ inject: (_services: unknown, install: typeof connect) => { connect = install } } as never)
    await expect(command({ kind: 'auto-switch', value: true })).resolves.toBe('unknown')
    connect({ remote: { opencodeGoAccounts: { execute } }, effect: (install: () => () => void) => { disconnect = install() } })
    await expect(command({ kind: 'auto-switch', value: true })).resolves.toBe('applied')
    disconnect()
    await expect(command({ kind: 'auto-switch', value: false })).resolves.toBe('unknown')
    expect(execute).toHaveBeenCalledExactlyOnceWith({ kind: 'auto-switch', value: true })
  })
  it('registers the conversation pill with live account commands and filters credential invalidations', async () => {
    const harness = clientHarness()
    harness.settings.publish({ value: { accounts: [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' }], apiKeyEnv: 'ACCOUNT_A' } })
    const directory = createSnapshotStore<ModelDirectoryState>({
      current: { provider: 'dsh-opencode-go', model: 'alpha' }, routable: true,
      groups: [], failures: [], status: 'ready', error: null,
    })
    const quota = { rolling: { status: 'ok', percent: 10, resetsAt: '2026-12-01T00:00:00Z' } }
    const read = vi.fn(async () => ({ ok: true, value: quota }))
    Object.assign(harness.ctx, { sessions: {}, modelDirectories: { directoryFor: vi.fn(() => ({ store: directory })) } })
    Object.assign(harness.ctx.remote, { session: {}, opencodeGoUsage: { read } })
    apply(harness.ctx as never)
    const registrations = harness.slotsRegister.mock.calls as unknown as Array<[{ id: string; inject: (sessionId: string) => UsagePillProps }]>
    const registration = registrations.find(([entry]) => entry.id === 'opencode-go-usage')![0]
    const face = registration.inject('session-a')
    expect(face.directory).toBe(directory)
    expect(face.settings).toBe(harness.settings.form)
    await expect(face.readUsage()).resolves.toEqual(quota)
    expect(face.credentialChanges!.getSnapshot()).toBe(0)
    for (const listener of harness.listeners) listener('SOME_OTHER_KEY')
    expect(face.credentialChanges!.getSnapshot()).toBe(0)
    for (const listener of harness.listeners) listener('ACCOUNT_A')
    expect(face.credentialChanges!.getSnapshot()).toBe(1)
    await expect(face.selectAccount!('MISSING')).resolves.toBe(false)
    await expect(face.selectAccount!('ACCOUNT_A')).resolves.toBe(true)
    expect(harness.ctx.remote.opencodeGoAccounts.execute).toHaveBeenCalledExactlyOnceWith({ kind: 'select', ref: 'ACCOUNT_A' })
    harness.settings.publish({ writable: false })
    await expect(face.selectAccount!('ACCOUNT_A')).resolves.toBe(false)
    await harness.dispose()
    expect(harness.listeners.size).toBe(0)
  })

  it('registers sidebar quota at the root without requiring a conversation or model directory', async () => {
    const harness = clientHarness()
    harness.settings.publish({ value: { showSidebarQuota: true, usageDisplay: 'off', apiKeyEnv: 'ACCOUNT_A', accounts: [
      { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' }, { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
    ] } })
    const original = harness.settings.form.getSnapshot()
    const window = { status: 'ok', percent: 12, resetsAt: '2026-12-01T00:00:00Z' }
    const read = vi.fn(async () => ({ ok: true, value: { rolling: window, weekly: window, monthly: window } }))
    const readAccount = vi.fn(async (_ref: string) => ({ ok: true, value: { rolling: window, weekly: window, monthly: window } }))
    Object.assign(harness.ctx.remote, { opencodeGoUsage: { read, readAccount } })
    apply(harness.ctx as never)
    expect(harness.slotsInject).toHaveBeenCalledWith('sidebar.footer.action', expect.any(Function))
    expect(harness.slotsInject).not.toHaveBeenCalledWith('conversation.input.right', expect.any(Function))
    const registrations = harness.slotsRegister.mock.calls as unknown as Array<[
      { id: string; name: string; inject: () => Omit<SidebarQuotaProps, 'wide'> }, unknown,
    ]>
    const [registration, component] = registrations.find(([entry]) => entry.id === 'opencode-go-sidebar-quota')!
    expect(registration.name).toBe('sidebar.footer.action')
    expect(component).toBe(SidebarQuota)
    const props = registration.inject()
    let view!: ReturnType<typeof render>
    await act(async () => { view = render(<SidebarQuota {...props} wide />) })
    expect(screen.getByText('OpenCode Go')).toBeTruthy()
    expect(readAccount).toHaveBeenCalledExactlyOnceWith('ACCOUNT_A')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${en.sidebarNextAccount}: Primary` })) })
    expect(readAccount).toHaveBeenLastCalledWith('ACCOUNT_B')
    expect(screen.getByRole('button', { name: `${en.sidebarNextAccount}: Backup` })).toBeTruthy()
    expect(read).not.toHaveBeenCalled()
    expect(harness.ctx.remote.opencodeGoAccounts.execute).not.toHaveBeenCalled()
    expect(harness.settings.form.getSnapshot()).toBe(original)
    expect(harness.settings.set).not.toHaveBeenCalled()
    expect(harness.settings.mutate).not.toHaveBeenCalled()
    view.unmount()
    await harness.dispose()
    expect(harness.listeners.size).toBe(0)
  })

})
