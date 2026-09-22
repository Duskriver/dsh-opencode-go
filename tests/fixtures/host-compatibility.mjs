/** Exercise the shipped artifact with real, versioned LLM packages; no mocked exports. */
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { useModernHost } from './modern-host.mjs'

const modern = process.argv[2] === 'v017'
if (modern) {
  await useModernHost()
  process.argv[2] = '@deepseek-ai/dsh-llm'
}
const legacy = process.argv[2].startsWith('dsh-llm-v015')
const llmURL = import.meta.resolve(process.argv[2])
const aliased = process.argv[2].startsWith('dsh-llm-')
const attachmentPackage = aliased ? process.argv[2].replace('dsh-llm-', 'dsh-attachment-') : '@deepseek-ai/dsh-attachment'
const attachmentURL = import.meta.resolve(attachmentPackage)
const localPackage = aliased ? process.argv[2].replace('dsh-llm-', 'dsh-attachment-local-') : '@deepseek-ai/dsh-attachment-local'
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-llm') return { url: llmURL, shortCircuit: true }
    if (specifier === '@deepseek-ai/dsh-attachment') return { url: attachmentURL, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const llm = await import('@deepseek-ai/dsh-llm')
const plugin = await import('../../lib/index.js')
const { LocalAttachmentStore } = await import(localPackage)
const sharp = createRequire(import.meta.resolve(localPackage))('sharp')
const usage = Object.fromEntries(['rolling', 'weekly', 'monthly'].map(key => [key,
  { status: 'ok', percent: 12, resetsAt: '2026-10-01T00:00:00Z' }]))
const bodies = []
const networkFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === 'https://models.dev/api.json') return Promise.resolve(Response.json({
    'opencode-go': { npm: '@ai-sdk/openai-compatible', models: {
      'compat-model': { name: 'Compatibility fixture', reasoning: false,
        modalities: { input: ['text', 'image'] }, limit: { context: 100000, output: 4096 } },
    } },
  }))
  assert.ok(url.startsWith('http://127.0.0.1:'), `Unexpected network request: ${url}`)
  return networkFetch(input, init)
}
const server = createServer((request, response) => {
  let body = ''
  request.on('data', chunk => { body += chunk })
  request.on('end', () => {
    if (request.url === '/usage') {
      assert.equal(request.headers.authorization, 'Bearer fixture-key')
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ usage }))
      return
    }
    if (request.url === '/models') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ data: [{ id: 'compat-model' }] }))
      return
    }
    assert.equal(request.url, '/chat/completions')
    assert.equal(request.headers.authorization, 'Bearer fixture-key')
    assert.equal(request.headers['x-opencode-session'], 'compat-session')
    bodies.push(JSON.parse(body))
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    for (const event of [
      { choices: [{ delta: { role: 'assistant', content: 'compat-ok' }, index: 0, finish_reason: null }] },
      { choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } },
    ]) response.write(`data: ${JSON.stringify(event)}\n\n`)
    response.end('data: [DONE]\n\n')
  })
})
const ctx = new Context()
const attachmentHome = await mkdtemp(join(tmpdir(), 'opencode-go-image-compat-'))
process.env.OPENCODE_GO_COMPAT_KEY = 'fixture-key'
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const config = plugin.PlainConfig({ apiKeyEnv: 'OPENCODE_GO_COMPAT_KEY',
    baseURL: `http://127.0.0.1:${server.address().port}`, maxRequestImageBytes: 8 })
  ctx.baseUrl = new URL('../../package.json', import.meta.url).href
  await ctx.plugin(Loader)
  if (modern) {
    await ctx.plugin((await import('@deepseek-ai/dsh-typert-registry')).default)
    await ctx.plugin((await import('@deepseek-ai/dsh-api-gateway')).default)
  }
  await ctx.loader.create({ name: '@deepseek-ai/dsh-llm' })
  const id = await ctx.loader.create({ name: new URL('../../lib/index.js', import.meta.url).href, config })
  await ctx.loader.await()
  assert.ok(ctx.loader.resolve(id).fiber, 'plugin mounts through the real Loader')
  assert.ok(ctx.llm.listProviders().some(p => p.id === 'opencode-go'))
  assert.equal((await ctx.llm.listModels('opencode-go'))[0].id, 'compat-model')
  if (modern) assert.deepEqual(await ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} }), usage)
  const user = content => llm.createUserMessage({ content, source: { kind: 'plugin', plugin: 'compat-test' } })
  const request = messages => ({ provider: 'opencode-go', model: 'compat-model', messages, sessionId: 'compat-session' })
  const drain = async stream => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return chunks }
  const text = await drain(ctx.llm.stream(request([user([{ type: 'text', text: 'hello' }])])))
  assert.ok(text.some(c => c.type === 'text-delta' && c.text === 'compat-ok'))
  if (modern) {
    const messages = [
      { id: 'assistant-tool-call', role: 'assistant', source: { kind: 'model', provider: 'opencode-go', model: 'compat-model' },
        content: [{ type: 'tool-call', id: 'call', name: 'lookup', arguments: '{}' }] },
      llm.createToolResultMessage({ callId: 'call', content: [{ type: 'text', text: 'tool-result-ok' }], isError: true }),
    ]
    await drain(ctx.llm.stream(request(messages)))
    assert.ok(bodies.at(-1).messages.some(m => m.role === 'tool' && m.tool_call_id === 'call' && m.content.includes('tool-result-ok')),
      '0.1.7 tool-role results must answer their tool call, not become user messages')
  }

  // Exercise the real attachment policy validation, resizing and encoding (#2).
  // The original image-transport mock below ignores the second argument entirely.
  await ctx.plugin(LocalAttachmentStore, { dshHome: attachmentHome, normalizedImageMaxPixels: 8 * 1024 * 1024 })
  const imageConfig = { ...config, maxRequestImageBytes: 20 * 1024 * 1024 }
  const realAdapter = new plugin.OpencodeGoAdapter({ config: () => imageConfig,
    resolveApiKey: async () => 'fixture-key', imageAccess: {
      resolveImageAccess: () => undefined,
      resolveAttachments: () => ctx.attachments,
    },
  })
  for (const [width, height, maxPixels, maxBytes] of [
    [800, 600, 2048 * 2048, 1024 * 1024],
    [3000, 2000, 2048 * 2048, 1024 * 1024],
    [3000, 2000, 1000 * 1000, 64 * 1024],
  ]) {
    imageConfig.requestImagePixelBudget = maxPixels
    imageConfig.requestImageMaxBytes = maxBytes
    const data = await sharp({ create: { width, height, channels: 3, background: '#5588aa' } }).png().toBuffer()
    const attachment = await ctx.attachments.saveImage({ data, mediaType: 'image/png' })
    assert.deepEqual([attachment.width, attachment.height], [width, height], 'admission must leave resizing to the request path')
    const chunks = await drain(realAdapter.stream(request([user([{ type: 'image', attachment }])])))
    assert.ok(chunks.some(c => c.type === 'text-delta' && c.text === 'compat-ok'))
    const sent = bodies.at(-1).messages.flatMap(m => Array.isArray(m.content) ? m.content : [])
      .filter(c => c.type === 'image_url')
    assert.equal(sent.length, 1)
    const encoded = Buffer.from(sent[0].image_url.url.split(',')[1], 'base64')
    const metadata = await sharp(encoded).metadata()
    assert.ok(metadata.width * metadata.height <= maxPixels)
    assert.ok(encoded.length <= maxBytes)
    if (width === 800) assert.deepEqual([metadata.width, metadata.height], [width, height])
    else assert.ok(metadata.width < width && metadata.height < height)
  }

  const reads = []
  let encodedBytes = 3
  const adapter = new plugin.OpencodeGoAdapter({ config: () => config,
    resolveApiKey: async () => 'fixture-key', imageAccess: {
      resolveImageAccess: () => undefined,
      resolveAttachments: () => ({ readImageRequest: async ref => {
        reads.push(ref.attachmentId)
        return { attachment: ref, data: new Uint8Array(encodedBytes), bytes: encodedBytes,
          mediaType: 'image/png', width: 1, height: 1 }
      } }),
    },
  })
  const image = hex => ({ type: 'image', attachment: {
    attachmentId: `sha256:${hex.repeat(64)}`, bytes: 3, mediaType: 'image/png', width: 1, height: 1,
  } })
  const imagesSent = () => bodies.at(-1).messages.flatMap(m => Array.isArray(m.content) ? m.content : [])
    .filter(c => c.type === 'image_url')
  // Two 3-byte images consume exactly 8 base64 bytes. Repeated occurrences count twice.
  const recent = image('b')
  await drain(adapter.stream(request([user([recent, recent])])))
  assert.equal(imagesSent().length, 2)
  assert.deepEqual(reads.splice(0), [recent.attachment.attachmentId])

  // Oldest nested image exceeds the budget. Legacy hosts project it before reading;
  // modern hosts ask the surface to persist an offload event, without sending a request.
  const old = image('a')
  const messages = [modern
    ? llm.createToolResultMessage({ callId: 'call', content: [old], isError: false })
    : user([{ type: 'tool-result', toolCallId: 'call', content: [old] }]), user([recent, recent])]
  const original = JSON.stringify(messages)
  if (legacy) {
    await drain(adapter.stream(request(messages)))
    assert.equal(imagesSent().length, 2)
    assert.ok(JSON.stringify(bodies.at(-1)).includes(llm.offloadedImageText(old.attachment)))
    assert.deepEqual(reads.splice(0), [recent.attachment.attachmentId])
  } else {
    const sent = bodies.length
    await assert.rejects(() => drain(adapter.stream(request(messages))),
      error => error.code === 'IMAGE_OFFLOAD_REQUIRED' && error.failure.offloadImages === 1)
    assert.equal(bodies.length, sent)
    reads.splice(0)
  }
  assert.equal(JSON.stringify(messages), original, 'durable history is never mutated')

  // Encoded request images can exceed their estimates: perform the second, exact-byte check.
  encodedBytes = 7
  if (legacy) {
    await drain(adapter.stream(request([user([recent])])))
    assert.equal(imagesSent().length, 0)
    assert.ok(JSON.stringify(bodies.at(-1)).includes(llm.offloadedImageText(recent.attachment)))
  } else {
    await assert.rejects(() => drain(adapter.stream(request([user([recent])]))),
      error => error.code === 'IMAGE_OFFLOAD_REQUIRED')
  }
  console.log(`PASS: host compatibility (${process.argv[2]}): ESM, Loader, catalog, text, real images, resizing, image bounds, history`)
} finally {
  await ctx.fiber.dispose()
  await rm(attachmentHome, { recursive: true, force: true })
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
