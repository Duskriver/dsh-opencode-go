import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

/**
 * The usage panel's frosted glass was lost three times to the same trap: this
 * repo's CSS modules are minified by lightningcss, which merges backdrop-filter
 * with -webkit-backdrop-filter and ships only the LAST spelling. Current
 * Chromium ignores -webkit-backdrop-filter entirely, so a source file that
 * carries both (prefix last) compiles to a stylesheet with no working blur.
 * These guards pin the structure that survives the build: the blur on a
 * dedicated material child (the host MenuSurface's shape), unprefixed.
 */
/** Declarations only: comments may quote the forbidden prefixed spelling. */
const source = readFileSync('src/client/UsagePill.module.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const rule = (name: string): string => source.match(new RegExp('\\' + name + ' \\{([^}]*)\\}'))?.[1] ?? ''

it('declares only the unprefixed backdrop-filter', () => {
  expect(source).toContain('backdrop-filter')
  expect(source).not.toContain('-webkit-backdrop-filter')
})

it('keeps the blur on the material child, never on the panel or its scroller', () => {
  expect(rule('.material')).toContain('backdrop-filter')
  expect(rule('.panel')).not.toContain('backdrop-filter')
  expect(rule('.panel')).not.toContain('overflow')
  expect(rule('.body')).toContain('overflow-y: auto')
})

it('keeps an opaque fallback for hosts without backdrop-filter', () => {
  expect(source).toMatch(/@supports not \(backdrop-filter: blur\(1px\)\)/)
})
