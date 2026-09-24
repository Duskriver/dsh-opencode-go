import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const run = promisify(execFile)
const hosts = ['dsh-llm-v015-rc1', 'dsh-llm-v015-rc2', '@deepseek-ai/dsh-llm', 'dsh-llm-v016-alpha2', 'v017', 'v017-alpha2', 'v017-rc1', 'v017-rc2']

it.each(['v017-rc1', 'v017-rc2'])('admits the plugin bundle through the %s profile compatibility gate', async (host) => {
  const { stdout, stderr } = await run(process.execPath, [
    '--expose-internals', fileURLToPath(new URL('./fixtures/bundle-compatibility.mjs', import.meta.url)), host,
  ], { timeout: 12000 })
  expect(stdout).toContain('PASS: Web and Headless bundle admission without exemptions')
  expect(stderr).not.toContain('skipping profile bundle')
})

// A fresh Node process tests distributed ESM imports and real LLM/attachment packages.
// Mocking exports or attachment reads would hide the failures reported in #1 and #2.
it.each(hosts)(
  'loads and streams the built plugin against %s',
  async (llm) => {
    const { stdout } = await run(process.execPath, [
      '--expose-internals', fileURLToPath(new URL('./fixtures/host-compatibility.mjs', import.meta.url)), llm,
    ], { timeout: 12000 })
    expect(stdout).toContain('PASS: host compatibility')
  },
)

it.each(hosts)('resolves default and explicit reasoning efforts on %s', async (host) => {
  const { stdout } = await run(process.execPath, [
    '--expose-internals', fileURLToPath(new URL('./fixtures/reasoning-compatibility.mjs', import.meta.url)), host,
  ], { timeout: 12000 })
  expect(stdout).toContain('PASS: reasoning compatibility')
})

it.each(['v017', 'v017-alpha2', 'v017-rc1', 'v017-rc2'])('edits profile settings without remounting on %s', async (host) => {
  const { stdout } = await run(process.execPath, [
    '--expose-internals', fileURLToPath(new URL('./fixtures/profile-compatibility.mjs', import.meta.url)), host,
  ], { timeout: 12000 })
  expect(stdout).toContain('PASS: profile settings')
})
