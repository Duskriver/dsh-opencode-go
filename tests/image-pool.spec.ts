import { expect, it, vi } from 'vitest'
import { IMAGE_PAYLOAD_BUDGET_BYTES, IMAGE_PREPARATION_CONCURRENCY, IMAGE_PREPARATION_QUEUE_LIMIT,
  ImagePayloadLease, retryImagePreparation, withImagePermit } from '../src/conversion/image-pool.ts'

it('bounds the process queue and removes cancelled waiters without releasing active work', async () => {
  const work = Promise.withResolvers<void>()
  const started = vi.fn(() => work.promise)
  const active = Array.from({ length: IMAGE_PREPARATION_CONCURRENCY }, () => withImagePermit(started))
  await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(IMAGE_PREPARATION_CONCURRENCY))
  const abort = new AbortController(), observation = vi.fn()
  const waiters = Array.from({ length: IMAGE_PREPARATION_QUEUE_LIMIT }, () => withImagePermit(started, abort.signal).catch(error => error))
  await expect(withImagePermit(started, undefined, observation)).rejects.toMatchObject({ code: 'IMAGE_RESOURCE_BUSY' })
  expect(observation).toHaveBeenCalledWith(expect.objectContaining({
    active: IMAGE_PREPARATION_CONCURRENCY, queued: IMAGE_PREPARATION_QUEUE_LIMIT, rejected: true,
  }))
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

it('releases partial payloads before waiting and retries when the competing lease releases', async () => {
  using competing = new ImagePayloadLease()
  using lease = new ImagePayloadLease()
  competing.reserve(IMAGE_PAYLOAD_BUDGET_BYTES - 10)
  const prepare = vi.fn(async () => { lease.reserve(5); lease.reserve(10); return 'ready' })
  const pending = retryImagePreparation(prepare, lease)
  try {
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))
    // The failed preparation's five bytes are available while it waits.
    competing.reserve(10)
    expect(prepare).toHaveBeenCalledTimes(1)
  } finally { competing[Symbol.dispose]() }
  await expect(pending).resolves.toBe('ready')
  expect(prepare).toHaveBeenCalledTimes(2)
})

it('makes progress when two preparations exhaust the budget together', async () => {
  const together = Promise.withResolvers<void>()
  let started = 0
  const runs = [0, 0]
  const tasks = runs.map(async (_, index) => {
    using lease = new ImagePayloadLease()
    return await retryImagePreparation(async () => {
      runs[index]!++
      lease.reserve(IMAGE_PAYLOAD_BUDGET_BYTES / 2)
      if (++started === 2) together.resolve()
      await together.promise
      lease.reserve(1)
      return index
    }, lease)
  })
  await expect(Promise.all(tasks)).resolves.toEqual([0, 1])
  expect(runs.reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(4)
})

it('cancels a retry queued behind another retry without starting more image work', async () => {
  using competing = new ImagePayloadLease()
  competing.reserve(IMAGE_PAYLOAD_BUDGET_BYTES)
  using first = new ImagePayloadLease(), second = new ImagePayloadLease()
  const firstWork = vi.fn(async () => { first.reserve(1) })
  const secondWork = vi.fn(async () => { second.reserve(1) })
  const controller = new AbortController()
  const pending = retryImagePreparation(firstWork, first)
  const cancelled = retryImagePreparation(secondWork, second, controller.signal)
  const outcome = cancelled.catch(error => error)
  try {
    await vi.waitFor(() => expect(secondWork).toHaveBeenCalledTimes(1))
    controller.abort('cancelled')
    expect(await outcome).toBe('cancelled')
    expect(firstWork).toHaveBeenCalledTimes(1)
    expect(secondWork).toHaveBeenCalledTimes(1)
  } finally { competing[Symbol.dispose](); await pending }
  expect(firstWork).toHaveBeenCalledTimes(2)
  expect(secondWork).toHaveBeenCalledTimes(1)
})

it('does not miss a competing release before it starts waiting', async () => {
  using competing = new ImagePayloadLease(), lease = new ImagePayloadLease()
  competing.reserve(IMAGE_PAYLOAD_BUDGET_BYTES)
  const prepare = vi.fn(async () => {
    try { lease.reserve(1) }
    catch (error) { competing[Symbol.dispose](); throw error }
  })
  await retryImagePreparation(prepare, lease)
  expect(prepare).toHaveBeenCalledTimes(2)
})

it('rejects a request that cannot fit by itself without waiting or retrying', async () => {
  using lease = new ImagePayloadLease()
  const prepare = vi.fn(async () => { lease.reserve(IMAGE_PAYLOAD_BUDGET_BYTES); lease.reserve(1) })
  await expect(retryImagePreparation(prepare, lease)).rejects.toMatchObject({ code: 'IMAGE_PAYLOAD_TOO_LARGE' })
  expect(prepare).toHaveBeenCalledTimes(1)
})
