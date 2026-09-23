import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'

export interface UsageWindow {
  status: 'ok' | 'rate-limited'
  percent: number
  resetsAt: string
}

export interface GoUsage {
  /** Opaque Host identity for this endpoint/account; never a credential or its hash. */
  source?: string
  rolling: UsageWindow
  weekly: UsageWindow
  monthly: UsageWindow
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
    }
  }
  interface TypertRemoteNamespaceMap {
    opencodeGoUsage: { read(): Promise<RemoteResult<GoUsage>> }
  }
}

// Released DSH uses schema; current source builds use a lazy create() codec.
const usageCodec = {
  mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#GoUsage',
  schema: { parse: parseGoUsage }, create: () => ({ parse: parseGoUsage }),
}

export const usageRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [{
    id: 'dsh-opencode-go#opencodeGoUsage/read',
    service: 'opencodeGoUsage', namespace: 'opencodeGoUsage', method: 'read',
    invocation: { kind: 'direct' }, parameters: [],
    result: usageCodec,
  }],
}
