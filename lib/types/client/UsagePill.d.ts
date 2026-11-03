import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import { type GoUsage, type AnalyticsQuery, type AnalyticsReport } from '../contracts.ts';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { OpencodeGoSettings } from './controller.ts';
export interface UsagePillProps {
    directory: SnapshotStore<ModelDirectoryState>;
    settings: ConfigForm<OpencodeGoSettings>;
    readUsage: () => Promise<GoUsage>;
    /** Optional so an embedded/test render can omit the dashboard. */
    readAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>;
    t: (key: string) => string;
    getLocale?: () => string;
    credentialChanges?: SnapshotStore<number>;
    selectAccount?: (ref: string) => Promise<boolean>;
}
/** Only a visible, enabled pill mounts the usage poller. */
export declare function UsagePill({ directory, settings, credentialChanges, ...props }: UsagePillProps): import("react").JSX.Element | null;
