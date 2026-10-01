import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { GoUsage } from '../usage-contract.ts';
import type { SettingsScope } from './settings.ts';
import type { OpencodeGoSettings } from './section-controller.ts';
export interface UsagePillProps {
    directory: SnapshotStore<ModelDirectoryState>;
    settings: SettingsScope<OpencodeGoSettings>;
    readUsage: () => Promise<GoUsage>;
    t: (key: string) => string;
    getLocale?: () => string;
}
/** Only a visible, enabled pill mounts the usage poller. */
export declare function UsagePill({ directory, settings, ...props }: UsagePillProps): import("react").JSX.Element | null;
