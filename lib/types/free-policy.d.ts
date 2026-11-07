/** Free-specific error semantics; Go account classification remains unchanged. */
export declare function classifyFreeGatewayError(status: number, body: string): string | undefined;
/** Parse delta-seconds or HTTP-date, accounting for a server clock when supplied. */
export declare function retryAfterDeadline(value: string | null, now?: number, serverDate?: string | null): number | undefined;
