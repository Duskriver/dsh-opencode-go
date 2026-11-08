import { describe, expect, it } from 'vitest'
import {
  GO_THEME_FALLBACKS,
  GO_THEME_TOKENS,
  NATIVE_THEME_FALLBACKS,
  themeStyle,
  type GoThemeScheme,
  type GoThemeTokens,
} from '../src/client/presentation.ts'

/** Relative luminance from WCAG 2.x; only static local fallback hex is measured. */
function luminance(hex: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground), second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function expectContrastAtLeast3(foreground: string, background: string, label: string): void {
  expect(contrast(foreground, background), `${label}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(3)
}

const SCHEMES: readonly GoThemeScheme[] = ['light', 'dark']
const SURFACES: readonly (keyof GoThemeTokens)[] = ['bg', 'surface', 'surface2']
const CHART_COLORS = ['accent', 'accent2', 'cacheRead', 'cacheWrite'] as const

for (const [theme, fallbacks] of [['native', NATIVE_THEME_FALLBACKS], ['classic', GO_THEME_FALLBACKS]] as const) {
  describe(`${theme} local fallbacks`, () => {
    it.each(SCHEMES)('keeps every chart series legible on every surface in %s', scheme => {
      const tokens = fallbacks[scheme]
      for (const color of CHART_COLORS) {
        for (const surface of SURFACES) expectContrastAtLeast3(tokens[color], tokens[surface], `${scheme} ${color}/${surface}`)
      }
    })

    it.each(SCHEMES)('keeps the strong control border at WCAG 1.4.11 >= 3:1 in %s', scheme => {
      const tokens = fallbacks[scheme]
      for (const surface of SURFACES) expectContrastAtLeast3(tokens.borderStrong, tokens[surface], `${scheme} borderStrong/${surface}`)
      expect(contrast(tokens.borderStrong, tokens.surface)).toBeGreaterThan(contrast(tokens.border, tokens.surface))
    })
  })
}

describe('Native theme follows public Host semantics', () => {
  it.each(SCHEMES)('maps all color, state and dataviz values with neutral fallbacks in %s', scheme => {
    const tokens = GO_THEME_TOKENS.native[scheme], fallback = NATIVE_THEME_FALLBACKS[scheme]
    const mapped: ReadonlyArray<readonly [keyof GoThemeTokens, string]> = [
      ['bg', '--dsw-alias-bg-base'],
      ['surface', '--dsw-alias-bg-layer-1'],
      ['surface2', '--dsw-alias-bg-layer-2'],
      ['border', '--dsw-alias-border-l1'],
      ['borderStrong', '--dsw-alias-border-l2'],
      ['text', '--dsw-alias-label-primary'],
      ['muted', '--dsw-alias-label-secondary'],
      ['accent', '--dsw-alias-brand-primary'],
      ['accent2', '--dsw-alias-state-success-primary'],
      ['onAccent', '--dsw-alias-bg-base'],
      ['cacheRead', '--dsw-alias-state-idle-primary'],
      ['cacheWrite', '--dsw-alias-state-warn-primary'],
      ['shadow', '--dsw-elevation-prominent'],
      ['success', '--dsw-alias-state-success-primary'],
      ['warning', '--dsw-alias-state-warn-primary'],
      ['danger', '--dsw-alias-state-error-primary'],
    ]
    for (const [key, hostVariable] of mapped) {
      expect(tokens[key], `${scheme} ${key} must read ${hostVariable}`).toContain(`var(${hostVariable}, `)
      expect(tokens[key], `${scheme} ${key} must retain its neutral fallback`).toContain(fallback[key])
    }
    expect(tokens.accentSoft).toContain('--dsw-alias-brand-primary')
    expect(tokens.accentSoft).toContain('--dsw-alias-bg-base')
    expect(tokens.bg).not.toBe(GO_THEME_FALLBACKS[scheme].bg)
  })

  it.each(SCHEMES)('uses Host typography, radii and focus geometry in %s', scheme => {
    const tokens = GO_THEME_TOKENS.native[scheme]
    const style = themeStyle(tokens) as Record<string, string>
    expect(tokens.font).toContain('var(--dsw-font-family,')
    expect(tokens.displayFont).toContain('var(--dsw-font-family,')
    expect(tokens.numberFont).toContain('var(--ds-font-family-code,')
    expect(tokens.font).toContain('--dsh-font-family-text')
    expect(tokens.numberFont).toContain('--dsh-font-family-code')
    expect(tokens.displayFont).not.toContain('Serif')
    expect(tokens.radiusSmall).toContain('--dsw-radius-xs')
    expect(tokens.radiusControl).toContain('--dsw-radius-sm')
    expect(tokens.radiusPill).toContain('--dsw-radius-sm')
    expect(tokens.radiusCard).toContain('--dsw-radius-md')
    expect(tokens.radiusModal).toContain('--dsw-radius-lg')
    expect(tokens.focusWidth).toContain('--dsw-focus-ring-width')
    expect(style['--go-display-weight']).toBe('600')
    expect(style['--go-display-tracking']).toBe('normal')
  })
})

describe('Classic theme preserves the independent plugin identity', () => {
  it.each(SCHEMES)('keeps fixed palette, serif display type and geometry in %s', scheme => {
    const tokens = GO_THEME_TOKENS.classic[scheme]
    expect(tokens).toBe(GO_THEME_FALLBACKS[scheme])
    expect(tokens.bg).toMatch(/^#[0-9a-f]{6}$/)
    expect(tokens.accent).toMatch(/^#[0-9a-f]{6}$/)
    expect(tokens.success).toMatch(/^#[0-9a-f]{6}$/)
    expect(tokens.displayFont).toContain('Anthropic Serif')
    expect(tokens.displayFont).not.toContain('--dsw-')
    expect(tokens.shadow).toMatch(/^0 18px 48px #[0-9a-f]{8}$/)
    expect(tokens.radiusPill).toBe('99px')
    expect(tokens.displayWeight).toBe('400')
    expect(tokens.displayTracking).toBe('-.025em')
  })
})

describe('themeStyle', () => {
  it('publishes every internal derived variable without fetching fonts', () => {
    const style = themeStyle(GO_THEME_TOKENS.native.light) as Record<string, string>
    const expected = [
      '--go-bg', '--go-surface', '--go-surface-2', '--go-border', '--go-border-strong',
      '--go-text', '--go-muted', '--go-accent', '--go-accent-2', '--go-accent-soft', '--go-on-accent',
      '--go-cache-read', '--go-cache-write', '--go-shadow', '--go-success', '--go-warning', '--go-danger',
      '--go-font', '--go-display-font', '--go-number-font', '--go-radius-small', '--go-radius-control',
      '--go-radius-pill', '--go-radius-option', '--go-radius-card', '--go-radius-popover', '--go-radius-modal', '--go-focus-width',
      '--go-display-weight', '--go-display-tracking',
    ]
    for (const property of expected) expect(style[property], property).toBeTruthy()
    for (const property of ['--go-font', '--go-display-font', '--go-number-font']) {
      expect(style[property]).not.toContain('url(')
      expect(style[property]).not.toContain('@import')
    }
  })
})
