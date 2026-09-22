/** Real 0.1.7 Loader/settings contracts, isolated from the legacy host packages. */
import assert from 'node:assert/strict'
import { useModernHost } from './modern-host.mjs'

await useModernHost(process.argv[2])
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
  ctx.baseUrl = new URL('../../package.json', import.meta.url).href
  await ctx.plugin(Loader)
  await ctx.loader.create({ name: '@deepseek-ai/dsh-llm' })
  const id = await ctx.loader.create({ id: 'opencode-go', name: new URL('../../lib/index.js', import.meta.url).href,
    config: { apiKeyEnv: 'OPENCODE_GO_COMPAT_KEY' } })
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
  await ctx.settings.update('opencode-go', { enabled: false })
  assert.equal(entry.fiber, fiber, 'a settings write must preserve the running plugin')
  assert.equal(view().value.enabled, false)
  assert.deepEqual(ctx.llm.listProviders(), [])
  await ctx.settings.update('opencode-go', { enabled: true, refreshMinutes: 30 })
  assert.ok(ctx.llm.listProviders().some(row => row.id === 'opencode-go'))
  assert.equal(view().value.refreshMinutes, 30)
  assert.deepEqual(await ctx.llm.listModels('opencode-go'), [], 'deprecated models hidden by default')
  let pickerUpdates = 0
  ctx.on('llm/adapters-updated', () => { pickerUpdates++ })
  await ctx.settings.update('opencode-go', { showDeprecatedModels: true })
  assert.ok(pickerUpdates > 0, 'visibility change notifies already open session pickers')
  assert.equal((await ctx.llm.listModels('opencode-go'))[0].id, 'compat-model')
  await ctx.settings.update('opencode-go', { showDeprecatedModels: false })
  assert.deepEqual(await ctx.llm.listModels('opencode-go'), [])
  assert.equal(entry.fiber, fiber, 'visibility changes preserve the running plugin')
  const capacity = async () => (await ctx.llm.resolveModelInfo('opencode-go', 'compat-model')).context.contextWindow
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
  console.log('PASS: profile settings, live updates, capacities, reset, route toggle, validation')
} finally {
  await ctx.fiber.dispose()
}
