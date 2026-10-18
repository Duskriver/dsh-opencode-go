/**
 * OpenCode Go plan snapshot: monthly limits and the one peak-pricing window the
 * official tariff defines. Prices themselves stay on models.dev (the catalog's
 * model.cost); this file only carries what models.dev does not publish.
 *
 * Source: https://opencode.ai/v2/docs/console/go/ (Go and Go Plus tables).
 * The snapshot is reviewed when the model list or the plan changes; the report
 * shows {@link GO_PLAN_AS_OF}, so a stale table is visible rather than silent.
 *
 * @module dsh-opencode-go/go-plan
 */

/** Date the limits below were read from the official plan page. */
export const GO_PLAN_AS_OF = '2026-10-18'

/** Human-readable source for the limit snapshot. */
export const GO_PLAN_SOURCE = 'https://opencode.ai/v2/docs/console/go/'

/** Why a row has no numeric limit. */
export type GoLimitNote = 'unlimited' | 'limited-time'

/** One model's monthly allowance on each plan (USD), or a note instead. */
export interface GoMonthlyLimit {
  /** Go plan monthly limit in USD; null when the row is unlimited. */
  readonly go: number | null
  /** Go Plus plan monthly limit in USD; null when the row is unlimited. */
  readonly goPlus: number | null
  readonly note?: GoLimitNote
}

const UNLIMITED: GoMonthlyLimit = { go: null, goPlus: null, note: 'unlimited' }

/**
 * Monthly limits by model id. Promo rows use the effective (post-strike-through)
 * value and carry {@link GoLimitNote} 'limited-time'; free rows are unlimited.
 */
export const GO_MONTHLY_LIMITS: Readonly<Record<string, GoMonthlyLimit>> = {
  'glm-5.3-flash': { go: 60, goPlus: 180 },
  'glm-5.3': { go: 15, goPlus: 120 },
  'glm-5.2': { go: 60, goPlus: 180 },
  'kimi-k3': { go: 15, goPlus: 60 },
  'kimi-k2.7-code': { go: 60, goPlus: 180 },
  'longcat-2.0': { go: 60, goPlus: 240 },
  'longcat-2.5-preview-free': UNLIMITED,
  'step-5-preview': { go: 60, goPlus: 240, note: 'limited-time' },
  'beam-free': UNLIMITED,
  'mimo-v2.6-flash': { go: 60, goPlus: 120 },
  'mimo-v2.6-pro': { go: 15, goPlus: 60 },
  'mimo-v2.5': { go: 60, goPlus: 120 },
  'mimo-v2.5-pro': { go: 15, goPlus: 60 },
  'minimax-m3': { go: 60, goPlus: 180 },
  'muse-spark-1.3-contributor': { go: 60, goPlus: 120 },
  'muse-spark-1.2-contributor': { go: 60, goPlus: 120 },
  'qwen3.8-max': { go: 15, goPlus: 60 },
  'qwen3.8-flash': { go: 30, goPlus: 90 },
  'qwen3.7-plus': { go: 60, goPlus: 180 },
  'deepseek-v4.1-flash': { go: 80, goPlus: 160 },
  'deepseek-v4-pro': { go: 15, goPlus: 60 },
  'hy4-preview': { go: 30, goPlus: 120 },
  'hy3': { go: 60, goPlus: 240 },
  'space-bunny': { go: 30, goPlus: 120 },
  'grok-4.7': { go: 15, goPlus: 60 },
  'gpt-6-luna': { go: 15, goPlus: 60 },
  'gpt-5.6-luna': { go: 15, goPlus: 60 },
  'claude-haiku-5-5': { go: 15, goPlus: 60 },
  'gemini-4-argon-contributor': { go: 60, goPlus: 240, note: 'limited-time' },
}

/**
 * Read one model's limit snapshot.
 * @param model - catalog model id.
 * @returns the row, or undefined when the plan page lists no such model.
 */
export function goMonthlyLimit(model: string): GoMonthlyLimit | undefined {
  return Object.hasOwn(GO_MONTHLY_LIMITS, model) ? GO_MONTHLY_LIMITS[model] : undefined
}

/** Models with a documented peak/off-peak tariff (DeepSeek V4.1 Flash and V4 Pro). */
export const PEAK_PRICED_MODELS: ReadonlySet<string> = new Set(['deepseek-v4.1-flash', 'deepseek-v4-pro'])

/**
 * Whether a request started inside the documented DeepSeek peak window:
 * 01:00-04:00 and 06:00-10:00 UTC, Monday through Friday. All other hours,
 * including weekends, are off-peak.
 * @param at - request start time in Unix epoch milliseconds.
 * @returns true when the peak multiplier applies.
 */
export function isPeakPricedAt(at: number): boolean {
  if (!Number.isFinite(at)) return false
  const date = new Date(at)
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false
  const hour = date.getUTCHours()
  return hour >= 1 && hour < 4 || hour >= 6 && hour < 10
}
