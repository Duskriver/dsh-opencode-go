import type { ReactNode } from 'react';
import type { PageViewProps } from './types.ts';
/**
 * Render the About tab: the build facts with their links, then the live
 * diagnostics. There is no export-log action on purpose: the client bundle has
 * no log sink, and a button that only promised one would be a dead control.
 * @param props - the snapshot, the business face and the locale.
 * @returns the two information cards.
 */
export declare function AboutPage({ state, actions, locale }: PageViewProps): ReactNode;
