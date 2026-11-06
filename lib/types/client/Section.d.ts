import { type en } from './presentation.ts';
import { type ReactNode } from 'react';
import type { GoAccountsActions, GoAccountsState, OpencodeGoModelLimit, OpencodeGoModelLimits, OpencodeGoModels, OpencodeGoSectionFace } from './controller.ts';
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
export declare function AccountsCard({ state, actions, writable, t, locale }: {
    state: GoAccountsState;
    actions: GoAccountsActions;
    writable: boolean;
    t: AccountTranslate;
    locale?: string;
}): import("react").JSX.Element;
type ModelTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
export declare function hasCapacityOverride(limit: OpencodeGoModelLimit | null | undefined): boolean;
/** Per-model switches apply immediately; capacity edits stay in the staged form. */
export declare function ModelEditor({ source, models, draft, modelVisibility, t, locale, disabled, visibilitySaving, filterAction, onEdit, onModelEnabled }: {
    source?: ModelSource;
    models: OpencodeGoModels;
    draft: OpencodeGoModelLimits;
    modelVisibility: Readonly<Record<string, boolean>>;
    t: ModelTranslate;
    locale?: string;
    disabled: boolean;
    visibilitySaving: boolean;
    /** Optional control pinned to the right of the filter row, such as a refresh. */
    filterAction?: ReactNode;
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
}
/** Props delivered by the slot outlet: the inject face spread flat. */
export type OpencodeGoSectionProps = Partial<InjectFace<OpencodeGoSectionInjected>>;
/**
 * Render the OpenCode Go settings page.
 * @param props - locale copy, the page snapshot, and its form actions.
 * @returns the section.
 */
export declare function OpencodeGoSection(props: OpencodeGoSectionProps): import("react").JSX.Element | null;
