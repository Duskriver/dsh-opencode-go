import { expect, it, vi } from 'vitest'
import { ACCOUNT_RECOVERY_TIMEOUT_MS, GoAccountManager } from '../src/account-manager.ts'
import { ACCOUNT_REF_PREFIX, accountsOf, type AccountSettings } from '../src/accounts.ts'
import type { AccountCommand } from '../src/accounts-contract.ts'

const add = (id = 'a'.repeat(32)): AccountCommand => ({ kind: 'add', id, name: id[0]!, key: `private-key-${id[0]}` })
const backup = { id: 'backup', name: 'Backup', apiKeyEnv: 'BACKUP_KEY' }
const owned = { id: 'a'.repeat(32), name: 'Work', apiKeyEnv: ACCOUNT_REF_PREFIX + 'A'.repeat(32) }

function fixture(initial: AccountSettings = { accounts: [] }) {
  let value = structuredClone(initial), revision = 1
  const secrets = new Map<string, string>()
  const settings = {
    describe: () => [{ ns: 'opencode-go', revision, value }],
    mutate: vi.fn(async (_ns: string, ops: readonly { op: 'set'; path: string[]; value: unknown }[], expected?: number) => {
      if (expected !== revision) return false
      value = { ...value, ...Object.fromEntries(ops.map(op => [op.path[0], op.value])) }
      revision++
      return true
    }),
  }
  const credentials = {
    describe: vi.fn(async (ref: string) => ({ configured: secrets.has(ref), writable: true })),
    set: vi.fn(async (ref: string, key: string) => { secrets.set(ref, key) }),
    unset: vi.fn(async (ref: string) => { secrets.delete(ref) }),
  }
  const manager = new GoAccountManager({ warn: vi.fn() })
  const disconnect = manager.connect(settings, credentials)
  return { manager, disconnect, settings, credentials, secrets, value: () => value,
    externalEdit: (patch: AccountSettings) => { value = { ...value, ...patch }; revision++ } }
}

it('serializes concurrent additions and makes a repeated addition ID idempotent', async () => {
  const f = fixture()
  expect(await Promise.all([f.manager.execute(add()), f.manager.execute(add('b'.repeat(32)))])).toEqual(['applied', 'applied'])
  expect(f.value().accounts?.map(account => account.id)).toEqual(['a'.repeat(32), 'b'.repeat(32)])
  expect(f.value().apiKeyEnv).toBe(ACCOUNT_REF_PREFIX + 'A'.repeat(32))
  expect(f.value().accountOperations).toEqual([])
  expect(await f.manager.execute(add())).toBe('applied')
  expect(f.credentials.set).toHaveBeenCalledTimes(2)
  expect(JSON.stringify([f.value(), f.settings.mutate.mock.calls])).not.toContain('private-key')
})

it('keeps different addition IDs separate when their labels match a pending addition', async () => {
  const f = fixture({ accounts: [backup], apiKeyEnv: backup.apiKeyEnv })
  f.secrets.set(backup.apiKeyEnv, 'backup-secret')
  const commit = f.settings.mutate.getMockImplementation()!
  f.settings.mutate.mockImplementationOnce(commit).mockResolvedValueOnce(false)
  expect(await f.manager.execute({ ...add(), name: 'Same label' })).toBe('unknown')
  expect(f.value().accountOperations).toHaveLength(1)
  expect(await f.manager.execute({ ...add('b'.repeat(32)), name: 'Same label' })).toBe('applied')
  expect(f.secrets.get(owned.apiKeyEnv)).toBe('private-key-a')
  expect(f.secrets.get(ACCOUNT_REF_PREFIX + 'B'.repeat(32))).toBe('private-key-b')
  expect(f.value().accounts?.some(account => account.id === 'b'.repeat(32))).toBe(true)
  expect(await f.manager.execute({ ...add(), name: 'Same label' })).toBe('applied')
  expect(f.value().accounts?.filter(account => account.name === 'Same label')).toHaveLength(2)
  expect(f.value().apiKeyEnv).toBe(backup.apiKeyEnv)
  expect(f.value().accountOperations).toEqual([])
})

it.each(['reconnect', 'remount', 'new provider', 'failed write'] as const)(
  'keeps an interrupted addition removable until its actual key write settles (%s)', async mode => {
    const f = fixture()
    const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
    f.credentials.set.mockImplementationOnce(async (ref, key) => {
      started.resolve()
      await release.promise
      if (mode === 'failed write') throw new Error('Credential write failed')
      f.secrets.set(ref, key)
    })
    const addition = f.manager.execute(add())
    await started.promise
    f.disconnect()
    expect(await addition).toBe('unknown')
    const manager = mode === 'remount' || mode === 'new provider' ? new GoAccountManager({ warn: vi.fn() }) : f.manager
    const disconnect = manager.connect(f.settings, mode === 'new provider' ? { ...f.credentials } : f.credentials)
    await manager.recover()
    let removed = false
    const removal = manager.execute({ kind: 'remove', ref: owned.apiKeyEnv }).then(status => { removed = true; return status })
    try {
      await vi.waitFor(() => expect(f.settings.mutate.mock.calls.some(([, ops]) =>
        ops.some(op => op.path[0] === 'accountOperations' && (op.value as { kind?: string }[])?.some(entry => entry.kind === 'remove')))).toBe(true))
      expect(removed).toBe(false)
      expect(f.value().accountOperations?.[0]?.kind).toBe('remove')
    } finally { release.resolve(); await removal; disconnect() }
    expect(await removal).toBe('applied')
    expect(f.secrets.has(owned.apiKeyEnv)).toBe(false)
    expect(f.value().accounts).toEqual([])
    expect(f.value().accountOperations).toEqual([])
  },
)

it('retains the deletion intention through a timeout while the earlier key write is still running', async () => {
  vi.useFakeTimers()
  const f = fixture()
  const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  f.credentials.set.mockImplementationOnce(async (ref, key) => {
    started.resolve()
    await release.promise
    f.secrets.set(ref, key)
  })
  try {
    const addition = f.manager.execute(add())
    await started.promise
    await vi.advanceTimersByTimeAsync(ACCOUNT_RECOVERY_TIMEOUT_MS + 1)
    expect(await addition).toBe('unknown')
    const removal = f.manager.execute({ kind: 'remove', ref: owned.apiKeyEnv })
    await vi.advanceTimersByTimeAsync(ACCOUNT_RECOVERY_TIMEOUT_MS + 1)
    expect(await removal).toBe('unknown')
    expect(f.value().accountOperations?.[0]?.kind).toBe('remove')
    expect(await f.manager.execute(add())).toBe('rejected')
    // A stuck write blocks its own reference, not another account's commands.
    expect(await f.manager.execute(add('b'.repeat(32)))).toBe('applied')
    release.resolve()
    await f.manager.recover()
    expect(f.secrets.has(owned.apiKeyEnv)).toBe(false)
    expect(f.value().accounts?.map(account => account.id)).toEqual(['b'.repeat(32)])
    expect(f.value().accountOperations).toEqual([])
  } finally { release.resolve(); f.disconnect(); vi.useRealTimers() }
})

it('rejects a key replacement if another manager removed its account during describe', async () => {
  const f = fixture({ accounts: [owned], apiKeyEnv: owned.apiKeyEnv })
  f.secrets.set(owned.apiKeyEnv, 'original-key')
  await f.manager.recover()
  const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  f.credentials.describe.mockImplementationOnce(async () => {
    started.resolve()
    await release.promise
    return { configured: true, writable: true }
  })
  const replacement = f.manager.execute({ kind: 'replace-key', ref: owned.apiKeyEnv, key: 'replacement-key' })
  await started.promise
  const other = new GoAccountManager({ warn: vi.fn() })
  const disconnect = other.connect(f.settings, f.credentials)
  await other.recover()
  try {
    expect(await other.execute({ kind: 'remove', ref: owned.apiKeyEnv })).toBe('applied')
  } finally { release.resolve(); disconnect() }
  expect(await replacement).toBe('rejected')
  expect(f.credentials.set).not.toHaveBeenCalled()
  expect(f.secrets.has(owned.apiKeyEnv)).toBe(false)
  expect(f.value().accounts).toEqual([])
})

it('orders deletion after a replacement already writing through another manager', async () => {
  const f = fixture({ accounts: [owned], apiKeyEnv: owned.apiKeyEnv })
  f.secrets.set(owned.apiKeyEnv, 'original-key')
  await f.manager.recover()
  const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  f.credentials.set.mockImplementationOnce(async (ref, key) => {
    started.resolve()
    await release.promise
    f.secrets.set(ref, key)
  })
  const replacement = f.manager.execute({ kind: 'replace-key', ref: owned.apiKeyEnv, key: 'replacement-key' })
  await started.promise
  const other = new GoAccountManager({ warn: vi.fn() })
  const disconnect = other.connect(f.settings, f.credentials)
  await other.recover()
  let removed = false
  const removal = other.execute({ kind: 'remove', ref: owned.apiKeyEnv }).then(status => { removed = true; return status })
  try {
    await vi.waitFor(() => expect(f.settings.mutate.mock.calls.some(([, ops]) =>
      ops.some(op => op.path[0] === 'accountOperations' && (op.value as { kind?: string }[])?.some(entry => entry.kind === 'remove')))).toBe(true))
    expect(removed).toBe(false)
    expect(f.value().accountOperations?.[0]?.kind).toBe('remove')
  } finally { release.resolve(); await Promise.all([replacement, removal]); disconnect() }
  expect(await removal).toBe('applied')
  expect(f.secrets.has(owned.apiKeyEnv)).toBe(false)
  expect(f.value().accounts).toEqual([])
  expect(f.value().accountOperations).toEqual([])
})

it('persists a legacy current account first without changing credentials, and is idempotent', async () => {
  const primary = { id: 'primary', name: 'Primary', apiKeyEnv: 'PRIMARY_KEY' }
  const third = { id: 'third', name: 'Third', apiKeyEnv: 'THIRD_KEY' }
  const f = fixture({ accounts: [primary, backup, third], apiKeyEnv: third.apiKeyEnv })
  await f.manager.recover()
  expect(f.value()).toEqual({ accounts: [third, primary, backup], apiKeyEnv: third.apiKeyEnv })
  expect(f.settings.mutate).toHaveBeenCalledTimes(1)
  expect(f.settings.mutate).toHaveBeenCalledWith('opencode-go', [
    { op: 'set', path: ['accounts'], value: [third, primary, backup] },
    { op: 'set', path: ['apiKeyEnv'], value: third.apiKeyEnv },
  ], 1)
  await f.manager.recover()
  expect(f.settings.mutate).toHaveBeenCalledTimes(1)
  expect(f.credentials.describe).not.toHaveBeenCalled()
  expect(f.credentials.set).not.toHaveBeenCalled()
  expect(f.credentials.unset).not.toHaveBeenCalled()
})

it('keeps a competing selection when legacy order normalization loses its revision', async () => {
  const primary = { id: 'primary', name: 'Primary', apiKeyEnv: 'PRIMARY_KEY' }
  const f = fixture({ accounts: [primary, backup], apiKeyEnv: backup.apiKeyEnv })
  f.settings.mutate.mockImplementationOnce(async () => {
    f.externalEdit({ accounts: [primary, backup], apiKeyEnv: primary.apiKeyEnv })
    return false
  })
  await f.manager.recover()
  expect(f.value()).toEqual({ accounts: [primary, backup], apiKeyEnv: primary.apiKeyEnv })
  await f.manager.recover()
  expect(f.settings.mutate).toHaveBeenCalledTimes(1)
})

it('keeps the selected account first in the view when legacy order cannot yet be persisted', async () => {
  const primary = { id: 'primary', name: 'Primary', apiKeyEnv: 'PRIMARY_KEY' }
  const f = fixture({ accounts: [primary, backup], apiKeyEnv: backup.apiKeyEnv })
  const commit = f.settings.mutate.getMockImplementation()!
  f.settings.mutate.mockResolvedValueOnce(false)
  await f.manager.recover()
  expect(f.value()).toEqual({ accounts: [primary, backup], apiKeyEnv: backup.apiKeyEnv })
  expect(accountsOf(f.value())).toEqual([backup, primary])
  f.settings.mutate.mockImplementation(commit)
  await f.manager.recover()
  expect(f.value()).toEqual({ accounts: [backup, primary], apiKeyEnv: backup.apiKeyEnv })
  expect(f.settings.mutate).toHaveBeenCalledTimes(2)
})

it('moves a new account first when it replaces the selection of unconfigured accounts', async () => {
  const f = fixture({ accounts: [backup], apiKeyEnv: backup.apiKeyEnv })
  expect(await f.manager.execute(add())).toBe('applied')
  expect(f.value().accounts).toEqual([
    expect.objectContaining({ id: 'a'.repeat(32) }), backup,
  ])
  expect(f.value().apiKeyEnv).toBe(f.value().accounts?.[0]?.apiKeyEnv)
})

it('recovers the same foreground intention when metadata fails after the key is saved', async () => {
  const f = fixture()
  const commit = f.settings.mutate.getMockImplementation()!
  f.settings.mutate.mockImplementationOnce(commit).mockResolvedValueOnce(false)
  expect(await f.manager.execute(add())).toBe('unknown')
  expect(f.value().accounts).toEqual([])
  expect(f.value().accountOperations).toHaveLength(1)
  expect(f.secrets.size).toBe(1)
  await f.manager.recover()
  expect(f.value().accounts).toHaveLength(1)
  expect(f.value().accountOperations).toEqual([])
  expect(f.credentials.set).toHaveBeenCalledTimes(1)
})

it('preserves another surface\'s selection and account edits while a key write is in flight', async () => {
  const f = fixture()
  f.credentials.set.mockImplementationOnce(async (ref, key) => {
    f.secrets.set(ref, key)
    f.externalEdit({ accounts: [backup], apiKeyEnv: backup.apiKeyEnv })
  })
  expect(await f.manager.execute(add())).toBe('applied')
  expect(f.value().accounts).toEqual([backup, expect.objectContaining({ id: 'a'.repeat(32) })])
  expect(f.value().apiKeyEnv).toBe(backup.apiKeyEnv)
})

it.each([false, undefined])('never writes a key without confirmed durable intention (%s)', async verdict => {
  const f = fixture()
  f.settings.mutate.mockResolvedValue(verdict as never)
  expect(await f.manager.execute(add())).toBe(verdict === false ? 'rejected' : 'unknown')
  expect(f.credentials.set).not.toHaveBeenCalled()
  expect(f.value().accounts).toEqual([])
})

it('rejects queued commands for a detached profile and lets the next connection recover', async () => {
  const f = fixture()
  const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  f.credentials.set.mockImplementationOnce(async (ref, key) => {
    started.resolve()
    await release.promise
    f.secrets.set(ref, key)
  })
  const running = f.manager.execute(add())
  await started.promise
  const queued = f.manager.execute({ kind: 'rename', ref: ACCOUNT_REF_PREFIX + 'A'.repeat(32), name: 'stale' })
  f.disconnect()
  expect(await running).toBe('unknown')
  expect(await queued).toBe('rejected')
  expect(f.value().accounts).toEqual([])
  release.resolve()
  await vi.waitFor(() => expect(f.secrets.size).toBe(1))
  f.manager.connect(f.settings, f.credentials)
  await f.manager.recover()
  expect(f.value().accounts?.[0]?.name).toBe('a')
  expect(f.value().accountOperations).toEqual([])
})

it('rejects malformed commands before performing settings or credential work', () => {
  const f = fixture()
  expect(() => f.manager.execute({ ...add(), secretInSettings: 'forbidden' } as never)).toThrow('Invalid account command')
  expect(() => f.manager.execute({ kind: 'replace-key', ref: '../INVALID', key: 'key' })).toThrow('Invalid account reference')
  expect(f.settings.mutate).not.toHaveBeenCalled()
  expect(f.credentials.set).not.toHaveBeenCalled()
})
