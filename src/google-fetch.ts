/** Per-request fetch binding for the bundled Google SDK; never changes global fetch. */
import { AsyncLocalStorage } from 'node:async_hooks'

const requests = new AsyncLocalStorage<{ fetch: typeof globalThis.fetch; userAgent?: string }>()

export function withGoogleFetch<T>(options: {
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string | null>
} | undefined, request: () => T): T {
  const userAgent = Object.entries(options?.headers ?? {}).find(([key]) => key.toLowerCase() === 'user-agent')?.[1]
  return requests.run({ fetch: options?.fetch ?? globalThis.fetch,
    ...typeof userAgent === 'string' ? { userAgent } : {},
  }, request)
}

/** The pinned Google SDK's HTTP call uses this binding in builds and tests. */
export const googleFetch: typeof globalThis.fetch = (input, init) => {
  const request = requests.getStore()
  if (request?.userAgent) {
    // Google's default SDK agent would otherwise be prepended to Harness attribution.
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    headers.set('user-agent', request.userAgent)
    init = { ...init, headers }
  }
  return (request?.fetch ?? globalThis.fetch)(input, init)
}
