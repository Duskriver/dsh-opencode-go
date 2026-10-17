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
