import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import { afterEach, expect, it } from 'vitest'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'

afterEach(closeMockGateways)

function prompt(session: Session, text: string): void {
  session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 'test' } }), { surfaceOp: 'append' })
}

async function generate(adapter: OpencodeGoAdapter, session: Session): Promise<StreamChunk[]> {
  const chunks = []
  for await (const chunk of adapter.stream({ provider: 'opencode-go', model: 'deepseek-v4.1-flash',
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
