import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { OpencodeGoSettings } from './controller.ts';
import type { SharedModelCatalog } from './model-catalog-store.ts';
import { type MultiplierTranslate } from './quota-badge.ts';
export interface ModelLabelInjected {
    settings: ConfigForm<OpencodeGoSettings>;
    catalog: SharedModelCatalog;
    t: MultiplierTranslate;
    getLocale?: () => string;
}
export type ModelLabelProps = PropsRuntime<'conversation.input.model.label'> & Partial<ModelLabelInjected>;
/**
 * Render an OpenCode Go option label with its live quota multiplier on the
 * right side of the composer dropdown, keeping trigger, menu and other
 * providers as plain `model.name`.
 */
export declare function ModelLabel({ provider, model, placement, settings, catalog, t, getLocale }: ModelLabelProps): import("react").JSX.Element;
