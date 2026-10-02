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
Object.assign(globalThis, { window, document: window.document, getComputedStyle: window.getComputedStyle,
  IS_REACT_ACT_ENVIRONMENT: true })
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
const { createRoot } = await import('react-dom/client')
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
  // The real Host scope is a class instance whose methods read their own state;
  // prototype methods must use this too, or they still hide detached calls.
  class CompatibilityScope {
    constructor(snapshot, listeners) {
      this.snapshot = snapshot
      this.listeners = listeners
    }
    getSnapshot() { return this.snapshot }
    subscribe(listener) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
    async set() {}
    async unset() {}
    async mutate() {}
  }
  const scope = new CompatibilityScope(snapshot, listeners)
  const slots = mock.fn(() => () => {})
  const getForm = mock.fn(() => scope)
  const bindScope = mock.fn(() => scope)
  const directory = store.createSnapshotStore({
    current: { provider: 'deepseek', model: 'deepseek-chat' },
    routable: true, groups: [], failures: [], status: 'ready', error: null,
  })
  const ctx = {
    inject: (services, callback) => {
      if (services.includes(modern ? 'configForms' : 'settingsScope')
        || services.includes('modelDirectories') || services.includes('remote.opencodeGoUsage')) callback({
        ...ctx,
        remote: new Proxy(ctx.remote, { get(target, key) {
          if (key === 'opencodeGoModels') assert.ok(services.includes('remote.opencodeGoModels'), 'catalog service must be injected')
          if (key === 'opencodeGoUsage') assert.ok(services.includes('remote.opencodeGoUsage'), 'usage service must be injected')
          return target[key]
        } }),
      })
    },
    get: () => ({ get: getForm }),
    effect: install => { effects.push(install()) },
    locale: { getLocale: () => ({ active: 'en' }), register: () => () => {}, bind: () => key => key },
    settingsScope: { bind: bindScope },
    modelDirectories: { directoryFor: () => ({ store: directory }) },
    remote: {
      $mount: async () => () => {}, $on: () => () => {},
      opencodeGoModels: { read: async () => ({ ok: true, value: { models: [], stale: false } }) },
      opencodeGoUsage: { read: async () => ({ ok: true, value: {} }) },
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
  const [usageOptions, UsageComponent] = slots.mock.calls.find(call => call.arguments[0].id === 'opencode-go-usage').arguments
  const usageProps = usageOptions.inject('fixture-session')
  assert.equal(usageProps.settings, scope, 'usage pill follows the same settings scope as the advanced form')
  const usageMarkup = () => renderToStaticMarkup(React.createElement(UsageComponent, usageProps))
  assert.equal(usageMarkup(), '', 'auto hides usage on other providers')
  snapshot.value = { usageDisplay: 'always' }
  assert.match(usageMarkup(), /aria-haspopup="dialog"/, 'always shows the pill on other providers')
  assert.doesNotMatch(usageMarkup(), /role="dialog"/, 'the usage panel starts collapsed')
  snapshot.value = { usageDisplay: 'always', enabled: false }
  assert.equal(usageMarkup(), '', 'disabled plugins hide even an always-visible pill')
  snapshot.value = { usageDisplay: 'off' }
  directory.set({ ...directory.getSnapshot(), current: { provider: 'dsh-opencode-go', model: 'compat-model' } })
  assert.equal(usageMarkup(), '', 'off hides usage even on this plugin provider')
  snapshot.value = {}
  assert.match(usageMarkup(), /aria-haspopup="dialog"/, 'auto retains usage on this plugin provider')
  directory.set({ ...directory.getSnapshot(), current: { provider: 'opencode-go', model: 'compat-model' } })
  assert.equal(usageMarkup(), '', 'auto keeps the built-in provider separate')
  // SSR checks the snapshot reader; a client mount also exercises subscribe.
  // Auto stays hidden on this provider, so this check starts no usage poller.
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const beforeMount = listeners.size
  try {
    await React.act(async () => { root.render(React.createElement(UsageComponent, usageProps)) })
    assert.equal(container.innerHTML, '', 'the mounted pill stays hidden on the built-in provider')
    assert.equal(listeners.size, beforeMount + 1, 'the mounted pill subscribes through the scope receiver')
  } finally {
    await React.act(async () => { root.unmount() })
    container.remove()
  }
  assert.equal(listeners.size, beforeMount, 'unmount releases the pill settings subscription')
  const [options, Component] = slots.mock.calls.find(call => call.arguments[0].id === 'opencode-go').arguments
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
  console.log(`PASS: client compatibility (${host}): module table, settings, catalog injection, SSR/client rendering, CSS, cleanup`)
} finally {
  for (const dispose of effects.reverse()) (await dispose)()
  dom.window.close()
}
