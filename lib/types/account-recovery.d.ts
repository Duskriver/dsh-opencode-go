import { type CredentialProvider } from '@deepseek-ai/dsh-credentials';
import type { AccountSettingsWriter } from './account-selection.ts';
export declare const ACCOUNT_RECOVERY_TIMEOUT_MS = 30000;
/** Reconcile the current profile only; no secret or process-global journal is stored. */
export declare class GoAccountRecovery {
    private readonly logger;
    private connection;
    private pending;
    private again;
    constructor(logger: {
        warn(message: string): void;
    });
    connect(settings: AccountSettingsWriter, credentials: Pick<CredentialProvider, 'describe' | 'unset'>): () => void;
    trigger(): void;
    recover(): Promise<void>;
    private row;
    private run;
    private complete;
}
