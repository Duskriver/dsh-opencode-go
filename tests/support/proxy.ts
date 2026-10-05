import { createServer as httpServer } from 'node:http'
import { connect, createServer as tcpServer } from 'node:net'
import type { Socket } from 'node:net'

/** Real loopback proxies; a mapped target lets tests use an otherwise unreachable hostname. */
export async function mockProxy(protocol: 'http' | 'socks5', options: {
  target?: string
  username?: string
  password?: string
} = {}) {
  const destinations: string[] = []
  const authorizations: string[] = []
  const sockets = new Set<Socket>()
  const track = (socket: Socket) => {
    sockets.add(socket)
    socket.on('close', () => { sockets.delete(socket) })
    socket.on('error', () => {})
    return socket
  }
  const tunnel = (client: Socket, host: string, port: number, ready: () => void, head = Buffer.alloc(0)) => {
    destinations.push(`${host}:${port}`)
    const target = options.target ? new URL(options.target) : undefined
    const upstream = track(connect({ host: target?.hostname ?? host, port: target ? Number(target.port) : port }))
    upstream.on('connect', () => {
      ready()
      if (head.length) upstream.write(head)
      client.pipe(upstream).pipe(client)
    })
    upstream.on('error', () => { client.destroy() })
    client.on('close', () => { upstream.destroy() })
  }
  const server = protocol === 'http' ? httpServer((_req, res) => { res.writeHead(500).end() }) : tcpServer()
  server.on('connection', socket => { track(socket) })
  if (protocol === 'http') {
    server.on('connect', (req, client, head) => {
      const auth = req.headers['proxy-authorization'] ?? ''
      authorizations.push(auth)
      if (options.username && auth !== `Basic ${Buffer.from(`${options.username}:${options.password}`).toString('base64')}`) {
        client.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n')
        return
      }
      const url = new URL(`http://${req.url}`)
      tunnel(client as Socket, url.hostname, Number(url.port) || 80,
        () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n') }, head)
    })
  } else {
    server.on('connection', client => {
      let data = Buffer.alloc(0)
      let state = 'greeting'
      const consume = (size: number) => { data = data.subarray(size) }
      const read = (chunk: Buffer) => {
        data = Buffer.concat([data, chunk])
        if (state === 'greeting') {
          if (data.length < 2 || data.length < 2 + data[1]!) return
          consume(2 + data[1]!)
          client.write(Buffer.from([5, options.username ? 2 : 0]))
          state = options.username ? 'auth' : 'connect'
        }
        if (state === 'auth') {
          if (data.length < 2 || data.length < 3 + data[1]!) return
          const nameLength = data[1]!
          const passwordLength = data[2 + nameLength]!
          if (data.length < 3 + nameLength + passwordLength) return
          const username = data.subarray(2, 2 + nameLength).toString()
          const password = data.subarray(3 + nameLength, 3 + nameLength + passwordLength).toString()
          authorizations.push(`${username}:${password}`)
          consume(3 + nameLength + passwordLength)
          const ok = username === options.username && password === options.password
          client.write(Buffer.from([1, ok ? 0 : 1]))
          if (!ok) { client.end(); return }
          state = 'connect'
        }
        if (state !== 'connect' || data.length < 5) return
        const kind = data[3]!
        const size = kind === 3 ? 7 + data[4]! : kind === 1 ? 10 : 22
        if (data.length < size) return
        const host = kind === 3 ? data.subarray(5, size - 2).toString()
          : kind === 1 ? [...data.subarray(4, 8)].join('.') : '::1'
        const port = data.readUInt16BE(size - 2)
        consume(size)
        state = 'tunnel'
        client.removeListener('data', read)
        tunnel(client, host, port, () => { client.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0])) }, data)
      }
      client.on('data', read)
    })
  }
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing proxy address')
  return {
    url: `${protocol}://127.0.0.1:${address.port}`,
    destinations, authorizations,
    close: async () => {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}
