import { describe, expect, it } from 'vitest'
import {
  QUOTA_WORKLOAD_TOKENS,
  STANDARD_QUOTA_SHARE,
  effectiveUsageRemainingRatio,
  estimateModelQuota,
  estimateRequestCostUsd,
  formatQuotaMultiplier,
  TYPICAL_REQUEST_TOKENS,
} from '../src/quota-estimate.ts'
import type { GoModel, GoUsage } from '../src/contracts.ts'
import { peakMultipliers } from './support/data.ts'

const resetsAt = '2026-11-20T00:00:00Z'

const usageOf = (rolling: number, weekly: number, monthly: number, limited = false): GoUsage => ({
  rolling: { status: limited ? 'rate-limited' : 'ok', percent: rolling, resetsAt },
  weekly: { status: 'ok', percent: weekly, resetsAt },
  monthly: { status: 'ok', percent: monthly, resetsAt },
})

const deepseekPro: GoModel = {
  id: 'deepseek-v4-pro',
  name: 'DeepSeek V4 Pro',
  source: 'go',
  price: { input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: 0, multipliers: true },
  goMonthlyUsage: { go: 15, 'go-plus': 60, 'go-teams': 20 },
  pricingMultipliers: peakMultipliers,
}

describe('effectiveUsageRemainingRatio', () => {
  it('picks the tightest window among 20% rolling, 50% weekly and 100% monthly', () => {
    expect(effectiveUsageRemainingRatio(usageOf(50, 20, 10))).toEqual({
      ratio: 0.1, bottleneck: 'rolling', limited: false,
    })
    expect(effectiveUsageRemainingRatio(usageOf(0, 90, 10))).toEqual({
      ratio: 0.05, bottleneck: 'weekly', limited: false,
    })
    expect(effectiveUsageRemainingRatio(usageOf(0, 0, 95))).toEqual({
      ratio: 0.05, bottleneck: 'monthly', limited: false,
    })
    expect(effectiveUsageRemainingRatio(usageOf(0, 0, 0, true))).toEqual({
      ratio: 0, bottleneck: 'rolling', limited: true,
    })
  })
})

describe('estimateRequestCostUsd', () => {
  it('weights a typical cached coding request and falls back to input price when cacheRead is zero', () => {
    const expectedPro = (
      TYPICAL_REQUEST_TOKENS.input * 0.66
      + TYPICAL_REQUEST_TOKENS.cacheRead * 0.022
      + TYPICAL_REQUEST_TOKENS.output * 1.98
    ) / 1_000_000
    expect(estimateRequestCostUsd(deepseekPro.price)).toBeCloseTo(expectedPro, 10)

    const uncached = estimateRequestCostUsd({ input: 1, output: 3, cacheRead: 0, cacheWrite: 0 })
    const expectedUncached = (
      (TYPICAL_REQUEST_TOKENS.input + TYPICAL_REQUEST_TOKENS.cacheRead) * 1
      + TYPICAL_REQUEST_TOKENS.output * 3
    ) / 1_000_000
    expect(uncached).toBeCloseTo(expectedUncached, 10)
  })
})

describe('estimateModelQuota', () => {
  it('computes 5h/weekly/monthly full request specs and live remaining requests across plans and peak windows', () => {
    const offPeak = Date.parse('2026-11-16T05:00:00Z') // Monday 05:00 UTC (1x)
    const peak = Date.parse('2026-11-16T02:00:00Z') // Monday 02:00 UTC (2x)
    const halfUsed = usageOf(50, 0, 0) // 50% of 5h window spent -> $1.50 left on $15 model
    const reqUsd = estimateRequestCostUsd(deepseekPro.price)!

    const goOffPeak = estimateModelQuota({ model: deepseekPro, plan: 'go', usage: halfUsed, nowMs: offPeak })!
    expect(goOffPeak.kind).toBe('go')
    if (goOffPeak.kind !== 'go') throw new Error('expected go estimate')
    expect(goOffPeak.monthlyUsd).toBe(15)
    expect(goOffPeak.peakFactor).toBe(2)
    expect(goOffPeak.multiplier).toBe(1)
    expect(goOffPeak.fullRequests).toEqual({
      rolling: Math.floor(3 / reqUsd),
      weekly: Math.floor(7.5 / reqUsd),
      monthly: Math.floor(15 / reqUsd),
    })
    expect(goOffPeak.remainingRequests).toBe(Math.floor(1.5 / reqUsd))

    // Peak 2x halves live remaining calls while keeping full-capacity specs at base 1x.
    const goPeak = estimateModelQuota({ model: deepseekPro, plan: 'go', usage: halfUsed, nowMs: peak })!
    if (goPeak.kind !== 'go') throw new Error('expected go estimate')
    expect(goPeak.multiplier).toBe(2)
    expect(goPeak.fullRequests).toEqual(goOffPeak.fullRequests)
    expect(goPeak.remainingRequests).toBe(Math.floor(1.5 / (reqUsd * 2)))

    // Go Plus increases monthly limit from $15 to $60 (4x).
    const plusOffPeak = estimateModelQuota({ model: deepseekPro, plan: 'go-plus', usage: usageOf(0, 0, 0), nowMs: offPeak })!
    if (plusOffPeak.kind !== 'go') throw new Error('expected go estimate')
    expect(plusOffPeak.monthlyUsd).toBe(60)
    expect(plusOffPeak.fullRequests.rolling).toBe(Math.floor(12 / reqUsd))
    expect(plusOffPeak.remainingRequests).toBe(Math.floor(12 / reqUsd))
  })

  it('returns zero remaining requests when rate-limited', () => {
    const offPeak = Date.parse('2026-11-16T05:00:00Z')
    const est = estimateModelQuota({ model: deepseekPro, plan: 'go', usage: usageOf(100, 0, 0, true), nowMs: offPeak })!
    expect(est.kind).toBe('go')
    if (est.kind !== 'go') throw new Error('expected go estimate')
    expect(est.limited).toBe(true)
    expect(est.remainingRequests).toBe(0)
  })

  it('returns free for zero-cost or free-channel models', () => {
    expect(estimateModelQuota({
      model: { id: 'hy4-flash-free', source: 'free', price: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
      plan: 'go',
    })).toEqual({ kind: 'free' })
  })

  it('computes normalized quotaMultiplier, context tiers and separates date rules from recurring peak schedules', () => {
    const offPeak = Date.parse('2026-11-16T05:00:00Z')
    const peak = Date.parse('2026-11-16T02:00:00Z')
    const estOff = estimateModelQuota({ model: deepseekPro, plan: 'go', nowMs: offPeak })!
    const estPeak = estimateModelQuota({ model: deepseekPro, plan: 'go', nowMs: peak })!
    if (estOff.kind !== 'go' || estPeak.kind !== 'go') throw new Error('expected go estimate')
    const expectedBase = (estOff.requestUsd / 15) / STANDARD_QUOTA_SHARE
    expect(estOff.isPeak).toBe(false)
    expect(estOff.quotaMultiplier).toBeCloseTo(expectedBase, 8)
    expect(estOff.peakQuotaMultiplier).toBeCloseTo(expectedBase * 2, 8)
    expect(estPeak.isPeak).toBe(true)
    expect(estPeak.quotaMultiplier).toBeCloseTo(expectedBase * 2, 8)

    const argonLike: GoModel = {
      id: 'gemini-4-argon',
      source: 'go',
      price: {
        input: 2,
        output: 12,
        cacheRead: 0.2,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 100_000, input: 4, output: 24, cacheRead: 0.4, cacheWrite: 0 }],
      },
      goMonthlyUsage: { go: 15, 'go-plus': 60, 'go-teams': 20 },
      pricingMultipliers: [{ when: { date: { gte: '2026-12-01' } }, factor: 2 }],
    }
    const beforeDate = estimateModelQuota({ model: argonLike, plan: 'go', nowMs: Date.parse('2026-11-30T12:00:00Z') })!
    const afterDate = estimateModelQuota({ model: argonLike, plan: 'go', nowMs: Date.parse('2026-12-01T12:00:00Z') })!
    if (beforeDate.kind !== 'go' || afterDate.kind !== 'go') throw new Error('expected go estimate')
    expect(beforeDate.peakFactor).toBeUndefined()
    expect(beforeDate.isPeak).toBe(false)
    expect(beforeDate.hasContextTiers).toBe(true)
    expect(beforeDate.minTierThreshold).toBe(100_000)
    expect(beforeDate.upcomingDateChange).toMatchObject({ date: '2026-12-01', factor: 2 })
    expect(afterDate.peakFactor).toBeUndefined()
    expect(afterDate.isPeak).toBe(false)
    expect(afterDate.multiplier).toBe(2)
    expect(afterDate.quotaMultiplier).toBeCloseTo(beforeDate.quotaMultiplier * 2, 8)
    expect(afterDate.fullRequests.monthly).toBeLessThan(beforeDate.fullRequests.monthly)
  })

  it('formats quota multipliers with compact precision tiers', () => {
    expect(formatQuotaMultiplier(0.004)).toBe('<0.01×')
    expect(formatQuotaMultiplier(0.304)).toBe('0.30×')
    expect(formatQuotaMultiplier(8.396)).toBe('8.40×')
    expect(formatQuotaMultiplier(9.996)).toBe('10.0×')
    expect(formatQuotaMultiplier(42.14)).toBe('42.1×')
    expect(formatQuotaMultiplier(99.96)).toBe('100×')
  })

  it('supports chat, coding and agent workload profiles and applies context tiers when crossed', () => {
    const offPeak = Date.parse('2026-11-16T05:00:00Z')
    const chatEst = estimateModelQuota({ model: deepseekPro, plan: 'go', nowMs: offPeak, profile: 'chat' })!
    const codingEst = estimateModelQuota({ model: deepseekPro, plan: 'go', nowMs: offPeak, profile: 'coding' })!
    const agentEst = estimateModelQuota({ model: deepseekPro, plan: 'go', nowMs: offPeak, profile: 'agent' })!
    if (chatEst.kind !== 'go' || codingEst.kind !== 'go' || agentEst.kind !== 'go') throw new Error('expected go')
    expect(chatEst.fullRequests.monthly).toBeGreaterThan(codingEst.fullRequests.monthly)
    expect(codingEst.fullRequests.monthly).toBeGreaterThan(agentEst.fullRequests.monthly)

    const tieredModel: GoModel = {
      id: 'tiered-agent',
      source: 'go',
      price: {
        input: 2,
        output: 10,
        cacheRead: 0.2,
        cacheWrite: 0,
        tiers: [{ inputTokensAbove: 100_000, input: 4, output: 20, cacheRead: 0.4, cacheWrite: 0 }],
      },
      goMonthlyUsage: { go: 15, 'go-plus': 60, 'go-teams': 20 },
    }
    const expectedAgentUsd = (
      QUOTA_WORKLOAD_TOKENS.agent.input * 4
      + QUOTA_WORKLOAD_TOKENS.agent.cacheRead * 0.4
      + QUOTA_WORKLOAD_TOKENS.agent.output * 20
    ) / 1_000_000
    expect(estimateRequestCostUsd(tieredModel.price, 'agent')).toBeCloseTo(expectedAgentUsd, 10)
  })
})
