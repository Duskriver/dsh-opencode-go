import { afterEach, expect, it, vi } from 'vitest'
import { OpencodeGoCatalog } from '../src/catalog.ts'
import { withConsentGuidance } from '../src/gateway-error.ts'
import { isContributorModel } from '../src/models-contract.ts'
import { readModelMetadata } from '../src/model-metadata.ts'
import { closeMockGateways, listingBody, mockGateway } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

const networkFetch = globalThis.fetch
const GATEWAY = 'https://opencode.ai/zen/go/v1'
const GOOGLE_ID = 'gemini-4-argon-contributor'

function googleDocument(providerApi?: string, effortValues: readonly string[] = ['low', 'medium', 'high']): Record<string, unknown> {
  return metadataDocument({
    [GOOGLE_ID]: modelMetadata({
      name: 'Gemini 4 Argon Contributor',
      provider: { npm: '@ai-sdk/google' },
      reasoning_options: [{ type: 'effort', values: [...effortValues] }],
    }),
  }, providerApi === undefined ? {} : { api: providerApi })
}

it('converts a google-npm model on the same registrable domain, keeping the recorded /v1 endpoint', () => {
  const { models, errors } = readModelMetadata(googleDocument('https://opencode.ai/inference/go/v1'), GATEWAY, new Map())
  expect(errors.size).toBe(0)
  const model = models.get(GOOGLE_ID)
  expect(model?.api).toBe('google-generative-ai')
  expect(model?.baseUrl).toBe('https://opencode.ai/inference/go/v1')
  expect(model?.reasoningControl).toBe('effort')
  expect(model?.thinkingLevelMap).toMatchObject({ low: 'low', medium: 'medium', high: 'high', off: null })
})

it('refuses a recorded endpoint outside the configured gateway registrable domain', () => {
  const { models, errors } = readModelMetadata(googleDocument('https://evil.example.org/v1'), GATEWAY, new Map())
  expect(models.has(GOOGLE_ID)).toBe(false)
  expect(errors.get(GOOGLE_ID)).toContain("outside the configured gateway's domain")
  expect(errors.get(GOOGLE_ID)).toContain('https://evil.example.org/v1')
})

it('reports a google model whose catalog record carries no provider endpoint', () => {
  const { models, errors } = readModelMetadata(googleDocument(), GATEWAY, new Map())
  expect(models.has(GOOGLE_ID)).toBe(false)
  expect(errors.get(GOOGLE_ID)).toContain('records no provider endpoint')
})

it('reports a recorded endpoint that is not a valid URL', () => {
  const { models, errors } = readModelMetadata(googleDocument('not a url'), GATEWAY, new Map())
  expect(models.has(GOOGLE_ID)).toBe(false)
  expect(errors.get(GOOGLE_ID)).toContain('not a valid URL')
})

it('treats distinct multi-label public suffix domains as different registrable domains', () => {
  const { models, errors } = readModelMetadata(googleDocument('https://bar.co.uk/v1'), 'https://foo.co.uk/v1', new Map())
  expect(models.has(GOOGLE_ID)).toBe(false)
  expect(errors.get(GOOGLE_ID)).toContain("outside the configured gateway's domain")
})

it('matches IP-literal gateways only by exact address', () => {
  // 127.0.0.1 and 10.0.0.1 reduce to the same two labels without the literal rule.
  const denied = readModelMetadata(googleDocument('http://10.0.0.1/v1'), 'http://127.0.0.1:3000/v1', new Map())
  expect(denied.models.has(GOOGLE_ID)).toBe(false)
  expect(denied.errors.get(GOOGLE_ID)).toContain("outside the configured gateway's domain")
  const same = readModelMetadata(googleDocument('http://127.0.0.1:9999/v1'), 'http://127.0.0.1:3000/v1', new Map())
  expect(same.errors.size).toBe(0)
  expect(same.models.get(GOOGLE_ID)?.baseUrl).toBe('http://127.0.0.1:9999/v1')
})

it('strips credentials from a recorded endpoint before it becomes a baseUrl', () => {
  const { models, errors } = readModelMetadata(googleDocument('https://user:pass@opencode.ai/inference/go/v1'), GATEWAY, new Map())
  expect(errors.size).toBe(0)
  expect(models.get(GOOGLE_ID)?.baseUrl).toBe('https://opencode.ai/inference/go/v1')
})

it('keeps the configured gateway baseUrl for non-google models even when an endpoint is recorded', () => {
  const document = metadataDocument({ 'kimi-k3': modelMetadata({ name: 'Kimi K3' }) }, { api: 'https://opencode.ai/inference/go/v1' })
  const { models, errors } = readModelMetadata(document, GATEWAY, new Map())
  expect(errors.size).toBe(0)
  expect(models.get('kimi-k3')?.api).toBe('openai-completions')
  expect(models.get('kimi-k3')?.baseUrl).toBe(GATEWAY)
})

it('appends the consent path to contributor refusals and leaves other copy alone', () => {
  const refusal = 'Upstream request failed: This Go model trains on request data. Allow paid endpoints that train on request data in your workspace\'s Privacy settings to use it.'
  const guided = withConsentGuidance(refusal)
  expect(guided.startsWith(refusal)).toBe(true)
  expect(guided).toContain('Enable "Allow paid endpoints that train on request data" in your OpenCode workspace Privacy settings (opencode.ai)')
  expect(withConsentGuidance('the model listing has no "data" array')).toBe('the model listing has no "data" array')
  // A bare "consent" is not evidence of the training-data refusal.
  expect(withConsentGuidance('upstream declined for lack of consent')).toBe('upstream declined for lack of consent')
})

it('recognizes contributor-tier model ids by their suffix', () => {
  expect(isContributorModel('gemini-4-argon-contributor')).toBe(true)
  expect(isContributorModel('glm-5.2')).toBe(false)
  expect(isContributorModel('cat-jam-free')).toBe(false)
})

it('serves a listed google model through the registered api module end to end', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([GOOGLE_ID]) })
  // The recorded surface is the mock gateway itself: same registrable domain.
  const metadataGateway = await mockGateway({
    status: 200,
    body: metadataDocument({
      [GOOGLE_ID]: modelMetadata({ name: 'Gemini 4 Argon Contributor', provider: { npm: '@ai-sdk/google' } }),
    }, { api: gateway.url }),
  })
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    return networkFetch(url === MODELS_METADATA_URL ? `${metadataGateway.url}/models` : input, init)
  })
  const catalog = new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {})

  const snapshot = await catalog.snapshot()

  expect(snapshot.live).toBe(true)
  expect(snapshot.unavailable.size).toBe(0)
  expect(snapshot.models.get(GOOGLE_ID)).toMatchObject({
    api: 'google-generative-ai', baseUrl: gateway.url,
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await closeMockGateways()
})
