import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const run = promisify(execFile)

// A fresh Node process tests distributed ESM imports and real LLM/attachment packages.
// Mocking exports or attachment reads would hide the failures reported in #1 and #2.
it.each(['dsh-llm-v015-rc1', 'dsh-llm-v015-rc2', '@deepseek-ai/dsh-llm', 'dsh-llm-v016-alpha2', 'v017'])(
  'loads and streams the built plugin against %s',
  async (llm) => {
    const { stdout } = await run(process.execPath, [
      '--expose-internals', fileURLToPath(new URL('./fixtures/host-compatibility.mjs', import.meta.url)), llm,
    ], { timeout: 12000 })
    expect(stdout).toContain('PASS: host compatibility')
  },
)

it('edits profile settings without remounting on DSH 0.1.7', async () => {
  const { stdout } = await run(process.execPath, [
    '--expose-internals', fileURLToPath(new URL('./fixtures/profile-compatibility.mjs', import.meta.url)),
  ], { timeout: 12000 })
  expect(stdout).toContain('PASS: profile settings')
})
