import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { DEFAULT_CONFIG, PlainConfig, assertBaseURL, validateGoConfig } from '../src/config.ts'
import {
  MAX_THINKING_BUDGET_TOKENS,
  PROFILE_ENTRY_ID,
  SETTINGS_NAMESPACE,
  assertProxyURL,
  type OpencodeGoConfig,
} from '../src/contracts.ts'

function config(patch: Partial<OpencodeGoConfig> = {}): OpencodeGoConfig {
  return { ...DEFAULT_CONFIG, ...patch }
}

describe('gateway base URL validation', () => {
  it('normalizes acceptable addresses', () => {
    expect(assertBaseURL('https://gateway.example/v1/')).toBe('https://gateway.example/v1')
    expect(assertBaseURL('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080')
    expect(assertBaseURL('https://opencode.ai/zen/go/v1')).toBe('https://opencode.ai/inference/go/v1')
    expect(assertBaseURL('https://free.example/v1/', 'freeBaseURL')).toBe('https://free.example/v1')
  })

  it.each(['baseURL', 'freeBaseURL'] as const)('rejects embedded credentials in %s without echoing them', field => {
    let message = ''
    try {
      assertBaseURL('https://gateway-user:gateway-super-secret@gateway.example/v1', field)
    } catch (error) {
      message = String(error)
    }
    expect(message).toContain('must not embed credentials')
    expect(message).toContain(field)
    expect(message).not.toContain('gateway-super-secret')
    expect(message).not.toContain('gateway-user:')
  })

  it.each([
    ['not-a-url', /is not a valid URL/],
    ['ftp://gateway.example/v1', /must be http or https/],
    ['https://gateway.example/v1?tenant=1', /must not carry a query or fragment/],
    ['https://gateway.example/v1#frag', /must not carry a query or fragment/],
  ])('keeps rejecting malformed %s', (address, expected) => {
    expect(() => assertBaseURL(address)).toThrow(expected)
  })

  it('does not echo a credential-like fragment from an unparseable URL', () => {
    let message = ''
    try {
      assertBaseURL('not a url gateway-user:gateway-super-secret@host')
    } catch (error) {
      message = String(error)
    }
    expect(message).toContain('[redacted URL]')
    expect(message).not.toContain('gateway-super-secret')
  })

  it('validateGoConfig rejects both base URLs before any request is built', () => {
    expect(() => validateGoConfig(config({ baseURL: 'https://user:secret@gateway.example/v1' })))
      .toThrow(/baseURL must not embed credentials/)
    expect(() => validateGoConfig(config({ freeBaseURL: 'https://user:secret@gateway.example/v1' })))
      .toThrow(/freeBaseURL must not embed credentials/)
    expect(() => validateGoConfig(config())).not.toThrow()
  })
})

describe('proxy URL credentials', () => {
  it('keeps userinfo in proxy addresses and passes configuration validation', () => {
    const proxy = 'socks5://proxy-user:proxy%40pass@proxy.example:1080'
    expect(assertProxyURL(proxy)).toContain('proxy-user')
    expect(() => validateGoConfig(config({ proxyURL: proxy }))).not.toThrow()
    expect(() => validateGoConfig(config({ proxyURL: 'https://plain.example:8443' }))).not.toThrow()
  })
})

describe('thinking budget bounds', () => {
  it('accepts the schema ceiling and rejects values outside it', () => {
    expect(PlainConfig({ modelLimits: { model: { thinkingBudgets: [MAX_THINKING_BUDGET_TOKENS] } } })
      .modelLimits.model?.thinkingBudgets).toEqual([MAX_THINKING_BUDGET_TOKENS])
    expect(() => PlainConfig({ modelLimits: { model: { thinkingBudgets: [MAX_THINKING_BUDGET_TOKENS + 1] } } }))
      .toThrow()
    for (const tokens of [0, -1, 1.5, NaN]) {
      expect(() => PlainConfig({ modelLimits: { model: { thinkingBudgets: [tokens] } } })).toThrow()
    }
  })
})

describe('profile entry identity', () => {
  it('keeps the settings row id in sync with the shipped profile patch entry', async () => {
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    const ids = [...patch.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map(match => match[1])
    // DSH settings addresses rows by Loader profile entry id (entry.options.id),
    // so the constant must track the shipped patch entry, not the service name.
    expect(ids).toContain(PROFILE_ENTRY_ID)
    expect(PROFILE_ENTRY_ID).toBe('opencode-go')
    expect(PROFILE_ENTRY_ID).not.toBe(SETTINGS_NAMESPACE)
    expect(SETTINGS_NAMESPACE).toBe('llm-opencode-go')
  })
})
