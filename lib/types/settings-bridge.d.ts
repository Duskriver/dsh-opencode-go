export interface AccountSettingsWriter {
    describe(): readonly {
        ns: string;
        revision: number;
        value: unknown;
    }[];
    mutate(ns: string, ops: readonly {
        op: 'set';
        path: string[];
        value: unknown;
    }[], expectedRevision?: number): Promise<unknown>;
}
/** Prefer the live profile entry when a legacy section also exists. */
export declare function accountSettingsRow(settings: AccountSettingsWriter): {
    ns: string;
    revision: number;
    value: unknown;
} | undefined;
export type SettingsWriteResult = 'applied' | 'rejected' | 'unknown';
/** Legacy writes need observation; callers may require it for acknowledgments too. */
export declare function settingsWriteResult(verdict: unknown, committed: () => boolean, confirmation?: 'acknowledged' | 'observed'): SettingsWriteResult;
export declare function isSettingsConflict(error: unknown): boolean;
