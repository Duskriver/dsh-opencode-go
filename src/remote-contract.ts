import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { modelsRemote } from './models-contract.ts'
import { usageRemote } from './usage-contract.ts'

/** A registry owns one contribution per package; mount all plugin endpoints together. */
export const goRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [...usageRemote.descriptors, ...modelsRemote.descriptors],
}
