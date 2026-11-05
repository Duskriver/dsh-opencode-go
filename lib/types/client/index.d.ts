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
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registration depends on each slot through `slots.inject()`.
 * `remote.llm` is the discovery namespace the page reads the model listing
 * through.
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
