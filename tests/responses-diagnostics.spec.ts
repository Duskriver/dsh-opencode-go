import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { ResponsesDiagnostics } from '../src/responses-diagnostics.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway } from './mock-gateway.ts'

const model = 'deepseek-v4.1-flash'
const override = { [model]: 'openai-responses' as const }
const rawText = 'PRIVATE_ORIGINAL_REASONING_SENTINEL'
const summaryText = 'PRIVATE_REASONING_SUMMARY_SENTINEL'
const encrypted = 'PRIVATE_ENCRYPTED_REASONING_SENTINEL'
const tool = { name: 'private_tool_name', description: 'Private tool description', parameters: { type: 'object', properties: {} } }
const request = (extra: Partial<GenerateOptions> = {}): GenerateOptions => ({
  provider: 'dsh-opencode-go', model, sessionId: 'private-session-id' as never,
  messages: [createUserMessage({ content: [{ type: 'text', text: 'PRIVATE_USER_PROMPT_SENTINEL' }], source: { kind: 'plugin', plugin: 'test' } })],
  tools: [tool], ...extra,
})
const fingerprint = (text: string) => ({ bytes: text.length * 2, sha256: createHash('sha256').update(text, 'utf16le').digest('hex') })
const summaryItem = () => ({ id: 'rs_private_reasoning_id', type: 'reasoning', summary: [{ type: 'summary_text', text: summaryText }] })
const fullItem = () => ({ ...summaryItem(), content: [{ type: 'reasoning_text', text: rawText }], encrypted_content: encrypted })

type Shape = 'normal-full' | 'summary-only' | 'full-only-in-completed' | 'reasoning-only-in-completed' | 'raw-delta-summary-done'

/** Real wire events, including terminal-only data that the SDK currently drops. */
function toolEvents(shape: Shape): string[] {
  const done = shape === 'normal-full' ? fullItem() : summaryItem()
  const completed = shape === 'summary-only' || shape === 'raw-delta-summary-done' ? summaryItem() : fullItem()
  // Keep this case focused on plaintext loss rather than the existing ciphertext backfill.
  if (shape !== 'normal-full') delete (completed as { encrypted_content?: string }).encrypted_content
  const call = { id: 'fc_private_call_item', type: 'function_call', call_id: 'call_private_call_id', name: tool.name,
    arguments: JSON.stringify({ secret: 'PRIVATE_TOOL_ARGUMENT_SENTINEL' }), status: 'completed' }
  return [
    { type: 'response.created', response: { id: 'resp_private_response_id' } },
    ...shape === 'reasoning-only-in-completed' ? [] : [
      { type: 'response.output_item.added', output_index: 0, item: { ...summaryItem(), summary: [] } },
      ...shape === 'raw-delta-summary-done' ? [
        { type: 'response.reasoning_text.delta', output_index: 0, content_index: 0, delta: rawText.slice(0, 10) },
        { type: 'response.reasoning_text.delta', output_index: 0, content_index: 0, delta: rawText.slice(10) },
      ] : [],
      { type: 'response.output_item.done', output_index: 0, item: done },
    ],
    { type: 'response.output_item.added', output_index: 1, item: { ...call, arguments: '' } },
    { type: 'response.function_call_arguments.delta', output_index: 1, delta: call.arguments },
    { type: 'response.output_item.done', output_index: 1, item: call },
    { type: 'response.completed', response: { id: 'resp_private_response_id', status: 'completed', output: [completed, call] } },
  ].map(event => JSON.stringify(event))
}

function textEvents(): string[] {
  const item = { id: 'msg_final', type: 'message', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: 'PRIVATE_ASSISTANT_ANSWER_SENTINEL', annotations: [] }] }
  return [
    { type: 'response.created', response: { id: 'resp_final' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, content: [] } },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'PRIVATE_ASSISTANT_ANSWER_SENTINEL' },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id: 'resp_final', status: 'completed', output: [item] } },
  ].map(event => JSON.stringify(event))
}

async function drain(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

function restoredTurn(chunks: StreamChunk[]): GenerateOptions['messages'] {
  const finish = chunks.find(chunk => chunk.type === 'finish')!
  expect(finish.reason.kind).toBe('tool-calls')
  const blocks = chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block)
  const call = blocks.find(block => block.type === 'tool-call')!
  return [JSON.parse(JSON.stringify({ id: 'assistant-saved-turn', role: 'assistant', content: blocks,
    source: { kind: 'model', provider: 'dsh-opencode-go', model, replayState: finish.replayState } })),
  createUserMessage({ content: [{ type: 'tool-result', toolCallId: call.id,
    content: [{ type: 'text', text: 'PRIVATE_TOOL_RESULT_SENTINEL' }] }], source: { kind: 'plugin', plugin: 'test' } })]
}

async function reports(directory: string): Promise<{ text: string; record: Record<string, any> }[]> {
  const files = (await readdir(directory)).filter(file => file.startsWith('responses-replay-'))
  return Promise.all(files.map(async file => {
    const text = await readFile(join(directory, file), 'utf8')
    return { text, record: JSON.parse(text) }
  }))
}

beforeEach(() => { vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', '') })
afterEach(closeMockGateways)

describe('Responses reasoning diagnostics', () => {
  it.each<Shape>(['normal-full', 'summary-only', 'full-only-in-completed', 'reasoning-only-in-completed', 'raw-delta-summary-done'])(
    'observes %s across provider events, adapter finish and next request without repairing history', async shape => {
      const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
      vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', directory)
      const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
      const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override }), resolveApiKey: async () => 'fixture-secret-key' })
      try {
        gateway.pushCompletions({ events: toolEvents(shape), headers: { 'x-request-id': 'first-request' } })
        const initial = request()
        const restored = restoredTurn(await drain(adapter.stream(initial)))
        const saved = JSON.stringify(restored)
        gateway.pushCompletions({ events: textEvents(), headers: { 'x-request-id': 'second-request' } })
        expect((await drain(adapter.stream({ ...initial, messages: [...initial.messages, ...restored] }))).at(-1))
          .toMatchObject({ reason: { kind: 'stop' } })
        const captured = await reports(directory)
        expect(captured).toHaveLength(2)
        const first = captured.find(({ record }) => record.http?.requestId === 'first-request')!.record
        const second = captured.find(({ record }) => record.http?.requestId === 'second-request')!.record
        expect(first).toMatchObject({ version: 1, model, attempt: 1, fingerprintEncoding: 'utf16le', http: { status: 200 },
          termination: 'completed', outcome: 'tool-calls', terminalEventReceived: true, finishReceived: true,
          truncated: false, inspectionFailed: false })
        expect(second).toMatchObject({ termination: 'completed', outcome: 'stop', terminalEventReceived: true, finishReceived: true })
        expect(first.callId).toEqual(expect.any(String))
        expect(second.callId).not.toBe(first.callId)
        expect(second.sessionHash).toBe(first.sessionHash)
        expect(first.sessionHash).toMatch(/^[a-f0-9]+$/)
        const wireReasoning = first.parsedProviderEvents.find((entry: any) => entry.event === 'response.completed.output' && entry.item?.type === 'reasoning').item
        expect(wireReasoning.summary.parts).toEqual([fingerprint(summaryText)])
        const terminalHasRaw = shape !== 'summary-only' && shape !== 'raw-delta-summary-done'
        expect(wireReasoning.content.present).toBe(terminalHasRaw)
        if (terminalHasRaw) expect(wireReasoning.content.parts).toEqual([fingerprint(rawText)])
        const finished = first.adapterFinishReplay.find((entry: any) => entry.item?.type === 'reasoning')
        const source = second.nextRequestContext.find((entry: any) => entry.item?.type === 'reasoning')
        const outbound = second.sdkPayload.find((entry: any) => entry.type === 'reasoning')
        const sent = (gateway.bodies[1] as Record<string, any>).input.filter((entry: any) => entry.type === 'reasoning')
        if (shape === 'reasoning-only-in-completed') {
          expect(finished).toBeUndefined()
          expect(source).toBeUndefined()
          expect(outbound).toBeUndefined()
          expect(sent).toEqual([])
        } else {
          const keptRaw = shape === 'normal-full'
          for (const item of [finished.item, source.item, outbound]) {
            expect(item.idHash).toBe(wireReasoning.idHash)
            expect(item.content.present).toBe(keptRaw)
            expect(item.content.parts).toEqual(keptRaw ? [fingerprint(rawText)] : [])
          }
          expect(sent).toEqual([keptRaw ? fullItem() : summaryItem()])
          if (keptRaw) expect(finished.item.encryptedContent).toEqual(fingerprint(encrypted))
        }
        if (shape === 'raw-delta-summary-done') {
          expect(JSON.stringify(first.reasoningDeltas)).toContain(fingerprint(rawText).sha256)
        }
        for (const body of gateway.bodies as Record<string, any>[]) expect(body.reasoning).toBeUndefined()
        expect(JSON.stringify(restored)).toBe(saved)
        for (const { text } of captured) for (const secret of [rawText, summaryText, encrypted, 'fixture-secret-key',
          'PRIVATE_USER_PROMPT_SENTINEL', 'PRIVATE_TOOL_ARGUMENT_SENTINEL', 'PRIVATE_TOOL_RESULT_SENTINEL',
          'PRIVATE_ASSISTANT_ANSWER_SENTINEL', 'private-session-id', 'rs_private_reasoning_id', 'call_private_call_id', tool.name]) {
          expect(text).not.toContain(secret)
        }
      } finally { await adapter.dispose() }
    },
  )

  it('captures a rejected continuation and correlates it with the successful response without altering explicit effort', async () => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override }),
      resolveApiKey: async () => 'fixture-secret-key', debugDirectory: () => directory })
    try {
      gateway.pushCompletions({ events: toolEvents('summary-only'), headers: { 'x-request-id': 'success-id' } })
      const initial = request({ reasoningEffort: ReasoningEffortId('high') })
      const restored = restoredTurn(await drain(adapter.stream(initial)))
      gateway.pushCompletions({ status: 400, body: JSON.stringify({ error: { message: 'reasoning text required' } }),
        headers: { 'x-request-id': 'rejected-fixture-secret-key' } })
      expect((await drain(adapter.stream({ ...initial, messages: [...initial.messages, ...restored] }))).at(-1))
        .toMatchObject({ reason: { kind: 'error', failure: { code: 'INVALID_REQUEST' } } })
      const captured = await reports(directory)
      expect(captured).toHaveLength(2)
      const rejected = captured.find(({ record }) => record.http?.status === 400)!.record
      const successful = captured.find(({ record }) => record.http?.status === 200)!.record
      expect(rejected.http.requestId).toBe('rejected-[REDACTED]')
      expect(rejected.sessionHash).toBe(successful.sessionHash)
      expect(rejected.outcome).toBe('error')
      expect(rejected.sdkPayload.find((item: any) => item.type === 'reasoning')).toMatchObject({ content: { present: false } })
      for (const body of gateway.bodies as Record<string, any>[]) expect(body.reasoning).toMatchObject({ effort: 'high' })
      expect((gateway.bodies[1] as Record<string, any>).input.filter((item: any) => item.type === 'reasoning')).toEqual([summaryItem()])
      expect(captured.map(({ text }) => text).join('')).not.toContain('fixture-secret-key')
    } finally { await adapter.dispose() }
  })

  it('keeps tracing disabled without an opt-in directory and leaves the serialized request identical', async () => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    await mkdir(directory)
    let enabled = false
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override }),
      resolveApiKey: async () => 'fixture-secret-key', debugDirectory: () => enabled ? directory : undefined })
    try {
      gateway.pushCompletions({ events: toolEvents('summary-only') })
      const initial = request()
      const restored = restoredTurn(await drain(adapter.stream(initial)))
      gateway.pushCompletions({ events: textEvents() })
      const continued = { ...initial, messages: [...initial.messages, ...restored] }
      await drain(adapter.stream(continued))
      expect(await readdir(directory)).toEqual([])
      enabled = true
      gateway.pushCompletions({ events: textEvents() })
      await drain(adapter.stream(continued))
      expect(await reports(directory)).toHaveLength(1)
      expect(gateway.bodies[2]).toEqual(gateway.bodies[1])
    } finally { await adapter.dispose() }
  })

  it('does not fail successful inference when the diagnostic path is not writable', async () => {
    const directory = join(process.env.DSH_HOME!, 'not-a-directory')
    await writeFile(directory, '')
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override }),
      resolveApiKey: async () => 'fixture-secret-key', debugDirectory: () => directory })
    try {
      gateway.pushCompletions({ events: textEvents() })
      expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
    } finally { await adapter.dispose() }
  })

  it.each(['consumer-stopped', 'caller-aborted'] as const)('records %s during a genuine unterminated Responses stream', async termination => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    gateway.pushCompletions({ hangOpen: true, events: [
      { type: 'response.created', response: { id: 'resp_unfinished' } },
      { type: 'response.output_item.added', output_index: 0, item: { ...summaryItem(), summary: [] } },
      { type: 'response.reasoning_text.delta', output_index: 0, content_index: 0, delta: rawText },
    ].map(event => JSON.stringify(event)) })
    const controller = new AbortController()
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override }),
      resolveApiKey: async () => 'fixture-secret-key', debugDirectory: () => directory })
    const chunks: StreamChunk[] = []
    try {
      for await (const chunk of adapter.stream(request({ signal: controller.signal }))) {
        chunks.push(chunk)
        if (chunk.type === 'reasoning-delta') {
          if (termination === 'consumer-stopped') break
          controller.abort('PRIVATE_ABORT_REASON')
        }
      }
      expect(chunks).toContainEqual(expect.objectContaining({ type: 'reasoning-delta', text: rawText }))
      const [{ record, text }] = await reports(directory)
      expect(record.termination).toBe(termination)
      expect(record.terminalEventReceived).not.toBe(true)
      expect(record.adapterFinishReplay).toEqual([])
      expect(record.reasoningDeltas).toContainEqual({ kind: 'reasoning_text', outputIndex: 0, partIndex: 0, ...fingerprint(rawText) })
      if (termination === 'caller-aborted') {
        expect(chunks.at(-1)).toMatchObject({ reason: { kind: 'aborted', failure: { code: 'ABORTED' } } })
        expect(record.outcome).toBe('aborted')
      } else {
        expect(chunks.some(chunk => chunk.type === 'finish')).toBe(false)
        expect(record.finishReceived).not.toBe(true)
      }
      expect(text).not.toContain(rawText)
      expect(text).not.toContain('PRIVATE_ABORT_REASON')
      expect((await readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false)
    } finally { await adapter.dispose(); await gateway.close() }
  })

  it('distinguishes a provider terminal failure from interrupted collection without logging the error text', async () => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
    gateway.pushCompletions({ events: [
      { type: 'response.created', response: { id: 'resp_failed' } },
      { type: 'response.failed', response: { id: 'resp_failed', status: 'failed', output: [],
        error: { code: 'server_error', message: 'PRIVATE_PROVIDER_FAILURE_MESSAGE' } } },
    ].map(event => JSON.stringify(event)) })
    const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url, { protocolOverrides: override }),
      resolveApiKey: async () => 'fixture-secret-key', debugDirectory: () => directory })
    try {
      expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error' } })
      const [{ record, text }] = await reports(directory)
      expect(record).toMatchObject({ termination: 'completed', outcome: 'error', terminalEventReceived: true, finishReceived: true })
      expect(record.parsedProviderEvents).toContainEqual(expect.objectContaining({ event: 'response.failed' }))
      expect(text).not.toContain('PRIVATE_PROVIDER_FAILURE_MESSAGE')
    } finally { await adapter.dispose() }
  })

  it('compares split Unicode reasoning deltas with complete parts while keeping summary streams separate', async () => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    const diagnostic = new ResponsesDiagnostics({ directory, callId: 'unicode-test', attempt: 1,
      model: { id: model, api: 'openai-responses', provider: 'opencode-go' } as never, sessionId: 'private-session-id' })
    const text = 'A😀B'
    diagnostic.providerEvent({ type: 'response.reasoning_text.delta', output_index: 3, content_index: 0, delta: text.slice(0, 2) })
    diagnostic.providerEvent({ type: 'response.reasoning_summary_text.delta', output_index: 3, summary_index: 0, delta: summaryText })
    diagnostic.providerEvent({ type: 'response.reasoning_text.delta', output_index: 3, content_index: 1, delta: 'second part' })
    diagnostic.providerEvent({ type: 'response.reasoning_text.delta', output_index: 3, content_index: 0, delta: text.slice(2) })
    const event = { type: 'response.output_item.done', output_index: 3, item: { ...summaryItem(),
      content: [{ type: 'reasoning_text', text }, { type: 'reasoning_text', text: 'second part' }] } }
    const saved = JSON.stringify(event)
    diagnostic.providerEvent(event)
    await diagnostic.save()
    const [{ record, text: report }] = await reports(directory)
    expect(record.reasoningDeltas).toEqual(expect.arrayContaining([
      { kind: 'reasoning_text', outputIndex: 3, partIndex: 0, ...fingerprint(text) },
      { kind: 'reasoning_text', outputIndex: 3, partIndex: 1, ...fingerprint('second part') },
      { kind: 'summary_text', outputIndex: 3, partIndex: 0, ...fingerprint(summaryText) },
    ]))
    expect(record.parsedProviderEvents[0].item.content.parts).toEqual([fingerprint(text), fingerprint('second part')])
    expect(JSON.stringify(event)).toBe(saved)
    for (const secret of [text, 'second part', summaryText]) expect(report).not.toContain(secret)
  })

  it('records full-text done events and reasoning parts even without deltas or a complete reasoning item', async () => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    const diagnostic = new ResponsesDiagnostics({ directory, callId: 'done-events-test', attempt: 1,
      model: { id: model, api: 'openai-responses', provider: 'opencode-go' } as never, sessionId: 'private-session-id' })
    const common = { output_index: 2, item_id: 'rs_private_reasoning_id', content_index: 0, summary_index: 0 }
    diagnostic.providerEvent({ ...common, type: 'response.reasoning_text.done', text: rawText })
    diagnostic.providerEvent({ ...common, type: 'response.reasoning_summary_text.done', text: summaryText })
    diagnostic.providerEvent({ ...common, type: 'response.content_part.done', part: { type: 'reasoning_text', text: rawText } })
    diagnostic.providerEvent({ ...common, type: 'response.reasoning_summary_part.done', part: { type: 'summary_text', text: summaryText } })
    diagnostic.providerEvent({ ...common, type: 'response.content_part.done', part: { type: 'output_text', text: 'PRIVATE_ASSISTANT_ANSWER_SENTINEL' } })
    await diagnostic.save()
    const [{ record, text }] = await reports(directory)
    expect(record.reasoningDeltas).toEqual([])
    expect(record.parsedProviderEvents).toHaveLength(4)
    for (const [event, content] of [
      ['response.reasoning_text.done', rawText], ['response.reasoning_summary_text.done', summaryText],
      ['response.content_part.done', rawText], ['response.reasoning_summary_part.done', summaryText],
    ]) {
      expect(record.parsedProviderEvents).toContainEqual(expect.objectContaining({ event, outputIndex: 2,
        partIndex: 0, itemIdHash: fingerprint('rs_private_reasoning_id').sha256, text: fingerprint(content!) }))
    }
    for (const secret of [rawText, summaryText, 'rs_private_reasoning_id', 'PRIVATE_ASSISTANT_ANSWER_SENTINEL']) expect(text).not.toContain(secret)
  })

  it('bounds long histories, terminal output and delta streams, and marks incomplete inspection', async () => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    const diagnostic = new ResponsesDiagnostics({ directory, callId: 'bounds-test', attempt: 1,
      model: { id: model, api: 'openai-responses', provider: 'opencode-go' } as never, sessionId: 'private-session-id' })
    const input = Array.from({ length: 1100 }, (_, index) => ({ id: `rs_${index}`, type: 'reasoning', summary: [],
      content: Array.from({ length: 10 }, (_, part) => ({ type: 'reasoning_text', text: `PRIVATE_PART_${index}_${part}` })) }))
    diagnostic.payload({ input, store: false })
    diagnostic.providerEvent({ type: 'response.completed', response: { id: 'large-response', output: input } })
    for (let index = 0; index < 270; index++) {
      diagnostic.providerEvent({ type: 'response.reasoning_text.delta', output_index: index, content_index: 0, delta: 'PRIVATE_DELTA' })
    }
    // A diagnostic read failure is recorded without changing control flow.
    expect(() => diagnostic.payload(Object.defineProperty({}, 'input', { get() { throw new Error('unreadable') } }))).not.toThrow()
    await diagnostic.save()
    const [{ record, text }] = await reports(directory)
    expect(record.truncated).toBe(true)
    expect(record.inspectionFailed).toBe(true)
    expect(record.terminalEventReceived).toBe(true)
    expect(record.sdkPayload.length).toBeLessThanOrEqual(1024)
    expect(record.parsedProviderEvents.length).toBeLessThanOrEqual(1024)
    expect(record.reasoningDeltas).toHaveLength(256)
    expect(record.sdkPayload.at(-1)).toMatchObject({ index: 1099, idHash: fingerprint('rs_1099').sha256,
      content: { count: 10, parts: Array.from({ length: 8 }, (_, part) => fingerprint(`PRIVATE_PART_1099_${part + 2}`)) } })
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(text).not.toContain('PRIVATE_PART')
    expect(text).not.toContain('PRIVATE_DELTA')
  })

  it('rotates only its own old reports and retains separate HTTP error evidence', async () => {
    const directory = join(process.env.DSH_HOME!, 'responses-diagnostics')
    await mkdir(directory)
    await Promise.all(Array.from({ length: 65 }, async (_, index) => {
      const path = join(directory, `responses-replay-${randomUUID()}.json`)
      await writeFile(path, '{}')
      await utimes(path, 1000 + index, 1000 + index)
    }))
    await writeFile(join(directory, 'http-error-important.json'), 'KEEP_HTTP_EVIDENCE')
    await writeFile(join(directory, 'responses-replay-not-managed.json'), 'KEEP_USER_FILE')
    const diagnostic = new ResponsesDiagnostics({ directory, callId: 'rotation-test', attempt: 1,
      model: { id: model, api: 'openai-responses', provider: 'opencode-go' } as never, sessionId: 'private-session-id' })
    await diagnostic.save()
    const names = await readdir(directory)
    expect(names.filter(name => /^responses-replay-[0-9a-f-]{36}\.json$/.test(name))).toHaveLength(64)
    expect(await readFile(join(directory, 'http-error-important.json'), 'utf8')).toBe('KEEP_HTTP_EVIDENCE')
    expect(await readFile(join(directory, 'responses-replay-not-managed.json'), 'utf8')).toBe('KEEP_USER_FILE')
  })
})
