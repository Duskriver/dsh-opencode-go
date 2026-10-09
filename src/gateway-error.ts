import { isQuotaExceededError } from '@deepseek-ai/dsh-llm'

/** Gateway status codes cover several domains; a 401 alone cannot reject a key. */
export function classifyGatewayError(status: number, body: string, fallback: string): string {
  let error: { type?: unknown; code?: unknown; message?: unknown } | undefined
  try {
    const parsed = JSON.parse(body)
    error = parsed?.error && typeof parsed.error === 'object' ? parsed.error : parsed
  } catch { /* Proxies may return plain text or HTML. Status remains authoritative. */ }
  const types = [error?.type, error?.code].filter((value): value is string => typeof value === 'string')
    .map(value => value.replace(/[^a-z0-9]/gi, '').toLowerCase())
  if (types.some(type => ['modelerror', 'modelnotfound', 'unknownmodel'].includes(type))) return 'UNKNOWN_MODEL'
  if (types.some(type => ['creditserror', 'monthlylimiterror', 'userlimiterror', 'gousagelimiterror',
    'insufficientquota', 'quotaexceeded'].includes(type))) return 'QUOTA'
  if (types.some(type => ['autherror', 'authenticationerror', 'invalidapikey', 'invalidkey'].includes(type))) return 'INVALID_CREDENTIAL'
  if (types.some(type => ['regionerror', 'datapolicyerror', 'permissionerror', 'permissiondenied'].includes(type))) return 'AUTH'
  if (types.some(type => ['ratelimiterror', 'ratelimitexceeded'].includes(type))) return 'RATE_LIMIT'
  const message = typeof error?.message === 'string' ? error.message : body
  // Legacy gateways report subscription limits as untyped 401/402/403/429.
  // A proxy's 5xx diagnostic may quote an earlier quota failure; it cannot
  // authorize switching accounts without structured evidence.
  if ([401, 402, 403, 429].includes(status) && isQuotaExceededError(message)) return 'QUOTA'
  if ((status === 401 || status === 403)
    && /(?:invalid|incorrect|expired)[ _-]?(?:api[ _-]?)?key|invalid credential/i.test(message)) return 'INVALID_CREDENTIAL'
  if (status === 401 || status === 402 || status === 403) return 'AUTH'
  if (status === 404) return 'UNKNOWN_MODEL'
  if (status === 429) return 'RATE_LIMIT'
  if (status === 408 || status === 504) return 'TIMEOUT'
  if (status >= 500) return 'SERVER'
  if (status === 400 || status === 413 || status === 422) {
    return fallback === 'CONTEXT_WINDOW_EXCEEDED' ? fallback : 'INVALID_REQUEST'
  }
  return fallback
}
