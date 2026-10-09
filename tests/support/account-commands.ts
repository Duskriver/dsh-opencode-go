import { GoAccountManager } from '../../src/account-manager.ts'
import type { AccountSettings } from '../../src/accounts.ts'
import type { SettingsScope } from '../../src/client/settings.ts'
import type { ExecuteAccountCommand } from '../../src/client/accounts-controller.ts'

/** Simulate the host document separately from a browser snapshot that can lag writes. */
export function accountCommandHarness(scope: SettingsScope<AccountSettings>, credentials: {
  describe(refs: string[]): Promise<{ ok: boolean; value?: Record<string, { configured: boolean; writable: boolean }>; error?: unknown }>
  set(ref: string, key: string): Promise<{ ok: boolean; error?: unknown }>
  unset(ref: string): Promise<{ ok: boolean; error?: unknown }>
}, confirmAccount?: (id: string) => Promise<boolean | undefined>): ExecuteAccountCommand {
  let value = scope.getSnapshot().value ?? {}
  let revision = scope.getSnapshot().revision ?? 0
  scope.subscribe(() => {
    value = scope.getSnapshot().value ?? {}
    revision = scope.getSnapshot().revision ?? revision
  })
  const manager = new GoAccountManager({ warn: () => {} })
  manager.connect({
    describe: () => [{ ns: 'llm-opencode-go', revision, value }],
    mutate: async (_ns, ops, expected) => {
      const result = await scope.mutate(ops, expected)
      const addition = ops.find(op => op.path[0] === 'accounts')?.value as AccountSettings['accounts']
      const added = addition?.find(account => !value.accounts?.some(existing => existing.id === account.id))
      // Modern acknowledgments come from the host even if the browser fold is delayed.
      // A legacy server confirmation models that same authoritative document.
      if (result === true || result === undefined && added && await confirmAccount?.(added.id) === true) {
        value = { ...value, ...Object.fromEntries(ops.map(op => [op.path[0], op.value])) }
        revision = (expected ?? revision) + 1
      }
      return result
    },
  }, {
    describe: async (ref: string) => {
      const result = await credentials.describe([ref])
      if (!result.ok || !result.value?.[ref]) throw new Error('Credential state unavailable')
      return result.value[ref]
    },
    set: async (ref: string, key: string) => {
      const result = await credentials.set(ref, key)
      if (!result.ok) throw new Error('Credential write refused')
    },
    unset: async (ref: string) => {
      const result = await credentials.unset(ref)
      if (!result.ok) throw new Error('Credential deletion refused')
    },
  } as never)
  return command => manager.execute(command)
}
