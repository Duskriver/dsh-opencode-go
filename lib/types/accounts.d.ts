/** Client-safe account metadata. Secrets stay in the host credential service. */
export type GoAccount = {
    id: string;
    name: string;
    apiKeyEnv: string;
};
export declare const MAX_ACCOUNTS = 20;
export declare const ACCOUNT_REF_PREFIX = "DSH_OPENCODE_GO_ACCOUNT_";
export declare const DEFAULT_ACCOUNT_REF = "OPENCODE_API_KEY";
/** A credential reference is a bare environment variable name, never empty or decorated. */
export declare const ACCOUNT_REF_PATTERN: RegExp;
export interface AccountSettings {
    apiKeyEnv?: string;
    /** Omission/null preserves legacy credentials; an explicit empty list removes all accounts. */
    accounts?: readonly GoAccount[] | null;
    autoSwitch?: boolean;
}
export declare function accountRefOf(settings: AccountSettings): string;
/** Include an externally selected reference without rewriting existing configuration. */
export declare function accountsOf(settings: AccountSettings): readonly GoAccount[];
export declare function assertAccounts(accounts: readonly GoAccount[] | null | undefined, selectedRef?: string): void;
/** Safe UI notice for a successful request using a fallback account. */
export interface GoAccountSwitch {
    fromRef: string;
    toRef: string;
    reason: 'quota' | 'credential';
    at: number;
}
