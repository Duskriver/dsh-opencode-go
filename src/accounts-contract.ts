import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { ACCOUNT_REF_PATTERN } from './accounts.ts'
import type { SettingsWriteResult } from './settings-bridge.ts'

export type AccountCommand =
  | { kind: 'add'; id: string; name: string; key: string }
  | { kind: 'remove'; ref: string }
  | { kind: 'select'; ref: string }
  | { kind: 'rename'; ref: string; name: string }
  | { kind: 'replace-key'; ref: string; key: string }
  | { kind: 'move'; ref: string; toIndex: number }
  | { kind: 'auto-switch'; value: boolean }

export function parseAccountCommand(value: unknown): AccountCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid account command')
  const row = value as Record<string, unknown>
  const fields: Record<string, string[]> = {
    add: ['kind', 'id', 'name', 'key'], remove: ['kind', 'ref'], select: ['kind', 'ref'],
    rename: ['kind', 'ref', 'name'], 'replace-key': ['kind', 'ref', 'key'],
    move: ['kind', 'ref', 'toIndex'], 'auto-switch': ['kind', 'value'],
  }
  if (typeof row.kind !== 'string' || !Object.hasOwn(fields, row.kind)
    || Object.keys(row).some(key => !fields[row.kind as string]!.includes(key))
    || fields[row.kind]!.some(key => !Object.hasOwn(row, key))) throw new Error('Invalid account command')
  if ('ref' in row && (typeof row.ref !== 'string' || !ACCOUNT_REF_PATTERN.test(row.ref))) throw new Error('Invalid account reference')
  if ('name' in row && (typeof row.name !== 'string' || !row.name.trim() || row.name.trim().length > 80)) throw new Error('Invalid account name')
  if ('key' in row && (typeof row.key !== 'string' || !row.key.trim())) throw new Error('Missing account credential')
  if (row.kind === 'add' && (typeof row.id !== 'string' || !/^[a-f0-9]{32}$/.test(row.id))) throw new Error('Invalid account operation ID')
  if (row.kind === 'move' && (!Number.isInteger(row.toIndex) || (row.toIndex as number) < 0)) throw new Error('Invalid account position')
  if (row.kind === 'auto-switch' && typeof row.value !== 'boolean') throw new Error('Invalid account switch')
  return { ...row } as AccountCommand
}

function parseResult(value: unknown): SettingsWriteResult {
  if (value !== 'applied' && value !== 'rejected' && value !== 'unknown') throw new Error('Invalid account command result')
  return value
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    opencodeGoAccounts: { execute(command: AccountCommand): Promise<RemoteResult<SettingsWriteResult>> }
  }
}
const commandCodec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#AccountCommand',
  schema: { parse: parseAccountCommand }, create: () => ({ parse: parseAccountCommand }) }
const resultCodec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#AccountCommandResult',
  schema: { parse: parseResult }, create: () => ({ parse: parseResult }) }
export const accountsRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go', descriptors: [{ id: 'dsh-opencode-go#opencodeGoAccounts/execute',
    service: 'opencodeGoAccounts', namespace: 'opencodeGoAccounts', method: 'execute', invocation: { kind: 'direct' },
    parameters: [{ name: 'command', wire: 'command', source: 'json', codec: commandCodec }], result: resultCodec }],
}
