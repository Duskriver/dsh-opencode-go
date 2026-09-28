var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __using = (stack, value, async) => {
  if (value != null) {
    if (typeof value !== "object" && typeof value !== "function") __typeError("Object expected");
    var dispose, inner;
    if (async) dispose = value[__knownSymbol("asyncDispose")];
    if (dispose === void 0) {
      dispose = value[__knownSymbol("dispose")];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") __typeError("Object not disposable");
    if (inner) dispose = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    stack.push([async, dispose, value]);
  } else if (async) {
    stack.push([async]);
  }
  return value;
};
var __callDispose = (stack, error, hasError) => {
  var E = typeof SuppressedError === "function" ? SuppressedError : function(e, s, m, _) {
    return _ = Error(m), _.name = "SuppressedError", _.error = e, _.suppressed = s, _;
  };
  var fail = (e) => error = hasError ? new E(e, error, "An error was suppressed during disposal") : (hasError = true, e);
  var next = (it) => {
    while (it = stack.pop()) {
      try {
        var result = it[1] && it[1].call(it[2]);
        if (it[0]) return Promise.resolve(result).then(next, (e) => (fail(e), next()));
      } catch (e) {
        fail(e);
      }
    }
    if (hasError) throw error;
  };
  return next();
};

// src/index.ts
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { LlmError as LlmError7, assertUsableApiKey, resolveImageAttachmentAccess } from "@deepseek-ai/dsh-llm";

// src/adapter.ts
import { randomUUID } from "node:crypto";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import {
  LlmAdapter,
  LlmError as LlmError6,
  ReasoningEffortId,
  attributionHeaders as attributionHeaders2,
  contentHasImage as contentHasImage2
} from "@deepseek-ai/dsh-llm";

// src/conversion/context.ts
import { brandString } from "@deepseek-ai/dsh-brand";
import { contentHasImage, LlmError as LlmError3, offloadedImageText, requestImageHandleText } from "@deepseek-ai/dsh-llm";

// src/conversion/replay.ts
import { LlmError } from "@deepseek-ai/dsh-llm";
function parseArguments(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
  }
  return {};
}
function emptyPiUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
  };
}
function toPiReplayState(message, requestedModel = message.model) {
  const responseModel = message.api === "anthropic-messages" && message.model !== requestedModel ? message.model : message.responseModel;
  const response = {
    kind: "pi-ai",
    version: 2,
    api: message.api,
    provider: message.provider,
    model: requestedModel,
    ...responseModel === void 0 ? {} : { responseModel },
    ...message.responseId === void 0 ? {} : { responseId: message.responseId },
    ...message.providerThinkingLevel === void 0 ? {} : { providerThinkingLevel: message.providerThinkingLevel },
    stopReason: message.stopReason
  };
  return {
    response,
    blocks: message.content.map((block) => {
      switch (block.type) {
        case "text":
          return {
            type: "text",
            ...block.textSignature === void 0 ? {} : { textSignature: block.textSignature }
          };
        case "thinking":
          return {
            type: "reasoning",
            ...block.thinkingSignature === void 0 ? {} : { thinkingSignature: block.thinkingSignature },
            ...block.redacted === void 0 ? {} : { redacted: block.redacted }
          };
        case "toolCall":
          return {
            type: "tool-call",
            ...block.thoughtSignature === void 0 ? {} : { thoughtSignature: block.thoughtSignature }
          };
      }
    })
  };
}
function invalidReplay(message) {
  throw new LlmError(`invalid pi-ai replay state: ${message}`, "INVALID_REPLAY_STATE");
}
function readReplayState(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalidReplay("expected a replay envelope");
  const envelope = value;
  const rawResponse = envelope["response"];
  if (typeof rawResponse !== "object" || rawResponse === null || Array.isArray(rawResponse)) return invalidReplay("expected a response object");
  const response = rawResponse;
  if (response["kind"] !== "pi-ai") return invalidReplay("unknown state kind");
  if (response["version"] !== 2) return invalidReplay(`unsupported version ${String(response["version"])}`);
  for (const key of ["api", "provider", "model"]) {
    if (typeof response[key] !== "string" || response[key].length === 0) return invalidReplay(`${key} must be a non-empty string`);
  }
  if (!["stop", "length", "toolUse", "error", "aborted"].includes(String(response["stopReason"]))) {
    return invalidReplay("unknown stopReason");
  }
  if (response["responseModel"] !== void 0 && typeof response["responseModel"] !== "string") return invalidReplay("responseModel must be a string");
  if (response["responseId"] !== void 0 && typeof response["responseId"] !== "string") return invalidReplay("responseId must be a string");
  if (response["providerThinkingLevel"] !== void 0 && typeof response["providerThinkingLevel"] !== "string") return invalidReplay("providerThinkingLevel must be a string");
  const blocks = envelope["blocks"];
  if (!Array.isArray(blocks)) return invalidReplay("blocks must be an array");
  for (const [index, value2] of blocks.entries()) {
    if (typeof value2 !== "object" || value2 === null || Array.isArray(value2)) return invalidReplay(`block ${index} must be an object`);
    const block = value2;
    if (!["text", "reasoning", "tool-call"].includes(String(block["type"]))) return invalidReplay(`block ${index} has an unknown type`);
    for (const signature of ["textSignature", "thinkingSignature", "thoughtSignature"]) {
      if (block[signature] !== void 0 && typeof block[signature] !== "string") return invalidReplay(`block ${index} ${signature} must be a string`);
    }
    if (block["redacted"] !== void 0 && typeof block["redacted"] !== "boolean") return invalidReplay(`block ${index} redacted must be boolean`);
  }
  return {
    response,
    blocks
  };
}
function foreignAssistant(message) {
  const source = message.source.kind === "model" ? message.source : void 0;
  const content = [];
  for (const block of message.content) {
    switch (block.type) {
      case "text":
        content.push({ type: "text", text: block.text });
        break;
      case "reasoning":
        content.push({ type: "thinking", thinking: block.text });
        break;
      case "tool-call":
        content.push({
          type: "toolCall",
          id: block.id,
          name: block.name,
          arguments: parseArguments(block.arguments)
        });
        break;
      case "image":
        throw new LlmError("pi-ai chat history cannot represent structured assistant image output", "UNSUPPORTED_CONTENT");
      default:
        break;
    }
  }
  return {
    role: "assistant",
    content,
    // Deliberately never equals a catalog API: absent replay state is foreign
    // even if source names the same provider/model as this request.
    api: "dsh-foreign",
    provider: source?.provider ?? "dsh-foreign",
    model: source?.model ?? "dsh-foreign",
    usage: emptyPiUsage(),
    stopReason: content.some((piece) => piece.type === "toolCall") ? "toolUse" : "stop",
    timestamp: 0
  };
}
function replayedAssistant(message, source, rawState) {
  const state = readReplayState(rawState);
  if (state.response.provider !== source.provider) return invalidReplay("provider does not match assistant source");
  if (state.response.model !== source.model) return invalidReplay("model does not match assistant source");
  if (state.blocks.length !== message.content.length) return invalidReplay("block count does not match assistant content");
  const content = message.content.map((block, index) => {
    const replay = state.blocks[index];
    if (replay === void 0 || replay.type !== block.type) return invalidReplay(`block ${index} does not match assistant content`);
    switch (block.type) {
      case "text":
        return {
          type: "text",
          text: block.text,
          ...replay.type === "text" && replay.textSignature !== void 0 ? { textSignature: replay.textSignature } : {}
        };
      case "reasoning":
        return {
          type: "thinking",
          thinking: block.text,
          ...replay.type === "reasoning" && replay.thinkingSignature !== void 0 ? { thinkingSignature: replay.thinkingSignature } : {},
          ...replay.type === "reasoning" && replay.redacted !== void 0 ? { redacted: replay.redacted } : {}
        };
      case "tool-call":
        return {
          type: "toolCall",
          id: block.id,
          name: block.name,
          arguments: parseArguments(block.arguments),
          ...replay.type === "tool-call" && replay.thoughtSignature !== void 0 ? { thoughtSignature: replay.thoughtSignature } : {}
        };
      /* v8 ignore next -- readReplayState rejects unknown replay tags, so an equal plugin-added Harness tag cannot reach this switch */
      default:
        return invalidReplay(`block ${index} has an unsupported Harness type`);
    }
  });
  return {
    role: "assistant",
    content,
    api: state.response.api,
    provider: state.response.provider,
    // Anthropic reports aliases and fallbacks as model, unlike Completions' informational responseModel.
    model: state.response.api === "anthropic-messages" ? state.response.responseModel ?? state.response.model : state.response.model,
    ...state.response.responseModel === void 0 ? {} : { responseModel: state.response.responseModel },
    ...state.response.responseId === void 0 ? {} : { responseId: state.response.responseId },
    ...state.response.providerThinkingLevel === void 0 ? {} : { providerThinkingLevel: state.response.providerThinkingLevel },
    usage: emptyPiUsage(),
    stopReason: state.response.stopReason,
    timestamp: 0
  };
}
function toPiAssistant(message, onDegrade) {
  const source = message.source;
  if (source.kind !== "model" || source.replayState === void 0) return foreignAssistant(message);
  try {
    return replayedAssistant(message, source, source.replayState);
  } catch (error) {
    if (!(error instanceof LlmError) || error.code !== "INVALID_REPLAY_STATE") throw error;
    onDegrade?.(error.message);
    return foreignAssistant(message);
  }
}

// src/conversion/context.ts
import { requestImageDimensions } from "@deepseek-ai/dsh-attachment";

// src/conversion/config.ts
var DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;

// src/conversion/image-offload.ts
import * as llm from "@deepseek-ai/dsh-llm";
var api = llm;
function projectRequestImages(messages, policy) {
  if (api.requiredImageOffload !== void 0 && api.projectOffloadedImages !== void 0) {
    if (!policy.exact) return messages;
    if (policy.maxBytes !== void 0 || policy.maxImages !== void 0) {
      const offloadImages = api.requiredImageOffload(
        messages,
        { representation: "base64", maxBytes: policy.maxBytes, maxImages: policy.maxImages, countQuantum: 1 },
        (block) => policy.byteLength(block.attachment)
      );
      if (offloadImages > 0) {
        throw new llm.LlmError(
          `pi-ai request images exceed the configured image count or base64 payload bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
          api.IMAGE_OFFLOAD_REQUIRED_CODE ?? "IMAGE_OFFLOAD_REQUIRED",
          { offloadImages }
        );
      }
    }
    return api.projectOffloadedImages(messages, policy.placeholder);
  }
  if (api.offloadRequestImagesWithPolicy === void 0) {
    throw new llm.LlmError("The DSH host has no supported image offload API", "UNSUPPORTED_CONTENT");
  }
  return api.offloadRequestImagesWithPolicy(messages, {
    representation: "base64",
    byteQuantum: 1,
    countQuantum: 1,
    maxImages: policy.maxImages,
    maxBytes: policy.maxBytes,
    byteLength: policy.byteLength,
    placeholder: policy.placeholder
  });
}

// src/conversion/context.ts
function flattenText(message) {
  return message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
}
function toolResultText(blocks) {
  return blocks.map((block) => block.type === "text" ? block.text : block.type === "tool-result" ? toolResultText(block.content) : "").join("");
}
function toolMessage(message) {
  if (message.role !== "tool") return void 0;
  return message;
}
function assertSupportedHistory(messages) {
  for (const message of messages) {
    if (message.role === "developer") throw new LlmError3("Developer messages are not supported yet", "UNSUPPORTED_CONTENT");
    if (message.content.some((block) => block.type === "tool-addition" || block.type === "tool-removal")) {
      throw new LlmError3("Tool-change blocks require developer role", "UNSUPPORTED_CONTENT");
    }
    if (message.role !== "user" && !toolMessage(message) && contentHasImage(message.content)) {
      throw new LlmError3(
        `pi-ai cannot represent an image in an in-history ${message.role} message`,
        "UNSUPPORTED_CONTENT"
      );
    }
  }
}
async function userContent(blocks, requestImages, resolveImageAccess) {
  const content = [];
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        if (block.text.length > 0) content.push({ type: "text", text: block.text });
        break;
      case "image": {
        const version = requestImages.get(block.attachment.attachmentId);
        content.push({
          type: "text",
          text: requestImageHandleText(block.attachment, version, resolveImageAccess(block.attachment))
        });
        content.push({
          type: "image",
          data: Buffer.from(version.data).toString("base64"),
          mimeType: version.mediaType
        });
        break;
      }
      case "tool-result":
        {
          const nested = await userContent(block.content, requestImages, resolveImageAccess);
          if (typeof nested === "string") {
            if (nested.length > 0) content.push({ type: "text", text: nested });
          } else {
            content.push(...nested);
          }
        }
        break;
      default:
        break;
    }
  }
  if (content.every((block) => block.type === "text")) return content.map((block) => block.text).join("");
  return content;
}
function collectImageRefs(blocks, refs) {
  for (const block of blocks) {
    if (block.type === "image") {
      if (block.offloaded !== true) refs.set(block.attachment.attachmentId, block.attachment);
    } else if (block.type === "tool-result") {
      collectImageRefs(block.content, refs);
    }
  }
}
async function prepareRequestImages(messages, attachments, budget, signal) {
  const refs = /* @__PURE__ */ new Map();
  for (const message of messages) collectImageRefs(message.content, refs);
  const orderedRefs = [...refs.values()];
  const prepared = await Promise.all(orderedRefs.map(
    (ref) => attachments.readImageRequest(ref, requestImageTarget(ref, budget), signal)
  ));
  const versions = /* @__PURE__ */ new Map();
  for (const [index, ref] of orderedRefs.entries()) {
    versions.set(ref.attachmentId, prepared[index]);
  }
  return versions;
}
function toolsOf(options) {
  if (options.tools?.some((tool) => tool.deferLoading === true)) {
    throw new LlmError3("Deferred tool loading is not supported yet", "UNSUPPORTED_CONTENT");
  }
  return options.tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
    // ToolSchema.parameters is a JSON Schema object; pi-ai's TSchema
    // (TypeBox) is structurally JSON Schema, so it assigns directly.
    parameters: tool.parameters
  }));
}
function splitSystemPrompt(options) {
  if (options.system !== void 0) return { systemPrompt: options.system, messages: options.messages };
  const [first, ...rest] = options.messages;
  if (first?.role !== "system") return { systemPrompt: void 0, messages: options.messages };
  const text = flattenText(first);
  return { systemPrompt: text.length > 0 ? text : void 0, messages: rest };
}
function piContext(systemPrompt, options, messages) {
  const tools = toolsOf(options);
  return {
    ...systemPrompt !== void 0 ? { systemPrompt } : {},
    messages,
    ...tools !== void 0 && tools.length > 0 ? { tools } : {}
  };
}
function appendAssistant(message, messages, toolNames, onReplayDegrade) {
  const assistant = toPiAssistant(message, onReplayDegrade);
  for (const block of assistant.content) {
    if (block.type === "toolCall") toolNames.set(brandString(block.id), block.name);
  }
  messages.push(assistant);
}
function textOnlyContext(options, onReplayDegrade) {
  assertSupportedHistory(options.messages);
  const split = splitSystemPrompt(options);
  const toolNames = /* @__PURE__ */ new Map();
  const messages = [];
  for (const message of split.messages) {
    if (contentHasImage(message.content)) {
      throw new LlmError3("pi-ai image conversion requires the durable attachment service", "UNSUPPORTED_CONTENT");
    }
    const tool = toolMessage(message);
    if (tool) {
      messages.push({
        role: "toolResult",
        toolCallId: tool.toolCallId,
        toolName: toolNames.get(tool.toolCallId) ?? "unknown",
        content: [{ type: "text", text: toolResultText(tool.content) || "(no output)" }],
        isError: tool.isError ?? false,
        timestamp: 0
      });
      continue;
    }
    if (message.role === "system") {
      messages.push({ role: "user", content: flattenText(message), timestamp: 0 });
      continue;
    }
    if (message.role === "assistant") {
      appendAssistant(message, messages, toolNames, onReplayDegrade);
      continue;
    }
    const text = flattenText(message);
    const results = message.content.filter((block) => block.type === "tool-result");
    if (text.length > 0 || results.length === 0) messages.push({ role: "user", content: text, timestamp: 0 });
    for (const result of results) {
      messages.push({
        role: "toolResult",
        toolCallId: result.toolCallId,
        toolName: toolNames.get(result.toolCallId) ?? "unknown",
        content: [{
          type: "text",
          text: toolResultText(result.content) || "(no output)"
        }],
        isError: result.isError ?? false,
        timestamp: 0
      });
    }
  }
  return piContext(split.systemPrompt, options, messages);
}
function requestImageTarget(ref, budget) {
  return {
    ...requestImageDimensions(ref.width, ref.height, budget.maxPixels),
    maxPixels: budget.maxPixels,
    maxBytes: budget.maxBytes
  };
}
function toPiContext(options, images, onReplayDegrade) {
  return images === void 0 ? textOnlyContext(options, onReplayDegrade) : toPiContextWithImages(options, images, onReplayDegrade);
}
async function toPiContextWithImages(options, images, onReplayDegrade) {
  const { attachments, resolveImageAccess, maxImages, maxRequestImageBytes } = images;
  const requestImagePolicy = images.requestImagePolicy ?? {
    maxPixels: DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
    maxBytes: DEFAULT_REQUEST_IMAGE_MAX_BYTES
  };
  assertSupportedHistory(options.messages);
  const split = splitSystemPrompt(options);
  const projection = {
    maxImages,
    maxBytes: maxRequestImageBytes,
    placeholder: (ref) => offloadedImageText(ref, resolveImageAccess(ref))
  };
  const requestMessages = projectRequestImages(split.messages, {
    ...projection,
    exact: false,
    byteLength: (ref) => Math.min(ref.bytes, requestImagePolicy.maxBytes)
  });
  const requestImages = await prepareRequestImages(requestMessages, attachments, requestImagePolicy, options.signal);
  const exactMessages = projectRequestImages(requestMessages, {
    ...projection,
    exact: true,
    byteLength: (ref) => requestImages.get(ref.attachmentId).bytes
  });
  const toolNames = /* @__PURE__ */ new Map();
  const messages = [];
  for (const message of exactMessages) {
    const tool = toolMessage(message);
    if (tool) {
      const content2 = await userContent(tool.content, requestImages, resolveImageAccess);
      messages.push({
        role: "toolResult",
        toolCallId: tool.toolCallId,
        toolName: toolNames.get(tool.toolCallId) ?? "unknown",
        content: typeof content2 === "string" ? [{ type: "text", text: content2 || "(no output)" }] : content2,
        isError: tool.isError ?? false,
        timestamp: 0
      });
      continue;
    }
    if (message.role === "system") {
      messages.push({ role: "user", content: flattenText(message), timestamp: 0 });
      continue;
    }
    if (message.role === "assistant") {
      appendAssistant(message, messages, toolNames, onReplayDegrade);
      continue;
    }
    const regular = message.content.filter((block) => block.type !== "tool-result");
    const content = await userContent(regular, requestImages, resolveImageAccess);
    const results = message.content.filter((block) => block.type === "tool-result");
    if (content.length > 0 || results.length === 0) {
      messages.push({ role: "user", content, timestamp: 0 });
    }
    for (const result of results) {
      const resultContent = await userContent(result.content, requestImages, resolveImageAccess);
      messages.push({
        role: "toolResult",
        toolCallId: result.toolCallId,
        toolName: toolNames.get(result.toolCallId) ?? "unknown",
        content: typeof resultContent === "string" ? [{ type: "text", text: resultContent || "(no output)" }] : resultContent,
        isError: result.isError ?? false,
        timestamp: 0
      });
    }
  }
  return piContext(split.systemPrompt, options, messages);
}

// src/conversion/stream.ts
import { brandString as brandString2 } from "@deepseek-ai/dsh-brand";
import { CONTEXT_WINDOW_EXCEEDED_CODE, EMPTY_RESPONSE_CODE, isContextWindowExceededError, isQuotaExceededError, LlmError as LlmError4, QUOTA_EXCEEDED_CODE } from "@deepseek-ai/dsh-llm";
import { isContextOverflow } from "@earendil-works/pi-ai";
function mapUsage(usage) {
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.totalTokens,
    ...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
    ...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {}
  };
}
function classifyPiAiError(message) {
  if (/\b(?:401|403)\b/.test(message)) return "AUTH";
  if (isQuotaExceededError(message)) return QUOTA_EXCEEDED_CODE;
  if (/\b429\b|rate.?limit/i.test(message)) return "RATE_LIMIT";
  if (/\b413\b|failed to buffer the request body:\s*length limit exceeded|payload too large|request body too large/i.test(message)) return "INVALID_REQUEST";
  if (/\b400\b|invalid.?request/i.test(message)) return "INVALID_REQUEST";
  if (/\b5\d\d\b/.test(message)) return "SERVER";
  if (/\btime(?:d)?\s*out\b|timeout/i.test(message)) return "TIMEOUT";
  if (/stream ended (?:before|without)\b/i.test(message)) return "TRANSPORT";
  if (/\b(?:network|connection|socket|fetch)\b|\bECONN[A-Z]+\b/i.test(message) || /\b(?:other side closed|HTTP2 request did not get a response|WebSocket closed unexpectedly)\b/i.test(message) || /\bterminated\b|premature close/i.test(message)) {
    return "TRANSPORT";
  }
  return "PI_AI_ERROR";
}
function mapStopReason(message, contextWindow) {
  const piAiOverflow = isContextOverflow(message, contextWindow);
  const harnessOverflow = message.stopReason === "error" && message.errorMessage !== void 0 && isContextWindowExceededError(message.errorMessage);
  if (piAiOverflow || harnessOverflow) {
    return {
      kind: "error",
      failure: {
        message: message.errorMessage ?? `pi-ai detected context overflow for model "${message.model}"`,
        code: CONTEXT_WINDOW_EXCEEDED_CODE
      }
    };
  }
  switch (message.stopReason) {
    case "stop":
      if (message.content.length === 0) {
        return {
          kind: "error",
          failure: {
            message: `model "${message.model}" returned a completed response with no content`,
            code: EMPTY_RESPONSE_CODE
          }
        };
      }
      return { kind: "stop" };
    case "length":
      return { kind: "max-tokens" };
    case "toolUse":
      return { kind: "tool-calls" };
    case "pending":
      return {
        kind: "error",
        failure: { message: `pi-ai stream for model "${message.model}" ended pending`, code: "PI_AI_ERROR" }
      };
    case "deferred":
      return {
        kind: "error",
        failure: { message: `pi-ai deferred response for model "${message.model}" is not supported`, code: "PI_AI_ERROR" }
      };
    case "aborted":
      return {
        kind: "aborted",
        failure: { message: message.errorMessage ?? "pi-ai stream aborted", code: "ABORTED" }
      };
    case "error": {
      const text = message.errorMessage ?? "pi-ai stream error";
      return { kind: "error", failure: { message: text, code: classifyPiAiError(text) } };
    }
  }
}
async function* toStreamChunks(events, contextWindow, callerSignal, requestedModel) {
  const toolIds = /* @__PURE__ */ new Map();
  for await (const event of events) {
    switch (event.type) {
      case "start":
        break;
      case "text_start":
        yield { type: "block-start", index: event.contentIndex, blockType: "text" };
        break;
      case "text_delta":
        yield { type: "text-delta", index: event.contentIndex, text: event.delta };
        break;
      case "text_end":
        yield { type: "block-end", index: event.contentIndex, block: { type: "text", text: event.content } };
        break;
      case "thinking_start":
        yield { type: "block-start", index: event.contentIndex, blockType: "reasoning" };
        break;
      case "thinking_delta":
        yield { type: "reasoning-delta", index: event.contentIndex, text: event.delta };
        break;
      case "thinking_end":
        yield { type: "block-end", index: event.contentIndex, block: { type: "reasoning", text: event.content } };
        break;
      case "toolcall_start": {
        const partial = event.partial.content[event.contentIndex];
        const id = partial?.type === "toolCall" ? partial.id : "";
        const name2 = partial?.type === "toolCall" ? partial.name : "";
        toolIds.set(event.contentIndex, { id, name: name2 });
        yield { type: "block-start", index: event.contentIndex, blockType: "tool-call" };
        break;
      }
      case "toolcall_delta": {
        const known = toolIds.get(event.contentIndex);
        yield {
          type: "tool-call-delta",
          index: event.contentIndex,
          id: brandString2(known?.id ?? ""),
          ...known?.name !== void 0 && known.name.length > 0 ? { name: known.name } : {},
          argumentsDelta: event.delta
        };
        break;
      }
      case "toolcall_end":
        yield {
          type: "block-end",
          index: event.contentIndex,
          block: {
            type: "tool-call",
            id: brandString2(event.toolCall.id),
            name: event.toolCall.name,
            // pi-ai hands back the PARSED arguments; the harness vocabulary
            // keeps the raw string.
            arguments: JSON.stringify(event.toolCall.arguments)
          }
        };
        break;
      case "done":
        yield { type: "usage", usage: mapUsage(event.message.usage) };
        yield {
          type: "finish",
          reason: mapStopReason(event.message, contextWindow),
          replayState: toPiReplayState(event.message, requestedModel)
        };
        return;
      case "error":
        yield { type: "usage", usage: mapUsage(event.error.usage) };
        yield {
          type: "finish",
          reason: mapStopReason(
            callerSignal?.aborted ? { ...event.error, stopReason: "aborted" } : event.error,
            contextWindow
          )
        };
        return;
    }
  }
  throw new LlmError4("pi-ai event stream ended without done/error", "STREAM_CLOSED");
}

// src/adapter.ts
import { idleWatchdog, timeoutOf } from "@deepseek-ai/dsh-timeout";

// src/catalog.ts
import { createProvider } from "@earendil-works/pi-ai";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { attributionHeaders, LlmError as LlmError5 } from "@deepseek-ai/dsh-llm";

// src/models-contract.ts
function isModelEnabled(model, modelVisibility) {
  if (model.configurationMissing) return false;
  const enabled = modelVisibility && Object.hasOwn(modelVisibility, model.id) ? modelVisibility[model.id] : void 0;
  return typeof enabled === "boolean" ? enabled : !model.deprecated;
}
function validReleaseDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function isNewModel(model, now = Date.now()) {
  if (model.deprecated || !validReleaseDate(model.releaseDate)) return false;
  const days = Math.floor(now / 864e5) - Date.parse(model.releaseDate) / 864e5;
  return days >= 0 && days < 7;
}
function sortModels(models, now = Date.now()) {
  const rank = (model) => model.deprecated ? 2 : isNewModel(model, now) ? 0 : 1;
  return [...models].sort((a, b) => rank(a) - rank(b) || (isNewModel(a, now) && isNewModel(b, now) ? b.releaseDate.localeCompare(a.releaseDate) : 0));
}
function parseGoModels(value) {
  if (!Array.isArray(value)) throw new Error("Invalid OpenCode Go model list");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid OpenCode Go model");
    const row = entry;
    if (typeof row.id !== "string" || !row.id) throw new Error("Missing OpenCode Go model id");
    const model = { id: row.id };
    if (typeof row.name === "string") model.name = row.name;
    for (const key of ["contextWindow", "maxTokens"]) {
      if (typeof row[key] === "number" && Number.isSafeInteger(row[key]) && row[key] > 0) model[key] = row[key];
    }
    if (typeof row.deprecated === "boolean") model.deprecated = row.deprecated;
    if (typeof row.configurationMissing === "boolean") model.configurationMissing = row.configurationMissing;
    if (validReleaseDate(row.releaseDate)) model.releaseDate = row.releaseDate;
    return model;
  });
}
function parseGoModelCatalog(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid OpenCode Go model catalog");
  const catalog = value;
  if (typeof catalog.stale !== "boolean" || catalog.error !== void 0 && typeof catalog.error !== "string") {
    throw new Error("Invalid OpenCode Go model catalog status");
  }
  return {
    models: parseGoModels(catalog.models),
    stale: catalog.stale,
    ...catalog.error === void 0 ? {} : { error: catalog.error },
    ...catalog.sources === void 0 ? {} : { sources: parseSources(catalog.sources) }
  };
}
function parseSources(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid OpenCode Go catalog sources");
  const sources = value;
  const parse = (value2) => {
    if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error("Invalid OpenCode Go catalog source status");
    const source = value2;
    if (source.updatedAt !== void 0 && (typeof source.updatedAt !== "number" || !Number.isSafeInteger(source.updatedAt) || source.updatedAt < 0 || source.updatedAt > 864e13)) {
      throw new Error("Invalid OpenCode Go catalog source timestamp");
    }
    if (source.error !== void 0 && typeof source.error !== "string") throw new Error("Invalid OpenCode Go catalog source error");
    return {
      ...source.updatedAt === void 0 ? {} : { updatedAt: source.updatedAt },
      ...source.error === void 0 ? {} : { error: source.error }
    };
  };
  return { listing: parse(sources.listing), metadata: parse(sources.metadata) };
}
var codec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#GoModelCatalog",
  schema: { parse: parseGoModelCatalog },
  create: () => ({ parse: parseGoModelCatalog })
};
var modelsRemote = {
  package: "dsh-opencode-go",
  descriptors: [{
    id: "dsh-opencode-go#opencodeGoModels/read",
    service: "opencodeGoModels",
    namespace: "opencodeGoModels",
    method: "read",
    invocation: { kind: "direct" },
    parameters: [],
    result: codec
  }]
};

// src/model-metadata.ts
var MODEL_METADATA_URL = "https://models.dev/api.json";
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function positiveInteger(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`missing or invalid ${field}`);
  }
  return value;
}
function rates(value) {
  const cost = record(value);
  const rate = (key) => {
    const value2 = cost[key];
    return typeof value2 === "number" && Number.isFinite(value2) && value2 >= 0 ? value2 : 0;
  };
  return { input: rate("input"), output: rate("output"), cacheRead: rate("cache_read"), cacheWrite: rate("cache_write") };
}
var LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
function thinkingLevels(metadata, known) {
  if (!Array.isArray(metadata.reasoning_options) && known?.thinkingLevelMap !== void 0) return known.thinkingLevelMap;
  const map = Object.fromEntries(LEVELS.map((level) => [level, null]));
  for (const item of Array.isArray(metadata.reasoning_options) ? metadata.reasoning_options : []) {
    const option = record(item);
    if (option.type === "toggle" || option.type === "budget_tokens") {
      map.off = "off";
      map.high = "high";
    }
    if (option.type !== "effort" || !Array.isArray(option.values)) continue;
    for (const value of option.values) {
      const level = value === "none" ? "off" : value;
      if (LEVELS.includes(level)) map[level] = String(value);
    }
  }
  if (known?.reasoning && known.thinkingLevelMap?.off !== null) map.off ??= known.thinkingLevelMap?.off ?? "off";
  return map;
}
function modelBaseURL(api2, baseURL) {
  const base = baseURL.replace(/\/+$/, "");
  return api2 === "anthropic-messages" ? base.replace(/\/v1$/, "") : base;
}
function readModelMetadata(body, baseURL, builtin) {
  const provider = record(record(body)["opencode-go"]);
  if (provider.models === null || typeof provider.models !== "object" || Array.isArray(provider.models)) {
    throw new Error("models.dev has no opencode-go models object");
  }
  const entries = record(provider.models);
  const models = /* @__PURE__ */ new Map();
  const errors = /* @__PURE__ */ new Map();
  const details = /* @__PURE__ */ new Map();
  for (const [id, value] of Object.entries(entries)) {
    const data = record(value);
    details.set(id, {
      deprecated: data.status === "deprecated",
      ...validReleaseDate(data.release_date) ? { releaseDate: data.release_date } : {}
    });
    try {
      const metadata = record(value);
      const npm = record(metadata.provider).npm ?? provider.npm;
      const api2 = npm === "@ai-sdk/anthropic" ? "anthropic-messages" : npm === "@ai-sdk/openai" ? "openai-responses" : npm === "@ai-sdk/openai-compatible" ? "openai-completions" : void 0;
      if (api2 === void 0) throw new Error(`unsupported model protocol ${String(npm)}`);
      const limit = record(metadata.limit);
      const input = record(metadata.modalities).input;
      if (!Array.isArray(input) || !input.includes("text")) throw new Error("missing text input modality");
      if (typeof metadata.reasoning !== "boolean") throw new Error("missing reasoning capability");
      const exact = builtin.get(id);
      const family = typeof metadata.family === "string" ? Object.keys(entries).find((key) => record(entries[key]).family === metadata.family && builtin.get(key)?.api === api2) : void 0;
      const known = exact?.api === api2 ? exact : family === void 0 ? void 0 : builtin.get(family);
      const compat = api2 === "openai-completions" ? {
        supportsStore: false,
        supportsDeveloperRole: false,
        maxTokensField: "max_tokens",
        ...record(metadata.interleaved).field === "reasoning_content" ? { requiresReasoningContentOnAssistantMessages: true } : {},
        ...known?.compat
      } : api2 === "openai-responses" ? { sessionAffinityFormat: "openai-nosession", ...known?.compat } : { ...known?.compat };
      const cost = rates(metadata.cost);
      const tiers = record(metadata.cost).tiers;
      if (Array.isArray(tiers)) {
        cost.tiers = tiers.flatMap((item) => {
          const tier = record(record(item).tier);
          return tier.type === "context" && typeof tier.size === "number" && Number.isSafeInteger(tier.size) && tier.size > 0 ? [{ ...rates(item), inputTokensAbove: tier.size }] : [];
        }).sort((a, b) => a.inputTokensAbove - b.inputTokensAbove);
      }
      models.set(id, {
        id,
        name: typeof metadata.name === "string" && metadata.name.length > 0 ? metadata.name : id,
        provider: "opencode-go",
        api: api2,
        baseUrl: modelBaseURL(api2, baseURL),
        reasoning: metadata.reasoning,
        thinkingLevelMap: thinkingLevels(metadata, known),
        input: input.includes("image") ? ["text", "image"] : ["text"],
        contextWindow: positiveInteger(limit.context, "context limit"),
        maxTokens: positiveInteger(limit.output, "output limit"),
        cost,
        compat
      });
    } catch (error) {
      errors.set(id, error instanceof Error ? error.message : String(error));
    }
  }
  return { models, errors, details };
}

// src/json-response.ts
import { setTimeout as delay } from "node:timers/promises";
var RETRYABLE_CODES = /* @__PURE__ */ new Set(["ECONNRESET", "EPIPE", "UND_ERR_SOCKET", "EAI_AGAIN"]);
function errorCauses(error) {
  const causes = [];
  for (let depth = 0; depth < 5 && error !== null && typeof error === "object"; depth += 1) {
    causes.push(error);
    error = "cause" in error ? error.cause : void 0;
  }
  return causes;
}
function retryableTransportFailure(error) {
  if (error instanceof SyntaxError || error instanceof RangeError) return false;
  for (const cause of errorCauses(error)) {
    if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return false;
    if ("code" in cause && typeof cause.code === "string") return RETRYABLE_CODES.has(cause.code);
  }
  return false;
}
function transportFailure(error) {
  const causes = errorCauses(error);
  if (causes.some((cause) => cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError"))) {
    return "request timed out or was aborted";
  }
  for (const cause of causes) {
    if ("code" in cause && typeof cause.code === "string" && /^[A-Z][A-Z0-9_]+$/.test(cause.code)) {
      return `network error (${cause.code})`;
    }
  }
  return "network request failed";
}
function diagnosticURL(raw) {
  const url = new URL(raw);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.href;
}
async function fetchJsonResponse(url, init, maxBytes) {
  if ((init.method ?? "GET").toUpperCase() !== "GET") throw new TypeError("JSON requests must use GET");
  const headers = new Headers(init.headers);
  headers.set("accept-encoding", "identity");
  const options = { ...init, method: "GET", headers };
  for (let attempt = 0; ; attempt += 1) {
    init.signal?.throwIfAborted();
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        await response.body?.cancel().catch(() => {
        });
        return { response, body: void 0 };
      }
      return { response, body: await readJsonResponse(response, maxBytes) };
    } catch (error) {
      init.signal?.throwIfAborted();
      if (attempt > 0 || !retryableTransportFailure(error)) throw error;
      await delay(150, void 0, { signal: init.signal ?? void 0 });
    }
  }
}
async function readBoundedBody(response, maxBytes) {
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      if (value.byteLength > maxBytes - size) {
        const error = new RangeError(`Response body exceeds ${maxBytes} byte limit`);
        await reader.cancel(error).catch(() => {
        });
        throw error;
      }
      size += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
async function readJsonResponse(response, maxBytes) {
  const bytes = await readBoundedBody(response, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new SyntaxError("Response is not valid JSON", { cause: error });
  }
}

// src/catalog.ts
var PROVIDER_ID = "opencode-go";
var DISPLAY_NAME = "OpenCode Go";
var DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
var MODELS_FETCH_TIMEOUT_MS = 1e4;
var METADATA_FETCH_TIMEOUT_MS = 3e4;
var STALE_WHILE_REVALIDATE_MS = 5 * 6e4;
var MODEL_LISTING_MAX_BYTES = 1024 * 1024;
var MODEL_METADATA_MAX_BYTES = 16 * 1024 * 1024;
var RETRY_MIN_MS = 5e3;
var RETRY_MAX_MS = 6e4;
function waitForSnapshot(pending, signal) {
  if (signal === void 0) return pending;
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new LlmError5("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason }));
    };
    pending.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
function builtinModels(baseURL) {
  return new Map(getBuiltinModels("opencode-go").map((model) => [model.id, {
    ...model,
    provider: PROVIDER_ID,
    baseUrl: modelBaseURL(model.api, baseURL)
  }]));
}
function readLiveModelIds(body) {
  const data = body?.data;
  if (!Array.isArray(data)) throw new Error('the model listing has no "data" array');
  const ids = [];
  for (const entry of data) {
    const id = entry?.id;
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }
  return [...new Set(ids)];
}
async function fetchLiveModelIds(baseURL) {
  const url = `${baseURL.replace(/\/+$/, "")}/models`;
  const endpoint = diagnosticURL(url);
  let result;
  try {
    result = await fetchJsonResponse(url, {
      method: "GET",
      cache: "no-cache",
      headers: { ...attributionHeaders(), accept: "application/json" },
      signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS)
    }, MODEL_LISTING_MAX_BYTES);
  } catch (error) {
    const detail = error instanceof SyntaxError ? "invalid JSON response" : error instanceof RangeError ? `response exceeds the ${MODEL_LISTING_MAX_BYTES} byte limit` : transportFailure(error);
    const action = error instanceof SyntaxError || error instanceof RangeError ? "read" : "reach";
    throw new LlmError5(`could not ${action} ${endpoint}: ${detail}`, "DISCOVERY_FAILED", { cause: error });
  }
  const { response, body } = result;
  if (!response.ok) throw new LlmError5(`${endpoint} answered HTTP ${response.status}`, "DISCOVERY_FAILED");
  try {
    return readLiveModelIds(body);
  } catch (error) {
    throw new LlmError5(`${endpoint} returned an invalid model listing: expected a "data" array`, "DISCOVERY_FAILED", { cause: error });
  }
}
function harnessApiKeyAuth() {
  return { apiKey: {
    name: "OpenCode API key",
    resolve: () => Promise.resolve({ auth: {}, source: "OpenCode API key" })
  } };
}
function buildProvider(baseURL, models) {
  return createProvider({
    id: PROVIDER_ID,
    name: DISPLAY_NAME,
    baseUrl: baseURL,
    auth: harnessApiKeyAuth(),
    models: [...models],
    api: {
      "anthropic-messages": anthropicMessagesApi(),
      "openai-completions": openAICompletionsApi(),
      "openai-responses": openAIResponsesApi()
    }
  });
}
var OpencodeGoCatalog = class {
  constructor(baseURL, refreshMs, onFallback, onOmitted) {
    this.baseURL = baseURL;
    this.refreshMs = refreshMs;
    this.onFallback = onFallback;
    this.onOmitted = onOmitted;
  }
  served;
  pending;
  metadata;
  metadataETag;
  metadataUpdatedAtMs;
  failures = 0;
  refreshAtMs = 0;
  snapshot(force = false, signal) {
    if (signal?.aborted) {
      return Promise.reject(new LlmError5("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason }));
    }
    if (!force && this.served !== void 0 && Date.now() < this.refreshAtMs) {
      return Promise.resolve(this.served);
    }
    this.pending ??= this.build().then((snapshot) => {
      this.served = snapshot;
      this.failures = snapshot.live && snapshot.metadataLive ? 0 : Math.min(this.failures + 1, 5);
      const lifetime = this.failures === 0 ? this.refreshMs : Math.min(this.refreshMs, RETRY_MIN_MS * 2 ** (this.failures - 1), RETRY_MAX_MS);
      this.refreshAtMs = snapshot.fetchedAtMs + lifetime;
      return snapshot;
    }).finally(() => {
      this.pending = void 0;
    });
    return waitForSnapshot(this.pending, signal);
  }
  /** Conditional HTTP requests save bandwidth while still checking for updated metadata. */
  async refreshMetadata(builtin) {
    const { response, body } = await fetchJsonResponse(MODEL_METADATA_URL, {
      headers: {
        ...attributionHeaders(),
        accept: "application/json",
        ...this.metadataETag === void 0 ? {} : { "if-none-match": this.metadataETag }
      },
      cache: "no-cache",
      signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS)
    }, MODEL_METADATA_MAX_BYTES);
    if (response.status === 304 && this.metadata !== void 0) {
      this.metadataUpdatedAtMs = Date.now();
      return this.metadata;
    }
    if (!response.ok) throw new LlmError5(`${MODEL_METADATA_URL} answered HTTP ${response.status}`, "DISCOVERY_FAILED");
    let metadata;
    try {
      metadata = readModelMetadata(body, this.baseURL, builtin);
    } catch (error) {
      throw new LlmError5(`${MODEL_METADATA_URL} returned invalid model configuration`, "DISCOVERY_FAILED", { cause: error });
    }
    this.metadata = metadata;
    this.metadataETag = response.headers.get("etag") ?? void 0;
    this.metadataUpdatedAtMs = Date.now();
    return metadata;
  }
  /** Gateway ids decide membership; online metadata decides how to call each model. */
  async build() {
    const builtin = builtinModels(this.baseURL);
    const [listing, metadataResult] = await Promise.allSettled([
      fetchLiveModelIds(this.baseURL).then((ids) => ({ ids, updatedAtMs: Date.now() })),
      this.refreshMetadata(builtin)
    ]);
    const metadata = metadataResult.status === "fulfilled" ? metadataResult.value : this.metadata;
    const metadataStatus = {
      metadataLive: metadataResult.status === "fulfilled",
      ...this.metadataUpdatedAtMs === void 0 ? {} : { metadataUpdatedAtMs: this.metadataUpdatedAtMs },
      ...metadataResult.status === "rejected" ? { metadataFailure: metadataResult.reason } : {}
    };
    const known = new Map([...builtin, ...this.served?.models ?? [], ...metadata?.models ?? []]);
    if (metadataResult.status === "rejected") {
      this.onFallback({ url: MODEL_METADATA_URL, error: metadataResult.reason, kept: known.size });
    }
    if (listing.status === "rejected") {
      const models2 = this.served?.models ?? /* @__PURE__ */ new Map();
      this.onFallback({ url: `${this.baseURL.replace(/\/+$/, "")}/models`, error: listing.reason, kept: models2.size });
      return {
        details: this.served?.details ?? /* @__PURE__ */ new Map(),
        models: models2,
        unavailable: this.served?.unavailable ?? /* @__PURE__ */ new Map(),
        provider: buildProvider(this.baseURL, [...models2.values()]),
        live: false,
        fetchedAtMs: Date.now(),
        ...metadataStatus,
        ...this.served?.listingUpdatedAtMs === void 0 ? {} : { listingUpdatedAtMs: this.served.listingUpdatedAtMs },
        listingFailure: listing.reason
      };
    }
    const models = /* @__PURE__ */ new Map();
    const unavailable = /* @__PURE__ */ new Map();
    for (const id of listing.value.ids) {
      const error = metadata?.errors.get(id);
      const model = known.get(id);
      if (error !== void 0 || model === void 0) {
        unavailable.set(id, error ?? "no usable configuration was found for this OpenCode Go model");
      } else {
        models.set(id, model);
      }
    }
    if (unavailable.size > 0) this.onOmitted([...unavailable.keys()]);
    return {
      details: new Map(listing.value.ids.map((id) => [id, metadata?.details.get(id) ?? {}])),
      models,
      unavailable,
      provider: buildProvider(this.baseURL, [...models.values()]),
      live: true,
      fetchedAtMs: Date.now(),
      listingUpdatedAtMs: listing.value.updatedAtMs,
      ...metadataStatus
    };
  }
  /** New or previously unconfigured ids get a fresh lookup even during the runtime TTL. */
  async forModel(id, signal) {
    const cached = this.served;
    if (signal?.aborted) throw new LlmError5("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason });
    if (cached?.models.has(id) && cached.listingUpdatedAtMs !== void 0 && cached.metadataUpdatedAtMs !== void 0 && Date.now() < Math.min(cached.listingUpdatedAtMs, cached.metadataUpdatedAtMs) + this.refreshMs + STALE_WHILE_REVALIDATE_MS) {
      void this.snapshot().catch(() => {
      });
      return cached;
    }
    let snapshot = await this.snapshot(false, signal);
    if (!snapshot.models.has(id) && snapshot === cached) snapshot = await this.snapshot(true, signal);
    if (signal?.aborted) throw new LlmError5("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason });
    if (snapshot.unavailable.has(id)) {
      throw new LlmError5(
        `opencode-go model "${id}" is advertised but cannot be configured: ${snapshot.unavailable.get(id)}; refresh the model list to retry`,
        "MODEL_METADATA_UNAVAILABLE"
      );
    }
    return snapshot;
  }
};
async function discoverCatalogModels(catalog) {
  const snapshot = await catalog.snapshot(true);
  requireLiveListing(snapshot);
  return describeCatalog(snapshot);
}
function requireLiveListing(snapshot) {
  if (snapshot.live) return;
  throw listingError(snapshot);
}
function listingError(snapshot) {
  const detail = snapshot.listingFailure instanceof LlmError5 ? snapshot.listingFailure.message : "the live model listing is unreachable";
  return new LlmError5(`llm-opencode-go: ${detail}; refresh the model list to retry`, "DISCOVERY_FAILED", { cause: snapshot.listingFailure });
}
function describeConfiguredModels(snapshot) {
  return [...snapshot.models.values()].map((model) => ({
    id: model.id,
    name: model.name,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens
  }));
}
function describeCatalog(snapshot) {
  return [
    ...describeConfiguredModels(snapshot),
    ...[...snapshot.unavailable].map(([id, reason]) => ({ id, name: `${id} (metadata unavailable: ${reason})` }))
  ];
}
async function discoverSettingsModels(catalog) {
  const snapshot = await catalog.snapshot(true);
  const metadataError = snapshot.metadataLive ? void 0 : metadataFailureMessage(snapshot.metadataFailure);
  const errors = [snapshot.live ? void 0 : listingError(snapshot).message, metadataError].filter((message) => message !== void 0);
  return {
    models: sortModels([
      ...describeConfiguredModels(snapshot),
      ...[...snapshot.unavailable.keys()].map((id) => ({ id, name: id, configurationMissing: true }))
    ].map((model) => ({ ...model, ...snapshot.details.get(model.id) }))),
    stale: errors.length > 0,
    ...errors.length === 0 ? {} : { error: errors.join("; ") },
    sources: {
      listing: {
        ...snapshot.listingUpdatedAtMs === void 0 ? {} : { updatedAt: snapshot.listingUpdatedAtMs },
        ...snapshot.live ? {} : { error: listingError(snapshot).message }
      },
      metadata: {
        ...snapshot.metadataUpdatedAtMs === void 0 ? {} : { updatedAt: snapshot.metadataUpdatedAtMs },
        ...metadataError === void 0 ? {} : { error: metadataError }
      }
    }
  };
}
function metadataFailureMessage(error) {
  const detail = error instanceof LlmError5 ? error.message : `${MODEL_METADATA_URL}: ${error instanceof SyntaxError ? "invalid JSON response" : error instanceof RangeError ? `response exceeds the ${MODEL_METADATA_MAX_BYTES} byte limit` : transportFailure(error)}`;
  return `could not refresh model configuration (${detail}); using previously fetched or built-in configuration where available`;
}

// src/config.ts
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import z from "@deepseek-ai/schemastery";
var DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
var DEFAULT_REFRESH_MINUTES = 60;
var DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
var fields = {
  enabled: z.boolean().default(true),
  modelVisibility: z.dict(z.boolean().required()).default({}),
  apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  refreshMinutes: z.number().step(1).min(1).max(7 * 24 * 60).default(DEFAULT_REFRESH_MINUTES),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  maxImages: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
  // The image defaults are the generic pi-ai adapter's: one normalized
  // request image fits the budget, and fifteen of them fit the payload cap.
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
  // null explicitly selects catalog values, overriding even inherited profile limits.
  modelLimits: z.dict(z.union([z.const(null), z.object({
    contextWindow: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)]),
    maxTokens: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)])
  })])).default({})
};
var PlainConfig = z.object(fields);
var Config = z.object(Object.fromEntries(
  Object.entries(fields).map(([key, schema]) => [key, schema.volatile()])
));
function readConfig(config) {
  return Object.fromEntries(Object.keys(fields).map((key) => [key, config[key].get()]));
}
function assertBaseURL(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`llm-opencode-go: baseURL "${raw}" is not a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`llm-opencode-go: baseURL "${raw}" must be http or https`);
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`llm-opencode-go: baseURL "${raw}" must not carry a query or fragment`);
  }
  return url.toString().replace(/\/+$/, "");
}

// src/adapter.ts
var DISABLES_THINKING_WHEN_UNSET = /* @__PURE__ */ new Set(["deepseek", "zai", "qwen", "qwen-chat-template"]);
function withModelLimit(model, limits) {
  const limit = limits[model.id];
  if (limit == null) return model;
  return {
    ...model,
    contextWindow: limit.contextWindow ?? model.contextWindow,
    maxTokens: limit.maxTokens ?? model.maxTokens
  };
}
function opencodeSessionValue(sessionId) {
  return sessionId !== void 0 && sessionId.length > 0 ? sessionId : randomUUID();
}
var OpencodeGoAdapter = class extends LlmAdapter {
  constructor(options) {
    super();
    this.options = options;
  }
  /**
   * One catalog instance per endpoint/refresh pair. A settings write that
   * changes either gets a fresh resolver (and a fresh live-listing fetch) on
   * the next operation; an unchanged configuration keeps its cached snapshot
   * for the whole refresh interval.
   */
  catalogCache;
  /**
   * The catalog resolver for one configuration, rebuilding on the facts it
   * owns. Public for the plugin's discovery registration, which resolves the
   * current configuration the same way the adapter does.
   * @param config - the endpoint and refresh interval for the raw catalog.
   * @returns the resolver caching catalog values, independent of deployment limits.
   */
  catalogOf(config) {
    const key = `${config.baseURL}|${String(config.refreshMinutes)}`;
    if (this.catalogCache?.key !== key) {
      this.catalogCache = {
        key,
        catalog: new OpencodeGoCatalog(
          assertBaseURL(config.baseURL),
          config.refreshMinutes * 6e4,
          /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
          this.options.onFallback ?? (() => {
          }),
          /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
          this.options.onOmitted ?? (() => {
          })
        )
      };
    }
    return this.catalogCache.catalog;
  }
  providerInfo(provider) {
    return { id: provider, name: DISPLAY_NAME };
  }
  async listModels(_provider) {
    const config = this.options.config();
    const snapshot = await this.catalogOf(config).snapshot();
    return [...snapshot.models.values()].filter((model) => isModelEnabled({ id: model.id, ...snapshot.details.get(model.id) }, config.modelVisibility)).map((model) => ({
      provider: PROVIDER_ID,
      id: model.id,
      name: model.name,
      inputModalities: [...model.input]
    }));
  }
  async resolveModel(_provider, model, signal) {
    const config = this.options.config();
    const snapshot = await this.catalogOf(config).forModel(model, signal);
    const resolved = snapshot.models.get(model);
    if (resolved === void 0) {
      throw new LlmError6(`opencode-go has no model "${model}"`, "UNKNOWN_MODEL");
    }
    return this.modelInfo(withModelLimit(resolved, config.modelLimits));
  }
  /** Describe one model: capacities plus the reasoning levels it actually offers. */
  modelInfo(model) {
    const reasoning = {};
    const levels = model.reasoning ? getSupportedThinkingLevels(model) : [];
    if (levels.length > 0) {
      const format = model.compat?.thinkingFormat;
      const fallback = format !== void 0 && DISABLES_THINKING_WHEN_UNSET.has(format) ? levels.includes("high") ? "high" : levels.findLast((level) => level !== "off") : void 0;
      reasoning.reasoning = {
        efforts: levels.map((level) => ({
          id: ReasoningEffortId(level),
          name: `${level.charAt(0).toUpperCase()}${level.slice(1)}`
        })),
        ...fallback === void 0 ? {} : { defaultEffort: ReasoningEffortId(fallback) }
      };
    }
    return {
      provider: PROVIDER_ID,
      id: model.id,
      name: model.name,
      inputModalities: [...model.input],
      context: { contextWindow: model.contextWindow },
      ...reasoning
    };
  }
  /** Validate an explicit effort against the model's own levels, without clamping. */
  resolveReasoningLevel(model, effort) {
    if (effort === void 0) return void 0;
    const supported = getSupportedThinkingLevels(model);
    if (supported.some((level) => level === effort)) return effort;
    throw new LlmError6(
      `opencode-go model "${model.id}" does not support reasoning effort "${effort}"`,
      "UNSUPPORTED_REASONING_EFFORT"
    );
  }
  async *stream(options) {
    var _stack = [];
    try {
      if (options.stop !== void 0) {
        throw new LlmError6("llm-opencode-go does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
      }
      const config = this.options.config();
      let snapshot;
      try {
        snapshot = await this.catalogOf(config).forModel(options.model, options.signal);
      } catch (error) {
        if (!options.signal?.aborted) throw error;
        yield { type: "finish", reason: {
          kind: "aborted",
          failure: { code: "ABORTED", message: "opencode-go request aborted by caller" }
        } };
        return;
      }
      const advertised = snapshot.models.get(options.model);
      if (advertised === void 0) {
        throw new LlmError6(`opencode-go has no model "${options.model}"`, "UNKNOWN_MODEL");
      }
      const model = withModelLimit(advertised, config.modelLimits);
      const outputLimit = config.modelLimits[model.id]?.maxTokens;
      const maxTokens = outputLimit == null ? options.maxTokens : Math.min(options.maxTokens ?? outputLimit, outputLimit);
      const apiKey = await this.options.resolveApiKey();
      if (apiKey === void 0 || apiKey.length === 0) {
        throw new LlmError6("llm-opencode-go: no credential resolved for the route", "MISSING_CREDENTIAL");
      }
      const reasoning = this.resolveReasoningLevel(model, options.reasoningEffort);
      const consumer = new AbortController();
      const upstream = options.signal === void 0 ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]);
      const watchdog = __using(_stack, idleWatchdog(upstream, config.streamIdleTimeoutMs, "LLM_STREAM_IDLE_TIMEOUT"));
      try {
        const containsImage = options.messages.some((message) => contentHasImage2(message.content));
        if (containsImage && !model.input.includes("image")) {
          throw new LlmError6(`opencode-go model "${model.id}" does not support image input`, "UNSUPPORTED_CONTENT");
        }
        let imageRequest;
        if (containsImage) {
          const access = this.options.imageAccess;
          const store = access?.resolveAttachments();
          if (access === void 0 || store === void 0) {
            throw new LlmError6("llm-opencode-go image input requires the durable attachment service", "UNSUPPORTED_CONTENT");
          }
          imageRequest = {
            attachments: store,
            resolveImageAccess: (ref) => access.resolveImageAccess(store, ref),
            maxImages: config.maxImages ?? void 0,
            maxRequestImageBytes: config.maxRequestImageBytes,
            requestImagePolicy: {
              maxPixels: config.requestImagePixelBudget,
              maxBytes: config.requestImageMaxBytes
            }
          };
        }
        const context = imageRequest === void 0 ? toPiContext(options, void 0, this.options.onReplayDegrade) : await toPiContext({ ...options, signal: watchdog.signal }, imageRequest, this.options.onReplayDegrade);
        const events = snapshot.provider.streamSimple(model, context, {
          apiKey,
          ...reasoning === void 0 || reasoning === "off" ? {} : { reasoning },
          ...options.temperature === void 0 ? {} : { temperature: options.temperature },
          ...maxTokens === void 0 ? {} : { maxTokens },
          ...options.sessionId === void 0 ? {} : { sessionId: String(options.sessionId) },
          signal: watchdog.signal,
          // Harness-owned request identity: the gateway refuses requests without
          // `x-opencode-session` and profiles clients by User-Agent, and
          // attribution merges last in pi-ai's client.
          headers: {
            "x-opencode-session": opencodeSessionValue(options.sessionId === void 0 ? void 0 : String(options.sessionId)),
            ...attributionHeaders2()
          },
          // The agent recovery layer owns visible attempts; one adapter call is
          // one SDK attempt.
          maxRetries: 0
        });
        const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id)[Symbol.asyncIterator]();
        let exhausted = false;
        try {
          while (true) {
            const result = await watchdog.next(iterator);
            if (timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT") !== void 0) {
              throw new LlmError6("opencode-go stream idle timeout", "TIMEOUT");
            }
            if (result.done) {
              exhausted = true;
              return;
            }
            yield result.value;
          }
        } finally {
          if (!exhausted) {
            consumer.abort("opencode-go stream consumer stopped");
            try {
              await iterator.return(void 0);
            } catch (_abortedSdkTeardown) {
            }
          }
        }
      } catch (error) {
        if (timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT") !== void 0) {
          throw new LlmError6("opencode-go stream idle timeout", "TIMEOUT", { cause: error });
        }
        if (options.signal?.aborted) {
          throw new LlmError6("opencode-go request aborted by caller", "ABORTED", { cause: error });
        }
        throw error;
      }
    } catch (_) {
      var _error = _, _hasError = true;
    } finally {
      __callDispose(_stack, _error, _hasError);
    }
  }
};

// src/usage.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { attributionHeaders as attributionHeaders3 } from "@deepseek-ai/dsh-llm";

// src/usage-contract.ts
function parseGoUsage(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid OpenCode Go usage response");
  const source = value;
  const result = {};
  if (source.source !== void 0) {
    if (typeof source.source !== "string" || source.source.length === 0 || source.source.length > 128) {
      throw new Error("Invalid OpenCode Go usage source");
    }
    result.source = source.source;
  }
  for (const key of ["rolling", "weekly", "monthly"]) {
    const row = source[key];
    if (!row || row.status !== "ok" && row.status !== "rate-limited" || typeof row.percent !== "number" || !Number.isFinite(row.percent) || row.percent < 0 || typeof row.resetsAt !== "string" || !Number.isFinite(Date.parse(row.resetsAt))) {
      throw new Error("Invalid OpenCode Go usage response");
    }
    result[key] = { status: row.status, percent: row.percent, resetsAt: row.resetsAt };
  }
  return result;
}
var usageCodec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#GoUsage",
  schema: { parse: parseGoUsage },
  create: () => ({ parse: parseGoUsage })
};
var usageRemote = {
  package: "dsh-opencode-go",
  descriptors: [{
    id: "dsh-opencode-go#opencodeGoUsage/read",
    service: "opencodeGoUsage",
    namespace: "opencodeGoUsage",
    method: "read",
    invocation: { kind: "direct" },
    parameters: [],
    result: usageCodec
  }]
};

// src/usage.ts
var USAGE_MAX_BYTES = 1024 * 1024;
var GoUsageService = class extends TypertRemoteService {
  constructor(ctx, options) {
    super(ctx, "opencodeGoUsage");
    this.options = options;
  }
  identity;
  async read() {
    const baseURL = assertBaseURL(this.options.baseURL()).replace(/\/$/, "");
    let key;
    try {
      key = await this.options.resolveApiKey();
    } catch (error) {
      this.identity = void 0;
      const missing = error instanceof Error && "code" in error && error.code === "MISSING_CREDENTIAL";
      throw new RemoteError("opencode-go/usage-unavailable", missing ? "OpenCode Go API key is not configured" : "Could not resolve the OpenCode Go API key", {
        retryable: !missing,
        retainPrevious: false
      }, { cause: error });
    }
    if (!key) {
      this.identity = void 0;
      throw new RemoteError("opencode-go/usage-unavailable", "OpenCode Go API key is not configured", {
        retryable: false,
        retainPrevious: false
      });
    }
    if (this.identity?.baseURL !== baseURL || this.identity.key !== key) {
      this.identity = { baseURL, key, source: randomUUID2() };
    }
    const { source } = this.identity;
    const endpoint = diagnosticURL(`${baseURL}/usage`);
    let result;
    try {
      result = await fetchJsonResponse(`${baseURL}/usage`, {
        headers: { ...attributionHeaders3(), Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(1e4),
        redirect: "error"
      }, USAGE_MAX_BYTES);
    } catch (error) {
      const invalid = error instanceof SyntaxError || error instanceof RangeError;
      const detail = error instanceof SyntaxError ? "invalid JSON response" : error instanceof RangeError ? `response exceeds the ${USAGE_MAX_BYTES} byte limit` : transportFailure(error);
      throw new RemoteError("opencode-go/usage-unavailable", `Could not read ${endpoint}: ${detail}`, {
        retryable: true,
        retainPrevious: !invalid,
        source
      }, { cause: error });
    }
    const { response, body } = result;
    if (!response.ok) {
      const temporary = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new RemoteError("opencode-go/usage-unavailable", `OpenCode Go usage unavailable (HTTP ${response.status})`, {
        retryable: temporary,
        retainPrevious: temporary,
        source
      });
    }
    try {
      const usage = parseGoUsage(body && typeof body === "object" ? body.usage : void 0);
      return { ...usage, source };
    } catch (error) {
      throw new RemoteError("opencode-go/usage-unavailable", "Invalid OpenCode Go usage response", {
        retryable: true,
        retainPrevious: false,
        source
      }, { cause: error });
    }
  }
};

// src/models.ts
import { TypertRemoteService as TypertRemoteService2 } from "@deepseek-ai/dsh-typert-protocol";
var GoModelsService = class extends TypertRemoteService2 {
  constructor(ctx, options) {
    super(ctx, "opencodeGoModels");
    this.options = options;
  }
  async read() {
    try {
      return await discoverSettingsModels(this.options.catalog());
    } finally {
      this.options.onRefresh?.();
    }
  }
};

// src/remote-contract.ts
var goRemote = {
  package: "dsh-opencode-go",
  descriptors: [...usageRemote.descriptors, ...modelsRemote.descriptors]
};

// src/remotes.ts
function registerGoRemotes(ctx) {
  ctx.inject(["typert"], (scope) => {
    scope.effect(() => scope.typert.register({
      package: goRemote.package,
      face: "host",
      schemas: [],
      model: { services: [], events: [], objects: [] },
      invocations: goRemote.descriptors
    }));
  });
}

// src/index.ts
var name = "llm-opencode-go";
var inject = ["llm"];
var NS = "llm-opencode-go";
function apply(ctx, raw) {
  const config = raw && typeof raw.enabled === "object" ? raw : Config(raw);
  const entry = readConfig(config);
  assertBaseURL(entry.baseURL);
  let current = () => readConfig(config);
  const resolveApiKey = async () => {
    const ref = current().apiKeyEnv;
    const credentials = ctx.get("credentials");
    const hit = credentials !== void 0 ? (await credentials.resolve(credentialRef(ref)))?.value : launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== void 0 && hit.length > 0) return assertUsableApiKey(hit, name, ref);
    throw new LlmError7(
      `llm-opencode-go: no credential; the profile resolves ${ref}, which is not set \u2014 store ${ref} through the credentials service or export it`,
      "MISSING_CREDENTIAL"
    );
  };
  registerGoRemotes(ctx);
  ctx.plugin(GoUsageService, { baseURL: () => current().baseURL, resolveApiKey });
  const logger = {
    fallback: ({ url, error }) => {
      ctx.logger.warn(`llm-opencode-go: could not refresh ${url}; using last-known model data (${String(error)})`);
    },
    omitted: (ids) => {
      ctx.logger.warn(`llm-opencode-go: gateway models awaiting usable online metadata: ${ids.join(", ")}`);
    }
  };
  const adapter = new OpencodeGoAdapter({
    config: () => current(),
    resolveApiKey,
    imageAccess: {
      resolveAttachments: () => ctx.get("attachments"),
      resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
        attachments,
        (hostPath) => ctx.get("fs")?.processPathFromHostPath(hostPath),
        ref
      )
    },
    onFallback: logger.fallback,
    onOmitted: logger.omitted,
    onReplayDegrade: (reason) => {
      ctx.logger.warn(`llm-opencode-go: unusable replay state on assistant history; sending provider-neutral content (${reason})`);
    }
  });
  let registration;
  ctx.plugin(GoModelsService, {
    catalog: () => adapter.catalogOf(current()),
    onRefresh: () => {
      registration?.replace([PROVIDER_ID]);
    }
  });
  const pickerVisibilityOf = () => JSON.stringify(current().modelVisibility ?? {});
  let pickerVisibility = pickerVisibilityOf();
  const applyRoute = (configured) => {
    if (configured && current().enabled && registration === void 0) {
      try {
        registration = ctx.llm.registerAdapter([PROVIDER_ID], adapter);
      } catch (error) {
        ctx.logger.error(`llm-opencode-go: not registering the "${PROVIDER_ID}" route (${String(error)})`);
      }
    } else if ((!configured || !current().enabled) && registration !== void 0) {
      registration();
      registration = void 0;
      if (!current().enabled) {
        ctx.logger.info("llm-opencode-go: disabled by configuration; the route and its models are withdrawn");
      }
    }
  };
  const syncRoute = () => {
    const visibility = pickerVisibilityOf();
    if (pickerVisibility !== visibility) {
      pickerVisibility = visibility;
      registration?.replace([PROVIDER_ID]);
    }
    const credentials = ctx.get("credentials");
    if (credentials === void 0) {
      applyRoute(launchEnvironmentOf(ctx).get(current().apiKeyEnv)?.value !== void 0);
      return;
    }
    void credentials.describe(credentialRef(current().apiKeyEnv)).then((info) => {
      applyRoute(info.configured);
    }).catch((error) => {
      ctx.logger.error(`llm-opencode-go: credential describe failed; keeping the previous route state (${String(error)})`);
    });
  };
  syncRoute();
  const undiscover = ctx.llm.registerModelDiscovery(name, async (request) => {
    if (request.provider !== PROVIDER_ID && !(request.baseURL ?? "").includes("opencode.ai")) {
      throw new LlmError7(
        "llm-opencode-go discovers only OpenCode zen/go endpoints; enter this provider's models by hand",
        "DISCOVERY_UNSUPPORTED"
      );
    }
    return discoverCatalogModels(adapter.catalogOf(current()));
  });
  ctx.effect(() => () => {
    registration?.();
    undiscover();
  });
  ctx.inject(["settings"], (settingsCtx) => {
    if ("configure" in settingsCtx.settings) {
      const settings = settingsCtx.settings;
      settingsCtx.effect(() => settings.configure({ auto: false }, ctx.fiber));
      return;
    }
    settingsCtx.settings.installSection(ctx, NS, PlainConfig, entry, {
      validate: (value) => {
        assertBaseURL(value.baseURL);
      },
      setSource: (source) => {
        current = source;
      },
      onChange: () => {
        syncRoute();
      }
    });
  });
  ctx.on("internal/config", function(_raw, next) {
    const value = next();
    if (this === ctx.fiber) assertBaseURL(PlainConfig(value).baseURL);
    return value;
  });
  ctx.on("loader/volatile-update", syncRoute);
  ctx.inject(["credentials"], (credentialsCtx) => {
    credentialsCtx.on("credentials/reference-updated", (ref) => {
      if (ref === current().apiKeyEnv) syncRoute();
    });
    syncRoute();
  });
  ctx.logger.info(`llm-opencode-go: route "${PROVIDER_ID}" registered as ${DISPLAY_NAME}`);
}
export {
  Config,
  DEFAULT_BASE_URL,
  DISPLAY_NAME,
  NS,
  OpencodeGoAdapter,
  OpencodeGoCatalog,
  PROVIDER_ID,
  PlainConfig,
  apply,
  assertBaseURL,
  discoverCatalogModels,
  inject,
  name,
  readLiveModelIds
};
