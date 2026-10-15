/** Output allowance shared by model resolution and request dispatch. */
import type { OpencodeGoModelLimits } from './config-contract.ts';
/**
 * Reserve 64k by default only for deepseek-v4.1-flash. Other models retain the
 * SDK's default when neither the caller nor settings specify an allowance.
 * Per-model settings continue to cap caller values for every model. The model
 * has already had capacity overrides applied.
 */
export declare function requestMaxTokens(model: {
    id: string;
    maxTokens: number;
}, limits: OpencodeGoModelLimits, requested?: number): number | undefined;
