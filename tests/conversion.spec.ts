import { vi, describe, expect, it } from 'vitest'
import {
  AttachmentId,
  ImageVariantId,
  type AttachmentStore,
  type ImageAttachmentRef,
} from '@deepseek-ai/dsh-attachment'
import {
  createAssistantMessage,
  createSystemMessage,
  createUserMessage,
  createToolResultMessage,
  ToolCallId,
  type ContentBlock,
  BlockAssembler,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import {
  toPiContext,
  toPiAssistant,
  toPiReplayState,
  piContextUsageKey,
  type PiImageRequestContext,
  toStreamChunks,
} from '../src/conversion.ts'
import { requestOf } from './support/host.ts'
import type { AssistantMessage, AssistantMessageEvent } from '../src/sdk-types.ts'
import { estimateContextTokens } from 'opencode-go-pi-ai/utils/estimate'

describe("stream outcomes", () => {
  function message(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
    return {
      role: 'assistant', api: 'openai-completions', provider: 'opencode-go', model: 'deepseek-v4.1-flash',
      content: [], timestamp: 0, stopReason: 'error', errorMessage: '400 status code (no body)',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      ...overrides,
    }
  }

  async function collect(event: AssistantMessageEvent, contextWindow?: number, reservedMaxTokens?: number): Promise<StreamChunk[]> {
    async function* events() { yield event }
    const chunks: StreamChunk[] = []
    for await (const chunk of toStreamChunks(events(), contextWindow, undefined, undefined, undefined, reservedMaxTokens)) chunks.push(chunk)
    return chunks
  }

  it.each(['error', 'aborted'] as const)('omits unmeasured usage on %s so the host has no zero pressure sample', async reason => {
    const chunks = await collect({ type: 'error', reason, error: message({ stopReason: reason }) })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ type: 'finish', reason: { kind: reason } })
    const assembler = new BlockAssembler()
    for (const chunk of chunks) assembler.push(chunk)
    expect(assembler.usage).toBeUndefined()
  })

  it.each(['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'] as const)('keeps measured %s on a failed attempt', async field => {
    const failed = message()
    failed.usage[field] = 17
    const chunks = await collect({ type: 'error', reason: 'error', error: failed })
    expect(chunks[0]).toMatchObject({ type: 'usage' })
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error' } })
  })

  it('omits zero usage when a nominal success becomes an empty-response error', async () => {
    const chunks = await collect({ type: 'done', reason: 'stop', message: message({ stopReason: 'stop' }) })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'EMPTY_RESPONSE' } } })
  })

  it.each([
    { allowance: 512, output: 0 },
    { allowance: 4_096, output: 4_096 },
  ])('explains empty length responses limited by a $allowance-token allowance', async ({ allowance, output }) => {
    const empty = message({ stopReason: 'length' })
    empty.usage.output = output
    empty.usage.totalTokens = output
    const chunks = await collect({ type: 'done', reason: 'length', message: empty }, 262_144, allowance)
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
      code: 'INVALID_REQUEST', message: expect.stringContaining(`its ${allowance}-token output allowance`),
    } } })
    expect(chunks.at(-1)).toMatchObject({ reason: { failure: {
      message: expect.stringContaining('Increase this model\'s "max output"'),
    } } })
    if (output > 0) expect(chunks[0]).toMatchObject({ type: 'usage', usage: { outputTokens: output, totalTokens: output } })
    else expect(chunks).toHaveLength(1)
  })

  it.each([
    { contextWindow: 262_144, allowance: 65_536 },
    { contextWindow: undefined, allowance: undefined },
  ])('explains empty length responses without assuming a small output allowance: %j', async ({ contextWindow, allowance }) => {
    const chunks = await collect({ type: 'done', reason: 'length', message: message({ stopReason: 'length' }) }, contextWindow, allowance)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
      code: 'INVALID_REQUEST', message: expect.stringContaining('Compact the context (/compact)'),
    } } })
    expect(chunks[0]).toMatchObject({ reason: { failure: {
      message: expect.stringContaining('or lower this model\'s "max output"'),
    } } })
    const assembler = new BlockAssembler()
    for (const chunk of chunks) assembler.push(chunk)
    expect(assembler.usage).toBeUndefined()
  })

  it('keeps confirmed context overflow ahead of the empty length fallback', async () => {
    const empty = message({ stopReason: 'length' })
    empty.usage.input = 262_144
    empty.usage.totalTokens = 262_144
    const chunks = await collect({ type: 'done', reason: 'length', message: empty }, 262_144, 512)
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: {
      kind: 'error', failure: { code: 'CONTEXT_WINDOW_EXCEEDED' },
    } })
  })

  it.each([
    { content: [{ type: 'text', text: 'partial answer' }] },
    { content: [{ type: 'thinking', thinking: 'partial reasoning' }] },
  ] satisfies { content: AssistantMessage['content'] }[])('keeps nonempty length responses as max-tokens: %j', async ({ content }) => {
    const chunks = await collect({ type: 'done', reason: 'length', message: message({ stopReason: 'length', content }) }, 262_144, 512)
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'max-tokens' } })
  })

  it('rejects a future SDK event instead of silently omitting it', async () => {
    async function* futureEvents() { yield { type: 'future-content' } as unknown as AssistantMessageEvent }
    const iterator = toStreamChunks(futureEvents())[Symbol.asyncIterator]()
    await expect(iterator.next()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
  })
})

describe('current history roles and durable replay', () => {
  const callId = ToolCallId('lookup-1')
  const user = (content: ContentBlock[]) => createUserMessage({ content, source: { kind: 'plugin', plugin: 'conversion-test' } })
  const assistant = () => createAssistantMessage({
    content: [{ type: 'reasoning', text: 'think' }, { type: 'text', text: 'checking' }, { type: 'tool-call', id: callId, name: 'lookup', arguments: '{"path":"a.txt"}' }],
    source: { provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash' },
  })
  const images = (): PiImageRequestContext => ({ attachments: { readImageRequest: vi.fn() } as unknown as AttachmentStore, resolveImageAccess: () => undefined })

  it.each(['text', 'images'] as const)('preserves standalone tool identity, result text and errors through the %s path', async mode => {
    const options = requestOf({ messages: [
      createSystemMessage('system instructions'), user([{ type: 'text', text: 'hello' }]), assistant(),
      createToolResultMessage({ callId, content: [{ type: 'text', text: 'read ' }, { type: 'text', text: 'failed' }], isError: true }),
      user([]),
    ], tools: [{ name: 'lookup', description: 'Read a file', parameters: { type: 'object' } }] })
    const context = mode === 'text' ? toPiContext(options) : await toPiContext(options, images())
    expect(context.systemPrompt).toBe('system instructions')
    expect(context.tools).toEqual([{ name: 'lookup', description: 'Read a file', parameters: { type: 'object' } }])
    expect(context.messages).toHaveLength(4)
    expect(context.messages[1]).toMatchObject({ role: 'assistant', content: [{ type: 'thinking', thinking: 'think' }, { type: 'text', text: 'checking' }, { type: 'toolCall', id: callId, name: 'lookup', arguments: { path: 'a.txt' } }] })
    expect(context.messages[2]).toEqual({ role: 'toolResult', toolCallId: callId, toolName: 'lookup', content: [{ type: 'text', text: 'read failed' }], isError: true, timestamp: 0 })
    expect(context.messages[3]).toEqual({ role: 'user', content: '', timestamp: 0 })
  })

  it.each(['text', 'images'] as const)('keeps explicit system precedence and later system ordering on the %s path', async mode => {
    const options = requestOf({ system: 'explicit', messages: [createSystemMessage('leading'), user([{ type: 'text', text: 'middle' }]), createSystemMessage('later')] })
    const context = mode === 'text' ? toPiContext(options) : await toPiContext(options, images())
    expect(context.systemPrompt).toBe('explicit')
    expect(context.messages.map(message => message.content)).toEqual(['leading', 'middle', 'later'])
    const absent = mode === 'text' ? toPiContext(requestOf({ messages: [createSystemMessage('')] })) : await toPiContext(requestOf({ messages: [createSystemMessage('')] }), images())
    expect(absent).not.toHaveProperty('systemPrompt')
    expect(absent).not.toHaveProperty('tools')
  })

  it('uses a useful placeholder for an empty tool result whose call name is unknown', () => {
    const context = toPiContext(requestOf({ messages: [createToolResultMessage({ callId, content: [], isError: false })] }))
    expect(context.messages[0]).toMatchObject({ role: 'toolResult', toolName: 'unknown', content: [{ type: 'text', text: '(no output)' }], isError: false })
  })

  it.each(['not-json', '[]', 'null', '123'])('keeps an invalid tool argument object harmless: %s', argumentsText => {
    const message = createAssistantMessage({ content: [{ type: 'tool-call', id: callId, name: 'lookup', arguments: argumentsText }], source: { provider: 'other', model: 'other' } })
    expect(toPiAssistant(message).content[0]).toMatchObject({ type: 'toolCall', arguments: {} })
  })

  const piMessage = (): AssistantMessage => ({
    role: 'assistant', api: 'google-generative-ai', provider: 'opencode-go', model: 'returned-alias', responseId: 'response-1', providerThinkingLevel: 'low',
    content: [{ type: 'thinking', thinking: 'reasoning', thinkingSignature: 'signed-thinking', redacted: true }, { type: 'text', text: 'answer', textSignature: 'signed-text' }, { type: 'toolCall', id: callId, name: 'lookup', arguments: { path: 'a.txt' }, thoughtSignature: 'signed-call' }],
    usage: { input: 3, output: 1, cacheRead: 2, cacheWrite: 0, totalTokens: 6, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: 'toolUse', timestamp: 0,
  })
  const durable = (replayState: unknown) => createAssistantMessage({
    content: [{ type: 'reasoning', text: 'reasoning' }, { type: 'text', text: 'answer' }, { type: 'tool-call', id: callId, name: 'lookup', arguments: '{"path":"a.txt"}' }],
    source: { provider: 'dsh-opencode-go', model: 'requested-model', replayState: replayState as never },
  })

  it('preserves signatures and native provider identity through a JSON-restored tool turn', () => {
    const replay = toPiReplayState(piMessage(), 'requested-model', 'dsh-opencode-go')
    const stored = JSON.parse(JSON.stringify(durable(replay)))
    const converted = toPiAssistant(stored)
    expect(converted).toMatchObject({ api: 'google-generative-ai', provider: 'opencode-go', model: 'requested-model', responseId: 'response-1', providerThinkingLevel: 'low', stopReason: 'toolUse', content: piMessage().content, usage: piMessage().usage })
    const context = toPiContext(requestOf({ messages: [stored, createToolResultMessage({ callId, content: [{ type: 'text', text: 'file contents' }], isError: false })] }))
    expect(context.messages[1]).toMatchObject({ role: 'toolResult', toolName: 'lookup', toolCallId: callId })
  })

  it.each(['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'] as const)('preserves nonzero %s through durable replay without persisting cost', field => {
    const message = piMessage()
    const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, [field]: 17 }
    message.usage = { ...tokens, cost: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 } }
    const replay = toPiReplayState(message, 'requested-model', 'dsh-opencode-go')
    expect(replay.response).toHaveProperty('usage', tokens)
    expect((replay.response as { usage: unknown }).usage).not.toHaveProperty('cost')
    const restored = toPiAssistant(JSON.parse(JSON.stringify(durable(replay))))
    expect(restored.usage).toEqual({ ...tokens, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } })
    expect(estimateContextTokens([restored])).toMatchObject({ tokens: 17, usageTokens: 17, lastUsageIndex: 0 })
  })

  it.each(['text', 'images'] as const)('validates measured usage against the full prefix without losing signed replay on the %s path', async mode => {
    const degraded = vi.fn()
    const first = requestOf({ model: 'requested-model', system: 'System instructions',
      messages: [user([{ type: 'text', text: 'hello' }])],
      tools: [{ name: 'lookup', description: 'Read a path', parameters: {
        type: 'object', properties: { path: { type: 'string' } }, required: ['path'],
      } }],
    })
    const convert = (options: typeof first) => mode === 'text'
      ? Promise.resolve(toPiContext(options, undefined, degraded)) : toPiContext(options, images(), degraded)
    const context = await convert(first)
    const replay = toPiReplayState(piMessage(), first.model, first.provider, piContextUsageKey(context, first.provider, first.model))
    const stored = JSON.parse(JSON.stringify(durable(replay)))
    const next = user([{ type: 'text', text: 'continue' }])
    const continued = { ...first, messages: [...first.messages, stored, next],
      tools: [{ ...first.tools![0], parameters: { required: ['path'], properties: { path: { type: 'string' } }, type: 'object' } }],
    }
    expect(estimateContextTokens(await convert(continued))).toMatchObject({ usageTokens: 6, lastUsageIndex: 1 })

    const compacted = { ...continued, messages: [user([{ type: 'text', text: 'Compacted summary' }]), stored, next] }
    const compactedContext = await convert(compacted)
    expect(estimateContextTokens(compactedContext).lastUsageIndex).toBeNull()
    expect(compactedContext.messages[1]).toMatchObject({
      api: 'google-generative-ai', provider: 'opencode-go', model: 'requested-model',
      content: toPiAssistant(stored).content, usage: { totalTokens: 0 },
    })
    expect(stored.source.replayState.response.usage.totalTokens).toBe(6)

    // A fresh response after compaction supplies a valid measurement again.
    const fresh = durable(toPiReplayState(piMessage(), first.model, first.provider,
      piContextUsageKey(compactedContext, first.provider, first.model)))
    const resumed = await convert({ ...compacted, messages: [...compacted.messages, fresh, next] })
    expect(estimateContextTokens(resumed)).toMatchObject({ usageTokens: 6, lastUsageIndex: 3 })

    const legacy = structuredClone(stored)
    delete legacy.source.replayState.response.usageContext
    const legacyContext = await convert({ ...continued, messages: [...first.messages, legacy, next] })
    expect(estimateContextTokens(legacyContext).lastUsageIndex).toBeNull()
    expect(legacyContext.messages[1]).toMatchObject({ api: 'google-generative-ai', content: toPiAssistant(stored).content })
    expect(degraded).not.toHaveBeenCalled()
  })

  it('omits unmeasured usage and reads older replay envelopes without usage', () => {
    const message = piMessage()
    const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
    message.usage = usage
    expect(toPiReplayState(message).response).not.toHaveProperty('usage')
    const replay = toPiReplayState(piMessage(), 'requested-model', 'dsh-opencode-go')
    delete (replay.response as { usage?: unknown }).usage
    const degraded = vi.fn()
    expect(toPiAssistant(durable(replay), degraded)).toMatchObject({ api: 'google-generative-ai', usage })
    expect(degraded).not.toHaveBeenCalled()
  })

  it.each([
    (state: any) => { state.response.version = 99 },
    (state: any) => { state.response.kind = 'other' },
    (state: any) => { state.response.provider = 'other' },
    (state: any) => { state.response.model = 'other' },
    (state: any) => { state.blocks.pop() },
    (state: any) => { state.blocks[0].type = 'text' },
    (state: any) => { state.blocks[0].thinkingSignature = false },
    (state: any) => { state.response.usageContext = null },
    (state: any) => { state.response.usageContext = 'invalid' },
    (state: any) => { state.response.usage = null },
    (state: any) => { state.response.usage = [] },
    (state: any) => { state.response.usage.input = -1 },
    (state: any) => { state.response.usage.output = '1' },
    (state: any) => { state.response.usage.cacheRead = Infinity },
    (state: any) => { state.response.usage.cacheWrite = NaN },
    (state: any) => { delete state.response.usage.totalTokens },
  ])('degrades malformed replay to neutral content while reporting its reason', mutate => {
    const replay = structuredClone(toPiReplayState(piMessage(), 'requested-model', 'dsh-opencode-go'))
    mutate(replay)
    const degraded = vi.fn()
    const result = toPiAssistant(durable(replay), degraded)
    expect(result.api).toBe('dsh-foreign')
    expect(result.content).toEqual([{ type: 'thinking', thinking: 'reasoning' }, { type: 'text', text: 'answer' }, { type: 'toolCall', id: callId, name: 'lookup', arguments: { path: 'a.txt' } }])
    expect(degraded).toHaveBeenCalledOnce()
    expect(degraded).toHaveBeenCalledWith(expect.stringContaining('invalid pi-ai replay state'))
  })

  it.each(['text', 'images'] as const)('rejects unsupported history and deferred tools before I/O on the %s path', async mode => {
    for (const options of [
      requestOf({ messages: [{ role: 'developer', content: [], source: { kind: 'plugin', plugin: 'test' } } as never] }),
      requestOf({ messages: [{ role: 'unknown', content: [] } as never] }),
      requestOf({ messages: [user([{ type: 'tool-addition', toolName: 'lookup' }])] }),
      requestOf({ tools: [{ name: 'lookup', description: '', parameters: {}, deferLoading: true }] }),
    ]) {
      const access = images()
      await expect(Promise.resolve().then(() => mode === 'text' ? toPiContext(options) : toPiContext(options, access))).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
      expect(access.attachments.readImageRequest).not.toHaveBeenCalled()
    }
  })
})

describe('request-local image budgets and durable offloading', () => {
  const ref = (id = 1): ImageAttachmentRef => ({ attachmentId: AttachmentId('sha256:' + id.toString(16).padStart(64, '0')), mediaType: 'image/png', bytes: 3, width: 4096, height: 4096 })
  const user = (blocks: ContentBlock[]) => createUserMessage({ content: blocks, source: { kind: 'plugin', plugin: 'test' } })
  function fixture() {
    const read = vi.fn(async (attachment: ImageAttachmentRef) => ({
      variantId: ImageVariantId('sha256:' + 'b'.repeat(64)), attachment, data: Uint8Array.of(1, 2, 3), bytes: 3,
      mediaType: attachment.mediaType, width: 2048, height: 2048, depth: 'uchar' as const, space: 'srgb' as const, hasAlpha: true,
    }))
    return { read, access: { attachments: { readImageRequest: read } as unknown as AttachmentStore, resolveImageAccess: () => undefined } satisfies PiImageRequestContext }
  }

  it('invalidates measured usage when a retained prefix image is offloaded', async () => {
    const { read, access } = fixture(), image = ref()
    const first = requestOf({ messages: [user([{ type: 'image', attachment: image }])] })
    const context = await toPiContext(first, access)
    const reply: AssistantMessage = {
      role: 'assistant', api: 'openai-completions', provider: 'opencode-go', model: first.model,
      content: [{ type: 'text', text: 'Image answer' }], stopReason: 'stop', timestamp: 0,
      usage: { input: 50_000, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 50_001,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    }
    const previous = createAssistantMessage({ content: [{ type: 'text', text: 'Image answer' }],
      source: { provider: first.provider, model: first.model,
        replayState: toPiReplayState(reply, first.model, first.provider, piContextUsageKey(context, first.provider, first.model)) },
    })
    const continued = await toPiContext({ ...first, messages: [...first.messages, previous] }, access)
    expect(estimateContextTokens(continued).usageTokens).toBe(50_001)
    const offloaded = await toPiContext({ ...first,
      messages: [user([{ type: 'image', attachment: image, offloaded: true }]), previous],
    }, access)
    expect(estimateContextTokens(offloaded).lastUsageIndex).toBeNull()
    expect(offloaded.messages[1]).toMatchObject({ api: reply.api, content: reply.content })
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('prepares a repeated attachment once, preserving every occurrence and the configured normalization target', async () => {
    const { read, access } = fixture(), image = ref()
    const options = requestOf({ messages: [user([{ type: 'text', text: 'images' }, { type: 'image', attachment: image }, { type: 'image', attachment: image }])] })
    const result = await toPiContext(options, { ...access, requestImagePolicy: { maxPixels: 1024 * 1024, maxBytes: 1024 } })
    expect(read).toHaveBeenCalledExactlyOnceWith(image, { width: 1024, height: 1024, maxPixels: 1024 * 1024, maxBytes: 1024 }, expect.any(AbortSignal))
    const content = result.messages[0]!.content as any[]
    expect(content.filter(block => block.type === 'image')).toEqual([{ type: 'image', data: 'AQID', mimeType: 'image/png' }, { type: 'image', data: 'AQID', mimeType: 'image/png' }])
    expect(JSON.stringify(content)).toContain(image.attachmentId)
  })

  it('converts images in an independent tool result and retains its call identity', async () => {
    const { read, access } = fixture(), image = ref()
    const context = await toPiContext(requestOf({ messages: [createToolResultMessage({ callId: ToolCallId('image-tool'), content: [{ type: 'image', attachment: image }], isError: false })] }), access)
    expect(read).toHaveBeenCalledOnce()
    expect(context.messages[0]).toMatchObject({ role: 'toolResult', toolCallId: 'image-tool', content: [{ type: 'text', text: expect.any(String) }, { type: 'image', data: 'AQID' }] })
  })

  it('requests count offloading before reading attachments and never edits the original history', async () => {
    const { read, access } = fixture(), image = ref()
    const options = requestOf({ messages: [user([{ type: 'image', attachment: image }, { type: 'image', attachment: image }])] })
    await expect(toPiContext(options, { ...access, maxImages: 1 })).rejects.toMatchObject({ code: 'IMAGE_OFFLOAD_REQUIRED', failure: { offloadImages: 1 } })
    expect(read).not.toHaveBeenCalled()
    expect(options.messages[0]!.content.every(block => !('offloaded' in block))).toBe(true)
  })

  it('keeps encoded bytes exactly at the cap and requests the oldest occurrence when the cap is exceeded', async () => {
    const { read, access } = fixture(), image = ref()
    const options = requestOf({ messages: [user([{ type: 'image', attachment: image }, { type: 'image', attachment: image }])] })
    await expect(toPiContext(options, { ...access, maxRequestImageBytes: 8 })).resolves.toBeDefined()
    expect(read).toHaveBeenCalledTimes(1)
    await expect(toPiContext(options, { ...access, maxRequestImageBytes: 7 })).rejects.toMatchObject({ code: 'IMAGE_OFFLOAD_REQUIRED', failure: { offloadImages: 1 } })
  })

  it('projects durable offloaded occurrences to text and reads only retained attachments', async () => {
    const { read, access } = fixture(), old = ref(), recent = ref(2)
    const context = await toPiContext(requestOf({ messages: [user([{ type: 'image', attachment: old, offloaded: true }, { type: 'image', attachment: recent }])] }), { ...access, maxImages: 1 })
    expect(read).toHaveBeenCalledExactlyOnceWith(recent, expect.any(Object), expect.any(AbortSignal))
    expect(JSON.stringify(context.messages)).toContain(old.attachmentId)
    expect((context.messages[0]!.content as any[]).filter(block => block.type === 'image')).toHaveLength(1)
  })

  it('does not read offloaded images and rejects retained images without attachment access', async () => {
    const { read, access } = fixture(), image = ref()
    const options = requestOf({ messages: [user([{ type: 'image', attachment: image, offloaded: true }])] })
    const context = await toPiContext(options, access)
    expect(read).not.toHaveBeenCalled()
    expect(typeof context.messages[0]!.content).toBe('string')
    expect(() => toPiContext(requestOf({ messages: [user([{ type: 'image', attachment: image }])] }))).toThrow(/attachment service/)
  })

  it('bounds concurrent image preparation inside one request and observes cancellation', async () => {
    const { read, access } = fixture(), gate = Promise.withResolvers<void>()
    const normal = read.getMockImplementation()!
    let active = 0, peak = 0
    read.mockImplementation(async image => { active++; peak = Math.max(peak, active); await gate.promise; active--; return normal(image) })
    const options = requestOf({ messages: [user(Array.from({ length: 9 }, (_, index) => ({ type: 'image', attachment: ref(index + 1) })))] })
    const pending = toPiContext(options, access)
    await vi.waitFor(() => { expect(read).toHaveBeenCalledTimes(4) })
    gate.resolve()
    await pending
    expect(peak).toBe(4)
    expect(read).toHaveBeenCalledTimes(9)
    const started = Promise.withResolvers<void>(), controller = new AbortController()
    read.mockImplementationOnce(async () => { started.resolve(); return new Promise(() => {}) })
    const cancelled = toPiContext({ ...requestOf({ messages: [user([{ type: 'image', attachment: ref() }])] }), signal: controller.signal }, access)
    const outcome = cancelled.catch(error => error)
    await started.promise
    controller.abort(new Error('cancel image read'))
    expect(await outcome).toBe(controller.signal.reason)
  })
})
