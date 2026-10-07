import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from '../src/adapter.ts'
import { GatewayDiagnostics } from '../src/gateway-diagnostics.ts'
import { configOf } from './config-of.ts'
import { closeMockGateways, listingBody, mockGateway, textEvents } from './mock-gateway.ts'

const model = 'deepseek-v4.1-flash'
const request = () => ({ provider: 'dsh-opencode-go', model, sessionId: 'diagnostic-session' as never,
  maxTokens: 512, messages: [createUserMessage({ content: [{ type: 'text', text: 'private prompt' }],
    source: { kind: 'plugin', plugin: 'test' } })] })
const drain = async (stream: AsyncIterable<StreamChunk>) => {
  const chunks: StreamChunk[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}
afterEach(async () => { vi.restoreAllMocks(); await closeMockGateways() })
beforeEach(() => { vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', '') })

it.each([
  { body: '', presence: 'empty' },
  // OpenAI's SDK drops valid JSON without a top-level `error` field and reports `(no body)`.
  { body: '{"message":"edge rejected the request"}', presence: 'nonempty' },
  { body: '{"error":{"message":"Invalid max_tokens"}}', presence: 'nonempty' },
])('reports actual $presence HTTP body presence without retrying or changing the session', async ({ body, presence }) => {
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ status: 400, body })
  gateway.pushCompletions({ events: textEvents })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
  const chunks = await drain(adapter.stream(request()))
  expect(chunks).toHaveLength(2)
  expect(chunks[0]).toMatchObject({ type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } })
  expect(chunks[1]).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: {
    code: 'INVALID_REQUEST', message: expect.stringContaining(`response body: ${presence}`),
  } } })
  const message = (chunks[1] as Extract<StreamChunk, { type: 'finish' }>).reason
  expect(JSON.stringify(message)).toContain(`dsh-opencode-go/${model}`)
  if (presence === 'nonempty') expect(JSON.stringify(message)).not.toContain('(no body)')
  expect(gateway.bodies).toHaveLength(1)
  expect(gateway.headers[1]?.['x-opencode-session']).toBe('diagnostic-session')
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
})

it('saves bounded HTTP evidence only when opted in, omitting request content and secrets', async () => {
  const directory = join(process.env.DSH_HOME!, 'diagnostics')
  vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', directory)
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  const body = '{"message":"edge rejection", "echo":"fixture-key"}'
  gateway.pushCompletions({ status: 400, body, headers: {
    'x-request-id': 'edge-fixture-40', 'server': 'fixture-edge',
    'set-cookie': 'private-cookie', 'authorization': 'Bearer fixture-key',
  } })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
  await drain(adapter.stream(request()))
  const files = await readdir(directory)
  expect(files).toHaveLength(1)
  const text = await readFile(join(directory, files[0]!), 'utf8')
  const record = JSON.parse(text)
  expect(record).toMatchObject({ provider: 'dsh-opencode-go', model,
    request: { method: 'POST', messageCount: 1, maxTokens: 512, bodyBytes: expect.any(Number) },
    response: { status: 400, headers: { 'x-request-id': 'edge-fixture-40', server: 'fixture-edge' },
      body: { bytes: Buffer.byteLength(body), truncated: false, text: body.replace('fixture-key', '[REDACTED]') } },
  })
  expect(record.request.sessionHash).toMatch(/^[a-f0-9]{16}$/)
  for (const secret of ['fixture-key', 'private prompt', 'private-cookie', 'Bearer', 'diagnostic-session']) {
    expect(text).not.toContain(secret)
  }
})

it('keeps the HTTP failure usable when the debug destination cannot be written', async () => {
  const directory = join(process.env.DSH_HOME!, 'not-a-directory')
  await writeFile(directory, '')
  vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', directory)
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ status: 400, body: '' })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'error', failure: {
    code: 'INVALID_REQUEST', message: expect.stringContaining('diagnostic file could not be written'),
  } } })
})

it('does not write diagnostic files for a successful SSE response', async () => {
  const directory = join(process.env.DSH_HOME!, 'diagnostics')
  await mkdir(directory)
  vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', directory)
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ events: textEvents })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
  expect((await drain(adapter.stream(request()))).at(-1)).toMatchObject({ reason: { kind: 'stop' } })
  expect(await readdir(directory)).toEqual([])
})

it('bounds error capture and redacts a credential crossing the truncation boundary', async () => {
  const directory = join(process.env.DSH_HOME!, 'diagnostics')
  vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', directory)
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ status: 400, body: 'x'.repeat(16 * 1024 - 5) + 'fixture-key' + 'y'.repeat(20000) })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
  await drain(adapter.stream(request()))
  const text = await readFile(join(directory, (await readdir(directory))[0]!), 'utf8')
  const body = JSON.parse(text).response.body
  expect(body.bytes).toBe(16 * 1024)
  expect(body.truncated).toBe(true)
  expect(body.text).toBe('x'.repeat(16 * 1024 - 5) + '[REDACTED]')
})

it('does not label a complete response exactly at the capture limit as truncated', async () => {
  const directory = join(process.env.DSH_HOME!, 'diagnostics')
  const diagnostics = new GatewayDiagnostics({ provider: 'dsh-opencode-go', model, apiKey: 'fixture-key', directory,
    fetch: async () => new Response('x'.repeat(16 * 1024), { status: 400 }),
  })
  await diagnostics.fetch('https://gateway.example/chat/completions')
  await diagnostics.failureMessage('400 rejected')
  const record = JSON.parse(await readFile(join(directory, (await readdir(directory))[0]!), 'utf8'))
  expect(record.response.body).toMatchObject({ bytes: 16 * 1024, truncated: false })
})

it('keeps concurrent failures associated with their own session and response', async () => {
  const directory = join(process.env.DSH_HOME!, 'diagnostics')
  vi.stubEnv('DSH_OPENCODE_GO_DEBUG_DIR', directory)
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  for (const id of ['first', 'second']) gateway.pushCompletions({ status: 400,
    body: JSON.stringify({ message: id }), headers: { 'x-request-id': id } })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
  await Promise.all(['a', 'b'].map(sessionId => drain(adapter.stream({ ...request(), sessionId: sessionId as never }))))
  const records = await Promise.all((await readdir(directory)).map(async file => JSON.parse(await readFile(join(directory, file), 'utf8'))))
  expect(records).toHaveLength(2)
  for (const [index, id] of ['first', 'second'].entries()) {
    const record = records.find(record => record.response.headers['x-request-id'] === id)
    const session = gateway.headers[index + 1]!['x-opencode-session'] as string
    expect(record.request.sessionHash).toBe(createHash('sha256').update(session).digest('hex').slice(0, 16))
    expect(record.response.body.text).toBe(JSON.stringify({ message: id }))
  }
})

it('limits diagnostic waiting on a stalled response clone and preserves the original response', async () => {
  let cancelled = false
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('partial')) },
    cancel() { cancelled = true },
  }), { status: 400 })
  const diagnostics = new GatewayDiagnostics({ provider: 'dsh-opencode-go', model, apiKey: 'fixture-key',
    fetch: async () => response })
  expect(await diagnostics.fetch('https://gateway.example/chat/completions')).toBe(response)
  expect(await diagnostics.failureMessage('400 status code (no body)')).toContain('incomplete read')
  const reader = response.body!.getReader()
  expect(new TextDecoder().decode((await reader.read()).value)).toBe('partial')
  await reader.cancel()
  expect(cancelled).toBe(true)
})

it('redacts proxy credentials without changing diagnostic JSON keys', async () => {
  const directory = join(process.env.DSH_HOME!, 'diagnostics')
  const diagnostics = new GatewayDiagnostics({ provider: 'dsh-opencode-go', model, apiKey: 'fixture-key',
    proxyURL: 'http://user:p%40ss@proxy.invalid', directory,
    fetch: async () => Response.json({ message: 'user p@ss p%40ss dXNlcjpwQHNz fixture-key' }, { status: 400 }),
  })
  await diagnostics.fetch('https://gateway.example/chat/completions', { headers: { 'user-agent': 'test user' } })
  await diagnostics.failureMessage('400 status code (no body)')
  const record = JSON.parse(await readFile(join(directory, (await readdir(directory))[0]!), 'utf8'))
  expect(record.request.userAgent).toBe('test [REDACTED]')
  expect(record.response.body.text).not.toMatch(/p@ss|p%40ss|dXNlcjpwQHNz|fixture-key|user/)
})

it('redacts credentials escaped inside an upstream JSON error', async () => {
  const directory = join(process.env.DSH_HOME!, 'diagnostics')
  const apiKey = 'fixture"key'
  const password = 'proxy"password'
  const diagnostics = new GatewayDiagnostics({ provider: 'dsh-opencode-go', model, apiKey,
    proxyURL: 'http://user:proxy%22password@proxy.invalid', directory,
    fetch: async () => Response.json({ message: `echo ${apiKey} ${password}` }, { status: 400 }),
  })
  await diagnostics.fetch('https://gateway.example/chat/completions')
  const message = await diagnostics.failureMessage('400 status code (no body)')
  expect(message).not.toContain('fixture')
  const record = JSON.parse(await readFile(join(directory, (await readdir(directory))[0]!), 'utf8'))
  expect(JSON.parse(record.response.body.text).message).toBe('echo [REDACTED] [REDACTED]')
})

it('honors cancellation while capturing a failure instead of returning INVALID_REQUEST', async () => {
  const gateway = await mockGateway({ status: 200, body: listingBody([model]) })
  gateway.pushCompletions({ status: 400, body: '' })
  const original = globalThis.fetch
  const started = Promise.withResolvers<void>()
  const failureMessage = GatewayDiagnostics.prototype.failureMessage
  vi.spyOn(GatewayDiagnostics.prototype, 'failureMessage').mockImplementation(function (message) {
    started.resolve()
    return failureMessage.call(this, message)
  })
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await original(input, init)
    if (String(input).endsWith('/chat/completions')) {
      vi.spyOn(response, 'clone').mockImplementation(() => new Response(new ReadableStream({
        start() {},
      })))
    }
    return response
  })
  const adapter = new OpencodeGoAdapter({ config: () => configOf(gateway.url), resolveApiKey: async () => 'fixture-key' })
  const controller = new AbortController()
  const pending = drain(adapter.stream({ ...request(), signal: controller.signal }))
  await started.promise
  controller.abort()
  expect((await pending).at(-1)).toMatchObject({ reason: { kind: 'aborted', failure: { code: 'ABORTED' } } })
})
