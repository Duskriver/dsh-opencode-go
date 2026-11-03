import { type LlmDiscoveredModel } from '@deepseek-ai/dsh-llm';
import type { Api, Model, ModelThinkingLevel, ThinkingBudgets, ThinkingLevelMap, Provider } from './sdk-types.ts';
import { type ThinkingBudgetRange, type GoModel, type OpencodeGoConfig, type GoModelCatalog } from './contracts.ts';
import { type ProxyTransport } from './transport.ts';
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
export declare const THINKING_LEVELS: readonly ModelThinkingLevel[];
/** Protocol formats whose switch/budget is understood by pi-ai. */
export declare const NATIVE_THINKING_FLAGS: ReadonlySet<string>;
/** Expose budgets only when the SDK knows where to serialize a numeric limit. */
export declare function supportsThinkingBudget(api: Api, compat: Model<Api>['compat']): boolean;
export declare function reasoningBudgetRange(model: Model<Api>): ThinkingBudgetRange | undefined;
export declare function unsupportedThinkingLevels(): ThinkingLevelMap;
/** Exact model/protocol controls verified against OpenCode Go. */
export declare function withGatewayReasoning(model: Model<Api>): Model<Api>;
export declare function reasoningChoices(model: Model<Api>): readonly {
    id: string;
    name: string;
}[];
export type ReasoningIntent = {
    kind: 'default';
} | {
    kind: 'off';
} | {
    kind: 'on';
} | {
    kind: 'effort';
    level: Exclude<ModelThinkingLevel, 'off'>;
} | {
    kind: 'budget';
    tokens: number;
    min: number;
};
/** Called after validation against the model's choices. */
export declare function reasoningIntent(model: Model<Api>, level: string | undefined): ReasoningIntent;
/**
 * The SDK serializes explicit choices. Default must leave all thinking controls
 * to the service; a switch's On must not acquire an invented effort spelling.
 */
export declare function reasoningRequest(intent: ReasoningIntent): {
    reasoning?: Exclude<ModelThinkingLevel, 'off'>;
    thinkingBudgets?: ThinkingBudgets;
    onPayload: (payload: unknown) => unknown;
};
export declare const MODEL_METADATA_URL = "https://models.dev/api.json";
/** Lifecycle and capability data the online catalog adds to a gateway listing. */
export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'> & {
    /**
     * Present only when the upstream cost block is missing or carries a malformed
     * component: its zeros are then indistinguishable from a genuinely free model,
     * so analytics must treat the model as unpriced instead of pricing it at 0.
     * A published block with legal components stays unmarked even when all zero.
     */
    readonly costKnown?: false;
};
export interface ModelMetadata {
    readonly models: ReadonlyMap<string, Model<Api>>;
    readonly details: ReadonlyMap<string, ModelDetails>;
    readonly errors: ReadonlyMap<string, string>;
}
/** Select documented official protocol endpoints while preserving custom gateway prefixes. */
export declare function modelBaseURL(api: Api, baseURL: string): string;
/** Shared Responses defaults for declared models and explicit protocol overrides. */
export declare function responsesCompatibility(): NonNullable<Model<'openai-responses'>['compat']>;
/**
 * Only read the opencode-go record. Online endpoints, headers and credentials
 * are deliberately ignored: protocol endpoints are selected on the configured gateway.
 * A bad entry is isolated instead of discarding every other model.
 */
export declare function readModelMetadata(body: unknown, baseURL: string, builtin: ReadonlyMap<string, Model<Api>>): ModelMetadata;
export declare const MODEL_METADATA_MAX_BYTES: number;
export interface CachedMetadata {
    readonly body: unknown;
    readonly etag?: string;
    /** Last successful download or HTTP 304 verification. */
    readonly savedAtMs: number;
}
export declare function metadataCachePath(): string;
/** Only persist validators that can safely become an HTTP request header. */
export declare function metadataETag(value: unknown): string | undefined;
export declare function readMetadataCache(path: string): Promise<CachedMetadata | undefined>;
export declare function writeMetadataCache(path: string, value: CachedMetadata): Promise<boolean>;
/** Resolve a request's wire model without mutating the shared metadata catalog. */
export declare function withProtocolOverride(model: Model<Api>, config: OpencodeGoConfig): Model<Api>;
export { PROVIDER_ID, DISPLAY_NAME } from './contracts.ts';
export { DEFAULT_BASE_URL } from './contracts.ts';
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
    readonly listingWarning?: string;
    readonly metadataFailure?: unknown;
    /** Last successful fetch or revalidation, not the time of a failed attempt. */
    readonly listingUpdatedAtMs?: number;
    readonly metadataUpdatedAtMs?: number;
    readonly fetchedAtMs: number;
}
/** A valid empty listing means the gateway serves nothing; malformed replies are failures. */
export declare function readLiveModelIds(body: unknown, onInvalidRows?: (warning: string) => void): readonly string[];
/** Runtime requests reuse a snapshot; discovery revalidates it. Concurrent reads coalesce. */
export declare class OpencodeGoCatalog {
    private readonly baseURL;
    private readonly refreshMs;
    private readonly onFallback;
    /** Kept for API compatibility; now reports unconfigured ids rather than hiding them. */
    private readonly onOmitted;
    private readonly onRefresh;
    private readonly fetcher?;
    private readonly onWarning?;
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
    onOmitted: (ids: readonly string[]) => void, onRefresh?: () => void, fetcher?: typeof globalThis.fetch | undefined, onWarning?: ((warning: string) => void) | undefined);
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
/** One mount owns discovery; inference, settings and pickers share its snapshots. */
export declare class GoCatalogManager {
    private readonly options;
    private current;
    constructor(options: {
        transport: ProxyTransport;
        onFallback?: (detail: {
            url: string;
            error: unknown;
            kept: number;
        }) => void;
        onOmitted?: (ids: readonly string[]) => void;
        onRefresh?: () => void;
        onWarning?: (warning: string) => void;
    });
    forConfig(config: OpencodeGoConfig): OpencodeGoCatalog;
}
/** Uses the same gateway snapshot as the adapter, including models hidden from pickers. */
export declare class GoModelsService extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        catalog: () => OpencodeGoCatalog;
        onRefresh?: () => void;
    });
    read(): Promise<GoModelCatalog>;
}
