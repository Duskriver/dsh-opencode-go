import { expect, it, vi } from 'vitest'
import { ACCOUNT_RECOVERY_TIMEOUT_MS, GoAccountRecovery } from '../src/account-recovery.ts'
import { assertAccountOperations, visibleAccountsOf, type GoAccountOperation } from '../src/account-operations.ts'
import { ACCOUNT_REF_PREFIX, type AccountSettings } from '../src/accounts.ts'

const account = { id: 'a'.repeat(32), name: 'Work', apiKeyEnv: ACCOUNT_REF_PREFIX + 'A'.repeat(32) }
const backup = { id: 'backup', name: 'Backup', apiKeyEnv: 'BACKUP_KEY' }
const add: GoAccountOperation = { id: account.id, kind: 'add', account, select: true, previousRef: 'OPENCODE_API_KEY' }
const remove: GoAccountOperation = { id: 'b'.repeat(32), kind: 'remove', account }

function fixture(initial: AccountSettings, configured = true) {
  let value = structuredClone(initial), revision = 1
  const secrets = new Set(configured ? [account.apiKeyEnv] : [])
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
    unset: vi.fn(async (ref: string) => { secrets.delete(ref) }),
  }
  const logger = { warn: vi.fn() }
  const recovery = new GoAccountRecovery(logger)
  const disconnect = recovery.connect(settings, credentials)
  return { settings, credentials, secrets, logger, recovery, disconnect, value: () => value }
}

it('recovers a key committed before metadata after the browser and host restart', async () => {
  const f = fixture({ accounts: [], accountOperations: [add] })
  await f.recovery.recover()
  expect(f.value()).toEqual({ accounts: [account], apiKeyEnv: account.apiKeyEnv, accountOperations: [] })
  expect(f.credentials.unset).not.toHaveBeenCalled()
  await f.recovery.recover()
  expect(f.settings.mutate).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(f.value())).not.toContain('secret')
})

it('keeps an addition without its key visible and resumes after key replacement', async () => {
  const f = fixture({ accounts: [], accountOperations: [add] }, false)
  await f.recovery.recover()
  expect(visibleAccountsOf(f.value())).toEqual([account])
  expect(f.settings.mutate).not.toHaveBeenCalled()
  f.secrets.add(account.apiKeyEnv)
  await f.recovery.recover()
  expect(f.value().accounts).toEqual([account])
  expect(f.value().accountOperations).toEqual([])
})

it('recovers a deletion after the key was removed but the metadata write failed', async () => {
  const f = fixture({ accounts: [account, backup], apiKeyEnv: account.apiKeyEnv, accountOperations: [remove] }, false)
  await f.recovery.recover()
  expect(f.value()).toEqual({ accounts: [backup], apiKeyEnv: backup.apiKeyEnv, accountOperations: [] })
  expect(f.credentials.unset).not.toHaveBeenCalled()
})

it('retries a pending deletion on reconnect while preserving the row when storage is refused', async () => {
  const f = fixture({ accounts: [account], apiKeyEnv: account.apiKeyEnv, accountOperations: [remove] })
  f.credentials.unset.mockRejectedValueOnce(new Error('private storage detail'))
  await f.recovery.recover()
  expect(f.value().accounts).toEqual([account])
  expect(f.value().accountOperations).toEqual([remove])
  expect(JSON.stringify(f.logger.warn.mock.calls)).not.toContain('private storage detail')
  f.disconnect()
  const restarted = new GoAccountRecovery(f.logger)
  restarted.connect(f.settings, f.credentials)
  await restarted.recover()
  expect(f.value().accounts).toEqual([])
  expect(f.value().accountOperations).toEqual([])
})

it('does not overwrite a selection made after an addition started', async () => {
  const f = fixture({ accounts: [backup], apiKeyEnv: backup.apiKeyEnv, accountOperations: [add] })
  await f.recovery.recover()
  expect(f.value().apiKeyEnv).toBe(backup.apiKeyEnv)
  expect(f.value().accounts).toEqual([backup, account])
})

it('leaves shared or externally named credentials intact', async () => {
  const operation: GoAccountOperation = { ...remove, account: backup }
  const f = fixture({ accounts: [backup], apiKeyEnv: backup.apiKeyEnv, accountOperations: [operation] })
  f.secrets.add(backup.apiKeyEnv)
  await f.recovery.recover()
  expect(f.credentials.unset).not.toHaveBeenCalled()
  expect(f.secrets.has(backup.apiKeyEnv)).toBe(true)
  expect(f.value().accounts).toEqual([])
})

it('bounds CAS retries and keeps the intention when settings remain read-only', async () => {
  const f = fixture({ accounts: [], accountOperations: [add] })
  f.settings.mutate.mockResolvedValue(false)
  await f.recovery.recover()
  expect(f.settings.mutate).toHaveBeenCalledTimes(4)
  expect(f.value().accountOperations).toEqual([add])
})

it('does not act on an old profile after its credential description settles', async () => {
  const f = fixture({ accounts: [account], apiKeyEnv: account.apiKeyEnv, accountOperations: [remove] })
  const late = Promise.withResolvers<{ configured: boolean; writable: boolean }>()
  f.credentials.describe.mockImplementationOnce(() => late.promise)
  const running = f.recovery.recover()
  await vi.waitFor(() => expect(f.credentials.describe).toHaveBeenCalled())
  f.disconnect()
  late.resolve({ configured: true, writable: true })
  await running
  expect(f.credentials.unset).not.toHaveBeenCalled()
  expect(f.settings.mutate).not.toHaveBeenCalled()
})

it('rejects forged ownership and duplicate intentions before recovery', () => {
  expect(() => assertAccountOperations([{ ...add, account: { ...account, apiKeyEnv: 'SHARED_KEY' } }])).toThrow()
  expect(() => assertAccountOperations([add, add])).toThrow()
})

it('lets a fresh connection recover while the old credential service never settles', async () => {
  const f = fixture({ accounts: [], accountOperations: [add] })
  const late = Promise.withResolvers<{ configured: boolean; writable: boolean }>()
  f.credentials.describe.mockImplementationOnce(() => late.promise)
  const old = f.recovery.recover()
  await vi.waitFor(() => expect(f.credentials.describe).toHaveBeenCalled())
  f.disconnect()
  f.recovery.connect(f.settings, f.credentials)
  await old
  await vi.waitFor(() => expect(f.value().accountOperations).toEqual([]))
  expect(f.value().accounts).toEqual([account])
  late.resolve({ configured: true, writable: true })
})

it('bounds an unresponsive recovery operation and keeps the intention for a later trigger', async () => {
  vi.useFakeTimers()
  const f = fixture({ accounts: [], accountOperations: [add] })
  const late = Promise.withResolvers<{ configured: boolean; writable: boolean }>()
  f.credentials.describe.mockImplementationOnce(() => late.promise)
  try {
    const pending = f.recovery.recover()
    await vi.advanceTimersByTimeAsync(ACCOUNT_RECOVERY_TIMEOUT_MS + 1)
    await pending
    expect(f.value().accountOperations).toEqual([add])
    expect(f.settings.mutate).not.toHaveBeenCalled()
    expect(f.logger.warn).toHaveBeenCalledTimes(1)
  } finally { f.disconnect(); late.resolve({ configured: true, writable: true }); vi.useRealTimers() }
})
