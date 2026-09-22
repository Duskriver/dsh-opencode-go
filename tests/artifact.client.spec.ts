// @vitest-environment jsdom
/** The distributed factory must resolve against the DSH module table and mount its settings page. */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as store from '@deepseek-ai/dsh-client-store'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import * as modernPrimitives from './hosts/v017/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { stubSettingsScope } from './support/client.ts'

it.each(['legacy', 'modern'])('loads the built client and registers settings with the %s service', async (host) => {
  const table = new Map<string, unknown>([
    ['react', React], ['react/jsx-runtime', jsx],
    ['@deepseek-ai/dsh-client-store', store],
    ['@deepseek-ai/dsh-client-ui-primitives', host === 'modern' ? modernPrimitives : primitives],
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
    const effects: Array<(() => void) | Promise<() => void>> = []
    const sharedForm = stubSettingsScope()
    const scope = sharedForm.scope
    sharedForm.publish({ status: 'ready', value: {}, base: {}, user: {}, writable: true })
    const getForm = vi.fn(() => scope)
    const bindScope = vi.fn(() => scope)
    const ctx = {
      inject: vi.fn((services: string[], callback: (child: unknown) => void) => {
        if (services.includes(host === 'modern' ? 'configForms' : 'settingsScope')) callback(ctx)
      }),
      get: () => ({ get: getForm }),
      effect: (install: () => (() => void) | Promise<() => void>) => { effects.push(install()) },
      locale: { register: () => () => {}, bind: () => (key: string) => key },
      settingsScope: { bind: bindScope },
      remote: { $mount: async () => () => {}, opencodeGoModels: { read: async () => ({ ok: true, value: [] }) }, $on: () => () => {}, credentials: { describe: async () => ({ ok: true, value: {} }) } },
      slots: { inject: (_name: string, install: () => void) => install(), register: slots },
    }
    client.apply(ctx)
    await Promise.resolve()
    if (host === 'modern') {
      expect(getForm).toHaveBeenCalledWith('opencode-go')
      expect(bindScope).not.toHaveBeenCalled()
    } else {
      expect(bindScope).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'llm-opencode-go' }))
      expect(getForm).not.toHaveBeenCalled()
    }
    expect(slots).toHaveBeenCalledWith(expect.objectContaining({ id: 'opencode-go', name: 'settings.section' }), expect.any(Function))
    const [options, Component] = slots.mock.calls[0] as unknown as [
      { inject(): { hooks: { opencodeGo: { getSnapshot(): unknown } } } }, React.ComponentType<object>,
    ]
    const face = options.inject()
    const markup = renderToStaticMarkup(React.createElement(Component, {
      ...face, useOpencodeGo: () => face.hooks.opencodeGo.getSnapshot(),
    }))
    expect(markup).toContain('type="password"')
    expect(document.querySelector('style[data-plugin="dsh-opencode-go"]')).not.toBeNull()
    for (const dispose of effects.reverse()) (await dispose)()
    expect(sharedForm.listenerCount()).toBe(0)
  } finally {
    for (const style of document.head.querySelectorAll('style')) if (!styles.has(style)) style.remove()
  }
})
