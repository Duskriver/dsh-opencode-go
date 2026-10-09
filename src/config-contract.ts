/** Browser-safe configuration vocabulary shared by both plugin faces. */
import type { GoAccount } from './accounts.ts'
import type { GoAccountOperation } from './account-operations.ts'
import type { UsageDisplayMode } from './usage-display.ts'
import type { GoProtocolOverrides } from './protocol-contract.ts'

export const SETTINGS_NAMESPACE = 'llm-opencode-go'
export const PROFILE_ENTRY_ID = 'opencode-go'

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
  /** Additional selectable thinking budgets, in tokens; null keeps the standard presets. */
  thinkingBudgets?: number[] | null
}

/** Per-model capacities; a null entry selects both original catalog values. */
export type OpencodeGoModelLimits = Record<string, OpencodeGoModelLimit | null>

/** Runtime configuration for one plugin mount. */
export interface OpencodeGoConfig {
  /**
   * Whether this adapter serves its route at all. False withdraws the
   * `dsh-opencode-go` route and its models from every picker without unloading the
   * plugin, so the settings page that owns this switch stays reachable to turn
   * it back on. Independent of the credential: a key present while this is
   * false registers nothing.
   */
  enabled: boolean
  /** Usage pill visibility; auto follows this plugin's selected provider. */
  usageDisplay: UsageDisplayMode
  /** Per-model picker switches; absent entries default to enabled unless deprecated. */
  modelVisibility?: Record<string, boolean>
  /** Experimental opt-in routing; omitted/null entries follow the catalog. */
  protocolOverrides?: GoProtocolOverrides
  /** Credential reference: the environment variable the key resolves from. */
  apiKeyEnv: string
  accounts?: GoAccount[] | null
  accountOperations?: GoAccountOperation[]
  /** Try other saved accounts on quota/credential rejection before any content is emitted. */
  autoSwitch?: boolean
  /** The gateway endpoint; also the base of the live model listing. */
  baseURL: string
  /** Optional HTTP(S) or SOCKS5 proxy; blank uses the default network transport. */
  proxyURL: string
  /** Request/picker cache lifetime in minutes; explicit discovery bypasses it. */
  refreshMinutes: number
  /** Largest idle gap between stream events before the request fails. */
  streamIdleTimeoutMs: number
  /** Bound discovery and each attempt's credential/image preparation. */
  requestPreparationTimeoutMs?: number
  /** Whole dispatch deadline, including discovery and account fallback. */
  requestTimeoutMs?: number
  /** Optional retained image occurrence cap per request; omission or null leaves the count unlimited. */
  maxImages?: number | null
  /** Request-level bound on base64-encoded image payload, in bytes. */
  maxRequestImageBytes: number
  /** Total-pixel budget for one request image. */
  requestImagePixelBudget: number
  /** Raw encoded-byte target for one request image before base64 expansion. */
  requestImageMaxBytes: number
  /** Per-model capacity overrides; an absent field inherits the catalog value. */
  modelLimits: OpencodeGoModelLimits
}

/** Settings snapshots may omit fields inherited from their base layer. */
export type OpencodeGoSettings = Partial<OpencodeGoConfig>
