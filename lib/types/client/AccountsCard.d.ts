import type { GoAccountsActions, GoAccountsState } from './accounts-controller.ts';
import type { en } from './locales.ts';
type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
/**
 * The account card: a folded header that summarizes the set, and one row per
 * account inside. Rows keep the identity, key state, rolling quota and its reset
 * countdown; everything else opens under the row. The handle is the drag source —
 * dragging it, or the arrow keys on it, reorders the list, and the first row is
 * the preferred account.
 */
export declare function AccountsCard({ state, actions, writable, t, locale }: {
    state: GoAccountsState;
    actions: GoAccountsActions;
    writable: boolean;
    t: Translate;
    locale?: string;
}): import("react").JSX.Element;
export {};
