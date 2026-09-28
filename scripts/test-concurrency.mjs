/** Run every item with bounded concurrency, settling all work before returning. */
export async function runConcurrent(items, concurrency, task) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error('Concurrency must be a positive integer')
  }
  const pending = items.entries()
  const results = new Array(items.length)
  async function worker() {
    for (const [index, item] of pending) {
      try {
        results[index] = { status: 'fulfilled', value: await task(item) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}
