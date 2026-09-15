/**
 * OpenCode Go settings plugin, browser half. Registers the "OpenCode Go"
 * settings page over the `llm-opencode-go` namespace: the API key (stored
 * write-only through the credentials domain), the gateway's current model
 * listing, and the adapter knobs behind the page's advanced disclosure. The
 * Host settings and credential contracts stay behind their existing wire APIs.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.remote merge (the forwarded credentials event key)
// into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { OpencodeGoSection } from './Section.tsx'
import type { OpencodeGoSectionInjected } from './Section.tsx'
import { OpencodeGoSectionController, type OpencodeGoSettings } from './section-controller.ts'
import { en, zh } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The OpenCode Go settings page copy. */
    'settings.opencode-go': keyof typeof en
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.opencode-go'

export type { OpencodeGoSectionProps } from './Section.tsx'
export type { OpencodeGoSectionState, OpencodeGoSettings } from './section-controller.ts'
export { OPENCODE_GO_NS } from './section-controller.ts'
export type { OpencodeGoKey } from './locales.ts'

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-settings' apply, whose activation order relative to this one is NOT
 * constrained; registration depends on each slot through `slots.inject()`.
 * `remote.llm` is the discovery namespace the page reads the model listing
 * through.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'remote.llm', 'settingsScope']

/**
 * Register the section once the `settings.section` declaration is on the
 * ledger, and keep the credential badge fresh on Host-reported key changes
 * written from any surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'llm-opencode-go: copy dictionaries')

  // The Host schema validated the section before it reached the wire; the
  // decoder narrows structurally and keeps the last accepted value otherwise.
  const scope = ctx.settingsScope.bind({
    namespace: 'llm-opencode-go',
    decode: (section): OpencodeGoSettings | undefined =>
      typeof section === 'object' && section !== null ? section as OpencodeGoSettings : undefined,
  })
  const controller = new OpencodeGoSectionController(scope, ctx)
  const t = ctx.locale.bind(NS) as OpencodeGoSectionInjected['t']
  const injected = (): OpencodeGoSectionInjected => ({ ...controller.inject(), t })

  ctx.effect(() => {
    const refresh = (ref: string): void => { controller.refreshCredential(ref) }
    const dispose = ctx.remote.$on('credentials/reference-updated', refresh)
    /* v8 ignore next -- fiber teardown never runs in unit tests */
    return () => { dispose() }
  }, 'llm-opencode-go: pushed credential invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'opencode-go',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, OpencodeGoSection))
}
