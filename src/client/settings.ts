import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'

/** Common read/write contract of legacy SettingsScope and 0.1.7 ConfigForm. */
export interface SettingsScopeSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  base: unknown
  user: unknown
  revision: number | undefined
  writable: boolean
  mode: 'host' | 'memory'
}

export interface SettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<void | boolean>
  set(field: string, value: unknown): Promise<void | boolean>
  unset(field: string): Promise<void | boolean>
}
