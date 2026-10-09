import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { SettingsWriteResult } from './settings-bridge.ts';
export type AccountCommand = {
    kind: 'add';
    id: string;
    name: string;
    key: string;
} | {
    kind: 'remove';
    ref: string;
} | {
    kind: 'select';
    ref: string;
} | {
    kind: 'rename';
    ref: string;
    name: string;
} | {
    kind: 'replace-key';
    ref: string;
    key: string;
} | {
    kind: 'move';
    ref: string;
    toIndex: number;
} | {
    kind: 'auto-switch';
    value: boolean;
};
export declare function parseAccountCommand(value: unknown): AccountCommand;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        opencodeGoAccounts: {
            execute(command: AccountCommand): Promise<RemoteResult<SettingsWriteResult>>;
        };
    }
}
export declare const accountsRemote: TypertRemoteContribution;
