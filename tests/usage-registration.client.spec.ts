import { expect, it, vi } from 'vitest'
import { registerUsagePill } from '../src/client/usage.ts'
import type { UsagePillProps } from '../src/client/UsagePill.tsx'
import { stubSettingsScope } from './support/settings-scope.ts'
import type { OpencodeGoSettings } from '../src/client/section-controller.ts'

it('preserves the usage account source and structured failures through the client slot binding', async () => {
  let props: UsagePillProps | undefined
  const window = { status: 'ok' as const, percent: 10, resetsAt: '2026-10-01T00:00:00Z' }
  const usage = { rolling: window, weekly: window, monthly: window, source: 'account-a' }
  const error = Object.assign(new Error('Usage request failed: network error (ECONNRESET)'), {
    code: 'opencode-go/usage-unavailable',
    details: { retryable: true, retainPrevious: true, source: 'account-a' },
  })
  const read = vi.fn().mockResolvedValueOnce({ ok: true, value: usage }).mockResolvedValue({ ok: false, error })
  const ctx = {
    inject: (_services: unknown, callback: (scope: unknown) => void) => { callback(ctx) },
    effect: (install: () => unknown) => install(),
    remote: { opencodeGoUsage: { read }, $on: () => () => {} },
    modelDirectories: { directoryFor: () => ({ store: {} }) },
    locale: { bind: () => (key: string) => key, getLocale: () => ({ active: 'en' }) },
    slots: {
      inject: (_slot: unknown, callback: () => void) => { callback() },
      register: (definition: { inject: (id: string) => UsagePillProps }) => { props = definition.inject('fixture-session') },
    },
  }
  const host = stubSettingsScope<OpencodeGoSettings>()
  const settings = host.scope
  host.publish({ status: 'ready', writable: true, value: { accounts: [{ id: 'a', name: 'Work', apiKeyEnv: 'ACCOUNT_A' }] } })
  const select = vi.fn(async () => true)
  registerUsagePill(ctx as never, settings, select)
  expect(props).toBeDefined()
  expect(props!.settings).toBe(settings)
  await expect(props!.readUsage()).resolves.toEqual(usage)
  await expect(props!.readUsage()).rejects.toBe(error)
  await expect(props!.selectAccount!('ACCOUNT_A')).resolves.toBe(true)
  expect(select).toHaveBeenCalledWith('ACCOUNT_A')
  expect(host.mutate).not.toHaveBeenCalled()
  await expect(props!.selectAccount!('UNKNOWN_ACCOUNT')).resolves.toBe(false)
  expect(select).toHaveBeenCalledTimes(1)
})
