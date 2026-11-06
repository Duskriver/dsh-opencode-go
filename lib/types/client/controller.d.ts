import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { type SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type ModelSource, type OpencodeGoSettings, type OpencodeGoModelLimits, type GoAccount, type GoModel, type GoModelCatalog, type GoUsage, type AccountCommand, type SettingsWriteResult } from '../contracts.ts';
export type { OpencodeGoSettings, OpencodeGoModelLimit, OpencodeGoModelLimits } from '../contracts.ts';
export declare const OPENCODE_GO_NS = "llm-opencode-go";
export declare const TEXT_FIELDS: readonly ["usageDisplay", "usagePillStyle", "showSidebarQuota", "baseURL", "freeBaseURL", "proxyURL", "refreshMinutes", "streamIdleTimeoutMs", "maxImages", "maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes"];
export type TextField = typeof TEXT_FIELDS[number];
export declare const editableKeys: readonly ["usageDisplay", "usagePillStyle", "showSidebarQuota", "baseURL", "freeBaseURL", "proxyURL", "refreshMinutes", "streamIdleTimeoutMs", "maxImages", "maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes", "modelLimits"];
export type EditableField = typeof editableKeys[number];
export interface FieldState {
    text: string;
    overridden: boolean;
    invalid: boolean;
}
export interface FormActions {
    edit(field: TextField, text: string): void;
    editModelLimits(value: OpencodeGoModelLimits): void;
    resetField(field: EditableField): void;
    save(): void;
    discard(): void;
}
interface FormShell {
    available: boolean;
    writable: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    failed: boolean;
}
/** The gateway's model listing as the page reports it. */
export type OpencodeGoModels = 
/** Not asked for yet; the page asks once it mounts. */
{
    readonly status: 'idle';
}
/** A listing request is outstanding. */
 | {
    readonly status: 'loading';
}
/**
 * The gateway answered: a count/preview for the compact summary plus every
 * discovered entry used by the capacity editor.
 */
 | {
    readonly status: 'ready';
    readonly count: number;
    readonly preview: readonly string[];
    readonly entries: readonly GoModel[];
    readonly stale?: boolean;
    readonly message?: string;
    readonly refreshing?: boolean;
    readonly sources?: GoModelCatalog['sources'];
}
/** The listing could not be read; `message` is the Host's own diagnostic. */
 | {
    readonly status: 'failed';
    readonly message?: string;
    readonly sources?: GoModelCatalog['sources'];
};
/** A failure on one source must not hide the other source's usable models. */
export declare function modelsForSource(models: OpencodeGoModels, source: ModelSource): OpencodeGoModels;
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
    /** A newly opened addition form owns a fresh ID; retries keep its existing ID. */
    resetAddition?: () => void;
    renameAccount: (ref: string, name: string) => Promise<boolean>;
    removeAccount: (ref: string) => Promise<boolean>;
    selectAccount: (ref: string) => Promise<boolean>;
    setAutoSwitch: (next: boolean) => Promise<boolean>;
    replaceAccountKey: (ref: string, key: string) => Promise<boolean>;
    /** Move one account to a new position; the first row becomes the preferred account. */
    moveAccount: (ref: string, toIndex: number) => Promise<boolean>;
}
export interface OpencodeGoSectionState extends FormShell {
    accounts: GoAccountsState;
    enabled: boolean;
    usageDisplay: FieldState;
    showSidebarQuota: FieldState;
    usagePillStyle: FieldState;
    modelVisibility: Readonly<Record<string, boolean>>;
    pickerSaving: boolean;
    pickerFailed: boolean;
    baseURL: FieldState;
    freeBaseURL: FieldState;
    proxyURL: FieldState;
    refreshMinutes: FieldState;
    streamIdleTimeoutMs: FieldState;
    maxImages: FieldState;
    maxRequestImageBytes: FieldState;
    requestImagePixelBudget: FieldState;
    requestImageMaxBytes: FieldState;
    models: OpencodeGoModels;
    modelLimits: Omit<FieldState, 'text'>;
    modelLimitDraft: OpencodeGoModelLimits;
}
export interface OpencodeGoSectionFace extends FormActions, GoAccountsActions {
    hooks: {
        opencodeGo: SnapshotStore<OpencodeGoSectionState>;
    };
    loadModels(): void;
    setEnabled(next: boolean): void;
    setModelEnabled(id: string, next: boolean): void;
}
/** One controller owns the page's typed drafts and immediate account operations. */
export declare class OpencodeGoSectionController {
    private readonly scope;
    private readonly ctx;
    private readonly readModels;
    private readonly readUsage;
    private readonly executeAccountCommand;
    private readonly drafts;
    private readonly store;
    private readonly unsubscribe;
    private saving;
    private failed;
    private pickerSaving;
    private pickerFailed;
    private models;
    private modelsRequest;
    private face;
    private accountRows;
    private accountBusy;
    private accountRefreshing;
    private accountFailure;
    private accountEpoch;
    private accountsIdentity;
    private accountsLoaded;
    private disposed;
    private addition;
    constructor(scope: ConfigForm<OpencodeGoSettings>, ctx: ClientContext, readModels?: () => Promise<RemoteResult<GoModelCatalog>>, readUsage?: (ref: string) => Promise<GoUsage>, executeAccountCommand?: ExecuteAccountCommand);
    dispose(): void;
    private publish;
    private blocked;
    private stored;
    private value;
    private field;
    private plan;
    private projection;
    private edit;
    save(): Promise<void>;
    setEnabled(next: boolean): Promise<void>;
    setModelEnabled(id: string, next: boolean): Promise<void>;
    private writePickerSetting;
    inject(): OpencodeGoSectionFace;
    loadModels(): void;
    accountState(): GoAccountsState;
    syncAccounts(): void;
    refreshCredential(ref: string): void;
    refreshAccounts(): Promise<void>;
    /** Mark every account row as unreadable with the Host's own diagnostic. */
    private markUnreadable;
    accountActions(): GoAccountsActions;
    private runAccountAction;
}
