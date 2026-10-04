// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GoAccountsController } from '../src/client/accounts-controller.ts'
import { OpencodeGoSectionController, type OpencodeGoSettings } from '../src/client/section-controller.ts'
import { AccountsCard } from '../src/client/AccountsCard.tsx'
import { UsagePill } from '../src/client/UsagePill.tsx'
import { en } from '../src/client/locales.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { stubSettingsScope } from './support/settings-scope.ts'
import type { GoUsage } from '../src/usage-contract.ts'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'

const accounts = [{ id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' }, { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' }]
const window = { status: 'ok' as const, percent: 10, resetsAt: '2026-10-03T00:00:00Z' }
const usage = (source: string, percent = 10): GoUsage => ({ source, rolling: { ...window, percent }, weekly: window, monthly: window })
const t = (key: keyof typeof en, params?: Record<string, unknown>) => Object.entries(params ?? {}).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), en[key])
afterEach(cleanup)

function setup(value: OpencodeGoSettings = { accounts, apiKeyEnv: 'ACCOUNT_A' }) {
  const host = stubSettingsScope<OpencodeGoSettings>()
  host.publish({ status: 'ready', writable: true, value, user: {}, revision: 1 })
  const mutate = async (ops: readonly SettingsPathOpView[], revision?: number) => {
    const current = host.scope.getSnapshot()
    if (revision !== undefined && revision !== current.revision) return
    const value = { ...current.value }
    for (const op of ops) if (op.op === 'set') Object.assign(value, { [op.path[0]!]: op.value })
    host.publish({ value, user: value, revision: (current.revision ?? 0) + 1 })
  }
  host.mutate.mockImplementation(mutate)
  host.set.mockImplementation(async (field, value) => { await mutate([{ op: 'set', path: [field], value }]) })
  const secrets = new Map([['ACCOUNT_A', 'secret-a'], ['ACCOUNT_B', 'secret-b']])
  const credentials = {
    describe: vi.fn(async (refs: string[]) => ({ ok: true as const, value: Object.fromEntries(refs.map(ref => [ref, { configured: secrets.has(ref), writable: true }])) })),
    set: vi.fn(async (ref: string, key: string) => { secrets.set(ref, key); return { ok: true as const, value: undefined } }),
    unset: vi.fn(async (ref: string) => { secrets.delete(ref); return { ok: true as const, value: undefined } }),
  }
  const read = vi.fn(async (ref: string) => usage(ref))
  const controller = new GoAccountsController(host.scope, { remote: { credentials } } as never, read, () => {}, () => false)
  host.scope.subscribe(() => { controller.sync() })
  return { host, credentials, secrets, read, controller, actions: controller.actions() }
}

it('stores new keys only through credentials and persists metadata and selection atomically', async () => {
  const fixture = setup({ accounts: [] })
  expect(await fixture.actions.addAccount(' Work ', ' private-new-key ')).toBe(true)
  const config = fixture.host.scope.getSnapshot().value!
  expect(config.accounts).toHaveLength(1)
  expect(config.accounts![0]!.name).toBe('Work')
  expect(config.apiKeyEnv).toBe(config.accounts![0]!.apiKeyEnv)
  expect(fixture.credentials.set).toHaveBeenCalledWith(config.apiKeyEnv, 'private-new-key')
  expect(JSON.stringify([config, fixture.controller.snapshot(), fixture.host.mutate.mock.calls])).not.toContain('private-new-key')
  expect(fixture.host.mutate.mock.calls[0]![0]).toHaveLength(2)
  expect(await fixture.actions.renameAccount(config.apiKeyEnv!, 'Renamed')).toBe(true)
  fixture.controller.dispose()
})

it('replaces an unconfigured legacy placeholder with the first added account', async () => {
  const fixture = setup({})
  await fixture.controller.refresh()
  expect(await fixture.actions.addAccount('Work', 'new-secret')).toBe(true)
  expect(fixture.controller.snapshot().entries).toHaveLength(1)
  expect(fixture.controller.snapshot().entries[0]?.name).toBe('Work')
  fixture.controller.dispose()
})

it('keeps a possibly committed credential after an ambiguous metadata transport failure', async () => {
  const fixture = setup()
  fixture.host.mutate.mockRejectedValueOnce(new Error('transport lost after write'))
  expect(await fixture.actions.addAccount('Work', 'new-secret')).toBe(false)
  expect(fixture.credentials.unset).not.toHaveBeenCalled()
  fixture.controller.dispose()
})

it('allows replacing a writable key even when the settings document is read-only', async () => {
  const fixture = setup()
  fixture.host.publish({ writable: false })
  expect(await fixture.actions.replaceAccountKey('ACCOUNT_A', 'replacement')).toBe(true)
  expect(fixture.credentials.set).toHaveBeenCalledWith('ACCOUNT_A', 'replacement')
  expect(await fixture.actions.selectAccount('ACCOUNT_B')).toBe(false)
  fixture.controller.dispose()
})

it('rolls back the fresh credential when a metadata write is refused and preserves existing secrets', async () => {
  const fixture = setup()
  fixture.host.mutate.mockImplementation(async () => {})
  expect(await fixture.actions.addAccount('Work', 'new-secret')).toBe(false)
  expect(fixture.secrets.size).toBe(2)
  expect(fixture.credentials.unset).toHaveBeenCalledWith(expect.stringMatching(/^DSH_OPENCODE_GO_ACCOUNT_/))
  expect(fixture.controller.snapshot().failure).toBe('write')
  fixture.controller.dispose()
})

it('removes the selected account and chooses its replacement in one write; an empty list stays empty', async () => {
  const fixture = setup()
  expect(await fixture.actions.removeAccount('ACCOUNT_A')).toBe(true)
  expect(fixture.host.mutate.mock.calls[0]![0]).toEqual([
    { op: 'set', path: ['accounts'], value: [accounts[1]] }, { op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_B' },
  ])
  expect(fixture.credentials.unset).not.toHaveBeenCalled()
  expect(await fixture.actions.removeAccount('ACCOUNT_B')).toBe(true)
  expect(fixture.controller.snapshot().entries).toEqual([])
  fixture.controller.dispose()
})

it('removes managed credentials and retains the account entry when the config removal is refused', async () => {
  const fixture = setup({ accounts: [] })
  await fixture.actions.addAccount('Work', 'private-key')
  const ref = fixture.host.scope.getSnapshot().value!.apiKeyEnv!
  fixture.host.mutate.mockImplementationOnce(async () => {})
  expect(await fixture.actions.removeAccount(ref)).toBe(false)
  expect(fixture.credentials.unset).not.toHaveBeenCalled()
  expect(await fixture.actions.removeAccount(ref)).toBe(true)
  expect(fixture.secrets.has(ref)).toBe(false)
  fixture.controller.dispose()
})

it('isolates account quota reads, retains only matching stale data, and clears quota when the key changes', async () => {
  const fixture = setup()
  await fixture.controller.refresh()
  expect(fixture.read.mock.calls.map(([ref]) => ref)).toEqual(['ACCOUNT_A', 'ACCOUNT_B'])
  expect(fixture.host.scope.getSnapshot().value!.apiKeyEnv).toBe('ACCOUNT_A')
  fixture.read.mockRejectedValueOnce({ code: 'opencode-go/usage-unavailable', details: { retryable: true, retainPrevious: true, source: 'ACCOUNT_A' } })
  await fixture.controller.refresh()
  expect(fixture.controller.snapshot().entries[0]).toMatchObject({ stale: true, usage: { source: 'ACCOUNT_A' } })
  const delayed = Promise.withResolvers<GoUsage>()
  fixture.read.mockImplementation(ref => ref === 'ACCOUNT_A' ? delayed.promise : Promise.resolve(usage(ref)))
  fixture.controller.invalidate('ACCOUNT_A')
  expect(fixture.controller.snapshot().entries[0]!.usage).toBeUndefined()
  delayed.resolve(usage('new-account'))
  await vi.waitFor(() => { expect(fixture.controller.snapshot().entries[0]?.usage?.source).toBe('new-account') })
  fixture.controller.dispose()
})

it('fences late usage from an old endpoint or removed account', async () => {
  const fixture = setup()
  const first = Promise.withResolvers<GoUsage>()
  fixture.read.mockImplementationOnce(() => first.promise)
  const old = fixture.controller.refresh()
  await vi.waitFor(() => { expect(fixture.read).toHaveBeenCalled() })
  fixture.host.publish({ value: { accounts: [accounts[1]!], apiKeyEnv: 'ACCOUNT_B', baseURL: 'https://new.test/v1' } })
  first.resolve(usage('old-secret-account'))
  await old
  await vi.waitFor(() => { expect(fixture.controller.snapshot().refreshing).toBe(false) })
  expect(fixture.controller.snapshot().entries).toEqual([expect.objectContaining({ name: 'Backup', usage: { ...usage('ACCOUNT_B') } })])
  fixture.controller.dispose()
})

it('pins an unsaved key draft to its original account when another surface switches accounts', async () => {
  const fixture = setup()
  const controller = new OpencodeGoSectionController(fixture.host.scope, { remote: { credentials: fixture.credentials } } as never)
  const face = controller.inject()
  face.edit('apiKey', 'new-a-secret')
  expect(await face.selectAccount('ACCOUNT_B')).toBe(false)
  fixture.host.publish({ value: { accounts, apiKeyEnv: 'ACCOUNT_B' } })
  face.save()
  await vi.waitFor(() => { expect(fixture.credentials.set).toHaveBeenCalledWith('ACCOUNT_A', 'new-a-secret') })
  await vi.waitFor(() => { expect(face.hooks.opencodeGo.getSnapshot().dirty).toBe(false) })
  expect(fixture.secrets.get('ACCOUNT_B')).toBe('secret-b')
  controller.dispose()
  fixture.controller.dispose()
})

it('keeps a key draft pinned after a partial save fails and a different surface switches accounts', async () => {
  const fixture = setup()
  const controller = new OpencodeGoSectionController(fixture.host.scope, { remote: { credentials: fixture.credentials } } as never)
  const face = controller.inject()
  face.edit('apiKey', 'new-a-secret')
  face.edit('refreshMinutes', '30')
  fixture.host.set.mockRejectedValueOnce(new Error('settings write failed'))
  face.save()
  await vi.waitFor(() => { expect(face.hooks.opencodeGo.getSnapshot()).toMatchObject({ failed: true, saving: false, dirty: true }) })
  fixture.host.publish({ value: { accounts, apiKeyEnv: 'ACCOUNT_B' } })
  face.save()
  await vi.waitFor(() => { expect(face.hooks.opencodeGo.getSnapshot().dirty).toBe(false) })
  expect(fixture.credentials.set.mock.calls.map(([ref]) => ref)).toEqual(['ACCOUNT_A', 'ACCOUNT_A'])
  controller.dispose()
  fixture.controller.dispose()
})

it('keeps rejected account form input and clears it only after a successful submission', async () => {
  const fixture = setup()
  fixture.actions.addAccount = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const props = { state: fixture.controller.snapshot(), actions: fixture.actions, writable: true, t }
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

it('refreshes the pill immediately on switching and discards an old late response using the same reader', async () => {
  const fixture = setup()
  const old = Promise.withResolvers<GoUsage>()
  const fresh = Promise.withResolvers<GoUsage>()
  const read = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => fresh.promise)
  const directory = createSnapshotStore({ current: { provider: 'dsh-opencode-go', model: 'test' }, routable: true, groups: [], failures: [], status: 'ready', error: null })
  await act(async () => { render(<UsagePill directory={directory as never} settings={fixture.host.scope} readUsage={read} t={t as never}
    selectAccount={fixture.actions.selectAccount} />) })
  await act(async () => { fixture.host.publish({ value: { accounts, apiKeyEnv: 'ACCOUNT_B' } }) })
  expect(read).toHaveBeenCalledTimes(2)
  await act(async () => { fresh.resolve(usage('b', 42)) })
  expect(screen.getByRole('button', { name: /OpenCode Go usage/ }).textContent).toContain('42%')
  await act(async () => { old.resolve(usage('a', 91)) })
  expect(screen.getByRole('button', { name: /OpenCode Go usage/ }).textContent).not.toContain('91%')
  fixture.controller.dispose()
})

it('invalidates pill quota immediately when the selected stored key is replaced', async () => {
  const fixture = setup()
  const changes = createSnapshotStore(0)
  const directory = createSnapshotStore({ current: { provider: 'dsh-opencode-go', model: 'test' }, routable: true, groups: [], failures: [], status: 'ready', error: null })
  const pending = Promise.withResolvers<GoUsage>()
  const read = vi.fn().mockResolvedValueOnce(usage('a', 91)).mockImplementationOnce(() => pending.promise)
  await act(async () => { render(<UsagePill directory={directory as never} settings={fixture.host.scope} readUsage={read} t={t as never} credentialChanges={changes} />) })
  await act(async () => { changes.set(1) })
  expect(read).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: /OpenCode Go usage/ }).textContent).not.toContain('91%')
  await act(async () => { pending.resolve(usage('new', 13)) })
  expect(screen.getByRole('button', { name: /OpenCode Go usage/ }).textContent).toContain('13%')
  fixture.controller.dispose()
})

it('shows a successful fallback notice even when the preferred account cannot read usage', async () => {
  const fixture = setup()
  const directory = createSnapshotStore({ current: { provider: 'dsh-opencode-go', model: 'test' }, routable: true, groups: [], failures: [], status: 'ready', error: null })
  const read = vi.fn().mockRejectedValue({ code: 'opencode-go/usage-unavailable', message: 'HTTP 401',
    details: { retryable: false, retainPrevious: false, lastSwitch: { fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: 'credential', at: Date.now() } } })
  await act(async () => { render(<UsagePill directory={directory as never} settings={fixture.host.scope} readUsage={read} t={t as never} />) })
  fireEvent.click(screen.getByRole('button', { name: /OpenCode Go usage/ }))
  expect(screen.getByRole('status').textContent).toContain('Backup')
  expect(screen.getByRole('status').textContent).toContain(en.accountFallbackCredential)
  fixture.controller.dispose()
})

it('ships folded, and keeps every account row detail closed until its disclosure opens', async () => {
  const fixture = setup()
  await fixture.controller.refresh()
  render(<AccountsCard state={fixture.controller.snapshot()} actions={fixture.actions} writable t={t} />)
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

it('writes the dragged order and the new preferred account in one mutation', async () => {
  const fixture = setup()
  await fixture.controller.refresh()
  expect(await fixture.actions.moveAccount('ACCOUNT_B', 0)).toBe(true)
  expect(fixture.host.mutate.mock.calls.at(-1)![0]).toEqual([
    { op: 'set', path: ['accounts'], value: [accounts[1], accounts[0]] },
    { op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_B' },
  ])
  expect(fixture.controller.snapshot().entries.map(entry => entry.apiKeyEnv)).toEqual(['ACCOUNT_B', 'ACCOUNT_A'])
  fixture.controller.dispose()
})

it('keeps the loaded rows when only the order changes', async () => {
  const fixture = setup()
  await fixture.controller.refresh()
  const reads = fixture.read.mock.calls.length
  expect(await fixture.actions.moveAccount('ACCOUNT_B', 0)).toBe(true)
  expect(fixture.read.mock.calls.length).toBe(reads)
  expect(fixture.controller.snapshot().entries[0]).toMatchObject({ apiKeyEnv: 'ACCOUNT_B', usage: { source: 'ACCOUNT_B' } })
  fixture.controller.dispose()
})

it('reorders when a row handle is dragged onto another row', async () => {
  const fixture = setup()
  await fixture.controller.refresh()
  const moveAccount = vi.fn(async () => true)
  render(<AccountsCard state={fixture.controller.snapshot()} actions={{ ...fixture.actions, moveAccount }} writable t={t} />)
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

it('reorders with the arrow keys on a row handle', async () => {
  const fixture = setup()
  await fixture.controller.refresh()
  const moveAccount = vi.fn(async () => true)
  render(<AccountsCard state={fixture.controller.snapshot()} actions={{ ...fixture.actions, moveAccount }} writable t={t} />)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.accountsTitle) }))
  fireEvent.keyDown(screen.getByRole('button', { name: t('accountDragHandle', { name: 'Backup' }) }), { key: 'ArrowUp' })
  expect(moveAccount).toHaveBeenCalledWith('ACCOUNT_B', 0)
  fixture.controller.dispose()
})

