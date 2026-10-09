import type { GoAccountSettlement } from './adapter.ts';
import { type GoAccountSwitch } from './accounts.ts';
import type { OpencodeGoConfig } from './config.ts';
import { type AccountSettingsWriter } from './settings-bridge.ts';
export type { AccountSettingsWriter } from './settings-bridge.ts';
/** Owns both the fallback notice and its optional persisted account selection. */
export declare class GoAccountSelection {
    private readonly config;
    private readonly logger;
    private settings;
    private connection;
    private credentials;
    private version;
    private signature;
    private latestSeq;
    private notice;
    constructor(config: () => OpencodeGoConfig, logger: {
        debug(message: string): void;
        warn(message: string): void;
    });
    connect(settings: AccountSettingsWriter): () => void;
    private row;
    /** Reading the revision also catches A → C → A before async change watchers run. */
    capture(): number;
    credentialChanged(): void;
    lastSwitch(): GoAccountSwitch | undefined;
    /** One freshness decision governs both side effects of a request's outcome. */
    settle(event: GoAccountSettlement): void;
    private adopt;
}
