/**
 * Fold one persisted session into request facts for the usage dashboard.
 *
 * The fold is range-independent: it records when each model call started and
 * what it reported, so later queries can filter by any date range and timezone
 * without reading the session again. It never returns session ids, titles or
 * message content.
 *
 * @module dsh-opencode-go/analytics-scan
 */

import { PROVIDER_ID } from './provider-identity.ts'

/** Route id used by this plugin before 0.1.16. */
export const LEGACY_PROVIDER_ID = 'opencode-go'

/** 0.1.16 isolated the plugin route; later legacy-id records belong to DSH native. */
export const LEGACY_ROUTE_CUTOFF_MS = Date.parse('2026-09-30T00:00:00Z')

/** Minimal structural event face; the Host owns the real session types. */
export interface AnalyticsEventLike {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data?: unknown
}

/** Minimal structural snapshot returned by readSession. */
export interface AnalyticsSnapshotLike {
  readonly inheritedEventCount: number
  readonly events: readonly AnalyticsEventLike[]
}

/** One model request that the dashboard can price. */
export interface RequestFact {
  /** Request start, Unix epoch milliseconds. */
  readonly at: number
  readonly model: string
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
  /** The request was recorded under the pre-0.1.16 route id. */
  readonly legacy: boolean
  readonly kind: 'message' | 'summary'
  /** The request settled without a usable usage report. */
  readonly missingUsage: boolean
}

/** Everything one session contributes, before date filtering. */
export interface FoldedSession {
  readonly facts: RequestFact[]
  /** Start times of attempts that committed no surface message. */
  readonly attempts: number[]
  /** Model calls with no usable routing header or model id. */
  readonly unattributed: number[]
  readonly events: number
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function usageOf(value: unknown): { input: number; output: number; cacheRead: number; cacheWrite: number } | undefined {
  const usage = record(value)
  if (usage === undefined) return undefined
  const input = count(usage.inputTokens)
  const output = count(usage.outputTokens)
  const cacheRead = usage.cacheReadTokens === undefined ? 0 : count(usage.cacheReadTokens)
  const cacheWrite = usage.cacheWriteTokens === undefined ? 0 : count(usage.cacheWriteTokens)
  if (input === undefined || output === undefined || cacheRead === undefined || cacheWrite === undefined) return undefined
  if (!Number.isSafeInteger(input + output + cacheRead + cacheWrite)) return undefined
  return { input, output, cacheRead, cacheWrite }
}

function stepKey(data: Record<string, unknown> | undefined): string | undefined {
  const turn = count(data?.turn)
  const step = count(data?.step)
  return turn === undefined || step === undefined ? undefined : turn + ':' + step
}

/**
 * Whether a recorded provider id belongs to this plugin.
 * @param provider - the provider id in a request header or summary event.
 * @param at - the request start time.
 * @param cutoff - legacy route cutoff, overridable in tests.
 * @returns true when the request is this plugin's.
 */
export function isPluginRoute(provider: unknown, at: number, cutoff = LEGACY_ROUTE_CUTOFF_MS): boolean {
  return provider === PROVIDER_ID || provider === LEGACY_PROVIDER_ID && at < cutoff
}

/**
 * Fold one session snapshot.
 * @param snapshot - complete raw event log plus its fork-inherited prefix length.
 * @param options - test seams; the cutoff defaults to the 0.1.16 release.
 * @returns the session's priceable facts and counters.
 */
export function foldSession(
  snapshot: AnalyticsSnapshotLike,
  options: { cutoff?: number } = {},
): FoldedSession {
  const inherited = count(snapshot.inheritedEventCount) ?? 0
  const cutoff = options.cutoff ?? LEGACY_ROUTE_CUTOFF_MS
  const facts: RequestFact[] = []
  const attempts: number[] = []
  const unattributed: number[] = []
  const stepStarts = new Map<string, number>()
  let header: { provider: string; model?: string } | undefined

  for (const event of snapshot.events) {
    const seq = count(event.seq)
    if (seq === undefined || seq <= inherited) continue
    const eventTime = count(event.time)
    const data = record(event.data)

    if (event.type === 'request/header') {
      const config = record(record(data?.header)?.config)
      const provider = typeof config?.provider === 'string' ? config.provider : undefined
      const model = typeof config?.model === 'string' && config.model ? config.model : undefined
      header = provider === undefined ? undefined : { provider, ...(model === undefined ? {} : { model }) }
      continue
    }

    if (event.type === 'step/start' || event.type === 'step/end') {
      const key = stepKey(data)
      if (key === undefined || eventTime === undefined) continue
      if (event.type === 'step/start') stepStarts.set(key, eventTime)
      else stepStarts.delete(key)
      continue
    }

    if (event.type === 'assistant/message') {
      const at = stepStarts.get(stepKey(data) ?? '') ?? eventTime
      if (at === undefined) continue
      if (header === undefined) { unattributed.push(at); continue }
      if (!isPluginRoute(header.provider, at, cutoff)) continue
      const messageModel = record(data?.message)?.model
      const model = typeof messageModel === 'string' && messageModel ? messageModel : header.model
      if (model === undefined) { unattributed.push(at); continue }
      const usage = usageOf(data?.usage)
      facts.push({
        at, model, kind: 'message', legacy: header.provider === LEGACY_PROVIDER_ID,
        missingUsage: usage === undefined,
        input: usage?.input ?? 0, output: usage?.output ?? 0,
        cacheRead: usage?.cacheRead ?? 0, cacheWrite: usage?.cacheWrite ?? 0,
      })
      continue
    }

    if (event.type === 'compaction/summary') {
      if (eventTime === undefined) continue
      const provider = data?.provider
      if (typeof provider !== 'string' || !isPluginRoute(provider, eventTime, cutoff)) continue
      const model = typeof data?.model === 'string' && data.model ? data.model : undefined
      if (model === undefined) { unattributed.push(eventTime); continue }
      const usage = usageOf(data?.usage)
      facts.push({
        at: eventTime, model, kind: 'summary', legacy: provider === LEGACY_PROVIDER_ID,
        missingUsage: usage === undefined,
        input: usage?.input ?? 0, output: usage?.output ?? 0,
        cacheRead: usage?.cacheRead ?? 0, cacheWrite: usage?.cacheWrite ?? 0,
      })
      continue
    }

    if (event.type === 'assistant/attempt') {
      const at = stepStarts.get(stepKey(data) ?? '') ?? eventTime
      if (at === undefined || header === undefined) continue
      if (isPluginRoute(header.provider, at, cutoff)) attempts.push(at)
    }
  }

  return { facts, attempts, unattributed, events: snapshot.events.length }
}
