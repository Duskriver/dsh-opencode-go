/** Regression for Git installs: no lib/, test hosts, or node_modules in the source fixture. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { npm, run } from './test-process.mjs'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const scratch = await realpath(await mkdtemp(join(tmpdir(), 'dsh-git-install-')))
try {
  const source = join(scratch, 'source')
  await mkdir(source)
  const { stdout } = await exec('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root })
  for (const path of new Set(stdout.split('\0').filter(Boolean))) {
    if (path.startsWith('tests/')) continue
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
  for (const manager of ['npm', 'pnpm']) {
    console.log(`\nChecking ${manager} Git installation without compatibility fixtures`)
    const consumer = join(scratch, manager)
    await mkdir(consumer)
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: `install-test-${manager}`, private: true }))
    if (manager === 'npm') {
      await npm(['install', '--no-audit', '--no-fund', gitURL], consumer)
    } else {
      await writeFile(join(consumer, 'pnpm-workspace.yaml'), [
        'allowBuilds:', `  ${JSON.stringify(`${manifest.name}@${gitURL}`)}: true`,
        '  "@google/genai": false', '  protobufjs: false', '',
      ].join('\n'))
      // Pin the same pnpm generation used by DSH desktop; npm exec works on Windows too.
      await npm(['exec', '--yes', '--package=pnpm@11.7.0', '--', 'pnpm', 'add', gitURL], consumer)
    }
    await copyFile(join(root, 'tests/fixtures/installation.mjs'), join(consumer, 'installation.mjs'))
    await run(process.execPath, ['installation.mjs'], { cwd: consumer })
  }
  console.log('\nPASS: npm and pnpm Git installation without test-host dependencies')
} finally {
  await rm(scratch, { recursive: true, force: true })
}
