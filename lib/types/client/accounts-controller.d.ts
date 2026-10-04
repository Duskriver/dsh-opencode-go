import type { Context } from '@deepseek-ai/cordis';
import { type AccountSettings, type GoAccount } from '../accounts.ts';
import type { GoUsage } from '../usage-contract.ts';
import type { SettingsScope } from './settings.ts';
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
    failure?: 'write' | 'cleanup' | 'read';
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
    private rows;
    private busy;
    private refreshing;
    private failure;
    private epoch;
    private identity;
    private loaded;
    private disposed;
    constructor(scope: SettingsScope<AccountSettings & {
        baseURL?: string;
    }>, ctx: Context, readUsage: (ref: string) => Promise<GoUsage>, publish: () => void, blocked: () => boolean);
    snapshot(): GoAccountsState;
    sync(): void;
    dispose(): void;
    invalidate(ref: string): void;
    refresh(): Promise<void>;
    actions(): GoAccountsActions;
    /**
     * Reorder the visible accounts and keep the preferred reference on the first row.
     * The adapter tries the preferred reference first and the rest in array order, so
     * one write is what makes top-to-bottom the real call order. A placeholder row the
     * settings never stored is materialized here, which its `legacy:` id admits.
     */
    private move;
    private account;
    private mutate;
    private add;
    private rename;
    private select;
    private remove;
    private run;
}
