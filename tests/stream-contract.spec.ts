import { expect, it } from 'vitest'
import { mapStopReason, toStreamChunks } from '../src/conversion/stream.ts'
import type { AssistantMessage, AssistantMessageEvent } from '../src/sdk-types.ts'

it('rejects a future SDK event instead of silently omitting it', async () => {
  async function* futureEvents() { yield { type: 'future-content' } as unknown as AssistantMessageEvent }
  const iterator = toStreamChunks(futureEvents())[Symbol.asyncIterator]()
  await expect(iterator.next()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
})

it('reports an empty answer at the output cap instead of a silent truncation', () => {
  const usage = { input: 900_000, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 900_000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
  const truncated = { model: 'deepseek-v4.1-flash', content: [], stopReason: 'length', usage } as unknown as AssistantMessage
  const reason = mapStopReason(truncated, 950_000)
  expect(reason).toMatchObject({ kind: 'error', failure: { code: 'INVALID_REQUEST' } })
  expect(reason.kind === 'error' ? reason.failure.message : '').toContain('950000-token window')
  // Content at the cap stays the ordinary truncated finish the agent continues from.
  expect(mapStopReason({ ...truncated, content: [{ type: 'text', text: 'partial' }] } as AssistantMessage, 950_000))
    .toEqual({ kind: 'max-tokens' })
})

it('blames the output allowance when the allowance was the limit, and the prompt otherwise', () => {
  const usage = { input: 900_000, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 900_000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
  const empty = { model: 'deepseek-v4.1-flash', content: [], stopReason: 'length', usage } as unknown as AssistantMessage
  const message = (reason: ReturnType<typeof mapStopReason>): string =>
    reason.kind === 'error' ? reason.failure.message : ''
  // A "max output" of 1 cannot answer, whatever the prompt looked like.
  const tiny = message(mapStopReason(empty, 1_000_000, 1))
  expect(tiny).toContain('1-token output allowance')
  expect(tiny).toContain('Raise')
  expect(tiny).not.toContain('/compact')
  // An allowance the model spent entirely is the same setting, not the prompt.
  expect(message(mapStopReason({ ...empty, usage: { ...usage, output: 32_768 } } as AssistantMessage, 1_000_000, 32_768)))
    .toContain('32768-token output allowance')
  // A healthy allowance with an empty answer still points at the prompt.
  expect(message(mapStopReason(empty, 1_000_000, 32_768))).toContain('/compact')
})
