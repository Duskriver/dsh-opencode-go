import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import { type GoModelCatalog, type GoUsage, type UsageWindow, type UsagePillStyle, type AnalyticsQuery, type AnalyticsReport, type AnalyticsExport } from '../contracts.ts';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { OpencodeGoSettings } from './controller.ts';
import type { SharedModelCatalog } from './model-catalog-store.ts';
export interface UsagePillProps {
    directory: SnapshotStore<ModelDirectoryState>;
    settings: ConfigForm<OpencodeGoSettings>;
    readUsage: (force?: boolean) => Promise<GoUsage>;
    readAccountUsage?: (ref: string, force?: boolean) => Promise<GoUsage>;
    readModels?: () => Promise<GoModelCatalog>;
    /** Shared client-side model catalog cache; falls back to `readModels` when omitted. */
    catalog?: SharedModelCatalog;
    /** Optional so an embedded/test render can omit the dashboard. */
    readAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>;
    exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>;
    t: (key: string, params?: Record<string, unknown>) => string;
    getLocale?: () => string;
    credentialChanges?: SnapshotStore<number>;
    selectAccount?: (ref: string) => Promise<boolean>;
    /**
     * Open the console page instead of the in-place dialog. Set by the client
     * registration once the host declares a sidebar panel; omitted hosts (and
     * tests) keep the self-contained dialog. Returns whether navigation happened,
     * so a page withdrawn since the face was built still opens the dialog.
     */
    openUsagePage?: () => boolean;
}
/** A root sidebar entry receives its width mode from the host slot owner. */
export type SidebarQuotaProps = Omit<UsagePillProps, 'directory'> & {
    wide: boolean;
};
/** Render a live, non-interactive quota trigger sample for Settings and Console appearance cards. */
export declare function UsageTriggerPreview({ style, border, rollingShort, weekShort, monthShort, rolling, weekly, monthly, accountName, className, }: {
    style: UsagePillStyle;
    border: boolean;
    rollingShort: string;
    weekShort: string;
    monthShort?: string;
    rolling?: UsageWindow;
    weekly?: UsageWindow;
    monthly?: UsageWindow;
    accountName?: string;
    className?: string;
}): import("react").JSX.Element;
/** Only a visible, enabled input indicator mounts the usage poller. */
export declare function UsagePill({ directory, ...props }: UsagePillProps): import("react").JSX.Element;
export declare function SidebarQuota({ wide, ...props }: SidebarQuotaProps): import("react").JSX.Element;
