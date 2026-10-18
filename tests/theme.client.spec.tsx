// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ThemeDots } from '../src/client/ThemeDots.tsx'
import { en } from '../src/client/locales.ts'
import {
  DEFAULT_GO_THEME, GO_THEMES, GO_THEME_TOKENS, getGoTheme, setGoTheme, subscribeGoTheme, themeStyle, useGoThemeTokens,
} from '../src/client/theme.ts'

beforeEach(() => { localStorage.clear(); setGoTheme(DEFAULT_GO_THEME) })
afterEach(() => { cleanup(); localStorage.clear(); document.body.removeAttribute('data-ds-dark-theme') })

it('defaults to graphite and persists a selection', () => {
  expect(GO_THEMES).toHaveLength(4)
  expect(getGoTheme()).toBe(DEFAULT_GO_THEME)
  const listener = vi.fn()
  const off = subscribeGoTheme(listener)
  setGoTheme('silent-black')
  expect(getGoTheme()).toBe('silent-black')
  expect(localStorage.getItem('dsh-opencode-go.theme')).toBe('silent-black')
  expect(listener).toHaveBeenCalledTimes(1)
  off()
  setGoTheme('graphite')
  expect(listener).toHaveBeenCalledTimes(1)
})

it('carries every token into the inline style', () => {
  const style = themeStyle(GO_THEME_TOKENS.graphite.dark) as Record<string, string>
  expect(style['--go-accent']).toBe('#6e8bff')
  expect(style['--go-bg']).toBe('#111214')
  for (const key of ['--go-surface', '--go-surface-2', '--go-border', '--go-text', '--go-muted',
    '--go-accent-2', '--go-success', '--go-warning', '--go-danger']) {
    expect(style[key]).toBeTruthy()
  }
})

it('renders four palette dots and switches on click', () => {
  render(<ThemeDots t={key => en[key]} />)
  expect(screen.getAllByRole('button')).toHaveLength(4)
  expect(screen.getByRole('button', { name: en.themeGraphite }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: en.themeSilentBlack }))
  expect(getGoTheme()).toBe('silent-black')
  expect(screen.getByRole('button', { name: en.themeSilentBlack }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: en.themeGraphite }).getAttribute('aria-pressed')).toBe('false')
})

function Probe() {
  const tokens = useGoThemeTokens()
  return <span data-testid="probe" data-bg={tokens.bg} />
}

it('follows the host light/dark attribute', async () => {
  document.body.removeAttribute('data-ds-dark-theme')
  render(<Probe />)
  expect(screen.getByTestId('probe').getAttribute('data-bg')).toBe(GO_THEME_TOKENS.graphite.light.bg)
  await act(async () => {
    document.body.setAttribute('data-ds-dark-theme', '')
    await Promise.resolve()
  })
  expect(screen.getByTestId('probe').getAttribute('data-bg')).toBe(GO_THEME_TOKENS.graphite.dark.bg)
})
