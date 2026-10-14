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
