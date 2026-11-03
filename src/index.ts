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
  DISPLAY_NAME,
  PROVIDER_ID,
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
      ctx.logger.warn(`llm-opencode-go: gateway models awaiting usable online metadata: ${ids.join(', ')}`)
    },
  }
  let registration: AdapterRegistrationHandle | undefined
  const catalogs = new GoCatalogManager({
    transport, onFallback: logger.fallback, onOmitted: logger.omitted,
    onWarning: warning => { ctx.logger.warn(`llm-opencode-go: ${warning}`) },
    onRefresh: () => { registration?.replace([PROVIDER_ID]) },
  })
  const adapter = new OpencodeGoAdapter({
    transport,
    catalog: config => catalogs.forConfig(config),
    config: () => current(),
    resolveApiKey,
    accountGeneration: () => accountManager.capture(),
    onAccountSettled: event => { accountManager.settle(event) },
    imageAccess: {
      resolveAttachments: () => ctx.get('attachments'),
      resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
        attachments,
        hostPath => ctx.get('fs')?.processPathFromHostPath(hostPath),
        ref,
      ),
    },
    onReplayDegrade: (reason) => {
      ctx.logger.warn(`llm-opencode-go: unusable replay state on assistant history; sending provider-neutral content (${reason})`)
    },
  })
  ctx.plugin(GoModelsService, {
    catalog: () => catalogs.forConfig(current()),
    onRefresh: () => { registration?.replace([PROVIDER_ID]) },
  })
  const sessionQueryOf = (): AnalyticsSessionQuery | undefined =>
    (ctx as unknown as { get(name: string): unknown }).get('sessionQuery') as AnalyticsSessionQuery | undefined
  ctx.plugin(GoAnalyticsService, {
    query: sessionQueryOf,
    // Review P14 (core half): the price book omits cost for models whose
    // upstream cost block is missing or malformed (ModelDetails.costKnown ===
    // false), so their requests are reported unpriced instead of silently
    // priced at 0; a published block with legal components stays priced even
    // when all of its rates are zero.
    pricing: async () => analyticsPriceBook(await catalogs.forConfig(current()).snapshot()),
  })
  const pickerVisibilityOf = (): string => JSON.stringify([current().modelVisibility ?? {}, current().protocolOverrides ?? {}])
  let pickerVisibility = pickerVisibilityOf()
  /**
   * Register the route while the switch is on and its credential resolves, and
   * drop it when either says no. A route with no key would otherwise sit in
   * every model picker and read as a usable provider to first-run onboarding —
   * the dormancy llm-pi-ai keeps by resolving zero routes until configured.
   * Without the credentials seam the environment answers synchronously, so
   * registration is too.
   *
   * Nothing else is torn down with the route: model discovery, the settings
   * section, and the credentials listener all stay mounted, so the page that
   * owns the switch stays reachable to turn it back on.
   */
  const applyRoute = (configured: boolean): void => {
    if (configured && current().enabled && registration === undefined) {
      try {
        registration = ctx.llm.registerAdapter([PROVIDER_ID], adapter)
        ctx.logger.info(`llm-opencode-go: route "${PROVIDER_ID}" registered as ${DISPLAY_NAME}`)
      } catch (error: unknown) {
        // A duplicate mount may already own our namespaced route. The refusal names the route;
        // discovery still registers below, and everything else about the
        // mount keeps working.
        ctx.logger.error(`llm-opencode-go: not registering the "${PROVIDER_ID}" route (${String(error)})`)
      }
    } else if ((!configured || !current().enabled) && registration !== undefined) {
      registration()
      registration = undefined
      if (!current().enabled) {
        ctx.logger.info('llm-opencode-go: disabled by configuration; the route and its models are withdrawn')
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
      registration?.replace([PROVIDER_ID])
    }
    const credentials = ctx.get('credentials')
    const selected = accountRefOf(config)
    // A stored selection outranks the gateway's last rejection of it: choosing an
    // account back must try it again rather than skip it for the whole window.
    if (selected !== selectedRef) {
      selectedRef = selected
      adapter.forgetRejectedKey(selected)
    }
    const refs = accountsOf(config).filter(account => config.autoSwitch || account.apiKeyEnv === selected)
      .map(account => account.apiKeyEnv)
    if (credentials === undefined) {
      applyRoute(refs.some(ref => Boolean(launchEnvironmentOf(ctx).get(ref)?.value)))
      return
    }
    void Promise.all(refs.map(ref => credentials.describe(credentialRef(ref))))
      .then((infos) => { if (check === routeCheck) applyRoute(infos.some(info => info.configured)) })
      .catch((error: unknown) => {
        ctx.logger.error(`llm-opencode-go: credential describe failed; keeping the previous route state (${String(error)})`)
      })
  }
  syncRoute()
  let undiscover: () => void = () => {}
  try {
    undiscover = ctx.llm.registerModelDiscovery(name, async (request: LlmModelDiscoveryRequest) => {
      if (request.provider !== PROVIDER_ID
        && !(request.baseURL ?? '').includes('opencode.ai')) {
        throw new LlmError(
          'llm-opencode-go discovers only OpenCode zen/go endpoints; enter this provider\'s models by hand',
          'DISCOVERY_UNSUPPORTED',
        )
      }
      return discoverCatalogModels(catalogs.forConfig(current()))
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
