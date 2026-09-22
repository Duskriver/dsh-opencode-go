import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { createUserMessage, MessageId, ReasoningEffortId, userAgent } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { PROVIDER_ID } from '../src/catalog.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, fullLiveListing, listingBody, mockGateway, textEvents } from './mock-gateway.ts'

const IMAGE_REF: ImageAttachmentRef = {
  attachmentId: AttachmentId(`sha256:${'a'.repeat(64)}`),
  mediaType: 'image/png',
  bytes: 1,
  width: 1,
  height: 1,
}

beforeEach(() => {
  vi.stubEnv('OPENCODE_API_KEY', 'test-key')
})

async function drain(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

function requestOf(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    provider: PROVIDER_ID,
    model: 'deepseek-v4.1-flash',
    messages: [createUserMessage({
      content: [{ type: 'text', text: 'hi' }],
      source: { kind: 'plugin', plugin: 'test' },
    })],
    ...overrides,
  }
}

async function adapterFor(url: string, apiKey = 'test-key'): Promise<OpencodeGoAdapter> {
  return new OpencodeGoAdapter({
    config: () => configOf(url),
    resolveApiKey: () => Promise.resolve(apiKey),
  })
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await closeMockGateways()
})

describe('OpencodeGoAdapter stream', () => {
  it.each([
    { prompt_tokens_details: { cached_tokens: 80 } },
    { prompt_cache_hit_tokens: 80 },
    { cached_tokens: 80 },
  ])('preserves cached input from the wire usage %j', async (cacheFields) => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: [
      textEvents[0]!, textEvents[1]!,
      JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: {
        prompt_tokens: 100, completion_tokens: 5, ...cacheFields,
      } }), '[DONE]',
    ] })
    const adapter = await adapterFor(gateway.url)
    const chunks = await drain(adapter.stream(requestOf({ sessionId: 'cache-session' as never })))
    expect(chunks.find(chunk => chunk.type === 'usage')).toMatchObject({
      usage: { inputTokens: 20, outputTokens: 5, cacheReadTokens: 80, totalTokens: 105 },
    })
  })
  it('streams chat completions with the session header and Harness user agent', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = await adapterFor(gateway.url)

    const chunks = await drain(adapter.stream(requestOf({ sessionId: 'session-1' as never })))

    expect(gateway.paths).toEqual(['/models', '/chat/completions'])
    expect(gateway.bodies[0]).toMatchObject({ model: 'deepseek-v4.1-flash' })
    expect(gateway.headers[1]?.['x-opencode-session']).toBe('session-1')
    expect(gateway.headers[1]?.['user-agent']).toBe(userAgent())
    const finish = chunks.find(chunk => chunk.type === 'finish')
    expect(finish).toMatchObject({ reason: { kind: 'stop' } })
    expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text === 'hello')).toBe(true)
    expect(chunks.find(chunk => chunk.type === 'usage')).toMatchObject({
      usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
    })
  })

  it('sends a fresh random session value per request when none arrived', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    gateway.pushCompletions({ events: textEvents })
    const adapter = await adapterFor(gateway.url)

    await drain(adapter.stream(requestOf()))
    await drain(adapter.stream(requestOf()))

    const first = gateway.headers[1]?.['x-opencode-session']
    const second = gateway.headers[2]?.['x-opencode-session']
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    expect(first).not.toBe(second)
  })

  it('forwards supported reasoning efforts and refuses unsupported ones before I/O', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = await adapterFor(gateway.url)

    await drain(adapter.stream(requestOf({ reasoningEffort: ReasoningEffortId('high') })))
    expect(gateway.bodies[0]).toMatchObject({ reasoning_effort: 'high' })

    await expect(drain(adapter.stream(requestOf({ reasoningEffort: ReasoningEffortId('medium') }))))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
    // The refusal happened before the second request went out.
    expect(gateway.paths.filter(path => path === '/chat/completions')).toHaveLength(1)
  })

  it('omits the reasoning option for the off effort', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = await adapterFor(gateway.url)

    await drain(adapter.stream(requestOf({ reasoningEffort: ReasoningEffortId('off') })))

    expect(gateway.bodies[0]).toMatchObject({ thinking: { type: 'disabled' } })
    expect(gateway.bodies[0]).not.toHaveProperty('reasoning_effort')
  })

  it('refuses GenerateOptions.stop as unsupported', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = await adapterFor(gateway.url)

    await expect(drain(adapter.stream(requestOf({ stop: ['now'] }))))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_OPTION' })
    // The refusal happens before the catalog is even read.
    expect(gateway.paths).toEqual([])
  })

  it('reports an abort mid-stream as aborted, not as a server fault', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents.slice(0, 1), hangOpen: true })
    const adapter = await adapterFor(gateway.url)
    const controller = new AbortController()

    const reading = drain(adapter.stream(requestOf({ signal: controller.signal })))
    // Let the request reach the gateway, then cancel it while the response hangs.
    await vi.waitFor(() => {
      if (gateway.paths.length < 2) throw new Error('waiting for the completions request')
    })
    controller.abort()

    // The shared event mapper turns an in-band terminal error under an aborted
    // caller into an aborted finish chunk rather than a thrown fault.
    const chunks = await reading
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({
      reason: { kind: 'aborted' },
    })
  })

  it('fails the stream when events stall past the idle timeout', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents, delayMs: 1_000 })
    const adapter = new OpencodeGoAdapter({
      config: () => configOf(gateway.url, { streamIdleTimeoutMs: 100 }),
      resolveApiKey: () => Promise.resolve('test-key'),
    })

    await expect(drain(adapter.stream(requestOf()))).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('teardown abandons the upstream stream when the consumer stops early', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = await adapterFor(gateway.url)

    let received = 0
    for await (const _chunk of adapter.stream(requestOf())) {
      received += 1
      break
    }

    // The generator's finally abandoned the SSE request; the next stream on a
    // fresh route works exactly the same.
    expect(received).toBe(1)
  })

  it('reports a caller abort before the request starts as an aborted finish', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = await adapterFor(gateway.url)
    const controller = new AbortController()
    controller.abort()

    // The shared event mapper turns an in-band terminal error under an aborted
    // caller into an aborted finish chunk rather than a thrown fault.
    const chunks = await drain(adapter.stream(requestOf({ signal: controller.signal })))
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({
      reason: { kind: 'aborted' },
    })
  })

  it('classifies a conversion failure under a concurrent caller abort as aborted', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = await adapterFor(gateway.url)
    const controller = new AbortController()
    const original = new Error('conversion lost its caller')
    const message = Object.defineProperty({}, 'content', {
      get() {
        controller.abort('caller cancelled during conversion')
        throw original
      },
    })
    const failing = requestOf({ signal: controller.signal })
    failing.messages = [message as never]

    await expect(drain(adapter.stream(failing))).rejects.toMatchObject({ code: 'ABORTED' })
  })

  it('rethrows conversion failures that are neither timeouts nor aborts', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = await adapterFor(gateway.url)
    const original = new Error('conversion exploded')
    const message = Object.defineProperty({}, 'content', {
      get() {
        throw original
      },
    })
    const failing = requestOf()
    failing.messages = [message as never]

    await expect(drain(adapter.stream(failing))).rejects.toBe(original)
    // The refusal happened before any provider request went out.
    expect(gateway.paths).toEqual(['/models'])
  })

  it('surfaces a provider error event as an error finish, not a throw', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ status: 500, body: '{"error":"boom"}' })
    const adapter = await adapterFor(gateway.url)

    const chunks = await drain(adapter.stream(requestOf()))
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({
      reason: { kind: 'error' },
    })
  })

  it('degrades unusable replay state to provider-neutral history and reports it', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const degraded: string[] = []
    const adapter = new OpencodeGoAdapter({
      config: () => configOf(gateway.url),
      resolveApiKey: () => Promise.resolve('test-key'),
      onReplayDegrade: (reason) => {
        degraded.push(reason)
      },
    })
    const history = requestOf()
    history.messages = [
      createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      }),
      {
        id: MessageId('m1'),
        role: 'assistant',
        content: [{ type: 'text', text: 'earlier answer' }],
        // Another adapter family's replay envelope: unusable here, so the
        // message converts provider-neutrally and the degradation is reported.
        source: {
          kind: 'model',
          provider: PROVIDER_ID,
          model: 'deepseek-v4.1-flash',
          replayState: { kind: 'foreign-adapter' },
        },
      },
    ]

    const chunks = await drain(adapter.stream(history))

    expect(degraded).toHaveLength(1)
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  })

  it('forwards temperature and maxTokens', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = await adapterFor(gateway.url)

    await drain(adapter.stream(requestOf({ temperature: 0.2, maxTokens: 77 })))

    expect(gateway.bodies[0]).toMatchObject({ temperature: 0.2, max_tokens: 77 })
  })

  it('refuses a model the live catalog does not serve', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['kimi-k3']) })
    const adapter = await adapterFor(gateway.url)

    await expect(drain(adapter.stream(requestOf({ model: 'deepseek-v4.1-flash' }))))
      .rejects.toMatchObject({ code: 'UNKNOWN_MODEL' })
    expect(gateway.paths).toEqual(['/models'])
  })

  it('fails loud when no credential resolves', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = new OpencodeGoAdapter({
      config: () => configOf(gateway.url),
      resolveApiKey: () => Promise.resolve(undefined),
    })

    await expect(drain(adapter.stream(requestOf())))
      .rejects.toMatchObject({ code: 'MISSING_CREDENTIAL' })
    expect(gateway.paths).toEqual(['/models'])
  })

  it('refuses image content without the durable attachment service', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = await adapterFor(gateway.url)

    const image = requestOf()
    image.messages = [createUserMessage({
      content: [{ type: 'image', attachment: IMAGE_REF }],
      source: { kind: 'plugin', plugin: 'test' },
    })]

    await expect(drain(adapter.stream(image))).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
    expect(gateway.paths).toEqual(['/models'])
  })

  it('refuses image content when the attachment service stays unmounted', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = new OpencodeGoAdapter({
      config: () => configOf(gateway.url),
      resolveApiKey: () => Promise.resolve('test-key'),
      imageAccess: {
        resolveAttachments: () => undefined,
        resolveImageAccess: () => undefined,
      },
    })

    const image = requestOf()
    image.messages = [createUserMessage({
      content: [{ type: 'image', attachment: IMAGE_REF }],
      source: { kind: 'plugin', plugin: 'test' },
    })]

    await expect(drain(adapter.stream(image))).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
    expect(gateway.paths).toEqual(['/models'])
  })

  it('refuses image content on a text-only model before provider I/O', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = await adapterFor(gateway.url)

    const image = requestOf({ model: 'deepseek-v4-flash' })
    image.messages = [createUserMessage({
      content: [{ type: 'image', attachment: IMAGE_REF }],
      source: { kind: 'plugin', plugin: 'test' },
    })]

    await expect(drain(adapter.stream(image))).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
    expect(gateway.paths).toEqual(['/models'])
  })

  it('describes models with capacities and selectable reasoning levels', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const adapter = await adapterFor(gateway.url)

    const models = await adapter.listModels(PROVIDER_ID)
    const flash = models.find(model => model.id === 'deepseek-v4.1-flash')
    expect(flash).toMatchObject({ provider: PROVIDER_ID, name: 'DeepSeek V4.1 Flash', inputModalities: ['text', 'image'] })

    const resolved = await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')
    expect(resolved.context?.contextWindow).toBeGreaterThan(0)
    expect(resolved.reasoning?.efforts.map(effort => effort.id)).toContain(ReasoningEffortId('high'))
    // DSH resolves an unset effort through `defaultEffort`. Without one the
    // request carries no effort and pi-ai's deepseek thinking format answers
    // `thinking: { type: 'disabled' }`, so the model's reasoning lands in the
    // normal content instead of a reasoning block.
    expect(resolved.reasoning?.defaultEffort).toBe(ReasoningEffortId('high'))
    expect(resolved.reasoning?.efforts.map(effort => effort.id))
      .toContain(resolved.reasoning?.defaultEffort)

    // A transport that leaves thinking to the provider needs no default: it
    // already sends no disable, so the model keeps thinking when nothing is
    // chosen. Only the formats that would answer with an explicit disable do.
    const providerDecides = await adapter.resolveModel(PROVIDER_ID, 'kimi-k3')
    expect(providerDecides.reasoning?.efforts.length).toBeGreaterThan(0)
    expect(providerDecides.reasoning).not.toHaveProperty('defaultEffort')

    await expect(adapter.resolveModel(PROVIDER_ID, 'absent'))
      .rejects.toMatchObject({ code: 'UNKNOWN_MODEL' })
    expect(adapter.providerInfo(PROVIDER_ID)).toEqual({ id: PROVIDER_ID, name: 'OpenCode Go' })
  })

  it('applies and removes capacities immediately without dropping the catalog cache', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    let modelLimits: Record<string, { contextWindow?: number; maxTokens?: number }> = {}
    const adapter = new OpencodeGoAdapter({
      config: () => configOf(gateway.url, { modelLimits }),
      resolveApiKey: () => Promise.resolve('test-key'),
    })

    const advertised = (await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')).context!.contextWindow
    expect(advertised).toBeGreaterThan(0)

    modelLimits = { 'deepseek-v4.1-flash': { contextWindow: 123_456, maxTokens: 5_432 } }
    expect((await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')).context?.contextWindow).toBe(123_456)

    modelLimits = {}
    expect((await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')).context?.contextWindow).toBe(advertised)
    expect(gateway.modelListings).toBe(1)
  })
})
