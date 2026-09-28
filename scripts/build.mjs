/** Build Node ESM and the DSH browser module factory using installed dependencies. */
import { build } from 'esbuild'
import { transform } from 'lightningcss'
import { readFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Usage: node scripts/build.mjs [--check]')
}
if (args[0] === '--check') {
  const scratch = await mkdtemp(join(tmpdir(), 'dsh-dist-check-'))
  try {
    await compile(scratch)
    const [shipped, rebuilt] = await Promise.all([readArtifacts('lib'), readArtifacts(scratch)])
    const different = [...new Set([...shipped.keys(), ...rebuilt.keys()])].sort()
      .filter(path => !shipped.has(path) || !rebuilt.has(path) || !shipped.get(path).equals(rebuilt.get(path)))
    if (different.length) {
      throw new Error(`Committed build differs from source: ${different.join(', ')}. Run npm run compile and commit lib/ with the source changes.`)
    }
    console.log(`PASS: all ${shipped.size} shipped build files match the source`)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
} else {
  await compile('lib')
}

async function readArtifacts(directory, prefix = '') {
  const files = new Map()
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) }
  catch (error) {
    if (error.code === 'ENOENT' && !prefix) return files
    throw error
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    const name = `${prefix}${entry.name}`
    if (entry.isDirectory()) {
      for (const [key, value] of await readArtifacts(path, `${name}/`)) files.set(key, value)
    } else {
      files.set(name, await readFile(path))
    }
  }
  return files
}

async function compile(output) {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  for (const face of ['host', 'client']) {
    execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `tsconfig.${face}.json`, '--outDir', join(output, 'types')], { stdio: 'inherit' })
  }
  await build({ entryPoints: ['src/index.ts'], outfile: join(output, 'index.js'), bundle: true, packages: 'external', format: 'esm', platform: 'node', target: 'node22' })

  // These identities are supplied by the DSH Web module table.
  const external = ['react', 'react/jsx-runtime', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives']
  const cssPlugin = {
    name: 'plugin-css-modules',
    setup(build) {
      build.onResolve({ filter: /\.module\.css$/ }, args => ({
        path: relative(process.cwd(), resolve(args.resolveDir, args.path)).split(sep).join('/'),
        namespace: 'plugin-css',
      }))
      build.onLoad({ filter: /.*/, namespace: 'plugin-css' }, async args => {
        const result = transform({ filename: args.path, code: await readFile(args.path), cssModules: { pattern: '[hash]_[local]' }, minify: true })
        const classes = Object.fromEntries(Object.entries(result.exports).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => [key,
          [value.name, ...value.composes.map(item => {
            if (item.type === 'dependency') throw new Error(`External CSS composition is unsupported: ${item.name}`)
            return item.name
          })].join(' '),
        ]))
        return { loader: 'js', contents: `const id = ${JSON.stringify(pkg.name + '/' + basename(args.path))}; if (!document.querySelector('style[data-plugin-css=' + JSON.stringify(id) + ']')) { const style = document.createElement('style'); style.dataset.plugin = ${JSON.stringify(pkg.name)}; style.dataset.pluginCss = id; style.textContent = ${JSON.stringify(result.code.toString())}; document.head.appendChild(style); } export default ${JSON.stringify(classes)};` }
      })
    },
  }
  const result = await build({
    entryPoints: ['src/client/index.ts'], outfile: join(output, 'client.js'), bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', jsx: 'automatic', external,
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [cssPlugin], metafile: true,
    banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
    footer: { js: 'return module.exports; } });' },
  })
  for (const output of Object.values(result.metafile.outputs)) {
    for (const item of output.imports) {
      if (item.external && !external.includes(item.path)) throw new Error(`Unsupported DSH client external: ${item.path}`)
    }
  }
  await writeFile(join(output, 'build-info.json'), JSON.stringify({ clientExternals: external }, null, 2) + '\n')
}
