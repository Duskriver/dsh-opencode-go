import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-typert-registry'
import { goRemote } from './remote-contract.ts'

/** Register once per plugin mount, after either registry activation order. */
export function registerGoRemotes(ctx: Context): void {
  ctx.inject(['typert'], scope => {
    scope.effect(() => scope.typert.register({ package: goRemote.package, face: 'host', schemas: [],
      model: { services: [], events: [], objects: [] }, invocations: goRemote.descriptors }))
  })
}
