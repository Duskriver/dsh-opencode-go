// @vitest-environment jsdom
/** The distributed factory must resolve against the DSH module table and mount its settings page. */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as store from '@deepseek-ai/dsh-client-store'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { expect, it, vi } from 'vitest'
import { stubSettingsScope } from './support/client.ts'

it('loads the built client and registers the settings section using published platform modules', async () => {
  const table = new Map<string, unknown>([
    ['react', React], ['react/jsx-runtime', jsx],
    ['@deepseek-ai/dsh-client-store', store],
    ['@deepseek-ai/dsh-client-ui-primitives', primitives],
  ])
  let registration: { id: string; factory: (require: (id: string) => unknown) => { apply: (ctx: unknown) => void } } | undefined
  const styles = new Set(document.head.querySelectorAll('style'))
  try {
    runInNewContext(readFileSync('lib/client.js', 'utf8'), {
      document, window: { __ModuleLoader__: { load: (entry: typeof registration) => { registration = entry } } },
    })
    expect(registration?.id).toBe('dsh-opencode-go')
    const client = registration!.factory(id => {
      if (!table.has(id)) throw new Error(`Unprovided module: ${id}`)
      return table.get(id)
    })
    const slots = vi.fn(() => () => {})
    const effects: Array<() => void> = []
    const scope = stubSettingsScope().scope
    client.apply({
      effect: (install: () => (() => void)) => { effects.push(install()) },
      locale: { register: () => () => {}, bind: () => (key: string) => key },
      settingsScope: { bind: () => scope },
      remote: { $on: () => () => {}, credentials: { describe: async () => ({ ok: true, value: {} }) } },
      slots: { inject: (_name: string, install: () => void) => install(), register: slots },
    })
    await Promise.resolve()
    expect(slots).toHaveBeenCalledWith(expect.objectContaining({ id: 'opencode-go', name: 'settings.section' }), expect.any(Function))
    expect(document.querySelector('style[data-plugin="dsh-opencode-go"]')).not.toBeNull()
    for (const dispose of effects.reverse()) dispose()
  } finally {
    for (const style of document.head.querySelectorAll('style')) if (!styles.has(style)) style.remove()
  }
})
