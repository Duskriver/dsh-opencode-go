/** Gateway status codes cover several domains; a 401 alone cannot reject a key. */
export declare function classifyGatewayError(status: number, body: string, fallback: string): string;
/** Contributor refusals name the switch but not where it lives; append the path. */
export declare function withConsentGuidance(message: string): string;
