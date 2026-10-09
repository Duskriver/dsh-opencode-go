/** Verify default and explicit efforts through each real host and the shipped adapter. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'

const host = process.argv[2]
const modern = host.startsWith('v017') || host.startsWith('v02')
const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const llm = await import('@deepseek-ai/dsh-llm')
const plugin = await import('dsh-opencode-go')

const models = {
  'deepseek-v4-flash': { reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }] },
  'deepseek-v4-pro': { reasoning_options: [{ type: 'toggle' }] },
  'glm-5.3': { reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }] },
  'mimo-v2.6-flash': { reasoning_options: [] },
  'qwen3.7-plus': { provider: { npm: '@ai-sdk/anthropic' }, limit: { context: 100000, output: 65536 },
    reasoning_options: [{ type: 'toggle' }, { type: 'budget_tokens', max: 262144 }] },
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
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    assert.ok(path === '/chat/completions' || path === '/v1/messages', request.url)
    assert.ok(request.headers.authorization === 'Bearer fixture-key' || request.headers['x-api-key'] === 'fixture-key')
    const parsed = JSON.parse(body)
    bodies.push(parsed)
    const thinkingEnabled = parsed.thinking?.type !== 'disabled' && parsed.enable_thinking !== false && parsed.reasoning_effort !== 'none'
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    if (path === '/v1/messages') {
      const events = [
        { type: 'message_start', message: { id: 'msg_budget', type: 'message', role: 'assistant', model: parsed.model,
          content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
        ...thinkingEnabled ? [
          { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'think' } },
          { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'fixture-signature' } },
          { type: 'content_block_stop', index: 0 },
        ] : [],
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'ok' } },
        { type: 'content_block_stop', index: 1 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: 'message_stop' },
      ]
      for (const event of events) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      response.end()
      return
    }
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
    modelLimits: { 'qwen3.7-plus': { thinkingBudgets: [4096] } },
    baseURL: `http://127.0.0.1:${server.address().port}` })
  ctx.baseUrl = new URL('../package.json', import.meta.url).href
  await ctx.plugin(Loader)
  if (modern) {
    await ctx.plugin((await import('@deepseek-ai/dsh-typert-registry')).default)
    await ctx.plugin((await import('@deepseek-ai/dsh-api-gateway')).default)
  }
  await ctx.loader.create({ name: '@deepseek-ai/dsh-llm' })
  await ctx.loader.create({ name: 'dsh-opencode-go', config })
  await ctx.loader.await()

  const cases = [
    ['deepseek-v4-flash', undefined, {}],
    ['deepseek-v4-flash', 'low', { thinking: { type: 'enabled' }, reasoning_effort: 'low' }],
    ['deepseek-v4-flash', 'off', { thinking: { type: 'disabled' } }],
    ['deepseek-v4-pro', undefined, {}],
    ['deepseek-v4-pro', 'high', { thinking: { type: 'enabled' } }],
    ['deepseek-v4-pro', 'off', { thinking: { type: 'disabled' } }],
    ['glm-5.3', undefined, {}],
    ['glm-5.3', 'low', { reasoning_effort: 'low' }],
    ['mimo-v2.6-flash', undefined, {}],
    ['qwen3.7-plus', undefined, {}],
    ['qwen3.7-plus', 'off', { thinking: { type: 'disabled' } }],
    ['qwen3.7-plus', 'low', { thinking: { type: 'enabled', budget_tokens: 2048, display: 'summarized' } }],
    ['qwen3.7-plus', 'high', { thinking: { type: 'enabled', budget_tokens: 16384, display: 'summarized' } }],
    ['qwen3.7-plus', 'budget:4096', { thinking: { type: 'enabled', budget_tokens: 4096, display: 'summarized' } }],
    ['mimo-v2.6-flash', 'off', { reasoning_effort: 'none' }],
    ['mimo-v2.6-flash', 'low', { reasoning_effort: 'low' }],
    ['mimo-v2.6-flash', 'medium', { reasoning_effort: 'medium' }],
    ['mimo-v2.6-flash', 'high', { reasoning_effort: 'high' }],
    ['mimo-v2.6-flash', undefined, {}],
  ]
  for (const [model, effort, wire] of cases) {
    const request = { provider: 'dsh-opencode-go', model,
      messages: [llm.createUserMessage({ content: [{ type: 'text', text: 'hello' }],
        source: { kind: 'plugin', plugin: 'reasoning-compat-test' } })],
      ...effort === undefined ? {} : { reasoningEffort: llm.ReasoningEffortId(effort) },
    }
    const info = await ctx.llm.resolveModelInfo('dsh-opencode-go', model)
    assert.equal(info.reasoning.defaultEffort, undefined)
    if (model === 'deepseek-v4-pro') assert.deepEqual(info.reasoning.efforts.map(effort => effort.name), ['Off', 'On'])
    if (model === 'mimo-v2.6-flash') assert.deepEqual(info.reasoning.efforts.map(effort => effort.id), ['off', 'low', 'medium', 'high'])
    if (model === 'qwen3.7-plus') assert.deepEqual(info.reasoning.efforts.map(effort => effort.name),
      ['Off', '1,024 tokens', '2,048 tokens', '4,096 tokens', '8,192 tokens', '16,384 tokens'])
    const resolved = await ctx.llm.resolveCallConfig(request)
    assert.equal(resolved.reasoningEffort, effort)

    const chunks = []
    for await (const chunk of ctx.llm.stream(request)) chunks.push(chunk)
    const body = bodies.at(-1)
    for (const key of ['thinking', 'reasoning_effort', 'enable_thinking']) {
      assert.deepEqual(body[key], wire[key], `${host} ${model} ${effort ?? 'default'} ${key}`)
    }
    assert.equal(chunks.some(c => c.type === 'reasoning-delta' && c.text === 'think'), effort !== 'off')
    assert.ok(chunks.some(c => c.type === 'text-delta' && c.text === 'ok'))
  }
  console.log(`PASS: reasoning compatibility (${host}): defaults, explicit low/off, native toggle, token budgets, MiMo wire mappings; ${cases.length} streams`)
} finally {
  await ctx.fiber.dispose()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
