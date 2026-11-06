import type { AnalyticsExport, AnalyticsQuery, AnalyticsReport, GoAccount, GoUsage } from '../contracts.ts';
import { type en } from './presentation.ts';
export declare function historyNumber(value: string, locale?: string, compact?: boolean): string;
/** Keep micro-cents exact through rounding: one dollar is 100,000,000 units. */
export declare function historyMoney(value: string, locale?: string): string;
export interface AnalyticsDialogProps {
    open: boolean;
    onClose: () => void;
    readAnalytics: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>;
    exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>;
    readQuota?: (ref: string) => Promise<GoUsage>;
    accounts: readonly GoAccount[];
    activeRef: string;
    contextKey?: string | number;
    t: (key: keyof typeof en) => string;
    getLocale?: () => string;
}
export declare function AnalyticsDialog(props: AnalyticsDialogProps): import("react").JSX.Element;
