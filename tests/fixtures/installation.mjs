/** Run from a consumer, so module resolution cannot fall back to the checkout. */
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(new URL('./node_modules/dsh-opencode-go/package.json', import.meta.url), 'utf8'))
// These keys make npm/pnpm prepare Git sources or execute dependency hooks.
for (const name of ['build', 'prepare', 'prepack', 'prepublish', 'preinstall', 'install', 'postinstall']) {
  assert.ok(!manifest.scripts?.[name], `Git consumers must not need the ${name} script`)
}
for (const path of [manifest.main, manifest.types, 'lib/client.js', 'lib/types/client/index.d.ts', 'lib/build-info.json']) {
  await access(new URL(`./node_modules/dsh-opencode-go/${path}`, import.meta.url))
}
const plugin = await import('dsh-opencode-go')
assert.equal(typeof plugin.apply, 'function')
assert.equal(typeof plugin.Config, 'function')
console.log('PASS: installed host/client entrypoints, declarations, build metadata and ESM loading')
