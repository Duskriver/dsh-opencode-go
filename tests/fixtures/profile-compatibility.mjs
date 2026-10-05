/** Real profile Loader/settings contracts, isolated from the legacy host packages. */
import assert from 'node:assert/strict'

const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const { default: Settings } = await import('@deepseek-ai/dsh-settings')
const ctx = new Context()
process.env.OPENCODE_GO_COMPAT_KEY = 'fixture-key'
globalThis.fetch = async (input) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === 'https://models.dev/api.json') return Response.json({
    'opencode-go': { npm: '@ai-sdk/openai-compatible', models: {
      'compat-model': { name: 'Compatibility fixture', reasoning: false, status: 'deprecated',
        modalities: { input: ['text'] }, limit: { context: 100000, output: 4096 } },
    } },
  })
  assert.equal(url, 'https://opencode.ai/zen/go/v1/models')
  return Response.json({ data: [{ id: 'compat-model' }] })
}
try {
  ctx.baseUrl = new URL('../package.json', import.meta.url).href
  await ctx.plugin(Loader)
  await ctx.loader.create({ name: '@deepseek-ai/dsh-llm' })
  const id = await ctx.loader.create({ id: 'opencode-go', name: 'dsh-opencode-go',
    config: { apiKeyEnv: 'OPENCODE_GO_COMPAT_KEY', legacyOption: true,
      showDeprecatedModels: true, visibleModelIds: ['compat-model'] } })
  await ctx.loader.await()
  const entry = ctx.loader.resolve(id)
  assert.ok(entry.fiber, 'plugin mounts')
  const fiber = entry.fiber
  // The settings service is real; this editor supplies an in-memory profile and
  // delegates updates to the real Loader, including validation and live refs.
  ctx.provide('profileContext', { home: '/nonexistent/opencode-go-compat' })
  ctx.provide('configEditor', {
    entries: () => [entry],
    configuration: () => [{ entry, inherited: {}, override: entry.options.config }],
    edit: async (_entry, change) => {
      const next = change(entry.options.config, {})
      const validated = fiber.ctx.waterfall(fiber, 'internal/config', next, () => next)
      await entry.update({ config: validated })
    },
  })
  await ctx.plugin(Settings)
  await ctx.loader.await()
  const view = () => ctx.settings.describe().find(row => row.ns === 'opencode-go')
  assert.ok(view(), 'OpenCode Go must be exposed in the new profile settings')
  assert.equal(view().autoGenerate, false, 'the custom page owns these settings')
  assert.equal(view().value.usageDisplay, 'auto', 'usage display keeps the previous default')
  assert.equal(view().value.proxyURL, '', 'proxy defaults to the host network path')
  for (const proxyURL of ['http://127.0.0.1:7890', 'https://127.0.0.1:7890', 'socks5://user:pass@127.0.0.1:1080']) {
    await ctx.settings.update('opencode-go', { proxyURL })
    assert.equal(view().value.proxyURL, proxyURL)
    assert.equal(entry.fiber, fiber, 'changing the proxy preserves the running plugin')
  }
  await assert.rejects(ctx.settings.update('opencode-go', { proxyURL: 'ftp://127.0.0.1:7890' }))
  assert.equal(view().value.proxyURL, 'socks5://user:pass@127.0.0.1:1080', 'invalid proxy writes leave the setting intact')
  await ctx.settings.update('opencode-go', { proxyURL: '' })
  assert.equal(view().value.proxyURL, '', 'blank disables the explicit proxy')
  await ctx.settings.mutate('opencode-go', [{ op: 'unset', path: ['proxyURL'] }])
  assert.equal(view().value.proxyURL, '', 'reset restores the default network path')
  for (const usageDisplay of ['always', 'off']) {
    await ctx.settings.update('opencode-go', { usageDisplay })
    assert.equal(view().value.usageDisplay, usageDisplay)
    assert.equal(entry.fiber, fiber, 'usage display changes preserve the running plugin')
  }
  await assert.rejects(ctx.settings.update('opencode-go', { usageDisplay: 'invalid' }))
  assert.equal(view().value.usageDisplay, 'off', 'invalid modes leave the saved setting intact')
  await ctx.settings.mutate('opencode-go', [{ op: 'unset', path: ['usageDisplay'] }])
  assert.equal(view().value.usageDisplay, 'auto', 'reset restores automatic usage display')
  process.env.OPENCODE_GO_BACKUP_COMPAT_KEY = 'backup-fixture-key'
  const accounts = [
    { id: 'primary', name: 'Primary', apiKeyEnv: 'OPENCODE_GO_COMPAT_KEY' },
    { id: 'backup', name: 'Backup', apiKeyEnv: 'OPENCODE_GO_BACKUP_COMPAT_KEY' },
  ]
  await ctx.settings.mutate('opencode-go', [
    { op: 'set', path: ['accounts'], value: accounts },
    { op: 'set', path: ['apiKeyEnv'], value: 'OPENCODE_GO_BACKUP_COMPAT_KEY' },
  ])
  assert.deepEqual(view().value.accounts, accounts, 'account metadata persists through real profile forms')
  assert.equal(view().value.apiKeyEnv, 'OPENCODE_GO_BACKUP_COMPAT_KEY')
  assert.equal(entry.fiber, fiber, 'account switching preserves the running plugin')
  await ctx.settings.update('opencode-go', { autoSwitch: true })
  assert.equal(view().value.autoSwitch, true)
  await assert.rejects(ctx.settings.update('opencode-go', { accounts: [accounts[0], accounts[0]] }))
  assert.deepEqual(view().value.accounts, accounts, 'duplicate account writes are refused')
  await ctx.settings.mutate('opencode-go', [
    { op: 'set', path: ['accounts'], value: [] },
    { op: 'set', path: ['apiKeyEnv'], value: 'OPENCODE_GO_COMPAT_KEY' },
    { op: 'set', path: ['autoSwitch'], value: false },
  ])
  assert.deepEqual(ctx.llm.listProviders(), [], 'removing every account withdraws the route')
  await ctx.settings.mutate('opencode-go', [{ op: 'unset', path: ['accounts'] }])
  assert.ok(ctx.llm.listProviders().some(row => row.id === 'dsh-opencode-go'), 'legacy credentials resume after resetting accounts')
  assert.equal(view().value.maxImages, undefined, 'image count has no default')
  await ctx.settings.update('opencode-go', { maxImages: 30 })
  assert.equal(view().value.maxImages, 30)
  assert.equal(entry.fiber, fiber, 'image count changes preserve the running plugin')
  await assert.rejects(ctx.settings.update('opencode-go', { maxImages: 1.5 }))
  assert.equal(view().value.maxImages, 30, 'invalid counts do not replace the saved cap')
  await ctx.settings.mutate('opencode-go', [{ op: 'unset', path: ['maxImages'] }])
  assert.equal(view().value.maxImages, undefined, 'clearing does not fall back to 30')
  assert.equal(entry.fiber, fiber, 'clearing the count preserves the running plugin')
  await ctx.settings.update('opencode-go', { enabled: false })
  assert.equal(entry.fiber, fiber, 'a settings write must preserve the running plugin')
  assert.equal(view().value.enabled, false)
  assert.deepEqual(ctx.llm.listProviders(), [])
  await ctx.settings.update('opencode-go', { enabled: true, refreshMinutes: 30 })
  assert.ok(ctx.llm.listProviders().some(row => row.id === 'dsh-opencode-go'))
  assert.equal(view().value.refreshMinutes, 30)
  assert.deepEqual(await ctx.llm.listModels('dsh-opencode-go'), [], 'legacy visibility fields do not override the deprecated default')
  let pickerUpdates = 0
  ctx.on('llm/adapters-updated', () => { pickerUpdates++ })
  await ctx.settings.update('opencode-go', { modelVisibility: { 'compat-model': true, missing: true } })
  assert.ok(pickerUpdates > 0, 'enabling a model notifies already open session pickers')
  assert.deepEqual((await ctx.llm.listModels('dsh-opencode-go')).map(model => model.id), ['compat-model'],
    'explicitly enabling a deprecated model does not manufacture unknown gateway models')
  assert.equal(view().value.modelVisibility['compat-model'], true)
  assert.equal(entry.fiber, fiber, 'enabling a model preserves the running plugin')
  pickerUpdates = 0
  await ctx.settings.update('opencode-go', { modelVisibility: { 'compat-model': false, missing: true } })
  assert.ok(pickerUpdates > 0, 'disabling a model notifies already open session pickers')
  assert.deepEqual(await ctx.llm.listModels('dsh-opencode-go'), [])
  assert.equal(view().value.modelVisibility['compat-model'], false)
  assert.equal(entry.fiber, fiber, 'disabling a model preserves the running plugin')
  const capacity = async () => (await ctx.llm.resolveModelInfo('dsh-opencode-go', 'compat-model')).context.contextWindow
  assert.equal(await capacity(), 100000)
  await ctx.settings.update('opencode-go', { modelLimits: { 'compat-model': { contextWindow: 50000, maxTokens: 1024 } } })
  assert.equal(entry.fiber, fiber, 'capacity changes must preserve the running plugin')
  assert.equal(await capacity(), 50000)
  assert.equal(view().value.modelLimits['compat-model'].maxTokens, 1024)
  await ctx.settings.update('opencode-go', { modelLimits: { 'compat-model': null } })
  assert.equal(await capacity(), 100000)
  assert.equal(entry.fiber, fiber, 'reset must preserve the running plugin')
  await assert.rejects(ctx.settings.update('opencode-go', { baseURL: 'not-a-url' }), /not a valid URL/)
  assert.equal(entry.fiber, fiber)
  assert.equal(entry.options.config.legacyOption, true, 'unknown profile fields survive live updates without breaking reads')
  assert.equal(entry.options.config.showDeprecatedModels, true, 'the legacy toggle remains an inert unknown profile field')
  assert.deepEqual(entry.options.config.visibleModelIds, ['compat-model'], 'the legacy selection remains an inert unknown profile field')
  console.log('PASS: profile settings, live updates, capacities, reset, route toggle, validation')
} finally {
  await ctx.fiber.dispose()
}
