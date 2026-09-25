import { readFileSync } from 'node:fs'
import { satisfies } from 'semver'
import { expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// DSH's bundle gate and the market both include prereleases in host ranges.
// Keep these declaration checks aligned with that policy, not npm's defaults.
it.each([
  ['0.1.5-rc.1', '4.0.2'],
  ['0.1.5-rc.2', '4.0.2'],
  ['0.1.6-alpha.1', '4.0.2'],
  ['0.1.6-alpha.2', '4.0.2'],
  ['0.1.7-alpha.1', '4.0.3'],
  ['0.1.7-alpha.2', '4.0.4'],
  ['0.1.7-rc.1', '4.0.4'],
  ['0.1.7-rc.2', '4.0.4'],
])('declares compatible engine and peers for DSH %s / Cordis %s', (dsh, cordis) => {
  expect(satisfies(dsh, manifest.engines.dsh, { includePrerelease: true }), 'engines.dsh').toBe(true)
  for (const [name, range] of Object.entries(manifest.peerDependencies)) {
    const version = name === '@deepseek-ai/cordis' ? cordis : dsh
    expect(satisfies(version, range as string, { includePrerelease: true }), `${name}@${version}`).toBe(true)
  }
})

it('keeps the minimum DSH version without an upper bound or prerelease whitelist', () => {
  const declarations = [manifest.engines.dsh, ...Object.entries(manifest.peerDependencies)
    .filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
    .map(([, range]) => range as string)]
  for (const [version, supported] of [
    ['0.1.4', false],
    ['0.1.5-alpha.1', false],
    ['0.1.5-rc.0', false],
    ['0.1.5', true],
    ['0.1.6-alpha.3', true],
    ['0.1.7-alpha.3', true],
    ['0.1.7-rc.3', true],
    ['0.1.7', true],
    ['0.1.8-alpha.1', true],
    ['0.1.8-rc.1', true],
    ['0.2.0', true],
    ['1.0.0-alpha.1', true],
    ['1.0.0', true],
  ] as const) {
    for (const range of declarations) {
      expect(satisfies(version, range, { includePrerelease: true }), `${version} in ${range}`).toBe(supported)
    }
  }
})
