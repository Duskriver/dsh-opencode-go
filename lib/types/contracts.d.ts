/** Browser-safe configuration, account metadata and RPC wire contracts. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
/** Public DSH route and the private SDK transport have separate identities. */
export declare const PROVIDER_ID = "dsh-opencode-go";
export declare const DISPLAY_NAME = "DSH OpenCode Go";
export declare const FREE_PROVIDER_ID = "dsh-opencode-free";
export declare const FREE_DISPLAY_NAME = "DSH OpenCode Free";
export type ModelSource = 'go' | 'free';
/** Go keeps its legacy keys; Free owns a separate settings namespace. */
export declare function modelSettingsKey(model: {
    id: string;
    source?: ModelSource;
}): string;
export declare const SDK_PROVIDER_ID = "opencode-go";
/** Public Go discovery/usage base; inference uses the documented protocol-specific siblings. */
export declare const DEFAULT_BASE_URL = "https://opencode.ai/inference/go/v1";
export declare const DEFAULT_FREE_BASE_URL = "https://opencode.ai/inference/v1";
/**
 * Migrate the legacy official address before any request is constructed.
 */
export declare function migrateGatewayBaseURL(baseURL: string): string;
/** Shared by Host validation and the browser form; never echo proxy credentials. */
export declare function assertProxyURL(raw: string | undefined): string;
/** Usage visibility shared by the Host schema and the browser settings. */
export declare const USAGE_DISPLAY_MODES: readonly ["auto", "always", "off"];
export type UsageDisplayMode = typeof USAGE_DISPLAY_MODES[number];
export declare const DEFAULT_USAGE_DISPLAY: UsageDisplayMode;
export declare const USAGE_PILL_STYLES: readonly ["badge", "plain"];
export type UsagePillStyle = typeof USAGE_PILL_STYLES[number];
export declare const DEFAULT_USAGE_PILL_STYLE: UsagePillStyle;
/** Client-safe account metadata. Secrets stay in the host credential service. */
export type GoAccount = {
    id: string;
    name: string;
    apiKeyEnv: string;
};
export declare const MAX_ACCOUNTS = 20;
/**
 * Upper bound for one configured thinking budget, in tokens. Shared with the
 * browser form so a stored value always fits a model's advertised ceiling while
 * staying far below any tokenizer/timer limit.
 */
export declare const MAX_THINKING_BUDGET_TOKENS = 1000000;
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
/** Promote one account while preserving every other account's relative order. */
export declare function moveAccountFirst(accounts: readonly GoAccount[], ref: string): readonly GoAccount[];
/** Read legacy selections as the first account until the host persists their order. */
export declare function accountsOf(settings: AccountSettings): readonly GoAccount[];
export declare function assertAccounts(accounts: readonly GoAccount[] | null | undefined, selectedRef?: string): void;
/** Safe UI notice for a successful request using a fallback account. */
export interface GoAccountSwitch {
    fromRef: string;
    toRef: string;
    reason: 'quota' | 'credential';
    at: number;
}
export declare const SETTINGS_NAMESPACE = "llm-opencode-go";
/**
 * Loader profile entry id this plugin ships in `cordis.patch.yml`.
 *
 * DSH settings addresses rows by Loader profile entry id: `SettingsDescriptor.ns`
 * is `entry.options.id` in `@deepseek-ai/dsh-settings`, so this is NOT an
 * intrinsic plugin namespace — it must match the `insert[].id` of the shipped
 * profile patch. Renaming that patch id requires renaming this constant.
 *
 * A runtime fallback discovery is intentionally not attempted:
 * `settings.describe()` exposes no plugin identity (`ns` is the entry id and
 * `schema` is a per-mount uid/ref graph), so a heuristic match could bind
 * account metadata to another plugin's row. The shipped patch id is the
 * invariant; a renamed entry id is unsupported and fails loudly through the
 * account manager ("Account settings are unavailable") instead of guessing.
 */
export declare const PROFILE_ENTRY_ID = "opencode-go";
/**
 * One model's configured capacities. Every field is optional so a deployment
 * can override only the value it needs. Null explicitly selects the catalog
 * value even when a lower profile/settings layer supplies an override.
 */
export interface OpencodeGoModelLimit {
    /** Context window in tokens, overriding what the catalog advertised. */
    contextWindow?: number | null;
    /** Output cap per request, overriding what the catalog advertised. */
    maxTokens?: number | null;
    /** Additional selectable thinking budgets, in tokens; null keeps the standard presets. */
    thinkingBudgets?: number[] | null;
}
/** Per-model capacities; a null entry selects both original catalog values. */
export type OpencodeGoModelLimits = Record<string, OpencodeGoModelLimit | null>;
/** Runtime configuration for one plugin mount. */
export interface OpencodeGoConfig {
    /**
     * Master switch for both routes. False withdraws Go and Free and their models
     * without unloading the settings page. Go additionally requires a usable
     * configured key; Free additionally requires {@link freeEnabled}.
     */
    enabled: boolean;
    /**
     * Serve the Free provider, its models and its public access. Off by default:
     * enabling it sends requests as the official OpenCode CLI user agent and may
     * violate upstream terms or trigger rate limiting, so it is an explicit
     * opt-in independent of {@link enabled}. While off, the Free route is not
     * registered, its catalog is not fetched and its models are not discovered.
     */
    freeEnabled: boolean;
    /** Usage pill visibility; auto follows only the selected Go route. */
    usageDisplay: UsageDisplayMode;
    /** Show quota in the sidebar independently of the selected conversation model. */
    showSidebarQuota: boolean;
    /** Appearance of the conversation input's quota trigger. */
    usagePillStyle: UsagePillStyle;
    /** Per-model picker switches; absent entries default to enabled unless deprecated. */
    modelVisibility?: Record<string, boolean>;
    /** Legacy credential reference, kept in sync with the first/current account. */
    apiKeyEnv: string;
    /** The first account is current; subsequent accounts are tried in order. */
    accounts?: GoAccount[] | null;
    /** Try other saved accounts on quota/credential rejection before any content is emitted. */
    autoSwitch?: boolean;
    /** Discovery/usage base; the official Go gateway selects inference endpoints by protocol. */
    baseURL: string;
    /** Platform discovery base; only explicitly free chat models are served. */
    freeBaseURL: string;
    /** Optional HTTP(S) or SOCKS5 proxy; blank uses the default network transport. */
    proxyURL: string;
    /** Request/picker cache lifetime in minutes; explicit discovery bypasses it. */
    refreshMinutes: number;
    /** Largest idle gap between stream events before the request fails. */
    streamIdleTimeoutMs: number;
    /** Bound discovery and each attempt's credential/image preparation. */
    requestPreparationTimeoutMs?: number;
    /** Whole dispatch deadline, including discovery and account fallback. */
    requestTimeoutMs?: number;
    /** Optional retained image occurrence cap per request; omission or null leaves the count unlimited. */
    maxImages?: number | null;
    /** Request-level bound on base64-encoded image payload, in bytes. */
    maxRequestImageBytes: number;
    /** Total-pixel budget for one request image. */
    requestImagePixelBudget: number;
    /** Raw encoded-byte target for one request image before base64 expansion. */
    requestImageMaxBytes: number;
    /** Per-model capacity overrides; an absent field inherits the catalog value. */
    modelLimits: OpencodeGoModelLimits;
}
/** Settings snapshots may omit fields inherited from their base layer. */
export type OpencodeGoSettings = Partial<OpencodeGoConfig>;
export interface GoModel {
    id: string;
    source?: ModelSource;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
    /** Token budget controls available to this model, including their catalog bounds. */
    reasoningBudget?: ThinkingBudgetRange;
    deprecated?: boolean;
    releaseDate?: string;
    /** Input modalities the gateway declares, in {@link INPUT_MODALITIES} order. */
    inputModalities?: readonly InputModality[];
    /** Advertised by the gateway but lacking a usable protocol and capability configuration. */
    configurationMissing?: boolean;
}
export interface ThinkingBudgetRange {
    min: number;
    max: number;
}
/**
 * Input modalities this page can name; MIME types are normalized to these tokens.
 */
export declare const INPUT_MODALITIES: readonly ["text", "image", "audio", "video", "pdf"];
export type InputModality = typeof INPUT_MODALITIES[number];
/**
 * Normalize one `modalities.input` array into display order.
 * @param value - the raw gateway declaration or Host response.
 * @returns the declared modalities in {@link INPUT_MODALITIES} order, or
 *   `undefined` when nothing recognizable was declared.
 */
export declare function normalizeInputModalities(value: unknown): readonly InputModality[] | undefined;
/** Last successful check of one catalog source, plus any current refresh failure. */
export interface GoCatalogSourceStatus {
    readonly updatedAt?: number;
    readonly error?: string;
    readonly warning?: string;
}
/** A failed refresh retains the Host's usable data with an explicit diagnostic. */
export interface GoModelCatalog {
    readonly models: readonly GoModel[];
    readonly stale: boolean;
    readonly error?: string;
    /** Optional for clients reading an older Host response. Timestamps are Unix milliseconds. */
    readonly sources?: {
        readonly go: GoCatalogSourceStatus;
        readonly free: GoCatalogSourceStatus;
    };
}
/** Missing configuration cannot be enabled; configured models follow explicit switches or lifecycle defaults. */
export declare function isModelEnabled(model: Pick<GoModel, 'id' | 'source' | 'deprecated' | 'configurationMissing'>, modelVisibility?: Readonly<Record<string, boolean>>): boolean;
export declare function validReleaseDate(value: unknown): value is string;
/** Calendar dates are supplied without a timezone; compare UTC dates consistently. */
export declare function isNewModel(model: GoModel, now?: number): boolean;
export declare function sortModels(models: readonly GoModel[], now?: number): GoModel[];
export declare function parseGoModels(value: unknown): GoModel[];
export declare function parseGoModelCatalog(value: unknown): GoModelCatalog;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        opencodeGoModels: {
            read(): Promise<RemoteResult<GoModelCatalog>>;
        };
    }
}
export declare const modelsRemote: TypertRemoteContribution;
export interface UsageWindow {
    status: 'ok' | 'rate-limited';
    percent: number;
    resetsAt: string;
}
export interface GoUsage {
    /** Opaque Host identity for this endpoint/account; never a credential or its hash. */
    source?: string;
    lastSwitch?: GoAccountSwitch;
    rolling: UsageWindow;
    weekly: UsageWindow;
    monthly: UsageWindow;
}
export declare function parseAccountSwitch(value: unknown): GoAccountSwitch;
/** Reject missing statistics rather than turning unavailable data into zero. */
export declare function parseGoUsage(value: unknown): GoUsage;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'opencode-go/usage-unavailable': {
            readonly retryable: boolean;
            readonly retainPrevious: boolean;
            readonly source?: string;
            readonly lastSwitch?: GoAccountSwitch;
        };
    }
    interface TypertRemoteNamespaceMap {
        opencodeGoUsage: {
            read(): Promise<RemoteResult<GoUsage>>;
            readAccount(ref: string): Promise<RemoteResult<GoUsage>>;
        };
    }
}
export declare const usageRemote: TypertRemoteContribution;
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
export type SettingsWriteResult = 'applied' | 'rejected' | 'unknown';
export type AnalyticsRange = 'today' | '7d' | '30d' | '90d';
export interface AnalyticsQuery {
    accountRef: string;
    range: AnalyticsRange;
    refresh?: boolean;
}
/** Exact nonnegative integers on the wire; one USD is 100,000,000 micro cents. */
export interface AnalyticsTotals {
    requests: string;
    inputTokens: string;
    outputTokens: string;
    cacheReadTokens: string;
    cacheWrite5mTokens: string;
    cacheWrite1hTokens: string;
    cacheWriteTokens: string;
    tokens: string;
    costMicroCents: string;
}
export interface AnalyticsModelRow extends AnalyticsTotals {
    provider: string;
    model: string;
}
export interface AnalyticsDayRow extends AnalyticsTotals {
    day: string;
}
export interface AnalyticsReport {
    accountRef: string;
    /** Opaque account, credential and network identity; contains no credential material. */
    source: string;
    generatedAt: number;
    period: AnalyticsRange;
    range: {
        from: number;
        to: number;
    };
    timeZone: 'UTC';
    totals: AnalyticsTotals;
    byModel: AnalyticsModelRow[];
    byDay: AnalyticsDayRow[];
}
export interface AnalyticsExport {
    filename: string;
    csv: string;
}
export type AnalyticsFailureReason = 'invalid-query' | 'unknown-account' | 'missing-credential' | 'credential-unavailable' | 'unsupported-gateway' | 'invalid-proxy' | 'permission-denied' | 'upstream' | 'network' | 'timeout' | 'invalid-response';
/**
 * Validate one account-scoped official history query.
 * @param value - raw RPC argument.
 * @returns the validated query.
 */
export declare function parseAnalyticsQuery(value: unknown): AnalyticsQuery;
/** Keep the browser wire response limited to validated aggregate fields. */
export declare function parseAnalyticsReport(value: unknown): AnalyticsReport;
export declare function parseAnalyticsExport(value: unknown): AnalyticsExport;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'opencode-go/analytics-unavailable': {
            readonly reason: AnalyticsFailureReason;
            readonly retryable: boolean;
            readonly retainPrevious?: boolean;
            readonly source?: string;
        };
    }
    interface TypertRemoteNamespaceMap {
        opencodeGoAnalytics: {
            read(query: AnalyticsQuery, signal?: AbortSignal): Promise<RemoteResult<AnalyticsReport>>;
            exportCsv(query: AnalyticsQuery, signal?: AbortSignal): Promise<RemoteResult<AnalyticsExport>>;
        };
    }
}
/** The dashboard endpoint, mounted with the other plugin remotes. */
export declare const analyticsRemote: TypertRemoteContribution;
/** A registry owns one contribution per package; mount all plugin endpoints together. */
export declare const goRemote: TypertRemoteContribution;
/** Default image budgets, overridable through the adapter configuration. */
export declare const DEFAULT_MAX_REQUEST_IMAGE_BYTES: number;
export declare const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET: number;
export declare const DEFAULT_REQUEST_IMAGE_MAX_BYTES: number;
