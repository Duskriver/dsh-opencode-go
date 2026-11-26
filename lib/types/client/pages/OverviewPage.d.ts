import { type ReactNode } from 'react';
import type { PageViewProps } from './types.ts';
/**
 * Render the Overview tab.
 * @param props - the snapshot, the business face, the locale and the tab switcher.
 * @returns the KPI row, current-account / cold-start card, provider & workspace stack and interactive 7-day chart.
 */
export declare function OverviewPage({ state, actions, locale, go }: PageViewProps): ReactNode;
