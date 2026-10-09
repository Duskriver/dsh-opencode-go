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
/** A modern verdict is authoritative; legacy writes need a committed-state check. */
export declare function settingsWriteResult(verdict: unknown, committed: () => boolean): SettingsWriteResult;
export declare function isSettingsConflict(error: unknown): boolean;
