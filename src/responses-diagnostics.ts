/** Opt-in, content-free evidence for Responses reasoning across conversion stages. */
import { createHash, randomUUID, type Hash } from 'node:crypto'
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join, resolve as resolveDiagnosticDirectory } from 'node:path'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Api, Context, Model } from './sdk-types.ts'

const MAX_ITEMS = 1024
const MAX_PARTS = 8
const MAX_DELTAS = 256
const MAX_REPORT_BYTES = 4 * 1024 * 1024
const MAX_REPORT_FILES = 64
const WRITE_TIMEOUT_MS = 1000
type Row = Record<string, unknown>
type Fingerprint = { bytes: number; sha256: string }

function record(value: unknown): Row | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : undefined
}

// UTF-16LE preserves code units even when a stream splits a surrogate pair.
function fingerprint(value: unknown): Fingerprint | undefined {
  return typeof value === 'string'
    ? { bytes: value.length * 2, sha256: createHash('sha256').update(value, 'utf16le').digest('hex') } : undefined
}

/** One report per attempt, including successes needed to inspect the next continuation. */
export class ResponsesDiagnostics {
  private readonly report: Row
  private readonly deltas = new Map<string, { kind: string; outputIndex: number; partIndex: number; bytes: number; hash: Hash }>()
  private truncated = false
  private inspectionFailed = false

  constructor(private readonly options: {
    directory: string
    callId: string
    attempt: number
    model: Model<Api>
    sessionId: string
  }) {
    this.report = {
      version: 1, time: new Date().toISOString(), callId: options.callId, attempt: options.attempt,
      model: options.model.id.slice(0, 256), sessionHash: fingerprint(options.sessionId)?.sha256,
      fingerprintEncoding: 'utf16le', nextRequestContext: [], sdkPayload: [], parsedProviderEvents: [],
      adapterFinishReplay: [], outcome: 'unfinished', terminalEventReceived: false, finishReceived: false,
    }
  }

  /** Observation failures must not change the provider's request or stream outcome. */
  private observe(action: () => void): void {
    try { action() } catch { this.inspectionFailed = true }
  }

  private tail<T>(values: readonly T[], limit = MAX_ITEMS): readonly T[] {
    if (values.length > limit) this.truncated = true
    return values.slice(-limit)
  }

  private append(key: string, value: Row): void {
    const rows = this.report[key] as Row[]
    if (rows.length >= MAX_ITEMS) { rows.shift(); this.truncated = true }
    rows.push(value)
  }

  private parts(value: unknown, type: string): Row {
    if (!Array.isArray(value)) return { present: false, parts: [] }
    const parts = this.tail(value, MAX_PARTS).flatMap(part => {
      const item = record(part)
      const text = item?.type === type ? fingerprint(item.text) : undefined
      return text === undefined ? [] : [text]
    })
    return { present: true, count: value.length, parts }
  }

  private item(value: unknown): Row | undefined {
    const item = record(value)
    if (item?.type === 'reasoning') return {
      type: 'reasoning', idHash: fingerprint(item.id)?.sha256,
      summary: this.parts(item.summary, 'summary_text'), content: this.parts(item.content, 'reasoning_text'),
      encryptedContent: fingerprint(item.encrypted_content),
    }
    if (item?.type === 'function_call' || item?.type === 'function_call_output') return {
      type: item.type, idHash: fingerprint(item.id)?.sha256, callIdHash: fingerprint(item.call_id)?.sha256,
    }
    return undefined
  }

  private signature(value: unknown): Row {
    if (typeof value !== 'string' || value.length === 0) return { signature: 'missing' }
    try {
      const item = this.item(JSON.parse(value))
      return item?.type === 'reasoning' ? { signature: 'reasoning', item } : { signature: 'other' }
    } catch { return { signature: 'invalid' } }
  }

  context(context: Context): void {
    this.observe(() => {
      this.report.contextMessageCount = context.messages.length
      const messages = this.tail(context.messages)
      const start = context.messages.length - messages.length
      for (const [offset, message] of messages.entries()) {
        if (message.role !== 'assistant') continue
        const blocks = this.tail(message.content)
        for (const [index, block] of blocks.entries()) {
          const position = { messageIndex: start + offset, blockIndex: message.content.length - blocks.length + index,
            native: message.api === this.options.model.api && message.provider === this.options.model.provider
              && message.model === this.options.model.id,
            skippedBySdk: message.stopReason === 'error' || message.stopReason === 'aborted' }
          if (block.type === 'thinking') this.append('nextRequestContext', { ...position, type: 'reasoning',
            visible: fingerprint(block.thinking), ...this.signature(block.thinkingSignature) })
          else if (block.type === 'toolCall') this.append('nextRequestContext', { ...position, type: 'function_call',
            idHash: fingerprint(block.id)?.sha256 })
        }
      }
    })
  }

  payload(payload: unknown): void {
    this.observe(() => {
      const input = record(payload)?.input
      if (!Array.isArray(input)) return
      this.report.payloadItemCount = input.length
      this.report.sdkPayload = []
      const body = record(payload)!
      this.report.requestMode = {
        store: typeof body.store === 'boolean' ? body.store : undefined,
        previousResponseIdHash: fingerprint(body.previous_response_id)?.sha256,
        includeEncryptedContent: Array.isArray(body.include) && body.include.includes('reasoning.encrypted_content'),
      }
      // Keep the latest relevant items, including when messages/images dominate input.
      for (let index = 0; index < input.length; index++) {
        const item = this.item(input[index])
        if (item) this.append('sdkPayload', { index, ...item })
      }
    })
  }

  providerEvent(value: unknown): void {
    this.observe(() => {
      const event = record(value)
      const type = event?.type
      if (!event) return
      const outputIndex = Number.isSafeInteger(event.output_index) ? event.output_index as number : undefined
      if (type === 'response.reasoning_text.delta' || type === 'response.reasoning_summary_text.delta') {
        const rawIndex = type === 'response.reasoning_text.delta' ? event.content_index : event.summary_index
        const partIndex = Number.isSafeInteger(rawIndex) ? rawIndex as number : 0
        if (outputIndex === undefined || typeof event.delta !== 'string') return
        const kind = type === 'response.reasoning_text.delta' ? 'reasoning_text' : 'summary_text'
        const key = `${kind}:${outputIndex}:${partIndex}`
        let delta = this.deltas.get(key)
        if (!delta) {
          if (this.deltas.size >= MAX_DELTAS) { this.truncated = true; return }
          delta = { kind, outputIndex, partIndex, bytes: 0, hash: createHash('sha256') }
          this.deltas.set(key, delta)
        }
        delta.bytes += event.delta.length * 2
        delta.hash.update(event.delta, 'utf16le')
      } else if (type === 'response.output_item.added' || type === 'response.output_item.done') {
        const item = this.item(event.item)
        if (item) this.append('parsedProviderEvents', { event: type, outputIndex, item })
      } else if (type === 'response.reasoning_text.done' || type === 'response.reasoning_summary_text.done') {
        const partIndex = type === 'response.reasoning_text.done' ? event.content_index : event.summary_index
        this.append('parsedProviderEvents', { event: type, outputIndex,
          partIndex: Number.isSafeInteger(partIndex) ? partIndex : undefined,
          itemIdHash: fingerprint(event.item_id)?.sha256, text: fingerprint(event.text) })
      } else if (type === 'response.reasoning_summary_part.added' || type === 'response.reasoning_summary_part.done'
        || type === 'response.content_part.added' || type === 'response.content_part.done') {
        const part = record(event.part)
        if (part?.type === 'summary_text' || part?.type === 'reasoning_text') {
          const partIndex = part.type === 'reasoning_text' ? event.content_index : event.summary_index
          this.append('parsedProviderEvents', { event: type, outputIndex,
            partIndex: Number.isSafeInteger(partIndex) ? partIndex : undefined,
            itemIdHash: fingerprint(event.item_id)?.sha256, partType: part.type, text: fingerprint(part.text) })
        }
      } else if (type === 'response.created' || type === 'response.completed' || type === 'response.incomplete' || type === 'response.failed') {
        const response = record(event.response)
        const output = response?.output
        if (type !== 'response.created') this.report.terminalEventReceived = true
        this.append('parsedProviderEvents', { event: type, responseIdHash: fingerprint(response?.id)?.sha256,
          itemCount: Array.isArray(output) ? output.length : 0 })
        if (Array.isArray(output)) {
          const kept = this.tail(output)
          for (const [index, value] of kept.entries()) {
            const item = this.item(value)
            if (item) this.append('parsedProviderEvents', { event: `${type}.output`,
              outputIndex: output.length - kept.length + index, item })
          }
        }
      }
    })
  }

  http(status: number, requestId?: string): void {
    this.observe(() => { this.report.http = { status, requestId } })
  }

  chunk(chunk: StreamChunk): void {
    if (chunk.type !== 'finish') return
    this.observe(() => {
      this.report.outcome = chunk.reason.kind
      this.report.finishReceived = true
      const blocks = chunk.replayState?.blocks
      if (!Array.isArray(blocks)) return
      const kept = this.tail(blocks)
      for (const [index, value] of kept.entries()) {
        const block = record(value)
        if (block?.type === 'reasoning') this.append('adapterFinishReplay', {
          blockIndex: blocks.length - kept.length + index, type: 'reasoning', ...this.signature(block.thinkingSignature),
        })
      }
    })
  }

  end(termination: 'completed' | 'caller-aborted' | 'timeout' | 'exception' | 'consumer-stopped'): void {
    this.observe(() => {
      this.report.termination = termination
      if (!this.report.finishReceived) {
        if (termination === 'caller-aborted') this.report.outcome = 'aborted'
        else if (termination === 'timeout' || termination === 'exception') this.report.outcome = 'error'
      }
    })
  }

  /** Bounded optional disk I/O; never rejects or indefinitely delays stream cleanup. */
  async save(): Promise<void> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const expired = new Promise<void>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve() }, WRITE_TIMEOUT_MS)
    })
    const write = async (): Promise<void> => {
      let temporary: string | undefined
      try {
        const reasoningDeltas = [...this.deltas.values()].map(({ hash, ...value }) => ({ ...value, sha256: hash.copy().digest('hex') }))
        const report: Row = { ...this.report, reasoningDeltas, truncated: this.truncated, inspectionFailed: this.inspectionFailed }
        let body = JSON.stringify(report, null, 2)
        while (Buffer.byteLength(body) > MAX_REPORT_BYTES) {
          report.truncated = true
          for (const key of ['nextRequestContext', 'sdkPayload', 'parsedProviderEvents', 'adapterFinishReplay']) {
            const rows = report[key] as Row[]
            report[key] = rows.slice(Math.ceil(rows.length / 2))
          }
          body = JSON.stringify(report, null, 2)
        }
        const directory = resolveDiagnosticDirectory(this.options.directory)
        await mkdir(directory, { recursive: true, mode: 0o700 })
        controller.signal.throwIfAborted()
        const file = join(directory, `responses-replay-${randomUUID()}.json`)
        temporary = `${file}.tmp`
        await writeFile(temporary, body + '\n',
          { flag: 'wx', mode: 0o600, signal: controller.signal })
        controller.signal.throwIfAborted()
        await rename(temporary, file)
        temporary = undefined
        // Rotate only this feature's own files, never existing HTTP-error evidence.
        controller.signal.throwIfAborted()
        const names = (await readdir(directory)).filter(name => /^responses-replay-[0-9a-f-]{36}\.json$/.test(name))
        if (names.length > MAX_REPORT_FILES) {
          const files = await Promise.all(names.map(async name => ({ path: join(directory, name),
            time: await stat(join(directory, name)).then(value => value.mtimeMs, () => Infinity) })))
          controller.signal.throwIfAborted()
          await Promise.all(files.sort((a, b) => b.time - a.time).slice(MAX_REPORT_FILES)
            .map(file => unlink(file.path).catch(() => {})))
        }
      } catch { /* Optional diagnostics cannot fail a request. */ }
      finally { if (temporary) await unlink(temporary).catch(() => {}) }
    }
    try { await Promise.race([write(), expired]) }
    finally { clearTimeout(timer) }
  }
}
