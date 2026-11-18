// @vitest-environment jsdom
/**
 * Contract tests for the OpenCode Go marks: the sidebar row icon and the page
 * brand tile. The sidebar icon is the hand-drawn `go` mark (a `g` outline plus
 * the filled and hollow stone pair); pinning its geometry keeps a later refactor
 * from silently reverting to the old wave glyph.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GoLogo, GoMark, GoRowIcon } from '../src/client/GoMark.tsx'

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
