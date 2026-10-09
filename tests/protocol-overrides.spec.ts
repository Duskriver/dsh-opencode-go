import { afterEach, describe, expect, it, vi } from 'vitest'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { createUserMessage, ReasoningEffortId, userAgent } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { PlainConfig } from '../src/config.ts'
import { validateGoConfig } from '../src/host-settings.ts'
import { readModelMetadata } from '../src/model-metadata.ts'
import { withProtocolOverride } from '../src/protocol-policy.ts'
import { RESPONSES_OVERRIDE_MODEL as MODEL } from '../src/protocol-contract.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument } from './support/model-metadata.ts'

const override = { [MODEL]: 'openai-responses' as const }
const tool = { name: 'probe', description: 'Probe', parameters: { type: 'object', properties: {} } }
const user = (text: string) => createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'test' } })
const request = (extra: Partial<GenerateOptions> = {}): GenerateOptions => ({
  provider: 'dsh-opencode-go', model: MODEL, messages: [user('hello')], sessionId: 'override-session' as never, ...extra,
})
async function drain(stream: AsyncIterable<StreamChunk>) {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

/** Actual SDK events including opaque reasoning, not a mocked provider stream. */
function responsesEvents(callingTool = false): string[] {
  const reasoning = { id: 'rs_probe', type: 'reasoning', summary: [{ type: 'summary_text', text: 'visible thought' }], encrypted_content: 'OPAQUE_REASONING' }
  const item = callingTool
    ? { id: 'fc_probe', type: 'function_call', call_id: 'call_probe', name: tool.name, arguments: '{}', status: 'completed' }
    : { id: 'msg_probe', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'hello', annotations: [] }] }
  return [
    { type: 'response.created', response: { id: 'resp_probe' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...reasoning, summary: [], encrypted_content: null } },
    { type: 'response.reasoning_summary_text.delta', output_index: 0, summary_index: 0, delta: 'visible thought' },
    { type: 'response.output_item.done', output_index: 0, item: reasoning },
    { type: 'response.output_item.added', output_index: 1, item: callingTool ? { ...item, arguments: '' } : { ...item, content: [] } },
    callingTool ? { type: 'response.function_call_arguments.delta', output_index: 1, delta: '{}' }
      : { type: 'response.output_text.delta', output_index: 1, content_index: 0, delta: 'hello' },
    { type: 'response.output_item.done', output_index: 1, item },
    { type: 'response.completed', response: { id: 'resp_probe', status: 'completed', output: [reasoning, item],
      usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13, input_tokens_details: { cached_tokens: 4 }, output_tokens_details: { reasoning_tokens: 2 } } } },
  ].map(event => JSON.stringify(event))
}

const chatToolEvents = [
  JSON.stringify({ choices: [{ delta: { role: 'assistant', reasoning_content: 'visible thought', tool_calls: [
    { index: 0, id: 'call_probe', type: 'function', function: { name: tool.name, arguments: '{}' } },
  ] }, index: 0, finish_reason: null }] }),
  JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 3, completion_tokens: 1 } }),
  '[DONE]',
]

afterEach(closeMockGateways)

describe('experimental protocol override', () => {
  it.each([undefined, {}, { [MODEL]: null }])('keeps automatic routing for %j', async protocolOverrides => {
    const gateway = await mockGateway({ status: 200, body: listingBody([MODEL]) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides }), resolveApiKey: async () => 'fixture-key' })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    expect(gateway.paths).toEqual(['/models', '/chat/completions'])
  })

  it.each([undefined, 'low', 'high', 'max'])('serializes Responses reasoning %s, headers, limits and usage', async effort => {
    const gateway = await mockGateway({ status: 200, body: listingBody([MODEL]) })
    gateway.pushCompletions({ events: responsesEvents() })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override, modelLimits: { [MODEL]: { maxTokens: 1234 } } }), resolveApiKey: async () => 'fixture-key' })
    const model = await adapter.resolveModel('dsh-opencode-go', MODEL)
    expect(model.reasoning?.efforts.map(effort => effort.id)).toEqual(['low', 'high', 'max'])
    const chunks = await drain(adapter.stream(request({ ...(effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) }) })))
    expect(gateway.paths).toEqual(['/models', '/responses'])
    expect(gateway.headers[1]).toMatchObject({ 'x-opencode-session': 'override-session', 'user-agent': userAgent(), authorization: 'Bearer fixture-key' })
    expect(gateway.headers[1]?.session_id).toBeUndefined()
    const body = gateway.bodies[0] as Record<string, unknown>
    expect(body).toMatchObject({ model: MODEL, stream: true, store: false, max_output_tokens: 1234, prompt_cache_key: 'override-session' })
    if (effort === undefined) expect(body.reasoning).toBeUndefined()
    else expect(body).toMatchObject({ reasoning: { effort, summary: 'auto' }, include: ['reasoning.encrypted_content'] })
    expect(body).not.toHaveProperty('max_tokens')
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
    expect(chunks.find(chunk => chunk.type === 'usage')).toMatchObject({ usage: { inputTokens: 6, cacheReadTokens: 4, outputTokens: 3, totalTokens: 13 } })
    expect(chunks.at(-1)).toMatchObject({ reason: { kind: 'stop' }, replayState: { response: { api: 'openai-responses' } } })
  })

  it('captures prepared routing and switches new calls without refetching or mutating the catalog', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody([MODEL]) })
    const config = configOf(gateway.url)
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'fixture-key' })
    const prepared = await adapter.prepareCall('dsh-opencode-go', MODEL)
    config.protocolOverrides = override
    gateway.pushCompletions({ events: textEvents })
    await drain(prepared.stream(request()))
    gateway.pushCompletions({ events: responsesEvents() })
    await drain(adapter.stream(request()))
    config.protocolOverrides = { [MODEL]: null }
    gateway.pushCompletions({ events: textEvents })
    await drain(adapter.stream(request()))
    expect(gateway.paths).toEqual(['/models', '/chat/completions', '/responses', '/chat/completions'])
    expect(gateway.modelListings).toBe(1)
  })

  it.each(['same', 'responses-to-chat', 'chat-to-responses'] as const)('restores tool calls and reasoning for %s continuation', async direction => {
    const gateway = await mockGateway({ status: 200, body: listingBody([MODEL]) })
    const startsResponses = direction !== 'chat-to-responses'
    const config = configOf(gateway.url, { protocolOverrides: startsResponses ? override : {} })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'fixture-key' })
    gateway.pushCompletions({ events: startsResponses ? responsesEvents(true) : chatToolEvents })
    const initial = request({ tools: [tool], system: 'SYSTEM_SENTINEL', reasoningEffort: ReasoningEffortId('high') })
    const chunks = await drain(adapter.stream(initial))
    const finish = chunks.find(chunk => chunk.type === 'finish')!
    expect(finish.reason.kind).toBe('tool-calls')
    const blocks = chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block)
    const call = blocks.find(block => block.type === 'tool-call')!
    expect(call).toMatchObject({ name: tool.name, arguments: '{}' })
    const assistant = JSON.parse(JSON.stringify({ id: 'assistant-tool-turn', role: 'assistant', content: blocks,
      source: { kind: 'model', provider: 'dsh-opencode-go', model: MODEL, replayState: finish.replayState } }))
    const result = createUserMessage({ content: [{ type: 'tool-result', toolCallId: call.id, isError: false,
      content: [{ type: 'text', text: 'TOOL_RESULT_SENTINEL' }] }], source: { kind: 'plugin', plugin: 'test' } })
    config.protocolOverrides = direction === 'responses-to-chat' ? {} : override
    const endsResponses = direction !== 'responses-to-chat'
    gateway.pushCompletions({ events: endsResponses ? responsesEvents() : textEvents })
    const continued = await drain(adapter.stream({ ...initial, messages: [...initial.messages, assistant, result] }))
    expect(continued.at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    const body = gateway.bodies[1] as Record<string, any>
    expect(JSON.stringify(body)).toContain('TOOL_RESULT_SENTINEL')
    expect(JSON.stringify(body).split('SYSTEM_SENTINEL')).toHaveLength(2)
    expect(JSON.stringify(body)).toContain('visible thought')
    if (direction === 'same') expect(JSON.stringify(body)).toContain('OPAQUE_REASONING')
    else expect(JSON.stringify(body)).not.toContain('OPAQUE_REASONING')
    if (endsResponses) {
      const call = body.input.find((item: any) => item.type === 'function_call')
      const result = body.input.find((item: any) => item.type === 'function_call_output')
      expect(call.call_id).toBe('call_probe')
      expect(result.call_id).toBe(call.call_id)
    } else {
      const id = body.messages.find((item: any) => item.role === 'assistant' && item.tool_calls)?.tool_calls[0].id
      expect(id).toMatch(/^call_probe/)
      expect(body.messages.find((item: any) => item.role === 'tool').tool_call_id).toBe(id)
    }
    expect(gateway.paths.at(-1)).toBe(endsResponses ? '/responses' : '/chat/completions')
  })

  it('keeps the attachment normalization path for Responses image inputs', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody([MODEL]) })
    gateway.pushCompletions({ events: responsesEvents() })
    const attachment = { attachmentId: AttachmentId(`sha256:${'a'.repeat(64)}`), mediaType: 'image/png', bytes: 1, width: 1, height: 1 }
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override }), resolveApiKey: async () => 'fixture-key',
      imageAccess: { resolveImageAccess: () => undefined, resolveAttachments: () => ({ readImageRequest: async () => ({
        variantId: `sha256:${'b'.repeat(64)}`, attachment, data: Uint8Array.of(1), mediaType: 'image/png', bytes: 1,
        width: 1, height: 1, depth: 'uchar', space: 'srgb', hasAlpha: true,
      }) }) as never } })
    await drain(adapter.stream(request({ messages: [createUserMessage({ content: [{ type: 'image', attachment }], source: { kind: 'plugin', plugin: 'test' } })] })))
    expect(gateway.bodies[0]).toMatchObject({ input: [expect.objectContaining({ role: 'user', content: expect.arrayContaining([
      expect.objectContaining({ type: 'input_image', image_url: 'data:image/png;base64,AQ==' }),
    ]) })] })
  })

  it('surfaces an unsupported-protocol rejection without retrying another protocol or account', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody([MODEL]) })
    gateway.pushCompletions({ status: 400, body: JSON.stringify({ error: { code: 'ModelProtocolUnsupported', message: 'ModelProtocolUnsupported' } }) })
    const resolveApiKey = vi.fn(async () => 'fixture-key')
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override, autoSwitch: true,
      accounts: [{ id: 'first', name: 'First', apiKeyEnv: 'FIRST_KEY' }, { id: 'second', name: 'Second', apiKeyEnv: 'SECOND_KEY' }], apiKeyEnv: 'FIRST_KEY',
    }), resolveApiKey })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error' } })
    expect(gateway.paths).toEqual(['/models', '/responses'])
    expect(resolveApiKey).toHaveBeenCalledTimes(1)
  })

  it('isolates the wire profile and leaves other model routing intact', () => {
    const models = readModelMetadata(metadataDocument(), 'https://gateway.test/v1/', new Map()).models
    const config = configOf('https://gateway.test/v1/', { protocolOverrides: override })
    const raw = models.get(MODEL)!
    expect(raw.compat).toMatchObject({ maxTokensField: 'max_tokens', supportsDeveloperRole: false })
    expect(withProtocolOverride(raw, config)).toMatchObject({ api: 'openai-responses', baseUrl: 'https://gateway.test/v1', compat: { sessionAffinityFormat: 'openai-nosession' } })
    expect(withProtocolOverride(raw, config).compat).not.toHaveProperty('maxTokensField')
    expect(raw.api).toBe('openai-completions')
    const other = models.get('kimi-k3')!
    expect(withProtocolOverride(other, config)).toBe(other)
    expect(() => withProtocolOverride({ ...raw, api: 'anthropic-messages' }, config)).toThrow(/current protocol/)
    expect(() => withProtocolOverride({ ...raw, reasoningControl: 'toggle' }, config)).toThrow(/current protocol/)
    const declared = { ...raw, api: 'openai-responses' as const }
    expect(withProtocolOverride(declared, config)).toBe(declared)
  })

  it.each([[], 'openai-responses', { 'kimi-k3': 'openai-responses' }, { [MODEL]: 'anthropic-messages' }])('refuses unsupported override configuration %j', value => {
    expect(() => validateGoConfig(PlainConfig({ protocolOverrides: value }))).toThrow()
  })
})
