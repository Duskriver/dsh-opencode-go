/**
 * Configuration schema for the OpenCode Go adapter plugin. The section is
 * installed under the `llm-opencode-go` settings namespace on DSH 0.1.5/0.1.6.
 * DSH 0.1.7 edits the `opencode-go` profile entry through live references.
 * Both paths update field by field without a restart. Self-contained constraints
 * (URL shape, numeric bounds) fail at load for the composition layer and
 * refuse the write for the settings layer.
 *
 * @module dsh-llm-opencode-go/config
 */

import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import {
  DEFAULT_MAX_REQUEST_IMAGE_BYTES,
  DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
} from './conversion/index.ts'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_BASE_URL } from './catalog.ts'
import { DEFAULT_USAGE_DISPLAY, USAGE_DISPLAY_MODES } from './usage-display.ts'
import { ACCOUNT_REF_PATTERN, DEFAULT_ACCOUNT_REF, MAX_ACCOUNTS } from './accounts.ts'
import type { OpencodeGoConfig } from './config-contract.ts'
export type { OpencodeGoConfig, OpencodeGoModelLimit, OpencodeGoModelLimits } from './config-contract.ts'

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
  usageDisplay: z.union(USAGE_DISPLAY_MODES.map(mode => z.const(mode))).default(DEFAULT_USAGE_DISPLAY),
  modelVisibility: z.dict(z.boolean().required()).default({}),
  protocolOverrides: z.dict(z.union([z.const(null), z.const('openai-responses')])).default({}),
  // A bare environment variable name: an empty string would otherwise pass the
  // schema, then never match any account (accountRefOf normalizes it away) and
  // silently deregister the route while the default credential still resolves.
  apiKeyEnv: z.string().role('credential-ref').pattern(ACCOUNT_REF_PATTERN).default(DEFAULT_API_KEY_ENV),
  accounts: z.union([z.const(null), z.array(z.object({
    id: z.string().required(), name: z.string().required(),
    apiKeyEnv: z.string().role('credential-ref').pattern(ACCOUNT_REF_PATTERN).required(),
  })).max(MAX_ACCOUNTS)]).default(null),
  autoSwitch: z.boolean().default(false),
  // Internal recovery state uses the same durable profile/section as its accounts.
  // Cross-field ownership and discriminants are checked before any side effect.
  accountOperations: z.array(z.any()).max(MAX_ACCOUNTS).default([]).hidden(),
  baseURL: z.string().default(DEFAULT_BASE_URL),
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
    thinkingBudgets: z.union([z.const(null), z.array(z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).required()).max(16)]),
  })])).default({}),
}

/** Plain values used by the adapter and by pre-0.1.7 settings documents. */
export const PlainConfig: z<OpencodeGoConfig> = z.object(fields)

/** 0.1.7's Loader retains these references when profile fields change. */
export type LiveConfig = { [K in keyof OpencodeGoConfig]-?: { get(): OpencodeGoConfig[K] } }
export const Config = z.object(Object.fromEntries(
  Object.entries(fields).map(([key, schema]) => [key, schema.volatile()]),
)) as z<Partial<OpencodeGoConfig>, LiveConfig>

/** Keep the Loader's references: reparsing them would detach live updates. */
export function readConfig(config: LiveConfig): OpencodeGoConfig {
  // Schemastery preserves unknown profile fields as plain values. Only the
  // fields declared above are volatile references owned by this plugin.
  return Object.fromEntries((Object.keys(fields) as Array<keyof OpencodeGoConfig>)
    .map(key => [key, config[key].get()])) as unknown as OpencodeGoConfig
}

/**
 * Accept only an http(s) base without a query or fragment. Runs at load for
 * the composition layer and as the settings section's write validator, so a
 * bad URL fails where it is written, never at first request.
 * @param raw - the configured base URL.
 * @returns the normalized base URL without trailing slashes.
 */
export function assertBaseURL(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`llm-opencode-go: baseURL "${raw}" is not a valid URL`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`llm-opencode-go: baseURL "${raw}" must be http or https`)
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`llm-opencode-go: baseURL "${raw}" must not carry a query or fragment`)
  }
  return url.toString().replace(/\/+$/, '')
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
