/** Durable, client-safe intentions. Never put a credential value in this document. */
import { type AccountSettings, type GoAccount } from './accounts.ts';
export type GoAccountOperation = {
    id: string;
    kind: 'add';
    account: GoAccount;
    previousRef: string;
    select: boolean;
} | {
    id: string;
    kind: 'remove';
    account: GoAccount;
};
export declare function ownsAccountCredential(account: GoAccount): boolean;
export declare function assertAccountOperations(value: readonly GoAccountOperation[] | undefined): void;
/** Pending additions remain visible so a lost key write can be repaired or removed. */
export declare function visibleAccountsOf(settings: AccountSettings): readonly GoAccount[];
/** The same transition completes a foreground operation or a recovered intention. */
export declare function accountOperationPatch(settings: AccountSettings, operation: GoAccountOperation, dropLegacyRef?: string): ({
    op: "set";
    path: string[];
    value: GoAccount[];
} | {
    op: "set";
    path: string[];
    value: string;
} | {
    op: "set";
    path: string[];
    value: GoAccountOperation[];
})[];
