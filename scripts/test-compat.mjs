/** Build once, install the same tarball in isolated consumers, test real exports. */
import assert from 'node:assert/strict'
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hosts } from './compatibility-hosts.mjs'
import { npm, run } from './test-process.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const selected = process.argv.slice(2)
for (const id of selected) assert.ok(hosts.some(host => host.id === id), `Unknown host: ${id}`)
const matrix = hosts.filter(host => !selected.length || selected.includes(host.id))
const scratch = await realpath(await mkdtemp(join(tmpdir(), 'dsh-compat-')))
try {
  await npm(['pack', '--pack-destination', scratch], root)
  const tarballs = (await readdir(scratch)).filter(name => name.endsWith('.tgz'))
  assert.equal(tarballs.length, 1)
  const tarball = join(scratch, tarballs[0])
  for (const { id, version } of matrix) {
    console.log(`\nTesting installed package on DSH ${version} (${id})`)
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
    await npm(['ci', '--strict-peer-deps', '--no-audit', '--no-fund'], consumer)
    // DSH accepts future prereleases in >= ranges, whereas npm peers do not.
    // Scope this exception to installing the artifact into an already validated host.
    await npm(['install', '--no-save', '--package-lock=false', '--legacy-peer-deps', '--no-audit', '--no-fund', tarball], consumer)
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
        cwd: consumer, timeout: 30_000,
      })
    }
  }
  console.log(`\nPASS: installed-package compatibility across ${matrix.length} host(s)`)
} finally {
  await rm(scratch, { recursive: true, force: true })
}
