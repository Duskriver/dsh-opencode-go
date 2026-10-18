import { expect, it } from 'vitest'
import { billedInput, isFreeCost, priceUsage } from '../src/analytics-pricing.ts'

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
