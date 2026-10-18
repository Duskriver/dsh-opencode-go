import type { AnalyticsQuery, AnalyticsReport } from '../analytics-contract.ts';
import type { GoUsage } from '../usage-contract.ts';
import type { en } from './locales.ts';
type AnalyticsKey = keyof typeof en;
export interface AnalyticsDialogProps {
    open: boolean;
    onClose: () => void;
    readAnalytics: (query: AnalyticsQuery) => Promise<AnalyticsReport>;
    readQuota?: () => Promise<GoUsage>;
    t: (key: AnalyticsKey) => string;
    getLocale?: () => string;
}
/**
 * Shared usage dashboard, opened from the composer pill and the settings card.
 * It scans only when opened or when the range asks for it; closing the modal
 * stops the request. Every number shown here comes from the same Host report
 * as before; only the presentation and the palette are new.
 */
export declare function AnalyticsDialog({ open, onClose, readAnalytics, readQuota, t, getLocale }: AnalyticsDialogProps): import("react").JSX.Element;
export {};
