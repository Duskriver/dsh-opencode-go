/** Page-level tab state shared by the shell, the composer pill and the settings section. */
import { useSyncExternalStore } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { PageTab } from './types.ts'
import { PAGE_TABS } from './types.ts'

/**
 * Module-level because the host unmounts the \`main\` panel when the user
 * returns to the conversation: a component-local tab would reset to Overview
 * on every re-entry, including the entry the composer pill just requested.
 */
export const pageTabStore = createSnapshotStore<PageTab>('overview')

/** Select one tab for the next render (also used before the panel is opened). */
export function setPageTab(tab: PageTab): void {
  if (PAGE_TABS.includes(tab)) pageTabStore.set(tab)
}

/** Preserve the current tab (tests reset this between cases). */
export function resetPageTab(): void {
  pageTabStore.set('overview')
}

/** Read the selected tab; re-renders on change. */
export function usePageTab(): PageTab {
  return useSyncExternalStore(pageTabStore.subscribe, pageTabStore.getSnapshot, pageTabStore.getSnapshot)
}
