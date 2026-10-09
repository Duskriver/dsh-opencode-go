import Anthropic from '@anthropic-ai/sdk';
import { ResponseCreateParamsStreaming } from 'openai/resources/responses/responses.js';
import OpenAI from 'openai';
import { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';

interface TSchema {
}

type AttributeValue = string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];
interface SpanAttributes {
    [name: string]: AttributeValue | undefined;
}
interface SpanOptions {
    name: string;
    attributes?: SpanAttributes;
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
interface TelemetryContext {
    startSpan<T>(options: SpanOptions, callback: (span: TelemetrySpan) => T | Promise<T>): Promise<T>;
}
interface TelemetrySpan extends TelemetryContext {
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

type KnownApi = "openai-completions" | "mistral-conversations" | "openai-responses" | "azure-openai-responses" | "openai-codex-responses" | "anthropic-messages" | "bedrock-converse-stream" | "google-generative-ai" | "google-vertex" | "pi-messages";
type Api = KnownApi | (string & {});
type KnownImageApi = "openrouter-images";
type ImageApi = KnownImageApi | (string & {});
type KnownClassifierApi = "typesafe-system-one" | "cloudflare-workers-ai-system-one" | "llama-cpp-classify" | "openai-decisions";
type ClassifierApi = KnownClassifierApi | (string & {});
type KnownProvider = "amazon-bedrock" | "ant-ling" | "anthropic" | "google" | "google-vertex" | "openai" | "azure" | "openai-codex" | "radius" | "typesafe" | "nvidia" | "deepseek" | "github-copilot" | "xai" | "groq" | "cerebras" | "openrouter" | "vercel-ai-gateway" | "zai" | "zai-coding-cn" | "mistral" | "minimax" | "minimax-cn" | "moonshotai" | "moonshotai-cn" | "huggingface" | "fireworks" | "together" | "baseten" | "opencode" | "opencode-go" | "kimi-coding" | "meta" | "cloudflare-workers-ai" | "cloudflare-ai-gateway" | "qwen-token-plan" | "qwen-token-plan-cn" | "qwen-token-plan-individual" | "xiaomi" | "xiaomi-token-plan-cn" | "xiaomi-token-plan-ams" | "xiaomi-token-plan-sgp";
type ProviderId = KnownProvider | string;
type ToolChoice = "auto" | "none";
type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
type ModelThinkingLevel = "off" | ThinkingLevel;
type ThinkingLevelMap = Partial<Record<ModelThinkingLevel, string | null>>;
type SamplingParams = Record<string, unknown>;
type SamplingParamsByThinkingLevel = Partial<Record<ModelThinkingLevel, SamplingParams>>;
type ChatTemplateKwargValue = string | number | boolean | null | {
    $var: "thinking.enabled" | "thinking.effort" | "thinking.budget";
    omitWhenOff?: boolean;
};
/** Top-level request field used to cap reasoning tokens on OpenAI-compatible servers. */
type ThinkingTokenBudgetField = "thinking_token_budget" | "thinking_budget" | "thinking_budget_tokens";
/** Token budgets for each thinking level (token-based providers only) */
interface ThinkingBudgets {
    minimal?: number;
    low?: number;
    medium?: number;
    high?: number;
}
type CacheRetention = "none" | "short" | "long";
/**
 * Best-effort prompt cache lifetime in seconds for each retention tier a request can ask for.
 * A missing tier means the lifetime is unknown; pi does not warm such caches.
 */
type ModelPromptCache = Partial<Record<Exclude<CacheRetention, "none">, number>>;
type Transport = "sse" | "websocket" | "websocket-cached" | "auto";
/** Provider-scoped environment overrides. Values take precedence over process.env. */
type ProviderEnv = Record<string, string>;
type ProviderHeaders = Record<string, string | null>;
type FetchFunction = typeof globalThis.fetch;
type SessionAffinityFormat = "openai" | "openai-nosession" | "openrouter";
interface ProviderResponse {
    status: number;
    headers: Record<string, string>;
}
/** Authentication, HTTP transport, and lifecycle callbacks shared by provider requests. */
interface ProviderRequestOptions<TModel = Model$1<Api>> {
    signal?: AbortSignal;
    /** Explicit parent context for telemetry produced by this logical request. */
    telemetryContext?: TelemetryContext;
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
interface AnthropicAllowedFallbackModel {
    provider: ProviderId;
    model: string;
    cost: ModelCost;
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
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
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
interface Tool<TParameters extends TSchema = TSchema> {
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
/**
 * Compatibility settings for OpenAI-compatible completions APIs.
 * Use this to override URL-based auto-detection for custom providers.
 */
interface OpenAICompletionsCompat {
    /** Whether the provider supports the `store` field. Default: auto-detected from URL. */
    supportsStore?: boolean;
    /** Whether the provider supports the `developer` role (vs `system`). Default: auto-detected from URL. */
    supportsDeveloperRole?: boolean;
    /** Whether the provider supports `reasoning_effort`. Default: auto-detected from URL. */
    supportsReasoningEffort?: boolean;
    /** Whether the provider supports `stream_options: { include_usage: true }` for token usage in streaming responses. Default: true. */
    supportsUsageInStreaming?: boolean;
    /** Whether streamed responses include `finish_reason`. When false, pi infers `stop` or `toolUse` when the stream ends. Default: true. */
    supportsFinishReason?: boolean;
    /** Which field to use for max tokens. Default: auto-detected from URL. */
    maxTokensField?: "max_completion_tokens" | "max_tokens";
    /** Whether tool results require the `name` field. Default: auto-detected from URL. */
    requiresToolResultName?: boolean;
    /** Whether a user message after tool results requires an assistant message in between. Default: auto-detected from URL. */
    requiresAssistantAfterToolResult?: boolean;
    /** Whether thinking blocks must be converted to text blocks with <thinking> delimiters. Default: auto-detected from URL. */
    requiresThinkingAsText?: boolean;
    /** Whether all replayed assistant messages must include an empty reasoning_content field when reasoning is enabled. Default: auto-detected from URL. */
    requiresReasoningContentOnAssistantMessages?: boolean;
    /** Format for reasoning/thinking parameter. "openai" uses reasoning_effort, "openrouter" uses reasoning: { effort }, "deepseek" uses thinking: { type } plus reasoning_effort when supported, "together" uses reasoning: { enabled } plus reasoning_effort when supported, "baseten" uses configurable chat_template_args plus reasoning_effort when supported, "zai" uses thinking: { type }, "qwen" uses top-level enable_thinking: boolean, "qwen-chat-template" uses chat_template_kwargs.enable_thinking and preserve_thinking, "chat-template" uses configurable chat_template_kwargs, "string-thinking" uses top-level thinking: string, and "ant-ling" uses reasoning: { effort } only when the mapped effort is non-null. Default: "openai". */
    thinkingFormat?: "openai" | "openrouter" | "deepseek" | "together" | "baseten" | "zai" | "qwen" | "chat-template" | "qwen-chat-template" | "string-thinking" | "ant-ling";
    /** Kwargs to send as `chat_template_kwargs` when `thinkingFormat` is `chat-template`. Use `{ "$var": "thinking.enabled" }`, `{ "$var": "thinking.effort" }`, or `{ "$var": "thinking.budget" }` for pi-controlled thinking values. */
    chatTemplateKwargs?: Record<string, ChatTemplateKwargValue>;
    /** Arguments to send as `chat_template_args` when `thinkingFormat` is `baseten`. Use `{ "$var": "thinking.enabled" }`, `{ "$var": "thinking.effort" }`, or `{ "$var": "thinking.budget" }` for pi-controlled thinking values. */
    chatTemplateArgs?: Record<string, ChatTemplateKwargValue>;
    /** OpenRouter-compatible routing preferences sent as the `provider` request field. */
    openRouterRouting?: OpenRouterRouting;
    /** Vercel AI Gateway routing preferences. Only used when baseUrl points to Vercel AI Gateway. */
    vercelGatewayRouting?: VercelGatewayRouting;
    /** Whether z.ai supports top-level `tool_stream: true` for streaming tool call deltas. Default: false. */
    zaiToolStream?: boolean;
    /**
     * Top-level request field used to cap reasoning tokens from `thinkingBudgets`.
     * Reasoning and the answer share `max_tokens` on these endpoints, so without a budget a
     * reasoning-heavy turn can consume the whole response and emit no answer.
     * `"thinking_token_budget"` is vLLM, `"thinking_budget"` is Qwen/DashScope/SGLang,
     * `"thinking_budget_tokens"` is llama.cpp. Off by default; not set on the generated catalog.
     */
    thinkingTokenBudgetField?: ThinkingTokenBudgetField;
    /** Alias for `thinkingTokenBudgetField: "thinking_token_budget"` (vLLM). Prefer `thinkingTokenBudgetField`. Default: false. */
    supportsThinkingTokenBudget?: boolean;
    /** Whether the provider supports OpenAI custom tools with Lark/regex grammar formats. When false, grammar-constrained tools fall back to normal function tools. Default: false; the generated model catalog enables it for capable models. */
    supportsOpenAIGrammarTools?: boolean;
    /** Whether the exact model accepts system or developer messages after the conversation has started. When false, later system messages are folded into the leading system message. Default: false; the generated model catalog enables it for verified models. */
    supportsMidConvoSystemMessages?: boolean;
    /** Whether system messages can introduce additional tools mid-conversation. Requires `supportsMidConvoSystemMessages`. Default: false; the generated model catalog enables it for capable models. */
    supportsMidConvoToolAdditions?: boolean;
    /** Whether the provider supports the `strict` field in tool definitions. Default: false; generated capable models enable it explicitly. */
    supportsStrictMode?: boolean;
    /** Cache control convention for prompt caching. "anthropic" applies Anthropic-style `cache_control` markers to the system prompt, last tool definition, and last user, assistant, or tool-result text content. */
    cacheControlFormat?: "anthropic";
    /** Whether to send session-affinity data from `options.sessionId`. Default: true for OpenRouter endpoints, false otherwise. */
    sendSessionAffinityHeaders?: boolean;
    /** Session-affinity header format: `openai` sends `session_id`, `x-client-request-id`, and `x-session-affinity`; `openai-nosession` sends `x-client-request-id` and `x-session-affinity`; `openrouter` sends `x-session-id`. Does not affect the `prompt_cache_key` body param, which is governed by cache retention. Default: auto-detected. */
    sessionAffinityFormat?: SessionAffinityFormat;
    /** Whether the provider supports long prompt cache retention (`prompt_cache_retention: "24h"` or Anthropic-style `cache_control.ttl: "1h"`, depending on format). Default: true. */
    supportsLongCacheRetention?: boolean;
    /**
     * vLLM scheduler priority sent as the top-level `priority` request field (lower values are
     * handled earlier; server default 0). Only meaningful when vLLM runs with
     * `--scheduling-policy priority`; useful for keeping background/batch work from stalling
     * interactive sessions. Off by default; not set on the generated catalog.
     */
    vllmPriority?: number;
}
/** Compatibility settings for OpenAI Responses APIs. */
interface OpenAIResponsesCompat {
    /** Whether the provider supports the `developer` role (vs `system`). Default: true. */
    supportsDeveloperRole?: boolean;
    /** Whether the exact model accepts developer or system messages after the conversation has started. When false, later system messages are folded into the leading system message. Default: false; the generated model catalog enables it for verified models. */
    supportsMidConvoSystemMessages?: boolean;
    /** Session-affinity header format: `openai` sends `session_id` and `x-client-request-id`; `openai-nosession` sends `x-client-request-id`; `openrouter` sends `x-session-id`. Does not affect the `prompt_cache_key` body param, which is governed by cache retention. Default: auto-detected. */
    sessionAffinityFormat?: SessionAffinityFormat;
    /** Whether the provider supports long prompt cache retention. This uses `prompt_cache_options.ttl: "30m"` on GPT-5.6+ and `prompt_cache_retention: "24h"` on earlier models. Default: true. */
    supportsLongCacheRetention?: boolean;
    /** Whether the provider supports strict JSON-schema function tools. Defaults are API-specific; generated OpenAI models enable it explicitly. */
    supportsStrictMode?: boolean;
    /** Whether to emit OpenAI custom tools with Lark/regex grammar formats. When false, grammar-constrained tools fall back to normal function tools. Default: false; the generated model catalog enables it for capable models. */
    supportsOpenAIGrammarTools?: boolean;
    /** Whether the model supports message-anchored `additional_tools` input items. Default: false. */
    supportsAdditionalTools?: boolean;
    /** Whether the model supports client-executed tool search for transcript-anchored additions. Default: false. */
    supportsToolSearch?: boolean;
    /** Whether the model accepts `prompt_cache_options` (OpenAI GPT-5.6+ prompt caching). Older OpenAI models reject the parameter. Default: false. */
    supportsExplicitPromptCacheMode?: boolean;
    /** Whether the provider accepts the `max_output_tokens` parameter. Some Codex-protocol gateways reject it. Default: true. */
    supportsMaxOutputTokens?: boolean;
}
/** Compatibility settings for Anthropic Messages-compatible APIs. */
interface AnthropicMessagesCompat {
    /**
     * Whether the provider accepts per-tool `eager_input_streaming`.
     * When false, the Anthropic provider omits `tools[].eager_input_streaming`
     * and sends the legacy `fine-grained-tool-streaming-2025-05-14` beta header
     * for tool-enabled requests.
     * Default: true.
     */
    supportsEagerToolInputStreaming?: boolean;
    /** Whether the provider supports Anthropic long cache retention (`cache_control.ttl: "1h"`). Default: true. */
    supportsLongCacheRetention?: boolean;
    /**
     * Whether to send the `x-session-affinity` header from `options.sessionId`
     * when caching is enabled. Required for providers like Fireworks that use
     * session affinity for prompt cache routing (requests to the same replica
     * maximize cache hits).
     * Default: false.
     */
    sendSessionAffinityHeaders?: boolean;
    /** Session-affinity format. `"openrouter"` sends `x-session-id`; when unset, sends `x-session-affinity`. */
    sessionAffinityFormat?: "openrouter";
    /**
     * Whether the provider supports Anthropic-style `cache_control` markers on
     * tool definitions. When false, `cache_control` is omitted from tool params.
     * Some Anthropic-compatible providers (e.g., Fireworks) do not support this
     * field on tools and may reject or ignore it.
     * Default: true.
     */
    supportsCacheControlOnTools?: boolean;
    /**
     * Whether the model accepts the Anthropic `temperature` request field.
     * Claude Opus 4.7+ rejects non-default temperature values.
     * Default: true.
     */
    supportsTemperature?: boolean;
    /**
     * Whether to force adaptive thinking (`thinking.type: "adaptive"` plus
     * `output_config.effort`) regardless of the model id. Built-in models that
     * require adaptive thinking set this in generated metadata. Custom
     * Anthropic-compatible providers can set this to `true` for any model whose
     * upstream requires the adaptive format. Set to `false` to
     * opt out on overridden built-in models.
     * Default: false.
     */
    forceAdaptiveThinking?: boolean;
    /** Whether to replay empty thinking signatures as `signature: ""` instead of converting thinking to text. Default: false. */
    allowEmptySignature?: boolean;
    /** Whether the provider supports Anthropic strict tool schemas. Default: false; generated Anthropic models enable it explicitly. */
    supportsStrictTools?: boolean;
    /** Whether the exact model transport supports effort-only system messages and thinking binding controls. Default: false. */
    supportsMidConvoEffort?: boolean;
    /** Whether the exact model accepts system-role messages inside the conversation. When false, later system messages are folded into the top-level system prompt. Default: false. */
    supportsMidConvoSystemMessages?: boolean;
    /** Whether the exact model accepts mid-conversation `tool_addition` blocks with inline tool definitions (`inline-tools-2026-09-15`) and `tool_removal` blocks. Requires `supportsMidConvoSystemMessages`. Default: false. */
    supportsMidConvoToolChanges?: boolean;
    /**
     * Models Anthropic accepts in `fallbacks` for server-side refusal fallback,
     * with local pricing metadata for returned fallback responses. When absent or
     * empty, callers must omit `fallbacks`; Anthropic rejects the field for models
     * with no permitted fallback targets.
     */
    allowedFallbackModels?: AnthropicAllowedFallbackModel[];
}
/** Compatibility settings for Amazon Bedrock models. */
interface BedrockCompat {
    /** Whether the model supports Bedrock strict tool schemas. Default: false. */
    supportsStrictMode?: boolean;
}
/** Compatibility settings for the Mistral chat API. */
interface MistralConversationsCompat {
    /** Whether the exact model accepts system messages after the conversation has started. When false, later system messages are folded into the leading system message. Default: false. */
    supportsMidConvoSystemMessages?: boolean;
}
/**
 * OpenRouter provider routing preferences.
 * Controls which upstream providers OpenRouter routes requests to.
 * Sent as the `provider` field in the OpenRouter API request body.
 * @see https://openrouter.ai/docs/guides/routing/provider-selection
 */
interface OpenRouterRouting {
    /** Whether to allow backup providers to serve requests. Default: true. */
    allow_fallbacks?: boolean;
    /** Whether to filter providers to only those that support all parameters in the request. Default: false. */
    require_parameters?: boolean;
    /** Data collection setting. "allow" (default): allow providers that may store/train on data. "deny": only use providers that don't collect user data. */
    data_collection?: "deny" | "allow";
    /** Whether to restrict routing to only ZDR (Zero Data Retention) endpoints. */
    zdr?: boolean;
    /** Whether to restrict routing to only models that allow text distillation. */
    enforce_distillable_text?: boolean;
    /** An ordered list of provider names/slugs to try in sequence, falling back to the next if unavailable. */
    order?: string[];
    /** List of provider names/slugs to exclusively allow for this request. */
    only?: string[];
    /** List of provider names/slugs to skip for this request. */
    ignore?: string[];
    /** A list of quantization levels to filter providers by (e.g., ["fp16", "bf16", "fp8", "fp6", "int8", "int4", "fp4", "fp32"]). */
    quantizations?: string[];
    /** Sorting strategy. Can be a string (e.g., "price", "throughput", "latency") or an object with `by` and `partition`. */
    sort?: string | {
        /** The sorting metric: "price", "throughput", "latency". */
        by?: string;
        /** Partitioning strategy: "model" (default) or "none". */
        partition?: string | null;
    };
    /** Maximum price per million tokens (USD). */
    max_price?: {
        /** Price per million prompt tokens. */
        prompt?: number | string;
        /** Price per million completion tokens. */
        completion?: number | string;
        /** Price per image. */
        image?: number | string;
        /** Price per audio unit. */
        audio?: number | string;
        /** Price per request. */
        request?: number | string;
    };
    /** Preferred minimum throughput (tokens/second). Can be a number (applies to p50) or an object with percentile-specific cutoffs. */
    preferred_min_throughput?: number | {
        /** Minimum tokens/second at the 50th percentile. */
        p50?: number;
        /** Minimum tokens/second at the 75th percentile. */
        p75?: number;
        /** Minimum tokens/second at the 90th percentile. */
        p90?: number;
        /** Minimum tokens/second at the 99th percentile. */
        p99?: number;
    };
    /** Preferred maximum latency (seconds). Can be a number (applies to p50) or an object with percentile-specific cutoffs. */
    preferred_max_latency?: number | {
        /** Maximum latency in seconds at the 50th percentile. */
        p50?: number;
        /** Maximum latency in seconds at the 75th percentile. */
        p75?: number;
        /** Maximum latency in seconds at the 90th percentile. */
        p90?: number;
        /** Maximum latency in seconds at the 99th percentile. */
        p99?: number;
    };
}
/**
 * Vercel AI Gateway routing preferences.
 * Controls which upstream providers the gateway routes requests to.
 * @see https://vercel.com/docs/ai-gateway/models-and-providers/provider-options
 */
interface VercelGatewayRouting {
    /** List of provider slugs to exclusively use for this request (e.g., ["bedrock", "anthropic"]). */
    only?: string[];
    /** List of provider slugs to try in order (e.g., ["anthropic", "openai"]). */
    order?: string[];
}
interface ModelCostRates {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
}
interface ModelCostTier extends ModelCostRates {
    /** Use this tier for requests whose total input usage exceeds this token count. */
    inputTokensAbove: number;
}
interface ModelCost extends ModelCostRates {
    /** Request-wide pricing tiers. The highest matching input threshold applies to the full request. */
    tiers?: ModelCostTier[];
}
interface ModelImageResizeOptions {
    maxWidth?: number;
    maxHeight?: number;
    /** Maximum base64-encoded payload size in bytes. */
    maxBytes?: number;
    jpegQuality?: number;
}
interface ModelImageInputLimits {
    /** Cache-safe resize profile applied before a new image enters conversation history. */
    resize?: ModelImageResizeOptions;
    /** Maximum images accepted in one provider message. */
    maxPerMessage?: number;
    /** Maximum images accepted across one provider request. */
    maxPerRequest?: number;
}
interface ModelInputLimits {
    /** Maximum serialized provider request size in bytes. */
    maxRequestBytes?: number;
    images?: ModelImageInputLimits;
}
/** Fields shared by every catalog entry, regardless of what you can do with it. */
interface BaseModel<TApi extends string> {
    id: string;
    name: string;
    api: TApi;
    provider: ProviderId;
    baseUrl: string;
    input: ("text" | "image")[];
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

/** Settings discovery includes lifecycle data that the host's generic model DTO omits. */

interface GoModel {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
    /** Token budget controls available to this model, including their catalog bounds. */
    reasoningBudget?: ThinkingBudgetRange;
    deprecated?: boolean;
    releaseDate?: string;
    /** Input modalities models.dev declares, in {@link INPUT_MODALITIES} order. */
    inputModalities?: readonly InputModality[];
    /** Advertised by the gateway but lacking a usable protocol and capability configuration. */
    configurationMissing?: boolean;
}
interface ThinkingBudgetRange {
    min: number;
    max: number;
}
/**
 * Input modalities this page can name. models.dev uses these same five tokens, so
 * an unknown token is dropped rather than rendered as an untranslatable chip.
 */
declare const INPUT_MODALITIES: readonly ["text", "image", "audio", "video", "pdf"];
type InputModality = typeof INPUT_MODALITIES[number];
/** Last successful check of one catalog source, plus any current refresh failure. */
interface GoCatalogSourceStatus {
    readonly updatedAt?: number;
    readonly error?: string;
}
/** A failed refresh retains the Host's usable data with an explicit diagnostic. */
interface GoModelCatalog {
    readonly models: readonly GoModel[];
    readonly stale: boolean;
    readonly error?: string;
    /** Optional for clients reading an older Host response. Timestamps are Unix milliseconds. */
    readonly sources?: {
        readonly listing: GoCatalogSourceStatus;
        readonly metadata: GoCatalogSourceStatus;
    };
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        opencodeGoModels: {
            read(): Promise<RemoteResult<GoModelCatalog>>;
        };
    }
}

/** Public SDK types are bundled at build time, alongside the private implementation. */

/** User controls are independent of the SDK's internal level used to enable a switch. */
type Model<TApi extends Api> = Model$1<TApi> & {
    reasoningControl?: 'toggle' | 'effort' | 'budget';
    reasoningBudget?: ThinkingBudgetRange;
    reasoningBudgetPresets?: readonly number[];
};

export type { Api, AssistantMessage, AssistantMessageEvent, Context, ImageContent, Message, Model, ModelCost, ModelThinkingLevel, Provider, TextContent, ThinkingBudgets, ThinkingLevelMap, Tool, ToolCall, Usage };
