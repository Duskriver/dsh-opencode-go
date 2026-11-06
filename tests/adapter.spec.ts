import { afterEach, expect, it, vi, beforeEach, describe } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import {
  ReasoningEffortId,
  BlockAssembler,
  createUserMessage,
  MessageId,
  userAgent,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { discoverCatalogModels, discoverSettingsModels, PROVIDER_ID } from '../src/catalog.ts'
import { PlainConfig } from '../src/config.ts'
import { configOf } from './support/host.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents, fullLiveListing } from './support/gateway.ts'
import { modelsDocument, modelEntry } from './support/data.ts'
import SessionStore from '@deepseek-ai/dsh-session'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { AttachmentId, type ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { randomUUID } from 'node:crypto'

describe("requests and deadlines", () => {
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
    it.each(['resolve', 'prepare', 'stream'] as const)('cancels %s during discovery while another caller keeps the shared refresh', async (operation) => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const original = globalThis.fetch
      const discoveryReads = vi.fn()
      let completeMetadata!: (response: Response) => void
      let metadataSignal: AbortSignal | null | undefined
      const started = Promise.withResolvers<void>()
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
        if (!String(input).endsWith('/models')) return original(input, init)
        discoveryReads()
        metadataSignal = init?.signal
        started.resolve()
        return new Promise<Response>(resolve => { completeMetadata = resolve })
      })
      const adapter = await adapterFor(gateway.url)
      const controller = new AbortController()
      const cancelled = operation === 'resolve'
        ? adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash', controller.signal)
        : operation === 'prepare'
          ? adapter.prepareCall(PROVIDER_ID, 'deepseek-v4.1-flash', controller.signal)
          : drain(adapter.stream(requestOf({ signal: controller.signal })))
      const outcome = cancelled.then(value => ({ value }), error => ({ error }))
      const other = adapter.resolveModel(PROVIDER_ID, 'deepseek-v4.1-flash')
      await started.promise
      controller.abort()
      try {
        // Observe cancellation before releasing the unrelated shared network read.
        const result = await Promise.race([outcome, new Promise<null>(resolve => setTimeout(() => resolve(null), 100))])
        if (operation !== 'stream') expect(result).toMatchObject({ error: { code: 'ABORTED' } })
        else expect(result).toMatchObject({ value: [{ type: 'finish', reason: { kind: 'aborted' } }] })
        expect(metadataSignal?.aborted).toBe(false)
        expect(gateway.paths).not.toContain('/chat/completions')
      } finally {
        completeMetadata(Response.json(modelsDocument()))
        await outcome
        await expect(other).resolves.toMatchObject({ id: 'deepseek-v4.1-flash' })
      }
      expect(discoveryReads).toHaveBeenCalledOnce()
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

    it.each([
      { maxTokens: undefined, expected: 65_536, guidance: 'Compact the context (/compact)' },
      { maxTokens: 512, expected: 512, guidance: 'Increase this model\'s "max output"' },
    ])('reports empty length completions with guidance for the $expected-token allowance', async ({ maxTokens, expected, guidance }) => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      gateway.pushCompletions({ events: [
        JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'length' }],
          usage: { prompt_tokens: 3, completion_tokens: 0 } }),
        '[DONE]',
      ] })
      const adapter = await adapterFor(gateway.url)
      const chunks = await drain(adapter.stream(requestOf({ ...maxTokens === undefined ? {} : { maxTokens } })))
      expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
        code: 'INVALID_REQUEST', message: expect.stringContaining(guidance),
      } } })
      expect(chunks.find(chunk => chunk.type === 'usage')).toMatchObject({ usage: { inputTokens: 3, outputTokens: 0 } })
      expect(gateway.bodies).toHaveLength(1)
      expect(gateway.bodies[0]).toMatchObject({ model: 'deepseek-v4.1-flash', max_tokens: expected })
    })

    it('suggests compaction when the SDK clamps a large allowance to one token', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      gateway.pushCompletions({ events: [
        JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'length' }] }), '[DONE]',
      ] })
      const adapter = new OpencodeGoAdapter({
        config: () => configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 4_096 } } }),
        resolveApiKey: async () => 'test-key',
      })
      const chunks = await drain(adapter.stream(requestOf()))
      expect(gateway.bodies[0]).toMatchObject({ max_tokens: 1 })
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
        code: 'INVALID_REQUEST', message: expect.stringContaining('Compact the context (/compact)'),
      } } })
    })

    it.each([200, 400])('clamps a Chinese conversation above 80 percent from replayed usage for HTTP %s', async status => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const contextWindow = 131_072
      gateway.pushCompletions({ events: [
        textEvents[0]!, textEvents[1]!,
        JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: {
          prompt_tokens: 110_000, completion_tokens: 1_024, prompt_tokens_details: { cached_tokens: 12_000 },
        } }), '[DONE]',
      ] })
      gateway.pushCompletions(status === 400
        ? { status, body: '{"model":"deepseek-v4.1-flash"}' }
        : { events: textEvents })
      const adapter = new OpencodeGoAdapter({
        config: () => configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow } } }),
        resolveApiKey: async () => 'test-key',
      })
      const first = requestOf({ messages: [createUserMessage({
        content: [{ type: 'text', text: '中文'.repeat(30_000) }], source: { kind: 'plugin', plugin: 'test' },
      })] })
      const assembler = new BlockAssembler()
      for (const chunk of await drain(adapter.stream(first))) assembler.push(chunk)
      // Persist and restore exactly as a host session does between turns.
      const previous = JSON.parse(JSON.stringify(assembler.message({
        provider: PROVIDER_ID, model: first.model, replayState: assembler.replayState,
      })))
      expect(previous.source.replayState.response.usage).toEqual({
        input: 98_000, output: 1_024, cacheRead: 12_000, cacheWrite: 0, totalTokens: 111_024,
      })
      const next = createUserMessage({ content: [{ type: 'text', text: '继续' }], source: { kind: 'plugin', plugin: 'test' } })
      const chunks = await drain(adapter.stream(requestOf({ messages: [...first.messages, previous, next] })))
      // Actual prior usage + one trailing token + the SDK's 4096-token reserve.
      expect(gateway.bodies[0]).toMatchObject({ max_tokens: 65_536 })
      expect(gateway.bodies[1]).toMatchObject({ max_tokens: contextWindow - 111_024 - 1 - 4_096 })
      expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: status === 400
        ? { kind: 'error', failure: { code: 'CONTEXT_WINDOW_EXCEEDED' } }
        : { kind: 'stop' } })
    })

    it.each(['compaction', 'pruning', 'system', 'tools', 'response', 'legacy'] as const)(
      'discards stale context usage after %s instead of clamping a short request to one token', async change => {
        const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
        gateway.pushCompletions({ events: [
          textEvents[0]!, textEvents[1]!,
          JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: {
            prompt_tokens: 124_000, completion_tokens: 3_072, total_tokens: 127_072,
          } }), '[DONE]',
        ] })
        gateway.pushCompletions({ events: textEvents })
        const adapter = new OpencodeGoAdapter({
          config: () => configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 131_072 } } }),
          resolveApiKey: async () => 'test-key',
        })
        const user = (text: string) => createUserMessage({
          content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'test' },
        })
        const large = 'a'.repeat(420_000)
        const first = requestOf({
          system: change === 'system' ? large : 'System instructions',
          messages: [...(change === 'compaction' || change === 'pruning' ? [user(large)] : []), user('Keep this recent turn.')],
          tools: [{ name: 'lookup', description: change === 'tools' ? large : 'Look up a path', parameters: { type: 'object' } }],
        })
        try {
          const assembler = new BlockAssembler()
          for (const chunk of await drain(adapter.stream(first))) assembler.push(chunk)
          const previous = JSON.parse(JSON.stringify(assembler.message({
            provider: PROVIDER_ID, model: first.model, replayState: assembler.replayState,
          })))
          expect(previous.source.replayState.response.usage.totalTokens).toBe(127_072)
          if (change === 'legacy') delete previous.source.replayState.response.usageContext
          if (change === 'response') previous.content[0].text = 'Edited answer.'
          const next = {
            ...first,
            system: change === 'system' ? 'Updated system instructions' : first.system,
            tools: change === 'tools' ? [{ ...first.tools![0], description: 'Updated tool description' }] : first.tools,
            messages: [
              ...(change === 'compaction' ? [user('Compacted summary.'), first.messages.at(-1)!]
                : change === 'pruning' ? [first.messages.at(-1)!] : first.messages),
              previous, user('Continue.'),
            ],
          }
          const chunks = await drain(adapter.stream(next))
          expect(gateway.bodies[1]).toMatchObject({ max_tokens: 65_536 })
          expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'stop' } })
        } finally { await adapter.dispose() }
      },
    )

    it('keeps a model-only 400 as invalid request for a small context', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      gateway.pushCompletions({ status: 400, body: '{"model":"deepseek-v4.1-flash"}' })
      const adapter = await adapterFor(gateway.url)
      const chunks = await drain(adapter.stream(requestOf()))
      expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'INVALID_REQUEST' } } })
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

      // V4.1 Flash does not advertise Off; V4 Pro supports the native disable flag.
      await drain(adapter.stream(requestOf({ model: 'deepseek-v4-pro', reasoningEffort: ReasoningEffortId('off') })))

      expect(gateway.bodies[0]).toMatchObject({ thinking: { type: 'disabled' } })
      expect(gateway.bodies[0]).not.toHaveProperty('reasoning_effort')
    })

    it.each(['stream', 'prepare'] as const)('refuses GenerateOptions.stop as unsupported through %s', async operation => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const adapter = await adapterFor(gateway.url)

      const request = requestOf({ stop: ['now'] })
      const stream = operation === 'prepare'
        ? (await adapter.prepareCall(PROVIDER_ID, request.model)).stream(request)
        : adapter.stream(request)
      await expect(drain(stream)).rejects.toMatchObject({ code: 'UNSUPPORTED_OPTION' })
      // Direct streaming refuses the option before reading the catalog.
      if (operation === 'stream') expect(gateway.paths).toEqual([])
      expect(gateway.bodies).toHaveLength(0)
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

      const image = requestOf({ model: 'deepseek-v4-pro' })
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
})

describe("session routing", () => {
  afterEach(closeMockGateways)

  function prompt(session: Session, text: string): void {
    session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'test' } }), { surfaceOp: 'append' })
  }

  async function generate(adapter: OpencodeGoAdapter, session: Session): Promise<StreamChunk[]> {
    const chunks = []
    for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash',
      sessionId: session.id, messages: session.deriveMessages(),
    })) chunks.push(chunk)
    return chunks
  }

  it('keeps the Host session identity across continuation, host retry, durable restore and adapter recreation', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const adapter = () => new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
    try {
      const original = ctx.sessions.create(SessionId(randomUUID()))
      prompt(original, 'first turn')
      let current = adapter()
      gateway.pushCompletions({ events: textEvents })
      expect(await generate(current, original)).toContainEqual(expect.objectContaining({ type: 'finish', reason: { kind: 'stop' } }))
      prompt(original, 'continue this conversation')
      gateway.pushCompletions({ status: 503, body: '{"error":{"message":"temporarily unavailable"}}' })
      expect(await generate(current, original)).toContainEqual(expect.objectContaining({ type: 'finish', reason: expect.objectContaining({ kind: 'error' }) }))
      gateway.pushCompletions({ events: textEvents })
      await generate(current, original)
      // The Host owns persistence. Round-trip the exact durable header and log;
      // recreate both Session and adapter so no in-memory adapter identity can help.
      const saved = JSON.parse(JSON.stringify({ header: original.header, events: original.snapshotEvents(), inheritedEventCount: original.inheritedEventCount }))
      const restored = Session.fromRestore(SessionId(saved.header.id), saved.events, saved.header, saved.inheritedEventCount, 'detached')
      expect(restored).not.toBe(original)
      expect(restored.deriveMessages()).toEqual(original.deriveMessages())
      current = adapter()
      gateway.pushCompletions({ events: textEvents })
      await generate(current, restored)
      const headers = gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions')
      expect(headers).toHaveLength(4)
      expect(headers.map(header => header['x-opencode-session'])).toEqual(Array(4).fill(original.id))
      expect((gateway.bodies[3] as { messages: unknown[] }).messages).toHaveLength(2)
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('uses distinct durable identities for a real fork and subagent child, including concurrent requests and child restore', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
    try {
      const parent = ctx.sessions.create(SessionId(randomUUID()))
      prompt(parent, 'shared parent history')
      const fork = ctx.sessions.fork(parent)
      const child = ctx.sessions.create(SessionId(randomUUID()), { meta: { parentSession: parent.id, origin: 'subagent', delegationDepth: 1 } })
      prompt(child, 'delegated task')
      expect(fork.header.parentSession).toBe(parent.id)
      expect(fork.header.isSeeded).toBe(true)
      expect(fork.deriveMessages()).toEqual(parent.deriveMessages())
      expect(child.header.origin).toBe('subagent')
      for (let i = 0; i < 3; i++) gateway.pushCompletions({ events: textEvents })
      await Promise.all([parent, fork, child].map(session => generate(adapter, session)))
      const headers = gateway.headers.filter((_, index) => gateway.paths[index] === '/chat/completions')
      expect(new Set(headers.map(header => header['x-opencode-session']))).toEqual(new Set([parent.id, fork.id, child.id]))
      expect(new Set([parent.id, fork.id, child.id]).size).toBe(3)
      for (const session of [fork, child]) {
        const saved = JSON.parse(JSON.stringify({ header: session.header, events: session.snapshotEvents(), inheritedEventCount: session.inheritedEventCount }))
        const restored = Session.fromRestore(SessionId(saved.header.id), saved.events, saved.header, saved.inheritedEventCount, 'detached')
        gateway.pushCompletions({ events: textEvents })
        await generate(adapter, restored)
        expect(gateway.headers.at(-1)?.['x-opencode-session']).toBe(session.id)
        expect(gateway.headers.at(-1)?.['x-opencode-session']).not.toBe(parent.id)
      }
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it.each([
    { label: 'Chinese', id: '会话-a', expected: 'dsh-go-session-v1-gfOfUn1OfrpwXFw0alFDv3iYSlRdom5rr2JaJTHWtbM' },
    { label: 'Latin-1', id: 'café-session' },
    { label: 'CRLF', id: 'session\r\ninvalid' },
    { label: 'trailing newline', id: 'session\n' },
    { label: 'only spaces', id: '   ' },
    { label: 'surrounding spaces', id: ' session ' },
    { label: 'tabs', id: 'session\twith\ttabs' },
    { label: 'NUL', id: '\u0000session' },
    { label: 'lone surrogate', id: '\ud800' },
  ])('keeps a $label session stable through restore, prepared title and compaction calls', async ({ id, expected }) => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const createAdapter = () => new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
    const adapters = [createAdapter(), createAdapter()]
    try {
      const original = ctx.sessions.create(SessionId(id))
      prompt(original, 'first turn')
      gateway.pushCompletions({ events: textEvents })
      expect((await generate(adapters[0]!, original)).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
      const identity = gateway.headers.at(-1)?.['x-opencode-session']
      expect(identity).toMatch(/^[\x21-\x7e]+$/)
      expect(identity).not.toBe(id)
      if (expected !== undefined) expect(identity).toBe(expected)

      const saved = JSON.parse(JSON.stringify({ header: original.header, events: original.snapshotEvents(), inheritedEventCount: original.inheritedEventCount }))
      const restored = Session.fromRestore(SessionId(saved.header.id), saved.events, saved.header, saved.inheritedEventCount, 'detached')
      const prepared = await adapters[1]!.prepareCall('dsh-opencode-go', 'deepseek-v4.1-flash')
      for (const purpose of ['session-title', 'compaction'] as const) {
        gateway.pushCompletions({ events: textEvents })
        const input = Object.freeze({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash',
          sessionId: restored.id, messages: restored.deriveMessages(), purpose })
        const chunks = await Array.fromAsync(purpose === 'session-title' ? prepared.stream(input) : adapters[1]!.stream(input))
        expect(chunks.at(-1)).toMatchObject({ reason: { kind: 'stop' } })
        expect(gateway.headers.at(-1)?.['x-opencode-session']).toBe(identity)
        expect(input.sessionId).toBe(id)
      }
      expect(original.id).toBe(id)
      expect(restored.id).toBe(id)
    } finally {
      await Promise.all(adapters.map(adapter => adapter.dispose()))
      await ctx.fiber.dispose()
    }
  })

  it('keeps distinct special IDs and a literal mapped-header value in separate sessions', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
    try {
      const ids = ['会话-a', '会话-b', 'session', ' session', 'session ', '\ud800', '\ud801', '\ufffd']
      const identities = []
      for (const id of ids) {
        const session = ctx.sessions.create(SessionId(id))
        prompt(session, 'distinct session')
        gateway.pushCompletions({ events: textEvents })
        expect((await generate(adapter, session)).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
        identities.push(gateway.headers.at(-1)?.['x-opencode-session'])
      }
      expect(new Set(identities).size).toBe(ids.length)

      // A caller may legitimately choose a string equal to another session's wire ID.
      const literal = ctx.sessions.create(SessionId(String(identities[0])))
      prompt(literal, 'literal mapped header')
      for (let i = 0; i < 2; i++) {
        gateway.pushCompletions({ events: textEvents })
        expect((await generate(adapter, literal)).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
        expect(gateway.headers.at(-1)?.['x-opencode-session']).not.toBe(identities[0])
      }
      expect(gateway.headers.at(-1)?.['x-opencode-session']).toBe(gateway.headers.at(-2)?.['x-opencode-session'])
    } finally {
      await adapter.dispose()
      await ctx.fiber.dispose()
    }
  })
})

describe("deadline configuration", () => {
  it('provides finite preparation and whole-request deadlines', () => {
    expect(PlainConfig()).toMatchObject({ requestPreparationTimeoutMs: 60_000, requestTimeoutMs: 1_800_000 })
  })

  it.each(['requestPreparationTimeoutMs', 'requestTimeoutMs'])('rejects invalid %s values before installing timer policy', field => {
    for (const value of [0, -1, Infinity, NaN, 2_147_483_648, '30']) {
      expect(() => PlainConfig({ [field]: value })).toThrow()
    }
    expect(PlainConfig({ [field]: 30 })[field as 'requestTimeoutMs']).toBe(30)
  })
})

describe("host and wire capacity alignment", () => {
  afterEach(closeMockGateways)

  it.each([
    { configured: undefined, requested: undefined, expected: 65_536 },
    { configured: 131_072, requested: undefined, expected: 131_072 },
    { configured: undefined, requested: 98_304, expected: 98_304 },
    { configured: 32_768, requested: 98_304, expected: 32_768 },
  ])('aligns the host reservation with the wire allowance ($configured, $requested)', async ({ configured, requested, expected }) => {
    const model = 'deepseek-v4.1-flash'
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    gateway.pushCompletions({ events: textEvents })
    const config = configOf(gateway.url, { modelLimits: configured === undefined ? {} : { [model]: { maxTokens: configured } } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
    try {
      const info = await adapter.resolveModel('dsh-opencode-go', model)
      expect(info.defaultMaxTokens).toBe(configured ?? 65_536)
      const prepared = await ctx.llm.prepareCall({ provider: 'dsh-opencode-go', model,
        ...requested === undefined ? {} : { maxTokens: requested } })
      expect(prepared.config.maxTokens).toBe(requested ?? info.defaultMaxTokens)
      for await (const chunk of prepared.stream({ provider: 'dsh-opencode-go', model, messages: [], ...prepared.config })) void chunk
      expect(gateway.bodies[0]).toMatchObject({ max_tokens: expected })
    } finally { await ctx.fiber.dispose() }
  })

  it('bounds the DeepSeek V4.1 Flash default by a smaller declared output capacity without changing the catalog', async () => {
    const model = 'deepseek-v4.1-flash'
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input).endsWith('/models')
      ? Promise.resolve(Response.json(modelsDocument({ [model]: modelEntry({ limit: { context: 262144, output: 8192 } }) })))
      : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    gateway.pushCompletions({ events: textEvents })
    const config = configOf(gateway.url)
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    expect((await adapter.resolveModel('dsh-opencode-go', model)).defaultMaxTokens).toBeUndefined()
    for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model, messages: [] })) void chunk
    expect(gateway.bodies[0]).toMatchObject({ max_tokens: 8192 })
    expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({ id: model, maxTokens: 8192 }))
  })

  it.each(['deepseek-v4-pro', 'deepseek-v4.1-flash-vision-exp', 'kimi-k3', 'future-model'])(
    'caps large model defaults uniformly and preserves explicit caller allowances: %s', async model => {
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input).endsWith('/models')
      ? Promise.resolve(Response.json(modelsDocument({ [model]: modelEntry() })))
      : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    gateway.pushCompletions({ events: textEvents })
    gateway.pushCompletions({ events: textEvents })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['dsh-opencode-go'], adapter)
    try {
      expect((await adapter.resolveModel('dsh-opencode-go', model)).defaultMaxTokens).toBe(65536)
      const prepared = await ctx.llm.prepareCall({ provider: 'dsh-opencode-go', model })
      expect(prepared.config.maxTokens).toBe(65536)
      for await (const chunk of prepared.stream({ provider: 'dsh-opencode-go', model, messages: [], ...prepared.config })) void chunk
      expect(gateway.bodies[0]).toMatchObject({ max_tokens: 65_536 })
      for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model, messages: [], maxTokens: 196_608 })) void chunk
      expect(gateway.bodies[1]).toMatchObject({ max_tokens: 196_608 })
    } finally { await ctx.fiber.dispose() }
  })

  it('preserves an explicit output override for other models', async () => {
    const model = 'deepseek-v4-pro'
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    gateway.pushCompletions({ events: textEvents })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, {
      modelLimits: { [model]: { maxTokens: 98_304 } },
    }), resolveApiKey: async () => 'test-key' })
    for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model, messages: [] })) void chunk
    expect(gateway.bodies[0]).toMatchObject({ max_tokens: 98_304 })
  })

  it.each([undefined, 'high'])('caps large Anthropic default allowances with reasoning=%s', async effort => {
    const model = 'minimax-m3'
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    gateway.pushCompletions({ status: 400, body: '{"message":"fixture rejection"}' })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'test-key' })
    const prepared = await adapter.prepareCall('dsh-opencode-go', model)
    expect(prepared.model.defaultMaxTokens).toBe(65536)
    for await (const chunk of prepared.stream({ provider: 'dsh-opencode-go', model, messages: [],
      ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
    })) void chunk
    expect(gateway.paths.at(-1)).toMatch(/\/messages(?:\?|$)/)
    expect(gateway.bodies[0]).toMatchObject({ max_tokens: effort === undefined ? 65536 : 81920 })
    if (effort) expect(gateway.bodies[0]).toHaveProperty('thinking.budget_tokens', 16384)
  })

  it('keeps original catalog references when runtime capacities are overridden', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 123456, maxTokens: 5432 } } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    expect((await adapter.resolveModel('dsh-opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow).toBe(123456)
    expect(await discoverCatalogModels(adapter.catalogOf(config))).toContainEqual(expect.objectContaining({
      id: 'deepseek-v4.1-flash', contextWindow: 262144, maxTokens: 131072,
    }))
  })

  it.each([undefined, 8192, 512])('caps explicit and default request output (%s)', async (requested) => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    gateway.pushCompletions({ events: textEvents })
    const config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { maxTokens: 1024 } } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    for await (const chunk of adapter.stream({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', messages: [],
      ...(requested === undefined ? {} : { maxTokens: requested }),
    })) void chunk
    const body = gateway.bodies[0] as Record<string, number>
    expect(body.max_tokens ?? body.max_completion_tokens).toBe(Math.min(requested ?? 1024, 1024))
  })

  it('retains last known online metadata when limits change during an outage', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['union-alpha']) })
    let config = configOf(gateway.url)
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    expect((await adapter.resolveModel('dsh-opencode-go', 'union-alpha')).context?.contextWindow).toBe(262144)
    gateway.setModelListing(503, {})
    config = { ...config, modelLimits: { 'union-alpha': { contextWindow: 123456 } } }
    await expect(adapter.resolveModel('dsh-opencode-go', 'union-alpha')).resolves.toMatchObject({ context: { contextWindow: 123456 } })
    // An explicit refresh must preserve the learned model too, not just the TTL hit.
    expect((await discoverSettingsModels(adapter.catalogOf(config))).models).toContainEqual(expect.objectContaining({
      id: 'union-alpha', contextWindow: 262144,
    }))
    expect(gateway.modelListings).toBe(2)
    config = { ...config, modelLimits: {} }
    expect((await adapter.resolveModel('dsh-opencode-go', 'union-alpha')).context?.contextWindow).toBe(262144)
  })

  it('keeps capacities captured before an in-flight fetch across a settings change', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    let config = configOf(gateway.url, { modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 123456 } } })
    const adapter = new OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'test-key' })
    const priorFetch = globalThis.fetch
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith('/models')) await gate
      return priorFetch(input, init)
    })
    const pending = adapter.resolveModel('dsh-opencode-go', 'deepseek-v4.1-flash')
    // Keep the nested object shared: model reads still need an owned config snapshot.
    config.modelLimits['deepseek-v4.1-flash']!.contextWindow = 42
    config = { ...config }
    release()
    expect((await pending).context?.contextWindow).toBe(123456)
    expect((await adapter.resolveModel('dsh-opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow).toBe(42)
  })
})
