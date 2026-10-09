import { type CredentialProvider } from '@deepseek-ai/dsh-credentials';
import { type AccountSettingsWriter, type SettingsWriteResult } from './settings-bridge.ts';
import { type AccountCommand } from './accounts-contract.ts';
export declare const ACCOUNT_RECOVERY_TIMEOUT_MS = 30000;
/** Serialize account commands and recover the same durable operations for one profile. */
export declare class GoAccountManager {
    private readonly logger;
    private connection;
    private pending;
    private again;
    private queue;
    constructor(logger: {
        warn(message: string): void;
    });
    connect(settings: AccountSettingsWriter, credentials: Pick<CredentialProvider, 'describe' | 'unset'> & Partial<Pick<CredentialProvider, 'set'>>): () => void;
    trigger(): void;
    recover(): Promise<void>;
    private row;
    private run;
    private complete;
    private enqueue;
    execute(raw: AccountCommand): Promise<SettingsWriteResult>;
}
