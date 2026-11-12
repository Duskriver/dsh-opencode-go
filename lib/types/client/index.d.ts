import type { Context as ClientContext, Context } from '@deepseek-ai/cordis';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { PageReaders, PageTab } from './pages/types.ts';
import { type OpencodeGoSettings, type ExecuteAccountCommand } from './controller.ts';
import { en } from './presentation.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'sidebar.footer.action': {
            kind: 'list';
            scope: 'root';
            owner: {
                wide: boolean;
            };
        };
    }
    interface LocaleNamespaceMap {
        /** The OpenCode Go settings page and console page copy. */
        'settings.opencode-go': keyof typeof en;
    }
}
export type { OpencodeGoSectionProps } from './Section.tsx';
export type { OpencodeGoSectionState, OpencodeGoSettings } from './controller.ts';
export { OPENCODE_GO_NS } from './controller.ts';
export type { OpencodeGoKey } from './presentation.ts';
export { PAGE_PANEL_ID, PAGE_SIDEBAR_ORDER } from './host-slots.ts';
export type { PageTab } from './pages/types.ts';
/** Re-exported so the host page id and the navigation helper stay discoverable. */
export { setPageTab } from './pages/nav.ts';
/**
 * Required top-level services (cordis fiber inject): the slot ledger, the locale
 * registry, the remote transport and the credential describe namespace. The
 * settings/model/analytics namespaces, \`layout\` and \`configForms\` are mounted
 * later with their own \`ctx.inject\` waits, and every target slot is reached
 * through \`slots.inject()\`, whose declaration order relative to this one is not
 * constrained.
 */
export declare const inject: string[];
/**
 * Register the settings section and the console page once their slots are on
 * the ledger, and keep the credential badge fresh on Host-reported key changes
 * written from any surface.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
export declare function accountCommands(ctx: Context): ExecuteAccountCommand;
/**
 * @param ctx - client root context.
 * @param settings - the profile ConfigForm backing every account surface.
 * @param selectAccount - switch the profile's preferred account.
 * @param readers - shared usage/analytics readers (page and pill share one set).
 * @param openPage - open the console page, or undefined on hosts without it.
 */
export declare function registerUsagePill(ctx: Context, settings: ConfigForm<OpencodeGoSettings>, selectAccount?: (ref: string) => Promise<boolean>, readers?: PageReaders, openPage?: (tab?: PageTab) => void): void;
