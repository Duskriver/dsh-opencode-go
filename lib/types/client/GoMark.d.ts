/** Sidebar row icon and page brand mark for OpenCode Go. */
import type { ReactElement } from 'react';
/** Monochrome wave mark rendered in the host sidebar; inherits currentColor. */
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
 * @param owner - slot owner props.
 * @returns the monochrome mark.
 */
export declare function GoRowIcon(owner: {
    size?: number;
    active?: boolean;
}): ReactElement;
