import { expect, it, vi } from 'vitest'
import { IMAGE_PAYLOAD_BUDGET_BYTES, IMAGE_PREPARATION_CONCURRENCY, IMAGE_PREPARATION_QUEUE_LIMIT,
  ImagePayloadLease, withImagePermit } from '../src/conversion/image-pool.ts'

it('bounds the process queue and removes cancelled waiters without releasing active work', async () => {
  const work = Promise.withResolvers<void>()
  const started = vi.fn(() => work.promise)
  const active = Array.from({ length: IMAGE_PREPARATION_CONCURRENCY }, () => withImagePermit(started))
  await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(IMAGE_PREPARATION_CONCURRENCY))
  const abort = new AbortController(), observation = vi.fn()
  const waiters = Array.from({ length: IMAGE_PREPARATION_QUEUE_LIMIT }, () => withImagePermit(started, abort.signal).catch(error => error))
  await expect(withImagePermit(started, undefined, observation)).rejects.toMatchObject({ code: 'IMAGE_RESOURCE_BUSY' })
  expect(observation).toHaveBeenCalledWith(expect.objectContaining({ active: 4, queued: 32, rejected: true }))
  abort.abort('cancelled')
  expect(await Promise.all(waiters)).toEqual(Array(IMAGE_PREPARATION_QUEUE_LIMIT).fill('cancelled'))
  const accepted = withImagePermit(started)
  expect(started).toHaveBeenCalledTimes(IMAGE_PREPARATION_CONCURRENCY)
  work.resolve()
  await Promise.all([...active, accepted])
  expect(started).toHaveBeenCalledTimes(IMAGE_PREPARATION_CONCURRENCY + 1)
})

it('shares payload admission across calls and releases it idempotently after failure', () => {
  const first = new ImagePayloadLease(), second = new ImagePayloadLease()
  try {
    first.reserve(IMAGE_PAYLOAD_BUDGET_BYTES)
    expect(() => second.reserve(1)).toThrow(expect.objectContaining({ code: 'IMAGE_RESOURCE_BUSY' }))
    first[Symbol.dispose]()
    first[Symbol.dispose]()
    second.reserve(IMAGE_PAYLOAD_BUDGET_BYTES)
    expect(() => first.reserve(1)).toThrow(expect.objectContaining({ code: 'ABORTED' }))
  } finally { first[Symbol.dispose](); second[Symbol.dispose]() }
  using reusable = new ImagePayloadLease()
  reusable.reserve(IMAGE_PAYLOAD_BUDGET_BYTES)
})

it('measures queue waiting and contains observer errors', async () => {
  const work = Promise.withResolvers<void>()
  const active = Array.from({ length: IMAGE_PREPARATION_CONCURRENCY }, () => withImagePermit(() => work.promise))
  await Promise.resolve()
  const observer = vi.fn(() => { throw new Error('observer') })
  const waiting = withImagePermit(async () => 'ready', undefined, observer)
  await new Promise(resolve => setTimeout(resolve, 15))
  work.resolve()
  await Promise.all(active)
  await expect(waiting).resolves.toBe('ready')
  expect(observer.mock.calls.at(-1)?.[0].queueWaitMs).toBeGreaterThanOrEqual(10)
})
