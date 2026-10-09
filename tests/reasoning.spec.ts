import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { getSupportedThinkingLevels } from 'opencode-go-pi-ai'
import { getBuiltinModels } from 'opencode-go-pi-ai/providers/all'
import type { Api, Model } from 'opencode-go-pi-ai'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { readModelMetadata } from '../src/model-metadata.ts'
import { reasoningBudgetRange, reasoningChoices, reasoningIntent, reasoningRequest, withGatewayReasoning } from '../src/reasoning.ts'
import { streamSimple as streamChat } from 'opencode-go-pi-ai/api/openai-completions'
import { PlainConfig } from '../src/config.ts'
import { discoverSettingsModels } from '../src/catalog.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

const id = 'mimo-v2.6-flash'
const builtin = new Map<string, Model<Api>>(getBuiltinModels('opencode-go').map(model => [model.id, model]))
const levels = (model: Model<Api>) => getSupportedThinkingLevels(model)

afterEach(closeMockGateways)

describe('gateway reasoning metadata', () => {
  it('fills MiMo Flash controls from its verified gateway rule despite an empty online list', () => {
    const model = readModelMetadata(metadataDocument({ [id]: modelMetadata({ reasoning_options: [] }) }),
      'https://gateway.example/v1', builtin).models.get(id)!
    expect(model.reasoning).toBe(true)
    expect(levels(model)).toEqual(['off', 'low', 'medium', 'high'])
    expect(model.thinkingLevelMap).toEqual({
      off: 'none', minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: null, max: null,
    })
  })

  it.each(['mimo-v2.6-pro', 'mimo-v2.5', 'kimi-k2.6'])('does not synthesize an Off for intrinsic reasoning in %s', modelId => {
    const model = readModelMetadata(metadataDocument({ [modelId]: modelMetadata({ reasoning_options: [] }) }),
      'https://gateway.example/v1', builtin).models.get(modelId)!
    expect(model.reasoning).toBe(true)
    expect(levels(model)).toEqual([])
    expect(model.thinkingLevelMap?.off).toBeNull()
  })

  it('does not inherit a verified model rule through the family or a different protocol', () => {
    const verifiedBuiltin = new Map([[id, withGatewayReasoning(builtin.get(id)!)]])
    const sibling = { ...modelMetadata({ family: 'mimo' }) }
    delete sibling.reasoning_options
    const result = readModelMetadata(metadataDocument({
      [id]: modelMetadata({ family: 'mimo', reasoning_options: [] }),
      'future-mimo': sibling,
      'mimo-v2.6-pro': modelMetadata({ family: 'mimo', reasoning_options: [] }),
    }), 'https://gateway.example/v1', verifiedBuiltin)
    expect(levels(result.models.get('future-mimo')!)).toEqual([])
    expect(levels(result.models.get('mimo-v2.6-pro')!)).toEqual([])
    const otherProtocol = readModelMetadata(metadataDocument({
      [id]: modelMetadata({ provider: { npm: '@ai-sdk/anthropic' }, reasoning_options: [] }),
    }), 'https://gateway.example/v1', builtin).models.get(id)!
    expect(levels(otherProtocol)).toEqual([])
    expect(otherProtocol.thinkingLevelMap?.off).toBeNull()
  })

  it.each(['toggle', 'budget_tokens'])('does not turn an OpenAI %s into invented effort parameters', type => {
    const model = readModelMetadata(metadataDocument({
      'qwen3.7-max': modelMetadata({ reasoning_options: [{ type }] }),
    }), 'https://gateway.example/v1', builtin).models.get('qwen3.7-max')!
    expect(levels(model)).toEqual([])
  })

  it('offers only declared efforts when a generic model also advertises a toggle and budget', () => {
    const model = readModelMetadata(metadataDocument({
      'qwen3.8-max': modelMetadata({ reasoning_options: [
        { type: 'toggle' }, { type: 'effort', values: ['low', 'medium', 'xhigh'] }, { type: 'budget_tokens' },
      ] }),
    }), 'https://gateway.example/v1', builtin).models.get('qwen3.8-max')!
    expect(levels(model)).toEqual(['low', 'medium', 'xhigh'])
    expect(model.thinkingLevelMap?.off).toBeNull()
    expect(model.thinkingLevelMap?.high).toBeNull()
  })

  it('retains native switches without inventing a wire effort for Off', () => {
    const result = readModelMetadata(metadataDocument({
      'deepseek-v4-flash': modelMetadata(),
      'deepseek-v4-pro': modelMetadata({ reasoning_options: [{ type: 'toggle' }] }),
      'minimax-m3': modelMetadata({ provider: { npm: '@ai-sdk/anthropic' }, reasoning_options: [{ type: 'toggle' }] }),
    }), 'https://gateway.example/v1', builtin)
    expect(levels(result.models.get('deepseek-v4-flash')!)).toEqual(['off', 'low', 'high', 'max'])
    for (const modelId of ['deepseek-v4-pro', 'minimax-m3']) {
      expect(levels(result.models.get(modelId)!)).toEqual(['off', 'high'])
      expect(result.models.get(modelId)!.thinkingLevelMap).not.toHaveProperty('off')
      expect(reasoningChoices(result.models.get(modelId)!)).toEqual([{ id: 'off', name: 'Off' }, { id: 'high', name: 'On' }])
    }
  })

  it('does not add High beside explicit efforts for a native toggle', () => {
    const model = readModelMetadata(metadataDocument({
      'deepseek-v4-pro': modelMetadata({ reasoning_options: [
        { type: 'toggle' }, { type: 'effort', values: ['low', 'medium'] },
      ] }),
    }), 'https://gateway.example/v1', builtin).models.get('deepseek-v4-pro')!
    expect(levels(model)).toEqual(['off', 'low', 'medium'])
  })

  it('maps advertised none to Off without inventing other levels', () => {
    const model = readModelMetadata(metadataDocument({
      future: modelMetadata({ reasoning_options: [{ type: 'effort', values: ['none', 'low'] }] }),
    }), 'https://gateway.example/v1', builtin).models.get('future')!
    expect(levels(model)).toEqual(['off', 'low'])
    expect(model.thinkingLevelMap?.off).toBe('none')
  })
})

describe('reasoning through the Harness and SDK', () => {
  it.each([{ outage: false, efforts: false }, { outage: true, efforts: false }, { outage: false, efforts: true }])(
    'sends token budgets and restored selections with metadata outage=$outage, efforts=$efforts', async ({ outage, efforts }) => {
    const modelId = 'qwen3.7-plus'
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? Promise.resolve(outage ? new Response('', { status: 503 }) : Response.json(metadataDocument({
          [modelId]: modelMetadata({ provider: { npm: '@ai-sdk/anthropic' }, limit: { context: 100000, output: 32768 },
            reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', min: 1024, max: 20000 },
              ...efforts ? [{ type: 'effort', values: ['minimal', 'low', 'medium', 'high'] }] : []] }),
        }))) : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody([modelId]) })
    let config = configOf(gateway.url, { modelLimits: { [modelId]: { thinkingBudgets: [4096, 4096] } } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
    const events = [
      { type: 'message_start', message: { id: 'msg_budget', type: 'message', role: 'assistant', model: modelId,
        content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
      { type: 'message_stop' },
    ].map(event => JSON.stringify(event))
    try {
      const info = await ctx.llm.resolveModelInfo('dsh-opencode-go', modelId)
      expect(info.reasoning?.defaultEffort).toBeUndefined()
      expect(info.reasoning?.efforts).toEqual(efforts ? [
        { id: 'off', name: 'Off' }, { id: 'minimal', name: 'Minimal' }, { id: 'low', name: 'Low' },
        { id: 'medium', name: 'Medium' }, { id: 'high', name: 'High' }, { id: 'budget:4096', name: '4,096 tokens' },
      ] : [
        { id: 'off', name: 'Off' }, { id: 'minimal', name: '1,024 tokens' }, { id: 'low', name: '2,048 tokens' },
        { id: 'budget:4096', name: '4,096 tokens' }, { id: 'medium', name: '8,192 tokens' }, { id: 'high', name: '16,384 tokens' },
      ])
      const catalog = await discoverSettingsModels(adapter.catalogOf(config))
      expect(catalog.models[0]?.reasoningBudget).toEqual({ min: 1024, max: outage ? 64512 : 20000 })
      for (const [selection, budget] of [[undefined, undefined], ['off', undefined], ['minimal', 1024], ['low', 2048],
        ['medium', 8192], ['high', 16384], ['budget:4096', 4096]] as const) {
        gateway.pushCompletions({ events, namedEvents: true })
        const restored = JSON.parse(JSON.stringify({ provider: 'dsh-opencode-go', model: modelId,
          ...selection === undefined ? {} : { reasoningEffort: selection }, maxTokens: 2048,
          messages: [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'plugin', plugin: 'test' } })],
        }))
        const chunks = []
        for await (const chunk of ctx.llm.stream(restored)) chunks.push(chunk)
        expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
        const body = gateway.bodies.at(-1)
        if (selection === undefined) expect(body).not.toHaveProperty('thinking')
        else if (selection === 'off') expect(body).toHaveProperty('thinking.type', 'disabled')
        else expect(body).toMatchObject({ thinking: { type: 'enabled', budget_tokens: budget }, max_tokens: budget! + 2048 })
        expect(body).not.toHaveProperty('reasoning_effort')
        expect(body).not.toHaveProperty('output_config')
      }
      const snapshot = await adapter.catalogOf(config).snapshot()
      expect(snapshot.models.get(modelId)).not.toHaveProperty('reasoningBudgetPresets')
      const prepared = await adapter.prepareCall('dsh-opencode-go', modelId)
      config = { ...config, modelLimits: { [modelId]: { thinkingBudgets: [6000] } } }
      gateway.pushCompletions({ events, namedEvents: true })
      for await (const _chunk of prepared.stream({ provider: 'dsh-opencode-go', model: modelId,
        reasoningEffort: ReasoningEffortId('budget:4096'), messages: [], maxTokens: 2048 })) { /* Captured settings stay stable. */ }
      expect(gateway.bodies.at(-1)).toHaveProperty('thinking.budget_tokens', 4096)
      expect((await adapter.resolveModel('dsh-opencode-go', modelId)).reasoning?.efforts).toContainEqual({ id: 'budget:6000', name: '6,000 tokens' })
      const count = gateway.bodies.length
      await expect(adapter.stream({ provider: 'dsh-opencode-go', model: modelId,
        reasoningEffort: ReasoningEffortId('budget:4096'), messages: [] })[Symbol.asyncIterator]().next())
        .rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
      expect(gateway.bodies).toHaveLength(count)
      config = { ...config, modelLimits: { [modelId]: { contextWindow: 8192, thinkingBudgets: [6000] } } }
      gateway.pushCompletions({ events, namedEvents: true })
      for await (const _chunk of adapter.stream({ provider: 'dsh-opencode-go', model: modelId,
        reasoningEffort: ReasoningEffortId('budget:6000'), messages: [], maxTokens: 2048 })) { /* SDK shrinks to the context room. */ }
      const clamped = gateway.bodies.at(-1) as { max_tokens: number; thinking: { budget_tokens: number } }
      expect(clamped.thinking.budget_tokens).toBeLessThan(6000)
      expect(clamped.thinking.budget_tokens).toBeGreaterThanOrEqual(1024)
      expect(clamped.max_tokens - clamped.thinking.budget_tokens).toBeGreaterThanOrEqual(1024)
    } finally { await ctx.fiber.dispose() }
  })

  it.each([false, true])('uses adaptive Haiku thinking with metadata outage=%s', async outage => {
    const modelId = 'claude-haiku-5-5'
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
      String(input) === MODELS_METADATA_URL
        ? Promise.resolve(outage ? new Response('', { status: 503 }) : Response.json(metadataDocument({
            [modelId]: modelMetadata({ provider: { npm: '@ai-sdk/anthropic' },
              reasoning_options: [{ type: 'toggle' }, { type: 'effort', values: ['low', 'medium', 'high', 'xhigh', 'max'] }, { type: 'budget_tokens' }],
            }),
          }))) : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody([modelId]) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
    const events = [
      { type: 'message_start', message: { id: 'msg_haiku', type: 'message', role: 'assistant', model: modelId,
        content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
      { type: 'message_stop' },
    ].map(event => JSON.stringify(event))
    for (const effort of [undefined, 'low', 'medium', 'high', 'xhigh', 'max', 'off']) {
      gateway.pushCompletions({ events, namedEvents: true })
      const chunks = []
      for await (const chunk of adapter.stream({
        provider: 'dsh-opencode-go', model: modelId, ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
        messages: [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'plugin', plugin: 'test' } })],
      })) chunks.push(chunk)
      expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
      const body = gateway.bodies.at(-1)
      if (effort === undefined) expect(body).not.toHaveProperty('thinking')
      else expect(body).toMatchObject({ model: modelId, thinking: { type: effort === 'off' ? 'disabled' : 'adaptive' } })
      expect(body).not.toHaveProperty('thinking.budget_tokens')
      if (effort === undefined || effort === 'off') expect(body).not.toHaveProperty('output_config')
      else expect(body).toMatchObject({ output_config: { effort } })
    }
  })

  it.each([false, true])('keeps MiMo Default separate from Off with metadata outage=%s', async outage => {
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
      String(input) === MODELS_METADATA_URL
        ? Promise.resolve(outage ? new Response('', { status: 503 }) : Response.json(metadataDocument({
            [id]: modelMetadata({ reasoning_options: [] }),
          })))
        : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody([id]) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
    try {
      const info = await ctx.llm.resolveModelInfo('dsh-opencode-go', id)
      expect(info.reasoning?.efforts.map(effort => effort.id)).toEqual(['off', 'low', 'medium', 'high'])
      expect(info.reasoning?.defaultEffort).toBeUndefined()
      const snapshot = await adapter.catalogOf(configOf(gateway.url)).snapshot()
      const sharedMap = snapshot.models.get(id)!.thinkingLevelMap
      for (const effort of [undefined, 'off', 'low', 'medium', 'high', 'off', undefined]) {
        gateway.pushCompletions({ events: textEvents })
        const chunks = []
        for await (const chunk of ctx.llm.stream({
          provider: 'dsh-opencode-go', model: id,
          ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
          messages: [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'plugin', plugin: 'test' } })],
        })) chunks.push(chunk)
        expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
        const body = gateway.bodies.at(-1)
        if (effort === undefined) expect(body).not.toHaveProperty('reasoning_effort')
        else expect(body).toMatchObject({ reasoning_effort: effort === 'off' ? 'none' : effort })
        expect(body).not.toHaveProperty('thinking')
        expect(body).not.toHaveProperty('enable_thinking')
        expect(snapshot.models.get(id)!.thinkingLevelMap).toBe(sharedMap)
        expect(sharedMap?.off).toBe('none')
      }
      const requests = gateway.bodies.length
      for (const effort of ['minimal', 'xhigh', 'max']) {
        await expect(adapter.stream({ provider: 'dsh-opencode-go', model: id, messages: [],
          reasoningEffort: ReasoningEffortId(effort) })[Symbol.asyncIterator]().next())
          .rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
      }
      expect(gateway.bodies).toHaveLength(requests)
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('distinguishes Default from an advertised none mapping on a future model', async () => {
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) =>
      String(input) === MODELS_METADATA_URL
        ? Promise.resolve(Response.json(metadataDocument({
            future: modelMetadata({ reasoning_options: [{ type: 'effort', values: ['none', 'low'] }] }),
          }))) : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody(['future']) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
    for (const effort of [undefined, 'off']) {
      gateway.pushCompletions({ events: textEvents })
      for await (const _chunk of adapter.stream({ provider: 'dsh-opencode-go', model: 'future', messages: [],
        ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
      })) { /* Inspect each emitted request. */ }
    }
    expect(gateway.bodies[0]).not.toHaveProperty('reasoning_effort')
    expect(gateway.bodies[1]).toMatchObject({ reasoning_effort: 'none' })
  })
})


describe('reasoning intent at the SDK boundary', () => {
  it('uses native completion budget fields without an invented effort', async () => {
    const modelId = 'numeric-thinking'
    const known: Model<Api> = { ...builtin.get('deepseek-v4-flash')!, id: modelId,
      compat: { thinkingFormat: 'qwen', thinkingTokenBudgetField: 'thinking_budget', supportsReasoningEffort: true } }
    const gateway = await mockGateway({ status: 200, body: listingBody([]) })
    const model = readModelMetadata(metadataDocument({
      [modelId]: modelMetadata({ reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', min: 512, max: 10000 }] }),
    }), gateway.url, new Map([[modelId, known]])).models.get(modelId)!
    for (const [selection, budget] of [[undefined, undefined], ['off', undefined], ['low', 2048], ['medium', 8192]] as const) {
      gateway.pushCompletions({ events: textEvents })
      const stream = streamChat(model, { messages: [{ role: 'user', content: 'hi', timestamp: 0 }] }, {
        apiKey: 'test-key', maxTokens: 10000, maxRetries: 0, ...reasoningRequest(reasoningIntent(model, selection)),
      })
      for await (const _event of stream) { /* Inspect the actual serialized SDK payload. */ }
      const body = gateway.bodies.at(-1)
      expect(body).not.toHaveProperty('reasoning_effort')
      if (selection === undefined || selection === 'off') expect(body).not.toHaveProperty('thinking_budget')
      else expect(body).toMatchObject({ enable_thinking: true, thinking_budget: budget })
    }
  })

  it('rejects invalid budgets and preserves answer room at the SDK boundary', () => {
    const model = readModelMetadata(metadataDocument({
      budget: modelMetadata({ provider: { npm: '@ai-sdk/anthropic' }, limit: { context: 10000, output: 5000 },
        reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', min: 1500, max: 4500 }] }),
    }), 'https://gateway.example/v1', builtin).models.get('budget')!
    expect(reasoningBudgetRange(model)).toEqual({ min: 1500, max: 3976 })
    expect(reasoningChoices(model).map(choice => choice.name)).toEqual(['Off', '2,048 tokens'])
    for (const tokens of [1, 1024, 3977, 6000, 1.5, NaN]) {
      expect(() => reasoningChoices({ ...model, reasoningBudgetPresets: [tokens] })).toThrow(/between 1500 and 3976/)
    }
    for (const tokens of [0, -1, 1.5, NaN]) {
      expect(() => PlainConfig({ modelLimits: { budget: { thinkingBudgets: [tokens] } } })).toThrow()
    }
    const request = reasoningRequest({ kind: 'budget', tokens: 3000, min: 1500 })
    expect(request.onPayload({ thinking: { type: 'enabled', budget_tokens: 2000 }, max_tokens: 3500 }))
      .toMatchObject({ thinking: { budget_tokens: 2000 } })
    expect(() => request.onPayload({ thinking: { budget_tokens: 1024 }, max_tokens: 1500 })).toThrow(/at least 1500/)
    expect(() => request.onPayload({ thinking: { budget_tokens: 1500 }, max_tokens: 1500 })).toThrow(/at least 1500/)
  })

  it.each(['deepseek', 'qwen', 'qwen-chat-template', 'zai'] as const)(
    'preserves Default, native On, and Off separately for %s', async format => {
      const gateway = await mockGateway({ status: 200, body: listingBody([]) })
      const modelId = 'native-switch'
      const known: Model<Api> = { ...builtin.get('deepseek-v4-flash')!, id: modelId,
        compat: { thinkingFormat: format, supportsReasoningEffort: true } }
      const model = readModelMetadata(metadataDocument({
        [modelId]: modelMetadata({ reasoning_options: [{ type: 'toggle' }] }),
      }), gateway.url, new Map([[modelId, known]])).models.get(modelId)!
      for (const level of [undefined, 'high', 'off'] as const) {
        gateway.pushCompletions({ events: textEvents })
        const stream = streamChat(model, { messages: [{ role: 'user', content: 'hi', timestamp: 0 }] }, {
          apiKey: 'test-key', maxRetries: 0, ...reasoningRequest(reasoningIntent(model, level)),
        })
        for await (const _event of stream) { /* Check what the real SDK sends. */ }
        const body = gateway.bodies.at(-1)
        expect(body).not.toHaveProperty('reasoning_effort')
        if (level === undefined) {
          expect(body).not.toHaveProperty('thinking')
          expect(body).not.toHaveProperty('enable_thinking')
          expect(body).not.toHaveProperty('chat_template_kwargs.enable_thinking')
        } else if (format === 'qwen') {
          expect(body).toMatchObject({ enable_thinking: level !== 'off' })
        } else if (format === 'qwen-chat-template') {
          expect(body).toMatchObject({ chat_template_kwargs: { enable_thinking: level !== 'off', preserve_thinking: true } })
        } else {
          expect(body).toMatchObject({ thinking: { type: level === 'off' ? 'disabled' : 'enabled' } })
        }
      }
    },
  )

  it('keeps non-policy payload fields and the shared SDK payload intact', () => {
    const source = { model: 'future', thinking: { type: 'disabled' }, reasoning_effort: 'none',
      reasoning: { effort: 'none', summary: 'auto' }, output_config: { effort: 'high', format: { type: 'json_schema' } },
      chat_template_kwargs: { enable_thinking: false, preserve_thinking: true }, tools: [{ name: 'probe' }] }
    const original = structuredClone(source)
    expect(reasoningRequest({ kind: 'default' }).onPayload(source)).toEqual({ model: 'future',
      reasoning: { summary: 'auto' }, output_config: { format: { type: 'json_schema' } },
      chat_template_kwargs: { preserve_thinking: true }, tools: [{ name: 'probe' }] })
    expect(source).toEqual(original)
  })
})
