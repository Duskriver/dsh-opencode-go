import { expect, it, vi } from 'vitest'
import { fetchJsonResponse } from '../src/json-response.ts'
import { readUsageError } from '../src/usage-error.ts'

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
