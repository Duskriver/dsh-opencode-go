import { type en } from './presentation.ts';
import type { GoAccountsActions, GoAccountsState, OpencodeGoModelLimit, OpencodeGoModelLimits, OpencodeGoModels, TextField, EditableField, OpencodeGoSectionFace, OpencodeGoSectionState } from './controller.ts';
import { type ModelSource } from '../contracts.ts';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
export declare function HintMark(props: {
    hint: string;
}): import("react").JSX.Element;
export declare function HintText(props: {
    id: string;
    hint: string;
}): import("react").JSX.Element;
type AccountTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
/**
 * The account card: a folded header that summarizes the set, and one row per
 * account inside. Rows keep the identity, key state, rolling quota and its reset
 * countdown; everything else opens under the row. The handle is the drag source —
 * dragging it, or the arrow keys on it, reorders the list, and the first row is
 * the preferred account. Every row is read in the same pass, so the one refresh
 * stamp belongs to the card and sits in its header.
 */
export declare function AccountsCard({ state, actions, writable, t, locale, addRequest, defaultOpen, surface }: {
    state: GoAccountsState;
    actions: GoAccountsActions;
    writable: boolean;
    t: AccountTranslate;
    locale?: string;
    /**
     * Rising counter from a page-level "Add account" action. The page owns the
     * button, the card owns the editor: asking through a counter keeps one add
     * form (and its draft state) instead of a second copy on the page.
     */
    addRequest?: number;
    /** The console page shows the rows by default; the settings section keeps its fold. */
    defaultOpen?: boolean;
    /** Settings keeps the hairline card; the console page draws a real card. */
    surface?: 'settings' | 'page';
}): import("react").JSX.Element;
type ModelTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
export declare function hasCapacityOverride(limit: OpencodeGoModelLimit | null | undefined): boolean;
/** Per-model switches apply immediately; capacity edits stay in the staged form. */
export declare function ModelEditor({ source, models, draft, modelVisibility, t, locale, disabled, visibilitySaving, onEdit, onModelEnabled }: {
    source?: ModelSource;
    models: OpencodeGoModels;
    draft: OpencodeGoModelLimits;
    modelVisibility: Readonly<Record<string, boolean>>;
    t: ModelTranslate;
    locale?: string;
    disabled: boolean;
    visibilitySaving: boolean;
    onEdit: (next: OpencodeGoModelLimits) => void;
    onModelEnabled: (id: string, enabled: boolean) => void;
}): import("react").JSX.Element;
export type { OpencodeGoSectionState } from './controller.ts';
/** Section copy lookup, including the optional `{name}` template params. */
type SectionTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
/** Injected dependencies of {@link OpencodeGoSection} (slot `inject`). */
export interface OpencodeGoSectionInjected extends OpencodeGoSectionFace {
    /** Section copy. */
    t: SectionTranslate;
    /** Read at render time because the Host caches injected values across locale changes. */
    getLocale?: () => string;
    /**
     * Opens the full sidebar page from the settings section. Optional: hosts that
     * never register the page simply leave the secondary button out.
     */
    openPage?: () => void;
}
/** Props delivered by the slot outlet: the inject face spread flat. */
export type OpencodeGoSectionProps = Partial<InjectFace<OpencodeGoSectionInjected>>;
/**
 * The Appearance tab's card. Extracted from `Loaded` so the sidebar page and the
 * settings section render one implementation; the classes and children are the
 * ones the settings tests already read.
 */
export declare function AppearanceSettings({ state, t, disabled, saving, onEdit, resetField, surface }: {
    state: OpencodeGoSectionState;
    t: SectionTranslate;
    disabled: boolean;
    saving: boolean;
    onEdit: (field: TextField, text: string) => void;
    resetField: (field: EditableField) => void;
    surface?: 'settings' | 'page';
}): import("react").JSX.Element;
/**
 * The Advanced tab's card: connection overrides, cache/timeout tuning and the
 * image budget, closed by the reset-all row. Extracted from `Loaded` unchanged
 * so the full page can carry the same fields.
 */
export declare function AdvancedSettings({ state, t, disabled, saving, invalidLabel, edit, resetField, surface }: {
    state: OpencodeGoSectionState;
    t: SectionTranslate;
    disabled: boolean;
    saving: boolean;
    invalidLabel: string;
    edit: (field: TextField, text: string) => void;
    resetField: (field: EditableField) => void;
    surface?: 'settings' | 'page';
}): import("react").JSX.Element;
/**
 * The Models tab's card: the Go/Free source tabs, the listing status and the
 * capacity editor. The selected source is local (as it was in `Loaded`), so the
 * page and the section behave the same on remount.
 */
export declare function ModelsSettings({ state, t, locale, disabled, onEdit, setModelEnabled, loadModels, surface }: {
    state: OpencodeGoSectionState;
    t: SectionTranslate;
    locale?: string;
    disabled: boolean;
    onEdit: (value: OpencodeGoModelLimits) => void;
    setModelEnabled: (id: string, next: boolean) => void;
    loadModels: () => void;
    surface?: 'settings' | 'page';
}): import("react").JSX.Element;
/**
 * Render the OpenCode Go settings page.
 * @param props - locale copy, the page snapshot, and its form actions.
 * @returns the section.
 */
export declare function OpencodeGoSection(props: OpencodeGoSectionProps): import("react").JSX.Element | null;
