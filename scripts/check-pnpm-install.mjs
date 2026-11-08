/** Install the packed plugin with the pnpm generation and strict build policy from issue #87. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const scratch = await realpath(await mkdtemp(join(tmpdir(), 'dsh-opencode-go-pnpm-')))

async function run(command, args, cwd, env = process.env, quiet = false) {
  try {
    const { stdout, stderr } = await exec(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    if (!quiet && stdout) process.stdout.write(stdout)
    if (!quiet && stderr) process.stderr.write(stderr)
    return stdout
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    throw error
  }
}

try {
  const packed = await run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root, process.env, true)
  const parsed = JSON.parse(packed)
  const entry = Array.isArray(parsed) ? parsed[0] : parsed[Object.keys(parsed)[0]]
  assert.ok(entry?.filename, 'npm pack did not return a tarball filename')
  const consumer = join(scratch, 'consumer')
  const config = join(scratch, 'config')
  await mkdir(consumer)
  await mkdir(config)
  const userConfig = join(scratch, 'empty-npmrc')
  await writeFile(userConfig, '')
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'dsh-opencode-go-pnpm-check', private: true }))

  // Isolate user/global approvals. strict-dep-builds turns every ignored Bun
  // postinstall into the same nonzero installation failure reported in #87.
  const env = { ...process.env, XDG_CONFIG_HOME: config, NPM_CONFIG_USERCONFIG: userConfig }
  await run(npm, [
    'exec', '--yes', '--package=pnpm@11.28.5', '--', 'pnpm', 'add',
    '--config.strict-dep-builds=true', '--config.auto-install-peers=false',
    '--config.strict-peer-dependencies=false', '--store-dir', join(scratch, 'store'), join(scratch, entry.filename),
  ], consumer, env)

  const manifestPath = join(consumer, 'node_modules/dsh-opencode-go/package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(manifest.optionalDependencies?.bun, undefined, 'the script-bearing bun wrapper must not be installed')
  const platform = process.platform === 'win32' ? 'windows' : process.platform === 'android' ? 'linux' : process.platform
  const arch = process.arch === 'arm64' ? 'aarch64' : process.arch
  const report = process.platform === 'linux' ? process.report?.getReport() : undefined
  const libc = process.platform === 'android' ? '-android' : process.platform === 'linux' && !report?.header?.glibcVersionRuntime ? '-musl' : ''
  const name = `@oven/bun-${platform}-${arch}${libc}`
  const version = manifest.optionalDependencies?.[name]
  assert.equal(typeof version, 'string', `the direct optional runtime ${name} must be declared`)
  const require = createRequire(await realpath(manifestPath))
  const binary = join(dirname(require.resolve(`${name}/package.json`)), 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun')
  assert.equal((await run(binary, ['--version'], consumer, env)).trim(), version)
  console.log(`PASS: pnpm 11.28.5 installs the packed plugin without build approvals; ${name}@${version} runs`)
} finally {
  await rm(scratch, { recursive: true, force: true })
}
