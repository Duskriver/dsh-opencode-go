import { afterEach, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Registry from '@deepseek-ai/dsh-typert-registry'
import Gateway, { type InvokeRemoteRequest } from '@deepseek-ai/dsh-api-gateway'
import type { PeerScope } from '@deepseek-ai/dsh-typert-protocol'
import { createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { PlainConfig, validateGoConfig, type OpencodeGoConfig } from '../../src/config.ts'
import { GoAccountManager, type AccountSettingsWriter } from '../../src/accounts.ts'
import { registerGoRemotes } from '../../src/index.ts'
import { PROVIDER_ID } from '../../src/contracts.ts'

const contexts = new Set<Context>()
const owners = new WeakMap<Context, PeerScope>()
afterEach(async () => {
  for (const ctx of [...contexts].reverse()) await ctx.fiber.dispose()
  contexts.clear()
})

export function context(): Context {
  const ctx = new Context()
  contexts.add(ctx)
  return ctx
}

export function configOf(baseURL: string, overrides: Partial<OpencodeGoConfig> = {}): OpencodeGoConfig {
  return PlainConfig({ baseURL, streamIdleTimeoutMs: 5000, ...overrides })
}

export function requestOf(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    provider: PROVIDER_ID, model: 'deepseek-v4.1-flash',
    messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'test' } })],
    ...overrides,
  }
}

export async function drain(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const result: StreamChunk[] = []
  for await (const chunk of stream) result.push(chunk)
  return result
}

/** Real registry/gateway, with an explicit local-owner Peer and no network carrier. */
export async function mountRemotes(ctx: Context, register = true): Promise<void> {
  ctx.provide('remoteAccess', { decide: () => ({ kind: 'deny', reason: 'test-owner-only' }) } as never)
  await ctx.plugin(Registry)
  await ctx.plugin(Gateway)
  if (register) registerGoRemotes(ctx)
  owners.set(ctx, {
    id: 'test-owner' as PeerScope['id'], ctx, principal: { kind: 'owner' },
    signal: new AbortController().signal, interactions: 'none', dispose: () => ctx.fiber.dispose(),
  })
  if (!ctx.get('typertGateway')) throw new Error('The current Host gateway did not activate')
}

export function invokeRemote(ctx: Context, request: Omit<InvokeRemoteRequest, 'peer'>): Promise<unknown> {
  const peer = owners.get(ctx)
  if (!peer) throw new Error('mountRemotes must precede an invocation')
  return ctx.typertGateway.invoke({ ...request, peer })
}

/** Credential storage and one revision-guarded profile document; no recovery journal. */
export function accountHarness(initial: Partial<OpencodeGoConfig> = { accounts: [] }) {
  let config = PlainConfig(initial), revision = 0
  const secrets = new Map<string, string>()
  const writable = new Map<string, boolean>()
  const warn = vi.fn()
  const settings = {
    describe: () => [{ ns: 'opencode-go', revision, value: structuredClone(config) }],
    mutate: vi.fn(async (ns: string, ops: Parameters<AccountSettingsWriter['mutate']>[1], expected?: number) => {
      if (ns !== 'opencode-go' || expected !== revision) throw new Error('SETTINGS_CONFLICT')
      const next = { ...config, ...Object.fromEntries(ops.map(op => [op.path[0], structuredClone(op.value)])) }
      validateGoConfig(next)
      config = next
      revision++
      manager.settingsChanged()
    }),
  }
  const credentials = {
    describe: vi.fn(async (ref: string) => ({ ref, configured: secrets.has(ref), writable: writable.get(ref) !== false })),
    resolve: vi.fn(async (ref: string) => secrets.has(ref) ? { ref, value: secrets.get(ref)!, source: 'test' } : undefined),
    set: vi.fn(async (ref: string, key: string) => { secrets.set(ref, key) }),
    unset: vi.fn(async (ref: string) => { secrets.delete(ref) }),
  }
  const manager = new GoAccountManager(() => config, { warn })
  const disconnect = manager.connect(settings, credentials)
  return {
    manager, settings, credentials, secrets, writable, warn, disconnect,
    value: () => structuredClone(config), revision: () => revision,
    externalEdit: (patch: Partial<OpencodeGoConfig>) => { config = { ...config, ...structuredClone(patch) }; revision++; manager.settingsChanged() },
  }
}
