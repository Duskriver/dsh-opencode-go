/** Build Node ESM and the DSH browser module factory using installed dependencies. */
import { build } from 'esbuild'
import { transform } from 'lightningcss'
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
await rm('lib', { recursive: true, force: true })
await mkdir('lib', { recursive: true })
for (const face of ['host', 'client']) {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `tsconfig.${face}.json`], { stdio: 'inherit' })
}
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, packages: 'external', format: 'esm', platform: 'node', target: 'node22' })

// These identities are supplied by the DSH Web module table.
const external = ['react', 'react/jsx-runtime', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives']
const cssPlugin = {
  name: 'plugin-css-modules',
  setup(build) {
    build.onResolve({ filter: /\.module\.css$/ }, args => ({ path: resolve(args.resolveDir, args.path), namespace: 'plugin-css' }))
    build.onLoad({ filter: /.*/, namespace: 'plugin-css' }, async args => {
      const result = transform({ filename: args.path, code: await readFile(args.path), cssModules: { pattern: '[hash]_[local]' }, minify: true })
      const classes = Object.fromEntries(Object.entries(result.exports).map(([key, value]) => [key, value.name]))
      return { loader: 'js', contents: `const id = ${JSON.stringify(pkg.name + '/' + basename(args.path))}; if (!document.querySelector('style[data-plugin-css=' + JSON.stringify(id) + ']')) { const style = document.createElement('style'); style.dataset.plugin = ${JSON.stringify(pkg.name)}; style.dataset.pluginCss = id; style.textContent = ${JSON.stringify(result.code.toString())}; document.head.appendChild(style); } export default ${JSON.stringify(classes)};` }
    })
  },
}
const result = await build({
  entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js', bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', jsx: 'automatic', external,
  define: { 'process.env.NODE_ENV': '"production"' }, plugins: [cssPlugin], metafile: true,
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
})
for (const output of Object.values(result.metafile.outputs)) {
  for (const item of output.imports) {
    if (item.external && !external.includes(item.path)) throw new Error(`Unsupported DSH client external: ${item.path}`)
  }
}
await writeFile('lib/build-info.json', JSON.stringify({ clientExternals: external }, null, 2) + '\n')
