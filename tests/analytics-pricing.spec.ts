import { describe, expect, it } from 'vitest'
import { billedInput, isFreeCost, priceUsage } from '../src/analytics-pricing.ts'
import { readModelMetadata } from '../src/model-metadata.ts'
import { metadataDocument, modelMetadata } from './support/model-metadata.ts'

const flash = { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 }
const mondayOffPeak = Date.UTC(2026, 9, 19, 0, 30)
const mondayPeak = Date.UTC(2026, 9, 19, 2, 0)
const saturdayPeakHours = Date.UTC(2026, 9, 17, 2, 0)
const oneMillionEach = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0 }

it('prices tokens at catalog rates in micro-USD', () => {
  expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, mondayOffPeak)).toBe(753_000)
  expect(billedInput(oneMillionEach)).toBe(2_000_000)
})

it('doubles DeepSeek only inside the documented UTC peak windows', () => {
  expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, mondayPeak)).toBe(1_506_000)
  expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, Date.UTC(2026, 9, 19, 4, 0))).toBe(753_000)
  expect(priceUsage('deepseek-v4.1-flash', oneMillionEach, flash, saturdayPeakHours)).toBe(753_000)
  expect(priceUsage('glm-5.3', oneMillionEach, flash, mondayPeak)).toBe(753_000)
})

it('uses the highest matching context tier for the whole request', () => {
  const qwen = {
    input: 0.4, output: 1.6, cacheRead: 0.04, cacheWrite: 0.5,
    tiers: [{ inputTokensAbove: 256_000, input: 1.2, output: 4.8, cacheRead: 0.12, cacheWrite: 1.5 }],
  }
  const usage = { input: 300_000, output: 1_000, cacheRead: 0, cacheWrite: 0 }
  expect(priceUsage('qwen3.7-plus', usage, qwen, mondayOffPeak)).toBe(364_800)
  expect(priceUsage('qwen3.7-plus', { ...usage, input: 256_000 }, qwen, mondayOffPeak))
    .toBe(104_000)
})

it('treats an all-zero cost as free and never charges past it', () => {
  const free = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  expect(isFreeCost(free)).toBe(true)
  expect(isFreeCost({ ...free, tiers: [{ inputTokensAbove: 1, ...free }] })).toBe(true)
  expect(priceUsage('longcat-2.5-preview-free', oneMillionEach, free, mondayPeak)).toBe(0)
  expect(isFreeCost(flash)).toBe(false)
})

describe('catalog metadata distinguishes unknown prices from genuinely free ones', () => {
  const base = 'https://gateway.example/v1'

  it('marks a missing or non-object cost block instead of reading it as free', () => {
    const result = readModelMetadata(metadataDocument({
      'no-cost-block': modelMetadata({ cost: undefined }),
      'non-object-cost': modelMetadata({ cost: 'free' }),
    }), base, new Map())
    expect(result.details.get('no-cost-block')?.costKnown).toBe(false)
    expect(result.details.get('non-object-cost')?.costKnown).toBe(false)
    // Neither route may make the model unavailable or drop its required cost:
    // the unpriced decision belongs to the analytics price book, not the catalog.
    for (const id of ['no-cost-block', 'non-object-cost']) {
      expect(result.errors.get(id)).toBeUndefined()
      expect(result.models.get(id)?.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
    }
  })

  it('marks a malformed rate component while the surviving components still parse', () => {
    const result = readModelMetadata(metadataDocument({
      'half-cost-model': modelMetadata({ cost: { input: 0.15, output: 'n/a', cache_read: 0.003, cache_write: 0 } }),
      'negative-cost': modelMetadata({ cost: { input: -1, output: 0.6, cache_read: 0, cache_write: 0 } }),
      'null-component': modelMetadata({ cost: { input: 0.15, output: 0.6, cache_read: null, cache_write: 0 } }),
    }), base, new Map())
    expect(result.details.get('half-cost-model')?.costKnown).toBe(false)
    expect(result.details.get('negative-cost')?.costKnown).toBe(false)
    expect(result.details.get('null-component')?.costKnown).toBe(false)
    for (const id of ['half-cost-model', 'negative-cost', 'null-component']) {
      expect(result.errors.get(id)).toBeUndefined()
      expect(result.models.get(id)).toHaveProperty('cost')
    }
    // Existing folding is unchanged: legal components keep their values, bad ones read 0.
    expect(result.models.get('half-cost-model')?.cost).toMatchObject({ input: 0.15, output: 0, cacheRead: 0.003 })
  })

  it('keeps a published all-zero block unmarked so free models stay unlimited', () => {
    const result = readModelMetadata(metadataDocument({
      // cache_write absent: an absent component folds to 0 and stays legal.
      'free-partial': modelMetadata({}),
      'free-explicit': modelMetadata({ cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } }),
    }), base, new Map())
    for (const id of ['free-partial', 'free-explicit']) {
      expect(result.details.get(id)?.costKnown).toBeUndefined()
      expect(result.errors.get(id)).toBeUndefined()
      // The documented free path survives: analytics keeps pricing these at 0.
      expect(isFreeCost(result.models.get(id)!.cost)).toBe(true)
    }
  })
})
