import { LlmError } from '@deepseek-ai/dsh-llm'
import { waitWithSignal } from '../request-control.ts'

/** Local protection defaults, not limits reported by the upstream gateway. */
export const IMAGE_PREPARATION_CONCURRENCY = 100
export const IMAGE_PREPARATION_QUEUE_LIMIT = 300
/** Raw prepared bytes plus base64 payloads, not a bound on native decoder RSS. */
export const IMAGE_PAYLOAD_BUDGET_BYTES = 2 * 1024 * 1024 * 1024
let active = 0
let retainedBytes = 0
const queued: Array<() => void> = []
const leases = new Set<ImagePayloadLease>()
let permitReleased = Promise.withResolvers<void>()
let retryTail = Promise.resolve()

/** A local collision can be retried once an actual competing resource releases. */
class ImageResourceBusyError extends LlmError {
  constructor(message: string, readonly retryAfter: Promise<void>) {
    super(message, 'IMAGE_RESOURCE_BUSY')
  }
}

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
  private released = Promise.withResolvers<void>()
  constructor(private readonly observer?: ImagePoolObserver) {}
  reserve(bytes: number): void {
    if (this.closed) throw new LlmError('Image preparation was cancelled', 'ABORTED')
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > IMAGE_PAYLOAD_BUDGET_BYTES - this.bytes) {
      observe(this.observer, performance.now(), true)
      throw new LlmError('OpenCode Go single image request exceeds the local 2 GiB raw plus base64 budget; reduce maxImages, maxRequestImageBytes or requestImageMaxBytes', 'IMAGE_PAYLOAD_TOO_LARGE')
    }
    if (bytes > IMAGE_PAYLOAD_BUDGET_BYTES - retainedBytes) {
      observe(this.observer, performance.now(), true)
      // Capture competing releases now, so releasing our own partial payload
      // neither causes a retry loop nor loses an already-completed wakeup.
      const retryAfter = Promise.race([...leases].filter(lease => lease !== this).map(lease => lease.released.promise))
      throw new ImageResourceBusyError('OpenCode Go image payload capacity is busy', retryAfter)
    }
    this.bytes += bytes
    retainedBytes += bytes
    if (this.bytes > 0) leases.add(this)
    observe(this.observer, performance.now())
  }
  /** Discard a failed preparation before waiting; partial leases must not deadlock. */
  reset(): void {
    if (this.bytes === 0) return
    retainedBytes -= this.bytes
    this.bytes = 0
    leases.delete(this)
    this.released.resolve()
    this.released = Promise.withResolvers<void>()
  }
  async waitForCapacity(error: ImageResourceBusyError, signal?: AbortSignal): Promise<void> {
    const started = performance.now()
    try { await waitWithSignal(() => error.retryAfter, signal) }
    finally { observe(this.observer, started) }
  }
  [Symbol.dispose](): void {
    if (this.closed) return
    this.closed = true
    this.reset()
  }
}

/** Retry only local admission failures, before any provider request is sent. */
export async function retryImagePreparation<T>(work: () => Promise<T>, lease: ImagePayloadLease, signal?: AbortSignal): Promise<T> {
  let busy: ImageResourceBusyError
  try { return await work() }
  catch (error) {
    if (!(error instanceof ImageResourceBusyError)) throw error
    lease.reset()
    busy = error
  }
  // Serialize colliding retries so large requests cannot repeatedly split the
  // budget, release it together, and collide again without making progress.
  const previous = retryTail
  const turn = Promise.withResolvers<void>()
  retryTail = previous.then(() => turn.promise)
  try {
    await waitWithSignal(() => previous, signal)
    while (true) {
      await lease.waitForCapacity(busy, signal)
      signal?.throwIfAborted()
      try { return await work() }
      catch (error) {
        if (!(error instanceof ImageResourceBusyError)) throw error
        lease.reset()
        busy = error
      }
    }
  } finally { turn.resolve() }
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
      resolve(() => {
        active--
        permitReleased.resolve()
        permitReleased = Promise.withResolvers<void>()
        queued.shift()?.()
      })
    }
    if (active < IMAGE_PREPARATION_CONCURRENCY) start()
    else if (queued.length >= IMAGE_PREPARATION_QUEUE_LIMIT) {
      observe(observer, started, true)
      reject(new ImageResourceBusyError('OpenCode Go image preparation queue is full', permitReleased.promise))
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
