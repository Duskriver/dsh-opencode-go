import { describe, expect, it, vi } from 'vitest'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { FreeChannelState } from '../src/free-channel.ts'
import { classifyFreeGatewayError, retryAfterDeadline } from '../src/free-policy.ts'
import { GatewayDiagnostics, classifyGatewayError } from '../src/transport.ts'
import { goRemote } from '../src/contracts.ts'
import { apply } from '../src/index.ts'
import { context, configOf, drain, mountRemotes, requestOf } from './support/host.ts'
import { mockGateway, listingBody, textEvents } from './support/gateway.ts'

const freeRequest = () => requestOf({ provider: 'dsh-opencode-free', model: 'beam-free' })
const quota = JSON.stringify({ error: { type: 'FreeUsageLimitError', message: 'Free usage limit reached. Free models work in OpenCode.' } })

describe('Free classification and Retry-After', () => {
  it.each([
    [429, quota, 'FREE_QUOTA'],
    [403, '{"error":{"message":"Free models are only available in OpenCode"}}', 'FREE_CLIENT_RESTRICTED'],
    [403, '<html>Access denied</html>', 'FREE_ACCESS_DENIED'],
    [429, '{"error":{"type":"RateLimitError"}}', 'FREE_RATE_LIMIT'],
    [429, '{"error":{"type":"GoUsageLimitError"}}', undefined],
    [403, '{"error":{"type":"AuthError"}}', undefined],
    [403, '{"error":{"message":"invalid key"}}', undefined],
  ])('classifies %s %s without modifying Go semantics', (status, body, expected) => {
    expect(classifyFreeGatewayError(status as number, body as string)).toBe(expected)
  })
  it('keeps Go account quota and rate-limit codes unchanged', () => {
    expect(classifyGatewayError(429, quota, 'UNKNOWN')).toBe('QUOTA')
    expect(classifyGatewayError(429, '{"error":{"type":"GoUsageLimitError"}}', 'UNKNOWN')).toBe('QUOTA')
    expect(classifyGatewayError(429, '{}', 'UNKNOWN')).toBe('RATE_LIMIT')
  })
  it('accepts long delta-seconds and dates, including server clock skew and expired dates', () => {
    const now = Date.UTC(2026, 10, 6, 12)
    expect(retryAfterDeadline('53305', now)).toBe(now + 53_305_000)
    expect(retryAfterDeadline('0', now)).toBe(now)
    expect(retryAfterDeadline(new Date(now + 90_000).toUTCString(), now)).toBe(now + 90_000)
    expect(retryAfterDeadline(new Date(now + 90_000).toUTCString(), now, new Date(now + 30_000).toUTCString())).toBe(now + 60_000)
    expect(retryAfterDeadline(new Date(now - 90_000).toUTCString(), now)).toBe(now)
  })
  it.each([null, '', '-1', '1.5', 'tomorrow', '2026', 'NaN', '999999999999999999999', 'Wed, invalid'])('handles invalid or ambiguous headers safely (%s)', raw => {
    // Digits always mean seconds, never a year.
    expect(retryAfterDeadline(raw, 1000)).toBe(raw === '2026' ? 2_027_000 : undefined)
  })
  it('classifies a Free transport failure for passive backoff', async () => {
    const diagnostics = new GatewayDiagnostics({ provider: 'free', model: 'beam-free', apiKey: 'secret', free: true,
      fetch: async () => { throw new TypeError('network failure with secret') } })
    await expect(diagnostics.fetch('http://127.0.0.1')).rejects.toThrow()
    expect(await diagnostics.failureCode('PI_AI_ERROR')).toBe('NETWORK')
  })
})

describe('Free channel backoff state', () => {
  const config = configOf('https://go.example/v1', { freeBaseURL: 'https://free.example/v1', accounts: [] })
  it('isolates endpoints and proxy credentials and expires lazily', () => {
    const state = new FreeChannelState()
    const proxy = { ...config, proxyURL: 'http://user:password@proxy.example:8080' }
    const now = Date.now()
    state.finish(state.begin(proxy), { outcome: 'error', code: 'FREE_QUOTA', retryAt: now + 53_305_000 })
    expect(state.cooldownUntil(proxy)).toBe(now + 53_305_000)
    expect(state.cooldownUntil(config)).toBeUndefined()
    expect(state.cooldownUntil({ ...proxy, proxyURL: 'http://user:other@proxy.example:8080' })).toBeUndefined()
    expect(state.cooldownUntil({ ...proxy, freeBaseURL: 'https://other.example/v1' })).toBeUndefined()
    expect(() => state.assertReady(proxy)).toThrow(/cooling down/)
    vi.spyOn(Date, 'now').mockReturnValue(now + 53_306_000)
    expect(state.cooldownUntil(proxy)).toBeUndefined()
    expect(() => state.assertReady(proxy)).not.toThrow()
  })
  it('uses bounded exponential fallback, does not penalize cancellations, and resets on success', () => {
    const state = new FreeChannelState(), now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    for (let n = 0; n < 6; n++) {
      state.finish(state.begin(config), { outcome: 'error', code: 'FREE_RATE_LIMIT' })
      expect(state.cooldownUntil(config)).toBe(now + Math.min(60_000 * 2 ** n, 900_000))
    }
    state.finish(state.begin(config), { outcome: 'aborted' })
    expect(state.cooldownUntil(config)).toBe(now + 900_000)
    vi.mocked(Date.now).mockReturnValue(now + 901_000)
    state.finish(state.begin(config), { outcome: 'success' })
    expect(state.cooldownUntil(config)).toBeUndefined()
    state.finish(state.begin(config), { outcome: 'error', code: 'NETWORK' })
    expect(state.cooldownUntil(config)).toBe(now + 961_000)
  })
  it('does not let an older in-flight success clear a newer cooldown', () => {
    const state = new FreeChannelState()
    const older = state.begin(config), newer = state.begin(config)
    state.finish(newer, { outcome: 'error', code: 'FREE_QUOTA' })
    state.finish(older, { outcome: 'success' })
    expect(state.cooldownUntil(config)).toBeGreaterThan(Date.now())
  })
  it('honors a late limiting response when a concurrent request already succeeded', () => {
    const state = new FreeChannelState()
    const older = state.begin(config), newer = state.begin(config)
    state.finish(newer, { outcome: 'success' })
    state.finish(older, { outcome: 'error', code: 'FREE_QUOTA' })
    expect(state.cooldownUntil(config)).toBeGreaterThan(Date.now())
  })
})

describe('Free backoff through normal Host requests', () => {
  it('honors long Retry-After without diagnostic RPCs and leaves Go streaming available', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'saved-go-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(['beam-free']) })
    const ctx = context(); await mountRemotes(ctx); await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url, { freeBaseURL: gateway.url }))
    await vi.waitFor(() => expect(ctx.llm.listProviders().map(provider => provider.id)).toContain('dsh-opencode-free'))
    expect(goRemote.descriptors.some(descriptor => descriptor.namespace === 'opencodeGoFree')).toBe(false)
    expect(gateway.paths).toHaveLength(0)
    gateway.pushCompletions({ status: 429, body: quota, headers: { 'retry-after': '53305' } })
    const before = Date.now(), result = await drain(ctx.llm.stream(freeRequest()))
    expect(result.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'FREE_QUOTA' } } })
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer saved-go-key')
    const cooldown = await drain(ctx.llm.stream(freeRequest()))
    expect(cooldown.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'FREE_COOLDOWN' } } })
    const message = JSON.stringify(cooldown)
    const until = message.match(/cooling down until ([0-9TZ:.-]+)/)?.[1]
    expect(Date.parse(until!)).toBeGreaterThanOrEqual(before + 53_305_000)
    expect(message).not.toMatch(/diagnostic|OpenCode Go settings/i)
    expect(gateway.bodies).toHaveLength(1)
    gateway.pushCompletions({ events: textEvents })
    const chunks = await drain(ctx.llm.stream({ ...freeRequest(), provider: 'dsh-opencode-go' }))
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer saved-go-key')
    expect((await drain(ctx.llm.stream(freeRequest()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'FREE_COOLDOWN' } } })
  })
})
