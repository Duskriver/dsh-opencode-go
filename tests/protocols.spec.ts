import LlmRuntime from '@deepseek-ai/dsh-llm'
import {
  createUserMessage,
  ReasoningEffortId,
  userAgent,
  type GenerateOptions,
  type StreamChunk,
  BlockAssembler,
} from '@deepseek-ai/dsh-llm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { getSupportedThinkingLevels, type Api, normalizeContext } from 'opencode-go-pi-ai'
import { getBuiltinModels } from 'opencode-go-pi-ai/providers/all'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import {
  readModelMetadata,
  reasoningBudgetRange,
  reasoningChoices,
  reasoningIntent,
  reasoningRequest,
  withGatewayReasoning,
  discoverSettingsModels,
  withProtocolOverride,
  modelBaseURL,
} from '../src/catalog.ts'
import { streamSimple as streamChat } from 'opencode-go-pi-ai/api/openai-completions'
import { PlainConfig, validateGoConfig } from '../src/config.ts'
import { configOf } from './support/host.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents, googleTextEvents } from './support/gateway.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/data.ts'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { RESPONSES_OVERRIDE_MODEL as MODEL } from '../src/contracts.ts'
import { GoogleGenAI } from '@google/genai'
import { streamSimple } from '../src/google.ts'
import type { Model } from '../src/sdk-types.ts'

describe("reasoning controls", () => {
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
})

describe("Responses routing", () => {
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

    it.each([undefined, '', '会话\r\n-a', '   '])('shares a safe Responses cache key and header across account retry with sessionId=%s', async sessionId => {
      const gateway = await mockGateway({ status: 200, body: listingBody([MODEL]) })
      gateway.pushCompletions({ status: 401, body: JSON.stringify({ error: { message: 'Invalid API key' } }) })
      gateway.pushCompletions({ events: responsesEvents() })
      const config = configOf(gateway.url, { protocolOverrides: override, apiKeyEnv: 'ACCOUNT_A', autoSwitch: true,
        accounts: [{ id: 'a', name: 'A', apiKeyEnv: 'ACCOUNT_A' }, { id: 'b', name: 'B', apiKeyEnv: 'ACCOUNT_B' }] })
      const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async config => `${config.apiKeyEnv}-fixture` })
      const input = Object.freeze(request({ sessionId: sessionId as GenerateOptions['sessionId'] }))
      try {
        expect((await drain(adapter.stream(input))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
        expect(gateway.paths).toEqual(['/models', '/responses', '/responses'])
        const attempts = gateway.headers.filter(header => header.authorization)
        const identity = attempts[0]?.['x-opencode-session']
        expect(identity).toMatch(/^[\x21-\x7e]+$/)
        expect(attempts[1]?.['x-opencode-session']).toBe(identity)
        for (const body of gateway.bodies) expect(body).toMatchObject({ prompt_cache_key: identity })
        expect(input.sessionId).toBe(sessionId)
      } finally { await adapter.dispose() }
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

    it.each(['https://opencode.ai/zen/go/v1/', 'https://opencode.ai/inference/go/v1'])('keeps experimental Responses on the official OpenAI endpoint for %s', base => {
      const raw = readModelMetadata(metadataDocument(), base, new Map()).models.get(MODEL)!
      expect(withProtocolOverride(raw, configOf(base, { protocolOverrides: override })))
        .toMatchObject({ api: 'openai-responses', baseUrl: 'https://opencode.ai/inference/go/openai/v1' })
      expect(raw.api).toBe('openai-completions')
    })

    it.each([[], 'openai-responses', { 'kimi-k3': 'openai-responses' }, { [MODEL]: 'anthropic-messages' }])('refuses unsupported override configuration %j', value => {
      expect(() => validateGoConfig(PlainConfig({ protocolOverrides: value }))).toThrow()
    })
  })
})

describe("Google transport and replay", () => {
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

  it.each([
    'https://opencode.ai/zen/go/v1', 'https://opencode.ai/zen/go/v1/',
    'https://opencode.ai/inference/go/v1', 'https://opencode.ai/inference/go/v1/',
  ])('selects the documented protocol base from the official gateway %s', base => {
    expect(readModelMetadata(metadata, base, new Map()).models.get(id)?.baseUrl)
      .toBe('https://opencode.ai/inference/go/google/v1beta')
    expect(modelBaseURL('google-generative-ai', base)).toBe('https://opencode.ai/inference/go/google/v1beta')
    expect(modelBaseURL('openai-completions', base)).toBe('https://opencode.ai/inference/go/openai/v1')
    expect(modelBaseURL('openai-responses', base)).toBe('https://opencode.ai/inference/go/openai/v1')
    // The Anthropic SDK appends /v1/messages itself.
    expect(modelBaseURL('anthropic-messages', base)).toBe('https://opencode.ai/inference/go/anthropic')
  })

  it('preserves custom gateways for every protocol', () => {
    expect(modelBaseURL('google-generative-ai', 'https://gateway.example/zen/go/v1')).toBe('https://gateway.example/zen/go/v1')
    expect(modelBaseURL('google-generative-ai', 'http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1')
    expect(modelBaseURL('openai-completions', 'https://gateway.example/v1/')).toBe('https://gateway.example/v1')
    expect(modelBaseURL('openai-responses', 'https://gateway.example/v1/')).toBe('https://gateway.example/v1')
    expect(modelBaseURL('anthropic-messages', 'https://gateway.example/v1/')).toBe('https://gateway.example')
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
})
