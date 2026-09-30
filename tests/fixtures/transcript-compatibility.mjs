/** Verify prompts, tool calls and restored history through each installed host and protocol. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'

const host = process.argv[2]
const modern = host.startsWith('v017') || host.startsWith('v020')
const { Context } = await import('@deepseek-ai/cordis')
const llm = await import('@deepseek-ai/dsh-llm')
const plugin = await import('dsh-opencode-go')
const prompt = 'SYSTEM_PROMPT_SENTINEL'
const resultText = 'TOOL_RESULT_SENTINEL'
const parameters = { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
const tool = { name: 'probe_tool', description: 'Probe tool', parameters }
const argumentsText = '{"query":"hello"}'
const protocols = [
  { id: 'compat-completions', npm: '@ai-sdk/openai-compatible', path: '/v1/chat/completions' },
  { id: 'compat-responses', npm: '@ai-sdk/openai', path: '/v1/responses' },
  { id: 'compat-anthropic', npm: '@ai-sdk/anthropic', path: '/v1/messages' },
]
const requests = new Map(protocols.map(protocol => [protocol.path, []]))
const networkFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === 'https://models.dev/api.json') return Promise.resolve(Response.json({
    'opencode-go': { npm: '@ai-sdk/openai-compatible', models: Object.fromEntries(protocols.map(protocol => [protocol.id, {
      name: protocol.id, provider: { npm: protocol.npm }, reasoning: false,
      modalities: { input: ['text'] }, limit: { context: 100000, output: 4096 },
    }])) },
  }))
  assert.ok(url.startsWith('http://127.0.0.1:'), `Unexpected network request: ${url}`)
  return networkFetch(input, init)
}

function events(protocol, callingTool) {
  if (protocol.npm === '@ai-sdk/openai-compatible') return [
    { choices: [{ delta: callingTool ? { role: 'assistant', tool_calls: [{ index: 0, id: 'call_probe', type: 'function',
      function: { name: tool.name, arguments: argumentsText } }] } : { role: 'assistant', content: 'compat-ok' },
    index: 0, finish_reason: null }] },
    { choices: [{ delta: {}, index: 0, finish_reason: callingTool ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 1 } },
  ]
  if (protocol.npm === '@ai-sdk/openai') {
    const item = callingTool
      ? { id: 'fc_probe', type: 'function_call', call_id: 'call_probe', name: tool.name, arguments: argumentsText, status: 'completed' }
      : { id: 'msg_probe', type: 'message', role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: 'compat-ok', annotations: [] }] }
    return [
      { type: 'response.created', response: { id: 'resp_probe' } },
      { type: 'response.output_item.added', output_index: 0, item: callingTool ? { ...item, arguments: '' } : { ...item, content: [] } },
      callingTool ? { type: 'response.function_call_arguments.delta', output_index: 0, delta: argumentsText }
        : { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'compat-ok' },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response: { id: 'resp_probe', status: 'completed', output: [item],
        usage: { input_tokens: 3, output_tokens: 1, total_tokens: 4 } } },
    ]
  }
  return [
    { type: 'message_start', message: { id: 'msg_probe', type: 'message', role: 'assistant', model: protocol.id,
      content: [], stop_reason: null, usage: { input_tokens: 3, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: callingTool
      ? { type: 'tool_use', id: 'call_probe', name: tool.name, input: {} } : { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: callingTool
      ? { type: 'input_json_delta', partial_json: argumentsText } : { type: 'text_delta', text: 'compat-ok' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: callingTool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ]
}

function assertPromptAndTools(protocol, body) {
  assert.equal(JSON.stringify(body).split(prompt).length - 1, 1, `${host} ${protocol.id}: prompt must reach the wire exactly once`)
  if (protocol.npm === '@ai-sdk/anthropic') {
    assert.ok(body.system.some(block => block.type === 'text' && block.text === prompt))
    assert.equal(body.tools[0].name, tool.name)
    assert.deepEqual(body.tools[0].input_schema, parameters)
  } else if (protocol.npm === '@ai-sdk/openai') {
    assert.ok(body.input.some(message => ['system', 'developer'].includes(message.role) && message.content === prompt))
    assert.equal(body.tools[0].name, tool.name)
    assert.deepEqual(body.tools[0].parameters, parameters)
  } else {
    assert.ok(body.messages.some(message => message.role === 'system' && message.content === prompt))
    assert.equal(body.tools[0].function.name, tool.name)
    assert.deepEqual(body.tools[0].function.parameters, parameters)
  }
}

const server = createServer((request, response) => {
  let body = ''
  request.on('data', chunk => { body += chunk })
  request.on('end', () => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    if (path === '/v1/models') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ data: protocols.map(protocol => ({ id: protocol.id })) }))
      return
    }
    const protocol = protocols.find(protocol => protocol.path === path)
    assert.ok(protocol, `Unexpected path: ${request.url}`)
    assert.equal(request.headers['x-opencode-session'], 'transcript-session')
    requests.get(protocol.path).push(JSON.parse(body))
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    for (const event of events(protocol, requests.get(protocol.path).length === 1)) {
      response.write(`${protocol.npm === '@ai-sdk/anthropic' ? `event: ${event.type}\n` : ''}data: ${JSON.stringify(event)}\n\n`)
    }
    if (protocol.npm === '@ai-sdk/openai-compatible') response.write('data: [DONE]\n\n')
    response.end()
  })
})
const ctx = new Context()
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const config = plugin.PlainConfig({ baseURL: `http://127.0.0.1:${server.address().port}/v1` })
  await ctx.plugin(llm.default)
  ctx.llm.registerAdapter(['dsh-opencode-go'], new plugin.OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => 'fixture-key' }))
  const user = content => llm.createUserMessage({ content, source: { kind: 'plugin', plugin: 'transcript-compat' } })
  const drain = async options => { const chunks = []; for await (const chunk of ctx.llm.stream(options)) chunks.push(chunk); return chunks }
  for (const protocol of protocols) {
    const leading = { id: 'system-header', role: 'system', content: [{ type: 'text', text: prompt }],
      source: { kind: 'plugin', plugin: 'transcript-compat' } }
    const initial = { provider: 'dsh-opencode-go', model: protocol.id, sessionId: 'transcript-session', tools: [tool],
      messages: [leading, user([{ type: 'text', text: 'hello' }])] }
    const chunks = await drain(initial)
    const finish = chunks.find(chunk => chunk.type === 'finish')
    assert.equal(finish?.reason.kind, 'tool-calls')
    assert.equal(finish.replayState.response.provider, 'dsh-opencode-go')
    assert.equal(finish.replayState.response.sdkProvider, 'opencode-go')
    const blocks = chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block)
    const call = blocks.find(block => block.type === 'tool-call')
    assert.equal(call?.name, tool.name)
    assert.deepEqual(JSON.parse(call.arguments), { query: 'hello' })
    assertPromptAndTools(protocol, requests.get(protocol.path)[0])

    // Round-trip the real streamed replay envelope as a restored session would.
    const assistant = JSON.parse(JSON.stringify({ id: 'assistant-tool-turn', role: 'assistant', content: blocks,
      source: { kind: 'model', provider: 'dsh-opencode-go', model: protocol.id, replayState: finish.replayState } }))
    const content = [{ type: 'text', text: resultText }]
    const result = modern ? llm.createToolResultMessage({ callId: call.id, content, isError: false })
      : user([{ type: 'tool-result', toolCallId: call.id, content, isError: false }])
    const continued = await drain({ ...initial, messages: [...initial.messages, assistant, result] })
    assert.equal(continued.find(chunk => chunk.type === 'finish')?.reason.kind, 'stop')
    assert.ok(continued.some(chunk => chunk.type === 'text-delta' && chunk.text === 'compat-ok'))
    const replayed = requests.get(protocol.path)[1]
    assertPromptAndTools(protocol, replayed)
    assert.ok(JSON.stringify(replayed).includes(resultText), 'the tool result must reach the resumed request')
    assert.ok(JSON.stringify(replayed).includes('call_probe'), 'the resumed tool result must retain its call identity')

    await drain({ ...initial, system: prompt, tools: [], messages: [user([{ type: 'text', text: 'one-shot' }])] })
    const oneShot = requests.get(protocol.path)[2]
    assert.equal(JSON.stringify(oneShot).split(prompt).length - 1, 1)
    assert.ok(!oneShot.tools || oneShot.tools.length === 0, 'empty declarations must not leak tools from another request')
  }
  console.log(`PASS: transcript compatibility (${host}): 3 protocols, prompts, declarations, tool calls, restored replay and one-shot requests`)
} finally {
  await ctx.fiber.dispose()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
