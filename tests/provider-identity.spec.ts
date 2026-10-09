import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createMessage, createUserMessage, LlmAdapter, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { apply } from '../src/index.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'

const route = 'dsh-opencode-go'

class HostAdapter extends LlmAdapter {
  override providerInfo(provider: string) { return { id: provider, name: 'Host pi-ai' } }
  override async listModels(provider: string) { return [{ provider, id: 'host-model', name: 'Host model' }] }
  override async resolveModel(provider: string, id: string) { return { provider, id, name: 'Host model' } }
  override async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield { type: 'text-delta', index: 0, text: 'host answer' }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const user = () => createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })
async function drain(ctx: Context, options: GenerateOptions): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of ctx.llm.stream(options)) chunks.push(chunk)
  return chunks
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await closeMockGateways()
})

it.each(['before', 'after'])('coexists with the host opencode-go route when mounted %s it', async order => {
  vi.stubEnv('OPENCODE_API_KEY', 'test-key')
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  gateway.pushCompletions({ events: textEvents })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  try {
    if (order === 'after') ctx.llm.registerAdapter(['opencode-go'], new HostAdapter())
    apply(ctx, configOf(gateway.url))
    if (order === 'before') ctx.llm.registerAdapter(['opencode-go'], new HostAdapter())
    expect(ctx.llm.listProviders()).toEqual(expect.arrayContaining([
      { id: 'opencode-go', name: 'Host pi-ai' }, { id: route, name: 'DSH OpenCode Go' },
    ]))
    expect(await ctx.llm.listModels('opencode-go')).toEqual([{ provider: 'opencode-go', id: 'host-model', name: 'Host model' }])
    expect(await ctx.llm.resolveModelInfo(route, 'deepseek-v4.1-flash')).toMatchObject({ provider: route })
    const host = await drain(ctx, { provider: 'opencode-go', model: 'host-model', messages: [user()] })
    expect(host).toContainEqual({ type: 'text-delta', index: 0, text: 'host answer' })
    const plugin = await drain(ctx, { provider: route, model: 'deepseek-v4.1-flash', messages: [user()], sessionId: 'isolated-route' as never })
    expect(plugin).toContainEqual({ type: 'text-delta', index: 0, text: 'hello' })
    expect(gateway.headers.at(-1)?.['x-opencode-session']).toBe('isolated-route')
  } finally {
    await ctx.fiber.dispose()
  }
})

it('preserves OpenCode reasoning replay across the DSH route and SDK provider identities', async () => {
  vi.stubEnv('OPENCODE_API_KEY', 'test-key')
  const gateway = await mockGateway({ status: 200, body: listingBody(['glm-5.3']) })
  gateway.pushCompletions({ events: [
    '{"choices":[{"delta":{"role":"assistant","reasoning":"think"},"index":0,"finish_reason":null}]}',
    '{"choices":[{"delta":{"content":"answer"},"index":0,"finish_reason":null}]}',
    '{"choices":[{"delta":{},"index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}', '[DONE]',
  ] })
  gateway.pushCompletions({ events: textEvents })
  gateway.pushCompletions({ events: textEvents })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  try {
    apply(ctx, configOf(gateway.url))
    const request = { provider: route, model: 'glm-5.3', messages: [user()] }
    const chunks = await drain(ctx, request)
    const finish = chunks.find(chunk => chunk.type === 'finish')
    expect(finish?.replayState).toMatchObject({
      response: { provider: route, sdkProvider: 'opencode-go' },
      blocks: expect.arrayContaining([{ type: 'reasoning', thinkingSignature: 'reasoning_content' }]),
    })
    const assistant = createMessage({ role: 'assistant',
      content: chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block),
      source: { kind: 'model', provider: route, model: request.model, replayState: finish?.replayState },
    })
    const restored = JSON.parse(JSON.stringify(assistant))
    await drain(ctx, { ...request, messages: [...request.messages, restored, user()] })
    const body = gateway.bodies[1] as { messages: { role: string; reasoning_content?: string; content?: string }[] }
    expect(body.messages.find(message => message.role === 'assistant')).toMatchObject({ reasoning_content: 'think', content: 'answer' })

    // Switching an old session to the new route still carries its durable text.
    restored.source.provider = 'opencode-go'
    restored.source.replayState.response.provider = 'opencode-go'
    delete restored.source.replayState.response.sdkProvider
    await drain(ctx, { ...request, messages: [...request.messages, restored, user()] })
    const migrated = gateway.bodies[2] as { messages: { role: string; content?: string }[] }
    expect(migrated.messages.find(message => message.role === 'assistant')?.content).toContain('answer')
  } finally {
    await ctx.fiber.dispose()
  }
})

it.each(['minimax-m3', 'claude-haiku-5-5'])('preserves signed %s thinking across a returned model alias and JSON-restored continuation', async modelId => {
  vi.stubEnv('OPENCODE_API_KEY', 'test-key')
  const gateway = await mockGateway({ status: 200, body: listingBody([modelId, 'union-alpha']) })
  const events = [
    { type: 'message_start', message: { id: 'msg_alias', type: 'message', role: 'assistant', model: `${modelId}-reported-alias`,
      content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'signed thought' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'fixture-signature' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'answer' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } },
    { type: 'message_stop' },
  ].map(event => JSON.stringify(event))
  for (let i = 0; i < 3; i++) gateway.pushCompletions({ events, namedEvents: true })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  try {
    apply(ctx, configOf(`${gateway.url}/v1`))
    const request = { provider: route, model: modelId, messages: [user()], reasoningEffort: ReasoningEffortId('high') }
    const chunks = await drain(ctx, request)
    const finish = chunks.find(chunk => chunk.type === 'finish')
    expect(finish).toMatchObject({ reason: { kind: 'stop' }, replayState: { response: {
      model: request.model, responseModel: `${modelId}-reported-alias`, provider: route, sdkProvider: 'opencode-go',
    } } })
    const restored = JSON.parse(JSON.stringify(createMessage({ role: 'assistant',
      content: chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block),
      source: { kind: 'model', provider: route, model: request.model, replayState: finish?.replayState },
    })))
    const messages = [...request.messages, restored, user()]
    await drain(ctx, { ...request, messages })
    const assistant = (gateway.bodies[1] as { messages: { role: string; content: unknown[] }[] }).messages.find(m => m.role === 'assistant')
    expect(assistant?.content).toContainEqual({ type: 'thinking', thinking: 'signed thought', signature: 'fixture-signature' })

    // A real model switch must still strip signatures that belong to the previous model.
    await drain(ctx, { provider: route, model: 'union-alpha', messages })
    expect(JSON.stringify(gateway.bodies[2])).not.toContain('fixture-signature')
  } finally {
    await ctx.fiber.dispose()
  }
})
