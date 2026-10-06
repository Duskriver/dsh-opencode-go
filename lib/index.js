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
import { randomUUID as randomUUID2 } from "node:crypto";
import { getSupportedThinkingLevels, normalizeContext } from "opencode-go-pi-ai";
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
function toPiReplayState(message, requestedModel = message.model, requestedProvider = message.provider) {
  const responseModel = message.api === "anthropic-messages" && message.model !== requestedModel ? message.model : message.responseModel;
  const response = {
    kind: "pi-ai",
    version: 2,
    api: message.api,
    provider: requestedProvider,
    ...requestedProvider === message.provider ? {} : { sdkProvider: message.provider },
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
  if (response["sdkProvider"] !== void 0 && (typeof response["sdkProvider"] !== "string" || response["sdkProvider"].length === 0)) {
    return invalidReplay("sdkProvider must be a non-empty string");
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
    provider: state.response.sdkProvider ?? state.response.provider,
    // SDK signature matching uses the requested identity even when Anthropic reports an alias.
    model: state.response.model,
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
import { isContextOverflow } from "opencode-go-pi-ai";
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
async function* toStreamChunks(events, contextWindow, callerSignal, requestedModel, requestedProvider) {
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
          replayState: toPiReplayState(event.message, requestedModel, requestedProvider)
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
import { createProvider } from "opencode-go-pi-ai";
import { getBuiltinModels } from "opencode-go-pi-ai/providers/all";
import { anthropicMessagesApi } from "opencode-go-pi-ai/api/anthropic-messages.lazy";
import { openAICompletionsApi } from "opencode-go-pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "opencode-go-pi-ai/api/openai-responses.lazy";
import { attributionHeaders, LlmError as LlmError5 } from "@deepseek-ai/dsh-llm";

// src/models-contract.ts
var INPUT_MODALITIES = ["text", "image", "audio", "video", "pdf"];
function normalizeInputModalities(value) {
  if (!Array.isArray(value)) return void 0;
  const declared = new Set(value.filter((item) => typeof item === "string").map((item) => item.toLowerCase()));
  const ordered = INPUT_MODALITIES.filter((modality) => declared.has(modality));
  return ordered.length === 0 ? void 0 : ordered;
}
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
    const modalities = normalizeInputModalities(row.inputModalities);
    if (modalities !== void 0) model.inputModalities = modalities;
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

// src/reasoning.ts
var THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var NATIVE_THINKING_FLAGS = /* @__PURE__ */ new Set(["deepseek", "zai", "qwen", "qwen-chat-template"]);
function unsupportedThinkingLevels() {
  return Object.fromEntries(THINKING_LEVELS.map((level) => [level, null]));
}
function withGatewayReasoning(model) {
  if (model.id !== "mimo-v2.6-flash" || model.api !== "openai-completions" || !model.reasoning) return model;
  return { ...model, thinkingLevelMap: {
    ...unsupportedThinkingLevels(),
    off: "none",
    low: "low",
    medium: "medium",
    high: "high"
  } };
}
function withRequestReasoning(model, level) {
  const format = model.compat?.thinkingFormat;
  if (level !== void 0 || model.api !== "openai-completions" || format !== void 0 && format !== "openai" || typeof model.thinkingLevelMap?.off !== "string") return model;
  return { ...model, thinkingLevelMap: { ...model.thinkingLevelMap, off: null } };
}

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
function thinkingLevels(id, api2, metadata, known) {
  if (!Array.isArray(metadata.reasoning_options) && known?.id === id && known.thinkingLevelMap !== void 0) return known.thinkingLevelMap;
  const map = unsupportedThinkingLevels();
  const options = (Array.isArray(metadata.reasoning_options) ? metadata.reasoning_options : []).map(record);
  const efforts = options.filter((option) => option.type === "effort" && Array.isArray(option.values));
  for (const option of efforts) {
    for (const value of option.values) {
      const level = value === "none" ? "off" : value;
      if (THINKING_LEVELS.includes(level)) map[level] = String(value);
    }
  }
  const format = known?.compat?.thinkingFormat;
  const native = api2 === "anthropic-messages" || NATIVE_THINKING_FLAGS.has(format ?? "");
  const toggle = options.some((option) => option.type === "toggle");
  const budget = options.some((option) => option.type === "budget_tokens");
  if (native && efforts.length === 0 && (toggle || budget)) map.high = "high";
  const enabled = Object.entries(map).some(([level, wire]) => level !== "off" && typeof wire === "string");
  if (native && (toggle || enabled && known?.reasoning) && known?.thinkingLevelMap?.off !== null && map.off === null) {
    delete map.off;
  } else if (enabled && known?.id === id && known.reasoning && typeof known.thinkingLevelMap?.off === "string") {
    map.off ??= known.thinkingLevelMap.off;
  }
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
    const inputModalities = normalizeInputModalities(record(data.modalities).input);
    details.set(id, {
      deprecated: data.status === "deprecated",
      ...validReleaseDate(data.release_date) ? { releaseDate: data.release_date } : {},
      ...inputModalities === void 0 ? {} : { inputModalities }
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
      models.set(id, withGatewayReasoning({
        id,
        name: typeof metadata.name === "string" && metadata.name.length > 0 ? metadata.name : id,
        provider: "opencode-go",
        api: api2,
        baseUrl: modelBaseURL(api2, baseURL),
        reasoning: metadata.reasoning,
        thinkingLevelMap: thinkingLevels(id, api2, metadata, known),
        input: input.includes("image") ? ["text", "image"] : ["text"],
        contextWindow: positiveInteger(limit.context, "context limit"),
        maxTokens: positiveInteger(limit.output, "output limit"),
        cost,
        compat
      }));
    } catch (error) {
      errors.set(id, error instanceof Error ? error.message : String(error));
    }
  }
  return { models, errors, details };
}

// src/json-response.ts
import { setTimeout as delay } from "node:timers/promises";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
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
async function fetchJsonResponse(url, init, maxBytes, encoding = "identity", fetcher = globalThis.fetch) {
  if ((init.method ?? "GET").toUpperCase() !== "GET") throw new TypeError("JSON requests must use GET");
  const headers = new Headers(init.headers);
  headers.set("accept-encoding", encoding);
  const options = { ...init, method: "GET", headers };
  for (let attempt = 0; ; attempt += 1) {
    init.signal?.throwIfAborted();
    try {
      const response = await fetcher(url, options);
      if (!response.ok) {
        await response.body?.cancel().catch(() => {
        });
        return { response, body: void 0 };
      }
      return { response, body: await readJsonResponse(response, maxBytes, { gzip: encoding === "gzip", signal: init.signal }) };
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
async function readGzipBody(bytes, maxBytes, signal) {
  const chunks = [];
  let size = 0;
  await pipeline(Readable.from([bytes]), createGunzip(), new Writable({
    write(chunk, _encoding, done) {
      if (chunk.length > maxBytes - size) {
        done(new RangeError(`Response body exceeds ${maxBytes} byte limit`));
        return;
      }
      size += chunk.length;
      chunks.push(chunk);
      done();
    }
  }), { signal: signal ?? void 0 });
  return Buffer.concat(chunks, size);
}
async function readJsonResponse(response, maxBytes, options = {}) {
  let bytes = await readBoundedBody(response, maxBytes);
  if (options.gzip && bytes[0] === 31 && bytes[1] === 139) {
    try {
      bytes = await readGzipBody(bytes, maxBytes, options.signal);
    } catch (error) {
      options.signal?.throwIfAborted();
      if (error instanceof RangeError) throw error;
      throw new SyntaxError("Response is not valid gzip", { cause: error });
    }
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new SyntaxError("Response is not valid JSON", { cause: error });
  }
}

// src/metadata-cache.ts
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
var MODEL_METADATA_MAX_BYTES = 16 * 1024 * 1024;
var CACHE_MAX_BYTES = MODEL_METADATA_MAX_BYTES + 4096;
function metadataCachePath() {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  return resolve(home, "cache", "dsh-opencode-go", "models.dev.api.json");
}
function metadataETag(value) {
  return typeof value === "string" && value.length <= 1024 && /^(W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(value) ? value : void 0;
}
async function readMetadataCache(path) {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > CACHE_MAX_BYTES) return void 0;
    const chunks = [];
    let size = 0;
    for await (const chunk of createReadStream(path)) {
      const bytes = chunk;
      size += bytes.length;
      if (size > CACHE_MAX_BYTES) return void 0;
      chunks.push(bytes);
    }
    const value = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
    if (!value || value.version !== 1 || value.sourceURL !== MODEL_METADATA_URL || typeof value.savedAtMs !== "number" || !Number.isSafeInteger(value.savedAtMs) || value.savedAtMs < 0 || value.savedAtMs > Date.now() || value.etag !== void 0 && metadataETag(value.etag) === void 0) return void 0;
    return { body: value.body, savedAtMs: value.savedAtMs, etag: metadataETag(value.etag) };
  } catch {
    return void 0;
  }
}
async function writeMetadataCache(path, value) {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    const content = JSON.stringify({ version: 1, sourceURL: MODEL_METADATA_URL, ...value });
    if (Buffer.byteLength(content) > CACHE_MAX_BYTES) return;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, content, { flag: "wx", mode: 384 });
    await rename(temporary, path);
  } catch {
  } finally {
    await rm(temporary, { force: true }).catch(() => {
    });
  }
}

// src/provider-identity.ts
var PROVIDER_ID = "dsh-opencode-go";
var DISPLAY_NAME = "DSH OpenCode Go";
var SDK_PROVIDER_ID = "opencode-go";

// src/catalog.ts
var DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
var MODELS_FETCH_TIMEOUT_MS = 1e4;
var METADATA_FETCH_TIMEOUT_MS = 3e4;
var STALE_WHILE_REVALIDATE_MS = 5 * 6e4;
var MODEL_LISTING_MAX_BYTES = 1024 * 1024;
var RETRY_MIN_MS = 5e3;
var RETRY_MAX_MS = 6e4;
async function settled(promise) {
  const [result] = await Promise.allSettled([promise]);
  return result;
}
function waitForSnapshot(pending, signal) {
  if (signal === void 0) return pending;
  return new Promise((resolve2, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new LlmError5("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason }));
    };
    pending.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve2(value);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
function builtinModels(baseURL) {
  return new Map(getBuiltinModels(SDK_PROVIDER_ID).map((model) => [model.id, withGatewayReasoning({
    ...model,
    provider: SDK_PROVIDER_ID,
    baseUrl: modelBaseURL(model.api, baseURL)
  })]));
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
async function fetchLiveModelIds(baseURL, fetcher) {
  const url = `${baseURL.replace(/\/+$/, "")}/models`;
  const endpoint = diagnosticURL(url);
  let result;
  try {
    result = await fetchJsonResponse(url, {
      method: "GET",
      cache: "no-cache",
      headers: { ...attributionHeaders(), accept: "application/json" },
      signal: AbortSignal.timeout(MODELS_FETCH_TIMEOUT_MS)
    }, MODEL_LISTING_MAX_BYTES, "identity", fetcher);
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
    id: SDK_PROVIDER_ID,
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
  constructor(baseURL, refreshMs, onFallback, onOmitted, onRefresh = () => {
  }, fetcher) {
    this.baseURL = baseURL;
    this.refreshMs = refreshMs;
    this.onFallback = onFallback;
    this.onOmitted = onOmitted;
    this.onRefresh = onRefresh;
    this.fetcher = fetcher;
  }
  served;
  pending;
  /** A cold runtime read can use disk metadata while the shared online refresh runs. */
  cachedPending;
  initialized;
  cachePath = metadataCachePath();
  metadata;
  metadataBody;
  metadataETag;
  metadataUpdatedAtMs;
  failures = 0;
  refreshAtMs = 0;
  snapshot(force = false, signal) {
    if (signal?.aborted) {
      return Promise.reject(new LlmError5("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason }));
    }
    return waitForSnapshot(this.served === void 0 ? this.readSnapshot(force) : this.currentSnapshot(force), signal);
  }
  async restoreMetadata() {
    const saved = await readMetadataCache(this.cachePath);
    if (saved === void 0) return;
    try {
      this.metadata = readModelMetadata(saved.body, this.baseURL, builtinModels(this.baseURL));
      this.metadataBody = saved.body;
      this.metadataETag = saved.etag;
      this.metadataUpdatedAtMs = saved.savedAtMs;
    } catch {
    }
  }
  async readSnapshot(force) {
    await (this.initialized ??= this.restoreMetadata());
    return this.currentSnapshot(force);
  }
  currentSnapshot(force) {
    if (!force && this.served !== void 0 && Date.now() < this.refreshAtMs) return Promise.resolve(this.served);
    if (this.pending === void 0) this.startRefresh(force);
    return !force && this.cachedPending !== void 0 ? this.cachedPending : this.pending;
  }
  startRefresh(force) {
    const builtin = builtinModels(this.baseURL);
    const listing = settled(fetchLiveModelIds(this.baseURL, this.fetcher).then((ids) => ({ ids, updatedAtMs: Date.now() })));
    const restored = this.metadata;
    if (!force && this.served === void 0 && restored !== void 0) {
      const status = { metadataLive: false, metadataUpdatedAtMs: this.metadataUpdatedAtMs };
      this.cachedPending = listing.then((result) => {
        const snapshot = this.build(builtin, result, restored, status);
        this.served = snapshot;
        return snapshot;
      });
    }
    const notify = this.cachedPending !== void 0 || !force && this.served !== void 0;
    this.pending = Promise.all([listing, settled(this.refreshMetadata(builtin)), this.cachedPending]).then(([listing2, result]) => this.build(
      builtin,
      listing2,
      result.status === "fulfilled" ? result.value : this.metadata,
      {
        metadataLive: result.status === "fulfilled",
        ...this.metadataUpdatedAtMs === void 0 ? {} : { metadataUpdatedAtMs: this.metadataUpdatedAtMs },
        ...result.status === "rejected" ? { metadataFailure: result.reason } : {}
      }
    )).then((snapshot) => {
      this.served = snapshot;
      this.failures = snapshot.live && snapshot.metadataLive ? 0 : Math.min(this.failures + 1, 5);
      const lifetime = this.failures === 0 ? this.refreshMs : Math.min(this.refreshMs, RETRY_MIN_MS * 2 ** (this.failures - 1), RETRY_MAX_MS);
      this.refreshAtMs = snapshot.fetchedAtMs + lifetime;
      if (notify) this.onRefresh();
      return snapshot;
    }).finally(() => {
      this.pending = void 0;
      this.cachedPending = void 0;
    });
    void this.pending.catch(() => {
    });
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
    }, MODEL_METADATA_MAX_BYTES, "gzip", this.fetcher);
    if (response.status === 304 && this.metadata !== void 0) {
      this.metadataUpdatedAtMs = Date.now();
      this.metadataETag = metadataETag(response.headers.get("etag")) ?? this.metadataETag;
      await this.persistMetadata();
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
    this.metadataBody = body;
    this.metadataETag = metadataETag(response.headers.get("etag"));
    this.metadataUpdatedAtMs = Date.now();
    await this.persistMetadata();
    return metadata;
  }
  async persistMetadata() {
    await writeMetadataCache(this.cachePath, {
      body: this.metadataBody,
      etag: this.metadataETag,
      savedAtMs: this.metadataUpdatedAtMs
    });
  }
  /** Gateway ids decide membership; online metadata decides how to call each model. */
  build(builtin, listing, metadata, metadataStatus) {
    const known = new Map([...builtin, ...this.served?.models ?? [], ...metadata?.models ?? []]);
    if (metadataStatus.metadataFailure !== void 0) {
      this.onFallback({ url: MODEL_METADATA_URL, error: metadataStatus.metadataFailure, kept: known.size });
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
    if (unavailable.size > 0 && (metadataStatus.metadataLive || metadataStatus.metadataFailure !== void 0)) {
      this.onOmitted([...unavailable.keys()]);
    }
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
    if (!snapshot.models.has(id) && (snapshot === cached || this.cachedPending !== void 0)) {
      snapshot = await this.snapshot(true, signal);
    }
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

// src/usage-display.ts
var USAGE_DISPLAY_MODES = ["auto", "always", "off"];
var DEFAULT_USAGE_DISPLAY = "auto";

// src/accounts.ts
var MAX_ACCOUNTS = 20;
var DEFAULT_ACCOUNT_REF = "OPENCODE_API_KEY";
var ACCOUNT_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function accountRefOf(settings) {
  return settings.apiKeyEnv || DEFAULT_ACCOUNT_REF;
}
function accountsOf(settings) {
  const ref = accountRefOf(settings);
  if (settings.accounts?.length === 0) return [];
  const accounts = settings.accounts ?? [];
  return accounts.some((account) => account.apiKeyEnv === ref) ? accounts : [
    { id: `legacy:${ref}`, name: "", apiKeyEnv: ref },
    ...accounts
  ];
}
function assertAccounts(accounts, selectedRef) {
  if (accounts == null) return;
  if (!Array.isArray(accounts) || accounts.length > MAX_ACCOUNTS || accounts.length === MAX_ACCOUNTS && selectedRef && !accounts.some((account) => account.apiKeyEnv === selectedRef)) {
    throw new Error(`OpenCode Go supports at most ${MAX_ACCOUNTS} accounts, including the selected reference`);
  }
  const ids = /* @__PURE__ */ new Set();
  const refs = /* @__PURE__ */ new Set();
  for (const account of accounts) {
    if (!account || typeof account.id !== "string" || !account.id || account.id.length > 128 || account.id.startsWith("legacy:") && account.id !== `legacy:${account.apiKeyEnv}` || typeof account.name !== "string" || !account.name.trim() && account.id !== `legacy:${account.apiKeyEnv}` || account.name.length > 80 || typeof account.apiKeyEnv !== "string" || !ACCOUNT_REF_PATTERN.test(account.apiKeyEnv) || ids.has(account.id) || refs.has(account.apiKeyEnv)) throw new Error("Invalid or duplicate OpenCode Go account");
    ids.add(account.id);
    refs.add(account.apiKeyEnv);
  }
}

// src/config.ts
var DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
var DEFAULT_REFRESH_MINUTES = 60;
var DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
var fields = {
  enabled: z.boolean().default(true),
  usageDisplay: z.union(USAGE_DISPLAY_MODES.map((mode) => z.const(mode))).default(DEFAULT_USAGE_DISPLAY),
  modelVisibility: z.dict(z.boolean().required()).default({}),
  // A bare environment variable name: an empty string would otherwise pass the
  // schema, then never match any account (accountRefOf normalizes it away) and
  // silently deregister the route while the default credential still resolves.
  apiKeyEnv: z.string().role("credential-ref").pattern(ACCOUNT_REF_PATTERN).default(DEFAULT_API_KEY_ENV),
  accounts: z.union([z.const(null), z.array(z.object({
    id: z.string().required(),
    name: z.string().required(),
    apiKeyEnv: z.string().role("credential-ref").pattern(ACCOUNT_REF_PATTERN).required()
  })).max(MAX_ACCOUNTS)]).default(null),
  autoSwitch: z.boolean().default(false),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  proxyURL: z.string().default(""),
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
function assertApiKeyEnv(raw) {
  if (!ACCOUNT_REF_PATTERN.test(raw)) {
    throw new Error(`llm-opencode-go: apiKeyEnv "${raw}" must be an environment variable name ([A-Za-z_][A-Za-z0-9_]*)`);
  }
}

// src/proxy-url.ts
function assertProxyURL(raw) {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OpenCode Go: proxy address must be a valid URL");
  }
  if (!["http:", "https:", "socks5:"].includes(url.protocol)) {
    throw new Error("OpenCode Go: proxy address must use http://, https:// or socks5://");
  }
  if (!url.hostname || url.port === "0" || url.pathname !== "" && url.pathname !== "/" || url.search || url.hash) {
    throw new Error("OpenCode Go: proxy address must contain a host and optional port, without a path, query or fragment");
  }
  try {
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    throw new Error("OpenCode Go: proxy credentials contain invalid URL encoding");
  }
  return url.href;
}

// src/proxy.ts
import { ProxyAgent, Socks5ProxyAgent } from "undici";
var ProxyTransport = class {
  current;
  retired = /* @__PURE__ */ new Set();
  disposed = false;
  forProxy(raw) {
    const address = assertProxyURL(raw);
    if (!address) {
      this.retire();
      return void 0;
    }
    return (input, init) => {
      if (this.disposed) return Promise.reject(new Error("OpenCode Go proxy transport is disposed"));
      if (this.current?.address !== address) {
        const url = new URL(address);
        const dispatcher = url.protocol === "socks5:" ? new Socks5ProxyAgent(url) : new ProxyAgent(address);
        this.retire();
        this.current = { address, dispatcher };
      }
      const options = { ...init, dispatcher: this.current.dispatcher };
      return globalThis.fetch(input, options);
    };
  }
  /** Close replaced pools after their in-flight response bodies have finished. */
  retire() {
    if (!this.current) return;
    const { dispatcher } = this.current;
    this.current = void 0;
    this.retired.add(dispatcher);
    void dispatcher.close().catch(() => dispatcher.destroy()).catch(() => {
    }).finally(() => {
      this.retired.delete(dispatcher);
    });
  }
  /** Unloading the mount cancels remaining requests and releases every pool. */
  async dispose() {
    this.disposed = true;
    const dispatchers = [...this.retired, ...this.current ? [this.current.dispatcher] : []];
    this.current = void 0;
    this.retired.clear();
    await Promise.all(dispatchers.map((dispatcher) => dispatcher.destroy().catch(() => {
    })));
  }
};

// src/adapter.ts
function accountFailureReason(failure) {
  if (failure.code === "QUOTA") return "quota";
  if (failure.code === "MISSING_CREDENTIAL" || failure.code === "INVALID_CREDENTIAL" || failure.code === "AUTH" && (/\b401\b/.test(failure.message) || /invalid[ _-]?(?:api[ _-]?)?key|incorrect[ _-]?(?:api[ _-]?)?key|expired[ _-]?(?:api[ _-]?)?key/i.test(failure.message))) return "credential";
  return void 0;
}
var REJECTED_KEY_TTL_MS = 5 * 6e4;
function isGatewayKeyRejection(failure) {
  return failure.code === "INVALID_CREDENTIAL" || failure.code === "AUTH";
}
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
  return sessionId !== void 0 && sessionId.length > 0 ? sessionId : randomUUID2();
}
var OpencodeGoAdapter = class extends LlmAdapter {
  constructor(options) {
    super();
    this.options = options;
    this.transport = options.transport ?? new ProxyTransport();
  }
  /**
   * One catalog instance per endpoint/refresh pair. A settings write that
   * changes either gets a fresh resolver (and a fresh live-listing fetch) on
   * the next operation; an unchanged configuration keeps its cached snapshot
   * for the whole refresh interval.
   */
  catalogCache;
  transport;
  /** Per-reference rejection deadlines, isolated by the gateway that rejected it. */
  rejectedKeys = /* @__PURE__ */ new Map();
  /** Monotonic sequence of the latest request this adapter started. */
  callSeq = 0;
  dispose() {
    return this.transport.dispose();
  }
  /**
   * The catalog resolver for one configuration, rebuilding on the facts it
   * owns. Public for the plugin's discovery registration, which resolves the
   * current configuration the same way the adapter does.
   * @param config - the endpoint and refresh interval for the raw catalog.
   * @returns the resolver caching catalog values, independent of deployment limits.
   */
  catalogOf(config) {
    const key = JSON.stringify([config.baseURL, config.refreshMinutes, assertProxyURL(config.proxyURL)]);
    if (this.catalogCache?.key !== key) {
      const catalog = new OpencodeGoCatalog(
        assertBaseURL(config.baseURL),
        config.refreshMinutes * 6e4,
        /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
        this.options.onFallback ?? (() => {
        }),
        /* v8 ignore next -- the plugin always passes both observers; the defaults exist for direct construction */
        this.options.onOmitted ?? (() => {
        }),
        () => {
          if (this.catalogCache?.catalog === catalog) this.options.onCatalogRefresh?.();
        },
        this.transport.forProxy(config.proxyURL)
      );
      this.catalogCache = { key, catalog };
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
    return this.modelInfo((await this.callSnapshot(model, signal)).model);
  }
  /** Copy nested limits before discovery can yield to a settings update. */
  async callSnapshot(model, signal) {
    const config = structuredClone(this.options.config());
    const catalog = await this.catalogOf(config).forModel(model, signal);
    const resolved = catalog.models.get(model);
    if (resolved === void 0) {
      throw new LlmError6(`opencode-go has no model "${model}"`, "UNKNOWN_MODEL");
    }
    return { config, catalog, model: withModelLimit(resolved, config.modelLimits) };
  }
  /** Keep capability resolution and eventual dispatch on the same configuration. */
  async prepareCall(_provider, model, signal) {
    const snapshot = await this.callSnapshot(model, signal);
    return {
      model: this.modelInfo(snapshot.model),
      stream: (options) => this.streamWithSnapshot(options, snapshot)
    };
  }
  /** Describe one model: capacities plus the reasoning levels it actually offers. */
  modelInfo(model) {
    const reasoning = {};
    const levels = model.reasoning ? getSupportedThinkingLevels(model) : [];
    if (levels.length > 0) {
      const format = model.compat?.thinkingFormat;
      const fallback = format !== void 0 && NATIVE_THINKING_FLAGS.has(format) ? levels.includes("high") ? "high" : levels.findLast((level) => level !== "off") : void 0;
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
    if (options.stop !== void 0) {
      throw new LlmError6("llm-opencode-go does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
    }
    let snapshot;
    try {
      snapshot = await this.callSnapshot(options.model, options.signal);
    } catch (error) {
      if (!options.signal?.aborted) throw error;
      yield { type: "finish", reason: {
        kind: "aborted",
        failure: { code: "ABORTED", message: "opencode-go request aborted by caller" }
      } };
      return;
    }
    yield* this.streamWithSnapshot(options, snapshot);
  }
  /** Latest started request's sequence; a consumer fences late switch notices against it. */
  accountSwitchWatermark() {
    return this.callSeq;
  }
  async *streamWithSnapshot(options, snapshot) {
    const seq = ++this.callSeq;
    const accounts = accountsOf(snapshot.config);
    if (accounts.length === 0) throw new LlmError6("OpenCode Go has no accounts", "MISSING_CREDENTIAL");
    const preferred = accountRefOf(snapshot.config);
    const ordered = snapshot.config.autoSwitch ? [.../* @__PURE__ */ new Set([preferred, ...accounts.map((account) => account.apiKeyEnv)])] : [preferred];
    const now = Date.now();
    const gateway = assertBaseURL(snapshot.config.baseURL);
    const usable = ordered.filter((ref) => {
      const rejected = this.rejectedKeys.get(ref);
      const until = rejected?.get(gateway);
      if (until === void 0) return true;
      if (now >= until) {
        rejected.delete(gateway);
        if (rejected.size === 0) this.rejectedKeys.delete(ref);
        return true;
      }
      return false;
    });
    const refs = usable.length > 0 ? usable : ordered;
    const skippedRef = ordered.find((ref) => !refs.includes(ref));
    let switchReason;
    let failedRef;
    for (let attempt = 0; attempt < refs.length; attempt++) {
      let emitted = false;
      let usage;
      let retry = false;
      const announce = () => {
        if (emitted) return;
        const serving = refs[attempt];
        if (serving === preferred) this.options.onAccountSwitch?.(void 0, snapshot.config, seq);
        else this.options.onAccountSwitch?.({
          // The notice names the account the journey left: the first one that
          // failed this request, else the first one skipped for a remembered
          // rejection.
          fromRef: failedRef ?? skippedRef ?? preferred,
          toRef: serving,
          reason: switchReason ?? "credential",
          at: Date.now()
        }, snapshot.config, seq);
      };
      try {
        for await (const chunk of this.streamAttempt(options, {
          ...snapshot,
          config: { ...snapshot.config, apiKeyEnv: refs[attempt] }
        })) {
          if (chunk.type === "usage") {
            usage = chunk;
            continue;
          }
          if (chunk.type === "finish") {
            const failure = chunk.reason.kind === "error" ? chunk.reason.failure : void 0;
            const reason = failure === void 0 ? void 0 : accountFailureReason(failure);
            if (reason && failure !== void 0 && !emitted && !options.signal?.aborted && !((usage?.usage.totalTokens ?? 0) > 0) && attempt + 1 < refs.length) {
              if (isGatewayKeyRejection(failure)) this.rememberRejectedKey(refs[attempt], gateway);
              switchReason ??= reason;
              failedRef ??= refs[attempt];
              retry = true;
              break;
            }
            if (chunk.reason.kind === "stop" || chunk.reason.kind === "tool-calls" || chunk.reason.kind === "max-tokens") announce();
            if (usage) yield usage;
            yield chunk;
            return;
          }
          announce();
          emitted = true;
          yield chunk;
        }
        if (!retry) return;
      } catch (error) {
        const reason = error instanceof LlmError6 ? accountFailureReason(error) : void 0;
        if (!reason || emitted || options.signal?.aborted || attempt + 1 >= refs.length) throw error;
        if (error instanceof LlmError6 && isGatewayKeyRejection(error)) this.rememberRejectedKey(refs[attempt], gateway);
        switchReason ??= reason;
        failedRef ??= refs[attempt];
      }
    }
  }
  rememberRejectedKey(ref, gateway) {
    const rejected = this.rejectedKeys.get(ref) ?? /* @__PURE__ */ new Map();
    rejected.set(gateway, Date.now() + REJECTED_KEY_TTL_MS);
    this.rejectedKeys.set(ref, rejected);
  }
  /** A stored change to a reference outranks the gateway's last rejection of it. */
  forgetRejectedKey(ref) {
    this.rejectedKeys.delete(ref);
  }
  /** One account, one SDK attempt; host recovery still owns failures after output. */
  async *streamAttempt(options, snapshot) {
    var _stack = [];
    try {
      if (options.stop !== void 0) {
        throw new LlmError6("llm-opencode-go does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
      }
      const { config, catalog, model } = snapshot;
      const outputLimit = config.modelLimits[model.id]?.maxTokens;
      const maxTokens = outputLimit == null ? options.maxTokens : Math.min(options.maxTokens ?? outputLimit, outputLimit);
      const apiKey = await this.options.resolveApiKey(config);
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
        const events = catalog.provider.streamSimple(withRequestReasoning(model, reasoning), normalizeContext(context), {
          apiKey,
          fetch: this.transport.forProxy(config.proxyURL),
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
        const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id, options.provider)[Symbol.asyncIterator]();
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
import { randomUUID as randomUUID3 } from "node:crypto";
import { RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { attributionHeaders as attributionHeaders3 } from "@deepseek-ai/dsh-llm";

// src/usage-contract.ts
function parseAccountSwitch(value) {
  const notice = value;
  if (!notice || typeof notice.fromRef !== "string" || typeof notice.toRef !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(notice.fromRef) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(notice.toRef) || notice.reason !== "quota" && notice.reason !== "credential" || typeof notice.at !== "number" || !Number.isSafeInteger(notice.at) || notice.at < 0 || notice.at > 864e13) throw new Error("Invalid account switch notice");
  return { fromRef: notice.fromRef, toRef: notice.toRef, reason: notice.reason, at: notice.at };
}
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
  if (source.lastSwitch !== void 0) {
    result.lastSwitch = parseAccountSwitch(source.lastSwitch);
  }
  for (const key of ["rolling", "weekly", "monthly"]) {
    const row = source[key];
    if (!row || row.status !== "ok" && row.status !== "rate-limited" || typeof row.percent !== "number" || !Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100 || typeof row.resetsAt !== "string" || !Number.isFinite(Date.parse(row.resetsAt))) {
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
var parseRef = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("Invalid account reference");
  return value;
};
var refCodec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#AccountRef",
  schema: { parse: parseRef },
  create: () => ({ parse: parseRef })
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
  }, {
    id: "dsh-opencode-go#opencodeGoUsage/readAccount",
    service: "opencodeGoUsage",
    namespace: "opencodeGoUsage",
    method: "readAccount",
    invocation: { kind: "direct" },
    parameters: [{ name: "ref", wire: "ref", source: "json", codec: refCodec }],
    result: usageCodec
  }]
};

// src/usage.ts
var USAGE_MAX_BYTES = 1024 * 1024;
var GoUsageService = class extends TypertRemoteService {
  constructor(ctx, options) {
    super(ctx, "opencodeGoUsage");
    this.options = options;
    this.transport = options.transport ?? new ProxyTransport();
    if (!options.transport) ctx.effect(() => () => this.transport.dispose());
  }
  identities = /* @__PURE__ */ new Map();
  pending = /* @__PURE__ */ new Map();
  transport;
  async read() {
    try {
      const usage = await this.readRef(this.options.activeRef?.());
      const lastSwitch = this.options.lastSwitch?.();
      return lastSwitch ? { ...usage, lastSwitch } : usage;
    } catch (error) {
      const lastSwitch = this.options.lastSwitch?.();
      if (lastSwitch && error instanceof RemoteError && error.code === "opencode-go/usage-unavailable") {
        throw new RemoteError(
          "opencode-go/usage-unavailable",
          error.message,
          { ...error.details, lastSwitch },
          { cause: error }
        );
      }
      throw error;
    }
  }
  async readAccount(ref) {
    if (!this.options.accountRefs?.().includes(ref)) {
      throw new RemoteError("gateway/bad-request", "Unknown OpenCode Go account", {});
    }
    return this.readRef(ref);
  }
  async readRef(ref) {
    const identityKey = ref ?? "";
    if (this.options.accountRefs) for (const saved of this.identities.keys()) {
      if (saved && !this.options.accountRefs().includes(saved)) this.identities.delete(saved);
    }
    const baseURL = assertBaseURL(this.options.baseURL()).replace(/\/$/, "");
    const proxyURL = assertProxyURL(this.options.proxyURL?.());
    let key;
    try {
      key = await this.options.resolveApiKey(ref);
    } catch (error) {
      this.identities.delete(identityKey);
      const missing = error instanceof Error && "code" in error && error.code === "MISSING_CREDENTIAL";
      throw new RemoteError("opencode-go/usage-unavailable", missing ? "OpenCode Go API key is not configured" : "Could not resolve the OpenCode Go API key", {
        retryable: !missing,
        retainPrevious: false
      }, { cause: error });
    }
    if (!key) {
      this.identities.delete(identityKey);
      throw new RemoteError("opencode-go/usage-unavailable", "OpenCode Go API key is not configured", {
        retryable: false,
        retainPrevious: false
      });
    }
    let identity = this.identities.get(identityKey);
    if (identity?.baseURL !== baseURL || identity.proxyURL !== proxyURL || identity.key !== key) {
      identity = { baseURL, proxyURL, key, source: randomUUID3() };
      this.identities.set(identityKey, identity);
    }
    const { source } = identity;
    const shared = this.pending.get(source);
    if (shared) return shared;
    const pending = this.fetchUsage(baseURL, key, source, this.transport.forProxy(proxyURL));
    this.pending.set(source, pending);
    try {
      return await pending;
    } finally {
      this.pending.delete(source);
    }
  }
  async fetchUsage(baseURL, key, source, fetcher) {
    const endpoint = diagnosticURL(`${baseURL}/usage`);
    let result;
    try {
      result = await fetchJsonResponse(`${baseURL}/usage`, {
        headers: { ...attributionHeaders3(), Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(1e4),
        redirect: "error"
      }, USAGE_MAX_BYTES, "identity", fetcher);
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
  assertProxyURL(entry.proxyURL);
  assertApiKeyEnv(entry.apiKeyEnv);
  assertAccounts(entry.accounts, entry.apiKeyEnv);
  let current = () => readConfig(config);
  const resolveApiKey = async (config2 = current()) => {
    const ref = accountRefOf(config2);
    if (!accountsOf(config2).some((account) => account.apiKeyEnv === ref)) {
      throw new LlmError7("OpenCode Go has no selected account", "MISSING_CREDENTIAL");
    }
    const credentials = ctx.get("credentials");
    const hit = credentials !== void 0 ? (await credentials.resolve(credentialRef(ref)))?.value : launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== void 0 && hit.length > 0) return assertUsableApiKey(hit, name, ref);
    throw new LlmError7(
      `llm-opencode-go: no credential; the profile resolves ${ref}, which is not set \u2014 store ${ref} through the credentials service or export it`,
      "MISSING_CREDENTIAL"
    );
  };
  registerGoRemotes(ctx);
  let lastSwitch;
  let lastSwitchSeq = -1;
  const transport = new ProxyTransport();
  ctx.effect(() => () => transport.dispose());
  ctx.plugin(GoUsageService, {
    baseURL: () => current().baseURL,
    proxyURL: () => current().proxyURL,
    transport,
    resolveApiKey: (ref) => resolveApiKey({ ...current(), apiKeyEnv: ref ?? current().apiKeyEnv }),
    activeRef: () => accountRefOf(current()),
    accountRefs: () => accountsOf(current()).map((account) => account.apiKeyEnv),
    lastSwitch: () => lastSwitch
  });
  const logger = {
    fallback: ({ url, error }) => {
      ctx.logger.warn(`llm-opencode-go: could not refresh ${url}; using last-known model data (${String(error)})`);
    },
    omitted: (ids) => {
      ctx.logger.warn(`llm-opencode-go: gateway models awaiting usable online metadata: ${ids.join(", ")}`);
    }
  };
  let registration;
  const adapter = new OpencodeGoAdapter({
    transport,
    config: () => current(),
    resolveApiKey,
    onAccountSwitch: (notice, captured, seq) => {
      const config2 = current();
      if (config2.baseURL === captured.baseURL && config2.proxyURL === captured.proxyURL && config2.apiKeyEnv === captured.apiKeyEnv && JSON.stringify(config2.accounts) === JSON.stringify(captured.accounts) && seq >= lastSwitchSeq) {
        lastSwitchSeq = seq;
        lastSwitch = notice;
      }
    },
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
    onCatalogRefresh: () => {
      registration?.replace([PROVIDER_ID]);
    },
    onReplayDegrade: (reason) => {
      ctx.logger.warn(`llm-opencode-go: unusable replay state on assistant history; sending provider-neutral content (${reason})`);
    }
  });
  const clearAccountSwitch = () => {
    lastSwitch = void 0;
    lastSwitchSeq = adapter.accountSwitchWatermark();
  };
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
        ctx.logger.info(`llm-opencode-go: route "${PROVIDER_ID}" registered as ${DISPLAY_NAME}`);
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
  let routeCheck = 0;
  let accountIdentity = "";
  const syncRoute = () => {
    const check = ++routeCheck;
    const config2 = current();
    const identity = JSON.stringify([config2.apiKeyEnv, config2.accounts, config2.baseURL, config2.proxyURL, config2.autoSwitch]);
    if (identity !== accountIdentity) {
      accountIdentity = identity;
      clearAccountSwitch();
    }
    const visibility = pickerVisibilityOf();
    if (pickerVisibility !== visibility) {
      pickerVisibility = visibility;
      registration?.replace([PROVIDER_ID]);
    }
    const credentials = ctx.get("credentials");
    const selected = accountRefOf(config2);
    const refs = accountsOf(config2).filter((account) => config2.autoSwitch || account.apiKeyEnv === selected).map((account) => account.apiKeyEnv);
    if (credentials === void 0) {
      applyRoute(refs.some((ref) => Boolean(launchEnvironmentOf(ctx).get(ref)?.value)));
      return;
    }
    void Promise.all(refs.map((ref) => credentials.describe(credentialRef(ref)))).then((infos) => {
      if (check === routeCheck) applyRoute(infos.some((info) => info.configured));
    }).catch((error) => {
      ctx.logger.error(`llm-opencode-go: credential describe failed; keeping the previous route state (${String(error)})`);
    });
  };
  syncRoute();
  let undiscover = () => {
  };
  try {
    undiscover = ctx.llm.registerModelDiscovery(name, async (request) => {
      if (request.provider !== PROVIDER_ID && !(request.baseURL ?? "").includes("opencode.ai")) {
        throw new LlmError7(
          "llm-opencode-go discovers only OpenCode zen/go endpoints; enter this provider's models by hand",
          "DISCOVERY_UNSUPPORTED"
        );
      }
      return discoverCatalogModels(adapter.catalogOf(current()));
    });
  } catch (error) {
    ctx.logger.error(`llm-opencode-go: not registering model discovery for "${name}" (${String(error)})`);
  }
  ctx.effect(() => () => {
    registration?.();
    registration = void 0;
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
        assertProxyURL(value.proxyURL);
        if (typeof value.apiKeyEnv === "string") assertApiKeyEnv(value.apiKeyEnv);
        assertAccounts(value.accounts, value.apiKeyEnv);
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
    if (this === ctx.fiber) {
      const raw2 = value;
      if (typeof raw2.apiKeyEnv === "string") assertApiKeyEnv(raw2.apiKeyEnv);
      const config2 = PlainConfig(value);
      assertBaseURL(config2.baseURL);
      assertProxyURL(config2.proxyURL);
      assertAccounts(config2.accounts, config2.apiKeyEnv);
    }
    return value;
  });
  ctx.on("loader/volatile-update", syncRoute);
  ctx.inject(["credentials"], (credentialsCtx) => {
    credentialsCtx.on("credentials/reference-updated", (ref) => {
      adapter.forgetRejectedKey(ref);
      if (accountsOf(current()).some((account) => account.apiKeyEnv === ref)) {
        clearAccountSwitch();
        syncRoute();
      }
    });
    syncRoute();
  });
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
  assertProxyURL,
  discoverCatalogModels,
  inject,
  name,
  readLiveModelIds
};
