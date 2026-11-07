/** Executed by standalone Bun. One request, then raw response bytes until EOF. */
import type { FreeHttpRequest, FreeHttpResponse } from './free-protocol.ts'

let headersSent = false
function write(bytes: string | Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => process.stdout.write(bytes, error => error ? reject(error) : resolve()))
}

try {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  const input = JSON.parse(Buffer.concat(chunks).toString()) as FreeHttpRequest
  const options: RequestInit & { proxy?: string } = {
    method: input.method, headers: input.headers, redirect: input.redirect,
    ...(input.body === undefined ? {} : { body: new Uint8Array(Buffer.from(input.body, 'base64')) }),
    ...(input.proxy ? { proxy: input.proxy } : {}),
  }
  const response = await fetch(input.url, options)
  const metadata: FreeHttpResponse = {
    status: response.status, statusText: response.statusText, headers: [...response.headers],
    url: response.url, redirected: response.redirected,
  }
  await write(JSON.stringify(metadata) + '\n')
  headersSent = true
  if (response.body) for await (const chunk of response.body) await write(chunk)
} catch {
  // Network/IPC errors must not echo request URLs, authorization or proxy secrets.
  if (!headersSent) await write(JSON.stringify({ error: 'Free HTTP worker could not send the request' }) + '\n').catch(() => {})
  process.exitCode = 1
}
