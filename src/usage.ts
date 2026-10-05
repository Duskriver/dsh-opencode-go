import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { assertBaseURL } from './config.ts'
import { parseGoUsage, type GoUsage } from './usage-contract.ts'
import { diagnosticURL, fetchJsonResponse, transportFailure } from './json-response.ts'
import type { GoAccountSwitch } from './accounts.ts'
import { assertProxyURL } from './proxy-url.ts'
import { ProxyTransport } from './proxy.ts'

const USAGE_MAX_BYTES = 1024 * 1024

interface UsageOptions {
  baseURL: () => string
  proxyURL?: () => string
  transport?: ProxyTransport
  resolveApiKey: (ref?: string) => Promise<string | undefined>
  activeRef?: () => string
  accountRefs?: () => readonly string[]
  lastSwitch?: () => GoAccountSwitch | undefined
}

/** Account statistics are fetched on the Host; credentials never enter the browser. */
export class GoUsageService extends TypertRemoteService {
  private readonly identities = new Map<string, { baseURL: string; proxyURL: string; key: string; source: string }>()
  private readonly pending = new Map<string, Promise<GoUsage>>()
  private readonly transport: ProxyTransport

  constructor(ctx: Context, private readonly options: UsageOptions) {
    super(ctx, 'opencodeGoUsage')
    this.transport = options.transport ?? new ProxyTransport()
    if (!options.transport) ctx.effect(() => () => this.transport.dispose())
  }

  async read(): Promise<GoUsage> {
    try {
      const usage = await this.readRef(this.options.activeRef?.())
      const lastSwitch = this.options.lastSwitch?.()
      return lastSwitch ? { ...usage, lastSwitch } : usage
    } catch (error) {
      const lastSwitch = this.options.lastSwitch?.()
      if (lastSwitch && error instanceof RemoteError && error.code === 'opencode-go/usage-unavailable') {
        throw new RemoteError('opencode-go/usage-unavailable', error.message,
          { ...error.details as { retryable: boolean; retainPrevious: boolean; source?: string }, lastSwitch }, { cause: error })
      }
      throw error
    }
  }

  async readAccount(ref: string): Promise<GoUsage> {
    if (!this.options.accountRefs?.().includes(ref)) {
      throw new RemoteError('gateway/bad-request', 'Unknown OpenCode Go account', {})
    }
    return this.readRef(ref)
  }

  private async readRef(ref?: string): Promise<GoUsage> {
    const identityKey = ref ?? ''
    // Retire removed accounts, including their secret-bearing identity records.
    if (this.options.accountRefs) for (const saved of this.identities.keys()) {
      if (saved && !this.options.accountRefs().includes(saved)) this.identities.delete(saved)
    }
    const baseURL = assertBaseURL(this.options.baseURL()).replace(/\/$/, '')
    const proxyURL = assertProxyURL(this.options.proxyURL?.())
    let key: string | undefined
    try {
      key = await this.options.resolveApiKey(ref)
    } catch (error: unknown) {
      this.identities.delete(identityKey)
      const missing = error instanceof Error && 'code' in error && error.code === 'MISSING_CREDENTIAL'
      throw new RemoteError('opencode-go/usage-unavailable', missing
        ? 'OpenCode Go API key is not configured' : 'Could not resolve the OpenCode Go API key', {
        retryable: !missing, retainPrevious: false,
      }, { cause: error })
    }
    if (!key) {
      this.identities.delete(identityKey)
      throw new RemoteError('opencode-go/usage-unavailable', 'OpenCode Go API key is not configured', {
        retryable: false, retainPrevious: false,
      })
    }
    let identity = this.identities.get(identityKey)
    if (identity?.baseURL !== baseURL || identity.proxyURL !== proxyURL || identity.key !== key) {
      identity = { baseURL, proxyURL, key, source: randomUUID() }
      this.identities.set(identityKey, identity)
    }
    const { source } = identity
    const shared = this.pending.get(source)
    if (shared) return shared
    const pending = this.fetchUsage(baseURL, key, source, this.transport.forProxy(proxyURL))
    this.pending.set(source, pending)
    try { return await pending } finally { this.pending.delete(source) }
  }

  private async fetchUsage(baseURL: string, key: string, source: string, fetcher?: typeof globalThis.fetch): Promise<GoUsage> {
    const endpoint = diagnosticURL(`${baseURL}/usage`)
    let result: Awaited<ReturnType<typeof fetchJsonResponse>>
    try {
      result = await fetchJsonResponse(`${baseURL}/usage`, {
        headers: { ...attributionHeaders(), Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      }, USAGE_MAX_BYTES, 'identity', fetcher)
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
