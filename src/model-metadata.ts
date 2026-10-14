/** Convert OpenCode's online models.dev metadata into the SDK's three wire protocols. */
import type { Api, Model, ModelCost, ModelThinkingLevel } from './sdk-types.ts'
import { usesGoogleThinkingLevel } from 'opencode-go-pi-ai/api/google-shared'

import { normalizeInputModalities, validReleaseDate, type GoModel } from './models-contract.ts'
import { NATIVE_THINKING_FLAGS, THINKING_LEVELS, supportsThinkingBudget, unsupportedThinkingLevels, withGatewayReasoning } from './reasoning.ts'

export const MODEL_METADATA_URL = 'https://models.dev/api.json'

/** Lifecycle and capability data the online catalog adds to a gateway listing. */
export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'>

export interface ModelMetadata {
  readonly models: ReadonlyMap<string, Model<Api>>
  readonly details: ReadonlyMap<string, ModelDetails>
  readonly errors: ReadonlyMap<string, string>
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`missing or invalid ${field}`)
  }
  return value
}

function rates(value: unknown): ModelCost {
  const cost = record(value)
  const rate = (key: string): number => {
    const value = cost[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
  }
  return { input: rate('input'), output: rate('output'), cacheRead: rate('cache_read'), cacheWrite: rate('cache_write') }
}

/** Missing controls must not turn into SDK-default effort levels the gateway never advertised. */
function reasoningControls(id: string, api: Api, metadata: Record<string, unknown>, known?: Model<Api>): Pick<Model<Api>, 'thinkingLevelMap' | 'reasoningControl' | 'reasoningBudget'> {
  // A family can share wire quirks without sharing selectable effort levels.
  if (!Array.isArray(metadata.reasoning_options) && known?.id === id && known.thinkingLevelMap !== undefined) {
    return { thinkingLevelMap: known.thinkingLevelMap, reasoningControl: known.reasoningControl ?? 'effort',
      ...known.reasoningBudget === undefined ? {} : { reasoningBudget: known.reasoningBudget } }
  }
  const map = unsupportedThinkingLevels()
  const options = (Array.isArray(metadata.reasoning_options) ? metadata.reasoning_options : []).map(record)
  const efforts = options.filter(option => option.type === 'effort' && Array.isArray(option.values))
  for (const option of efforts) {
    for (const value of option.values as unknown[]) {
      const level = value === 'none' ? 'off' : value
      if (THINKING_LEVELS.includes(level as ModelThinkingLevel)) map[level as ModelThinkingLevel] = String(value)
    }
  }
  const format = (known?.compat as { thinkingFormat?: string } | undefined)?.thinkingFormat
  const native = api === 'anthropic-messages' || NATIVE_THINKING_FLAGS.has(format ?? '')
  const toggle = options.some(option => option.type === 'toggle')
  const budget = options.find(option => option.type === 'budget_tokens')
  const tokenBudget = budget !== undefined && supportsThinkingBudget(api, known?.compat)
  // The SDK represents a native switch/budget's enabled state with high. That
  // is not evidence that an OpenAI-compatible endpoint accepts effort "high".
  if (native && efforts.length === 0 && (toggle || budget)) map.high = 'high'
  const enabled = Object.entries(map).some(([level, wire]) => level !== 'off' && typeof wire === 'string')
  if (native && (toggle || (enabled && known?.reasoning)) && known?.thinkingLevelMap?.off !== null && map.off === null) {
    // An absent Off key advertises the native disable flag without inventing
    // an effort spelling. Empty control lists never reach this branch.
    delete map.off
  } else if (enabled && known?.id === id && known.reasoning && typeof known.thinkingLevelMap?.off === 'string') {
    map.off ??= known.thinkingLevelMap.off
  }
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  return { thinkingLevelMap: map,
    reasoningControl: tokenBudget && efforts.length === 0 ? 'budget' : native && efforts.length === 0 && (toggle || budget) ? 'toggle' : 'effort',
    ...tokenBudget ? { reasoningBudget: {
      min: Math.max(api === 'anthropic-messages' ? 1024 : 1, positive(budget.min) ? budget.min : 1),
      max: positive(budget.max) ? budget.max : Number.MAX_SAFE_INTEGER,
    } } : {},
  }
}

/** Common two-part public suffixes; the exhaustive public-suffix list is deliberately out of scope. */
const MULTI_LABEL_SUFFIXES = new Set(['com', 'co', 'org', 'net', 'gov', 'edu', 'ac'])

/** Suffixes whose subdomains are unrelated tenants, not one site: hosts on them only match exactly. */
const SHARED_HOSTING_SUFFIXES = new Set(['github.io', 'gitlab.io', 'pages.dev', 'vercel.app', 'netlify.app',
  'web.app', 'firebaseapp.com', 'appspot.com', 'workers.dev', 'deno.dev', 'herokuapp.com', 'azurewebsites.net'])

function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split('.')
  if (labels.length <= 2) return labels.join('.')
  const secondLevel = labels[labels.length - 2]
  return (MULTI_LABEL_SUFFIXES.has(secondLevel) ? labels.slice(-3) : labels.slice(-2)).join('.')
}

/** Dot-separated numeric hostnames are IPv4 literals and bracketed ones IPv6: registrable domains do not apply. */
function isIpLiteral(hostname: string): boolean {
  return hostname.startsWith('[') || (hostname.includes('.') && hostname.split('.').every(label => /^\d+$/.test(label)))
}

function sameRegistrableDomain(candidate: string, gateway: string): boolean {
  // Unparsable either side counts as a different domain: deny by default.
  try {
    const a = new URL(candidate).hostname
    const b = new URL(gateway).hostname
    if (a === '' || b === '') return false
    // IP literals have no registrable domain: only the same address matches.
    if (isIpLiteral(a) || isIpLiteral(b)) return a === b
    const candidateDomain = registrableDomain(a)
    const gatewayDomain = registrableDomain(b)
    // Shared-hosting suffixes host unrelated tenants under the suffix itself,
    // so their registrable domain names no single site: only exact hosts match.
    if (SHARED_HOSTING_SUFFIXES.has(candidateDomain) || SHARED_HOSTING_SUFFIXES.has(gatewayDomain)) return a === b
    return candidateDomain === gatewayDomain
  } catch {
    return false
  }
}

function googleSurface(recorded: string | undefined, gateway: string): string {
  if (recorded === undefined) throw new Error('models.dev records no provider endpoint for the Google protocol')
  let url: URL
  try {
    url = new URL(recorded)
  } catch {
    throw new Error('the recorded provider endpoint is not a valid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('the recorded provider endpoint must be http or https')
  if (url.search !== '' || url.hash !== '') throw new Error('the recorded provider endpoint must not carry a query or fragment')
  if (!sameRegistrableDomain(recorded, gateway)) {
    throw new Error("the recorded Google endpoint " + recorded + " is outside the configured gateway's domain")
  }
  // The domain check above proved the gateway URL parses. A cleartext surface
  // must not downgrade a TLS-configured gateway; http stays available for the
  // http local gateways the tests and self-hosters use.
  if (url.protocol !== 'https:' && new URL(gateway).protocol === 'https:') {
    throw new Error('the recorded Google endpoint must be https while the configured gateway uses https')
  }
  // Rebuild from the parsed URL so catalog metadata cannot smuggle credentials
  // into the baseUrl the transport sends requests to.
  url.username = ''
  url.password = ''
  return url.href.replace(/\/+$/, '')
}

/**
 * Anthropic's SDK appends /v1/messages; the OpenAI SDKs append paths below /v1.
 * Google's adapter clears apiVersion and expects the baseUrl to carry the
 * version path itself, so /v1 stays in place.
 */
export function modelBaseURL(api: Api, baseURL: string): string {
  const base = baseURL.replace(/\/+$/, '')
  return api === 'anthropic-messages' ? base.replace(/\/v1$/, '') : base
}

/** Shared Responses defaults for declared models and explicit protocol overrides. */
export function responsesCompatibility(): NonNullable<Model<'openai-responses'>['compat']> {
  return { sessionAffinityFormat: 'openai-nosession' }
}

/**
 * Only read the opencode-go record. Online endpoints, headers and credentials
 * are deliberately ignored: model traffic always stays on the configured gateway.
 * The sole exception is Google's protocol, whose adapter cannot reach the
 * gateway's OpenAI-shaped paths: models.dev's recorded provider endpoint is
 * followed, but only within the configured gateway's registrable domain.
 * A bad entry is isolated instead of discarding every other model.
 */
export function readModelMetadata(body: unknown, baseURL: string, builtin: ReadonlyMap<string, Model<Api>>): ModelMetadata {
  const provider = record(record(body)['opencode-go'])
  const recorded = typeof provider.api === 'string' && provider.api.trim() !== '' ? provider.api.trim() : undefined
  if (provider.models === null || typeof provider.models !== 'object' || Array.isArray(provider.models)) {
    throw new Error('models.dev has no opencode-go models object')
  }
  const entries = record(provider.models)
  const models = new Map<string, Model<Api>>()
  const errors = new Map<string, string>()
  const details = new Map<string, ModelDetails>()
  for (const [id, value] of Object.entries(entries)) {
    const data = record(value)
    const inputModalities = normalizeInputModalities(record(data.modalities).input)
    details.set(id, { deprecated: data.status === 'deprecated',
      ...(validReleaseDate(data.release_date) ? { releaseDate: data.release_date } : {}),
      ...(inputModalities === undefined ? {} : { inputModalities }) })
    try {
      const metadata = record(value)
      const npm = record(metadata.provider).npm ?? provider.npm
      const api = npm === '@ai-sdk/anthropic' ? 'anthropic-messages'
        : npm === '@ai-sdk/openai' ? 'openai-responses'
          : npm === '@ai-sdk/openai-compatible' ? 'openai-completions'
            : npm === '@ai-sdk/google' ? 'google-generative-ai' : undefined
      if (api === undefined) throw new Error(`unsupported model protocol ${String(npm)}`)
      const limit = record(metadata.limit)
      const input = record(metadata.modalities).input
      if (!Array.isArray(input) || !input.includes('text')) throw new Error('missing text input modality')
      if (typeof metadata.reasoning !== 'boolean') throw new Error('missing reasoning capability')
      // Retain established wire quirks, including those of a declared family,
      // while taking names, capacities, modalities and protocol from live data.
      const exact = builtin.get(id)
      const family = typeof metadata.family === 'string'
        ? Object.keys(entries).find(key => record(entries[key]).family === metadata.family && builtin.get(key)?.api === api)
        : undefined
      const known = exact?.api === api ? exact : family === undefined ? undefined : builtin.get(family)
      const compat = api === 'openai-completions'
        ? { supportsStore: false, supportsDeveloperRole: false, maxTokensField: 'max_tokens' as const,
            ...(record(metadata.interleaved).field === 'reasoning_content' ? { requiresReasoningContentOnAssistantMessages: true } : {}),
            ...known?.compat }
        : api === 'openai-responses'
          ? { ...responsesCompatibility(), ...known?.compat }
          : { ...known?.compat }
      const cost = rates(metadata.cost)
      const tiers = record(metadata.cost).tiers
      if (Array.isArray(tiers)) {
        cost.tiers = tiers.flatMap(item => {
          const tier = record(record(item).tier)
          return tier.type === 'context' && typeof tier.size === 'number' && Number.isSafeInteger(tier.size) && tier.size > 0
            ? [{ ...rates(item), inputTokensAbove: tier.size }] : []
        }).sort((a, b) => a.inputTokensAbove - b.inputTokensAbove)
      }
      const entry = withGatewayReasoning({
        id,
        name: typeof metadata.name === 'string' && metadata.name.length > 0 ? metadata.name : id,
        provider: 'opencode-go', api,
        // models.dev records the provider surface that serves Google's native path,
        // which the configured gateway may not expose; traffic may only follow that
        // record within the gateway's own domain.
        baseUrl: modelBaseURL(api, api === 'google-generative-ai' ? googleSurface(recorded, baseURL) : baseURL),
        reasoning: metadata.reasoning,
        ...reasoningControls(id, api, metadata, known),
        input: input.includes('image') ? ['text', 'image'] : ['text'],
        contextWindow: positiveInteger(limit.context, 'context limit'),
        maxTokens: positiveInteger(limit.output, 'output limit'),
        cost, compat,
      })
      // pi-ai encodes Google efforts as native thinking levels only for IDs it
      // recognizes (`usesGoogleThinkingLevel`); every other ID serializes all
      // efforts to the same budget fallback. Those models expose no effort
      // choices rather than controls that cannot take effect; Default keeps
      // the provider's own thinking behavior either way.
      // The api check narrows to the Google wire before the SDK type cast.
      models.set(id, entry.api === 'google-generative-ai' && !usesGoogleThinkingLevel(entry as Model<'google-generative-ai'>)
        ? { ...entry, thinkingLevelMap: unsupportedThinkingLevels() }
        : entry)
    } catch (error) {
      errors.set(id, error instanceof Error ? error.message : String(error))
    }
  }
  return { models, errors, details }
}
