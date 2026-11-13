import { type AnalyticsExport, type AnalyticsQuery, type AnalyticsReport, type GoAccount, type GoUsage, type OpencodeGoTheme } from '../contracts.ts';
import { type en } from './presentation.ts';
/** The locale translate seat; every visible string in this dialog comes from it. */
type AnalyticsTranslate = (key: keyof typeof en) => string;
export declare function historyNumber(value: string, locale?: string, compact?: boolean): string;
/** Keep micro-cents exact through rounding: one dollar is 100,000,000 units. */
export declare function historyMoney(value: string, locale?: string): string;
/** Data and copy the dashboard reads on every surface it is mounted on. */
interface AnalyticsDashboardDataProps {
    readAnalytics: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>;
    exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>;
    readQuota?: (ref: string) => Promise<GoUsage>;
    accounts: readonly GoAccount[];
    activeRef: string;
    t: AnalyticsTranslate;
    getLocale?: () => string;
    /** Defaults to Native for embedded callers and older tests. */
    theme?: OpencodeGoTheme;
}
/**
 * Props of the reusable dashboard. `variant` picks the surface chrome: the
 * dialog keeps its brand row with the close control, while the sidebar page
 * already has its own title, padding and scroll container.
 */
export interface AnalyticsDashboardProps extends AnalyticsDashboardDataProps {
    variant?: 'dialog' | 'page';
    /** Only the dialog surface owns a close action; the page is left via the host. */
    onClose?: () => void;
}
export interface AnalyticsDialogProps extends AnalyticsDashboardDataProps {
    open: boolean;
    onClose: () => void;
    contextKey?: string | number;
}
/** Modal shell kept for every entry point that still opens history as a dialog. */
export declare function AnalyticsDialog(props: AnalyticsDialogProps): import("react").JSX.Element;
/**
 * The official workspace history dashboard. State, data reads, CSV export and
 * keyboard handling are shared by both surfaces; only the outer box and the
 * dialog-only chrome come from `variant`.
 */
export declare function AnalyticsDashboard(props: AnalyticsDashboardProps): import("react").JSX.Element;
export {};
