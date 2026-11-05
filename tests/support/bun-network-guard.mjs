/** Preserve the suite's network isolation inside the real Bun HTTP worker. */
const fetchNetwork = globalThis.fetch
const local = host => ['127.0.0.1', 'localhost', '[::1]'].includes(host)
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  const fixtureProxy = init?.proxy && local(new URL(typeof init.proxy === 'string' ? init.proxy : init.proxy.url).hostname)
  if (!local(url.hostname) && !(url.hostname.endsWith('.invalid') && fixtureProxy)) {
    throw new Error('Unexpected external Bun test request')
  }
  return fetchNetwork(input, init)
}
