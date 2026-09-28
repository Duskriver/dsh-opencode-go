import type { OpencodeGoModelLimit, OpencodeGoModelLimits, OpencodeGoModels } from './section-controller.ts';
import type { en } from './locales.ts';
type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
export declare function hasCapacityOverride(limit: OpencodeGoModelLimit | null | undefined): boolean;
/** Per-model switches apply immediately; capacity edits stay in the staged form. */
export declare function ModelEditor({ models, draft, modelVisibility, t, locale, disabled, visibilitySaving, onEdit, onModelEnabled }: {
    models: OpencodeGoModels;
    draft: OpencodeGoModelLimits;
    modelVisibility: Readonly<Record<string, boolean>>;
    t: Translate;
    locale?: string;
    disabled: boolean;
    visibilitySaving: boolean;
    onEdit: (next: OpencodeGoModelLimits) => void;
    onModelEnabled: (id: string, enabled: boolean) => void;
}): import("react").JSX.Element;
export {};
