import { expect, it } from 'vitest'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { toStreamChunks } from '../src/conversion/stream.ts'
import type { AssistantMessage, AssistantMessageEvent } from '../src/sdk-types.ts'

function message(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    role: 'assistant', api: 'openai-completions', provider: 'opencode-go', model: 'deepseek-v4.1-flash',
    content: [], timestamp: 0, stopReason: 'error', errorMessage: '400 status code (no body)',
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    ...overrides,
  }
}

async function collect(event: AssistantMessageEvent, contextWindow?: number, reservedMaxTokens?: number): Promise<StreamChunk[]> {
  async function* events() { yield event }
  const chunks: StreamChunk[] = []
  for await (const chunk of toStreamChunks(events(), contextWindow, undefined, undefined, undefined, reservedMaxTokens)) chunks.push(chunk)
  return chunks
}

it.each(['error', 'aborted'] as const)('omits unmeasured usage on %s so the host has no zero pressure sample', async reason => {
  const chunks = await collect({ type: 'error', reason, error: message({ stopReason: reason }) })
  expect(chunks).toHaveLength(1)
  expect(chunks[0]).toMatchObject({ type: 'finish', reason: { kind: reason } })
  const assembler = new BlockAssembler()
  for (const chunk of chunks) assembler.push(chunk)
  expect(assembler.usage).toBeUndefined()
})

it.each(['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'] as const)('keeps measured %s on a failed attempt', async field => {
  const failed = message()
  failed.usage[field] = 17
  const chunks = await collect({ type: 'error', reason: 'error', error: failed })
  expect(chunks[0]).toMatchObject({ type: 'usage' })
  expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error' } })
})

it('omits zero usage when a nominal success becomes an empty-response error', async () => {
  const chunks = await collect({ type: 'done', reason: 'stop', message: message({ stopReason: 'stop' }) })
  expect(chunks).toHaveLength(1)
  expect(chunks[0]).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'EMPTY_RESPONSE' } } })
})

it.each([
  { allowance: 512, output: 0 },
  { allowance: 4_096, output: 4_096 },
])('explains empty length responses limited by a $allowance-token allowance', async ({ allowance, output }) => {
  const empty = message({ stopReason: 'length' })
  empty.usage.output = output
  empty.usage.totalTokens = output
  const chunks = await collect({ type: 'done', reason: 'length', message: empty }, 262_144, allowance)
  expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
    code: 'INVALID_REQUEST', message: expect.stringContaining(`its ${allowance}-token output allowance`),
  } } })
  expect(chunks.at(-1)).toMatchObject({ reason: { failure: {
    message: expect.stringContaining('Increase this model\'s "max output"'),
  } } })
  if (output > 0) expect(chunks[0]).toMatchObject({ type: 'usage', usage: { outputTokens: output, totalTokens: output } })
  else expect(chunks).toHaveLength(1)
})

it.each([
  { contextWindow: 262_144, allowance: 65_536 },
  { contextWindow: undefined, allowance: undefined },
])('explains empty length responses without assuming a small output allowance: %j', async ({ contextWindow, allowance }) => {
  const chunks = await collect({ type: 'done', reason: 'length', message: message({ stopReason: 'length' }) }, contextWindow, allowance)
  expect(chunks).toHaveLength(1)
  expect(chunks[0]).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
    code: 'INVALID_REQUEST', message: expect.stringContaining('Compact the context (/compact)'),
  } } })
  expect(chunks[0]).toMatchObject({ reason: { failure: {
    message: expect.stringContaining('or lower this model\'s "max output"'),
  } } })
  const assembler = new BlockAssembler()
  for (const chunk of chunks) assembler.push(chunk)
  expect(assembler.usage).toBeUndefined()
})

it('keeps confirmed context overflow ahead of the empty length fallback', async () => {
  const empty = message({ stopReason: 'length' })
  empty.usage.input = 262_144
  empty.usage.totalTokens = 262_144
  const chunks = await collect({ type: 'done', reason: 'length', message: empty }, 262_144, 512)
  expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: {
    kind: 'error', failure: { code: 'CONTEXT_WINDOW_EXCEEDED' },
  } })
})

it.each([
  { content: [{ type: 'text', text: 'partial answer' }] },
  { content: [{ type: 'thinking', thinking: 'partial reasoning' }] },
] satisfies { content: AssistantMessage['content'] }[])('keeps nonempty length responses as max-tokens: %j', async ({ content }) => {
  const chunks = await collect({ type: 'done', reason: 'length', message: message({ stopReason: 'length', content }) }, 262_144, 512)
  expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'max-tokens' } })
})

it('rejects a future SDK event instead of silently omitting it', async () => {
  async function* futureEvents() { yield { type: 'future-content' } as unknown as AssistantMessageEvent }
  const iterator = toStreamChunks(futureEvents())[Symbol.asyncIterator]()
  await expect(iterator.next()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
})
