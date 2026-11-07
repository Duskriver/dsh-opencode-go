import { describe, expect, it } from 'vitest'
import {
  GO_THEME_FALLBACKS,
  GO_THEME_TOKENS,
  themeStyle,
  type GoThemeScheme,
  type GoThemeTokens,
} from '../src/client/presentation.ts'

/**
 * Relative luminance from the WCAG 2.x definition. Only the static fallback hex
 * values are measured: when the Host supplies an alias token the Host owns its own
 * contrast guarantees, while the fallbacks are what this plugin paints without it.
 * @param hex - `#rrggbb` color.
 * @returns relative luminance in [0, 1].
 */
function luminance(hex: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** WCAG contrast ratio between two `#rrggbb` colors. */
function contrast(foreground: string, background: string): number {
  const first = luminance(foreground), second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** Assert the WCAG 1.4.11 non-text minimum for a meaningful graphic or control boundary. */
function expectContrastAtLeast3(foreground: string, background: string, label: string): void {
  expect(contrast(foreground, background), `${label}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(3)
}

const SCHEMES: readonly GoThemeScheme[] = ['light', 'dark']
const SURFACES: readonly (keyof GoThemeTokens)[] = ['bg', 'surface', 'surface2']

describe('plugin theme tokens follow the Host', () => {
  it.each(SCHEMES)('keeps chart series legible against every surface in %s (WCAG 1.4.11 >= 3:1)', scheme => {
    const tokens = GO_THEME_FALLBACKS[scheme]
    for (const surface of SURFACES) {
      expectContrastAtLeast3(tokens.cacheRead, tokens[surface], `${scheme} cacheRead/${surface}`)
      expectContrastAtLeast3(tokens.cacheWrite, tokens[surface], `${scheme} cacheWrite/${surface}`)
    }
  })

  it.each(SCHEMES)('keeps the strong control border at WCAG 1.4.11 >= 3:1 in %s', scheme => {
    const tokens = GO_THEME_FALLBACKS[scheme]
    for (const surface of SURFACES) expectContrastAtLeast3(tokens.borderStrong, tokens[surface], `${scheme} borderStrong/${surface}`)
    // The decorative hairline may stay quieter; the control boundary may not.
    expect(contrast(tokens.borderStrong, tokens.surface)).toBeGreaterThan(contrast(tokens.border, tokens.surface))
  })

  it.each(SCHEMES)('reads surfaces, text, borders and the brand from Host alias tokens with local fallbacks in %s', scheme => {
    const tokens = GO_THEME_TOKENS[scheme], fallback = GO_THEME_FALLBACKS[scheme]
    const mapped: ReadonlyArray<readonly [keyof GoThemeTokens, string]> = [
      ['bg', '--dsw-alias-bg-base'],
      ['surface', '--dsw-alias-bg-layer-1'],
      ['surface2', '--dsw-alias-bg-layer-2'],
      ['border', '--dsw-alias-border-l1'],
      ['text', '--dsw-alias-label-primary'],
      ['muted', '--dsw-alias-label-secondary'],
      ['accent', '--dsw-alias-brand-primary'],
      ['onAccent', '--dsw-alias-label-primary-foreground'],
    ]
    for (const [key, hostVariable] of mapped) {
      expect(tokens[key], `${scheme} ${key} must read ${hostVariable}`).toContain(`var(${hostVariable}, `)
      expect(tokens[key], `${scheme} ${key} must keep its local fallback`).toContain(fallback[key])
    }
    // Plugin-owned values have no Host token to defer to: they are painted as-is.
    expect(tokens.borderStrong).toBe(fallback.borderStrong)
    expect(tokens.cacheRead).toBe(fallback.cacheRead)
    expect(tokens.cacheWrite).toBe(fallback.cacheWrite)
  })

  it.each(SCHEMES)('prefers the Host font families and keeps a local stack as fallback in %s', scheme => {
    const style = themeStyle(GO_THEME_TOKENS[scheme]) as Record<string, string>
    expect(style['--go-font']).toContain('var(--dsh-font-family-text,')
    expect(style['--go-number-font']).toContain('var(--dsh-font-family-code,')
    // The fallback stacks stay in the same declaration, and no font request is introduced.
    expect(style['--go-font']).toContain('sans-serif')
    expect(style['--go-number-font']).toContain('monospace')
    for (const property of ['--go-font', '--go-number-font']) {
      expect(style[property]).not.toContain('url(')
      expect(style[property]).not.toContain('@import')
    }
    expect(style['--go-border-strong']).toBe(GO_THEME_FALLBACKS[scheme].borderStrong)
  })
})
