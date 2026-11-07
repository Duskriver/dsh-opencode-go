import { afterEach, expect, it, vi, describe } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import {
  createMessage,
  createUserMessage,
  LlmAdapter,
  ReasoningEffortId,
  type GenerateOptions,
  type StreamChunk,
  MessageId,
  userAgent,
} from '@deepseek-ai/dsh-llm'
import * as OpencodeGo from '../src/index.ts'
import { apply } from '../src/index.ts'
import { configOf, context, mountRemotes, invokeRemote } from './support/host.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents, fullLiveListing } from './support/gateway.ts'
import SettingsForms from '@deepseek-ai/dsh-settings'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { satisfies } from 'semver'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import {
  AttachmentId,
  AttachmentStore,
  ImageVariantId,
  type ImageAttachmentLimits,
  type ImageAttachmentRef,
  type ImageRequestTarget,
  type RequestImageAttachment,
  type SaveImageAttachment,
  type StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import { Config, DEFAULT_CONFIG, normalizeConfig, type LiveConfig } from '../src/config.ts'
import { OpencodeGoCatalog } from '../src/catalog.ts'
import { FreeBunTransport } from '../src/free-transport.ts'
import { ProxyTransport } from '../src/transport.ts'
import { modelsDocument, modelEntry } from './support/data.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'

describe("route lifecycle", () => {
  const HOST_IMAGE_PATH = '/host/.dsh/attachments/objects/aa/object'

  const MODEL_IMAGE_PATH = '/model/.dsh/attachments/objects/aa/object'

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
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === `${gateway.url}/models`
        ? Promise.resolve(Response.json(modelsDocument({ [id]: modelEntry() }))) : original(input, init))
      await new OpencodeGoCatalog(gateway.url, 60_000, () => {}, () => {}).snapshot(true)
      const metadata = Promise.withResolvers<Response>()
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === `${gateway.url}/models`
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
        metadata.resolve(Response.json(modelsDocument({ [id]: modelEntry(), 'new-model': modelEntry() })))
        await expect.poll(() => updated.mock.calls.length).toBe(1)
        expect((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id)).toEqual([id, 'new-model'])
      } finally {
        metadata.resolve(Response.json(modelsDocument()))
        await ctx.fiber.dispose()
      }
    })

    it('releases both adapters and their Free transports when the plugin unloads', async () => {
      vi.stubEnv('OPENCODE_API_KEY', 'test-key')
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      const freeTransportDispose = vi.spyOn(FreeBunTransport.prototype, 'dispose')
      const transportDispose = vi.spyOn(ProxyTransport.prototype, 'dispose')
      try {
        apply(ctx, configOf(gateway.url, { freeEnabled: true }))
        await expect.poll(() => ctx.llm.listProviders().map(provider => provider.id).sort())
          .toEqual(['dsh-opencode-free', 'dsh-opencode-go'])

        await ctx.fiber.dispose()

        // Each adapter owns one Free transport (Bun workers and SOCKS tunnels).
        expect(freeTransportDispose).toHaveBeenCalledTimes(2)
        // The Host owns the shared ProxyTransport; the adapters must not
        // dispose a transport they did not create.
        expect(transportDispose).toHaveBeenCalledTimes(1)
      } finally {
        freeTransportDispose.mockRestore()
        transportDispose.mockRestore()
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

    it('keeps private inference data on the gateway while fetching public model metadata', async () => {
      const apiKey = 'private-fixture-key'
      const prompt = 'private fixture conversation'
      const sessionId = 'private-fixture-session'
      vi.stubEnv('OPENCODE_API_KEY', apiKey)
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      gateway.pushCompletions({ events: textEvents })
      const fetch = globalThis.fetch
      const metadataRequests: Request[] = []
      const destinations: string[] = []
      vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        destinations.push(url)
        if (url === `${gateway.url}/models`) metadataRequests.push(new Request(input, init))
        return fetch(input, init)
      })
      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      try {
        apply(ctx, configOf(gateway.url))
        const chunks: StreamChunk[] = []
        for await (const chunk of ctx.llm.stream({
          provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', sessionId: sessionId as never,
          messages: [createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'plugin', plugin: 'test' } })],
        })) chunks.push(chunk)
        expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello' }))
        expect(gateway.headers.at(-1)?.authorization).toBe(`Bearer ${apiKey}`)
        expect(JSON.stringify(gateway.bodies)).toContain(prompt)
        expect(metadataRequests.length).toBeGreaterThan(0)
        for (const request of metadataRequests) {
          expect(request.method).toBe('GET')
          expect(request.body).toBeNull()
          expect(request.headers.get('authorization')).toBeNull()
          expect(request.headers.get('cookie')).toBeNull()
          expect(request.headers.get('x-opencode-session')).toBeNull()
          const publicRequest = JSON.stringify([request.url, [...request.headers]])
          for (const privateValue of [apiKey, prompt, sessionId]) expect(publicRequest).not.toContain(privateValue)
        }
        expect(destinations.every(url => url === `${gateway.url}/models` || url.startsWith(`${gateway.url}/`))).toBe(true)
      } finally { await ctx.fiber.dispose() }
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

    it('leaves thinking to the service when the picker is left on default', async () => {
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

      expect(gateway.bodies[0]).not.toHaveProperty('thinking')
      expect(gateway.bodies[0]).not.toHaveProperty('reasoning_effort')
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
        body: { data: [...(listingBody(fullLiveListing()) as { data: unknown[] }).data, { id: 'mystery-model', ...modelEntry({ api: {} }) }] },
      })
      gateway.pushCompletions({ events: textEvents })
      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      apply(ctx, configOf(gateway.url))

      const models = await ctx.llm.discoverModels('llm-opencode-go', { provider: 'dsh-opencode-go' })
      expect(models.find(model => model.id === 'mystery-model')?.name).toContain('configuration unavailable')
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

    it('activates only Free until a usable credential enables Go', async () => {
      Reflect.deleteProperty(process.env, 'OPENCODE_API_KEY')
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const ctx = new Context()
      await ctx.plugin(LlmRuntime)
      apply(ctx, configOf(gateway.url, { freeEnabled: true }))

      // No key anywhere: the route stays dormant so first-run onboarding never
      // mistakes it for a usable provider, and no request reaches the gateway.
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(ctx.llm.listProviders()).toEqual([{ id: 'dsh-opencode-free', name: 'DSH OpenCode Free' }])
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
      expect(() => apply(ctx, { ...configOf('https://gateway.example/v1'), apiKeyEnv: '' })).toThrow(/match regexp/)
      // A live reference carries the field-level message.
      const config = { ...configOf('https://gateway.example/v1'), apiKeyEnv: '' }
      const live = Object.fromEntries(Object.keys(Config()).map(key => [key, { get: () => config[key as keyof typeof config] }])) as LiveConfig
      expect(() => apply(ctx, live)).toThrow(/apiKeyEnv "" must be an environment variable name/)
    })
  })
})

describe("Loader composition", () => {
  let root: string | undefined

  const contexts: Context[] = []

  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
    if (root !== undefined) await rm(root, { recursive: true, force: true })
    root = undefined
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
    await closeMockGateways()
    vi.unstubAllEnvs()
  })

  async function loadComposition(lines: readonly string[]): Promise<Context> {
    root = await mkdtemp(join(tmpdir(), 'dsh-opencode-go-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [...lines, ''].join('\n'))
    const ctx = new Context()
    contexts.push(ctx)
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-llm', LlmRuntime],
      ['@deepseek-ai/dsh-credentials-local', LocalCredentialProvider],
      ['dsh-opencode-go', OpencodeGo],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await ctx.loader.await()
    const unloaded = [...ctx.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])
    return ctx
  }

  describe('llm-opencode-go through a real Loader composition', () => {
    it('loads profile entries with fields outside the plugin schema', async () => {
      vi.stubEnv('OPENCODE_API_KEY', 'loader-key')
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const ctx = await loadComposition([
        "- name: '@deepseek-ai/dsh-llm'",
        "- name: 'dsh-opencode-go'",
        '  config:',
        `    baseURL: ${gateway.url}`,
        '    modelLimits:',
        '      deepseek-v4.1-flash:',
        '        contextWindow: 123456',
        // Schemastery preserves unknown profile fields without wrapping them
        // in volatile references. None of these values has a callable get().
        '    provider: dsh-opencode-go',
        '    legacyEnabled: true',
        '    legacyLimit: 42',
        '    legacyOption: null',
        '    legacyModels: []',
        '    legacySettings: { get: false }',
      ])

      await expect.poll(() => ctx.llm.listProviders())
        .toContainEqual({ id: 'dsh-opencode-go', name: 'DSH OpenCode Go' })
      expect((await ctx.llm.resolveModelInfo('dsh-opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow)
        .toBe(123456)
      expect(gateway.paths).toEqual(['/models'])
    })

    it('serves the gateway catalog and routes a stream with the session header', async () => {
      vi.stubEnv('OPENCODE_API_KEY', 'loader-key')
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      gateway.pushCompletions({ events: textEvents })
      const ctx = await loadComposition([
        "- name: '@deepseek-ai/dsh-llm'",
        "- name: 'dsh-opencode-go'",
        '  config:',
        `    baseURL: ${gateway.url}`,
      ])

      await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 })
        .toContainEqual({ id: 'dsh-opencode-go', name: 'DSH OpenCode Go' })
      // The supplemented model reaches the picker through the loaded row.
      await expect(ctx.llm.listModels('dsh-opencode-go')).resolves.toContainEqual(
        expect.objectContaining({ id: 'deepseek-v4.1-flash' }),
      )

      const chunks: StreamChunk[] = []
      for await (const chunk of ctx.llm.stream({
        provider: 'dsh-opencode-go',
        model: 'deepseek-v4.1-flash',
        messages: [createUserMessage({
          content: [{ type: 'text', text: 'hi' }],
          source: { kind: 'plugin', plugin: 'loader-test' },
        })],
        sessionId: 'loader-session' as never,
      })) chunks.push(chunk)

      expect(chunks.some(chunk => chunk.type === 'text-delta')).toBe(true)
      expect(gateway.paths).toEqual(['/models', '/chat/completions'])
      const request = gateway.headers[1]
      expect(request?.['x-opencode-session']).toBe('loader-session')
      expect(request?.['user-agent']).toBe(userAgent())
      expect(request?.authorization).toBe('Bearer loader-key')
    })

    it('registers the route when the credentials seam becomes active after the plugin', async () => {
      const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
      const credDir = await mkdtemp(join(tmpdir(), 'dsh-opencode-go-cred-'))
      tempDirs.push(credDir)
      const credPath = join(credDir, '.credentials.yaml')
      await writeFile(credPath, 'version: 1\nrefs:\n  OPENCODE_API_KEY: loader-key\n', { mode: 0o600 })
      // The Loader starts every entry concurrently, and this plugin injects only
      // `llm`, so it applies before the credential provider finishes its
      // asynchronous document load. The stored key must still register the route
      // at boot, not only at the next credentials write.
      const ctx = await loadComposition([
        "- name: '@deepseek-ai/dsh-llm'",
        "- name: 'dsh-opencode-go'",
        '  config:',
        `    baseURL: ${gateway.url}`,
        "- name: '@deepseek-ai/dsh-credentials-local'",
        '  config:',
        `    path: ${credPath}`,
        '    watch: false',
      ])

      await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 })
        .toContainEqual({ id: 'dsh-opencode-go', name: 'DSH OpenCode Go' })
    })
  })
})

describe('profile forms and live configuration', () => {
  it('normalizes old profiles to badge appearance with sidebar quota disabled and validates saved choices', () => {
    expect(DEFAULT_CONFIG).toMatchObject({ showSidebarQuota: false, usagePillStyle: 'badge' })
    expect(normalizeConfig()).toMatchObject({ showSidebarQuota: false, usagePillStyle: 'badge' })
    expect(normalizeConfig({ showSidebarQuota: true, usagePillStyle: 'plain' })).toMatchObject({ showSidebarQuota: true, usagePillStyle: 'plain' })
    expect(DEFAULT_CONFIG).toMatchObject({ showSidebarQuota: false, usagePillStyle: 'badge' })
    expect(() => normalizeConfig({ usagePillStyle: 'neon' as never })).toThrow()
    expect(() => normalizeConfig({ showSidebarQuota: 'true' as never })).toThrow()
  })

  async function profile(baseURL: string) {
    const ctx = context()
    const secrets = new Map([['OPENCODE_API_KEY', 'profile-key']])
    ctx.provide('credentials', {
      resolve: async (ref: string) => secrets.has(ref) ? { value: secrets.get(ref), source: 'test' } : undefined,
      describe: async (ref: string) => ({ configured: secrets.has(ref), writable: true }),
      set: async (ref: string, value: string) => { secrets.set(ref, value); ctx.emit('credentials/reference-updated', ref) },
      unset: async (ref: string) => { secrets.delete(ref); ctx.emit('credentials/reference-updated', ref) },
    } as never)
    await ctx.plugin(Loader)
    await mountRemotes(ctx, false)
    ctx.loader.internal = { version: 'v2', import: async (name: string) => {
      if (name === 'runtime') return { default: LlmRuntime }
      if (name === 'opencode-go') return OpencodeGo
      throw new Error(`Unexpected test profile module ${name}`)
    } } as never
    await ctx.loader.create({ id: 'runtime', name: 'runtime' })
    const id = await ctx.loader.create({ id: 'opencode-go', name: 'opencode-go', config: { baseURL } })
    await ctx.loader.await()
    const entry = ctx.loader.resolve(id), fiber = entry.fiber!
    expect(fiber).toBeDefined()
    ctx.provide('profileContext', { home: process.env.DSH_HOME! } as never)
    // The persistence boundary delegates validation and hot updates to the real Loader.
    ctx.provide('configEditor', {
      entries: () => [entry],
      configuration: () => [{ entry, inherited: {}, override: structuredClone(entry.options.config) }],
      edit: async (_entry: unknown, change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => unknown) => {
        const next = change(structuredClone(entry.options.config ?? {}), {})
        const validated = fiber.ctx.waterfall(fiber, 'internal/config', next, () => next)
        await entry.update({ config: validated as object })
      },
    } as never)
    await ctx.plugin(SettingsForms)
    await ctx.loader.await()
    const view = () => ctx.settings.describe().find(row => row.ns === 'opencode-go')!
    expect(view().autoGenerate).toBe(false)
    return { ctx, entry, fiber, view, secrets }
  }

  it('exposes one custom form and changes activation, model visibility and capacities without remounting', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const { ctx, entry, fiber, view } = await profile(gateway.url)
    await expect.poll(() => ctx.llm.listProviders()).toContainEqual({ id: 'dsh-opencode-go', name: 'DSH OpenCode Go' })
    expect((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id)).toEqual(['deepseek-v4.1-flash'])
    const before = view()
    await ctx.settings.update('opencode-go', { enabled: false }, before.revision)
    await expect.poll(() => ctx.llm.listProviders()).toEqual([])
    expect(entry.fiber).toBe(fiber)
    await ctx.settings.update('opencode-go', { enabled: true, modelVisibility: { 'deepseek-v4.1-flash': false } })
    await expect.poll(() => ctx.llm.listProviders()).toHaveLength(1)
    expect(await ctx.llm.listModels('dsh-opencode-go')).toEqual([])
    await ctx.settings.update('opencode-go', { modelVisibility: {}, modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 123456, maxTokens: 2048 } } })
    const resolved = await ctx.llm.resolveModelInfo('dsh-opencode-go', 'deepseek-v4.1-flash')
    expect(resolved).toMatchObject({ context: { contextWindow: 123456 }, defaultMaxTokens: 2048 })
    await expect(ctx.settings.update('opencode-go', { proxyURL: 'ftp://bad-proxy' })).rejects.toThrow(/proxy/)
    await expect(ctx.settings.update('opencode-go', { maxImages: 0 })).rejects.toThrow()
    await expect(ctx.settings.update('opencode-go', { enabled: false }, before.revision)).rejects.toMatchObject({ code: 'SETTINGS_CONFLICT' })
    expect(view().value).toMatchObject({ enabled: true, proxyURL: '' })
    expect(entry.fiber).toBe(fiber)
    expect(gateway.modelListings).toBe(1)
  })

  it('persists quota placement and appearance through the live profile without remounting the provider', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const { ctx, entry, fiber, view } = await profile(gateway.url)
    expect(view().value).toMatchObject({ showSidebarQuota: false, usagePillStyle: 'badge' })
    await ctx.settings.update('opencode-go', { showSidebarQuota: true, usagePillStyle: 'plain' }, view().revision)
    expect(view().value).toMatchObject({ showSidebarQuota: true, usagePillStyle: 'plain' })
    expect(entry.options.config).toMatchObject({ showSidebarQuota: true, usagePillStyle: 'plain' })
    expect(entry.fiber).toBe(fiber)
    await expect(ctx.settings.update('opencode-go', { usagePillStyle: 'neon' })).rejects.toThrow()
    await expect(ctx.settings.update('opencode-go', { showSidebarQuota: 'true' })).rejects.toThrow()
    expect(view().value).toMatchObject({ showSidebarQuota: true, usagePillStyle: 'plain' })
    await ctx.settings.update('opencode-go', { showSidebarQuota: false, usagePillStyle: 'badge' })
    expect(view().value).toMatchObject({ showSidebarQuota: false, usagePillStyle: 'badge' })
    expect(entry.fiber).toBe(fiber)
  })

  it('runs account commands through current RPC and forms, keeping secrets outside the configuration document', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const { ctx, entry, fiber, view, secrets } = await profile(gateway.url)
    const command = (command: unknown) => invokeRemote(ctx, { namespace: 'opencodeGoAccounts', method: 'execute', args: { command } })
    expect(await command({ kind: 'add', id: 'a'.repeat(32), name: 'Backup', key: 'backup-fixture-key' })).toBe('applied')
    const ref = 'DSH_OPENCODE_GO_ACCOUNT_' + 'A'.repeat(32)
    expect(secrets.get(ref)).toBe('backup-fixture-key')
    expect(await command({ kind: 'select', ref })).toBe('applied')
    expect(view().value).toMatchObject({ apiKeyEnv: ref, accounts: [expect.objectContaining({ name: 'Backup' }), expect.objectContaining({ apiKeyEnv: 'OPENCODE_API_KEY' })] })
    expect(JSON.stringify([view(), entry.options.config])).not.toContain('backup-fixture-key')
    expect(await command({ kind: 'replace-key', ref, key: 'rotated-fixture-key' })).toBe('applied')
    expect(await command({ kind: 'remove', ref })).toBe('applied')
    expect(secrets.has(ref)).toBe(false)
    expect(view().value).toMatchObject({ apiKeyEnv: 'OPENCODE_API_KEY' })
    expect(entry.fiber).toBe(fiber)
    await expect(command({ kind: 'select', ref: 'invalid reference' })).rejects.toMatchObject({ code: 'gateway/input-invalid' })
  })

  it('keeps a prepared call on its captured gateway and capacities while later calls use the new profile', async () => {
    const first = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const second = await mockGateway({ status: 200, body: listingBody(['deepseek-v4.1-flash']) })
    const { ctx, entry, fiber } = await profile(first.url)
    const adapter = new OpencodeGo.OpencodeGoAdapter({ config: () => OpencodeGo.PlainConfig(ctx.settings.describe()[0]!.value), resolveApiKey: async config => config.apiKeyEnv })
    try {
      await ctx.settings.update('opencode-go', { modelLimits: { 'deepseek-v4.1-flash': { maxTokens: 1024 } } })
      const prepared = await adapter.prepareCall('dsh-opencode-go', 'deepseek-v4.1-flash')
      await ctx.settings.update('opencode-go', { baseURL: second.url, apiKeyEnv: 'SECOND_KEY', modelLimits: { 'deepseek-v4.1-flash': { maxTokens: 2048 } } })
      first.pushCompletions({ events: textEvents }); second.pushCompletions({ events: textEvents })
      const options = { provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', messages: [createUserMessage({ content: [{ type: 'text', text: 'profile snapshot' }], source: { kind: 'plugin', plugin: 'test' } })] }
      for await (const _ of prepared.stream(options)) { /* drain */ }
      for await (const _ of adapter.stream(options)) { /* drain */ }
      const allowance = (body: any) => body.max_tokens ?? body.max_completion_tokens
      expect(allowance(first.bodies[0])).toBe(1024)
      expect(allowance(second.bodies[0])).toBe(2048)
      expect(first.headers.at(-1)?.authorization).toBe('Bearer OPENCODE_API_KEY')
      expect(second.headers.at(-1)?.authorization).toBe('Bearer SECOND_KEY')
      expect(entry.fiber).toBe(fiber)
    } finally { await adapter.dispose() }
  })

  it('declares the current host baseline and retains both published entry exports', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    for (const version of ['0.2.1-rc.4', '0.2.0', '0.1.6']) expect(satisfies(version, pkg.engines.dsh, { includePrerelease: true })).toBe(false)
    for (const version of ['0.2.1-rc.5', '0.2.1', '0.3.0']) expect(satisfies(version, pkg.engines.dsh, { includePrerelease: true })).toBe(true)
    expect(satisfies('4.0.5', pkg.peerDependencies['@deepseek-ai/cordis'])).toBe(true)
    expect(satisfies('4.1.0', pkg.peerDependencies['@deepseek-ai/cordis'])).toBe(true)
    expect(satisfies('4.0.4', pkg.peerDependencies['@deepseek-ai/cordis'])).toBe(false)
    for (const entry of ['.', './client']) {
      expect(pkg.exports[entry]).toMatchObject({ types: expect.stringMatching(/\.d\.ts$/), default: expect.stringMatching(/\.js$/) })
      expect((await readFile(new URL('../' + pkg.exports[entry].default, import.meta.url))).byteLength).toBeGreaterThan(0)
    }
  })
})

describe("independent provider identity and durable continuation", () => {
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

  it.each(['minimax-m3', 'claude-haiku-5-5'])('preserves signed %s thinking across a returned model alias and JSON-restored continuation', async modelId => {
    vi.stubEnv('OPENCODE_API_KEY', 'test-key')
    const gateway = await mockGateway({ status: 200, body: listingBody([modelId, 'union-alpha']) })
    const events = [
      { type: 'message_start', message: { id: 'msg_alias', type: 'message', role: 'assistant', model: `${modelId}-reported-alias`,
        content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'signed thought' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'fixture-signature' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'answer' } },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } },
      { type: 'message_stop' },
    ].map(event => JSON.stringify(event))
    for (let i = 0; i < 3; i++) gateway.pushCompletions({ events, namedEvents: true })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    try {
      apply(ctx, configOf(`${gateway.url}/v1`))
      const request = { provider: route, model: modelId, messages: [user()], reasoningEffort: ReasoningEffortId('high') }
      const chunks = await drain(ctx, request)
      const finish = chunks.find(chunk => chunk.type === 'finish')
      expect(finish).toMatchObject({ reason: { kind: 'stop' }, replayState: { response: {
        model: request.model, responseModel: `${modelId}-reported-alias`, provider: route, sdkProvider: 'opencode-go',
      } } })
      const restored = JSON.parse(JSON.stringify(createMessage({ role: 'assistant',
        content: chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block),
        source: { kind: 'model', provider: route, model: request.model, replayState: finish?.replayState },
      })))
      const messages = [...request.messages, restored, user()]
      await drain(ctx, { ...request, messages })
      const assistant = (gateway.bodies[1] as { messages: { role: string; content: unknown[] }[] }).messages.find(m => m.role === 'assistant')
      expect(assistant?.content).toContainEqual({ type: 'thinking', thinking: 'signed thought', signature: 'fixture-signature' })

      // A real model switch must still strip signatures that belong to the previous model.
      await drain(ctx, { provider: route, model: 'union-alpha', messages })
      expect(JSON.stringify(gateway.bodies[2])).not.toContain('fixture-signature')
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
