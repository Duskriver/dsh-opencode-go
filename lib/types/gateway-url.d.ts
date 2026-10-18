/** Public Go discovery/usage base; inference uses the documented protocol-specific siblings. */
export declare const DEFAULT_BASE_URL = "https://opencode.ai/inference/go/v1";
/**
 * Migrate the legacy official address before any request is constructed.
 */
export declare function migrateGatewayBaseURL(baseURL: string): string;
