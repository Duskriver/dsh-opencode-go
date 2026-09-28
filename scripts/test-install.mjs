/** Install the shipped Git artifacts without source, build tools, or plugin build approval. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { appendFile, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { npm, run } from './test-process.mjs'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const requested = process.argv.slice(2)
const managers = requested.length ? [...new Set(requested)] : ['npm', 'pnpm']
for (const manager of managers) {
  if (!['npm', 'pnpm'].includes(manager)) throw new Error(`Unknown package manager: ${manager}. Use npm or pnpm.`)
}
const timings = []
async function measure(phase, action) {
  const start = performance.now()
  let status = 'failed'
  console.log(`\n[install] ${phase}: started`)
  try {
    const result = await action()
    status = 'passed'
    return result
  } finally {
    const seconds = ((performance.now() - start) / 1000).toFixed(1)
    timings.push({ phase, seconds, status })
    console.log(`[install] ${phase}: ${status} (${seconds}s)`)
  }
}

const start = performance.now()
// Keep CI consumers outside the checkout, on the runner's temporary volume.
const scratch = await realpath(await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'dsh-git-install-')))
console.log(`[install] Node ${process.version} on ${process.platform}; managers: ${managers.join(', ')}`)
try {
  const { manifest, gitURL } = await measure('Prepare source fixture', async () => {
    const source = join(scratch, 'source')
    await mkdir(source)
    const { stdout } = await exec('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root })
    for (const path of new Set(stdout.split('\0').filter(Boolean))) {
      if (['tests/', 'src/', 'scripts/'].some(prefix => path.startsWith(prefix))) continue
      const destination = join(source, path)
      await mkdir(dirname(destination), { recursive: true })
      try { await copyFile(join(root, path), destination) }
      catch (error) { if (error.code !== 'ENOENT') throw error } // tracked deletions
    }
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    await exec('git', ['init', '--quiet', source])
    await exec('git', ['add', '.'], { cwd: source })
    const hooks = join(scratch, 'empty-hooks')
    await mkdir(hooks)
    await exec('git', ['-c', 'user.name=Install fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', `core.hooksPath=${hooks}`, 'commit', '--no-gpg-sign', '--quiet', '-m', 'Installation fixture'], { cwd: source })
    const { stdout: revision } = await exec('git', ['rev-parse', 'HEAD'], { cwd: source })
    const gitURL = `git+${pathToFileURL(source).href}#${revision.trim()}`
    return { manifest, gitURL }
  })
  for (const manager of managers) {
    console.log(`\nChecking ${manager} Git installation from prebuilt artifacts`)
    const consumer = join(scratch, manager)
    await mkdir(consumer)
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: `install-test-${manager}`, private: true }))
    if (manager === 'npm') {
      await measure('npm Git installation', () => npm(['install', '--no-audit', '--no-fund', gitURL], consumer))
    } else {
      await writeFile(join(consumer, 'pnpm-workspace.yaml'), [
        'allowBuilds:',
        '  "@google/genai": false', '  protobufjs: false', '',
      ].join('\n'))
      // No plugin allowBuilds entry: users must be able to install with the default trust policy.
      // Pin the same pnpm generation used by DSH desktop; npm exec works on Windows too.
      const store = process.env.DSH_PNPM_STORE_DIR ? ['--store-dir', process.env.DSH_PNPM_STORE_DIR] : []
      await measure('pnpm Git installation', () => npm([
        'exec', '--yes', '--package=pnpm@11.7.0', '--', 'pnpm', 'add', '--prefer-offline', ...store, gitURL,
      ], consumer))
    }
    await copyFile(join(root, 'tests/fixtures/installation.mjs'), join(consumer, 'installation.mjs'))
    await measure(`${manager} artifact verification`, () => run(process.execPath, ['installation.mjs'], { cwd: consumer }))
  }
  console.log(`\nPASS: ${managers.join(' and ')} Git installation without source builds or plugin build approval`)
} finally {
  try {
    await measure('Clean temporary consumers', () => rm(scratch, { recursive: true, force: true }))
  } finally {
    const total = ((performance.now() - start) / 1000).toFixed(1)
    console.log(`[install] Total: ${total}s`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, [
        `## Git installation: ${managers.join(', ')}`, '',
        '| Phase | Seconds | Result |', '| --- | ---: | --- |',
        ...timings.map(({ phase, seconds, status }) => `| ${phase} | ${seconds} | ${status} |`),
        '', `Total: ${total}s.`, '',
      ].join('\n'))
    }
  }
}
