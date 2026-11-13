import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { HostObservable, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { OpencodeGoSettings } from '../../src/contracts.ts'
import type { OpencodeGoSectionController } from '../../src/client/controller.ts'
import { en, zh } from '../../src/client/presentation.ts'
export { RemoteError } from '@deepseek-ai/dsh-typert-protocol'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const rect = target.getBoundingClientRect()
      const size = [{ inlineSize: rect.width, blockSize: rect.height }]
      this.callback([{ target, contentRect: rect, borderBoxSize: size, contentBoxSize: size, devicePixelContentBoxSize: size }], this as unknown as ResizeObserver)
    }
    unobserve() {}
    disconnect() {}
  })
})
afterEach(() => { cleanup(); localStorage.clear() })

export function bindSnapshotSelector<T>(source: HostObservable<T>): SnapshotSelectorHook<T> {
  return function useSnapshotSelector<R>(selector: (snapshot: T) => R): R {
    return selector(useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot))
  }
}

/**
 * Client fixture baseline: Free access is opt-in, so fixtures start with it
 * disabled. Most fixtures exercise the console page and the sidebar surfaces,
 * which only exist while the opt-in sidebar entry is on; a test that reads the
 * off posture spreads `sidebarEntry: false` over this baseline.
 */
export const defaultClientSettings: OpencodeGoSettings = { freeEnabled: false, sidebarEntry: true }

/** The current ConfigForm contract: writes acknowledge acceptance with a boolean. */
class TestForm<T> implements ConfigForm<T> {
  private snapshot: ConfigFormSnapshot<T> = {
    status: 'loading', value: undefined, base: undefined, user: undefined,
    revision: 0, writable: false,
  }
  private readonly listeners = new Set<() => void>()
  constructor(private readonly writes: Pick<ConfigForm<T>, 'set' | 'mutate' | 'unset'>) {}
  getSnapshot(): ConfigFormSnapshot<T> { return this.snapshot }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  mutate(ops: readonly SettingsPathOpView[], revision?: number): Promise<boolean> { return this.writes.mutate(ops, revision) }
  set(field: string, value: unknown): Promise<boolean> { return this.writes.set(field, value) }
  unset(field: string): Promise<boolean> { return this.writes.unset(field) }
  publish(next: Partial<ConfigFormSnapshot<T>>) { this.snapshot = { ...this.snapshot, ...next }; for (const listener of this.listeners) listener() }
  subscribers() { return this.listeners.size }
}

export function createConfigForm<T = OpencodeGoSettings>(value?: T) {
  const set = vi.fn<ConfigForm<T>['set']>(), mutate = vi.fn<ConfigForm<T>['mutate']>(), unset = vi.fn<ConfigForm<T>['unset']>()
  const form = new TestForm<T>({ set, mutate, unset })
  if (value !== undefined) form.publish({ status: 'ready', writable: true, value, base: structuredClone(value), user: {} })
  const host = { form, set, mutate, unset, publish: (next: Partial<ConfigFormSnapshot<T>>) => form.publish(next), listenerCount: () => form.subscribers() }
  acceptFormWrites(host)
  return host
}

export function acceptFormWrites<T>(host: ReturnType<typeof createConfigForm<T>>): void {
  const apply = (ops: readonly SettingsPathOpView[], revision?: number): boolean => {
    const snapshot = host.form.getSnapshot()
    if (!snapshot.writable || revision !== undefined && revision !== snapshot.revision) return false
    const value = { ...snapshot.value } as Record<string, unknown>
    const user = { ...snapshot.user as object } as Record<string, unknown>
    for (const op of ops) {
      const field = op.path[0]!
      if (op.path.length !== 1) throw new Error('This form fixture supports top-level field batches')
      if (op.op === 'set') { value[field] = structuredClone(op.value); user[field] = structuredClone(op.value) }
      else { delete user[field]; value[field] = (snapshot.base as Record<string, unknown> | undefined)?.[field] }
    }
    host.publish({ value: value as T, user, revision: (snapshot.revision ?? 0) + 1 })
    return true
  }
  host.mutate.mockImplementation(async (ops, revision) => apply(ops, revision))
  host.set.mockImplementation(async (field, value) => apply([{ op: 'set', path: [field], value: value as never }]))
  host.unset.mockImplementation(async field => apply([{ op: 'unset', path: [field] }]))
}

export function translator(locale: 'en' | 'zh' = 'en') {
  return (key: keyof typeof en, params?: Record<string, unknown>): string => {
    const copy = (locale === 'zh' ? zh : en)[key]
    return copy.replace(/\{(\w+)\}/g, (match, name) => String(params?.[name] ?? match))
  }
}

export function sectionProps(controller: OpencodeGoSectionController, locale: 'en' | 'zh' = 'en') {
  const { hooks, ...actions } = controller.inject()
  return { ...actions, useOpencodeGo: bindSnapshotSelector(hooks.opencodeGo), t: translator(locale), getLocale: () => locale }
}
