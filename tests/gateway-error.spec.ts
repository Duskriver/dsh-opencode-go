import { expect, it } from 'vitest'
import { GatewayDiagnostics } from '../src/gateway-diagnostics.ts'

it.each([
  [500, { error: { message: 'upstream request 401 did not complete' } }, 'AUTH', 'SERVER'],
  [500, { error: { message: 'Diagnostic: previous request had insufficient credits' } }, 'QUOTA', 'SERVER'],
  [502, 'insufficient credits', 'QUOTA', 'SERVER'],
  [504, { error: { message: 'insufficient credits' } }, 'QUOTA', 'TIMEOUT'],
  [400, { error: { message: 'insufficient credits' } }, 'QUOTA', 'INVALID_REQUEST'],
  [500, { error: { type: 'CreditsError', message: 'Limit reached' } }, 'SERVER', 'QUOTA'],
  [402, { error: { message: 'insufficient credits' } }, 'AUTH', 'QUOTA'],
  [401, { error: { type: 'ModelError', message: 'invalid API key for this model' } }, 'AUTH', 'UNKNOWN_MODEL'],
  [401, { error: { type: 'AuthError', message: 'Access denied' } }, 'PI_AI_ERROR', 'INVALID_CREDENTIAL'],
  [403, { error: { type: 'RegionError', message: 'Unavailable in region' } }, 'PI_AI_ERROR', 'AUTH'],
  [401, { error: { message: 'insufficient credits' } }, 'AUTH', 'QUOTA'],
  [401, {}, 'AUTH', 'AUTH'],
  [429, { error: { type: 'RateLimitError' } }, 'PI_AI_ERROR', 'RATE_LIMIT'],
  [400, {}, 'CONTEXT_WINDOW_EXCEEDED', 'CONTEXT_WINDOW_EXCEEDED'],
  [400, { error: { code: 'context_length_exceeded', message: 'Limit reached' } }, 'INVALID_REQUEST', 'CONTEXT_WINDOW_EXCEEDED'],
  [422, { error: { type: 'context_window_exceeded', message: 'Limit reached' } }, 'INVALID_REQUEST', 'CONTEXT_WINDOW_EXCEEDED'],
  [400, { message: 'Prompt exceeds the model context window' }, 'INVALID_REQUEST', 'CONTEXT_WINDOW_EXCEEDED'],
  [413, 'request body too large', 'INVALID_REQUEST', 'INVALID_REQUEST'],
  [400, { model: 'deepseek-v4.1-flash' }, 'INVALID_REQUEST', 'INVALID_REQUEST'],
  [502, { error: { message: 'previous request: context_length_exceeded' } }, 'CONTEXT_WINDOW_EXCEEDED', 'SERVER'],
  [504, {}, 'SERVER', 'TIMEOUT'],
] as const)('classifies HTTP %s from captured response evidence', async (status, body, fallback, expected) => {
  const diagnostics = new GatewayDiagnostics({ provider: 'test', model: 'test', apiKey: 'fixture-key',
    fetch: async () => Response.json(body, { status }) })
  await diagnostics.fetch('https://gateway.example/v1')
  expect(await diagnostics.failureCode(fallback)).toBe(expected)
})
