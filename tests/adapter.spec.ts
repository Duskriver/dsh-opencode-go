import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { createUserMessage, MessageId, ReasoningEffortId, userAgent } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { PROVIDER_ID } from '../src/catalog.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, fullLiveListing, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { metadataDocument, MODELS_METADATA_URL } from './support/model-metadata.ts'
import { IMAGE_PAYLOAD_BUDGET_BYTES, ImagePayloadLease } from '../src/conversion/image-pool.ts'

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
  it.each(['resolve', 'stream'] as const)('cancels %s during discovery while another caller keeps the shared refresh', async (operation) => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const original = globalThis.fetch
    let completeMetadata!: (response: Response) => void
    let metadataSignal: AbortSignal | null | undefined
    const started = Promise.withResolvers<void>()
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) !== MODELS_METADATA_URL) return original(input, init)
      metadataSignal = init?.signal
      started.resolve()
      return new Promise<Response>(resolve => { completeMetadata = resolve })
    })
    const adapter = await adapterFor(gateway.url)
    const controller = new AbortController()
    const cancelled = operation === 'resolve'
      ? adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash', controller.signal)
      : drain(adapter.stream(requestOf({ signal: controller.signal })))
    const outcome = cancelled.then(value => ({ value }), error => ({ error }))
    const other = adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')
    await started.promise
    controller.abort()
    try {
      // Observe cancellation before releasing the unrelated shared network read.
      const result = await Promise.race([outcome, new Promise<null>(resolve => setTimeout(() => resolve(null), 100))])
      if (operation === 'resolve') expect(result).toMatchObject({ error: { code: 'ABORTED' } })
      else expect(result).toMatchObject({ value: [{ type: 'finish', reason: { kind: 'aborted' } }] })
      expect(metadataSignal?.aborted).toBe(false)
      expect(gateway.paths).not.toContain('/chat/completions')
    } finally {
      completeMetadata(Response.json(metadataDocument()))
      await outcome
      await expect(other).resolves.toMatchObject({ id: 'deepseek-v4.1-flash' })
    }
    expect(gateway.modelListings).toBe(1)
  })

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

    // pi-ai 0.87.1 no longer advertises off for V4.1; V4 still supports it.
    await drain(adapter.stream(requestOf({ model: 'deepseek-v4-flash', reasoningEffort: ReasoningEffortId('off') })))

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
    expect(gateway.paths).toEqual([])
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

    expect((await drain(adapter.stream(failing))).at(-1)).toMatchObject({ reason: { kind: 'aborted', failure: { code: 'ABORTED' } } })
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
    expect(resolved.reasoning).not.toHaveProperty('defaultEffort')

    const providerDecides = await adapter.resolveModel(PROVIDER_ID, 'kimi-k3')
    expect(providerDecides.reasoning?.efforts.length).toBeGreaterThan(0)
    expect(providerDecides.reasoning).not.toHaveProperty('defaultEffort')

    await expect(adapter.resolveModel(PROVIDER_ID, 'absent'))
      .rejects.toMatchObject({ code: 'UNKNOWN_MODEL' })
    expect(adapter.providerInfo(PROVIDER_ID)).toEqual({ id: PROVIDER_ID, name: 'DSH OpenCode Go' })
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

it.each(['caller', 'preparation', 'whole'] as const)('bounds an unresponsive credential resolver by %s cancellation', async kind => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  const started = Promise.withResolvers<void>()
  const late = Promise.withResolvers<string>()
  const controller = new AbortController()
  let warmed = false
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, {
    requestPreparationTimeoutMs: warmed && kind === 'preparation' ? 30 : 1000,
    requestTimeoutMs: kind === 'whole' ? 30 : 1000,
  }), resolveApiKey: () => { started.resolve(); return late.promise } })
  await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')
  warmed = true
  const pending = drain(adapter.stream(requestOf({ signal: controller.signal })))
  const outcome = pending.then(value => ({ value }), error => ({ error }))
  await started.promise
  if (kind === 'caller') controller.abort()
  try {
    const result = await Promise.race([outcome, new Promise(resolve => setTimeout(() => resolve('stalled'), 200))])
    if (kind === 'caller') expect(result).toMatchObject({ value: [{ reason: { kind: 'aborted', failure: { code: 'ABORTED' } } }] })
    else expect(result).toMatchObject({ error: { code: 'TIMEOUT' } })
    expect(gateway.bodies).toHaveLength(0)
  } finally { late.resolve('late-key'); await outcome }
  await Promise.resolve()
  expect(gateway.bodies).toHaveLength(0)
})

it('enforces the whole deadline while stream events continue and records a safe summary', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  gateway.pushCompletions({ events: [textEvents[0]!, ...Array.from({ length: 40 }, () => textEvents[1]!), ...textEvents.slice(2)], delayMs: 5 })
  const trace = vi.fn()
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { requestTimeoutMs: 70, streamIdleTimeoutMs: 1000 }),
    resolveApiKey: async () => 'private-key', onCallTrace: trace })
  await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')
  await expect(drain(adapter.stream(requestOf({ sessionId: 'private-session' as never })))).rejects.toMatchObject({ code: 'TIMEOUT' })
  expect(trace).toHaveBeenCalledTimes(1)
  expect(trace.mock.calls[0]?.[0]).toMatchObject({ attempts: 1, outcome: 'failed', code: 'TIMEOUT', stages: { credential: expect.any(Number), stream: expect.any(Number) } })
  expect(JSON.stringify(trace.mock.calls)).not.toMatch(/private-key|private-session|"hi"/)
})

it('records HTTP 200 stream truncation and contains observer failures', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  gateway.pushCompletions({ events: textEvents.slice(0, 2) })
  const trace = vi.fn(() => { throw new Error('observer failed') })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key', onCallTrace: trace })
  expect((await drain(adapter.stream(requestOf()))).at(-1)).toMatchObject({ reason: { kind: 'error', failure: { code: 'TRANSPORT' } } })
  expect(trace.mock.calls[0]?.[0]).toMatchObject({ attempts: 1, outcome: 'failed', code: 'TRANSPORT' })
})

it('retains image payload admission through streaming and releases it when the consumer stops', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  gateway.pushCompletions({ events: textEvents })
  const trace = vi.fn()
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key',
    onCallTrace: trace, imageAccess: {
      resolveAttachments: () => ({ readImageRequest: async () => ({
        variantId: `sha256:${'b'.repeat(64)}`, attachment: IMAGE_REF, data: Uint8Array.of(1),
        mediaType: 'image/png', bytes: 1, width: 1, height: 1, depth: 'uchar', space: 'srgb', hasAlpha: true,
      }) }) as never, resolveImageAccess: () => undefined,
    } })
  const iterator = adapter.stream(requestOf({ messages: [createUserMessage({
    content: [{ type: 'image', attachment: IMAGE_REF }], source: { kind: 'plugin', plugin: 'test' },
  })] }))[Symbol.asyncIterator]()
  try {
    expect((await iterator.next()).done).toBe(false)
    using competing = new ImagePayloadLease()
    competing.reserve(IMAGE_PAYLOAD_BUDGET_BYTES - 5)
    expect(() => competing.reserve(1)).toThrow(expect.objectContaining({ code: 'IMAGE_RESOURCE_BUSY' }))
  } finally { await iterator.return?.() }
  using available = new ImagePayloadLease()
  available.reserve(IMAGE_PAYLOAD_BUDGET_BYTES)
  expect(trace).toHaveBeenCalledTimes(1)
  expect(trace.mock.calls[0]?.[0]).toMatchObject({ outcome: 'consumer-stopped', attemptDetails: [
    { outcome: 'consumer-stopped', imagePool: { maxRetainedBytes: 5, rejected: false } },
  ] })
})

it('times out image preparation even when the attachment service ignores cancellation', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  const late = Promise.withResolvers<never>()
  const read = vi.fn(() => late.promise)
  let warmed = false
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { requestPreparationTimeoutMs: warmed ? 30 : 1000 }),
    resolveApiKey: async () => 'fixture-key', imageAccess: {
      resolveAttachments: () => ({ readImageRequest: read }) as never,
      resolveImageAccess: () => undefined,
    } })
  await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')
  warmed = true
  const pending = drain(adapter.stream(requestOf({ messages: [createUserMessage({
    content: [{ type: 'image', attachment: IMAGE_REF }], source: { kind: 'plugin', plugin: 'test' },
  })] })))
  const outcome = pending.then(value => ({ value }), error => ({ error }))
  try {
    expect(await Promise.race([outcome, new Promise(resolve => setTimeout(() => resolve('stalled'), 200))]))
      .toMatchObject({ error: { code: 'TIMEOUT' } })
    expect(read).toHaveBeenCalledTimes(1)
    expect(gateway.bodies).toHaveLength(0)
  } finally { late.reject(new Error('late attachment failure')); await outcome; await Promise.resolve() }
})

it('keeps one whole-request deadline across account fallback', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<string>()
  const accounts = [{ id: 'a', name: 'A', apiKeyEnv: 'ACCOUNT_A' }, { id: 'b', name: 'B', apiKeyEnv: 'ACCOUNT_B' }]
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, {
    accounts, autoSwitch: true, apiKeyEnv: 'ACCOUNT_A', requestTimeoutMs: 80, requestPreparationTimeoutMs: 1000,
  }), resolveApiKey: async config => {
    if (config.apiKeyEnv === 'ACCOUNT_A') {
      await new Promise(resolve => setTimeout(resolve, 45))
      return undefined
    }
    started.resolve()
    return release.promise
  } })
  await adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')
  const pending = drain(adapter.stream(requestOf()))
  const outcome = pending.then(value => ({ value }), error => ({ error }))
  await started.promise
  try {
    expect(await Promise.race([outcome, new Promise(resolve => setTimeout(() => resolve('stalled'), 65))]))
      .toMatchObject({ error: { code: 'TIMEOUT' } })
  } finally { release.resolve('late-key'); await outcome }
  expect(gateway.bodies).toHaveLength(0)
})
