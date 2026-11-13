/** Sidebar row icon and page brand mark for OpenCode Go. */
import type { ReactElement } from 'react';
/**
 * The hand-drawn `go` mark: a curly `g` outline (with its descender) around a
 * filled stone, plus the hollow stone that reads as the `o`. Kept as data so the
 * React row icon and the settings-navigation CSS mask cannot drift apart.
 */
export declare const GO_ROW_GEOMETRY: {
    readonly viewBox: 24;
    readonly strokeWidth: 2.05;
    readonly path: "M12.15 4.25C6.45 3.45 2.5 6.8 2.5 11.85c0 4.92 3.3 7.95 8.02 7.95 1.17 0 2.3-.15 3.13-.55M10.52 14.25v5.55";
    readonly stone: {
        readonly cx: 10.65;
        readonly cy: 12.3;
        readonly r: 3.75;
    };
    readonly outline: {
        readonly cx: 17.85;
        readonly cy: 12.05;
        readonly r: 3.73;
        readonly strokeWidth: 1.95;
    };
};
/**
 * The row mark as one standalone black SVG, for a CSS `mask-image`.
 * A mask reads alpha only, so every paint is pure black; the visible colour
 * comes from the masked element's `background-color: currentColor`.
 * @returns the self-contained SVG source (needs `xmlns` as a data URI document).
 */
export declare function goRowMaskSvg(): string;
/** Monochrome wave mark inside the colored page logo. */
export declare function GoMark(props: {
    size?: number;
    className?: string;
}): ReactElement;
/** Colored square mark used by the page header and the About page. */
export declare function GoLogo(props: {
    size?: number;
    className?: string;
}): ReactElement;
/**
 * Sidebar row occupant: the host supplies the square edge and the active flag;
 * the icon inherits currentColor so the host's selected colour applies.
 * @param owner - slot owner props (the settings nav icon seat passes `size` too).
 * @returns the monochrome mark.
 */
export declare function GoRowIcon(owner: {
    size?: number;
    active?: boolean;
}): ReactElement;
