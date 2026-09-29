/** Build once, install the same tarball in isolated consumers, test real exports. */
import assert from 'node:assert/strict'
import { appendFile, copyFile, cp, mkdir, mkdtemp, open, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hosts } from './compatibility-hosts.mjs'
import { npm, run } from './test-process.mjs'
import { runConcurrent } from './test-concurrency.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const selected = process.argv.slice(2)
for (const id of selected) assert.ok(hosts.some(host => host.id === id), `Unknown host: ${id}`)
const matrix = hosts.filter(host => !selected.length || selected.includes(host.id))
const concurrency = Number(process.env.DSH_COMPAT_CONCURRENCY ?? 1)
assert.ok(Number.isSafeInteger(concurrency) && concurrency > 0, 'DSH_COMPAT_CONCURRENCY must be a positive integer')
const started = performance.now()
const timings = new Map()
const scratch = await realpath(await mkdtemp(join(tmpdir(), 'dsh-compat-')))
try {
  await npm(['pack', '--pack-destination', scratch], root)
  const tarballs = (await readdir(scratch)).filter(name => name.endsWith('.tgz'))
  assert.equal(tarballs.length, 1)
  const tarball = join(scratch, tarballs[0])
  console.log(`\nTesting ${matrix.length} installed hosts with concurrency ${Math.min(concurrency, matrix.length)}`)
  const results = await runConcurrent(matrix, concurrency, async ({ id, version }) => {
    console.log(`[${id}] Starting DSH ${version}`)
    const hostStarted = performance.now()
    const logPath = join(scratch, `${id}.log`)
    const log = await open(logPath, 'w')
    const stdio = ['ignore', log.fd, log.fd]
    try {
      await testHost({ id, version }, tarball, stdio)
    } catch (cause) {
      throw new Error(`${id}: compatibility check failed`, { cause })
    } finally {
      await log.close()
      timings.set(id, ((performance.now() - hostStarted) / 1000).toFixed(1))
      const output = await readFile(logPath, 'utf8')
      console.log(`\n${process.env.GITHUB_ACTIONS ? '::group::' : ''}[${id}] DSH ${version} (${timings.get(id)}s)`)
      console.log(output)
      if (process.env.GITHUB_ACTIONS) console.log('::endgroup::')
    }
  })
  const rows = matrix.map(({ id }, index) => `| ${id} | ${results[index].status === 'fulfilled' ? 'PASS' : 'FAIL'} | ${timings.get(id) ?? '—'} |`)
  const summary = [
    `### Installed-host compatibility (concurrency ${Math.min(concurrency, matrix.length)})`,
    '', '| Host | Result | Seconds |', '| --- | --- | ---: |', ...rows, '',
    `Elapsed before cleanup: ${((performance.now() - started) / 1000).toFixed(1)}s`, '',
  ].join('\n')
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  const failures = results.filter(result => result.status === 'rejected')
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), `${failures.length} host(s) failed`)
  console.log(`\nPASS: installed-package compatibility across ${matrix.length} host(s)`)
} finally {
  await rm(scratch, { recursive: true, force: true })
  console.log(`Compatibility total including cleanup: ${((performance.now() - started) / 1000).toFixed(1)}s`)
}

async function testHost({ id, version }, tarball, stdio) {
  const consumer = join(scratch, id)
  await mkdir(consumer)
  for (const name of ['package.json', 'package-lock.json']) {
    await copyFile(join(root, 'tests/hosts', id, name), join(consumer, name))
  }
  const lock = JSON.parse(await readFile(join(consumer, 'package-lock.json'), 'utf8'))
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path.includes('node_modules/@deepseek-ai/dsh-')) {
      assert.equal(entry.version, version, `${id}: ${path} must belong to this host generation`)
    }
  }
  // Validate the host's own dependency contracts before installing the plugin.
  await npm(['ci', '--strict-peer-deps', '--no-audit', '--no-fund'], consumer, { stdio })
  // DSH accepts future prereleases in >= ranges, whereas npm peers do not.
  // Scope this exception to installing the artifact into an already validated host.
  await npm(['install', '--no-save', '--package-lock=false', '--legacy-peer-deps', '--no-audit', '--no-fund', tarball], consumer, { stdio })
  const manifest = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'))
  for (const [name, expected] of Object.entries(manifest.dependencies)) {
    if (!name.startsWith('@deepseek-ai/')) continue
    const installed = JSON.parse(await readFile(join(consumer, 'node_modules', name, 'package.json'), 'utf8'))
    assert.equal(installed.version, expected, `${id}: ${name} must retain its pinned host version`)
  }
  const plugin = join(consumer, 'node_modules/dsh-opencode-go')
  assert.equal(await realpath(plugin), plugin, 'the installed plugin must not link to the source checkout')
  await cp(join(root, 'tests/fixtures'), join(consumer, 'fixtures'), { recursive: true })
  const fixtures = ['host-compatibility', 'reasoning-compatibility', 'client-compatibility']
  if (id.startsWith('v017')) fixtures.push('profile-compatibility')
  if (id.startsWith('v017-rc')) fixtures.push('bundle-compatibility')
  for (const fixture of fixtures) {
    await run(process.execPath, ['--expose-internals', join(consumer, 'fixtures', `${fixture}.mjs`), id, version], {
      cwd: consumer, timeout: 30_000, stdio,
      env: { ...process.env, DSH_HOME: join(consumer, `home-${fixture}`) },
    })
  }
}
