import { describe, afterEach, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import { GoUsageService } from '../src/accounts.ts'
import { parseGoUsage } from '../src/contracts.ts'
import { fetchJsonResponse, readUsageError } from '../src/transport.ts'
import { mountRemotes, invokeRemote } from './support/host.ts'

describe("official quota RPC", () => {
  const window = { status: 'ok', percent: 10, resetsAt: '2026-09-21T00:00:00Z' }

  const usage = { rolling: { ...window, percent: 0 }, weekly: window, monthly: { ...window, percent: 7 } }

  const cleanups: Array<() => Promise<unknown>> = []

  afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close() })

  it('queries authenticated account usage through the actual Host RPC gateway and follows credential changes', async () => {
    const requests: Array<{ url?: string; auth?: string; encoding?: string }> = []
    let status = 200
    const server = createServer((req, res) => {
      requests.push({ url: req.url, auth: req.headers.authorization, encoding: req.headers['accept-encoding'] })
      res.writeHead(status, { 'Content-Type': 'application/json' })
      const body = Buffer.from(JSON.stringify(status === 200 ? { usage }
        : { error: { message: 'Invalid API key', credential: req.headers.authorization } }))
      // Simulate a host that loses Content-Encoding, with an upstream honoring identity.
      res.end(req.headers['accept-encoding'] === 'identity' ? body : brotliCompressSync(body))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    let key = 'first-key'
    await ctx.plugin(GoUsageService, {
      baseURL: () => `http://127.0.0.1:${address.port}/v1`, resolveApiKey: async () => key,
    })
    const read = () => invokeRemote(ctx, { namespace: 'opencodeGoUsage', method: 'read', args: {} })
    const first = await read()
    expect(first).toEqual({ ...usage, source: expect.any(String) })
    key = 'second-key'
    const second = await read()
    expect(second).toEqual({ ...usage, source: expect.any(String) })
    expect(second.source).not.toBe(first.source)
    expect(requests).toEqual([
      { url: '/v1/usage', auth: 'Bearer first-key', encoding: 'identity' },
      { url: '/v1/usage', auth: 'Bearer second-key', encoding: 'identity' },
    ])
    status = 401
    await expect(read()).rejects.toThrow('HTTP 401')
  })

  it('keeps unavailable or malformed usage distinct from zero', () => {
    expect(parseGoUsage(usage).rolling.percent).toBe(0)
    for (const value of [null, {}, { ...usage, weekly: {} }, { ...usage, weekly: { ...window, percent: NaN } }]) {
      expect(() => parseGoUsage(value)).toThrow('Invalid OpenCode Go usage response')
    }
  })

  it('rejects a window percentage outside 0..100 rather than rendering it raw', () => {
    for (const percent of [100.5, 5000, 1e308]) {
      expect(() => parseGoUsage({ ...usage, rolling: { ...window, percent } })).toThrow('Invalid OpenCode Go usage response')
    }
    expect(parseGoUsage({ ...usage, rolling: { ...window, percent: 100 } }).rolling.percent).toBe(100)
  })

  it('reads named accounts through the real RPC contract without switching the active account or exposing keys', async () => {
    const calls: string[] = []
    let status = 200
    const server = createServer((req, res) => {
      calls.push(req.headers.authorization ?? '')
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ usage }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    const active = 'ACCOUNT_A'
    let backupKey = 'backup-private-key'
    await ctx.plugin(GoUsageService, {
      baseURL: () => `http://127.0.0.1:${address.port}/v1`, activeRef: () => active,
      accountRefs: () => ['ACCOUNT_A', 'ACCOUNT_B'],
      resolveApiKey: async ref => ref === 'ACCOUNT_B' ? backupKey : 'primary-private-key',
      lastSwitch: () => ({ fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: 'credential', at: 1 }),
    })
    const readAccount = (ref: string) => invokeRemote(ctx, { namespace: 'opencodeGoUsage', method: 'readAccount', args: { ref } })
    const first = await readAccount('ACCOUNT_A')
    const backup = await readAccount('ACCOUNT_B')
    expect(first.source).not.toBe(backup.source)
    expect((await readAccount('ACCOUNT_A')).source).toBe(first.source)
    backupKey = 'rotated-private-key'
    const rotated = await readAccount('ACCOUNT_B')
    expect(rotated.source).not.toBe(backup.source)
    expect(active).toBe('ACCOUNT_A')
    expect(calls).toEqual(['Bearer primary-private-key', 'Bearer backup-private-key', 'Bearer primary-private-key', 'Bearer rotated-private-key'])
    await expect(readAccount('NOT_A_SAVED_ACCOUNT')).rejects.toMatchObject({ code: 'gateway/bad-request' })
    expect(calls).toHaveLength(4)
    expect(JSON.stringify([first, backup, rotated])).not.toContain('private-key')
    status = 401
    await expect(invokeRemote(ctx, { namespace: 'opencodeGoUsage', method: 'read', args: {} }))
      .rejects.toMatchObject({ details: { retainPrevious: false,
        lastSwitch: { fromRef: 'ACCOUNT_A', toRef: 'ACCOUNT_B', reason: 'credential', at: 1 } } })
  })

  async function usageReader(body: Buffer, headers: Record<string, string> = {}) {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json', ...headers })
      res.end(body)
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    await ctx.plugin(GoUsageService, {
      baseURL: () => `http://127.0.0.1:${address.port}/v1`, resolveApiKey: async () => 'fixture-key',
    })
    return () => invokeRemote(ctx, { namespace: 'opencodeGoUsage', method: 'read', args: {} })
  }

  it.each([
    { encoding: 'br', compress: brotliCompressSync },
    { encoding: 'gzip', compress: gzipSync },
    { encoding: 'deflate', compress: deflateSync },
  ])('reads $encoding usage decoded by fetch through Host RPC', async ({ encoding, compress }) => {
    const read = await usageReader(compress(Buffer.from(JSON.stringify({ usage }))),
      { 'content-encoding': encoding })
    expect(await read()).toEqual({ ...usage, source: expect.any(String) })
  })

  it.each([false, true])('bounds usage response bytes, compressed=%s', async (compressed) => {
    const body = Buffer.from(JSON.stringify({ usage, padding: 'x'.repeat(1024 * 1024) }))
    const read = await usageReader(compressed ? gzipSync(body) : body,
      compressed ? { 'content-encoding': 'gzip' } : {})
    await expect(read()).rejects.toThrow(/exceeds.*byte limit/)
  })

  it('keeps safe network diagnostics and account identity through Host RPC without retaining another account', async () => {
    let mode: 'ok' | 'reset' | 'reset-once' | 'unauthorized' = 'ok'
    let requests = 0
    const server = createServer((req, res) => {
      requests++
      if (mode === 'reset' || mode === 'reset-once') {
        if (mode === 'reset-once') mode = 'ok'
        req.socket.destroy()
        return
      }
      res.writeHead(mode === 'unauthorized' ? 401 : 200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(mode === 'unauthorized'
        ? { error: { message: 'Account access denied', credential: req.headers.authorization } } : { usage }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    let key: string | undefined = 'private-account-one'
    let credentialError = false
    let baseURL = `http://127.0.0.1:${address.port}/v1`
    await ctx.plugin(GoUsageService, { baseURL: () => baseURL, resolveApiKey: async () => {
      if (credentialError) throw Object.assign(new Error('private account credential detail'), { code: 'MISSING_CREDENTIAL' })
      return key
    } })
    const read = () => invokeRemote(ctx, { namespace: 'opencodeGoUsage', method: 'read', args: {} })
    const first = await read()
    expect(first.source).toEqual(expect.any(String))
    expect(await read()).toEqual(first)
    mode = 'reset-once'
    expect(await read()).toEqual(first)
    mode = 'reset'
    const failed = await read().catch((error: unknown) => error)
    expect(failed).toMatchObject({ code: 'opencode-go/usage-unavailable',
      message: expect.stringContaining('network error (UND_ERR_SOCKET)'),
      details: { retainPrevious: true, retryable: true, source: first.source } })
    key = 'private-account-two'
    const changed = await read().catch((error: unknown) => error)
    expect(changed).toMatchObject({ details: { source: expect.any(String) } })
    expect((changed as { details: { source: string } }).details.source).not.toBe(first.source)
    mode = 'ok'
    const second = await read()
    baseURL = `http://127.0.0.1:${address.port}/other`
    const other = await read()
    expect(other.source).not.toBe(second.source)
    mode = 'unauthorized'
    const count = requests
    await expect(read()).rejects.toMatchObject({ code: 'opencode-go/usage-unavailable',
      message: 'OpenCode Go usage unavailable (HTTP 401) Upstream: Account access denied',
      details: { retainPrevious: false, retryable: false, source: other.source } })
    expect(requests - count).toBe(1)
    key = undefined
    await expect(read()).rejects.toMatchObject({ details: { retainPrevious: false, retryable: false } })
    expect(requests - count).toBe(1)
    credentialError = true
    await expect(read()).rejects.toMatchObject({ code: 'opencode-go/usage-unavailable',
      message: 'OpenCode Go API key is not configured', details: { retainPrevious: false, retryable: false } })
    expect(JSON.stringify([first, second, other, failed, changed])).not.toMatch(/private-account|private account/)
  })

  it.each([
    { status: 403, body: { error: { type: 'PermissionError', message: 'Go subscription is inactive', apiKey: 'private-usage-key' } },
      reason: 'Go subscription is inactive', temporary: false },
    { status: 401, body: { error: { data: { message: 'Invalid API key: private-usage-key' } } },
      reason: 'Invalid API key: [REDACTED]', temporary: false },
    { status: 429, body: { error: 'Rate limit reached', token: 'unrelated-private-token' },
      reason: 'Rate limit reached', temporary: true },
    { status: 503, body: { message: 'Gateway temporarily unavailable', headers: { authorization: 'private-usage-key' } },
      reason: 'Gateway temporarily unavailable', temporary: true },
  ])('preserves a safe upstream reason for HTTP $status through both usage RPCs without retrying', async ({ status, body, reason, temporary }) => {
    let requests = 0
    const server = createServer((_req, res) => {
      requests++
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    await ctx.plugin(GoUsageService, {
      baseURL: () => `http://127.0.0.1:${address.port}/v1`, resolveApiKey: async () => 'private-usage-key',
      activeRef: () => 'ACCOUNT_A', accountRefs: () => ['ACCOUNT_A'],
    })
    for (const method of ['read', 'readAccount']) {
      const error = await invokeRemote(ctx, { namespace: 'opencodeGoUsage', method,
        args: method === 'read' ? {} : { ref: 'ACCOUNT_A' } }).catch((error: unknown) => error)
      expect(error).toMatchObject({ code: 'opencode-go/usage-unavailable',
        message: expect.stringContaining(`Upstream: ${reason}`),
        details: { retryable: temporary, retainPrevious: temporary, source: expect.any(String) } })
      const serialized = JSON.stringify({ ...error as object, message: (error as Error).message })
      expect(serialized).toContain(`HTTP ${status}`)
      expect(serialized.includes('Check your API key and Go subscription permissions.')).toBe(status === 403)
      expect(serialized).not.toMatch(/private-usage-key|unrelated-private-token|credential|authorization/)
    }
    expect(requests).toBe(2)
  })

  it('keeps HTTP 403 and its guidance when the upstream provides no usable reason', async () => {
    const server = createServer((_req, res) => { res.writeHead(403); res.end('{"error":broken}') })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(() => new Promise<void>(resolve => server.close(() => resolve())))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    const ctx = new Context()
    cleanups.push(() => ctx.fiber.dispose())
    await mountRemotes(ctx)
    await ctx.plugin(GoUsageService, {
      baseURL: () => `http://127.0.0.1:${address.port}/v1`, resolveApiKey: async () => 'private-usage-key',
    })
    await expect(invokeRemote(ctx, { namespace: 'opencodeGoUsage', method: 'read', args: {} }))
      .rejects.toMatchObject({ message: 'OpenCode Go usage unavailable (HTTP 403). Check your API key and Go subscription permissions.',
        details: { retryable: false, retainPrevious: false } })
  })
})

describe("safe upstream reasons", () => {
  const options = () => ({ apiKey: 'private-usage-key', baseURL: 'https://gateway.invalid/v1', proxyURL: '',
    signal: AbortSignal.timeout(2000) })

  it.each([
    { body: '{"error":{"message":"Go access denied","key":"do-not-expose"}}', reason: 'Go access denied' },
    { body: '{"error":{"type":"PermissionError"}}', reason: 'PermissionError' },
    { body: '{"detail":"No active Go subscription"}', reason: 'No active Go subscription' },
    { body: 'Forbidden: Go subscription required', reason: 'Forbidden: Go subscription required' },
    { body: '<html><head><style>private style</style></head><body><h1>Access denied</h1><script>private script</script></body></html>', reason: 'Access denied' },
    { body: '', reason: undefined },
    { body: '{"error":broken,"key":"do-not-expose"}', reason: undefined },
    { body: '{"request":{"authorization":"do-not-expose"}}', reason: undefined },
  ])('extracts a usage error reason from $body', async ({ body, reason }) => {
    await expect(readUsageError(new Response(body), options())).resolves.toBe(reason)
  })

  it('redacts API keys, escaped/encoded credentials, proxy authentication, and credential fields', async () => {
    const apiKey = 'private-"key\\value'
    const proxyPassword = 'proxy"password'
    const basicAuth = Buffer.from(`proxy-user:${proxyPassword}`).toString('base64')
    const message = `Access denied: ${apiKey}; ${JSON.stringify(apiKey).slice(1, -1)}; ${encodeURIComponent(apiKey)}; `
      + `${proxyPassword}; proxy%22password; ${basicAuth}; base-password; `
      + 'Bearer unknown-token; token=unknown-token; api_key="unknown-key"; '
      + 'https://other-user:other-password@edge.invalid/usage?access_token=query-secret#fragment-secret'
    const result = await readUsageError(Response.json({ error: { message }, key: 'unselected-secret' }), {
      ...options(), apiKey, baseURL: 'https://base-user:base-password@gateway.invalid/v1',
      proxyURL: 'http://proxy-user:proxy%22password@proxy.invalid',
    })
    expect(result).toContain('Access denied: [REDACTED]')
    expect(result).toContain('https://edge.invalid/usage')
    for (const secret of [apiKey, proxyPassword, 'proxy%22password', basicAuth, 'base-password',
      'unknown-token', 'unknown-key', 'other-user', 'other-password', 'query-secret', 'fragment-secret', 'unselected-secret']) {
      expect(result).not.toContain(secret)
    }
  })

  it('cancels an oversized body and redacts a key crossing the byte limit', async () => {
    const cancel = vi.fn()
    let reads = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads++
        controller.enqueue(Buffer.from(' '.repeat(16 * 1024 - 5) + 'private-usage-key'))
      }, cancel,
    }, { highWaterMark: 0 })
    const result = await readUsageError(new Response(body), options())
    expect(cancel).toHaveBeenCalledOnce()
    expect(reads).toBe(1)
    expect(result).toBe('[REDACTED]…')
  })

  it('redacts authentication headers and cookie values embedded in an upstream reason', async () => {
    const message = 'Permission denied\nCookie: sid=private-cookie; second=another-private-cookie\n'
      + 'Authorization: Bearer unrelated-token\npassword="private\\\"password"\napi_key=unrelated-key'
    const result = await readUsageError(Response.json({ error: { message } }), options())
    expect(result).toContain('Permission denied')
    expect(result).not.toMatch(/private-cookie|another-private-cookie|unrelated-token|private|password"|unrelated-key/)
  })

  it('redacts a credential before shortening the displayed reason', async () => {
    const result = await readUsageError(new Response('x'.repeat(250) + 'private-usage-key'), options())
    expect(result?.length).toBe(257)
    expect(result).not.toContain('private')
    expect(result).toMatch(/…$/)
  })

  it('redacts the partial credential when a response disconnects mid-key', async () => {
    let reads = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (++reads === 1) controller.enqueue(Buffer.from('Permission denied: private-usage'))
        else controller.error(Object.assign(new Error('private transport detail'), { code: 'ECONNRESET' }))
      },
    }, { highWaterMark: 0 })
    const fetcher = vi.fn().mockResolvedValue(new Response(body, { status: 403 }))
    const result = await fetchJsonResponse('https://gateway.invalid/usage', {}, 1024, 'identity', fetcher,
      response => readUsageError(response, options()))
    expect(result.response.status).toBe(403)
    expect(result.body).toBe('Permission denied: [REDACTED]…')
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('stops reading a stalled error body, preserving the status without retrying', async () => {
    const cancel = vi.fn()
    const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status: 403 }))
    const result = await fetchJsonResponse('https://gateway.invalid/usage', {}, 1024, 'identity', fetcher,
      response => readUsageError(response, options()))
    expect(result.response.status).toBe(403)
    expect(result.body).toBeUndefined()
    expect(fetcher).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('uses the original request signal while reading an error body', async () => {
    const cancel = vi.fn()
    const controller = new AbortController()
    const pending = readUsageError(new Response(new ReadableStream({ cancel })), { ...options(), signal: controller.signal })
    controller.abort(new Error('private cancellation reason'))
    await expect(pending).resolves.toBeUndefined()
    expect(cancel).toHaveBeenCalledOnce()
  })
})
