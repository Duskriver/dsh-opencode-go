import type { OpencodeGoConfig } from './contracts.ts';
type Network = Pick<OpencodeGoConfig, 'freeBaseURL' | 'proxyURL'>;
export interface FreeAttemptTicket {
    key: string;
    sequence: number;
}
export interface FreeAttemptResult {
    outcome: 'success' | 'error' | 'aborted';
    code?: string;
    retryAt?: number;
}
export declare class FreeChannelState {
    private readonly entries;
    private sequence;
    private key;
    cooldownUntil(config: Network): number | undefined;
    assertReady(config: Network): void;
    begin(config: Network): FreeAttemptTicket;
    finish(ticket: FreeAttemptTicket, result: FreeAttemptResult): void;
}
export {};
