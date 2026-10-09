/** Gateway status codes cover several domains; a 401 alone cannot reject a key. */
export declare function classifyGatewayError(status: number, body: string, fallback: string): string;
