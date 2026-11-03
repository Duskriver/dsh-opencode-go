/** Host plugin composition, route lifecycle and remote registration. */
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-typert-registry'
import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import {
  LlmError,
  assertUsableApiKey,
  resolveImageAttachmentAccess,
  type AdapterRegistrationHandle,
  type LlmModelDiscoveryRequest,
} from '@deepseek-ai/dsh-llm'
import { OpencodeGoAdapter } from './adapter.ts'
import {
  DISPLAY_NAME,
  PROVIDER_ID,
  FREE_DISPLAY_NAME,
  FREE_PROVIDER_ID,
  discoverCatalogModels,
  GoModelsService,
  GoCatalogManager,
} from './catalog.ts'
import {
  Config,
  readConfig,
  type LiveConfig,
  type OpencodeGoConfig,
  installHostSettings,
  validateGoConfig,
} from './config.ts'
import { GoUsageService, GoAccountManager, GoAccountsService } from './accounts.ts'
import { GoAnalyticsService, analyticsPriceBook, type AnalyticsSessionQuery } from './analytics.ts'
import { accountsOf, accountRefOf, SETTINGS_NAMESPACE, goRemote } from './contracts.ts'
import { ProxyTransport } from './transport.ts'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'loader/volatile-update'(paths: readonly (readonly string[])[]): void
  }
}

export { OpencodeGoAdapter } from './adapter.ts'

export type { OpencodeGoAdapterOptions, OpencodeGoImageAccess, GoAccountSettlement } from './adapter.ts'

export {
  DEFAULT_BASE_URL,
  DEFAULT_FREE_BASE_URL,
  DISPLAY_NAME,
  PROVIDER_ID,
  FREE_DISPLAY_NAME,
  FREE_PROVIDER_ID,
  OpencodeGoCatalog,
  discoverCatalogModels,
  readLiveModelIds,
} from './catalog.ts'

export { Config, PlainConfig, assertBaseURL } from './config.ts'

export { assertProxyURL } from './contracts.ts'

export type { OpencodeGoConfig } from './config.ts'

export const name = 'llm-opencode-go'

export const inject = ['llm']

/** Settings namespace this plugin installs and the Web page edits. */
export const NS = SETTINGS_NAMESPACE

/**
 * Register the route, model discovery and settings presentation for one mount.
 * The adapter re-reads live profile fields at every operation.
 */
export function apply(ctx: Context, raw?: OpencodeGoConfig | LiveConfig): void {
  const config = raw && typeof raw.enabled === 'object' ? raw as LiveConfig : Config(raw)
  const entry = readConfig(config)
  // Self-contained misconfiguration fails at load; a bad stored value instead
  // refuses the write through the section's validate hook.
  validateGoConfig(entry)
  const current = (): OpencodeGoConfig => readConfig(config)

  const resolveApiKey = async (config: OpencodeGoConfig = current()): Promise<string | undefined> => {
    // Compare through accountRefOf so a stray empty string keeps the default
    // reference's semantics instead of matching nothing.
    const ref = accountRefOf(config)
    if (!accountsOf(config).some(account => account.apiKeyEnv === ref)) {
      throw new LlmError('OpenCode Go has no selected account', 'MISSING_CREDENTIAL')
    }
    const credentials = ctx.get('credentials')
    const hit = credentials !== undefined
      ? (await credentials.resolve(credentialRef(ref)))?.value
      // Without the seam the environment is the whole credential plane.
      : launchEnvironmentOf(ctx).get(ref)?.value
    if (hit !== undefined && hit.length > 0) return assertUsableApiKey(hit, name, ref)
    throw new LlmError(
      `llm-opencode-go: no credential; the profile resolves ${ref}, which is not set — store ${ref} through the`
      + ' credentials service or export it',
      'MISSING_CREDENTIAL',
    )
  }
  registerGoRemotes(ctx)
  const accountManager = new GoAccountManager(current, ctx.logger)
  ctx.plugin(GoAccountsService, { manager: accountManager })
  ctx.inject(['settings', 'credentials'], ready => {
    ready.effect(() => accountManager.connect(ready.settings, ready.credentials))
  })
  const transport = new ProxyTransport()
  ctx.effect(() => () => transport.dispose())
  ctx.plugin(GoUsageService, {
    baseURL: () => current().baseURL,
    proxyURL: () => current().proxyURL,
    transport,
    resolveApiKey: (ref?: string) => resolveApiKey({ ...current(), apiKeyEnv: ref ?? current().apiKeyEnv }),
    activeRef: () => accountRefOf(current()),
    accountRefs: () => accountsOf(current()).map(account => account.apiKeyEnv),
    lastSwitch: () => accountManager.lastSwitch(),
  })
  const logger = {
    fallback: ({ url, error }: { url: string; error: unknown; kept: number }): void => {
      ctx.logger.warn(`llm-opencode-go: could not refresh ${url}; using last-known model data (${String(error)})`)
    },
    omitted: (ids: readonly string[]): void => {
      ctx.logger.warn(`llm-opencode-go: gateway models with unusable declarations: ${ids.join(', ')}`)
    },
  }
  let registration: AdapterRegistrationHandle | undefined
  let freeRegistration: AdapterRegistrationHandle | undefined
  const refreshPickers = (): void => {
    registration?.replace([PROVIDER_ID])
    freeRegistration?.replace([FREE_PROVIDER_ID])
  }
  let callSequence = 0
  const catalogs = new GoCatalogManager({
    transport, onFallback: logger.fallback, onOmitted: logger.omitted,
    onWarning: warning => { ctx.logger.warn(`llm-opencode-go: ${warning}`) },
    onRefresh: refreshPickers,
  })
  const adapterOptions = {
    transport,
    config: () => current(),
    resolveApiKey,
    accountGeneration: () => accountManager.capture(),
    nextCallSequence: () => ++callSequence,
    onAccountSettled: (event: import('./adapter.ts').GoAccountSettlement) => { accountManager.settle(event) },
    imageAccess: {
      resolveAttachments: () => ctx.get('attachments'),
      resolveImageAccess: (attachments: import('@deepseek-ai/dsh-attachment').AttachmentStore, ref: import('@deepseek-ai/dsh-attachment').ImageAttachmentRef) => resolveImageAttachmentAccess(
        attachments,
        hostPath => ctx.get('fs')?.processPathFromHostPath(hostPath),
        ref,
      ),
    },
    onReplayDegrade: (reason: string) => {
      ctx.logger.warn(`llm-opencode-go: unusable replay state on assistant history; sending provider-neutral content (${reason})`)
    },
  }
  const adapter = new OpencodeGoAdapter({ ...adapterOptions, catalog: config => catalogs.forConfig(config) })
  const freeAdapter = new OpencodeGoAdapter({ ...adapterOptions, source: 'free', catalog: config => catalogs.forConfig(config, 'free') })
  ctx.plugin(GoModelsService, {
    catalog: () => catalogs.forConfig(current()),
    freeCatalog: () => catalogs.forConfig(current(), 'free'),
    onRefresh: refreshPickers,
  })
  const sessionQueryOf = (): AnalyticsSessionQuery | undefined =>
    (ctx as unknown as { get(name: string): unknown }).get('sessionQuery') as AnalyticsSessionQuery | undefined
  ctx.plugin(GoAnalyticsService, {
    query: sessionQueryOf,
    pricing: async () => analyticsPriceBook(...await Promise.all([
      catalogs.forConfig(current()).snapshot(), catalogs.forConfig(current(), 'free').snapshot(),
    ])),
  })
  const pickerVisibilityOf = (): string => JSON.stringify([current().modelVisibility ?? {}, current().modelLimits ?? {},
    current().baseURL, current().freeBaseURL, current().proxyURL])
  let pickerVisibility = pickerVisibilityOf()
  /** Free follows enabled immediately; Go additionally requires a usable saved key. */
  const applyRoute = (configured: boolean): void => {
    for (const source of ['go', 'free'] as const) {
      const id = source === 'go' ? PROVIDER_ID : FREE_PROVIDER_ID
      const handle = source === 'go' ? registration : freeRegistration
      const active = current().enabled && (source === 'free' || configured)
      if (active && !handle) {
        try {
          const next = ctx.llm.registerAdapter([id], source === 'go' ? adapter : freeAdapter)
          if (source === 'go') registration = next
          else freeRegistration = next
          ctx.logger.info(`llm-opencode-go: route "${id}" registered as ${source === 'go' ? DISPLAY_NAME : FREE_DISPLAY_NAME}`)
        } catch (error) { ctx.logger.error(`llm-opencode-go: not registering the "${id}" route (${String(error)})`) }
      } else if (!active && handle) {
        handle()
        if (source === 'go') registration = undefined
        else freeRegistration = undefined
      }
    }
  }
  let routeCheck = 0
  let selectedRef = accountRefOf(current())
  const syncRoute = (): void => {
    const check = ++routeCheck
    const config = current()
    accountManager.capture()
    const visibility = pickerVisibilityOf()
    if (pickerVisibility !== visibility) {
      pickerVisibility = visibility
      // Replacing the owned route notifies every session picker without a restart.
      refreshPickers()
    }
    const credentials = ctx.get('credentials')
    const selected = accountRefOf(config)
    // A stored selection outranks the gateway's last rejection of it: choosing an
    // account back must try it again rather than skip it for the whole window.
    if (selected !== selectedRef) {
      selectedRef = selected
      adapter.forgetRejectedKey(selected)
      freeAdapter.forgetRejectedKey(selected)
    }
    const refs = accountsOf(config).map(account => account.apiKeyEnv)
    // Free is available immediately, including while credential storage is resolving.
    if (!config.enabled) { applyRoute(false); return }
    if (!freeRegistration) {
      try { freeRegistration = ctx.llm.registerAdapter([FREE_PROVIDER_ID], freeAdapter) }
      catch (error) { ctx.logger.error(`llm-opencode-go: not registering the "${FREE_PROVIDER_ID}" route (${String(error)})`) }
    }
    if (credentials === undefined) {
      applyRoute(refs.some(ref => {
        const value = launchEnvironmentOf(ctx).get(ref)?.value
        if (!value) return false
        try { return Boolean(assertUsableApiKey(value, name, ref)) } catch { return false }
      }))
      return
    }
    const checkCredential = async (ref: string): Promise<boolean> => {
      const info = await credentials.describe(credentialRef(ref))
      if (!info.configured) return false
      try { return Boolean(await resolveApiKey({ ...config, apiKeyEnv: ref })) }
      catch (error) {
        if (error instanceof LlmError && ['MISSING_CREDENTIAL', 'INVALID_CREDENTIAL'].includes(error.code)) return false
        throw error
      }
    }
    // One pending/unreadable account must not prevent another usable key from
    // activating Go. Only a completed, successful check of every account can
    // establish that no key is configured.
    let remaining = refs.length, usable = false, failed = false
    if (remaining === 0) applyRoute(false)
    for (const ref of refs) void checkCredential(ref).then(configured => {
      if (check !== routeCheck) return
      usable ||= configured
      if (usable) applyRoute(true)
    }).catch((error: unknown) => {
      failed = true
      if (check === routeCheck) ctx.logger.error(`llm-opencode-go: credential check failed; keeping the previous route state (${String(error)})`)
    }).finally(() => {
      remaining--
      if (remaining === 0 && check === routeCheck && !usable && !failed) applyRoute(false)
    })
  }
  syncRoute()
  let undiscover: () => void = () => {}
  try {
    undiscover = ctx.llm.registerModelDiscovery(name, async (request: LlmModelDiscoveryRequest) => {
      if (request.provider !== PROVIDER_ID && request.provider !== FREE_PROVIDER_ID
        && !isOfficialEndpoint(request.baseURL)) {
        throw new LlmError(
          'llm-opencode-go discovers only OpenCode Go and Free endpoints; enter this provider\'s models by hand',
          'DISCOVERY_UNSUPPORTED',
        )
      }
      const source = request.provider === FREE_PROVIDER_ID || request.provider !== PROVIDER_ID
        && request.baseURL !== undefined && !new URL(request.baseURL).pathname.includes('/go/') ? 'free' : 'go'
      return discoverCatalogModels(catalogs.forConfig(current(), source))
    })
  } catch (error: unknown) {
    // A duplicate mount may already own our discovery registration — the same
    // refusal the route registration above absorbs. The surviving mount keeps
    // serving discovery, and everything else this mount does keeps working.
    ctx.logger.error(`llm-opencode-go: not registering model discovery for "${name}" (${String(error)})`)
  }
  ctx.effect(() => () => {
    /* v8 ignore start -- plugin unload never runs in tests: no Context disposal API is exercised */
    registration?.()
    registration = undefined
    freeRegistration?.()
    freeRegistration = undefined
    undiscover()
    /* v8 ignore stop */
  })
  installHostSettings(ctx)
  ctx.on('loader/volatile-update', syncRoute)
  // A key stored or removed anywhere — the settings page's write-only control
  // included — flips the route's presence; the event names the reference.
  ctx.inject(['credentials'], (credentialsCtx) => {
    credentialsCtx.on('credentials/reference-updated', (ref) => {
      // A stored change to a reference outranks the gateway's last rejection
      // of it, so the very next request re-checks the new key.
      adapter.forgetRejectedKey(ref)
      freeAdapter.forgetRejectedKey(ref)
      if (accountsOf(current()).some(account => account.apiKeyEnv === ref)) { accountManager.credentialChanged(); syncRoute() }
    })
    // The seam becomes visible only once its provider is active, which can be
    // after this plugin applied: the boot-time call above then found no seam
    // and fell back to the environment. Sync again here so a credential
    // already stored in the seam registers the route at boot instead of
    // waiting for its next write.
    syncRoute()
  })
}

/** Register once per plugin mount, after either registry activation order. */
export function registerGoRemotes(ctx: Context): void {
  ctx.inject(['typert'], scope => {
    scope.effect(() => scope.typert.register({ package: goRemote.package, face: 'host', schemas: [],
      model: { services: [], events: [], objects: [] }, invocations: goRemote.descriptors }))
  })
}

function isOfficialEndpoint(raw: string | undefined): boolean {
  try { return raw !== undefined && new URL(raw).hostname === 'opencode.ai' } catch { return false }
}
