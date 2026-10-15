/** Bounded live comparison: byte-identical gateway requests vs the desktop-installed adapter. */
import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { channel } from 'node:diagnostics_channel'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const option = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1] }
const hash = value => createHash('sha256').update(value).digest('hex')
const round = value => Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length ? sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 : null
}

/** Forward chunks immediately; retain counters and timestamps, never generated content. */
function observeSse(row, now) {
  const decoder = new TextDecoder()
  let pending = ''
  const consume = text => {
    pending += text
    let end
    while ((end = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, end).trimEnd()
      pending = pending.slice(end + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') { row.doneEventMs ??= now(); continue }
      if (!data) continue
      let event
      try { event = JSON.parse(data) } catch { row.invalidJsonEvents = (row.invalidJsonEvents ?? 0) + 1; continue }
      row.wireEvents = (row.wireEvents ?? 0) + 1
      row.firstWireEventMs ??= now()
      if (event.error) row.wireError = true
      for (const choice of event.choices ?? []) {
        const delta = choice.delta ?? {}
        const thinking = delta.reasoning_content ?? delta.reasoning
        if (typeof thinking === 'string' && thinking.length) {
          row.firstWireReasoningMs ??= now()
          row.reasoningChars = (row.reasoningChars ?? 0) + thinking.length
        }
        if (typeof delta.content === 'string' && delta.content.length) {
          row.firstWireTextMs ??= now()
          row.textChars = (row.textChars ?? 0) + delta.content.length
        }
        if (delta.tool_calls?.some(call => call.function?.arguments?.length)) row.firstWireToolMs ??= now()
        if (choice.finish_reason) { row.wireFinish = choice.finish_reason; row.wireFinishMs = now() }
      }
      if (event.usage) row.wireUsage = event.usage
    }
  }
  return new TransformStream({
    transform(bytes, controller) {
      row.firstBodyByteMs ??= now()
      row.responseBytes = (row.responseBytes ?? 0) + bytes.byteLength
      consume(decoder.decode(bytes, { stream: true }))
      controller.enqueue(bytes)
    },
    flush() { consume(decoder.decode() + '\n'); row.bodyEndMs = now() },
  })
}

async function selfTest() {
  assert.equal(median([20, 1, 3, 9]), 6)
  const row = {}
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"r"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"t"},"finish_reason":"stop"}],"usage":{"prompt_tokens":7}}\n\ndata: [DONE]\n\n')
  let time = 0
  const body = new ReadableStream({ start(controller) {
    for (let offset = 0; offset < bytes.length; offset += 11) controller.enqueue(bytes.slice(offset, offset + 11))
    controller.close()
  } }).pipeThrough(observeSse(row, () => ++time))
  for await (const _ of body) { /* drain */ }
  assert.equal(row.wireEvents, 2)
  assert.equal(row.responseBytes, bytes.length)
  assert.equal(row.textChars, 1)
  assert.equal(row.reasoningChars, 1)
  assert.equal(row.wireUsage.prompt_tokens, 7)
  assert.ok(row.firstBodyByteMs < row.firstWireReasoningMs)
  assert.ok(row.firstWireReasoningMs < row.firstWireTextMs)
  assert.equal(row.wireFinish, 'stop')
  console.log('PASS: incremental CRLF SSE timing, byte forwarding, usage and statistics')
}

async function main() {
  if (args.includes('--self-test')) return selfTest()
  assert.ok(args.includes('--live'), 'Live calls require --live')
  assert.ok(process.versions.electron, 'Use ELECTRON_RUN_AS_NODE=1 with the desktop executable')
  const source = option('--session')
  assert.ok(source, 'Supply the single-step recorded session with --session')
  const pairs = Number(option('--pairs', 4))
  const controlPairs = Number(option('--control-pairs', 2))
  const freshContext = args.includes('--fresh-context')
  const concurrentTitle = args.includes('--concurrent-title')
  const maxTokens = Number(option('--max-tokens', 1024))
  assert.ok(Number.isInteger(pairs) && pairs >= 2 && pairs <= 6, 'Use 2 to 6 main pairs')
  assert.ok(Number.isInteger(controlPairs) && controlPairs >= 0 && controlPairs <= 2, 'Use 0 to 2 control pairs')
  assert.ok(!freshContext || controlPairs === 0, 'Fresh-context runs omit the minimal control')
  assert.ok(!concurrentTitle || controlPairs === 0, 'Concurrent-title runs omit the minimal control')
  assert.ok(Number.isInteger(maxTokens) && maxTokens >= 256 && maxTokens <= 2048, 'Use a bounded output cap')

  const userHome = homedir()
  const profile = resolve(option('--profile', `${userHome}/.dsh/profiles/desktop`))
  const resources = option('--resources', '/Applications/DeepSeek Harness.app/Contents/Resources')
  const parentURL = pathToFileURL(`${resources}/app.asar/dsh/package.json`).href
  const host = createRequire(parentURL)
  registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@deepseek-ai/') && specifier !== '@deepseek-ai/dsh-brand') {
      return nextResolve(specifier, { ...context, parentURL })
    }
    return nextResolve(specifier, context)
  } })
  const { parseDocument } = host('yaml')
  const parseYaml = text => {
    const document = parseDocument(text, { logLevel: 'silent' })
    assert.ok(document.errors.length === 0, 'Profile YAML could not be parsed')
    return document.toJS()
  }
  const llm = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-llm')).href)
  const { Context } = await import('@deepseek-ai/cordis')
  const { credentialRef } = await import('@deepseek-ai/dsh-credentials')
  const { LocalCredentialProvider } = await import('@deepseek-ai/dsh-credentials-local')
  const pluginPath = `${profile}/node_modules/dsh-opencode-go/lib/index.js`
  const plugin = await import(pathToFileURL(pluginPath).href)
  const runId = randomUUID()
  const output = resolve(option('--out', `opencode-protocol-benchmark-latency-${runId}`))
  await mkdir(output, { recursive: true, mode: 0o700 })
  const protectedPaths = ['cordis.yml', 'cordis.patch.yml', 'package.json', 'pnpm-workspace.yaml'].map(name => `${profile}/${name}`)
  protectedPaths.push(`${userHome}/.dsh/.credentials.yaml`)
  const originals = await Promise.all(protectedPaths.map(filename => readFile(filename)))
  let overrides = {}
  const collect = value => {
    if (!value || typeof value !== 'object') return
    if (value.id === 'opencode-go' || value.name === 'dsh-opencode-go') overrides = { ...overrides, ...value.config }
    for (const child of Object.values(value)) collect(child)
  }
  originals.slice(0, 2).forEach(text => collect(parseYaml(text.toString())))
  const config = plugin.PlainConfig({ ...overrides, autoSwitch: false, requestTimeoutMs: 60_000, streamIdleTimeoutMs: 45_000 })
  assert.ok(!config.proxyURL, 'An explicit proxy needs a matching direct transport before comparison')
  // The journal appends independent Zstandard frames; decode every frame.
  const events = execFileSync('zstd', ['--decompress', '--stdout', source], { maxBuffer: 16 * 1024 * 1024 })
    .toString('utf8').trim().split('\n').map(line => JSON.parse(line))
  assert.equal(events.filter(event => event.type === 'step/start').length, 1, 'The source must contain one step')
  const headerAt = events.findIndex(event => event.type === 'request/header')
  assert.ok(headerAt >= 0, 'Recorded request header is missing')
  const header = events[headerAt].data.header
  const model = header.config.model
  assert.equal(model, 'deepseek-v4.1-flash', 'This comparison targets the recorded slow DeepSeek call')
  const messages = events.slice(0, headerAt).flatMap(event => event.type === 'system/message' ? [event.data.message]
    : event.type === 'user/message' ? [event.data] : [])
  assert.ok(messages.length > 0 && messages.every(message => message.content.every(block => block.type === 'text')),
    'Replay must be a text-only recorded request')
  const originalAssistant = events.find(event => event.type === 'assistant/message')
  const originalTitle = events.find(event => event.type === 'session/title-llm-request')?.data
  assert.ok(!concurrentTitle || originalTitle?.route.model === model, 'The recorded title request must use the same model')
  const conditions = freshContext ? Array.from({ length: pairs }, (_, index) => {
    const freshMessages = structuredClone(messages)
    const freshTools = structuredClone(header.tools ?? [])
    const prefix = `Diagnostic isolation code ${runId}-${index + 1}. This is inert metadata.\n\n`
    const system = freshMessages.find(message => message.role === 'system')
    assert.ok(system?.content[0]?.type === 'text' && freshTools.length > 0, 'Fresh-context isolation requires the recorded system prompt and tools')
    system.content[0].text = prefix + system.content[0].text
    freshTools[0].description = prefix + freshTools[0].description
    return { id: `fresh-${index + 1}`, group: 'fresh', pairNumber: index + 1, messages: freshMessages, tools: freshTools, pairs: 1 }
  }) : [{ id: 'recorded', group: 'recorded', messages, tools: header.tools ?? [], pairs }]
  if (controlPairs) {
    const user = messages.find(message => message.role === 'user' && message.source?.kind === 'user')
    assert.ok(user, 'Recorded user prompt is missing')
    conditions.push({ id: 'minimal', group: 'minimal', messages: [user], tools: [], pairs: controlPairs })
  }
  const origin = new URL(config.baseURL).origin
  const credentialContext = new Context()
  let adapter
  let active
  let capturing = false
  let captured
  let expected
  let key = ''
  const networkFetch = globalThis.fetch
  const measurement = new AsyncLocalStorage()
  const currentRow = () => measurement.getStore()?.row ?? active
  const subscriptions = []
  const samples = []
  const result = { runId, startedAt: new Date().toISOString(), model, samples, conditions: [],
    environment: { node: process.version, electron: process.versions.electron, userAgent: llm.userAgent(),
      pluginBuildSha256: hash(await readFile(pluginPath)), sameAccount: true, explicitProxy: false },
    method: { arms: ['direct fetch of captured wire request', 'desktop-installed OpencodeGoAdapter'],
      pairs, controlPairs, freshContext, concurrentTitle, order: 'direct/plugin then plugin/direct, sequential arms', maxOutputTokens: maxTokens,
      matching: 'byte-identical request body and all SDK-visible headers within each condition, including one fresh shared session header',
      source: 'system/user messages and tools reconstructed from the original single-step log; content remains in memory',
      boundedChangesFromOriginal: freshContext ? 'output cap and an inert system/tool prefix per pair to test observed cache misses; no temperature or thinking override'
        : 'output cap only; no temperature or thinking override',
      connection: concurrentTitle ? 'same Electron Node fetch pool; recorded title starts immediately before the main call, with the same session header'
        : 'same Electron Node fetch pool for both arms; no concurrent inference',
      timing: 'all milliseconds from arm entry; wire timestamps observed before SDK parsing',
      cache: 'first and repeated samples retained; upstream cache reads recorded, not assumed',
      isolation: 'no chat writes, tool execution, automatic retries or account switching',
      limitations: 'standalone installed adapter, not desktop UI IPC; gateway queue and provider computation are not separately visible' },
    originalUsage: originalAssistant?.data.usage }
  const persist = () => writeFile(`${output}/results.json`, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 })
  const now = row => round(performance.now() - row.started)
  const mark = (row, field) => { row[field] ??= now(row) }
  const errorDetails = error => {
    const causes = []
    for (let current = error, count = 0; current && count < 5; current = current.cause, count++) {
      causes.push({ name: current.name, code: current.code, syscall: current.syscall,
        message: String(current.message).replaceAll(key || '\0', '[redacted]').slice(0, 250) })
    }
    return causes
  }
  const requests = new WeakMap()
  const subscribe = (name, callback) => {
    const topic = channel(name)
    const handler = message => { try { callback(message) } catch { /* Diagnostics never change transport. */ } }
    topic.subscribe(handler)
    subscriptions.push(() => topic.unsubscribe(handler))
  }
  for (const [name, field] of [['create', 'requestCreatedMs'], ['bodySent', 'requestBodySentMs'],
    ['headers', 'socketResponseHeadersMs'], ['bodyChunkReceived', 'socketFirstBodyByteMs'], ['trailers', 'socketBodyEndMs']]) {
    subscribe(`undici:request:${name}`, ({ request }) => {
      const owner = currentRow()
      if (name === 'create' && owner && String(request.origin) === origin && request.method === 'POST') requests.set(request, owner)
      const row = requests.get(request)
      if (row) mark(row, field)
    })
  }
  subscribe('undici:client:sendHeaders', ({ request }) => {
    const row = requests.get(request)
    if (row) mark(row, 'socketSendHeadersMs')
  })
  subscribe('undici:request:error', ({ request, error }) => {
    const row = requests.get(request)
    if (row) { mark(row, 'socketErrorMs'); row.networkError = errorDetails(error) }
  })
  for (const [name, field] of [['beforeConnect', 'connectionStartMs'], ['connected', 'connectionReadyMs']]) {
    subscribe(`undici:client:${name}`, ({ connectParams }) => {
      const owner = currentRow()
      if (owner && connectParams.hostname === new URL(origin).hostname) mark(owner, field)
    })
  }
  const inspectRequest = async (input, init) => {
    const request = new Request(input, init)
    return { url: request.url, headers: new Headers(request.headers), body: await request.text() }
  }
  const sameHeaders = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (method !== 'POST') return networkFetch(input, init)
    assert.equal(url.origin, origin, 'Inference must stay on the configured gateway')
    const wire = await inspectRequest(input, init)
    const body = JSON.parse(wire.body)
    assert.equal(body.model, model)
    assert.ok(wire.headers.get('authorization') === `Bearer ${key}`, 'The same credential must be used')
    assert.ok(url.pathname.endsWith('/chat/completions'), 'This benchmark requires the original automatic Chat Completions route')
    if (capturing) {
      captured = wire
      return new Response('data: {"choices":[{"index":0,"delta":{"content":"fixture"},"finish_reason":null}]}\n\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\ndata: [DONE]\n\n',
        { headers: { 'content-type': 'text/event-stream' } })
    }
    const row = currentRow()
    const template = measurement.getStore()?.wire ?? expected
    assert.ok(row && template, 'Inference must belong to a measured sample')
    assert.ok(wire.body === template.body, 'Request bodies must be byte-identical')
    assert.ok(sameHeaders(wire.headers, template.headers), 'All request headers must match')
    row.httpAttempts = (row.httpAttempts ?? 0) + 1
    assert.equal(row.httpAttempts, 1, 'Automatic retries are forbidden')
    row.bodyIdentical = true
    row.headersIdentical = true
    mark(row, 'httpDispatchMs')
    const response = await networkFetch(input, init)
    mark(row, 'fetchHeadersMs')
    row.httpStatus = response.status
    row.routeHeaders = Object.fromEntries(['x-opencode-endpoint-id', 'x-opencode-upstream-model-id', 'x-zen-model', 'x-opencode-log-id', 'x-request-id', 'cf-ray', 'server-timing']
      .flatMap(name => response.headers.has(name) ? [[name, response.headers.get(name).replaceAll(key, '[redacted]').slice(0, 256)]] : []))
    if (!response.ok || !response.body) {
      await response.body?.cancel()
      throw new Error(`Gateway returned HTTP ${response.status}`)
    }
    assert.ok(response.headers.get('content-type')?.includes('text/event-stream'), 'Expected an SSE response')
    return new Response(response.body.pipeThrough(observeSse(row, () => now(row))),
      { status: response.status, statusText: response.statusText, headers: response.headers })
  }

  try {
    await credentialContext.plugin(LocalCredentialProvider, { path: protectedPaths.at(-1), watch: false })
    const resolveKey = async () => (await credentialContext.credentials.resolve(credentialRef(config.apiKeyEnv)))?.value
    key = await resolveKey()
    assert.ok(typeof key === 'string' && key.length > 0, 'Selected desktop credential is unavailable')
    adapter = new plugin.OpencodeGoAdapter({ config: () => config, resolveApiKey: resolveKey,
      debugDirectory: () => '', onCallTrace: trace => { const row = currentRow(); if (row) row.trace = trace } })
    const preflight = await networkFetch(`${config.baseURL.replace(/\/+$/, '')}/usage`, {
      headers: { ...llm.attributionHeaders(), authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000), redirect: 'error',
    })
    assert.ok(preflight.ok, `Account preflight returned HTTP ${preflight.status}`)
    const periods = (await preflight.json()).usage ?? {}
    result.quotaBefore = Object.fromEntries(Object.entries(periods).map(([period, value]) => [period, { percent: value.percent, status: value.status }]))
    assert.ok(!Object.values(periods).some(period => period.percent >= 100), 'Selected account quota is exhausted')
    const warmStart = performance.now()
    await adapter.resolveModel('dsh-opencode-go', model)
    result.coldDiscoveryMs = round(performance.now() - warmStart)
    console.log(JSON.stringify({ phase: 'ready', output, model, pairs, controlPairs, quota: result.quotaBefore }))
    for (const condition of conditions) {
      const sessionId = `dsh-latency-${runId}-${condition.id}`
      const request = { ...header.config, messages: condition.messages, tools: condition.tools, sessionId, maxTokens }
      capturing = true
      const prepared = await adapter.prepareCall('dsh-opencode-go', model)
      for await (const _ of prepared.stream(request)) { /* capture the actual SDK body without a live generation */ }
      capturing = false
      assert.ok(captured, 'Could not capture a canonical request')
      expected = captured
      let titleRequest
      let titleWire
      if (concurrentTitle) {
        titleRequest = { ...originalTitle.route, system: originalTitle.system, messages: originalTitle.messages,
          maxTokens: originalTitle.maxTokens, sessionId, purpose: 'session-title' }
        capturing = true
        for await (const _ of adapter.stream(titleRequest)) { /* offline capture of the recorded auxiliary request */ }
        capturing = false
        titleWire = captured
      }
      const wireBody = JSON.parse(expected.body)
      result.conditions.push({ id: condition.id, pairs: condition.pairs, bodySha256: hash(expected.body), bodyBytes: Buffer.byteLength(expected.body),
        messages: wireBody.messages.length, tools: wireBody.tools?.length ?? 0,
        outputCap: wireBody.max_tokens ?? wireBody.max_completion_tokens, thinking: wireBody.thinking ?? wireBody.reasoning_effort ?? 'default' })
      await persist()
      for (let pair = 1; pair <= condition.pairs; pair++) {
        const order = (condition.pairNumber ?? pair) % 2 ? ['direct', 'plugin'] : ['plugin', 'direct']
        for (const arm of order) {
          active = { index: samples.length + 1, condition: condition.id, group: condition.group,
            pair: condition.pairNumber ?? pair, arm, startedAt: new Date().toISOString(), started: performance.now() }
          const measureOne = async (row, wire, options, auxiliary = false) => measurement.run({ row, wire }, async () => {
            try {
              if (arm === 'direct') {
                const response = await globalThis.fetch(wire.url, { method: 'POST', headers: new Headers(wire.headers),
                  body: wire.body, signal: AbortSignal.timeout(60_000), redirect: 'error' })
                for await (const _ of response.body) { /* common wire observer records direct output */ }
              } else {
                const preparedAt = performance.now()
                const stream = auxiliary ? adapter.stream({ ...options, signal: AbortSignal.timeout(60_000) })
                  : (await adapter.prepareCall('dsh-opencode-go', model)).stream({ ...options, signal: AbortSignal.timeout(60_000) })
                row.prepareCallMs = round(performance.now() - preparedAt)
                for await (const chunk of stream) {
                  if (chunk.type === 'reasoning-delta' && chunk.text.length) mark(row, 'firstPluginReasoningMs')
                  if (chunk.type === 'text-delta' && chunk.text.length) mark(row, 'firstPluginTextMs')
                  if (chunk.type === 'usage') row.pluginUsage = chunk.usage
                  if (chunk.type === 'finish') {
                    row.pluginFinish = chunk.reason.kind
                    if (chunk.reason.failure) throw new Error(`Plugin returned ${chunk.reason.failure.code}`)
                  }
                }
              }
              row.endToEndMs = now(row)
              row.firstOutputMs = Math.min(...[row.firstWireReasoningMs, row.firstWireTextMs, row.firstWireToolMs].filter(Number.isFinite))
              row.uploadToHeadersMs = round(row.fetchHeadersMs - (row.requestBodySentMs ?? row.httpDispatchMs))
              row.headersToFirstOutputMs = round(row.firstOutputMs - row.fetchHeadersMs)
              row.pluginTextDeliveryMs = arm === 'plugin' ? round(row.firstPluginTextMs - row.firstWireTextMs) : null
              row.pluginReasoningDeliveryMs = arm === 'plugin' ? round(row.firstPluginReasoningMs - row.firstWireReasoningMs) : null
              row.success = row.httpStatus === 200 && row.httpAttempts === 1 && Number.isFinite(row.firstOutputMs) && !row.wireError
              assert.ok(row.success, 'The request did not produce a valid measured output')
            } catch (error) {
              row.success = false
              row.endToEndMs = now(row)
              row.failure = errorDetails(error)
              throw error
            }
          })
          try {
            if (concurrentTitle) {
              active.auxiliary = { purpose: 'session-title', started: active.started }
              const settled = await Promise.allSettled([
                measureOne(active.auxiliary, titleWire, titleRequest, true),
                measureOne(active, expected, request),
              ])
              delete active.auxiliary.started
              if (settled[1].status === 'rejected') throw settled[1].reason
            } else {
              await measureOne(active, expected, request)
            }
          } catch (error) {
            active.success = false
            active.endToEndMs = now(active)
            active.failure = errorDetails(error)
            throw error
          } finally {
            delete active.started
            samples.push(active)
            console.log(JSON.stringify({ phase: 'sample', index: active.index, condition: active.condition, pair, arm,
              success: active.success, dispatchMs: active.httpDispatchMs, headersMs: active.fetchHeadersMs,
              firstOutputMs: active.firstOutputMs, firstTextMs: active.firstWireTextMs, totalMs: active.endToEndMs,
              pluginDeliveryMs: active.pluginTextDeliveryMs, usage: active.wireUsage, failure: active.failure }))
            active = undefined
            await persist()
          }
        }
      }
    }
  } catch (error) {
    result.failure = { name: error.name, message: String(error.message).replaceAll(key || '\0', '[redacted]').slice(0, 300) }
    process.exitCode = 1
  } finally {
    active = undefined
    await adapter?.dispose()
    await credentialContext.fiber.dispose()
    globalThis.fetch = networkFetch
    subscriptions.forEach(dispose => dispose())
    const after = await Promise.all(protectedPaths.map(filename => readFile(filename)))
    result.desktopFilesUnchanged = after.every((value, index) => hash(value) === hash(originals[index]))
    result.completedAt = new Date().toISOString()
    result.summary = []
    for (const group of new Set(conditions.map(condition => condition.group))) for (const arm of ['direct', 'plugin']) {
      const rows = samples.filter(row => row.group === group && row.arm === arm && row.success)
      result.summary.push({ condition: group, arm, successes: rows.length,
        ...Object.fromEntries(['httpDispatchMs', 'fetchHeadersMs', 'firstOutputMs', 'firstWireTextMs', 'endToEndMs',
          'requestBodySentMs', 'uploadToHeadersMs', 'headersToFirstOutputMs', 'pluginTextDeliveryMs', 'pluginReasoningDeliveryMs']
          .map(field => [field, round(median(rows.map(row => row[field])))])),
        inputTokens: median(rows.map(row => row.wireUsage?.prompt_tokens)),
        outputTokens: median(rows.map(row => row.wireUsage?.completion_tokens)),
        cacheReadTokens: median(rows.map(row => row.wireUsage?.prompt_tokens_details?.cached_tokens ?? row.wireUsage?.prompt_cache_hit_tokens ?? 0)),
      })
    }
    await persist()
    console.log(JSON.stringify({ phase: 'complete', output, desktopFilesUnchanged: result.desktopFilesUnchanged,
      summary: result.summary, failure: result.failure }))
  }
}

await main().catch(error => { console.error(`${error.name}: ${error.message}`); process.exitCode = 1 })
