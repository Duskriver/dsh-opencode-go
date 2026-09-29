import type { Api, Model, Provider } from '@earendil-works/pi-ai';
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm';
import { type GoModelCatalog } from './models-contract.ts';
import type { ModelMetadata } from './model-metadata.ts';
export declare const PROVIDER_ID = "opencode-go";
export declare const DISPLAY_NAME = "OpenCode Go";
export declare const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
export interface CatalogSnapshot {
    readonly details: ModelMetadata['details'];
    readonly models: ReadonlyMap<string, Model<Api>>;
    /** Advertised ids with missing/unsupported metadata stay visible with a diagnostic. */
    readonly unavailable: ReadonlyMap<string, string>;
    readonly provider: Provider;
    readonly live: boolean;
    readonly metadataLive: boolean;
    /** Retained for explicit discovery; runtime callers may still use the last catalog. */
    readonly listingFailure?: unknown;
    readonly metadataFailure?: unknown;
    /** Last successful fetch or revalidation, not the time of a failed attempt. */
    readonly listingUpdatedAtMs?: number;
    readonly metadataUpdatedAtMs?: number;
    readonly fetchedAtMs: number;
}
/** A valid empty listing means the gateway serves nothing; malformed replies are failures. */
export declare function readLiveModelIds(body: unknown): readonly string[];
/** Runtime requests reuse a snapshot; discovery revalidates it. Concurrent reads coalesce. */
export declare class OpencodeGoCatalog {
    private readonly baseURL;
    private readonly refreshMs;
    private readonly onFallback;
    /** Kept for API compatibility; now reports unconfigured ids rather than hiding them. */
    private readonly onOmitted;
    private readonly onRefresh;
    private served;
    private pending;
    /** A cold runtime read can use disk metadata while the shared online refresh runs. */
    private cachedPending;
    private initialized;
    private readonly cachePath;
    private metadata;
    private metadataBody;
    private metadataETag;
    private metadataUpdatedAtMs;
    private failures;
    private refreshAtMs;
    constructor(baseURL: string, refreshMs: number, onFallback: (detail: {
        url: string;
        error: unknown;
        kept: number;
    }) => void, 
    /** Kept for API compatibility; now reports unconfigured ids rather than hiding them. */
    onOmitted: (ids: readonly string[]) => void, onRefresh?: () => void);
    snapshot(force?: boolean, signal?: AbortSignal): Promise<CatalogSnapshot>;
    private restoreMetadata;
    private readSnapshot;
    private currentSnapshot;
    private startRefresh;
    /** Conditional HTTP requests save bandwidth while still checking for updated metadata. */
    private refreshMetadata;
    private persistMetadata;
    /** Gateway ids decide membership; online metadata decides how to call each model. */
    private build;
    /** New or previously unconfigured ids get a fresh lookup even during the runtime TTL. */
    forModel(id: string, signal?: AbortSignal): Promise<CatalogSnapshot>;
}
/** Explicit discovery always revalidates both sources, including during the runtime TTL. */
export declare function discoverCatalogModels(catalog: OpencodeGoCatalog): Promise<readonly LlmDiscoveredModel[]>;
/** Settings expose the same retained catalog as requests, with a failed-refresh diagnostic. */
export declare function discoverSettingsModels(catalog: OpencodeGoCatalog): Promise<GoModelCatalog>;
