/**
 * Settings-backed configuration: the `llm-opencode-go` section overrides the
 * cordis.yml entry field by field, a change reaches the next request without
 * a restart, and a refused write leaves the document untouched.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import { apply } from '../src/index.ts'
import { closeMockGateways, fullLiveListing, listingBody, mockGateway, textEvents } from './mock-gateway.ts'
import { configOf } from './config-of.ts'

import { metadataDocument, modelMetadata, MODELS_METADATA_URL } from './support/model-metadata.ts'

const NS = 'llm-opencode-go'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
  await closeMockGateways()
  vi.unstubAllEnvs()
})

async function home(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-opencode-go-dynamic-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  return dir
}

/** The managed credential document's current layout: a versioned refs map. */
function credentialsYaml(refs: Record<string, string>): string {
  const rows = Object.entries(refs).map(([ref, value]) => `  ${ref}: ${value}`).join('\n')
  return `version: 1\nrefs:\n${rows}\n`
}

interface BootOptions {
  settingsYaml: string
  credentials: Record<string, string>
  baseURL: string
}

/** The plugin as a mountable cordis definition: `apply`'s named exports do not ride the function value. */
function asPlugin(config?: unknown): { name: string; inject: string[]; apply: (ctx: Context) => void } {
  return {
    name: 'llm-opencode-go-test',
    inject: ['llm'],
    apply: (ctx: Context) => {
      apply(ctx, config as never)
    },
  }
}

/** A whole composition: runtime, settings document, credential store, plugin. */
async function boot(options: BootOptions): Promise<Context> {
  const dir = await home()
  await writeFile(join(dir, 'settings.yaml'), options.settingsYaml)
  await writeFile(join(dir, '.credentials.yaml'), credentialsYaml(options.credentials), { mode: 0o600 })
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(FileSettingsProvider, { path: join(dir, 'settings.yaml'), watch: false })
  await ctx.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
  await ctx.plugin(asPlugin({ baseURL: options.baseURL }))
  return ctx
}

async function streamOnce(ctx: Context): Promise<void> {
  // Seam-backed registration settles asynchronously once the credential
  // provider answers; a request before that would race the route's arrival.
  await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 })
    .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })
  for await (const _chunk of ctx.llm.stream({
    provider: 'opencode-go',
    model: 'deepseek-v4.1-flash',
    messages: [],
  })) { /* drain */ }
}

describe('settings-backed configuration', () => {
  it('serves the cordis entry until the settings section supplies overrides', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'env-key')
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const ctx = await boot({ settingsYaml: '', credentials: {}, baseURL: gateway.url })

    await streamOnce(ctx)

    expect(gateway.paths).toEqual(['/models', '/chat/completions'])
    expect(gateway.headers[1]?.authorization).toBe('Bearer env-key')
  })

  it('reaches the next request with a new endpoint and key without a restart', async () => {
    vi.stubEnv('OPENCODE_API_KEY', 'env-key')
    const first = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const second = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    first.pushCompletions({ events: textEvents })
    second.pushCompletions({ events: textEvents })
    const dir = await home()
    const settingsPath = join(dir, 'settings.yaml')
    await writeFile(settingsPath, '')
    await writeFile(join(dir, '.credentials.yaml'), credentialsYaml({ CUSTOM_OPENCODE_REF: 'stored-key' }), { mode: 0o600 })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(FileSettingsProvider, { path: settingsPath, watch: false })
    await ctx.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
    await ctx.plugin(asPlugin({ baseURL: first.url }))

    await streamOnce(ctx)
    expect(first.paths).toHaveLength(2)
    expect(first.headers[1]?.authorization).toBe('Bearer env-key')

    await ctx.settings.update(NS, { baseURL: second.url, apiKeyEnv: 'CUSTOM_OPENCODE_REF' })

    await streamOnce(ctx)

    expect(second.paths).toEqual(['/models', '/chat/completions'])
    expect(second.headers[1]?.authorization).toBe('Bearer stored-key')
  })

  it('rebuilds the catalog when the refresh interval changes', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    gateway.pushCompletions({ events: textEvents })
    const ctx = await boot({
      settingsYaml: '',
      credentials: { OPENCODE_API_KEY: 'test-key' },
      baseURL: gateway.url,
    })

    await streamOnce(ctx)
    await ctx.settings.update(NS, { refreshMinutes: 30 })
    await streamOnce(ctx)

    // Two catalog fetches on two different catalog generations (the change
    // rebuilt the resolver), never a stale snapshot served twice.
    expect(gateway.paths.filter(path => path === '/models')).toHaveLength(2)
    expect(gateway.paths.filter(path => path === '/chat/completions')).toHaveLength(2)
  })

  it('applies and removes per-model capacities without a restart', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    const ctx = await boot({
      settingsYaml: '',
      credentials: { OPENCODE_API_KEY: 'test-key' },
      baseURL: gateway.url,
    })
    await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 })
      .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })

    const advertised = (await ctx.llm.resolveModelInfo('opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow
    expect(advertised).toBeGreaterThan(0)

    await ctx.settings.update(NS, {
      modelLimits: { 'deepseek-v4.1-flash': { contextWindow: 123_456, maxTokens: 5_432 } },
    })
    expect((await ctx.llm.resolveModelInfo('opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow)
      .toBe(123_456)

    // `update` is merge-only, so use the documented replace path to remove the
    // user-layer field and let the catalog value re-inherit.
    await ctx.settings.replace(NS, {})
    expect((await ctx.llm.resolveModelInfo('opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow)
      .toBe(advertised)
  })

  it('drops the route when the credential goes away, and revives it on return', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const ctx = await boot({
      settingsYaml: '',
      credentials: { OPENCODE_API_KEY: 'test-key' },
      baseURL: gateway.url,
    })
    await streamOnce(ctx)
    expect(gateway.paths.filter(path => path === '/chat/completions')).toHaveLength(1)

    // An event naming another reference leaves the route alone; removing the
    // key emits the reference event and the route drops, with no request
    // reaching the gateway while it is gone.
    await ctx.credentials.set(credentialRef('UNRELATED_REF'), 'other')
    await ctx.credentials.unset(credentialRef('OPENCODE_API_KEY'))
    await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 }).toEqual([])
    expect(gateway.paths.filter(path => path === '/chat/completions')).toHaveLength(1)

    // Storing it again brings the route back without a restart.
    await ctx.credentials.set(credentialRef('OPENCODE_API_KEY'), 'test-key')
    await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 })
      .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })
    await streamOnce(ctx)
    expect(gateway.paths.filter(path => path === '/chat/completions')).toHaveLength(2)
  })

  it('keeps the route unregistered when the credential describe fails', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.provide('credentials', {
      describe: () => Promise.reject(new Error('describe exploded')),
      resolve: () => Promise.resolve({ value: 'k', source: 'test' }),
    } as never)
    apply(ctx, configOf('https://opencode.ai/zen/go/v1'))

    // The refusal is logged and the route simply stays unregistered.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(ctx.llm.listProviders()).toEqual([])
  })

  it('fails the in-flight request loudly when the key vanishes underneath the route', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    // Describe still sees a configured reference (the route stays registered),
    // but resolution finds nothing — the race a removed shadowing source leaves.
    ctx.provide('credentials', {
      describe: () => Promise.resolve({ configured: true, writable: true }),
      resolve: () => Promise.resolve(undefined),
    } as never)
    apply(ctx, configOf(gateway.url))
    await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 })
      .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })

    const chunks: Array<{ type: string; reason?: unknown }> = []
    for await (const chunk of ctx.llm.stream({
      provider: 'opencode-go',
      model: 'deepseek-v4.1-flash',
      messages: [],
    })) chunks.push(chunk)

    expect(chunks.find(chunk => chunk.type === 'finish')).toMatchObject({
      reason: { kind: 'error', failure: { code: 'MISSING_CREDENTIAL' } },
    })
    // The catalog fetch precedes credential resolution; no request goes out.
    expect(gateway.paths).toEqual(['/models'])
  })

  it('updates legacy session pickers when deprecated model visibility changes', async () => {
    const original = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => String(input) === MODELS_METADATA_URL
      ? Promise.resolve(Response.json(metadataDocument({ old: modelMetadata({ status: 'deprecated' }) })))
      : original(input, init))
    const gateway = await mockGateway({ status: 200, body: listingBody(['old']) })
    const ctx = await boot({ settingsYaml: '', credentials: { OPENCODE_API_KEY: 'test-key' }, baseURL: gateway.url })
    await expect.poll(() => ctx.llm.listProviders()).toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })
    expect(await ctx.llm.listModels('opencode-go')).toEqual([])
    const notify = vi.fn()
    ctx.on('llm/adapters-updated', notify)
    await ctx.settings.update(NS, { showDeprecatedModels: true })
    expect(notify).toHaveBeenCalled()
    expect((await ctx.llm.listModels('opencode-go')).map(m => m.id)).toEqual(['old'])
    await ctx.settings.update(NS, { showDeprecatedModels: false })
    expect(await ctx.llm.listModels('opencode-go')).toEqual([])
  })

  it('withdraws the route and its models the moment the switch goes off, and serves again on', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    gateway.pushCompletions({ events: textEvents })
    const ctx = await boot({
      settingsYaml: '',
      credentials: { OPENCODE_API_KEY: 'test-key' },
      baseURL: gateway.url,
    })
    await streamOnce(ctx)
    expect((await ctx.llm.listModels('opencode-go')).map(model => model.id)).toContain('deepseek-v4.1-flash')

    // The key stays configured throughout: only the switch decides.
    await ctx.settings.update(NS, { enabled: false })

    // Gone from the picker's source, not merely filtered at request time, and
    // nothing further reaches the gateway while it is off.
    await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 }).toEqual([])
    // The route itself is gone, so even a direct catalog read cannot find it.
    await expect(ctx.llm.listModels('opencode-go')).rejects.toThrow()
    expect(gateway.paths.filter(path => path === '/chat/completions')).toHaveLength(1)

    // The page that owns the switch keeps working while the route is gone.
    expect(ctx.settings.describe().find(view => view.ns === NS)?.value)
      .toMatchObject({ enabled: false })

    await ctx.settings.update(NS, { enabled: true })
    await expect.poll(() => ctx.llm.listProviders(), { timeout: 10_000 })
      .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })
    await streamOnce(ctx)
    expect(gateway.paths.filter(path => path === '/chat/completions')).toHaveLength(2)
  })

  it('refuses a write whose baseURL is not usable, leaving the document untouched', async () => {
    const gateway = await mockGateway({ status: 200, body: listingBody(fullLiveListing()) })
    gateway.pushCompletions({ events: textEvents })
    const dir = await home()
    const settingsPath = join(dir, 'settings.yaml')
    await writeFile(settingsPath, '')
    await writeFile(join(dir, '.credentials.yaml'), credentialsYaml({ OPENCODE_API_KEY: 'test-key' }), { mode: 0o600 })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(FileSettingsProvider, { path: settingsPath, watch: false })
    await ctx.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
    await ctx.plugin(asPlugin({ baseURL: gateway.url }))

    await expect(ctx.settings.update(NS, { baseURL: 'not-a-url' })).rejects.toThrow(/not a valid URL/)

    expect(await readFile(settingsPath, 'utf8')).toBe('')
    await streamOnce(ctx)
    expect(gateway.paths).toEqual(['/models', '/chat/completions'])
  })
})
