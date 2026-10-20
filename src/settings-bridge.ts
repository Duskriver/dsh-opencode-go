import { PROFILE_ENTRY_ID, SETTINGS_NAMESPACE } from './config-contract.ts'

export interface AccountSettingsWriter {
  describe(): readonly { ns: string; revision: number; value: unknown }[]
  mutate(ns: string, ops: readonly { op: 'set'; path: string[]; value: unknown }[], expectedRevision?: number): Promise<unknown>
}

/** Prefer the live profile entry when a legacy section also exists. */
export function accountSettingsRow(settings: AccountSettingsWriter) {
  const rows = settings.describe()
  return rows.find(row => row.ns === PROFILE_ENTRY_ID) ?? rows.find(row => row.ns === SETTINGS_NAMESPACE)
}

export type SettingsWriteResult = 'applied' | 'rejected' | 'unknown'

/** Legacy writes need observation; callers may require it for acknowledgments too. */
export function settingsWriteResult(verdict: unknown, committed: () => boolean, confirmation: 'acknowledged' | 'observed' = 'acknowledged'): SettingsWriteResult {
  if (verdict === true && confirmation === 'acknowledged') return 'applied'
  if (verdict === false) return 'rejected'
  return committed() ? 'applied' : 'unknown'
}

export function isSettingsConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown }
  return /conflict/i.test(`${String(name ?? '')} ${String(code ?? '')} ${String(message ?? '')}`)
}
