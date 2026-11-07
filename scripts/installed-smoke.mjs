/** Exercise a tarball installed in a separate consumer through Cordis's real package resolver. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { once } from 'node:events'

const consumer = resolve(process.argv[2] ?? '.')
const require = createRequire(resolve(consumer, 'package.json'))
const entry = require.resolve('dsh-opencode-go')
const fromPlugin = createRequire(entry)
const load = id => import(pathToFileURL(fromPlugin.resolve(id)).href)
const { Context } = await load('@deepseek-ai/cordis')
const { default: Loader } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis-plugin-loader')).href)
const { createUserMessage } = await load('@deepseek-ai/dsh-llm')
const requests = []
const server = createServer((request, response) => {
  let body = ''
  request.on('data', chunk => { body += chunk })
  request.on('end', () => {
    requests.push({ path: request.url, headers: request.headers, body: body ? JSON.parse(body) : undefined })
    if (request.url.endsWith('/models')) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ data: [{ id: 'deepseek-v4.1-flash', type: 'chat', name: 'Fixture chat',
        api: { 'chat-completions': {} }, capabilities: { reasoning: { supported: false } },
        modalities: { input: ['text'], output: ['text'] }, limit: { context: 262144, output: 131072 },
        cost: { text: { input: { price: 0 }, output: { price: 0 } } },
      }] }))
    } else {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const event of [
        { choices: [{ delta: { role: 'assistant', content: 'standalone-ok' }, index: 0, finish_reason: null }] },
        { choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } },
      ]) response.write(`data: ${JSON.stringify(event)}\n\n`)
      response.end('data: [DONE]\n\n')
    }
  })
})
const ctx = new Context()
const previous = { key: process.env.OPENCODE_GO_INSTALL_TEST_KEY, home: process.env.DSH_HOME, fetch: globalThis.fetch }
const smokeHome = await mkdtemp(join(tmpdir(), 'dsh-go-installed-'))
process.env.DSH_HOME = smokeHome
process.env.OPENCODE_GO_INSTALL_TEST_KEY = 'fixture-key'
// Every model declaration and inference request uses the loopback gateway.
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.hostname !== '127.0.0.1') throw new Error(`Unexpected smoke request: ${url.origin}`)
  return previous.fetch(input, init)
}
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  ctx.baseUrl = pathToFileURL(resolve(consumer, 'package.json')).href
  await ctx.plugin(Loader)
  await ctx.loader.create({ name: '@deepseek-ai/dsh-llm' })
  const adapterId = await ctx.loader.create({
    name: 'dsh-opencode-go',
    config: { apiKeyEnv: 'OPENCODE_GO_INSTALL_TEST_KEY', baseURL: `http://127.0.0.1:${server.address().port}`, freeBaseURL: `http://127.0.0.1:${server.address().port}/free`, streamIdleTimeoutMs: 5000 },
  })
  await ctx.loader.await()
  const adapterEntry = ctx.loader.resolve(adapterId)
  assert.ok(adapterEntry.fiber, 'the installed adapter must mount')
  assert.deepEqual(ctx.llm.listProviders().map(provider => provider.id).sort(), ['dsh-opencode-free', 'dsh-opencode-go'])
  assert.ok((await ctx.llm.listModels('dsh-opencode-free')).some(model => model.id === 'deepseek-v4.1-flash'))
  const models = await ctx.llm.listModels('dsh-opencode-go')
  assert.ok(models.some(model => model.id === 'deepseek-v4.1-flash'))
  for (const sessionId of ['standalone-session-a', 'standalone-session-a', 'standalone-session-b']) {
    const chunks = []
    for await (const chunk of ctx.llm.stream({ provider: 'dsh-opencode-go', model: 'deepseek-v4.1-flash', messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'plugin', plugin: 'installed-smoke' } })], sessionId })) chunks.push(chunk)
    assert.ok(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text === 'standalone-ok'), JSON.stringify(chunks))
  }
  const freeChunks = []
  for await (const chunk of ctx.llm.stream({ provider: 'dsh-opencode-free', model: 'deepseek-v4.1-flash', messages: [], sessionId: 'free-session' })) freeChunks.push(chunk)
  assert.ok(freeChunks.some(chunk => chunk.type === 'text-delta' && chunk.text === 'standalone-ok'))
  assert.ok(requests.some(request => request.path === '/free/chat/completions' && request.headers.authorization === 'Bearer fixture-key'))
  const freeRequest = requests.find(request => request.path === '/free/chat/completions')
  assert.equal(freeRequest.headers['user-agent'], 'opencode/latest/2.2.5/cli')
  assert.equal(freeRequest.headers['x-opencode-session'], 'free-session')
  assert.equal(freeRequest.body.tools, undefined)
  const completions = requests.filter(request => request.path === '/chat/completions')
  assert.deepEqual(completions.map(request => request.headers['x-opencode-session']), ['standalone-session-a', 'standalone-session-a', 'standalone-session-b'])
  assert.ok(completions.every(request => request.headers['user-agent'].startsWith('deepseek-harness/')))
  assert.ok(completions.every(request => request.headers.authorization === 'Bearer fixture-key'))
  await adapterEntry.fiber.dispose()
  assert.deepEqual(ctx.llm.listProviders(), [])
  console.log('PASS: installed package resolution, dual catalogs/routes, streamed text, session headers, attribution, authorization, unload')
} finally {
  await ctx.fiber.dispose()
  globalThis.fetch = previous.fetch
  if (previous.key === undefined) delete process.env.OPENCODE_GO_INSTALL_TEST_KEY
  else process.env.OPENCODE_GO_INSTALL_TEST_KEY = previous.key
  if (previous.home === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previous.home
  await rm(smokeHome, { recursive: true, force: true })
  server.closeAllConnections()
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}
