import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { AttachmentId, AttachmentStore, ImageVariantId } from '@deepseek-ai/dsh-attachment'
import type {
  ImageAttachmentLimits,
  ImageAttachmentRef,
  ImageRequestTarget,
  RequestImageAttachment,
  SaveImageAttachment,
  StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import LlmRuntime, { LlmAdapter, createUserMessage, MessageId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { apply } from '../src/index.ts'
import { Config, type LiveConfig } from '../src/config.ts'
import { closeMockGateways, fullLiveListing, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { configOf } from './config-of.ts'
import { OpencodeGoCatalog } from '../src/catalog.ts'
import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

const HOST_IMAGE_PATH = '/host/.dsh/attachments/objects/aa/object'
const MODEL_IMAGE_PATH = '/model/.dsh/attachments/objects/aa/object'

/** Wait until the credential-backed route registration settles. */
async function waitForRoute(ctx: Context): Promise<void> {
  await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 }).toContainEqual({ id: 'dsh-opencode-go', name: 'DSH OpenCode Go' })
}

class MappedFileSystem extends Service {
  constructor(ctx: Context) {
    super(ctx, 'fs')
  }

  processPathFromHostPath(hostPath: string): string | undefined {
    return hostPath === HOST_IMAGE_PATH ? MODEL_IMAGE_PATH : undefined
  }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await closeMockGateways()
})

class StubAdapter extends LlmAdapter {
  override async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new Error('stub')
  }
}

describe('llm-opencode-go plugin mount', () => {
  it('notifies the host picker when a disk-backed startup finishes refreshing metadata', async () => {
    const id = 'persisted-model'
    const gateway = await mockGateway({ status: 200, body: listingBody([id, 'new-model']) })
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? Promise.resolve(Response.json(metadataDocument({ [id]: modelMetadata() }))) : original(input, init))
    await new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}).snapshot(true)
    const metadata = Promise.withResolvers<Response>()
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? metadata.promise : original(input, init))
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))
    const updated = vi.fn()
    ctx.on('llm/adapters-updated', updated)
    try {
      expect((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id)).toEqual([id])
      expect(updated).not.toHaveBeenCalled()
      metadata.resolve(Response.json(metadataDocument({ [id]: modelMetadata(), 'new-model': modelMetadata() })))
      await expect.poll(() => updated.mock.calls.length).toBe(1)
      expect((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id)).toEqual([id, 'new-model'])
    } finally {
      metadata.resolve(Response.json(metadataDocument()))
      await ctx.fiber.dispose()
    }
  })

  it('registers the route and answers model discovery from the live listing', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))

    const models = await ctx.llm.discoverModels('llm-opencode-go', { provider: 'dsh-opencode-go' })

    expect(models.map(model => model.id)).toContain('deepseek-v4.1-flash')
  })

  it('applies configuration defaults from a bare mount', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    // A bare mount: no config at all. The route registers against the default
    // endpoint; only a request would touch the network.
    apply(ctx)

  })

  it('refuses discovery for endpoints that are not OpenCode zen/go', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf('https://opencode.ai/zen/go/v1'))

    await expect(ctx.llm.discoverModels('llm-opencode-go', { baseURL: 'https://gateway.example/v1' }))
      .rejects.toMatchObject({ code: 'DISCOVERY_UNSUPPORTED' })
    // A draft naming another provider with no endpoint at all is equally not ours.
    await expect(ctx.llm.discoverModels('llm-opencode-go', { provider: 'someone-else' }))
      .rejects.toMatchObject({ code: 'DISCOVERY_UNSUPPORTED' })
  })

  it('keeps discovery working when another adapter family owns the route', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['dsh-opencode-go'], new StubAdapter())

    // The conflicting registration is logged, not thrown, and discovery — whose
    // value does not depend on owning the route — still registers.
    apply(ctx, configOf(gateway.url))

    const models = await ctx.llm.discoverModels('llm-opencode-go', { provider: 'dsh-opencode-go' })
    expect(models.map(model => model.id)).toContain('deepseek-v4.1-flash')
  })

  it('keeps a duplicate mount loading when it already owns the discovery namespace', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))
    const errors: string[] = []
    ctx.logger.error = ((message: string) => { errors.push(message) }) as typeof ctx.logger.error

    // A second mount on the same context meets the first one's discovery
    // registration; the refusal must degrade the way the route's does instead
    // of failing the whole entry.
    apply(ctx, configOf(gateway.url))

    expect(errors.some(message => message.includes('not registering model discovery'))).toBe(true)
    const models = await ctx.llm.discoverModels('llm-opencode-go', { provider: 'dsh-opencode-go' })
    expect(models.map(model => model.id)).toContain('deepseek-v4.1-flash')
  })

  it('streams through the mounted route, resolving the credential from the environment', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    // A trailing slash must not corrupt the derived listing path.
    apply(ctx, configOf(`${gateway.url}/`))

    const chunks: StreamChunk[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'dsh-opencode-go',
      model: 'deepseek-v4.1-flash',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
      sessionId: 'mounted-session' as never,
    })) chunks.push(chunk)

    expect(gateway.paths).toEqual(['/models', '/chat/completions'])
    expect(gateway.headers[1]?.['x-opencode-session']).toBe('mounted-session')
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  })

  it('keeps thinking on when the picker is left on the provider default', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))

    // No `reasoningEffort`: this is the "Default" entry of the model picker.
    for await (const _chunk of ctx.llm.stream({
      provider: 'dsh-opencode-go',
      model: 'deepseek-v4.1-flash',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
      sessionId: 'default-effort' as never,
    })) { /* drain the stream: only the request body is asserted */ }

    // Without the declared default this body carries `thinking: { type: 'disabled' }`,
    // which lands the model's reasoning in ordinary content instead of a reasoning block.
    expect(gateway.bodies[0]).toMatchObject({ thinking: { type: 'enabled' } })
  })

  it('refuses to call a model never confirmed by the gateway', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 503, body: {} })
    gateway.pushCompletions({ events: textEvents })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))

    const chunks: StreamChunk[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'dsh-opencode-go',
      model: 'deepseek-v4.1-flash',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })) chunks.push(chunk)

    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'error' } })
    expect(gateway.paths).toEqual(['/models'])
  })

  it('resolves the credential through the credentials seam when one is mounted', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.provide('credentials', {
      resolve: () => Promise.resolve({ value: 'seam-key', source: 'test' }),
      describe: () => Promise.resolve({ configured: true, writable: true }),
    } as never)
    apply(ctx, configOf(gateway.url))
    await waitForRoute(ctx)

    const chunks: StreamChunk[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'dsh-opencode-go',
      model: 'deepseek-v4.1-flash',
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })) chunks.push(chunk)

    expect(gateway.headers[1]?.authorization).toBe('Bearer seam-key')
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  })

  it('keeps unconfigured live ids visible with an explicit diagnostic', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({
      status: 200,
      body: listingBody([...fullLiveListing(), 'mystery-model']),
    })
    gateway.pushCompletions({ events: textEvents })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))

    const models = await ctx.llm.discoverModels('llm-opencode-go', { provider: 'dsh-opencode-go' })
    expect(models.find(model => model.id === 'mystery-model')?.name).toContain('metadata unavailable')
    expect(models.map(model => model.id)).toContain('deepseek-v4.1-flash')
  })

  it('reports replay degradation through the mounted adapter', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const warnings: string[] = []
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.logger.warn = ((message: string) => {
      warnings.push(message)
    }) as typeof ctx.logger.warn
    apply(ctx, configOf(gateway.url))

    const chunks: StreamChunk[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'dsh-opencode-go',
      model: 'deepseek-v4.1-flash',
      messages: [
        createUserMessage({
          content: [{ type: 'text', text: 'hi' }],
          source: { kind: 'plugin', plugin: 'test' },
        }),
        {
          id: MessageId('m1'),
          role: 'assistant',
          content: [{ type: 'text', text: 'earlier answer' }],
          source: {
            kind: 'model',
            provider: 'dsh-opencode-go',
            model: 'deepseek-v4.1-flash',
            replayState: { kind: 'foreign-adapter' },
          },
        },
      ],
    })) chunks.push(chunk)

    expect(warnings.some(message => message.includes('unusable replay state'))).toBe(true)
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  })

  it('discovers by an OpenCode baseURL alone, without the route name', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))

    const models = await ctx.llm.discoverModels('llm-opencode-go', { baseURL: 'https://opencode.ai/zen/go/v1' })

    expect(models.map(model => model.id)).toContain('deepseek-v4.1-flash')
  })

  it('keeps the route unregistered until its credential resolves', async () => {
    Reflect.deleteProperty(process.env, 'OPENCODE_API_KEY')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))

    // No key anywhere: the route stays dormant so first-run onboarding never
    // mistakes it for a usable provider, and no request reaches the gateway.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(ctx.llm.listProviders()).toEqual([])
    expect(gateway.paths).toEqual([])
  })

  it('converts image attachments for the multimodal model end to end', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const attachmentId = AttachmentId(`sha256:${'a'.repeat(64)}`)
    const ref: ImageAttachmentRef = {
      attachmentId,
      mediaType: 'image/png',
      bytes: 1,
      width: 4096,
      height: 4096,
    }
    const readImageRequest = vi.fn((
      value: ImageAttachmentRef,
      _policy: ImageRequestTarget,
      _signal?: AbortSignal,
    ): Promise<RequestImageAttachment> => (
      Promise.resolve({
        variantId: ImageVariantId(`sha256:${'b'.repeat(64)}`),
        attachment: value,
        data: Uint8Array.of(1),
        mediaType: value.mediaType,
        bytes: 1,
        width: value.width,
        height: value.height,
        depth: 'uchar',
        space: 'srgb',
        hasAlpha: true,
      })
    ))

    class LateAttachmentStore extends AttachmentStore {
      readonly imageLimits: ImageAttachmentLimits = {
        maxImageBytes: 1,
        maxImagesPerMessage: 1,
        maxMessageImageBytes: 1,
        maxImagePixels: 1,
        maxImageDimension: 2000,
        mediaTypes: ['image/png'],
      }

      validateImage(_input: SaveImageAttachment): Promise<void> {
        return Promise.reject(new Error('not used'))
      }

      saveImage(_input: SaveImageAttachment): Promise<ImageAttachmentRef> {
        return Promise.reject(new Error('not used'))
      }

      readImage(_value: ImageAttachmentRef): Promise<StoredImageAttachment> {
        return Promise.reject(new Error('not used'))
      }

      override imageHostPath(_ref: ImageAttachmentRef): string {
        return HOST_IMAGE_PATH
      }

      override readImageRequest(
        value: ImageAttachmentRef,
        policy: ImageRequestTarget,
        signal?: AbortSignal,
      ): Promise<RequestImageAttachment> {
        return readImageRequest(value, policy, signal)
      }
    }

    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    apply(ctx, configOf(gateway.url))
    await ctx.plugin(LateAttachmentStore)
    await ctx.plugin(MappedFileSystem)

    const chunks: StreamChunk[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'dsh-opencode-go',
      model: 'deepseek-v4.1-flash',
      messages: [createUserMessage({
        content: [{ type: 'image', attachment: ref }],
        source: { kind: 'plugin', plugin: 'test' },
      })],
    })) chunks.push(chunk)

    expect(readImageRequest).toHaveBeenCalledWith(ref, {
      width: 2048,
      height: 2048,
      maxPixels: 2048 * 2048,
      maxBytes: 1024 * 1024,
    }, expect.any(AbortSignal))
    expect(JSON.stringify(gateway.bodies[0])).toContain(MODEL_IMAGE_PATH)
    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({ reason: { kind: 'stop' } })
  })

  it('fails loud at load on an unusable baseURL', () => {
    const ctx = new Context()
    return expect(Promise.resolve().then(async () => {
      await ctx.plugin(LlmRuntime)
      apply(ctx, configOf('not-a-url'))
    })).rejects.toThrow(/baseURL "not-a-url" is not a valid URL/)
  })

  it.each([
    ['ftp://gateway.example/v1', /must be http or https/],
    ['https://gateway.example/v1?tenant=1', /must not carry a query or fragment/],
    ['https://gateway.example/v1#frag', /must not carry a query or fragment/],
  ])('refuses the unusable baseURL %s at load', (baseURL, message) => {
    const ctx = new Context()
    return expect(Promise.resolve().then(async () => {
      await ctx.plugin(LlmRuntime)
      apply(ctx, configOf(baseURL))
    })).rejects.toThrow(message)
  })

  it('refuses an empty selected apiKeyEnv instead of silently deregistering the route', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    // Composition layer: the schema pattern fails the load rather than letting
    // an empty reference match no account while the default credential works.
    expect(() => apply(ctx, configOf('https://gateway.example/v1', { apiKeyEnv: '' }))).toThrow(/match regexp/)
    // A live reference carries the field-level message.
    const config = configOf('https://gateway.example/v1', { apiKeyEnv: '' })
    const live = Object.fromEntries(Object.keys(Config()).map(key => [key, { get: () => config[key as keyof typeof config] }])) as LiveConfig
    expect(() => apply(ctx, live)).toThrow(/apiKeyEnv "" must be an environment variable name/)
  })
})
