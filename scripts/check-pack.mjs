/**
 * Assert the published tarball contains every file the plugin needs at runtime,
 * for its docs and for its third-party notices. Runs as `npm run check:pack`
 * locally and in CI; `--ignore-scripts` keeps the assertion from re-running the
 * `prepack` build it is meant to guard.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

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

const args = ['pack', '--dry-run', '--json', '--ignore-scripts']
// npm's own CLI path is the most portable invocation under `npm run`; the
// fallback covers direct `node scripts/check-pack.mjs` on every platform.
const npmExecPath = process.env.npm_execpath
const output = npmExecPath
  ? execFileSync(process.execPath, [npmExecPath, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  : execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' })

const parsed = JSON.parse(output)
const entry = Array.isArray(parsed) ? parsed[0] : parsed[Object.keys(parsed)[0]]
assert.ok(entry && typeof entry === 'object' && Array.isArray(entry.files), 'npm pack did not report a package entry')
const packed = new Set(entry.files.map(file => typeof file === 'string' ? file : file.path))
const missing = REQUIRED_FILES.filter(path => !packed.has(path))
assert.deepEqual(missing, [], `Tarball is missing required files: ${missing.join(', ')}`)
if (typeof entry.entryCount === 'number') assert.equal(packed.size, entry.entryCount, 'npm pack entry count does not match its file list')
console.log(`PASS: ${packed.size} packed files include all ${REQUIRED_FILES.length} required paths`)
