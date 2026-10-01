import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { getSupportedThinkingLevels } from 'opencode-go-pi-ai'
import { getBuiltinModels } from 'opencode-go-pi-ai/providers/all'
import type { Api, Model } from 'opencode-go-pi-ai'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { readModelMetadata } from '../src/model-metadata.ts'
import { withGatewayReasoning } from '../src/reasoning.ts'
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
      'qwen3.6-plus': modelMetadata({ reasoning_options: [{ type: 'toggle' }] }),
      'minimax-m3': modelMetadata({ provider: { npm: '@ai-sdk/anthropic' }, reasoning_options: [{ type: 'toggle' }] }),
    }), 'https://gateway.example/v1', builtin)
    expect(levels(result.models.get('deepseek-v4-flash')!)).toEqual(['off', 'low', 'high', 'max'])
    for (const modelId of ['qwen3.6-plus', 'minimax-m3']) {
      expect(levels(result.models.get(modelId)!)).toEqual(['off', 'high'])
      expect(result.models.get(modelId)!.thinkingLevelMap).not.toHaveProperty('off')
    }
  })

  it('does not add High beside explicit efforts for a native toggle', () => {
    const model = readModelMetadata(metadataDocument({
      'qwen3.6-plus': modelMetadata({ reasoning_options: [
        { type: 'toggle' }, { type: 'effort', values: ['low', 'medium'] },
      ] }),
    }), 'https://gateway.example/v1', builtin).models.get('qwen3.6-plus')!
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
