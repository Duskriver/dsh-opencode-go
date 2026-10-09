import type { Context } from '@deepseek-ai/cordis';
import { type AccountSettings, type GoAccount } from '../accounts.ts';
import type { GoUsage } from '../usage-contract.ts';
import type { SettingsScope } from './settings.ts';
import type { AccountCommand } from '../accounts-contract.ts';
import type { SettingsWriteResult } from '../settings-bridge.ts';
export type ExecuteAccountCommand = (command: AccountCommand) => Promise<SettingsWriteResult>;
export interface GoAccountView extends GoAccount {
    configured?: boolean;
    writable?: boolean;
    usage?: GoUsage;
    updatedAt?: number;
    stale?: boolean;
    loading?: boolean;
    failed?: boolean;
    /** Why the last quota read failed, safe to show: it carries no credential value. */
    problem?: string;
}
export interface GoAccountsState {
    entries: readonly GoAccountView[];
    activeRef: string;
    autoSwitch: boolean;
    busy: boolean;
    blocked: boolean;
    refreshing: boolean;
    failure?: 'write' | 'cleanup' | 'remove' | 'read';
}
export interface GoAccountsActions {
    loadAccounts: () => void;
    addAccount: (name: string, key: string) => Promise<boolean>;
    renameAccount: (ref: string, name: string) => Promise<boolean>;
    removeAccount: (ref: string) => Promise<boolean>;
    selectAccount: (ref: string) => Promise<boolean>;
    setAutoSwitch: (next: boolean) => Promise<boolean>;
    replaceAccountKey: (ref: string, key: string) => Promise<boolean>;
    /** Move one account to a new position; the first row becomes the preferred account. */
    moveAccount: (ref: string, toIndex: number) => Promise<boolean>;
}
/** Immediate account operations, separate from the page's staged tuning form. */
export declare class GoAccountsController {
    private readonly scope;
    private readonly ctx;
    private readonly readUsage;
    private readonly publish;
    private readonly blocked;
    private readonly execute;
    private rows;
    private busy;
    private refreshing;
    private failure;
    private epoch;
    private identity;
    private loaded;
    private disposed;
    private addition;
    constructor(scope: SettingsScope<AccountSettings & {
        baseURL?: string;
        proxyURL?: string;
    }>, ctx: Context, readUsage: (ref: string) => Promise<GoUsage>, publish: () => void, blocked: () => boolean, execute?: ExecuteAccountCommand);
    snapshot(): GoAccountsState;
    sync(): void;
    dispose(): void;
    invalidate(ref: string): void;
    refresh(): Promise<void>;
    /** Mark every account row as unreadable with the Host's own diagnostic. */
    private markUnreadable;
    actions(): GoAccountsActions;
    private run;
}
