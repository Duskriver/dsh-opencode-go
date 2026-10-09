import type { Context } from '@deepseek-ai/cordis';
import type { OpencodeGoConfig } from './config-contract.ts';
import type { AccountSettingsWriter } from './settings-bridge.ts';
export declare function validateGoConfig(value: OpencodeGoConfig): void;
/** Version-specific settings attachment and validation stay at the host boundary. */
export declare function installHostSettings(ctx: Context, entry: OpencodeGoConfig, options: {
    connect: (settings: AccountSettingsWriter) => () => void;
    setSource: (source: () => OpencodeGoConfig) => void;
    onChange: () => void;
    recover: () => void;
}): void;
