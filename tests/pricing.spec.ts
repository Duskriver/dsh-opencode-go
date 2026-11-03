import { describe, expect, it } from 'vitest'
import { readModelCost, priceMultiplierAt, matchesPricingCondition } from '../src/pricing.ts'
import { priceUsage } from '../src/analytics.ts'
import { peakMultipliers, zeroCost } from './support/data.ts'

describe('gateway text tariff validation', () => {
  it.each([undefined, null, 'free', 0, [], {}, { text: {} }, { text: { input: { price: 0 } } },
    { text: { input: { price: '0' }, output: { price: 0 } } }, { text: { input: { price: 0 }, output: { price: null } } },
  ])('never classifies a missing or malformed tariff as free: %j', cost => {
    expect(readModelCost(cost)).toBeUndefined()
  })
  it.each([NaN, Infinity, -1, '0', null])('rejects illegal rates at every billable location: %s', invalid => {
    const tariffs = [
      { text: { input: { price: invalid }, output: { price: 0 } } },
      { text: { input: { price: 0 }, output: { price: invalid } } },
      { text: { input: { price: 0, cache: { read: invalid } }, output: { price: 0 } } },
      { text: { input: { price: 0, cache: { write: invalid } }, output: { price: 0 } } },
      { text: { input: { price: 0, overrides: [{ when: { context: { gt: 10 } }, price: invalid }] }, output: { price: 0 } } },
      { text: { input: { price: 0 }, output: { price: 0, overrides: [{ when: { context: { gt: 10 } }, price: invalid }] } } },
      { text: { input: { price: 0, overrides: [{ when: { context: { gt: 10 } }, cache: { read: invalid } }] }, output: { price: 0 } } },
      { text: { input: { price: 0, overrides: [{ when: { context: { gt: 10 } }, cache: { write: invalid } }] }, output: { price: 0 } } },
    ]
    for (const tariff of tariffs) expect(readModelCost(tariff)).toBeUndefined()
  })
  it('accepts explicitly published zero base prices with omitted caches and zero tiers', () => {
    const parsed = readModelCost({ text: { input: { price: 0, overrides: [{ when: { context: { gt: 10 } }, price: 0 }] }, output: { price: 0 } } })!
    expect(parsed.free).toBe(true)
    expect(parsed.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
      tiers: [{ inputTokensAbove: 10, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }] })
  })
  it('combines independent input/output/cache thresholds with inherited rates and exact boundaries', () => {
    const parsed = readModelCost({ text: {
      input: { price: 1, cache: { read: 0.1, write: 1.25 }, overrides: [
        { when: { context: { gt: 200000 } }, price: 2, cache: { read: 0.2 } },
        { when: { context: { gte: 300001 } }, cache: { write: 5 } },
      ] },
      output: { price: 4, overrides: [{ when: { context: { gt: 250000 } }, price: 8 }] },
    } })!
    expect(parsed.cost.tiers).toEqual([
      { inputTokensAbove: 200000, input: 2, output: 4, cacheRead: 0.2, cacheWrite: 1.25 },
      { inputTokensAbove: 250000, input: 2, output: 8, cacheRead: 0.2, cacheWrite: 1.25 },
      { inputTokensAbove: 300000, input: 2, output: 8, cacheRead: 0.2, cacheWrite: 5 },
    ])
    expect(priceUsage('arbitrary', { input: 200000, output: 10, cacheRead: 0, cacheWrite: 0 }, parsed.cost, 0)).toBe(200040)
    expect(priceUsage('arbitrary', { input: 200000, output: 10, cacheRead: 1, cacheWrite: 0 }, parsed.cost, 0)).toBe(400040)
    expect(priceUsage('arbitrary', { input: 250001, output: 10, cacheRead: 0, cacheWrite: 0 }, parsed.cost, 0)).toBe(500082)
  })
  it.each([null, {}, [{ when: { context: { gt: -1 } }, price: 0 }], [{ when: { context: { gt: 1.5 } }, price: 0 }],
    [{ when: { context: { gt: 1 }, unknown: {} }, price: 0 }], [{ when: { context: { gt: 1 } } }],
  ])('rejects malformed optional context overrides: %j', overrides => {
    expect(readModelCost({ text: { input: { price: 0, overrides }, output: { price: 0 } } })).toBeUndefined()
  })
})

describe('dynamic UTC multipliers', () => {
  it.each([
    ['2026-11-02T00:59:59Z', 1], ['2026-11-02T01:00:00Z', 2], ['2026-11-02T03:59:59Z', 2],
    ['2026-11-02T04:00:00Z', 1], ['2026-11-02T06:00:00Z', 2], ['2026-11-02T09:59:59Z', 2],
    ['2026-11-02T10:00:00Z', 1], ['2026-11-07T02:00:00Z', 1], ['2026-11-08T07:00:00Z', 1],
  ])('evaluates advertised weekday/hour conditions at %s', (time, factor) => {
    const parsed = readModelCost({ ...zeroCost(), multipliers: peakMultipliers })!
    expect(priceMultiplierAt(parsed.multipliers, Date.parse(time))).toBe(factor)
  })
  it('supports date changes, conjunctions and multiple matching factors without model-name rules', () => {
    const parsed = readModelCost({ ...zeroCost(), multipliers: [
      { when: { date: { gte: '2026-12-01' } }, factor: 2 },
      { when: { all: [{ date: { lt: '2027-01-01' } }, { utc_hours: { gte: '06:00', lt: '10:00' } }] }, factor: 1.5 },
    ] })!
    expect(priceMultiplierAt(parsed.multipliers, Date.parse('2026-11-30T23:59:59Z'))).toBe(1)
    expect(priceMultiplierAt(parsed.multipliers, Date.parse('2026-12-01T06:00:00Z'))).toBe(3)
    expect(priceMultiplierAt(parsed.multipliers, Date.parse('2027-01-01T06:00:00Z'))).toBe(2)
    const cost = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, multipliers: parsed.multipliers }
    expect(priceUsage('future-model', { input: 100, output: 100, cacheRead: 0, cacheWrite: 0 }, cost, Date.parse('2026-12-01T06:00:00Z'))).toBe(600)
  })
  it.each([null, {}, [{ factor: -1, when: { date: { gte: '2026-12-01' } } }],
    [{ factor: 2, when: {} }], [{ factor: 2, when: { unknown: {} } }], [{ factor: 2, when: { any: [] } }],
    [{ factor: 2, when: { date: { gte: '2026-02-30' } } }], [{ factor: 2, when: { utc_hours: { gt: '25:00' } } }],
    [{ factor: 2, when: { utc_days: { in: ['monday'] } } }],
  ])('rejects malformed multipliers, including for zero-cost entries: %j', multipliers => {
    expect(readModelCost({ ...zeroCost(), multipliers })).toBeUndefined()
  })
  it('handles invalid timestamps without matching a condition', () => {
    expect(matchesPricingCondition({ date: { gte: '2026-01-01' } }, NaN)).toBe(false)
    expect(matchesPricingCondition({ utc_days: { in: ['mon'] } }, Infinity)).toBe(false)
  })
})
