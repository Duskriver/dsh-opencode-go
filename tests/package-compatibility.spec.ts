import { readFileSync } from 'node:fs'
import { satisfies } from 'semver'
import { expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// Loading fixtures bypass the package manager, so also check the ranges consumers install.
it.each([
  ['0.1.5-rc.1', '4.0.2'],
  ['0.1.5-rc.2', '4.0.2'],
  ['0.1.6-alpha.1', '4.0.2'],
  ['0.1.6-alpha.2', '4.0.2'],
  ['0.1.7-alpha.1', '4.0.3'],
  ['0.1.7-alpha.2', '4.0.4'],
  ['0.1.7-rc.1', '4.0.4'],
])('declares compatible engine and peers for DSH %s / Cordis %s', (dsh, cordis) => {
  expect(satisfies(dsh, manifest.engines.dsh), 'engines.dsh').toBe(true)
  for (const [name, range] of Object.entries(manifest.peerDependencies)) {
    const version = name === '@deepseek-ai/cordis' ? cordis : dsh
    expect(satisfies(version, range as string), `${name}@${version}`).toBe(true)
  }
})

it('does not claim support for unverified DSH prereleases', () => {
  for (const version of ['0.1.7-alpha.3', '0.1.8-alpha.1']) {
    expect(satisfies(version, manifest.engines.dsh)).toBe(false)
    expect(satisfies(version, manifest.peerDependencies['@deepseek-ai/dsh-llm'])).toBe(false)
  }
})
