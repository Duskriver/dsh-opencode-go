import { type LlmDiscoveredModel } from '@deepseek-ai/dsh-llm';
import type { Api, Model, ModelThinkingLevel, ThinkingBudgets, ThinkingLevelMap, Provider } from './sdk-types.ts';
import { type ThinkingBudgetRange, type GoModel, type OpencodeGoConfig, type ModelSource, type GoModelCatalog } from './contracts.ts';
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
export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'> & {
    readonly costKnown?: false;
};
export interface ModelDirectory {
    readonly models: ReadonlyMap<string, Model<Api>>;
    readonly details: ReadonlyMap<string, ModelDetails>;
    readonly errors: ReadonlyMap<string, string>;
    readonly warning?: string;
}
/** Official listings own their protocol endpoints; custom gateways keep their prefix. */
export declare function modelBaseURL(api: Api, baseURL: string, declared?: unknown, source?: ModelSource): string;
export declare function readLiveModelIds(body: unknown, onInvalidRows?: (warning: string) => void): readonly string[];
export declare function readModelDirectory(body: unknown, baseURL: string, source?: ModelSource): ModelDirectory;
export declare const MODEL_LISTING_MAX_BYTES: number;
export interface CachedDirectory {
    readonly body: unknown;
    readonly etag?: string;
    readonly savedAtMs: number;
}
export declare function catalogCachePath(source?: ModelSource): string;
export declare function catalogETag(value: unknown): string | undefined;
export declare function readCatalogCache(path: string, sourceURL: string): Promise<CachedDirectory | undefined>;
export declare function writeCatalogCache(path: string, sourceURL: string, value: CachedDirectory): Promise<boolean>;
export { PROVIDER_ID, DISPLAY_NAME, FREE_PROVIDER_ID, FREE_DISPLAY_NAME, DEFAULT_BASE_URL, DEFAULT_FREE_BASE_URL } from './contracts.ts';
export interface CatalogSnapshot {
    readonly source: ModelSource;
    readonly details: ModelDirectory['details'];
    readonly models: ReadonlyMap<string, Model<Api>>;
    readonly unavailable: ReadonlyMap<string, string>;
    readonly provider: Provider;
    readonly live: boolean;
    readonly failure?: unknown;
    readonly warning?: string;
    readonly updatedAtMs?: number;
    readonly fetchedAtMs: number;
}
/** One gateway owns its membership, disk cache, validator, refresh and failure backoff. */
export declare class OpencodeGoCatalog {
    private readonly baseURL;
    private readonly refreshMs;
    private readonly onFallback;
    private readonly onOmitted;
    private readonly onRefresh;
    private readonly fetcher?;
    private readonly onWarning?;
    readonly source: ModelSource;
    private served;
    private pending;
    private initialized;
    private cached;
    private startupCache;
    private refreshAtMs;
    private failures;
    private readonly url;
    private readonly cachePath;
    constructor(baseURL: string, refreshMs: number, onFallback?: (detail: {
        url: string;
        error: unknown;
        kept: number;
    }) => void, onOmitted?: (ids: readonly string[]) => void, onRefresh?: () => void, fetcher?: typeof globalThis.fetch | undefined, onWarning?: ((warning: string) => void) | undefined, source?: ModelSource);
    snapshot(force?: boolean, signal?: AbortSignal): Promise<CatalogSnapshot>;
    private empty;
    private build;
    private restore;
    private refresh;
    forModel(id: string, signal?: AbortSignal): Promise<CatalogSnapshot>;
}
export declare function discoverCatalogModels(catalog: OpencodeGoCatalog): Promise<readonly LlmDiscoveredModel[]>;
export declare function discoverSettingsModels(catalog: OpencodeGoCatalog, freeCatalog?: OpencodeGoCatalog): Promise<GoModelCatalog>;
export declare class GoCatalogManager {
    private readonly options;
    private readonly current;
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
    forConfig(config: OpencodeGoConfig, source?: ModelSource): OpencodeGoCatalog;
}
export declare class GoModelsService extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        catalog: () => OpencodeGoCatalog;
        freeCatalog?: () => OpencodeGoCatalog;
        onRefresh?: () => void;
    });
    read(): Promise<GoModelCatalog>;
}
