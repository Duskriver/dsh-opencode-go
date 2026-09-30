/** Run from a consumer, so module resolution cannot fall back to the checkout. */
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { findPackageJSON } from 'node:module'

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
const sdk = JSON.parse(await readFile(findPackageJSON('opencode-go-pi-ai', import.meta.resolve('dsh-opencode-go')), 'utf8'))
assert.equal(sdk.version, '0.87.1', 'the plugin owns the normalized-transcript SDK')
assert.equal(manifest.dependencies['opencode-go-pi-ai'], 'npm:@earendil-works/pi-ai@0.87.1')
assert.equal(manifest.dependencies['@earendil-works/pi-ai'], undefined)
const peerSdk = JSON.parse(await readFile(findPackageJSON('@earendil-works/pi-ai', import.meta.resolve('pi-ai-peer-probe')), 'utf8'))
assert.equal(peerSdk.version, '0.85.1', 'installing the plugin must preserve another plugin\'s peer resolution')
assert.equal(typeof (await import('pi-ai-peer-probe')).createProvider, 'function')
assert.equal((await import('pi-ai-peer-probe')).normalizeContext, undefined)
console.log('PASS: installed artifacts, ESM loading, private SDK 0.87.1 and unchanged peer SDK 0.85.1')
