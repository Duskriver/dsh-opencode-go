/** Content-free stage timings. Observer failures must not affect the operation. */
export interface DiagnosticTiming {
  readonly stage: string
  readonly phase: 'start' | 'success' | 'failure'
  readonly elapsedMs: number
  readonly attempt?: number
  readonly status?: number
  /** Bytes delivered to the reader, or produced by explicit gzip recovery. */
  readonly bytes?: number
  readonly cacheHit?: boolean
  readonly persisted?: boolean
}

export type TimingObserver = (event: DiagnosticTiming) => void
type TimingDetails = Pick<DiagnosticTiming, 'status' | 'bytes' | 'cacheHit' | 'persisted'>

export async function measureTiming<T>(
  observer: TimingObserver | undefined, stage: string, work: () => T | PromiseLike<T>,
  details?: (value: T) => TimingDetails,
): Promise<T> {
  if (observer === undefined) return work()
  const started = performance.now()
  const emit = (phase: DiagnosticTiming['phase'], value?: T): void => {
    try {
      observer({ stage, phase, elapsedMs: Math.round(performance.now() - started),
        ...(phase === 'success' ? details?.(value as T) : {}) })
    } catch { /* Logging cannot change discovery or cancellation. */ }
  }
  emit('start')
  try {
    const value = await work()
    emit('success', value)
    return value
  } catch (error) {
    emit('failure')
    throw error
  }
}
