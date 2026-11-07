import { describe, expect, it } from 'vitest'
import { readModelCost } from '../src/pricing.ts'
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
  })
  it.each([null, {}, [{ when: { context: { gt: -1 } }, price: 0 }], [{ when: { context: { gt: 1.5 } }, price: 0 }],
    [{ when: { context: { gt: 1 }, unknown: {} }, price: 0 }], [{ when: { context: { gt: 1 } } }],
  ])('rejects malformed optional context overrides: %j', overrides => {
    expect(readModelCost({ text: { input: { price: 0, overrides }, output: { price: 0 } } })).toBeUndefined()
  })
})

describe('gateway multiplier validation', () => {
  it('keeps a published zero tariff free with valid weekday, date and combined conditions', () => {
    expect(readModelCost({ ...zeroCost(), multipliers: peakMultipliers })?.free).toBe(true)
    const parsed = readModelCost({ ...zeroCost(), multipliers: [
      { when: { date: { gte: '2026-12-01' } }, factor: 2 },
      { when: { all: [{ date: { lt: '2027-01-01' } }, { utc_hours: { gte: '06:00', lt: '10:00' } }] }, factor: 1.5 },
    ] })!
    expect(parsed.free).toBe(true)
  })
  it.each([null, {}, [{ factor: -1, when: { date: { gte: '2026-12-01' } } }],
    [{ factor: 2, when: {} }], [{ factor: 2, when: { unknown: {} } }], [{ factor: 2, when: { any: [] } }],
    [{ factor: 2, when: { date: { gte: '2026-02-30' } } }], [{ factor: 2, when: { utc_hours: { gt: '25:00' } } }],
    [{ factor: 2, when: { utc_days: { in: ['monday'] } } }],
  ])('rejects malformed multipliers, including for zero-cost entries: %j', multipliers => {
    expect(readModelCost({ ...zeroCost(), multipliers })).toBeUndefined()
  })
})
