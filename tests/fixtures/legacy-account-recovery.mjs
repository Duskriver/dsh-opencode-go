/** Installed 0.1.5/0.1.6 sections and real credential files must recover together. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
const { Context } = await import('@deepseek-ai/cordis')
const { default: Llm } = await import('@deepseek-ai/dsh-llm')
const { default: Settings } = await import('@deepseek-ai/dsh-settings-file')
const { LocalCredentialProvider } = await import('@deepseek-ai/dsh-credentials-local')
const { credentialRef } = await import('@deepseek-ai/dsh-credentials')
const plugin = await import('dsh-opencode-go')
const ns = 'llm-opencode-go'
const account = { id: 'a'.repeat(32), name: 'Recovered', apiKeyEnv: 'DSH_OPENCODE_GO_ACCOUNT_' + 'A'.repeat(32) }
await mkdir(process.env.DSH_HOME, { recursive: true })
const settingsPath = join(process.env.DSH_HOME, 'settings.yaml')
const credentialPath = join(process.env.DSH_HOME, 'credentials.yaml')
await writeFile(settingsPath, JSON.stringify({ [ns]: { accounts: [], accountOperations: [
  { id: account.id, kind: 'add', account, previousRef: 'OPENCODE_API_KEY', select: true },
] } }))
await writeFile(credentialPath, JSON.stringify({ version: 1, refs: { [account.apiKeyEnv]: 'recovery-fixture-key' } }), { mode: 0o600 })
const ctx = new Context()
try {
  await ctx.plugin(Llm)
  await ctx.plugin((await import('@deepseek-ai/dsh-typert-registry')).default)
  await ctx.plugin((await import('@deepseek-ai/dsh-api-gateway')).default)
  await ctx.plugin(Settings, { path: settingsPath, watch: false })
  await ctx.plugin(LocalCredentialProvider, { path: credentialPath, watch: false })
  await ctx.plugin({ name: 'account-recovery-fixture', inject: ['llm'], apply: scope => plugin.apply(scope) })
  const view = () => ctx.settings.describe().find(row => row.ns === ns).value
  const waitForRecovery = async () => {
    for (let attempt = 0; attempt < 100 && view().accountOperations.length; attempt++) await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(view().accountOperations, [])
  }
  await waitForRecovery()
  assert.deepEqual(view().accounts, [account], 'startup finishes the stored addition')
  assert.equal(view().apiKeyEnv, account.apiKeyEnv)
  await ctx.settings.update(ns, { accountOperations: [{ id: 'b'.repeat(32), kind: 'remove', account }] })
  await waitForRecovery()
  assert.deepEqual(view().accounts, [], 'committed settings update finishes removal')
  assert.equal(await ctx.credentials.resolve(credentialRef(account.apiKeyEnv)), undefined)
  const execute = command => ctx.typertGateway.invoke({ namespace: 'opencodeGoAccounts', method: 'execute', args: { command } })
  assert.equal(await execute({ kind: 'add', id: account.id, name: 'RPC account', key: 'rpc-fixture-key' }), 'applied')
  assert.equal(await execute({ kind: 'rename', ref: account.apiKeyEnv, name: 'RPC renamed' }), 'applied')
  assert.equal(view().accounts[0].name, 'RPC renamed')
  assert.equal(await execute({ kind: 'replace-key', ref: account.apiKeyEnv, key: 'rpc-replaced-key' }), 'applied')
  assert.equal((await ctx.credentials.resolve(credentialRef(account.apiKeyEnv))).value, 'rpc-replaced-key')
  assert.ok(!JSON.stringify(view()).includes('rpc-replaced-key'), 'account RPC keeps credentials out of settings')
  await assert.rejects(execute({ kind: 'select', ref: account.apiKeyEnv, extra: true }))
  assert.equal(await execute({ kind: 'remove', ref: account.apiKeyEnv }), 'applied')
  assert.deepEqual(view().accounts, [])
  assert.equal(await ctx.credentials.resolve(credentialRef(account.apiKeyEnv)), undefined)
  console.log('PASS: legacy account commands and recovery with real settings and managed credential files')
} finally { await ctx.fiber.dispose() }
