/**
 * The OpenCode Go settings page. Three cards carry the page's whole order — the
 * connection (the switch that routes the provider plus the API key it
 * authenticates with), the models the gateway currently serves and their
 * capacities, and the adapter tuning fields behind a collapsed disclosure at the
 * foot. The credential reference, the endpoint, and the tuning knobs all live in
 * the `llm-opencode-go` namespace, so every card writes the same document.
 */
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { OpencodeGoSectionFace } from './section-controller.ts';
import type { en } from './locales.ts';
export type { OpencodeGoSectionState } from './section-controller.ts';
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
