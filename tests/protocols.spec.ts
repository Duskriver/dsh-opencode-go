import LlmRuntime, { createAssistantMessage, createUserMessage, createToolResultMessage, ReasoningEffortId, ToolCallId, type GenerateOptions, type StreamChunk, BlockAssembler, userAgent } from '@deepseek-ai/dsh-llm'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSupportedThinkingLevels, normalizeContext } from 'opencode-go-pi-ai'
import { streamSimple as streamChat } from 'opencode-go-pi-ai/api/openai-completions'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { GoogleGenAI } from '@google/genai'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { readModelDirectory, reasoningBudgetRange, reasoningChoices, reasoningIntent, reasoningRequest, discoverSettingsModels, modelBaseURL } from '../src/catalog.ts'
import { PlainConfig } from '../src/config.ts'
import { streamSimple } from '../src/google.ts'
import type { Model } from '../src/sdk-types.ts'
import { configOf, drain, requestOf } from './support/host.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents, googleTextEvents } from './support/gateway.ts'
import { modelsDocument, modelEntry, protocolEntry } from './support/data.ts'

const parsed = (entry: Record<string, unknown>) => readModelDirectory(modelsDocument({ future: entry }), 'https://gateway.example/v1').models.get('future')!
const anthropicEvents = (id: string) => [
  { type: 'message_start', message: { id: 'msg_fixture', type: 'message', role: 'assistant', model: id,
    content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
  { type: 'message_stop' },
].map(event => JSON.stringify(event))

describe('reasoning declarations', () => {
  it.each(['mimo-v2.6-flash', 'future-model'])('offers no invented levels for intrinsically reasoning %s', id => {
    const model = readModelDirectory(modelsDocument({ [id]: modelEntry({ capabilities: { reasoning: { supported: true } } }) }), 'https://gateway.example/v1').models.get(id)!
    expect(model.reasoning).toBe(true)
    expect(getSupportedThinkingLevels(model)).toEqual([])
    expect(reasoningChoices(model)).toEqual([])
    expect(model.thinkingLevelMap?.off).toBeNull()
  })
  it('maps only advertised efforts, including none, and does not inherit levels from family siblings', () => {
    const result = readModelDirectory(modelsDocument({
      full: modelEntry({ family: 'mimo', capabilities: { reasoning: { supported: true, effort: ['none', 'low', 'medium', 'high'] } } }),
      empty: modelEntry({ family: 'mimo', capabilities: { reasoning: { supported: true } } }),
    }), 'https://gateway.example/v1')
    expect(getSupportedThinkingLevels(result.models.get('full')!)).toEqual(['off', 'low', 'medium', 'high'])
    expect(result.models.get('full')?.thinkingLevelMap?.off).toBe('none')
    expect(getSupportedThinkingLevels(result.models.get('empty')!)).toEqual([])
  })
  it('ignores unknown effort spellings and unsupported reasoning', () => {
    expect(getSupportedThinkingLevels(parsed(modelEntry({ capabilities: { reasoning: { supported: true, effort: ['future', null, 'low'] } } })))).toEqual(['low'])
    expect(reasoningChoices(parsed(modelEntry({ capabilities: { reasoning: { supported: false, effort: ['low'] } } })))).toEqual([])
  })
  it.each(['deepseek', 'qwen', 'glm'])('offers declared native On/Off for family %s without inventing efforts', family => {
    const model = parsed(modelEntry({ family, capabilities: { reasoning: { supported: true, toggle: true } } }))
    expect(model.reasoningControl).toBe('toggle')
    expect(model.thinkingLevelMap).not.toHaveProperty('off')
    expect(reasoningChoices(model)).toEqual([{ id: 'off', name: 'Off' }, { id: 'high', name: 'On' }])
  })
  it('does not synthesize high alongside declared efforts on native toggles', () => {
    const model = parsed(modelEntry({ family: 'deepseek', capabilities: { reasoning: { supported: true, toggle: true, effort: ['low', 'medium'] } } }))
    expect(getSupportedThinkingLevels(model)).toEqual(['off', 'low', 'medium'])
  })
  it('does not offer a generic toggle without a known wire format', () => {
    expect(getSupportedThinkingLevels(parsed(modelEntry({ capabilities: { reasoning: { supported: true, toggle: true } } })))).toEqual([])
  })
  it('uses adaptive Anthropic thinking for effort controls and token budgets for budget declarations', () => {
    const adaptive = parsed(modelEntry({ api: protocolEntry('messages'), capabilities: { reasoning: { supported: true, toggle: true, effort: ['low', 'xhigh'] }, temperature: false } }))
    expect(adaptive.compat).toMatchObject({ forceAdaptiveThinking: true, supportsTemperature: false })
    expect(adaptive.reasoningBudget).toBeUndefined()
    const budget = parsed(modelEntry({ api: protocolEntry('messages'), capabilities: { reasoning: { supported: true, toggle: true, budget: { min: 512, max: 10000 } } } }))
    expect(budget.compat).toMatchObject({ forceAdaptiveThinking: false })
    expect(budget.reasoningBudget).toEqual({ min: 1024, max: 10000 })
    expect(budget.reasoningControl).toBe('budget')
  })
})

describe('reasoning through Harness and SDK', () => {
  it.each(['chat-completions', 'messages'])('serializes inherited effort with partial %s reasoning capabilities', async protocol => {
    const id = 'partial-reasoning'
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ [id]: modelEntry({
      capabilities: { reasoning: { supported: true, effort: ['low', 'high'] } },
      api: protocolEntry(protocol, { capabilities: { reasoning: { toggle: true } } }),
    }) }) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'key' })
    expect((await adapter.resolveModel('dsh-opencode-go', id)).reasoning?.efforts).toContainEqual({ id: 'high', name: 'High' })
    gateway.pushCompletions({ events: protocol === 'messages' ? anthropicEvents(id) : textEvents, namedEvents: protocol === 'messages' })
    expect((await drain(adapter.stream(requestOf({ model: id, reasoningEffort: ReasoningEffortId('high') })))).at(-1))
      .toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    const body = gateway.bodies.at(-1)
    if (protocol === 'messages') {
      expect(body).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'high' } })
      expect(body).not.toHaveProperty('thinking.budget_tokens')
    } else expect(body).toHaveProperty('reasoning_effort', 'high')
  })
  it.each([false, true])('serializes declared budgets, including persisted selections, with cached outage=%s', async outage => {
    const id = 'future-budget'
    const body = modelsDocument({ [id]: modelEntry({ api: protocolEntry('messages'), limit: { context: 100000, output: 32768 },
      capabilities: { reasoning: { supported: true, toggle: true, budget: { min: 1024, max: 20000 } } } }) })
    const gateway = await mockGateway({ status: 200, body })
    let config = configOf(gateway.url, { modelLimits: { [id]: { thinkingBudgets: [4096, 4096] } } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'key' })
    const ctx = new Context(); await ctx.plugin(LlmRuntime); ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
    try {
      await adapter.catalogOf(config).snapshot(true)
      if (outage) { gateway.setModelListing(503, {}); await adapter.catalogOf(config).snapshot(true) }
      const info = await ctx.llm.resolveModelInfo('dsh-opencode-go', id)
      expect(info.reasoning?.defaultEffort).toBeUndefined()
      expect(info.reasoning?.efforts).toEqual([
        { id: 'off', name: 'Off' }, { id: 'minimal', name: '1,024 tokens' }, { id: 'low', name: '2,048 tokens' },
        { id: 'budget:4096', name: '4,096 tokens' }, { id: 'medium', name: '8,192 tokens' }, { id: 'high', name: '16,384 tokens' },
      ])
      for (const [selection, budget] of [[undefined, undefined], ['off', undefined], ['minimal', 1024], ['low', 2048], ['medium', 8192], ['high', 16384], ['budget:4096', 4096]] as const) {
        gateway.pushCompletions({ events: anthropicEvents(id), namedEvents: true })
        const restored = JSON.parse(JSON.stringify(requestOf({ model: id, maxTokens: 2048, ...selection === undefined ? {} : { reasoningEffort: ReasoningEffortId(selection) } })))
        expect((await drain(ctx.llm.stream(restored))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
        const sent = gateway.bodies.at(-1)
        if (selection === undefined) expect(sent).not.toHaveProperty('thinking')
        else if (selection === 'off') expect(sent).toHaveProperty('thinking.type', 'disabled')
        else expect(sent).toMatchObject({ thinking: { type: 'enabled', budget_tokens: budget }, max_tokens: budget! + 2048 })
        expect(sent).not.toHaveProperty('reasoning_effort')
        expect(sent).not.toHaveProperty('output_config')
      }
      const shared = (await adapter.catalogOf(config).snapshot()).models.get(id)!
      expect(shared).not.toHaveProperty('reasoningBudgetPresets')
      const prepared = await adapter.prepareCall('dsh-opencode-go', id)
      config = { ...config, modelLimits: { [id]: { thinkingBudgets: [6000] } } }
      gateway.pushCompletions({ events: anthropicEvents(id), namedEvents: true })
      await drain(prepared.stream(requestOf({ model: id, maxTokens: 2048, reasoningEffort: ReasoningEffortId('budget:4096') })))
      expect(gateway.bodies.at(-1)).toHaveProperty('thinking.budget_tokens', 4096)
      expect((await adapter.resolveModel('dsh-opencode-go', id)).reasoning?.efforts).toContainEqual({ id: 'budget:6000', name: '6,000 tokens' })
      const count = gateway.bodies.length
      await expect(drain(adapter.stream(requestOf({ model: id, reasoningEffort: ReasoningEffortId('budget:4096') })))).rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
      expect(gateway.bodies).toHaveLength(count)
      config = { ...config, modelLimits: { [id]: { contextWindow: 8192, thinkingBudgets: [6000] } } }
      gateway.pushCompletions({ events: anthropicEvents(id), namedEvents: true })
      await drain(adapter.stream(requestOf({ model: id, maxTokens: 2048, reasoningEffort: ReasoningEffortId('budget:6000') })))
      const clamped = gateway.bodies.at(-1) as { max_tokens: number; thinking: { budget_tokens: number } }
      expect(clamped.thinking.budget_tokens).toBeLessThan(6000)
      expect(clamped.thinking.budget_tokens).toBeGreaterThanOrEqual(1024)
      expect(clamped.max_tokens - clamped.thinking.budget_tokens).toBeGreaterThanOrEqual(1024)
    } finally { await ctx.fiber.dispose() }
  })
  it.each([false, true])('serializes adaptive thinking for any Anthropic effort model with cached outage=%s', async outage => {
    const id = 'future-anthropic'
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ [id]: modelEntry({ api: protocolEntry('messages'),
      capabilities: { reasoning: { supported: true, toggle: true, effort: ['low', 'medium', 'high', 'xhigh', 'max'] }, temperature: false } }) }) })
    const config = configOf(gateway.url), adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'key' })
    await adapter.catalogOf(config).snapshot(true)
    if (outage) { gateway.setModelListing(503, {}); await adapter.catalogOf(config).snapshot(true) }
    for (const effort of [undefined, 'low', 'medium', 'high', 'xhigh', 'max', 'off']) {
      gateway.pushCompletions({ events: anthropicEvents(id), namedEvents: true })
      const chunks = await drain(adapter.stream(requestOf({ model: id, temperature: 0.5, ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) } })))
      expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      const body = gateway.bodies.at(-1)
      if (effort === undefined) expect(body).not.toHaveProperty('thinking')
      else expect(body).toMatchObject({ thinking: { type: effort === 'off' ? 'disabled' : 'adaptive' } })
      expect(body).not.toHaveProperty('thinking.budget_tokens')
      expect(body).not.toHaveProperty('temperature')
      if (effort === undefined || effort === 'off') expect(body).not.toHaveProperty('output_config')
      else expect(body).toMatchObject({ output_config: { effort } })
    }
  })
  it.each(['mimo-v2.6-flash', 'future-effort'])('keeps Default separate from declared none for %s and refuses unadvertised levels', async id => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ [id]: modelEntry({ capabilities: { reasoning: { supported: true, effort: ['none', 'low', 'medium', 'high'] } } }) }) })
    const config = configOf(gateway.url), adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'key' })
    const shared = (await adapter.catalogOf(config).snapshot()).models.get(id)!
    const map = shared.thinkingLevelMap
    for (const effort of [undefined, 'off', 'low', 'medium', 'high', 'off', undefined]) {
      gateway.pushCompletions({ events: textEvents })
      expect((await drain(adapter.stream(requestOf({ model: id, ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) } })))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      const body = gateway.bodies.at(-1)
      if (effort === undefined) expect(body).not.toHaveProperty('reasoning_effort')
      else expect(body).toHaveProperty('reasoning_effort', effort === 'off' ? 'none' : effort)
      expect(body).not.toHaveProperty('thinking'); expect(body).not.toHaveProperty('enable_thinking')
      expect(shared.thinkingLevelMap).toBe(map)
    }
    const count = gateway.bodies.length
    for (const level of ['minimal', 'xhigh', 'max']) await expect(drain(adapter.stream(requestOf({ model: id, reasoningEffort: ReasoningEffortId(level) })))).rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
    expect(gateway.bodies).toHaveLength(count)
  })
  it('uses declared completion budget fields without an invented effort', async () => {
    const gateway = await mockGateway({ status: 200, body: { data: [] } })
    const model = readModelDirectory(modelsDocument({ budget: modelEntry({ family: 'qwen',
      capabilities: { reasoning: { supported: true, toggle: true, budget: { min: 512, max: 10000 } } },
      api: protocolEntry('chat-completions', { compatibility: { thinking_budget_field: 'thinking_budget' } }) }) }), gateway.url).models.get('budget')!
    for (const [selection, budget] of [[undefined, undefined], ['off', undefined], ['low', 2048], ['medium', 8192]] as const) {
      gateway.pushCompletions({ events: textEvents })
      await Array.fromAsync(streamChat(model, { messages: [{ role: 'user', content: 'hi', timestamp: 0 }] }, {
        apiKey: 'key', maxTokens: 10000, maxRetries: 0, ...reasoningRequest(reasoningIntent(model, selection)),
      }))
      const body = gateway.bodies.at(-1)
      expect(body).not.toHaveProperty('reasoning_effort')
      if (selection === undefined || selection === 'off') expect(body).not.toHaveProperty('thinking_budget')
      else expect(body).toMatchObject({ enable_thinking: true, thinking_budget: budget })
    }
  })
  it('rejects invalid budgets and preserves answer room at the SDK boundary', () => {
    const model = parsed(modelEntry({ api: protocolEntry('messages'), limit: { context: 10000, output: 5000 },
      capabilities: { reasoning: { supported: true, toggle: true, budget: { min: 1500, max: 4500 } } } }))
    expect(reasoningBudgetRange(model)).toEqual({ min: 1500, max: 3976 })
    expect(reasoningChoices(model).map(choice => choice.name)).toEqual(['Off', '2,048 tokens'])
    // Unusable configured budgets are filtered instead of failing the model;
    // only valid presets are offered as extra choices.
    for (const tokens of [1, 1024, 3977, 6000, 1.5, NaN]) {
      expect(() => reasoningChoices({ ...model, reasoningBudgetPresets: [tokens] })).not.toThrow()
    }
    expect(reasoningChoices({ ...model, reasoningBudgetPresets: [1, 1024, 2048, 3977, 6000, 1.5, NaN] }))
      .toEqual([{ id: 'off', name: 'Off' }, { id: 'low', name: '2,048 tokens' }])
    for (const tokens of [0, -1, 1.5, NaN]) expect(() => PlainConfig({ modelLimits: { budget: { thinkingBudgets: [tokens] } } })).toThrow()
    const request = reasoningRequest({ kind: 'budget', tokens: 3000, min: 1500 })
    expect(request.onPayload({ thinking: { type: 'enabled', budget_tokens: 2000 }, max_tokens: 3500 })).toMatchObject({ thinking: { budget_tokens: 2000 } })
    expect(() => request.onPayload({ thinking: { budget_tokens: 1024 }, max_tokens: 1500 })).toThrow(/at least 1500/)
    expect(() => request.onPayload({ thinking: { budget_tokens: 1500 }, max_tokens: 1500 })).toThrow(/at least 1500/)
  })
  it.each(['deepseek', 'qwen', 'qwen-chat-template', 'zai'] as const)('preserves Default, native On and Off separately with SDK format %s', async format => {
    const gateway = await mockGateway({ status: 200, body: { data: [] } })
    const model = { ...readModelDirectory(modelsDocument({ toggle: modelEntry({ family: 'deepseek', capabilities: { reasoning: { supported: true, toggle: true } } }) }), gateway.url).models.get('toggle')!,
      compat: { thinkingFormat: format, supportsReasoningEffort: true } }
    for (const level of [undefined, 'high', 'off'] as const) {
      gateway.pushCompletions({ events: textEvents })
      await Array.fromAsync(streamChat(model, { messages: [{ role: 'user', content: 'hi', timestamp: 0 }] }, { apiKey: 'key', maxRetries: 0, ...reasoningRequest(reasoningIntent(model, level)) }))
      const body = gateway.bodies.at(-1)
      expect(body).not.toHaveProperty('reasoning_effort')
      if (level === undefined) {
        expect(body).not.toHaveProperty('thinking'); expect(body).not.toHaveProperty('enable_thinking'); expect(body).not.toHaveProperty('chat_template_kwargs.enable_thinking')
      } else if (format === 'qwen') expect(body).toHaveProperty('enable_thinking', level !== 'off')
      else if (format === 'qwen-chat-template') expect(body).toMatchObject({ chat_template_kwargs: { enable_thinking: level !== 'off', preserve_thinking: true } })
      else expect(body).toHaveProperty('thinking.type', level === 'off' ? 'disabled' : 'enabled')
    }
  })
  it('preserves non-policy fields and leaves shared payloads intact', () => {
    const source = { model: 'future', thinking: { type: 'disabled' }, reasoning_effort: 'none', reasoning: { effort: 'none', summary: 'auto' },
      output_config: { effort: 'high', format: { type: 'json_schema' } }, chat_template_kwargs: { enable_thinking: false, preserve_thinking: true }, tools: [{ name: 'probe' }] }
    const original = structuredClone(source)
    expect(reasoningRequest({ kind: 'default' }).onPayload(source)).toEqual({ model: 'future', reasoning: { summary: 'auto' },
      output_config: { format: { type: 'json_schema' } }, chat_template_kwargs: { preserve_thinking: true }, tools: [{ name: 'probe' }] })
    expect(source).toEqual(original)
  })
})

describe('declared Responses routing', () => {
  const tool = { name: 'probe', description: 'Probe', parameters: { type: 'object', properties: {} } }

  const user = (text: string) => createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'test' } })

  const request = (extra: Partial<GenerateOptions> = {}): GenerateOptions => ({
    provider: 'dsh-opencode-go', model: 'future-responses', messages: [user('hello')], sessionId: 'declared-session' as never, ...extra,
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

  it.each([false, true])('uses declared Responses for text/tools=%s with replay and session affinity', async callingTool => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ 'future-responses': modelEntry({ api: protocolEntry('responses') }) }) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
    gateway.pushCompletions({ events: responsesEvents(callingTool) })
    const assembler = new BlockAssembler()
    for await (const chunk of adapter.stream(request({ tools: [tool], maxTokens: 1234, reasoningEffort: ReasoningEffortId('high') }))) assembler.push(chunk)
    expect(assembler.finish.kind).toBe(callingTool ? 'tool-calls' : 'stop')
    expect(gateway.paths.at(-1)).toBe('/responses')
    expect(gateway.bodies[0]).toMatchObject({ model: 'future-responses', max_output_tokens: 1234, reasoning: { effort: 'high' } })
    expect(gateway.bodies[0]).not.toHaveProperty('max_tokens')
    expect(gateway.headers.at(-1)?.['x-opencode-session']).toBe('declared-session')
    expect(gateway.headers.at(-1)?.authorization).toBe('Bearer fixture-key')
    expect(assembler.replayState).toBeDefined()
    const replay = JSON.parse(JSON.stringify(assembler.replayState))
    expect(JSON.stringify(replay)).toContain('OPAQUE_REASONING')
  })
  it.each([undefined, 'low', 'high', 'max'])('serializes declared Responses effort=%s with limits, usage and private replay', async effort => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ 'future-responses': modelEntry({ api: protocolEntry('responses') }) }) })
    gateway.pushCompletions({ events: responsesEvents() })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { modelLimits: { 'future-responses': { maxTokens: 1234 } } }), resolveApiKey: async () => 'fixture-key' })
    expect((await adapter.resolveModel('dsh-opencode-go', 'future-responses')).reasoning?.efforts.map(effort => effort.id)).toEqual(['low', 'high', 'max'])
    const chunks = await drain(adapter.stream(request({ ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) } })))
    expect(gateway.paths).toEqual(['/models', '/responses'])
    expect(gateway.headers[1]).toMatchObject({ 'x-opencode-session': 'declared-session', 'user-agent': userAgent(), authorization: 'Bearer fixture-key' })
    expect(gateway.headers[1]?.session_id).toBeUndefined()
    const body = gateway.bodies[0] as Record<string, unknown>
    expect(body).toMatchObject({ model: 'future-responses', stream: true, store: false, max_output_tokens: 1234, prompt_cache_key: 'declared-session' })
    if (effort === undefined) expect(body.reasoning).toBeUndefined()
    else expect(body).toMatchObject({ reasoning: { effort, summary: 'auto' }, include: ['reasoning.encrypted_content'] })
    expect(body).not.toHaveProperty('max_tokens')
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
    expect(chunks.find(chunk => chunk.type === 'usage')).toMatchObject({ usage: { inputTokens: 6, cacheReadTokens: 4, outputTokens: 3, totalTokens: 13 } })
    expect(chunks.at(-1)).toMatchObject({ reason: { kind: 'stop' }, replayState: { response: { api: 'openai-responses' } } })
  })
  it.each([undefined, '', '会话\r\n-a', '   '])('shares a safe Responses cache key across account retry, session=%j', async sessionId => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ 'future-responses': modelEntry({ api: protocolEntry('responses') }) }) })
    gateway.pushCompletions({ status: 401, body: '{"error":{"message":"Invalid API key"}}' }); gateway.pushCompletions({ events: responsesEvents() })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { apiKeyEnv: 'A', autoSwitch: true, accounts: [
      { id: 'a', name: 'A', apiKeyEnv: 'A' }, { id: 'b', name: 'B', apiKeyEnv: 'B' },
    ] }), resolveApiKey: async config => `${config.apiKeyEnv}-fixture` })
    const input = Object.freeze(request({ sessionId: sessionId as GenerateOptions['sessionId'] }))
    expect((await drain(adapter.stream(input))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    expect(gateway.paths).toEqual(['/models', '/responses', '/responses'])
    const attempts = gateway.headers.filter(header => header.authorization), identity = attempts[0]?.['x-opencode-session']
    expect(identity).toMatch(/^[\x21-\x7e]+$/)
    expect(attempts[1]?.['x-opencode-session']).toBe(identity)
    for (const body of gateway.bodies) expect(body).toHaveProperty('prompt_cache_key', identity)
    expect(input.sessionId).toBe(sessionId)
  })
  it('normalizes durable image attachments for declared Responses models', async () => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ 'future-responses': modelEntry({ api: protocolEntry('responses') }) }) })
    gateway.pushCompletions({ events: responsesEvents() })
    const attachment = { attachmentId: AttachmentId(`sha256:${'a'.repeat(64)}`), mediaType: 'image/png', bytes: 1, width: 1, height: 1 }
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key',
      imageAccess: { resolveImageAccess: () => undefined, resolveAttachments: () => ({ readImageRequest: async () => ({
        variantId: `sha256:${'b'.repeat(64)}`, attachment, data: Uint8Array.of(1), mediaType: 'image/png', bytes: 1,
        width: 1, height: 1, depth: 'uchar', space: 'srgb', hasAlpha: true,
      }) }) as never } })
    await drain(adapter.stream(request({ messages: [createUserMessage({ content: [{ type: 'image', attachment }], source: { kind: 'plugin', plugin: 'test' } })] })))
    expect(gateway.bodies[0]).toMatchObject({ input: [expect.objectContaining({ role: 'user', content: expect.arrayContaining([
      expect.objectContaining({ type: 'input_image', image_url: 'data:image/png;base64,AQ==' }),
    ]) })] })
  })

  it('captures prepared protocols while refreshing the next call from a changed directory', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['future-responses']) })
    const config = configOf(gateway.url), adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'fixture-key' })
    const prepared = await adapter.prepareCall('dsh-opencode-go', 'future-responses')
    const raw = (await adapter.catalogOf(config).snapshot()).models.get('future-responses')!
    gateway.setModelListing(200, modelsDocument({ 'future-responses': modelEntry({ api: protocolEntry('responses') }) }))
    await adapter.catalogOf(config).snapshot(true)
    gateway.pushCompletions({ events: textEvents }); await drain(prepared.stream(request()))
    expect(gateway.paths.at(-1)).toBe('/chat/completions')
    gateway.pushCompletions({ events: responsesEvents() }); await drain(adapter.stream(request()))
    expect(gateway.paths.at(-1)).toBe('/responses')
    expect(raw.api).toBe('openai-completions')
  })
  it('surfaces an unsupported-protocol rejection without trying another protocol or account', async () => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ 'future-responses': modelEntry({ api: protocolEntry('responses') }) }) })
    gateway.pushCompletions({ status: 400, body: '{"error":{"message":"unsupported protocol"}}' })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { autoSwitch: true, apiKeyEnv: 'A', accounts: [
      { id: 'a', name: 'A', apiKeyEnv: 'A' }, { id: 'b', name: 'B', apiKeyEnv: 'B' },
    ] }), resolveApiKey: async () => 'fixture-key' })
    expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error' } })
    expect(gateway.bodies).toHaveLength(1)
    expect(gateway.paths.at(-1)).toBe('/responses')
  })
})
describe("Google transport and replay", () => {
  const id = 'gemini-4-argon'

  const metadata = modelsDocument({ [id]: modelEntry({
    name: 'Gemini 4 Argon', api: protocolEntry('generate-content'),
    capabilities: { reasoning: { supported: true, effort: ['low', 'medium', 'high'] } },
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
    expect(readModelDirectory(metadata, base).models.get(id)?.baseUrl)
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
    const gateway = await mockGateway({ status: 200, body: metadata })
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
    expect(catalog.models).toContainEqual(expect.objectContaining({ id, name: 'Gemini 4 Argon', releaseDate: '2026-10-13' }))
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
    const model = readModelDirectory(metadata, 'https://gateway.invalid/v1').models.get(id)! as Model<'google-generative-ai'>
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

  it.each(['unrecognized-google-alias', 'gemini-4-budget-alias'])('uses declared numeric budgets independently of the Google model name: %s', async modelId => {
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ [modelId]: modelEntry({ api: protocolEntry('generate-content'),
      limit: { context: 100000, output: 20000 }, capabilities: { reasoning: { supported: true, toggle: true, budget: { min: 512, max: 10000 } } } }) }) })
    const config = configOf(gateway.url, { modelLimits: { [modelId]: { thinkingBudgets: [4096] } } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'key' }); adapters.push(adapter)
    expect((await adapter.resolveModel('dsh-opencode-go', modelId)).reasoning?.efforts).toContainEqual({ id: 'budget:4096', name: '4,096 tokens' })
    for (const [selection, budget] of [[undefined, undefined], ['off', 0], ['low', 2048], ['medium', 8192], ['budget:4096', 4096]] as const) {
      gateway.pushCompletions({ events: googleTextEvents })
      const chunks = await drain(adapter.stream(requestOf({ model: modelId, maxTokens: 10000,
        ...selection === undefined ? {} : { reasoningEffort: ReasoningEffortId(selection) } })))
      expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      const body = gateway.bodies.at(-1)
      if (selection === undefined) expect(body).not.toHaveProperty('generationConfig.thinkingConfig')
      else expect(body).toHaveProperty('generationConfig.thinkingConfig.thinkingBudget', budget)
      expect(body).not.toHaveProperty('generationConfig.thinkingConfig.thinkingLevel')
    }
  })

  it('uses declared Google effort levels for a new alias instead of an SDK-invented token budget', async () => {
    const modelId = 'new-google-effort-alias'
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ [modelId]: modelEntry({ api: protocolEntry('generate-content'),
      capabilities: { reasoning: { supported: true, effort: ['low', 'medium', 'high'] } } }) }) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'key' }); adapters.push(adapter)
    gateway.pushCompletions({ events: googleTextEvents })
    expect((await drain(adapter.stream(requestOf({ model: modelId, reasoningEffort: ReasoningEffortId('medium') })))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
    expect(gateway.bodies[0]).toHaveProperty('generationConfig.thinkingConfig.thinkingLevel', 'MEDIUM')
    expect(gateway.bodies[0]).not.toHaveProperty('generationConfig.thinkingConfig.thinkingBudget')
  })

  it('honors declared Google toggles without inventing an effort level', async () => {
    const modelId = 'new-google-toggle-alias'
    const gateway = await mockGateway({ status: 200, body: modelsDocument({ [modelId]: modelEntry({ api: protocolEntry('generate-content'),
      capabilities: { reasoning: { supported: true, toggle: true } } }) }) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'key' }); adapters.push(adapter)
    expect((await adapter.resolveModel('dsh-opencode-go', modelId)).reasoning?.efforts).toEqual([{ id: 'off', name: 'Off' }, { id: 'high', name: 'On' }])
    for (const selection of [undefined, 'off', 'high']) {
      gateway.pushCompletions({ events: googleTextEvents })
      expect((await drain(adapter.stream(requestOf({ model: modelId, ...selection === undefined ? {} : { reasoningEffort: ReasoningEffortId(selection) } })))).at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
      const body = gateway.bodies.at(-1)
      if (selection === undefined) expect(body).not.toHaveProperty('generationConfig.thinkingConfig')
      else expect(body).toHaveProperty('generationConfig.thinkingConfig', selection === 'off' ? { thinkingBudget: 0 } : { includeThoughts: true })
    }
  })

  const signatureA = Buffer.from('first-signature').toString('base64')

  const signatureB = Buffer.from('second-signature').toString('base64')

  const signedA = { text: 'first text part', thoughtSignature: signatureA }

  const signedB = { text: 'second text part', thoughtSignature: signatureB }

  const unsigned = { text: 'unsigned text' }

  const emptySigned = { text: '', thoughtSignature: signatureB }

  it('bypasses signature validation for an unsigned historical Gemini function call', async () => {
    const { adapter, gateway, options } = await setup()
    const callId = ToolCallId('web-fetch-1')
    const assistant = createAssistantMessage({
      content: [{ type: 'tool-call', id: callId, name: 'default_api:web_fetch', arguments: '{"url":"https://example.com"}' }],
      source: { provider: options.provider as never, model: id },
    })
    gateway.pushCompletions({ events: googleTextEvents })
    const resumed = await Array.fromAsync(adapter.stream({ ...options, messages: [
      ...options.messages, assistant,
      createToolResultMessage({ callId, content: [{ type: 'text', text: 'page contents' }], isError: false }),
    ] }))
    expect(resumed.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
    const replayed = gateway.bodies[0]?.contents.find((message: { role: string }) => message.role === 'model')
    expect(replayed?.parts).toEqual([{
      functionCall: { id: callId, name: 'default_api:web_fetch', args: { url: 'https://example.com' } },
      thoughtSignature: 'skip_thought_signature_validator',
    }])
  })

  it('replays a Gemini function call with its required thought signature after the tool result', async () => {
    const { adapter, gateway, options } = await setup()
    const callId = ToolCallId('web-fetch-1')
    gateway.pushCompletions({ events: [JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{
        functionCall: { id: callId, name: 'default_api:web_fetch', args: { url: 'https://example.com' } },
        thoughtSignature: signatureA,
      }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
    })] })
    const assembler = new BlockAssembler()
    for await (const chunk of adapter.stream(options)) assembler.push(chunk)
    expect(assembler.finish.kind).toBe('tool-calls')
    const assistant = JSON.parse(JSON.stringify(assembler.message({
      kind: 'model', provider: options.provider as never, model: id,
      replayState: assembler.replayState,
    })))

    gateway.pushCompletions({ events: googleTextEvents })
    const resumed = await Array.fromAsync(adapter.stream({ ...options, messages: [
      ...options.messages, assistant,
      createToolResultMessage({ callId, content: [{ type: 'text', text: 'page contents' }], isError: false }),
    ] }))
    expect(resumed.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
    const replayed = gateway.bodies[1]?.contents.find((message: { role: string }) => message.role === 'model')
    expect(replayed?.parts).toEqual([{
      functionCall: { id: callId, name: 'default_api:web_fetch', args: { url: 'https://example.com' } },
      thoughtSignature: signatureA,
    }])
  })

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
