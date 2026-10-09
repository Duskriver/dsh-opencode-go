/** Real profile Loader/settings contracts, isolated from the legacy host packages. */
import assert from 'node:assert/strict'

const { Context } = await import('@deepseek-ai/cordis')
const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader')
const { default: Settings } = await import('@deepseek-ai/dsh-settings')
const { createUserMessage } = await import('@deepseek-ai/dsh-llm')
const { CredentialProvider } = await import('@deepseek-ai/dsh-credentials')
const ctx = new Context()
const inferenceKeys = []
const usage = Object.fromEntries(['rolling', 'weekly', 'monthly'].map(key => [key,
  { status: 'ok', percent: 12, resetsAt: '2026-10-01T00:00:00Z' }]))
process.env.OPENCODE_GO_COMPAT_KEY = 'fixture-key'
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url === 'https://models.dev/api.json') return Response.json({
    'opencode-go': { npm: '@ai-sdk/openai-compatible', models: {
      'compat-model': { name: 'Compatibility fixture', reasoning: false, status: 'deprecated',
        modalities: { input: ['text'] }, limit: { context: 100000, output: 4096 } },
    } },
  })
  const authorization = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('authorization')
  if (url === 'https://opencode.ai/zen/go/v1/usage') {
    assert.equal(authorization, 'Bearer backup-fixture-key', 'usage follows the adopted account')
    return Response.json({ usage })
  }
  if (url === 'https://opencode.ai/zen/go/v1/chat/completions') {
    inferenceKeys.push(authorization)
    if (authorization === 'Bearer fixture-key') {
      return Response.json({ error: { message: 'Monthly usage limit exceeded' } }, { status: 429 })
    }
    assert.equal(authorization, 'Bearer backup-fixture-key')
    const events = [
      { choices: [{ delta: { role: 'assistant', content: 'compat-ok' }, index: 0, finish_reason: null }] },
      { choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1 } },
    ]
    return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n',
      { headers: { 'content-type': 'text/event-stream' } })
  }
  assert.equal(url, 'https://opencode.ai/zen/go/v1/models')
  return Response.json({ data: [{ id: 'compat-model' }] })
}
try {
  ctx.baseUrl = new URL('../package.json', import.meta.url).href
  await ctx.plugin(Loader)
  await ctx.plugin((await import('@deepseek-ai/dsh-typert-registry')).default)
  await ctx.plugin((await import('@deepseek-ai/dsh-api-gateway')).default)
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
  assert.deepEqual(view().value.protocolOverrides, {}, 'protocol routing defaults to the catalog')
  const protocolOverride = { 'deepseek-v4.1-flash': 'openai-responses' }
  await ctx.settings.update('opencode-go', { protocolOverrides: protocolOverride })
  assert.deepEqual(view().value.protocolOverrides, protocolOverride)
  await assert.rejects(ctx.settings.update('opencode-go', { protocolOverrides: { 'kimi-k3': 'openai-responses' } }))
  await assert.rejects(ctx.settings.update('opencode-go', { protocolOverrides: { 'deepseek-v4.1-flash': 'anthropic-messages' } }))
  assert.deepEqual(view().value.protocolOverrides, protocolOverride, 'invalid protocol writes leave the saved setting intact')
  await ctx.settings.update('opencode-go', { protocolOverrides: { 'deepseek-v4.1-flash': null } })
  assert.deepEqual(view().value.protocolOverrides, { 'deepseek-v4.1-flash': null }, 'null explicitly restores catalog routing')
  await ctx.settings.mutate('opencode-go', [{ op: 'unset', path: ['protocolOverrides'] }])
  assert.deepEqual(view().value.protocolOverrides, {})
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
  await ctx.settings.update('opencode-go', { apiKeyEnv: 'OPENCODE_GO_COMPAT_KEY' })
  const beforeAdoption = view().revision
  // Observe the real write promise so assertions wait for persistence without
  // sleeping or replacing the SettingsForms implementation.
  const mutate = ctx.settings.mutate
  const adoptionWrites = []
  ctx.settings.mutate = function (...args) {
    const pending = mutate.apply(this, args)
    adoptionWrites.push(pending)
    return pending
  }
  try {
    const chunks = []
    for await (const chunk of ctx.llm.stream({ provider: 'dsh-opencode-go', model: 'compat-model',
      messages: [createUserMessage({ content: [{ type: 'text', text: 'hello' }],
        source: { kind: 'plugin', plugin: 'profile-compat-test' } })],
    })) chunks.push(chunk)
    assert.equal(chunks.at(-1).reason.kind, 'stop')
    assert.ok(chunks.some(chunk => chunk.type === 'text-delta' && chunk.text === 'compat-ok'))
    assert.deepEqual(inferenceKeys, ['Bearer fixture-key', 'Bearer backup-fixture-key'])
    assert.equal(adoptionWrites.length, 1, 'fallback performs one real profile mutation')
    await Promise.all(adoptionWrites)
    assert.equal(view().value.apiKeyEnv, 'OPENCODE_GO_BACKUP_COMPAT_KEY', 'fallback adopts the serving account')
    assert.deepEqual(view().value.accounts, accounts, 'adoption preserves the account order')
    assert.equal(entry.fiber, fiber, 'adoption preserves the running plugin')
    const revision = view().revision
    assert.equal(revision, beforeAdoption + 1, 'adoption changes exactly one profile revision')
    let notice
    for (let read = 0; read < 3; read++) {
      assert.equal(view().revision, revision, 'repeated describe does not advance the profile revision')
      const reading = await ctx.typertGateway.invoke({ namespace: 'opencodeGoUsage', method: 'read', args: {} })
      assert.deepEqual(reading.rolling, usage.rolling)
      assert.equal(reading.lastSwitch?.fromRef, 'OPENCODE_GO_COMPAT_KEY')
      assert.equal(reading.lastSwitch?.toRef, 'OPENCODE_GO_BACKUP_COMPAT_KEY')
      assert.equal(reading.lastSwitch?.reason, 'quota')
      if (notice) assert.deepEqual(reading.lastSwitch, notice, 'describe and usage reads preserve the adoption notice')
      notice = reading.lastSwitch
    }
  } finally { ctx.settings.mutate = mutate }
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
  // Recovery must use the same real SettingsForms write/revision contract as
  // adoption, including hosts that expose live profile refs instead of sections.
  const recovered = { id: 'c'.repeat(32), name: 'Recovered', apiKeyEnv: 'DSH_OPENCODE_GO_ACCOUNT_' + 'C'.repeat(32) }
  const values = new Map([['OPENCODE_GO_COMPAT_KEY', 'fixture-key'],
    ['OPENCODE_GO_BACKUP_COMPAT_KEY', 'backup-fixture-key'], [recovered.apiKeyEnv, 'recovered-fixture-key']])
  class FixtureCredentials extends CredentialProvider {
    constructor(scope) { super(scope) }
    async resolve(ref) { return values.has(ref) ? { value: values.get(ref), source: 'file' } : undefined }
    async describe(ref) { return { configured: values.has(ref), writable: true, source: 'file' } }
    async set(ref, value) { values.set(ref, value); this.notifyUpdated(ref) }
    async unset(ref) { values.delete(ref); this.notifyUpdated(ref) }
  }
  await ctx.plugin(FixtureCredentials)
  await ctx.loader.await()
  const waitForRecovery = async () => {
    for (let attempt = 0; attempt < 100 && view().value.accountOperations.length; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    assert.deepEqual(view().value.accountOperations, [], 'profile recovery clears committed intentions')
  }
  await ctx.settings.update('opencode-go', { accountOperations: [{ id: recovered.id, kind: 'add', account: recovered,
    previousRef: view().value.apiKeyEnv, select: false }] })
  await waitForRecovery()
  assert.ok(view().value.accounts.some(account => account.id === recovered.id), 'recovery attaches the already committed key')
  await ctx.settings.update('opencode-go', { accountOperations: [{ id: 'd'.repeat(32), kind: 'remove', account: recovered }] })
  await waitForRecovery()
  assert.ok(!view().value.accounts.some(account => account.id === recovered.id), 'recovery removes stale account metadata')
  assert.ok(!values.has(recovered.apiKeyEnv), 'recovery removes only the generated credential')
  assert.equal(entry.fiber, fiber, 'recovery preserves the running plugin')
  const execute = command => ctx.typertGateway.invoke({ namespace: 'opencodeGoAccounts', method: 'execute', args: { command } })
  assert.equal(await execute({ kind: 'add', id: recovered.id, name: 'RPC account', key: 'rpc-fixture-key' }), 'applied')
  assert.equal(await execute({ kind: 'add', id: recovered.id, name: 'RPC account', key: 'rpc-fixture-key' }), 'applied', 'RPC retries are idempotent')
  assert.equal(await execute({ kind: 'rename', ref: recovered.apiKeyEnv, name: 'RPC renamed' }), 'applied')
  assert.equal(await execute({ kind: 'move', ref: recovered.apiKeyEnv, toIndex: 0 }), 'applied')
  assert.equal(view().value.accounts[0].name, 'RPC renamed')
  assert.equal(await execute({ kind: 'select', ref: recovered.apiKeyEnv }), 'applied')
  assert.equal(await execute({ kind: 'auto-switch', value: false }), 'applied')
  assert.equal(view().value.autoSwitch, false)
  assert.equal(await execute({ kind: 'replace-key', ref: recovered.apiKeyEnv, key: 'rpc-replaced-key' }), 'applied')
  assert.equal(values.get(recovered.apiKeyEnv), 'rpc-replaced-key')
  assert.ok(!JSON.stringify(view().value).includes('rpc-replaced-key'), 'account RPC keeps credentials out of profile settings')
  await assert.rejects(execute({ kind: 'select', ref: recovered.apiKeyEnv, extra: true }))
  assert.equal(await execute({ kind: 'remove', ref: recovered.apiKeyEnv }), 'applied')
  assert.ok(!values.has(recovered.apiKeyEnv))
  assert.equal(entry.fiber, fiber, 'account commands preserve the running plugin')
  console.log('PASS: profile settings, account commands, adoption and recovery, live updates, capacities, reset, route toggle, validation')
} finally {
  await ctx.fiber.dispose()
}
