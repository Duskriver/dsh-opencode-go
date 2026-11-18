// @vitest-environment jsdom
/**
 * Contract tests for the settings-dialog navigation glyph:
 * - hosts with the DSH 0.2.2+ icon seat get a real registration;
 * - older hosts get the DOM stand-in only, and it steps aside once the seat
 *   appears;
 * - the stand-in never touches other rows, follows label changes, and cleans up
 *   its marker/stylesheet/observer.
 */
import { createElement, type ReactElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SETTINGS_NAV_MARKER,
  SETTINGS_NAV_ROW_SELECTOR,
  installSettingsNavIcon,
  isOwnSettingsNavRow,
  settingsNavIconCss,
  settingsNavMaskUrl,
  startSettingsNavStandIn,
} from '../src/client/settings-nav-icon.tsx'
import { SETTINGS_SECTION_ICON_SLOT } from '../src/client/host-slots.ts'
import { goRowMaskSvg } from '../src/client/GoMark.tsx'

const LABEL = 'OpenCode Go'
const STYLE_SELECTOR = 'style[data-plugin-css="dsh-opencode-go/settings-nav-icon"]'

/** A settings dialog fixture: one nav row per section label. */
function mountNav(labels: readonly string[]): HTMLElement {
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  const nav = document.createElement('nav')
  for (const label of labels) {
    const button = document.createElement('button')
    button.type = 'button'
    const icon = document.createElement('svg')
    button.appendChild(icon)
    const text = document.createElement('span')
    text.textContent = label
    button.appendChild(text)
    nav.appendChild(button)
  }
  dialog.appendChild(nav)
  document.body.appendChild(dialog)
  return dialog
}

/** The row whose visible text matches one label, as the user would see it. */
function rowFor(label: string): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(SETTINGS_NAV_ROW_SELECTOR)]
    .find(row => row.textContent === label) ?? null
}

/** Minimal client context: records effects, slot injections and registrations. */
function harness(options: { seat: boolean; lateSeat?: boolean }) {
  const registrations: Array<{ options: Record<string, unknown>; component: unknown }> = []
  const cleanups: Array<() => void> = []
  let declaredSeat: (() => unknown) | undefined
  const inject = vi.fn((slot: string, install: () => unknown) => {
    if (slot !== SETTINGS_SECTION_ICON_SLOT) return () => {}
    if (options.seat) return install()
    if (options.lateSeat) { declaredSeat = install; return () => {} }
    return () => {}
  })
  const ctx = {
    effect(install: () => unknown) {
      const result = install()
      if (typeof result === 'function') cleanups.push(result)
      return () => {}
    },
    slots: {
      inject,
      register(entry: Record<string, unknown>, component?: unknown) {
        registrations.push({ options: entry, component })
        const dispose = vi.fn()
        cleanups.push(dispose)
        return dispose
      },
    },
  }
  return {
    ctx,
    inject,
    registrations,
    /** Simulate the host declaring the icon seat after mount. */
    declareSeat: () => {
      const start = declaredSeat
      declaredSeat = undefined
      const result = start?.()
      if (typeof result === 'function') cleanups.push(result as () => void)
    },
    dispose: () => { for (const stop of cleanups.splice(0).reverse()) stop() },
  }
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  document.head.querySelectorAll(STYLE_SELECTOR).forEach(tag => { tag.remove() })
})

describe('settings nav glyph: host icon seat', () => {
  it('registers the row mark under the settings section id', () => {
    const host = harness({ seat: true })
    installSettingsNavIcon(host.ctx as never, () => LABEL)
    expect(host.registrations).toHaveLength(1)
    expect(host.registrations[0]!.options).toMatchObject({ name: SETTINGS_SECTION_ICON_SLOT, id: 'opencode-go' })
    // The seat ships the glyph itself; no DOM stand-in may be left behind.
    expect(document.querySelector(STYLE_SELECTOR)).toBeNull()
  })

  it('renders the hand-drawn go mark at the host-provided size', () => {
    const host = harness({ seat: true })
    installSettingsNavIcon(host.ctx as never, () => LABEL)
    const component = host.registrations[0]!.component as (owner?: { size?: number }) => ReactElement
    const view = render(createElement(component, { size: 18 }))
    const svg = view.container.querySelector('svg') as SVGElement
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('width')).toBe('18')
    expect(svg.querySelector('path')!.getAttribute('stroke')).toBe('currentColor')
  })
})

describe('settings nav glyph: older-host stand-in', () => {
  it('claims only its own row and paints the mark through a mask', () => {
    mountNav([LABEL, 'Models'])
    const host = harness({ seat: false })
    installSettingsNavIcon(host.ctx as never, () => LABEL)
    expect(rowFor(LABEL)!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(true)
    expect(rowFor('Models')!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(false)
    expect(host.registrations).toHaveLength(0)
    const style = document.querySelector(STYLE_SELECTOR) as HTMLStyleElement
    expect(style).not.toBeNull()
    expect(style.textContent).toContain('mask-image')
    expect(style.textContent).toContain(SETTINGS_NAV_MARKER)
    expect(style.textContent).toContain(encodeURIComponent('viewBox="0 0 24 24"'))
  })

  it('re-claims the row when a later render adds it, and drops a stale label', async () => {
    mountNav(['Models'])
    let label = LABEL
    const host = harness({ seat: false })
    installSettingsNavIcon(host.ctx as never, () => label)
    expect(rowFor(LABEL)).toBeNull()

    mountNav([LABEL])
    await vi.waitFor(() => { expect(rowFor(LABEL)!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(true) })

    // A locale switch changes the registered label; the old row must be released.
    label = 'OpenCode Go (zh)'
    mountNav([label])
    await vi.waitFor(() => {
      expect(rowFor('OpenCode Go')!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(false)
      expect(rowFor(label)!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(true)
    })
  })

  it('steps aside once the host declares the icon seat', () => {
    mountNav([LABEL])
    const host = harness({ seat: false, lateSeat: true })
    installSettingsNavIcon(host.ctx as never, () => LABEL)
    expect(rowFor(LABEL)!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(true)
    expect(document.querySelector(STYLE_SELECTOR)).not.toBeNull()

    host.declareSeat()
    expect(host.registrations).toHaveLength(1)
    expect(rowFor(LABEL)!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(false)
    expect(document.querySelector(STYLE_SELECTOR)).toBeNull()
  })

  it('removes the marker, stylesheet and observer on teardown', () => {
    mountNav([LABEL])
    const host = harness({ seat: false })
    installSettingsNavIcon(host.ctx as never, () => LABEL)
    expect(rowFor(LABEL)!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(true)
    host.dispose()
    expect(rowFor(LABEL)!.hasAttribute(SETTINGS_NAV_MARKER)).toBe(false)
    expect(document.querySelector(STYLE_SELECTOR)).toBeNull()
  })

  it('degrades without MutationObserver without throwing', () => {
    mountNav([LABEL])
    vi.stubGlobal('MutationObserver', undefined)
    try {
      const stop = startSettingsNavStandIn(() => LABEL)
      expect(() => { stop() }).not.toThrow()
      expect(document.querySelector(STYLE_SELECTOR)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('settings nav glyph helpers', () => {
  it('matches rows only by a non-empty trimmed label', () => {
    expect(isOwnSettingsNavRow(LABEL, LABEL)).toBe(true)
    expect(isOwnSettingsNavRow(' ' + LABEL + ' ', LABEL)).toBe(true)
    expect(isOwnSettingsNavRow('Models', LABEL)).toBe(false)
    expect(isOwnSettingsNavRow('', '')).toBe(false)
    expect(isOwnSettingsNavRow(LABEL, '   ')).toBe(false)
  })

  it('serialises the row mark as a self-contained black mask', () => {
    const svg = goRowMaskSvg()
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 24 24"')
    expect(svg).not.toContain('currentColor')
    expect(decodeURIComponent(settingsNavMaskUrl(svg))).toBe('data:image/svg+xml,' + svg)
    // The mask is a separate image document; it must not lean on host sprites.
    expect(svg).not.toContain('<use')
  })

  it('hides both shell glyph shapes and keeps the host colour in charge', () => {
    const css = settingsNavIconCss('data:image/svg+xml,x')
    expect(css).toContain('[' + SETTINGS_NAV_MARKER + '] > svg')
    expect(css).toContain('[class*="navIcon"]')
    expect(css).toContain('background-color: currentColor')
    expect(css).toContain('-webkit-mask-image')
    expect(css).toContain('mask-image')
  })
})
