// @vitest-environment jsdom

/**
 * The OpenCode Go settings page component: the key control and its badge, the
 * gateway model listing it reads on mount, the advanced disclosure that holds
 * the tuning fields, the save/discard actions, and the unavailable posture.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from './support/client.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { OpencodeGoSection } from '../src/client/Section.tsx'
import type { OpencodeGoSectionProps, OpencodeGoSectionState } from '../src/client/Section.tsx'
import { OpencodeGoSectionController, type OpencodeGoSettings } from '../src/client/section-controller.ts'
import { stubSettingsScope } from './support/client.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en, params?: Record<string, unknown>): string =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    en[key],
  )

function field(text: string, rest: Partial<OpencodeGoSectionState['baseURL']> = {}): OpencodeGoSectionState['baseURL'] {
  return { text, overridden: false, invalid: false, ...rest }
}

type SectionField = 'baseURL' | 'proxyURL' | 'apiKeyEnv' | 'refreshMinutes' | 'streamIdleTimeoutMs'
  | 'usageDisplay'
  | 'maxImages'
  | 'maxRequestImageBytes' | 'requestImagePixelBudget' | 'requestImageMaxBytes' | 'apiKey' | 'models'
  | 'modelLimits' | 'modelLimitDraft'

const settled: Omit<OpencodeGoSectionState, SectionField> = {
  available: true,
  writable: true,
  dirty: false,
  invalid: false,
  saving: false,
  failed: false,
  enabled: true,
  modelVisibility: {},
  pickerSaving: false,
  pickerFailed: false,
  apiKeyConfigured: false,
  apiKeyWritable: true,
}

type ModelEntry = import('../src/models-contract.ts').GoModel

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
    apiKeyEnv: field('OPENCODE_API_KEY'),
    baseURL: field('https://opencode.ai/zen/go/v1'),
    proxyURL: field(''),
    refreshMinutes: field('60'),
    streamIdleTimeoutMs: field('300000'),
    maxImages: field(''),
    maxRequestImageBytes: field('20971520'),
    requestImagePixelBudget: field('4194304'),
    requestImageMaxBytes: field('1048576'),
    apiKey: field(''),
    modelLimits: field(''),
    modelLimitDraft: {},
    models: { status: 'idle' },
    ...overrides,
  }
}

function actions() {
  return {
    edit: vi.fn(),
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
  options: { foldedModels?: boolean } = {},
) {
  const store = createSnapshotStore(state)
  const props = {
    ...actions(),
    ...overrides,
    t,
    useOpencodeGo: bindSnapshotSelector(store),
  } as unknown as OpencodeGoSectionProps
  render(<OpencodeGoSection {...props} />)
  // The page ships with the model card folded; most of these tests are about what
  // is inside it, so they open it the way a reader would.
  if (options.foldedModels !== true) openModelLimits()
  return store
}

/** The page's advanced disclosure starts collapsed; open it before its fields. */
function openAdvanced(): void {
  fireEvent.click(screen.getByText(en.advancedLabel))
}

/** The model card ships folded; open it before its list and its capacities. */
function openModelLimits(): void {
  // Nothing is served in the unavailable posture, and then there is no card.
  const trigger = document.querySelector('[aria-controls="opencode-go-models"]')
  if (trigger !== null) fireEvent.click(trigger)
}

describe('OpencodeGoSection', () => {
  it('stages the three usage display modes in advanced settings and offers reset', () => {
    const reading = actions()
    renderSection(stateOf({ usageDisplay: field('always', { overridden: true }) }), reading)
    expect(screen.queryByRole('combobox', { name: en.usageDisplayLabel })).toBeNull()
    openAdvanced()
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: en.usageDisplayLabel })
    expect(select.value).toBe('always')
    expect(within(select).getAllByRole('option').map(option => option.textContent))
      .toEqual([en.usageDisplay_auto, en.usageDisplay_always, en.usageDisplay_off])
    fireEvent.change(select, { target: { value: 'off' } })
    expect(reading.edit).toHaveBeenCalledWith('usageDisplay', 'off')
    expect(reading.save).not.toHaveBeenCalled()
    fireEvent.click(within(select.parentElement!).getByRole('button', { name: en.reset }))
    expect(reading.resetField).toHaveBeenCalledWith('usageDisplay')
  })

  it('disables usage display editing in a read-only deployment', () => {
    renderSection(stateOf({ writable: false }))
    openAdvanced()
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: en.usageDisplayLabel }).disabled).toBe(true)
  })

  it('renders nothing until every injected seat is present', () => {
    const { container } = render(<OpencodeGoSection t={t} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the unavailable posture while the namespace is not served', () => {
    const reading = actions()
    renderSection(stateOf({ available: false }), reading)
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
    renderSection(stateOf({ enabled: true }), reading)

    const control = screen.getByRole('switch', { name: en.enabledLabel })
    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(en.enabledHint)).toBeTruthy()

    // The toggle writes on the click: no save gesture stands between the user
    // and the route leaving the pickers.
    fireEvent.click(control)
    expect(reading.setEnabled).toHaveBeenCalledWith(false)
    expect(reading.save).not.toHaveBeenCalled()
  })

  it('explains the withdrawn state while the switch is off', () => {
    renderSection(stateOf({ enabled: false }))

    expect(screen.getByRole('switch', { name: en.enabledLabel }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText(en.enabledOff)).toBeTruthy()
  })

  it('locks the switch with the same read-only document that locks the form', () => {
    renderSection(stateOf({ writable: false }))

    expect(screen.getByRole('switch', { name: en.enabledLabel }).hasAttribute('disabled')).toBe(true)
  })

  it('shows the key state and the models the gateway serves', () => {
    renderSection(stateOf({
      apiKeyConfigured: true,
      models: listing([
        { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' },
        { id: 'kimi-k2', name: 'Kimi K2' },
      ]),
    }))

    expect(screen.getByText(en.keyConfigured)).toBeTruthy()
    // The listing's size shows on the filter that selects all of it, not in the
    // card header it used to be repeated in.
    expect(screen.getByRole('button', { name: en.filterAll + ' 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /DeepSeek V4\.1 Flash/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Kimi K2/ })).toBeTruthy()
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
    const nav = () => screen.getByRole('navigation', { name: en.modelsLabel })
    expect(within(nav()).getAllByRole('button').map(button => button.textContent?.split(' ')[0])).toEqual(['New', 'Normal', 'Old'])
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.filterDeprecated + ' 1') }))
    expect(within(nav()).getAllByRole('button')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText(en.limitsFilterLabel), { target: { value: 'new' } })
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('shows one selected model editor immediately alongside the searchable list', () => {
    renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
    expect(screen.getByRole('navigation', { name: en.modelsLabel })).toBeTruthy()
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
    const nav = screen.getByRole('navigation', { name: en.modelsLabel })
    expect(nav.querySelector('[title="' + en.overridden + '"]')).toBeTruthy()
    expect(screen.getByText(t('limitsSummary', { count: 1 }))).toBeTruthy()
  })

  it('keeps the compact row to the model name and its badges', () => {
    const today = new Date().toISOString().slice(0, 10)
    renderSection(stateOf({ models: listing([{ id: 'fresh-model', name: 'Fresh', releaseDate: today }]) }))
    const row = within(screen.getByRole('navigation', { name: en.modelsLabel })).getByRole('button')
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
    expect(edits.edit).toHaveBeenCalledWith(
      'modelLimits',
      '{"deepseek-v4.1-flash":{"contextWindow":262144}}',
    )

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
    expect(edits.edit).toHaveBeenCalledWith('modelLimits', '{"deepseek-v4.1-flash":null}')
  })

  it('stages clearing one field without dropping the other or restoring an inherited value', () => {
    const edits = actions()
    renderSection(stateOf({
      models: listing([{ id: 'm', name: 'Model' }]),
      modelLimitDraft: { m: { contextWindow: 123456, maxTokens: 1024 }, previous: null },
    }), edits)
    fireEvent.change(screen.getByLabelText(t('limitsContextLabel', { name: 'Model' })), { target: { value: '' } })
    expect(edits.edit).toHaveBeenCalledWith('modelLimits', '{"m":{"contextWindow":null,"maxTokens":1024},"previous":null}')
    fireEvent.click(screen.getByRole('button', { name: en.limitsResetAll }))
    expect(edits.edit).toHaveBeenCalledWith('modelLimits', '{"m":null,"previous":null}')
  })

  it('does not count explicit catalog resets as customized models', () => {
    renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]), modelLimitDraft: { m: null } }))
    expect(screen.getByText(t('limitsSummary', { count: 0 }))).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.limitsResetModel })).toBeNull()
    expect(screen.queryByRole('button', { name: en.limitsResetAll })).toBeNull()
  })

  it('ships the model card folded and opens it on demand', () => {
    renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }), {}, { foldedModels: true })
    const trigger = screen.getByRole('button', { name: en.modelsLabel })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('opencode-go-models')).toBeNull()
    expect(screen.queryByRole('navigation', { name: en.modelsLabel })).toBeNull()

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('opencode-go-models')).not.toBeNull()
    expect(screen.getByRole('navigation', { name: en.modelsLabel })).toBeTruthy()

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('opencode-go-models')).toBeNull()
  })

  it('keeps what the model card reports out of the fold', () => {
    // The card ships folded, so a notice behind it is a notice nobody reads:
    // the refused switch write and the listing's own diagnostics both show.
    renderSection(stateOf({ pickerFailed: true, models: listing([{ id: 'm', name: 'Model' }]) }), {}, { foldedModels: true })
    expect(screen.getByRole('button', { name: en.modelsLabel }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText(en.pickerFailed)).toBeTruthy()

    cleanup()
    renderSection(stateOf({ models: { status: 'failed', message: 'offline' } }), {}, { foldedModels: true })
    expect(screen.getByRole('button', { name: en.modelsLabel }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText(en.modelsFailed)).toBeTruthy()
    expect(screen.getByText('offline')).toBeTruthy()

    // A healthy listing still leaves the folded card with nothing to say.
    cleanup()
    renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }), {}, { foldedModels: true })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: en.modelsLabel }).textContent).toBe(en.modelsLabel)
  })

  it('keeps the header to the title and the disclosure, with refresh on the filter row', () => {
    renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
    expect(screen.getByRole('button', { name: en.modelsLabel }).textContent).toBe(en.modelsLabel)

    const refresh = screen.getByRole('button', { name: en.modelsRefresh })
    const filters = screen.getByRole('group', { name: en.filterLabel })
    expect(filters.contains(refresh)).toBe(true)
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
    expect(edits.edit).toHaveBeenCalledWith('modelLimits', '{"retired":null,"reset":null}')
  })

  it('reports a reading listing, an empty listing, and a failed one', () => {
    renderSection(stateOf())
    expect(screen.getByText(en.modelsLoading)).toBeTruthy()

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

  it('keeps the tuning fields collapsed until the disclosure is opened', () => {
    renderSection(stateOf({ refreshMinutes: field('30', { overridden: true }) }))

    expect(screen.queryByLabelText(en.baseURLLabel)).toBeNull()
    // The collapsed row still says a tuning field carries a user value.
    expect(screen.getByRole('button', { name: new RegExp(en.advancedLabel) }).textContent).toContain(en.overridden)
    expect(screen.queryByText(en.advancedHint)).toBeNull()

    openAdvanced()
    expect(screen.getByLabelText(en.baseURLLabel)).toHaveProperty('value', 'https://opencode.ai/zen/go/v1')
    expect(screen.getByLabelText(en.refreshMinutesLabel)).toHaveProperty('value', '30')
    expect(screen.getByText(en.keyLabel)).toBeTruthy()
  })

  it('ties the advanced disclosure to the region it controls', () => {
    renderSection(stateOf())
    const trigger = screen.getByText(en.advancedLabel).closest('button') as HTMLButtonElement
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe('opencode-go-advanced')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('opencode-go-advanced')).not.toBeNull()
  })

  it('reads down the page as connection, models, then tuning', () => {
    renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(en.titleLabel)
    // The page's order is the product decision: enable, key, models, tuning.
    const sequence = [
      screen.getByRole('switch', { name: en.enabledLabel }),
      screen.getByLabelText(en.keyLabel),
      screen.getByRole('navigation', { name: en.modelsLabel }),
      screen.getByText(en.advancedLabel),
    ]
    for (let index = 1; index < sequence.length; index += 1) {
      const relation = sequence[index - 1].compareDocumentPosition(sequence[index])
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    // The tuning card is the last thing on the page, under the list it tunes.
    const tuning = screen.getByText(en.advancedLabel).closest('section') as HTMLElement
    expect(tuning.parentElement?.lastElementChild).toBe(tuning)
  })

  it('keeps the switch and the key control in one connection card', () => {
    renderSection(stateOf({ models: listing([{ id: 'm', name: 'Model' }]) }))
    const connection = screen.getByRole('switch', { name: en.enabledLabel }).closest('section') as HTMLElement
    expect(connection).toBeTruthy()
    expect(within(connection).getByLabelText(en.keyLabel)).toBeTruthy()
    // The models card is a card of its own, not a stray block on the page.
    const models = screen.getByRole('navigation', { name: en.modelsLabel }).closest('section') as HTMLElement
    expect(models).toBeTruthy()
    expect(models).not.toBe(connection)
  })
  it('stages edits through the injected actions and resets on demand', () => {
    const edits = actions()
    renderSection(stateOf({ refreshMinutes: field('60', { overridden: true }) }), edits)
    openAdvanced()

    fireEvent.change(screen.getByLabelText(en.baseURLLabel), { target: { value: 'https://other.test/v1' } })
    expect(edits.edit).toHaveBeenCalledWith('baseURL', 'https://other.test/v1')

    fireEvent.click(screen.getByText(en.reset))
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
      apiKeyEnv: field('OPENCODE_API_KEY', { overridden: true }),
      baseURL: field('https://opencode.ai/zen/go/v1', { overridden: true }),
      refreshMinutes: field('not-a-number', { overridden: true, invalid: true }),
      streamIdleTimeoutMs: field('300000', { overridden: true }),
      maxImages: field('30', { overridden: true }),
      maxRequestImageBytes: field('20971520', { overridden: true }),
      requestImagePixelBudget: field('4194304', { overridden: true }),
      requestImageMaxBytes: field('1048576', { overridden: true }),
    }), edits)

    fireEvent.change(screen.getByLabelText(en.keyLabel), { target: { value: 'secret-value' } })
    expect(edits.edit).toHaveBeenCalledWith('apiKey', 'secret-value')

    openAdvanced()
    const fields: readonly (readonly [label: string, name: string, numeric: boolean])[] = [
      [en.apiKeyEnvLabel, 'apiKeyEnv', false],
      [en.baseURLLabel, 'baseURL', false],
      [en.refreshMinutesLabel, 'refreshMinutes', true],
      [en.streamIdleTimeoutMsLabel, 'streamIdleTimeoutMs', true],
      [en.maxImagesLabel, 'maxImages', true],
      [en.maxRequestImageBytesLabel, 'maxRequestImageBytes', true],
      [en.requestImagePixelBudgetLabel, 'requestImagePixelBudget', true],
      [en.requestImageMaxBytesLabel, 'requestImageMaxBytes', true],
    ]
    const resets = screen.getAllByText(en.reset)
    expect(resets).toHaveLength(fields.length)
    fields.forEach(([label, name, numeric], index) => {
      const input = screen.getByLabelText(label) as HTMLInputElement
      expect(input.inputMode).toBe(numeric ? 'numeric' : '')
      expect(input.type).toBe(numeric ? 'number' : 'text')
      const nextValue = numeric ? '123' : `edited-${name}`
      fireEvent.change(input, { target: { value: nextValue } })
      expect(edits.edit).toHaveBeenCalledWith(name, nextValue)
      fireEvent.click(resets[index] as Element)
      expect(edits.resetField).toHaveBeenCalledWith(name)
    })

    // The invalid refresh draft renders the invalid style and copy.
    expect(screen.getByText(en.invalidValue)).toBeTruthy()
  })

  it('shows the saving state while a save crosses the wire', () => {
    renderSection(stateOf({ dirty: true, saving: true }))
    expect(screen.getByText<HTMLButtonElement>(en.saving).disabled).toBe(true)
    expect(screen.getByText<HTMLButtonElement>(en.discard).disabled).toBe(true)
  })

  it('disables the form for a read-only document but leaves the key state visible', () => {
    renderSection(stateOf({ writable: false, apiKeyConfigured: true }))
    expect(screen.getByText<HTMLButtonElement>(en.save).disabled).toBe(true)
    expect(screen.getByLabelText<HTMLInputElement>(en.keyLabel).disabled).toBe(false)
    expect(screen.getByText(en.readOnly)).toBeTruthy()

    openAdvanced()
    expect(screen.getByLabelText<HTMLInputElement>(en.baseURLLabel).disabled).toBe(true)
  })

  it('reports a key the deployment supplies from elsewhere as read-only', () => {
    renderSection(stateOf({ apiKeyWritable: false }))
    expect(screen.getByLabelText<HTMLInputElement>(en.keyLabel).disabled).toBe(true)
    expect(screen.getByText(en.keyNotWritable)).toBeTruthy()
  })
})

describe('OpencodeGoSectionController through the component', () => {
  it('adds, saves, discards, and removes a custom budget without changing capacities', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    host.set.mockImplementation((field: string, value: unknown) => {
      host.publish({ value: { ...host.scope.getSnapshot().value, [field]: structuredClone(value) },
        user: { ...host.scope.getSnapshot().user as object, [field]: structuredClone(value) } })
    })
    const controller = new OpencodeGoSectionController(host.scope, { remote: {
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
      expect(host.scope.getSnapshot().value?.modelLimits).toEqual({ budget: { contextWindow: 100000, thinkingBudgets: [6000] } })
      fireEvent.click(screen.getByRole('button', { name: t('thinkingBudgetRemove', { value: 6000 }) }))
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.scope.getSnapshot().value?.modelLimits).toEqual({ budget: { contextWindow: 100000, thinkingBudgets: null } })
      fireEvent.click(screen.getByRole('button', { name: 'Effort Model' }))
      expect(screen.queryByText(en.thinkingBudgets)).toBeNull()
    } finally { controller.dispose() }
  })

  it('validates, saves, clears and resets the proxy address in advanced settings', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const base = { proxyURL: 'http://localhost:7890' }
    host.set.mockImplementation((field: string, value: unknown) => {
      host.publish({ value: { ...host.scope.getSnapshot().value, [field]: value },
        user: { ...host.scope.getSnapshot().user as object, [field]: value } })
    })
    host.unset.mockImplementation((field: string) => {
      const user = { ...host.scope.getSnapshot().user as Record<string, unknown> }
      delete user[field]
      host.publish({ value: { ...base, ...user }, user })
    })
    host.publish({ status: 'ready', writable: true, value: base, base, user: {} })
    const controller = new OpencodeGoSectionController(host.scope, { remote: {
      credentials: { describe: async () => ({ ok: true, value: {} }) },
      llm: { discoverModels: async () => ({ ok: true, value: [] }) },
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
      expect(host.set).toHaveBeenCalledWith('proxyURL', 'socks5://localhost:1080')
      fireEvent.change(input(), { target: { value: '' } })
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.set).toHaveBeenCalledWith('proxyURL', '')
      expect(input().value).toBe('')
      fireEvent.click(within(input().parentElement!).getByRole('button', { name: en.reset }))
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.unset).toHaveBeenCalledWith('proxyURL')
      expect(input().value).toBe(base.proxyURL)
    } finally { controller.dispose() }
  })

  it('saves an optional image count, rejects invalid counts, and clears or resets the override', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    host.set.mockImplementation((field: string, value: unknown) => {
      host.publish({
        value: { ...host.scope.getSnapshot().value, [field]: value },
        user: { ...host.scope.getSnapshot().user as object, [field]: value },
      })
    })
    host.unset.mockImplementation((field: string) => {
      const user = { ...host.scope.getSnapshot().user as Record<string, unknown> }
      delete user[field]
      const base = host.scope.getSnapshot().base as Record<string, unknown> | undefined
      host.publish({ value: { ...host.scope.getSnapshot().value, [field]: base?.[field] }, user })
    })
    const controller = new OpencodeGoSectionController(host.scope, { remote: {
      credentials: { describe: async () => ({ ok: true, value: {} }) },
      llm: { discoverModels: async () => ({ ok: true, value: [] }) },
    } } as never)
    host.publish({ status: 'ready', writable: true, value: {}, base: {}, user: {} })
    render(<OpencodeGoSection {...controller.inject()} t={t}
      useOpencodeGo={bindSnapshotSelector(controller.inject().hooks.opencodeGo)} />)
    try {
      await act(async () => { await Promise.resolve() })
      openAdvanced()
      const input = () => screen.getByLabelText<HTMLInputElement>(en.maxImagesLabel)
      expect(input().value).toBe('')
      expect(screen.getByText(en.maxImagesHint)).toBeTruthy()
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
      expect(host.set).toHaveBeenCalledWith('maxImages', 30)
      expect(input().value).toBe('30')
      fireEvent.change(input(), { target: { value: '' } })
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.unset).toHaveBeenCalledWith('maxImages')
      expect(host.scope.getSnapshot().value?.maxImages).toBeUndefined()
      expect(input().value).toBe('')

      // Reset follows the shared settings convention, including inherited caps.
      act(() => { host.publish({ value: { maxImages: 30 }, base: { maxImages: 60 }, user: { maxImages: 30 } }) })
      fireEvent.click(screen.getByRole('button', { name: en.reset }))
      expect(input().value).toBe('60')
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.scope.getSnapshot().value?.maxImages).toBe(60)
      expect(host.scope.getSnapshot().user).toEqual({})
    } finally {
      controller.dispose()
    }
  })

  it('saves, discards, and resets capacities while preserving explicit catalog choices', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    host.set.mockImplementation((field: string, value: unknown) => {
      host.publish({
        value: { ...host.scope.getSnapshot().value, [field]: structuredClone(value) },
        user: { ...host.scope.getSnapshot().user as object, [field]: structuredClone(value) },
      })
    })
    const controller = new OpencodeGoSectionController(host.scope, { remote: {
      credentials: { describe: async () => ({ ok: true, value: {} }) },
      llm: { discoverModels: async () => ({ ok: true, value: [{ id: 'm', name: 'Model', contextWindow: 262144, maxTokens: 32768 }] }) },
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
      expect(host.scope.getSnapshot().value?.modelLimits?.m?.contextWindow).toBe(200000)
      expect(screen.getByText(t('capacityDefault', { value: '262,144' }) + ' · ' + en.overridden)).toBeTruthy()
      expect(screen.getByText<HTMLButtonElement>(en.save).disabled).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: en.limitsResetModel }))
      expect(input().value).toBe('')
      fireEvent.click(screen.getByText(en.discard))
      expect(input().value).toBe('200000')
      fireEvent.click(screen.getByRole('button', { name: en.limitsResetAll }))
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.scope.getSnapshot().value?.modelLimits).toEqual({ m: null })
      expect(screen.getByText(t('limitsSummary', { count: 0 }))).toBeTruthy()
      fireEvent.change(input(), { target: { value: '150000' } })
      await act(async () => { screen.getByText(en.save).click() })
      expect(host.scope.getSnapshot().value?.modelLimits).toEqual({ m: { contextWindow: 150000, maxTokens: null, thinkingBudgets: null } })
    } finally {
      controller.dispose()
    }
  })

  it('drives a staged edit end to end against the stub scope', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    host.set.mockImplementation((field: string, value: unknown) => {
      const section = { ...host.scope.getSnapshot().value as object }
      const user = { ...host.scope.getSnapshot().user as object }
      host.publish({ value: { ...section, [field]: value }, user: { ...user, [field]: value } })
    })
    const ctx = {
      remote: {
        credentials: { describe: vi.fn(() => Promise.resolve({ ok: true, value: {} })), set: vi.fn() },
        llm: { discoverModels: vi.fn(() => Promise.resolve({ ok: true, value: [] })) },
      },
    } as never
    const controller = new OpencodeGoSectionController(host.scope, ctx)
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

    await vi.waitFor(() => { expect(host.set).toHaveBeenCalledWith('baseURL', 'https://edited.test/v1') })
  })
})
