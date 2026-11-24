/** Shared client-side usage cache with in-flight deduplication across surfaces. */
import type { GoUsage } from '../contracts.ts';
export interface UsageReading {
    readonly usage: GoUsage;
    readonly updatedAt: number;
}
export interface SharedUsageStore {
    /** Read active-account usage with short-TTL deduplication (bypassed when `force` is true). */
    readActive(force?: boolean): Promise<GoUsage>;
    /** Read one account's usage with short-TTL deduplication (bypassed when `force` is true). */
    readAccount(ref: string, force?: boolean): Promise<GoUsage>;
    /** Read the most recent cached snapshot for one account without triggering a network call. */
    peek(ref: string): UsageReading | undefined;
    /** Drop cached entries after credential, account, or endpoint changes. */
    invalidate(ref?: string): void;
}
export declare function createSharedUsageStore(readers: {
    readActive: () => Promise<GoUsage>;
    readAccount: (ref: string) => Promise<GoUsage>;
    endpointKey?: () => string;
}, ttlMs?: number): SharedUsageStore;
