/** Official Console history: bounded CSV reads and exact UTC aggregates. */
import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  assertProxyURL, parseAnalyticsQuery, validReleaseDate,
  type AnalyticsQuery, type AnalyticsRange, type AnalyticsTotals, type AnalyticsReport,
  type AnalyticsExport, type AnalyticsFailureReason,
} from './contracts.ts'
import { ProxyTransport, readUsageError, transportFailure, waitWithSignal } from './transport.ts'

export const ANALYTICS_MAX_BYTES = 16 * 1024 * 1024
const CACHE_MS = 30_000
const REQUEST_TIMEOUT_MS = 30_000
const CONSOLE_ORIGIN = 'https://opencode.ai'
const DAY_MS = 86_400_000
const CSV_COLUMNS = ['day', 'user_type', 'user_id', 'user_name', 'provider', 'model', 'requests',
  'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_5m_tokens',
  'cache_write_1h_tokens', 'cost_micro_cents', 'cost_usd'] as const
const TOTAL_FIELDS: readonly (keyof AnalyticsTotals)[] = ['requests', 'inputTokens', 'outputTokens',
  'cacheReadTokens', 'cacheWrite5mTokens', 'cacheWrite1hTokens', 'cacheWriteTokens', 'tokens', 'costMicroCents']

export interface AnalyticsOptions {
  baseURL: () => string
  proxyURL?: () => string
  transport?: ProxyTransport
  resolveApiKey: (ref: string) => Promise<string | undefined>
  accountRefs: () => readonly string[]
  now?: () => number
  fetch?: typeof globalThis.fetch
}

type BigTotals = Record<keyof AnalyticsTotals, bigint>
interface HistoryRow { day: string; provider: string; model: string; totals: BigTotals; fields: string[] }
interface ParsedCsv { header: string[]; rows: HistoryRow[] }
interface Identity { accountRef: string; baseURL: string; proxyURL: string; key: string; source: string }
interface Dataset extends ParsedCsv { csv: string; generatedAt: number; day: string; source: string }
interface Pending { promise: Promise<Dataset>; controller: AbortController; consumers: number; source: string }

function invalidCsv(): never { throw new SyntaxError('Invalid official usage CSV') }

/** RFC 4180 fields, including quoted CRLF, commas and doubled quotes. */
function csvRecords(raw: string): string[][] {
  const csv = raw.replace(/^\uFEFF/, '')
  if (!csv || csv.includes('\0')) return invalidCsv()
  const records: string[][] = []
  let row: string[] = [], field = ''
  let state: 'start' | 'bare' | 'quoted' | 'closed' = 'start'
  let ended = false
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index]
    ended = false
    if (state === 'quoted') {
      if (char === '"') {
        if (csv[index + 1] === '"') { field += '"'; index++ }
        else state = 'closed'
      } else field += char
      continue
    }
    if (char === ',') { row.push(field); field = ''; state = 'start'; continue }
    if (char === '\r' || char === '\n') {
      if (char === '\r') {
        if (csv[index + 1] !== '\n') return invalidCsv()
        index++
      }
      row.push(field)
      records.push(row)
      row = []; field = ''; state = 'start'; ended = true
      continue
    }
    if (state === 'closed') return invalidCsv()
    if (char === '"') {
      if (state !== 'start') return invalidCsv()
      state = 'quoted'
    } else { field += char; state = 'bare' }
  }
  if (state === 'quoted') return invalidCsv()
  if (!ended) { row.push(field); records.push(row) }
  return records
}

function exactInteger(value: string): bigint {
  if (!/^\d{1,100}$/.test(value)) return invalidCsv()
  return BigInt(value)
}

function zero(): BigTotals {
  return { requests: 0n, inputTokens: 0n, outputTokens: 0n, cacheReadTokens: 0n,
    cacheWrite5mTokens: 0n, cacheWrite1hTokens: 0n, cacheWriteTokens: 0n, tokens: 0n, costMicroCents: 0n }
}

function add(target: BigTotals, value: BigTotals): void {
  for (const field of TOTAL_FIELDS) target[field] += value[field]
}

function strings(value: BigTotals): AnalyticsTotals {
  return Object.fromEntries(TOTAL_FIELDS.map(field => [field, value[field].toString()])) as unknown as AnalyticsTotals
}

function parseCsv(csv: string): ParsedCsv {
  const [header, ...records] = csvRecords(csv)
  if (!header || header.length !== CSV_COLUMNS.length || new Set(header).size !== header.length
    || CSV_COLUMNS.some(column => !header.includes(column))) return invalidCsv()
  const columns = Object.fromEntries(header.map((column, index) => [column, index]))
  const rows = records.map(fields => {
    if (fields.length !== header.length) return invalidCsv()
    const get = (column: typeof CSV_COLUMNS[number]): string => fields[columns[column]]
    const day = get('day'), provider = get('provider'), model = get('model')
    if (!validReleaseDate(day) || !provider.trim() || !model.trim() || provider.length > 1024 || model.length > 1024
      || /[\u0000-\u001f\u007f]/.test(provider + model)) return invalidCsv()
    const totals: BigTotals = {
      requests: exactInteger(get('requests')), inputTokens: exactInteger(get('input_tokens')),
      outputTokens: exactInteger(get('output_tokens')), cacheReadTokens: exactInteger(get('cache_read_tokens')),
      cacheWrite5mTokens: exactInteger(get('cache_write_5m_tokens')), cacheWrite1hTokens: exactInteger(get('cache_write_1h_tokens')),
      cacheWriteTokens: 0n, tokens: 0n, costMicroCents: exactInteger(get('cost_micro_cents')),
    }
    totals.cacheWriteTokens = totals.cacheWrite5mTokens + totals.cacheWrite1hTokens
    totals.tokens = totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
    // The optional display precision never overrides the exact billed integer.
    const usd = get('cost_usd')
    if (!/^\d{1,100}(?:\.\d{1,100})?$/.test(usd)) return invalidCsv()
    return { fields, day, provider, model, totals }
  })
  return { header, rows }
}

function utcDay(now: number): string { return new Date(now).toISOString().slice(0, 10) }

function rangeOf(period: AnalyticsRange, now: number): { from: number; to: number } {
  const days = period === 'today' ? 1 : Number(period.slice(0, -1))
  return { from: Math.floor(now / DAY_MS) * DAY_MS - (days - 1) * DAY_MS, to: now }
}

function rowsIn(data: Dataset, period: AnalyticsRange): HistoryRow[] {
  const range = rangeOf(period, data.generatedAt)
  const from = utcDay(range.from), to = utcDay(range.to)
  return data.rows.filter(row => row.day >= from && row.day <= to)
}

function aggregate(data: Dataset, query: AnalyticsQuery): AnalyticsReport {
  const totals = zero()
  const models = new Map<string, { provider: string; model: string; totals: BigTotals }>()
  const days = new Map<string, BigTotals>()
  const range = rangeOf(query.range, data.generatedAt)
  for (let time = range.from; time <= Math.floor(range.to / DAY_MS) * DAY_MS; time += DAY_MS) days.set(utcDay(time), zero())
  for (const row of rowsIn(data, query.range)) {
    add(totals, row.totals)
    add(days.get(row.day)!, row.totals)
    const id = JSON.stringify([row.provider, row.model])
    let model = models.get(id)
    if (!model) { model = { provider: row.provider, model: row.model, totals: zero() }; models.set(id, model) }
    add(model.totals, row.totals)
  }
  return {
    accountRef: query.accountRef, source: data.source, generatedAt: data.generatedAt,
    period: query.range, range, timeZone: 'UTC', totals: strings(totals),
    byModel: [...models.values()].sort((a, b) => a.totals.costMicroCents > b.totals.costMicroCents ? -1
      : a.totals.costMicroCents < b.totals.costMicroCents ? 1 : a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
      .map(row => ({ provider: row.provider, model: row.model, ...strings(row.totals) })),
    byDay: [...days].map(([day, value]) => ({ day, ...strings(value) })),
  }
}

function encodeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(value => /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value).join(',')).join('\r\n') + '\r\n'
}

/** The Host retains the official CSV; ordinary reads expose only aggregate numbers. */
export class GoAnalyticsService extends TypertRemoteService {
  private readonly identities = new Map<string, Identity>()
  private readonly cache = new Map<string, Dataset>()
  private readonly pending = new Map<string, Pending>()
  private readonly active = new Set<Pending>()
  private readonly transport: ProxyTransport

  constructor(ctx: Context, private readonly options: AnalyticsOptions) {
    super(ctx, 'opencodeGoAnalytics')
    this.transport = options.transport ?? new ProxyTransport()
    ctx.effect(() => () => {
      for (const pending of this.active) pending.controller.abort()
      this.active.clear()
      this.pending.clear(); this.cache.clear(); this.identities.clear()
      if (!options.transport) return this.transport.dispose()
    })
  }

  async read(raw: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsReport> {
    const query = this.query(raw)
    return aggregate(await this.dataset(query, signal), query)
  }

  async exportCsv(raw: AnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsExport> {
    const query = this.query(raw)
    const data = await this.dataset(query, signal)
    return {
      filename: 'opencode-usage-' + query.range + '-' + data.day + '.csv',
      csv: encodeCsv([data.header, ...rowsIn(data, query.range).map(row => row.fields)]),
    }
  }

  private now(): number { return this.options.now?.() ?? Date.now() }

  private query(raw: AnalyticsQuery): AnalyticsQuery {
    try { return parseAnalyticsQuery(raw) }
    catch { throw this.failure('invalid-query', 'Invalid official usage history query', false) }
  }

  private failure(reason: AnalyticsFailureReason, message: string, retryable: boolean, source?: string, retainPrevious = retryable): RemoteError {
    return new RemoteError('opencode-go/analytics-unavailable', message, {
      reason, retryable, retainPrevious, ...(source ? { source } : {}),
    })
  }

  private forget(identity: Identity): void {
    this.identities.delete(identity.accountRef)
    for (const [key, data] of this.cache) if (data.source === identity.source) this.cache.delete(key)
    for (const pending of this.active) if (pending.source === identity.source) pending.controller.abort()
    for (const [key, pending] of this.pending) if (pending.source === identity.source) this.pending.delete(key)
  }

  private network(): { baseURL: string; proxyURL: string } {
    let baseURL: string
    try {
      const url = new URL(this.options.baseURL())
      if (url.origin !== CONSOLE_ORIGIN || url.username || url.password || url.search || url.hash) throw new Error()
      baseURL = url.href
    } catch {
      throw this.failure('unsupported-gateway', 'Official usage history is only available with the official OpenCode gateway', false)
    }
    let proxyURL: string
    try { proxyURL = assertProxyURL(this.options.proxyURL?.()) }
    catch { throw this.failure('invalid-proxy', 'The OpenCode proxy address is invalid', false) }
    return { baseURL, proxyURL }
  }

  private assertCurrentNetwork(identity: Pick<Identity, 'baseURL' | 'proxyURL' | 'source'>): void {
    const current = this.network()
    if (current.baseURL !== identity.baseURL || current.proxyURL !== identity.proxyURL) {
      throw this.failure('network', 'The OpenCode connection changed; retry the usage history request', true, identity.source, false)
    }
  }

  private async identity(query: AnalyticsQuery, signal?: AbortSignal): Promise<Identity> {
    signal?.throwIfAborted()
    const refs = this.options.accountRefs()
    for (const identity of this.identities.values()) if (!refs.includes(identity.accountRef)) this.forget(identity)
    if (!refs.includes(query.accountRef)) throw this.failure('unknown-account', 'The selected OpenCode account no longer exists', false)
    let baseURL: string, proxyURL: string
    try { ({ baseURL, proxyURL } = this.network()) }
    catch (error) {
      const old = this.identities.get(query.accountRef)
      if (old) this.forget(old)
      throw error
    }
    let key: string | undefined
    try { key = await waitWithSignal(() => this.options.resolveApiKey(query.accountRef), signal) }
    catch (error) {
      signal?.throwIfAborted()
      const old = this.identities.get(query.accountRef)
      if (old) this.forget(old)
      const missing = error !== null && typeof error === 'object' && 'code' in error && error.code === 'MISSING_CREDENTIAL'
      throw this.failure(missing ? 'missing-credential' : 'credential-unavailable',
        missing ? 'The selected OpenCode account has no API key' : 'Could not resolve the selected OpenCode account API key', !missing, undefined, false)
    }
    signal?.throwIfAborted()
    try { this.assertCurrentNetwork({ baseURL, proxyURL, source: '' }) }
    catch (error) {
      const old = this.identities.get(query.accountRef)
      if (old) this.forget(old)
      throw error
    }
    if (!this.options.accountRefs().includes(query.accountRef)) {
      const old = this.identities.get(query.accountRef)
      if (old) this.forget(old)
      throw this.failure('unknown-account', 'The selected OpenCode account no longer exists', false)
    }
    if (!key || !key.trim() || /[\r\n\0]/.test(key)) {
      const old = this.identities.get(query.accountRef)
      if (old) this.forget(old)
      throw this.failure('missing-credential', 'The selected OpenCode account has no usable API key', false)
    }
    let identity = this.identities.get(query.accountRef)
    if (!identity || identity.baseURL !== baseURL || identity.proxyURL !== proxyURL || identity.key !== key) {
      if (identity) this.forget(identity)
      identity = { accountRef: query.accountRef, baseURL, proxyURL, key, source: randomUUID() }
      this.identities.set(query.accountRef, identity)
    }
    return identity
  }

  private async dataset(query: AnalyticsQuery, signal?: AbortSignal): Promise<Dataset> {
    const identity = await this.identity(query, signal)
    const now = this.now(), day = utcDay(now)
    for (const [key, cached] of this.cache) {
      if (cached.day !== day || now < cached.generatedAt || now - cached.generatedAt >= CACHE_MS) this.cache.delete(key)
    }
    const period = query.range === 'today' ? '7d' : query.range
    const cacheKey = identity.source + ':' + day + ':' + period
    const cached = this.cache.get(cacheKey)
    if (!query.refresh && cached) return cached
    let pending = query.refresh ? undefined : this.pending.get(cacheKey)
    if (!pending || pending.controller.signal.aborted) {
      const controller = new AbortController()
      const task: Pending = { controller, consumers: 0, source: identity.source, promise: undefined as never }
      this.active.add(task)
      task.promise = this.fetchDataset(identity, period, now, controller.signal).then(data => {
        if (this.pending.get(cacheKey) === task && this.identities.get(query.accountRef) === identity
          && this.options.accountRefs().includes(query.accountRef)) this.cache.set(cacheKey, data)
        return data
      }).catch(error => {
        if (this.pending.get(cacheKey) === task && error instanceof RemoteError
          && error.details && typeof error.details === 'object'
          && 'retryable' in error.details && error.details.retryable === false) this.cache.delete(cacheKey)
        throw error
      }).finally(() => {
        this.active.delete(task)
        if (this.pending.get(cacheKey) === task) this.pending.delete(cacheKey)
      })
      this.pending.set(cacheKey, task)
      pending = task
    }
    const task = pending
    task.consumers++
    try { return await waitWithSignal(() => task.promise, signal) }
    finally {
      task.consumers--
      if (!task.consumers) {
        task.controller.abort()
        if (this.pending.get(cacheKey) === task) this.pending.delete(cacheKey)
      }
    }
  }

  private async fetchDataset(identity: Identity, period: Exclude<AnalyticsRange, 'today'>, now: number, caller: AbortSignal): Promise<Dataset> {
    const signal = AbortSignal.any([caller, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    const url = CONSOLE_ORIGIN + '/console/api/v2/usage/export?range=' + period
    const fetcher = this.options.fetch ?? this.transport.forProxy(identity.proxyURL) ?? globalThis.fetch
    let response: Response | undefined
    try {
      response = await waitWithSignal(async () => {
        this.assertCurrentNetwork(identity)
        if (!this.options.accountRefs().includes(identity.accountRef)) {
          throw this.failure('unknown-account', 'The selected OpenCode account no longer exists', false)
        }
        const result = await fetcher(url, {
          method: 'GET', headers: { ...attributionHeaders(), Authorization: 'Bearer ' + identity.key,
            Accept: 'text/csv', 'Accept-Encoding': 'identity' }, redirect: 'error', signal,
        })
        if (signal.aborted) { void result.body?.cancel().catch(() => {}); signal.throwIfAborted() }
        return result
      }, signal)
      if (!response.ok) {
        const reason = await readUsageError(response, {
          apiKey: identity.key, baseURL: identity.baseURL, proxyURL: identity.proxyURL, signal,
        })
        signal.throwIfAborted()
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500
        throw this.failure(response.status === 401 || response.status === 403 ? 'permission-denied' : 'upstream',
          'Official usage history unavailable (HTTP ' + response.status + ')' + (reason ? ': ' + reason : ''), retryable, identity.source)
      }
      if (!/^text\/csv(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw new SyntaxError('Expected CSV')
      const bytes: Uint8Array[] = []
      let size = 0
      const reader = response.body?.getReader()
      if (!reader) throw new SyntaxError('Missing CSV')
      try {
        while (true) {
          const part = await waitWithSignal(() => reader.read(), signal)
          signal.throwIfAborted()
          if (part.done) break
          if (part.value.byteLength > ANALYTICS_MAX_BYTES - size) throw new RangeError('CSV response too large')
          size += part.value.byteLength
          bytes.push(part.value)
        }
      } catch (error) { void reader.cancel(error).catch(() => {}); throw error }
      finally { reader.releaseLock() }
      const csv = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(bytes, size))
      const parsed = parseCsv(csv)
      signal.throwIfAborted()
      return { ...parsed, csv, generatedAt: now, day: utcDay(now), source: identity.source }
    } catch (error) {
      caller.throwIfAborted()
      if (error instanceof RemoteError) throw error
      if (signal.aborted) throw this.failure('timeout', 'Official usage history request timed out', true, identity.source)
      const invalid = error instanceof SyntaxError || error instanceof RangeError
        || error instanceof TypeError && 'code' in error && error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA'
      throw this.failure(invalid ? 'invalid-response' : 'network',
        invalid ? 'Official usage history returned invalid or oversized CSV' : 'Could not read official usage history: ' + transportFailure(error),
        !invalid, identity.source)
    } finally { void response?.body?.cancel().catch(() => {}) }
  }
}
