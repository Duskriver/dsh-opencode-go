/**
 * Assert the published tarball contains every file the plugin needs at runtime,
 * for its docs and for its third-party notices, and verify the single tracked
 * root `<name>-<version>.tgz` matches the workspace byte-for-byte. Runs as
 * `npm run check:pack` locally and in CI; `--ignore-scripts` keeps the
 * assertion from re-running the `prepack` build it is meant to guard.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

const REQUIRED_FILES = [
  'package.json',
  'LICENSE',
  'README.md',
  'README.en.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'THIRD_PARTY_NOTICES.md',
  'cordis.patch.yml',
  'assets/icon.png',
  'lib/index.js',
  'lib/client.js',
  'lib/free-http-worker.js',
  'lib/build-info.json',
  'lib/vendor-licenses.txt',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'docs/advanced.md',
  'docs/advanced.en.md',
  'docs/development.md',
  'docs/independent-package.md',
  'docs/usage-analytics.md',
  'docs/usage-analytics.en.md',
  'docs/verification.md',
  'docs/assets/logo-light.png',
  'docs/assets/logo-dark.png',
  'examples/headless.patch.yml',
  'examples/migrate-from-fork.patch.yml',
  // THIRD_PARTY_NOTICES.md points here for the pi packages' upstream license.
  'scripts/licenses/pi-1.5.0-LICENSE',
]

function parsePaxPath(data) {
  const text = data.toString('utf8')
  let offset = 0
  while (offset < text.length) {
    const space = text.indexOf(' ', offset)
    if (space === -1) break
    const length = Number.parseInt(text.slice(offset, space), 10)
    if (!Number.isFinite(length) || length <= 0) break
    const record = text.slice(space + 1, offset + length).replace(/\n$/, '')
    if (record.startsWith('path=')) return record.slice('path='.length)
    offset += length
  }
  return undefined
}

function readTarEntries(tgzBuffer) {
  const tar = gunzipSync(tgzBuffer)
  const files = new Map()
  let offset = 0
  let paxPath
  let gnuLongName
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const sizeText = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim()
    const size = sizeText === '' ? 0 : Number.parseInt(sizeText, 8)
    const typeFlag = header[156]
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    offset += 512
    const data = tar.subarray(offset, offset + size)
    offset += Math.ceil(size / 512) * 512

    if (typeFlag === 120) {
      paxPath = parsePaxPath(data)
      continue
    }
    if (typeFlag === 76) {
      gnuLongName = data.toString('utf8').replace(/\0.*$/, '')
      continue
    }
    if (typeFlag === 103) {
      continue
    }

    const fullName = paxPath ?? gnuLongName ?? (prefix ? `${prefix}/${rawName}` : rawName)
    paxPath = undefined
    gnuLongName = undefined

    if (typeFlag === 0 || typeFlag === 48) {
      const normalized = fullName.replace(/^package\//, '')
      files.set(normalized, Buffer.from(data))
    }
  }
  return files
}

const args = ['pack', '--dry-run', '--json', '--ignore-scripts']
// npm's own CLI path is the most portable invocation under `npm run`; the
// fallback covers direct `node scripts/check-pack.mjs` on every platform.
const npmExecPath = process.env.npm_execpath
const output = npmExecPath
  ? execFileSync(process.execPath, [npmExecPath, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  : execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args,
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' })

const parsed = JSON.parse(output)
const entry = Array.isArray(parsed) ? parsed[0] : parsed[Object.keys(parsed)[0]]
assert.ok(entry && typeof entry === 'object' && Array.isArray(entry.files), 'npm pack did not report a package entry')
const packed = new Set(entry.files.map(file => typeof file === 'string' ? file : file.path))
const missing = REQUIRED_FILES.filter(path => !packed.has(path))
assert.deepEqual(missing, [], `Tarball is missing required files: ${missing.join(', ')}`)
if (typeof entry.entryCount === 'number') assert.equal(packed.size, entry.entryCount, 'npm pack entry count does not match its file list')

const expectedTarball = `${pkg.name}-${pkg.version}.tgz`
const tarballPattern = new RegExp(`^${pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-.*\\.tgz$`)
const rootTarballs = readdirSync(root).filter(name => tarballPattern.test(name)).sort()
assert.deepEqual(
  rootTarballs,
  [expectedTarball],
  `Expected exactly one tracked root tarball [${expectedTarball}], found [${rootTarballs.join(', ')}]. Run npm run pack:release.`,
)

const archivedFiles = readTarEntries(readFileSync(resolve(root, expectedTarball)))
const missingInArchive = [...packed].filter(path => !archivedFiles.has(path))
const extraInArchive = [...archivedFiles.keys()].filter(path => !packed.has(path))
assert.deepEqual(
  missingInArchive,
  [],
  `Tracked tarball ${expectedTarball} is missing files: ${missingInArchive.join(', ')}. Run npm run pack:release.`,
)
assert.deepEqual(
  extraInArchive,
  [],
  `Tracked tarball ${expectedTarball} contains extra files: ${extraInArchive.join(', ')}. Run npm run pack:release.`,
)

const staleFiles = []
for (const path of packed) {
  if (!archivedFiles.get(path).equals(readFileSync(resolve(root, path)))) {
    staleFiles.push(path)
  }
}
assert.deepEqual(
  staleFiles,
  [],
  `Tracked tarball ${expectedTarball} differs from workspace files: ${staleFiles.join(', ')}. Run npm run pack:release.`,
)

console.log(`PASS: ${packed.size} packed files include all ${REQUIRED_FILES.length} required paths, and ${expectedTarball} matches workspace bytes`)
