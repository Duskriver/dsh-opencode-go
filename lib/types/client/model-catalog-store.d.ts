/** Shared client-side Go catalog cache to prevent N+1 RPCs when pickers render. */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { GoModel, GoModelCatalog } from '../contracts.ts';
export interface SharedModelCatalog {
    readonly store: SnapshotStore<readonly GoModel[] | null>;
    /** Record a catalog read performed by another surface (Settings, UsagePill). */
    publish(catalog: GoModelCatalog, endpointKey: string): void;
    /** Deduplicated lazy load; returns cached entries while fresh and on the same endpoint. */
    ensureLoaded(endpointKey: string, ttlMs?: number): Promise<readonly GoModel[] | null>;
    /** Drop cached entries when connection endpoints change. */
    syncEndpoint(endpointKey: string): void;
}
export declare function createSharedModelCatalog(readModels: () => Promise<GoModelCatalog>): SharedModelCatalog;
