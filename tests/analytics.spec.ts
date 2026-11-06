import { describe, expect, it, vi } from 'vitest'
import { context, mountRemotes, invokeRemote } from './support/host.ts'
import { ANALYTICS_MAX_BYTES, GoAnalyticsService, type AnalyticsOptions } from '../src/analytics.ts'
import {
  DEFAULT_BASE_URL, parseAnalyticsQuery, parseAnalyticsReport, parseAnalyticsExport,
  type AnalyticsQuery, type AnalyticsReport, type AnalyticsTotals,
} from '../src/contracts.ts'

const HEADER = ['day', 'user_type', 'user_id', 'user_name', 'provider', 'model', 'requests',
  'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_5m_tokens',
  'cache_write_1h_tokens', 'cost_micro_cents', 'cost_usd'] as const
type Column = typeof HEADER[number]
const NOW = Date.parse('2026-11-06T12:00:00Z')
const QUERY: AnalyticsQuery = { accountRef: 'ACCOUNT_A', range: '30d' }

function record(patch: Partial<Record<Column, string>> = {}): string[] {
  const data: Record<Column, string> = {
    day: '2026-11-06', user_type: 'member', user_id: 'user-fixture', user_name: 'Fixture User',
    provider: 'opencode-go', model: 'model-one', requests: '3',
    input_tokens: '1000', output_tokens: '200', cache_read_tokens: '5000',
    cache_write_5m_tokens: '7', cache_write_1h_tokens: '11', cost_micro_cents: '1234567', cost_usd: '0.01234567',
    ...patch,
  }
  if (patch.cost_micro_cents !== undefined && patch.cost_usd === undefined) {
    const cost = BigInt(patch.cost_micro_cents)
    data.cost_usd = String(cost / 100_000_000n) + '.' + String(cost % 100_000_000n).padStart(8, '0')
  }
  return HEADER.map(key => data[key])
}

function csv(records: readonly (readonly string[])[] = [record()], newline = '\r\n'): string {
  return [HEADER, ...records].map(fields => fields.map(field => /[",\r\n]/.test(field)
    ? '"' + field.replaceAll('"', '""') + '"' : field).join(',')).join(newline) + newline
}

function response(body = csv(), status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/csv; charset=utf-8' } })
}

function harness(options: Partial<AnalyticsOptions> = {}) {
  let now = NOW, baseURL = DEFAULT_BASE_URL, proxyURL = ''
  let refs = ['ACCOUNT_A', 'ACCOUNT_B'], key: string | undefined = 'fixture-api-key'
  const fetcher = vi.fn<typeof globalThis.fetch>(async () => response())
  const resolveApiKey = vi.fn(async () => key)
  const config: AnalyticsOptions = {
    baseURL: () => baseURL, proxyURL: () => proxyURL, now: () => now,
    accountRefs: () => refs, resolveApiKey, fetch: fetcher, ...options,
  }
  const ctx = context()
  return {
    ctx, config, service: new GoAnalyticsService(ctx, config), fetcher, resolveApiKey,
    time: (value: number) => { now = value }, base: (value: string) => { baseURL = value },
    proxy: (value: string) => { proxyURL = value }, refs: (value: string[]) => { refs = value },
    key: (value: string | undefined) => { key = value },
  }
}

describe('official usage history aggregates', () => {
  it('uses the official CSV and exact micro cents, including large integers, with all totals reconciled', async () => {
    const h = harness()
    h.fetcher.mockResolvedValueOnce(response(csv([
      record({ input_tokens: '9007199254740993', cost_micro_cents: '9007199254740993123', cost_usd: '90071992547.40993' }),
      record({ user_type: 'service_account', user_id: 'svc-fixture', requests: '2', input_tokens: '9', cost_micro_cents: '17' }),
      record({ day: '2026-11-04', provider: 'another-provider', requests: '1', cost_micro_cents: '100000000' }),
    ])))
    const report = await h.service.read(QUERY)
    expect(report.totals).toEqual({
      requests: '6', inputTokens: '9007199254742002', outputTokens: '600', cacheReadTokens: '15000',
      cacheWrite5mTokens: '21', cacheWrite1hTokens: '33', cacheWriteTokens: '54',
      tokens: '9007199254757656', costMicroCents: '9007199254840993140',
    })
    expect(report.byModel).toHaveLength(2)
    expect(report.byModel.map(row => [row.provider, row.model])).toEqual([
      ['opencode-go', 'model-one'], ['another-provider', 'model-one'],
    ])
    expect(report.byDay).toHaveLength(30)
    expect(report.byDay[0].day).toBe('2026-10-08')
    expect(report.byDay.at(-1)?.day).toBe('2026-11-06')
    expect(report.byDay.find(row => row.day === '2026-11-05')?.requests).toBe('0')
    for (const field of Object.keys(report.totals) as (keyof AnalyticsTotals)[]) {
      expect(report.byModel.reduce((sum, row) => sum + BigInt(row[field]), 0n).toString()).toBe(report.totals[field])
      expect(report.byDay.reduce((sum, row) => sum + BigInt(row[field]), 0n).toString()).toBe(report.totals[field])
    }
    expect(report.range).toEqual({ from: Date.parse('2026-10-08T00:00:00Z'), to: NOW })
    expect(report.timeZone).toBe('UTC')
    expect(JSON.stringify(report)).not.toMatch(/user-fixture|Fixture User|svc-fixture|fixture-api-key|cost_usd/)
    expect(parseAnalyticsReport(report)).toEqual(report)
    const [url, init] = h.fetcher.mock.calls[0]
    expect(url).toBe('https://opencode.ai/console/api/v2/usage/export?range=30d')
    expect(init?.redirect).toBe('error')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-api-key')
    expect(new Headers(init?.headers).get('accept-encoding')).toBe('identity')
  })

  it('keeps the official micro-cent unit unchanged instead of treating it as micro-USD', async () => {
    const h = harness()
    h.fetcher.mockResolvedValueOnce(response(csv([record({ cost_micro_cents: '100000000' })])))
    expect((await h.service.read(QUERY)).totals.costMicroCents).toBe('100000000') // $1, not $100.
  })

  it('requests seven days for today, filters UTC days, and exports the same selected rows', async () => {
    const h = harness()
    h.fetcher.mockResolvedValueOnce(response(csv([
      record({ day: '2026-11-05', requests: '999' }), record(), record({ day: '2026-11-07', requests: '999' }),
    ])))
    const query: AnalyticsQuery = { ...QUERY, range: 'today' }
    const report = await h.service.read(query)
    expect(report.totals.requests).toBe('3')
    expect(report.range.from).toBe(Date.parse('2026-11-06T00:00:00Z'))
    expect(report.byDay).toHaveLength(1)
    const exported = await h.service.exportCsv(query)
    expect(exported.csv).toBe(csv([record()]))
    expect(exported.filename).toBe('opencode-usage-today-2026-11-06.csv')
    expect(h.fetcher).toHaveBeenCalledTimes(1)
    expect(h.fetcher.mock.calls[0][0]).toContain('range=7d')
    expect((await h.service.read({ ...QUERY, range: '7d' })).byDay).toHaveLength(7)
    expect(h.fetcher).toHaveBeenCalledTimes(1)
  })

  it('supports ninety dense UTC days and a genuinely empty official export', async () => {
    const h = harness()
    h.fetcher.mockResolvedValueOnce(response(csv([])))
    const report = await h.service.read({ ...QUERY, range: '90d' })
    expect(report.byDay).toHaveLength(90)
    expect(Object.values(report.totals).every(value => value === '0')).toBe(true)
    expect(report.byModel).toEqual([])
    expect(h.fetcher.mock.calls[0][0]).toContain('range=90d')
  })

  it('parses BOM, escaped quotes, commas, Unicode and embedded CRLF without exposing personal fields in reports', async () => {
    const h = harness()
    const body = csv([record({ user_name: 'Fixture, "User"\r\n名字', model: 'model, "one"' })])
    h.fetcher.mockResolvedValueOnce(response('\uFEFF' + body))
    const report = await h.service.read(QUERY)
    expect(report.byModel[0].model).toBe('model, "one"')
    expect(JSON.stringify(report)).not.toContain('名字')
    expect((await h.service.exportCsv(QUERY)).csv).toBe(body)
  })

  it('accepts LF and reordered columns while preserving their official export order', async () => {
    const h = harness()
    const reversed = [HEADER, record()].map(row => [...row].reverse().join(',')).join('\n')
    h.fetcher.mockResolvedValueOnce(response(reversed))
    expect((await h.service.read(QUERY)).totals.requests).toBe('3')
  })

  it.each([
    ['missing required header', csv().replace('cache_write_1h_tokens,', '')],
    ['duplicate header', csv().replace('cache_write_1h_tokens', 'cache_write_5m_tokens')],
    ['missing row field', csv([record().slice(0, -1)])],
    ['extra row field', csv([[...record(), 'extra']])],
    ['unclosed quote', csv().trimEnd() + ',"'],
    ['quote in bare field', csv().replace('Fixture User', 'Fixture"User')],
    ['text following closing quote', csv().replace('Fixture User', '"Fixture"oops')],
    ['bare CR', csv().replaceAll('\r\n', '\r')],
    ['blank record', csv() + '\r\n'],
    ['invalid day', csv([record({ day: '2026-02-30' })])],
    ['missing numeric field', csv([record({ requests: '' })])],
    ['negative tokens', csv([record({ input_tokens: '-1' })])],
    ['fractional tokens', csv([record({ cache_write_5m_tokens: '1.5' })])],
    ['numeric exponent', csv([record({ requests: '1e3' })])],
    ['malformed display USD', csv([record({ cost_usd: 'NaN' })])],
    ['empty provider', csv([record({ provider: '' })])],
    ['empty model', csv([record({ model: '' })])],
  ])('rejects %s instead of inventing zero totals', async (_name, body) => {
    const h = harness()
    h.fetcher.mockResolvedValueOnce(response(body))
    await expect(h.service.read(QUERY)).rejects.toMatchObject({
      code: 'opencode-go/analytics-unavailable',
      details: { reason: 'invalid-response', retryable: false, retainPrevious: false },
    })
  })
})

describe('official history identity and cache isolation', () => {
  it('validates current credentials on each call, shares read/export for 30s, and bypasses on refresh', async () => {
    const h = harness()
    const first = await h.service.read(QUERY)
    h.time(NOW + 29_999)
    expect((await h.service.read(QUERY)).generatedAt).toBe(first.generatedAt)
    await h.service.exportCsv(QUERY)
    expect(h.fetcher).toHaveBeenCalledTimes(1)
    expect(h.resolveApiKey).toHaveBeenCalledTimes(3)
    h.time(NOW + 30_000)
    await h.service.read(QUERY)
    expect(h.fetcher).toHaveBeenCalledTimes(2)
    await h.service.read({ ...QUERY, refresh: true })
    expect(h.fetcher).toHaveBeenCalledTimes(3)
  })

  it('changes opaque source on credential, account, proxy or gateway identity changes', async () => {
    const h = harness()
    const first = await h.service.read(QUERY)
    h.key('second-fixture-key')
    const second = await h.service.read(QUERY)
    expect(second.source).not.toBe(first.source)
    const accountB = await h.service.read({ ...QUERY, accountRef: 'ACCOUNT_B' })
    expect(accountB.source).not.toBe(second.source)
    h.proxy('http://proxy.invalid:8080')
    const proxied = await h.service.read(QUERY)
    expect(proxied.source).not.toBe(second.source)
    h.base('https://opencode.ai/another-official-path')
    expect((await h.service.read(QUERY)).source).not.toBe(proxied.source)
    expect(h.fetcher).toHaveBeenCalledTimes(5)
    expect(JSON.stringify(first)).not.toContain('fixture-api-key')
  })

  it('does not reuse a cache across UTC midnight even when less than thirty seconds old', async () => {
    const h = harness()
    h.time(Date.parse('2026-11-06T23:59:59Z'))
    await h.service.read(QUERY)
    h.time(Date.parse('2026-11-07T00:00:01Z'))
    const next = await h.service.read({ ...QUERY, range: 'today' })
    expect(next.byDay[0].day).toBe('2026-11-07')
    expect(next.totals.requests).toBe('0')
    expect(h.fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects deleted accounts and removed credentials before serving cached data', async () => {
    const h = harness()
    const first = await h.service.read(QUERY)
    h.refs(['ACCOUNT_B'])
    await expect(h.service.read(QUERY)).rejects.toMatchObject({ details: { reason: 'unknown-account', retainPrevious: false } })
    expect(h.resolveApiKey).toHaveBeenCalledTimes(1)
    h.refs(['ACCOUNT_A', 'ACCOUNT_B']); h.key(undefined)
    await expect(h.service.read(QUERY)).rejects.toMatchObject({ details: { reason: 'missing-credential', retainPrevious: false } })
    h.key('fixture-api-key')
    expect((await h.service.read(QUERY)).source).not.toBe(first.source)
    expect(h.fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not leak credential resolver errors or reuse cached data when resolution fails', async () => {
    const h = harness()
    await h.service.read(QUERY)
    h.resolveApiKey.mockRejectedValueOnce(new Error('fixture-api-key private backend detail'))
    await expect(h.service.read(QUERY)).rejects.toMatchObject({
      message: 'Could not resolve the selected OpenCode account API key',
      details: { reason: 'credential-unavailable', retryable: true, retainPrevious: false },
    })
    expect(h.fetcher).toHaveBeenCalledTimes(1)
  })

  it.each(['https://gateway.invalid/v1', 'http://opencode.ai/inference/go/v1',
    'https://opencode.ai.evil.invalid/v1', 'https://opencode.ai:8443/v1',
    'https://user:password@opencode.ai/v1', 'invalid'])('refuses a nonofficial gateway without sending its key: %s', async base => {
    const h = harness(); h.base(base)
    await expect(h.service.read(QUERY)).rejects.toMatchObject({ details: { reason: 'unsupported-gateway', retryable: false } })
    expect(h.fetcher).not.toHaveBeenCalled()
    expect(h.resolveApiKey).not.toHaveBeenCalled()
  })

  it('invalidates previously cached permission after a failed forced refresh', async () => {
    const h = harness()
    const first = await h.service.read(QUERY)
    h.fetcher.mockResolvedValueOnce(response('Forbidden fixture-api-key', 403))
    await expect(h.service.read({ ...QUERY, refresh: true })).rejects.toMatchObject({
      details: { reason: 'permission-denied', source: first.source, retryable: false, retainPrevious: false },
    })
    await h.service.read(QUERY)
    expect(h.fetcher).toHaveBeenCalledTimes(3)
  })

  it('never sends a resolved key if the gateway changed during credential resolution', async () => {
    const h = harness()
    const gate = Promise.withResolvers<string>()
    h.resolveApiKey.mockReturnValueOnce(gate.promise)
    const pending = h.service.read(QUERY)
    await vi.waitFor(() => expect(h.resolveApiKey).toHaveBeenCalledTimes(1))
    h.base('https://third-party.invalid/v1')
    gate.resolve('third-party-secret')
    await expect(pending).rejects.toMatchObject({ details: { reason: 'unsupported-gateway', retainPrevious: false } })
    expect(h.fetcher).not.toHaveBeenCalled()
  })
})

describe('bounded and cancellable official history requests', () => {
  it('redacts HTTP errors while preserving permission, retry and source semantics', async () => {
    const h = harness()
    h.proxy('http://alice:proxy-secret@proxy.invalid:8080')
    h.fetcher.mockResolvedValueOnce(response('Forbidden Bearer fixture-api-key password=proxy-secret https://alice:proxy-secret@proxy.invalid/path?token=private', 401))
    const error = await h.service.read(QUERY).catch(error => error)
    expect(error.message).toContain('HTTP 401')
    expect(error.message).not.toMatch(/fixture-api-key|proxy-secret|alice|token=private/)
    expect(error.details).toMatchObject({ reason: 'permission-denied', retryable: false, retainPrevious: false, source: expect.any(String) })
    h.fetcher.mockResolvedValueOnce(response('Busy', 503))
    await expect(h.service.read(QUERY)).rejects.toMatchObject({ details: { retryable: true, retainPrevious: true } })
  })

  it('never displays arbitrary fetch errors or follows an HTTP redirect', async () => {
    const h = harness()
    h.fetcher.mockRejectedValueOnce(new Error('fixture-api-key secret transport detail'))
    await expect(h.service.read(QUERY)).rejects.toMatchObject({ message: 'Could not read official usage history: network request failed' })
    h.fetcher.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://evil.invalid' } }))
    await expect(h.service.read(QUERY)).rejects.toMatchObject({ details: { reason: 'upstream', retryable: false } })
    expect(h.fetcher.mock.calls.every(call => call[1]?.redirect === 'error')).toBe(true)
  })

  it('rejects wrong content type, invalid UTF-8, and actual oversized streamed bytes', async () => {
    for (const result of [
      new Response('<html>sign in</html>', { headers: { 'content-type': 'text/html' } }),
      new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'text/csv' } }),
      new Response(new Uint8Array(ANALYTICS_MAX_BYTES + 1), { headers: { 'content-type': 'text/csv', 'content-length': '1' } }),
    ]) {
      const h = harness()
      h.fetcher.mockResolvedValueOnce(result)
      await expect(h.service.read(QUERY)).rejects.toMatchObject({ details: { reason: 'invalid-response', retainPrevious: false } })
    }
  })

  it('cancels hung fetch and body reads, including a caller that was already aborted', async () => {
    for (const body of [false, true]) {
      const h = harness()
      let captured: AbortSignal | null | undefined
      h.fetcher.mockImplementationOnce(async (_url, init) => {
        captured = init?.signal
        return body ? new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/csv' } })
          : await new Promise<Response>(() => {})
      })
      const abort = new AbortController()
      const promise = h.service.read(QUERY, abort.signal)
      await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledTimes(1))
      abort.abort(new Error('caller stopped'))
      await expect(promise).rejects.toThrow('caller stopped')
      expect(captured?.aborted).toBe(true)
      await expect(h.service.read(QUERY, abort.signal)).rejects.toThrow('caller stopped')
      expect(h.fetcher).toHaveBeenCalledTimes(1)
    }
  })

  it('times out an uncooperative fetch without exposing its details', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(timeout.signal)
    const h = harness()
    h.fetcher.mockImplementationOnce(async () => await new Promise<Response>(() => {}))
    const pending = h.service.read(QUERY)
    await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledTimes(1))
    timeout.abort(new DOMException('timed out', 'TimeoutError'))
    await expect(pending).rejects.toMatchObject({ details: { reason: 'timeout', retryable: true, retainPrevious: true } })
  })

  it('shares a concurrent snapshot while keeping each caller cancellation independent', async () => {
    const h = harness()
    const gate = Promise.withResolvers<Response>()
    h.fetcher.mockReturnValueOnce(gate.promise)
    const abort = new AbortController()
    const first = h.service.read(QUERY, abort.signal)
    const second = h.service.exportCsv(QUERY)
    await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledTimes(1))
    abort.abort(new Error('first stopped'))
    await expect(first).rejects.toThrow('first stopped')
    expect(h.fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false)
    gate.resolve(response())
    expect((await second).csv).toBe(csv())
    expect((await h.service.read(QUERY)).totals.requests).toBe('3')
    expect(h.fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps a superseded response from replacing a forced refresh snapshot', async () => {
    const h = harness()
    const gate = Promise.withResolvers<Response>()
    h.fetcher.mockReturnValueOnce(gate.promise)
    const old = h.service.read(QUERY)
    await vi.waitFor(() => expect(h.fetcher).toHaveBeenCalledTimes(1))
    h.fetcher.mockResolvedValueOnce(response(csv([record({ requests: '99' })])))
    const fresh = await h.service.read({ ...QUERY, refresh: true })
    gate.resolve(response())
    await old
    expect((await h.service.read(QUERY)).totals.requests).toBe(fresh.totals.requests)
  })
})

describe('official analytics RPC contracts', () => {
  it('registers read and exportCsv with the actual Host gateway', async () => {
    const h = harness()
    const ctx = context()
    await mountRemotes(ctx)
    await ctx.plugin(GoAnalyticsService, h.config)
    const invoke = (method: string) => invokeRemote(ctx, { namespace: 'opencodeGoAnalytics', method, args: { query: QUERY } })
    const report = await invoke('read') as AnalyticsReport
    expect(report.totals.requests).toBe('3')
    const exported = parseAnalyticsExport(await invoke('exportCsv'))
    expect(exported.csv).toBe(csv())
    expect(h.fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([{}, { ...QUERY, accountRef: '../account' }, { ...QUERY, range: '365d' }, { ...QUERY, refresh: 'yes' }])('rejects invalid queries before I/O: %j', async query => {
    expect(() => parseAnalyticsQuery(query)).toThrow()
    const h = harness()
    await expect(h.service.read(query as AnalyticsQuery)).rejects.toMatchObject({ details: { reason: 'invalid-query' } })
    expect(h.fetcher).not.toHaveBeenCalled()
    expect(h.resolveApiKey).not.toHaveBeenCalled()
  })

  it('validates precise string totals on the report wire instead of accepting floating numbers', async () => {
    const report = await harness().service.read(QUERY)
    expect(() => parseAnalyticsReport({ ...report, totals: { ...report.totals, requests: 3 } })).toThrow()
    expect(() => parseAnalyticsReport({ ...report, totals: { ...report.totals, requests: '-1' } })).toThrow()
    expect(() => parseAnalyticsExport({ filename: '../private.csv', csv: '' })).toThrow()
  })
})
