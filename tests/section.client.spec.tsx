// @vitest-environment jsdom

/**
 * The OpenCode Go settings page component: the key control and its badge, the
 * gateway model listing it reads on mount, the advanced disclosure that holds
 * the tuning fields, the save/discard actions, and the unavailable posture.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

type SectionField = 'baseURL' | 'apiKeyEnv' | 'refreshMinutes' | 'streamIdleTimeoutMs'
  | 'maxRequestImageBytes' | 'requestImagePixelBudget' | 'requestImageMaxBytes' | 'apiKey' | 'models'

const settled: Omit<OpencodeGoSectionState, SectionField> = {
  available: true,
  writable: true,
  dirty: false,
  invalid: false,
  saving: false,
  failed: false,
  enabled: true,
  apiKeyConfigured: false,
  apiKeyWritable: true,
}

function stateOf(overrides: Partial<OpencodeGoSectionState> = {}): OpencodeGoSectionState {
  return {
    ...settled,
    apiKeyEnv: field('OPENCODE_API_KEY'),
    baseURL: field('https://opencode.ai/zen/go/v1'),
    refreshMinutes: field('60'),
    streamIdleTimeoutMs: field('300000'),
    maxRequestImageBytes: field('20971520'),
    requestImagePixelBudget: field('4194304'),
    requestImageMaxBytes: field('1048576'),
    apiKey: field(''),
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
  }
}

function renderSection(state: OpencodeGoSectionState, overrides: Partial<ReturnType<typeof actions>> = {}) {
  const store = createSnapshotStore(state)
  const props = {
    ...actions(),
    ...overrides,
    t,
    useOpencodeGo: bindSnapshotSelector(store),
  } as unknown as OpencodeGoSectionProps
  render(<OpencodeGoSection {...props} />)
  return store
}

/** The page's advanced disclosure starts collapsed; open it before its fields. */
function openAdvanced(): void {
  fireEvent.click(screen.getByText(en.advancedLabel))
}

describe('OpencodeGoSection', () => {
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
    renderSection(stateOf({ models: { status: 'ready', count: 1, preview: ['DeepSeek V4.1 Flash'] } }), held)
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
      models: { status: 'ready', count: 37, preview: ['DeepSeek V4.1 Flash', 'Kimi K2'] },
    }))

    expect(screen.getByText(en.keyConfigured)).toBeTruthy()
    expect(screen.getByText(t('modelsCount', { count: 37 }))).toBeTruthy()
    expect(screen.getByText('DeepSeek V4.1 Flash')).toBeTruthy()
    expect(screen.getByText('Kimi K2')).toBeTruthy()
  })

  it('reports a reading listing, an empty listing, and a failed one', () => {
    renderSection(stateOf())
    expect(screen.getByText(en.modelsLoading)).toBeTruthy()

    cleanup()
    renderSection(stateOf({ models: { status: 'ready', count: 0, preview: [] } }))
    expect(screen.getByText(en.modelsEmpty)).toBeTruthy()

    cleanup()
    renderSection(stateOf({ models: { status: 'failed', message: 'the live model listing is unreachable' } }))
    expect(screen.getByText(en.modelsFailed)).toBeTruthy()
    expect(screen.getByText('the live model listing is unreachable')).toBeTruthy()
  })

  it('re-reads the listing on demand, and refuses a second read while one is outstanding', () => {
    const reading = actions()
    renderSection(stateOf({ models: { status: 'ready', count: 3, preview: ['a'] } }), reading)
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
    expect(screen.getByText(en.overridden)).toBeTruthy()
    expect(screen.getByText(en.advancedHint)).toBeTruthy()

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
      [en.maxRequestImageBytesLabel, 'maxRequestImageBytes', true],
      [en.requestImagePixelBudgetLabel, 'requestImagePixelBudget', true],
      [en.requestImageMaxBytesLabel, 'requestImageMaxBytes', true],
    ]
    const resets = screen.getAllByText(en.reset)
    expect(resets).toHaveLength(fields.length)
    fields.forEach(([label, name, numeric], index) => {
      const input = screen.getByLabelText(label) as HTMLInputElement
      expect(input.inputMode).toBe(numeric ? 'numeric' : '')
      fireEvent.change(input, { target: { value: `edited-${name}` } })
      expect(edits.edit).toHaveBeenCalledWith(name, `edited-${name}`)
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
