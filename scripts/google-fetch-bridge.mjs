/** Guarded Google transport binding and explicit Gemini backend selection. */
import { readFileSync } from 'node:fs'
import { findPackageJSON } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const sdk = fileURLToPath(import.meta.resolve('@google/genai'))
const adapter = fileURLToPath(import.meta.resolve('opencode-go-pi-ai/api/google-generative-ai'))
const bridge = fileURLToPath(new URL('../src/google-fetch.ts', import.meta.url))

/** Vite IDs use forward slashes on Windows, while Node returns native paths. */
export function matchesGoogleModuleId(id, filename) {
  const normalize = value => value.split('?')[0].replace(/\\/g, '/').replace(/^\/(?=[a-z]:\/)/i, '')
  return normalize(id) === normalize(filename)
}

function sdkSource() {
  const manifest = JSON.parse(readFileSync(findPackageJSON('@google/genai', import.meta.url), 'utf8'))
  if (manifest.version !== '2.21.0') throw new Error('Review the Google fetch bridge before upgrading @google/genai')
  const original = readFileSync(sdk, 'utf8')
  const call = 'response = await fetch(url, '
  if (original.split(call).length !== 2) throw new Error('The Google SDK HTTP call changed; review the fetch bridge')
  return `import { googleFetch as __opencodeGoogleFetch } from ${JSON.stringify(bridge)};\n`
    + original.replace(call, 'response = await __opencodeGoogleFetch(url, ')
}

function adapterSource() {
  const manifest = JSON.parse(readFileSync(findPackageJSON('opencode-go-pi-ai', import.meta.url), 'utf8'))
  if (manifest.version !== '1.2.0') throw new Error('Review the Google backend pin before upgrading pi-ai')
  const original = readFileSync(adapter, 'utf8')
  const constructor = 'return new GoogleGenAI({'
  if (original.split(constructor).length !== 2) throw new Error('The pi-ai Google client changed; review the backend pin')
  // Only this adapter targets the gateway's Gemini API. Other Google clients
  // retain their own Vertex/Enterprise flags and environment selection.
  return original.replace(constructor, `${constructor}\n        vertexai: false,`)
}

export function googleFetchEsbuildPlugin() {
  return {
    name: 'opencode-google-fetch',
    setup(build) {
      build.onLoad({ filter: /[/\\]@google[/\\]genai[/\\]dist[/\\]node[/\\]index\.mjs$/ }, args =>
        matchesGoogleModuleId(args.path, sdk) ? { contents: sdkSource(), loader: 'js', resolveDir: dirname(sdk) } : undefined)
      build.onLoad({ filter: /[/\\]api[/\\]google-generative-ai\.js$/ }, args =>
        matchesGoogleModuleId(args.path, adapter) ? { contents: adapterSource(), loader: 'js', resolveDir: dirname(adapter) } : undefined)
    },
  }
}

export function googleFetchVitePlugin() {
  return {
    name: 'opencode-google-fetch', enforce: 'pre',
    load(id) {
      if (matchesGoogleModuleId(id, sdk)) return sdkSource()
      if (matchesGoogleModuleId(id, adapter)) return adapterSource()
    },
  }
}
