import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const run = promisify(execFile)

// A fresh Node process tests the distributed ESM imports as well as behavior.
// Mocking exports in Vitest would hide the startup failure reported in #1.
it.each(['dsh-llm-v015-rc1', 'dsh-llm-v015-rc2', '@deepseek-ai/dsh-llm'])(
  'loads and streams the built plugin against %s',
  async (llm) => {
    const { stdout } = await run(process.execPath, [
      '--expose-internals', fileURLToPath(new URL('./fixtures/host-compatibility.mjs', import.meta.url)), llm,
    ], { timeout: 12000 })
    expect(stdout).toContain('PASS: host compatibility')
  },
)
