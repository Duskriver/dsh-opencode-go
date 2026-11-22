/** Shared multiplier badge formatting and boundary-aware clock hooks for model lists. */
import { useEffect, useState } from 'react'
import {
  accountPlanOf,
  accountsOf,
  DEFAULT_GO_PLAN,
  GO_PLANS,
  type GoModel,
  type GoPlan,
  type OpencodeGoConfig,
  type PriceMultiplier,
} from '../contracts.ts'
import { nextCatalogMultiplierTransitionMs } from '../pricing.ts'
import { estimateModelQuota, formatQuotaMultiplier } from '../quota-estimate.ts'
import { formatTokenCount, type en } from './presentation.ts'

export type MultiplierTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string

export type ModelMultiplierBadge =
  | { readonly kind: 'free'; readonly text: string; readonly title: string; readonly tone: 'free' }
  | {
    readonly kind: 'go'
    readonly text: string
    readonly title: string
    readonly ariaLabel: string
    readonly tone: 'normal' | 'peak'
    readonly isPeak: boolean
  }

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
 * Build the compact list multiplier badge and descriptive tooltip for one model.
 * Returns `undefined` for Free-channel models and models lacking `goMonthlyUsage`
 * or price data, ensuring unreliable fallback numbers are never displayed.
 */
export function resolveModelMultiplierBadge(input: {
  model: GoModel
  plan: GoPlan
  t: MultiplierTranslate
  locale?: string
  nowMs?: number
}): ModelMultiplierBadge | undefined {
  const { model, plan, t, locale, nowMs = Date.now() } = input
  if ((model.source ?? 'go') !== 'go') return undefined
  const estimate = estimateModelQuota({ model, plan, nowMs })
  if (!estimate) return undefined
  if (estimate.kind === 'free') {
    return {
      kind: 'free',
      text: t('modelMultiplierFreeBadge'),
      title: t('modelMultiplierFreeTitle'),
      tone: 'free',
    }
  }
  const text = formatQuotaMultiplier(estimate.quotaMultiplier)
  if (!text) return undefined
  const lines = [
    t('modelMultiplierTooltip', { plan: t(`goPlan_${plan}`), rate: text }),
  ]
  if (estimate.peakFactor !== undefined && estimate.peakQuotaMultiplier !== undefined) {
    const offPeak = formatQuotaMultiplier(estimate.baseQuotaMultiplier)
    const peak = formatQuotaMultiplier(estimate.peakQuotaMultiplier)
    lines.push(t(
      estimate.isPeak ? 'modelMultiplierPeakActiveNote' : 'modelMultiplierPeakScheduleNote',
      { factor: estimate.peakFactor, offPeak, peak },
    ))
  }
  if (estimate.upcomingDateChange !== undefined) {
    lines.push(t('modelMultiplierDateChangeNote', {
      date: estimate.upcomingDateChange.date,
      factor: estimate.upcomingDateChange.factor,
      rate: formatQuotaMultiplier(estimate.upcomingDateChange.quotaMultiplier),
    }))
  }
  if (estimate.hasContextTiers && estimate.minTierThreshold !== undefined) {
    lines.push(t('modelMultiplierTierNote', {
      context: formatTokenCount(estimate.minTierThreshold, locale),
    }))
  }
  return {
    kind: 'go',
    text,
    title: lines.join('\n'),
    ariaLabel: t('modelMultiplierAria', { rate: text }),
    tone: estimate.isPeak ? 'peak' : 'normal',
    isPeak: estimate.isPeak,
  }
}

const MAX_DELAY_MS = 2_147_483_647

function nextUtcMidnightMs(nowMs: number): number {
  const now = new Date(nowMs)
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
}

/**
 * Subscribe to a clock that ticks precisely at the next multiplier transition
 * boundary (and optionally the next UTC midnight for 7-day NEW badges) as well
 * as when the document regains visibility.
 */
export function useScheduledTransitionClock(
  schedules: readonly (readonly PriceMultiplier[] | undefined)[],
  includeUtcMidnight = false,
): number {
  const [now, setNow] = useState(Date.now)
  const scheduleKey = JSON.stringify(schedules.filter(Boolean))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleNext = (currentMs: number): void => {
      const ruleNext = nextCatalogMultiplierTransitionMs(schedules, currentMs)
      const midnightNext = includeUtcMidnight ? nextUtcMidnightMs(currentMs) : undefined
      const target = ruleNext !== undefined && midnightNext !== undefined
        ? Math.min(ruleNext, midnightNext)
        : ruleNext ?? midnightNext
      if (target === undefined) return
      const delay = Math.min(Math.max(100, target - currentMs + 50), MAX_DELAY_MS)
      timer = setTimeout(() => {
        const nextMs = Date.now()
        setNow(nextMs)
        scheduleNext(nextMs)
      }, delay)
    }
    const onVisible = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (timer !== undefined) clearTimeout(timer)
      const nextMs = Date.now()
      setNow(nextMs)
      scheduleNext(nextMs)
    }
    scheduleNext(Date.now())
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    }
    // `scheduleKey` captures structural changes to schedules without needing identity stability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleKey, includeUtcMidnight])
  return now
}
