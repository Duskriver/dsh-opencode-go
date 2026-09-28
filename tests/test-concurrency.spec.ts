import { expect, test } from 'vitest'
import { runConcurrent } from '../scripts/test-concurrency.mjs'

test('bounds active work and fills a free slot without waiting for the slowest item', async () => {
  const gates = Array.from({ length: 4 }, () => Promise.withResolvers<void>())
  const thirdStarted = Promise.withResolvers<void>()
  const started: number[] = []
  let active = 0
  let peak = 0
  const result = runConcurrent([0, 1, 2, 3], 2, async (id: number) => {
    started.push(id)
    peak = Math.max(peak, ++active)
    if (id === 2) thirdStarted.resolve()
    await gates[id].promise
    active--
    return id
  })
  expect(started).toEqual([0, 1])
  gates[0].resolve()
  await thirdStarted.promise
  expect(started).toEqual([0, 1, 2])
  gates.forEach(gate => gate.resolve())
  expect(await result).toEqual([0, 1, 2, 3].map(value => ({ status: 'fulfilled', value })))
  expect(peak).toBe(2)
  expect(active).toBe(0)
})

test('reports every failure and drains active and queued work before allowing cleanup', async () => {
  const slow = Promise.withResolvers<void>()
  const lastStarted = Promise.withResolvers<void>()
  const failure = new Error('broken host')
  const completed: number[] = []
  let settled = false
  const result = runConcurrent([0, 1, 2, 3], 2, async (id: number) => {
    if (id === 0) throw failure
    if (id === 1) await slow.promise
    if (id === 2) throw new Error('another broken host')
    if (id === 3) lastStarted.resolve()
    completed.push(id)
  }).then(results => {
    settled = true
    return results
  })
  await lastStarted.promise
  expect(completed).toContain(3)
  expect(settled).toBe(false)
  slow.resolve()
  const results = await result
  expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled', 'rejected', 'fulfilled'])
  expect(results[0].reason).toBe(failure)
  expect(completed).toEqual([3, 1])
})

test('rejects invalid concurrency before starting any work', async () => {
  let started = false
  for (const concurrency of [0, -1, 1.5, NaN, Infinity]) {
    await expect(runConcurrent([0], concurrency, () => { started = true })).rejects.toThrow('positive integer')
  }
  expect(started).toBe(false)
})
