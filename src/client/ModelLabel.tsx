/** Inline composer model-option label showing live OpenCode Go quota multipliers. */
import css from './ModelLabel.module.css'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
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

/**
 * Render an OpenCode Go option label with its live quota multiplier on the
 * right side of the composer dropdown, keeping trigger, menu and other
 * providers as plain `model.name`.
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
  const activeOption = placement === 'option' && provider.id === PROVIDER_ID && enabled
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

  if (!activeOption || !entry || !t) return <>{model.name}</>

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
