import { randomUUID } from 'node:crypto'
import type { ImagePoolObservation } from './conversion/image-pool.ts'

type Outcome = 'completed' | 'failed' | 'aborted' | 'consumer-stopped'
type Stages = Partial<Record<'discovery' | 'credential' | 'images' | 'stream', number>>
export interface GoAttemptTrace {
  attempt: number
  elapsedMs: number
  stages: Stages
  outcome: Outcome
  code?: string
  httpStatus?: number
  requestId?: string
  /** First text, reasoning or tool argument delta, measured from attempt start. */
  firstOutputMs?: number
  imagePool?: { queueWaitMs: number; maxActive: number; maxQueued: number; maxRetainedBytes: number; rejected: boolean }
}

/** Safe per-call diagnostics: no transcript, credential, URL or raw session id. */
export interface GoCallTrace {
  callId: string
  model: string
  elapsedMs: number
  stages: Stages
  attempts: number
  attemptDetails: readonly GoAttemptTrace[]
  outcome: Outcome
  code?: string
}

export class CallTrace {
  private readonly started = performance.now()
  readonly callId = randomUUID()
  readonly stages: GoCallTrace['stages'] = {}
  attempts = 0
  outcome: GoCallTrace['outcome'] = 'consumer-stopped'
  code: string | undefined
  private readonly details: GoAttemptTrace[] = []
  private current: { started: number; trace: GoAttemptTrace } | undefined
  private finished = false
  constructor(private readonly model: string, private readonly observer?: (trace: GoCallTrace) => void) {}

  startAttempt(): void {
    this.attempts++
    this.current = { started: performance.now(), trace: {
      attempt: this.attempts, elapsedMs: 0, stages: {}, outcome: 'consumer-stopped',
    } }
  }

  response(status: number, requestId?: string): void {
    if (!this.current) return
    this.current.trace.httpStatus = status
    if (requestId !== undefined) this.current.trace.requestId = requestId
  }

  firstOutput(): void {
    if (this.current && this.current.trace.firstOutputMs === undefined) {
      this.current.trace.firstOutputMs = performance.now() - this.current.started
    }
  }

  imagePool = (value: ImagePoolObservation): void => {
    if (!this.current) return
    const stats = this.current.trace.imagePool ??= { queueWaitMs: 0, maxActive: 0, maxQueued: 0, maxRetainedBytes: 0, rejected: false }
    stats.queueWaitMs += value.queueWaitMs
    stats.maxActive = Math.max(stats.maxActive, value.active)
    stats.maxQueued = Math.max(stats.maxQueued, value.queued)
    stats.maxRetainedBytes = Math.max(stats.maxRetainedBytes, value.retainedBytes)
    stats.rejected ||= value.rejected === true
  }

  endAttempt(outcome: Outcome = 'consumer-stopped', code?: string): void {
    if (!this.current) return
    const detail = this.current.trace
    detail.elapsedMs = performance.now() - this.current.started
    detail.outcome = outcome
    if (code !== undefined) detail.code = code
    // Account admission currently caps this at 20; preserve a hard bound if it grows.
    if (this.details.length < 32) this.details.push(detail)
    this.current = undefined
  }

  async measure<T>(stage: keyof GoCallTrace['stages'], work: () => Promise<T>): Promise<T> {
    const started = performance.now()
    const attempt = this.current
    try { return await work() }
    finally {
      const elapsed = performance.now() - started
      this.stages[stage] = (this.stages[stage] ?? 0) + elapsed
      if (attempt) attempt.trace.stages[stage] = (attempt.trace.stages[stage] ?? 0) + elapsed
    }
  }

  finish(): void {
    if (this.finished) return
    this.finished = true
    this.endAttempt()
    try { this.observer?.({ callId: this.callId, model: this.model,
      elapsedMs: performance.now() - this.started, stages: { ...this.stages },
      attempts: this.attempts, attemptDetails: structuredClone(this.details), outcome: this.outcome,
      ...this.code ? { code: this.code } : {} }) }
    catch { /* Observability must not change the request outcome. */ }
  }
}
