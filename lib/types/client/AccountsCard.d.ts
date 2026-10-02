import type { GoAccountsActions, GoAccountsState } from './accounts-controller.ts';
import type { en } from './locales.ts';
type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
export declare function AccountsCard({ state, actions, writable, t, locale }: {
    state: GoAccountsState;
    actions: GoAccountsActions;
    writable: boolean;
    t: Translate;
    locale?: string;
}): import("react").JSX.Element;
export {};
