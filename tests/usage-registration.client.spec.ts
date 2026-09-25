import { expect, it, vi } from 'vitest'
import { registerUsagePill } from '../src/client/usage.ts'
import type { UsagePillProps } from '../src/client/UsagePill.tsx'

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
    get: () => ({ binding: () => ({ eventSource: { getSnapshot: () => ({ entries: [] }), subscribe: () => () => {} } }) }),
    inject: (_services: unknown, callback: (scope: unknown) => void) => { callback(ctx) },
    remote: { opencodeGoUsage: { read } },
    modelDirectories: { directoryFor: () => ({ store: {} }) },
    locale: { bind: () => (key: string) => key, getLocale: () => ({ active: 'en' }) },
    slots: {
      inject: (_slot: unknown, callback: () => void) => { callback() },
      register: (definition: { inject: (id: string) => UsagePillProps }) => { props = definition.inject('fixture-session') },
    },
  }
  registerUsagePill(ctx as never)
  expect(props).toBeDefined()
  expect(props!.sessionEvents!.getSnapshot()).toEqual({ entries: [] })
  await expect(props!.readUsage()).resolves.toEqual(usage)
  await expect(props!.readUsage()).rejects.toBe(error)
})
