// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GoModel, GoModelCatalog, GoUsage } from '../src/contracts.ts'
import { OpencodeGoSection, AccountsCard } from '../src/client/Section.tsx'
import { en } from '../src/client/presentation.ts'
import { OpencodeGoSectionController, type OpencodeGoSettings } from '../src/client/controller.ts'
import { bindSnapshotSelector, createConfigForm, translator } from './support/client.tsx'
import { accountHarness } from './support/host.ts'

describe("model availability and picker visibility", () => {

  const controllers: OpencodeGoSectionController[] = []

  afterEach(() => {
    cleanup()
    for (const controller of controllers.splice(0)) controller.dispose()
  })

  const t = (key: keyof typeof en, params?: Record<string, unknown>): string =>
    Object.entries(params ?? {}).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), en[key])

  const models: readonly GoModel[] = [
    { id: 'alpha', name: 'Alpha' },
    { id: 'beta', name: 'Beta' },
    { id: 'old', name: 'Old', deprecated: true },
  ]

  async function mount(options: { value?: OpencodeGoSettings; writable?: boolean; catalog?: GoModelCatalog } = {}) {
    const host = createConfigForm<OpencodeGoSettings>()
    host.publish({ status: 'ready', writable: options.writable ?? true, value: options.value ?? {}, base: {}, user: {} })

    const read = vi.fn(async () => ({ ok: true as const, value: options.catalog ?? { models, stale: false } }))
    const controller = new OpencodeGoSectionController(host.form, { remote: {
      credentials: { describe: async () => ({ ok: true, value: {} }) },
    } } as never, read)
    controllers.push(controller)
    const face = controller.inject()
    render(<OpencodeGoSection {...face} t={t} useOpencodeGo={bindSnapshotSelector(face.hooks.opencodeGo)} />)
    await act(async () => { await Promise.resolve() })
    return { host, read, snapshot: face.hooks.opencodeGo.getSnapshot }
  }

  /** Open the model card the way a reader does, for the tests that read inside it. */
  async function openModels(): Promise<void> {
    await act(async () => { fireEvent.click(document.querySelector('[aria-controls="opencode-go-models"]') as HTMLElement) })
  }

  /** The shipped posture is folded; most of these tests read the list and its switches. */
  async function mountOpen(options: Parameters<typeof mount>[0] = {}) {
    const mounted = await mount(options)
    await openModels()
    return mounted
  }

  it('shows a mixed-listing warning while keeping valid models usable', async () => {
    const warning = 'Model listing ignored 1 of 3 rows with invalid model ids; the listing may be incomplete'
    const { snapshot } = await mountOpen({ catalog: { models, stale: false,
      sources: { go: { warning }, free: {} } } })
    expect(screen.getByRole('alert').textContent).toContain(warning)
    expect(toggle('Alpha').disabled).toBe(false)
    expect(snapshot().models).toMatchObject({ stale: false, count: 3 })
  })

  const toggle = (name: string): HTMLButtonElement => screen.getByRole('switch', { name: t('modelVisibleLabel', { name }) })

  const checked = (name: string) => toggle(name).getAttribute('aria-checked') === 'true'

  async function flip(name: string) { await act(async () => { fireEvent.click(toggle(name)) }) }

  async function refresh() { await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.modelsRefresh })) }) }

  describe('per-model switches through the settings controller and component', () => {
    it('keeps invalid declarations disabled while a source refresh fails, then enables repaired models', async () => {
      const id = 'future-model', missing = { id, configurationMissing: true }
      const { read, host } = await mountOpen({ catalog: {
        models: [missing, ...models], stale: true, error: 'Go answered HTTP 503',
        sources: { go: { error: 'Go answered HTTP 503' }, free: { updatedAt: Date.now() } },
      } })
      expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
      expect(screen.getAllByText(en.configurationMissing).length).toBeGreaterThan(0)
      expect(toggle(id).disabled).toBe(true)
      expect(toggle('Alpha').disabled).toBe(false)
      await flip(id)
      expect(host.set).not.toHaveBeenCalled()
      const pending = Promise.withResolvers<{ ok: true; value: GoModelCatalog }>()
      read.mockImplementationOnce(() => pending.promise)
      await refresh()
      expect(screen.getByText(en.modelsRefreshing)).toBeTruthy()
      expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
      expect(screen.getByText('Go answered HTTP 503')).toBeTruthy()
      await act(async () => { pending.resolve({ ok: true, value: {
        models: [missing, ...models], stale: false, sources: { go: { updatedAt: Date.now() }, free: { updatedAt: Date.now() } },
      } }) })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(toggle(id).disabled).toBe(true)
      read.mockResolvedValueOnce({ ok: true, value: {
        models: [{ id, name: 'Future Model' }, ...models], stale: false,
        sources: { go: { updatedAt: Date.now() }, free: { updatedAt: Date.now() } },
      } })
      await refresh()
      expect(screen.queryByText(en.configurationMissing)).toBeNull()
      expect(toggle('Future Model').disabled).toBe(false)
      expect(checked('Future Model')).toBe(true)
    })

    it('keeps the healthy Go view usable during a Free source outage and isolates empty-source diagnostics', async () => {
      const { read } = await mountOpen({ catalog: {
        models, stale: true, error: 'Free answered HTTP 503',
        sources: { go: { updatedAt: Date.now() }, free: { error: 'Free answered HTTP 503' } },
      } })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(toggle('Alpha').disabled).toBe(false)
      fireEvent.click(screen.getByRole('tab', { name: en.modelsFreeTab }))
      expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
      expect(screen.getByText('Free answered HTTP 503')).toBeTruthy()
      expect(screen.queryByRole('switch', { name: t('modelVisibleLabel', { name: 'Alpha' }) })).toBeNull()
      read.mockResolvedValueOnce({ ok: true, value: { models, stale: false, sources: { go: {}, free: { updatedAt: Date.now() } } } })
      await refresh()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText(en.modelsEmpty)).toBeTruthy()
    })

    it('carries independent source timestamps through the controller and clears stale diagnostics after recovery', async () => {
      const goTime = Date.UTC(2026, 8, 25, 10), freeTime = goTime - 60000
      const { read } = await mountOpen({ catalog: {
        models, stale: true, error: 'Free answered HTTP 503',
        sources: { go: { updatedAt: goTime }, free: { updatedAt: freeTime, error: 'HTTP 503' } },
      } })
      expect(screen.getByText(/Go model source: Up to date/).textContent).toContain(new Date(goTime).toLocaleString())
      expect(screen.getByText(/Free model source: Refresh failed/).textContent).toContain(new Date(freeTime).toLocaleString())
      read.mockRejectedValueOnce(new Error('Host unreachable'))
      await refresh()
      expect(screen.getByText('Host unreachable')).toBeTruthy()
      expect(screen.queryByText(/Go model source: Up to date/)).toBeNull()
      read.mockResolvedValueOnce({ ok: true, value: { models, stale: false } })
      await refresh()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByText(/Free model source: Refresh failed/)).toBeNull()
      expect(toggle('Alpha').disabled).toBe(false)
    })

    it('keeps duplicate ids in separate tabs and persists Free switches without changing Go', async () => {
      const { host } = await mountOpen({ value: { modelVisibility: { same: false } }, catalog: { stale: false, models: [
        { id: 'same', name: 'Same Go', source: 'go' }, { id: 'same', name: 'Same Free', source: 'free' },
      ] } })
      expect(checked('Same Go')).toBe(false)
      expect(screen.queryByRole('switch', { name: t('modelVisibleLabel', { name: 'Same Free' }) })).toBeNull()
      const free = screen.getByRole('tab', { name: en.modelsFreeTab })
      fireEvent.keyDown(screen.getByRole('tab', { name: en.modelsGoTab }), { key: 'ArrowRight' })
      expect(document.activeElement).toBe(free)
      expect(free.getAttribute('aria-selected')).toBe('true')
      expect(checked('Same Free')).toBe(true)
      await flip('Same Free')
      expect(host.set).toHaveBeenLastCalledWith('modelVisibility', { same: false, 'dsh-opencode-free/same': false })
      fireEvent.click(screen.getByRole('tab', { name: en.modelsGoTab }))
      expect(checked('Same Go')).toBe(false)
    })

    it('stages capacities and resets only the active source while preserving the other route', async () => {
      const { host, snapshot } = await mountOpen({ value: { modelLimits: {
        same: { contextWindow: 10000, maxTokens: 1000 }, 'dsh-opencode-free/same': { contextWindow: 20000, maxTokens: 2000 },
      } }, catalog: { stale: false, models: [
        { id: 'same', name: 'Same Go', source: 'go', contextWindow: 100000, maxTokens: 10000 },
        { id: 'same', name: 'Same Free', source: 'free', contextWindow: 200000, maxTokens: 20000 },
      ] } })
      expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: t('limitsContextLabel', { name: 'Same Go' }) }).value).toBe('10000')
      fireEvent.click(screen.getByRole('tab', { name: en.modelsFreeTab }))
      const input = screen.getByRole('spinbutton', { name: t('limitsContextLabel', { name: 'Same Free' }) })
      fireEvent.change(input, { target: { value: '30000' } })
      expect(snapshot().modelLimitDraft).toEqual({ same: { contextWindow: 10000, maxTokens: 1000 },
        'dsh-opencode-free/same': { contextWindow: 30000, maxTokens: 2000 } })
      expect(host.mutate).not.toHaveBeenCalled()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.save })) })
      expect(host.form.getSnapshot().value?.modelLimits?.['dsh-opencode-free/same']?.contextWindow).toBe(30000)
      fireEvent.click(screen.getByRole('button', { name: en.limitsResetAll }))
      expect(snapshot().modelLimitDraft).toEqual({ same: { contextWindow: 10000, maxTokens: 1000 }, 'dsh-opencode-free/same': null })
      fireEvent.click(screen.getByRole('tab', { name: en.modelsGoTab }))
      expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: t('limitsContextLabel', { name: 'Same Go' }) }).value).toBe('10000')
    })

    it('defaults normal models on and deprecated models off, applying each switch immediately', async () => {
      const { host, snapshot } = await mountOpen()
      expect(screen.queryByLabelText(en.keyLabel)).toBeNull()
      expect(checked('Alpha')).toBe(true)
      expect(checked('Beta')).toBe(true)
      expect(checked('Old')).toBe(false)
      expect(screen.queryByRole('checkbox')).toBeNull()
      // The accounts card ships folded, so its fallback switch is not on the page yet.
      expect(screen.getAllByRole('switch')).toHaveLength(4) // provider and one per model

      await flip('Beta')
      expect(host.set).toHaveBeenLastCalledWith('modelVisibility', { beta: false })
      expect(checked('Beta')).toBe(false)
      expect(within(screen.getByRole('region', { name: en.modelDetails })).getByRole('heading').textContent).toBe('Alpha')
      await flip('Old')
      expect(host.set).toHaveBeenLastCalledWith('modelVisibility', { beta: false, old: true })
      expect(checked('Old')).toBe(true)
      expect(snapshot().dirty).toBe(false)
      expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
    })

    it('preserves unrelated drafts and committed switch values when a write fails', async () => {
      const { host, snapshot } = await mountOpen()
      fireEvent.click(screen.getByText(en.advancedLabel))
      fireEvent.change(screen.getByLabelText(en.refreshMinutesLabel), { target: { value: '30' } })
      await flip('Old')
      expect(screen.getByLabelText(en.refreshMinutesLabel)).toHaveProperty('value', '30')
      expect(snapshot().dirty).toBe(true)
      host.set.mockRejectedValueOnce(new Error('write refused'))
      await flip('Old')
      expect(checked('Old')).toBe(true)
      expect(screen.getByRole('alert').textContent).toBe(en.pickerFailed)
      fireEvent.click(screen.getByRole('button', { name: en.discard }))
      expect(checked('Old')).toBe(true)
    })

    it('preserves absent overrides and applies defaults to newly discovered models', async () => {
      const { host, read } = await mountOpen({ value: { modelVisibility: { missing: false, old: true } } })
      await flip('Beta')
      read.mockResolvedValueOnce({ ok: true, value: { models: [...models, { id: 'new', name: 'New' }, { id: 'older', name: 'Older', deprecated: true }], stale: false } })
      await refresh()
      expect(checked('New')).toBe(true)
      expect(checked('Older')).toBe(false)
      expect(checked('Old')).toBe(true)
      expect(checked('Beta')).toBe(false)
      expect(host.form.getSnapshot().value?.modelVisibility).toEqual({ missing: false, old: true, beta: false })
    })

    it('disables switches while a write is pending and for a read-only profile', async () => {
      const { host } = await mountOpen()
      let finish!: (accepted: boolean) => void
      host.set.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve }))
      fireEvent.click(screen.getByText(en.advancedLabel))
      fireEvent.change(screen.getByLabelText(en.refreshMinutesLabel), { target: { value: '30' } })
      fireEvent.click(toggle('Alpha'))
      expect(screen.getByRole<HTMLButtonElement>('button', { name: en.save }).disabled).toBe(true)
      expect(screen.getByRole<HTMLButtonElement>('switch', { name: en.enabledLabel }).disabled).toBe(true)
      expect(toggle('Alpha').disabled).toBe(true)
      expect(toggle('Old').disabled).toBe(true)
      await act(async () => { finish(false) })
      expect(checked('Alpha')).toBe(true) // unacknowledged write did not change the switch
      expect(screen.getByRole('alert').textContent).toBe(en.pickerFailed)
      await act(async () => { host.publish({ writable: false }) })
      expect(toggle('Beta').disabled).toBe(true)
    })

    it('keeps the catalog and switches visible during refresh and after a transport failure', async () => {
      const { read, snapshot } = await mountOpen()
      let reject!: (error: Error) => void
      read.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
      fireEvent.click(screen.getByRole('button', { name: en.modelsRefresh }))
      expect(snapshot().models).toMatchObject({ status: 'ready', refreshing: true })
      expect(screen.getByText(en.modelsRefreshing)).toBeTruthy()
      expect(toggle('Beta').disabled).toBe(false)
      await act(async () => { reject(new Error('request timed out')) })
      expect(snapshot().models).toMatchObject({ status: 'ready', stale: true, count: 3, message: 'request timed out' })
      expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
      expect(checked('Beta')).toBe(true)
      await flip('Old')
      expect(checked('Old')).toBe(true)
      await refresh()
      expect(screen.queryByText(en.modelsStale)).toBeNull()
    })

    it('shows the Host cached list on first opening after a timeout and clears it on a confirmed empty catalog', async () => {
      const { read } = await mountOpen({ catalog: { models, stale: true, error: 'request timed out' } })
      expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
      expect(checked('Alpha')).toBe(true)
      expect(screen.getByText('request timed out')).toBeTruthy()
      read.mockResolvedValueOnce({ ok: true, value: { models: [], stale: false } })
      await refresh()
      expect(screen.getByText(en.modelsEmpty)).toBeTruthy()
      expect(screen.queryByRole('switch', { name: t('modelVisibleLabel', { name: 'Alpha' }) })).toBeNull()
    })
    it('drops the previous gateway cache when the endpoint changes, including late responses', async () => {
      const { host, read, snapshot } = await mountOpen()
      let finishOld!: (value: { ok: true; value: GoModelCatalog }) => void
      read.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
      fireEvent.click(screen.getByRole('button', { name: en.modelsRefresh }))
      read.mockResolvedValueOnce({ ok: true, value: { models: [], stale: true, error: 'new gateway unavailable' } })
      await act(async () => { host.publish({ value: { baseURL: 'https://new-gateway.invalid/v1' } }) })
      expect(snapshot().models).toEqual({ status: 'failed', message: 'new gateway unavailable' })
      await act(async () => { finishOld({ ok: true, value: { models, stale: false } }) })
      expect(snapshot().models.status).toBe('failed')
      expect(screen.queryByRole('switch', { name: t('modelVisibleLabel', { name: 'Alpha' }) })).toBeNull()
    })

    it('marks missing configuration and prevents enabling it even with a saved true override', async () => {
      const missing = { id: 'missing-model', name: 'missing-model', configurationMissing: true }
      const { host, read } = await mountOpen({
        value: { modelVisibility: { 'missing-model': true } },
        catalog: { models: [missing], stale: false },
      })
      expect(toggle('missing-model').disabled).toBe(true)
      expect(checked('missing-model')).toBe(false)
      expect(screen.getAllByText('Configuration missing').length).toBeGreaterThan(0)
      const details = screen.getByRole('region', { name: en.modelDetails })
      expect(within(details).getByRole('heading').textContent).toBe('missing-model')
      expect(within(details).queryByRole('spinbutton')).toBeNull()
      await flip('missing-model')
      expect(host.set).not.toHaveBeenCalled()

      read.mockResolvedValueOnce({ ok: true, value: { models: [{ id: 'missing-model', name: 'Ready model', contextWindow: 100000, maxTokens: 4096 }], stale: false } })
      await refresh()
      expect(toggle('Ready model').disabled).toBe(false)
      expect(checked('Ready model')).toBe(true)
      expect(screen.queryByText('Configuration missing')).toBeNull()
    })

    it('carries a refused switch write while the model card is still folded', async () => {
      const { host } = await mount()
      host.set.mockRejectedValueOnce(new Error('write refused'))
      // The switch that can fail on its own lives in the connection card, above
      // the fold: its refusal has to reach the reader without opening the list.
      await act(async () => { fireEvent.click(screen.getByRole('switch', { name: en.enabledLabel })) })
      expect(screen.getByRole('alert').textContent).toBe(en.pickerFailed)
      expect(document.getElementById('opencode-go-models')).toBeNull()
    })

    it('reports an unreachable listing without opening the card', async () => {
      await mount({ catalog: { models, stale: true, error: 'request timed out' } })
      expect(screen.getByRole('alert').textContent).toBe(en.modelsStale)
      expect(screen.getByText('request timed out')).toBeTruthy()
      expect(document.getElementById('opencode-go-models')).toBeNull()
    })

  })
})

describe("account cards, quota rows and ordering", () => {

  const controllers: OpencodeGoSectionController[] = []

  afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose() })

  const accounts = [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' }, { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' }]

  const window = { status: 'ok' as const, percent: 10, resetsAt: '2026-10-03T00:00:00Z' }

  const usage = (source: string, percent = 10): GoUsage => ({ source, rolling: { ...window, percent }, weekly: window, monthly: window })

  const t = translator()

  function setup(value: OpencodeGoSettings = { accounts, apiKeyEnv: 'ACCOUNT_A' }) {
    const server = accountHarness(value)
    const host = createConfigForm<OpencodeGoSettings>(server.value())
    server.secrets.set('ACCOUNT_A', 'secret-a'); server.secrets.set('ACCOUNT_B', 'secret-b')
    const commit = server.settings.mutate.getMockImplementation()!
    server.settings.mutate.mockImplementation(async (...args) => {
      await commit(...args)
      host.publish({ value: server.value(), user: server.value(), revision: server.revision() })
    })
    const credentials = {
      describe: vi.fn(async (refs: string[]) => ({ ok: true as const, value: Object.fromEntries(refs.map(ref => [ref, { configured: server.secrets.has(ref), writable: server.writable.get(ref) !== false }])) })),
    }
    const read = vi.fn(async (ref: string) => usage(ref))
    const execute = vi.fn(command => server.manager.execute(command))
    const controller = new OpencodeGoSectionController(host.form, { remote: { credentials } } as never,
      async () => ({ ok: true, value: { models: [], stale: false } }), read, execute)
    controllers.push(controller)
    return { host, server, credentials, secrets: server.secrets, read, execute, controller, actions: controller.accountActions() }
  }

  it('keeps rejected account form input and clears it only after a successful submission', async () => {
    const fixture = setup()
    fixture.actions.addAccount = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const props = { state: fixture.controller.accountState(), actions: fixture.actions, writable: true, t }
    render(<AccountsCard {...props} />)
    // The card ships folded; its controls are one disclosure away.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    fireEvent.click(screen.getByRole('button', { name: en.accountAdd }))
    fireEvent.change(screen.getByLabelText(en.accountName), { target: { value: 'Work' } })
    fireEvent.change(screen.getByLabelText(en.keyLabel), { target: { value: 'private-new-key' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.accountConfirm })) })
    expect((screen.getByLabelText(en.keyLabel) as HTMLInputElement).value).toBe('private-new-key')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.accountConfirm })) })
    expect(screen.queryByLabelText(en.accountName)).toBeNull()
    fixture.controller.dispose()
  })

  it('carries the automatic-fallback hint as the switch description, behind its mark', () => {
    const fixture = setup()
    const props = { state: fixture.controller.accountState(), actions: fixture.actions, writable: true, t }
    render(<AccountsCard {...props} />)
    // The card ships folded; the fallback switch is one disclosure away.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    expect(screen.getByRole('switch', { name: en.accountAutoSwitch }).getAttribute('title')).toBe(en.accountAutoSwitchHint)
    expect(screen.queryByText(en.accountAutoSwitchHint)).toBeNull()
    fixture.controller.dispose()
  })

  it('ships folded, and keeps every account row detail closed until its disclosure opens', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    render(<AccountsCard state={fixture.controller.accountState()} actions={fixture.actions} writable t={t} />)
    const trigger = screen.getByRole('button', { name: new RegExp(en.accountsTitle) })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: en.accountAdd })).toBeNull()
    expect(screen.getByText(/^2 accounts/)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: en.accountAdd })).toBeTruthy()
    // The automatic-fallback switch lives inside the fold, unlike the model switches.
    expect(screen.getByRole('switch')).toBeTruthy()
    // Rows carry the key state and the rolling reading; the rest is behind each row's disclosure.
    expect(screen.getAllByText(en.keyConfigured)).toHaveLength(2)
    expect(screen.queryByText(new RegExp(en.usage_weekly))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('accountsDetails', { name: 'Primary' }) }))
    expect(screen.getByText(new RegExp(en.usage_weekly))).toBeTruthy()
    expect(screen.getByRole('button', { name: t('accountsDetailsHide', { name: 'Primary' }) })).toBeTruthy()
    fixture.controller.dispose()
  })

  it('moves a manually selected account first in one write without refreshing existing quotas', async () => {
    const third = { id: 'c', name: 'Third', apiKeyEnv: 'ACCOUNT_C' }
    const fixture = setup({ accounts: [...accounts, third], apiKeyEnv: 'ACCOUNT_A' })
    fixture.secrets.set('ACCOUNT_C', 'secret-c')
    await fixture.controller.refreshAccounts()
    const reads = fixture.read.mock.calls.length
    expect(await fixture.actions.selectAccount('ACCOUNT_C')).toBe(true)
    expect(fixture.server.settings.mutate.mock.calls.at(-1)![1]).toEqual([
      { op: 'set', path: ['accounts'], value: [third, ...accounts] },
      { op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_C' },
    ])
    expect(fixture.host.form.getSnapshot().value?.accounts).toEqual([third, ...accounts])
    expect(fixture.controller.accountState().entries.map(entry => entry.apiKeyEnv)).toEqual(['ACCOUNT_C', 'ACCOUNT_A', 'ACCOUNT_B'])
    expect(fixture.controller.accountState().activeRef).toBe('ACCOUNT_C')
    expect(fixture.read).toHaveBeenCalledTimes(reads)
    fixture.controller.dispose()
  })

  it('writes the dragged order and the new preferred account in one mutation', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    expect(await fixture.actions.moveAccount('ACCOUNT_B', 0)).toBe(true)
    expect(fixture.server.settings.mutate.mock.calls.at(-1)![1]).toEqual([
      { op: 'set', path: ['accounts'], value: [accounts[1], accounts[0]] },
      { op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_B' },
    ])
    expect(fixture.controller.accountState().entries.map(entry => entry.apiKeyEnv)).toEqual(['ACCOUNT_B', 'ACCOUNT_A'])
    fixture.controller.dispose()
  })

  it('keeps the loaded rows when only the order changes', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const reads = fixture.read.mock.calls.length
    expect(await fixture.actions.moveAccount('ACCOUNT_B', 0)).toBe(true)
    expect(fixture.read.mock.calls.length).toBe(reads)
    expect(fixture.controller.accountState().entries[0]).toMatchObject({ apiKeyEnv: 'ACCOUNT_B', usage: { source: 'ACCOUNT_B' } })
    fixture.controller.dispose()
  })

  it('reorders when a row handle is dragged onto another row', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const moveAccount = vi.fn(async () => true)
    render(<AccountsCard state={fixture.controller.accountState()} actions={{ ...fixture.actions, moveAccount }} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    const source = screen.getByRole('button', { name: t('accountDragHandle', { name: 'Primary' }) })
    const target = screen.getByRole('button', { name: t('accountDragHandle', { name: 'Backup' }) })
    const dataTransfer = { effectAllowed: 'none', dropEffect: 'none', setData: vi.fn() }
    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })
    expect(moveAccount).toHaveBeenCalledWith('ACCOUNT_A', 1)
    fixture.controller.dispose()
  })

  /**
   * jsdom reports no layout, so the boxes the insertion-slot math reads are
   * supplied here: two 40px rows with the 10px grid gap between them.
   * @returns the list element that carries the drop handlers.
   */
  function stackRows(): HTMLElement {
    const boxes: Record<string, { top: number; height: number }> = {
      ACCOUNT_A: { top: 100, height: 40 }, ACCOUNT_B: { top: 150, height: 40 },
    }
    for (const [ref, box] of Object.entries(boxes)) {
      const row = document.querySelector<HTMLElement>(`[data-account-row="${ref}"]`)!
      row.getBoundingClientRect = () => ({
        top: box.top, bottom: box.top + box.height, height: box.height,
        left: 0, right: 320, width: 320, x: 0, y: box.top, toJSON: () => ({}),
      }) as DOMRect
    }
    return document.querySelector<HTMLElement>('[data-account-row="ACCOUNT_A"]')!.parentElement!
  }

  /**
   * jsdom has no DragEvent and its events carry no pointer position, so the
   * transfer and the pointer's Y are attached to a plain bubbling event — the two
   * facts the drop handlers read.
   */
  function fireDrag(type: 'dragstart' | 'dragover' | 'drop' | 'dragend', element: HTMLElement,
    dataTransfer: unknown, clientY?: number): void {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { dataTransfer, clientY })
    fireEvent(element, event)
  }

  /** Mount the unfolded card with a spy standing in for the settings write. */
  async function dragFixture() {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const moveAccount = vi.fn(async () => true)
    render(<AccountsCard state={fixture.controller.accountState()} actions={{ ...fixture.actions, moveAccount }} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    const list = stackRows()
    const dataTransfer = { effectAllowed: 'none', dropEffect: 'none', setData: vi.fn() }
    const handle = (name: string) => screen.getByRole('button', { name: t('accountDragHandle', { name }) })
    return { fixture, moveAccount, list, dataTransfer, handle }
  }

  it('reorders when the row is released on the list itself, above the target row', async () => {
    const { fixture, moveAccount, list, dataTransfer, handle } = await dragFixture()
    fireDrag('dragstart', handle('Backup'), dataTransfer)
    // The list is the drop surface: a release over a row, over the gap between two
    // rows or over the insertion mark all reach the same handler.
    fireDrag('dragover', list, dataTransfer, 110)
    expect(screen.getByText('Primary').closest('[data-account-row]')!.getAttribute('data-drop')).toBe('before')
    fireDrag('drop', list, dataTransfer, 110)
    expect(moveAccount).toHaveBeenCalledWith('ACCOUNT_B', 0)
    fixture.controller.dispose()
  })

  it('reorders downward and marks the end of the list', async () => {
    const { fixture, moveAccount, list, dataTransfer, handle } = await dragFixture()
    fireDrag('dragstart', handle('Primary'), dataTransfer)
    fireDrag('dragover', list, dataTransfer, 175)
    expect(screen.getByText('Backup').closest('[data-account-row]')!.getAttribute('data-drop')).toBe('after')
    fireDrag('drop', list, dataTransfer, 175)
    expect(moveAccount).toHaveBeenCalledWith('ACCOUNT_A', 1)
    fixture.controller.dispose()
  })

  it('keeps a drop on the dragged row\'s own slot silent: no mark and no write', async () => {
    const { fixture, moveAccount, list, dataTransfer, handle } = await dragFixture()
    fireDrag('dragstart', handle('Backup'), dataTransfer)
    // The lower half of the row above names the position the row already holds.
    fireDrag('dragover', list, dataTransfer, 135)
    expect(document.querySelectorAll('[data-drop]')).toHaveLength(0)
    fireDrag('drop', list, dataTransfer, 135)
    expect(moveAccount).not.toHaveBeenCalled()
    fixture.controller.dispose()
  })

  it('takes the release position over the last hovered slot', async () => {
    const { fixture, moveAccount, list, dataTransfer, handle } = await dragFixture()
    fireDrag('dragstart', handle('Backup'), dataTransfer)
    // The drag last reported the end of the list — the row's own slot, a no-op —
    // and then the pointer crossed to the top without a hover in between.
    fireDrag('dragover', list, dataTransfer, 175)
    fireDrag('drop', list, dataTransfer, 110)
    expect(moveAccount).toHaveBeenCalledWith('ACCOUNT_B', 0)
    fixture.controller.dispose()
  })

  it('reorders with the arrow keys on a row handle', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const moveAccount = vi.fn(async () => true)
    render(<AccountsCard state={fixture.controller.accountState()} actions={{ ...fixture.actions, moveAccount }} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    fireEvent.keyDown(screen.getByRole('button', { name: t('accountDragHandle', { name: 'Backup' }) }), { key: 'ArrowUp' })
    expect(moveAccount).toHaveBeenCalledWith('ACCOUNT_B', 0)
    fixture.controller.dispose()
  })

  it('reports the reason a row could not read its quota, without any credential value', async () => {
    const fixture = setup()
    const message = 'OpenCode Go usage unavailable (HTTP 403). Check your API key and Go subscription permissions. '
      + 'Upstream: This workspace does not have permission to read Go usage; check that the Go subscription is active for the workspace that owns this API key.'
    fixture.read.mockRejectedValue(Object.assign(new Error(message), { code: 'opencode-go/usage-unavailable' }))
    await fixture.controller.refreshAccounts()
    expect(fixture.controller.accountState().entries[0]).toMatchObject({
      failed: true, problem: message,
    })
    render(<AccountsCard state={fixture.controller.accountState()} actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    expect(screen.getAllByText(message)).toHaveLength(2)
    expect(JSON.stringify(fixture.controller.accountState())).not.toContain('secret-a')
    fixture.controller.dispose()
  })

  it('marks the handle as the drag source, so a real browser can start the reorder', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    render(<AccountsCard state={fixture.controller.accountState()} actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    const handle = screen.getByRole('button', { name: t('accountDragHandle', { name: 'Primary' }) })
    // Dragging is inert without this attribute: the browser never dispatches dragstart.
    expect(handle.getAttribute('draggable')).toBe('true')
    expect(handle.closest('[data-account-row]')?.getAttribute('data-account-row')).toBe('ACCOUNT_A')
    // The hint paragraph is gone, so the handle's own tooltip carries the affordance.
    expect(handle.getAttribute('title')).toBe(t('accountDragHandle', { name: 'Primary' }))
    fixture.controller.dispose()
  })

  it('carries one refresh stamp in the header and none under a row', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    render(<AccountsCard state={fixture.controller.accountState()} actions={fixture.actions} writable t={t} />)
    // Every row is read in the same pass, so the stamp belongs to the card and is
    // visible while it is folded; opening every row must not add a second one.
    expect(screen.getAllByText(new RegExp(`^${en.usageLastUpdated}`))).toHaveLength(1)
    const trigger = screen.getByRole('button', { name: new RegExp(en.accountsTitle) })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    for (const name of ['Primary', 'Backup']) {
      fireEvent.click(screen.getByRole('button', { name: t('accountsDetails', { name }) }))
    }
    expect(screen.getAllByText(new RegExp(`^${en.usageLastUpdated}`))).toHaveLength(1)
    fixture.controller.dispose()
  })

  it('keeps the row actions to rename, replace key and remove', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    render(<AccountsCard state={fixture.controller.accountState()} actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    const row = screen.getByRole('button', { name: t('accountDragHandle', { name: 'Primary' }) }).closest('[data-account-row]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: t('accountsDetails', { name: 'Primary' }) }))
    for (const name of [en.accountRename, en.accountReplaceKey, en.accountRemove]) {
      expect(within(row).getByRole('button', { name })).toBeTruthy()
    }
    // Reordering is drag and arrow keys only: no per-row move buttons survive.
    expect(within(row).queryByRole('button', { name: /^move/i })).toBeNull()
    fixture.controller.dispose()
  })

  it('draws the row quota as one wide bar with quarter marks and a trailing reading', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    render(<AccountsCard state={fixture.controller.accountState()} actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    const bar = screen.getByRole('progressbar', { name: `Primary ${en.usage_rolling}` })
    expect(bar.getAttribute('aria-valuenow')).toBe('10')
    expect(bar.getAttribute('data-level')).toBe('ok')
    // One fill plus the three quarter marks, and the fill is the reading itself.
    expect(bar.querySelectorAll('span')).toHaveLength(4)
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('10%')
    fixture.controller.dispose()
  })

  it('lays a row out as fixed columns, so a longer name cannot move the bar', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const state = fixture.controller.accountState()
    const main = () => screen.getByRole('button', { name: t('accountDragHandle', { name: 'Primary' }) })
      .closest('[data-account-row]')!.querySelector('[data-account-main]') as HTMLElement
    const { unmount } = render(<AccountsCard state={state} actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    // Handle, name, key state, bar, reading, reset, disclosure: the flexible
    // spacer that let a long name push every later column is gone.
    expect(Array.from(main().children).map(child => child.tagName)).toEqual(
      ['BUTTON', 'STRONG', 'SPAN', 'SPAN', 'SPAN', 'SPAN', 'BUTTON'])
    expect(main().children[3]!.getAttribute('role')).toBe('progressbar')
    // The name column is fixed and may ellipsise, so the full value stays reachable.
    expect(main().children[1]!.getAttribute('title')).toBe('Primary')
    unmount()
    // A row with nothing to read yet keeps that grid: its message spans the bar,
    // the reading and the countdown instead of adding a column.
    render(<AccountsCard state={{ ...state, entries: state.entries.map(entry => ({ ...entry, usage: undefined, loading: true })) }}
      actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    expect(Array.from(main().children).map(child => child.tagName)).toEqual(['BUTTON', 'STRONG', 'SPAN', 'SPAN', 'BUTTON'])
    expect(screen.getAllByText(en.usageLoading)).toHaveLength(2)
    fixture.controller.dispose()
  })

  it('turns the row bar amber at 80% and red once the window is spent', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const state = fixture.controller.accountState()
    const level = (rolling: GoUsage['rolling']): string | null => {
      render(<AccountsCard state={{ ...state, entries: [{ ...state.entries[0]!, usage: { ...usage('ACCOUNT_A'), rolling } }] }}
        actions={fixture.actions} writable t={t} />)
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
      const found = screen.getByRole('progressbar', { name: `Primary ${en.usage_rolling}` }).getAttribute('data-level')
      cleanup()
      return found
    }
    expect(level({ status: 'ok', percent: 79, resetsAt: window.resetsAt })).toBe('ok')
    expect(level({ status: 'ok', percent: 80, resetsAt: window.resetsAt })).toBe('high')
    expect(level({ status: 'rate-limited', percent: 100, resetsAt: window.resetsAt })).toBe('limited')
    fixture.controller.dispose()
  })

  it('edits a row in place and reports why a quota read failed', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const state = fixture.controller.accountState()
    render(<AccountsCard state={{ ...state, entries: state.entries.map((entry, index) => index === 0
      ? { ...entry, failed: true, usage: undefined, problem: 'OpenCode Go usage unavailable (HTTP 401)' }
      : entry) }} actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    // The reason is visible without opening the row's detail, and retrying is one click away.
    expect(screen.getByText('OpenCode Go usage unavailable (HTTP 401)')).toBeTruthy()
    expect(screen.getByRole('button', { name: en.usageRetry })).toBeTruthy()
    expect(screen.getByText(t('accountsAvailabilityFailed', { ready: 2, total: 2, failed: 1 }))).toBeTruthy()
    // Editing opens inside the row it edits, not at the foot of the list.
    const row = screen.getByRole('button', { name: t('accountDragHandle', { name: 'Primary' }) }).closest('[data-account-row]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: t('accountsDetails', { name: 'Primary' }) }))
    fireEvent.click(within(row).getByRole('button', { name: en.accountRename }))
    expect(within(row).getByLabelText(en.accountName)).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.accountAdd })).toBeNull()
    fixture.controller.dispose()
  })

  it('marks every row unreadable instead of eternally loading when the describe fails', async () => {
    const fixture = setup()
    fixture.credentials.describe.mockResolvedValue({ ok: false as const, error: new Error('no credential provider mounted') })
    await fixture.controller.refreshAccounts()
    const state = fixture.controller.accountState()
    expect(state.failure).toBe('read')
    expect(state.entries.every(entry => entry.failed === true && entry.configured === undefined)).toBe(true)
    render(<AccountsCard state={state} actions={fixture.actions} writable t={t} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    expect(screen.queryByText(en.usageLoading)).toBeNull()
    expect(screen.getAllByText(en.accountsStatusUnknown)).toHaveLength(2)
    expect(screen.getByText(en.accountsReadFailed)).toBeTruthy()
    fixture.controller.dispose()
  })

  it('recovers the add entry when a concurrent settings update removes its editing row', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const removeAccount = vi.fn(async () => false)
    const base = { actions: { ...fixture.actions, removeAccount }, writable: true, t }
    const view = render(<AccountsCard {...base} state={fixture.controller.accountState()} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
    const row = screen.getByRole('button', { name: t('accountDragHandle', { name: 'Primary' }) }).closest('[data-account-row]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: t('accountsDetails', { name: 'Primary' }) }))
    fireEvent.click(within(row).getByRole('button', { name: en.accountRemove }))
    expect(screen.queryByRole('button', { name: en.accountAdd })).toBeNull()
    // A concurrent settings update removes the row while its editor is open.
    fixture.host.publish({ value: { accounts: [accounts[1]!], apiKeyEnv: 'ACCOUNT_B' } })
    await act(async () => { view.rerender(<AccountsCard {...base} state={fixture.controller.accountState()} />) })
    expect(screen.getByRole('button', { name: en.accountAdd })).toBeTruthy()
    fixture.controller.dispose()
  })

  it('keeps the loaded rows when only a name changes', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const reads = fixture.read.mock.calls.length
    expect(await fixture.actions.renameAccount('ACCOUNT_A', 'Renamed')).toBe(true)
    expect(fixture.read.mock.calls.length).toBe(reads)
    expect(fixture.controller.accountState().entries[0]).toMatchObject({ name: 'Renamed', usage: { source: 'ACCOUNT_A' } })
    fixture.controller.dispose()
  })
  it('keeps previous quota only for a retryable error naming the same credential source', async () => {
    const fixture = setup()
    await fixture.controller.refreshAccounts()
    const error = (source: string) => Object.assign(new Error('temporarily unavailable'), {
      code: 'opencode-go/usage-unavailable', details: { source, retryable: true, retainPrevious: true },
    })
    fixture.read.mockImplementation(async ref => { throw error(ref) })
    await fixture.controller.refreshAccounts()
    expect(fixture.controller.accountState().entries.every(entry => entry.stale && entry.usage?.rolling.percent === 10)).toBe(true)
    fixture.read.mockImplementation(async () => { throw error('DIFFERENT_KEY') })
    await fixture.controller.refreshAccounts()
    expect(fixture.controller.accountState().entries.every(entry => entry.failed && !entry.usage)).toBe(true)
  })

  it('drops an older quota response after a newer refresh has completed', async () => {
    const fixture = setup()
    const pending = Promise.withResolvers<GoUsage>()
    fixture.read.mockImplementationOnce(() => pending.promise)
    const older = fixture.controller.refreshAccounts()
    await vi.waitFor(() => expect(fixture.read).toHaveBeenCalledWith('ACCOUNT_A'))
    await fixture.controller.refreshAccounts()
    pending.resolve(usage('ACCOUNT_A', 99))
    await older
    expect(fixture.controller.accountState().entries[0]?.usage?.rolling.percent).toBe(10)
  })

  it('refuses replacing a read-only credential before sending an account command', async () => {
    const fixture = setup()
    fixture.server.writable.set('ACCOUNT_A', false)
    await fixture.controller.refreshAccounts()
    expect(await fixture.actions.replaceAccountKey('ACCOUNT_A', 'new-key')).toBe(false)
    expect(fixture.execute).not.toHaveBeenCalled()
    expect(fixture.secrets.get('ACCOUNT_A')).toBe('secret-a')
  })

})
