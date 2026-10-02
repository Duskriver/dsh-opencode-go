/**
 * The OpenCode Go settings page's staged form over the `llm-opencode-go`
 * settings namespace, plus the gateway model listing the page reports.
 *
 * The key is the one control that does not live in the section: its literal
 * never rides a response, so the page learns only whether one is configured
 * and writes it through the credentials domain, addressed by the reference the
 * section names. It is still staged with the rest of the form, so one save
 * covers everything the page shows.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { GoModel, GoModelCatalog } from '../models-contract.ts';
import { type UsageDisplayMode } from '../usage-display.ts';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { SettingsScope } from './settings.ts';
import type { GoAccount } from '../accounts.ts';
import { type GoAccountsState, type GoAccountsActions } from './accounts-controller.ts';
import { type FieldState, type FormActions, type FormShell } from './staged-form.ts';
/** Namespace of the OpenCode Go adapter. Spelled here rather than imported: a client package must not depend on a Host package. */
export declare const OPENCODE_GO_NS = "llm-opencode-go";
/** The adapter fields this page edits. */
export interface OpencodeGoSettings {
    /** Whether the adapter serves its route; false withdraws it from every picker. */
    enabled?: boolean;
    /** Usage pill visibility, independent of the selected model in always mode. */
    usageDisplay?: UsageDisplayMode;
    /** Per-model switches; normal models default on, deprecated models default off. */
    modelVisibility?: Record<string, boolean>;
    /** Credential reference naming the environment key. */
    apiKeyEnv?: string;
    accounts?: GoAccount[] | null;
    autoSwitch?: boolean;
    /** The gateway endpoint; also the live listing base. */
    baseURL?: string;
    /** Live catalog re-resolution interval, in minutes. */
    refreshMinutes?: number;
    /** Largest idle gap between stream events, in milliseconds. */
    streamIdleTimeoutMs?: number;
    /** Optional retained image occurrence cap per request. */
    maxImages?: number | null;
    /** Accumulated base64 image payload bound for one request. */
    maxRequestImageBytes?: number;
    /** Total-pixel budget for one request image. */
    requestImagePixelBudget?: number;
    /** Raw encoded-byte target for one request image. */
    requestImageMaxBytes?: number;
    /** Per-model capacity overrides, keyed by the gateway model id. */
    modelLimits?: OpencodeGoModelLimits;
}
/** The two capacity values the settings table can override. */
export interface OpencodeGoModelLimit {
    contextWindow?: number | null;
    maxTokens?: number | null;
}
export type OpencodeGoModelLimits = Record<string, OpencodeGoModelLimit | null>;
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
/** What the settings page renders. */
export interface OpencodeGoSectionState extends FormShell {
    accounts?: GoAccountsState;
    /**
     * Whether the adapter currently serves its route. Resolved from the section
     * rather than staged: the switch writes on the click that flips it, because
     * a withdrawn route is what the user is trying to observe.
     */
    enabled: boolean;
    usageDisplay: FieldState;
    modelVisibility: Readonly<Record<string, boolean>>;
    pickerSaving: boolean;
    pickerFailed: boolean;
    /** Credential reference naming the environment key. */
    apiKeyEnv: FieldState;
    /** The gateway endpoint. */
    baseURL: FieldState;
    /** Live catalog re-resolution interval, in minutes. */
    refreshMinutes: FieldState;
    /** Largest idle gap between stream events, in milliseconds. */
    streamIdleTimeoutMs: FieldState;
    /** Optional retained image occurrence cap; blank inherits the base configuration. */
    maxImages: FieldState;
    /** Accumulated base64 image payload bound for one request. */
    maxRequestImageBytes: FieldState;
    /** Total-pixel budget for one request image. */
    requestImagePixelBudget: FieldState;
    /** Raw encoded-byte target for one request image. */
    requestImageMaxBytes: FieldState;
    /** The staged credential, which starts blank on every load. */
    apiKey: FieldState;
    /** Whether the Host reports a credential configured for the referenced key. */
    apiKeyConfigured: boolean;
    /** Whether the credentials domain accepts a write for it; false disables the control. */
    apiKeyWritable: boolean;
    /** The gateway's current model listing. */
    models: OpencodeGoModels;
    /** The staged JSON field backing the capacity table. */
    modelLimits: FieldState;
    /** The parsed overrides currently shown by the capacity table. */
    modelLimitDraft: OpencodeGoModelLimits;
}
/** The registration-side face the page's slot entry injects. */
export interface OpencodeGoSectionFace extends FormActions, GoAccountsActions {
    hooks: {
        /** Page snapshot bound by the UI renderer as useOpencodeGo. */
        opencodeGo: SnapshotStore<OpencodeGoSectionState>;
    };
    /** Read the gateway's model listing, now or again after a failure. */
    loadModels: () => void;
    /**
     * Turn the adapter's route on or off, writing immediately.
     * @param next - the state the switch asks for.
     */
    setEnabled: (next: boolean) => void;
    setModelEnabled: (id: string, next: boolean) => void;
}
/** Bridges the `llm-opencode-go` scope and the credentials domain onto the page. */
export declare class OpencodeGoSectionController {
    private readonly scope;
    private readonly ctx;
    private readonly readModels;
    private readonly form;
    private readonly store;
    private credential;
    private models;
    private modelsRequest;
    private pickerSaving;
    private pickerFailed;
    private face;
    private readonly unsubscribe;
    private accounts;
    private credentialRequest;
    private keyDraftRef;
    /**
     * @param scope - the bound settings scope for the `llm-opencode-go` namespace.
     * @param ctx - the page plugin's context, whose `remote.credentials` namespace
     *   answers for the credential the section references.
     */
    constructor(scope: SettingsScope<OpencodeGoSettings>, ctx: ClientContext, readModels?: () => Promise<RemoteResult<GoModelCatalog>>, readUsage?: (ref: string) => Promise<import('../usage-contract.ts').GoUsage>);
    /** Release subscriptions without disposing the host's shared form. */
    dispose(): void;
    private projection;
    /**
     * Read the overrides as the page currently shows them. A staged JSON draft
     * wins while it is valid; malformed text falls back to the last accepted
     * settings value so the table never renders phantom rows.
     */
    private limitDraft;
    /**
     * The adapter's effective switch state: the resolved section's value, over
     * the Host's own default when the section carries none.
     * @returns whether the route is currently served.
     */
    private enabled;
    /**
     * Flip the switch by writing the field on the click itself.
     *
     * Like the per-model switches, this control does not wait for Save: the point
     * of turning it off is to watch the models leave the pickers, and the point
     * of turning it back on is to use the route again — staging either behind a
     * second gesture would report a state the Host does not hold. The write is
     * revision-fenced by the scope like every other, and a refusal surfaces as a
     * failed save through the shared shell rather than a silent revert.
     * @param next - the state the switch asks for.
     */
    setEnabled(next: boolean): Promise<void>;
    /** Each model switch has one committed value and takes effect without Save. */
    setModelEnabled(id: string, next: boolean): Promise<void>;
    /** Serialize immediate switches with form saves; refused writes retain committed values. */
    private writePickerSetting;
    /**
     * Read the gateway's model listing through the Host's discovery for this
     * adapter. Called when the page mounts and again from its refresh control.
     * A rejection settles as a failure too: the refresh control is disabled
     * while loading and the next read starts only from `idle`, so leaving the
     * state loading would strand the page with no way to ask the gateway again.
     */
    loadModels(): void;
    /**
     * Ask the credentials domain about the reference the section currently names.
     *
     * The answer is stored with the reference it describes: `apiKeyEnv` can
     * change between the request and its response, and two reads can settle out
     * of order, so a response is published only while it still answers for the
     * reference in force.
     */
    private readCredential;
    /**
     * Re-read after the Host reports a change to the reference this page watches.
     *
     * A key can be written from somewhere else — the Models page addresses the
     * same reference — and the settings section does not change when it is, so
     * without this the badge keeps reporting a state the Host already replaced.
     * @param ref - the reference the Host reports as changed.
     */
    refreshCredential(ref: string): void;
    /**
     * Build the face the page's slot registration injects. Built once: the store
     * is what changes, and the renderer binds the same callbacks across renders.
     * @returns the page snapshot and its form actions.
     */
    inject(): OpencodeGoSectionFace;
    /**
     * Write the staged key, then re-read whether the Host now holds one.
     * @param value - the staged credential literal.
     * @returns whether the Host reports a configured credential afterwards.
     */
    private writeKey;
}
