/** Gateway reasoning controls shared by live metadata, fallbacks and requests. */
import type { Api, Model, ModelThinkingLevel, ThinkingLevelMap } from './sdk-types.ts';
export declare const THINKING_LEVELS: readonly ModelThinkingLevel[];
/** Formats that explicitly disable thinking when no SDK effort is supplied. */
export declare const NATIVE_THINKING_FLAGS: ReadonlySet<string>;
export declare function unsupportedThinkingLevels(): ThinkingLevelMap;
/** Exact model/protocol rules verified against OpenCode Go, never inherited by a family. */
export declare function withGatewayReasoning(model: Model<Api>): Model<Api>;
/** An unset OpenAI effort preserves the provider default; explicit Off retains its wire value. */
export declare function withRequestReasoning(model: Model<Api>, level: ModelThinkingLevel | undefined): Model<Api>;
