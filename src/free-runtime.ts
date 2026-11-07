/** Resolve the pinned official Bun dependency, including installs with scripts disabled. */
import { closeSync, existsSync, openSync, readSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LlmError } from '@deepseek-ai/dsh-llm'

function nativeBinary(path: string): boolean {
  let descriptor: number | undefined
  try {
    descriptor = openSync(path, 'r')
    const bytes = Buffer.alloc(4)
    if (readSync(descriptor, bytes, 0, 4, 0) !== 4) return false
    const magic = bytes.toString('hex')
    return magic.startsWith('4d5a') || ['7f454c46', 'cffaedfe', 'cefaedfe', 'feedfacf', 'feedface', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(magic)
  } catch { return false }
  finally { if (descriptor !== undefined) closeSync(descriptor) }
}

export function resolveFreeRuntime(): string {
  try {
    const require = createRequire(import.meta.url)
    const manifest = require.resolve('bun/package.json')
    // Bun's installer can select a baseline CPU binary. Prefer its native
    // launcher when present; otherwise resolve the optional platform package.
    const installed = join(dirname(manifest), 'bin', 'bun.exe')
    if (nativeBinary(installed)) return installed
    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'android' ? 'linux' : process.platform
    const arch = process.arch === 'arm64' ? 'aarch64' : process.arch
    const report = process.platform === 'linux' ? process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } : undefined
    const header = report?.header
    const libc = process.platform === 'android' ? '-android' : process.platform === 'linux' && !header?.glibcVersionRuntime ? '-musl' : ''
    const name = `@oven/bun-${platform}-${arch}${libc}`
    const binary = join(dirname(createRequire(manifest).resolve(`${name}/package.json`)), 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun')
    if (existsSync(binary)) return binary
  } catch { /* Optional runtime installation may have been omitted. Go still works. */ }
  throw new LlmError('OpenCode Free requires the bundled Bun runtime. Reinstall dsh-opencode-go with optional dependencies enabled.', 'MISSING_BUN_RUNTIME')
}

export function freeWorkerPath(): string {
  const compiled = fileURLToPath(new URL('./free-http-worker.js', import.meta.url))
  if (existsSync(compiled)) return compiled
  // Bun also runs the source worker during development and source-based tests.
  const source = fileURLToPath(new URL('./free-http-worker.ts', import.meta.url))
  if (existsSync(source)) return source
  throw new LlmError('OpenCode Free HTTP worker is missing from the installed package.', 'MISSING_BUN_RUNTIME')
}
