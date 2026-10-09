import type { Api, Model, ModelThinkingLevel, ThinkingBudgets, ThinkingLevelMap } from './sdk-types.ts';
import type { ThinkingBudgetRange } from './models-contract.ts';
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
