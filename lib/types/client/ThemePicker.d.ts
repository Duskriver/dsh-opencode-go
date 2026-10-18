import type { en } from './locales.ts';
/**
 * The one place a style is chosen: four previews, each a miniature of the
 * surface it selects, on the Settings page. The picker lives here rather than in
 * the pill or the dashboard so a working session never changes its own look.
 * @param props.t - copy lookup.
 */
export declare function ThemePicker({ t }: {
    t: (key: keyof typeof en) => string;
}): import("react").JSX.Element;
