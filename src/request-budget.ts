/**
 * Per-request output reservation.
 *
 * The gateway accounts `prompt + max_tokens` against its own context window, so
 * whatever a request reserves for its own output directly shrinks the prompt it
 * may carry: reserving a model's full output ceiling (384k of a 1M window) caps
 * a session far below the advertised capacity and gets it rejected with an
 * opaque 400 long before the model's real limit is reached.
 *
 * The reservation is therefore bounded by a share of the advertised window and
 * by the host's own per-request default, and `defaultMaxTokens` reports the very
 * same number to the host so its compaction budget reserves what a request
 * reserves instead of assuming none.
 *
 * This bound, not pi-ai's own `clampMaxTokensToContext`, is what keeps a request
 * inside the gateway window. pi-ai clamps below it only once its `chars / 3.5`
 * estimate comes within `CONTEXT_SAFETY_TOKENS` (4096) of the window, while the
 * host compacts at `min(window x 0.8, window - reserved - 65536)` — always
 * earlier, because the host's 64k headroom exceeds pi-ai's 4k margin and the
 * host reserves this same value first. Feeding an estimated prompt back to
 * pi-ai therefore cannot change any reservation the host would actually make.
 *
 * @module dsh-opencode-go/request-budget
 */

import type { OpencodeGoModelLimits } from './config-contract.ts'

/** The host's own per-request output default; see `@deepseek-ai/dsh-llm-pi-ai`. */
const DEFAULT_REQUEST_MAX_TOKENS = 32_768

/** Largest share of the window one request may reserve for its own output. */
const REQUEST_OUTPUT_WINDOW_RATIO = 1 / 16

/** Floor that keeps reasoning and the answer room even on tiny windows. */
const MIN_REQUEST_MAX_TOKENS = 1_024

/** The capacity fields this rule reads; a resolved `Model<Api>` satisfies it. */
interface RequestCapacity {
  readonly id: string
  readonly contextWindow: number
  readonly maxTokens: number | null
}

/**
 * Resolve one request's output reservation.
 * @param model - capacities with settings overrides already applied.
 * @param limits - per-model settings overrides for this configuration.
 * @param requested - cap the host materialized for this request, when supplied.
 * @returns the `max_tokens` this request sends, never above the model's declared
 *   output ceiling and never above the caller's cap.
 */
export function requestMaxTokens(
  model: RequestCapacity,
  limits: OpencodeGoModelLimits,
  requested?: number,
): number {
  // An explicit override is the user's answer budget and also caps the caller.
  const override = limits[model.id]?.maxTokens ?? undefined
  if (override !== undefined) return requested === undefined ? override : Math.min(requested, override)
  const share = Math.max(MIN_REQUEST_MAX_TOKENS, Math.floor(model.contextWindow * REQUEST_OUTPUT_WINDOW_RATIO))
  const cap = model.maxTokens === null
    ? Math.min(DEFAULT_REQUEST_MAX_TOKENS, share)
    : Math.min(DEFAULT_REQUEST_MAX_TOKENS, model.maxTokens, share)
  return requested === undefined ? cap : Math.min(requested, cap)
}
