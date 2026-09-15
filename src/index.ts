/**
 * Dedicated OpenCode Go adapter plugin. Registers one `opencode-go` route
 * whose catalog is the curated table intersected with the gateway's live model
 * listing, and installs the `llm-opencode-go` settings section: the Web UI
 * renders it as its own settings page where the API key and every knob are
 * edited, and a change reaches the next request without a restart. The plugin
 * exists because the gateway has wire requirements a generic pi-ai route
 * cannot express: a mandatory per-conversation `x-opencode-session` routing
 * header and a model list that rotates faster than any shipped catalog.
 *
 * Configuration layers like every settings-backed plugin: a `cordis.yml`
 * entry supplies the composition base and the settings document overrides it
 * field by field.
 *
 * ```yaml
 * - id: llm-opencode-go
 *   name: 'dsh-opencode-go'
 *   config:
 *     enabled: true                     # false withdraws the route; the plugin stays mounted
 *     apiKeyEnv: OPENCODE_API_KEY       # default
 *     baseURL: https://opencode.ai/zen/go/v1   # default
 *     refreshMinutes: 60                # live catalog re-resolution interval
 * ```
 *
 * The credential resolves per request through the credentials seam, falling
 * back to the process environment — the same reference semantics the generic
 * pi-ai adapter uses. The route registers atomically: if another adapter
 * family already owns `opencode-go` (a profile in `llm-pi-ai`, for example),
 * the refusal is logged with the reason and everything else this plugin does
 * still works.
 *
 * @module dsh-opencode-go
 */

import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { LlmError, assertUsableApiKey, resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { AdapterRegistrationHandle, LlmModelDiscoveryRequest } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-settings'
import { OpencodeGoAdapter } from './adapter.ts'
import {
  DISPLAY_NAME,
  PROVIDER_ID,
  discoverCatalogModels,
} from './catalog.ts'
import { Config, assertBaseURL } from './config.ts'
import type { OpencodeGoConfig } from './config.ts'

export { OpencodeGoAdapter } from './adapter.ts'
export type { OpencodeGoAdapterOptions, OpencodeGoImageAccess } from './adapter.ts'
export {
  DEFAULT_BASE_URL,
  DISPLAY_NAME,
  PROVIDER_ID,
  OpencodeGoCatalog,
  discoverCatalogModels,
  readLiveModelIds,
} from './catalog.ts'
export { Config, assertBaseURL } from './config.ts'
export type { OpencodeGoConfig } from './config.ts'

export const name = 'llm-opencode-go'
export const inject = ['llm']

/** Settings namespace this plugin installs and the Web page edits. */
export const NS = 'llm-opencode-go'

/**
 * Register the route, its discovery, the settings section, and their
 * teardown for one mount. Configuration starts as the cordis.yml entry and is
 * replaced by the settings section's resolved value once the settings
 * provider attaches; the adapter re-reads it at every operation.
 */
export function apply(ctx: Context, raw?: OpencodeGoConfig): void {
  const entry = Config(raw)
  // Self-contained misconfiguration fails at load; a bad stored value instead
  // refuses the write through the section's validate hook.
  assertBaseURL(entry.baseURL)
  let current: () => OpencodeGoConfig = () => entry

  const resolveApiKey = async (): Promise<string | undefined> => {
    const ref = current().apiKeyEnv
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
  const logger = {
    fallback: ({ error }: { url: string; error: unknown; kept: number }): void => {
      ctx.logger.warn(`llm-opencode-go: live model listing unreachable; serving the curated table until the next refresh (${String(error)})`)
    },
    omitted: (ids: readonly string[]): void => {
      ctx.logger.info(`llm-opencode-go: live listing carries ids the curated table cannot route; omitted: ${ids.join(', ')}`)
    },
  }
  const adapter = new OpencodeGoAdapter({
    config: () => current(),
    resolveApiKey,
    imageAccess: {
      resolveAttachments: () => ctx.get('attachments'),
      resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
        attachments,
        hostPath => ctx.get('fs')?.processPathFromHostPath(hostPath),
        ref,
      ),
    },
    onFallback: logger.fallback,
    onOmitted: logger.omitted,
    onReplayDegrade: (reason) => {
      ctx.logger.warn(`llm-opencode-go: unusable replay state on assistant history; sending provider-neutral content (${reason})`)
    },
  })
  let registration: AdapterRegistrationHandle | undefined
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
      } catch (error: unknown) {
        // Most likely DUPLICATE_ADAPTER: a profile in another family
        // (llm-pi-ai) already owns the route. The refusal names the route;
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
  const syncRoute = (): void => {
    const credentials = ctx.get('credentials')
    if (credentials === undefined) {
      applyRoute(launchEnvironmentOf(ctx).get(current().apiKeyEnv)?.value !== undefined)
      return
    }
    void credentials.describe(credentialRef(current().apiKeyEnv))
      .then((info) => { applyRoute(info.configured) })
      .catch((error: unknown) => {
        ctx.logger.error(`llm-opencode-go: credential describe failed; keeping the previous route state (${String(error)})`)
      })
  }
  syncRoute()
  const undiscover = ctx.llm.registerModelDiscovery(name, async (request: LlmModelDiscoveryRequest) => {
    if (request.provider !== PROVIDER_ID
      && !(request.baseURL ?? '').includes('opencode.ai')) {
      throw new LlmError(
        'llm-opencode-go discovers only OpenCode zen/go endpoints; enter this provider\'s models by hand',
        'DISCOVERY_UNSUPPORTED',
      )
    }
    return discoverCatalogModels(adapter.catalogOf(current()))
  })
  ctx.effect(() => () => {
    /* v8 ignore start -- plugin unload never runs in tests: no Context disposal API is exercised */
    registration?.()
    undiscover()
    /* v8 ignore stop */
  })
  // Settings-backed configuration: the section starts from the cordis.yml
  // entry as its base layer and follows the settings provider while attached.
  // Without a settings provider the plugin still loads and serves the entry.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, entry, {
      validate: (value) => {
        assertBaseURL(value.baseURL)
      },
      setSource: (source) => {
        current = source
      },
      onChange: () => {
        // The registered route set follows the credential the section names;
        // every other fact is per-request and reaches it through `current`.
        syncRoute()
      },
    })
  })
  // A key stored or removed anywhere — the settings page's write-only control
  // included — flips the route's presence; the event names the reference.
  ctx.inject(['credentials'], (credentialsCtx) => {
    credentialsCtx.on('credentials/reference-updated', (ref) => {
      if (ref === current().apiKeyEnv) syncRoute()
    })
    // The seam becomes visible only once its provider is active, which can be
    // after this plugin applied: the boot-time call above then found no seam
    // and fell back to the environment. Sync again here so a credential
    // already stored in the seam registers the route at boot instead of
    // waiting for its next write.
    syncRoute()
  })
  ctx.logger.info(`llm-opencode-go: route "${PROVIDER_ID}" registered as ${DISPLAY_NAME}`)
}
