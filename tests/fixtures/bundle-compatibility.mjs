/** Exercise the startup gate that skips incompatible profile bundles (#8). */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useModernHost } from './modern-host.mjs'

const host = process.argv[2] ?? 'v017-rc1'
await useModernHost(host)
const { getDshRuntimeVersion, loadProfileDirectory } = await import('@deepseek-ai/dsh-app-boot')
assert.equal(getDshRuntimeVersion(), { 'v017-rc1': '0.1.7-rc.1', 'v017-rc2': '0.1.7-rc.2' }[host])
const root = fileURLToPath(new URL('../../', import.meta.url))
const installAnchor = fileURLToPath(new URL(`../hosts/${host}/package.json`, import.meta.url))
const home = await mkdtemp(join(tmpdir(), 'opencode-go-bundle-compat-'))
try {
  for (const name of ['web', 'headless']) {
    const dir = join(home, name)
    await mkdir(join(dir, 'node_modules'), { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      private: true, dsh: { profile: { bundles: ['dsh-opencode-go'] } },
    }))
    await symlink(root, join(dir, 'node_modules/dsh-opencode-go'), 'junction')
    const profile = loadProfileDirectory('dsh', dir, installAnchor)
    assert.deepEqual(profile.skippedBundles ?? [], [], `${name}: no profile bundles may be rejected`)
    assert.equal(profile.layers.length, 1, `${name}: OpenCode Go bundle must not be skipped without a version exemption`)
    assert.equal(profile.layers[0].packageName, 'dsh-opencode-go')
    assert.ok(profile.layers[0].patches.some(patch => patch.insert?.some(entry => entry.id === 'opencode-go')),
      `${name}: the provider entry must survive bundle admission`)
  }
  console.log('PASS: Web and Headless bundle admission without exemptions')
} finally {
  await rm(home, { recursive: true, force: true })
}
