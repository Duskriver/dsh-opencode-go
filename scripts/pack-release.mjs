/**
 * Rebuild check, remove stale root release tarballs, and pack the single tracked
 * `<name>-<version>.tgz` archive at the repository root.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const expectedTarball = `${pkg.name}-${pkg.version}.tgz`

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath) {
    return execFileSync(process.execPath, [npmExecPath, ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  }
  return execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  })
}

execFileSync(process.execPath, [resolve(root, 'scripts/build.mjs'), '--check'], {
  cwd: root,
  stdio: 'inherit',
})

const tarballPattern = new RegExp(`^${pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-.*\\.tgz$`)
for (const entry of readdirSync(root)) {
  if (tarballPattern.test(entry)) {
    rmSync(resolve(root, entry), { force: true })
  }
}

const output = runNpm(['pack', '--ignore-scripts', '--json'])
const parsed = JSON.parse(output)
const entry = Array.isArray(parsed) ? parsed[0] : parsed[Object.keys(parsed)[0]]
assert.equal(entry?.filename, expectedTarball, `Expected ${expectedTarball}, got ${entry?.filename}`)

execFileSync(process.execPath, [resolve(root, 'scripts/check-pack.mjs')], {
  cwd: root,
  stdio: 'inherit',
})

const bytes = statSync(resolve(root, expectedTarball)).size
console.log(`PASS: packed ${expectedTarball} (${(bytes / 1024).toFixed(1)} kB)`)
