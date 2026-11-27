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
 * right side of the composer dropdown.
 *
 * The label slot is single-occupant: whichever contribution holds it is called for
 * every provider's row. So a Go row falls back to the quota badge this plugin
 * publishes on the catalog whenever its live lookup has none, and another provider's
 * row reproduces that model's own catalog `badge` the way the host's fallback would
 * have drawn it (#125). The composer trigger and the menu's current value keep the
 * plain name.
 */
export declare function ModelLabel({ provider, model, placement, settings, catalog, t, getLocale }: ModelLabelProps): import("react").JSX.Element;
