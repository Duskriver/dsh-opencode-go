import { afterEach, expect, it, vi } from 'vitest'
import { GoogleGenAI } from '@google/genai'
import { BlockAssembler, createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { normalizeContext } from 'opencode-go-pi-ai'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { discoverSettingsModels } from '../src/catalog.ts'
import { modelBaseURL, readModelMetadata } from '../src/model-metadata.ts'
import { streamSimple } from '../src/google-generative-ai.ts'
import type { Model } from '../src/sdk-types.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, googleTextEvents, listingBody, mockGateway } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

const id = 'gemini-4-argon-contributor'
const metadata = metadataDocument({ [id]: modelMetadata({
  name: 'Gemini 4 Argon Contributor', provider: { npm: '@ai-sdk/google' },
  reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
  limit: { context: 1048576, output: 65536 }, release_date: '2026-10-13',
}) })
const adapters: OpencodeGoAdapter[] = []
afterEach(async () => {
  await Promise.all(adapters.splice(0).map(adapter => adapter.dispose()))
  await closeMockGateways()
})

it('uses the canonical gateway for every protocol when reading the public legacy alias', () => {
  const legacy = 'https://opencode.ai/zen/go/v1'
  const current = 'https://opencode.ai/inference/go/v1'
  expect(modelBaseURL('google-generative-ai', legacy + '/')).toBe(current)
  expect(readModelMetadata(metadata, legacy, new Map()).models.get(id)?.baseUrl).toBe(current)
  expect(modelBaseURL('google-generative-ai', current)).toBe(current)
  expect(modelBaseURL('google-generative-ai', 'https://gateway.example/zen/go/v1')).toBe('https://gateway.example/zen/go/v1')
  expect(modelBaseURL('google-generative-ai', 'http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1')
  expect(modelBaseURL('openai-completions', legacy)).toBe(current)
  expect(modelBaseURL('openai-responses', legacy)).toBe(current)
  expect(modelBaseURL('anthropic-messages', legacy)).toBe('https://opencode.ai/inference/go')
})

async function setup(overrides: Parameters<typeof configOf>[1] = {}) {
  const network = globalThis.fetch
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
    ? Promise.resolve(Response.json(metadata)) : network(input, init))
  const gateway = await mockGateway({ status: 200, body: listingBody([id]) })
  const config = configOf(`${gateway.url}/v1`, overrides)
  const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'go-key' })
  adapters.push(adapter)
  const options = {
    provider: 'dsh-opencode-go', model: id, sessionId: 'google-session' as never,
    system: 'Google system prompt', maxTokens: 128,
    messages: [createUserMessage({ content: [{ type: 'text' as const, text: 'hi' }], source: { kind: 'plugin', plugin: 'test' } })],
    tools: [{ name: 'lookup', description: 'Look up a value', parameters: {
      type: 'object', properties: { query: { type: 'string' } }, required: ['query'],
    } }],
  }
  return { adapter, config, gateway, options }
}

it('enables the advertised Gemini model and offers only its declared thinking levels', async () => {
  const { adapter, config } = await setup()
  const catalog = await discoverSettingsModels(adapter.catalogOf(config))
  expect(catalog.models).toContainEqual(expect.objectContaining({ id, name: 'Gemini 4 Argon Contributor', releaseDate: '2026-10-13' }))
  expect(catalog.models[0]?.configurationMissing).not.toBe(true)
  const info = await adapter.resolveModel('dsh-opencode-go', id)
  expect(info.reasoning?.efforts.map(effort => effort.id)).toEqual(['low', 'medium', 'high'])
  expect(info.reasoning).not.toHaveProperty('defaultEffort')
})

it.each(['GOOGLE_GENAI_USE_VERTEXAI', 'GOOGLE_GENAI_USE_ENTERPRISE'])(
  'keeps the gateway Gemini endpoint when %s enables another Google backend', async flag => {
    vi.stubEnv('GOOGLE_GENAI_USE_VERTEXAI', undefined)
    vi.stubEnv('GOOGLE_GENAI_USE_ENTERPRISE', undefined)
    vi.stubEnv(flag, 'true')
    const { adapter, gateway, options } = await setup()
    gateway.pushCompletions({ events: googleTextEvents })
    const chunks = await Array.fromAsync(adapter.stream(options))
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
    expect(gateway.paths.map(path => path.split('?')[0])).toEqual(['/v1/models', `/v1/models/${id}:streamGenerateContent`])
    expect(process.env[flag]).toBe('true')
    // Other clients in the host retain the SDK's normal environment selection.
    expect(new GoogleGenAI({ apiKey: 'another-provider-key' }).vertexai).toBe(true)
  },
)

it.each([undefined, 'low', 'medium', 'high'] as const)('streams Gemini through the gateway with thinking=%s', async effort => {
  const { adapter, gateway, options } = await setup()
  gateway.pushCompletions({ events: googleTextEvents })
  const chunks = await Array.fromAsync(adapter.stream({ ...options,
    ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
  }))
  expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
  expect(chunks).toContainEqual(expect.objectContaining({ type: 'reasoning-delta', text: 'thought' }))
  expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  expect(gateway.paths.map(path => path.split('?')[0])).toEqual(['/v1/models', `/v1/models/${id}:streamGenerateContent`])
  expect(gateway.headers[1]?.['x-goog-api-key']).toBe('go-key')
  expect(gateway.headers[1]?.['x-opencode-session']).toBe('google-session')
  expect(gateway.headers[1]?.['user-agent']).toMatch(/^deepseek-harness\//)
  const body = gateway.bodies[0]
  expect(body).toMatchObject({
    contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    systemInstruction: { parts: [{ text: 'Google system prompt' }] },
    tools: [{ functionDeclarations: [{ name: 'lookup' }] }],
    generationConfig: { maxOutputTokens: 128 },
  })
  if (effort === undefined) expect(body).not.toHaveProperty('generationConfig.thinkingConfig')
  else expect(body).toHaveProperty('generationConfig.thinkingConfig', { includeThoughts: true, thinkingLevel: effort.toUpperCase() })
})

it('classifies Google gateway quota failures using the captured HTTP response', async () => {
  const { adapter, gateway, options } = await setup()
  gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { type: 'GoUsageLimitError', message: 'Subscription usage limit' } }) })
  const chunks = await Array.fromAsync(adapter.stream(options))
  expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'error', failure: { code: 'QUOTA' } } })
  expect(gateway.bodies).toHaveLength(1)
})

it('cancels an open Google stream through the normal request signal', async () => {
  const { adapter, gateway, options } = await setup()
  gateway.pushCompletions({ events: [googleTextEvents[1]!], hangOpen: true })
  const controller = new AbortController()
  const chunks = []
  for await (const chunk of adapter.stream({ ...options, signal: controller.signal })) {
    chunks.push(chunk)
    if (chunk.type === 'text-delta') controller.abort()
  }
  expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'aborted' } })
})

it('keeps simultaneous Google requests on their own fetch binding without replacing global fetch', async () => {
  const model = readModelMetadata(metadata, 'https://gateway.invalid/v1', new Map()).models.get(id)! as Model<'google-generative-ai'>
  const context = normalizeContext({ messages: [{ role: 'user', content: 'hi', timestamp: Date.now() }] })
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const events = googleTextEvents.map(event => `data: ${event}\n\n`).join('')
  const first = vi.fn(async () => { entered.resolve(); await release.promise; return new Response(events) })
  const second = vi.fn(async () => new Response(events))
  const globalFetch = globalThis.fetch
  const a = Array.fromAsync(streamSimple(model, context, { apiKey: 'a', fetch: first }))
  await entered.promise
  const b = await Array.fromAsync(streamSimple(model, context, { apiKey: 'b', fetch: second }))
  release.resolve()
  expect((await a).at(-1)?.type).toBe('done')
  expect(b.at(-1)?.type).toBe('done')
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  expect(globalThis.fetch).toBe(globalFetch)
})

const signatureA = Buffer.from('first-signature').toString('base64')
const signatureB = Buffer.from('second-signature').toString('base64')
const signedA = { text: 'first text part', thoughtSignature: signatureA }
const signedB = { text: 'second text part', thoughtSignature: signatureB }
const unsigned = { text: 'unsigned text' }
const emptySigned = { text: '', thoughtSignature: signatureB }

it.each([
  { label: 'two signed text parts in one chunk', chunks: [[signedA, signedB]], expected: [signedA, signedB] },
  { label: 'signed then unsigned parts', chunks: [[signedA, unsigned]], expected: [signedA, unsigned] },
  { label: 'unsigned then signed parts', chunks: [[unsigned, signedB]], expected: [unsigned, signedB] },
  { label: 'two signed thinking parts',
    chunks: [[{ ...signedA, thought: true }, { ...signedB, thought: true }]],
    expected: [{ ...signedA, thought: true }, { ...signedB, thought: true }] },
  { label: 'a separate signature-only text part', chunks: [[signedA, emptySigned]], expected: [signedA, emptySigned] },
  { label: 'a signature-only part before text', chunks: [[emptySigned, unsigned]], expected: [emptySigned, unsigned] },
  { label: 'different signatures in successive chunks', chunks: [[signedA], [signedB]], expected: [signedA, signedB] },
  { label: 'a signature sent before continuing text deltas', chunks: [[signedA], [unsigned]],
    expected: [{ text: signedA.text + unsigned.text, thoughtSignature: signatureA }] },
  { label: 'a signature repeated on continuing text deltas', chunks: [[signedA], [{ ...unsigned, thoughtSignature: signatureA }]],
    expected: [{ text: signedA.text + unsigned.text, thoughtSignature: signatureA }] },
  { label: 'a final empty delta carrying the current part signature', chunks: [[unsigned], [emptySigned]],
    expected: [{ text: unsigned.text, thoughtSignature: signatureB }] },
])('preserves Google part signatures through assembled, JSON-restored history: $label', async ({ chunks: partsByChunk, expected }) => {
  const { adapter, gateway, options } = await setup()
  gateway.pushCompletions({ events: partsByChunk.map((parts, index) => JSON.stringify({
    candidates: [{ content: { role: 'model', parts },
      ...index === partsByChunk.length - 1 ? { finishReason: 'STOP' } : {},
    }],
    ...index === partsByChunk.length - 1 ? { usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 } } : {},
  })) })
  const assembler = new BlockAssembler()
  for await (const chunk of adapter.stream(options)) assembler.push(chunk)
  expect(assembler.finish.kind).toBe('stop')
  const assistant = JSON.parse(JSON.stringify(assembler.message({
    kind: 'model', provider: options.provider as never, model: id,
    replayState: assembler.replayState,
  })))
  gateway.pushCompletions({ events: googleTextEvents })
  const resumed = await Array.fromAsync(adapter.stream({ ...options, messages: [
    ...options.messages, assistant,
    createUserMessage({ content: [{ type: 'text', text: 'continue' }], source: { kind: 'plugin', plugin: 'test' } }),
  ] }))
  expect(resumed.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  const replayed = gateway.bodies[1]?.contents.find((message: { role: string }) => message.role === 'model')
  expect(replayed?.parts).toEqual(expected)
})
