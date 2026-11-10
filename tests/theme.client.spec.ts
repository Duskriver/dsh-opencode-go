import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CHART_BAR_OPACITY,
  GO_THEME_FALLBACKS,
  GO_THEME_TOKENS,
  NATIVE_THEME_FALLBACKS,
  QUOTA_TRACK_PERCENT,
  themeStyle,
  type GoThemeScheme,
  type GoThemeTokens,
} from '../src/client/presentation.ts'

/** Relative luminance from WCAG 2.x; only tokens that resolve to static hex are measured. */
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

/**
 * Composite an opaque hex color at `alpha` over a hex background, as the
 * browser paints a CSS `opacity` layer before the rendered color is measured.
 */
function blend(foreground: string, background: string, alpha: number): string {
  const channel = (offset: number): string => {
    const value = alpha * parseInt(foreground.slice(offset, offset + 2), 16) + (1 - alpha) * parseInt(background.slice(offset, offset + 2), 16)
    return Math.round(value).toString(16).padStart(2, '0')
  }
  return `#${channel(1)}${channel(3)}${channel(5)}`
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

    it.each(SCHEMES)('keeps every rendered chart bar legible on every surface in %s', scheme => {
      const tokens = fallbacks[scheme]
      for (const color of CHART_COLORS) {
        for (const surface of SURFACES) {
          const rendered = blend(tokens[color], tokens[surface], CHART_BAR_OPACITY)
          expectContrastAtLeast3(rendered, tokens[surface], `${scheme} rendered ${color}/${surface}`)
        }
      }
    })

    it.each(SCHEMES)('keeps the strong control border at WCAG 1.4.11 >= 3:1 in %s', scheme => {
      const tokens = fallbacks[scheme]
      for (const surface of SURFACES) expectContrastAtLeast3(tokens.borderStrong, tokens[surface], `${scheme} borderStrong/${surface}`)
      expect(contrast(tokens.borderStrong, tokens.surface)).toBeGreaterThan(contrast(tokens.border, tokens.surface))
    })

    it.each(SCHEMES)('keeps the quota track visible on every surface in %s', scheme => {
      const tokens = fallbacks[scheme]
      for (const surface of SURFACES) {
        const track = blend(tokens.text, tokens[surface], QUOTA_TRACK_ALPHA)
        expectQuotaTrackVisible(track, tokens[surface], `${scheme} ${theme} track/${surface}`)
        expect(contrast(tokens.accent, track), `${scheme} ${theme} fill/track ${surface}: ${tokens.accent} on ${track}`)
          .toBeGreaterThanOrEqual(2.5)
      }
    })
  })
}

/**
 * Host surfaces observed in DSH 0.2.2: light resolves to white, dark layers are
 * #151517/#232324/#2c2c2e. The contrast-checked tokens must clear 3:1 on that
 * whole range because a Host or third-party theme can paint any of them.
 */
const HOST_SURFACE_ANCHORS: Record<GoThemeScheme, readonly string[]> = {
  light: ['#ffffff', '#fafafa', '#f5f5f5'],
  dark: ['#151517', '#232324', '#2c2c2e'],
}

/**
 * Host's `border-l2` is a hairline divider and its `state-*` colors are status
 * dots, not data-viz series, so these must never follow a Host var().
 */
const HOST_INDEPENDENT_TOKENS = ['borderStrong', 'accent2', 'cacheRead', 'cacheWrite'] as const

/** The state-derived chart series are painted as bars, so they composite with the bar opacity. */
const HOST_STATE_CHART_SERIES = ['accent2', 'cacheRead', 'cacheWrite'] as const

/** The quota track is the text colour mixed into the backdrop, so it composites at this opacity. */
const QUOTA_TRACK_ALPHA = QUOTA_TRACK_PERCENT / 100

/**
 * A track is the frame that tells a reader the bar exists: it is informative
 * shape, not text, so the contract is visibility rather than WCAG text
 * contrast. Layer-2 alone is within a few RGB points of a Native light card
 * (about 1.1:1), which is why the track mixes text into the backdrop; 1.3:1 is
 * the weakest track the mix may produce, and the fill must stay separable from
 * it so "how full" still reads at a glance.
 */
function expectQuotaTrackVisible(track: string, surface: string, label: string): void {
  expect(contrast(track, surface), `${label}: track ${track} on ${surface}`).toBeGreaterThanOrEqual(1.3)
}

describe('Native contrast-checked tokens ignore the Host palette', () => {
  it.each(SCHEMES)('resolves the strong control boundary and state chart series to static values in %s', scheme => {
    const tokens = GO_THEME_TOKENS.native[scheme]
    for (const token of HOST_INDEPENDENT_TOKENS) {
      expect(tokens[token], `${scheme} ${token} must not follow a Host var()`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it.each(SCHEMES)('keeps them at WCAG 1.4.11 3:1 across the Host surface range in %s', scheme => {
    const tokens = GO_THEME_TOKENS.native[scheme]
    for (const token of HOST_INDEPENDENT_TOKENS) {
      for (const surface of HOST_SURFACE_ANCHORS[scheme]) {
        expectContrastAtLeast3(tokens[token], surface, `${scheme} ${token}/host ${surface}`)
      }
    }
  })

  it.each(SCHEMES)('keeps the quota track visible across the Host surface range in %s', scheme => {
    const text = NATIVE_THEME_FALLBACKS[scheme].text
    for (const surface of HOST_SURFACE_ANCHORS[scheme]) {
      const track = blend(text, surface, QUOTA_TRACK_ALPHA)
      expectQuotaTrackVisible(track, surface, `${scheme} track/host ${surface}`)
    }
  })

  it.each(SCHEMES)('keeps the rendered state chart series at 3:1 across the Host surface range in %s', scheme => {
    const tokens = GO_THEME_TOKENS.native[scheme]
    for (const token of HOST_STATE_CHART_SERIES) {
      for (const surface of HOST_SURFACE_ANCHORS[scheme]) {
        const rendered = blend(tokens[token], surface, CHART_BAR_OPACITY)
        expectContrastAtLeast3(rendered, surface, `${scheme} rendered ${token}/host ${surface}`)
      }
    }
  })
})

describe('Native theme follows public Host semantics', () => {
  it.each(SCHEMES)('maps Host color, state and elevation values with neutral fallbacks in %s', scheme => {
    const tokens = GO_THEME_TOKENS.native[scheme], fallback = NATIVE_THEME_FALLBACKS[scheme]
    const mapped: ReadonlyArray<readonly [keyof GoThemeTokens, string]> = [
      ['bg', '--dsw-alias-bg-base'],
      ['surface', '--dsw-alias-bg-layer-1'],
      ['surface2', '--dsw-alias-bg-layer-2'],
      ['border', '--dsw-alias-border-l1'],
      ['text', '--dsw-alias-label-primary'],
      ['muted', '--dsw-alias-label-secondary'],
      ['accent', '--dsw-alias-brand-primary'],
      ['onAccent', '--dsw-alias-bg-base'],
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
      '--go-display-weight', '--go-display-tracking', '--go-track', '--go-chart-bar-opacity',
    ]
    for (const property of expected) expect(style[property], property).toBeTruthy()
    expect(style['--go-track']).toContain('color-mix(in srgb,')
    expect(style['--go-track']).toContain(`${QUOTA_TRACK_PERCENT}%`)
    for (const property of ['--go-font', '--go-display-font', '--go-number-font']) {
      expect(style[property]).not.toContain('url(')
      expect(style[property]).not.toContain('@import')
    }
  })

  it.each([
    ['native', 'light'], ['native', 'dark'], ['classic', 'light'], ['classic', 'dark'],
  ] as const)('publishes the rendered chart-bar opacity for %s %s', (theme, scheme) => {
    const style = themeStyle(GO_THEME_TOKENS[theme][scheme]) as Record<string, string>
    expect(style['--go-chart-bar-opacity']).toBe(String(CHART_BAR_OPACITY))
  })
})

/** The contrast math above must use exactly the opacity the stylesheet paints, or it can drift. */
describe('AnalyticsDialog chart-bar rendering', () => {
  it('paints unselected bars with the opacity the contrast tests composite', () => {
    const css = readFileSync(new URL('../src/client/AnalyticsDialog.module.css', import.meta.url), 'utf8')
    const rule = css.match(/(?:^|\n)\.barStack\s*\{([^}]*)\}/)
    expect(rule, '.barStack rule must exist').not.toBeNull()
    const declaration = rule![1].match(/opacity:\s*([^;]+)/)
    expect(declaration, '.barStack must declare its rendered opacity').not.toBeNull()
    const painted = declaration![1].trim()
    const customProperty = painted.match(/^var\(--go-chart-bar-opacity,\s*(\d*\.?\d+)\)$/)
    expect(customProperty, `.barStack opacity must read var(--go-chart-bar-opacity, <fallback>), got ${painted}`).not.toBeNull()
    expect(Number(customProperty![1])).toBe(CHART_BAR_OPACITY)
  })
})

/**
 * Every quota track must paint the token the contrast tests measure; a surface
 * layer would vanish again. The track colour is translucent, so it may be
 * painted exactly once: WebKit layers `::-webkit-progress-bar` over the
 * element's own background, and a second translucent coat would darken the
 * track past the measured ratio (Firefox paints only the element background,
 * which is why the element carries the colour).
 */
describe('quota bar tracks', () => {
  const tracks: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['Section.module.css', ['.accountBar', '.accountUsage progress']],
    ['AnalyticsDialog.module.css', ['.quotaWindow progress', '.rankTrack']],
    ['UsagePill.module.css', ['.win progress', '.sidebarWindow progress']],
  ]
  const clearedPseudoBars: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['Section.module.css', ['.accountUsage progress::-webkit-progress-bar']],
    ['AnalyticsDialog.module.css', ['.quotaWindow progress::-webkit-progress-bar']],
    ['UsagePill.module.css', ['.win progress::-webkit-progress-bar', '.sidebarWindow progress::-webkit-progress-bar']],
  ]

  function ruleBody(css: string, selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
    return match ? match[1]! : null
  }

  it('paints every quota track with the visible track token', () => {
    for (const [file, selectors] of tracks) {
      const css = readFileSync(new URL(`../src/client/${file}`, import.meta.url), 'utf8')
      for (const selector of selectors) {
        const body = ruleBody(css, selector)
        expect(body, `${file} ${selector} rule must exist`).not.toBeNull()
        expect(body, `${file} ${selector} must paint var(--go-track)`).toContain('var(--go-track)')
        expect(body, `${file} ${selector} must not paint a surface layer`).not.toContain('--go-surface-2')
      }
    }
  })

  it('clears the WebKit progress bar so the translucent track is painted once', () => {
    for (const [file, selectors] of clearedPseudoBars) {
      const css = readFileSync(new URL(`../src/client/${file}`, import.meta.url), 'utf8')
      for (const selector of selectors) {
        const body = ruleBody(css, selector)
        expect(body, `${file} ${selector} rule must exist`).not.toBeNull()
        expect(body, `${file} ${selector} must stay transparent`).toMatch(/background:\s*transparent/)
        expect(body, `${file} ${selector} must not repeat the track colour`).not.toContain('var(--go-track)')
      }
    }
  })
})
