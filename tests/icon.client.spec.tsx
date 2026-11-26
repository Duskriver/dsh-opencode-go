// @vitest-environment jsdom
/**
 * Contract tests for the OpenCode Go marks: the sidebar row icon, the page brand
 * tile and the SVG package icon. The sidebar icon is the hand-drawn `go` mark (a
 * `g` outline plus the filled and hollow stone pair); pinning its geometry keeps
 * a later refactor from silently reverting to the old wave glyph.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GO_ROW_GEOMETRY, GoLogo, GoMark, GoRowIcon } from '../src/client/GoMark.tsx'

afterEach(() => { cleanup() })

/** The hand-drawn g outline + descender the sidebar row ships. */
const HAND_DRAWN_GO = 'M12.15 4.25C6.45 3.45 2.5 6.8 2.5 11.85c0 4.92 3.3 7.95 8.02 7.95 1.17 0 2.3-.15 3.13-.55M10.52 14.25v5.55'

describe('sidebar row mark', () => {
  it('renders the hand-drawn go mark in a 24-unit box', () => {
    const { container } = render(<GoRowIcon size={16} />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('width')).toBe('16')
    expect(svg.getAttribute('height')).toBe('16')
    expect(svg.getAttribute('fill')).toBe('none')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.style.display).toBe('block')

    const path = container.querySelector('path') as SVGPathElement
    expect(path.getAttribute('d')).toBe(HAND_DRAWN_GO)
    expect(path.getAttribute('stroke')).toBe('currentColor')
    expect(path.getAttribute('stroke-width')).toBe('2.05')
    expect(path.getAttribute('stroke-linecap')).toBe('round')
    expect(path.getAttribute('stroke-linejoin')).toBe('round')

    // The filled stone and the hollow stone are the two counters of "go".
    const circles = [...container.querySelectorAll('circle')]
    expect(circles).toHaveLength(2)
    const [stone, outline] = circles as SVGElement[]
    expect(stone.getAttribute('cx')).toBe('10.65')
    expect(stone.getAttribute('cy')).toBe('12.3')
    expect(stone.getAttribute('r')).toBe('3.75')
    expect(stone.getAttribute('fill')).toBe('currentColor')
    expect(outline.getAttribute('cx')).toBe('17.85')
    expect(outline.getAttribute('cy')).toBe('12.05')
    expect(outline.getAttribute('r')).toBe('3.73')
    expect(outline.getAttribute('stroke')).toBe('currentColor')
    expect(outline.getAttribute('stroke-width')).toBe('1.95')
    // The hollow stone must not also be painted solid.
    expect(outline.getAttribute('fill')).toBeNull()
  })

  it('honours the expanded, collapsed and default host sizes', () => {
    const renderAt = (size?: number) => {
      const { container, unmount } = render(size === undefined ? <GoRowIcon /> : <GoRowIcon size={size} />)
      const svg = container.querySelector('svg') as SVGElement
      const size_ = [svg.getAttribute('width'), svg.getAttribute('height')]
      unmount()
      return size_
    }
    expect(renderAt()).toEqual(['16', '16'])
    expect(renderAt(16)).toEqual(['16', '16'])
    expect(renderAt(18)).toEqual(['18', '18'])
    expect(renderAt(24)).toEqual(['24', '24'])
  })

  it('inherits the host colour and never bakes one in', () => {
    const { container } = render(<GoRowIcon size={18} />)
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/)
    expect(container.innerHTML).toContain('currentColor')
  })

  it('keeps the same geometry when the host marks the row active', () => {
    const idle = render(<GoRowIcon size={16} />)
    const idleHtml = idle.container.innerHTML
    idle.unmount()
    const active = render(<GoRowIcon size={16} active />)
    expect(active.container.innerHTML).toBe(idleHtml)
  })
})

describe('page brand mark', () => {
  it('keeps the wave mark inside the coloured tile', () => {
    const { container } = render(<GoLogo size={32} />)
    const tile = container.querySelector('span') as HTMLElement
    expect(tile).not.toBeNull()
    expect(tile.style.background).toContain('linear-gradient')
    expect(tile.getAttribute('aria-hidden')).toBe('true')

    const mark = tile.querySelector('svg') as SVGElement
    // The page tile keeps its own 16-unit wave mark, independent of the sidebar icon.
    expect(mark.getAttribute('viewBox')).toBe('0 0 16 16')
    expect(mark.getAttribute('width')).toBe('18')
    expect(mark.getAttribute('height')).toBe('18')
    expect(mark.querySelectorAll('path')).toHaveLength(2)
    expect(mark.querySelectorAll('circle')).toHaveLength(1)
  })

  it('scales the nested mark with the tile', () => {
    const { container } = render(<GoLogo size={64} />)
    const mark = container.querySelector('svg') as SVGElement
    expect(mark.getAttribute('width')).toBe('36')
    expect(mark.getAttribute('height')).toBe('36')
  })

  it('renders the standalone wave mark at its requested size', () => {
    const { container } = render(<GoMark size={24} />)
    const mark = container.querySelector('svg') as SVGElement
    expect(mark.getAttribute('viewBox')).toBe('0 0 16 16')
    expect(mark.getAttribute('width')).toBe('24')
    expect(mark.getAttribute('height')).toBe('24')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('package icon', () => {
  // The Host renders this file through an <img>, never as inline markup.
  const source = readFileSync(resolve('assets/icon.svg'), 'utf8')
  const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
  const attrs = (element: Element | null) =>
    Object.fromEntries([...(element?.attributes ?? [])].map(({ name, value }) => [name, value]))
  const gradient = (id: string) => root.querySelector(`linearGradient[id="${id}"]`)
  const stops = (id: string) =>
    [...root.querySelectorAll(`linearGradient[id="${id}"] stop`)].map(stop => stop.getAttribute('stop-color'))
  const precedes = (first: Element | null, second: Element | null) =>
    Boolean(first && second && (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING))
  const mark = root.querySelector('g[transform]')
  const outline = root.querySelector('path')
  const [stone, hollow] = [...root.querySelectorAll('circle')]

  it('is the manifest icon, ships in the package and stays under the Host size cap', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
    expect(pkg.icon).toBe('assets/icon.svg')
    expect(pkg.files).toContain('assets/icon.svg')
    // The Host refuses to read an icon larger than 256 KiB.
    expect(Buffer.byteLength(source, 'utf8')).toBeLessThanOrEqual(256 * 1024)
  })

  it('maps the 24-unit sidebar mark across the 36-unit image canvas without double padding', () => {
    expect(root.getAttribute('viewBox')).toBe('0 0 36 36')
    const placed = /translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/.exec(mark?.getAttribute('transform') ?? '')?.slice(1).map(Number)
    expect(placed?.slice(0, 2)).toEqual([0, 0])
    expect(placed?.[2]).toBeCloseTo(36 / GO_ROW_GEOMETRY.viewBox, 4)
    expect(attrs(mark)).toMatchObject({ fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  })

  it('traces GO_ROW_GEOMETRY, so the row icon and the package icon cannot drift apart', () => {
    expect(outline?.getAttribute('d')).toBe(GO_ROW_GEOMETRY.path)
    expect(attrs(stone)).toMatchObject({
      cx: String(GO_ROW_GEOMETRY.stone.cx), cy: String(GO_ROW_GEOMETRY.stone.cy), r: String(GO_ROW_GEOMETRY.stone.r),
    })
    expect(attrs(hollow)).toMatchObject({
      cx: String(GO_ROW_GEOMETRY.outline.cx), cy: String(GO_ROW_GEOMETRY.outline.cy), r: String(GO_ROW_GEOMETRY.outline.r),
    })
  })

  it('wears the Host palette: blue outline and hollow stone, green-to-teal filled stone', () => {
    // Slightly heavier than the 16px row icon (2.05/1.95) so the 1.5x scaled strokes match the bold built-in artwork.
    expect(attrs(outline)).toMatchObject({ 'stroke-width': '2.3' })
    expect(outline?.parentElement?.getAttribute('stroke')).toBe('url(#a)')
    expect(attrs(stone)).toMatchObject({ fill: 'url(#b)', stroke: 'none' })
    expect(attrs(hollow)).toMatchObject({ 'stroke-width': '2.15' })
    expect(hollow?.parentElement?.getAttribute('stroke')).toBe('url(#a)')
    // The hollow stone must not also be painted solid.
    expect(hollow?.getAttribute('fill')).toBeNull()
    // Painted in the row icon's order, so the hollow stone lies over the filled one.
    expect(precedes(outline, stone)).toBe(true)
    expect(precedes(stone, hollow)).toBe(true)
    expect(stops('a')).toEqual(['#69B9FF', '#324DE2'])
    expect(stops('b')).toEqual(['#45E7A4', '#05909D'])
    // Both run top to bottom over the whole mark, so its parts shade alike.
    for (const id of ['a', 'b']) {
      expect(attrs(gradient(id))).toMatchObject({ gradientUnits: 'userSpaceOnUse', x1: '18.004', x2: '18.004', y1: '4.473', y2: '31.425' })
    }
  })

  it('renders as a standalone image: no inherited colour, script, style or external reference', () => {
    expect(source).not.toMatch(/currentColor|<script\b|<style\b|<foreignObject\b|\bhref\s*=|@import|url\(\s*['"]?https?:/i)
    expect(root.querySelector('parsererror')).toBeNull()
  })
})
