import { type ReactNode } from 'react';
import type { PageViewProps } from './types.ts';
/**
 * Render the Overview tab.
 * @param props - the snapshot, the business face, the locale and the tab switcher.
 * @returns the KPI row, the current-account card, the status stack and shortcuts.
 */
export declare function OverviewPage({ state, actions, locale, go }: PageViewProps): ReactNode;
