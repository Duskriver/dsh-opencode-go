import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { GoAccountSwitch } from './accounts.ts'

export interface UsageWindow {
  status: 'ok' | 'rate-limited'
  percent: number
  resetsAt: string
}

export interface GoUsage {
  /** Opaque Host identity for this endpoint/account; never a credential or its hash. */
  source?: string
  lastSwitch?: GoAccountSwitch
  rolling: UsageWindow
  weekly: UsageWindow
  monthly: UsageWindow
}

export function parseAccountSwitch(value: unknown): GoAccountSwitch {
  const notice = value as Partial<GoAccountSwitch> | null
  if (!notice || typeof notice.fromRef !== 'string' || typeof notice.toRef !== 'string'
    || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(notice.fromRef) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(notice.toRef)
    || (notice.reason !== 'quota' && notice.reason !== 'credential')
    || typeof notice.at !== 'number' || !Number.isSafeInteger(notice.at) || notice.at < 0
    || notice.at > 8_640_000_000_000_000) throw new Error('Invalid account switch notice')
  return { fromRef: notice.fromRef, toRef: notice.toRef, reason: notice.reason, at: notice.at }
}

/** Reject missing statistics rather than turning unavailable data into zero. */
export function parseGoUsage(value: unknown): GoUsage {
  if (!value || typeof value !== 'object') throw new Error('Invalid OpenCode Go usage response')
  const source = value as Record<string, unknown>
  const result = {} as GoUsage
  if (source.source !== undefined) {
    if (typeof source.source !== 'string' || source.source.length === 0 || source.source.length > 128) {
      throw new Error('Invalid OpenCode Go usage source')
    }
    result.source = source.source
  }
  if (source.lastSwitch !== undefined) {
    result.lastSwitch = parseAccountSwitch(source.lastSwitch)
  }
  for (const key of ['rolling', 'weekly', 'monthly'] as const) {
    const row = source[key] as Partial<UsageWindow> | undefined
    if (!row || (row.status !== 'ok' && row.status !== 'rate-limited')
      || typeof row.percent !== 'number' || !Number.isFinite(row.percent) || row.percent < 0
      || typeof row.resetsAt !== 'string' || !Number.isFinite(Date.parse(row.resetsAt))) {
      throw new Error('Invalid OpenCode Go usage response')
    }
    result[key] = { status: row.status, percent: row.percent, resetsAt: row.resetsAt }
  }
  return result
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'opencode-go/usage-unavailable': {
      readonly retryable: boolean
      readonly retainPrevious: boolean
      readonly source?: string
      readonly lastSwitch?: GoAccountSwitch
    }
  }
  interface TypertRemoteNamespaceMap {
    opencodeGoUsage: {
      read(): Promise<RemoteResult<GoUsage>>
      readAccount(ref: string): Promise<RemoteResult<GoUsage>>
    }
  }
}

// Released DSH uses schema; current source builds use a lazy create() codec.
const usageCodec = {
  mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#GoUsage',
  schema: { parse: parseGoUsage }, create: () => ({ parse: parseGoUsage }),
}
const parseRef = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Invalid account reference')
  return value
}
const refCodec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#AccountRef',
  schema: { parse: parseRef }, create: () => ({ parse: parseRef }) }

export const usageRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [{
    id: 'dsh-opencode-go#opencodeGoUsage/read',
    service: 'opencodeGoUsage', namespace: 'opencodeGoUsage', method: 'read',
    invocation: { kind: 'direct' }, parameters: [],
    result: usageCodec,
  }, {
    id: 'dsh-opencode-go#opencodeGoUsage/readAccount',
    service: 'opencodeGoUsage', namespace: 'opencodeGoUsage', method: 'readAccount',
    invocation: { kind: 'direct' }, parameters: [{ name: 'ref', wire: 'ref', source: 'json', codec: refCodec }],
    result: usageCodec,
  }],
}
