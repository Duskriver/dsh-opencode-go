/**
 * Visual themes for the conversation usage pill and the analytics dashboard.
 * Four palettes share one token vocabulary; each has a dark and a light set so
 * the surfaces follow the Host's color scheme while keeping the selected style.
 *
 * The preference is local to this plugin (localStorage) and never touches the
 * settings document or the Host theme registry.
 *
 * @module dsh-opencode-go/client/theme
 */

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import type { en } from './locales.ts'

/** One palette's six theme colors plus the neutral surface steps. */
export interface GoThemeTokens {
  readonly bg: string
  readonly surface: string
  readonly surface2: string
  readonly border: string
  readonly text: string
  readonly muted: string
  readonly accent: string
  readonly accent2: string
  readonly success: string
  readonly warning: string
  readonly danger: string
}

/** The four selectable styles. */
export const GO_THEMES = ['silent-black', 'graphite', 'sea-salt', 'warm-sand'] as const
export type GoThemeId = typeof GO_THEMES[number]

/** Graphite is the default: it is the quietest match for the Host chrome. */
export const DEFAULT_GO_THEME: GoThemeId = 'graphite'

/** Locale key carrying each theme's display name. */
export const GO_THEME_LABELS: Record<GoThemeId, keyof typeof en> = {
  'silent-black': 'themeSilentBlack',
  graphite: 'themeGraphite',
  'sea-salt': 'themeSeaSalt',
  'warm-sand': 'themeWarmSand',
}

/** Each style in both Host color schemes. */
export const GO_THEME_TOKENS: Record<GoThemeId, { dark: GoThemeTokens; light: GoThemeTokens }> = {
  'silent-black': {
    dark: {
      bg: '#101010', surface: '#181818', surface2: '#202020', border: '#2b2b2b',
      text: '#e8e8e8', muted: '#8c8c8c', accent: '#4098f8', accent2: '#8b5cf6',
      success: '#40b870', warning: '#f88830', danger: '#e5484d',
    },
    light: {
      bg: '#f8f8f8', surface: '#ffffff', surface2: '#f0f0f0', border: '#e4e4e4',
      text: '#1c1c1c', muted: '#757575', accent: '#0878f8', accent2: '#8250df',
      success: '#188838', warning: '#e07800', danger: '#d9363e',
    },
  },
  graphite: {
    dark: {
      bg: '#111214', surface: '#181a1e', surface2: '#202329', border: '#2a2e36',
      text: '#edeff3', muted: '#9aa1ac', accent: '#6e8bff', accent2: '#a371f7',
      success: '#3fb950', warning: '#d29922', danger: '#f85149',
    },
    light: {
      bg: '#f6f7f9', surface: '#ffffff', surface2: '#f0f2f5', border: '#e3e6ea',
      text: '#1f2328', muted: '#6e7781', accent: '#4f6bed', accent2: '#8250df',
      success: '#1a7f37', warning: '#9a6700', danger: '#cf222e',
    },
  },
  'sea-salt': {
    dark: {
      bg: '#0b1416', surface: '#111d20', surface2: '#182a2e', border: '#24383c',
      text: '#e6f0f1', muted: '#8fa6ab', accent: '#2dd4bf', accent2: '#60a5fa',
      success: '#34d399', warning: '#fbbf24', danger: '#fb7185',
    },
    light: {
      bg: '#f3f8f8', surface: '#ffffff', surface2: '#eaf3f3', border: '#d8e6e6',
      text: '#13262b', muted: '#5f7478', accent: '#0e8c8f', accent2: '#3b82f6',
      success: '#2f9e6b', warning: '#c98a2b', danger: '#d9534f',
    },
  },
  'warm-sand': {
    dark: {
      bg: '#14110e', surface: '#1d1915', surface2: '#27211a', border: '#352d24',
      text: '#f4eee6', muted: '#a99c8d', accent: '#e08a62', accent2: '#7c9eff',
      success: '#4ade80', warning: '#fbbf24', danger: '#fb7185',
    },
    light: {
      bg: '#f7f3ec', surface: '#fffdf9', surface2: '#f1eae0', border: '#e6dccd',
      text: '#241f1a', muted: '#7a6f63', accent: '#c96f4a', accent2: '#4f7cff',
      success: '#3e8e63', warning: '#c98a2b', danger: '#c0504d',
    },
  },
}

const STORAGE_KEY = 'dsh-opencode-go.theme'
const listeners = new Set<() => void>()

function isGoTheme(value: unknown): value is GoThemeId {
  return typeof value === 'string' && (GO_THEMES as readonly string[]).includes(value)
}

function readStored(): GoThemeId {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)
    return isGoTheme(value) ? value : DEFAULT_GO_THEME
  } catch {
    return DEFAULT_GO_THEME
  }
}

let currentTheme: GoThemeId = readStored()

/** The selected style, stable until the next write. */
export function getGoTheme(): GoThemeId {
  return currentTheme
}

/**
 * Select a style and persist it for this browser.
 * @param id - one of {@link GO_THEMES}; unknown ids are ignored.
 */
export function setGoTheme(id: GoThemeId): void {
  if (!isGoTheme(id) || id === currentTheme) return
  currentTheme = id
  try { globalThis.localStorage?.setItem(STORAGE_KEY, id) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

/** Subscribe to style changes (for useSyncExternalStore). */
export function subscribeGoTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Read the selected style in a component. */
export function useGoTheme(): GoThemeId {
  return useSyncExternalStore(subscribeGoTheme, getGoTheme, () => DEFAULT_GO_THEME)
}

/**
 * Follow the Host's light/dark scheme. The layout presenter marks a dark body
 * with `data-ds-dark-theme`; the attribute is observed so switching the Host
 * theme updates the surfaces without a reload.
 */
export function useHostScheme(): 'dark' | 'light' {
  const [scheme, setScheme] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    if (body === null) return
    const update = (): void => {
      setScheme(body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light')
    }
    update()
    // The SSR/client fixture ships a minimal DOM; observing is an enhancement.
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(update)
    observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { observer.disconnect() }
  }, [])
  return scheme
}

/** The active style's tokens for the Host's current scheme. */
export function useGoThemeTokens(): GoThemeTokens {
  const id = useGoTheme()
  const scheme = useHostScheme()
  return GO_THEME_TOKENS[id][scheme]
}

/**
 * Inline custom properties consumed by the pill and dialog styles.
 * @param tokens - the active palette.
 * @returns a style object carrying every `--go-*` variable.
 */
export function themeStyle(tokens: GoThemeTokens): CSSProperties {
  return {
    '--go-bg': tokens.bg,
    '--go-surface': tokens.surface,
    '--go-surface-2': tokens.surface2,
    '--go-border': tokens.border,
    '--go-text': tokens.text,
    '--go-muted': tokens.muted,
    '--go-accent': tokens.accent,
    '--go-accent-2': tokens.accent2,
    '--go-success': tokens.success,
    '--go-warning': tokens.warning,
    '--go-danger': tokens.danger,
  } as CSSProperties
}
