/**
 * Wire contract for the usage dashboard. The Host scans local session history,
 * prices each request, and returns aggregate numbers only: no session ids,
 * titles, working directories, message content or credentials cross this seam.
 *
 * @module dsh-opencode-go/analytics-contract
 */

import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'

/** Why an analytics read failed. */
export type AnalyticsFailureReason = 'no-session-query' | 'invalid-range' | 'scan-failed'

/** One dashboard read. Dates are Unix epoch milliseconds. */
export interface AnalyticsQuery {
  /** Inclusive start. */
  from: number
  /** Exclusive end. */
  to: number
  /** IANA timezone used to bucket days. */
  timeZone: string
  /** Session scan cap, 1..2000; the Host default applies when absent. */
  maxSessions?: number
}

/** Totals over the requested range. */
export interface AnalyticsTotals {
  requests: number
  unsettledAttempts: number
  summaries: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedMicroUsd: number
  pricedRequests: number
  unpricedRequests: number
  missingUsage: number
}

/** One model's share of the range. */
export interface AnalyticsModelRow {
  model: string
  name?: string
  requests: number
  missingUsage: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedMicroUsd: number
  pricedRequests: number
  unpricedRequests: number
  /** Go monthly limit in USD; null when unlimited or unknown. */
  limitGoUsd: number | null
  /** Go Plus monthly limit in USD; null when unlimited or unknown. */
  limitGoPlusUsd: number | null
  limitNote?: 'unlimited' | 'limited-time' | 'unknown'
}

/** One local calendar day. */
export interface AnalyticsDayRow {
  /** YYYY-MM-DD in the query timezone. */
  day: string
  requests: number
  tokens: number
  estimatedMicroUsd: number
}

/**
 * How complete the scan was.
 *
 * Newer fields are optional numbers so an older client — whose strict report
 * codec passes unknown keys through — keeps accepting the report. Never add a
 * value to the truncation/limitNote enums for the same reason (see the
 * whitelist note below).
 */
export interface AnalyticsCoverage {
  listedSessions: number
  scannedSessions: number
  matchedSessions: number
  failedSessions: number
  eventsScanned: number
  summaries: number
  legacyRequests: number
  missingUsage: number
  truncated: boolean
  truncation?: 'sessions' | 'events' | 'time'
  scanMs: number
  timeZoneFallback?: true
  /**
   * Sessions listed but never scanned because the slice cap or a budget
   * stopped first (review P16/P18/M1). Observability only — this never
   * implies the requested range was fully covered.
   */
  unreadSessions?: number
  /**
   * Cache entries the end-of-run trim dropped after this report was computed
   * from run-local results; the next run re-reads them (review P3/S1).
   */
  evictedSessions?: number
  /**
   * Model calls in range with no usable routing header or model id, counted
   * for visibility only — never in tokens or cost (review P12).
   */
  unattributedRequests?: number
  /** Session listing wall time; scanMs excludes it (review S6). */
  listMs?: number
  /** Pricing harvest wall time; scanMs excludes it (review S6/P4). */
  pricingMs?: number
}

/** Where the prices came from. */
export interface AnalyticsPricing {
  source: 'models.dev'
  updatedAt?: number
  /**
   * True only when the whole price table was unavailable; unpricedModels then
   * lists every model that actually appeared in the range (review P15). A
   * table that loaded but lacks a model leaves this unset and lists the model.
   */
  unavailable?: true
  unpricedModels: string[]
}

/** One complete dashboard response. */
export interface AnalyticsReport {
  generatedAt: number
  range: { from: number; to: number }
  timeZone: string
  totals: AnalyticsTotals
  byModel: AnalyticsModelRow[]
  byDay: AnalyticsDayRow[]
  coverage: AnalyticsCoverage
  pricing: AnalyticsPricing
}

const MAX_TIME = 8_640_000_000_000_000
const MAX_RANGE_MS = 366 * 86_400_000
const MAX_SESSIONS = 2000

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid analytics ' + field)
  return value as Record<string, unknown>
}

function integer(value: unknown, field: string, min = 0, max = MAX_TIME): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error('Invalid analytics ' + field)
  }
  return value
}

function amount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) {
    throw new Error('Invalid analytics ' + field)
  }
  return value
}

function text(value: unknown, field: string, max = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Invalid analytics ' + field)
  }
  return value
}

function list(value: unknown, field: string, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid analytics ' + field)
  return value
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid analytics ' + field)
  return value
}

function optionalAmount(value: unknown, field: string): number | null {
  return value === null ? null : amount(value, field)
}

// Compat rule (review P3/S1-lite): never extend these whitelists — together
// with the strict codecs below they make an old client reject the whole
// report. Evolve through optional number/string fields instead; the report
// validator ignores unknown keys.
const TRUNCATIONS = ['sessions', 'events', 'time'] as const
const NOTES = ['unlimited', 'limited-time', 'unknown'] as const

/**
 * Validate one query. Unknown fields are ignored so a newer client can add
 * optional knobs without breaking an older Host.
 * @param value - raw RPC argument.
 * @returns the validated query.
 */
export function parseAnalyticsQuery(value: unknown): AnalyticsQuery {
  const row = object(value, 'query')
  const from = integer(row.from, 'query.from')
  const to = integer(row.to, 'query.to', 1)
  if (from >= to) throw new Error('Invalid analytics range')
  if (to - from > MAX_RANGE_MS) throw new Error('Invalid analytics range')
  const timeZone = text(row.timeZone, 'query.timeZone', 64)
  if (!/^[A-Za-z0-9_+\-/]+$/.test(timeZone)) throw new Error('Invalid analytics timezone')
  const maxSessions = row.maxSessions === undefined
    ? undefined : integer(row.maxSessions, 'query.maxSessions', 1, MAX_SESSIONS)
  return { from, to, timeZone, ...(maxSessions === undefined ? {} : { maxSessions }) }
}

function validateTotals(value: unknown): void {
  const row = object(value, 'totals')
  for (const key of ['requests', 'unsettledAttempts', 'summaries', 'inputTokens', 'outputTokens',
    'cacheReadTokens', 'cacheWriteTokens', 'estimatedMicroUsd', 'pricedRequests', 'unpricedRequests', 'missingUsage']) {
    integer(row[key], 'totals.' + key)
  }
}

function validateModel(value: unknown): void {
  const row = object(value, 'model')
  text(row.model, 'model.model')
  if (row.name !== undefined) text(row.name, 'model.name')
  for (const key of ['requests', 'missingUsage', 'inputTokens', 'outputTokens', 'cacheReadTokens',
    'cacheWriteTokens', 'estimatedMicroUsd', 'pricedRequests', 'unpricedRequests']) integer(row[key], 'model.' + key)
  optionalAmount(row.limitGoUsd, 'model.limitGoUsd')
  optionalAmount(row.limitGoPlusUsd, 'model.limitGoPlusUsd')
  if (row.limitNote !== undefined && !NOTES.includes(row.limitNote as never)) throw new Error('Invalid analytics model.limitNote')
}

function validateDay(value: unknown): void {
  const row = object(value, 'day')
  const day = text(row.day, 'day.day', 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid analytics day')
  const parsed = new Date(day + 'T00:00:00Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) throw new Error('Invalid analytics day')
  integer(row.requests, 'day.requests')
  integer(row.tokens, 'day.tokens')
  integer(row.estimatedMicroUsd, 'day.estimatedMicroUsd')
}

function validateCoverage(value: unknown): void {
  const row = object(value, 'coverage')
  for (const key of ['listedSessions', 'scannedSessions', 'matchedSessions', 'failedSessions', 'eventsScanned',
    'summaries', 'legacyRequests', 'missingUsage', 'scanMs']) integer(row[key], 'coverage.' + key)
  // Optional observability fields (review P16/P18/P12/S6): validated when a
  // newer Host sends them, absent when an older Host does not.
  for (const key of ['unreadSessions', 'evictedSessions', 'unattributedRequests', 'listMs', 'pricingMs']) {
    if (row[key] !== undefined) integer(row[key], 'coverage.' + key)
  }
  bool(row.truncated, 'coverage.truncated')
  if (row.truncation !== undefined && !TRUNCATIONS.includes(row.truncation as never)) throw new Error('Invalid analytics truncation')
  if (row.timeZoneFallback !== undefined && row.timeZoneFallback !== true) throw new Error('Invalid analytics timezone fallback')
}

function validatePricing(value: unknown): void {
  const row = object(value, 'pricing')
  if (row.source !== 'models.dev') throw new Error('Invalid analytics pricing source')
  if (row.updatedAt !== undefined) integer(row.updatedAt, 'pricing.updatedAt')
  if (row.unavailable !== undefined && row.unavailable !== true) throw new Error('Invalid analytics pricing state')
  for (const model of list(row.unpricedModels, 'pricing.unpricedModels', 256)) text(model, 'pricing.unpricedModels', 128)
}

/**
 * Validate one dashboard response.
 * @param value - raw RPC result.
 * @returns the validated report.
 */
export function parseAnalyticsReport(value: unknown): AnalyticsReport {
  const row = object(value, 'report')
  integer(row.generatedAt, 'generatedAt')
  const range = object(row.range, 'range')
  const from = integer(range.from, 'range.from')
  const to = integer(range.to, 'range.to', 1)
  if (from >= to) throw new Error('Invalid analytics range')
  text(row.timeZone, 'timeZone', 64)
  validateTotals(row.totals)
  for (const model of list(row.byModel, 'byModel', 256)) validateModel(model)
  for (const day of list(row.byDay, 'byDay', 366)) validateDay(day)
  validateCoverage(row.coverage)
  validatePricing(row.pricing)
  return value as AnalyticsReport
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'opencode-go/analytics-unavailable': {
      readonly reason: AnalyticsFailureReason
      readonly retryable: boolean
    }
  }
  interface TypertRemoteNamespaceMap {
    opencodeGoAnalytics: {
      read(query: AnalyticsQuery, signal?: AbortSignal): Promise<RemoteResult<AnalyticsReport>>
    }
  }
}

const queryCodec = {
  mode: 'strict' as const,
  typeSymbol: 'dsh-opencode-go#AnalyticsQuery',
  schema: { parse: parseAnalyticsQuery },
  create: () => ({ parse: parseAnalyticsQuery }),
}

const reportCodec = {
  mode: 'strict' as const,
  typeSymbol: 'dsh-opencode-go#AnalyticsReport',
  schema: { parse: parseAnalyticsReport },
  create: () => ({ parse: parseAnalyticsReport }),
}

/** The dashboard endpoint, mounted with the other plugin remotes. */
export const analyticsRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [{
    id: 'dsh-opencode-go#opencodeGoAnalytics/read',
    service: 'opencodeGoAnalytics',
    namespace: 'opencodeGoAnalytics',
    method: 'read',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'query', wire: 'query', source: 'json', codec: queryCodec }],
    // Review M4: the signal is injected after the business parameters and
    // never enters the wire args, so single-argument callers keep working
    // (precedent: dsh-llm discoverModels, typert.remote-client.js:62).
    cancellation: { parameter: 'signal' },
    result: reportCodec,
  }],
}
