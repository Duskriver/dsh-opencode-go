import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

export interface MockGateway {
  url: string
  paths: string[]
  headers: IncomingMessage['headers'][]
  bodies: unknown[]
  /** How many times `GET /models` was answered. */
  modelListings: number
  setModelListing: (status: number, body: unknown) => void
  pushCompletions: (script: CompletionsScript) => void
  close: () => Promise<void>
}

/** One scripted chat-completions behavior. */
export interface CompletionsScript {
  status?: number
  events?: string[]
  /** Anthropic requires named SSE events as well as each JSON event's type. */
  namedEvents?: boolean
  body?: string
  headers?: Record<string, string>
  /** Milliseconds between SSE events; exceeding the idle timeout fails the stream. */
  delayMs?: number
  /** Write the events and leave the response open, until the caller aborts. */
  hangOpen?: boolean
}

const servers: Server[] = []

/** Close every gateway opened since the last call; run from each spec's afterEach. */
export async function closeMockGateways(): Promise<void> {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))))
}

/** A minimal complete text generation in pi-ai's chat-completions shape. */
export const textEvents = [
  '{"choices":[{"delta":{"role":"assistant","content":""},"index":0,"finish_reason":null}]}',
  '{"choices":[{"delta":{"content":"hello"},"index":0,"finish_reason":null}]}',
  '{"choices":[{"delta":{},"index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}',
  '[DONE]',
]

/**
 * OpenCode Go gateway stand-in: `GET /models` answers the configured listing,
 * `POST /chat/completions` replays scripted SSE behaviors in order.
 */
export async function mockGateway(modelListing: { status: number; body: unknown; responseBodyTransform?: (body: Buffer) => Buffer }): Promise<MockGateway> {
  const paths: string[] = []
  const headers: IncomingMessage['headers'][] = []
  const bodies: unknown[] = []
  let listing = modelListing
  let modelListings = 0
  const completions: CompletionsScript[] = []
  const openResponses = new Set<ServerResponse>()
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    openResponses.add(response)
    response.on('close', () => {
      openResponses.delete(response)
    })
    let body = ''
    request.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
    request.on('end', () => {
      paths.push(request.url ?? '')
      headers.push(request.headers)
      if ((request.url === '/models' || request.url === '/v1/models') && request.method === 'GET') {
        modelListings += 1
        const payload = Buffer.from(JSON.stringify(listing.body))
        const transformed = listing.responseBodyTransform?.(payload) ?? payload
        response.writeHead(listing.status, { 'content-type': 'application/json', 'content-length': String(transformed.byteLength) })
        response.end(transformed)
        return
      }
      bodies.push(body.length === 0 ? undefined : JSON.parse(body))
      const behavior = completions.shift()
      if (behavior === undefined) {
        response.writeHead(500, { 'content-type': 'application/json' })
        response.end('{"error":"script exhausted"}')
        return
      }
      if (behavior.status !== undefined && behavior.status !== 200) {
        response.writeHead(behavior.status, { 'content-type': 'application/json', ...behavior.headers })
        response.end(behavior.body ?? '{}')
        return
      }
      if (behavior.body !== undefined) {
        response.writeHead(200, { 'content-type': 'application/json', ...behavior.headers })
        response.end(behavior.body)
        return
      }
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      if (behavior.hangOpen === true) {
        for (const event of behavior.events ?? []) response.write(`data: ${event}\n\n`)
        return
      }
      let index = 0
      const writeNext = (): void => {
        const event = behavior.events?.[index++]
        if (event === undefined) { response.end(); return }
        response.write(`${behavior.namedEvents ? `event: ${JSON.parse(event).type}\n` : ''}data: ${event}\n\n`)
        if (behavior.delayMs === undefined) writeNext()
        else setTimeout(writeNext, behavior.delayMs)
      }
      writeNext()
    })
  })
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  return {
    url: `http://127.0.0.1:${address.port}`,
    paths,
    headers,
    bodies,
    get modelListings() { return modelListings },
    setModelListing: (status, bodyListing) => {
      listing = { status, body: bodyListing }
    },
    pushCompletions: (script) => {
      completions.push(script)
    },
    close: () => new Promise<void>((resolve) => {
      // Hanging abort-test responses keep the server alive unless destroyed.
      for (const response of openResponses) response.destroy()
      server.close(() => {
        resolve()
      })
    }),
  }
}

/** Every curated model id a listing must carry for the full table to serve. */
export function fullLiveListing(): string[] {
  return ['deepseek-v4-flash', 'deepseek-v4.1-flash', 'kimi-k3', 'minimax-m3']
}

/** The listing shape the gateway answers: an OpenAI `data` array of id rows. */
export function listingBody(ids: readonly string[]): unknown {
  return { object: 'list', data: ids.map(id => ({ id, object: 'model', created: 0, owned_by: 'opencode' })) }
}
