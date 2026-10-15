import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Schema from '@deepseek-ai/schemastery'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import Gateway from '@deepseek-ai/dsh-api-gateway'
import Registry from '@deepseek-ai/dsh-typert-registry'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import { afterEach, expect, it, vi } from 'vitest'
import { apply, NS } from '../src/index.ts'
import { Config, PlainConfig, readConfig } from '../src/config.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, googleTextEvents, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

const legacy = 'https://opencode.ai/zen/go/v1'
const current = 'https://opencode.ai/inference/go/v1'
const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
  await closeMockGateways()
})

const anthropicEvents = [
  { type: 'message_start', message: { id: 'msg-test', type: 'message', role: 'assistant', model: 'anthropic-model', content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
  { type: 'message_stop' },
].map(event => JSON.stringify(event))
const responseMessage = { id: 'msg-test', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'hello', annotations: [] }] }
const responseEvents = [
  { type: 'response.created', response: { id: 'resp-test' } },
  { type: 'response.output_item.added', output_index: 0, item: { ...responseMessage, content: [] } },
  { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'hello' },
  { type: 'response.output_item.done', output_index: 0, item: responseMessage },
  { type: 'response.completed', response: { id: 'resp-test', status: 'completed', output: [responseMessage], usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 } } },
].map(event => JSON.stringify(event))
const protocols = [
  { id: 'chat-model', npm: '@ai-sdk/openai-compatible', path: '/chat/completions', events: textEvents },
  { id: 'anthropic-model', npm: '@ai-sdk/anthropic', path: '/messages', events: anthropicEvents, namedEvents: true },
  { id: 'responses-model', npm: '@ai-sdk/openai', path: '/responses', events: responseEvents },
  { id: 'gemini-4-argon-contributor', npm: '@ai-sdk/google', path: '/models/gemini-4-argon-contributor:streamGenerateContent', events: googleTextEvents },
]

it.each(['profile entry', 'settings document'])('keeps discovery, all protocols and usage working after the old gateway retires: %s', async source => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-migration-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  const settingsPath = join(dir, 'settings.yaml')
  const credentialsPath = join(dir, '.credentials.yaml')
  await writeFile(settingsPath, source === 'settings document' ? JSON.stringify({ [NS]: { baseURL: legacy + '/' } }) : '{}')
  await writeFile(credentialsPath, 'version: 1\nrefs:\n  OPENCODE_API_KEY: migration-fixture-key\n', { mode: 0o600 })
  const gateway = await mockGateway({ status: 200, body: listingBody(protocols.map(protocol => protocol.id)) })
  const metadata = metadataDocument(Object.fromEntries(protocols.map(protocol => [protocol.id,
    modelMetadata({ provider: { npm: protocol.npm }, reasoning_options: [] })])))
  const networkFetch = globalThis.fetch
  const requests: string[] = []
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init)
    if (request.url === MODELS_METADATA_URL) return Promise.resolve(Response.json(metadata))
    requests.push(request.url)
    if (request.url.startsWith(legacy)) return Promise.reject(new Error('the legacy gateway has permanently retired'))
    expect(request.url.startsWith(current + '/')).toBe(true)
    return networkFetch(new Request(request.url.replace(current, gateway.url + '/v1'), request))
  })
  const ctx = new Context()
  cleanups.push(() => ctx.fiber.dispose())
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(FileSettingsProvider, { path: settingsPath, watch: false })
  await ctx.plugin(LocalCredentialProvider, { path: credentialsPath, watch: false })
  await ctx.plugin({ name: 'gateway-migration-test', inject: ['llm'], apply: (scope: Context) => {
    apply(scope, configOf(source === 'profile entry' ? legacy : 'https://configured.example/v1'))
  } })
  const value = () => ctx.settings.describe().find(row => row.ns === NS)!.value
  await expect.poll(() => value().baseURL).toBe(current)
  await expect.poll(() => ctx.llm.listProviders()).toContainEqual({ id: 'dsh-opencode-go', name: 'DSH OpenCode Go' })
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  expect((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id).sort())
    .toEqual(protocols.map(protocol => protocol.id).sort())
  for (const protocol of protocols) {
    gateway.pushCompletions(protocol)
    const chunks = await Array.fromAsync(ctx.llm.stream({ provider: 'dsh-opencode-go', model: protocol.id, maxTokens: 128,
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'migration-test' } })],
    }))
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  }
  const window = { status: 'ok', percent: 0, resetsAt: '2026-10-15T00:00:00Z' }
  const usage = { rolling: window, weekly: window, monthly: window }
  gateway.pushCompletions({ body: JSON.stringify({ usage }) })
  expect(await ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} }))
    .toMatchObject(usage)
  expect(requests.map(url => new URL(url).pathname))
    .toEqual(['/models', ...protocols.map(protocol => protocol.path), '/usage'].map(path => '/inference/go/v1' + path))
  await ctx.settings.update(NS, { baseURL: legacy + '/' })
  await expect.poll(() => value().baseURL).toBe(current)
  await expect.poll(() => readFile(settingsPath, 'utf8')).toContain(current)
  expect(await readFile(settingsPath, 'utf8')).not.toContain(legacy)
  const custom = 'https://custom.example/zen/go/v1'
  await ctx.settings.update(NS, { baseURL: custom })
  expect(value().baseURL).toBe(custom)
})

it('keeps settings schemas valid after the Host rebuilds and forwards them to the desktop client', () => {
  // Modern settings first rebuild each volatile field as a plain schema, then
  // serialize the assembled form again for the client. Transform callbacks can
  // survive the first serialization and disappear during the second one.
  const fields = Object.fromEntries(Object.entries(Config.dict!).map(([key, field]) => {
    const plain = Schema(JSON.parse(JSON.stringify(field)))
    delete plain.meta.volatile
    return [key, plain]
  }))
  const schema = Schema(JSON.parse(JSON.stringify(Schema.object(fields))))
  expect(schema({ baseURL: current }).baseURL).toBe(current)
  expect(schema({ baseURL: 'https://custom.example/zen/go/v1' }).baseURL).toBe('https://custom.example/zen/go/v1')
  expect(readConfig(Config({ baseURL: legacy + '/' })).baseURL).toBe(current)
  expect(PlainConfig({ baseURL: legacy + '/' }).baseURL).toBe(legacy + '/')
})
