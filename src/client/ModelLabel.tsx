/** Inline composer model-option label showing live OpenCode Go quota multipliers. */
import css from './ModelLabel.module.css'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_OPENCODE_GO_THEME,
  DEFAULT_SHOW_MODEL_MULTIPLIER,
  PROVIDER_ID,
} from '../contracts.ts'
import type { OpencodeGoSettings } from './controller.ts'
import type { SharedModelCatalog } from './model-catalog-store.ts'
import { themeStyle, useGoThemeTokens } from './presentation.ts'
import {
  resolveActiveGoPlan,
  resolveModelMultiplierBadge,
  useScheduledTransitionClock,
  type MultiplierTranslate,
} from './quota-badge.ts'

export interface ModelLabelInjected {
  settings: ConfigForm<OpencodeGoSettings>
  catalog: SharedModelCatalog
  t: MultiplierTranslate
  getLocale?: () => string
}

export type ModelLabelProps = PropsRuntime<'conversation.input.model.label'> & Partial<ModelLabelInjected>

const DEFAULT_CACHE_TTL_MS = 5 * 60_000

function endpointKeyOf(value: OpencodeGoSettings | undefined): string {
  return JSON.stringify([value?.baseURL ?? '', value?.freeBaseURL ?? '', value?.proxyURL ?? ''])
}

/** The tones a catalog badge may declare; each is one the host `Tag` ships without an outline. */
const CATALOG_BADGE_TONES = ['neutral', 'info', 'success', 'warning'] as const

/**
 * Resolve the one line a catalog badge shows, or `undefined` when it says nothing.
 *
 * `badge` is another provider's display data, so nothing here may throw: a component
 * that throws is retired from the single-occupant slot, which would strip the name
 * off every row in the picker. A literal is used as-is; a translation table is read
 * for the active locale, its base tag, then the required `en`. Anything else —
 * absent, blank or malformed — reads as "no badge".
 */
function catalogBadgeText(badge: unknown, locale: string | undefined): string | undefined {
  if (typeof badge !== 'object' || badge === null || Array.isArray(badge)) return undefined
  const { text } = badge as { text?: unknown }
  if (typeof text === 'string') return text.trim() === '' ? undefined : text
  if (typeof text !== 'object' || text === null || Array.isArray(text)) return undefined
  const table = text as Record<string, unknown>
  const language = locale?.toLowerCase()
  for (const key of [language, language?.split('-')[0], 'en']) {
    const candidate = key === undefined || key === '' ? undefined : table[key]
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
  }
  return undefined
}

/** A badge's tone when it is one the host knows; anything else draws as a plain fact. */
function catalogBadgeTone(badge: unknown): (typeof CATALOG_BADGE_TONES)[number] {
  const { tone } = (badge ?? {}) as { tone?: unknown }
  return typeof tone === 'string' && (CATALOG_BADGE_TONES as readonly string[]).includes(tone)
    ? tone as (typeof CATALOG_BADGE_TONES)[number]
    : 'neutral'
}

/**
 * A catalog name with its optional `model.badge`, in the host's own order: the badge
 * leads in the composer trigger and follows the name in menus. A row without a badge
 * is the bare name.
 */
function CatalogLabel({ model, placement, locale }: {
  model: ModelLabelProps['model']
  placement: ModelLabelProps['placement']
  locale: string | undefined
}) {
  // `badge` joined the host's catalog model in DSH 0.2.2; the pinned 0.2.1 type lacks it.
  const badge = (model as { badge?: unknown }).badge
  const text = catalogBadgeText(badge, locale)
  if (text === undefined) return <>{model.name}</>
  const tag = <Tag className={css.catalogBadge} tone={catalogBadgeTone(badge)}>{text}</Tag>
  return (
    <span className={css.catalogLabel}>
      {placement === 'trigger' ? tag : null}
      <span className={css.catalogName}>{model.name}</span>
      {placement === 'trigger' ? null : tag}
    </span>
  )
}

/**
 * Render an OpenCode Go option label with its live quota multiplier on the
 * right side of the composer dropdown.
 *
 * The label slot is single-occupant: whichever contribution holds it is called for
 * every provider's row. So a Go row falls back to the quota badge this plugin
 * publishes on the catalog whenever its live lookup has none, and another provider's
 * row reproduces that model's own catalog `badge` the way the host's fallback would
 * have drawn it (#125). The composer trigger and the menu's current value keep the
 * plain name.
 */
export function ModelLabel({ provider, model, placement, settings, catalog, t, getLocale }: ModelLabelProps) {
  const readSettings = useCallback(() => settings?.getSnapshot(), [settings])
  const subscribeSettings = useCallback(
    (listener: () => void) => settings?.subscribe(listener) ?? (() => {}),
    [settings],
  )
  const config = useSyncExternalStore(subscribeSettings, readSettings, readSettings)

  const readCatalog = useCallback(() => catalog?.store.getSnapshot() ?? null, [catalog])
  const subscribeCatalog = useCallback(
    (listener: () => void) => catalog?.store.subscribe(listener) ?? (() => {}),
    [catalog],
  )
  const entries = useSyncExternalStore(subscribeCatalog, readCatalog, readCatalog)

  const settingsValue = config?.value
  const enabled = settingsValue?.enabled !== false && (settingsValue?.showModelMultiplier ?? DEFAULT_SHOW_MODEL_MULTIPLIER)
  const own = provider.id === PROVIDER_ID
  const activeOption = placement === 'option' && own && enabled
  const endpointKey = endpointKeyOf(settingsValue)
  const refreshMinutes = settingsValue?.refreshMinutes
  const ttlMs = typeof refreshMinutes === 'number' && Number.isFinite(refreshMinutes) && refreshMinutes > 0
    ? Math.min(refreshMinutes * 60_000, DEFAULT_CACHE_TTL_MS)
    : DEFAULT_CACHE_TTL_MS

  useEffect(() => {
    if (!catalog) return
    catalog.syncEndpoint(endpointKey)
    if (activeOption) void catalog.ensureLoaded(endpointKey, ttlMs)
  }, [catalog, activeOption, endpointKey, ttlMs])

  const entry = useMemo(
    () => (activeOption && entries ? entries.find(item => item.id === model.id && (item.source ?? 'go') === 'go') : undefined),
    [activeOption, entries, model.id],
  )
  const schedules = useMemo(
    () => (entry?.pricingMultipliers ? [entry.pricingMultipliers] : []),
    [entry?.pricingMultipliers],
  )
  const now = useScheduledTransitionClock(schedules, false)
  const tokens = useGoThemeTokens(settingsValue?.appearanceTheme ?? DEFAULT_OPENCODE_GO_THEME)

  if (!own) return <CatalogLabel model={model} placement={placement} locale={getLocale?.()} />
  // The composer trigger and the menu's current value keep the plain name, as does
  // a Go row while the reader has switched multipliers off.
  if (!activeOption) return <>{model.name}</>
  // The live catalog has not answered yet (or no translator arrived): the badge this
  // plugin published on the host catalog states the same quota fact.
  if (!entry || !t) return <CatalogLabel model={model} placement={placement} locale={getLocale?.()} />

  const plan = resolveActiveGoPlan(settingsValue)
  const badge = resolveModelMultiplierBadge({
    model: entry,
    plan,
    t,
    locale: getLocale?.(),
    nowMs: now,
  })
  if (!badge) return <>{model.name}</>

  return (
    <span className={css.optionRow} style={themeStyle(tokens)} title={badge.title}>
      <span className={css.optionName}>{model.name}</span>{' '}
      <span
        className={css.optionBadge}
        data-tone={badge.tone}
        aria-label={badge.kind === 'go' ? badge.ariaLabel : badge.title}
      >
        {badge.text}
      </span>
    </span>
  )
}
