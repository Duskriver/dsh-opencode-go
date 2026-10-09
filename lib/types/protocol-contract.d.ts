/** The supported experimental override surface, shared with the settings UI. */
export declare const RESPONSES_OVERRIDE_MODEL = "deepseek-v4.1-flash";
export type GoProtocolOverrides = Partial<Record<typeof RESPONSES_OVERRIDE_MODEL, 'openai-responses' | null>>;
/** Null selects catalog routing even when a lower settings layer overrides it. */
export declare function assertProtocolOverrides(value: unknown): asserts value is GoProtocolOverrides | undefined;
