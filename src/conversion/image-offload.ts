/** Bridge the request-local image policy in DSH 0.1.5 and durable offloading in 0.1.6. */
import * as llm from '@deepseek-ai/dsh-llm'
import type { Message } from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'

interface ImageProjectionPolicy {
  maxImages?: number
  maxBytes?: number
  byteLength: (ref: ImageAttachmentRef) => number
  placeholder: (ref: ImageAttachmentRef) => string
  /** False before preparing image bytes, true once encoded sizes are known. */
  exact: boolean
}

// Namespace access is intentional: named imports of either generation's
// exclusive exports prevent Node from loading the plugin on the other one.
const api: Partial<Pick<typeof llm,
  'requiredImageOffload' | 'projectOffloadedImages' | 'IMAGE_OFFLOAD_REQUIRED_CODE'
>> & {
  offloadRequestImagesWithPolicy?: (
    messages: readonly Message[],
    policy: Omit<ImageProjectionPolicy, 'exact'> & { representation: 'base64'; byteQuantum: number; countQuantum: number },
  ) => readonly Message[]
} = llm

/** Preserve the host generation's image policy, using estimates first and exact sizes second. */
export function projectRequestImages(messages: readonly Message[], policy: ImageProjectionPolicy): readonly Message[] {
  if (api.requiredImageOffload !== undefined && api.projectOffloadedImages !== undefined) {
    // New hosts own the durable offloaded marks. The adapter must neither
    // discard images from estimates nor replace the host's retry protocol.
    if (!policy.exact) return messages
    if (policy.maxBytes !== undefined || policy.maxImages !== undefined) {
      const offloadImages = api.requiredImageOffload(
        messages,
        { representation: 'base64', maxBytes: policy.maxBytes, maxImages: policy.maxImages, countQuantum: 1 },
        block => policy.byteLength(block.attachment),
      )
      if (offloadImages > 0) {
        throw new llm.LlmError(
          `pi-ai request images exceed the configured image count or base64 payload bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
          api.IMAGE_OFFLOAD_REQUIRED_CODE ?? 'IMAGE_OFFLOAD_REQUIRED',
          { offloadImages },
        )
      }
    }
    return api.projectOffloadedImages(messages, policy.placeholder)
  }
  if (api.offloadRequestImagesWithPolicy === undefined) {
    throw new llm.LlmError('The DSH host has no supported image offload API', 'UNSUPPORTED_CONTENT')
  }
  // 0.1.5 has no surface handler for IMAGE_OFFLOAD_REQUIRED. Its own adapter
  // projects the oldest images to placeholders without mutating saved history.
  return api.offloadRequestImagesWithPolicy(messages, {
    representation: 'base64', byteQuantum: 1, countQuantum: 1, maxImages: policy.maxImages,
    maxBytes: policy.maxBytes, byteLength: policy.byteLength, placeholder: policy.placeholder,
  })
}
