import type { AnalyticsQuery, AnalyticsReport } from '../analytics-contract.ts';
import type { GoUsage } from '../usage-contract.ts';
import type { en } from './locales.ts';
type AnalyticsKey = keyof typeof en;
export interface AnalyticsDialogProps {
    open: boolean;
    onClose: () => void;
    /** The signal reaches the Host's cancellation parameter (review M4). */
    readAnalytics: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>;
    readQuota?: () => Promise<GoUsage>;
    t: (key: AnalyticsKey) => string;
    getLocale?: () => string;
}
/**
 * Shared usage dashboard, opened from the composer pill and the settings card.
 * It scans only when opened or when the range asks for it; closing the modal
 * aborts the request. The window end is frozen once per open, so repeated
 * requests inside one open share the Host's dedup key (review P5/S5), a range
 * already seen in this open renders instantly and revalidates in the
 * background (review P17), and while a scan runs the previous results stay
 * visible under the newly selected range with an explicit annotation
 * (review P19). Every number shown here comes from the same Host report as
 * before; only the presentation and the palette are new.
 */
export declare function AnalyticsDialog({ open, onClose, readAnalytics, readQuota, t, getLocale }: AnalyticsDialogProps): import("react").JSX.Element;
export {};
