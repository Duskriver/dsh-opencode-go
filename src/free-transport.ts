/** Fetch-compatible Free transport. Bun owns target TLS; Node owns SDK parsing. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { dirname } from 'node:path'
import { assertProxyURL } from './contracts.ts'
import { waitWithSignal } from './transport.ts'
import { freeWorkerPath, resolveFreeRuntime } from './free-runtime.ts'
import { openSocksTunnel } from './free-socks-tunnel.ts'
import type { FreeHttpRequest, FreeHttpResponse } from './free-protocol.ts'

export const OPENCODE_FREE_USER_AGENT = 'opencode/latest/2.2.5/cli'
const MAX_METADATA_BYTES = 64 * 1024
const MAX_PACKET_BYTES = 256 * 1024 * 1024

export class FreeBunTransport {
  private readonly shutdown = new AbortController()
  private readonly workers = new Set<Promise<void>>()
  private readonly requests = new Set<Promise<Response>>()
  private readonly waiters = new Set<() => void>()
  private active = 0

  constructor(private readonly options: {
    executable?: () => string
    workerPath?: () => string
    maxConcurrent?: number
  } = {}) {
    if (options.maxConcurrent !== undefined && (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1)) {
      throw new RangeError('Free transport concurrency must be a positive integer')
    }
  }

  forProxy(raw?: string): typeof globalThis.fetch {
    const proxy = assertProxyURL(raw)
    // Resolve before entering the SDK so missing-runtime errors keep their
    // actionable LlmError code instead of becoming generic connection errors.
    const executable = (this.options.executable ?? resolveFreeRuntime)()
    const worker = (this.options.workerPath ?? freeWorkerPath)()
    return (input, init) => {
      const pending = this.fetchRequest(input, init, proxy, executable, worker)
      this.requests.add(pending)
      void pending.then(() => this.requests.delete(pending), () => this.requests.delete(pending))
      return pending
    }
  }

  private async acquire(signal: AbortSignal): Promise<() => void> {
    while (this.active >= (this.options.maxConcurrent ?? 4)) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { this.waiters.delete(wake); signal.removeEventListener('abort', abort) }
        const wake = () => { cleanup(); resolve() }
        const abort = () => { cleanup(); reject(signal.reason) }
        this.waiters.add(wake)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })
    }
    signal.throwIfAborted()
    this.active++
    let released = false
    return () => {
      if (released) return
      released = true
      this.active--
      this.waiters.values().next().value?.()
    }
  }

  private async fetchRequest(input: Parameters<typeof fetch>[0], init: RequestInit | undefined, proxy: string, executable: string, worker: string): Promise<Response> {
    const request = new Request(input, init)
    const signal = AbortSignal.any([request.signal, this.shutdown.signal])
    signal.throwIfAborted()
    const url = new URL(request.url)
    if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Free transport requires an HTTP URL')
    const release = await this.acquire(signal)
    let relay: Awaited<ReturnType<typeof openSocksTunnel>> | undefined
    let started = false
    try {
      const body = ['GET', 'HEAD'].includes(request.method) ? undefined
        : Buffer.from(await waitWithSignal(() => request.arrayBuffer(), signal)).toString('base64')
      signal.throwIfAborted()
      if (proxy.startsWith('socks5:')) relay = await openSocksTunnel(proxy, signal)
      signal.throwIfAborted()
      const packet: FreeHttpRequest = {
        url: request.url, method: request.method, headers: [...request.headers], body,
        redirect: request.redirect, ...proxy ? { proxy: relay?.url ?? proxy } : {},
      }
      const serialized = JSON.stringify(packet)
      if (Buffer.byteLength(serialized) > MAX_PACKET_BYTES) throw new RangeError('Free HTTP request exceeds the 256 MiB IPC limit')
      const env = { ...process.env }
      // Match Node's explicit proxy setting rather than silently inheriting a
      // different proxy from Bun's HTTP_PROXY/ALL_PROXY support.
      for (const name of ['BUN_BE_BUN', 'NODE_OPTIONS', 'BUN_OPTIONS', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy']) delete env[name]
      const child = spawn(executable, ['--no-env-file', worker], {
        env, cwd: dirname(worker), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
      })
      started = true
      const tunnel = relay
      const closed = new Promise<void>(resolve => child.once('close', () => {
        void tunnel?.close().finally(() => { release(); resolve() })
        if (!tunnel) { release(); resolve() }
      }))
      this.workers.add(closed)
      void closed.finally(() => this.workers.delete(closed))
      return await this.response(child, request, signal, serialized)
    } catch (error) {
      // Spawned workers release their slot only after process/tunnel teardown.
      if (!started) { release(); await relay?.close() }
      throw error
    }
  }

  private response(child: ChildProcessWithoutNullStreams, request: Request, signal: AbortSignal, packet: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0)
      let received = false
      let finished = false
      let controller: ReadableStreamDefaultController<Uint8Array>
      let killTimer: ReturnType<typeof setTimeout> | undefined
      const cleanup = () => { signal.removeEventListener('abort', abort) }
      const stop = () => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGTERM')
          killTimer ??= setTimeout(() => child.kill('SIGKILL'), 1000)
          killTimer.unref()
        }
        child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy()
      }
      const fail = (error: unknown) => {
        if (finished) return
        finished = true
        cleanup()
        if (received) controller.error(error)
        else reject(error)
        stop()
      }
      const abort = () => fail(signal.reason)
      const stream = new ReadableStream<Uint8Array>({
        start(value) { controller = value },
        pull() { child.stdout.resume() },
        cancel() { if (!finished) { finished = true; cleanup(); stop() } },
      })
      child.stderr.resume()
      child.stdin.on('error', () => fail(new TypeError('Free HTTP worker input failed')))
      child.on('error', () => fail(new TypeError('Free HTTP worker could not start')))
      child.stdout.on('data', (bytes: Buffer) => {
        if (finished) return
        if (!received) {
          buffer = Buffer.concat([buffer, bytes])
          const newline = buffer.indexOf(10)
          if (newline < 0) {
            if (buffer.length > MAX_METADATA_BYTES) fail(new TypeError('Free HTTP worker headers exceed limit'))
            return
          }
          if (newline > MAX_METADATA_BYTES) return fail(new TypeError('Free HTTP worker headers exceed limit'))
          let metadata: FreeHttpResponse
          try {
            metadata = JSON.parse(buffer.subarray(0, newline).toString())
            if (!Number.isInteger(metadata.status) || metadata.status < 200 || metadata.status > 599 || !Array.isArray(metadata.headers)) throw new Error()
            const noBody = request.method === 'HEAD' || [204, 205, 304].includes(metadata.status)
            const response = new Response(noBody ? null : stream, {
              status: metadata.status, statusText: metadata.statusText, headers: metadata.headers,
            })
            Object.defineProperties(response, { url: { value: metadata.url }, redirected: { value: metadata.redirected } })
            received = true
            resolve(response)
          } catch { return fail(new TypeError('Free HTTP worker could not send the request')) }
          bytes = buffer.subarray(newline + 1)
          buffer = Buffer.alloc(0)
        }
        if (bytes.length) {
          controller.enqueue(new Uint8Array(bytes))
          if ((controller.desiredSize ?? 0) <= 0) child.stdout.pause()
        }
      })
      child.once('close', code => {
        if (killTimer) clearTimeout(killTimer)
        if (finished) return
        if (code !== 0 || !received) return fail(new TypeError('Free HTTP worker stopped before the response completed'))
        finished = true
        cleanup()
        controller.close()
      })
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) { abort(); return }
      child.stdin.end(packet)
    })
  }

  async dispose(): Promise<void> {
    this.shutdown.abort(new DOMException('Free transport disposed', 'AbortError'))
    await Promise.allSettled([...this.requests, ...this.workers])
  }
}
