import { describe, expect, it } from 'vitest'
import { FREE_BADGE_TEXT, resolveActiveGoPlan, resolveModelCatalogBadge } from '../src/model-badge.ts'
import type { GoModel } from '../src/contracts.ts'
import { peakMultipliers } from './support/data.ts'

// peakMultipliers double the rate on weekdays between 01:00–04:00 and 06:00–10:00 UTC.
const MONDAY_OFF_PEAK = Date.parse('2026-11-16T00:59:30Z')
const MONDAY_PEAK = Date.parse('2026-11-16T01:00:00Z')
const SUNDAY = Date.parse('2026-11-22T12:00:00Z')

const priced: GoModel = {
  id: 'priced', name: 'Priced', source: 'go',
  price: { input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: 0, multipliers: true },
  goMonthlyUsage: { go: 15, 'go-plus': 60, 'go-teams': 20 },
  pricingMultipliers: peakMultipliers,
}
const free: GoModel = { id: 'free', name: 'Free', source: 'go', price: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }

describe('resolveModelCatalogBadge', () => {
  it('states the live quota fact in the four tones the host ships', () => {
    expect(FREE_BADGE_TEXT).toEqual({ en: 'Free', zh: '免费' })
    expect(resolveModelCatalogBadge({ model: free, plan: 'go' })).toEqual({ text: { en: 'Free', zh: '免费' }, tone: 'success' })
    expect(resolveModelCatalogBadge({ model: priced, plan: 'go', nowMs: MONDAY_OFF_PEAK })).toEqual({ text: '8.40×', tone: 'neutral' })
    expect(resolveModelCatalogBadge({ model: priced, plan: 'go', nowMs: MONDAY_PEAK })).toEqual({ text: '16.8×', tone: 'warning' })
    expect(resolveModelCatalogBadge({ model: priced, plan: 'go-plus', nowMs: MONDAY_PEAK })).toEqual({ text: '4.20×', tone: 'warning' })
    expect(resolveModelCatalogBadge({ model: priced, plan: 'go-plus', nowMs: SUNDAY })).toEqual({ text: '2.10×', tone: 'neutral' })
  })

  it('carries no badge for unpriced models, models without a Go allowance and Free-channel rows', () => {
    expect(resolveModelCatalogBadge({ model: { ...priced, goMonthlyUsage: undefined }, plan: 'go' })).toBeUndefined()
    expect(resolveModelCatalogBadge({ model: { id: 'bare', source: 'go' }, plan: 'go' })).toBeUndefined()
    expect(resolveModelCatalogBadge({ model: { ...free, source: 'free' }, plan: 'go' })).toBeUndefined()
  })
})

describe('resolveActiveGoPlan', () => {
  it('reads the current account tier, then the profile default, then the base plan', () => {
    const teams = { id: 'a', name: 'Teams', apiKeyEnv: 'K_A', plan: 'go-teams' as const }
    const plus = { id: 'b', name: 'Plus', apiKeyEnv: 'K_B', plan: 'go-plus' as const }
    expect(resolveActiveGoPlan({ apiKeyEnv: 'K_B', accounts: [teams, plus] })).toBe('go-plus')
    expect(resolveActiveGoPlan({ apiKeyEnv: 'K_A', accounts: [teams, plus] })).toBe('go-teams')
    expect(resolveActiveGoPlan({ apiKeyEnv: 'K_A', goPlan: 'go-plus', accounts: [{ id: 'a', name: 'A', apiKeyEnv: 'K_A' }] })).toBe('go-plus')
    expect(resolveActiveGoPlan({ apiKeyEnv: 'K_A', goPlan: 'go-plus', accounts: [{ id: 'a', name: 'A', apiKeyEnv: 'K_A', plan: 'lite' as never }] }))
      .toBe('go-plus')
    expect(resolveActiveGoPlan({ goPlan: 'gold' as never })).toBe('go')
    expect(resolveActiveGoPlan({})).toBe('go')
    expect(resolveActiveGoPlan()).toBe('go')
  })
})
