/** Verify default and explicit efforts through each real host and the shipped adapter. */
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { useModernHost } from './modern-host.mjs'

const host = process.argv[2]
const modern = ['v017', 'v017-alpha2'].includes(host)
if (modern) await useModernHost(host)
const llmURL = import.meta.resolve(modern ? '@deepseek-ai/dsh-llm' : host)
registerHooks({ resolve(id, context, next) {
  return id === '@deepseek-ai/dsh-llm' ? { url: llmURL, shortCircuit: true } : next(id, context)
} })
const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const llm = await import('@deepseek-ai/dsh-llm')
const plugin = await import('../../lib/index.js')

const models = {
  'deepseek-v4-flash': { reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }] },
  'qwen3.6-plus': { reasoning_options: [{ type: 'toggle' }] },
  'glm-5.3': { reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }] },
}
const bodies = []
const networkFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === 'https://models.dev/api.json') return Promise.resolve(Response.json({
    'opencode-go': { npm: '@ai-sdk/openai-compatible', models: Object.fromEntries(Object.entries(models).map(([id, extra]) => [id, {
      reasoning: true, modalities: { input: ['text'] }, limit: { context: 100000, output: 4096 }, ...extra,
    }])) },
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
      response.end(JSON.stringify({ data: Object.keys(models).map(id => ({ id })) }))
      return
    }
    assert.equal(request.url, '/chat/completions')
    assert.equal(request.headers.authorization, 'Bearer fixture-key')
    const parsed = JSON.parse(body)
    bodies.push(parsed)
    const thinkingEnabled = parsed.thinking?.type !== 'disabled' && parsed.enable_thinking !== false
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    for (const event of [
      ...thinkingEnabled ? [{ choices: [{ delta: { role: 'assistant', reasoning_content: 'think' }, index: 0, finish_reason: null }] }] : [],
      { choices: [{ delta: { role: 'assistant', content: 'ok' }, index: 0, finish_reason: null }] },
      { choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } },
    ]) response.write(`data: ${JSON.stringify(event)}\n\n`)
    response.end('data: [DONE]\n\n')
  })
})
const ctx = new Context()
process.env.OPENCODE_GO_REASONING_COMPAT_KEY = 'fixture-key'
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const config = plugin.PlainConfig({ apiKeyEnv: 'OPENCODE_GO_REASONING_COMPAT_KEY',
    baseURL: `http://127.0.0.1:${server.address().port}` })
  ctx.baseUrl = new URL('../../package.json', import.meta.url).href
  await ctx.plugin(Loader)
  if (modern) {
    await ctx.plugin((await import('@deepseek-ai/dsh-typert-registry')).default)
    await ctx.plugin((await import('@deepseek-ai/dsh-api-gateway')).default)
  }
  await ctx.loader.create({ name: '@deepseek-ai/dsh-llm' })
  await ctx.loader.create({ name: new URL('../../lib/index.js', import.meta.url).href, config })
  await ctx.loader.await()

  const cases = [
    ['deepseek-v4-flash', undefined, { thinking: { type: 'enabled' }, reasoning_effort: 'high' }],
    ['deepseek-v4-flash', 'low', { thinking: { type: 'enabled' }, reasoning_effort: 'low' }],
    ['deepseek-v4-flash', 'off', { thinking: { type: 'disabled' } }],
    ['qwen3.6-plus', undefined, { enable_thinking: true, reasoning_effort: 'high' }],
    ['qwen3.6-plus', 'off', { enable_thinking: false }],
    ['glm-5.3', undefined, {}],
    ['glm-5.3', 'low', { reasoning_effort: 'low' }],
  ]
  for (const [model, effort, wire] of cases) {
    const request = { provider: 'opencode-go', model,
      messages: [llm.createUserMessage({ content: [{ type: 'text', text: 'hello' }],
        source: { kind: 'plugin', plugin: 'reasoning-compat-test' } })],
      ...effort === undefined ? {} : { reasoningEffort: llm.ReasoningEffortId(effort) },
    }
    const expectedDefault = model === 'glm-5.3' ? undefined : 'high'
    const info = await ctx.llm.resolveModelInfo('opencode-go', model)
    assert.equal(info.reasoning.defaultEffort, expectedDefault)
    const resolved = await ctx.llm.resolveCallConfig(request)
    assert.equal(resolved.reasoningEffort, effort ?? expectedDefault)

    const chunks = []
    for await (const chunk of ctx.llm.stream(request)) chunks.push(chunk)
    const body = bodies.at(-1)
    for (const key of ['thinking', 'reasoning_effort', 'enable_thinking']) {
      assert.deepEqual(body[key], wire[key], `${host} ${model} ${effort ?? 'default'} ${key}`)
    }
    assert.equal(chunks.some(c => c.type === 'reasoning-delta' && c.text === 'think'), effort !== 'off')
    assert.ok(chunks.some(c => c.type === 'text-delta' && c.text === 'ok'))
  }
  console.log(`PASS: reasoning compatibility (${host}): defaults, explicit low/off, qwen toggle, provider defaults; ${cases.length} streams`)
} finally {
  await ctx.fiber.dispose()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
