import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createMessage, createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
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
