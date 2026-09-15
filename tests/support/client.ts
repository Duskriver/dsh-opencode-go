/** Local React test bindings; production rendering remains supplied by DSH. */
import { useSyncExternalStore } from 'react'
import type { HostObservable, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
export { stubSettingsScope } from './settings-scope.ts'
export { RemoteError } from '@deepseek-ai/dsh-typert-protocol'

export function bindSnapshotSelector<T>(source: HostObservable<T>): SnapshotSelectorHook<T> {
  return function useSnapshotSelector<R>(selector: (snapshot: T) => R): R {
    return selector(useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot))
  }
}
