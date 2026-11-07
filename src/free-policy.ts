/** Free-specific error semantics; Go account classification remains unchanged. */

export function classifyFreeGatewayError(status: number, body: string): string | undefined {
  let error: { type?: unknown; code?: unknown; message?: unknown } = {}
  try {
    const parsed = JSON.parse(body)
    error = parsed?.error && typeof parsed.error === 'object' ? parsed.error : parsed ?? {}
  } catch { /* Access proxies may return HTML instead of JSON. */ }
  const types = [error.type, error.code].filter((value): value is string => typeof value === 'string')
    .map(value => value.replace(/[^a-z0-9]/gi, '').toLowerCase())
  // This gateway limit is shared by public access / IP, not a rejected Go key.
  if (types.includes('freeusagelimiterror')) return 'FREE_QUOTA'
  // Explicit account errors retain the existing account fallback semantics.
  if (types.some(type => ['creditserror', 'monthlylimiterror', 'userlimiterror', 'gousagelimiterror',
    'insufficientquota', 'quotaexceeded', 'autherror', 'authenticationerror', 'invalidapikey', 'invalidkey',
    'regionerror', 'datapolicyerror', 'modelerror', 'modelnotfound', 'unknownmodel'].includes(type))) return undefined
  const message = typeof error.message === 'string' ? error.message : body
  if (status === 429) return /free (?:usage |daily )?(?:limit|quota)/i.test(message) ? 'FREE_QUOTA' : 'FREE_RATE_LIMIT'
  if (status === 403) {
    if (/(?:invalid|incorrect|expired)[ _-]?(?:api[ _-]?)?key|invalid credential/i.test(message)) return undefined
    if (/free[\s\S]{0,100}(?:only|work|available)[\s\S]{0,100}opencode|opencode[\s\S]{0,60}(?:client|only)/i.test(message)) {
      return 'FREE_CLIENT_RESTRICTED'
    }
    return 'FREE_ACCESS_DENIED'
  }
  return undefined
}

/** Parse delta-seconds or HTTP-date, accounting for a server clock when supplied. */
export function retryAfterDeadline(value: string | null, now = Date.now(), serverDate?: string | null): number | undefined {
  if (value === null) return undefined
  const raw = value.trim()
  let delay: number
  if (/^\d+$/.test(raw)) delay = Number(raw) * 1000
  else {
    // Date.parse also accepts negative numbers and arbitrary numeric dates.
    if (!/^(?:[A-Za-z]{3},|[A-Za-z]+,|[A-Za-z]{3} [A-Za-z]{3} )/.test(raw)) return undefined
    const date = Date.parse(raw)
    const server = serverDate ? Date.parse(serverDate) : NaN
    delay = Math.max(0, date - (Number.isFinite(server) ? server : now))
  }
  const until = now + delay
  return Number.isSafeInteger(until) && until >= now && until <= 8.64e15 ? until : undefined
}
