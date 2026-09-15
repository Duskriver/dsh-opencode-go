/** Run the installed plugin through the shipped headless profile against a local gateway. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { writeFile, rm } from 'node:fs/promises'

const root = resolve(process.argv[2])
const patch = resolve(root, 'smoke.patch.yml')
const requests = []
const server = createServer((request, response) => {
  request.resume()
  request.on('end', () => {
    if (request.url === '/models') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ data: [{ id: 'deepseek-v4.1-flash' }] }))
      return
    }
    requests.push(request.headers)
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    for (const event of [
      { choices: [{ delta: { role: 'assistant', content: 'standalone-ok' }, index: 0, finish_reason: null }] },
      { choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } },
    ]) response.write(`data: ${JSON.stringify(event)}\n\n`)
    response.end('data: [DONE]\n\n')
  })
})
let child
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  await writeFile(patch, `- id: opencode-go\n  config:\n    apiKeyEnv: OPENCODE_GO_INSTALL_TEST_KEY\n    baseURL: http://127.0.0.1:${server.address().port}\n- id: agent-default-model\n  config:\n    provider: opencode-go\n    model: deepseek-v4.1-flash\n- id: session-title-llm\n  disabled: true\n`)
  child = spawn(resolve(root, 'node_modules/.bin/dsh'), ['--profile', 'headless', '--patch', patch, 'Say standalone-ok'], {
    cwd: root,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DSH_HOME: resolve(root, 'home'), OPENCODE_GO_INSTALL_TEST_KEY: 'fixture-key' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = '', stderr = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  child.stderr.on('data', chunk => { stderr += chunk })
  const timeout = setTimeout(() => child.kill('SIGKILL'), 60000)
  try {
    const [code] = await once(child, 'exit')
    assert.equal(code, 0, stderr)
    assert.match(stdout, /standalone-ok/)
    assert.ok(requests.length > 0)
    assert.ok(requests.every(headers => headers['x-opencode-session']?.length > 0))
    console.log('PASS: official dsh headless profile completes a task through the installed OpenCode Go plugin')
  } finally { clearTimeout(timeout) }
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await once(child, 'exit')
  }
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await rm(patch, { force: true })
}
