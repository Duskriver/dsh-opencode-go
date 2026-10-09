/** Install prebuilt Git and npm artifacts, including a fresh pnpm profile with no approvals. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { appendFile, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { npm, run } from './test-process.mjs'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const { devDependencies: { typescript } } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const consumerDevDependencies = { typescript }
const requested = process.argv.slice(2)
const managers = requested.length ? [...new Set(requested)] : ['npm', 'pnpm']
for (const manager of managers) {
  if (!['npm', 'pnpm'].includes(manager)) throw new Error(`Unknown package manager: ${manager}. Use npm or pnpm.`)
}
const timings = []
async function measure(phase, action) {
  const start = performance.now()
  let status = 'failed'
  console.log(`\n[install] ${phase}: started`)
  try {
    const result = await action()
    status = 'passed'
    return result
  } finally {
    const seconds = ((performance.now() - start) / 1000).toFixed(1)
    timings.push({ phase, seconds, status })
    console.log(`[install] ${phase}: ${status} (${seconds}s)`)
  }
}

const start = performance.now()
// Keep CI consumers outside the checkout, on the runner's temporary volume.
const scratch = await realpath(await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'dsh-git-install-')))
console.log(`[install] Node ${process.version} on ${process.platform}; managers: ${managers.join(', ')}`)
try {
  const { gitURL, tarball } = await measure('Prepare prebuilt artifacts', async () => {
    const source = join(scratch, 'source')
    await mkdir(source)
    const { stdout } = await exec('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root })
    for (const path of new Set(stdout.split('\0').filter(Boolean))) {
      if (['tests/', 'src/', 'scripts/'].some(prefix => path.startsWith(prefix))) continue
      const destination = join(source, path)
      await mkdir(dirname(destination), { recursive: true })
      try { await copyFile(join(root, path), destination) }
      catch (error) { if (error.code !== 'ENOENT') throw error } // tracked deletions
    }
    await exec('git', ['init', '--quiet', source])
    await exec('git', ['add', '.'], { cwd: source })
    const hooks = join(scratch, 'empty-hooks')
    await mkdir(hooks)
    await exec('git', ['-c', 'user.name=Install fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', `core.hooksPath=${hooks}`, 'commit', '--no-gpg-sign', '--quiet', '-m', 'Installation fixture'], { cwd: source })
    const { stdout: revision } = await exec('git', ['rev-parse', 'HEAD'], { cwd: source })
    const gitURL = `git+${pathToFileURL(source).href}#${revision.trim()}`
    // The source fixture has no build script files. Packing it must use lib/ as-is.
    await npm(['pack', '--ignore-scripts', '--pack-destination', scratch], source)
    const [filename] = (await readdir(scratch)).filter(name => name.endsWith('.tgz'))
    return { gitURL, tarball: join(scratch, filename) }
  })
  for (const manager of managers) {
    console.log(`\nChecking ${manager} Git installation from prebuilt artifacts`)
    const consumer = join(scratch, manager)
    await mkdir(consumer)
    if (manager === 'npm') {
      // Preserve another plugin's older peer SDK. Its own install hooks are
      // unrelated to our fresh-profile check, so keep it in this npm consumer.
      await mkdir(join(consumer, 'pi-ai-peer-probe'))
      await writeFile(join(consumer, 'pi-ai-peer-probe/package.json'), JSON.stringify({
        name: 'pi-ai-peer-probe', version: '1.0.0', type: 'module', exports: './index.js',
        peerDependencies: { '@earendil-works/pi-ai': '0.82.1 || 0.85.1 || 0.87.1' },
      }))
      await writeFile(join(consumer, 'pi-ai-peer-probe/index.js'), 'export * from "@earendil-works/pi-ai";\n')
      await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'install-test-npm', private: true,
        devDependencies: consumerDevDependencies,
        dependencies: { '@earendil-works/pi-ai': '0.85.1', 'pi-ai-peer-probe': 'file:./pi-ai-peer-probe',
          openai: '6.40.0', '@anthropic-ai/sdk': '0.124.0' },
      }))
      await measure('npm Git installation', () => npm(['install', '--no-audit', '--no-fund', gitURL], consumer))
    } else {
      await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'install-test-pnpm', private: true,
        devDependencies: consumerDevDependencies }))
      // No allowBuilds, cached side effects, or global trust configuration.
      // Pin the same pnpm generation used by the issue #43 reporter.
      await measure('pnpm Git installation', () => npm([
        'exec', '--yes', '--package=pnpm@11.7.0', '--', 'pnpm', 'add',
        '--config.strict-dep-builds=true', '--store-dir', join(scratch, 'git-store'), gitURL,
      ], consumer, { env: { ...process.env, XDG_CONFIG_HOME: join(scratch, 'config') } }))
    }
    await copyFile(join(root, 'tests/fixtures/installation.mjs'), join(consumer, 'installation.mjs'))
    await measure(`${manager} artifact verification`, () => run(process.execPath,
      ['installation.mjs', ...manager === 'npm' ? ['legacy-peer'] : []], { cwd: consumer }))
    await checkConsumerTypes(consumer, manager)
    if (manager === 'pnpm') {
      const packedConsumer = join(scratch, 'pnpm-packed')
      await mkdir(packedConsumer)
      await writeFile(join(packedConsumer, 'package.json'), JSON.stringify({ name: 'install-test-packed', private: true,
        devDependencies: consumerDevDependencies }))
      await measure('pnpm packed npm installation', () => npm([
        'exec', '--yes', '--package=pnpm@11.7.0', '--', 'pnpm', 'add',
        '--config.strict-dep-builds=true', '--store-dir', join(scratch, 'packed-store'), tarball,
      ], packedConsumer, { env: { ...process.env, XDG_CONFIG_HOME: join(scratch, 'packed-config') } }))
      await copyFile(join(root, 'tests/fixtures/installation.mjs'), join(packedConsumer, 'installation.mjs'))
      await measure('pnpm packed artifact verification', () => run(process.execPath, ['installation.mjs'], { cwd: packedConsumer }))
      await checkConsumerTypes(packedConsumer, 'pnpm packed')
    }
  }
  console.log(`\nPASS: ${managers.join(' and ')} installation without source builds`
    + (managers.includes('pnpm') ? '; fresh pnpm needs no build approvals' : '; existing peer SDK preserved'))
} finally {
  try {
    await measure('Clean temporary consumers', () => rm(scratch, { recursive: true, force: true }))
  } finally {
    const total = ((performance.now() - start) / 1000).toFixed(1)
    console.log(`[install] Total: ${total}s`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, [
        `## Prebuilt installation: ${managers.join(', ')}`, '',
        '| Phase | Seconds | Result |', '| --- | ---: | --- |',
        ...timings.map(({ phase, seconds, status }) => `| ${phase} | ${seconds} | ${status} |`),
        '', `Total: ${total}s.`, '',
      ].join('\n'))
    }
  }
}

async function checkConsumerTypes(consumer, label) {
  await writeFile(join(consumer, 'consumer.mts'), [
    'import { OpencodeGoCatalog } from "dsh-opencode-go";',
    'declare const catalog: OpencodeGoCatalog;',
    'const snapshot = await catalog.snapshot();',
    'const model = snapshot.models.values().next().value;',
    'if (model) { const id: string = model.id; const context: number = model.contextWindow; void [id, context]; }',
    // This would pass silently if missing private SDK declarations became any.
    '// @ts-expect-error Model.id is a string',
    'const invalid: number = model!.id;',
    'void invalid;', '',
  ].join('\n'))
  await measure(`${label} public types`, () => run(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'),
    '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
    '--target', 'ES2024', 'consumer.mts',
  ], { cwd: consumer }))
}
