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

async function collect(event: AssistantMessageEvent): Promise<StreamChunk[]> {
  async function* events() { yield event }
  const chunks: StreamChunk[] = []
  for await (const chunk of toStreamChunks(events())) chunks.push(chunk)
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

it('rejects a future SDK event instead of silently omitting it', async () => {
  async function* futureEvents() { yield { type: 'future-content' } as unknown as AssistantMessageEvent }
  const iterator = toStreamChunks(futureEvents())[Symbol.asyncIterator]()
  await expect(iterator.next()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
})
