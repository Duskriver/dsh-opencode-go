/** Request history, durable images, provider replay and stream conversion. */
import {
  LlmError,
  type Message as HistoryMessage,
  type ModelMessageSource,
  type ReplayEnvelope,
  requiredImageOffload,
  projectOffloadedImages,
  IMAGE_OFFLOAD_REQUIRED_CODE,
  type RequestMessage as Message,
  contentHasImage,
  offloadedImageText,
  requestImageHandleText,
  type ContentBlock,
  type GenerateOptions,
  type ImageAttachmentAccessResolver,
  type ToolCallId,
  CONTEXT_WINDOW_EXCEEDED_CODE,
  EMPTY_RESPONSE_CODE,
  isContextWindowExceededError,
  isQuotaExceededError,
  QUOTA_EXCEEDED_CODE,
  type FinishReason,
  type StreamChunk,
  type TokenUsage,
} from '@deepseek-ai/dsh-llm'
import type {
  Api,
  AssistantMessage,
  ToolCall,
  Usage as PiUsage,
  Context as PiContext,
  ImageContent,
  Message as PiMessage,
  TextContent,
  Tool as PiTool,
  AssistantMessageEvent,
} from './sdk-types.ts'
import {
  type ImageAttachmentRef,
  type AttachmentId,
  type AttachmentStore,
  type ImageRequestTarget,
  type RequestImageAttachment,
  requestImageDimensions,
} from '@deepseek-ai/dsh-attachment'
import { brandString } from '@deepseek-ai/dsh-brand'
import { DEFAULT_REQUEST_IMAGE_MAX_BYTES, DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET } from './contracts.ts'
import { waitWithSignal } from './transport.ts'
import { isContextOverflow } from 'opencode-go-pi-ai'
import { createHash } from 'node:crypto'

/** Per-block half of the pi-ai replay envelope, one entry per content block. */
export type PiAiReplayBlock =
  | { type: 'text'; textSignature?: string }
  | { type: 'reasoning'; thinkingSignature?: string; redacted?: boolean }
  | { type: 'tool-call'; thoughtSignature?: string }

/** Versioned response-level half of the pi-ai replay envelope. */
export interface PiAiReplayResponse {
  kind: 'pi-ai'
  version: 2
  api: Api
  /** Requested DSH provider identity, matching the durable assistant source. */
  provider: string
  /** Native SDK provider when it differs from the DSH route. */
  sdkProvider?: string
  /** Requested model identity, matching the durable assistant source. */
  model: string
  /** Provider-reported model; informational only, so requested identity still matches replay signatures. */
  responseModel?: string
  responseId?: string
  /** Provider-native effort for historical replay; absence is preserved. */
  providerThinkingLevel?: string
  stopReason: AssistantMessage['stopReason']
  /** Measured context footprint for the next turn's SDK output-token clamp. */
  usage?: Pick<PiUsage, 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'totalTokens'>
  /** Fingerprint of the request prefix and this reply that the usage measured. */
  usageContext?: string
}

/** The validated halves of one pi-ai replay envelope. */
interface PiAiReplayState {
  response: PiAiReplayResponse
  blocks: PiAiReplayBlock[]
}

/** Parse tool-call argument JSON; tolerate model malformations with {}. */
function parseArguments(raw: string): ToolCall['arguments'] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      // JSON.parse guarantees JSON values; the root must also be an object.
      return parsed as ToolCall['arguments']
    }
  } catch {
    // fall through
  }
  return {}
}

/** Construct the zero usage value required by historical pi-ai messages. */
function emptyPiUsage(): PiUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

/** Key order can change across durable JSON replay without changing the context. */
function contextFingerprint(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
  return createHash('sha256').update(serialized).digest('hex')
}

function usageContextSeed(context: PiContext, provider: string, model: string): string {
  return contextFingerprint([provider, model, context.systemPrompt ?? '', context.tools ?? []])
}

/** Exclude accounting fields and synthetic timestamps; retain replay-sensitive identity. */
function appendUsageContext(prefix: string, message: PiMessage): string {
  if (message.role === 'assistant') return contextFingerprint([prefix, {
    role: message.role, api: message.api, provider: message.provider, model: message.model,
    content: message.content, responseId: message.responseId, providerThinkingLevel: message.providerThinkingLevel,
  }])
  const { timestamp: _timestamp, ...content } = message
  return contextFingerprint([prefix, content])
}

const usageKeys = new WeakMap<PiContext, { provider: string; model: string; key: string }>()

/** Capture one converted request before the SDK can mutate it while streaming. */
export function piContextUsageKey(context: PiContext, provider: string, model: string): string {
  const cached = usageKeys.get(context)
  if (cached && cached.provider === provider && cached.model === model) return cached.key
  const key = context.messages.reduce(appendUsageContext, usageContextSeed(context, provider, model))
  usageKeys.set(context, { provider, model, key })
  return key
}

/**
 * Project a successful pi-ai response into the minimal durable replay state.
 * The per-block half is index-aligned with the streamed blocks (pi-ai content
 * order), so `BlockAssembler` prunes an entry with its block whenever assembly
 * removes one.
 * @param message - completed native pi-ai assistant response.
 * @param requestedModel - request identity stored in the assistant source; defaults to the native model.
 * @param requestedProvider - DSH route stored in the assistant source; defaults to the native provider.
 * @param usageContext - fingerprint of the request that produced this response.
 * @returns the versioned lossless-JSON replay projection.
 */
export function toPiReplayState(message: AssistantMessage, requestedModel = message.model, requestedProvider = message.provider,
  usageContext?: string,
): ReplayEnvelope {
  const responseModel = message.api === 'anthropic-messages' && message.model !== requestedModel
    ? message.model : message.responseModel
  const { input, output, cacheRead, cacheWrite, totalTokens } = message.usage
  const response: PiAiReplayResponse = {
    kind: 'pi-ai',
    version: 2,
    api: message.api,
    provider: requestedProvider,
    ...requestedProvider === message.provider ? {} : { sdkProvider: message.provider },
    model: requestedModel,
    ...responseModel === undefined ? {} : { responseModel },
    ...message.responseId === undefined ? {} : { responseId: message.responseId },
    ...message.providerThinkingLevel === undefined ? {} : { providerThinkingLevel: message.providerThinkingLevel },
    stopReason: message.stopReason,
  }
  if (hasUsage(message.usage)) {
    response.usage = { input, output, cacheRead, cacheWrite, totalTokens }
    if (usageContext !== undefined) response.usageContext = appendUsageContext(usageContext, { ...message, model: requestedModel })
  }
  return {
    response,
    blocks: message.content.map((block): PiAiReplayBlock => {
      switch (block.type) {
        case 'text': return {
          type: 'text',
          ...block.textSignature === undefined ? {} : { textSignature: block.textSignature },
        }
        case 'thinking': return {
          type: 'reasoning',
          ...block.thinkingSignature === undefined ? {} : { thinkingSignature: block.thinkingSignature },
          ...block.redacted === undefined ? {} : { redacted: block.redacted },
        }
        case 'toolCall': return {
          type: 'tool-call',
          ...block.thoughtSignature === undefined ? {} : { thoughtSignature: block.thoughtSignature },
        }
      }
    }),
  }
}

function invalidReplay(message: string): never {
  throw new LlmError(`invalid pi-ai replay state: ${message}`, 'INVALID_REPLAY_STATE')
}

/** Validate the durable adapter-private envelope before it reaches pi-ai. */
function readReplayState(value: unknown): PiAiReplayState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalidReplay('expected a replay envelope')
  const envelope = value as Record<string, unknown>
  const rawResponse = envelope['response']
  if (typeof rawResponse !== 'object' || rawResponse === null || Array.isArray(rawResponse)) return invalidReplay('expected a response object')
  const response = rawResponse as Record<string, unknown>
  if (response['kind'] !== 'pi-ai') return invalidReplay('unknown state kind')
  if (response['version'] !== 2) return invalidReplay(`unsupported version ${String(response['version'])}`)
  for (const key of ['api', 'provider', 'model'] as const) {
    if (typeof response[key] !== 'string' || response[key].length === 0) return invalidReplay(`${key} must be a non-empty string`)
  }
  if (response['sdkProvider'] !== undefined && (typeof response['sdkProvider'] !== 'string' || response['sdkProvider'].length === 0)) {
    return invalidReplay('sdkProvider must be a non-empty string')
  }
  if (!['stop', 'length', 'toolUse', 'error', 'aborted'].includes(String(response['stopReason']))) {
    return invalidReplay('unknown stopReason')
  }
  if (response['responseModel'] !== undefined && typeof response['responseModel'] !== 'string') return invalidReplay('responseModel must be a string')
  if (response['responseId'] !== undefined && typeof response['responseId'] !== 'string') return invalidReplay('responseId must be a string')
  if (response['providerThinkingLevel'] !== undefined && typeof response['providerThinkingLevel'] !== 'string') return invalidReplay('providerThinkingLevel must be a string')
  if (response['usageContext'] !== undefined
    && (typeof response['usageContext'] !== 'string' || !/^[a-f0-9]{64}$/.test(response['usageContext']))) {
    return invalidReplay('usageContext must be a SHA-256 fingerprint')
  }
  if (response['usage'] !== undefined) {
    const usage = response['usage']
    if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) return invalidReplay('usage must be an object')
    for (const field of ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens'] as const) {
      const tokens = (usage as Record<string, unknown>)[field]
      if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens < 0) return invalidReplay(`usage ${field} must be a non-negative finite number`)
    }
  }
  const blocks = envelope['blocks']
  if (!Array.isArray(blocks)) return invalidReplay('blocks must be an array')
  for (const [index, value] of blocks.entries()) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalidReplay(`block ${index} must be an object`)
    const block = value as Record<string, unknown>
    if (!['text', 'reasoning', 'tool-call'].includes(String(block['type']))) return invalidReplay(`block ${index} has an unknown type`)
    for (const signature of ['textSignature', 'thinkingSignature', 'thoughtSignature'] as const) {
      if (block[signature] !== undefined && typeof block[signature] !== 'string') return invalidReplay(`block ${index} ${signature} must be a string`)
    }
    if (block['redacted'] !== undefined && typeof block['redacted'] !== 'boolean') return invalidReplay(`block ${index} redacted must be boolean`)
  }
  return {
    response: response as unknown as PiAiReplayResponse,
    blocks: blocks as PiAiReplayBlock[],
  }
}

/** Convert provider-neutral blocks without trusting them as same-model replay. */
function foreignAssistant(message: HistoryMessage): AssistantMessage {
  const source = message.source.kind === 'model' ? message.source : undefined
  const content: AssistantMessage['content'] = []
  for (const block of message.content) {
    switch (block.type) {
      case 'text': content.push({ type: 'text', text: block.text }); break
      case 'reasoning': content.push({ type: 'thinking', thinking: block.text }); break
      case 'tool-call': content.push({
        type: 'toolCall',
        id: block.id,
        name: block.name,
        arguments: parseArguments(block.arguments),
      }); break
      case 'image':
        throw new LlmError('pi-ai chat history cannot represent structured assistant image output', 'UNSUPPORTED_CONTENT')
      default:
        // plugin-added block types are not representable in pi-ai.
        break
    }
  }
  return {
    role: 'assistant',
    content,
    // Deliberately never equals a catalog API: absent replay state is foreign
    // even if source names the same provider/model as this request.
    api: 'dsh-foreign',
    provider: source?.provider ?? 'dsh-foreign',
    model: source?.model ?? 'dsh-foreign',
    usage: emptyPiUsage(),
    stopReason: content.some(piece => piece.type === 'toolCall') ? 'toolUse' : 'stop',
    timestamp: 0,
  }
}

/** Recombine durable Harness content with validated pi-ai replay metadata. */
function replayedAssistant(message: HistoryMessage, source: ModelMessageSource, rawState: unknown): AssistantMessage {
  const state = readReplayState(rawState)
  if (state.response.provider !== source.provider) return invalidReplay('provider does not match assistant source')
  if (state.response.model !== source.model) return invalidReplay('model does not match assistant source')
  if (state.blocks.length !== message.content.length) return invalidReplay('block count does not match assistant content')
  const content: AssistantMessage['content'] = message.content.map((block, index) => {
    const replay = state.blocks[index]
    if (replay === undefined || replay.type !== block.type) return invalidReplay(`block ${index} does not match assistant content`)
    switch (block.type) {
      case 'text': return {
        type: 'text',
        text: block.text,
        ...replay.type === 'text' && replay.textSignature !== undefined ? { textSignature: replay.textSignature } : {},
      }
      case 'reasoning': return {
        type: 'thinking',
        thinking: block.text,
        ...replay.type === 'reasoning' && replay.thinkingSignature !== undefined ? { thinkingSignature: replay.thinkingSignature } : {},
        ...replay.type === 'reasoning' && replay.redacted !== undefined ? { redacted: replay.redacted } : {},
      }
      case 'tool-call': return {
        type: 'toolCall',
        id: block.id,
        name: block.name,
        arguments: parseArguments(block.arguments),
        ...replay.type === 'tool-call' && replay.thoughtSignature !== undefined ? { thoughtSignature: replay.thoughtSignature } : {},
      }
      /* v8 ignore next -- readReplayState rejects unknown replay tags, so an equal plugin-added Harness tag cannot reach this switch */
      default: return invalidReplay(`block ${index} has an unsupported Harness type`)
    }
  })
  return {
    role: 'assistant',
    content,
    api: state.response.api,
    provider: state.response.sdkProvider ?? state.response.provider,
    // SDK signature matching uses the requested identity even when Anthropic reports an alias.
    model: state.response.model,
    ...state.response.responseModel === undefined ? {} : { responseModel: state.response.responseModel },
    ...state.response.responseId === undefined ? {} : { responseId: state.response.responseId },
    ...state.response.providerThinkingLevel === undefined ? {} : { providerThinkingLevel: state.response.providerThinkingLevel },
    usage: { ...emptyPiUsage(), ...state.response.usage },
    stopReason: state.response.stopReason,
    timestamp: 0,
  }
}

/**
 * Convert one durable Harness assistant message into pi-ai history.
 *
 * Durable content is the authoritative record; replay metadata only restores
 * native fidelity (ids, signatures). A replay state this build cannot use —
 * another adapter's kind, another version, a malformed value, or metadata that
 * no longer matches the content — therefore degrades the one message to
 * provider-neutral history instead of failing the request.
 * @param message - assistant content with required source and optional adapter-owned replay metadata.
 * @param onDegrade - called with the diagnostic reason when an unusable replay
 *   state falls back to provider-neutral conversion.
 * @returns a native pi-ai assistant message reconstructed from durable content.
 */
export function toPiAssistant(message: HistoryMessage, onDegrade?: (reason: string) => void): AssistantMessage {
  const source = message.source
  if (source.kind !== 'model' || source.replayState === undefined) return foreignAssistant(message)
  try {
    return replayedAssistant(message, source, source.replayState)
  } catch (error: unknown) {
    /* v8 ignore next -- replayedAssistant throws only INVALID_REPLAY_STATE LlmErrors; the
       guard keeps a future non-replay failure loud instead of silently degrading it */
    if (!(error instanceof LlmError) || error.code !== 'INVALID_REPLAY_STATE') throw error
    onDegrade?.(error.message)
    return foreignAssistant(message)
  }
}

interface ImageProjectionPolicy {
  maxImages?: number
  maxBytes?: number
  byteLength: (ref: ImageAttachmentRef) => number
  placeholder: (ref: ImageAttachmentRef) => string
  exact: boolean
}

export function projectRequestImages(messages: readonly Message[], policy: ImageProjectionPolicy): readonly Message[] {
  if ((policy.exact && policy.maxBytes !== undefined) || policy.maxImages !== undefined) {
    const offloadImages = requiredImageOffload(messages,
      { representation: 'base64', maxBytes: policy.exact ? policy.maxBytes : undefined, maxImages: policy.maxImages, countQuantum: 1 },
      block => policy.exact ? policy.byteLength(block.attachment) : 0)
    if (offloadImages > 0) throw new LlmError(
      `pi-ai request images exceed the configured image count or base64 payload bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
      IMAGE_OFFLOAD_REQUIRED_CODE, { offloadImages })
  }
  return policy.exact ? projectOffloadedImages(messages, policy.placeholder) : messages
}

/** Join the text blocks of a harness message. */
function flattenText(message: Message): string {
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

/** Reject unsupported roles, tool-change blocks, and image roles before replay or image offloading. */
function assertSupportedHistory(messages: readonly Message[]): void {
  for (const message of messages) {
    // Developer history is persisted for V4; provider serialization is intentionally deferred.
    if ((message as { role: string }).role === 'developer') throw new LlmError('Developer messages are not supported yet', 'UNSUPPORTED_CONTENT')
    if (!['system', 'user', 'assistant', 'tool'].includes((message as { role: string }).role)) {
      throw new LlmError(`Unsupported message role: ${message.role}`, 'UNSUPPORTED_CONTENT')
    }
    if ((message.content as readonly { type: string }[]).some(block => block.type === 'tool-addition' || block.type === 'tool-removal')) {
      throw new LlmError('Tool-change blocks require developer role', 'UNSUPPORTED_CONTENT')
    }
    if (message.role !== 'user' && message.role !== 'tool' && contentHasImage(message.content)) {
      throw new LlmError(
        `pi-ai cannot represent an image in an in-history ${message.role} message`,
        'UNSUPPORTED_CONTENT',
      )
    }
  }
}

async function userContent(
  blocks: readonly ContentBlock[],
  requestImages: ReadonlyMap<AttachmentId, RequestImageAttachment>,
  resolveImageAccess: ImageAttachmentAccessResolver,
): Promise<string | (TextContent | ImageContent)[]> {
  const content: (TextContent | ImageContent)[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if (block.text.length > 0) content.push({ type: 'text', text: block.text })
        break
      case 'image': {
        const version = requestImages.get(block.attachment.attachmentId) as RequestImageAttachment
        content.push({
          type: 'text',
          text: requestImageHandleText(block.attachment, version, resolveImageAccess(block.attachment)),
        })
        content.push({
          type: 'image',
          data: Buffer.from(version.data).toString('base64'),
          mimeType: version.mediaType,
        })
        break
      }
      default:
        // Other merge-extensible blocks are not user-input vocabulary for pi-ai.
        break
    }
  }
  if (content.every(block => block.type === 'text')) return content.map(block => block.text).join('')
  return content
}

function collectImageRefs(
  blocks: readonly ContentBlock[],
  refs: Map<AttachmentId, ImageAttachmentRef>,
  occurrences: Map<AttachmentId, number>,
): void {
  for (const block of blocks) {
    if (block.type === 'image') {
      if (block.offloaded !== true) {
        refs.set(block.attachment.attachmentId, block.attachment)
        occurrences.set(block.attachment.attachmentId, (occurrences.get(block.attachment.attachmentId) ?? 0) + 1)
      }
    }
  }
}

async function prepareRequestImages(
  messages: readonly Message[],
  attachments: AttachmentStore,
  budget: PiImageRequestBudget,
  signal?: AbortSignal,
  maxEncodedBytes?: number,
  checkBudget?: (versions: ReadonlyMap<AttachmentId, RequestImageAttachment>) => void,
): Promise<Map<AttachmentId, RequestImageAttachment>> {
  const refs = new Map<AttachmentId, ImageAttachmentRef>()
  const occurrences = new Map<AttachmentId, number>()
  for (const message of messages) collectImageRefs(message.content, refs, occurrences)
  const orderedRefs = [...refs.values()]
  const versions = new Map<AttachmentId, RequestImageAttachment>()
  const cancelled = new AbortController()
  const preparationSignal = signal ? AbortSignal.any([signal, cancelled.signal]) : cancelled.signal
  let next = 0
  let failed = false
  let failure: unknown
  let encodedBytes = 0
  const worker = async (): Promise<void> => {
    try {
      while (next < orderedRefs.length) {
        preparationSignal.throwIfAborted()
        const ref = orderedRefs[next++]!
        const image = await waitWithSignal(() => attachments.readImageRequest(ref, requestImageTargetFor(ref, budget), preparationSignal), preparationSignal)
        preparationSignal.throwIfAborted()
        versions.set(ref.attachmentId, image)
        encodedBytes += Math.ceil(image.bytes / 3) * 4 * occurrences.get(ref.attachmentId)!
        if (maxEncodedBytes !== undefined && encodedBytes > maxEncodedBytes) checkBudget?.(versions)
      }
    } catch (error) {
      if (!failed) { failed = true; failure = error; cancelled.abort(error) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, orderedRefs.length) }, worker))
  if (failed) throw failure
  return versions
}

function toolsOf(options: GenerateOptions): PiTool[] | undefined {
  // Deferred definitions are persisted for V4; provider loading is intentionally deferred.
  if ((options.tools as readonly { deferLoading?: unknown }[] | undefined)?.some(tool => tool.deferLoading === true)) {
    throw new LlmError('Deferred tool loading is not supported yet', 'UNSUPPORTED_CONTENT')
  }
  return options.tools?.map(tool => ({
    name: tool.name,
    description: tool.description,
    // ToolSchema.parameters is a JSON Schema object; pi-ai's TSchema
    // (TypeBox) is structurally JSON Schema, so it assigns directly.
    parameters: tool.parameters,
  }))
}

/** The request split into pi-ai's single `systemPrompt` slot and the history that converts to `messages`. */
interface SystemPromptSplit {
  /** Text for pi-ai's `systemPrompt`; `undefined` sends no system prompt. */
  systemPrompt: string | undefined
  /** History messages that convert to pi-ai `messages`. */
  messages: readonly Message[]
}

/**
 * Select the pi-ai `systemPrompt` source shared by both conversion paths.
 * `options.system` wins when defined and every history message converts,
 * including a leading `system` message, which then folds into a `user`
 * message. Otherwise a leading `system` history message supplies the prompt
 * and leaves the converted history; empty leading text sends no prompt.
 */
function splitSystemPrompt(options: GenerateOptions): SystemPromptSplit {
  if (options.system !== undefined) return { systemPrompt: options.system, messages: options.messages }
  const [first, ...rest] = options.messages
  if (first?.role !== 'system') return { systemPrompt: undefined, messages: options.messages }
  const text = flattenText(first)
  return { systemPrompt: text.length > 0 ? text : undefined, messages: rest }
}

/** Assemble the request-level pi-ai context envelope shared by both conversion paths. */
function piContext(systemPrompt: string | undefined, options: GenerateOptions, messages: PiMessage[],
  usageContexts: ReadonlyMap<AssistantMessage, string>,
): PiContext {
  const tools = toolsOf(options)
  const context: PiContext = {
    ...systemPrompt !== undefined ? { systemPrompt } : {},
    messages,
    ...tools !== undefined && tools.length > 0 ? { tools } : {},
  }
  if (usageContexts.size === 0) {
    for (const message of messages) {
      if (message.role === 'assistant') message.usage = emptyPiUsage()
    }
    return context
  }
  let prefix = usageContextSeed(context, options.provider, options.model)
  for (const message of messages) {
    prefix = appendUsageContext(prefix, message)
    // Compaction, pruning, image offloading and prompt/tool changes can leave
    // a native reply intact while replacing the prefix its usage described.
    // Legacy usage has no fingerprint, so it cannot safely budget this request.
    if (message.role === 'assistant' && usageContexts.get(message) !== prefix) message.usage = emptyPiUsage()
  }
  usageKeys.set(context, { provider: options.provider, model: options.model, key: prefix })
  return context
}

function appendAssistant(
  message: Extract<Message, { role: 'assistant' }>,
  messages: PiMessage[],
  toolNames: Map<ToolCallId, string>,
  usageContexts: Map<AssistantMessage, string>,
  onReplayDegrade?: (reason: string) => void,
): void {
  const assistant = toPiAssistant(message, onReplayDegrade)
  const replay = message.source.replayState as Partial<PiAiReplayState> | undefined
  const usageContext = replay?.response?.usageContext
  if (typeof usageContext === 'string') usageContexts.set(assistant, usageContext)
  for (const block of assistant.content) {
    if (block.type === 'toolCall') toolNames.set(brandString<ToolCallId>(block.id), block.name)
  }
  messages.push(assistant)
}

function textOnlyContext(options: GenerateOptions, onReplayDegrade?: (reason: string) => void): PiContext {
  assertSupportedHistory(options.messages)
  const split = splitSystemPrompt(options)
  const toolNames = new Map<ToolCallId, string>()
  const usageContexts = new Map<AssistantMessage, string>()
  const messages: PiMessage[] = []
  for (const message of split.messages) {
    if (contentHasImage(message.content)) {
      throw new LlmError('pi-ai image conversion requires the durable attachment service', 'UNSUPPORTED_CONTENT')
    }
    if (message.role === 'tool') {
      const tool = message
      messages.push({
        role: 'toolResult', toolCallId: tool.toolCallId,
        toolName: toolNames.get(tool.toolCallId) ?? 'unknown',
        content: [{ type: 'text', text: flattenText(tool) || '(no output)' }],
        isError: tool.isError ?? false, timestamp: 0,
      })
      continue
    }
    if (message.role === 'system') {
      // pi-ai has a single systemPrompt slot; a system message that did not
      // supply it folds into a user message to preserve order.
      messages.push({ role: 'user', content: flattenText(message), timestamp: 0 })
      continue
    }
    if (message.role === 'assistant') {
      appendAssistant(message, messages, toolNames, usageContexts, onReplayDegrade)
      continue
    }
    messages.push({ role: 'user', content: flattenText(message), timestamp: 0 })
  }
  return piContext(split.systemPrompt, options, messages, usageContexts)
}

/** Inputs that bind deterministic request images to one current tool execution world. */
export interface PiImageRequestContext {
  /** Durable provider that resolves request-image bytes and provider-owned host objects. */
  attachments: AttachmentStore
  /** Resolve current tool access separately from deterministic request-image versions. */
  resolveImageAccess: ImageAttachmentAccessResolver
  /** Maximum retained image occurrences across request history; omission leaves the count unlimited. */
  maxImages?: number
  /** Request-level bound on the base64-encoded payload of retained images; omission leaves the bound unchecked. */
  maxRequestImageBytes?: number
  /** Route pixel and raw encoded-byte budgets. */
  requestImagePolicy?: PiImageRequestBudget
}

/** Per-route budgets from which each request image's target is derived. */
export interface PiImageRequestBudget {
  /** Total-pixel budget; larger sources are downscaled proportionally. */
  maxPixels: number
  /** Encoded-byte target for one request image. */
  maxBytes: number
}

/**
 * Deterministic request target for one source under the route budgets.
 *
 * The single projection both request serialization and the adapter's
 * `LlmAdapter.imageRequestTarget` report use: the token meter must price the
 * exact dimensions and encoded-byte target this route sends, not the
 * normalized source image.
 * @param ref - durable normalized image reference.
 * @param budget - route pixel and encoded-byte budgets.
 * @returns the target width, height and encoded-byte cap, plus the budgets.
 */
export function requestImageTargetFor(ref: ImageAttachmentRef, budget: PiImageRequestBudget): ImageRequestTarget & PiImageRequestBudget {
  return {
    ...requestImageDimensions(ref.width, ref.height, budget.maxPixels),
    maxPixels: budget.maxPixels,
    maxBytes: budget.maxBytes,
  }
}

/**
 * Convert text-only harness history to a synchronous pi-ai Context. Tool
 * result names are recovered from preceding assistant tool calls.
 * @param options - the harness request; `options.system`, else a leading `system` message, maps to pi-ai's single `systemPrompt` slot.
 * @param images - absent; selects the synchronous conversion.
 * @param onReplayDegrade - forwarded to {@link toPiAssistant} for each assistant message.
 * @returns the pi-ai context; `tools` is omitted when the request declares none.
 * @throws {LlmError} `UNSUPPORTED_CONTENT` for a `developer` history message, a tool-change block, a deferred tool, or an image in any history role, including a leading system message.
 */
export function toPiContext(
  options: GenerateOptions,
  images?: undefined,
  onReplayDegrade?: (reason: string) => void,
): PiContext

/**
 * Convert harness history to a pi-ai Context while resolving durable images.
 * Tool result names are recovered from preceding assistant tool calls.
 * Occurrences the surface marks offloaded become placeholders; when the
 * retained occurrences exceed `maxImages` or their exact base64 payload exceeds
 * `maxRequestImageBytes`, the call fails with `IMAGE_OFFLOAD_REQUIRED` naming
 * how many more oldest occurrences must be offloaded.
 * @param options - the harness request; `options.system`, else a leading `system` message, maps to pi-ai's single `systemPrompt` slot.
 * @param images - attachment provider, current path resolver, and request limits.
 * @param onReplayDegrade - forwarded to {@link toPiAssistant} for each assistant message.
 * @returns the asynchronously resolved pi-ai context.
 */
export function toPiContext(
  options: GenerateOptions,
  images: PiImageRequestContext,
  onReplayDegrade?: (reason: string) => void,
): Promise<PiContext>

export function toPiContext(
  options: GenerateOptions,
  images?: PiImageRequestContext,
  onReplayDegrade?: (reason: string) => void,
): PiContext | Promise<PiContext> {
  return images === undefined
    ? textOnlyContext(options, onReplayDegrade)
    : toPiContextWithImages(options, images, onReplayDegrade)
}

async function toPiContextWithImages(
  options: GenerateOptions,
  images: PiImageRequestContext,
  onReplayDegrade?: (reason: string) => void,
): Promise<PiContext> {
  const { attachments, resolveImageAccess, maxImages, maxRequestImageBytes } = images
  const requestImagePolicy = images.requestImagePolicy ?? {
    maxPixels: DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
    maxBytes: DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  }
  assertSupportedHistory(options.messages)
  const split = splitSystemPrompt(options)
  const projection = {
    maxImages,
    maxBytes: maxRequestImageBytes,
    placeholder: (ref: ImageAttachmentRef) => offloadedImageText(ref, resolveImageAccess(ref)),
  }
  const requestMessages = projectRequestImages(split.messages, {
    ...projection, exact: false,
    byteLength: ref => Math.min(ref.bytes, requestImagePolicy.maxBytes),
  })
  const requestImages = await prepareRequestImages(requestMessages, attachments, requestImagePolicy, options.signal, maxRequestImageBytes, versions => {
    // Prepared sizes form a lower bound, so stop excess work without guessing source sizes.
    projectRequestImages(requestMessages, { ...projection, exact: true,
      byteLength: ref => versions.get(ref.attachmentId)?.bytes ?? 0 })
  })
  const exactMessages = projectRequestImages(requestMessages, {
    ...projection, exact: true,
    byteLength: ref => (requestImages.get(ref.attachmentId) as RequestImageAttachment).bytes,
  })
  const toolNames = new Map<ToolCallId, string>()
  const usageContexts = new Map<AssistantMessage, string>()
  const messages: PiMessage[] = []

  for (const message of exactMessages) {
    if (message.role === 'tool') {
      const tool = message
      const content = await userContent(tool.content, requestImages, resolveImageAccess)
      messages.push({
        role: 'toolResult', toolCallId: tool.toolCallId,
        toolName: toolNames.get(tool.toolCallId) ?? 'unknown',
        content: typeof content === 'string' ? [{ type: 'text', text: content || '(no output)' }] : content,
        isError: tool.isError ?? false, timestamp: 0,
      })
      continue
    }
    if (message.role === 'system') {
      // pi-ai has a single systemPrompt slot; a system message that did not
      // supply it folds into a user message to preserve order.
      messages.push({ role: 'user', content: flattenText(message), timestamp: 0 })
      continue
    }
    if (message.role === 'assistant') {
      appendAssistant(message, messages, toolNames, usageContexts, onReplayDegrade)
      continue
    }
    const content = await userContent(message.content, requestImages, resolveImageAccess)
    messages.push({ role: 'user', content, timestamp: 0 })
  }

  return piContext(split.systemPrompt, options, messages, usageContexts)
}

/**
 * Map pi-ai usage (reasoning folded into output by pi-ai).
 * @param usage - cumulative usage from the terminal pi-ai event.
 * @returns harness counts with pi-ai's exact total; cache fields appear only
 *   when non-zero (pi-ai reports zeros, not absence).
 */
export function mapUsage(usage: PiUsage): TokenUsage {
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.totalTokens,
    ...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
    ...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {},
  }
}

/** A failed request with no measured tokens is unknown usage, not an empty context. */
function hasUsage(usage: PiUsage): boolean {
  return usage.input > 0 || usage.output > 0 || usage.cacheRead > 0
    || usage.cacheWrite > 0 || usage.totalTokens > 0
}

// XXX(pi-ai upstream): pi-ai flattens the caught error to `error.message`
// (api/anthropic-messages.js: `errorMessage = error instanceof Error ?
// error.message : JSON.stringify(error)`), discarding the original Error and its
// `cause` chain before it reaches us. undici carries the actionable transport
// detail on `cause` (e.g. `SocketError: other side closed`) but hands the fetch
// wrapper a bare `terminated`, so we are left pattern-matching terse words here.
// If pi-ai ever forwards the original Error (or a fetch/dispatcher hook that lets
// us capture the cause ourselves), classify on `code`/`cause` instead of text.
function classifyPiAiError(message: string): string {
  if (isQuotaExceededError(message)) return QUOTA_EXCEEDED_CODE
  if (/\b(?:401|403)\b/.test(message)) return 'AUTH'
  if (/\b429\b|rate.?limit/i.test(message)) return 'RATE_LIMIT'
  // A rejected request body (gateway or provider size cap): resending the
  // same request cannot succeed, so it is invalid, not transient.
  if (/\b413\b|failed to buffer the request body:\s*length limit exceeded|payload too large|request body too large/i.test(message)) return 'INVALID_REQUEST'
  if (/\b400\b|invalid.?request/i.test(message)) return 'INVALID_REQUEST'
  if (/\b5\d\d\b/.test(message)) return 'SERVER'
  if (/\btime(?:d)?\s*out\b|timeout/i.test(message)) return 'TIMEOUT'
  // A stream truncated before the provider's terminal event: each pi-ai provider
  // throws its own wording when the wire closes mid-response without a terminal
  // event (`… stream ended before message_stop`, `… before a terminal response
  // event`, `… ended without a terminal event`, `Stream ended without
  // finish_reason`). The connection dropped mid-response, so this is a transport
  // truncation, not a model-level error.
  if (/stream ended (?:before|without)\b/i.test(message)) return 'TRANSPORT'
  if (/\b(?:network|connection|socket|fetch)\b|\bECONN[A-Z]+\b/i.test(message)
    || /\b(?:other side closed|HTTP2 request did not get a response|WebSocket closed unexpectedly)\b/i.test(message)
    // undici renders a mid-stream socket drop as a bare `terminated` (its
    // `cause` — the real SocketError — was flattened away upstream); Node's
    // stream layer says `Premature close`.
    || /\bterminated\b|premature close/i.test(message)) {
    return 'TRANSPORT'
  }
  return 'PI_AI_ERROR'
}

/** Prefer raising a clearly small output allowance over compaction advice. */
const MIN_ANSWER_ALLOWANCE = 1_024

/**
 * Map a terminal pi-ai event to the harness finish reason.
 * @param message - the assistant message carried by the `done` or `error` event.
 * @param contextWindow - resolved catalog capacity for usage-based overflow detection.
 * @param reservedMaxTokens - requested output allowance before SDK context clamping.
 * @returns the mapped harness reason. Recognized error text, `stop` usage above
 *   `contextWindow`, and zero-output `length` usage that fills the window map
 *   to `CONTEXT_WINDOW_EXCEEDED`; a `stop` with no content blocks maps to an
 *   `EMPTY_RESPONSE` error. Other empty `length` responses map to `INVALID_REQUEST`
 *   with output-limit or compaction guidance. Terminal `pending` and `deferred`
 *   states map to non-retryable `PI_AI_ERROR` failures.
 */
export function mapStopReason(message: AssistantMessage, contextWindow?: number, reservedMaxTokens?: number): FinishReason {
  const piAiOverflow = isContextOverflow(message, contextWindow)
  const harnessOverflow = message.stopReason === 'error'
    && message.errorMessage !== undefined
    && isContextWindowExceededError(message.errorMessage)
  if (piAiOverflow || harnessOverflow) {
    return {
      kind: 'error',
      failure: {
        message: message.errorMessage ?? `pi-ai detected context overflow for model "${message.model}"`,
        code: CONTEXT_WINDOW_EXCEEDED_CODE,
      },
    }
  }

  switch (message.stopReason) {
    case 'stop':
      // A terminal stop that produced no content blocks is a degenerate
      // provider completion, not a successful (empty) assistant message.
      if (message.content.length === 0) {
        return {
          kind: 'error',
          failure: {
            message: `model "${message.model}" returned a completed response with no content`,
            code: EMPTY_RESPONSE_CODE,
          },
        }
      }
      return { kind: 'stop' }
    case 'length':
      if (message.content.length === 0) {
        const raiseOutputLimit = reservedMaxTokens !== undefined
          && (reservedMaxTokens <= MIN_ANSWER_ALLOWANCE || message.usage.output >= reservedMaxTokens)
        return {
          kind: 'error',
          failure: {
            message: raiseOutputLimit
              ? `model "${message.model}" produced no content at its ${reservedMaxTokens}-token output`
                + ' allowance. Increase this model\'s "max output" in the plugin settings, then retry'
              : `model "${message.model}" produced no content at the output cap`
                + `${contextWindow === undefined ? '' : ` in a ${contextWindow}-token window`}`
                + '. The prompt may leave too little room for an answer. Compact the context (/compact)'
                + ' or lower this model\'s "max output" in the plugin settings, then retry',
            code: 'INVALID_REQUEST',
          },
        }
      }
      return { kind: 'max-tokens' }
    case 'toolUse': return { kind: 'tool-calls' }
    case 'pending': return {
      kind: 'error',
      failure: { message: `pi-ai stream for model "${message.model}" ended pending`, code: 'PI_AI_ERROR' },
    }
    case 'deferred': return {
      kind: 'error',
      failure: { message: `pi-ai deferred response for model "${message.model}" is not supported`, code: 'PI_AI_ERROR' },
    }
    case 'aborted': return {
      kind: 'aborted',
      failure: { message: message.errorMessage ?? 'pi-ai stream aborted', code: 'ABORTED' },
    }
    case 'error': {
      const text = message.errorMessage ?? 'pi-ai stream error'
      return { kind: 'error', failure: { message: text, code: classifyPiAiError(text) } }
    }
  }
}

/**
 * Translate the pi-ai event stream into StreamChunks. pi-ai never throws
 * mid-stream — failures arrive as `error` events, which become error/aborted
 * `finish` chunks (the harness protocol's other error-delivery style).
 * @param events - one assistant turn's pi-ai event stream.
 * @param contextWindow - resolved catalog capacity for usage-based overflow detection.
 * @param callerSignal - caller cancellation state; an aborted caller makes any
 *   in-band terminal error an aborted finish.
 * @param requestedModel - request model identity recorded for durable replay.
 * @param requestedProvider - DSH provider identity recorded for durable replay.
 * @param reservedMaxTokens - requested output allowance before SDK context clamping.
 * @param usageContext - fingerprint of the request whose usage may budget a later turn.
 * @returns the harness chunks, ending with measured `usage` then `finish`;
 *   failures with no measured tokens omit usage to preserve context pressure. Throws
 *   `LlmError` (`STREAM_CLOSED`) if the source ends without a terminal event.
 */
export async function* toStreamChunks(
  events: AsyncIterable<AssistantMessageEvent>,
  contextWindow?: number,
  callerSignal?: AbortSignal,
  requestedModel?: string,
  requestedProvider?: string,
  reservedMaxTokens?: number,
  usageContext?: string,
): AsyncGenerator<StreamChunk> {
  // pi-ai contentIndex ↔ our block index map 1:1 (both count blocks from 0
  // in stream order), but we track ids per index for tool calls.
  const toolIds = new Map<number, { id: string; name: string }>()

  for await (const event of events) {
    switch (event.type) {
      case 'start':
        break
      case 'text_start':
        yield { type: 'block-start', index: event.contentIndex, blockType: 'text' }
        break
      case 'text_delta':
        yield { type: 'text-delta', index: event.contentIndex, text: event.delta }
        break
      case 'text_end':
        yield { type: 'block-end', index: event.contentIndex, block: { type: 'text', text: event.content } }
        break
      case 'thinking_start':
        yield { type: 'block-start', index: event.contentIndex, blockType: 'reasoning' }
        break
      case 'thinking_delta':
        yield { type: 'reasoning-delta', index: event.contentIndex, text: event.delta }
        break
      case 'thinking_end':
        yield { type: 'block-end', index: event.contentIndex, block: { type: 'reasoning', text: event.content } }
        break
      case 'toolcall_start': {
        // The id/name live on the partial's content at this index.
        const partial = event.partial.content[event.contentIndex]
        const id = partial?.type === 'toolCall' ? partial.id : ''
        const name = partial?.type === 'toolCall' ? partial.name : ''
        toolIds.set(event.contentIndex, { id, name })
        yield { type: 'block-start', index: event.contentIndex, blockType: 'tool-call' }
        break
      }
      case 'toolcall_delta': {
        const known = toolIds.get(event.contentIndex)
        yield {
          type: 'tool-call-delta',
          index: event.contentIndex,
          id: brandString<ToolCallId>(known?.id ?? ''),
          ...known?.name !== undefined && known.name.length > 0 ? { name: known.name } : {},
          argumentsDelta: event.delta,
        }
        break
      }
      case 'toolcall_end':
        yield {
          type: 'block-end',
          index: event.contentIndex,
          block: {
            type: 'tool-call',
            id: brandString<ToolCallId>(event.toolCall.id),
            name: event.toolCall.name,
            // pi-ai hands back the PARSED arguments; the harness vocabulary
            // keeps the raw string.
            arguments: JSON.stringify(event.toolCall.arguments),
          },
        }
        break
      case 'done': {
        const reason = mapStopReason(event.message, contextWindow, reservedMaxTokens)
        if (reason.kind !== 'error' || hasUsage(event.message.usage)) {
          yield { type: 'usage', usage: mapUsage(event.message.usage) }
        }
        yield {
          type: 'finish',
          reason,
          replayState: toPiReplayState(event.message, requestedModel, requestedProvider, usageContext),
        }
        return
      }
      case 'error':
        // In-stream error delivery (pi-ai's style) → error finish chunk
        // (the harness's other sanctioned error path besides throwing).
        if (hasUsage(event.error.usage)) yield { type: 'usage', usage: mapUsage(event.error.usage) }
        yield {
          type: 'finish',
          reason: mapStopReason(
            callerSignal?.aborted ? { ...event.error, stopReason: 'aborted' } : event.error,
            contextWindow,
            reservedMaxTokens,
          ),
        }
        return
      default: {
        const unsupported: never = event
        throw new LlmError(`Unsupported pi-ai stream event: ${(unsupported as { type?: unknown }).type}`, 'UNSUPPORTED_CONTENT')
      }
    }
  }
  throw new LlmError('pi-ai event stream ended without done/error', 'STREAM_CLOSED')
}

export {
  DEFAULT_MAX_REQUEST_IMAGE_BYTES,
  DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
} from './contracts.ts'
