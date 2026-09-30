/** Load the installed client with this consumer's real React and DSH modules. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { mock } from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { JSDOM } from 'jsdom'
import { transform } from 'lightningcss'

const host = process.argv[2]
const modern = host.startsWith('v017') || host.startsWith('v020')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
const { window } = dom
Object.assign(globalThis, { window, document: window.document, getComputedStyle: window.getComputedStyle })
// Node has no CSS loader. Transform host styles as the browser toolchain does;
// all JavaScript packages still resolve normally within this isolated consumer.
registerHooks({ load(url, context, next) {
  if (!url.endsWith('.css')) return next(url, context)
  const { code, exports } = transform({ filename: fileURLToPath(url), code: readFileSync(new URL(url)), cssModules: url.endsWith('.module.css') })
  const style = document.createElement('style')
  style.textContent = code.toString()
  document.head.appendChild(style)
  const classes = Object.fromEntries(Object.entries(exports ?? {}).map(([key, value]) => [key,
    [value.name, ...value.composes.map(item => item.name)].join(' '),
  ]))
  return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true }
} })
const React = await import('react')
const jsx = await import('react/jsx-runtime')
const store = await import('@deepseek-ai/dsh-client-store')
const primitives = await import('@deepseek-ai/dsh-client-ui-primitives')
const { renderToStaticMarkup } = await import('react-dom/server')
const table = new Map([
  ['react', React], ['react/jsx-runtime', jsx],
  ['@deepseek-ai/dsh-client-store', store],
  ['@deepseek-ai/dsh-client-ui-primitives', primitives],
])
let registration
const effects = []
const listeners = new Set()
try {
  runInNewContext(await readFile(new URL('../node_modules/dsh-opencode-go/lib/client.js', import.meta.url), 'utf8'), {
    document, window: { __ModuleLoader__: { load: entry => { registration = entry } } },
  })
  assert.equal(registration?.id, 'dsh-opencode-go')
  const client = registration.factory(id => {
    assert.ok(table.has(id), `Unprovided module: ${id}`)
    return table.get(id)
  })
  const snapshot = { status: 'ready', value: {}, base: {}, user: {}, writable: true, mode: 'host' }
  const scope = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    set: async () => {}, mutate: async () => {}, unset: async () => {},
  }
  const slots = mock.fn(() => () => {})
  const getForm = mock.fn(() => scope)
  const bindScope = mock.fn(() => scope)
  const ctx = {
    inject: (services, callback) => {
      if (services.includes(modern ? 'configForms' : 'settingsScope')) callback({
        ...ctx,
        remote: new Proxy(ctx.remote, { get(target, key) {
          if (key === 'opencodeGoModels') assert.ok(services.includes('remote.opencodeGoModels'), 'catalog service must be injected')
          return target[key]
        } }),
      })
    },
    get: () => ({ get: getForm }),
    effect: install => { effects.push(install()) },
    locale: { getLocale: () => ({ active: 'en' }), register: () => () => {}, bind: () => key => key },
    settingsScope: { bind: bindScope },
    remote: {
      $mount: async () => () => {}, $on: () => () => {},
      opencodeGoModels: { read: async () => ({ ok: true, value: { models: [], stale: false } }) },
      credentials: { describe: async () => ({ ok: true, value: {} }) },
    },
    slots: { inject: (_name, install) => install(), register: slots },
  }
  client.apply(ctx)
  await Promise.resolve()
  if (modern) {
    // Calls originate in the VM, whose arrays have a different prototype.
    assert.equal(getForm.mock.calls[0]?.arguments.length, 1)
    assert.equal(getForm.mock.calls[0]?.arguments[0], 'opencode-go')
    assert.equal(bindScope.mock.callCount(), 0)
  } else {
    assert.equal(bindScope.mock.calls[0]?.arguments[0].namespace, 'llm-opencode-go')
    assert.equal(getForm.mock.callCount(), 0)
  }
  const [options, Component] = slots.mock.calls[0].arguments
  assert.equal(options.id, 'opencode-go')
  assert.equal(options.name, 'settings.section')
  assert.equal(typeof Component, 'function')
  const face = options.inject()
  face.loadModels()
  const deadline = Date.now() + 2_000
  while (face.hooks.opencodeGo.getSnapshot().models.status !== 'ready' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.equal(face.hooks.opencodeGo.getSnapshot().models.status, 'ready')
  const markup = renderToStaticMarkup(React.createElement(Component, {
    ...face, useOpencodeGo: () => face.hooks.opencodeGo.getSnapshot(),
  }))
  assert.match(markup, /type="password"/)
  document.body.innerHTML = markup
  const advanced = document.querySelector('[aria-controls="opencode-go-advanced"]')
  assert.ok(advanced)
  assert.equal(getComputedStyle(advanced).display, 'flex')
  assert.equal(getComputedStyle(advanced).cursor, 'pointer')
  const pluginStyles = document.querySelector('style[data-plugin="dsh-opencode-go"]')
  assert.ok(pluginStyles)
  // The row highlight and the model-area split are pure CSS, so the shape of the
  // distributed stylesheet is the only thing a DOM-level check can hold to: hover
  // must cover the same whole row as the selection, and the parameter card must
  // take the larger share of the split.
  const pluginCss = pluginStyles.textContent
  assert.match(pluginCss, /\.\w*modelRow:hover:not\(\.\w*modelRowSelected\)\{[^}]*background/)
  assert.doesNotMatch(pluginCss, /\.\w*modelChoice:hover\{[^}]*background/)
  assert.match(pluginCss, /\.\w*modelRowSelected\{[^}]*background:var\(--dsw-alias-bg-layer-3\)/)
  assert.match(pluginCss, /grid-template-columns:minmax\(0,45fr\) minmax\(0,55fr\)/)
  // The model card grows into the page's leftover height, and it must never
  // shrink: a page that needs more room than it has scrolls, while a card
  // allowed to compress spills its footer over the card below it.
  assert.match(pluginCss, /\.\w*cardModels\{[^}]*flex:1 0 auto/)
  // It carries no ceiling of its own: the listing's diagnostics are part of its
  // height, so a clamp below that spills the list and the footer over the card
  // below. Its notices sit outside the fold, and an empty notice block — the
  // healthy, folded card — takes no room at all.
  assert.doesNotMatch(pluginCss, /\.\w*cardModels\{[^}]*max-height/)
  assert.match(pluginCss, /\.\w*cardNotes:empty\{display:none\}/)
  // The override tally closes the card on a ruled footer row of its own.
  assert.match(pluginCss, /\.\w*limitsFoot\{[^}]*border-top/)
  for (const dispose of effects.splice(0).reverse()) (await dispose)()
  assert.equal(listeners.size, 0, 'client cleanup releases settings subscriptions')
  console.log(`PASS: client compatibility (${host}): module table, settings, catalog injection, rendering, CSS, cleanup`)
} finally {
  for (const dispose of effects.reverse()) (await dispose)()
  dom.window.close()
}
