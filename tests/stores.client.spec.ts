/**
 * The OpenCode Go settings page's staged form and controller: what a draft
 * shows before it is written, which wire call a save reaches, how credential
 * state is probed and written outside the section, and what happens to drafts
 * the Host did not accept.
 */

import { describe, expect, it, vi, type Mock } from 'vitest'
import type { LlmDiscoveredModel, SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { RemoteError, stubSettingsScope } from './support/client.ts'
import {
  StagedForm,
  numberField,
  textField,
  type FieldState,
  type FormShell,
} from '../src/client/staged-form.ts'
import {
  OpencodeGoSectionController,
  type OpencodeGoSettings,
} from '../src/client/section-controller.ts'

/** Make the stub behave like a Host that accepts every write. */
function acceptWrites(host: ReturnType<typeof stubSettingsScope>): void {
  const section = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().value as object })
  const layer = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().user as object })
  host.set.mockImplementation((field: string, value: unknown) => {
    host.publish({ value: { ...section(), [field]: value }, user: { ...layer(), [field]: value } })
  })
  host.mutate.mockImplementation((ops: readonly SettingsPathOpView[]) => {
    const value = { ...section() }
    const user = { ...layer() }
    for (const op of ops) {
      const field = op.path[0]!
      if (op.op === 'set') {
        value[field] = op.value
        user[field] = op.value
      }
    }
    host.publish({ value, user })
  })
  host.unset.mockImplementation((field: string) => {
    const user = Object.fromEntries(Object.entries(layer()).filter(([key]) => key !== field))
    const base = host.scope.getSnapshot().base as Record<string, unknown> | undefined
    host.publish({ value: { ...section(), [field]: base?.[field] }, user })
  })
}

/**
 * The stub's `set` spy under the scope face's declared signature. The untyped
 * `vi.fn()` receiver reads as void-returning to the linter, so promise
 * implementations need the promise-returning signature in force.
 */
function setSpy(host: ReturnType<typeof stubSettingsScope>): Mock<(field: string, value: unknown) => Promise<void>> {
  return host.set as Mock<(field: string, value: unknown) => Promise<void>>
}

/** The page plugin's context, scripted down to the namespaces it reaches. */
function ctxWith(namespaces: object) {
  return { remote: namespaces } as never
}

function credentialsApi(configured: boolean, ref = 'OPENCODE_API_KEY') {
  const describe = vi.fn(() => Promise.resolve({
    ok: true as const,
    value: { [ref]: { configured, writable: true } },
  }))
  const set = vi.fn(() => Promise.resolve({ ok: true as const, value: undefined }))
  return { ctx: ctxWith({ credentials: { describe, set } }), describe, set }
}

/** A context whose credential reads answer, and whose model discovery is scripted. */
function pageCtx(discoverModels: Mock) {
  const describe = vi.fn(() => Promise.resolve({ ok: true as const, value: {} }))
  return ctxWith({ credentials: { describe, set: vi.fn() }, llm: { discoverModels } })
}

/** A successful discovery answer carrying the given listing. */
function discovered(models: readonly { id: string; name?: string }[]): {
  ok: true
  value: readonly LlmDiscoveredModel[]
} {
  return { ok: true, value: models }
}

const settled: FormShell = {
  available: true,
  writable: true,
  dirty: false,
  invalid: false,
  saving: false,
  failed: false,
}

function field(text: string, rest: Partial<FieldState> = {}): FieldState {
  return { text, overridden: false, invalid: false, ...rest }
}

const specs = [textField('baseURL'), numberField('refreshMinutes')]

describe('StagedForm', () => {
  it('shows the effective value and the override state without staged edits', () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const form = new StagedForm(host.scope as never, specs)
    host.publish({
      status: 'ready',
      writable: true,
      value: { baseURL: 'https://gateway.test/v1', refreshMinutes: 30 },
      user: { refreshMinutes: 30 },
    })

    expect(form.shell()).toEqual(settled)
    expect(form.field('baseURL')).toEqual(field('https://gateway.test/v1'))
    expect(form.field('refreshMinutes')).toEqual(field('30', { overridden: true }))
  })

  it('stages edits and previews override and invalid states before any write', () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    acceptWrites(host)
    const form = new StagedForm(host.scope as never, specs)
    host.publish({ status: 'ready', writable: true, value: { refreshMinutes: 60 }, user: {} })

    form.actions().edit('refreshMinutes', '45')
    expect(form.field('refreshMinutes')).toEqual(field('45', { overridden: true }))
    expect(form.shell().dirty).toBe(true)

    form.actions().edit('refreshMinutes', 'not-a-number')
    expect(form.field('refreshMinutes')).toEqual(field('not-a-number', { overridden: false, invalid: true }))
    expect(form.shell().invalid).toBe(true)

    form.actions().edit('refreshMinutes', '')
    // An empty number draft is a clear, not an invalid value.
    expect(form.field('refreshMinutes')).toEqual(field('', { overridden: false }))
    expect(form.shell().invalid).toBe(false)
  })

  it('skips saving a draft that equals the stored value, and refuses invalid plans', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    acceptWrites(host)
    const form = new StagedForm(host.scope as never, specs)
    host.publish({ status: 'ready', writable: true, value: { baseURL: 'https://gateway.test/v1' }, user: {} })
    const actions = form.actions()

    actions.edit('baseURL', 'https://gateway.test/v1')
    actions.save()
    await vi.waitFor(() => { expect(host.set).not.toHaveBeenCalled() })
    expect(form.shell().dirty).toBe(false)

    actions.edit('baseURL', '   ')
    actions.edit('refreshMinutes', 'nope')
    await form.save()
    expect(host.set).not.toHaveBeenCalled()
    expect(form.shell().dirty).toBe(true)
  })

  it('writes staged edits on save, clears accepted drafts, and re-reads from the Host', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    acceptWrites(host)
    const form = new StagedForm(host.scope as never, specs)
    host.publish({ status: 'ready', writable: true, value: { refreshMinutes: 60 }, user: {} })

    form.actions().edit('baseURL', 'https://new.test/v1')
    form.actions().edit('refreshMinutes', '15')
    await form.save()

    expect(host.set).toHaveBeenCalledWith('baseURL', 'https://new.test/v1')
    expect(host.set).toHaveBeenCalledWith('refreshMinutes', 15)
    expect(form.shell()).toEqual(settled)
  })

  it('keeps drafts and reports failure when the Host does not hold what was staged', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const form = new StagedForm(host.scope as never, specs)
    // The Host never publishes the write back: the read-back reports failure.
    setSpy(host).mockImplementation(() => Promise.resolve())
    host.publish({ status: 'ready', writable: true, value: {}, user: {} })

    form.actions().edit('baseURL', 'https://rejected.test/v1')
    await form.save()

    expect(form.shell()).toMatchObject({ dirty: true, failed: true })
    form.actions().discard()
    expect(form.shell()).toEqual(settled)
  })

  it('does not start a second save while one is in flight and drops empty discards', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const form = new StagedForm(host.scope as never, specs)
    host.publish({ status: 'ready', writable: true, value: {}, user: {} })
    form.actions().discard()
    expect(form.shell()).toEqual(settled)

    let release!: () => void
    setSpy(host).mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))
    form.actions().edit('baseURL', 'https://slow.test/v1')
    const first = form.save()
    form.actions().save()
    expect(host.set).toHaveBeenCalledTimes(1)
    release()
    await first
  })

  it('clears a stored field only when the user layer carries it', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    acceptWrites(host)
    const form = new StagedForm(host.scope as never, specs)
    host.publish({ status: 'ready', writable: true, value: { baseURL: 'https://x.test/v1' }, user: { baseURL: 'https://x.test/v1' } })

    form.actions().resetField('baseURL')
    await form.save()

    expect(host.unset).toHaveBeenCalledWith('baseURL')
    expect(form.field('baseURL').overridden).toBe(false)

    // A second clear of an inherited field plans nothing.
    form.actions().resetField('baseURL')
    expect(form.shell().dirty).toBe(false)
  })

  it('previews a staged clear and plans a parse-clear write', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    acceptWrites(host)
    const form = new StagedForm(host.scope as never, specs)
    host.publish({
      status: 'ready',
      writable: true,
      value: { refreshMinutes: 60 },
      base: { refreshMinutes: 60 },
      user: { refreshMinutes: 60 },
    })
    const actions = form.actions()

    // A reset previews as not overridden: saving clears the user layer.
    actions.resetField('refreshMinutes')
    expect(form.field('refreshMinutes')).toEqual(field('60', { overridden: false }))

    await form.save()
    expect(host.unset).toHaveBeenCalledWith('refreshMinutes')

    // A blank number draft parses to a clear, which plans the same write.
    actions.edit('refreshMinutes', '')
    await form.save()
    expect(host.unset).toHaveBeenCalledTimes(2)
  })

  it('plans nothing for a secret staged blank, keeping the stored key', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const credentials = credentialsApi(true)
    const controller = new OpencodeGoSectionController(host.scope, credentials.ctx)
    host.publish({ status: 'ready', writable: true, value: {}, user: {} })
    const face = controller.inject()

    face.edit('apiKey', '   ')
    face.save()
    await vi.waitFor(() => { expect(face.hooks.opencodeGo.getSnapshot().saving).toBe(false) })

    expect(credentials.set).not.toHaveBeenCalled()
    // A blank secret plans nothing, so the form is clean without discarding.
    expect(face.hooks.opencodeGo.getSnapshot().dirty).toBe(false)
  })

  it('reports an unready namespace and refuses unknown fields loudly', () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const form = new StagedForm(host.scope as never, specs)

    expect(form.shell().available).toBe(false)
    expect(() => form.field('mystery')).toThrow(/no field mystery/)
  })
})

describe('OpencodeGoSectionController', () => {
  const ready = (value: OpencodeGoSettings, user: Record<string, unknown> = {}) => ({
    status: 'ready' as const,
    writable: true,
    value,
    user,
  })

  it('reads the credential state for the reference the section names', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const credentials = credentialsApi(true, 'MY_OPENCODE_KEY')
    const controller = new OpencodeGoSectionController(host.scope, credentials.ctx)
    const state = () => controller.inject().hooks.opencodeGo.getSnapshot()
    await vi.waitFor(() => { expect(credentials.describe).toHaveBeenCalled() })

    host.publish(ready({ baseURL: 'https://gateway.test/v1', apiKeyEnv: 'MY_OPENCODE_KEY' }))
    await vi.waitFor(() => { expect(state().apiKeyConfigured).toBe(true) })

    expect(credentials.describe).toHaveBeenCalledWith(['MY_OPENCODE_KEY'])
    expect(state()).toMatchObject({
      baseURL: { text: 'https://gateway.test/v1', overridden: false },
      refreshMinutes: { text: '', overridden: false },
      apiKey: { text: '', overridden: false },
      apiKeyWritable: true,
    })
  })

  it('defaults the credential reference when the section names none', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const credentials = credentialsApi(false)
    new OpencodeGoSectionController(host.scope, credentials.ctx)
    host.publish(ready({}))

    await vi.waitFor(() => {
      expect(credentials.describe).toHaveBeenCalledWith(['OPENCODE_API_KEY'])
    })
  })

  it('resets the credential answer when the section starts naming another reference', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const credentials = credentialsApi(true, 'FIRST_REF')
    const controller = new OpencodeGoSectionController(host.scope, credentials.ctx)
    host.publish(ready({ apiKeyEnv: 'FIRST_REF' }))
    await vi.waitFor(() => { expect(controller.inject().hooks.opencodeGo.getSnapshot().apiKeyConfigured).toBe(true) })

    credentials.describe.mockImplementation(() => Promise.resolve({
      ok: true as const,
      value: { SECOND_REF: { configured: false, writable: true } },
    }))
    host.publish(ready({ apiKeyEnv: 'SECOND_REF' }))

    await vi.waitFor(() => {
      expect(controller.inject().hooks.opencodeGo.getSnapshot().apiKeyConfigured).toBe(false)
    })
    expect(credentials.describe).toHaveBeenCalledWith(['SECOND_REF'])
  })

  it('drops a describe response that failed or drifted to another reference', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const credentials = credentialsApi(true)
    const controller = new OpencodeGoSectionController(host.scope, credentials.ctx)
    host.publish(ready({}))
    await vi.waitFor(() => { expect(controller.inject().hooks.opencodeGo.getSnapshot().apiKeyConfigured).toBe(true) })
    const state = () => controller.inject().hooks.opencodeGo.getSnapshot()

    credentials.describe.mockImplementation(() => Promise.resolve({
      ok: false as const,
      error: new RemoteError('gateway/internal', 'describe failed', {}),
    } as never))
    let calls = credentials.describe.mock.calls.length
    host.publish(ready({}))
    await vi.waitFor(() => { expect(credentials.describe.mock.calls.length).toBeGreaterThan(calls) })
    expect(state().apiKeyConfigured).toBe(true)

    // A batch naming another reference carries no entry for the one in force;
    // the badge reports it unconfigured rather than keeping a stale claim.
    credentials.describe.mockImplementation(() => Promise.resolve({
      ok: true as const,
      value: { OTHER_REF: { configured: false, writable: false } },
    }))
    calls = credentials.describe.mock.calls.length
    host.publish(ready({}))
    await vi.waitFor(() => { expect(credentials.describe.mock.calls.length).toBeGreaterThan(calls) })
    expect(state().apiKeyConfigured).toBe(false)
  })

  it('refreshes the credential badge only for the reference it watches', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const credentials = credentialsApi(true)
    const controller = new OpencodeGoSectionController(host.scope, credentials.ctx)
    host.publish(ready({}))
    await vi.waitFor(() => { expect(credentials.describe).toHaveBeenCalled() })

    controller.refreshCredential('SOME_OTHER_REF')
    const calls = credentials.describe.mock.calls.length
    expect(credentials.describe.mock.calls.length).toBe(calls)

    controller.refreshCredential('OPENCODE_API_KEY')
    await vi.waitFor(() => { expect(credentials.describe.mock.calls.length).toBeGreaterThan(calls) })
  })

  it('writes the staged key through the credentials domain, never the settings section', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const credentials = credentialsApi(false)
    const controller = new OpencodeGoSectionController(host.scope, credentials.ctx)
    host.publish(ready({}))
    const face = controller.inject()

    face.edit('apiKey', ' opencode-secret ')
    expect(face.hooks.opencodeGo.getSnapshot().dirty).toBe(true)
    expect(credentials.set).not.toHaveBeenCalled()

    credentials.describe.mockImplementation(() => Promise.resolve({
      ok: true as const,
      value: { OPENCODE_API_KEY: { configured: true, writable: true } },
    }))
    face.save()
    await vi.waitFor(() => { expect(credentials.set).toHaveBeenCalled() })

    expect(credentials.set).toHaveBeenCalledWith('OPENCODE_API_KEY', 'opencode-secret')
    expect(host.set).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(face.hooks.opencodeGo.getSnapshot()).toMatchObject({ dirty: false, apiKeyConfigured: true })
    })
  })

  it('reads the gateway listing for this adapter and previews its model names', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const discoverModels = vi.fn(() => Promise.resolve(discovered([
      { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash' },
      { id: 'deepseek-v4-flash' },
      { id: 'kimi-k2' }, { id: 'glm-5' }, { id: 'qwen3-max' }, { id: 'grok-5' }, { id: 'gpt-6' },
    ])))
    const controller = new OpencodeGoSectionController(host.scope, pageCtx(discoverModels))
    host.publish(ready({}))
    const state = () => controller.inject().hooks.opencodeGo.getSnapshot()

    expect(state().models).toEqual({ status: 'idle' })
    controller.loadModels()
    expect(state().models).toEqual({ status: 'loading' })
    expect(discoverModels).toHaveBeenCalledWith('llm-opencode-go', { provider: 'opencode-go' })

    await vi.waitFor(() => { expect(state().models.status).toBe('ready') })
    // Every model is visible, including those beyond the former six-name preview.
    expect(state().models).toEqual({
      status: 'ready',
      count: 7,
      preview: ['DeepSeek V4.1 Flash', 'deepseek-v4-flash', 'kimi-k2', 'glm-5', 'qwen3-max', 'grok-5', 'gpt-6'],
    })
  })

  it('reports a refused listing with the Host diagnostic', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const discoverModels = vi.fn(() => Promise.resolve({
      ok: false as const,
      error: new RemoteError('llm/model-discovery-rejected', 'the live model listing is unreachable', {
        settingsNs: 'llm-opencode-go',
      }),
    }))
    const controller = new OpencodeGoSectionController(host.scope, pageCtx(discoverModels))
    host.publish(ready({}))

    controller.loadModels()
    const state = () => controller.inject().hooks.opencodeGo.getSnapshot()
    await vi.waitFor(() => {
      expect(state().models).toEqual({ status: 'failed', message: 'the live model listing is unreachable' })
    })
  })

  it('reports a rejected listing read as a failure instead of loading forever', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    const discoverModels = vi.fn(() => Promise.reject(new Error('the gateway connection closed')))
    const controller = new OpencodeGoSectionController(host.scope, pageCtx(discoverModels))
    host.publish(ready({}))
    const state = () => controller.inject().hooks.opencodeGo.getSnapshot()

    controller.loadModels()
    expect(state().models).toEqual({ status: 'loading' })
    await vi.waitFor(() => {
      expect(state().models).toEqual({ status: 'failed', message: 'the gateway connection closed' })
    })
  })

  it('names a non-Error rejection in the failure it reports', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- the non-Error arm is the case under test.
    const discoverModels = vi.fn(() => Promise.reject('gateway offline'))
    const controller = new OpencodeGoSectionController(host.scope, pageCtx(discoverModels))
    host.publish(ready({}))

    controller.loadModels()
    await vi.waitFor(() => {
      expect(controller.inject().hooks.opencodeGo.getSnapshot().models)
        .toEqual({ status: 'failed', message: 'gateway offline' })
    })
  })

  it('drops a rejected listing answer a later read already replaced', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    let rejectFirst!: (reason: unknown) => void
    let settleSecond!: (answer: unknown) => void
    const discoverModels = vi.fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise((resolve) => { settleSecond = resolve }))
    const controller = new OpencodeGoSectionController(host.scope, pageCtx(discoverModels as never))
    host.publish(ready({}))
    const state = () => controller.inject().hooks.opencodeGo.getSnapshot()

    controller.loadModels()
    controller.loadModels()
    settleSecond(discovered([{ id: 'second' }]))
    await vi.waitFor(() => { expect(state().models).toEqual({ status: 'ready', count: 1, preview: ['second'] }) })

    rejectFirst(new Error('the first read failed late'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(state().models).toEqual({ status: 'ready', count: 1, preview: ['second'] })
  })

  it('drops a listing answer a later read already replaced', async () => {
    const host = stubSettingsScope<OpencodeGoSettings>()
    let settleFirst!: (answer: unknown) => void
    let settleSecond!: (answer: unknown) => void
    const discoverModels = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { settleFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { settleSecond = resolve }))
    const controller = new OpencodeGoSectionController(host.scope, pageCtx(discoverModels as never))
    host.publish(ready({}))
    const state = () => controller.inject().hooks.opencodeGo.getSnapshot()

    controller.loadModels()
    controller.loadModels()
    settleSecond(discovered([{ id: 'second' }]))
    await vi.waitFor(() => { expect(state().models).toEqual({ status: 'ready', count: 1, preview: ['second'] }) })

    settleFirst(discovered([{ id: 'first' }, { id: 'another' }]))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(state().models).toEqual({ status: 'ready', count: 1, preview: ['second'] })
  })
})
