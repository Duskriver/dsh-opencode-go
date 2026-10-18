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
  /** Events that passed the fork-prefix filter — never the inherited prefix (review P11). */
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
  // Field-level degradation (review P8): a present-but-malformed component only
  // degrades that component to 0 so partially valid tokens still reach the
  // report; the whole usage counts as missing when input AND output are both
  // missing or malformed. The safe-integer sum check runs on the degraded
  // values and still rejects the report when they could overflow.
  if (input === undefined && output === undefined) return undefined
  const cacheRead = (usage.cacheReadTokens === undefined ? 0 : count(usage.cacheReadTokens)) ?? 0
  const cacheWrite = (usage.cacheWriteTokens === undefined ? 0 : count(usage.cacheWriteTokens)) ?? 0
  const sum = (input ?? 0) + (output ?? 0) + cacheRead + cacheWrite
  if (!Number.isSafeInteger(sum)) return undefined
  return { input: input ?? 0, output: output ?? 0, cacheRead, cacheWrite }
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
  let lastStart: number | undefined
  let header: { provider: string; model?: string } | undefined
  let ownEvents = 0

  // Half-open ownership, matching the host's isOwnSeq (dsh-session
  // lib/index.js:1192-1194: `seq >= this.inheritedEventCount && seq < this.seq`):
  // the boundary slot seq === inheritedEventCount belongs to this session, and
  // only the prefix strictly below it is inherited. Skipping `seq <= inherited`
  // here would drop the session's first own event.
  for (const event of snapshot.events) {
    const seq = count(event.seq)
    if (seq === undefined || seq < inherited) continue
    ownEvents++
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
      if (event.type === 'step/start') {
        if (eventTime === undefined) continue
        if (key !== undefined) stepStarts.set(key, eventTime)
        // Track the latest start even when the key is malformed (review P10):
        // legacy, damaged and truncated logs omit turn/step, and falling back
        // to the completion time double-counts peak pricing, shifts day
        // buckets and flips the legacy-route cutoff.
        lastStart = eventTime
      } else if (key !== undefined) {
        stepStarts.delete(key)
      }
      continue
    }

    if (event.type === 'assistant/message') {
      const at = stepStarts.get(stepKey(data) ?? '') ?? lastStart ?? eventTime
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
      // Contract: the host defines assistant/attempt as one model attempt that
      // "committed no surface message" (dsh-session lib/types/types.d.ts:318-327;
      // shape {turn, step, stream} — no usage, no message), so every settled
      // model call surfaces as either an assistant/message or an
      // assistant/attempt, never both. We collect unconditionally and do not
      // de-duplicate against facts: a double count would require the host to
      // violate its own contract, and silently dropping one side would hide
      // exactly that violation.
      const at = stepStarts.get(stepKey(data) ?? '') ?? lastStart ?? eventTime
      if (at === undefined) continue
      // A headless attempt cannot be attributed to a route, but it must not
      // vanish without a trace (review U14 / P12 scan half): record its time
      // as unattributed instead of an attempt.
      if (header === undefined) { unattributed.push(at); continue }
      if (isPluginRoute(header.provider, at, cutoff)) attempts.push(at)
    }
  }

  return { facts, attempts, unattributed, events: ownEvents }
}
