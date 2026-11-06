/** Model access status read from the public OpenCode status feed. */
import { DEFAULT_STATUS_URL, assertProxyURL, parseGoStatusReport, type GoStatusReport } from './contracts.ts'
import { diagnosticURL, fetchJsonResponse, transportFailure, ProxyTransport } from './transport.ts'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'

const STATUS_MAX_BYTES = 1024 * 1024
/** The feed reports readings on the order of minutes; one fetch per window is enough. */
const STATUS_TTL_MS = 5 * 60_000
const STATUS_TIMEOUT_MS = 10_000

export interface StatusOptions {
  /** Shared proxy transport; the service owns one only when none is given. */
  transport?: ProxyTransport
  proxyURL?: () => string | undefined
  /** Overridable for tests and mirrors of the official feed. */
  statusURL?: () => string
  /** Cache window; the default keeps reads cheap while staying fresh. */
  ttlMs?: number
}

/**
 * Serves `opencodeGoStatus.read()` from the public status feed with a short
 * shared cache: every conversation pill reads the same report without
 * multiplying requests, and no credential ever reaches the feed.
 */
export class GoStatusService extends TypertRemoteService {
  private cached: { report: GoStatusReport; at: number } | null = null
  private pending: Promise<GoStatusReport> | null = null
  private readonly transport: ProxyTransport

  constructor(ctx: Context, private readonly options: StatusOptions) {
    super(ctx, 'opencodeGoStatus')
    this.transport = options.transport ?? new ProxyTransport()
    if (!options.transport) ctx.effect(() => () => this.transport.dispose())
  }

  async read(): Promise<GoStatusReport> {
    const ttl = this.options.ttlMs ?? STATUS_TTL_MS
    const cached = this.cached
    if (cached && Date.now() - cached.at < ttl) return cached.report
    const shared = this.pending
    if (shared) return shared
    const pending = this.fetchReport()
    this.pending = pending
    try { return await pending } finally { this.pending = null }
  }

  private async fetchReport(): Promise<GoStatusReport> {
    const proxyURL = assertProxyURL(this.options.proxyURL?.())
    const endpoint = diagnosticURL(this.options.statusURL?.() ?? DEFAULT_STATUS_URL)
    const signal = AbortSignal.timeout(STATUS_TIMEOUT_MS)
    let result: Awaited<ReturnType<typeof fetchJsonResponse>>
    try {
      result = await fetchJsonResponse(endpoint, {
        headers: { ...attributionHeaders(), Accept: 'application/json' },
        signal,
        redirect: 'error',
      }, STATUS_MAX_BYTES, 'identity', this.transport.forProxy(proxyURL))
    } catch (error: unknown) {
      const invalid = error instanceof SyntaxError || error instanceof RangeError
      const detail = error instanceof SyntaxError ? 'invalid JSON response'
        : error instanceof RangeError ? `response exceeds the ${STATUS_MAX_BYTES} byte limit`
          : transportFailure(error)
      throw new RemoteError('opencode-go/status-unavailable', `Could not read ${endpoint}: ${detail}`, {
        retryable: !invalid,
      }, { cause: error })
    }
    const { response, body } = result
    if (!response.ok) {
      const temporary = response.status === 408 || response.status === 429 || response.status >= 500
      throw new RemoteError('opencode-go/status-unavailable', `OpenCode status unavailable (HTTP ${response.status})`, {
        retryable: temporary,
      })
    }
    try {
      const report = parseGoStatusReport(body)
      this.cached = { report, at: Date.now() }
      return report
    } catch (error: unknown) {
      throw new RemoteError('opencode-go/status-unavailable', 'Invalid OpenCode status response', {
        retryable: false,
      }, { cause: error })
    }
  }
}
