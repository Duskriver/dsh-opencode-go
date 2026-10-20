import { expect, it, vi } from 'vitest'
import { GoAccountSelection } from '../src/account-selection.ts'
import type { GoAccountSettlement } from '../src/adapter.ts'
import { configOf } from './config-of.ts'

const accounts = [
  { id: 'a', name: 'Primary', apiKeyEnv: 'ACCOUNT_A' },
  { id: 'b', name: 'Backup', apiKeyEnv: 'ACCOUNT_B' },
  { id: 'c', name: 'Third', apiKeyEnv: 'ACCOUNT_C' },
]
const notice = { fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: 'quota' as const, at: 123 }

function fixture(verdict: unknown, advance = 1, nextNamespace = 'opencode-go') {
  let config = configOf('http://127.0.0.1:1234', { accounts, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true })
  let revision = 7, namespace = 'opencode-go'
  const settings = {
    describe: () => [{ ns: namespace, revision, value: config }],
    mutate: vi.fn(async (_ns: string, ops: readonly { op: 'set'; path: string[]; value: unknown }[], expected?: number): Promise<unknown> => {
      if (expected !== revision) return false
      config = { ...config, ...Object.fromEntries(ops.map(op => [op.path[0], op.value])) }
      revision += advance
      namespace = nextNamespace
      return verdict
    }),
  }
  const logger = { debug: vi.fn(), warn: vi.fn() }
  const selection = new GoAccountSelection(() => config, logger)
  const disconnect = selection.connect(settings)
  const event = (): GoAccountSettlement => ({
    seq: 1, generation: selection.capture(), config: structuredClone(config), ref: 'ACCOUNT_B', notice,
  })
  return { settings, selection, disconnect, logger, event, config: () => config }
}

it.each([
  { label: 'modern acknowledgment', verdict: true, advance: 1, namespace: 'opencode-go', confirmed: true },
  { label: 'legacy committed write', verdict: undefined, advance: 1, namespace: 'opencode-go', confirmed: true },
  { label: 'explicit refusal', verdict: false, advance: 1, namespace: 'opencode-go', confirmed: false },
  { label: 'missing revision change', verdict: true, advance: 0, namespace: 'opencode-go', confirmed: false },
  { label: 'modern intervening write', verdict: true, advance: 2, namespace: 'opencode-go', confirmed: false },
  { label: 'legacy intervening write', verdict: undefined, advance: 2, namespace: 'opencode-go', confirmed: false },
  { label: 'different settings namespace', verdict: true, advance: 1, namespace: 'llm-opencode-go', confirmed: false },
])('restores an automatic-switch notice only for its exact committed revision: $label', async ({ verdict, advance, namespace, confirmed }) => {
  const f = fixture(verdict, advance, namespace)
  f.selection.settle(f.event())
  await vi.waitFor(() => expect(f.settings.mutate).toHaveBeenCalledTimes(1))
  await Promise.all(f.settings.mutate.mock.results.map(result => result.value))

  expect(f.settings.mutate).toHaveBeenCalledWith('opencode-go', [
    { op: 'set', path: ['accounts'], value: [accounts[1], accounts[0], accounts[2]] },
    { op: 'set', path: ['apiKeyEnv'], value: 'ACCOUNT_B' },
  ], 7)
  expect(f.config().apiKeyEnv).toBe('ACCOUNT_B')
  expect(f.selection.lastSwitch()).toEqual(confirmed ? notice : undefined)
})

it('does not retry an automatic adoption after a revision conflict', async () => {
  const f = fixture(true)
  f.settings.mutate.mockRejectedValueOnce(Object.assign(new Error('Settings revision changed'), { name: 'SettingsConflictError' }))
  f.selection.settle(f.event())
  await vi.waitFor(() => expect(f.logger.warn).toHaveBeenCalledTimes(1))

  expect(f.settings.mutate).toHaveBeenCalledTimes(1)
  expect(f.config().apiKeyEnv).toBe('ACCOUNT_A')
  expect(f.selection.lastSwitch()).toEqual(notice)
})

it.each(['reconnect', 'credential update', 'newer request'] as const)('does not restore a pending adoption notice after %s', async change => {
  const f = fixture(true)
  const release = Promise.withResolvers<void>(), started = Promise.withResolvers<void>()
  const commit = f.settings.mutate.getMockImplementation()!
  f.settings.mutate.mockImplementationOnce(async (...args) => {
    const verdict = await commit(...args)
    started.resolve()
    await release.promise
    return verdict
  })
  f.selection.settle(f.event())
  await started.promise
  try {
    if (change === 'reconnect') {
      f.disconnect()
      f.selection.connect(f.settings)
    } else if (change === 'credential update') f.selection.credentialChanged()
    else f.selection.settle({ ...f.event(), seq: 2, notice: undefined })
  } finally { release.resolve() }
  await Promise.all(f.settings.mutate.mock.results.map(result => result.value))

  expect(f.settings.mutate).toHaveBeenCalledTimes(1)
  expect(f.selection.lastSwitch()).toBeUndefined()
})
