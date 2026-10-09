import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { AccountCommand } from './accounts-contract.ts';
import type { GoAccountManager } from './account-manager.ts';
/** The browser sends commands; the host owns credentials, revisions and recovery. */
export declare class GoAccountsService extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        manager: GoAccountManager;
    });
    execute(command: AccountCommand): Promise<import("./settings-bridge.ts").SettingsWriteResult>;
}
