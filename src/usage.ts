import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { assertBaseURL } from './config.ts'
import { parseGoUsage, type GoUsage } from './usage-contract.ts'

interface UsageOptions {
  baseURL: () => string
  resolveApiKey: () => Promise<string | undefined>
}

/** Account statistics are fetched on the Host; credentials never enter the browser. */
export class GoUsageService extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: UsageOptions) {
    super(ctx, 'opencodeGoUsage')
  }

  async read(): Promise<GoUsage> {
    const baseURL = assertBaseURL(this.options.baseURL()).replace(/\/$/, '')
    const key = await this.options.resolveApiKey()
    if (!key) throw new Error('OpenCode Go API key is not configured')
    const response = await fetch(`${baseURL}/usage`, {
      headers: { ...attributionHeaders(), Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    })
    if (!response.ok) throw new Error(`OpenCode Go usage unavailable (HTTP ${response.status})`)
    const body: unknown = await response.json()
    return parseGoUsage(body && typeof body === 'object' ? (body as { usage?: unknown }).usage : undefined)
  }
}
