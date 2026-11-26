import { type ReactNode } from 'react';
import type { PageViewProps } from './types.ts';
/** Build a safe, credential-free Markdown diagnostics block for issue reports. */
export declare function buildDiagnosticsMarkdown(state: PageViewProps['state'], historyAvailable: boolean): string;
/**
 * Render the About tab: the build facts with their links, then the live
 * diagnostics with a credential-free Markdown summary copy action.
 * @param props - the snapshot, the business face and the locale.
 * @returns the two information cards.
 */
export declare function AboutPage({ state, actions, locale }: PageViewProps): ReactNode;
