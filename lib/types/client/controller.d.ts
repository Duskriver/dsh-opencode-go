import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { type SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type ModelSource, type OpencodeGoTheme, type OpencodeGoSettings, type OpencodeGoModelLimits, type GoAccount, type GoModel, type GoModelCatalog, type GoUsage, type AccountCommand, type SettingsWriteResult } from '../contracts.ts';
export type { OpencodeGoSettings, OpencodeGoModelLimit, OpencodeGoModelLimits } from '../contracts.ts';
export declare const OPENCODE_GO_NS = "llm-opencode-go";
/**
 * Fields that apply the moment they change. Every non-advanced surface is
 * immediate, so the form has exactly one save gesture: the Advanced tab.
 */
export declare const IMMEDIATE_TEXT_FIELDS: readonly ["usageDisplay", "usagePillStyle", "appearanceTheme", "showSidebarQuota", "freeEnabled"];
export type ImmediateTextField = typeof IMMEDIATE_TEXT_FIELDS[number];
/** Fields the Advanced tab keeps behind Save/Discard. */
export declare const STAGED_TEXT_FIELDS: readonly ["baseURL", "freeBaseURL", "proxyURL", "refreshMinutes", "streamIdleTimeoutMs", "requestPreparationTimeoutMs", "requestTimeoutMs", "maxImages", "maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes"];
export type StagedTextField = typeof STAGED_TEXT_FIELDS[number];
export declare const TEXT_FIELDS: readonly ["usageDisplay", "usagePillStyle", "appearanceTheme", "showSidebarQuota", "freeEnabled", "baseURL", "freeBaseURL", "proxyURL", "refreshMinutes", "streamIdleTimeoutMs", "requestPreparationTimeoutMs", "requestTimeoutMs", "maxImages", "maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes"];
export type TextField = typeof TEXT_FIELDS[number];
/** An immediate field also covers the per-model capacity map. */
export type ImmediateField = ImmediateTextField | 'modelLimits';
export declare const editableKeys: readonly ["usageDisplay", "usagePillStyle", "appearanceTheme", "showSidebarQuota", "freeEnabled", "baseURL", "freeBaseURL", "proxyURL", "refreshMinutes", "streamIdleTimeoutMs", "requestPreparationTimeoutMs", "requestTimeoutMs", "maxImages", "maxRequestImageBytes", "requestImagePixelBudget", "requestImageMaxBytes", "modelLimits"];
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
/** Settings-document availability, as the Host ConfigForm reports it. */
export type SettingsStatus = 'loading' | 'ready' | 'unavailable';
interface FormShell {
    status: SettingsStatus;
    writable: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    failed: boolean;
}
/**
 * Numeric bounds mirrored from the Host settings schema (`src/config.ts`), so an
 * out-of-range draft is marked invalid here instead of being refused after Save
 * with no field-level explanation. `MAX_TIMER_DELAY_MS` is the Host's own constant.
 */
export interface NumericFieldLimit {
    integer: boolean;
    min: number;
    max?: number;
}
export declare const NUMERIC_FIELD_LIMITS: Partial<Record<TextField, NumericFieldLimit>>;
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
    /** Whether the opt-in sidebar row and its console page are registered. */
    sidebarEntry: boolean;
    /** The sidebar-entry switch write failed; the switch itself is elsewhere. */
    sidebarEntryFailed: boolean;
    /** The last immediate settings write that did not land, named for its surface. */
    writeFailed?: ImmediateField;
    usageDisplay: FieldState;
    showSidebarQuota: FieldState;
    freeEnabled: FieldState;
    usagePillStyle: FieldState;
    appearanceTheme: FieldState;
    /** Last saved theme; text drafts preview without switching the applied interface. */
    appliedAppearanceTheme: OpencodeGoTheme;
    modelVisibility: Readonly<Record<string, boolean>>;
    pickerSaving: boolean;
    pickerFailed: boolean;
    /** The provider `enabled` switch write failed; separate from model visibility. */
    enabledFailed: boolean;
    baseURL: FieldState;
    freeBaseURL: FieldState;
    proxyURL: FieldState;
    refreshMinutes: FieldState;
    streamIdleTimeoutMs: FieldState;
    requestPreparationTimeoutMs: FieldState;
    requestTimeoutMs: FieldState;
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
    /** Opt the sidebar row and the console page in or out; applied immediately. */
    setSidebarEntry(next: boolean): void;
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
    private enabledFailed;
    private sidebarEntryFailed;
    private writeFailed;
    private immediateSaving;
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
    /**
     * Edit one field. Immediate fields (everything outside the Advanced tab) are
     * written straight away; only staged fields keep a draft behind Save.
     * @param field - the field being edited.
     * @param text - the control's text form.
     */
    private edit;
    /** Keep a draft the Advanced tab saves on its own gesture. */
    private editStaged;
    /**
     * Write one immediate value straight through the Host form. A refused or
     * failed write names its field so the surface that owns it can say so; only a
     * later write of that same field clears the notice. A staged-save failure
     * belongs to the Advanced draft and is never cleared from here.
     * @param field - immediate field being written.
     * @param write - the value, or the clear that restores the base layer.
     */
    private writeImmediate;
    /**
     * Change one per-model capacity override, applied as soon as the editor
     * settles a value.
     * @param value - the complete override map.
     */
    editModelLimits(value: OpencodeGoModelLimits): void;
    /**
     * Restore one field to its inherited value. Outside the Advanced tab the
     * clear is written immediately; Advanced keeps it as a draft for Save.
     * @param field - the field to clear.
     */
    private resetField;
    save(): Promise<void>;
    setEnabled(next: boolean): Promise<void>;
    setSidebarEntry(next: boolean): Promise<void>;
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
