import type { PageTab } from './types.ts';
/**
 * Module-level because the host unmounts the \`main\` panel when the user
 * returns to the conversation: a component-local tab would reset to Overview
 * on every re-entry, including the entry the composer pill just requested.
 */
export declare const pageTabStore: import("@deepseek-ai/dsh-client-store").SnapshotStore<"models" | "accounts" | "usage" | "overview" | "appearance" | "about">;
/** Select one tab for the next render (also used before the panel is opened). */
export declare function setPageTab(tab: PageTab): void;
/** Preserve the current tab (tests reset this between cases). */
export declare function resetPageTab(): void;
/** Read the selected tab; re-renders on change. */
export declare function usePageTab(): PageTab;
