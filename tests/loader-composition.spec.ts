/**
 * The plugin through a real Loader composition. A hand-built `ctx.plugin(...)`
 * mount never proves that a deployment's `cordis.yml` row resolves: the Loader
 * reads `name`, `inject`, `Config`, and `apply` off the imported module, applies
 * the schema, and only mounts the row when every entry loads. This case boots
 * the shipped LLM runtime and this adapter from a test-only `cordis.yml`, then
 * asserts the user-visible result — the route appears and its stream carries
 * the gateway's routing header.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { LocalCredentialProvider } from '@deepseek-ai/dsh-credentials-local'
import LlmRuntime, { createUserMessage, userAgent } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import * as OpencodeGo from '../src/index.ts'
import { closeMockGateways, fullLiveListing, listingBody, mockGateway, textEvents } from './mock-gateway.ts'

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

/** Boot the given composition rows through the Loader and require every row to mount. */
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
      '    provider: opencode-go',
      '    legacyEnabled: true',
      '    legacyLimit: 42',
      '    legacyOption: null',
      '    legacyModels: []',
      '    legacySettings: { get: false }',
    ])

    await expect.poll(() => ctx.llm.listProviders())
      .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })
    expect((await ctx.llm.resolveModelInfo('opencode-go', 'deepseek-v4.1-flash')).context?.contextWindow)
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
      .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })
    // The supplemented model reaches the picker through the loaded row.
    await expect(ctx.llm.listModels('opencode-go')).resolves.toContainEqual(
      expect.objectContaining({ id: 'deepseek-v4.1-flash' }),
    )

    const chunks: StreamChunk[] = []
    for await (const chunk of ctx.llm.stream({
      provider: 'opencode-go',
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
      .toContainEqual({ id: 'opencode-go', name: 'OpenCode Go' })
  })
})
