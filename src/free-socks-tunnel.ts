/** Loopback CONNECT relay: SOCKS carries bytes; only Bun negotiates target TLS. */
import { createServer, Agent, request as httpRequest, type IncomingMessage, type OutgoingHttpHeaders } from 'node:http'
import { connect, isIP, type Socket } from 'node:net'
import { randomBytes } from 'node:crypto'

function hostname(url: URL): string { return url.hostname.replace(/^\[|\]$/g, '') }

/** Idle limit for a relayed connection: no bytes in either direction means teardown. */
const DEFAULT_IDLE_TIMEOUT_MS = 120_000

/** Restrictions for one loopback relay instance. */
export interface SocksTunnelOptions {
  /**
   * The only target host the relay may reach. Omitted keeps the unconstrained
   * behavior used by direct tests; Free always passes the request hostname so a
   * local process that learns the port and password cannot use it as an open
   * proxy to arbitrary destinations.
   */
  allowedHost?: string
  /** Overridable idle limit for tests; defaults to two minutes. */
  idleTimeoutMs?: number
}

/**
 * Canonicalize a host for comparisons: lower-case, brackets stripped and the
 * URL parser's IPv4/IPv6 normalization applied when possible. Both sides of a
 * comparison go through this, so differing input spellings cannot bypass the
 * allowlist and a malformed host cannot match another host by accident.
 */
function normalizeHost(host: string): string {
  const plain = host.replace(/^\[|\]$/g, '').trim().toLowerCase()
  const candidate = plain.includes(':') ? `[${plain}]` : plain
  try { return hostname(new URL(`http://${candidate}/`)) } catch { return plain }
}

async function read(socket: Socket, size: number): Promise<Buffer> {
  for (;;) {
    const bytes = socket.read(size) as Buffer | null
    if (bytes) {
      if (bytes.length !== size) throw new Error('Incomplete SOCKS reply')
      return bytes
    }
    if (socket.destroyed || socket.readableEnded) throw new Error('SOCKS connection closed')
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { socket.off('readable', ready); socket.off('error', error); socket.off('end', end); socket.off('close', end) }
      const ready = () => { cleanup(); resolve() }
      const error = (cause: Error) => { cleanup(); reject(cause) }
      const end = () => { cleanup(); reject(new Error('SOCKS connection closed')) }
      socket.once('readable', ready); socket.once('error', error); socket.once('end', end); socket.once('close', end)
    })
  }
}

function address(host: string): Buffer {
  if (isIP(host) === 4) return Buffer.from([1, ...host.split('.').map(Number)])
  if (isIP(host) === 6) {
    const normalized = host.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) =>
      `${(Number(a) * 256 + Number(b)).toString(16)}:${(Number(c) * 256 + Number(d)).toString(16)}`)
    const [left, right] = normalized.split('::')
    const head = left ? left.split(':') : []
    const tail = right ? right.split(':') : []
    const groups = right === undefined ? head : [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail]
    const bytes = Buffer.alloc(17); bytes[0] = 4
    groups.forEach((group, i) => bytes.writeUInt16BE(parseInt(group, 16), i * 2 + 1))
    return bytes
  }
  const bytes = Buffer.from(host)
  if (bytes.length > 255) throw new Error('SOCKS target hostname exceeds limit')
  return Buffer.concat([Buffer.from([3, bytes.length]), bytes])
}

async function socksConnect(proxy: URL, target: URL, signal: AbortSignal, track: (socket: Socket) => Socket): Promise<Socket> {
  signal.throwIfAborted()
  const socket = track(connect({ host: hostname(proxy), port: Number(proxy.port) || 1080 }))
  const abort = () => { socket.destroy() }
  signal.addEventListener('abort', abort, { once: true })
  socket.once('close', () => signal.removeEventListener('abort', abort))
  socket.setTimeout(10_000, () => socket.destroy(new Error('SOCKS handshake timed out')))
  try {
    const user = Buffer.from(decodeURIComponent(proxy.username))
    const password = Buffer.from(decodeURIComponent(proxy.password))
    socket.write(Buffer.from(user.length || password.length ? [5, 2, 0, 2] : [5, 1, 0]))
    const greeting = await read(socket, 2)
    if (greeting[0] !== 5 || ![0, 2].includes(greeting[1]!)) throw new Error('SOCKS authentication rejected')
    if (greeting[1] === 2) {
      if (!user.length || user.length > 255 || password.length > 255) throw new Error('SOCKS credentials exceed protocol limits')
      socket.write(Buffer.concat([Buffer.from([1, user.length]), user, Buffer.from([password.length]), password]))
      const auth = await read(socket, 2)
      if (auth[0] !== 1 || auth[1] !== 0) throw new Error('SOCKS authentication rejected')
    }
    const port = Buffer.alloc(2); port.writeUInt16BE(Number(target.port) || (target.protocol === 'https:' ? 443 : 80))
    socket.write(Buffer.concat([Buffer.from([5, 1, 0]), address(hostname(target)), port]))
    const reply = await read(socket, 4)
    if (reply[0] !== 5 || reply[1] !== 0) throw new Error('SOCKS target connection rejected')
    const size = reply[3] === 1 ? 4 : reply[3] === 4 ? 16 : reply[3] === 3 ? (await read(socket, 1))[0]! : -1
    if (size < 0) throw new Error('Invalid SOCKS reply address')
    await read(socket, size + 2)
    socket.setTimeout(0)
    return socket
  } catch (error) { socket.destroy(); throw error }
}

export async function openSocksTunnel(
  raw: string,
  signal: AbortSignal,
  options: SocksTunnelOptions = {},
): Promise<{ url: string; close(): Promise<void> }> {
  const proxy = new URL(raw)
  const sockets = new Set<Socket>()
  const track = (socket: Socket) => {
    sockets.add(socket)
    socket.on('error', () => {})
    socket.once('close', () => sockets.delete(socket))
    return socket
  }
  const password = randomBytes(24).toString('hex')
  const authorization = `Basic ${Buffer.from(`free:${password}`).toString('base64')}`
  const authorized = (request: IncomingMessage) => request.headers['proxy-authorization'] === authorization
  const allowedHost = options.allowedHost === undefined ? undefined : normalizeHost(options.allowedHost)
  const permitted = (target: URL): boolean => allowedHost === undefined || normalizeHost(hostname(target)) === allowedHost
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
  const idleTimers = new Set<ReturnType<typeof setTimeout>>()
  /** Tear a relayed pair down after `idleTimeoutMs` without bytes in either direction. */
  const idle = (first: Socket, second: Socket): void => {
    if (!(idleTimeoutMs > 0)) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const clear = (): void => {
      if (timer === undefined) return
      clearTimeout(timer)
      idleTimers.delete(timer)
      timer = undefined
    }
    const arm = (): void => {
      clear()
      timer = setTimeout(() => {
        idleTimers.delete(timer!)
        timer = undefined
        first.destroy()
        second.destroy()
      }, idleTimeoutMs)
      timer.unref()
      idleTimers.add(timer)
    }
    for (const socket of [first, second]) {
      socket.on('data', arm)
      socket.once('close', clear)
    }
    arm()
  }
  const server = createServer(async (request, response) => {
    let agent: Agent | undefined
    try {
      const destination = new URL(request.url ?? '')
      if (!authorized(request) || destination.protocol !== 'http:' || !permitted(destination)) {
        response.writeHead(403).end(); return
      }
      const socket = await socksConnect(proxy, destination, signal, track)
      if (request.destroyed || signal.aborted) { socket.destroy(); response.destroy(); return }
      agent = new Agent({ keepAlive: false })
      agent.createConnection = () => socket
      const headers: OutgoingHttpHeaders = { ...request.headers, host: destination.host }
      delete headers['proxy-authorization']; delete headers['proxy-connection']
      const upstream = httpRequest(destination, { method: request.method, headers, agent }, incoming => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers)
        incoming.pipe(response)
      })
      upstream.on('error', () => response.destroy())
      request.on('aborted', () => upstream.destroy())
      response.once('close', () => { upstream.destroy(); agent?.destroy() })
      request.pipe(upstream)
      // IncomingMessage#socket is a net.Socket for HTTP server requests.
      idle(request.socket as Socket, socket)
    } catch { agent?.destroy(); response.destroy() }
  })
  server.on('connection', socket => { track(socket) })
  server.on('connect', (request, client, head) => {
    void (async () => {
      try {
        const destination = new URL(`https://${request.url}`)
        if (!authorized(request) || !permitted(destination)) {
          client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return
        }
        const upstream = await socksConnect(proxy, destination, signal, track)
        if (client.destroyed || signal.aborted) { upstream.destroy(); client.destroy(); return }
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) upstream.write(head)
        client.pipe(upstream).pipe(client)
        client.once('close', () => upstream.destroy())
        upstream.once('close', () => client.destroy())
        // node:http types the CONNECT socket as Duplex; it is a net.Socket.
        idle(client as Socket, upstream)
      } catch { client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n') }
    })()
  })
  let closing: Promise<void> | undefined
  const close = () => closing ??= new Promise<void>(resolve => {
    signal.removeEventListener('abort', abort)
    for (const timer of idleTimers) clearTimeout(timer)
    idleTimers.clear()
    for (const socket of sockets) socket.destroy()
    server.close(() => resolve())
  })
  const abort = () => { void close() }
  try {
    signal.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve() })
    })
    server.on('error', () => { void close() })
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { await close(); signal.throwIfAborted() }
    const bound = server.address()
    if (!bound || typeof bound === 'string') throw new Error('SOCKS relay did not bind')
    return { url: `http://free:${password}@127.0.0.1:${bound.port}`, close }
  } catch (error) { await close(); throw error }
}
