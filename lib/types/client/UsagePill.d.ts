import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { GoUsage } from '../usage-contract.ts';
export interface UsagePillProps {
    directory: SnapshotStore<ModelDirectoryState>;
    readUsage: () => Promise<GoUsage>;
    t: (key: string) => string;
    getLocale?: () => string;
}
/** Only the selected Go provider mounts a poller, so other models send no usage traffic. */
export declare function UsagePill({ directory, ...props }: UsagePillProps): import("react").JSX.Element | null;
