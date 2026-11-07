/** Per-mount passive Free backoff; never schedules inference retries. */
import { createHash } from 'node:crypto'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { OpencodeGoConfig } from './contracts.ts'

type Network = Pick<OpencodeGoConfig, 'freeBaseURL' | 'proxyURL'>
interface Entry {
  failures: number
  cooldownSequence: number
  cooldownUntil?: number
}
export interface FreeAttemptTicket { key: string; sequence: number }
export interface FreeAttemptResult {
  outcome: 'success' | 'error' | 'aborted'
  code?: string
  retryAt?: number
}

export class FreeChannelState {
  private readonly entries = new Map<string, Entry>()
  private sequence = 0

  private key(config: Network): string {
    // Proxy credentials participate in identity without being retained verbatim.
    const endpoint = new URL(config.freeBaseURL).href.replace(/\/+$/, '')
    const proxy = config.proxyURL?.trim() ? new URL(config.proxyURL.trim()).href : ''
    return createHash('sha256').update(JSON.stringify([endpoint, proxy])).digest('hex')
  }

  cooldownUntil(config: Network): number | undefined {
    const entry = this.entries.get(this.key(config))
    return entry?.cooldownUntil && entry.cooldownUntil > Date.now() ? entry.cooldownUntil : undefined
  }

  assertReady(config: Network): void {
    const until = this.cooldownUntil(config)
    if (until !== undefined) throw new LlmError(
      `OpenCode Free is cooling down until ${new Date(until).toISOString()} (${Math.ceil((until - Date.now()) / 1000)}s remaining). Retry after the cooldown ends.`,
      'FREE_COOLDOWN',
    )
  }

  begin(config: Network): FreeAttemptTicket {
    const key = this.key(config)
    if (!this.entries.has(key)) {
      // Bounded across live endpoint/proxy edits; state lasts for this plugin mount.
      if (this.entries.size >= 64) this.entries.delete(this.entries.keys().next().value!)
      this.entries.set(key, { failures: 0, cooldownSequence: 0 })
    }
    return { key, sequence: ++this.sequence }
  }

  finish(ticket: FreeAttemptTicket, result: FreeAttemptResult): void {
    const entry = this.entries.get(ticket.key)
    if (!entry) return
    const now = Date.now()
    if (result.outcome === 'error') {
      // Account-specific quotas/auth still use account fallback. A shared Free
      // failure or transient transport/server failure cools this Free network.
      const transient = ['FREE_QUOTA', 'FREE_RATE_LIMIT', 'FREE_CLIENT_RESTRICTED', 'FREE_ACCESS_DENIED', 'NETWORK', 'TIMEOUT', 'SERVER'].includes(result.code ?? '')
      if (transient) {
        entry.failures = Math.min(entry.failures + 1, 5)
        const retryAt = result.retryAt ?? now + Math.min(60_000 * 2 ** (entry.failures - 1), 15 * 60_000)
        entry.cooldownUntil = Math.max(entry.cooldownUntil ?? 0, retryAt)
        entry.cooldownSequence = Math.max(entry.cooldownSequence, ticket.sequence)
      }
    } else if (result.outcome === 'success') {
      // An older in-flight success must not clear a later request's backoff.
      if (ticket.sequence >= entry.cooldownSequence) {
        entry.cooldownUntil = undefined
        entry.failures = 0
      }
    }
  }
}
