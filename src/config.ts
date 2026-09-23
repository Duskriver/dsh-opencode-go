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

/** Environment variable resolving the OpenCode API key. */
export const DEFAULT_API_KEY_ENV = 'OPENCODE_API_KEY'

/** Requests and pickers share this cache lifetime; explicit discovery revalidates immediately. */
export const DEFAULT_REFRESH_MINUTES = 60

/** Default maximum idle interval while a stream read is outstanding. */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000

/**
 * One model's configured capacities. Every field is optional so a deployment
 * can override only the value it needs. Null explicitly selects the catalog
 * value even when a lower profile/settings layer supplies an override.
 */
export interface OpencodeGoModelLimit {
  /** Context window in tokens, overriding what the catalog advertised. */
  contextWindow?: number | null
  /** Output cap per request, overriding what the catalog advertised. */
  maxTokens?: number | null
}

/** Per-model capacities; a null entry selects both original catalog values. */
export type OpencodeGoModelLimits = Record<string, OpencodeGoModelLimit | null>

/** Runtime configuration for one plugin mount. */
export interface OpencodeGoConfig {
  /**
   * Whether this adapter serves its route at all. False withdraws the
   * `opencode-go` route and its models from every picker without unloading the
   * plugin, so the settings page that owns this switch stays reachable to turn
   * it back on. Independent of the credential: a key present while this is
   * false registers nothing.
   */
  enabled: boolean
  /** Per-model picker switches; absent entries default to enabled unless deprecated. */
  modelVisibility?: Record<string, boolean>
  /** Credential reference: the environment variable the key resolves from. */
  apiKeyEnv: string
  /** The gateway endpoint; also the base of the live model listing. */
  baseURL: string
  /** Request/picker cache lifetime in minutes; explicit discovery bypasses it. */
  refreshMinutes: number
  /** Largest idle gap between stream events before the request fails. */
  streamIdleTimeoutMs: number
  /** Request-level bound on base64-encoded image payload, in bytes. */
  maxRequestImageBytes: number
  /** Total-pixel budget for one request image. */
  requestImagePixelBudget: number
  /** Raw encoded-byte target for one request image before base64 expansion. */
  requestImageMaxBytes: number
  /** Per-model capacity overrides; an absent field inherits the catalog value. */
  modelLimits: OpencodeGoModelLimits
}

/** Runtime schema for {@link OpencodeGoConfig}. */
const fields = {
  enabled: z.boolean().default(true),
  modelVisibility: z.dict(z.boolean().required()).default({}),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  refreshMinutes: z.number().step(1).min(1).max(7 * 24 * 60).default(DEFAULT_REFRESH_MINUTES),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  // The image defaults are the generic pi-ai adapter's: one normalized
  // request image fits the budget, and fifteen of them fit the payload cap.
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
  // null explicitly selects catalog values, overriding even inherited profile limits.
  modelLimits: z.dict(z.union([z.const(null), z.object({
    contextWindow: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)]),
    maxTokens: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)]),
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
