import Anthropic from '@anthropic-ai/sdk';
import { ResponseCreateParamsStreaming } from 'openai/resources/responses/responses.js';
import OpenAI from 'openai';
import { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';

interface InstrumentOptions {
    description?: string;
    unit?: string;
}
interface HistogramOptions extends InstrumentOptions {
    /** Bucket hints; callers supply finite, strictly increasing values. */
    boundaries?: readonly number[];
}
interface TelemetryCounter {
    add(value: number, attributes?: SpanAttributes): void;
}
interface TelemetryUpDownCounter {
    add(value: number, attributes?: SpanAttributes): void;
}
interface TelemetryHistogram {
    record(value: number, attributes?: SpanAttributes, context?: TelemetryContext): void;
}
/**
 * Optional adapter capability with synchronous factories and recording methods.
 * Typed inputs are trusted; callers supply finite measurements and nonnegative counter increments.
 * Malformed input behavior is unspecified.
 */
interface TelemetryMetrics {
    counter(name: string, options?: InstrumentOptions): TelemetryCounter;
    upDownCounter(name: string, options?: InstrumentOptions): TelemetryUpDownCounter;
    histogram(name: string, options?: HistogramOptions): TelemetryHistogram;
}

type AttributeValue = string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];
interface SpanAttributes {
    [name: string]: AttributeValue | undefined;
}
/** Opaque, JSON-serializable adapter-owned propagation data. */
type TelemetryCarrier = Record<string, string>;
/** Optional transport capability implemented by the application's telemetry adapter. */
interface TelemetryPropagation {
    inject(context: TelemetryContext): TelemetryCarrier | undefined;
    /** Absent or unknown carriers use the root; recognized identifiers are opaque strings. */
    extract(carrier: TelemetryCarrier | undefined): TelemetryContext;
}
interface SpanLink {
    context: TelemetryContext;
    attributes?: SpanAttributes;
}
interface SpanOptions {
    name: string;
    attributes?: SpanAttributes;
    links?: readonly SpanLink[];
}
type SpanStatus = {
    status: "ok";
} | {
    status: "error";
    error?: {
        name: string;
        message: string;
    };
};
/** Adapter contract for trusted typed inputs; malformed input behavior is unspecified. */
interface TelemetryContext {
    /** Adapter capabilities remain available on child spans and extracted parents. */
    readonly metrics?: TelemetryMetrics;
    readonly propagation?: TelemetryPropagation;
    startSpan<T>(options: SpanOptions, callback: (span: TelemetrySpan) => T | Promise<T>): Promise<T>;
}
interface TelemetrySpan extends TelemetryContext {
    addLink(link: SpanLink): void;
    addEvent(name: string, attributes?: SpanAttributes): void;
    setAttributes(attributes: SpanAttributes): void;
    setStatus(status: SpanStatus): void;
}

/** Azure models ship without a baseUrl: one resource per user, resolved per request. */
interface AzureEndpointOptions extends StreamOptions {
    azureApiVersion?: string;
    azureResourceName?: string;
    azureBaseUrl?: string;
    azureDeploymentName?: string;
}

interface AzureOpenAIResponsesOptions extends AzureEndpointOptions {
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    toolChoice?: ResponseCreateParamsStreaming["tool_choice"];
    reasoningSummary?: "auto" | "detailed" | "concise" | null;
}

type BedrockThinkingDisplay = "summarized" | "omitted";
interface BedrockOptions extends StreamOptions {
    region?: string;
    profile?: string;
    toolChoice?: "auto" | "any" | "none" | {
        type: "tool";
        name: string;
    };
    reasoning?: ThinkingLevel;
    thinkingBudgets?: ThinkingBudgets;
    interleavedThinking?: boolean;
    /**
     * Controls how Claude's thinking content is returned in responses.
     * - "summarized": Thinking blocks contain summarized thinking text (default here).
     * - "omitted": Thinking content is redacted but the signature still travels back
     *   for multi-turn continuity, reducing time-to-first-text-token.
     *
     * Note: Anthropic's API default for Claude Opus 4.8 and Mythos Preview is
     * "omitted". We default to "summarized" here to keep behavior consistent with
     * older Claude 4 models. Only applies to Claude models on Bedrock.
     */
    thinkingDisplay?: BedrockThinkingDisplay;
    /** Key-value pairs attached to the inference request for cost allocation tagging.
     * Keys: max 64 chars, no `aws:` prefix. Values: max 256 chars. Max 50 pairs.
     * Tags appear in AWS Cost Explorer split cost allocation data.
     * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html */
    requestMetadata?: Record<string, string>;
    /** Bearer token for Bedrock API key authentication.
     * When set, bypasses SigV4 signing and sends Authorization: Bearer <token> instead.
     * Requires `bedrock:CallWithBearerToken` IAM permission on the token's identity.
     * Set via AWS_BEARER_TOKEN_BEDROCK env var or pass directly.
     * @see https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonbedrock.html */
    bearerToken?: string;
}

/**
 * Shared utilities for Google Generative AI and Google Vertex providers.
 */

/**
 * Thinking level for Gemini 3 models.
 * Mirrors Google's ThinkingLevel enum values.
 */
type GoogleApiThinkingLevel = "THINKING_LEVEL_UNSPECIFIED" | "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

interface GoogleOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any";
    thinking?: {
        enabled: boolean;
        budgetTokens?: number;
        level?: GoogleApiThinkingLevel;
    };
}

interface GoogleVertexOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any";
    thinking?: {
        enabled: boolean;
        budgetTokens?: number;
        level?: GoogleApiThinkingLevel;
    };
    project?: string;
    location?: string;
}

/**
 * Provider-specific options for the Mistral API.
 */
type MistralReasoningEffort = "none" | "low" | "medium" | "high" | "max";
interface MistralOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    promptMode?: "reasoning";
    reasoningEffort?: MistralReasoningEffort;
}

interface OpenAICodexResponsesOptions extends StreamOptions {
    reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    reasoningSummary?: "auto" | "concise" | "detailed" | "off" | "on" | null;
    serviceTier?: ResponseCreateParamsStreaming["service_tier"];
    textVerbosity?: "low" | "medium" | "high";
    toolChoice?: "auto" | "none" | "required";
}

interface OpenAICompletionsOptions extends StreamOptions {
    toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    /** Token budgets per thinking level. Used when `compat.thinkingTokenBudgetField` or `compat.supportsThinkingTokenBudget` is set, or by `{ "$var": "thinking.budget" }`. */
    thinkingBudgets?: ThinkingBudgets;
}

interface OpenAIResponsesOptions extends StreamOptions {
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    reasoningSummary?: "auto" | "detailed" | "concise" | null;
    serviceTier?: ResponseCreateParamsStreaming["service_tier"];
    toolChoice?: ResponseCreateParamsStreaming["tool_choice"];
}

/**
 * pi-messages API implementation.
 *
 * Streams pi's own message protocol directly to a backend: the request is a
 * single POST of `{ model, context, options }` to `<baseUrl>/messages`, the
 * response is an SSE stream of serialized assistant-message events plus a
 * terminal `done`/`error` event. This is the wire protocol spoken by the
 * Radius gateway, but any backend implementing it can be used, e.g. via a
 * models.json custom provider with `"api": "pi-messages"`.
 */

interface PiMessagesOptions extends StreamOptions {
    reasoning?: ThinkingLevel;
    toolChoice?: "auto" | "none" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    /** Ask the backend for debug metadata (e.g. routing response headers). */
    debug?: boolean;
}

/** The value type of a TypeBox schema type by its `'~kind'`, or its `Type.Unsafe` type; `unknown` for other kinds. */
type TypeBoxStatic<S> = S extends {
    readonly "~kind": infer K;
} ? KindStatic<S, K> : S extends {
    readonly "~unsafe": infer T;
} ? T : unknown;
interface Primitives {
    String: string;
    Number: number;
    Integer: number;
    Boolean: boolean;
    Null: null;
    Unknown: unknown;
    Any: any;
}
type KindStatic<S, K> = K extends keyof Primitives ? Primitives[K] : K extends "Literal" ? S extends {
    readonly const: infer V;
} ? V : unknown : K extends "Array" ? S extends {
    readonly items: infer I;
} ? Static<I>[] : unknown : K extends "Object" ? S extends {
    readonly properties: infer P;
} ? ObjectStatic<P> : unknown : K extends "Union" ? S extends {
    readonly anyOf: readonly (infer B)[];
} ? Static<B> : unknown : K extends "Record" ? S extends {
    readonly patternProperties: infer P;
} ? Record<RecordKey<keyof P>, Static<P[keyof P]>> : unknown : unknown;
type Optional = {
    readonly "~optional": true;
};
type Readonly$1 = {
    readonly "~readonly": true;
};
type ObjectStatic<P> = keyof P extends never ? object : Simplify<{
    -readonly [K in keyof P as P[K] extends Optional | Readonly$1 ? never : K]: Static<P[K]>;
} & {
    -readonly [K in keyof P as P[K] extends Optional ? (P[K] extends Readonly$1 ? never : K) : never]?: Static<P[K]>;
} & {
    readonly [K in keyof P as P[K] extends Readonly$1 ? (P[K] extends Optional ? never : K) : never]: Static<P[K]>;
} & {
    readonly [K in keyof P as P[K] extends Optional ? (P[K] extends Readonly$1 ? K : never) : never]?: Static<P[K]>;
}>;
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};
type RecordKey<Pattern> = Pattern extends "^-?(?:0|[1-9][0-9]*)$" | "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" ? number : string;

declare const STATIC: unique symbol;
/** A JSON Schema object whose valid values have type `T` (a type-level brand; nothing extra exists at run time). */
type Schema<T = unknown> = {
    readonly [keyword: string]: unknown;
} & {
    readonly [STATIC]?: T;
};
/**
 * The type of the values `S` accepts: the type a builder recorded; for a TypeBox schema (`'~kind'` or `'~unsafe'`),
 * TypeBox's static type for the common kinds (see `TypeBoxStatic`); else `unknown`.
 */
type Static<S> = S extends {
    readonly "~kind": unknown;
} | {
    readonly "~unsafe": unknown;
} ? TypeBoxStatic<S> : S extends {
    readonly [STATIC]?: infer T;
} ? unknown extends T ? unknown : T : unknown;

declare const OpenAICompletionsCompatSchema: Schema<{
    supportsStore?: boolean | undefined;
    supportsDeveloperRole?: boolean | undefined;
    supportsReasoningEffort?: boolean | undefined;
    supportsUsageInStreaming?: boolean | undefined;
    supportsFinishReason?: boolean | undefined;
    maxTokensField?: "max_completion_tokens" | "max_tokens" | undefined;
    requiresToolResultName?: boolean | undefined;
    requiresAssistantAfterToolResult?: boolean | undefined;
    requiresThinkingAsText?: boolean | undefined;
    requiresReasoningContentOnAssistantMessages?: boolean | undefined;
    thinkingFormat?: "ant-ling" | "baseten" | "chat-template" | "deepseek" | "openai" | "openrouter" | "qwen" | "qwen-chat-template" | "string-thinking" | "together" | "zai" | undefined;
    chatTemplateKwargs?: Record<string, string | number | boolean | {
        $var: "thinking.budget" | "thinking.effort" | "thinking.enabled";
        omitWhenOff?: boolean | undefined;
    } | null> | undefined;
    chatTemplateArgs?: Record<string, string | number | boolean | {
        $var: "thinking.budget" | "thinking.effort" | "thinking.enabled";
        omitWhenOff?: boolean | undefined;
    } | null> | undefined;
    openRouterRouting?: {
        allow_fallbacks?: boolean | undefined;
        require_parameters?: boolean | undefined;
        data_collection?: "allow" | "deny" | undefined;
        zdr?: boolean | undefined;
        enforce_distillable_text?: boolean | undefined;
        order?: string[] | undefined;
        only?: string[] | undefined;
        ignore?: string[] | undefined;
        quantizations?: string[] | undefined;
        sort?: string | {
            by?: string | undefined;
            partition?: string | null | undefined;
        } | undefined;
        max_price?: {
            prompt?: string | number | undefined;
            completion?: string | number | undefined;
            image?: string | number | undefined;
            audio?: string | number | undefined;
            request?: string | number | undefined;
        } | undefined;
        preferred_min_throughput?: number | {
            p50?: number | undefined;
            p75?: number | undefined;
            p90?: number | undefined;
            p99?: number | undefined;
        } | undefined;
        preferred_max_latency?: number | {
            p50?: number | undefined;
            p75?: number | undefined;
            p90?: number | undefined;
            p99?: number | undefined;
        } | undefined;
    } | undefined;
    vercelGatewayRouting?: {
        only?: string[] | undefined;
        order?: string[] | undefined;
    } | undefined;
    zaiToolStream?: boolean | undefined;
    thinkingTokenBudgetField?: "thinking_budget" | "thinking_budget_tokens" | "thinking_token_budget" | undefined;
    supportsThinkingTokenBudget?: boolean | undefined;
    supportsOpenAIGrammarTools?: boolean | undefined;
    supportsMidConvoSystemMessages?: boolean | undefined;
    supportsMidConvoToolAdditions?: boolean | undefined;
    supportsStrictMode?: boolean | undefined;
    cacheControlFormat?: "anthropic" | undefined;
    sendSessionAffinityHeaders?: boolean | undefined;
    sessionAffinityFormat?: "openai" | "openai-nosession" | "openrouter" | undefined;
    supportsLongCacheRetention?: boolean | undefined;
    vllmPriority?: number | undefined;
}>;
declare const OpenAIResponsesCompatSchema: Schema<{
    supportsDeveloperRole?: boolean | undefined;
    supportsMidConvoSystemMessages?: boolean | undefined;
    sessionAffinityFormat?: "openai" | "openai-nosession" | "openrouter" | undefined;
    supportsLongCacheRetention?: boolean | undefined;
    supportsStrictMode?: boolean | undefined;
    supportsOpenAIGrammarTools?: boolean | undefined;
    supportsAdditionalTools?: boolean | undefined;
    supportsToolSearch?: boolean | undefined;
    supportsExplicitPromptCacheMode?: boolean | undefined;
    supportsMidConvoEffort?: boolean | undefined;
    supportsMaxOutputTokens?: boolean | undefined;
}>;
declare const AnthropicMessagesCompatSchema: Schema<{
    supportsEagerToolInputStreaming?: boolean | undefined;
    supportsLongCacheRetention?: boolean | undefined;
    sendSessionAffinityHeaders?: boolean | undefined;
    sessionAffinityFormat?: "openrouter" | undefined;
    supportsCacheControlOnTools?: boolean | undefined;
    supportsTemperature?: boolean | undefined;
    forceAdaptiveThinking?: boolean | undefined;
    allowEmptySignature?: boolean | undefined;
    supportsStrictTools?: boolean | undefined;
    supportsMidConvoEffort?: boolean | undefined;
    supportsMidConvoSystemMessages?: boolean | undefined;
    supportsMidConvoToolChanges?: boolean | undefined;
    allowedFallbackModels?: {
        provider: string;
        model: string;
        cost: {
            input: number;
            output: number;
            cacheRead: number;
            cacheWrite: number;
            tiers?: {
                input: number;
                output: number;
                cacheRead: number;
                cacheWrite: number;
                inputTokensAbove: number;
            }[] | undefined;
        };
    }[] | undefined;
}>;
declare const BedrockCompatSchema: Schema<{
    supportsStrictMode?: boolean | undefined;
}>;
declare const MistralConversationsCompatSchema: Schema<{
    supportsMidConvoSystemMessages?: boolean | undefined;
}>;
declare const SystemOneCompatSchema: Schema<{
    imageInput?: "assets" | "images" | "state-image-urls" | undefined;
    sendImageOptInHeader?: boolean | undefined;
}>;
/** Compatibility settings for OpenAI-compatible completions APIs. */
interface OpenAICompletionsCompat extends Static<typeof OpenAICompletionsCompatSchema> {
}
/** Compatibility settings for OpenAI Responses APIs. */
interface OpenAIResponsesCompat extends Static<typeof OpenAIResponsesCompatSchema> {
}
/** Compatibility settings for Anthropic Messages-compatible APIs. */
interface AnthropicMessagesCompat extends Static<typeof AnthropicMessagesCompatSchema> {
}
/** Compatibility settings for Amazon Bedrock models. */
interface BedrockCompat extends Static<typeof BedrockCompatSchema> {
}
/** Compatibility settings for the Mistral chat API. */
interface MistralConversationsCompat extends Static<typeof MistralConversationsCompatSchema> {
}
/** Compatibility settings for System One classifier APIs. */
interface SystemOneCompat extends Static<typeof SystemOneCompatSchema> {
}

declare const ThinkingLevelSchema: Schema<"high" | "low" | "max" | "medium" | "minimal" | "xhigh">;
declare const ModelThinkingLevelSchema: Schema<"high" | "low" | "max" | "medium" | "minimal" | "off" | "xhigh">;
declare const ModelInputModalitySchema: Schema<"image" | "text">;
declare const CacheRetentionSchema: Schema<"long" | "none" | "short">;
declare const ThinkingLevelMapSchema: Schema<{
    off?: string | null | undefined;
    minimal?: string | null | undefined;
    low?: string | null | undefined;
    medium?: string | null | undefined;
    high?: string | null | undefined;
    xhigh?: string | null | undefined;
    max?: string | null | undefined;
}>;
declare const ModelPromptCacheSchema: Schema<{
    short?: number | undefined;
    long?: number | undefined;
}>;
declare const ModelCostSchema: Schema<{
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    tiers?: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        inputTokensAbove: number;
    }[] | undefined;
}>;
declare const ModelInputLimitsSchema: Schema<{
    maxRequestBytes?: number | undefined;
    images?: {
        resize?: {
            maxWidth?: number | undefined;
            maxHeight?: number | undefined;
            maxBytes?: number | undefined;
            jpegQuality?: number | undefined;
        } | undefined;
        maxPerMessage?: number | undefined;
        maxPerRequest?: number | undefined;
    } | undefined;
}>;
type ThinkingLevel = Static<typeof ThinkingLevelSchema>;
type ModelThinkingLevel = Static<typeof ModelThinkingLevelSchema>;
type ThinkingLevelMap = Static<typeof ThinkingLevelMapSchema>;
type ModelInputModality = Static<typeof ModelInputModalitySchema>;
type CacheRetention = Static<typeof CacheRetentionSchema>;
type ModelPromptCache = Static<typeof ModelPromptCacheSchema>;
type ModelCost = Static<typeof ModelCostSchema>;
type ModelInputLimits = Static<typeof ModelInputLimitsSchema>;

interface DiagnosticErrorInfo {
    name?: string;
    message: string;
    stack?: string;
    code?: string | number;
}
interface AssistantMessageDiagnostic {
    type: string;
    timestamp: number;
    error?: DiagnosticErrorInfo;
    details?: JsonObject;
}

declare class EventStream<T, R = T> implements AsyncIterable<T> {
    private queue;
    private waiting;
    protected done: boolean;
    private finalResultPromise;
    private resolveFinalResult;
    private isComplete;
    private extractResult;
    constructor(isComplete: (event: T) => boolean, extractResult: (event: T) => R);
    push(event: T): void;
    end(result?: R): void;
    [Symbol.asyncIterator](): AsyncIterator<T>;
    result(): Promise<R>;
}
/**
 * Event stream of one assistant response. It also times the response: the final message (`done` or `error` event, or
 * the result passed to `end()`) gets `durationMs`, measured with a monotonic clock from the stream's creation, unless
 * the message already has one or its `timestamp` predates the stream. A stream that forwards a response which started
 * elsewhere, such as a deferred result fetched later, therefore leaves it untimed.
 */
declare class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
    #private;
    constructor();
    push(event: AssistantMessageEvent): void;
    end(result?: AssistantMessage): void;
}

/**
 * Request auth for a single model request. If a value cannot be expressed as
 * `apiKey`, `headers`, or `baseUrl`, it is provider config, not auth.
 */
interface ModelAuth {
    apiKey?: string;
    headers?: ProviderHeaders;
    baseUrl?: string;
}
/**
 * Stored api-key credential. `env` holds provider-scoped environment/config
 * values such as Cloudflare account/gateway ids.
 */
interface ApiKeyCredential {
    type: "api_key";
    key?: string;
    env?: ProviderEnv;
}
/** OAuth token data returned by extension compatibility flows. */
interface OAuthCredentials {
    refresh: string;
    access: string;
    expires: number;
    [key: string]: unknown;
}
/** Stored canonical OAuth credential. */
interface OAuthCredential extends OAuthCredentials {
    type: "oauth";
}
/** One type-tagged credential per provider — the shape of today's auth.json. */
type Credential = ApiKeyCredential | OAuthCredential;
/** Environment access for auth resolution. Injectable for tests and browsers. */
interface AuthContext {
    env(name: string): Promise<string | undefined>;
    /** Check whether a file exists. Supports a leading `~`. Always false in browsers. */
    fileExists(path: string): Promise<boolean>;
}
/** Result of resolving auth for a model. */
interface AuthResult {
    auth: ModelAuth;
    /** Provider-scoped environment/config values resolved from credentials and ambient context. */
    env?: ProviderEnv;
    /** Human-readable label for status UI: "ANTHROPIC_API_KEY", "OAuth", "~/.aws/credentials". */
    source?: string;
}
interface AuthCheck {
    source?: string;
    type: "api_key" | "oauth";
}
/**
 * Prompt shown to the user during login. `signal` lets the flow cancel a
 * pending prompt when an out-of-band event resolves the step, e.g. a
 * `manual_code` prompt raced against a callback server, aborted when the
 * callback wins.
 */
type AuthPrompt = {
    signal?: AbortSignal;
} & ({
    type: "text";
    message: string;
    placeholder?: string;
} | {
    type: "secret";
    message: string;
    placeholder?: string;
} | {
    type: "select";
    message: string;
    options: readonly {
        id: string;
        label: string;
        description?: string;
    }[];
} | {
    type: "manual_code";
    message: string;
    placeholder?: string;
});
interface AuthInfoLink {
    url: string;
    label?: string;
}
type AuthEvent = {
    type: "info";
    message: string;
    links?: readonly AuthInfoLink[];
} | {
    type: "auth_url";
    url: string;
    instructions?: string;
} | {
    type: "device_code";
    userCode: string;
    verificationUri: string;
    /** Offer best-effort browser opening on user confirmation. Defaults to true; clients may ignore it. */
    openBrowserOnConfirm?: boolean;
    /** Offer copying of userCode on user confirmation, replacing the clipboard. Defaults to true. */
    copyCodeOnConfirm?: boolean;
    intervalSeconds?: number;
    expiresInSeconds?: number;
} | {
    type: "progress";
    message: string;
};
/**
 * Login interaction callbacks serving both api-key and OAuth flows.
 *
 * `prompt()` returns the entered/selected string (`select` returns the option
 * id). Rejects on cancel/abort. `signal` aborts the whole login flow;
 * per-prompt cancellation uses `AuthPrompt.signal`.
 */
interface AuthInteraction {
    signal?: AbortSignal;
    prompt(prompt: AuthPrompt): Promise<string>;
    notify(event: AuthEvent): void;
}
/** Normalized interaction passed to provider login implementations. */
type ProviderAuthInteraction = AuthInteraction & {
    signal: AbortSignal;
};
/**
 * Api-key auth: stored key/provider env plus ambient sources (env vars, AWS
 * profiles, ADC files). Ambient-only providers omit `login`.
 */
interface ApiKeyAuth {
    /** Display name, e.g. "Anthropic API key". */
    name: string;
    /** Interactive setup (prompt for key/provider env). Absent = ambient-only. */
    login?(interaction: ProviderAuthInteraction): Promise<ApiKeyCredential>;
    /**
     * Optional side-effect-free availability check. Use this when `resolve()` may
     * execute commands or perform other request-time work. Missing means Models
     * checks availability by resolving auth.
     */
    check?(input: {
        ctx: AuthContext;
        credential?: ApiKeyCredential;
        signal: AbortSignal;
    }): Promise<AuthCheck | undefined>;
    /**
     * Resolve auth from the stored credential and/or ambient sources, merging
     * per field (`credential.key ?? env("...")`, `credential.env?.NAME ?? env("...")`).
     * undefined = not configured. Resolution is provider-scoped; model-specific
     * endpoint preparation happens after auth has been resolved.
     */
    resolve(input: {
        ctx: AuthContext;
        credential?: ApiKeyCredential;
        signal: AbortSignal;
    }): Promise<AuthResult | undefined>;
}
/** App-supplied context for `Models.login`. */
interface LoginOptions {
    /**
     * Returns the stable ID of this app installation, e.g. sent to OpenAI as its
     * agent host ID. Called only by login flows that need it, so apps can create
     * the ID on first use and must return the same ID on every later call.
     */
    getDeviceId?: () => string;
    /**
     * Name this app introduces itself with during login, e.g. OpenAI's agent name hint and
     * Codex originator. Defaults to pi's own name.
     */
    agentName?: string;
}
/**
 * OAuth auth. The `refresh`/`toAuth` split lets `Models` own the locked
 * refresh pattern: `refresh` produces a credential, `toAuth` derives request
 * auth from whatever credential ends up stored.
 */
interface OAuthAuth {
    /** Display name, e.g. "Anthropic (Claude Pro/Max)". */
    name: string;
    /** Whether access through this auth method is backed by a provider subscription. */
    isSubscription?: boolean;
    /** Selector label for the OAuth login option, e.g. "Sign in with SuperGrok or X Premium". */
    loginLabel?: string;
    login(interaction: ProviderAuthInteraction, options?: LoginOptions): Promise<OAuthCredential>;
    /**
     * Exchange the refresh token. Network call; throws on failure
     * (invalid_grant etc.). `Models` runs this under the store lock.
     */
    refresh(credential: OAuthCredential, signal: AbortSignal): Promise<OAuthCredential>;
    /**
     * Side-effect-free derivation of request auth from a valid credential.
     * Covers per-credential baseUrl (GitHub Copilot). Async so lazy wrappers
     * can load the implementation on first use.
     */
    toAuth(credential: OAuthCredential): Promise<ModelAuth>;
}
/**
 * Provider auth. At least one of `apiKey`/`oauth` must be present: even
 * ambient-credential providers and keyless local servers provide `apiKey`
 * auth whose `resolve()` reports whether the provider is configured.
 */
interface ProviderAuth {
    apiKey?: ApiKeyAuth;
    oauth?: OAuthAuth;
}

interface ModelsStoreEntry {
    /** Persisted models of every type. */
    models: readonly AnyModel[];
    /** Unix timestamp from the remote catalog's Last-Modified header. */
    lastModified?: number;
    /** Unix timestamp of the last completed remote check. */
    checkedAt?: number;
    /**
     * Opaque validator from the remote catalog's ETag header, stored verbatim
     * (quotes included) and echoed back as If-None-Match.
     */
    etag?: string;
}

interface ModelsPublication {
    /** Provider-selected persisted catalog. Omit to leave storage unchanged; null deletes it. */
    persist?: ModelsStoreEntry | null;
    /** Optional synchronous update of provider-private in-memory catalog state. */
    update?: () => void;
}
interface RefreshModelsContext {
    /** Effective configured credential. OAuth credentials are refreshed before network access. */
    credential?: Credential;
    /** Immutable provider-scoped catalog snapshot captured before this refresh phase. */
    stored?: Readonly<ModelsStoreEntry>;
    /**
     * Generation-checked publication. Persistence policy remains provider-owned;
     * the update runs synchronously only after the selected persistence mutation.
     */
    publish(publication: ModelsPublication): Promise<boolean>;
    /** False during offline/cache-only initialization. */
    allowNetwork: boolean;
    /** Bypass provider freshness checks and fetch immediately when network access is allowed. */
    force?: boolean;
    /** Always present, including when the public refresh caller omits its optional signal. */
    signal: AbortSignal;
    /**
     * Base URL of the registered provider, including configuration overrides that wrappers apply
     * outside the provider receiving this context.
     */
    baseUrl?: string;
}
/** Any model a provider with chat APIs `TApi` can list. */
type ProviderModel<TApi extends Api> = Model$1<TApi> | ImageModel<ImageApi> | ClassifierModel<ClassifierApi>;
/**
 * A provider is the concrete runtime unit. It owns id/name/base metadata,
 * auth methods, model listing, and the operations its models support
 * (streaming, image generation, classification).
 *
 * `TApi` lets concrete provider factories declare which chat APIs their models
 * use (e.g. `openaiProvider(): Provider<"openai-responses" | "openai-completions">`),
 * giving typed chat model lists to direct factory users. Other model types use
 * their operation-specific API unions. Inside a `Models` collection providers
 * are held as `Provider<Api>`.
 */
interface Provider<TApi extends Api = Api> {
    readonly id: string;
    readonly name: string;
    readonly baseUrl?: string;
    readonly headers?: ProviderHeaders;
    /**
     * Required: at least one of `apiKey`/`oauth`. Every provider has auth
     * semantics — even providers with only ambient credentials (env vars, AWS
     * profiles, ADC files) and keyless local servers provide `apiKey` auth
     * whose `resolve()` reports whether the provider is configured.
     * `Models.getAuth()` returns undefined when the provider is unconfigured.
     */
    readonly auth: ProviderAuth;
    /**
     * Current known chat models, sync. Static providers return their catalog;
     * dynamic providers return the list as of the last `refreshModels()` (empty
     * before the first). Must not throw; `Models` treats a throwing
     * implementation as having no models.
     */
    getModels(): readonly Model$1<TApi>[];
    /**
     * Current known models of every type, sync, with the same contract as
     * `getModels()`. Providers with only chat models may omit it; `Models` then
     * uses `getModels()`. Model ids are unique within each type; one upstream
     * model may have separate entries for different operations.
     */
    getAllModels?(): readonly ProviderModel<TApi>[];
    /**
     * Dynamic providers only: restore `context.stored` and optionally fetch a newer list using
     * the effective credential. Implementations retain their previous list on failure, publish
     * persistence and synchronous state changes through `context.publish()`, and honor the
     * shared abort signal for blocking work.
     */
    refreshModels?(context: RefreshModelsContext): Promise<void>;
    /**
     * Optional provider policy for credential-specific model availability.
     * `getModels()` remains the complete synchronous chat catalog; `Models.getAvailable()`
     * applies this filter after confirming that provider auth is configured.
     */
    filterModels?(models: readonly Model$1<TApi>[], credential: Credential | undefined): readonly Model$1<TApi>[];
    /**
     * Optional credential-specific availability policy across every model type.
     * Without it, `Models.getAllAvailable()` applies `filterModels` to chat models
     * and keeps every other model.
     */
    filterAllModels?(models: readonly ProviderModel<TApi>[], credential: Credential | undefined): readonly ProviderModel<TApi>[];
    /** Stream a normalized transcript. `Models` normalizes the caller's `Context` before dispatching here. */
    stream<T extends TApi>(model: Model$1<T>, context: TranscriptContext, options?: ApiStreamOptions<T>): AssistantMessageEventStream;
    streamSimple(model: Model$1<TApi>, context: TranscriptContext, options?: SimpleStreamOptions): AssistantMessageEventStream;
    fetchDeferred?(model: Model$1<TApi>, handle: DeferredHandle, options?: DeferredFetchOptions): AssistantMessageEventStream;
    cancelDeferred?(model: Model$1<TApi>, handle: DeferredHandle, options?: DeferredCancelOptions): Promise<void>;
    /** Present when the provider supports dedicated image models. Never rejects. */
    generateImages?(model: ImageModel<ImageApi>, context: ImagesContext, options?: ImagesOptions): Promise<AssistantImages>;
    /** Present when the provider supports structured classifier models. Never rejects. */
    classify?(model: ClassifierModel<ClassifierApi>, context: ClassifierContext, options?: ClassifierOptions): Promise<ClassifierResult>;
}

/**
 * The `User-Agent` sent to providers:
 * - `"detailed"`: `pi/<version> (<platform>; <runtime>/<runtime version>; <arch>)`, or `pi/<version> (browser)`
 *   outside Node.js and Bun.
 * - `"short"`: `pi`.
 * - `{ custom }`: the given value.
 */
type UserAgentMode = "short" | "detailed" | {
    custom: string;
};
/** Who requests are attributed to. `getAttributionHeaders()` maps the fields to each provider's headers. */
interface ClientAttribution {
    /** App name: OpenRouter app title, NVIDIA invoke origin (first letter upper-cased), OpenCode client. */
    name: string;
    /** App URL: OpenRouter `HTTP-Referer`, the app's identity in OpenRouter's rankings, grouped by origin. */
    url: string;
    /** App categories, e.g. `["cli-agent"]`: OpenRouter `X-OpenRouter-Categories`, comma-separated. */
    categories?: string[];
}
/**
 * How pi-ai identifies the calling app to providers. Every field is optional; absent fields use pi-ai's defaults:
 * a detailed `User-Agent` with pi-ai's version and no attribution headers. Plain JSON, so it can be persisted.
 */
interface ClientIdentity {
    /** Default: `"detailed"`. */
    userAgent?: UserAgentMode;
    /** Provider attribution headers. Absent or `null`: none; `null` also turns off attribution set by a merged identity. */
    attribution?: ClientAttribution | null;
    /** Version in the detailed `User-Agent`. Default: the pi-ai version. */
    version?: string;
}

type KnownApi = "openai-completions" | "mistral-conversations" | "openai-responses" | "azure-openai-responses" | "openai-codex-responses" | "anthropic-messages" | "bedrock-converse-stream" | "google-generative-ai" | "google-vertex" | "pi-messages";
type Api = KnownApi | (string & {});
type KnownImageApi = "openrouter-images";
type ImageApi = KnownImageApi | (string & {});
type KnownClassifierApi = "typesafe-system-one" | "cloudflare-workers-ai-system-one" | "llama-cpp-classify" | "openai-decisions";
type ClassifierApi = KnownClassifierApi | (string & {});
type KnownProvider = "amazon-bedrock" | "ant-ling" | "anthropic" | "google" | "google-vertex" | "openai" | "azure" | "openai-codex" | "radius" | "typesafe" | "nvidia" | "deepseek" | "github-copilot" | "xai" | "groq" | "cerebras" | "openrouter" | "vercel-ai-gateway" | "zai" | "zai-coding-cn" | "mistral" | "minimax" | "minimax-cn" | "moonshotai" | "moonshotai-cn" | "huggingface" | "fireworks" | "together" | "baseten" | "opencode" | "opencode-go" | "kimi-coding" | "meta" | "cloudflare-workers-ai" | "cloudflare-ai-gateway" | "qwen-token-plan" | "qwen-token-plan-cn" | "qwen-token-plan-individual" | "xiaomi" | "xiaomi-token-plan-cn" | "xiaomi-token-plan-ams" | "xiaomi-token-plan-sgp";
type ProviderId = KnownProvider | string;
type ToolChoice = "auto" | "none";
type SamplingParams = Record<string, unknown>;
type SamplingParamsByThinkingLevel = Partial<Record<ModelThinkingLevel, SamplingParams>>;
/** Token budgets for each thinking level (token-based providers only) */
interface ThinkingBudgets {
    minimal?: number;
    low?: number;
    medium?: number;
    high?: number;
}
type Transport = "sse" | "websocket" | "websocket-cached" | "auto";
/** Provider-scoped environment overrides. Values take precedence over process.env. */
type ProviderEnv = Record<string, string>;
type ProviderHeaders = Record<string, string | null>;
type FetchFunction = typeof globalThis.fetch;
interface ProviderResponse {
    status: number;
    headers: Record<string, string>;
}
/** Authentication, HTTP transport, and lifecycle callbacks shared by provider requests. */
interface ProviderRequestOptions<TModel = Model$1<Api>> {
    signal?: AbortSignal;
    /** Explicit parent span for telemetry produced by this logical request. */
    telemetry?: TelemetrySpan;
    apiKey?: string;
    /**
     * Optional fetch implementation for provider HTTP requests.
     * Defaults to `globalThis.fetch`. Provider adapters that cannot inject a custom implementation may reject it.
     * This does not affect WebSocket transports.
     */
    fetch?: FetchFunction;
    /**
     * Provider-scoped environment values. These take precedence over process.env for
     * provider configuration such as regional settings, endpoint placeholders, and
     * proxy variables.
     */
    env?: ProviderEnv;
    /**
     * Optional callback for inspecting or replacing provider payloads before sending.
     * Return undefined to keep the payload unchanged.
     */
    onPayload?: (payload: unknown, model: TModel) => unknown | undefined | Promise<unknown | undefined>;
    /**
     * Optional callback invoked after an HTTP response is received.
     */
    onResponse?: (response: ProviderResponse, model: TModel) => void | Promise<void>;
    /**
     * Optional custom HTTP headers to include in API requests.
     * Merged with provider defaults; caller values override default headers.
     * On AWS Bedrock these are injected via a Smithy `build`-step middleware so
     * they are covered by SigV4 signing; reserved headers (`x-amz-*`,
     * `authorization`, `host`) are silently ignored to preserve SigV4 / bearer auth.
     * A null value suppresses a provider/API default header with the same name.
     */
    headers?: ProviderHeaders;
    /**
     * How the request identifies the calling app: `User-Agent` and provider attribution headers.
     * Absent fields use pi-ai's defaults: a detailed `User-Agent` and no attribution.
     */
    identity?: ClientIdentity;
    /**
     * HTTP request timeout in milliseconds for providers/SDKs that support it.
     * For example, OpenAI and Anthropic SDK clients default to 10 minutes.
     */
    timeoutMs?: number;
    /**
     * Maximum retry attempts for providers/SDKs that support client-side retries.
     * For example, OpenAI and Anthropic SDK clients default to 2.
     */
    maxRetries?: number;
    /**
     * Maximum delay in milliseconds to wait for a retry when the server requests a long wait.
     * If the server's requested delay exceeds this value, the request fails immediately
     * with an error containing the requested delay, allowing higher-level retry logic
     * to handle it with user visibility.
     * Default: 60000 (60 seconds). Set to 0 to disable the cap.
     */
    maxRetryDelayMs?: number;
}
interface StreamOptions extends ProviderRequestOptions<Model$1<Api>> {
    /**
     * Optional callback invoked after an HTTP response is received and before
     * its body stream is consumed.
     */
    onResponse?: (response: ProviderResponse, model: Model$1<Api>) => void | Promise<void>;
    /**
     * Optional observer for each parsed provider stream event before Pi normalization.
     * Event data is adapter-owned and must be treated as read-only.
     * Adapter support is explicit; unsupported adapters do not invoke it.
     */
    onProviderStreamEvent?: (data: unknown, model: Model$1<Api>) => void | Promise<void>;
    temperature?: number;
    /**
     * Arbitrary sampling parameters merged into the request body as-is, after the named request
     * fields, so keys here override them. Lets custom OpenAI-compatible servers (llama.cpp, vLLM,
     * SGLang, ...) receive parameters pi does not model, e.g. `top_p`, `top_k`, `min_p`,
     * `repetition_penalty`. Merged over `Model.samplingParams` per key. Only applied by
     * OpenAI-compatible adapters (completions, responses, Azure responses); other APIs ignore it.
     */
    samplingParams?: SamplingParams;
    maxTokens?: number;
    /**
     * Preferred transport for providers that support multiple transports.
     * Providers that do not support this option ignore it.
     */
    transport?: Transport;
    /**
     * Prompt cache retention preference. Providers map this to their supported values.
     * Default: "short".
     */
    cacheRetention?: CacheRetention;
    /**
     * Optional session identifier for providers that support session-based caching.
     * Providers can use this to enable prompt caching, request routing, or other
     * session-aware features. Ignored by providers that don't support it.
     */
    sessionId?: string;
    /**
     * WebSocket connect timeout in milliseconds for providers that support
     * WebSocket transports. This covers the connection/open handshake only;
     * stream idleness after connection uses timeoutMs.
     */
    websocketConnectTimeoutMs?: number;
    /**
     * Optional metadata to include in API requests.
     * Providers extract the fields they understand and ignore the rest.
     * For example, Anthropic uses `user_id` for abuse tracking and rate limiting.
     */
    metadata?: Record<string, unknown>;
}
interface DeferredFetchOptions extends ProviderRequestOptions<Model$1<Api>> {
    /**
     * Maximum provider long-poll duration in milliseconds.
     * Defaults to 0, which performs one status check.
     */
    wait?: number;
}
/** Request options for best-effort deferred-response cancellation. */
type DeferredCancelOptions = ProviderRequestOptions<Model$1<Api>>;
/**
 * Maps known APIs to their full provider-specific stream option types.
 * Type-only imports from API implementation modules are erased at emit, so
 * this is tree-shake safe.
 */
interface ApiOptionsMap {
    "anthropic-messages": AnthropicOptions;
    "openai-completions": OpenAICompletionsOptions;
    "openai-responses": OpenAIResponsesOptions;
    "openai-codex-responses": OpenAICodexResponsesOptions;
    "azure-openai-responses": AzureOpenAIResponsesOptions;
    "google-generative-ai": GoogleOptions;
    "google-vertex": GoogleVertexOptions;
    "mistral-conversations": MistralOptions;
    "bedrock-converse-stream": BedrockOptions;
    "pi-messages": PiMessagesOptions;
}
/**
 * Full stream options for an API. Known APIs resolve to their concrete option
 * type; custom API strings fall back to the generic shape.
 */
type ApiStreamOptions<TApi extends Api> = TApi extends keyof ApiOptionsMap ? ApiOptionsMap[TApi] : StreamOptions & Record<string, unknown>;
interface ClassifierOptions extends ProviderRequestOptions<ClassifierModel<ClassifierApi>> {
    /**
     * Divides the answer logits by this value before they are normalized into probabilities.
     * Values above 1 soften the distribution; values below 1 sharpen it. Must be positive.
     * APIs that cannot apply it ignore it.
     */
    temperature?: number;
}
interface ImagesOptions extends ProviderRequestOptions<ImageModel<ImageApi>> {
    /**
     * Optional metadata to include in API requests.
     * Providers extract the fields they understand and ignore the rest.
     */
    metadata?: Record<string, unknown>;
}
interface SimpleStreamOptions extends StreamOptions {
    /** Provider-neutral tool selection for simple requests. When omitted, adapters use provider-specific behavior. */
    toolChoice?: ToolChoice;
    reasoning?: ThinkingLevel;
    /** Ask a capable provider to return a durable handle and continue the request asynchronously. */
    deferred?: boolean | {
        window?: "15m" | "1h" | "24h";
    };
    /** Custom token budgets for thinking levels (token-based providers only) */
    thinkingBudgets?: ThinkingBudgets;
}
type StreamFunction<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> = (model: Model$1<TApi>, context: TranscriptContext, options?: TOptions) => AssistantMessageEventStream;
interface TextContent {
    type: "text";
    text: string;
    textSignature?: string;
}
interface ThinkingContent {
    type: "thinking";
    thinking: string;
    thinkingSignature?: string;
    /** When true, the thinking content was redacted by safety filters. The opaque
     *  encrypted payload is stored in `thinkingSignature` so it can be passed back
     *  to the API for multi-turn continuity. */
    redacted?: boolean;
}
interface ImageContent {
    type: "image";
    data: string;
    mimeType: string;
}
interface ToolCall {
    type: "toolCall";
    id: string;
    name: string;
    arguments: JsonObject;
    thoughtSignature?: string;
    /** OpenAI Responses namespace for calls to dynamically loaded or namespaced tools. */
    namespace?: string;
    /**
     * Set when the model's complete arguments text was not a valid JSON object. `arguments` is then `{}`.
     * Describes the problem and includes the text the model sent; tool argument validation fails with it.
     */
    argumentsError?: string;
}
interface Usage {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    /** Subset of `cacheWrite` written with 1h retention. Only Anthropic reports this split. */
    cacheWrite1h?: number;
    /**
     * Reasoning/thinking tokens, when the provider reports them. This is a subset of
     * `output`: `output` already includes these tokens. Set to a number (possibly 0) by
     * providers that expose a reasoning breakdown; left undefined by providers that don't.
     */
    reasoning?: number;
    totalTokens: number;
    cost: {
        /** Catalog-derived input cost. */
        input: number;
        /** Catalog-derived output cost. */
        output: number;
        /** Catalog-derived cache-read cost. */
        cacheRead: number;
        /** Catalog-derived cache-write cost. */
        cacheWrite: number;
        /** Best available total: provider-reported billed cost when supported, otherwise the catalog estimate. */
        total: number;
        /** True when `total` is the billed cost reported by the provider. False when it is a catalog estimate; absent also means false. */
        totalFromProvider?: boolean;
    };
}
type StopReason = "pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred";
type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
type JsonObject = {
    [key: string]: JsonValue;
};
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactlyJsonValue<T> = [T] extends [JsonValue] ? ([JsonValue] extends [T] ? true : false) : false;
type IsJsonProperty<T> = IsAny<T> extends true ? false : unknown extends T ? false : [Exclude<T, undefined>] extends [never] ? true : IsJsonCompatible<Exclude<T, undefined>>;
type InvalidJsonKeys<T extends object> = {
    [TKey in keyof T]-?: TKey extends string | number ? (IsJsonProperty<T[TKey]> extends true ? never : TKey) : TKey;
}[keyof T];
type IsJsonCompatible<T> = IsAny<T> extends true ? false : unknown extends T ? false : IsExactlyJsonValue<T> extends true ? true : T extends null | boolean | number | string ? true : T extends undefined ? false : T extends readonly (infer TItem)[] ? IsJsonCompatible<TItem> : T extends (...args: never[]) => unknown ? false : T extends object ? [InvalidJsonKeys<T>] extends [never] ? true : false : false;
/** The JSON representation of a typed in-memory value. Optional object properties remain optional. */
type JsonRepresentation<T> = IsAny<T> extends true ? JsonValue : unknown extends T ? JsonValue : [T] extends [JsonValue] ? T : T extends readonly unknown[] ? {
    [TKey in keyof T]: JsonRepresentation<Exclude<T[TKey], undefined>>;
} : T extends object ? {
    [TKey in keyof T]: JsonRepresentation<Exclude<T[TKey], undefined>>;
} : never;
interface DeferredHandle {
    provider: string;
    modelId: string;
    api: string;
    /** Provider token, such as a response id or batch id plus row id. */
    id: string;
    expiresAt?: number;
    pollAfterMs?: number;
    /** Provider conversion data required to reconstruct the final assistant message. */
    data?: JsonValue;
}
/**
 * System instructions and tool declarations at one point in the transcript.
 *
 * The leading system message is the system prompt. Later system messages change it:
 * `content` adds instructions from that point on, `sections` replace or remove named
 * prompt sections, and `toolsAdded`/`toolsRemoved` change the tool set. Replaying
 * every system message in order yields the current prompt and tools. Providers that
 * accept system messages mid-conversation send each one in place; other providers
 * rebuild the leading system message from the replayed state.
 */
interface SystemMessage {
    role: "system";
    /** Instruction text. On the leading message this is the base prompt; later, additional instructions. */
    content: string | TextContent[];
    /**
     * Named, ordered prompt sections rendered verbatim after `content`. The leading message
     * declares them; later messages replace sections by name, and `null` removes one. Keep
     * each section self-delimiting (a tag, a heading) so the model can relate an update to
     * the original. Avoid integer-like names; JSON objects reorder those.
     */
    sections?: Record<string, string | null>;
    /** Complete definitions of tools that become available at this point. */
    toolsAdded?: Tool[];
    /** Tools that stop being available at this point. */
    toolsRemoved?: ToolReference[];
    timestamp: number;
}
interface UserMessage {
    role: "user";
    content: string | (TextContent | ImageContent)[];
    timestamp: number;
}
interface AssistantMessage {
    role: "assistant";
    content: (TextContent | ThinkingContent | ToolCall)[];
    api: Api;
    provider: ProviderId;
    model: string;
    responseModel?: string;
    responseId?: string;
    /** Exact provider-native effort level used for this response. Absent for legacy or unmanaged responses. */
    providerThinkingLevel?: string;
    /** Pi thinking level the agent loop requested for this response. Absent outside the agent loop and for legacy responses. */
    thinkingLevel?: ModelThinkingLevel;
    diagnostics?: AssistantMessageDiagnostic[];
    usage: Usage;
    stopReason: StopReason;
    deferred?: DeferredHandle;
    errorMessage?: string;
    rawStopReason?: string;
    /**
     * Provider indication of whether the model explicitly ended its turn.
     * Preserved for debugging and does not currently affect agent control flow.
     */
    endTurn?: boolean;
    /** Unix timestamp in milliseconds when the request started. */
    timestamp: number;
    /**
     * Milliseconds from `timestamp` until the response ended, measured with a monotonic clock. Set by
     * `AssistantMessageEventStream` on the final message of a response it saw start; absent for legacy messages and
     * for deferred results fetched later.
     */
    durationMs?: number;
}
/** A tool call that another tool made while it ran, for example from a codemode script. */
interface NestedToolCallRecord {
    id: string;
    name: string;
    /** Omitted when over the size limits; `argumentsBytes` then gives their size. */
    arguments?: JsonObject;
    /** UTF-8 size of the arguments as JSON, set when `arguments` is omitted. */
    argumentsBytes?: number;
    /** `unfinished`: the call was still running when the calling tool finished. */
    status: "ok" | "error" | "unfinished";
    durationMs?: number;
    /** Error text, truncated. */
    error?: string;
}
/** Bounded record of the nested calls a tool made. Results are not recorded. */
interface NestedToolCalls {
    calls: NestedToolCallRecord[];
    /** False when calls were dropped, arguments omitted, or calls had not finished. */
    complete: boolean;
}
type ToolResultMessage<TDetails = JsonValue> = IsJsonCompatible<TDetails> extends true ? {
    role: "toolResult";
    toolCallId: string;
    toolName: string;
    content: (TextContent | ImageContent)[];
    details?: JsonRepresentation<TDetails>;
    /** Usage from the tool execution itself, if available. Not part of main LLM context accounting. */
    usage?: Usage;
    /** Calls this tool made to other tools. Kept for the session record; not sent to the model. */
    nestedCalls?: NestedToolCalls;
    isError: boolean;
    /** Unix timestamp in milliseconds when the result was created. */
    timestamp: number;
    /** Milliseconds the tool's execution took, measured with a monotonic clock. Absent for legacy results. */
    durationMs?: number;
} : never;
type Message = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage;
type ImagesInputContent = TextContent | ImageContent;
type ImagesOutputContent = TextContent | ImageContent;
interface ImagesContext {
    input: ImagesInputContent[];
}
type ImagesStopReason = "stop" | "error" | "aborted";
interface AssistantImages {
    api: ImageApi;
    provider: ProviderId;
    model: string;
    output: ImagesOutputContent[];
    responseId?: string;
    usage?: Usage;
    stopReason: ImagesStopReason;
    errorMessage?: string;
    timestamp: number;
}
interface ClassifierChoiceQuestion {
    type: "choice";
    instructions: string;
    criteria: Record<string, string>;
}
interface ClassifierScoreQuestion {
    type: "score";
    instructions: string;
    criteria: string[];
}
interface ClassifierBoolQuestion {
    type: "bool";
    instructions: string;
    criteria: {
        true: string;
        false: string;
    };
}
type ClassifierQuestion = ClassifierChoiceQuestion | ClassifierScoreQuestion | ClassifierBoolQuestion;
interface ClassifierContext {
    state: JsonObject;
    /**
     * Images judged together with `state`. Only models whose `input` includes `"image"` accept them;
     * other models return an error result.
     */
    images?: ImageContent[];
    questions: Record<string, ClassifierQuestion>;
}
interface ClassifierChoiceAnswer {
    type: "choice";
    choice: string;
    probabilities: Record<string, number>;
    confidence: number;
}
interface ClassifierScoreAnswer {
    type: "score";
    score: number;
    confidence: number;
}
interface ClassifierBoolAnswer {
    type: "bool";
    probability: number;
}
type ClassifierAnswer = ClassifierChoiceAnswer | ClassifierScoreAnswer | ClassifierBoolAnswer;
type ClassifierStopReason = "stop" | "error" | "aborted";
interface ClassifierResult {
    api: ClassifierApi;
    provider: ProviderId;
    model: string;
    answers: Record<string, ClassifierAnswer>;
    /** Token usage and its cost at the model's catalog price, when the service reports token counts. */
    usage?: Usage;
    stopReason: ClassifierStopReason;
    errorMessage?: string;
    timestamp: number;
}
/** OpenAI grammar variants for constrained sampling. */
type GrammarFormat = "openai_lark" | "openai_regex";
type GrammarVariants = Partial<Record<GrammarFormat, string>>;
/**
 * Optional provider-side constrained sampling configs for a tool.
 *
 * The `json_schema` value roughly maps to the concept of `strict` in APIs which is
 * implemented as json-schema constrained sampling by APIs. Grammar variants let
 * callers provide provider-specific encodings of the same intended language.
 */
type ConstrainedSamplingConfig = {
    type: "json_schema";
    strict: "prefer" | "require";
} | {
    type: "grammar";
    variants: GrammarVariants;
};
/**
 * A tool the model may call. `parameters` is the JSON Schema of its arguments: pi-schema's builders (which also type
 * the arguments, see `Static` in `@earendil-works/pi-schema`), TypeBox schemas, or any JSON Schema object.
 */
interface Tool<TParameters extends object = object> {
    name: string;
    description: string;
    parameters: TParameters;
    constrainedSampling?: false | ConstrainedSamplingConfig;
}
interface ToolReference {
    name: string;
}
/**
 * Request input accepted by the public stream entry points (`Models.stream()`,
 * `streamSimple()`, ...). `systemPrompt` and `tools` are shorthand for a leading
 * system message; `normalizeContext()` folds them into one before the request
 * reaches a provider.
 */
interface Context {
    systemPrompt?: string;
    messages: Message[];
    tools?: Tool[];
}
declare const transcriptContextBrand: unique symbol;
/**
 * Normalized request context passed to providers and API implementations. The
 * prompt and tool declarations are carried by the transcript's system messages.
 * Only `normalizeContext()` produces this type, so a raw `Context` cannot reach
 * provider code by accident.
 */
type TranscriptContext = {
    messages: Message[];
    readonly [transcriptContextBrand]: true;
};
/**
 * Event protocol for AssistantMessageEventStream.
 *
 * Successful streams emit `start` before partial updates and terminate with
 * `done`. A stream may terminate directly with `error` when request setup fails
 * before generation starts; after `start`, failures also terminate with `error`.
 * Direct `streamSimple()` calls throw synchronously when request auth is missing.
 * Updates and `done` must never appear before `start`.
 *
 * `partial` is the shared live response-so-far helper, not an event-time
 * snapshot. Text and thinking blocks are empty when their `*_start` event is
 * emitted and grow only through their corresponding `*_delta` events until the
 * authoritative `*_end`. Redacted thinking may be complete at start and emit no
 * deltas. Tool-call arguments at `toolcall_start` are provider-specific;
 * `toolcall_delta` carries subsequent JSON updates.
 */
type AssistantMessageEvent = {
    type: "start";
    partial: AssistantMessage;
} | {
    type: "text_start";
    contentIndex: number;
    partial: AssistantMessage;
} | {
    type: "text_delta";
    contentIndex: number;
    delta: string;
    partial: AssistantMessage;
} | {
    type: "text_end";
    contentIndex: number;
    content: string;
    partial: AssistantMessage;
} | {
    type: "thinking_start";
    contentIndex: number;
    partial: AssistantMessage;
} | {
    type: "thinking_delta";
    contentIndex: number;
    delta: string;
    partial: AssistantMessage;
} | {
    type: "thinking_end";
    contentIndex: number;
    content: string;
    partial: AssistantMessage;
} | {
    type: "toolcall_start";
    contentIndex: number;
    partial: AssistantMessage;
} | {
    type: "toolcall_delta";
    contentIndex: number;
    delta: string;
    partial: AssistantMessage;
} | {
    type: "toolcall_end";
    contentIndex: number;
    toolCall: ToolCall;
    partial: AssistantMessage;
} | {
    type: "done";
    reason: Extract<StopReason, "stop" | "length" | "toolUse" | "deferred">;
    message: AssistantMessage;
} | {
    type: "error";
    reason: Extract<StopReason, "aborted" | "error">;
    error: AssistantMessage;
};
/** Fields shared by every catalog entry, regardless of what you can do with it. */
interface BaseModel<TApi extends string> {
    id: string;
    name: string;
    api: TApi;
    provider: ProviderId;
    baseUrl: string;
    input: ModelInputModality[];
    /** Provider input limits and cache-safe preprocessing metadata. */
    inputLimits?: ModelInputLimits;
    cost: ModelCost;
    headers?: Record<string, string>;
}
/** Chat model: usable with `stream()` and friends. */
interface Model$1<TApi extends Api> extends BaseModel<TApi> {
    /**
     * Optional: chat is the default model type, so models without `type` are chat
     * models. Narrow mixed model lists with `isModelType()` instead of comparing
     * `type` directly.
     */
    type?: "chat";
    reasoning: boolean;
    /**
     * Maps pi thinking levels to provider/model-specific values.
     * Missing keys use provider defaults. null marks a level as unsupported.
     */
    thinkingLevelMap?: ThinkingLevelMap;
    /** Prompt cache lifetimes per retention tier. Unset when the provider's cache behavior is unknown. */
    promptCache?: ModelPromptCache;
    contextWindow: number;
    maxTokens: number;
    /** Default sampling parameters for this model. See {@link StreamOptions.samplingParams}; per-request keys override these. */
    samplingParams?: SamplingParams;
    /** Sampling parameter overrides selected by the effective pi thinking level. */
    samplingParamsByThinkingLevel?: SamplingParamsByThinkingLevel;
    /** Compatibility overrides for OpenAI-compatible APIs. If not set, auto-detected from baseUrl. */
    compat?: TApi extends "openai-completions" ? OpenAICompletionsCompat : TApi extends "openai-responses" | "azure-openai-responses" | "openai-codex-responses" ? OpenAIResponsesCompat : TApi extends "anthropic-messages" ? AnthropicMessagesCompat : TApi extends "bedrock-converse-stream" ? BedrockCompat : TApi extends "mistral-conversations" ? MistralConversationsCompat : never;
}
/** Image-generation model: usable with `generateImages()` only. */
interface ImageModel<TApi extends ImageApi> extends BaseModel<TApi> {
    type: "image";
    /** Output modalities. Always includes `"image"`; `"text"` means the model can also return text blocks. */
    output: ("text" | "image")[];
}
/** Structured classifier model: usable with `classify()` only. */
interface ClassifierModel<TApi extends ClassifierApi> extends BaseModel<TApi> {
    type: "classifier";
    contextWindow: number;
    /** Compatibility overrides for System One APIs. If not set, auto-detected from provider, baseUrl, and id. */
    compat?: TApi extends "typesafe-system-one" | "cloudflare-workers-ai-system-one" ? SystemOneCompat : never;
}
/** Model shape for each model type. */
interface ModelTypeMap {
    chat: Model$1<Api>;
    image: ImageModel<ImageApi>;
    classifier: ClassifierModel<ClassifierApi>;
}
/** What a catalog entry is for. Decides which `Models` operation accepts it. */
type ModelType = keyof ModelTypeMap;
/** Anything a provider can list. Narrow with `isModelType()`. */
type AnyModel = ModelTypeMap[ModelType];

type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";
type AnthropicThinkingDisplay = "summarized" | "omitted";
interface AnthropicOptions extends StreamOptions {
    /**
     * Enable extended thinking.
     * For adaptive thinking models: the model decides when/how much to think.
     * For older models: uses budget-based thinking with thinkingBudgetTokens.
     * Default: undefined (thinking is omitted unless `streamSimple()` maps
     * a simple reasoning level to this option, or callers set it explicitly).
     */
    thinkingEnabled?: boolean;
    /**
     * Token budget for extended thinking (older models only).
     * Ignored for adaptive thinking models.
     * Default: 1024 when `thinkingEnabled` is true and no budget is provided.
     */
    thinkingBudgetTokens?: number;
    /**
     * Effort level for adaptive thinking models.
     * Controls how much thinking Claude allocates:
     * - "max": Always thinks with no constraints (Opus 4.6 only)
     * - "xhigh": Highest reasoning level (Opus 4.7+, Fable 5)
     * - "high": Always thinks, deep reasoning
     * - "medium": Moderate thinking, may skip for simple queries
     * - "low": Minimal thinking, skips for simple tasks
     * Ignored for older models.
     * Default: omitted unless `streamSimple()` maps a simple reasoning
     * level to this option.
     */
    effort?: AnthropicEffort;
    /**
     * Controls how thinking content is returned in API responses.
     * - "summarized": Thinking blocks contain summarized thinking text.
     * - "omitted": Thinking blocks return an empty thinking field; the encrypted
     *   signature still travels back for multi-turn continuity. Use for faster
     *   time-to-first-text-token when your UI does not surface thinking.
     *
     * Note: Anthropic's API default for Claude Opus 4.7 and Claude Mythos Preview
     * is "omitted". We default to "summarized" here to keep behavior consistent
     * with older Claude 4 models. Set this explicitly to "omitted" to opt in.
     * Default: "summarized" when thinking is enabled.
     */
    thinkingDisplay?: AnthropicThinkingDisplay;
    /**
     * Whether to request the interleaved thinking beta header for non-adaptive
     * thinking models. Adaptive thinking models have interleaved thinking built in,
     * so the header is skipped for them regardless of this setting.
     * Default: true.
     */
    interleavedThinking?: boolean;
    /**
     * Anthropic tool choice behavior. String values map to Anthropic's built-in
     * choices; `{ type: "tool", name }` forces a specific tool.
     * Default: omitted (Anthropic default behavior, currently equivalent to auto).
     */
    toolChoice?: "auto" | "any" | "none" | {
        type: "tool";
        name: string;
    };
    /**
     * Pre-built Anthropic client instance. When provided, skips internal client
     * construction entirely. Use this to inject alternative SDK clients such as
     * `AnthropicVertex` that shares the same messaging API.
     */
    client?: Anthropic;
}

/** Strict gateway tariff validation for model discovery and Free eligibility. */

type Comparison<T> = {
    in?: T[];
    eq?: T;
    gt?: T;
    gte?: T;
    lt?: T;
    lte?: T;
};
interface PricingCondition {
    all?: PricingCondition[];
    any?: PricingCondition[];
    utc_days?: Comparison<string>;
    utc_hours?: Comparison<string>;
    date?: Comparison<string>;
}
interface PriceMultiplier {
    when: PricingCondition;
    factor: number;
}

/** Browser-safe configuration, account metadata and RPC wire contracts. */

type ModelSource = 'go' | 'free';
/** Safe UI notice for a successful request using a fallback account. */
interface GoAccountSwitch {
    fromRef: string;
    toRef: string;
    reason: 'quota' | 'credential';
    at: number;
}
interface GoModel {
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
interface ThinkingBudgetRange {
    min: number;
    max: number;
}
/**
 * Input modalities this page can name; MIME types are normalized to these tokens.
 */
declare const INPUT_MODALITIES: readonly ["text", "image", "audio", "video", "pdf"];
type InputModality = typeof INPUT_MODALITIES[number];
/** Last successful check of one catalog source, plus any current refresh failure. */
interface GoCatalogSourceStatus {
    readonly updatedAt?: number;
    readonly error?: string;
    readonly warning?: string;
}
/** A failed refresh retains the Host's usable data with an explicit diagnostic. */
interface GoModelCatalog {
    readonly models: readonly GoModel[];
    readonly stale: boolean;
    readonly error?: string;
    /** Optional for clients reading an older Host response. Timestamps are Unix milliseconds. */
    readonly sources?: {
        readonly go: GoCatalogSourceStatus;
        readonly free: GoCatalogSourceStatus;
    };
}
interface UsageWindow {
    status: 'ok' | 'rate-limited';
    percent: number;
    resetsAt: string;
}
interface GoUsage {
    /** Opaque Host identity for this endpoint/account; never a credential or its hash. */
    source?: string;
    lastSwitch?: GoAccountSwitch;
    rolling: UsageWindow;
    weekly: UsageWindow;
    monthly: UsageWindow;
}
type AccountCommand = {
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
type SettingsWriteResult = 'applied' | 'rejected' | 'unknown';
type AnalyticsRange = 'today' | '7d' | '30d' | '90d';
interface AnalyticsQuery {
    accountRef: string;
    range: AnalyticsRange;
    refresh?: boolean;
}
/** Exact nonnegative integers on the wire; one USD is 100,000,000 micro cents. */
interface AnalyticsTotals {
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
interface AnalyticsModelRow extends AnalyticsTotals {
    provider: string;
    model: string;
}
interface AnalyticsDayRow extends AnalyticsTotals {
    day: string;
}
interface AnalyticsReport {
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
interface AnalyticsExport {
    filename: string;
    csv: string;
}
type AnalyticsFailureReason = 'invalid-query' | 'unknown-account' | 'missing-credential' | 'credential-unavailable' | 'unsupported-gateway' | 'invalid-proxy' | 'permission-denied' | 'upstream' | 'network' | 'timeout' | 'invalid-response';
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        opencodeGoModels: {
            read(): Promise<RemoteResult<GoModelCatalog>>;
        };
    }
}
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
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        opencodeGoAccounts: {
            execute(command: AccountCommand): Promise<RemoteResult<SettingsWriteResult>>;
        };
    }
}
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

/** Public SDK types bundled independently of the private runtime implementation. */

/** User controls are independent of the SDK's internal level used to enable a switch. */
type Model<TApi extends Api> = Model$1<TApi> & {
    source?: ModelSource;
    reasoningControl?: 'toggle' | 'effort' | 'budget';
    reasoningBudget?: {
        min: number;
        max: number;
    };
    reasoningBudgetPresets?: readonly number[];
    multipliers?: readonly PriceMultiplier[];
};

export type { Api, AssistantMessage, AssistantMessageEvent, Context, ImageContent, Message, Model, ModelCost, ModelThinkingLevel, Provider, SimpleStreamOptions, StreamFunction, TextContent, ThinkingBudgets, ThinkingLevelMap, Tool, ToolCall, Usage };
