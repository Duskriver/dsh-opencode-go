/** Shared by Host validation and the browser form; never echo proxy credentials. */
export function assertProxyURL(raw: string | undefined): string {
  const value = raw?.trim() ?? ''
  if (!value) return ''
  let url: URL
  try { url = new URL(value) }
  catch { throw new Error('OpenCode Go: proxy address must be a valid URL') }
  if (!['http:', 'https:', 'socks5:'].includes(url.protocol)) {
    throw new Error('OpenCode Go: proxy address must use http://, https:// or socks5://')
  }
  if (!url.hostname || url.port === '0' || (url.pathname !== '' && url.pathname !== '/') || url.search || url.hash) {
    throw new Error('OpenCode Go: proxy address must contain a host and optional port, without a path, query or fragment')
  }
  try { decodeURIComponent(url.username); decodeURIComponent(url.password) }
  catch { throw new Error('OpenCode Go: proxy credentials contain invalid URL encoding') }
  return url.href
}
