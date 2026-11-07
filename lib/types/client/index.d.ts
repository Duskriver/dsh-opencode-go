import type { Context as ClientContext, Context } from '@deepseek-ai/cordis';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
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
        /** The OpenCode Go settings page copy. */
        'settings.opencode-go': keyof typeof en;
    }
}
export type { OpencodeGoSectionProps } from './Section.tsx';
export type { OpencodeGoSectionState, OpencodeGoSettings } from './controller.ts';
export { OPENCODE_GO_NS } from './controller.ts';
export type { OpencodeGoKey } from './presentation.ts';
/**
 * Required top-level services (cordis fiber inject): the slot ledger, the locale
 * registry, the remote transport and the credential describe namespace. The
 * settings/model/analytics namespaces and `configForms` are mounted later with
 * their own `ctx.inject` waits, and every target slot is reached through
 * `slots.inject()`, whose declaration order relative to this one is not
 * constrained.
 */
export declare const inject: string[];
/**
 * Register the section once the `settings.section` declaration is on the
 * ledger, and keep the credential badge fresh on Host-reported key changes
 * written from any surface.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
export declare function accountCommands(ctx: Context): ExecuteAccountCommand;
export declare function registerUsagePill(ctx: Context, settings: ConfigForm<OpencodeGoSettings>, selectAccount?: (ref: string) => Promise<boolean>): void;
