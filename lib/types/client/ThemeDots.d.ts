import type { en } from './locales.ts';
/**
 * Four palette dots shared by the pill popover and the dashboard header.
 * @param props.t - copy lookup.
 * @param props.compact - hide the text label (the popover has no room).
 */
export declare function ThemeDots({ t, compact }: {
    t: (key: keyof typeof en) => string;
    compact?: boolean;
}): import("react").JSX.Element;
