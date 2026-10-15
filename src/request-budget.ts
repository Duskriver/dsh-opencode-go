/** Output allowance shared by model resolution and request dispatch. */
import type { OpencodeGoModelLimits } from './config-contract.ts'

const DEEPSEEK_V41_FLASH_DEFAULT_MAX_TOKENS = 65_536

/**
 * Reserve 64k by default only for deepseek-v4.1-flash. Other models retain the
 * SDK's default when neither the caller nor settings specify an allowance.
 * Per-model settings continue to cap caller values for every model. The model
 * has already had capacity overrides applied.
 */
export function requestMaxTokens(
  model: { id: string; maxTokens: number },
  limits: OpencodeGoModelLimits,
  requested?: number,
): number | undefined {
  const configured = limits[model.id]?.maxTokens ?? undefined
  const allowance = configured === undefined ? requested : Math.min(requested ?? configured, configured)
  if (model.id !== 'deepseek-v4.1-flash') return allowance
  return Math.min(allowance ?? DEEPSEEK_V41_FLASH_DEFAULT_MAX_TOKENS, model.maxTokens)
}
