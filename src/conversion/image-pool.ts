import { LlmError } from '@deepseek-ai/dsh-llm'

/** Shared across requests so concurrent conversations cannot multiply image work. */
export const IMAGE_PREPARATION_CONCURRENCY = 4
export const IMAGE_PREPARATION_QUEUE_LIMIT = 32
/** Raw prepared bytes plus base64 payloads, not a bound on native decoder RSS. */
export const IMAGE_PAYLOAD_BUDGET_BYTES = 128 * 1024 * 1024
let active = 0
let retainedBytes = 0
const queued: Array<() => void> = []

export interface ImagePoolObservation {
  queueWaitMs: number
  active: number
  queued: number
  retainedBytes: number
  rejected?: boolean
}
export type ImagePoolObserver = (observation: ImagePoolObservation) => void

function observe(observer: ImagePoolObserver | undefined, started: number, rejected = false): void {
  try { observer?.({ queueWaitMs: performance.now() - started, active, queued: queued.length,
    retainedBytes, ...rejected ? { rejected: true } : {} }) }
  catch { /* Diagnostics cannot hold a permit or change admission. */ }
}

/** Held by the adapter until an attempt ends, including streaming and fallback. */
export class ImagePayloadLease {
  private bytes = 0
  private closed = false
  constructor(private readonly observer?: ImagePoolObserver) {}
  reserve(bytes: number): void {
    if (this.closed) throw new LlmError('Image preparation was cancelled', 'ABORTED')
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > IMAGE_PAYLOAD_BUDGET_BYTES - retainedBytes) {
      observe(this.observer, performance.now(), true)
      throw new LlmError('OpenCode Go image payload capacity is busy; retry after another image request completes', 'IMAGE_RESOURCE_BUSY')
    }
    this.bytes += bytes
    retainedBytes += bytes
    observe(this.observer, performance.now())
  }
  [Symbol.dispose](): void {
    if (this.closed) return
    this.closed = true
    retainedBytes -= this.bytes
  }
}

function acquire(signal?: AbortSignal, observer?: ImagePoolObserver): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    if (signal?.aborted) { reject(signal.reason); return }
    const abort = (): void => {
      const index = queued.indexOf(start)
      if (index >= 0) queued.splice(index, 1)
      signal?.removeEventListener('abort', abort)
      observe(observer, started)
      reject(signal!.reason)
    }
    const start = (): void => {
      signal?.removeEventListener('abort', abort)
      active++
      observe(observer, started)
      resolve(() => { active--; queued.shift()?.() })
    }
    if (active < IMAGE_PREPARATION_CONCURRENCY) start()
    else if (queued.length >= IMAGE_PREPARATION_QUEUE_LIMIT) {
      observe(observer, started, true)
      reject(new LlmError('OpenCode Go image preparation queue is full; retry after another image request completes', 'IMAGE_RESOURCE_BUSY'))
    } else {
      queued.push(start)
      signal?.addEventListener('abort', abort, { once: true })
      observe(observer, performance.now())
    }
  })
}

/** Keep the permit until real work settles, even if its caller stops waiting. */
export async function withImagePermit<T>(work: () => Promise<T>, signal?: AbortSignal, observer?: ImagePoolObserver): Promise<T> {
  const release = await acquire(signal, observer)
  try { signal?.throwIfAborted(); return await work() }
  finally { release() }
}
