/**
 * Persistent, revision-keyed cache of folded session analytics.
 *
 * A process restart empties the in-memory LRU in analytics.ts, so a cold scan
 * would re-read every archived session. This module stores the
 * range-independent fold results under the DSH cache directory and lets a later
 * process reuse a session whose durable revision is unchanged. The envelope
 * carries a version and compact arrays; decoding is strict, and any missing,
 * corrupt, oversized or unwritable file behaves exactly like an empty cache.
 * Session ids are only cache keys — no titles, message text or credentials are
 * ever stored.
 *
 * @module dsh-opencode-go/analytics-fold-cache
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { RequestFact } from './analytics-scan.ts'

/** Envelope version; a different version is treated as no cache. */
export const ANALYTICS_FOLD_CACHE_VERSION = 1
/** The whole encoded document may not exceed this size. */
export const ANALYTICS_FOLD_CACHE_MAX_BYTES = 32 * 1024 * 1024
/** An entry not refreshed for this long may be dropped at the next write. */
export const ANALYTICS_FOLD_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Structural caps that keep a corrupt document from exhausting memory. */
const MAX_ENTRIES = 4096
const MAX_FACTS = 200_000
const MAX_MARKS = 200_000
const MAX_ID_LENGTH = 256
const MAX_REVISION_LENGTH = 512
const MAX_MODEL_LENGTH = 256

/** Fact tuple flags: one byte keeps legacy, summary and missing-usage bits. */
const FACT_LEGACY = 1
const FACT_SUMMARY = 2
const FACT_MISSING_USAGE = 4
const FACT_FLAGS_MAX = FACT_LEGACY | FACT_SUMMARY | FACT_MISSING_USAGE

/** One session's fold plus the revision it was computed from. */
export interface AnalyticsFoldEntry {
  /** The durable revision of the session this fold was read from. */
  readonly revision: string
  /** When the fold was computed; drives age and capacity eviction. */
  readonly storedAt: number
  readonly createdAt: number
  /** Events that passed the fork-prefix filter when the fold ran. */
  readonly events: number
  readonly facts: RequestFact[]
  readonly attempts: number[]
  readonly unattributed: number[]
}

/** Path options; tests point the cache at a temporary home. */
export interface AnalyticsFoldCachePathOptions {
  /** DSH home directory; defaults to $DSH_HOME, then ~/.dsh. */
  readonly home?: string
}

/** The default cache location, honoring DSH_HOME and the test override. */
export function analyticsFoldCachePath(options: AnalyticsFoldCachePathOptions = {}): string {
  const home = options.home?.trim() || process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return resolve(home, 'cache', 'dsh-opencode-go', 'analytics-folds.v1.json')
}

function validString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function encodeFact(fact: RequestFact): unknown[] {
  const flags = (fact.legacy ? FACT_LEGACY : 0)
    | (fact.kind === 'summary' ? FACT_SUMMARY : 0)
    | (fact.missingUsage ? FACT_MISSING_USAGE : 0)
  return [fact.at, fact.model, fact.input, fact.output, fact.cacheRead, fact.cacheWrite, flags]
}

function decodeFacts(value: unknown): RequestFact[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_FACTS) return undefined
  const facts: RequestFact[] = []
  for (const raw of value) {
    if (!Array.isArray(raw) || raw.length !== 7) return undefined
    const [at, model, input, output, cacheRead, cacheWrite, flags] = raw as unknown[]
    if (!validCount(at) || !validString(model, MAX_MODEL_LENGTH)) return undefined
    if (!validCount(input) || !validCount(output)) return undefined
    if (!validCount(cacheRead) || !validCount(cacheWrite)) return undefined
    if (!validCount(flags) || flags > FACT_FLAGS_MAX) return undefined
    facts.push({
      at,
      model,
      input,
      output,
      cacheRead,
      cacheWrite,
      legacy: (flags & FACT_LEGACY) !== 0,
      kind: (flags & FACT_SUMMARY) !== 0 ? 'summary' : 'message',
      missingUsage: (flags & FACT_MISSING_USAGE) !== 0,
    })
  }
  return facts
}

function decodeMarks(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_MARKS) return undefined
  const marks: number[] = []
  for (const mark of value) {
    if (!validCount(mark)) return undefined
    marks.push(mark)
  }
  return marks
}

/**
 * Whether an entry is inside the decoder's strict field limits. The writer
 * skips entries that would not survive a reload, so one anomalous session can
 * never invalidate the whole cache on the next start.
 */
function encodable(id: string, entry: AnalyticsFoldEntry): boolean {
  if (!validString(id, MAX_ID_LENGTH) || !validString(entry.revision, MAX_REVISION_LENGTH)) return false
  if (!validCount(entry.storedAt) || !validCount(entry.createdAt) || !validCount(entry.events)) return false
  if (!Array.isArray(entry.facts) || entry.facts.length > MAX_FACTS) return false
  if (!Array.isArray(entry.attempts) || entry.attempts.length > MAX_MARKS) return false
  if (!Array.isArray(entry.unattributed) || entry.unattributed.length > MAX_MARKS) return false
  for (const fact of entry.facts) {
    if (!validCount(fact.at) || !validString(fact.model, MAX_MODEL_LENGTH)) return false
    if (!validCount(fact.input) || !validCount(fact.output)) return false
    if (!validCount(fact.cacheRead) || !validCount(fact.cacheWrite)) return false
  }
  for (const mark of entry.attempts) if (!validCount(mark)) return false
  for (const mark of entry.unattributed) if (!validCount(mark)) return false
  return true
}

/**
 * Encode entries into the versioned envelope. Facts are compact tuples whose
 * exact field count is checked again on decode.
 * @param entries - cache key to fold entry pairs.
 * @returns the JSON document.
 */
export function encodeFoldCache(entries: Iterable<readonly [string, AnalyticsFoldEntry]>): string {
  const sessions: unknown[][] = []
  for (const [id, entry] of entries) {
    sessions.push([
      id,
      entry.revision,
      entry.storedAt,
      entry.createdAt,
      entry.events,
      entry.facts.map(encodeFact),
      entry.attempts,
      entry.unattributed,
    ])
  }
  return JSON.stringify({ version: ANALYTICS_FOLD_CACHE_VERSION, sessions })
}

/**
 * Decode the versioned envelope. Every field is validated before it reaches
 * the scan: a single malformed session discards the whole document, so a
 * damaged file degrades to "no cache" instead of a partially trusted one.
 * @param text - the JSON document.
 * @returns the decoded map, or undefined when anything is invalid.
 */
export function decodeFoldCache(text: string): Map<string, AnalyticsFoldEntry> | undefined {
  if (typeof text !== 'string') return undefined
  if (Buffer.byteLength(text) > ANALYTICS_FOLD_CACHE_MAX_BYTES) return undefined
  let document: unknown
  try {
    document = JSON.parse(text) as unknown
  } catch {
    return undefined
  }
  if (!isRecord(document) || document.version !== ANALYTICS_FOLD_CACHE_VERSION) return undefined
  if (!Array.isArray(document.sessions) || document.sessions.length > MAX_ENTRIES) return undefined
  const entries = new Map<string, AnalyticsFoldEntry>()
  for (const raw of document.sessions) {
    if (!Array.isArray(raw) || raw.length !== 8) return undefined
    const [id, revision, storedAt, createdAt, events, rawFacts, rawAttempts, rawUnattributed] = raw as unknown[]
    if (!validString(id, MAX_ID_LENGTH) || !validString(revision, MAX_REVISION_LENGTH)) return undefined
    if (!validCount(storedAt) || !validCount(createdAt) || !validCount(events)) return undefined
    const facts = decodeFacts(rawFacts)
    const attempts = decodeMarks(rawAttempts)
    const unattributed = decodeMarks(rawUnattributed)
    if (facts === undefined || attempts === undefined || unattributed === undefined) return undefined
    // Duplicate keys are corruption, not a merge: the encoder never emits them.
    if (entries.has(id)) return undefined
    entries.set(id, { revision, storedAt, createdAt, events, facts, attempts, unattributed })
  }
  return entries
}

/** Optional byte cap for load/save; tests use a small cap. */
export interface AnalyticsFoldCacheLimits {
  readonly maxBytes?: number
}

/**
 * Load the cache. Any failure — absent file, unreadable path, oversized file,
 * invalid JSON or invalid fields — resolves to an empty map.
 * @param path - cache file path.
 * @param options - byte-cap override.
 * @returns the entries that passed validation.
 */
export async function loadFoldCache(
  path: string,
  options: AnalyticsFoldCacheLimits = {},
): Promise<Map<string, AnalyticsFoldEntry>> {
  const limit = options.maxBytes ?? ANALYTICS_FOLD_CACHE_MAX_BYTES
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size > limit) return new Map()
    const bytes = await readFile(path)
    if (bytes.byteLength > limit) return new Map()
    return decodeFoldCache(bytes.toString('utf8')) ?? new Map()
  } catch {
    return new Map()
  }
}

/**
 * Atomically write the cache, dropping the oldest entries by storedAt until
 * the encoded document fits the byte cap. A failed write returns false and
 * leaves any previous valid file in place.
 * @param path - cache file path.
 * @param entries - key/value pairs to persist.
 * @param options - byte-cap override.
 * @returns whether the file was replaced.
 */
export async function saveFoldCache(
  path: string,
  entries: Iterable<readonly [string, AnalyticsFoldEntry]>,
  options: AnalyticsFoldCacheLimits = {},
): Promise<boolean> {
  const limit = options.maxBytes ?? ANALYTICS_FOLD_CACHE_MAX_BYTES
  const prefix = `{"version":${ANALYTICS_FOLD_CACHE_VERSION},"sessions":[`
  const suffix = ']}'
  interface EncodedSession {
    readonly storedAt: number
    readonly text: string
    readonly bytes: number
  }
  const rows: EncodedSession[] = []
  let content: string
  try {
    for (const [id, entry] of entries) {
      if (!encodable(id, entry)) continue
      const session = [
        id,
        entry.revision,
        entry.storedAt,
        entry.createdAt,
        entry.events,
        entry.facts.map(encodeFact),
        entry.attempts,
        entry.unattributed,
      ]
      const text = JSON.stringify(session)
      if (text === undefined) return false
      rows.push({ storedAt: entry.storedAt, text, bytes: Buffer.byteLength(text) })
    }
    // Oldest first: eviction removes from the front, so an over-cap write drops
    // the entries least recently verified rather than an arbitrary suffix.
    rows.sort((left, right) => left.storedAt - right.storedAt)
    let total = Buffer.byteLength(prefix) + Buffer.byteLength(suffix)
    for (const row of rows) total += row.bytes
    total += Math.max(0, rows.length - 1)
    let start = 0
    while (start < rows.length && total > limit) {
      total -= rows[start].bytes
      if (rows.length - start > 1) total -= 1
      start++
    }
    if (total > limit) return false
    content = prefix + rows.slice(start).map(row => row.text).join(',') + suffix
    if (Buffer.byteLength(content) > limit) return false
  } catch {
    // A malformed entry must not escape as a rejection: persistence is
    // best-effort and the caller only consumes a boolean.
    return false
  }
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 })
    await rename(temporary, path)
    return true
  } catch {
    return false
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}
