import { expect, it } from 'vitest'
import { toStreamChunks } from '../src/conversion/stream.ts'
import type { AssistantMessageEvent } from '../src/sdk-types.ts'

it('rejects a future SDK event instead of silently omitting it', async () => {
  async function* futureEvents() { yield { type: 'future-content' } as unknown as AssistantMessageEvent }
  const iterator = toStreamChunks(futureEvents())[Symbol.asyncIterator]()
  await expect(iterator.next()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT' })
})
