import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PlainConfig } from '../src/config.ts'

it('leaves the image count unset by default and accepts an explicit positive integer', () => {
  expect(PlainConfig({}).maxImages).toBeUndefined()
  // Schemastery preserves null for optional fields; the adapter treats it as unset.
  expect(PlainConfig({ maxImages: null }).maxImages).toBeNull()
  expect(PlainConfig({ maxImages: 30 }).maxImages).toBe(30)
})

it.each([0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '30'])(
  'rejects an invalid image count: %s', value => {
    expect(() => PlainConfig({ maxImages: value })).toThrow()
  },
)

it('persists and clears an optional count through legacy settings without adding a default', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opencode-go-image-count-'))
  const ctx = new Context()
  try {
    const path = join(dir, 'settings.yaml')
    await writeFile(path, '')
    await ctx.plugin(FileSettingsProvider, { path, watch: false })
    let current = () => PlainConfig({})
    ctx.settings.installSection(ctx, 'llm-opencode-go', PlainConfig, PlainConfig({}), {
      setSource: source => { current = source }, onChange: () => {},
    })
    expect(current().maxImages).toBeUndefined()
    await ctx.settings.mutate('llm-opencode-go', [{ op: 'set', path: ['maxImages'], value: 30 }])
    expect(current().maxImages).toBe(30)
    expect(await readFile(path, 'utf8')).toContain('maxImages: 30')
    await expect(ctx.settings.mutate('llm-opencode-go', [{ op: 'set', path: ['maxImages'], value: 0 }])).rejects.toThrow()
    expect(current().maxImages).toBe(30)
    await ctx.settings.mutate('llm-opencode-go', [{ op: 'unset', path: ['maxImages'] }])
    expect(current().maxImages).toBeUndefined()
    expect(await readFile(path, 'utf8')).not.toContain('maxImages')
  } finally {
    await ctx.fiber.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})
