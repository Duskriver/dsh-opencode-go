/** Test double for the client settings-scope seam. */
import { vi } from 'vitest'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type {
  SettingsScope, SettingsScopeSnapshot,
} from '@deepseek-ai/dsh-client-ui-settings/client'

/** Handle over one stubbed scope: the scope, its write spy, and publication controls. */
export interface StubSettingsScope<T> {
  /** The scope face handed to the service under test. */
  scope: SettingsScope<T>
  /** Spy behind `scope.set`; resolves immediately. */
  set: ReturnType<typeof vi.fn>
  /** Spy behind `scope.mutate`; resolves immediately. */
  mutate: ReturnType<typeof vi.fn>
  /** Spy behind `scope.unset`; resolves immediately. */
  unset: ReturnType<typeof vi.fn>
  /** @returns how many listeners are currently subscribed (disposal assertions). */
  listenerCount(): number
  /**
   * Replace part of the snapshot and notify subscribers, as a Host
   * acceptance would.
   * @param next - snapshot fields to replace.
   */
  publish(next: Partial<SettingsScopeSnapshot<T>>): void
}

/** The write spies the scope delegates to, shared with the handle the test holds. */
interface StubWrites<T> {
  set: SettingsScope<T>['set']
  mutate: SettingsScope<T>['mutate']
  unset: SettingsScope<T>['unset']
}

/**
 * The Host's scope is a class instance whose methods read their own state, so a
 * method handed over as a value loses its receiver. Keeping this double's
 * methods on the prototype is what makes such a detached call fail here exactly
 * as it does in a browser.
 */
class StubScope<T> implements SettingsScope<T> {
  private snapshot: SettingsScopeSnapshot<T> = {
    status: 'loading', value: undefined, base: undefined, user: undefined,
    revision: undefined, writable: false, mode: 'host',
  }
  private readonly listeners = new Set<() => void>()
  /** @param writes - the spies the handle exposes, so both sides count the same calls. */
  constructor(private readonly writes: StubWrites<T>) {}
  /** @returns the current sync snapshot (stable reference until the next change). */
  getSnapshot(): SettingsScopeSnapshot<T> {
    return this.snapshot
  }
  /**
   * @param listener - invoked after each snapshot change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  /**
   * @param ops - ordered field operations copied when queued.
   * @param expectedRevision - optional fixed revision read by the domain editor.
   * @returns settlement after this scope records the write.
   */
  mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<void> {
    return this.writes.mutate(ops, expectedRevision)
  }
  /**
   * @param field - scalar field inside the namespace section.
   * @param value - JSON-shaped value selected by the user.
   * @returns settlement after this scope records the write.
   */
  set(field: string, value: unknown): Promise<void> {
    return this.writes.set(field, value)
  }
  /**
   * @param field - scalar field inside the namespace section.
   * @returns settlement after this scope records the clear.
   */
  unset(field: string): Promise<void> {
    return this.writes.unset(field)
  }
  /**
   * Replace part of the snapshot and notify subscribers, as a Host
   * acceptance would.
   * @param next - snapshot fields to replace.
   */
  publish(next: Partial<SettingsScopeSnapshot<T>>): void {
    this.snapshot = { ...this.snapshot, ...next }
    for (const listener of [...this.listeners]) listener()
  }
  /** @returns how many listeners are currently subscribed. */
  subscribers(): number {
    return this.listeners.size
  }
}

/**
 * Build an in-memory settings scope for service specs: starts in the host
 * loading state, records writes, and lets the test publish Host acceptances.
 * @returns the stub handle.
 */
export function stubSettingsScope<T>(): StubSettingsScope<T> {
  const set = vi.fn((): Promise<void | boolean> => Promise.resolve())
  const mutate = vi.fn((): Promise<void | boolean> => Promise.resolve())
  const unset = vi.fn((): Promise<void | boolean> => Promise.resolve())
  const scope = new StubScope<T>({ set, mutate, unset })
  return {
    scope,
    set,
    mutate,
    unset,
    listenerCount: () => scope.subscribers(),
    publish: (next) => { scope.publish(next) },
  }
}
