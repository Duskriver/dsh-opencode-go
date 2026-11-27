/**
 * The one badge a Go model carries in Host model pickers, published through the
 * Host catalog (`LlmModelInfo.badge`, DSH 0.2.2+).
 *
 * Why a catalog field rather than the picker label alone:
 * `conversation.input.model.label` is a single-occupant slot whose lowest-priority
 * registration renders every provider's rows. This plugin registers at a yielding
 * priority, so whenever another plugin holds the slot its own live label is never
 * called. The catalog badge is the one channel that still reaches the occupant: it
 * is Host data carried on `model.badge`, so the winner can draw Go rows without
 * knowing this plugin (#125).
 */
import {
  DEFAULT_GO_PLAN,
  GO_PLANS,
  accountPlanOf,
  accountsOf,
  type GoModel,
  type GoPlan,
  type OpencodeGoConfig,
} from './contracts.ts'
import { estimateModelQuota, formatQuotaMultiplier } from './quota-estimate.ts'

/** Emphasis of a catalog badge: the four tones the Host `Tag` ships without an outline. */
export type CatalogBadgeTone = 'neutral' | 'info' | 'success' | 'warning'

/**
 * Host catalog badge (`LlmModelInfo.badge`). Declared here because the pinned 0.2.1
 * Host types predate the field; a registry that old drops the key silently.
 */
export interface CatalogBadge {
  /** One literal, or translations keyed by lowercase language id that include `en`. */
  text: string | { readonly en: string; readonly [locale: string]: string }
  tone: CatalogBadgeTone
}

/** The free-model badge in both languages this plugin ships; the Host resolves it per active locale. */
export const FREE_BADGE_TEXT: { readonly en: string; readonly zh: string } = { en: 'Free', zh: '免费' }

/**
 * Resolve the subscription tier of the active account from a settings snapshot,
 * falling back to the profile-level `goPlan` and then `'go'`.
 */
export function resolveActiveGoPlan(settings?: Partial<OpencodeGoConfig>): GoPlan {
  const fallback: GoPlan = settings?.goPlan && (GO_PLANS as readonly string[]).includes(settings.goPlan)
    ? settings.goPlan : DEFAULT_GO_PLAN
  const active = accountsOf(settings ?? {})[0]
  return accountPlanOf(active, fallback)
}

/**
 * The badge one Go model's catalog row carries right now: the same quota fact the
 * plugin's own picker label draws, in the Host's four-tone vocabulary. A Free-channel
 * model, an unpriced model or one without a Go allowance carries none.
 */
export function resolveModelCatalogBadge(input: {
  model: GoModel
  plan: GoPlan
  nowMs?: number
}): CatalogBadge | undefined {
  const { model, plan, nowMs = Date.now() } = input
  if ((model.source ?? 'go') !== 'go') return undefined
  const estimate = estimateModelQuota({ model, plan, nowMs })
  if (!estimate) return undefined
  if (estimate.kind === 'free') return { text: FREE_BADGE_TEXT, tone: 'success' }
  const value = formatQuotaMultiplier(estimate.quotaMultiplier)
  // `warning` is the Host's "attention" tone: a peak window costs more than the row's base rate.
  return value ? { text: value, tone: estimate.isPeak ? 'warning' : 'neutral' } : undefined
}
