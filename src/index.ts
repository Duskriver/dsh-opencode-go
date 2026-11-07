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
import { GoAnalyticsService } from './analytics.ts'
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
  /** Bounded, per-(model, reason) de-duplication for dropped-setting warnings. */
  const warnedModelSettings = new Set<string>()
  const refreshPickers = (): void => {
    registration?.replace([PROVIDER_ID])
    freeRegistration?.replace([FREE_PROVIDER_ID])
  }
  let callSequence = 0
  /** Free endpoint origins already reported as not reuse-bound for saved keys. */
  const withheldFreeEndpoints = new Set<string>()
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
    // One notice per withheld Free endpoint and mount: the Free route never
    // reuses saved credentials for an endpoint the accounts are not bound to,
    // and a request storm must not repeat the explanation. The value is the
    // endpoint origin only, never a key.
    onFreeCredentialWithheld: (detail: { reason: 'unbound-free-endpoint'; freeBaseURL: string }) => {
      if (withheldFreeEndpoints.has(detail.freeBaseURL)) return
      if (withheldFreeEndpoints.size >= 8) withheldFreeEndpoints.clear()
      withheldFreeEndpoints.add(detail.freeBaseURL)
      ctx.logger.info(`llm-opencode-go: not reusing saved credentials for the Free endpoint ${detail.freeBaseURL}; using public access`)
    },
    onReplayDegrade: (reason: string) => {
      ctx.logger.warn(`llm-opencode-go: unusable replay state on assistant history; sending provider-neutral content (${reason})`)
    },
    // Configured thinking budgets are filtered/clamped instead of failing the
    // model; surface each distinct dropped setting once so a stale profile can
    // be fixed without per-request log spam.
    onModelWarning: (detail: { model: string; reason: string }) => {
      const key = detail.model + '\u0000' + detail.reason
      if (warnedModelSettings.has(key)) return
      if (warnedModelSettings.size >= 64) warnedModelSettings.clear()
      warnedModelSettings.add(key)
      ctx.logger.warn(`llm-opencode-go: model "${detail.model}": ${detail.reason}`)
    },
  }
  const adapter = new OpencodeGoAdapter({ ...adapterOptions, catalog: config => catalogs.forConfig(config) })
  const freeAdapter = new OpencodeGoAdapter({ ...adapterOptions, source: 'free', catalog: config => catalogs.forConfig(config, 'free') })
  ctx.plugin(GoModelsService, {
    catalog: () => catalogs.forConfig(current()),
    // Free is an explicit opt-in: while it is off, its catalog is neither
    // fetched nor included in the settings model directory.
    freeCatalog: () => {
      const config = current()
      return config.freeEnabled ? catalogs.forConfig(config, 'free') : undefined
    },
    onRefresh: refreshPickers,
  })
  ctx.plugin(GoAnalyticsService, {
    baseURL: () => current().baseURL,
    proxyURL: () => current().proxyURL,
    transport,
    resolveApiKey: (ref: string) => resolveApiKey({ ...current(), apiKeyEnv: ref }),
    accountRefs: () => accountsOf(current()).map(account => account.apiKeyEnv),
  })
  const pickerVisibilityOf = (): string => JSON.stringify([current().modelVisibility ?? {}, current().modelLimits ?? {},
    current().baseURL, current().freeBaseURL, current().proxyURL])
  let pickerVisibility = pickerVisibilityOf()
  /**
   * Serve the Go route only when a usable key exists; serve Free only when the
   * user opted in with {@link OpencodeGoConfig.freeEnabled}. `enabled` remains
   * the master switch for both.
   */
  const applyRoute = (configured: boolean): void => {
    for (const source of ['go', 'free'] as const) {
      const id = source === 'go' ? PROVIDER_ID : FREE_PROVIDER_ID
      const handle = source === 'go' ? registration : freeRegistration
      const active = current().enabled && (source === 'free' ? current().freeEnabled : configured)
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
  /**
   * Register or withdraw only the Free route. It must not touch the Go route:
   * Go's presence waits for asynchronous credential checks and re-running the
   * whole route decision here would make pickers flap on every sync.
   */
  const syncFreeRoute = (): void => {
    const active = current().enabled && current().freeEnabled
    if (active && !freeRegistration) {
      try {
        freeRegistration = ctx.llm.registerAdapter([FREE_PROVIDER_ID], freeAdapter)
        ctx.logger.info(`llm-opencode-go: route "${FREE_PROVIDER_ID}" registered as ${FREE_DISPLAY_NAME}`)
      } catch (error) { ctx.logger.error(`llm-opencode-go: not registering the "${FREE_PROVIDER_ID}" route (${String(error)})`) }
    } else if (!active && freeRegistration) {
      // Withdrawing the route only removes the provider; a request already
      // streaming through it keeps its iterator and is allowed to finish.
      freeRegistration()
      freeRegistration = undefined
      ctx.logger.info(`llm-opencode-go: route "${FREE_PROVIDER_ID}" withdrawn (Free channel disabled)`)
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
    if (!config.enabled) { applyRoute(false); return }
    // Free is an explicit opt-in and needs no credential check, so register or
    // withdraw it immediately: a settings toggle takes effect on the next sync
    // (loader/volatile-update) without waiting for account resolution.
    syncFreeRoute()
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
    undiscover = ctx.llm.registerModelDiscovery(name, async (request: LlmModelDiscoveryRequest, signal?: AbortSignal) => {
      if (request.provider !== PROVIDER_ID && request.provider !== FREE_PROVIDER_ID
        && !isOfficialEndpoint(request.baseURL)) {
        throw new LlmError(
          'llm-opencode-go discovers only OpenCode Go and Free endpoints; enter this provider\'s models by hand',
          'DISCOVERY_UNSUPPORTED',
        )
      }
      const source = request.provider === FREE_PROVIDER_ID || request.provider !== PROVIDER_ID
        && request.baseURL !== undefined && !new URL(request.baseURL).pathname.includes('/go/') ? 'free' : 'go'
      const config = current()
      if (source === 'free' && !config.freeEnabled) {
        // Free is an explicit opt-in: refuse its discovery instead of fetching
        // (or advertising) a catalog for a channel the user has not enabled.
        throw new LlmError(
          'llm-opencode-go: the Free channel is disabled; enable it in Settings → Advanced settings',
          'DISCOVERY_UNSUPPORTED',
        )
      }
      // `LlmModelDiscoveryRequest` carries no signal; the registration callback's
      // second argument is the caller's cancellation and is forwarded into the
      // shared snapshot waiter. Aborting cancels only this discovery caller —
      // the refresh itself continues for other readers and the next discovery.
      return discoverCatalogModels(catalogs.forConfig(config, source), signal)
    })
  } catch (error: unknown) {
    // A duplicate mount may already own our discovery registration — the same
    // refusal the route registration above absorbs. The surviving mount keeps
    // serving discovery, and everything else this mount does keeps working.
    ctx.logger.error(`llm-opencode-go: not registering model discovery for "${name}" (${String(error)})`)
  }
  ctx.effect(() => () => {
    registration?.()
    registration = undefined
    freeRegistration?.()
    freeRegistration = undefined
    undiscover()
    // Adapters own their per-route Free transports (Bun workers and SOCKS
    // tunnels); each dispose releases those. The shared ProxyTransport belongs
    // to the Host effect registered above, and the adapters know not to
    // dispose an injected transport.
    return Promise.all([adapter.dispose(), freeAdapter.dispose()]).then(() => {})
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
