/** Cancel a wait even when an external service does not observe its signal. */
export function waitWithSignal<T>(work: () => PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise<T>((resolve, reject) => {
    const cleanup = (): void => { signal?.removeEventListener('abort', abort) }
    const abort = (): void => { cleanup(); reject(signal!.reason) }
    signal?.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(() => {
      signal?.throwIfAborted()
      return work()
    }).then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}
