import { expect, it } from 'vitest'
import { requestMaxTokens } from '../src/request-budget.ts'

const model = { id: 'deepseek-v4.1-flash', contextWindow: 1_000_000, maxTokens: 384_000 }

it('reserves a bounded share of the window instead of the model output ceiling', () => {
  expect(requestMaxTokens(model, {})).toBe(32_768)
  expect(requestMaxTokens({ ...model, contextWindow: 262_144 }, {})).toBe(16_384)
  // A window too small for the share keeps the host default out of the prompt budget.
  expect(requestMaxTokens({ ...model, contextWindow: 8_192, maxTokens: 4_096 }, {})).toBe(1_024)
  // A model that declares no output ceiling falls back to the share.
  expect(requestMaxTokens({ ...model, maxTokens: null }, {})).toBe(32_768)
  // Never above whatever the model itself declares.
  expect(requestMaxTokens({ ...model, contextWindow: 4_000_000, maxTokens: 8_192 }, {})).toBe(8_192)
})

it('lets a settings override set the answer budget and cap the caller', () => {
  const limits = { 'deepseek-v4.1-flash': { maxTokens: 131_072 } }
  expect(requestMaxTokens(model, limits)).toBe(131_072)
  expect(requestMaxTokens(model, limits, 8_192)).toBe(8_192)
  expect(requestMaxTokens(model, { 'deepseek-v4.1-flash': { maxTokens: 1_024 } }, 8_192)).toBe(1_024)
  // A null override returns the model to its catalog capacity.
  expect(requestMaxTokens(model, { 'deepseek-v4.1-flash': { maxTokens: null } })).toBe(32_768)
})

it('never exceeds the cap the host materialized for this request', () => {
  expect(requestMaxTokens(model, {}, 8_192)).toBe(8_192)
  expect(requestMaxTokens(model, {}, 384_000)).toBe(32_768)
})
