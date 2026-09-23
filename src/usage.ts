import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { assertBaseURL } from './config.ts'
import { parseGoUsage, type GoUsage } from './usage-contract.ts'
import { diagnosticURL, fetchJsonResponse, transportFailure } from './json-response.ts'

const USAGE_MAX_BYTES = 1024 * 1024

interface UsageOptions {
  baseURL: () => string
  resolveApiKey: () => Promise<string | undefined>
}

/** Account statistics are fetched on the Host; credentials never enter the browser. */
export class GoUsageService extends TypertRemoteService {
  private identity?: { baseURL: string; key: string; source: string }

  constructor(ctx: Context, private readonly options: UsageOptions) {
    super(ctx, 'opencodeGoUsage')
  }

  async read(): Promise<GoUsage> {
    const baseURL = assertBaseURL(this.options.baseURL()).replace(/\/$/, '')
    let key: string | undefined
    try {
      key = await this.options.resolveApiKey()
    } catch (error: unknown) {
      this.identity = undefined
      const missing = error instanceof Error && 'code' in error && error.code === 'MISSING_CREDENTIAL'
      throw new RemoteError('opencode-go/usage-unavailable', missing
        ? 'OpenCode Go API key is not configured' : 'Could not resolve the OpenCode Go API key', {
        retryable: !missing, retainPrevious: false,
      }, { cause: error })
    }
    if (!key) {
      this.identity = undefined
      throw new RemoteError('opencode-go/usage-unavailable', 'OpenCode Go API key is not configured', {
        retryable: false, retainPrevious: false,
      })
    }
    if (this.identity?.baseURL !== baseURL || this.identity.key !== key) {
      this.identity = { baseURL, key, source: randomUUID() }
    }
    const { source } = this.identity
    const endpoint = diagnosticURL(`${baseURL}/usage`)
    let result: Awaited<ReturnType<typeof fetchJsonResponse>>
    try {
      result = await fetchJsonResponse(`${baseURL}/usage`, {
        headers: { ...attributionHeaders(), Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      }, USAGE_MAX_BYTES)
    } catch (error: unknown) {
      const invalid = error instanceof SyntaxError || error instanceof RangeError
      const detail = error instanceof SyntaxError ? 'invalid JSON response'
        : error instanceof RangeError ? `response exceeds the ${USAGE_MAX_BYTES} byte limit`
          : transportFailure(error)
      throw new RemoteError('opencode-go/usage-unavailable', `Could not read ${endpoint}: ${detail}`, {
        retryable: true, retainPrevious: !invalid, source,
      }, { cause: error })
    }
    const { response, body } = result
    if (!response.ok) {
      const temporary = response.status === 408 || response.status === 429 || response.status >= 500
      throw new RemoteError('opencode-go/usage-unavailable', `OpenCode Go usage unavailable (HTTP ${response.status})`, {
        retryable: temporary, retainPrevious: temporary, source,
      })
    }
    try {
      const usage = parseGoUsage(body && typeof body === 'object' ? (body as { usage?: unknown }).usage : undefined)
      return { ...usage, source }
    } catch (error: unknown) {
      throw new RemoteError('opencode-go/usage-unavailable', 'Invalid OpenCode Go usage response', {
        retryable: true, retainPrevious: false, source,
      }, { cause: error })
    }
  }
}
