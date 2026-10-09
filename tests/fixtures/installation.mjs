/** Run from a consumer, so module resolution cannot fall back to the checkout. */
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { findPackageJSON } from 'node:module'

const manifest = JSON.parse(await readFile(new URL('./node_modules/dsh-opencode-go/package.json', import.meta.url), 'utf8'))
// These keys make npm/pnpm prepare Git sources or execute dependency hooks.
for (const name of ['build', 'prepare', 'prepack', 'prepublish', 'preinstall', 'install', 'postinstall']) {
  assert.ok(!manifest.scripts?.[name], `Git consumers must not need the ${name} script`)
}
for (const path of [manifest.main, manifest.types, 'lib/client.js', 'lib/types/client/index.d.ts', 'lib/build-info.json', 'lib/types/sdk-types.d.ts', 'lib/vendor-licenses.txt']) {
  await access(new URL(`./node_modules/dsh-opencode-go/${path}`, import.meta.url))
}
const plugin = await import('dsh-opencode-go')
assert.equal(typeof plugin.apply, 'function')
assert.equal(typeof plugin.Config, 'function')
const build = JSON.parse(await readFile(new URL('./node_modules/dsh-opencode-go/lib/build-info.json', import.meta.url), 'utf8'))
assert.equal(build.sdkVersion, '1.1.0', 'the plugin bundles its normalized-transcript SDK')
for (const [name, expected] of [['openai', '7.19.0'], ['@anthropic-ai/sdk', '0.129.0']]) {
  const sdk = JSON.parse(await readFile(findPackageJSON(name, import.meta.resolve('dsh-opencode-go')), 'utf8'))
  assert.equal(sdk.version, expected, `the plugin must resolve its own ${name} transport version`)
}

assert.equal(manifest.dependencies['opencode-go-pi-ai'], undefined)
assert.equal(manifest.dependencies['@earendil-works/pi-ai'], undefined)
assert.throws(() => findPackageJSON('opencode-go-pi-ai', import.meta.resolve('dsh-opencode-go')), { code: 'ERR_MODULE_NOT_FOUND' })
const declarations = await readFile(new URL('./node_modules/dsh-opencode-go/lib/types/sdk-types.d.ts', import.meta.url), 'utf8')
assert.ok(!declarations.includes('opencode-go-pi-ai'), 'public types must not need the build-time SDK alias')
if (process.argv[2] === 'legacy-peer') {
  for (const [name, expected] of [['openai', '6.40.0'], ['@anthropic-ai/sdk', '0.124.0']]) {
    const sdk = JSON.parse(await readFile(findPackageJSON(name, import.meta.url), 'utf8'))
    assert.equal(sdk.version, expected, `installing the plugin must preserve the host's ${name}`)
  }

  const peerSdk = JSON.parse(await readFile(findPackageJSON('@earendil-works/pi-ai', import.meta.resolve('pi-ai-peer-probe')), 'utf8'))
  assert.equal(peerSdk.version, '0.85.1', 'installing the plugin must preserve another plugin\'s peer resolution')
  assert.equal(typeof (await import('pi-ai-peer-probe')).createProvider, 'function')
  assert.equal((await import('pi-ai-peer-probe')).normalizeContext, undefined)
} else {
  for (const name of ['@earendil-works/pi-ai', '@google/genai', 'protobufjs']) {
    assert.throws(() => findPackageJSON(name, import.meta.resolve('dsh-opencode-go')), { code: 'ERR_MODULE_NOT_FOUND' })
  }
  // pnpm may create a workspace file, but it must not add script approvals.
  try {
    const workspace = await readFile(new URL('./pnpm-workspace.yaml', import.meta.url), 'utf8')
    assert.ok(!/allowBuilds|onlyBuiltDependencies|ignoredBuiltDependencies/.test(workspace))
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
console.log('PASS: installed artifacts, ESM loading and bundled SDK without dependency build approvals')
