/** Live profile configuration, validation and settings presentation. */
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-settings'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import {
  DEFAULT_MAX_REQUEST_IMAGE_BYTES,
  DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
  DEFAULT_BASE_URL,
  DEFAULT_FREE_BASE_URL,
  migrateGatewayBaseURL,
  DEFAULT_USAGE_DISPLAY,
  USAGE_DISPLAY_MODES,
  DEFAULT_USAGE_PILL_STYLE,
  USAGE_PILL_STYLES,
  DEFAULT_OPENCODE_GO_THEME,
  OPENCODE_GO_THEMES,
  ACCOUNT_REF_PATTERN,
  DEFAULT_ACCOUNT_REF,
  MAX_ACCOUNTS,
  MAX_THINKING_BUDGET_TOKENS,
  type OpencodeGoConfig,
  PROFILE_ENTRY_ID,
  assertProxyURL,
  assertAccounts,
} from './contracts.ts'
import type { Context } from '@deepseek-ai/cordis'

export type { OpencodeGoConfig, OpencodeGoModelLimit, OpencodeGoModelLimits } from './contracts.ts'

/** Environment variable resolving the OpenCode API key. */
export const DEFAULT_API_KEY_ENV = DEFAULT_ACCOUNT_REF

/** Successful refresh lifetime; failed refreshes retry sooner and explicit discovery revalidates immediately. */
export const DEFAULT_REFRESH_MINUTES = 60

/** Default maximum idle interval while a stream read is outstanding. */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000

export const DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS = 60_000

export const DEFAULT_REQUEST_TIMEOUT_MS = 30 * 60_000

/** Runtime schema for {@link OpencodeGoConfig}. */
const fields = {
  enabled: z.boolean().default(true),
  // Free access is deliberately off unless the user opts in: requests are sent
  // as the official OpenCode CLI user agent and may violate upstream terms.
  freeEnabled: z.boolean().default(false),
  usageDisplay: z.union(USAGE_DISPLAY_MODES.map(mode => z.const(mode))).default(DEFAULT_USAGE_DISPLAY),
  showSidebarQuota: z.boolean().default(false),
  usagePillStyle: z.union(USAGE_PILL_STYLES.map(style => z.const(style))).default(DEFAULT_USAGE_PILL_STYLE),
  appearanceTheme: z.union(OPENCODE_GO_THEMES.map(theme => z.const(theme))).default(DEFAULT_OPENCODE_GO_THEME),
  modelVisibility: z.dict(z.boolean().required()).default({}),
  // A bare environment variable name: an empty string would otherwise pass the
  // schema, then never match any account (accountRefOf normalizes it away) and
  // silently deregister the route while the default credential still resolves.
  apiKeyEnv: z.string().role('credential-ref').pattern(ACCOUNT_REF_PATTERN).default(DEFAULT_API_KEY_ENV),
  accounts: z.union([z.const(null), z.array(z.object({
    id: z.string().required(), name: z.string().required(),
    apiKeyEnv: z.string().role('credential-ref').pattern(ACCOUNT_REF_PATTERN).required(),
  })).max(MAX_ACCOUNTS)]).default(null),
  autoSwitch: z.boolean().default(false),
  // Settings rebuild and serialize this schema before sending it to clients.
  // Keep it data-only: a rehydrated transform loses its callback on forwarding.
  baseURL: z.string().default(DEFAULT_BASE_URL),
  freeBaseURL: z.string().default(DEFAULT_FREE_BASE_URL),
  proxyURL: z.string().default(''),
  refreshMinutes: z.number().step(1).min(1).max(7 * 24 * 60).default(DEFAULT_REFRESH_MINUTES),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  requestPreparationTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS),
  requestTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(DEFAULT_REQUEST_TIMEOUT_MS),
  maxImages: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
  // The image defaults are the generic pi-ai adapter's: one normalized
  // request image fits the budget, and fifteen of them fit the payload cap.
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
  // null explicitly selects catalog values, overriding even inherited profile limits.
  modelLimits: z.dict(z.union([z.const(null), z.object({
    contextWindow: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)]),
    maxTokens: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)]),
    thinkingBudgets: z.union([z.const(null), z.array(z.number().step(1).min(1).max(MAX_THINKING_BUDGET_TOKENS).required()).max(16)]),
  })])).default({}),
}

/** Plain configuration values used by validation and direct adapter consumers. */
export const PlainConfig: z<OpencodeGoConfig> = z.object(fields)

/** Derive defaults from the same schema used by persisted profile settings. */
export const DEFAULT_CONFIG: Readonly<OpencodeGoConfig> = PlainConfig()

/** Fill omitted profile fields and normalize the legacy official gateway. */
export function normalizeConfig(value: Partial<OpencodeGoConfig> = {}): OpencodeGoConfig {
  const config = PlainConfig({ ...DEFAULT_CONFIG, ...value })
  return { ...config, baseURL: migrateGatewayBaseURL(config.baseURL) }
}

/** The Loader retains these references when profile fields change. */
export type LiveConfig = { [K in keyof OpencodeGoConfig]-?: { get(): OpencodeGoConfig[K] } }

export const Config = z.object(Object.fromEntries(
  Object.entries(fields).map(([key, schema]) => [key, schema.volatile()]),
)) as z<Partial<OpencodeGoConfig>, LiveConfig>

/** Keep the Loader's references: reparsing them would detach live updates. */
export function readConfig(config: LiveConfig): OpencodeGoConfig {
  // Schemastery preserves unknown profile fields as plain values. Only the
  // fields declared above are volatile references owned by this plugin.
  const value = Object.fromEntries((Object.keys(fields) as Array<keyof OpencodeGoConfig>)
    .map(key => [key, config[key].get()])) as unknown as OpencodeGoConfig
  return { ...value, baseURL: migrateGatewayBaseURL(value.baseURL) }
}

/**
 * Render a base URL for an error message without URL credentials, query or
 * fragment. A string URL cannot carry header secrets, but `user:password@` is
 * exactly the input these diagnostics must never echo; an unparseable string
 * that mentions `@` is therefore replaced with a placeholder.
 * @param raw - the user-supplied base URL.
 * @returns the safe display form.
 */
function diagnosticBaseURL(raw: string): string {
  try {
    const url = new URL(raw)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.href
  } catch {
    return raw.includes('@') ? '[redacted URL]' : raw
  }
}

/**
 * Accept only an http(s) base without embedded credentials, query or fragment.
 * Runs at load for the composition layer and as the settings section's write
 * validator, so a bad URL fails where it is written, never at first request.
 * Credentials never belong in this URL: `fetch` rejects such URLs outright and
 * any failure diagnostic could otherwise carry them, so the value is refused
 * before it can reach a request or a log line.
 * @param raw - the configured base URL.
 * @param field - configuration field name for the diagnostic.
 * @returns the current gateway base URL without trailing slashes.
 */
export function assertBaseURL(raw: string, field: 'baseURL' | 'freeBaseURL' = 'baseURL'): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`llm-opencode-go: ${field} "${diagnosticBaseURL(raw)}" is not a valid URL`)
  }
  if (url.username || url.password) {
    throw new Error(`llm-opencode-go: ${field} must not embed credentials; remove the user:password@ part`)
  }
  const display = diagnosticBaseURL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`llm-opencode-go: ${field} "${display}" must be http or https`)
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`llm-opencode-go: ${field} "${display}" must not carry a query or fragment`)
  }
  const normalized = url.toString().replace(/\/+$/, '')
  return field === 'baseURL' ? migrateGatewayBaseURL(normalized) : normalized
}

/**
 * Reject a selected credential reference that is not a bare environment
 * variable name. The schema pattern above fails the composition layer and the
 * settings write; this assert gives the load and validate paths a message that
 * names the field, instead of schemastery's generic regexp complaint.
 * @param raw - the configured credential reference.
 */
export function assertApiKeyEnv(raw: string): void {
  if (!ACCOUNT_REF_PATTERN.test(raw)) {
    throw new Error(`llm-opencode-go: apiKeyEnv "${raw}" must be an environment variable name ([A-Za-z_][A-Za-z0-9_]*)`)
  }
}

export function validateGoConfig(value: OpencodeGoConfig): void {
  assertBaseURL(value.baseURL)
  assertBaseURL(value.freeBaseURL, 'freeBaseURL')
  assertProxyURL(value.proxyURL)
  assertApiKeyEnv(value.apiKeyEnv)
  assertAccounts(value.accounts, value.apiKeyEnv)
}

/** DSH profile forms edit the plugin's live Config fields directly. */
export function installHostSettings(ctx: Context): void {
  ctx.inject(['settings'], settingsCtx => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber))
    let migrating = false
    const migrateSavedGateway = (): void => {
      if (migrating || !settingsCtx.settings.writable) return
      const row = settingsCtx.settings.describe().find(row => row.ns === PROFILE_ENTRY_ID)
      const raw = (row?.user as { baseURL?: unknown } | undefined)?.baseURL
      if (typeof raw !== 'string' || migrateGatewayBaseURL(raw) === raw) return
      migrating = true
      void settingsCtx.settings.mutate(PROFILE_ENTRY_ID,
        [{ op: 'set', path: ['baseURL'], value: migrateGatewayBaseURL(raw) }], row!.revision)
        .catch(() => { ctx.logger.warn('llm-opencode-go: could not save the migrated gateway address') })
        .finally(() => { migrating = false })
    }
    settingsCtx.on('settings/document-updated', ns => { if (ns === PROFILE_ENTRY_ID) migrateSavedGateway() })
    migrateSavedGateway()
  })
  ctx.on('internal/config', function (_raw, next) {
    const value = next()
    if (this !== ctx.fiber) return value
    const raw = value as { apiKeyEnv?: unknown; baseURL?: unknown }
    if (typeof raw.apiKeyEnv === 'string') assertApiKeyEnv(raw.apiKeyEnv)
    validateGoConfig(PlainConfig(value))
    return typeof raw.baseURL === 'string' ? { ...value, baseURL: migrateGatewayBaseURL(raw.baseURL) } : value
  })
}
