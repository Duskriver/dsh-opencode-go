/** Exercise the shipped artifact with real, versioned LLM packages; no mocked exports. */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createServer } from 'node:http'
import { once } from 'node:events'

const llmURL = import.meta.resolve(process.argv[2])
registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === '@deepseek-ai/dsh-llm'
      ? { url: llmURL, shortCircuit: true }
      : nextResolve(specifier, context)
  },
})
const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const llm = await import('@deepseek-ai/dsh-llm')
const plugin = await import('../../lib/index.js')
const legacy = process.argv[2].startsWith('dsh-llm-v015')
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
process.env.OPENCODE_GO_COMPAT_KEY = 'fixture-key'
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const config = plugin.Config({ apiKeyEnv: 'OPENCODE_GO_COMPAT_KEY',
    baseURL: `http://127.0.0.1:${server.address().port}`, maxRequestImageBytes: 8 })
  ctx.baseUrl = new URL('../../package.json', import.meta.url).href
  await ctx.plugin(Loader)
  await ctx.loader.create({ name: '@deepseek-ai/dsh-llm' })
  const id = await ctx.loader.create({ name: new URL('../../lib/index.js', import.meta.url).href, config })
  await ctx.loader.await()
  assert.ok(ctx.loader.resolve(id).fiber, 'plugin mounts through the real Loader')
  assert.ok(ctx.llm.listProviders().some(p => p.id === 'opencode-go'))
  assert.equal((await ctx.llm.listModels('opencode-go'))[0].id, 'compat-model')
  const user = content => llm.createUserMessage({ content, source: { kind: 'plugin', plugin: 'compat-test' } })
  const request = messages => ({ provider: 'opencode-go', model: 'compat-model', messages, sessionId: 'compat-session' })
  const drain = async stream => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return chunks }
  const text = await drain(ctx.llm.stream(request([user([{ type: 'text', text: 'hello' }])])))
  assert.ok(text.some(c => c.type === 'text-delta' && c.text === 'compat-ok'))

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
  const messages = [user([{ type: 'tool-result', toolCallId: 'call', content: [old] }]), user([recent, recent])]
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
  console.log(`PASS: host compatibility (${process.argv[2]}): ESM, Loader, catalog, text, image bounds, history`)
} finally {
  await ctx.fiber.dispose()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
