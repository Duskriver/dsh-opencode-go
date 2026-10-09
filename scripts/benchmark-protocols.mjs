/** Live, bounded A/B benchmark of the desktop-installed adapter. No settings writes. */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const model = 'deepseek-v4.1-flash'
const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : null
}
const round = value => typeof value === 'number' ? Math.round(value * 1000) / 1000 : value

/** Observe usage without teeing, delaying, storing, or logging the generated body. */
function sseObserver(onEvent) {
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
      if (!data || data === '[DONE]') continue
      try { onEvent(JSON.parse(data)) } catch { /* Non-JSON stream data cannot change the benchmark. */ }
    }
  }
  return new TransformStream({
    transform(chunk, controller) { consume(decoder.decode(chunk, { stream: true })); controller.enqueue(chunk) },
    flush() { consume(decoder.decode() + '\n') },
  })
}

if (args.includes('--self-test')) {
  assert.equal(median([9, 1, 5, 3]), 4)
  const found = []
  const payload = new TextEncoder().encode('event: response.completed\r\ndata: {"response":{"usage":{"output_tokens":5}}}\r\n\r\ndata: [DONE]\n\n')
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(payload.slice(0, 17)); controller.enqueue(payload.slice(17, 43)); controller.enqueue(payload.slice(43)); controller.close()
  } }).pipeThrough(sseObserver(event => found.push(event)))
  for await (const _ of stream) { /* drain */ }
  assert.deepEqual(found, [{ response: { usage: { output_tokens: 5 } } }])
  console.log('PASS: median statistics and chunked CRLF SSE observation')
  process.exit(0)
}
if (!args.includes('--live')) throw new Error('Live calls require --live; use --self-test for offline checks.')
if (!process.versions.electron) throw new Error('Run with the desktop executable and ELECTRON_RUN_AS_NODE=1 to use its actual host packages.')

const userHome = homedir()
const profile = resolve(option('--profile', `${userHome}/.dsh/profiles/desktop`))
const appResources = option('--resources', '/Applications/DeepSeek Harness.app/Contents/Resources')
const host = createRequire(`${appResources}/app.asar/dsh/package.json`)
const hostParentURL = pathToFileURL(`${appResources}/app.asar/dsh/package.json`).href
// The app host normally supplies its peer identities. Supply those same peers
// to this standalone process, retaining dependencies installed with the plugin.
registerHooks({ resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('@deepseek-ai/dsh-') && specifier !== '@deepseek-ai/dsh-brand') || specifier === '@deepseek-ai/cordis') {
    return nextResolve(specifier, { ...context, parentURL: hostParentURL })
  }
  try { return nextResolve(specifier, context) }
  catch (error) {
    if (!specifier.startsWith('@deepseek-ai/') || error.code !== 'ERR_MODULE_NOT_FOUND') throw error
    return nextResolve(specifier, { ...context, parentURL: hostParentURL })
  }
} })
const { parseDocument } = host('yaml')
const llm = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-llm')).href)
const pluginPath = `${profile}/node_modules/dsh-opencode-go/lib/index.js`
const plugin = await import(pathToFileURL(pluginPath).href)
const runId = randomUUID()
const output = resolve(option('--out', `opencode-protocol-benchmark-${runId}`))
const maxTokens = Number(option('--max-tokens', 4096))
assert.ok(Number.isSafeInteger(maxTokens) && maxTokens >= 1024 && maxTokens <= 8192, 'Output cap must be between 1024 and 8192')
await mkdir(output, { recursive: true })

const protectedPaths = [`${profile}/cordis.yml`, `${profile}/cordis.patch.yml`, `${userHome}/.dsh/.credentials.yaml`]
const contents = await Promise.all(protectedPaths.map(path => readFile(path, 'utf8')))
const digest = value => createHash('sha256').update(value).digest('hex')
const hashes = contents.map(digest)
let overrides = {}
function collect(value) {
  if (!value || typeof value !== 'object') return
  if (value.id === 'opencode-go' || value.name === 'dsh-opencode-go') overrides = { ...overrides, ...value.config }
  for (const child of Object.values(value)) collect(child)
}
for (const text of contents.slice(0, 2)) collect(parseDocument(text, { logLevel: 'silent' }).toJS())
const config = plugin.PlainConfig({ ...overrides, autoSwitch: false,
  protocolOverrides: {}, requestTimeoutMs: 60_000, streamIdleTimeoutMs: 30_000 })
const ref = config.apiKeyEnv
const stored = parseDocument(contents[2], { logLevel: 'silent' }).toJS()
const key = process.env[ref] || stored.refs?.[ref]
if (typeof key !== 'string' || !key) throw new Error('The selected desktop credential is unavailable.')
const redact = value => String(value).replaceAll(key, '[redacted]')
const origin = new URL(config.baseURL).origin
const networkFetch = globalThis.fetch
let active
const samples = []
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const inference = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() === 'POST'
  if (inference) {
    try {
    assert.equal(url.origin, origin, 'Inference must stay on the configured gateway')
    assert.ok(active, 'Unexpected inference outside a measured request')
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    assert.equal(headers.get('x-opencode-session'), active.session)
    assert.equal(headers.get('user-agent'), llm.userAgent())
    const bodyText = typeof init?.body === 'string' ? init.body
      : input instanceof Request ? await input.clone().text() : undefined
    assert.ok(bodyText, 'The benchmark observer could not read the SDK request body')
    const body = JSON.parse(bodyText)
    assert.equal(body.model, model)
    const api = url.pathname.endsWith('/responses') ? 'openai-responses'
      : url.pathname.endsWith('/chat/completions') ? 'openai-completions' : 'unknown'
    assert.equal(api, active.protocol === 'auto' ? 'openai-completions' : 'openai-responses', 'Automatic routing no longer uses Chat Completions; comparison is invalid')
    active.api = api
    active.outputCap = body.max_output_tokens ?? body.max_tokens ?? body.max_completion_tokens
    active.wireReasoning = body.reasoning ?? body.reasoning_effort ?? null
    active.httpStarted = performance.now()
    } catch (error) {
      active.instrumentationFailure = redact(error.message).slice(0, 500)
      throw error
    }
  }
  const response = await networkFetch(input, init)
  if (!inference) return response
  active.httpStatus = response.status
  active.headersMs = round(performance.now() - active.httpStarted)
  active.routeHeaders = Object.fromEntries(['x-opencode-endpoint-id', 'x-opencode-upstream-model-id', 'x-zen-model']
    .flatMap(name => response.headers.has(name) ? [[name, response.headers.get(name)]] : []))
  if (!response.ok || !response.body) return response
  const row = active
  return new Response(response.body.pipeThrough(sseObserver(event => {
    row.wireEvents = (row.wireEvents ?? 0) + 1
    row.firstEventMs ??= round(performance.now() - row.httpStarted)
    const usage = event.usage ?? event.response?.usage
    if (usage) row.wireUsage = usage
  })), { status: response.status, statusText: response.statusText, headers: response.headers })
}

const result = {
  runId, startedAt: new Date().toISOString(), model, samples,
  environment: { node: process.version, electron: process.versions.electron, userAgent: llm.userAgent(),
    pluginBuildSha256: digest(await readFile(pluginPath)), proxyConfigured: Boolean(config.proxyURL), sameAccount: true, automaticFallback: false },
  method: { timer: 'HTTP dispatch to first nonempty body text delta / finish; catalog discovery excluded',
    order: 'AB/BA pairs', maxOutputTokens: maxTokens, temperature: 0, promptVersion: 'summary-v2',
    cache: 'first request per protocol and fresh block vs exact prompt repeats; upstream cold cache is not assumed',
    sessions: 'one fresh stable x-opencode-session shared across both protocols within each block',
    transcript: 'synthetic public text only; no tools, images or private conversation',
    highEffort: 'explicit high in both protocols; default omits reasoning controls' },
}
const persist = () => writeFile(`${output}/results.json`, JSON.stringify(result, null, 2) + '\n')
const adapter = new plugin.OpencodeGoAdapter({ config: () => config, resolveApiKey: async () => key,
  debugDirectory: () => '', onCallTrace: trace => { if (active) active.trace = trace } })

function promptOf(block) {
  const context = [
    'A small software team maintains a desktop assistant. Configuration is captured at the start of each request so changes cannot mix within a running call.',
    'A shared catalog owns model metadata and caches successful discovery. Changing a protocol does not require rebuilding that catalog.',
    'The host owns account mutations and durable recovery. The browser owns form drafts and displays acknowledgments from the host.',
    'Automatic account fallback is allowed only before output, only on quota or confirmed credential failures. Protocol errors must remain visible.',
    'The assistant preserves tool call identity through restored conversations. Only reasoning signatures compatible with the selected protocol may be replayed.',
    'Request tracing separates preparation, first visible body text, reasoning output and total generation time. Cache usage is observed rather than assumed.',
  ]
  return `Benchmark block ${runId}-${block}. This identifier is only for separating cache prefixes.\n`
    + Array.from({ length: 3 }, (_, index) => `Context section ${index + 1}:\n${context.join('\n')}`).join('\n')
    + '\nSummarize the context in three concise English bullet points. Cover request configuration, host/browser ownership, and reliable protocol replay. Output only the three bullet points.'
}

try {
  const usageResponse = await networkFetch(`${config.baseURL.replace(/\/$/, '')}/usage`, {
    headers: { ...llm.attributionHeaders(), authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
  })
  if (!usageResponse.ok) throw new Error(`Account preflight failed: HTTP ${usageResponse.status}`)
  const usage = (await usageResponse.json()).usage
  result.quotaBefore = Object.fromEntries(Object.entries(usage ?? {}).map(([period, value]) => [period, { percent: value.percent, status: value.status }]))
  assert.ok(!Object.values(usage ?? {}).some(value => value.percent >= 100), 'The selected account has exhausted its quota')
  console.log(JSON.stringify({ phase: 'preflight', quota: result.quotaBefore, output }))
  await adapter.resolveModel('dsh-opencode-go', model)
  const blocks = [{ id: 'default-1', effort: 'default', pairs: 3 }, { id: 'default-2', effort: 'default', pairs: 3 }, { id: 'high-1', effort: 'high', pairs: 4 }]
  let pairNumber = 0
  let stopped = false
  for (const block of blocks) {
    const session = `dsh-protocol-benchmark-${runId}-${block.id}`
    const prompt = promptOf(block.id)
    result.method.promptBytes = Buffer.byteLength(prompt)
    result.method.promptSha256 ??= digest(prompt)
    for (let repetition = 0; repetition < block.pairs && !stopped; repetition++) {
      pairNumber++
      const order = pairNumber % 2 ? ['auto', 'responses'] : ['responses', 'auto']
      for (const protocol of order) {
        config.protocolOverrides = protocol === 'responses' ? { [model]: 'openai-responses' } : {}
        const prepared = await adapter.prepareCall('dsh-opencode-go', model)
        active = { index: samples.length + 1, pair: pairNumber, block: block.id, effort: block.effort, protocol,
          phase: repetition === 0 ? 'first' : 'repeat', order: order.indexOf(protocol) + 1, session, startedAt: new Date().toISOString() }
        let text = ''
        let reasoning = ''
        const started = performance.now()
        try {
          for await (const chunk of prepared.stream({ provider: 'dsh-opencode-go', model, sessionId: session,
            temperature: 0, maxTokens,
            ...block.effort === 'high' ? { reasoningEffort: llm.ReasoningEffortId('high') } : {},
            messages: [llm.createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'plugin', plugin: 'protocol-benchmark' } })],
          })) {
            if (chunk.type === 'text-delta' && chunk.text.length) {
              active.firstTextMs ??= round(performance.now() - active.httpStarted)
              text += chunk.text
            }
            if (chunk.type === 'reasoning-delta' && chunk.text.length) {
              active.firstReasoningMs ??= round(performance.now() - active.httpStarted)
              reasoning += chunk.text
            }
            if (chunk.type === 'usage') active.usage = chunk.usage
            if (chunk.type === 'finish') {
              active.totalMs = round(performance.now() - active.httpStarted)
              active.finish = chunk.reason.kind
              active.replayApi = chunk.replayState?.response?.api
              if (chunk.reason.failure) active.failure = { code: chunk.reason.failure.code, message: redact(chunk.reason.failure.message).slice(0, 300) }
            }
          }
        } catch (error) { active.failure = { code: error.code ?? 'ERROR', message: redact(error.message).slice(0, 300) } }
        active.endToEndMs = round(performance.now() - started)
        active.textChars = [...text].length
        active.reasoningChars = [...reasoning].length
        active.reasoningTokens = active.wireUsage?.output_tokens_details?.reasoning_tokens
          ?? active.wireUsage?.completion_tokens_details?.reasoning_tokens ?? null
        active.visibleOutputTokens = active.reasoningTokens === null ? null : (active.usage?.outputTokens ?? 0) - active.reasoningTokens
        active.outputText = text
        active.success = active.finish === 'stop' && active.firstTextMs !== undefined && active.api === active.replayApi
        delete active.session; delete active.httpStarted
        samples.push(active)
        console.log(JSON.stringify({ phase: 'sample', index: active.index, effort: active.effort, protocol, cache: active.phase,
          success: active.success, firstTextMs: active.firstTextMs, totalMs: active.totalMs, usage: active.usage, failure: active.failure,
          instrumentationFailure: active.instrumentationFailure }))
        await persist()
        if (!active.success) { stopped = true; result.stoppedReason = 'First unsuccessful request; no automatic retries or account switching'; break }
      }
    }
    if (stopped) break
  }
  result.completedAt = new Date().toISOString()
  result.summary = []
  for (const effort of ['default', 'high']) for (const phase of ['all', 'first', 'repeat']) for (const protocol of ['auto', 'responses']) {
    const rows = samples.filter(row => row.effort === effort && row.protocol === protocol && (phase === 'all' || row.phase === phase))
    const valid = rows.filter(row => row.success)
    result.summary.push({ effort, phase, protocol, requests: rows.length, successes: valid.length,
      firstTextMedianMs: round(median(valid.map(row => row.firstTextMs))), totalMedianMs: round(median(valid.map(row => row.totalMs))),
      outputTokenMedian: median(valid.map(row => row.usage?.outputTokens ?? 0)),
      cacheReadMedian: median(valid.map(row => row.usage?.cacheReadTokens ?? 0)) })
  }
  const after = await Promise.all(protectedPaths.map(path => readFile(path, 'utf8')))
  result.desktopFilesUnchanged = after.every((value, index) => digest(value) === hashes[index])
  await persist()
  console.log(JSON.stringify({ phase: 'complete', samples: samples.length, filesUnchanged: result.desktopFilesUnchanged, summary: result.summary, output }))
} catch (error) {
  result.failure = { code: error.code ?? 'ERROR', message: redact(error.message).slice(0, 300) }
  await persist()
  console.error(JSON.stringify(result.failure))
  process.exitCode = 1
} finally {
  active = undefined
  await adapter.dispose()
  globalThis.fetch = networkFetch
}
