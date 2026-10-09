import { createRequire as __createRequire } from 'node:module'; var require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// node_modules/partial-json/dist/options.js
var require_options = __commonJS({
  "node_modules/partial-json/dist/options.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Allow = exports.ALL = exports.COLLECTION = exports.ATOM = exports.SPECIAL = exports.INF = exports._INFINITY = exports.INFINITY = exports.NAN = exports.BOOL = exports.NULL = exports.OBJ = exports.ARR = exports.NUM = exports.STR = void 0;
    exports.STR = 1;
    exports.NUM = 2;
    exports.ARR = 4;
    exports.OBJ = 8;
    exports.NULL = 16;
    exports.BOOL = 32;
    exports.NAN = 64;
    exports.INFINITY = 128;
    exports._INFINITY = 256;
    exports.INF = exports.INFINITY | exports._INFINITY;
    exports.SPECIAL = exports.NULL | exports.BOOL | exports.INF | exports.NAN;
    exports.ATOM = exports.STR | exports.NUM | exports.SPECIAL;
    exports.COLLECTION = exports.ARR | exports.OBJ;
    exports.ALL = exports.ATOM | exports.COLLECTION;
    exports.Allow = { STR: exports.STR, NUM: exports.NUM, ARR: exports.ARR, OBJ: exports.OBJ, NULL: exports.NULL, BOOL: exports.BOOL, NAN: exports.NAN, INFINITY: exports.INFINITY, _INFINITY: exports._INFINITY, INF: exports.INF, SPECIAL: exports.SPECIAL, ATOM: exports.ATOM, COLLECTION: exports.COLLECTION, ALL: exports.ALL };
    exports.default = exports.Allow;
  }
});

// node_modules/partial-json/dist/index.js
var require_dist = __commonJS({
  "node_modules/partial-json/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Allow = exports.MalformedJSON = exports.PartialJSON = exports.parseJSON = exports.parse = void 0;
    var options_1 = require_options();
    Object.defineProperty(exports, "Allow", { enumerable: true, get: function() {
      return options_1.Allow;
    } });
    __exportStar(require_options(), exports);
    var PartialJSON = class extends Error {
    };
    exports.PartialJSON = PartialJSON;
    var MalformedJSON = class extends Error {
    };
    exports.MalformedJSON = MalformedJSON;
    function parseJSON(jsonString, allowPartial = options_1.Allow.ALL) {
      if (typeof jsonString !== "string") {
        throw new TypeError(`expecting str, got ${typeof jsonString}`);
      }
      if (!jsonString.trim()) {
        throw new Error(`${jsonString} is empty`);
      }
      return _parseJSON(jsonString.trim(), allowPartial);
    }
    exports.parseJSON = parseJSON;
    var _parseJSON = (jsonString, allow) => {
      const length = jsonString.length;
      let index = 0;
      const markPartialJSON = (msg) => {
        throw new PartialJSON(`${msg} at position ${index}`);
      };
      const throwMalformedError = (msg) => {
        throw new MalformedJSON(`${msg} at position ${index}`);
      };
      const parseAny = () => {
        skipBlank();
        if (index >= length)
          markPartialJSON("Unexpected end of input");
        if (jsonString[index] === '"')
          return parseStr();
        if (jsonString[index] === "{")
          return parseObj();
        if (jsonString[index] === "[")
          return parseArr();
        if (jsonString.substring(index, index + 4) === "null" || options_1.Allow.NULL & allow && length - index < 4 && "null".startsWith(jsonString.substring(index))) {
          index += 4;
          return null;
        }
        if (jsonString.substring(index, index + 4) === "true" || options_1.Allow.BOOL & allow && length - index < 4 && "true".startsWith(jsonString.substring(index))) {
          index += 4;
          return true;
        }
        if (jsonString.substring(index, index + 5) === "false" || options_1.Allow.BOOL & allow && length - index < 5 && "false".startsWith(jsonString.substring(index))) {
          index += 5;
          return false;
        }
        if (jsonString.substring(index, index + 8) === "Infinity" || options_1.Allow.INFINITY & allow && length - index < 8 && "Infinity".startsWith(jsonString.substring(index))) {
          index += 8;
          return Infinity;
        }
        if (jsonString.substring(index, index + 9) === "-Infinity" || options_1.Allow._INFINITY & allow && 1 < length - index && length - index < 9 && "-Infinity".startsWith(jsonString.substring(index))) {
          index += 9;
          return -Infinity;
        }
        if (jsonString.substring(index, index + 3) === "NaN" || options_1.Allow.NAN & allow && length - index < 3 && "NaN".startsWith(jsonString.substring(index))) {
          index += 3;
          return NaN;
        }
        return parseNum();
      };
      const parseStr = () => {
        const start = index;
        let escape = false;
        index++;
        while (index < length && (jsonString[index] !== '"' || escape && jsonString[index - 1] === "\\")) {
          escape = jsonString[index] === "\\" ? !escape : false;
          index++;
        }
        if (jsonString.charAt(index) == '"') {
          try {
            return JSON.parse(jsonString.substring(start, ++index - Number(escape)));
          } catch (e) {
            throwMalformedError(String(e));
          }
        } else if (options_1.Allow.STR & allow) {
          try {
            return JSON.parse(jsonString.substring(start, index - Number(escape)) + '"');
          } catch (e) {
            return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("\\")) + '"');
          }
        }
        markPartialJSON("Unterminated string literal");
      };
      const parseObj = () => {
        index++;
        skipBlank();
        const obj = {};
        try {
          while (jsonString[index] !== "}") {
            skipBlank();
            if (index >= length && options_1.Allow.OBJ & allow)
              return obj;
            const key = parseStr();
            skipBlank();
            index++;
            try {
              const value = parseAny();
              obj[key] = value;
            } catch (e) {
              if (options_1.Allow.OBJ & allow)
                return obj;
              else
                throw e;
            }
            skipBlank();
            if (jsonString[index] === ",")
              index++;
          }
        } catch (e) {
          if (options_1.Allow.OBJ & allow)
            return obj;
          else
            markPartialJSON("Expected '}' at end of object");
        }
        index++;
        return obj;
      };
      const parseArr = () => {
        index++;
        const arr = [];
        try {
          while (jsonString[index] !== "]") {
            arr.push(parseAny());
            skipBlank();
            if (jsonString[index] === ",") {
              index++;
            }
          }
        } catch (e) {
          if (options_1.Allow.ARR & allow) {
            return arr;
          }
          markPartialJSON("Expected ']' at end of array");
        }
        index++;
        return arr;
      };
      const parseNum = () => {
        if (index === 0) {
          if (jsonString === "-")
            throwMalformedError("Not sure what '-' is");
          try {
            return JSON.parse(jsonString);
          } catch (e) {
            if (options_1.Allow.NUM & allow)
              try {
                return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf("e")));
              } catch (e2) {
              }
            throwMalformedError(String(e));
          }
        }
        const start = index;
        if (jsonString[index] === "-")
          index++;
        while (jsonString[index] && ",]}".indexOf(jsonString[index]) === -1)
          index++;
        if (index == length && !(options_1.Allow.NUM & allow))
          markPartialJSON("Unterminated number literal");
        try {
          return JSON.parse(jsonString.substring(start, index));
        } catch (e) {
          if (jsonString.substring(start, index) === "-")
            markPartialJSON("Not sure what '-' is");
          try {
            return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("e")));
          } catch (e2) {
            throwMalformedError(String(e2));
          }
        }
      };
      const skipBlank = () => {
        while (index < length && " \n\r	".includes(jsonString[index])) {
          index++;
        }
      };
      return parseAny();
    };
    var parse = parseJSON;
    exports.parse = parse;
  }
});

// src/index.ts
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { credentialRef as credentialRef2 } from "@deepseek-ai/dsh-credentials";
import { LlmError as LlmError9, assertUsableApiKey, resolveImageAttachmentAccess } from "@deepseek-ai/dsh-llm";

// src/adapter.ts
import { randomUUID as randomUUID4 } from "node:crypto";

// node_modules/opencode-go-pi-ai/dist/utils/event-stream.js
var FifoQueue = class {
  incoming = [];
  outgoing = [];
  get length() {
    return this.incoming.length + this.outgoing.length;
  }
  enqueue(value) {
    this.incoming.push(value);
  }
  dequeue() {
    if (this.outgoing.length === 0) {
      while (this.incoming.length > 0) {
        this.outgoing.push(this.incoming.pop());
      }
    }
    return this.outgoing.pop();
  }
};
var EventStream = class {
  queue = new FifoQueue();
  waiting = new FifoQueue();
  done = false;
  finalResultPromise;
  resolveFinalResult;
  isComplete;
  extractResult;
  constructor(isComplete, extractResult) {
    this.isComplete = isComplete;
    this.extractResult = extractResult;
    this.finalResultPromise = new Promise((resolve3) => {
      this.resolveFinalResult = resolve3;
    });
  }
  push(event) {
    if (this.done)
      return;
    if (this.isComplete(event)) {
      this.done = true;
      this.resolveFinalResult(this.extractResult(event));
    }
    const waiter = this.waiting.dequeue();
    if (waiter) {
      waiter({ value: event, done: false });
    } else {
      this.queue.enqueue(event);
    }
  }
  end(result) {
    this.done = true;
    if (result !== void 0) {
      this.resolveFinalResult(result);
    }
    while (this.waiting.length > 0) {
      const waiter = this.waiting.dequeue();
      waiter({ value: void 0, done: true });
    }
  }
  async *[Symbol.asyncIterator]() {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.dequeue();
      } else if (this.done) {
        return;
      } else {
        const result = await new Promise((resolve3) => this.waiting.enqueue(resolve3));
        if (result.done)
          return;
        yield result.value;
      }
    }
  }
  result() {
    return this.finalResultPromise;
  }
};
var AssistantMessageEventStream = class extends EventStream {
  #startedAt = Date.now();
  #startedAtMonotonic = performance.now();
  constructor() {
    super((event) => event.type === "done" || event.type === "error", (event) => {
      if (event.type === "done") {
        return event.message;
      } else if (event.type === "error") {
        return event.error;
      }
      throw new Error("Unexpected event type for final result");
    });
  }
  push(event) {
    if (event.type === "done")
      this.#time(event.message);
    else if (event.type === "error")
      this.#time(event.error);
    super.push(event);
  }
  end(result) {
    if (result !== void 0)
      this.#time(result);
    super.end(result);
  }
  #time(message) {
    if (this.done || message.durationMs !== void 0 || message.timestamp < this.#startedAt)
      return;
    message.durationMs = Math.max(0, Math.round(performance.now() - this.#startedAtMonotonic));
  }
};

// node_modules/opencode-go-pi-ai/dist/api/lazy.js
function createSetupErrorMessage(model, error, timestamp) {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason: "error",
    errorMessage: error instanceof Error ? error.message : String(error),
    timestamp
  };
}
function hasResult(source) {
  return typeof source.result === "function";
}
async function forwardStream(target, source) {
  for await (const event of source) {
    target.push(event);
  }
  target.end(hasResult(source) ? await source.result() : void 0);
}
function lazyStream(model, setup) {
  const startedAt = Date.now();
  const outer = new AssistantMessageEventStream();
  setup().then((inner) => forwardStream(outer, inner)).catch((error) => {
    const message = createSetupErrorMessage(model, error, startedAt);
    outer.push({ type: "error", reason: "error", error: message });
    outer.end(message);
  });
  return outer;
}

// node_modules/opencode-go-pi-ai/dist/utils/diagnostics.js
function formatThrownValue(value) {
  if (value instanceof Error)
    return value.message || value.name;
  if (typeof value === "string")
    return value;
  return String(value);
}
function appendAssistantMessageDiagnostic(message, diagnostic) {
  message.diagnostics = [...message.diagnostics ?? [], diagnostic];
}

// node_modules/opencode-go-pi-ai/dist/utils/models-error.js
var ModelsError = class extends Error {
  code;
  constructor(code, message, options) {
    super(withCauseDetail(message, options?.cause), options);
    this.name = "ModelsError";
    this.code = code;
  }
};
function withCauseDetail(message, cause) {
  if (cause === void 0 || cause === null)
    return message;
  const detail = formatThrownValue(cause).trim();
  if (!detail || message.includes(detail))
    return message;
  return `${message}: ${detail}`;
}

// node_modules/opencode-go-pi-ai/dist/auth/resolve.js
var DEFAULT_OAUTH_MINIMUM_VALIDITY_MS = 5 * 60 * 1e3;

// node_modules/opencode-go-pi-ai/dist/utils/model-operations.js
function getModelType(model) {
  return model.type ?? "chat";
}
function isModelType(model, type) {
  return getModelType(model) === type;
}
function imageErrorResult(model, error, aborted = false) {
  return {
    api: model.api,
    provider: model.provider,
    model: model.id,
    output: [],
    stopReason: aborted ? "aborted" : "error",
    errorMessage: error instanceof Error ? error.message : String(error),
    timestamp: Date.now()
  };
}
function classifierErrorResult(model, error, aborted = false) {
  return {
    api: model.api,
    provider: model.provider,
    model: model.id,
    answers: {},
    stopReason: aborted ? "aborted" : "error",
    errorMessage: error instanceof Error ? error.message : String(error),
    timestamp: Date.now()
  };
}

// node_modules/opencode-go-pi-ai/dist/utils/text.js
function contentText(content, separator = "\n") {
  if (typeof content === "string")
    return content;
  return content.filter((block) => block.type === "text").map((block) => block.text).join(separator);
}
function getSystemMessageText(message) {
  const parts = [contentText(message.content)];
  for (const text of Object.values(message.sections ?? {})) {
    if (text !== null)
      parts.push(text);
  }
  return parts.filter((part) => part.length > 0).join("\n\n");
}
function renderSystemMessageUpdate(message) {
  const parts = [];
  const text = contentText(message.content);
  if (text.length > 0)
    parts.push(text);
  for (const [name2, value] of Object.entries(message.sections ?? {})) {
    parts.push(value === null ? `Removed system prompt section "${name2}".` : `Updated system prompt section "${name2}":

${value}`);
  }
  return parts.join("\n\n");
}

// node_modules/opencode-go-pi-ai/dist/utils/transcript.js
function createInitialSystemMessage(systemPrompt, tools) {
  const hasSystemPrompt = systemPrompt !== void 0 && systemPrompt.length > 0;
  const hasTools = tools !== void 0 && tools.length > 0;
  if (!hasSystemPrompt && !hasTools)
    return void 0;
  return {
    role: "system",
    content: systemPrompt ?? "",
    ...hasTools ? { toolsAdded: tools } : {},
    timestamp: 0
  };
}
function normalizeContext(context) {
  const initialMessage = createInitialSystemMessage(context.systemPrompt, context.tools);
  const messages = initialMessage ? [initialMessage, ...context.messages] : context.messages;
  return { messages };
}
function isSystemMessage(message) {
  return message.role === "system";
}
function getInitialSystemMessage(messages) {
  const first = messages[0];
  return first && isSystemMessage(first) ? first : void 0;
}
function getCurrentTools(messages) {
  const tools = /* @__PURE__ */ new Map();
  for (const message of messages) {
    if (!isSystemMessage(message))
      continue;
    for (const tool of message.toolsRemoved ?? [])
      tools.delete(tool.name);
    for (const tool of message.toolsAdded ?? [])
      tools.set(tool.name, tool);
  }
  return [...tools.values()];
}
function getCurrentSystemMessage(messages) {
  const content = [];
  const sections = /* @__PURE__ */ new Map();
  let timestamp;
  for (const message of messages) {
    if (!isSystemMessage(message))
      continue;
    timestamp ??= message.timestamp;
    const text = contentText(message.content);
    if (text.length > 0)
      content.push(text);
    for (const [name2, value] of Object.entries(message.sections ?? {})) {
      if (value === null)
        sections.delete(name2);
      else
        sections.set(name2, value);
    }
  }
  const tools = getCurrentTools(messages);
  if (timestamp === void 0 && tools.length === 0)
    return void 0;
  return {
    role: "system",
    content: content.join("\n\n"),
    ...sections.size > 0 ? { sections: Object.fromEntries(sections) } : {},
    ...tools.length > 0 ? { toolsAdded: tools } : {},
    timestamp: timestamp ?? 0
  };
}
function collapseSystemMessages(context) {
  const head = getCurrentSystemMessage(context.messages);
  const messages = context.messages.filter((message) => message.role !== "system");
  return { messages: head ? [head, ...messages] : messages };
}
function resolveTranscript(context, supportsMidConvoSystemMessages) {
  return supportsMidConvoSystemMessages ? context : collapseSystemMessages(context);
}
function getDeclaredTools(messages) {
  const definitions = /* @__PURE__ */ new Map();
  for (const message of messages) {
    if (!isSystemMessage(message))
      continue;
    for (const tool of message.toolsAdded ?? [])
      definitions.set(tool.name, tool);
  }
  return [...definitions.values()];
}
function hasNonAdditiveToolChanges(messages) {
  const declared = /* @__PURE__ */ new Set();
  for (const message of messages) {
    if (!isSystemMessage(message))
      continue;
    if ((message.toolsRemoved?.length ?? 0) > 0)
      return true;
    for (const tool of message.toolsAdded ?? []) {
      if (declared.has(tool.name))
        return true;
      declared.add(tool.name);
    }
  }
  return false;
}
function resolveTranscriptTools(messages, supportsToolAdditions) {
  const anchorsAdditions = supportsToolAdditions && !hasNonAdditiveToolChanges(messages);
  return {
    requestTools: anchorsAdditions ? getInitialSystemMessage(messages)?.toolsAdded ?? [] : getCurrentTools(messages),
    anchorsAdditions
  };
}

// node_modules/opencode-go-pi-ai/dist/models.js
var KNOWN_MODEL_TYPES = { chat: true, image: true, classifier: true };
function hasKnownModelType(model) {
  return Object.hasOwn(KNOWN_MODEL_TYPES, getModelType(model));
}
function createProvider(input) {
  const single = input.api && typeof input.api.stream === "function" ? input.api : void 0;
  const byApi = single || !input.api ? void 0 : input.api;
  const images = input.images;
  const classifiers = input.classifiers;
  const streams = single ? [single] : Object.values(byApi ?? {}).filter((entry) => entry !== void 0);
  const imageImplementations = Object.values(images ?? {}).filter((entry) => entry !== void 0);
  const classifierImplementations = Object.values(classifiers ?? {}).filter((entry) => entry !== void 0);
  if (streams.length === 0 && imageImplementations.length === 0 && classifierImplementations.length === 0) {
    throw new Error(`Provider ${input.id}: at least one of "api", "images", or "classifiers" is required.`);
  }
  const baselineModels = input.models;
  let dynamicModels = [];
  const fetchModels = input.fetchModels;
  const currentModels = () => {
    const merged = [...baselineModels];
    for (const model of dynamicModels) {
      const index = merged.findIndex((entry) => getModelType(entry) === getModelType(model) && entry.id === model.id);
      if (index >= 0)
        merged[index] = model;
      else
        merged.push(model);
    }
    return merged;
  };
  const apiFor = (model) => single ?? byApi?.[model.api];
  const dispatch = (model, run) => {
    const streams2 = apiFor(model);
    if (!streams2) {
      return lazyStream(model, async () => {
        throw new ModelsError("stream", `Provider ${input.id} has no API implementation for "${model.api}"`);
      });
    }
    return run(streams2);
  };
  const provider = {
    id: input.id,
    name: input.name ?? input.id,
    baseUrl: input.baseUrl,
    headers: input.headers,
    auth: input.auth,
    getModels: () => currentModels().filter((model) => isModelType(model, "chat")),
    getAllModels: currentModels,
    refreshModels: fetchModels ? async (context) => {
      if (context.stored) {
        const restored = context.stored.models.filter((model) => model.provider === input.id).map((model) => model);
        if (!await context.publish({
          update: () => {
            dynamicModels = restored;
          }
        })) {
          return;
        }
      }
      if (!context.allowNetwork || context.signal.aborted)
        return;
      const fetched = await fetchModels(context);
      if (context.signal.aborted)
        return;
      const refreshed = fetched.filter(hasKnownModelType);
      await context.publish({
        persist: { models: refreshed, checkedAt: Date.now() },
        update: () => {
          dynamicModels = refreshed;
        }
      });
    } : void 0,
    filterModels: input.filterModels,
    filterAllModels: input.filterAllModels,
    stream: (model, context, options) => dispatch(model, (streams2) => streams2.stream(model, context, options)),
    streamSimple: (model, context, options) => dispatch(model, (streams2) => streams2.streamSimple(model, context, options))
  };
  if (streams.some((entry) => entry.fetchDeferred !== void 0)) {
    provider.fetchDeferred = (model, handle, options) => lazyStream(model, async () => {
      const implementation = apiFor(model);
      if (!implementation?.fetchDeferred) {
        throw new ModelsError("provider", `Provider ${input.id} does not support deferred responses for "${model.api}"`);
      }
      return implementation.fetchDeferred(model, handle, options);
    });
  }
  if (streams.some((entry) => entry.cancelDeferred !== void 0)) {
    provider.cancelDeferred = async (model, handle, options) => {
      const implementation = apiFor(model);
      if (!implementation?.cancelDeferred) {
        throw new ModelsError("provider", `Provider ${input.id} cannot cancel deferred responses for "${model.api}"`);
      }
      await implementation.cancelDeferred(model, handle, options);
    };
  }
  if (images && imageImplementations.length > 0) {
    provider.generateImages = async (model, context, options) => {
      const implementation = images[model.api];
      if (!implementation) {
        return imageErrorResult(model, new ModelsError("provider", `Provider ${input.id} has no image generation implementation for "${model.api}"`));
      }
      return implementation.generateImages(model, context, options);
    };
  }
  if (classifiers && classifierImplementations.length > 0) {
    provider.classify = async (model, context, options) => {
      const implementation = classifiers[model.api];
      if (!implementation) {
        return classifierErrorResult(model, new ModelsError("provider", `Provider ${input.id} has no classifier implementation for "${model.api}"`));
      }
      return implementation.classify(model, context, options);
    };
  }
  return provider;
}
function calculateCost(model, usage) {
  const inputTokens = usage.input + usage.cacheRead + usage.cacheWrite;
  let rates2 = model.cost;
  let matchedThreshold = -1;
  for (const tier of model.cost.tiers ?? []) {
    if (inputTokens > tier.inputTokensAbove && tier.inputTokensAbove > matchedThreshold) {
      rates2 = tier;
      matchedThreshold = tier.inputTokensAbove;
    }
  }
  const longWrite = usage.cacheWrite1h ?? 0;
  const shortWrite = usage.cacheWrite - longWrite;
  usage.cost.input = rates2.input / 1e6 * usage.input;
  usage.cost.output = rates2.output / 1e6 * usage.output;
  usage.cost.cacheRead = rates2.cacheRead / 1e6 * usage.cacheRead;
  usage.cost.cacheWrite = (rates2.cacheWrite * shortWrite + rates2.input * 2 * longWrite) / 1e6;
  usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
  return usage.cost;
}
var EXTENDED_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
function getSupportedThinkingLevels(model) {
  if (!model.reasoning)
    return ["off"];
  return EXTENDED_THINKING_LEVELS.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level];
    if (mapped === null)
      return false;
    if (level === "xhigh" || level === "max")
      return mapped !== void 0;
    return true;
  });
}
function clampThinkingLevel(model, level) {
  const availableLevels = getSupportedThinkingLevels(model);
  if (availableLevels.includes(level))
    return level;
  const requestedIndex = EXTENDED_THINKING_LEVELS.indexOf(level);
  if (requestedIndex === -1)
    return availableLevels[0] ?? "off";
  for (let i = requestedIndex; i < EXTENDED_THINKING_LEVELS.length; i++) {
    const candidate = EXTENDED_THINKING_LEVELS[i];
    if (availableLevels.includes(candidate))
      return candidate;
  }
  for (let i = requestedIndex - 1; i >= 0; i--) {
    const candidate = EXTENDED_THINKING_LEVELS[i];
    if (availableLevels.includes(candidate))
      return candidate;
  }
  return availableLevels[0] ?? "off";
}

// node_modules/opencode-go-pi-ai/dist/utils/json-parse.js
var import_partial_json = __toESM(require_dist(), 1);
var VALID_JSON_ESCAPES = /* @__PURE__ */ new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);
function isControlCharacter(char) {
  const codePoint = char.codePointAt(0);
  return codePoint !== void 0 && codePoint >= 0 && codePoint <= 31;
}
function escapeControlCharacter(char) {
  switch (char) {
    case "\b":
      return "\\b";
    case "\f":
      return "\\f";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "	":
      return "\\t";
    default:
      return `\\u${char.codePointAt(0)?.toString(16).padStart(4, "0") ?? "0000"}`;
  }
}
function repairJson(json) {
  let repaired = "";
  let inString = false;
  for (let index = 0; index < json.length; index++) {
    const char = json[index];
    if (!inString) {
      repaired += char;
      if (char === '"') {
        inString = true;
      }
      continue;
    }
    if (char === '"') {
      repaired += char;
      inString = false;
      continue;
    }
    if (char === "\\") {
      const nextChar = json[index + 1];
      if (nextChar === void 0) {
        repaired += "\\\\";
        continue;
      }
      if (nextChar === "u") {
        const unicodeDigits = json.slice(index + 2, index + 6);
        if (/^[0-9a-fA-F]{4}$/.test(unicodeDigits)) {
          repaired += `\\u${unicodeDigits}`;
          index += 5;
          continue;
        }
      }
      if (VALID_JSON_ESCAPES.has(nextChar)) {
        repaired += `\\${nextChar}`;
        index += 1;
        continue;
      }
      repaired += "\\\\";
      continue;
    }
    repaired += isControlCharacter(char) ? escapeControlCharacter(char) : char;
  }
  return repaired;
}
function parseJsonWithRepair(json) {
  try {
    return JSON.parse(json);
  } catch (error) {
    const repairedJson = repairJson(json);
    if (repairedJson !== json) {
      return JSON.parse(repairedJson);
    }
    throw error;
  }
}
function parseStreamingJson(partialJson) {
  if (!partialJson || partialJson.trim() === "") {
    return {};
  }
  try {
    return parseJsonWithRepair(partialJson);
  } catch {
    try {
      const result = (0, import_partial_json.parse)(partialJson);
      return result ?? {};
    } catch {
      try {
        const result = (0, import_partial_json.parse)(repairJson(partialJson));
        return result ?? {};
      } catch {
        return {};
      }
    }
  }
}

// node_modules/opencode-go-pi-ai/dist/utils/overflow.js
var OVERFLOW_PATTERNS = [
  /prompt (?:is )?too long/i,
  // Anthropic and z.ai token overflow
  /prompt exceeds max length/i,
  // z.ai CN endpoint token overflow
  /request_too_large/i,
  // Anthropic request byte-size overflow (HTTP 413)
  /input is too long for requested model/i,
  // Amazon Bedrock
  /exceeds the context window/i,
  // OpenAI (Completions & Responses API)
  /exceeds (?:the )?(?:model'?s )?maximum context length(?: of [\d,]+ tokens?|\s*\([\d,]+\))/i,
  // OpenAI-compatible proxies (LiteLLM)
  /input token count.*exceeds the maximum/i,
  // Google (Gemini)
  /maximum prompt length is \d+/i,
  // xAI (Grok)
  /reduce the length of the messages/i,
  // Groq
  /maximum context length is \d+ tokens/i,
  // OpenRouter (most backends)
  /exceeds (?:the )?maximum allowed input length of [\d,]+ tokens?/i,
  // OpenRouter/Poolside
  /input \(\d+ tokens\) is longer than the model'?s context length \(\d+ tokens\)/i,
  // Together AI
  /exceeds the limit of \d+/i,
  // GitHub Copilot
  /exceeds the available context size/i,
  // llama.cpp server
  /greater than the context length/i,
  // LM Studio
  /context window exceeds limit/i,
  // MiniMax
  /exceeded model token limit/i,
  // Kimi For Coding
  /too large for model with \d+ maximum context length/i,
  // Mistral
  /prompt has [\d,]+ tokens?, but the configured context size is [\d,]+ tokens?/i,
  // DS4 server
  /model_context_window_exceeded/i,
  // z.ai non-standard finish_reason surfaced as error text
  /prompt too long; exceeded (?:max )?context length/i,
  // Ollama explicit overflow error
  /range of input length should be/i,
  // DashScope / Qwen Token Plan
  /context[_ ]length[_ ]exceeded/i,
  // Generic fallback
  /too many tokens/i,
  // Generic fallback
  /token limit exceeded/i
  // Generic fallback
];
var CEREBRAS_BODYLESS_OVERFLOW_PATTERN = /^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i;
var NON_OVERFLOW_PATTERNS = [
  /^(Throttling error|Service unavailable):/i,
  // AWS Bedrock non-overflow errors (human-readable prefixes from formatBedrockError)
  /rate limit/i,
  // Generic rate limiting
  /too many requests/i
  // Generic HTTP 429 style
];
function isContextOverflow(message, contextWindow) {
  if (message.stopReason === "error" && message.errorMessage) {
    const isNonOverflow = NON_OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage));
    if (!isNonOverflow) {
      if (OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage))) {
        return true;
      }
      if (message.provider === "cerebras" && CEREBRAS_BODYLESS_OVERFLOW_PATTERN.test(message.errorMessage)) {
        return true;
      }
    }
  }
  if (contextWindow && message.stopReason === "stop") {
    const inputTokens = message.usage.input + message.usage.cacheRead;
    if (inputTokens > contextWindow) {
      return true;
    }
  }
  if (contextWindow && message.stopReason === "length" && message.usage.output === 0) {
    const inputTokens = message.usage.input + message.usage.cacheRead;
    if (inputTokens >= contextWindow * 0.99) {
      return true;
    }
  }
  return false;
}

// src/adapter.ts
import {
  LlmAdapter,
  LlmError as LlmError8,
  ReasoningEffortId,
  attributionHeaders as attributionHeaders2,
  contentHasImage as contentHasImage2
} from "@deepseek-ai/dsh-llm";

// src/conversion/context.ts
import { brandString } from "@deepseek-ai/dsh-brand";
import { contentHasImage, LlmError as LlmError4, offloadedImageText, requestImageHandleText } from "@deepseek-ai/dsh-llm";

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
    if (policy.exact && policy.maxBytes !== void 0 || policy.maxImages !== void 0) {
      const offloadImages = api.requiredImageOffload(
        messages,
        { representation: "base64", maxBytes: policy.exact ? policy.maxBytes : void 0, maxImages: policy.maxImages, countQuantum: 1 },
        (block) => policy.exact ? policy.byteLength(block.attachment) : 0
      );
      if (offloadImages > 0) {
        throw new llm.LlmError(
          `pi-ai request images exceed the configured image count or base64 payload bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
          api.IMAGE_OFFLOAD_REQUIRED_CODE ?? "IMAGE_OFFLOAD_REQUIRED",
          { offloadImages }
        );
      }
    }
    if (!policy.exact) return messages;
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

// src/conversion/image-pool.ts
import { LlmError as LlmError3 } from "@deepseek-ai/dsh-llm";
var IMAGE_PREPARATION_CONCURRENCY = 4;
var IMAGE_PREPARATION_QUEUE_LIMIT = 32;
var IMAGE_PAYLOAD_BUDGET_BYTES = 128 * 1024 * 1024;
var active = 0;
var retainedBytes = 0;
var queued = [];
function observe(observer, started, rejected = false) {
  try {
    observer?.({
      queueWaitMs: performance.now() - started,
      active,
      queued: queued.length,
      retainedBytes,
      ...rejected ? { rejected: true } : {}
    });
  } catch {
  }
}
var ImagePayloadLease = class {
  constructor(observer) {
    this.observer = observer;
  }
  bytes = 0;
  closed = false;
  reserve(bytes) {
    if (this.closed) throw new LlmError3("Image preparation was cancelled", "ABORTED");
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > IMAGE_PAYLOAD_BUDGET_BYTES - retainedBytes) {
      observe(this.observer, performance.now(), true);
      throw new LlmError3("OpenCode Go image payload capacity is busy; retry after another image request completes", "IMAGE_RESOURCE_BUSY");
    }
    this.bytes += bytes;
    retainedBytes += bytes;
    observe(this.observer, performance.now());
  }
  [Symbol.dispose]() {
    if (this.closed) return;
    this.closed = true;
    retainedBytes -= this.bytes;
  }
};
function acquire(signal, observer) {
  return new Promise((resolve3, reject) => {
    const started = performance.now();
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      const index = queued.indexOf(start);
      if (index >= 0) queued.splice(index, 1);
      signal?.removeEventListener("abort", abort);
      observe(observer, started);
      reject(signal.reason);
    };
    const start = () => {
      signal?.removeEventListener("abort", abort);
      active++;
      observe(observer, started);
      resolve3(() => {
        active--;
        queued.shift()?.();
      });
    };
    if (active < IMAGE_PREPARATION_CONCURRENCY) start();
    else if (queued.length >= IMAGE_PREPARATION_QUEUE_LIMIT) {
      observe(observer, started, true);
      reject(new LlmError3("OpenCode Go image preparation queue is full; retry after another image request completes", "IMAGE_RESOURCE_BUSY"));
    } else {
      queued.push(start);
      signal?.addEventListener("abort", abort, { once: true });
      observe(observer, performance.now());
    }
  });
}
async function withImagePermit(work, signal, observer) {
  const release = await acquire(signal, observer);
  try {
    signal?.throwIfAborted();
    return await work();
  } finally {
    release();
  }
}

// src/request-control.ts
function waitWithSignal(work, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve3, reject) => {
    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      signal?.throwIfAborted();
      return work();
    }).then((value) => {
      cleanup();
      resolve3(value);
    }, (error) => {
      cleanup();
      reject(error);
    });
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
    if (message.role === "developer") throw new LlmError4("Developer messages are not supported yet", "UNSUPPORTED_CONTENT");
    if (!["system", "user", "assistant", "tool"].includes(message.role)) {
      throw new LlmError4(`Unsupported message role: ${message.role}`, "UNSUPPORTED_CONTENT");
    }
    if (message.content.some((block) => block.type === "tool-addition" || block.type === "tool-removal")) {
      throw new LlmError4("Tool-change blocks require developer role", "UNSUPPORTED_CONTENT");
    }
    if (message.role !== "user" && !toolMessage(message) && contentHasImage(message.content)) {
      throw new LlmError4(
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
function collectImageRefs(blocks, refs, occurrences) {
  for (const block of blocks) {
    if (block.type === "image") {
      if (block.offloaded !== true) {
        refs.set(block.attachment.attachmentId, block.attachment);
        occurrences.set(block.attachment.attachmentId, (occurrences.get(block.attachment.attachmentId) ?? 0) + 1);
      }
    } else if (block.type === "tool-result") {
      collectImageRefs(block.content, refs, occurrences);
    }
  }
}
async function prepareRequestImages(messages, attachments, budget, signal, maxEncodedBytes, checkBudget, lease, observer) {
  const refs = /* @__PURE__ */ new Map();
  const occurrences = /* @__PURE__ */ new Map();
  for (const message of messages) collectImageRefs(message.content, refs, occurrences);
  const orderedRefs = [...refs.values()];
  const versions = /* @__PURE__ */ new Map();
  const cancelled = new AbortController();
  const preparationSignal = signal ? AbortSignal.any([signal, cancelled.signal]) : cancelled.signal;
  let next = 0;
  let failed = false;
  let failure;
  let encodedBytes = 0;
  const worker = async () => {
    try {
      while (next < orderedRefs.length) {
        preparationSignal.throwIfAborted();
        const ref = orderedRefs[next++];
        const image = await waitWithSignal(() => withImagePermit(
          () => attachments.readImageRequest(ref, requestImageTarget(ref, budget), preparationSignal),
          preparationSignal,
          observer
        ), preparationSignal);
        preparationSignal.throwIfAborted();
        lease?.reserve(image.data.byteLength + Math.ceil(image.data.byteLength / 3) * 4 * occurrences.get(ref.attachmentId));
        versions.set(ref.attachmentId, image);
        encodedBytes += Math.ceil(image.bytes / 3) * 4 * occurrences.get(ref.attachmentId);
        if (maxEncodedBytes !== void 0 && encodedBytes > maxEncodedBytes) checkBudget?.(versions);
      }
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
        cancelled.abort(error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(IMAGE_PREPARATION_CONCURRENCY, orderedRefs.length) }, worker));
  if (failed) throw failure;
  return versions;
}
function toolsOf(options) {
  if (options.tools?.some((tool) => tool.deferLoading === true)) {
    throw new LlmError4("Deferred tool loading is not supported yet", "UNSUPPORTED_CONTENT");
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
      throw new LlmError4("pi-ai image conversion requires the durable attachment service", "UNSUPPORTED_CONTENT");
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
  var _stack = [];
  try {
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
    const localLease = __using(_stack, images.payloadLease === void 0 ? new ImagePayloadLease() : void 0);
    const requestImages = await prepareRequestImages(requestMessages, attachments, requestImagePolicy, options.signal, maxRequestImageBytes, (versions) => {
      projectRequestImages(requestMessages, {
        ...projection,
        exact: true,
        byteLength: (ref) => versions.get(ref.attachmentId)?.bytes ?? 0
      });
    }, images.payloadLease ?? localLease, images.onImagePool);
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
  } catch (_) {
    var _error = _, _hasError = true;
  } finally {
    __callDispose(_stack, _error, _hasError);
  }
}

// src/conversion/stream.ts
import { brandString as brandString2 } from "@deepseek-ai/dsh-brand";
import { CONTEXT_WINDOW_EXCEEDED_CODE, EMPTY_RESPONSE_CODE, isContextWindowExceededError, isQuotaExceededError, LlmError as LlmError5, QUOTA_EXCEEDED_CODE } from "@deepseek-ai/dsh-llm";
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
  if (isQuotaExceededError(message)) return QUOTA_EXCEEDED_CODE;
  if (/\b(?:401|403)\b/.test(message)) return "AUTH";
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
      default: {
        const unsupported = event;
        throw new LlmError5(`Unsupported pi-ai stream event: ${unsupported.type}`, "UNSUPPORTED_CONTENT");
      }
    }
  }
  throw new LlmError5("pi-ai event stream ended without done/error", "STREAM_CLOSED");
}

// src/adapter.ts
import { deadline, idleWatchdog, timeoutOf } from "@deepseek-ai/dsh-timeout";

// node_modules/opencode-go-pi-ai/dist/providers/data/opencode-go.json
var opencode_go_default = { "anthropic-messages": { "chat:claude-haiku-5-5": { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", api: "anthropic-messages", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go", reasoning: true, input: ["text", "image"], cost: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125, tiers: [{ inputTokensAbove: 1e5, input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 }] }, contextWindow: 1e6, maxTokens: 128e3, thinkingLevelMap: { xhigh: "xhigh", max: "max" }, compat: { forceAdaptiveThinking: true, supportsTemperature: false }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:minimax-m3": { id: "minimax-m3", name: "MiniMax-M3", api: "anthropic-messages", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go", reasoning: true, input: ["text", "image"], cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0, tiers: [{ inputTokensAbove: 512e3, input: 0.6, output: 2.4, cacheRead: 0.12, cacheWrite: 0 }] }, contextWindow: 1e6, maxTokens: 131072, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:qwen3.7-plus": { id: "qwen3.7-plus", name: "Qwen3.7 Plus", api: "anthropic-messages", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go", reasoning: true, input: ["text", "image"], cost: { input: 0.4, output: 1.6, cacheRead: 0.04, cacheWrite: 0.5, tiers: [{ inputTokensAbove: 256e3, input: 1.2, output: 4.8, cacheRead: 0.12, cacheWrite: 1.5 }] }, contextWindow: 1e6, maxTokens: 65536, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:qwen3.8-flash": { id: "qwen3.8-flash", name: "Qwen3.8 Flash", api: "anthropic-messages", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go", reasoning: true, input: ["text", "image"], cost: { input: 0.15, output: 0.47, cacheRead: 0.016, cacheWrite: 0.2 }, contextWindow: 1e6, maxTokens: 131072, compat: { allowEmptySignature: true }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:qwen3.8-max": { id: "qwen3.8-max", name: "Qwen3.8 Max", api: "anthropic-messages", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go", reasoning: true, input: ["text", "image"], cost: { input: 2, output: 6, cacheRead: 0.25, cacheWrite: 2.5 }, contextWindow: 1e6, maxTokens: 131072, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" } }, "openai-completions": { "chat:deepseek-v4-flash": { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 0.15, output: 0.6, cacheRead: 3e-3, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens", requiresReasoningContentOnAssistantMessages: true, thinkingFormat: "deepseek" }, contextWindow: 1e6, maxTokens: 384e3, thinkingLevelMap: { minimal: null, low: "low", medium: null, high: "high", max: "max" }, type: "chat" }, "chat:deepseek-v4-flash-vision-exp": { id: "deepseek-v4-flash-vision-exp", name: "DeepSeek V4 Flash Vision Exp", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.15, output: 0.6, cacheRead: 3e-3, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens", requiresReasoningContentOnAssistantMessages: true, thinkingFormat: "deepseek" }, contextWindow: 1e6, maxTokens: 384e3, thinkingLevelMap: { minimal: null, low: "low", medium: null, high: "high", max: "max" }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:deepseek-v4-pro": { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro (New)", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens", requiresReasoningContentOnAssistantMessages: true, thinkingFormat: "deepseek" }, contextWindow: 1e6, maxTokens: 384e3, thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high", max: "max" }, type: "chat" }, "chat:deepseek-v4.1-flash": { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, thinkingLevelMap: { off: null, minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: "max" }, input: ["text", "image"], cost: { input: 0.15, output: 0.6, cacheRead: 3e-3, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens", requiresReasoningContentOnAssistantMessages: true, thinkingFormat: "deepseek" }, contextWindow: 1e6, maxTokens: 384e3, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:glm-5.2": { id: "glm-5.2", name: "GLM-5.2", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1e6, maxTokens: 131072, thinkingLevelMap: { off: null, minimal: null, low: null, medium: null, high: "high", xhigh: null, max: "max" }, type: "chat" }, "chat:glm-5.3": { id: "glm-5.3", name: "GLM-5.3", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1e6, maxTokens: 131072, thinkingLevelMap: { off: null, minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: "max" }, type: "chat" }, "chat:glm-5.3-flash": { id: "glm-5.3-flash", name: "GLM-5.3-Flash", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1e6, maxTokens: 131072, thinkingLevelMap: { off: null, minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: "max" }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:hy3": { id: "hy3", name: "Hy3", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 0.14, output: 0.58, cacheRead: 0.035, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 256e3, maxTokens: 128e3, thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: null }, type: "chat" }, "chat:hy4-preview": { id: "hy4-preview", name: "Hy4 preview", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 0.834, output: 2.501, cacheRead: 0.042, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1024e3, maxTokens: 64e3, thinkingLevelMap: { off: "none", minimal: null, low: null, medium: null, high: "high", xhigh: null, max: null }, type: "chat" }, "chat:kimi-k2.7-code": { id: "kimi-k2.7-code", name: "Kimi K2.7 Code", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 262144, maxTokens: 262144, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:kimi-k3": { id: "kimi-k3", name: "Kimi K3", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens", supportsMidConvoSystemMessages: true, supportsMidConvoToolAdditions: true }, contextWindow: 1048576, maxTokens: 131072, thinkingLevelMap: { off: null, minimal: null, low: null, medium: null, high: null, xhigh: null, max: "max" }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:longcat-2.0": { id: "longcat-2.0", name: "LongCat-2.0", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 0.3, output: 1.2, cacheRead: 6e-3, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1e6, maxTokens: 131072, type: "chat" }, "chat:longcat-2.5-preview-free": { id: "longcat-2.5-preview-free", name: "LongCat 2.5 Preview Free", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1e6, maxTokens: 131072, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:mimo-v2.5": { id: "mimo-v2.5", name: "MiMo V2.5", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.14, output: 0.28, cacheRead: 28e-4, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1e6, maxTokens: 128e3, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:mimo-v2.5-pro": { id: "mimo-v2.5-pro", name: "MiMo V2.5 Pro", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 0.435, output: 0.87, cacheRead: 3625e-6, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1048576, maxTokens: 128e3, type: "chat" }, "chat:mimo-v2.6-flash": { id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.14, output: 0.28, cacheRead: 28e-4, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1048576, maxTokens: 131072, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:mimo-v2.6-pro": { id: "mimo-v2.6-pro", name: "MiMo-V2.6-Pro", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.435, output: 0.87, cacheRead: 3625e-6, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1048576, maxTokens: 131072, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:minimax-m2.7": { id: "minimax-m2.7", name: "MiniMax-M2.7", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text"], cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 204800, maxTokens: 131072, type: "chat" }, "chat:space-bunny": { id: "space-bunny", name: "Space Bunny", api: "openai-completions", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.15, output: 0.6, cacheRead: 0.03, cacheWrite: 0 }, compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: true, maxTokensField: "max_tokens" }, contextWindow: 1048576, maxTokens: 524288, thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" } }, "openai-responses": { "chat:gpt-5.6-luna": { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", api: "openai-responses", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite: 0.25, tiers: [{ inputTokensAbove: 272e3, input: 0.4, output: 1.8, cacheRead: 0.04, cacheWrite: 0.5 }] }, compat: { sessionAffinityFormat: "openai-nosession", supportsMidConvoSystemMessages: true, supportsAdditionalTools: true }, contextWindow: 105e4, maxTokens: 128e3, thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:gpt-6-luna": { id: "gpt-6-luna", name: "GPT-6 Luna", api: "openai-responses", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125, tiers: [{ inputTokensAbove: 272e3, input: 0.2, output: 0.75, cacheRead: 0.02, cacheWrite: 0.25 }] }, compat: { sessionAffinityFormat: "openai-nosession", supportsMidConvoSystemMessages: true, supportsAdditionalTools: true }, contextWindow: 105e4, maxTokens: 128e3, thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:grok-4.6": { id: "grok-4.6", name: "Grok 4.6", api: "openai-responses", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0, tiers: [{ inputTokensAbove: 2e5, input: 4, output: 12, cacheRead: 1, cacheWrite: 0 }] }, compat: { sessionAffinityFormat: "openai-nosession" }, contextWindow: 5e5, maxTokens: 5e5, thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: null }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:grok-4.7": { id: "grok-4.7", name: "Grok 4.7", api: "openai-responses", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0, tiers: [{ inputTokensAbove: 2e5, input: 4, output: 12, cacheRead: 1, cacheWrite: 0 }] }, compat: { sessionAffinityFormat: "openai-nosession" }, contextWindow: 5e5, maxTokens: 5e5, thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: null }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:muse-spark-1.2-contributor": { id: "muse-spark-1.2-contributor", name: "Muse Spark 1.2 Contributor", api: "openai-responses", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.1, output: 0.2, cacheRead: 2e-3, cacheWrite: 0 }, compat: { sessionAffinityFormat: "openai-nosession" }, contextWindow: 1048576, maxTokens: 131072, thinkingLevelMap: { off: null, minimal: "minimal", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: null }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" }, "chat:muse-spark-1.3-contributor": { id: "muse-spark-1.3-contributor", name: "Muse Spark 1.3 Contributor", api: "openai-responses", provider: "opencode-go", baseUrl: "https://opencode.ai/zen/go/v1", reasoning: true, input: ["text", "image"], cost: { input: 0.1, output: 0.2, cacheRead: 2e-3, cacheWrite: 0 }, compat: { sessionAffinityFormat: "openai-nosession" }, contextWindow: 1048576, maxTokens: 131072, thinkingLevelMap: { off: null, minimal: "minimal", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: null }, inputLimits: { images: { resize: { maxWidth: 2e3, maxHeight: 2e3, maxBytes: 4718592, jpegQuality: 80 } } }, type: "chat" } } };

// node_modules/opencode-go-pi-ai/dist/model-catalog.js
function flattenModelCatalog(groups, type) {
  return Object.fromEntries(Object.values(groups).flatMap((models) => Object.values(models)).filter((model) => model.type === type).map((model) => [model.id, model]));
}
function flattenChatModelCatalog(_provider, groups) {
  return flattenModelCatalog(groups, "chat");
}
function flattenImageModelCatalog(_provider, groups) {
  return flattenModelCatalog(groups, "image");
}
function flattenClassifierModelCatalog(_provider, groups) {
  return flattenModelCatalog(groups, "classifier");
}

// node_modules/opencode-go-pi-ai/dist/providers/opencode-go.models.js
var OPENCODE_GO_MODELS = flattenChatModelCatalog("opencode-go", opencode_go_default);
var OPENCODE_GO_IMAGE_MODELS = flattenImageModelCatalog("opencode-go", opencode_go_default);
var OPENCODE_GO_CLASSIFIER_MODELS = flattenClassifierModelCatalog("opencode-go", opencode_go_default);

// node_modules/opencode-go-pi-ai/dist/api/anthropic-messages.js
var anthropic_messages_exports = {};
__export(anthropic_messages_exports, {
  stream: () => stream,
  streamSimple: () => streamSimple
});
import Anthropic, {} from "@anthropic-ai/sdk";

// node_modules/opencode-go-pi-ai/dist/utils/provider-env.js
var procEnvCache = null;
function getBunSandboxEnvValue(name2) {
  if (typeof process === "undefined" || !process.versions?.bun || Object.keys(process.env).length > 0) {
    return void 0;
  }
  if (procEnvCache === null) {
    procEnvCache = /* @__PURE__ */ new Map();
    try {
      const { readFileSync } = __require("node:fs");
      const data = readFileSync("/proc/self/environ", "utf-8");
      for (const entry of data.split("\0")) {
        const idx = entry.indexOf("=");
        if (idx > 0) {
          procEnvCache.set(entry.slice(0, idx), entry.slice(idx + 1));
        }
      }
    } catch {
    }
  }
  return procEnvCache.get(name2);
}
function getProviderEnvValue(name2, env) {
  return env?.[name2] || (typeof process !== "undefined" ? process.env[name2] : void 0) || getBunSandboxEnvValue(name2) || void 0;
}

// node_modules/opencode-go-pi-ai/dist/env-api-keys.js
var __rewriteRelativeImportExtension = function(path, preserveJsx) {
  if (typeof path === "string" && /^\.\.?\//.test(path)) {
    return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
      return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
    });
  }
  return path;
};
var _existsSync = null;
var _homedir = null;
var _join = null;
var dynamicImport = (specifier) => import(__rewriteRelativeImportExtension(specifier));
var NODE_FS_SPECIFIER = "node:fs";
var NODE_OS_SPECIFIER = "node:os";
var NODE_PATH_SPECIFIER = "node:path";
if (typeof process !== "undefined" && (process.versions?.node || process.versions?.bun)) {
  dynamicImport(NODE_FS_SPECIFIER).then((m) => {
    _existsSync = m.existsSync;
  });
  dynamicImport(NODE_OS_SPECIFIER).then((m) => {
    _homedir = m.homedir;
  });
  dynamicImport(NODE_PATH_SPECIFIER).then((m) => {
    _join = m.join;
  });
}
var ANTHROPIC_FEDERATION_RULE_ID_ENV = "ANTHROPIC_FEDERATION_RULE_ID";
var ANTHROPIC_ORGANIZATION_ID_ENV = "ANTHROPIC_ORGANIZATION_ID";
var ANTHROPIC_SERVICE_ACCOUNT_ID_ENV = "ANTHROPIC_SERVICE_ACCOUNT_ID";
var ANTHROPIC_IDENTITY_TOKEN_FILE_ENV = "ANTHROPIC_IDENTITY_TOKEN_FILE";
var ANTHROPIC_WORKSPACE_ID_ENV = "ANTHROPIC_WORKSPACE_ID";

// node_modules/opencode-go-pi-ai/dist/utils/headers.js
function headersToRecord(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}

// node_modules/opencode-go-pi-ai/dist/utils/pi-user-agent.js
function loadNodeOs() {
  if (typeof process === "undefined" || !(process.versions?.node || process.versions?.bun)) {
    return null;
  }
  return process.getBuiltinModule?.("node:os") ?? null;
}
var nodeOs = loadNodeOs();
function getPiUserAgent() {
  return nodeOs ? `pi (${nodeOs.platform()} ${nodeOs.release()}; ${nodeOs.arch()})` : "pi (browser)";
}

// node_modules/opencode-go-pi-ai/dist/utils/provider-retry.js
var DEFAULT_MAX_RETRY_DELAY_MS = 6e4;
function isProviderError(error) {
  if (!(error instanceof Error) || !("status" in error) || !("headers" in error))
    return false;
  return (error.status === void 0 || typeof error.status === "number") && (error.headers === void 0 || error.headers instanceof Headers);
}
function isRetryableProviderError(error) {
  const shouldRetry = error.headers?.get("x-should-retry");
  if (shouldRetry === "true")
    return true;
  if (shouldRetry === "false")
    return false;
  if (error.status === void 0)
    return true;
  return error.status === 408 || error.status === 409 || error.status === 429 || typeof error.status === "number" && error.status >= 500;
}
function validateServerRetryDelayMs(delayMs, maxRetryDelayMs, providerErrorMessage) {
  const maxDelayMs = maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  if (maxDelayMs > 0 && delayMs > maxDelayMs) {
    throw new Error(`Server requested ${Math.ceil(delayMs / 1e3)}s retry delay (max: ${Math.ceil(maxDelayMs / 1e3)}s). ${providerErrorMessage}`);
  }
  return delayMs;
}
function getRetryDelayMs(error, retryIndex, maxRetryDelayMs) {
  const retryAfterMs = error.headers?.get("retry-after-ms");
  if (retryAfterMs) {
    const value = Number.parseFloat(retryAfterMs);
    if (Number.isFinite(value))
      return validateServerRetryDelayMs(value, maxRetryDelayMs, error.message);
  }
  const retryAfter = error.headers?.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    const delayMs = Number.isNaN(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1e3;
    if (Number.isFinite(delayMs))
      return validateServerRetryDelayMs(delayMs, maxRetryDelayMs, error.message);
  }
  const exponentialDelay = Math.min(0.5 * 2 ** retryIndex, 8) * 1e3;
  return exponentialDelay * (1 - Math.random() * 0.25);
}
function createAbortError() {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return error;
}
function abortableSleep(ms, signal) {
  return new Promise((resolve3, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(createAbortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve3();
    }, Math.max(0, ms));
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
async function retryProviderRequest(request, options = {}) {
  const maxRetries = options.maxRetries ?? 0;
  let retriesRemaining = maxRetries;
  for (; ; ) {
    try {
      return await request();
    } catch (error) {
      if (options.signal?.aborted)
        throw createAbortError();
      if (retriesRemaining <= 0 || !isProviderError(error) || !isRetryableProviderError(error))
        throw error;
      if (error.status !== void 0 && options.noRetryStatuses?.includes(error.status))
        throw error;
      const retryIndex = maxRetries - retriesRemaining;
      retriesRemaining--;
      await abortableSleep(getRetryDelayMs(error, retryIndex, options.maxRetryDelayMs), options.signal);
    }
  }
}

// node_modules/opencode-go-pi-ai/dist/utils/sanitize-unicode.js
function sanitizeSurrogates(text) {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

// node_modules/opencode-go-pi-ai/dist/api/constrained-sampling.js
var UnsupportedStrictJsonSchemaError = class extends Error {
};
var UNSUPPORTED_STRICT_SCHEMA_KEYS = [
  "$ref",
  "$defs",
  "definitions",
  "allOf",
  "oneOf",
  "patternProperties",
  "dependentSchemas",
  "dependencies",
  "unevaluatedProperties",
  "propertyNames",
  "contains",
  "prefixItems",
  "not",
  "if",
  "then",
  "else"
];
function isJsonSchemaObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStructuredSchema(schema) {
  if (!isJsonSchemaObject(schema))
    return false;
  const types = typeof schema.type === "string" ? [schema.type] : Array.isArray(schema.type) ? schema.type : [];
  return types.includes("object") || types.includes("array") || schema.properties !== void 0 || schema.items !== void 0;
}
function schemaAllowsNull(schema) {
  if (!isJsonSchemaObject(schema))
    return false;
  if (schema.type === "null" || Array.isArray(schema.type) && schema.type.includes("null"))
    return true;
  if (schema.const === null || Array.isArray(schema.enum) && schema.enum.includes(null))
    return true;
  return Array.isArray(schema.anyOf) && schema.anyOf.some((variant) => schemaAllowsNull(variant));
}
function makeJsonSchemaNodeStrict(schema, isUnsupportedKeyword) {
  if (!isJsonSchemaObject(schema)) {
    throw new UnsupportedStrictJsonSchemaError("boolean schemas are unsupported");
  }
  for (const key of UNSUPPORTED_STRICT_SCHEMA_KEYS) {
    if (schema[key] !== void 0) {
      throw new UnsupportedStrictJsonSchemaError(`${key} schemas are unsupported`);
    }
  }
  if (isUnsupportedKeyword) {
    for (const [key, value] of Object.entries(schema)) {
      if (isUnsupportedKeyword(key, value)) {
        throw new UnsupportedStrictJsonSchemaError(`${key}: ${JSON.stringify(value)} is unsupported`);
      }
    }
  }
  if (schema.anyOf !== void 0) {
    if (!Array.isArray(schema.anyOf) || schema.anyOf.length === 0) {
      throw new UnsupportedStrictJsonSchemaError("anyOf must contain at least one schema");
    }
    for (const variant of schema.anyOf) {
      if (isStructuredSchema(variant)) {
        throw new UnsupportedStrictJsonSchemaError("object and array unions are unsupported");
      }
      makeJsonSchemaNodeStrict(variant, isUnsupportedKeyword);
    }
  }
  if (schema.items !== void 0) {
    if (Array.isArray(schema.items)) {
      throw new UnsupportedStrictJsonSchemaError("tuple schemas are unsupported");
    }
    makeJsonSchemaNodeStrict(schema.items, isUnsupportedKeyword);
  }
  const isObjectSchema = schema.type === "object";
  if (schema.properties !== void 0 && !isObjectSchema) {
    throw new UnsupportedStrictJsonSchemaError("properties require type object");
  }
  if (!isObjectSchema)
    return;
  if (schema.additionalProperties !== void 0 && schema.additionalProperties !== false) {
    throw new UnsupportedStrictJsonSchemaError("schema-valued or true additionalProperties is unsupported");
  }
  if (schema.properties !== void 0 && !isJsonSchemaObject(schema.properties)) {
    throw new UnsupportedStrictJsonSchemaError("object properties must be a schema map");
  }
  if (schema.required !== void 0 && (!Array.isArray(schema.required) || schema.required.some((key) => typeof key !== "string"))) {
    throw new UnsupportedStrictJsonSchemaError("object required must be a string array");
  }
  const properties = schema.properties ?? {};
  const propertyNames = Object.keys(properties);
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  if ([...required].some((key) => !propertyNames.includes(key))) {
    throw new UnsupportedStrictJsonSchemaError("required contains an unknown property");
  }
  for (const [key, property] of Object.entries(properties)) {
    makeJsonSchemaNodeStrict(property, isUnsupportedKeyword);
    if (!required.has(key) && !schemaAllowsNull(property)) {
      properties[key] = { anyOf: [property, { type: "null" }] };
    }
  }
  schema.required = propertyNames;
  schema.additionalProperties = false;
}
function makeStrictJsonSchema(schema, isUnsupportedKeyword) {
  const cloned = structuredClone(schema);
  if (!isJsonSchemaObject(cloned)) {
    throw new UnsupportedStrictJsonSchemaError("root schema must have type object");
  }
  makeJsonSchemaNodeStrict(cloned, isUnsupportedKeyword);
  if (cloned.type !== "object") {
    throw new UnsupportedStrictJsonSchemaError("root schema must have type object");
  }
  return cloned;
}
function getJsonSchemaToolParameters(tool, strict) {
  return strict === true ? makeStrictJsonSchema(tool.parameters) : tool.parameters;
}
function getGrammarToolInput(toolName, arguments_, inputProperty) {
  const input = arguments_[inputProperty];
  if (typeof input !== "string") {
    throw new Error(`Grammar tool call "${toolName}" requires argument "${inputProperty}" to be a string.`);
  }
  return input;
}
function appendGrammarToolInputJsonDelta(buffer, inputProperty, nextInput, close) {
  if (buffer.closed) {
    if (close && nextInput === buffer.input)
      return void 0;
    throw new Error(`grammar tool input for property "${inputProperty}" changed after it was closed`);
  }
  if (!nextInput.startsWith(buffer.input)) {
    throw new Error(`grammar tool input for property "${inputProperty}" changed non-monotonically`);
  }
  const inputDelta = nextInput.slice(buffer.input.length);
  if (!close && inputDelta.length === 0)
    return void 0;
  let delta = "";
  if (!buffer.started) {
    delta += `{${JSON.stringify(inputProperty)}:"`;
    buffer.started = true;
  }
  delta += JSON.stringify(inputDelta).slice(1, -1);
  buffer.input = nextInput;
  if (close) {
    delta += '"}';
    buffer.closed = true;
  }
  return delta;
}
function inferGrammarInputProperty(tool) {
  const schema = tool.parameters;
  if (schema.type !== "object") {
    throw new Error("grammar constrained sampling requires an object parameter schema");
  }
  if (!Array.isArray(schema.required) || schema.required.length !== 1 || typeof schema.required[0] !== "string") {
    throw new Error("grammar constrained sampling requires exactly one required string property");
  }
  const inputProperty = schema.required[0];
  if (!schema.properties?.[inputProperty]) {
    throw new Error(`grammar constrained sampling requires a properties entry for ${inputProperty}`);
  }
  if (schema.properties[inputProperty]?.type !== "string") {
    throw new Error(`grammar constrained sampling property ${inputProperty} must have type string`);
  }
  return inputProperty;
}
function resolveJsonSchemaStrictSampling(tool, supportsStrictMode, isUnsupportedKeyword) {
  const config = tool.constrainedSampling;
  if (!config || config.type !== "json_schema")
    return void 0;
  if (supportsStrictMode) {
    try {
      makeStrictJsonSchema(tool.parameters, isUnsupportedKeyword);
      return true;
    } catch (error) {
      if (!(error instanceof UnsupportedStrictJsonSchemaError))
        throw error;
      if (config.strict !== "require")
        return void 0;
      throw new Error(`Tool "${tool.name}" requires JSON-schema constrained sampling, but ${error.message}.`);
    }
  }
  if (config.strict === "require") {
    throw new Error(`Tool "${tool.name}" requires JSON-schema constrained sampling, but strict tools are unsupported.`);
  }
  return void 0;
}
function resolveGrammarConstrainedSampling(tool, supportsOpenAIGrammarTools) {
  const config = tool.constrainedSampling;
  if (!config || config.type !== "grammar") {
    return void 0;
  }
  if (!supportsOpenAIGrammarTools) {
    return void 0;
  }
  const larkDefinition = config.variants.openai_lark;
  const regexDefinition = config.variants.openai_regex;
  const hasLarkDefinition = typeof larkDefinition === "string" && larkDefinition.trim().length > 0;
  const hasRegexDefinition = typeof regexDefinition === "string" && regexDefinition.trim().length > 0;
  if (!hasLarkDefinition && !hasRegexDefinition) {
    throw new Error(`Tool "${tool.name}" cannot use grammar constrained sampling: no supported grammar variant was provided.`);
  }
  try {
    return {
      format: hasLarkDefinition ? "lark" : "regex",
      definition: hasLarkDefinition ? larkDefinition : regexDefinition,
      inputProperty: inferGrammarInputProperty(tool)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Tool "${tool.name}" cannot use grammar constrained sampling: ${message}.`);
  }
}
function createGrammarToolInputProperties(tools, supportsOpenAIGrammarTools) {
  const properties = /* @__PURE__ */ new Map();
  for (const tool of tools ?? []) {
    const grammar = resolveGrammarConstrainedSampling(tool, supportsOpenAIGrammarTools);
    if (grammar) {
      properties.set(tool.name, grammar.inputProperty);
    }
  }
  return properties;
}

// node_modules/opencode-go-pi-ai/dist/api/github-copilot-headers.js
function inferCopilotInitiator(messages) {
  const last = messages[messages.length - 1];
  return last && last.role !== "user" ? "agent" : "user";
}
function hasCopilotVisionInput(messages) {
  return messages.some((msg) => {
    if (msg.role === "user" && Array.isArray(msg.content)) {
      return msg.content.some((c) => c.type === "image");
    }
    if (msg.role === "toolResult" && Array.isArray(msg.content)) {
      return msg.content.some((c) => c.type === "image");
    }
    return false;
  });
}
function buildCopilotDynamicHeaders(params) {
  const headers = {
    "X-Initiator": inferCopilotInitiator(params.messages),
    "Openai-Intent": "conversation-edits"
  };
  if (params.hasImages) {
    headers["Copilot-Vision-Request"] = "true";
  }
  return headers;
}

// node_modules/opencode-go-pi-ai/dist/utils/estimate.js
var CHARS_PER_TOKEN = 3.5;
var ESTIMATED_IMAGE_CHARS = 4800;
function calculateContextTokens(usage) {
  return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}
function safeJsonStringify(value) {
  try {
    return JSON.stringify(value) ?? "undefined";
  } catch {
    return "[unserializable]";
  }
}
function estimateTextAndImageContentChars(content) {
  if (typeof content === "string")
    return content.length;
  let chars = 0;
  for (const block of content)
    chars += block.type === "text" ? block.text.length : ESTIMATED_IMAGE_CHARS;
  return chars;
}
function estimateTextTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
function estimateTextAndImageContentTokens(content) {
  return Math.ceil(estimateTextAndImageContentChars(content) / CHARS_PER_TOKEN);
}
function estimateMessageTokens(message) {
  let chars = 0;
  if (message.role === "system") {
    return estimateTextTokens(getSystemMessageText(message)) + estimateToolsTokens(message.toolsAdded) + estimateToolsTokens(message.toolsRemoved);
  }
  if (message.role === "user")
    return estimateTextAndImageContentTokens(message.content);
  if (message.role === "toolResult")
    return estimateTextAndImageContentTokens(message.content);
  for (const block of message.content) {
    if (block.type === "text") {
      chars += block.text.length;
    } else if (block.type === "thinking") {
      chars += block.thinking.length;
    } else {
      chars += block.name.length + safeJsonStringify(block.arguments).length;
    }
  }
  return Math.ceil(chars / CHARS_PER_TOKEN);
}
function getLastAssistantUsageInfo(messages) {
  let latestPrefixTimestamp = Number.NEGATIVE_INFINITY;
  let usageInfo;
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === "assistant") {
      const assistant = message;
      const usageAppliesToPrefix = assistant.timestamp >= latestPrefixTimestamp;
      if (usageAppliesToPrefix && assistant.stopReason !== "aborted" && assistant.stopReason !== "error" && calculateContextTokens(assistant.usage) > 0) {
        usageInfo = { usage: assistant.usage, index: i };
      }
    }
    latestPrefixTimestamp = Math.max(latestPrefixTimestamp, message.timestamp);
  }
  return usageInfo;
}
function estimateContextTokens(context) {
  const messages = "messages" in context ? context.messages : context;
  const usageInfo = getLastAssistantUsageInfo(messages);
  if (usageInfo) {
    const usageTokens = calculateContextTokens(usageInfo.usage);
    let trailingTokens = 0;
    for (let i = usageInfo.index + 1; i < messages.length; i++) {
      trailingTokens += estimateMessageTokens(messages[i]);
    }
    return { tokens: usageTokens + trailingTokens, usageTokens, trailingTokens, lastUsageIndex: usageInfo.index };
  }
  let tokens = 0;
  for (const message of messages)
    tokens += estimateMessageTokens(message);
  return { tokens, usageTokens: 0, trailingTokens: tokens, lastUsageIndex: null };
}
function estimateToolsTokens(tools) {
  if (!tools || tools.length === 0)
    return 0;
  return estimateTextTokens(safeJsonStringify(tools));
}

// node_modules/opencode-go-pi-ai/dist/api/simple-options.js
var CONTEXT_SAFETY_TOKENS = 4096;
var MIN_MAX_TOKENS = 1;
function clampMaxTokensToContext(model, context, maxTokens) {
  if (model.contextWindow <= 0)
    return Math.max(MIN_MAX_TOKENS, maxTokens);
  const available = model.contextWindow - estimateContextTokens(context).tokens - CONTEXT_SAFETY_TOKENS;
  return Math.min(maxTokens, Math.max(MIN_MAX_TOKENS, available));
}
function resolveSamplingParams(model, thinkingLevel, requestParams) {
  const effectiveThinkingLevel = clampThinkingLevel(model, thinkingLevel);
  const thinkingLevelParams = model.samplingParamsByThinkingLevel?.[effectiveThinkingLevel];
  return model.samplingParams || thinkingLevelParams || requestParams ? { ...model.samplingParams, ...thinkingLevelParams, ...requestParams } : void 0;
}
function buildBaseOptions(model, context, options, apiKey) {
  const samplingParams = resolveSamplingParams(model, options?.reasoning ?? "off", options?.samplingParams);
  return {
    temperature: options?.temperature,
    samplingParams,
    maxTokens: clampMaxTokensToContext(model, context, options?.maxTokens ?? model.maxTokens),
    signal: options?.signal,
    telemetryContext: options?.telemetryContext,
    apiKey: apiKey || options?.apiKey,
    fetch: options?.fetch,
    transport: options?.transport,
    cacheRetention: options?.cacheRetention,
    sessionId: options?.sessionId,
    headers: options?.headers,
    onPayload: options?.onPayload,
    onResponse: options?.onResponse,
    onProviderStreamEvent: options?.onProviderStreamEvent,
    timeoutMs: options?.timeoutMs,
    websocketConnectTimeoutMs: options?.websocketConnectTimeoutMs,
    maxRetries: options?.maxRetries,
    maxRetryDelayMs: options?.maxRetryDelayMs,
    metadata: options?.metadata,
    env: options?.env
  };
}
var MIN_ANSWER_TOKENS = 1024;
var DEFAULT_THINKING_BUDGETS = {
  minimal: 1024,
  low: 2048,
  medium: 8192,
  high: 16384
};
function clampReasoning(effort) {
  return effort === "xhigh" || effort === "max" ? "high" : effort;
}
function thinkingBudgetForLevel(reasoningLevel, customBudgets) {
  const budgets = { ...DEFAULT_THINKING_BUDGETS, ...customBudgets };
  const level = clampReasoning(reasoningLevel);
  return budgets[level];
}
function clampThinkingBudgetToAnswerRoom(thinkingBudget, ceiling) {
  return Math.min(thinkingBudget, Math.max(0, ceiling - MIN_ANSWER_TOKENS));
}
function adjustMaxTokensForThinking(baseMaxTokens, modelMaxTokens, reasoningLevel, customBudgets) {
  let thinkingBudget = thinkingBudgetForLevel(reasoningLevel, customBudgets);
  const maxTokens = baseMaxTokens === void 0 ? modelMaxTokens : Math.min(baseMaxTokens + thinkingBudget, modelMaxTokens);
  if (maxTokens <= thinkingBudget) {
    thinkingBudget = clampThinkingBudgetToAnswerRoom(thinkingBudget, maxTokens);
  }
  return { maxTokens, thinkingBudget };
}

// node_modules/opencode-go-pi-ai/dist/api/transform-messages.js
var NON_VISION_USER_IMAGE_PLACEHOLDER = "(image omitted: model does not support images)";
var NON_VISION_TOOL_IMAGE_PLACEHOLDER = "(tool image omitted: model does not support images)";
function replaceImagesWithPlaceholder(content, placeholder) {
  const result = [];
  let previousWasPlaceholder = false;
  for (const block of content) {
    if (block.type === "image") {
      if (!previousWasPlaceholder) {
        result.push({ type: "text", text: placeholder });
      }
      previousWasPlaceholder = true;
      continue;
    }
    result.push(block);
    previousWasPlaceholder = block.text === placeholder;
  }
  return result;
}
function downgradeUnsupportedImages(messages, model) {
  if (model.input.includes("image")) {
    return messages;
  }
  return messages.map((msg) => {
    if (msg.role === "user" && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: replaceImagesWithPlaceholder(msg.content, NON_VISION_USER_IMAGE_PLACEHOLDER)
      };
    }
    if (msg.role === "toolResult") {
      return {
        ...msg,
        content: replaceImagesWithPlaceholder(msg.content, NON_VISION_TOOL_IMAGE_PLACEHOLDER)
      };
    }
    return msg;
  });
}
function transformMessages(messages, model, normalizeToolCallId2) {
  const toolCallIdMap = /* @__PURE__ */ new Map();
  const normalizedMessages = messages.map((msg) => msg.content == null ? { ...msg, content: [] } : msg);
  const imageAwareMessages = downgradeUnsupportedImages(normalizedMessages, model);
  const transformed = imageAwareMessages.map((msg) => {
    if (msg.role === "system" || msg.role === "user") {
      return msg;
    }
    if (msg.role === "toolResult") {
      const normalizedId = toolCallIdMap.get(msg.toolCallId);
      if (normalizedId && normalizedId !== msg.toolCallId) {
        return { ...msg, toolCallId: normalizedId };
      }
      return msg;
    }
    if (msg.role === "assistant") {
      const assistantMsg = msg;
      const isSameModel = assistantMsg.provider === model.provider && assistantMsg.api === model.api && assistantMsg.model === model.id;
      const transformedContent = assistantMsg.content.flatMap((block) => {
        if (block.type === "thinking") {
          if (block.redacted) {
            return isSameModel ? block : [];
          }
          if (isSameModel && block.thinkingSignature)
            return block;
          if (!block.thinking || block.thinking.trim() === "")
            return [];
          if (isSameModel)
            return block;
          return {
            type: "text",
            text: block.thinking
          };
        }
        if (block.type === "text") {
          if (isSameModel)
            return block;
          return {
            type: "text",
            text: block.text
          };
        }
        if (block.type === "toolCall") {
          const toolCall = block;
          let normalizedToolCall = toolCall;
          if (!isSameModel && toolCall.thoughtSignature) {
            normalizedToolCall = { ...toolCall };
            delete normalizedToolCall.thoughtSignature;
          }
          if (!isSameModel && normalizeToolCallId2) {
            const normalizedId = normalizeToolCallId2(toolCall.id, model, assistantMsg);
            if (normalizedId !== toolCall.id) {
              toolCallIdMap.set(toolCall.id, normalizedId);
              normalizedToolCall = { ...normalizedToolCall, id: normalizedId };
            }
          }
          return normalizedToolCall;
        }
        return block;
      });
      return {
        ...assistantMsg,
        content: transformedContent
      };
    }
    return msg;
  });
  const result = [];
  let pendingToolCalls = [];
  let existingToolResultIds = /* @__PURE__ */ new Set();
  const heldSystemMessages = [];
  const closePendingToolCalls = () => {
    if (pendingToolCalls.length > 0) {
      for (const tc of pendingToolCalls) {
        if (!existingToolResultIds.has(tc.id)) {
          result.push({
            role: "toolResult",
            toolCallId: tc.id,
            toolName: tc.name,
            content: [{ type: "text", text: "No result provided" }],
            isError: true,
            timestamp: Date.now()
          });
        }
      }
      pendingToolCalls = [];
      existingToolResultIds = /* @__PURE__ */ new Set();
    }
    result.push(...heldSystemMessages);
    heldSystemMessages.length = 0;
  };
  for (let i = 0; i < transformed.length; i++) {
    const msg = transformed[i];
    if (msg.role === "assistant") {
      closePendingToolCalls();
      const assistantMsg = msg;
      if (assistantMsg.stopReason === "error" || assistantMsg.stopReason === "aborted") {
        continue;
      }
      const toolCalls = assistantMsg.content.filter((b) => b.type === "toolCall");
      if (toolCalls.length > 0) {
        pendingToolCalls = toolCalls;
        existingToolResultIds = /* @__PURE__ */ new Set();
      }
      result.push(msg);
    } else if (msg.role === "toolResult") {
      existingToolResultIds.add(msg.toolCallId);
      result.push(msg);
    } else if (msg.role === "system") {
      if (pendingToolCalls.length > 0) {
        heldSystemMessages.push(msg);
      } else {
        result.push(msg);
      }
    } else if (msg.role === "user") {
      closePendingToolCalls();
      result.push(msg);
    } else {
      result.push(msg);
    }
  }
  closePendingToolCalls();
  return result;
}

// node_modules/opencode-go-pi-ai/dist/api/anthropic-messages.js
function resolveCacheRetention(cacheRetention, env) {
  if (cacheRetention) {
    return cacheRetention;
  }
  if (getProviderEnvValue("PI_CACHE_RETENTION", env) === "long") {
    return "long";
  }
  return "short";
}
function getCacheControl(model, cacheRetention, env) {
  const retention = resolveCacheRetention(cacheRetention, env);
  if (retention === "none") {
    return { retention };
  }
  const ttl = retention === "long" && getAnthropicCompat(model).supportsLongCacheRetention ? "1h" : void 0;
  return {
    retention,
    cacheControl: { type: "ephemeral", ...ttl && { ttl } }
  };
}
var claudeCodeVersion = "2.1.280";
var claudeCodeTools = [
  "Read",
  "Write",
  "Edit",
  "Bash",
  "Grep",
  "Glob",
  "AskUserQuestion",
  "EnterPlanMode",
  "ExitPlanMode",
  "KillShell",
  "NotebookEdit",
  "Skill",
  "Task",
  "TaskOutput",
  "TodoWrite",
  "WebFetch",
  "WebSearch"
];
var ccToolLookup = new Map(claudeCodeTools.map((t) => [t.toLowerCase(), t]));
var toClaudeCodeName = (name2) => ccToolLookup.get(name2.toLowerCase()) ?? name2;
var fromClaudeCodeName = (name2, tools) => {
  if (tools && tools.length > 0) {
    const lowerName = name2.toLowerCase();
    const matchedTool = tools.find((tool) => tool.name.toLowerCase() === lowerName);
    if (matchedTool)
      return matchedTool.name;
  }
  return name2;
};
function convertContentBlocks(content) {
  const hasImages = content.some((c) => c.type === "image");
  if (!hasImages) {
    return sanitizeSurrogates(content.map((c) => c.text).join("\n"));
  }
  const blocks = content.map((block) => {
    if (block.type === "text") {
      return {
        type: "text",
        text: sanitizeSurrogates(block.text)
      };
    }
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: block.mimeType,
        data: block.data
      }
    };
  });
  const hasText = blocks.some((b) => b.type === "text");
  if (!hasText) {
    blocks.unshift({
      type: "text",
      text: "(see attached image)"
    });
  }
  return blocks;
}
var FINE_GRAINED_TOOL_STREAMING_BETA = "fine-grained-tool-streaming-2025-05-14";
var INTERLEAVED_THINKING_BETA = "interleaved-thinking-2025-05-14";
var SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";
var MID_CONVERSATION_OUTPUT_CONFIG_BETA = "mid-conversation-output-config-2026-07-01";
var THINKING_BINDING_CONTROLS_BETA = "thinking-binding-controls-2026-08-01";
var INLINE_TOOLS_BETA = "inline-tools-2026-09-15";
var DEFERRED_TOOL_PLACEHOLDER = {
  name: "__pi_deferred_placeholder__",
  description: "Reserved placeholder. Never available. Never call this.",
  input_schema: { type: "object", properties: {}, required: [] },
  defer_loading: true
};
function shouldUseServerSideFallbackBeta(model) {
  return (model.compat?.allowedFallbackModels?.length ?? 0) > 0;
}
function getAnthropicCompat(model) {
  const isOpenRouter = model.provider === "openrouter" || model.baseUrl.includes("openrouter.ai");
  return {
    supportsEagerToolInputStreaming: model.compat?.supportsEagerToolInputStreaming ?? true,
    supportsLongCacheRetention: model.compat?.supportsLongCacheRetention ?? true,
    sendSessionAffinityHeaders: model.compat?.sendSessionAffinityHeaders ?? isOpenRouter,
    sessionAffinityFormat: model.compat?.sessionAffinityFormat ?? (isOpenRouter ? "openrouter" : void 0),
    supportsCacheControlOnTools: model.compat?.supportsCacheControlOnTools ?? true,
    supportsTemperature: model.compat?.supportsTemperature ?? true,
    allowEmptySignature: model.compat?.allowEmptySignature ?? false,
    supportsStrictTools: model.compat?.supportsStrictTools ?? false,
    supportsMidConvoSystemMessages: model.compat?.supportsMidConvoSystemMessages ?? false,
    supportsMidConvoToolChanges: model.compat?.supportsMidConvoToolChanges ?? false
  };
}
function mergeHeaders(...headerSources) {
  const merged = {};
  for (const headers of headerSources) {
    if (headers) {
      Object.assign(merged, headers);
    }
  }
  return merged;
}
function mergeClientHeaders(...headerSources) {
  return mergeHeaders({ "User-Agent": getPiUserAgent() }, ...headerSources);
}
function hasHeader(headers, name2) {
  if (!headers)
    return false;
  const expected = name2.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === expected && value !== null && value.trim().length > 0)
      return true;
  }
  return false;
}
function hasRequestAuth(apiKey, headers) {
  return !!apiKey || hasHeader(headers, "authorization") || hasHeader(headers, "x-api-key") || hasHeader(headers, "cf-aig-authorization");
}
function assertRequestAuth(provider, apiKey, headers) {
  if (!hasRequestAuth(apiKey, headers))
    throw new Error(`No API key for provider: ${provider}`);
}
var PiAnthropic = class extends Anthropic {
  _shouldResolveDefaultCredentials() {
    return false;
  }
};
function getAnthropicFederation(model, apiKey, headers, env) {
  if (model.provider !== "anthropic" || hasRequestAuth(apiKey, headers))
    return void 0;
  const federationRuleId = getProviderEnvValue(ANTHROPIC_FEDERATION_RULE_ID_ENV, env);
  const organizationId = getProviderEnvValue(ANTHROPIC_ORGANIZATION_ID_ENV, env);
  const identityTokenFile = getProviderEnvValue(ANTHROPIC_IDENTITY_TOKEN_FILE_ENV, env);
  if (!federationRuleId || !organizationId || !identityTokenFile)
    return void 0;
  return {
    organization_id: organizationId,
    workspace_id: getProviderEnvValue(ANTHROPIC_WORKSPACE_ID_ENV, env),
    authentication: {
      type: "oidc_federation",
      federation_rule_id: federationRuleId,
      service_account_id: getProviderEnvValue(ANTHROPIC_SERVICE_ACCOUNT_ID_ENV, env),
      identity_token: { source: "file", path: identityTokenFile }
    }
  };
}
var federationClient;
var ANTHROPIC_MESSAGE_EVENTS = /* @__PURE__ */ new Set([
  "message_start",
  "message_delta",
  "message_stop",
  "content_block_start",
  "content_block_delta",
  "content_block_stop"
]);
function flushSseEvent(state) {
  if (!state.event && state.data.length === 0) {
    return null;
  }
  const event = {
    event: state.event,
    data: state.data.join("\n"),
    raw: [...state.raw]
  };
  state.event = null;
  state.data = [];
  state.raw = [];
  return event;
}
function decodeSseLine(line, state) {
  if (line === "") {
    return flushSseEvent(state);
  }
  state.raw.push(line);
  if (line.startsWith(":")) {
    return null;
  }
  const delimiterIndex = line.indexOf(":");
  const fieldName = delimiterIndex === -1 ? line : line.slice(0, delimiterIndex);
  let value = delimiterIndex === -1 ? "" : line.slice(delimiterIndex + 1);
  if (value.startsWith(" ")) {
    value = value.slice(1);
  }
  if (fieldName === "event") {
    state.event = value;
  } else if (fieldName === "data") {
    state.data.push(value);
  }
  return null;
}
function nextLineBreakIndex(text) {
  const carriageReturnIndex = text.indexOf("\r");
  const newlineIndex = text.indexOf("\n");
  if (carriageReturnIndex === -1) {
    return newlineIndex;
  }
  if (newlineIndex === -1) {
    return carriageReturnIndex;
  }
  return Math.min(carriageReturnIndex, newlineIndex);
}
function consumeLine(text) {
  const lineBreakIndex = nextLineBreakIndex(text);
  if (lineBreakIndex === -1) {
    return null;
  }
  let nextIndex = lineBreakIndex + 1;
  if (text[lineBreakIndex] === "\r" && text[nextIndex] === "\n") {
    nextIndex += 1;
  }
  return {
    line: text.slice(0, lineBreakIndex),
    rest: text.slice(nextIndex)
  };
}
async function* iterateSseMessages(body, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const state = { event: null, data: [], raw: [] };
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) {
        throw new Error("Request was aborted");
      }
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let consumed2 = consumeLine(buffer);
      while (consumed2) {
        buffer = consumed2.rest;
        const event = decodeSseLine(consumed2.line, state);
        if (event) {
          yield event;
        }
        consumed2 = consumeLine(buffer);
      }
    }
    buffer += decoder.decode();
    let consumed = consumeLine(buffer);
    while (consumed) {
      buffer = consumed.rest;
      const event = decodeSseLine(consumed.line, state);
      if (event) {
        yield event;
      }
      consumed = consumeLine(buffer);
    }
    if (buffer.length > 0) {
      const event = decodeSseLine(buffer, state);
      if (event) {
        yield event;
      }
    }
    const trailingEvent = flushSseEvent(state);
    if (trailingEvent) {
      yield trailingEvent;
    }
  } finally {
    reader.releaseLock();
  }
}
async function* iterateAnthropicEvents(response, signal) {
  if (!response.body) {
    throw new Error("Attempted to iterate over an Anthropic response with no body");
  }
  let sawMessageStart = false;
  let sawMessageEnd = false;
  for await (const sse of iterateSseMessages(response.body, signal)) {
    if (sse.event === "error") {
      throw new Error(sse.data);
    }
    if (!ANTHROPIC_MESSAGE_EVENTS.has(sse.event ?? "")) {
      continue;
    }
    try {
      const event = parseJsonWithRepair(sse.data);
      if (event.type === "message_start") {
        sawMessageStart = true;
      } else if (event.type === "message_stop") {
        sawMessageEnd = true;
      }
      yield event;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not parse Anthropic SSE event ${sse.event}: ${message}; data=${sse.data}; raw=${sse.raw.join("\\n")}`);
    }
  }
  if (sawMessageStart && !sawMessageEnd) {
    throw new Error("Anthropic stream ended before message_stop");
  }
}
var stream = (model, context, options) => {
  const stream4 = new AssistantMessageEventStream();
  const normalizedContext = resolveTranscript(context, getAnthropicCompat(model).supportsMidConvoSystemMessages);
  const currentTools = getCurrentTools(normalizedContext.messages);
  (async () => {
    const providerThinkingLevel = model.compat?.supportsMidConvoEffort ? options?.effort ?? "high" : void 0;
    const output = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      ...providerThinkingLevel === void 0 ? {} : { providerThinkingLevel },
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      },
      stopReason: "pending",
      timestamp: Date.now()
    };
    try {
      let client;
      let isOAuth;
      let usageModel = model;
      let inputTransformations;
      if (options?.client) {
        client = options.client;
        isOAuth = false;
      } else {
        const apiKey = options?.apiKey;
        const federation = getAnthropicFederation(model, apiKey, options?.headers, options?.env);
        if (!federation)
          assertRequestAuth(model.provider, apiKey, options?.headers);
        let copilotDynamicHeaders;
        if (model.provider === "github-copilot") {
          const hasImages = hasCopilotVisionInput(normalizedContext.messages);
          copilotDynamicHeaders = buildCopilotDynamicHeaders({
            messages: normalizedContext.messages,
            hasImages
          });
        }
        const cacheRetention = resolveCacheRetention(options?.cacheRetention, options?.env);
        const cacheSessionId = cacheRetention === "none" ? void 0 : options?.sessionId;
        const created = createClient(model, apiKey, options?.headers, options?.fetch, copilotDynamicHeaders, cacheSessionId, federation);
        client = created.client;
        isOAuth = created.isOAuthToken;
      }
      let params = buildParams(model, normalizedContext, isOAuth, options);
      const nextParams = await options?.onPayload?.(params, model);
      if (nextParams !== void 0) {
        params = { ...nextParams, stream: true };
      }
      const requestOptions = {
        ...options?.signal ? { signal: options.signal } : {},
        ...options?.timeoutMs !== void 0 ? { timeout: options.timeoutMs } : {},
        maxRetries: 0
      };
      const response = await retryProviderRequest(() => client.beta.messages.create(params, requestOptions).asResponse(), {
        maxRetries: options?.maxRetries,
        maxRetryDelayMs: options?.maxRetryDelayMs,
        signal: options?.signal
      });
      await options?.onResponse?.({ status: response.status, headers: headersToRecord(response.headers) }, model);
      stream4.push({ type: "start", partial: output });
      const blocks = output.content;
      for await (const event of iterateAnthropicEvents(response, options?.signal)) {
        await options?.onProviderStreamEvent?.(event, model);
        if (event.type === "message_start") {
          output.responseId = event.message.id;
          const transformations = event.message.input_transformations;
          if (Array.isArray(transformations))
            inputTransformations = transformations;
          const responseModel = event.message.model;
          if (responseModel !== model.id)
            output.responseModel = responseModel;
          const fallbackCost = responseModel === model.id ? void 0 : model.compat?.allowedFallbackModels?.find((fallback) => fallback.provider === model.provider && fallback.model === responseModel)?.cost;
          usageModel = fallbackCost ? { ...model, id: responseModel, cost: fallbackCost } : model;
          output.usage.input = event.message.usage.input_tokens || 0;
          output.usage.output = event.message.usage.output_tokens || 0;
          output.usage.cacheRead = event.message.usage.cache_read_input_tokens || 0;
          output.usage.cacheWrite = event.message.usage.cache_creation_input_tokens || 0;
          output.usage.cacheWrite1h = event.message.usage.cache_creation?.ephemeral_1h_input_tokens || 0;
          output.usage.totalTokens = output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
          calculateCost(usageModel, output.usage);
        } else if (event.type === "content_block_start") {
          if (event.content_block.type === "fallback") {
            if (output.content.length > 0) {
              throw new Error("Anthropic performed an unsupported mid-output model fallback");
            }
            continue;
          }
          if (event.content_block.type === "text") {
            const block = {
              type: "text",
              text: event.content_block.text ?? "",
              index: event.index
            };
            output.content.push(block);
            stream4.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output });
          } else if (event.content_block.type === "thinking") {
            const block = {
              type: "thinking",
              thinking: event.content_block.thinking ?? "",
              thinkingSignature: event.content_block.signature ?? "",
              index: event.index
            };
            output.content.push(block);
            stream4.push({ type: "thinking_start", contentIndex: output.content.length - 1, partial: output });
          } else if (event.content_block.type === "redacted_thinking") {
            const block = {
              type: "thinking",
              thinking: "[Reasoning redacted]",
              thinkingSignature: event.content_block.data,
              redacted: true,
              index: event.index
            };
            output.content.push(block);
            stream4.push({ type: "thinking_start", contentIndex: output.content.length - 1, partial: output });
          } else if (event.content_block.type === "tool_use") {
            const block = {
              type: "toolCall",
              id: event.content_block.id,
              name: isOAuth ? fromClaudeCodeName(event.content_block.name, currentTools) : event.content_block.name,
              arguments: event.content_block.input ?? {},
              partialJson: "",
              index: event.index
            };
            output.content.push(block);
            stream4.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output });
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            const index = blocks.findIndex((b) => b.index === event.index);
            const block = blocks[index];
            if (block && block.type === "text") {
              block.text += event.delta.text;
              stream4.push({
                type: "text_delta",
                contentIndex: index,
                delta: event.delta.text,
                partial: output
              });
            }
          } else if (event.delta.type === "thinking_delta") {
            const index = blocks.findIndex((b) => b.index === event.index);
            const block = blocks[index];
            if (block && block.type === "thinking") {
              block.thinking += event.delta.thinking;
              stream4.push({
                type: "thinking_delta",
                contentIndex: index,
                delta: event.delta.thinking,
                partial: output
              });
            }
          } else if (event.delta.type === "input_json_delta") {
            const index = blocks.findIndex((b) => b.index === event.index);
            const block = blocks[index];
            if (block && block.type === "toolCall") {
              block.partialJson += event.delta.partial_json;
              block.arguments = parseStreamingJson(block.partialJson);
              stream4.push({
                type: "toolcall_delta",
                contentIndex: index,
                delta: event.delta.partial_json,
                partial: output
              });
            }
          } else if (event.delta.type === "signature_delta") {
            const index = blocks.findIndex((b) => b.index === event.index);
            const block = blocks[index];
            if (block && block.type === "thinking") {
              block.thinkingSignature = block.thinkingSignature || "";
              block.thinkingSignature += event.delta.signature;
            }
          }
        } else if (event.type === "content_block_stop") {
          const index = blocks.findIndex((b) => b.index === event.index);
          const block = blocks[index];
          if (block) {
            delete block.index;
            if (block.type === "text") {
              stream4.push({
                type: "text_end",
                contentIndex: index,
                content: block.text,
                partial: output
              });
            } else if (block.type === "thinking") {
              stream4.push({
                type: "thinking_end",
                contentIndex: index,
                content: block.thinking,
                partial: output
              });
            } else if (block.type === "toolCall") {
              block.arguments = parseStreamingJson(block.partialJson);
              delete block.partialJson;
              stream4.push({
                type: "toolcall_end",
                contentIndex: index,
                toolCall: block,
                partial: output
              });
            }
          }
        } else if (event.type === "message_delta") {
          const transformations = event.input_transformations;
          if (Array.isArray(transformations))
            inputTransformations = transformations;
          if (event.delta.stop_reason) {
            output.rawStopReason = event.delta.stop_reason;
            const stopReasonResult = mapStopReason2(event.delta.stop_reason, event.delta.stop_details);
            output.stopReason = stopReasonResult.stopReason;
            if (stopReasonResult.errorMessage) {
              output.errorMessage = stopReasonResult.errorMessage;
            }
          }
          if (event.usage) {
            if (event.usage.input_tokens != null) {
              output.usage.input = event.usage.input_tokens;
            }
            if (event.usage.output_tokens != null) {
              output.usage.output = event.usage.output_tokens;
            }
            if (event.usage.cache_read_input_tokens != null) {
              output.usage.cacheRead = event.usage.cache_read_input_tokens;
            }
            if (event.usage.cache_creation_input_tokens != null) {
              output.usage.cacheWrite = event.usage.cache_creation_input_tokens;
            }
            const cacheCreation = event.usage.cache_creation;
            if (cacheCreation?.ephemeral_1h_input_tokens != null) {
              output.usage.cacheWrite1h = cacheCreation.ephemeral_1h_input_tokens;
            }
            const thinkingTokens = event.usage.output_tokens_details?.thinking_tokens;
            if (thinkingTokens != null) {
              output.usage.reasoning = thinkingTokens;
            }
          }
          output.usage.totalTokens = output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
          calculateCost(usageModel, output.usage);
        }
      }
      if (options?.signal?.aborted) {
        throw new Error("Request was aborted");
      }
      if (output.stopReason === "pending") {
        throw new Error("Anthropic stream ended without a stop reason");
      }
      if (output.stopReason === "aborted" || output.stopReason === "error") {
        throw new Error(output.errorMessage || "An unknown error occurred");
      }
      if (inputTransformations && inputTransformations.length > 0) {
        appendAssistantMessageDiagnostic(output, {
          type: "anthropic_input_transformations",
          timestamp: Date.now(),
          details: {
            transformations: inputTransformations.map((transformation) => ({
              type: transformation.type ?? void 0,
              path: transformation.path ?? void 0,
              reason: transformation.reason ?? void 0
            }))
          }
        });
      }
      stream4.push({ type: "done", reason: output.stopReason, message: output });
      stream4.end();
    } catch (error) {
      for (const block of output.content) {
        delete block.index;
        delete block.partialJson;
      }
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      stream4.push({ type: "error", reason: output.stopReason, error: output });
      stream4.end();
    }
  })();
  return stream4;
};
function mapThinkingLevelToEffort(model, level) {
  const mapped = level ? model.thinkingLevelMap?.[level] : void 0;
  if (typeof mapped === "string")
    return mapped;
  switch (level) {
    case "minimal":
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    default:
      return "high";
  }
}
var streamSimple = (model, context, options) => {
  if (!getAnthropicFederation(model, options?.apiKey, options?.headers, options?.env)) {
    assertRequestAuth(model.provider, options?.apiKey, options?.headers);
  }
  const base = {
    ...buildBaseOptions(model, context, options, options?.apiKey),
    toolChoice: options?.toolChoice
  };
  if (!options?.reasoning) {
    return stream(model, context, {
      ...base,
      thinkingEnabled: false
    });
  }
  if (model.compat?.forceAdaptiveThinking === true) {
    const effort = mapThinkingLevelToEffort(model, options.reasoning);
    return stream(model, context, {
      ...base,
      thinkingEnabled: true,
      effort
    });
  }
  const adjusted = adjustMaxTokensForThinking(base.maxTokens, model.maxTokens, options.reasoning, options.thinkingBudgets);
  const maxTokens = clampMaxTokensToContext(model, context, adjusted.maxTokens);
  return stream(model, context, {
    ...base,
    maxTokens,
    thinkingEnabled: true,
    thinkingBudgetTokens: Math.min(adjusted.thinkingBudget, Math.max(0, maxTokens - 1024))
  });
};
function isOAuthToken(apiKey) {
  return apiKey.includes("sk-ant-oat");
}
function createClient(model, apiKey, optionsHeaders, fetch, dynamicHeaders, sessionId, federation) {
  if (model.provider === "github-copilot") {
    const client2 = new PiAnthropic({
      apiKey: null,
      authToken: apiKey ?? null,
      baseURL: model.baseUrl,
      dangerouslyAllowBrowser: true,
      fetch,
      defaultHeaders: mergeClientHeaders({
        accept: "application/json",
        "anthropic-dangerous-direct-browser-access": "true"
      }, model.headers, dynamicHeaders, optionsHeaders)
    });
    return { client: client2, isOAuthToken: false };
  }
  if (apiKey && isOAuthToken(apiKey)) {
    const client2 = new PiAnthropic({
      apiKey: null,
      authToken: apiKey,
      baseURL: model.baseUrl,
      dangerouslyAllowBrowser: true,
      fetch,
      defaultHeaders: mergeClientHeaders({
        accept: "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
        "user-agent": `claude-cli/${claudeCodeVersion}`,
        "x-app": "cli"
      }, model.headers, optionsHeaders)
    });
    return { client: client2, isOAuthToken: true };
  }
  const compat = getAnthropicCompat(model);
  const sessionAffinityHeaders = {};
  if (sessionId && compat.sendSessionAffinityHeaders) {
    const header = compat.sessionAffinityFormat === "openrouter" ? "x-session-id" : "x-session-affinity";
    sessionAffinityHeaders[header] = sessionId;
  }
  const defaultHeaders = mergeClientHeaders({
    accept: "application/json",
    "anthropic-dangerous-direct-browser-access": "true"
  }, sessionAffinityHeaders, model.headers, optionsHeaders);
  if (federation) {
    const key = JSON.stringify([model.baseUrl, federation]);
    if (federationClient?.key !== key || federationClient.fetch !== fetch) {
      const client2 = new PiAnthropic({
        apiKey: null,
        authToken: null,
        config: federation,
        baseURL: model.baseUrl,
        dangerouslyAllowBrowser: true,
        fetch
      });
      federationClient = { key, fetch, client: client2 };
    }
    return { client: federationClient.client.withOptions({ defaultHeaders }), isOAuthToken: false };
  }
  const client = new PiAnthropic({
    apiKey: apiKey ?? null,
    authToken: null,
    baseURL: model.baseUrl,
    dangerouslyAllowBrowser: true,
    fetch,
    defaultHeaders
  });
  return { client, isOAuthToken: false };
}
function getBetaFeatures(model, context, isOAuthToken2, nativeToolChanges, options) {
  let configuredFeatures;
  for (const headers of [model.headers, options?.headers]) {
    for (const [name2, value] of Object.entries(headers ?? {})) {
      if (name2.toLowerCase() === "anthropic-beta")
        configuredFeatures = value;
    }
  }
  if (configuredFeatures === null)
    return [];
  if (configuredFeatures !== void 0) {
    return [
      ...new Set(configuredFeatures.split(",").map((feature) => feature.trim()).filter((feature) => feature.length > 0))
    ];
  }
  const features = [];
  if (isOAuthToken2)
    features.push("claude-code-20250219", "oauth-2025-04-20");
  if (shouldUseFineGrainedToolStreamingBeta(model, context))
    features.push(FINE_GRAINED_TOOL_STREAMING_BETA);
  if (model.reasoning && options?.thinkingEnabled === true && (options.interleavedThinking ?? true) && model.compat?.forceAdaptiveThinking !== true) {
    features.push(INTERLEAVED_THINKING_BETA);
  }
  if (shouldUseServerSideFallbackBeta(model))
    features.push(SERVER_SIDE_FALLBACK_BETA);
  if (model.compat?.supportsMidConvoEffort === true) {
    features.push(MID_CONVERSATION_OUTPUT_CONFIG_BETA, THINKING_BINDING_CONTROLS_BETA);
  }
  if (nativeToolChanges)
    features.push(INLINE_TOOLS_BETA);
  return [...new Set(features)];
}
function buildParams(model, context, isOAuthToken2, options) {
  const { cacheControl } = getCacheControl(model, options?.cacheRetention, options?.env);
  const compat = getAnthropicCompat(model);
  const initialSystemMessage = getInitialSystemMessage(context.messages);
  const initialSystemText = initialSystemMessage ? getSystemMessageText(initialSystemMessage) : "";
  const transformedMessages = transformMessages(context.messages, model, normalizeToolCallId);
  const conversationMessages = initialSystemMessage ? transformedMessages.slice(1) : transformedMessages;
  const initialTools = initialSystemMessage?.toolsAdded ?? [];
  const nativeToolChanges = compat.supportsMidConvoSystemMessages && compat.supportsMidConvoToolChanges && initialTools.length > 0;
  const converted = convertMessages(conversationMessages, isOAuthToken2, cacheControl, compat.allowEmptySignature, model.compat?.supportsMidConvoEffort === true ? model.provider : void 0, nativeToolChanges ? (tools) => convertTools(tools, isOAuthToken2, compat.supportsEagerToolInputStreaming, compat.supportsStrictTools) : void 0);
  const activeEffort = options?.effort ?? "high";
  const betaFeatures = getBetaFeatures(model, context, isOAuthToken2, nativeToolChanges, options);
  const params = {
    model: model.id,
    messages: model.compat?.supportsMidConvoEffort === true ? insertThinkingLevelMessages(converted, activeEffort) : converted.messages,
    max_tokens: options?.maxTokens ?? model.maxTokens,
    stream: true,
    ...betaFeatures.length > 0 ? { betas: betaFeatures } : {}
  };
  if (isOAuthToken2) {
    params.system = [
      {
        type: "text",
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
        ...cacheControl ? { cache_control: cacheControl } : {}
      }
    ];
    if (initialSystemText) {
      params.system.push({
        type: "text",
        text: sanitizeSurrogates(initialSystemText),
        ...cacheControl ? { cache_control: cacheControl } : {}
      });
    }
  } else if (initialSystemText) {
    params.system = [
      {
        type: "text",
        text: sanitizeSurrogates(initialSystemText),
        ...cacheControl ? { cache_control: cacheControl } : {}
      }
    ];
  }
  if (options?.temperature !== void 0 && !options?.thinkingEnabled && model.compat?.supportsMidConvoEffort !== true && compat.supportsTemperature) {
    params.temperature = options.temperature;
  }
  const toolCacheControl = compat.supportsCacheControlOnTools ? cacheControl : void 0;
  if (nativeToolChanges) {
    params.tools = [
      ...convertTools(initialTools, isOAuthToken2, compat.supportsEagerToolInputStreaming, compat.supportsStrictTools, toolCacheControl),
      DEFERRED_TOOL_PLACEHOLDER
    ];
  } else {
    const tools = getCurrentTools(context.messages);
    if (tools.length > 0) {
      params.tools = convertTools(tools, isOAuthToken2, compat.supportsEagerToolInputStreaming, compat.supportsStrictTools, toolCacheControl);
    }
  }
  if (model.compat?.supportsMidConvoEffort === true) {
    params.thinking = {
      type: "adaptive",
      display: options?.thinkingDisplay ?? "summarized",
      block_binding: { prefix_mismatch_behavior: "drop_block" }
    };
    params.output_config = { effort: "high" };
  } else if (model.reasoning) {
    if (options?.thinkingEnabled) {
      const display = options.thinkingDisplay ?? "summarized";
      if (model.compat?.forceAdaptiveThinking === true) {
        params.thinking = { type: "adaptive", display };
        if (options.effort) {
          params.output_config = { effort: options.effort };
        }
      } else {
        params.thinking = {
          type: "enabled",
          budget_tokens: options.thinkingBudgetTokens || 1024,
          display
        };
      }
    } else if (options?.thinkingEnabled === false && model.thinkingLevelMap?.off !== null) {
      params.thinking = { type: "disabled" };
    }
  }
  if (options?.metadata) {
    const userId = options.metadata.user_id;
    if (typeof userId === "string") {
      params.metadata = { user_id: userId };
    }
  }
  if (options?.toolChoice) {
    if (typeof options.toolChoice === "string") {
      params.tool_choice = { type: options.toolChoice };
    } else {
      params.tool_choice = options.toolChoice;
    }
  }
  const allowedFallbackModels = model.compat?.allowedFallbackModels;
  if (allowedFallbackModels && allowedFallbackModels.length > 0) {
    params.fallbacks = allowedFallbackModels.map((fallback) => ({ model: fallback.model }));
  }
  return params;
}
function normalizeToolCallId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}
function convertToolResult(msg) {
  return {
    type: "tool_result",
    tool_use_id: msg.toolCallId,
    content: convertContentBlocks(msg.content),
    is_error: msg.isError
  };
}
function convertMessages(transformedMessages, isOAuthToken2, cacheControl, allowEmptySignature = false, managedProvider, convertToolDefinitions) {
  const params = [];
  const assistantLevels = /* @__PURE__ */ new Map();
  const pendingSystemMessages = [];
  const flushPendingSystemMessages = () => {
    params.push(...pendingSystemMessages);
    pendingSystemMessages.length = 0;
  };
  for (let i = 0; i < transformedMessages.length; i++) {
    const msg = transformedMessages[i];
    if (msg.role === "system") {
      const text = renderSystemMessageUpdate(msg);
      const blocks = [];
      if (text.length > 0)
        blocks.push({ type: "text", text: sanitizeSurrogates(text) });
      if (convertToolDefinitions) {
        const added = msg.toolsAdded ?? [];
        const redefined = new Set(added.map((tool) => tool.name));
        for (const tool of msg.toolsRemoved ?? []) {
          if (redefined.has(tool.name))
            continue;
          blocks.push({
            type: "tool_removal",
            tool: { type: "tool_reference", name: isOAuthToken2 ? toClaudeCodeName(tool.name) : tool.name }
          });
        }
        for (const definition of convertToolDefinitions(added)) {
          blocks.push({ type: "tool_addition", tool: { type: "tool_definition", definition } });
        }
      }
      if (blocks.length > 0)
        pendingSystemMessages.push({ role: "system", content: blocks });
    } else if (msg.role === "user") {
      if (typeof msg.content === "string") {
        if (msg.content.trim().length > 0) {
          params.push({
            role: "user",
            content: sanitizeSurrogates(msg.content)
          });
        }
      } else {
        const blocks = msg.content.map((item) => {
          if (item.type === "text") {
            return {
              type: "text",
              text: sanitizeSurrogates(item.text)
            };
          } else {
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: item.mimeType,
                data: item.data
              }
            };
          }
        });
        const filteredBlocks = blocks.filter((b) => {
          if (b.type === "text") {
            return b.text.trim().length > 0;
          }
          return true;
        });
        if (filteredBlocks.length === 0)
          continue;
        params.push({
          role: "user",
          content: filteredBlocks
        });
      }
    } else if (msg.role === "assistant") {
      flushPendingSystemMessages();
      const blocks = [];
      for (const block of msg.content) {
        if (block.type === "text") {
          if (block.text.trim().length === 0)
            continue;
          blocks.push({
            type: "text",
            text: sanitizeSurrogates(block.text)
          });
        } else if (block.type === "thinking") {
          if (block.redacted) {
            blocks.push({
              type: "redacted_thinking",
              data: block.thinkingSignature
            });
            continue;
          }
          const thinkingSignature = block.thinkingSignature;
          const hasThinkingSignature = !!thinkingSignature && thinkingSignature.trim().length > 0;
          if (block.thinking.trim().length === 0 && !hasThinkingSignature)
            continue;
          if (!hasThinkingSignature) {
            blocks.push(allowEmptySignature ? {
              type: "thinking",
              thinking: sanitizeSurrogates(block.thinking),
              signature: ""
            } : {
              type: "text",
              text: sanitizeSurrogates(block.thinking)
            });
          } else {
            blocks.push({
              type: "thinking",
              thinking: sanitizeSurrogates(block.thinking),
              signature: thinkingSignature
            });
          }
        } else if (block.type === "toolCall") {
          blocks.push({
            type: "tool_use",
            id: block.id,
            name: isOAuthToken2 ? toClaudeCodeName(block.name) : block.name,
            input: block.arguments ?? {}
          });
        }
      }
      if (blocks.length === 0)
        continue;
      const messageIndex = params.length;
      params.push({
        role: "assistant",
        content: blocks
      });
      if (managedProvider !== void 0 && msg.api === "anthropic-messages" && msg.provider === managedProvider && isAnthropicEffort(msg.providerThinkingLevel)) {
        assistantLevels.set(messageIndex, msg.providerThinkingLevel);
      }
    } else if (msg.role === "toolResult") {
      const toolResults = [];
      let j = i;
      while (j < transformedMessages.length && transformedMessages[j].role === "toolResult") {
        toolResults.push(convertToolResult(transformedMessages[j]));
        j++;
      }
      i = j - 1;
      params.push({
        role: "user",
        content: toolResults
      });
    }
  }
  flushPendingSystemMessages();
  if (cacheControl && params.length > 0) {
    const lastMessage = params[params.length - 1];
    if (lastMessage.role === "user" || lastMessage.role === "system") {
      if (Array.isArray(lastMessage.content)) {
        const lastBlock = lastMessage.content[lastMessage.content.length - 1];
        if (lastBlock && (lastBlock.type === "text" || lastBlock.type === "image" || lastBlock.type === "tool_result" || lastBlock.type === "tool_addition" || lastBlock.type === "tool_removal")) {
          lastBlock.cache_control = cacheControl;
        }
      } else if (typeof lastMessage.content === "string") {
        lastMessage.content = [
          {
            type: "text",
            text: lastMessage.content,
            cache_control: cacheControl
          }
        ];
      }
    }
  }
  return { messages: params, assistantLevels };
}
function isAnthropicEffort(value) {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh" || value === "max";
}
function insertThinkingLevelMessages(converted, activeEffort) {
  const messages = [];
  for (let index = 0; index < converted.messages.length; index++) {
    const historicalEffort = converted.assistantLevels.get(index);
    if (historicalEffort !== void 0) {
      messages.push({ role: "system", content: [], output_config: { effort: historicalEffort } });
    }
    messages.push(converted.messages[index]);
  }
  messages.push({ role: "system", content: [], output_config: { effort: activeEffort } });
  return messages;
}
function shouldUseFineGrainedToolStreamingBeta(model, context) {
  return getCurrentTools(context.messages).length > 0 && !getAnthropicCompat(model).supportsEagerToolInputStreaming;
}
var ANTHROPIC_STRICT_UNSUPPORTED_KEYWORDS = /* @__PURE__ */ new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "maxItems",
  "uniqueItems",
  "minContains",
  "maxContains",
  "minProperties",
  "maxProperties"
]);
var ANTHROPIC_STRICT_STRING_FORMATS = /* @__PURE__ */ new Set([
  "date-time",
  "time",
  "date",
  "duration",
  "email",
  "hostname",
  "uri",
  "ipv4",
  "ipv6",
  "uuid"
]);
var isAnthropicStrictUnsupportedKeyword = (key, value) => {
  if (ANTHROPIC_STRICT_UNSUPPORTED_KEYWORDS.has(key))
    return true;
  if (key === "minItems")
    return value !== 0 && value !== 1;
  if (key === "format")
    return typeof value !== "string" || !ANTHROPIC_STRICT_STRING_FORMATS.has(value);
  return false;
};
function convertTools(tools, isOAuthToken2, supportsEagerToolInputStreaming, supportsStrictTools, cacheControl) {
  if (!tools)
    return [];
  return tools.map((tool, index) => {
    const strict = resolveJsonSchemaStrictSampling(tool, supportsStrictTools, isAnthropicStrictUnsupportedKeyword);
    const parameters = getJsonSchemaToolParameters(tool, strict);
    const schema = parameters;
    const legacyInputSchema = {
      type: "object",
      properties: schema.properties ?? {},
      required: schema.required ?? []
    };
    const inputSchema = strict === true ? {
      ...parameters,
      ...legacyInputSchema
    } : legacyInputSchema;
    return {
      name: isOAuthToken2 ? toClaudeCodeName(tool.name) : tool.name,
      description: tool.description,
      ...supportsEagerToolInputStreaming ? { eager_input_streaming: true } : {},
      ...strict === true ? { strict: true } : {},
      input_schema: inputSchema,
      ...cacheControl && index === tools.length - 1 ? { cache_control: cacheControl } : {}
    };
  });
}
function mapStopReason2(reason, stopDetails) {
  switch (reason) {
    case "end_turn":
      return { stopReason: "stop" };
    case "max_tokens":
      return { stopReason: "length" };
    case "tool_use":
      return { stopReason: "toolUse" };
    case "refusal":
      return {
        stopReason: "error",
        errorMessage: stopDetails?.explanation || `The model refused to complete the request`
      };
    case "pause_turn":
      return { stopReason: "stop" };
    case "stop_sequence":
      return { stopReason: "stop" };
    // We don't supply stop sequences, so this should never happen
    case "sensitive":
      return { stopReason: "error", errorMessage: "Provider stopped with: sensitive" };
    default:
      throw new Error(`Unhandled stop reason: ${reason}`);
  }
}

// node_modules/opencode-go-pi-ai/dist/api/openai-completions.js
var openai_completions_exports = {};
__export(openai_completions_exports, {
  convertMessages: () => convertMessages2,
  stream: () => stream2,
  streamSimple: () => streamSimple2
});
import OpenAI from "openai";

// node_modules/opencode-go-pi-ai/dist/utils/error-body.js
var MAX_PROVIDER_ERROR_BODY_CHARS = 4e3;
function normalizeProviderError(error) {
  if (!(error instanceof Error)) {
    return { message: safeJsonStringify2(error), messageCarriesBody: false };
  }
  const sdkError = error;
  const status = extractStatus(sdkError);
  const body = extractBody(sdkError);
  const messageCarriesBody = body === void 0 || error.message.includes(body);
  return {
    status,
    body,
    message: error.message,
    messageCarriesBody
  };
}
function extractStatus(error) {
  if (typeof error.statusCode === "number")
    return error.statusCode;
  if (typeof error.status === "number")
    return error.status;
  if (typeof error.$metadata?.httpStatusCode === "number")
    return error.$metadata.httpStatusCode;
  if (typeof error.$response?.statusCode === "number")
    return error.$response.statusCode;
  return void 0;
}
function extractBody(error) {
  const bodyText = pickBodyText(error);
  if (bodyText === void 0)
    return void 0;
  const trimmed = bodyText.trim();
  if (trimmed.length === 0)
    return void 0;
  return truncateErrorText(trimmed, MAX_PROVIDER_ERROR_BODY_CHARS);
}
function pickBodyText(error) {
  if (typeof error.body === "string")
    return error.body;
  if (isPlainNonEmptyObject(error.error))
    return safeJsonStringify2(error.error);
  const responseBody = error.$response?.body;
  if (typeof responseBody === "string")
    return responseBody;
  if (isReadableStreamLike(responseBody))
    return void 0;
  if (isPlainNonEmptyObject(responseBody))
    return safeJsonStringify2(responseBody);
  return void 0;
}
function isReadableStreamLike(value) {
  return typeof value === "object" && value !== null && "pipe" in value && typeof value.pipe === "function";
}
function isPlainNonEmptyObject(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    return false;
  return Object.keys(value).length > 0;
}
function formatProviderError(norm, prefix) {
  if (norm.messageCarriesBody || norm.status === void 0 || norm.body === void 0) {
    return prefix !== void 0 && norm.status !== void 0 ? `${prefix} (${norm.status}): ${norm.message}` : norm.message;
  }
  return prefix !== void 0 ? `${prefix} (${norm.status}): ${norm.body}` : `${norm.status}: ${norm.body}`;
}
function truncateErrorText(text, maxChars) {
  if (text.length <= maxChars)
    return text;
  return `${text.slice(0, maxChars)}... [truncated ${text.length - maxChars} chars]`;
}
function safeJsonStringify2(value) {
  try {
    const serialized = JSON.stringify(value);
    return serialized === void 0 ? String(value) : serialized;
  } catch {
    return String(value);
  }
}

// node_modules/opencode-go-pi-ai/dist/utils/hash.js
function shortHash(str) {
  let h1 = 3735928559;
  let h2 = 1103547991;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

// node_modules/opencode-go-pi-ai/dist/api/openai-prompt-cache.js
var OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH = 64;
function clampOpenAIPromptCacheKey(key) {
  if (key === void 0)
    return void 0;
  const chars = Array.from(key);
  if (chars.length <= OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH)
    return key;
  return chars.slice(0, OPENAI_PROMPT_CACHE_KEY_MAX_LENGTH).join("");
}

// node_modules/opencode-go-pi-ai/dist/api/openai-completions.js
function hasHeader2(headers, name2) {
  if (!headers)
    return false;
  const expected = name2.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === expected && value !== null && value.trim().length > 0)
      return true;
  }
  return false;
}
function getClientApiKey(provider, apiKey, headers) {
  if (apiKey)
    return apiKey;
  if (hasHeader2(headers, "authorization") || hasHeader2(headers, "cf-aig-authorization"))
    return "unused";
  throw new Error(`No API key for provider: ${provider}`);
}
function hasToolHistory(messages) {
  for (const msg of messages) {
    if (msg.role === "toolResult") {
      return true;
    }
    if (msg.role === "assistant") {
      if (msg.content.some((block) => block.type === "toolCall")) {
        return true;
      }
    }
  }
  return false;
}
function isTextContentBlock(block) {
  return block.type === "text";
}
function isThinkingContentBlock(block) {
  return block.type === "thinking";
}
function isToolCallBlock(block) {
  return block.type === "toolCall";
}
function isImageContentBlock(block) {
  return block.type === "image";
}
function isReasoningDetailObject(detail) {
  return typeof detail === "object" && detail !== null && !Array.isArray(detail);
}
function hasValidCommonReasoningDetailFields(candidate) {
  return (candidate.id === void 0 || candidate.id === null || typeof candidate.id === "string") && (candidate.format === void 0 || typeof candidate.format === "string") && (candidate.index === void 0 || typeof candidate.index === "number");
}
function isOpenAIReasoningDetail(detail) {
  if (!isReasoningDetailObject(detail) || !hasValidCommonReasoningDetailFields(detail)) {
    return false;
  }
  switch (detail.type) {
    case "reasoning.summary":
      return typeof detail.summary === "string";
    case "reasoning.encrypted":
      return typeof detail.data === "string";
    case "reasoning.text":
      return typeof detail.text === "string" && (detail.signature === void 0 || detail.signature === null || typeof detail.signature === "string");
    default:
      return false;
  }
}
function parseOpenAIReasoningDetails(signature) {
  if (!signature)
    return void 0;
  try {
    const parsed = JSON.parse(signature);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every(isOpenAIReasoningDetail) ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function parseLegacyEncryptedReasoningDetail(signature) {
  if (!signature)
    return void 0;
  try {
    const parsed = JSON.parse(signature);
    return isOpenAIReasoningDetail(parsed) && parsed.type === "reasoning.encrypted" && typeof parsed.id === "string" && parsed.id.length > 0 && parsed.data.length > 0 ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function fillMissingCommonReasoningDetailFields(target, source) {
  target.id ??= source.id;
  target.format ||= source.format;
  target.index ??= source.index;
}
function appendOpenAIReasoningDetail(details, detail) {
  const lastDetail = details[details.length - 1];
  if (detail.type === "reasoning.text" && lastDetail?.type === "reasoning.text") {
    lastDetail.text += detail.text;
    lastDetail.signature ||= detail.signature;
    fillMissingCommonReasoningDetailFields(lastDetail, detail);
    return;
  }
  if (detail.type === "reasoning.summary" && lastDetail?.type === "reasoning.summary") {
    lastDetail.summary += detail.summary;
    fillMissingCommonReasoningDetailFields(lastDetail, detail);
    return;
  }
  details.push({ ...detail });
}
var OPENAI_COMPLETIONS_REASONING_FIELDS = ["reasoning", "reasoning_content", "reasoning_text"];
function isOpenAICompletionsReasoningField(field) {
  return OPENAI_COMPLETIONS_REASONING_FIELDS.includes(field);
}
function resolveCacheRetention2(cacheRetention, env) {
  if (cacheRetention) {
    return cacheRetention;
  }
  if (getProviderEnvValue("PI_CACHE_RETENTION", env) === "long") {
    return "long";
  }
  return "short";
}
var stream2 = (model, context, options) => {
  const stream4 = new AssistantMessageEventStream();
  const normalizedContext = resolveTranscript(context, getCompat(model).supportsMidConvoSystemMessages);
  (async () => {
    const output = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      },
      stopReason: "pending",
      timestamp: Date.now()
    };
    let streamedReasoningDetails;
    const applyStreamedReasoningDetails = (block) => {
      if (streamedReasoningDetails !== void 0) {
        block.thinkingSignature = JSON.stringify(streamedReasoningDetails);
      }
    };
    try {
      const apiKey = getClientApiKey(model.provider, options?.apiKey, options?.headers);
      const compat = getCompat(model);
      const grammarToolInputProperties = createGrammarToolInputProperties(getDeclaredTools(normalizedContext.messages), compat.supportsOpenAIGrammarTools);
      const cacheRetention = resolveCacheRetention2(options?.cacheRetention, options?.env);
      const cacheSessionId = cacheRetention === "none" ? void 0 : options?.sessionId;
      const client = createClient2(model, normalizedContext, apiKey, options?.headers, options?.fetch, cacheSessionId, compat);
      let params = buildParams2(model, normalizedContext, options, compat, cacheRetention, grammarToolInputProperties);
      const nextParams = await options?.onPayload?.(params, model);
      if (nextParams !== void 0) {
        params = nextParams;
      }
      const requestOptions = {
        ...options?.signal ? { signal: options.signal } : {},
        ...options?.timeoutMs !== void 0 ? { timeout: options.timeoutMs } : {},
        maxRetries: 0
      };
      const { data: openaiStream, response } = await retryProviderRequest(() => client.chat.completions.create(params, requestOptions).withResponse(), {
        maxRetries: options?.maxRetries,
        maxRetryDelayMs: options?.maxRetryDelayMs,
        signal: options?.signal
      });
      await options?.onResponse?.({ status: response.status, headers: headersToRecord(response.headers) }, model);
      stream4.push({ type: "start", partial: output });
      let textBlock = null;
      let thinkingBlock = null;
      let hasFinishReason = false;
      const toolCallBlocksByIndex = /* @__PURE__ */ new Map();
      const toolCallBlocksById = /* @__PURE__ */ new Map();
      const blocks = output.content;
      const getContentIndex = (block) => blocks.indexOf(block);
      const getCustomToolCallInput2 = (block) => {
        const property = block.customInput?.property;
        if (property === void 0)
          return "";
        const value = block.arguments[property];
        return typeof value === "string" ? value : "";
      };
      const appendCustomToolCallInput2 = (block, nextInput, close) => {
        const customInput = block.customInput;
        if (!customInput)
          return void 0;
        const delta = appendGrammarToolInputJsonDelta(customInput.jsonBuffer, customInput.property, nextInput, close);
        block.arguments = { [customInput.property]: nextInput };
        return delta;
      };
      const finishBlock = (block) => {
        const contentIndex = getContentIndex(block);
        if (contentIndex === -1) {
          return;
        }
        if (block.type === "text") {
          stream4.push({
            type: "text_end",
            contentIndex,
            content: block.text,
            partial: output
          });
        } else if (block.type === "thinking") {
          applyStreamedReasoningDetails(block);
          stream4.push({
            type: "thinking_end",
            contentIndex,
            content: block.thinking,
            partial: output
          });
        } else if (block.type === "toolCall") {
          if (block.customInput) {
            const delta = appendCustomToolCallInput2(block, getCustomToolCallInput2(block), true);
            if (delta !== void 0) {
              stream4.push({
                type: "toolcall_delta",
                contentIndex,
                delta,
                partial: output
              });
            }
          } else {
            block.arguments = parseStreamingJson(block.partialArgs);
          }
          delete block.partialArgs;
          delete block.customInput;
          delete block.streamIndex;
          stream4.push({
            type: "toolcall_end",
            contentIndex,
            toolCall: block,
            partial: output
          });
        }
      };
      const ensureTextBlock = () => {
        if (!textBlock) {
          textBlock = { type: "text", text: "" };
          blocks.push(textBlock);
          stream4.push({ type: "text_start", contentIndex: getContentIndex(textBlock), partial: output });
        }
        return textBlock;
      };
      const ensureThinkingBlock = (thinkingSignature) => {
        if (!thinkingBlock) {
          thinkingBlock = {
            type: "thinking",
            thinking: "",
            thinkingSignature
          };
          blocks.push(thinkingBlock);
          stream4.push({ type: "thinking_start", contentIndex: getContentIndex(thinkingBlock), partial: output });
        }
        return thinkingBlock;
      };
      const ensureToolCallBlock = (toolCall) => {
        const streamIndex = typeof toolCall.index === "number" ? toolCall.index : void 0;
        const name2 = toolCall.function?.name ?? toolCall.custom?.name ?? "";
        let block = streamIndex !== void 0 ? toolCallBlocksByIndex.get(streamIndex) : void 0;
        if (!block && toolCall.id) {
          block = toolCallBlocksById.get(toolCall.id);
        }
        if (!block) {
          const customInputProperty = toolCall.custom && !toolCall.function ? grammarToolInputProperties.get(name2) ?? "input" : void 0;
          const hasCustomInput = customInputProperty !== void 0;
          block = {
            type: "toolCall",
            id: toolCall.id || "",
            name: name2,
            arguments: hasCustomInput ? { [customInputProperty]: "" } : {},
            partialArgs: hasCustomInput ? void 0 : "",
            customInput: hasCustomInput ? { property: customInputProperty, jsonBuffer: { input: "", started: false, closed: false } } : void 0,
            streamIndex
          };
          if (streamIndex !== void 0) {
            toolCallBlocksByIndex.set(streamIndex, block);
          }
          if (toolCall.id) {
            toolCallBlocksById.set(toolCall.id, block);
          }
          blocks.push(block);
          stream4.push({
            type: "toolcall_start",
            contentIndex: getContentIndex(block),
            partial: output
          });
        }
        if (streamIndex !== void 0 && block.streamIndex === void 0) {
          block.streamIndex = streamIndex;
          toolCallBlocksByIndex.set(streamIndex, block);
        }
        if (toolCall.id) {
          toolCallBlocksById.set(toolCall.id, block);
        }
        if (!block.name && name2) {
          block.name = name2;
        }
        if (toolCall.custom && !toolCall.function && !block.customInput) {
          const customInputProperty = grammarToolInputProperties.get(block.name) ?? "input";
          block.arguments = { [customInputProperty]: "" };
          block.customInput = {
            property: customInputProperty,
            jsonBuffer: { input: "", started: false, closed: false }
          };
          delete block.partialArgs;
        }
        return block;
      };
      for await (const chunk of openaiStream) {
        await options?.onProviderStreamEvent?.(chunk, model);
        if (!chunk || typeof chunk !== "object")
          continue;
        output.responseId ||= chunk.id;
        if (typeof chunk.model === "string" && chunk.model.length > 0 && chunk.model !== model.id) {
          output.responseModel ||= chunk.model;
        }
        if (chunk.usage) {
          output.usage = parseChunkUsage(chunk.usage, model);
        }
        const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : void 0;
        if (!choice)
          continue;
        if (!chunk.usage && choice.usage) {
          output.usage = parseChunkUsage(choice.usage, model);
        }
        if (choice.finish_reason) {
          output.rawStopReason = choice.finish_reason;
          const finishReasonResult = mapStopReason3(choice.finish_reason);
          output.stopReason = finishReasonResult.stopReason;
          if (finishReasonResult.errorMessage) {
            output.errorMessage = finishReasonResult.errorMessage;
          }
          hasFinishReason = true;
        }
        if (choice.delta) {
          if (choice.delta.content !== null && choice.delta.content !== void 0 && choice.delta.content.length > 0) {
            const block = ensureTextBlock();
            block.text += choice.delta.content;
            stream4.push({
              type: "text_delta",
              contentIndex: getContentIndex(block),
              delta: choice.delta.content,
              partial: output
            });
          }
          const reasoningFields = ["reasoning_content", "reasoning", "reasoning_text"];
          const deltaFields = choice.delta;
          let foundReasoningField = null;
          for (const field of reasoningFields) {
            const value = deltaFields[field];
            if (typeof value === "string" && value.length > 0) {
              foundReasoningField = field;
              break;
            }
          }
          if (foundReasoningField) {
            const delta = deltaFields[foundReasoningField];
            if (typeof delta === "string" && delta.length > 0) {
              const thinkingSignature = model.provider === "opencode-go" && foundReasoningField === "reasoning" ? "reasoning_content" : foundReasoningField;
              const block = ensureThinkingBlock(thinkingSignature);
              block.thinking += delta;
              stream4.push({
                type: "thinking_delta",
                contentIndex: getContentIndex(block),
                delta,
                partial: output
              });
            }
          }
          if (choice?.delta?.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {
              const block = ensureToolCallBlock(toolCall);
              if (!block.id && toolCall.id) {
                block.id = toolCall.id;
                toolCallBlocksById.set(toolCall.id, block);
              }
              const name2 = toolCall.function?.name ?? toolCall.custom?.name;
              if (!block.name && name2) {
                block.name = name2;
              }
              let delta = "";
              if (toolCall.function?.arguments) {
                delta = toolCall.function.arguments;
                block.partialArgs = (block.partialArgs ?? "") + toolCall.function.arguments;
                block.arguments = parseStreamingJson(block.partialArgs);
              } else if (toolCall.custom?.input) {
                const nextInput = getCustomToolCallInput2(block) + toolCall.custom.input;
                delta = appendCustomToolCallInput2(block, nextInput, false) ?? "";
              }
              stream4.push({
                type: "toolcall_delta",
                contentIndex: getContentIndex(block),
                delta,
                partial: output
              });
            }
          }
          const reasoningDetails = choice.delta.reasoning_details;
          if (Array.isArray(reasoningDetails)) {
            for (const detail of reasoningDetails) {
              if (!isOpenAIReasoningDetail(detail))
                continue;
              ensureThinkingBlock("");
              streamedReasoningDetails ??= [];
              appendOpenAIReasoningDetail(streamedReasoningDetails, detail);
            }
          }
        }
      }
      for (const block of blocks) {
        finishBlock(block);
      }
      if (options?.signal?.aborted) {
        throw new Error("Request was aborted");
      }
      if (output.stopReason === "aborted") {
        throw new Error("Request was aborted");
      }
      if (!hasFinishReason && !compat.supportsFinishReason) {
        output.stopReason = output.content.some((block) => block.type === "toolCall") ? "toolUse" : "stop";
      }
      if (output.stopReason === "error") {
        throw new Error(output.errorMessage || "Provider returned an error stop reason");
      }
      if (compat.supportsFinishReason && !hasFinishReason || output.stopReason === "pending") {
        throw new Error("Stream ended without finish_reason");
      }
      stream4.push({ type: "done", reason: output.stopReason, message: output });
      stream4.end();
    } catch (error) {
      for (const block of output.content) {
        if (block.type === "thinking") {
          applyStreamedReasoningDetails(block);
        }
        delete block.index;
        delete block.partialArgs;
        delete block.customInput;
        delete block.streamIndex;
      }
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = formatProviderError(normalizeProviderError(error));
      const rawMetadata = error?.error?.metadata?.raw;
      if (rawMetadata && !output.errorMessage.includes(String(rawMetadata))) {
        output.errorMessage += `
${rawMetadata}`;
      }
      stream4.push({ type: "error", reason: output.stopReason, error: output });
      stream4.end();
    }
  })();
  return stream4;
};
var streamSimple2 = (model, context, options) => {
  getClientApiKey(model.provider, options?.apiKey, options?.headers);
  const base = {
    ...buildBaseOptions(model, context, options, options?.apiKey),
    toolChoice: options?.toolChoice
  };
  const clampedReasoning = options?.reasoning ? clampThinkingLevel(model, options.reasoning) : void 0;
  const reasoningEffort = clampedReasoning === "off" ? void 0 : clampedReasoning;
  return stream2(model, context, {
    ...base,
    reasoningEffort,
    thinkingBudgets: options?.thinkingBudgets
  });
};
function createClient2(model, context, apiKey, optionsHeaders, fetch, sessionId, compat = getCompat(model)) {
  const headers = { "User-Agent": getPiUserAgent(), ...model.headers };
  if (model.provider === "github-copilot") {
    const hasImages = hasCopilotVisionInput(context.messages);
    const copilotHeaders = buildCopilotDynamicHeaders({
      messages: context.messages,
      hasImages
    });
    Object.assign(headers, copilotHeaders);
  }
  if (sessionId && compat.sendSessionAffinityHeaders) {
    if (compat.sessionAffinityFormat === "openrouter") {
      headers["x-session-id"] = sessionId;
    } else {
      if (compat.sessionAffinityFormat === "openai") {
        headers.session_id = sessionId;
      }
      headers["x-client-request-id"] = sessionId;
      headers["x-session-affinity"] = sessionId;
    }
  }
  if (optionsHeaders) {
    Object.assign(headers, optionsHeaders);
  }
  return new OpenAI({
    apiKey,
    baseURL: model.baseUrl,
    dangerouslyAllowBrowser: true,
    fetch,
    defaultHeaders: headers
  });
}
function buildParams2(model, context, options, compat = getCompat(model), cacheRetention = resolveCacheRetention2(options?.cacheRetention, options?.env), grammarToolInputProperties = createGrammarToolInputProperties(getDeclaredTools(context.messages), compat.supportsOpenAIGrammarTools)) {
  const transcriptTools = resolveTranscriptTools(context.messages, compat.supportsMidConvoSystemMessages === true && compat.supportsMidConvoToolAdditions === true);
  const messages = convertMessages2(model, context, compat, {
    grammarToolInputProperties
  });
  const cacheControl = getCompatCacheControl(compat, cacheRetention);
  const params = {
    model: model.id,
    messages,
    stream: true,
    prompt_cache_key: model.baseUrl.includes("api.openai.com") && cacheRetention !== "none" || cacheRetention === "long" && compat.supportsLongCacheRetention ? clampOpenAIPromptCacheKey(options?.sessionId) : void 0,
    prompt_cache_retention: cacheRetention === "long" && compat.supportsLongCacheRetention ? "24h" : void 0
  };
  if (compat.supportsUsageInStreaming !== false) {
    params.stream_options = { include_usage: true };
  }
  if (compat.supportsStore) {
    params.store = false;
  }
  if (options?.maxTokens) {
    if (compat.maxTokensField === "max_tokens") {
      params.max_tokens = options.maxTokens;
    } else {
      params.max_completion_tokens = options.maxTokens;
    }
  }
  if (options?.temperature !== void 0) {
    params.temperature = options.temperature;
  }
  if (transcriptTools.requestTools.length > 0) {
    params.tools = convertTools2(transcriptTools.requestTools, compat);
    if (compat.zaiToolStream) {
      params.tool_stream = true;
    }
  } else if (hasToolHistory(context.messages)) {
    params.tools = [];
  }
  if (cacheControl) {
    applyAnthropicCacheControl(messages, params.tools, cacheControl);
  }
  if (options?.toolChoice) {
    params.tool_choice = options.toolChoice;
  }
  if (compat.vllmPriority !== void 0) {
    params.priority = compat.vllmPriority;
  }
  const thinkingTokenBudgetField = resolveThinkingTokenBudgetField(compat);
  const thinkingBudget = resolveClampedThinkingBudget(model, options, params);
  if (compat.thinkingFormat === "zai" && model.reasoning) {
    const zaiParams = params;
    zaiParams.thinking = options?.reasoningEffort ? { type: "enabled", clear_thinking: false } : { type: "disabled" };
    if (options?.reasoningEffort && compat.supportsReasoningEffort) {
      const mappedEffort = model.thinkingLevelMap?.[options.reasoningEffort];
      const effort = mappedEffort === void 0 ? options.reasoningEffort : mappedEffort;
      if (typeof effort === "string") {
        zaiParams.reasoning_effort = effort;
      }
    }
  } else if (compat.thinkingFormat === "qwen" && model.reasoning) {
    params.enable_thinking = !!options?.reasoningEffort;
    if (options?.reasoningEffort && compat.supportsReasoningEffort) {
      const effort = model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort;
      if (typeof effort === "string") {
        params.reasoning_effort = effort;
      }
    }
  } else if (compat.thinkingFormat === "qwen-chat-template" && model.reasoning) {
    params.chat_template_kwargs = {
      enable_thinking: !!options?.reasoningEffort,
      preserve_thinking: true
    };
  } else if (compat.thinkingFormat === "chat-template" && model.reasoning) {
    const chatTemplateKwargs = buildChatTemplateValues(model, options, compat.chatTemplateKwargs, thinkingBudget);
    if (chatTemplateKwargs) {
      params.chat_template_kwargs = chatTemplateKwargs;
    }
  } else if (compat.thinkingFormat === "baseten" && model.reasoning) {
    const basetenParams = params;
    const chatTemplateArgs = buildChatTemplateValues(model, options, compat.chatTemplateArgs, thinkingBudget);
    if (chatTemplateArgs) {
      basetenParams.chat_template_args = chatTemplateArgs;
    }
    if (compat.supportsReasoningEffort) {
      const requestedEffort = options?.reasoningEffort;
      const mappedEffort = requestedEffort ? model.thinkingLevelMap?.[requestedEffort] : model.thinkingLevelMap?.off;
      const effort = mappedEffort === void 0 ? requestedEffort : mappedEffort;
      if (typeof effort === "string") {
        basetenParams.reasoning_effort = effort;
      }
    }
  } else if (compat.thinkingFormat === "deepseek" && model.reasoning) {
    if (options?.reasoningEffort) {
      params.thinking = { type: "enabled" };
    } else if (model.thinkingLevelMap?.off !== null) {
      params.thinking = { type: "disabled" };
    }
    if (options?.reasoningEffort && compat.supportsReasoningEffort) {
      params.reasoning_effort = model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort;
    }
  } else if (compat.thinkingFormat === "openrouter" && model.reasoning) {
    const openRouterParams = params;
    if (options?.reasoningEffort) {
      openRouterParams.reasoning = {
        effort: model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort
      };
    } else if (model.thinkingLevelMap?.off !== null) {
      openRouterParams.reasoning = { effort: model.thinkingLevelMap?.off ?? "none" };
    }
  } else if (compat.thinkingFormat === "ant-ling" && model.reasoning && options?.reasoningEffort) {
    const effort = model.thinkingLevelMap?.[options.reasoningEffort];
    if (typeof effort === "string") {
      params.reasoning = { effort };
    }
  } else if (compat.thinkingFormat === "together" && model.reasoning) {
    const togetherParams = params;
    togetherParams.reasoning = { enabled: !!options?.reasoningEffort };
    if (options?.reasoningEffort && compat.supportsReasoningEffort) {
      togetherParams.reasoning_effort = model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort;
    }
  } else if (compat.thinkingFormat === "string-thinking" && model.reasoning) {
    const stringThinkingParams = params;
    if (options?.reasoningEffort) {
      stringThinkingParams.thinking = model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort;
    } else if (model.thinkingLevelMap?.off !== null) {
      stringThinkingParams.thinking = model.thinkingLevelMap?.off ?? "none";
    }
  } else if (options?.reasoningEffort && model.reasoning && compat.supportsReasoningEffort) {
    params.reasoning_effort = model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort;
  } else if (!options?.reasoningEffort && model.reasoning && compat.supportsReasoningEffort) {
    const offValue = model.thinkingLevelMap?.off;
    if (typeof offValue === "string") {
      params.reasoning_effort = offValue;
    }
  }
  if (thinkingTokenBudgetField && thinkingBudget !== void 0) {
    Object.assign(params, { [thinkingTokenBudgetField]: thinkingBudget });
  }
  if (model.compat?.openRouterRouting) {
    params.provider = model.compat.openRouterRouting;
  }
  if (model.compat?.vercelGatewayRouting) {
    const routing = model.compat.vercelGatewayRouting;
    if (routing.only || routing.order) {
      const gatewayOptions = {};
      if (routing.only)
        gatewayOptions.only = routing.only;
      if (routing.order)
        gatewayOptions.order = routing.order;
      params.providerOptions = { gateway: gatewayOptions };
    }
  }
  const samplingParams = resolveSamplingParams(model, options?.reasoningEffort ?? "off", options?.samplingParams);
  if (samplingParams) {
    Object.assign(params, samplingParams);
  }
  return params;
}
function resolveThinkingTokenBudgetField(compat) {
  if (compat.thinkingTokenBudgetField)
    return compat.thinkingTokenBudgetField;
  if (compat.supportsThinkingTokenBudget)
    return "thinking_token_budget";
  return void 0;
}
function resolveClampedThinkingBudget(model, options, params) {
  if (!options?.reasoningEffort || !model.reasoning)
    return void 0;
  const ceiling = params.max_tokens ?? params.max_completion_tokens ?? model.maxTokens;
  const budget = clampThinkingBudgetToAnswerRoom(thinkingBudgetForLevel(options.reasoningEffort, options.thinkingBudgets), ceiling);
  return budget > 0 ? budget : void 0;
}
function buildChatTemplateValues(model, options, values, thinkingBudget) {
  const resolvedValues = {};
  for (const [key, value] of Object.entries(values)) {
    const resolved = resolveChatTemplateKwargValue(model, options, value, thinkingBudget);
    if (resolved !== void 0) {
      resolvedValues[key] = resolved;
    }
  }
  return Object.keys(resolvedValues).length > 0 ? resolvedValues : void 0;
}
function resolveChatTemplateKwargValue(model, options, value, thinkingBudget) {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const reasoningEffort = options?.reasoningEffort;
  if (!reasoningEffort && value.omitWhenOff) {
    return void 0;
  }
  if (value.$var === "thinking.enabled") {
    return !!reasoningEffort;
  }
  if (value.$var === "thinking.budget") {
    return thinkingBudget;
  }
  const mappedValue = reasoningEffort ? model.thinkingLevelMap?.[reasoningEffort] : model.thinkingLevelMap?.off;
  return mappedValue === void 0 ? reasoningEffort : typeof mappedValue === "string" ? mappedValue : void 0;
}
function getCompatCacheControl(compat, cacheRetention) {
  if (compat.cacheControlFormat !== "anthropic" || cacheRetention === "none") {
    return void 0;
  }
  const ttl = cacheRetention === "long" && compat.supportsLongCacheRetention ? "1h" : void 0;
  return { type: "ephemeral", ...ttl ? { ttl } : {} };
}
function applyAnthropicCacheControl(messages, tools, cacheControl) {
  addCacheControlToSystemPrompt(messages, cacheControl);
  addCacheControlToLastTool(tools, cacheControl);
  addCacheControlToLastConversationMessage(messages, cacheControl);
}
function addCacheControlToSystemPrompt(messages, cacheControl) {
  for (const message of messages) {
    if (message.role === "system" || message.role === "developer") {
      addCacheControlToInstructionMessage(message, cacheControl);
      return;
    }
  }
}
function addCacheControlToLastConversationMessage(messages, cacheControl) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "user" || message.role === "assistant" || message.role === "tool") {
      if (addCacheControlToMessage(message, cacheControl)) {
        return;
      }
    }
  }
}
function addCacheControlToLastTool(tools, cacheControl) {
  if (!tools || tools.length === 0) {
    return;
  }
  const lastTool = tools[tools.length - 1];
  lastTool.cache_control = cacheControl;
}
function addCacheControlToInstructionMessage(message, cacheControl) {
  return addCacheControlToTextContent(message, cacheControl);
}
function addCacheControlToMessage(message, cacheControl) {
  if (message.role === "user" || message.role === "assistant" || message.role === "tool") {
    return addCacheControlToTextContent(message, cacheControl);
  }
  return false;
}
function addCacheControlToTextContent(message, cacheControl) {
  const content = message.content;
  if (typeof content === "string") {
    if (content.length === 0) {
      return false;
    }
    message.content = [
      {
        type: "text",
        text: content,
        cache_control: cacheControl
      }
    ];
    return true;
  }
  if (!Array.isArray(content)) {
    return false;
  }
  for (let i = content.length - 1; i >= 0; i--) {
    const part = content[i];
    if (part?.type === "text") {
      const textPart = part;
      textPart.cache_control = cacheControl;
      return true;
    }
  }
  return false;
}
function convertMessages2(model, context, compat, options) {
  const normalizedContext = resolveTranscript(context, compat.supportsMidConvoSystemMessages);
  const params = [];
  const normalizeToolCallId2 = (id) => {
    if (id.includes("|")) {
      const separatorIndex = id.indexOf("|");
      const callId = id.slice(0, separatorIndex).replace(/[^a-zA-Z0-9_-]/g, "_");
      const itemId = id.slice(separatorIndex + 1).replace(/[^a-zA-Z0-9_-]/g, "_");
      const combinedId = itemId.length > 0 ? `${callId}_${itemId}` : callId;
      if (combinedId.length <= 40) {
        return combinedId;
      }
      const hash = shortHash(id).slice(0, 8);
      const prefix = callId.slice(0, Math.max(1, 40 - hash.length - 1));
      return `${prefix}_${hash}`;
    }
    if (model.provider === "openai")
      return id.length > 40 ? id.slice(0, 40) : id;
    return id;
  };
  const transformedMessages = transformMessages(normalizedContext.messages, model, (id) => normalizeToolCallId2(id));
  const transcriptTools = resolveTranscriptTools(normalizedContext.messages, compat.supportsMidConvoSystemMessages === true && compat.supportsMidConvoToolAdditions === true);
  const instructionRole = model.reasoning && compat.supportsDeveloperRole ? "developer" : "system";
  let lastRole = null;
  for (let i = 0; i < transformedMessages.length; i++) {
    const msg = transformedMessages[i];
    if (compat.requiresAssistantAfterToolResult && lastRole === "toolResult" && msg.role === "user") {
      params.push({
        role: "assistant",
        content: "I have processed the tool results."
      });
    }
    if (msg.role === "system") {
      const addedTools = i > 0 && transcriptTools.anchorsAdditions ? msg.toolsAdded ?? [] : [];
      if (addedTools.length > 0) {
        const kimiToolMessage = {
          role: "system",
          tools: convertTools2(addedTools, compat)
        };
        params.push(kimiToolMessage);
      }
      const text = i === 0 ? getSystemMessageText(msg) : renderSystemMessageUpdate(msg);
      if (text.length > 0) {
        params.push({ role: instructionRole, content: sanitizeSurrogates(text) });
      }
    } else if (msg.role === "user") {
      if (typeof msg.content === "string") {
        params.push({
          role: "user",
          content: sanitizeSurrogates(msg.content)
        });
      } else {
        const content = msg.content.filter((item) => item.type !== "text" || item.text.length > 0).map((item) => {
          if (item.type === "text") {
            return {
              type: "text",
              text: sanitizeSurrogates(item.text)
            };
          } else {
            return {
              type: "image_url",
              image_url: {
                url: `data:${item.mimeType};base64,${item.data}`
              }
            };
          }
        });
        if (content.length === 0)
          continue;
        params.push({
          role: "user",
          content
        });
      }
    } else if (msg.role === "assistant") {
      const assistantMsg = {
        role: "assistant",
        content: compat.requiresAssistantAfterToolResult ? "" : null
      };
      const assistantTextParts = msg.content.filter(isTextContentBlock).filter((block) => block.text.trim().length > 0).map((block) => ({
        type: "text",
        text: sanitizeSurrogates(block.text)
      }));
      const assistantText = assistantTextParts.map((part) => part.text).join("");
      const thinkingBlocks = msg.content.filter(isThinkingContentBlock);
      const toolCalls = msg.content.filter(isToolCallBlock);
      const signedReasoningDetails = thinkingBlocks.map((block) => parseOpenAIReasoningDetails(block.thinkingSignature)).find((details) => details !== void 0);
      const legacyReasoningDetails = toolCalls.map((toolCall) => parseLegacyEncryptedReasoningDetail(toolCall.thoughtSignature)).filter((detail) => detail !== void 0);
      const preservedReasoningDetails = signedReasoningDetails ?? (legacyReasoningDetails.length > 0 ? legacyReasoningDetails : void 0);
      const nonEmptyThinkingBlocks = thinkingBlocks.filter((block) => block.thinking.trim().length > 0);
      if (nonEmptyThinkingBlocks.length > 0) {
        if (compat.requiresThinkingAsText) {
          const thinkingText = nonEmptyThinkingBlocks.map((block) => sanitizeSurrogates(block.thinking)).join("\n\n");
          assistantMsg.content = [{ type: "text", text: thinkingText }, ...assistantTextParts];
        } else {
          if (assistantText.length > 0) {
            assistantMsg.content = assistantText;
          }
          if (!preservedReasoningDetails) {
            let signature = nonEmptyThinkingBlocks[0].thinkingSignature;
            if (model.provider === "opencode-go" && signature === "reasoning") {
              signature = "reasoning_content";
            }
            if (signature && isOpenAICompletionsReasoningField(signature)) {
              assistantMsg[signature] = nonEmptyThinkingBlocks.map((block) => block.thinking).join("\n");
            }
          }
        }
      } else if (assistantText.length > 0) {
        assistantMsg.content = assistantText;
      }
      if (toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls.map((tc) => {
          const customInputProperty = options?.grammarToolInputProperties?.get(tc.name);
          if (customInputProperty !== void 0) {
            return {
              id: tc.id,
              type: "custom",
              custom: {
                name: tc.name,
                input: sanitizeSurrogates(getGrammarToolInput(tc.name, tc.arguments, customInputProperty))
              }
            };
          }
          return {
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          };
        });
      }
      if (preservedReasoningDetails) {
        assistantMsg.reasoning_details = preservedReasoningDetails;
      }
      if (compat.requiresReasoningContentOnAssistantMessages && model.reasoning && assistantMsg.reasoning_content === void 0) {
        assistantMsg.reasoning_content = "";
      }
      const content = assistantMsg.content;
      const hasContent = content !== null && content !== void 0 && (typeof content === "string" ? content.length > 0 : content.length > 0);
      if (!hasContent && !assistantMsg.tool_calls) {
        continue;
      }
      params.push(assistantMsg);
    } else if (msg.role === "toolResult") {
      const imageBlocks = [];
      let j = i;
      for (; j < transformedMessages.length && transformedMessages[j].role === "toolResult"; j++) {
        const toolMsg = transformedMessages[j];
        const textResult = toolMsg.content.filter(isTextContentBlock).map((block) => block.text).join("\n");
        const hasImages = toolMsg.content.some((c) => c.type === "image");
        const hasText = textResult.length > 0;
        const toolResultText2 = hasText ? textResult : hasImages ? "(see attached image)" : "(no tool output)";
        const toolResultMsg = {
          role: "tool",
          content: sanitizeSurrogates(toolResultText2),
          tool_call_id: toolMsg.toolCallId
        };
        if (compat.requiresToolResultName && toolMsg.toolName) {
          toolResultMsg.name = toolMsg.toolName;
        }
        params.push(toolResultMsg);
        if (hasImages && model.input.includes("image")) {
          for (const block of toolMsg.content) {
            if (isImageContentBlock(block)) {
              imageBlocks.push({
                type: "image_url",
                image_url: {
                  url: `data:${block.mimeType};base64,${block.data}`
                }
              });
            }
          }
        }
      }
      i = j - 1;
      if (imageBlocks.length > 0) {
        if (compat.requiresAssistantAfterToolResult) {
          params.push({
            role: "assistant",
            content: "I have processed the tool results."
          });
        }
        params.push({
          role: "user",
          content: [
            {
              type: "text",
              text: "Attached image(s) from tool result:"
            },
            ...imageBlocks
          ]
        });
        lastRole = "user";
      } else {
        lastRole = "toolResult";
      }
      continue;
    }
    lastRole = msg.role;
  }
  return params;
}
function convertTools2(tools, compat) {
  return tools.map((tool) => {
    const grammar = resolveGrammarConstrainedSampling(tool, compat.supportsOpenAIGrammarTools);
    if (grammar) {
      return {
        type: "custom",
        custom: {
          name: tool.name,
          description: tool.description,
          format: {
            type: "grammar",
            grammar: {
              syntax: grammar.format,
              definition: grammar.definition
            }
          }
        }
      };
    }
    const strict = resolveJsonSchemaStrictSampling(tool, compat.supportsStrictMode !== false);
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: getJsonSchemaToolParameters(tool, strict),
        // Only include strict if provider supports it. Some reject unknown fields.
        ...compat.supportsStrictMode !== false && { strict: strict ?? false }
      }
    };
  });
}
function parseChunkUsage(rawUsage, model) {
  const promptTokens = rawUsage.prompt_tokens || 0;
  const cacheReadTokens = rawUsage.prompt_tokens_details?.cached_tokens ?? rawUsage.prompt_cache_hit_tokens ?? rawUsage.cached_tokens ?? 0;
  const cacheWriteTokens = rawUsage.prompt_tokens_details?.cache_write_tokens || 0;
  const input = Math.max(0, promptTokens - cacheReadTokens - cacheWriteTokens);
  const outputTokens = rawUsage.completion_tokens || 0;
  const usage = {
    input,
    output: outputTokens,
    cacheRead: cacheReadTokens,
    cacheWrite: cacheWriteTokens,
    reasoning: rawUsage.completion_tokens_details?.reasoning_tokens || 0,
    totalTokens: input + outputTokens + cacheReadTokens + cacheWriteTokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
  };
  calculateCost(model, usage);
  return usage;
}
function mapStopReason3(reason) {
  if (reason === null)
    return { stopReason: "stop" };
  switch (reason) {
    case "stop":
    case "end":
      return { stopReason: "stop" };
    case "length":
      return { stopReason: "length" };
    case "function_call":
    case "tool_calls":
      return { stopReason: "toolUse" };
    case "content_filter":
      return { stopReason: "error", errorMessage: "Provider finish_reason: content_filter" };
    case "network_error":
      return { stopReason: "error", errorMessage: "Provider finish_reason: network_error" };
    default:
      return {
        stopReason: "error",
        errorMessage: `Provider finish_reason: ${reason}`
      };
  }
}
function detectCompat(model) {
  const provider = model.provider;
  const baseUrl = model.baseUrl;
  const isZai = provider === "zai" || provider === "zai-coding-cn" || baseUrl.includes("api.z.ai") || baseUrl.includes("open.bigmodel.cn");
  const isTogether = provider === "together" || baseUrl.includes("api.together.ai") || baseUrl.includes("api.together.xyz");
  const isMoonshot = provider === "moonshotai" || provider === "moonshotai-cn" || baseUrl.includes("api.moonshot.");
  const isOpenRouter = provider === "openrouter" || baseUrl.includes("openrouter.ai");
  const isCloudflareWorkersAI = provider === "cloudflare-workers-ai" || baseUrl.includes("api.cloudflare.com");
  const isCloudflareAiGateway = provider === "cloudflare-ai-gateway" || baseUrl.includes("gateway.ai.cloudflare.com");
  const isNvidia = provider === "nvidia" || baseUrl.includes("integrate.api.nvidia.com");
  const isAntLing = provider === "ant-ling" || baseUrl.includes("api.ant-ling.com");
  const isCerebras = provider === "cerebras" || baseUrl.includes("cerebras.ai");
  const isDeepSeek = provider === "deepseek" || baseUrl.toLowerCase().includes("deepseek.com");
  const isNonStandard = isNvidia || isCerebras || provider === "xai" || baseUrl.includes("api.x.ai") || isTogether || baseUrl.includes("chutes.ai") || isDeepSeek || isZai || isMoonshot || provider === "opencode" || baseUrl.includes("opencode.ai") || isCloudflareWorkersAI || isCloudflareAiGateway || isAntLing;
  const useMaxTokens = baseUrl.includes("chutes.ai") || isDeepSeek || isMoonshot || isCloudflareAiGateway || isTogether || isNvidia || isAntLing || isZai;
  const isGrok = provider === "xai" || baseUrl.includes("api.x.ai");
  const isOpenRouterDeveloperRoleModel = isOpenRouter && (model.id.startsWith("anthropic/") || model.id.startsWith("openai/"));
  const cacheControlFormat = provider === "openrouter" && model.id.startsWith("anthropic/") ? "anthropic" : void 0;
  return {
    supportsStore: !isNonStandard,
    supportsDeveloperRole: isOpenRouterDeveloperRoleModel || !isNonStandard && !isOpenRouter,
    supportsReasoningEffort: !isGrok && !isZai && !isMoonshot && !isTogether && !isCloudflareAiGateway && !isNvidia && !isAntLing,
    supportsUsageInStreaming: true,
    supportsFinishReason: true,
    maxTokensField: useMaxTokens ? "max_tokens" : "max_completion_tokens",
    requiresToolResultName: false,
    requiresAssistantAfterToolResult: false,
    requiresThinkingAsText: false,
    requiresReasoningContentOnAssistantMessages: isDeepSeek,
    thinkingFormat: isDeepSeek ? "deepseek" : isZai ? "zai" : isTogether ? "together" : isAntLing ? "ant-ling" : isOpenRouter ? "openrouter" : "openai",
    openRouterRouting: {},
    vercelGatewayRouting: {},
    chatTemplateKwargs: {},
    chatTemplateArgs: {},
    zaiToolStream: false,
    supportsThinkingTokenBudget: false,
    thinkingTokenBudgetField: void 0,
    // OpenAI compatibility alone does not imply strict JSON-schema tool support.
    supportsStrictMode: false,
    supportsOpenAIGrammarTools: false,
    supportsMidConvoSystemMessages: false,
    supportsMidConvoToolAdditions: false,
    cacheControlFormat,
    sendSessionAffinityHeaders: isOpenRouter,
    sessionAffinityFormat: isOpenRouter ? "openrouter" : "openai",
    supportsLongCacheRetention: !(isTogether || isCloudflareWorkersAI || isCloudflareAiGateway || isNvidia || isAntLing)
  };
}
function getCompat(model) {
  const detected = detectCompat(model);
  if (!model.compat)
    return detected;
  return {
    supportsStore: model.compat.supportsStore ?? detected.supportsStore,
    supportsDeveloperRole: model.compat.supportsDeveloperRole ?? detected.supportsDeveloperRole,
    supportsReasoningEffort: model.compat.supportsReasoningEffort ?? detected.supportsReasoningEffort,
    supportsUsageInStreaming: model.compat.supportsUsageInStreaming ?? detected.supportsUsageInStreaming,
    supportsFinishReason: model.compat.supportsFinishReason ?? detected.supportsFinishReason,
    maxTokensField: model.compat.maxTokensField ?? detected.maxTokensField,
    requiresToolResultName: model.compat.requiresToolResultName ?? detected.requiresToolResultName,
    requiresAssistantAfterToolResult: model.compat.requiresAssistantAfterToolResult ?? detected.requiresAssistantAfterToolResult,
    requiresThinkingAsText: model.compat.requiresThinkingAsText ?? detected.requiresThinkingAsText,
    requiresReasoningContentOnAssistantMessages: model.compat.requiresReasoningContentOnAssistantMessages ?? detected.requiresReasoningContentOnAssistantMessages,
    thinkingFormat: model.compat.thinkingFormat ?? detected.thinkingFormat,
    openRouterRouting: model.compat.openRouterRouting ?? {},
    vercelGatewayRouting: model.compat.vercelGatewayRouting ?? detected.vercelGatewayRouting,
    chatTemplateKwargs: model.compat.chatTemplateKwargs ?? detected.chatTemplateKwargs,
    chatTemplateArgs: model.compat.chatTemplateArgs ?? detected.chatTemplateArgs,
    zaiToolStream: model.compat.zaiToolStream ?? detected.zaiToolStream,
    supportsThinkingTokenBudget: model.compat.supportsThinkingTokenBudget ?? detected.supportsThinkingTokenBudget,
    thinkingTokenBudgetField: model.compat.thinkingTokenBudgetField ?? detected.thinkingTokenBudgetField,
    supportsStrictMode: model.compat.supportsStrictMode ?? detected.supportsStrictMode,
    supportsOpenAIGrammarTools: model.compat.supportsOpenAIGrammarTools ?? detected.supportsOpenAIGrammarTools,
    supportsMidConvoSystemMessages: model.compat.supportsMidConvoSystemMessages ?? detected.supportsMidConvoSystemMessages,
    supportsMidConvoToolAdditions: model.compat.supportsMidConvoToolAdditions ?? detected.supportsMidConvoToolAdditions,
    cacheControlFormat: model.compat.cacheControlFormat ?? detected.cacheControlFormat,
    sendSessionAffinityHeaders: model.compat.sendSessionAffinityHeaders ?? detected.sendSessionAffinityHeaders,
    sessionAffinityFormat: model.compat.sessionAffinityFormat ?? detected.sessionAffinityFormat,
    supportsLongCacheRetention: model.compat.supportsLongCacheRetention ?? detected.supportsLongCacheRetention,
    vllmPriority: model.compat.vllmPriority
  };
}

// node_modules/opencode-go-pi-ai/dist/api/openai-responses.js
var openai_responses_exports = {};
__export(openai_responses_exports, {
  stream: () => stream3,
  streamSimple: () => streamSimple3
});
import OpenAI2 from "openai";

// node_modules/opencode-go-pi-ai/dist/api/openai-responses-shared.js
function encodeTextSignatureV1(id, phase) {
  const payload = { v: 1, id };
  if (phase)
    payload.phase = phase;
  return JSON.stringify(payload);
}
function parseTextSignature(signature) {
  if (!signature)
    return void 0;
  if (signature.startsWith("{")) {
    try {
      const parsed = JSON.parse(signature);
      if (parsed.v === 1 && typeof parsed.id === "string") {
        if (parsed.phase === "commentary" || parsed.phase === "final_answer") {
          return { id: parsed.id, phase: parsed.phase };
        }
        return { id: parsed.id };
      }
    } catch {
    }
  }
  return { id: signature };
}
function convertToolResultOutput(model, content) {
  const textResult = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  const images = content.filter((c) => c.type === "image");
  const hasText = textResult.length > 0;
  if (images.length === 0 || !model.input.includes("image")) {
    return sanitizeSurrogates(hasText ? textResult : images.length > 0 ? "(see attached image)" : "(no tool output)");
  }
  const output = [];
  if (hasText) {
    output.push({ type: "input_text", text: sanitizeSurrogates(textResult) });
  }
  for (const image of images) {
    output.push({
      type: "input_image",
      detail: "auto",
      image_url: `data:${image.mimeType};base64,${image.data}`
    });
  }
  return output;
}
function convertResponsesMessages(model, context, allowedToolCallProviders, options) {
  const normalizedContext = resolveTranscript(context, options?.supportsMidConvoSystemMessages);
  const messages = [];
  const normalizeIdPart = (part) => {
    const sanitized = part.replace(/[^a-zA-Z0-9_-]/g, "_");
    const normalized = sanitized.length > 64 ? sanitized.slice(0, 64) : sanitized;
    return normalized.replace(/_+$/, "");
  };
  const buildForeignResponsesItemId = (itemId) => {
    const normalized = `fc_${shortHash(itemId)}`;
    return normalized.length > 64 ? normalized.slice(0, 64) : normalized;
  };
  const normalizeToolCallId2 = (id, _targetModel, source) => {
    if (!allowedToolCallProviders.has(model.provider))
      return normalizeIdPart(id);
    if (!id.includes("|"))
      return normalizeIdPart(id);
    const [callId, itemId] = id.split("|");
    const normalizedCallId = normalizeIdPart(callId);
    const isForeignToolCall = source.provider !== model.provider || source.api !== model.api;
    let normalizedItemId = isForeignToolCall ? buildForeignResponsesItemId(itemId) : normalizeIdPart(itemId);
    if (!normalizedItemId.startsWith("fc_")) {
      normalizedItemId = normalizeIdPart(`fc_${normalizedItemId}`);
    }
    return `${normalizedCallId}|${normalizedItemId}`;
  };
  const transformedMessages = transformMessages(normalizedContext.messages, model, normalizeToolCallId2);
  const transcriptTools = resolveTranscriptTools(normalizedContext.messages, (options?.supportsAdditionalTools ?? false) || (options?.supportsToolSearch ?? false));
  const appendSystemToolAdditions = (message, seed) => {
    const tools = transcriptTools.anchorsAdditions ? message.toolsAdded ?? [] : [];
    if (tools.length === 0)
      return;
    if (options?.supportsAdditionalTools) {
      messages.push({
        type: "additional_tools",
        role: "developer",
        tools: convertResponsesTools(tools, options.toolOptions)
      });
      return;
    }
    if (!options?.supportsToolSearch)
      return;
    const names = tools.map((tool) => tool.name);
    const callId = `pi_tool_load_${shortHash(`${seed}:${names.join(",")}`)}`;
    messages.push({
      type: "tool_search_call",
      call_id: callId,
      execution: "client",
      status: "completed",
      arguments: { query: names.join(" "), limit: names.length }
    });
    messages.push({
      type: "tool_search_output",
      call_id: callId,
      execution: "client",
      status: "completed",
      tools: convertResponsesTools(tools, { ...options.toolOptions, toolSearchResult: true })
    });
  };
  const includeInitialSystemMessage = options?.includeSystemPrompt ?? true;
  const compat = model.compat;
  const instructionRole = model.reasoning && compat?.supportsDeveloperRole !== false ? "developer" : "system";
  let msgIndex = 0;
  let sourceIndex = 0;
  for (const msg of transformedMessages) {
    const isLeadingSystemMessage = sourceIndex++ === 0 && msg.role === "system";
    if (msg.role === "system") {
      if (!isLeadingSystemMessage)
        appendSystemToolAdditions(msg, `system:${msgIndex}`);
      if (!isLeadingSystemMessage || includeInitialSystemMessage) {
        const text = isLeadingSystemMessage ? getSystemMessageText(msg) : renderSystemMessageUpdate(msg);
        if (text.length > 0) {
          messages.push({ role: instructionRole, content: sanitizeSurrogates(text) });
        }
      }
    } else if (msg.role === "user") {
      if (typeof msg.content === "string") {
        messages.push({
          role: "user",
          content: [{ type: "input_text", text: sanitizeSurrogates(msg.content) }]
        });
      } else {
        const content = msg.content.map((item) => {
          if (item.type === "text") {
            return {
              type: "input_text",
              text: sanitizeSurrogates(item.text)
            };
          }
          return {
            type: "input_image",
            detail: "auto",
            image_url: `data:${item.mimeType};base64,${item.data}`
          };
        });
        if (content.length === 0)
          continue;
        messages.push({
          role: "user",
          content
        });
      }
    } else if (msg.role === "assistant") {
      const output = [];
      const assistantMsg = msg;
      const isSameProviderAndApi = assistantMsg.provider === model.provider && assistantMsg.api === model.api;
      const isSameModel = isSameProviderAndApi && assistantMsg.model === model.id;
      const isDifferentModel = isSameProviderAndApi && assistantMsg.model !== model.id;
      let textBlockIndex = 0;
      for (const block of msg.content) {
        if (block.type === "thinking") {
          if (block.thinkingSignature) {
            const reasoningItem = JSON.parse(block.thinkingSignature);
            output.push(reasoningItem);
          }
        } else if (block.type === "text") {
          const textBlock = block;
          const parsedSignature = parseTextSignature(textBlock.textSignature);
          const fallbackMessageId = textBlockIndex === 0 ? `msg_pi_${msgIndex}` : `msg_pi_${msgIndex}_${textBlockIndex}`;
          textBlockIndex++;
          let msgId = parsedSignature?.id;
          if (!msgId) {
            msgId = fallbackMessageId;
          } else if (msgId.length > 64) {
            msgId = `msg_${shortHash(msgId)}`;
          }
          output.push({
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: sanitizeSurrogates(textBlock.text), annotations: [] }],
            status: "completed",
            id: msgId,
            phase: parsedSignature?.phase
          });
        } else if (block.type === "toolCall") {
          const toolCall = block;
          const [callId, itemIdRaw] = toolCall.id.split("|");
          const customInputProperty = options?.grammarToolInputProperties?.get(toolCall.name);
          let itemId = itemIdRaw;
          const itemIdPrefix = customInputProperty === void 0 ? "fc_" : "ctc_";
          if (isDifferentModel || !itemId?.startsWith(itemIdPrefix)) {
            itemId = void 0;
          }
          if (customInputProperty !== void 0) {
            output.push({
              type: "custom_tool_call",
              id: itemId,
              call_id: callId,
              name: toolCall.name,
              input: sanitizeSurrogates(getGrammarToolInput(toolCall.name, toolCall.arguments, customInputProperty)),
              ...isSameModel && toolCall.namespace !== void 0 ? { namespace: toolCall.namespace } : {}
            });
          } else {
            output.push({
              type: "function_call",
              id: itemId,
              call_id: callId,
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
              ...isSameModel && toolCall.namespace !== void 0 ? { namespace: toolCall.namespace } : {}
            });
          }
        }
      }
      if (output.length === 0)
        continue;
      messages.push(...output);
    } else if (msg.role === "toolResult") {
      const [callId] = msg.toolCallId.split("|");
      const output = convertToolResultOutput(model, msg.content);
      if (options?.grammarToolInputProperties?.has(msg.toolName)) {
        messages.push({
          type: "custom_tool_call_output",
          call_id: callId,
          output
        });
      } else {
        messages.push({
          type: "function_call_output",
          call_id: callId,
          output
        });
      }
    }
    if (!isLeadingSystemMessage)
      msgIndex++;
  }
  return messages;
}
function convertResponsesTools(tools, options) {
  const defaultStrict = options?.strict === void 0 ? false : options.strict;
  const supportsStrictMode = options?.supportsStrictMode ?? true;
  const supportsOpenAIGrammarTools = options?.supportsOpenAIGrammarTools ?? false;
  return tools.map((tool) => {
    const grammar = resolveGrammarConstrainedSampling(tool, supportsOpenAIGrammarTools);
    if (grammar) {
      return {
        type: "custom",
        name: tool.name,
        description: tool.description,
        format: {
          type: "grammar",
          syntax: grammar.format,
          definition: grammar.definition
        },
        ...options?.toolSearchResult ? { defer_loading: true } : {}
      };
    }
    const constrainedStrict = resolveJsonSchemaStrictSampling(tool, supportsStrictMode);
    const strict = constrainedStrict ?? defaultStrict;
    const functionTool = {
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: getJsonSchemaToolParameters(tool, strict === true),
      ...options?.toolSearchResult ? { defer_loading: true } : {}
    };
    if (supportsStrictMode) {
      functionTool.strict = strict;
    }
    return functionTool;
  });
}
function getCustomToolCallInput(block) {
  const property = block.customInput?.property;
  if (property === void 0)
    return "";
  const value = block.arguments[property];
  return typeof value === "string" ? value : "";
}
function appendCustomToolCallInput(block, nextInput, close) {
  const customInput = block.customInput;
  if (!customInput)
    return void 0;
  const delta = appendGrammarToolInputJsonDelta(customInput.jsonBuffer, customInput.property, nextInput, close);
  block.arguments = { [customInput.property]: nextInput };
  return delta;
}
async function processResponsesStream(openaiStream, output, stream4, model, options) {
  let sawTerminalResponseEvent = false;
  const outputSlots = /* @__PURE__ */ new Map();
  const reasoningBlocksById = /* @__PURE__ */ new Map();
  const applyMessagePhaseStopReason = (item) => {
    if (item.type === "message" && item.phase === "final_answer") {
      output.stopReason = "stop";
    }
  };
  const getSlot = (outputIndex, type) => {
    const slot = outputSlots.get(outputIndex);
    return slot?.type === type ? slot : void 0;
  };
  const pushToolCallDelta = (slot, delta) => {
    if (delta === void 0)
      return;
    stream4.push({
      type: "toolcall_delta",
      contentIndex: slot.contentIndex,
      delta,
      partial: output
    });
  };
  const createSlot = (outputIndex, item) => {
    if (item.type === "reasoning") {
      const block = { type: "thinking", thinking: "" };
      output.content.push(block);
      const slot = {
        type: "thinking",
        block,
        contentIndex: output.content.length - 1
      };
      outputSlots.set(outputIndex, slot);
      stream4.push({ type: "thinking_start", contentIndex: slot.contentIndex, partial: output });
      return slot;
    }
    if (item.type === "message") {
      applyMessagePhaseStopReason(item);
      const block = { type: "text", text: "" };
      output.content.push(block);
      const slot = { type: "text", block, contentIndex: output.content.length - 1 };
      outputSlots.set(outputIndex, slot);
      stream4.push({ type: "text_start", contentIndex: slot.contentIndex, partial: output });
      return slot;
    }
    if (item.type === "function_call") {
      const block = {
        type: "toolCall",
        id: `${item.call_id}|${item.id}`,
        name: item.name,
        arguments: {},
        ...item.namespace !== void 0 ? { namespace: item.namespace } : {},
        partialJson: item.arguments || ""
      };
      output.content.push(block);
      const slot = {
        type: "toolCall",
        block,
        contentIndex: output.content.length - 1
      };
      outputSlots.set(outputIndex, slot);
      stream4.push({ type: "toolcall_start", contentIndex: slot.contentIndex, partial: output });
      return slot;
    }
    if (item.type === "custom_tool_call") {
      const inputProperty = options?.grammarToolInputProperties?.get(item.name) ?? "input";
      const input = item.input || "";
      const block = {
        type: "toolCall",
        id: `${item.call_id}|${item.id}`,
        name: item.name,
        arguments: { [inputProperty]: input },
        ...item.namespace !== void 0 ? { namespace: item.namespace } : {},
        customInput: {
          property: inputProperty,
          jsonBuffer: { input: "", started: false, closed: false }
        }
      };
      output.content.push(block);
      const slot = {
        type: "toolCall",
        block,
        contentIndex: output.content.length - 1
      };
      outputSlots.set(outputIndex, slot);
      stream4.push({ type: "toolcall_start", contentIndex: slot.contentIndex, partial: output });
      return slot;
    }
    return void 0;
  };
  const getOrCreateSlot = (outputIndex, item) => {
    return outputSlots.get(outputIndex) ?? createSlot(outputIndex, item);
  };
  const backfillReasoningSignatures = (responseOutput) => {
    for (const item of responseOutput) {
      if (item.type !== "reasoning" || !item.encrypted_content)
        continue;
      const block = reasoningBlocksById.get(item.id);
      if (!block?.thinkingSignature)
        continue;
      const storedItem = JSON.parse(block.thinkingSignature);
      if (storedItem.encrypted_content)
        continue;
      block.thinkingSignature = JSON.stringify({
        ...storedItem,
        encrypted_content: item.encrypted_content
      });
    }
  };
  const finalizeResponse = (response) => {
    sawTerminalResponseEvent = true;
    backfillReasoningSignatures(response.output ?? []);
    if (response?.id) {
      output.responseId = response.id;
    }
    if (response?.usage) {
      const inputDetails = response.usage.input_tokens_details;
      const cachedTokens = inputDetails?.cached_tokens || 0;
      const cacheWriteTokens = inputDetails?.cache_write_tokens || 0;
      output.usage = {
        // OpenAI includes cached and cache-write tokens in input_tokens, so subtract both.
        input: Math.max(0, (response.usage.input_tokens || 0) - cachedTokens - cacheWriteTokens),
        output: response.usage.output_tokens || 0,
        cacheRead: cachedTokens,
        cacheWrite: cacheWriteTokens,
        reasoning: response.usage.output_tokens_details?.reasoning_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      };
    }
    calculateCost(model, output.usage);
    if (options?.applyServiceTierPricing) {
      const serviceTier = options.resolveServiceTier ? options.resolveServiceTier(response?.service_tier, options.serviceTier) : response?.service_tier ?? options.serviceTier;
      options.applyServiceTierPricing(output.usage, serviceTier);
    }
    const status = response?.status;
    const incompleteDetails = response?.incomplete_details;
    const incompleteReason = typeof incompleteDetails?.reason === "string" ? incompleteDetails.reason : void 0;
    output.rawStopReason = incompleteReason ? `${status}.${incompleteReason}` : status;
    const mappedStop = mapStopReason4(status, incompleteReason);
    output.stopReason = mappedStop.stopReason;
    if (mappedStop.errorMessage === void 0)
      delete output.errorMessage;
    else
      output.errorMessage = mappedStop.errorMessage;
    if (output.content.some((b) => b.type === "toolCall") && output.stopReason === "stop") {
      output.stopReason = "toolUse";
    }
  };
  for await (const event of openaiStream) {
    await options?.onProviderStreamEvent?.(event, model);
    if (event.type === "response.created") {
      output.responseId = event.response.id;
    } else if (event.type === "response.output_item.added") {
      createSlot(event.output_index, event.item);
    } else if (event.type === "response.reasoning_summary_text.delta") {
      const slot = getSlot(event.output_index, "thinking");
      if (!slot)
        continue;
      slot.block.thinking += event.delta;
      stream4.push({
        type: "thinking_delta",
        contentIndex: slot.contentIndex,
        delta: event.delta,
        partial: output
      });
    } else if (event.type === "response.reasoning_summary_part.done") {
      const slot = getSlot(event.output_index, "thinking");
      if (!slot)
        continue;
      slot.block.thinking += "\n\n";
      stream4.push({
        type: "thinking_delta",
        contentIndex: slot.contentIndex,
        delta: "\n\n",
        partial: output
      });
    } else if (event.type === "response.reasoning_text.delta") {
      const slot = getSlot(event.output_index, "thinking");
      if (!slot)
        continue;
      slot.block.thinking += event.delta;
      stream4.push({
        type: "thinking_delta",
        contentIndex: slot.contentIndex,
        delta: event.delta,
        partial: output
      });
    } else if (event.type === "response.output_text.delta") {
      const slot = getSlot(event.output_index, "text");
      if (!slot)
        continue;
      slot.block.text += event.delta;
      stream4.push({
        type: "text_delta",
        contentIndex: slot.contentIndex,
        delta: event.delta,
        partial: output
      });
    } else if (event.type === "response.refusal.delta") {
      const slot = getSlot(event.output_index, "text");
      if (!slot)
        continue;
      slot.block.text += event.delta;
      stream4.push({
        type: "text_delta",
        contentIndex: slot.contentIndex,
        delta: event.delta,
        partial: output
      });
    } else if (event.type === "response.function_call_arguments.delta") {
      const slot = getSlot(event.output_index, "toolCall");
      if (!slot || slot.block.partialJson === void 0)
        continue;
      slot.block.partialJson += event.delta;
      slot.block.arguments = parseStreamingJson(slot.block.partialJson);
      pushToolCallDelta(slot, event.delta);
    } else if (event.type === "response.function_call_arguments.done") {
      const slot = getSlot(event.output_index, "toolCall");
      if (!slot || slot.block.partialJson === void 0)
        continue;
      const previousPartialJson = slot.block.partialJson;
      slot.block.partialJson = event.arguments;
      slot.block.arguments = parseStreamingJson(slot.block.partialJson);
      if (event.arguments.startsWith(previousPartialJson)) {
        const delta = event.arguments.slice(previousPartialJson.length);
        if (delta.length > 0)
          pushToolCallDelta(slot, delta);
      }
    } else if (event.type === "response.custom_tool_call_input.delta") {
      const slot = getSlot(event.output_index, "toolCall");
      if (!slot || !slot.block.customInput)
        continue;
      pushToolCallDelta(slot, appendCustomToolCallInput(slot.block, getCustomToolCallInput(slot.block) + event.delta, false));
    } else if (event.type === "response.custom_tool_call_input.done") {
      const slot = getSlot(event.output_index, "toolCall");
      if (!slot || !slot.block.customInput)
        continue;
      pushToolCallDelta(slot, appendCustomToolCallInput(slot.block, event.input, true));
    } else if (event.type === "response.output_item.done") {
      const item = event.item;
      applyMessagePhaseStopReason(item);
      const slot = getOrCreateSlot(event.output_index, item);
      if (item.type === "reasoning" && slot?.type === "thinking") {
        const summaryText = item.summary?.map((s) => s.text).join("\n\n") || "";
        const contentText2 = item.content?.map((c) => c.text).join("\n\n") || "";
        slot.block.thinking = summaryText || contentText2 || slot.block.thinking;
        slot.block.thinkingSignature = JSON.stringify(item);
        reasoningBlocksById.set(item.id, slot.block);
        stream4.push({
          type: "thinking_end",
          contentIndex: slot.contentIndex,
          content: slot.block.thinking,
          partial: output
        });
        outputSlots.delete(event.output_index);
      } else if (item.type === "message" && slot?.type === "text") {
        slot.block.text = item.content?.map((c) => c.type === "output_text" ? c.text : c.refusal).join("") || "";
        slot.block.textSignature = encodeTextSignatureV1(item.id, item.phase ?? void 0);
        stream4.push({
          type: "text_end",
          contentIndex: slot.contentIndex,
          content: slot.block.text,
          partial: output
        });
        outputSlots.delete(event.output_index);
      } else if (item.type === "function_call" && slot?.type === "toolCall" && slot.block.partialJson !== void 0) {
        slot.block.arguments = parseStreamingJson(item.arguments || slot.block.partialJson || "{}");
        if (item.namespace !== void 0)
          slot.block.namespace = item.namespace;
        delete slot.block.partialJson;
        stream4.push({
          type: "toolcall_end",
          contentIndex: slot.contentIndex,
          toolCall: slot.block,
          partial: output
        });
        outputSlots.delete(event.output_index);
      } else if (item.type === "custom_tool_call" && slot?.type === "toolCall" && slot.block.customInput) {
        pushToolCallDelta(slot, appendCustomToolCallInput(slot.block, item.input ?? getCustomToolCallInput(slot.block), true));
        if (item.namespace !== void 0)
          slot.block.namespace = item.namespace;
        delete slot.block.customInput;
        stream4.push({
          type: "toolcall_end",
          contentIndex: slot.contentIndex,
          toolCall: slot.block,
          partial: output
        });
        outputSlots.delete(event.output_index);
      }
    } else if (event.type === "response.completed" || event.type === "response.incomplete") {
      finalizeResponse(event.response);
    } else if (event.type === "error") {
      throw new Error(`Error Code ${event.code}: ${event.message}` || "Unknown error");
    } else if (event.type === "response.failed") {
      sawTerminalResponseEvent = true;
      output.rawStopReason = event.response?.status;
      const error = event.response?.error;
      const details = event.response?.incomplete_details;
      const msg = error ? `${error.code || "unknown"}: ${error.message || "no message"}` : details?.reason ? `incomplete: ${details.reason}` : "Unknown error (no error details in response)";
      throw new Error(msg);
    }
  }
  if (!sawTerminalResponseEvent) {
    throw new Error("OpenAI Responses stream ended before a terminal response event");
  }
  if (output.stopReason === "toolUse") {
    for (const block of output.content) {
      if (block.type !== "toolCall")
        continue;
      const toolCall = block;
      if (toolCall.partialJson !== void 0 || toolCall.customInput !== void 0) {
        throw new Error(`OpenAI Responses stream completed with an unfinished tool call: ${toolCall.name} (${toolCall.id})`);
      }
    }
  }
}
function mapStopReason4(status, incompleteReason) {
  if (!status)
    return { stopReason: "stop" };
  switch (status) {
    case "completed":
      return { stopReason: "stop" };
    case "incomplete":
      if (incompleteReason === "max_output_tokens") {
        return { stopReason: "length" };
      }
      return {
        stopReason: "error",
        errorMessage: incompleteReason ? `Response incomplete: ${incompleteReason}` : "Response incomplete without a provider reason"
      };
    case "failed":
    case "cancelled":
      return { stopReason: "error" };
    // These two are wonky ...
    case "in_progress":
    case "queued":
      return { stopReason: "stop" };
    default: {
      const _exhaustive = status;
      throw new Error(`Unhandled stop reason: ${_exhaustive}`);
    }
  }
}

// node_modules/opencode-go-pi-ai/dist/api/openai-responses.js
var OPENAI_TOOL_CALL_PROVIDERS = /* @__PURE__ */ new Set(["openai", "openai-codex", "opencode"]);
var OPENAI_RESPONSES_MIN_OUTPUT_TOKENS = 16;
var CHATGPT_USAGE_URL = "https://chatgpt.com/settings/usage";
function isChatGPTSignIn(model, apiKey) {
  return model.provider === "openai" && model.baseUrl === "https://api.openai.com/v1" && apiKey !== void 0 && !apiKey.startsWith("sk-");
}
function hasHeader3(headers, name2) {
  if (!headers)
    return false;
  const expected = name2.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === expected && value !== null && value.trim().length > 0)
      return true;
  }
  return false;
}
function getClientApiKey2(provider, apiKey, headers) {
  if (apiKey)
    return apiKey;
  if (hasHeader3(headers, "authorization") || hasHeader3(headers, "cf-aig-authorization"))
    return "unused";
  throw new Error(`No API key for provider: ${provider}`);
}
function detectSessionAffinityFormat(model) {
  return model.provider === "openrouter" || model.baseUrl.includes("openrouter.ai") ? "openrouter" : "openai";
}
function resolveCacheRetention3(cacheRetention, env) {
  if (cacheRetention) {
    return cacheRetention;
  }
  if (getProviderEnvValue("PI_CACHE_RETENTION", env) === "long") {
    return "long";
  }
  return "short";
}
function getCompat2(model) {
  return {
    supportsDeveloperRole: model.compat?.supportsDeveloperRole ?? true,
    supportsMidConvoSystemMessages: model.compat?.supportsMidConvoSystemMessages ?? false,
    sessionAffinityFormat: model.compat?.sessionAffinityFormat ?? detectSessionAffinityFormat(model),
    supportsLongCacheRetention: model.compat?.supportsLongCacheRetention ?? true,
    supportsStrictMode: model.compat?.supportsStrictMode ?? false,
    supportsOpenAIGrammarTools: model.compat?.supportsOpenAIGrammarTools ?? false,
    supportsAdditionalTools: model.compat?.supportsAdditionalTools ?? false,
    supportsToolSearch: model.compat?.supportsToolSearch ?? false,
    supportsExplicitPromptCacheMode: model.compat?.supportsExplicitPromptCacheMode ?? false,
    supportsMaxOutputTokens: model.compat?.supportsMaxOutputTokens ?? true
  };
}
function getPromptCacheRetention(compat, cacheRetention) {
  return cacheRetention === "long" && compat.supportsLongCacheRetention && !compat.supportsExplicitPromptCacheMode ? "24h" : void 0;
}
function getPromptCacheOptions(compat, cacheRetention) {
  if (!compat.supportsExplicitPromptCacheMode)
    return void 0;
  if (cacheRetention === "none")
    return { mode: "explicit" };
  if (cacheRetention === "long" && compat.supportsLongCacheRetention)
    return { ttl: "30m" };
  return void 0;
}
var stream3 = (model, context, options) => {
  const stream4 = new AssistantMessageEventStream();
  const normalizedContext = resolveTranscript(context, getCompat2(model).supportsMidConvoSystemMessages);
  (async () => {
    const output = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      },
      stopReason: "pending",
      timestamp: Date.now()
    };
    try {
      const apiKey = getClientApiKey2(model.provider, options?.apiKey, options?.headers);
      const cacheRetention = resolveCacheRetention3(options?.cacheRetention, options?.env);
      const cacheSessionId = cacheRetention === "none" ? void 0 : options?.sessionId;
      const compat = getCompat2(model);
      const grammarToolInputProperties = createGrammarToolInputProperties(getDeclaredTools(normalizedContext.messages), compat.supportsOpenAIGrammarTools);
      const client = createClient3(model, normalizedContext, apiKey, options?.headers, options?.fetch, cacheSessionId);
      let params = buildParams3(model, normalizedContext, options, compat, grammarToolInputProperties);
      const nextParams = await options?.onPayload?.(params, model);
      if (nextParams !== void 0) {
        params = nextParams;
      }
      const requestOptions = {
        ...options?.signal ? { signal: options.signal } : {},
        ...options?.timeoutMs !== void 0 ? { timeout: options.timeoutMs } : {},
        maxRetries: 0
      };
      const { data: openaiStream, response } = await retryProviderRequest(() => client.responses.create(params, requestOptions).withResponse(), {
        maxRetries: options?.maxRetries,
        maxRetryDelayMs: options?.maxRetryDelayMs,
        signal: options?.signal
      });
      await options?.onResponse?.({ status: response.status, headers: headersToRecord(response.headers) }, model);
      stream4.push({ type: "start", partial: output });
      await processResponsesStream(openaiStream, output, stream4, model, {
        onProviderStreamEvent: options?.onProviderStreamEvent,
        serviceTier: options?.serviceTier,
        grammarToolInputProperties,
        applyServiceTierPricing: (usage, serviceTier) => applyServiceTierPricing(usage, serviceTier, model)
      });
      if (options?.signal?.aborted) {
        throw new Error("Request was aborted");
      }
      if (output.stopReason === "pending") {
        throw new Error("OpenAI Responses stream ended without a stop reason");
      }
      if (output.stopReason === "aborted" || output.stopReason === "error") {
        throw new Error(output.errorMessage || "An unknown error occurred");
      }
      stream4.push({ type: "done", reason: output.stopReason, message: output });
      stream4.end();
    } catch (error) {
      for (const block of output.content) {
        delete block.index;
        delete block.partialJson;
        delete block.customInput;
      }
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      const errorMessage = formatProviderError(normalizeProviderError(error), `${model.provider === "openai" ? "OpenAI" : model.provider} API error`);
      output.errorMessage = errorMessage.includes("subscription_sharing_usage_limit_exceeded") ? `${errorMessage}
Check your ChatGPT usage: ${CHATGPT_USAGE_URL}` : errorMessage;
      stream4.push({ type: "error", reason: output.stopReason, error: output });
      stream4.end();
    }
  })();
  return stream4;
};
var streamSimple3 = (model, context, options) => {
  getClientApiKey2(model.provider, options?.apiKey, options?.headers);
  const base = {
    ...buildBaseOptions(model, context, options, options?.apiKey),
    toolChoice: options?.toolChoice
  };
  const clampedReasoning = options?.reasoning ? clampThinkingLevel(model, options.reasoning) : void 0;
  const reasoningEffort = clampedReasoning === "off" ? void 0 : clampedReasoning;
  return stream3(model, context, {
    ...base,
    reasoningEffort
  });
};
function createClient3(model, context, apiKey, optionsHeaders, fetch, sessionId) {
  const compat = getCompat2(model);
  const headers = { "User-Agent": getPiUserAgent(), ...model.headers };
  if (model.provider === "github-copilot") {
    const hasImages = hasCopilotVisionInput(context.messages);
    const copilotHeaders = buildCopilotDynamicHeaders({
      messages: context.messages,
      hasImages
    });
    Object.assign(headers, copilotHeaders);
  }
  if (sessionId) {
    if (compat.sessionAffinityFormat === "openrouter") {
      headers["x-session-id"] = sessionId;
    } else {
      if (compat.sessionAffinityFormat === "openai") {
        headers.session_id = sessionId;
      }
      headers["x-client-request-id"] = sessionId;
    }
  }
  if (optionsHeaders) {
    Object.assign(headers, optionsHeaders);
  }
  return new OpenAI2({
    apiKey,
    baseURL: model.baseUrl,
    dangerouslyAllowBrowser: true,
    fetch,
    defaultHeaders: headers
  });
}
function buildParams3(model, context, options, compat = getCompat2(model), grammarToolInputProperties = createGrammarToolInputProperties(getDeclaredTools(context.messages), compat.supportsOpenAIGrammarTools)) {
  const transcriptTools = resolveTranscriptTools(context.messages, compat.supportsAdditionalTools || compat.supportsToolSearch);
  const messages = convertResponsesMessages(model, context, OPENAI_TOOL_CALL_PROVIDERS, {
    grammarToolInputProperties,
    supportsMidConvoSystemMessages: compat.supportsMidConvoSystemMessages,
    supportsAdditionalTools: compat.supportsAdditionalTools,
    supportsToolSearch: compat.supportsToolSearch,
    toolOptions: {
      supportsStrictMode: compat.supportsStrictMode,
      supportsOpenAIGrammarTools: compat.supportsOpenAIGrammarTools
    }
  });
  const cacheRetention = resolveCacheRetention3(options?.cacheRetention, options?.env);
  const omitUnsupportedFields = isChatGPTSignIn(model, options?.apiKey);
  const params = {
    model: model.id,
    input: messages,
    stream: true,
    prompt_cache_key: cacheRetention === "none" ? void 0 : clampOpenAIPromptCacheKey(options?.sessionId),
    prompt_cache_retention: omitUnsupportedFields ? void 0 : getPromptCacheRetention(compat, cacheRetention),
    prompt_cache_options: omitUnsupportedFields ? void 0 : getPromptCacheOptions(compat, cacheRetention),
    store: false
  };
  if (options?.maxTokens && compat.supportsMaxOutputTokens && !omitUnsupportedFields) {
    params.max_output_tokens = Math.max(options.maxTokens, OPENAI_RESPONSES_MIN_OUTPUT_TOKENS);
  }
  if (options?.temperature !== void 0 && !omitUnsupportedFields) {
    params.temperature = options?.temperature;
  }
  if (options?.serviceTier !== void 0) {
    params.service_tier = options.serviceTier;
  }
  if (transcriptTools.requestTools.length > 0) {
    params.tools = convertResponsesTools(transcriptTools.requestTools, {
      supportsStrictMode: compat.supportsStrictMode,
      supportsOpenAIGrammarTools: compat.supportsOpenAIGrammarTools
    });
  }
  if (options?.toolChoice !== void 0) {
    params.tool_choice = options.toolChoice;
  }
  const reasoningEffort = options?.reasoningEffort ?? (options?.reasoningSummary ? "medium" : void 0);
  if (model.reasoning) {
    if (reasoningEffort) {
      const effort = options?.reasoningEffort ? model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort : reasoningEffort;
      params.reasoning = {
        effort,
        summary: options?.reasoningSummary || "auto"
      };
      params.include = ["reasoning.encrypted_content"];
    } else if (model.provider !== "github-copilot" && model.thinkingLevelMap?.off !== null) {
      params.reasoning = {
        effort: model.thinkingLevelMap?.off ?? "none"
      };
    }
    if (model.provider === "xai")
      params.include = ["reasoning.encrypted_content"];
  }
  const samplingParams = resolveSamplingParams(model, reasoningEffort ?? "off", options?.samplingParams);
  if (samplingParams) {
    Object.assign(params, samplingParams);
  }
  return params;
}
function getServiceTierCostMultiplier(model, serviceTier) {
  switch (serviceTier) {
    case "flex":
      return 0.5;
    case "priority":
    case "fast":
      return model.id === "gpt-5.5" ? 2.5 : 2;
    default:
      return 1;
  }
}
function applyServiceTierPricing(usage, serviceTier, model) {
  const multiplier = getServiceTierCostMultiplier(model, serviceTier);
  if (multiplier === 1)
    return;
  usage.cost.input *= multiplier;
  usage.cost.output *= multiplier;
  usage.cost.cacheRead *= multiplier;
  usage.cost.cacheWrite *= multiplier;
  usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
}

// src/catalog.ts
import { attributionHeaders, LlmError as LlmError7 } from "@deepseek-ai/dsh-llm";

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
    if (row.reasoningBudget !== null && typeof row.reasoningBudget === "object") {
      const { min, max } = row.reasoningBudget;
      if (typeof min === "number" && Number.isSafeInteger(min) && min > 0 && typeof max === "number" && Number.isSafeInteger(max) && max >= min) model.reasoningBudget = { min, max };
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
    if (source.warning !== void 0 && typeof source.warning !== "string") throw new Error("Invalid OpenCode Go catalog source warning");
    return {
      ...source.updatedAt === void 0 ? {} : { updatedAt: source.updatedAt },
      ...source.error === void 0 ? {} : { error: source.error },
      ...source.warning === void 0 ? {} : { warning: source.warning }
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
import { LlmError as LlmError6 } from "@deepseek-ai/dsh-llm";
var THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var NATIVE_THINKING_FLAGS = /* @__PURE__ */ new Set(["deepseek", "zai", "qwen", "qwen-chat-template"]);
var BUDGET_PRESETS = { minimal: 1024, low: 2048, medium: 8192, high: 16384 };
function supportsThinkingBudget(api2, compat) {
  const options = compat;
  return api2 === "anthropic-messages" ? options?.forceAdaptiveThinking !== true : api2 === "openai-completions" && Boolean(options?.thinkingTokenBudgetField || options?.supportsThinkingTokenBudget);
}
function reasoningBudgetRange(model) {
  if (!model.reasoning || !model.reasoningBudget) return void 0;
  return { min: model.reasoningBudget.min, max: Math.min(model.reasoningBudget.max, model.maxTokens - 1024) };
}
function unsupportedThinkingLevels() {
  return Object.fromEntries(THINKING_LEVELS.map((level) => [level, null]));
}
function withGatewayReasoning(model) {
  if (model.reasoning && model.reasoningControl === void 0 && model.api === "anthropic-messages" && supportsThinkingBudget(model.api, model.compat)) {
    return { ...model, reasoningControl: "budget", reasoningBudget: { min: 1024, max: Number.MAX_SAFE_INTEGER } };
  }
  if (model.id !== "mimo-v2.6-flash" || model.api !== "openai-completions" || !model.reasoning) return model;
  return { ...model, reasoningControl: "effort", thinkingLevelMap: {
    ...unsupportedThinkingLevels(),
    off: "none",
    low: "low",
    medium: "medium",
    high: "high"
  } };
}
function reasoningChoices(model) {
  if (!model.reasoning) return [];
  const range = reasoningBudgetRange(model);
  const presets = model.reasoningBudgetPresets ?? [];
  const valid = (tokens) => range !== void 0 && Number.isSafeInteger(tokens) && tokens >= range.min && tokens <= range.max;
  if (range && presets.some((tokens) => !valid(tokens))) {
    throw new LlmError6(`opencode-go model "${model.id}" thinking budgets must be integers between ${range.min} and ${range.max} tokens`, "INVALID_REQUEST");
  }
  if (range && model.reasoningControl === "budget") {
    const choices = Object.entries(BUDGET_PRESETS).filter(([, tokens]) => valid(tokens)).map(([id, tokens]) => ({ id, tokens }));
    const existing = new Set(choices.map((choice) => choice.tokens));
    for (const tokens of new Set(presets.length > 0 || choices.length > 0 ? presets : [range.min])) {
      if (valid(tokens) && !existing.has(tokens)) {
        choices.push({ id: `budget:${tokens}`, tokens });
        existing.add(tokens);
      }
    }
    const enabled = choices.sort((a, b) => a.tokens - b.tokens).map(({ id, tokens }) => ({ id, name: `${tokens.toLocaleString("en-US")} tokens` }));
    return model.thinkingLevelMap?.off === null ? enabled : [{ id: "off", name: "Off" }, ...enabled];
  }
  return [...getSupportedThinkingLevels(model).map((id) => ({
    id,
    // Keep the durable high ID of the old switch, but describe its actual meaning.
    name: model.reasoningControl === "toggle" && id === "high" ? "On" : `${id.charAt(0).toUpperCase()}${id.slice(1)}`
  })), ...range === void 0 ? [] : [...new Set(presets)].sort((a, b) => a - b).map((tokens) => ({ id: `budget:${tokens}`, name: `${tokens.toLocaleString("en-US")} tokens` }))];
}
function reasoningIntent(model, level) {
  if (level === void 0) return { kind: "default" };
  if (level === "off") return { kind: "off" };
  const range = reasoningBudgetRange(model);
  if (range && (model.reasoningControl === "budget" || level.startsWith("budget:"))) return {
    kind: "budget",
    min: range.min,
    tokens: level.startsWith("budget:") ? Number(level.slice(7)) : BUDGET_PRESETS[level]
  };
  return model.reasoningControl === "toggle" ? { kind: "on" } : { kind: "effort", level };
}
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function withoutKeys(value, keys) {
  const source = object(value);
  if (!source) return value;
  const result = { ...source };
  for (const key of keys) delete result[key];
  return Object.keys(result).length > 0 ? result : void 0;
}
function reasoningRequest(intent) {
  return {
    ...intent.kind === "effort" ? { reasoning: intent.level } : intent.kind === "budget" ? { reasoning: "high", thinkingBudgets: { high: intent.tokens } } : intent.kind === "on" ? { reasoning: "high" } : {},
    onPayload(payload) {
      if (intent.kind === "off" || intent.kind === "effort") return payload;
      const source = object(payload);
      if (!source) return payload;
      const body = { ...source };
      if (intent.kind === "budget") {
        const thinking = object(body.thinking);
        const actual = thinking?.budget_tokens ?? body.thinking_token_budget ?? body.thinking_budget ?? body.thinking_budget_tokens;
        const ceiling = body.max_tokens ?? body.max_completion_tokens;
        if (typeof actual !== "number" || actual < intent.min || typeof ceiling === "number" && actual > ceiling - 1024) {
          throw new LlmError6(`opencode-go thinking budget requires at least ${intent.min} tokens of available thinking space`, "INVALID_REQUEST");
        }
      }
      delete body.reasoning_effort;
      body.reasoning = withoutKeys(body.reasoning, ["effort"]);
      body.output_config = withoutKeys(body.output_config, ["effort"]);
      if (intent.kind === "default") {
        delete body.thinking;
        delete body.enable_thinking;
        body.chat_template_kwargs = withoutKeys(body.chat_template_kwargs, ["enable_thinking"]);
      }
      for (const key of ["reasoning", "output_config", "chat_template_kwargs"]) {
        if (body[key] === void 0) delete body[key];
      }
      return body;
    }
  };
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
function reasoningControls(id, api2, metadata, known) {
  if (!Array.isArray(metadata.reasoning_options) && known?.id === id && known.thinkingLevelMap !== void 0) {
    return {
      thinkingLevelMap: known.thinkingLevelMap,
      reasoningControl: known.reasoningControl ?? "effort",
      ...known.reasoningBudget === void 0 ? {} : { reasoningBudget: known.reasoningBudget }
    };
  }
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
  const budget = options.find((option) => option.type === "budget_tokens");
  const tokenBudget = budget !== void 0 && supportsThinkingBudget(api2, known?.compat);
  if (native && efforts.length === 0 && (toggle || budget)) map.high = "high";
  const enabled = Object.entries(map).some(([level, wire]) => level !== "off" && typeof wire === "string");
  if (native && (toggle || enabled && known?.reasoning) && known?.thinkingLevelMap?.off !== null && map.off === null) {
    delete map.off;
  } else if (enabled && known?.id === id && known.reasoning && typeof known.thinkingLevelMap?.off === "string") {
    map.off ??= known.thinkingLevelMap.off;
  }
  const positive = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  return {
    thinkingLevelMap: map,
    reasoningControl: tokenBudget && efforts.length === 0 ? "budget" : native && efforts.length === 0 && (toggle || budget) ? "toggle" : "effort",
    ...tokenBudget ? { reasoningBudget: {
      min: Math.max(api2 === "anthropic-messages" ? 1024 : 1, positive(budget.min) ? budget.min : 1),
      max: positive(budget.max) ? budget.max : Number.MAX_SAFE_INTEGER
    } } : {}
  };
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
        ...reasoningControls(id, api2, metadata, known),
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
  return new Promise((resolve3, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new LlmError7("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason }));
    };
    pending.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve3(value);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
function builtinModels(baseURL) {
  return new Map(Object.values(OPENCODE_GO_MODELS).map((model) => [model.id, withGatewayReasoning({
    ...model,
    provider: SDK_PROVIDER_ID,
    baseUrl: modelBaseURL(model.api, baseURL)
  })]));
}
function readLiveModelIds(body, onInvalidRows) {
  const data = body?.data;
  if (!Array.isArray(data)) throw new Error('the model listing has no "data" array');
  const ids = [];
  const invalidRows = [];
  let invalidCount = 0;
  for (const [index, entry] of data.entries()) {
    const id = entry?.id;
    if (typeof id === "string" && id.trim().length > 0) ids.push(id);
    else {
      invalidCount++;
      if (invalidRows.length < 8) invalidRows.push(index + 1);
    }
  }
  if (data.length > 0 && ids.length === 0) throw new Error("the nonempty model listing has no valid model ids");
  if (invalidCount > 0) onInvalidRows?.(`Model listing ignored ${invalidCount} of ${data.length} rows with invalid model ids (rows ${invalidRows.join(", ")}${invalidCount > invalidRows.length ? ", \u2026" : ""}); the listing may be incomplete`);
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
    throw new LlmError7(`could not ${action} ${endpoint}: ${detail}`, "DISCOVERY_FAILED", { cause: error });
  }
  const { response, body } = result;
  if (!response.ok) throw new LlmError7(`${endpoint} answered HTTP ${response.status}`, "DISCOVERY_FAILED");
  try {
    let warning;
    const ids = readLiveModelIds(body, (value) => {
      warning = value;
    });
    return { ids, ...warning === void 0 ? {} : { warning } };
  } catch (error) {
    throw new LlmError7(`${endpoint} returned an invalid model listing: ${error instanceof Error ? error.message : "invalid data"}`, "DISCOVERY_FAILED", { cause: error });
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
      "anthropic-messages": anthropic_messages_exports,
      "openai-completions": openai_completions_exports,
      "openai-responses": openai_responses_exports
    }
  });
}
var OpencodeGoCatalog = class {
  constructor(baseURL, refreshMs, onFallback, onOmitted, onRefresh = () => {
  }, fetcher, onWarning) {
    this.baseURL = baseURL;
    this.refreshMs = refreshMs;
    this.onFallback = onFallback;
    this.onOmitted = onOmitted;
    this.onRefresh = onRefresh;
    this.fetcher = fetcher;
    this.onWarning = onWarning;
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
      return Promise.reject(new LlmError7("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason }));
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
    const listing = settled(fetchLiveModelIds(this.baseURL, this.fetcher).then((result) => ({ ...result, updatedAtMs: Date.now() })));
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
      if (snapshot.listingWarning && snapshot.live) {
        try {
          this.onWarning?.(snapshot.listingWarning);
        } catch {
        }
      }
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
    if (!response.ok) throw new LlmError7(`${MODEL_METADATA_URL} answered HTTP ${response.status}`, "DISCOVERY_FAILED");
    let metadata;
    try {
      metadata = readModelMetadata(body, this.baseURL, builtin);
    } catch (error) {
      throw new LlmError7(`${MODEL_METADATA_URL} returned invalid model configuration`, "DISCOVERY_FAILED", { cause: error });
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
        listingFailure: listing.reason,
        ...this.served?.listingWarning === void 0 ? {} : { listingWarning: this.served.listingWarning }
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
      ...metadataStatus,
      ...listing.value.warning === void 0 ? {} : { listingWarning: listing.value.warning }
    };
  }
  /** New or previously unconfigured ids get a fresh lookup even during the runtime TTL. */
  async forModel(id, signal) {
    const cached = this.served;
    if (signal?.aborted) throw new LlmError7("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason });
    if (cached?.models.has(id) && cached.listingUpdatedAtMs !== void 0 && cached.metadataUpdatedAtMs !== void 0 && Date.now() < Math.min(cached.listingUpdatedAtMs, cached.metadataUpdatedAtMs) + this.refreshMs + STALE_WHILE_REVALIDATE_MS) {
      void this.snapshot().catch(() => {
      });
      return cached;
    }
    let snapshot = await this.snapshot(false, signal);
    if (!snapshot.models.has(id) && (snapshot === cached || this.cachedPending !== void 0)) {
      snapshot = await this.snapshot(true, signal);
    }
    if (signal?.aborted) throw new LlmError7("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason });
    if (snapshot.unavailable.has(id)) {
      throw new LlmError7(
        `opencode-go model "${id}" is advertised but cannot be configured: ${snapshot.unavailable.get(id)}; refresh the model list to retry`,
        "MODEL_METADATA_UNAVAILABLE"
      );
    }
    if (!snapshot.models.has(id) && !snapshot.live) throw listingError(snapshot);
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
  const detail = snapshot.listingFailure instanceof LlmError7 ? snapshot.listingFailure.message : "the live model listing is unreachable";
  return new LlmError7(`llm-opencode-go: ${detail}; refresh the model list to retry`, "DISCOVERY_FAILED", { cause: snapshot.listingFailure });
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
    ].map((model) => {
      const configured = snapshot.models.get(model.id);
      const budget = configured && reasoningBudgetRange(configured);
      return { ...model, ...snapshot.details.get(model.id), ...budget === void 0 ? {} : { reasoningBudget: budget } };
    })),
    stale: errors.length > 0,
    ...errors.length === 0 ? {} : { error: errors.join("; ") },
    sources: {
      listing: {
        ...snapshot.listingUpdatedAtMs === void 0 ? {} : { updatedAt: snapshot.listingUpdatedAtMs },
        ...snapshot.live ? {} : { error: listingError(snapshot).message },
        ...snapshot.listingWarning === void 0 ? {} : { warning: snapshot.listingWarning }
      },
      metadata: {
        ...snapshot.metadataUpdatedAtMs === void 0 ? {} : { updatedAt: snapshot.metadataUpdatedAtMs },
        ...metadataError === void 0 ? {} : { error: metadataError }
      }
    }
  };
}
function metadataFailureMessage(error) {
  const detail = error instanceof LlmError7 ? error.message : `${MODEL_METADATA_URL}: ${error instanceof SyntaxError ? "invalid JSON response" : error instanceof RangeError ? `response exceeds the ${MODEL_METADATA_MAX_BYTES} byte limit` : transportFailure(error)}`;
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
var ACCOUNT_REF_PREFIX = "DSH_OPENCODE_GO_ACCOUNT_";
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
var DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS = 6e4;
var DEFAULT_REQUEST_TIMEOUT_MS = 30 * 6e4;
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
  // Internal recovery state uses the same durable profile/section as its accounts.
  // Cross-field ownership and discriminants are checked before any side effect.
  accountOperations: z.array(z.any()).max(MAX_ACCOUNTS).default([]).hidden(),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  proxyURL: z.string().default(""),
  refreshMinutes: z.number().step(1).min(1).max(7 * 24 * 60).default(DEFAULT_REFRESH_MINUTES),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  requestPreparationTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS),
  requestTimeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(DEFAULT_REQUEST_TIMEOUT_MS),
  maxImages: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
  // The image defaults are the generic pi-ai adapter's: one normalized
  // request image fits the budget, and fifteen of them fit the payload cap.
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
  // null explicitly selects catalog values, overriding even inherited profile limits.
  modelLimits: z.dict(z.union([z.const(null), z.object({
    contextWindow: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)]),
    maxTokens: z.union([z.const(null), z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER)]),
    thinkingBudgets: z.union([z.const(null), z.array(z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).required()).max(16)])
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

// src/gateway-diagnostics.ts
import { createHash, randomUUID as randomUUID2 } from "node:crypto";
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { join as join2, resolve as resolve2 } from "node:path";

// src/gateway-error.ts
import { isQuotaExceededError as isQuotaExceededError2 } from "@deepseek-ai/dsh-llm";
function classifyGatewayError(status, body, fallback) {
  let error;
  try {
    const parsed = JSON.parse(body);
    error = parsed?.error && typeof parsed.error === "object" ? parsed.error : parsed;
  } catch {
  }
  const types = [error?.type, error?.code].filter((value) => typeof value === "string").map((value) => value.replace(/[^a-z0-9]/gi, "").toLowerCase());
  if (types.some((type) => ["modelerror", "modelnotfound", "unknownmodel"].includes(type))) return "UNKNOWN_MODEL";
  if (types.some((type) => [
    "creditserror",
    "monthlylimiterror",
    "userlimiterror",
    "gousagelimiterror",
    "insufficientquota",
    "quotaexceeded"
  ].includes(type))) return "QUOTA";
  if (types.some((type) => ["autherror", "authenticationerror", "invalidapikey", "invalidkey"].includes(type))) return "INVALID_CREDENTIAL";
  if (types.some((type) => ["regionerror", "datapolicyerror", "permissionerror", "permissiondenied"].includes(type))) return "AUTH";
  if (types.some((type) => ["ratelimiterror", "ratelimitexceeded"].includes(type))) return "RATE_LIMIT";
  const message = typeof error?.message === "string" ? error.message : body;
  if ([401, 402, 403, 429].includes(status) && isQuotaExceededError2(message)) return "QUOTA";
  if ((status === 401 || status === 403) && /(?:invalid|incorrect|expired)[ _-]?(?:api[ _-]?)?key|invalid credential/i.test(message)) return "INVALID_CREDENTIAL";
  if (status === 401 || status === 402 || status === 403) return "AUTH";
  if (status === 404) return "UNKNOWN_MODEL";
  if (status === 429) return "RATE_LIMIT";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status >= 500) return "SERVER";
  if (status === 400 || status === 413 || status === 422) {
    return fallback === "CONTEXT_WINDOW_EXCEEDED" ? fallback : "INVALID_REQUEST";
  }
  return fallback;
}

// src/gateway-diagnostics.ts
var MAX_BODY_BYTES = 16 * 1024;
var BODY_READ_TIMEOUT_MS = 1e3;
var RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "server",
  "via",
  "x-request-id",
  "request-id",
  "cf-ray",
  "x-amzn-requestid",
  "x-vercel-id",
  "traceparent",
  "retry-after",
  // Go exposes the upstream route and its log ID on some response paths.
  "x-opencode-log-id",
  "x-opencode-endpoint-id",
  "x-opencode-upstream-model-id",
  "x-zen-model",
  "cf-placement"
];
async function previewBody(response, callerSignal) {
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  let readFailed = false;
  let reader;
  const signal = callerSignal ? AbortSignal.any([callerSignal, AbortSignal.timeout(BODY_READ_TIMEOUT_MS)]) : AbortSignal.timeout(BODY_READ_TIMEOUT_MS);
  const abort = Promise.withResolvers();
  const onAbort = () => {
    abort.reject(signal.reason);
  };
  try {
    signal.throwIfAborted();
    reader = response.clone().body?.getReader();
    if (reader) {
      signal.addEventListener("abort", onAbort, { once: true });
      while (true) {
        const part = await Promise.race([reader.read(), abort.promise]);
        if (part.done) break;
        const remaining = MAX_BODY_BYTES - bytes;
        chunks.push(part.value.slice(0, remaining));
        bytes += Math.min(part.value.byteLength, remaining);
        if (part.value.byteLength > remaining) {
          truncated = true;
          break;
        }
      }
    }
  } catch {
    readFailed = true;
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (reader) void reader.cancel().catch(() => {
    });
  }
  return {
    text: Buffer.concat(chunks, bytes).toString("utf8"),
    bytes,
    truncated,
    ...readFailed ? { readFailed: true } : {}
  };
}
function requestSummary(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : void 0));
  const session = headers.get("x-opencode-session");
  const result = {
    url: `${url.origin}${url.pathname}`,
    method: init?.method ?? (input instanceof Request ? input.method : "GET"),
    sessionHash: session ? createHash("sha256").update(session).digest("hex").slice(0, 16) : void 0,
    userAgent: headers.get("user-agent")?.slice(0, 512)
  };
  if (typeof init?.body === "string") {
    result.bodyBytes = Buffer.byteLength(init.body);
    try {
      const body = JSON.parse(init.body);
      result.messageCount = Array.isArray(body?.messages) ? body.messages.length : void 0;
      result.toolCount = Array.isArray(body?.tools) ? body.tools.length : void 0;
      const maxTokens = body?.max_tokens ?? body?.max_completion_tokens ?? body?.max_output_tokens;
      if (typeof maxTokens === "number") result.maxTokens = maxTokens;
      const effort = body?.reasoning_effort ?? body?.reasoning?.effort;
      if (typeof effort === "string") result.reasoningEffort = effort.slice(0, 128);
      if (typeof body?.thinking?.type === "string") result.thinking = body.thinking.type.slice(0, 128);
    } catch {
    }
  }
  return result;
}
var GatewayDiagnostics = class {
  constructor(options) {
    this.options = options;
    this.secrets = [options.apiKey];
    if (options.proxyURL) {
      const url = new URL(options.proxyURL);
      for (const value of [url.username, url.password]) {
        if (value) this.secrets.push(value, decodeURIComponent(value));
      }
      if (url.username || url.password) {
        this.secrets.push(Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString("base64"));
      }
    }
    this.secrets = [...new Set(this.secrets.flatMap((secret) => [secret, JSON.stringify(secret).slice(1, -1)]))].sort((a, b) => b.length - a.length);
  }
  evidence;
  code;
  secrets;
  redact(text, truncated = false) {
    for (const secret of this.secrets) {
      if (!secret) continue;
      text = text.replaceAll(secret, "[REDACTED]");
      if (truncated) for (let length = Math.min(secret.length - 1, text.length); length > 0; length--) {
        if (text.endsWith(secret.slice(0, length))) {
          text = text.slice(0, -length) + "[REDACTED]";
          break;
        }
      }
    }
    return text;
  }
  fetch = async (input, init) => {
    const response = await (this.options.fetch ?? globalThis.fetch)(input, init);
    const rawRequestId = response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? response.headers.get("x-opencode-log-id");
    const requestId = rawRequestId === null ? void 0 : this.redact(rawRequestId, true).slice(0, 128);
    try {
      this.options.onResponse?.(response.status, requestId);
    } catch {
    }
    if (!response.ok) {
      const headers = {};
      for (const name2 of RESPONSE_HEADERS) {
        const value = response.headers.get(name2);
        if (value !== null) headers[name2] = this.redact(value).slice(0, 512);
      }
      const request = requestSummary(input, init);
      const signal = init?.signal ?? (input instanceof Request ? input.signal : void 0);
      const time = (/* @__PURE__ */ new Date()).toISOString();
      const preview = previewBody(response, signal);
      this.code = preview.then((body) => classifyGatewayError(response.status, body.text, "PI_AI_ERROR"));
      this.evidence = preview.then((body) => ({
        time,
        provider: this.options.provider,
        model: this.options.model,
        ...this.options.callId === void 0 ? {} : { callId: this.options.callId, attempt: this.options.attempt },
        request,
        response: { status: response.status, headers, body: {
          ...body,
          text: this.redact(body.text, body.truncated || body.readFailed)
        } }
      }));
    }
    return response;
  };
  async failureCode(fallback) {
    const code = await this.code;
    return code === void 0 || code === "PI_AI_ERROR" || code === "INVALID_REQUEST" && fallback === "CONTEXT_WINDOW_EXCEEDED" ? fallback : code;
  }
  async failureMessage(original) {
    let message = this.redact(original);
    const evidence = await this.evidence;
    if (!evidence) return `${this.options.provider}/${this.options.model}: ${message}`;
    const { status, body } = evidence.response;
    if (body.bytes > 0 && message.includes("status code (no body)")) {
      message = `${status} ${body.text.slice(0, 1024)}`;
    }
    const presence = body.bytes > 0 ? "nonempty" : body.readFailed ? "unavailable" : "empty";
    message += ` [HTTP ${status}; response body: ${presence}${body.truncated ? ", truncated" : ""}${body.readFailed ? ", incomplete read" : ""}]`;
    if (this.options.directory?.trim()) {
      try {
        const directory = resolve2(this.options.directory);
        await mkdir2(directory, { recursive: true, mode: 448 });
        const file = join2(directory, `http-error-${randomUUID2()}.json`);
        await writeFile2(file, JSON.stringify(evidence, (_key, value) => typeof value === "string" ? this.redact(value) : value, 2) + "\n", { flag: "wx", mode: 384 });
        message += ` [diagnostic file: ${this.redact(file)}]`;
      } catch {
        message += " [diagnostic file could not be written]";
      }
    }
    return `${this.options.provider}/${this.options.model}: ${message}`;
  }
};

// src/call-trace.ts
import { randomUUID as randomUUID3 } from "node:crypto";
var CallTrace = class {
  constructor(model, observer) {
    this.model = model;
    this.observer = observer;
  }
  started = performance.now();
  callId = randomUUID3();
  stages = {};
  attempts = 0;
  outcome = "consumer-stopped";
  code;
  details = [];
  current;
  finished = false;
  startAttempt() {
    this.attempts++;
    this.current = { started: performance.now(), trace: {
      attempt: this.attempts,
      elapsedMs: 0,
      stages: {},
      outcome: "consumer-stopped"
    } };
  }
  response(status, requestId) {
    if (!this.current) return;
    this.current.trace.httpStatus = status;
    if (requestId !== void 0) this.current.trace.requestId = requestId;
  }
  firstOutput() {
    if (this.current && this.current.trace.firstOutputMs === void 0) {
      this.current.trace.firstOutputMs = performance.now() - this.current.started;
    }
  }
  imagePool = (value) => {
    if (!this.current) return;
    const stats = this.current.trace.imagePool ??= { queueWaitMs: 0, maxActive: 0, maxQueued: 0, maxRetainedBytes: 0, rejected: false };
    stats.queueWaitMs += value.queueWaitMs;
    stats.maxActive = Math.max(stats.maxActive, value.active);
    stats.maxQueued = Math.max(stats.maxQueued, value.queued);
    stats.maxRetainedBytes = Math.max(stats.maxRetainedBytes, value.retainedBytes);
    stats.rejected ||= value.rejected === true;
  };
  endAttempt(outcome = "consumer-stopped", code) {
    if (!this.current) return;
    const detail = this.current.trace;
    detail.elapsedMs = performance.now() - this.current.started;
    detail.outcome = outcome;
    if (code !== void 0) detail.code = code;
    if (this.details.length < 32) this.details.push(detail);
    this.current = void 0;
  }
  async measure(stage, work) {
    const started = performance.now();
    const attempt = this.current;
    try {
      return await work();
    } finally {
      const elapsed = performance.now() - started;
      this.stages[stage] = (this.stages[stage] ?? 0) + elapsed;
      if (attempt) attempt.trace.stages[stage] = (attempt.trace.stages[stage] ?? 0) + elapsed;
    }
  }
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.endAttempt();
    try {
      this.observer?.({
        callId: this.callId,
        model: this.model,
        elapsedMs: performance.now() - this.started,
        stages: { ...this.stages },
        attempts: this.attempts,
        attemptDetails: structuredClone(this.details),
        outcome: this.outcome,
        ...this.code ? { code: this.code } : {}
      });
    } catch {
    }
  }
};

// src/adapter.ts
function accountFailureReason(failure) {
  if (failure.code === "QUOTA") return "quota";
  if (failure.code === "MISSING_CREDENTIAL" || failure.code === "INVALID_CREDENTIAL") return "credential";
  return void 0;
}
var REJECTED_KEY_TTL_MS = 5 * 6e4;
function isGatewayKeyRejection(failure) {
  return failure.code === "INVALID_CREDENTIAL";
}
function withModelLimit(model, limits) {
  const limit = limits[model.id];
  if (limit == null) return model;
  return {
    ...model,
    contextWindow: limit.contextWindow ?? model.contextWindow,
    maxTokens: limit.maxTokens ?? model.maxTokens,
    reasoningBudgetPresets: limit.thinkingBudgets ?? void 0
  };
}
function opencodeSessionValue(sessionId) {
  return sessionId !== void 0 && sessionId.length > 0 ? sessionId : randomUUID4();
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
        this.transport.forProxy(config.proxyURL),
        this.options.onCatalogWarning
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
  async callSnapshot(model, signal, captured = { generation: this.options.accountGeneration?.() ?? 0, config: structuredClone(this.options.config()) }) {
    var _stack = [];
    try {
      const { generation, config } = captured;
      const preparation = __using(_stack, deadline(signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, "LLM_PREPARATION_TIMEOUT"));
      let catalog;
      try {
        catalog = await this.catalogOf(config).forModel(model, preparation.signal);
      } catch (error) {
        if (timeoutOf(preparation.signal, "LLM_PREPARATION_TIMEOUT")) throw new LlmError8("opencode-go discovery preparation timeout", "TIMEOUT", { cause: error });
        throw error;
      }
      const resolved = catalog.models.get(model);
      if (resolved === void 0) {
        throw new LlmError8(`opencode-go has no model "${model}"`, "UNKNOWN_MODEL");
      }
      return { generation, config, catalog, model: withModelLimit(resolved, config.modelLimits) };
    } catch (_) {
      var _error = _, _hasError = true;
    } finally {
      __callDispose(_stack, _error, _hasError);
    }
  }
  /** Keep capability resolution and eventual dispatch on the same configuration. */
  async prepareCall(_provider, model, signal) {
    const seq = ++this.callSeq;
    const snapshot = await this.callSnapshot(model, signal);
    return {
      model: this.modelInfo(snapshot.model),
      stream: (options) => this.streamWithSnapshot(options, snapshot, seq)
    };
  }
  /** Describe one model: capacities plus the reasoning levels it actually offers. */
  modelInfo(model) {
    const reasoning = {};
    const choices = reasoningChoices(model);
    if (choices.length > 0) {
      reasoning.reasoning = {
        efforts: choices.map((choice) => ({ ...choice, id: ReasoningEffortId(choice.id) }))
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
    const supported = reasoningChoices(model).map((choice) => choice.id);
    if (supported.some((level) => level === effort)) return effort;
    throw new LlmError8(
      `opencode-go model "${model.id}" does not support reasoning effort "${effort}"`,
      "UNSUPPORTED_REASONING_EFFORT"
    );
  }
  async *stream(options) {
    if (options.stop !== void 0) {
      throw new LlmError8("llm-opencode-go does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
    }
    yield* this.dispatch(options, ++this.callSeq);
  }
  async *streamWithSnapshot(options, snapshot, seq) {
    yield* this.dispatch(options, seq, snapshot);
  }
  async *dispatch(options, seq, prepared) {
    var _stack = [];
    try {
      const captured = prepared ?? { generation: this.options.accountGeneration?.() ?? 0, config: structuredClone(this.options.config()) };
      const trace = new CallTrace(options.model, this.options.onCallTrace);
      const whole = __using(_stack, deadline(options.signal, captured.config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, "LLM_REQUEST_TIMEOUT"));
      try {
        const snapshot = prepared ?? await trace.measure("discovery", () => this.callSnapshot(options.model, whole.signal, captured));
        for await (const chunk of this.streamAccounts({ ...options, signal: whole.signal }, snapshot, seq, trace)) {
          if (chunk.type === "finish") {
            trace.outcome = chunk.reason.kind === "error" ? "failed" : chunk.reason.kind === "aborted" ? "aborted" : "completed";
            if (chunk.reason.kind === "error" || chunk.reason.kind === "aborted") trace.code = chunk.reason.failure?.code;
          }
          yield chunk;
        }
      } catch (error) {
        trace.outcome = "failed";
        if (timeoutOf(whole.signal, "LLM_REQUEST_TIMEOUT")) {
          trace.code = "TIMEOUT";
          throw new LlmError8("opencode-go whole request timeout", "TIMEOUT", { cause: error });
        }
        if (options.signal?.aborted) {
          trace.outcome = "aborted";
          trace.code = "ABORTED";
          yield { type: "finish", reason: { kind: "aborted", failure: { code: "ABORTED", message: "opencode-go request aborted by caller" } } };
          return;
        }
        trace.code = error instanceof LlmError8 ? error.code : "PI_AI_ERROR";
        throw error;
      } finally {
        trace.finish();
      }
    } catch (_) {
      var _error = _, _hasError = true;
    } finally {
      __callDispose(_stack, _error, _hasError);
    }
  }
  async *streamAccounts(options, snapshot, seq, trace) {
    const accounts = accountsOf(snapshot.config);
    if (accounts.length === 0) throw new LlmError8("OpenCode Go has no accounts", "MISSING_CREDENTIAL");
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
      trace.startAttempt();
      let emitted = false;
      let usage;
      let retry = false;
      const announce = () => {
        if (emitted) return;
        const serving = refs[attempt];
        const replaced = failedRef ?? skippedRef ?? preferred;
        const notice = serving === preferred ? void 0 : {
          // The notice names the account the journey left: the first one that
          // failed this request, else the first one skipped for a remembered
          // rejection.
          fromRef: replaced,
          toRef: serving,
          reason: switchReason ?? "credential",
          at: Date.now()
        };
        this.options.onAccountSettled?.({ seq, generation: snapshot.generation, config: snapshot.config, ref: serving, notice });
        this.options.onAccountSwitch?.(notice, snapshot.config, seq);
      };
      try {
        for await (const chunk of this.streamAttempt(options, {
          ...snapshot,
          config: { ...snapshot.config, apiKeyEnv: refs[attempt] }
        }, trace)) {
          if (chunk.type === "usage") {
            usage = chunk;
            continue;
          }
          if (chunk.type === "finish") {
            trace.endAttempt(
              chunk.reason.kind === "error" ? "failed" : chunk.reason.kind === "aborted" ? "aborted" : "completed",
              chunk.reason.kind === "error" || chunk.reason.kind === "aborted" ? chunk.reason.failure?.code : void 0
            );
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
        trace.endAttempt(
          options.signal?.aborted && !(error instanceof LlmError8 && error.code === "TIMEOUT") ? "aborted" : "failed",
          error instanceof LlmError8 ? error.code : "PI_AI_ERROR"
        );
        const reason = error instanceof LlmError8 ? accountFailureReason(error) : void 0;
        if (!reason || emitted || options.signal?.aborted || attempt + 1 >= refs.length) throw error;
        if (error instanceof LlmError8 && isGatewayKeyRejection(error)) this.rememberRejectedKey(refs[attempt], gateway);
        switchReason ??= reason;
        failedRef ??= refs[attempt];
      } finally {
        trace.endAttempt();
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
  async *streamAttempt(options, snapshot, trace) {
    var _stack = [];
    try {
      if (options.stop !== void 0) {
        throw new LlmError8("llm-opencode-go does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
      }
      const { config, catalog, model } = snapshot;
      const outputLimit = config.modelLimits[model.id]?.maxTokens;
      const maxTokens = outputLimit == null ? options.maxTokens : Math.min(options.maxTokens ?? outputLimit, outputLimit);
      const reasoning = this.resolveReasoningLevel(model, options.reasoningEffort);
      const consumer = new AbortController();
      const upstream = options.signal === void 0 ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]);
      const watchdog = __using(_stack, idleWatchdog(upstream, config.streamIdleTimeoutMs, "LLM_STREAM_IDLE_TIMEOUT"));
      const preparation = __using(_stack, deadline(watchdog.signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, "LLM_PREPARATION_TIMEOUT"));
      const payloadLease = __using(_stack, new ImagePayloadLease(trace.imagePool));
      try {
        const apiKey = await trace.measure("credential", () => waitWithSignal(
          () => this.options.resolveApiKey(config, preparation.signal),
          preparation.signal
        ));
        if (!apiKey) throw new LlmError8("llm-opencode-go: no credential resolved for the route", "MISSING_CREDENTIAL");
        const containsImage = options.messages.some((message) => contentHasImage2(message.content));
        if (containsImage && !model.input.includes("image")) {
          throw new LlmError8(`opencode-go model "${model.id}" does not support image input`, "UNSUPPORTED_CONTENT");
        }
        let imageRequest;
        if (containsImage) {
          const access = this.options.imageAccess;
          const store = access?.resolveAttachments();
          if (access === void 0 || store === void 0) {
            throw new LlmError8("llm-opencode-go image input requires the durable attachment service", "UNSUPPORTED_CONTENT");
          }
          imageRequest = {
            attachments: store,
            resolveImageAccess: (ref) => access.resolveImageAccess(store, ref),
            maxImages: config.maxImages ?? void 0,
            maxRequestImageBytes: config.maxRequestImageBytes,
            requestImagePolicy: {
              maxPixels: config.requestImagePixelBudget,
              maxBytes: config.requestImageMaxBytes
            },
            payloadLease,
            onImagePool: trace.imagePool
          };
        }
        const context = await trace.measure("images", () => waitWithSignal(() => imageRequest === void 0 ? Promise.resolve(toPiContext(options, void 0, this.options.onReplayDegrade)) : toPiContext({ ...options, signal: preparation.signal }, imageRequest, this.options.onReplayDegrade), preparation.signal));
        preparation[Symbol.dispose]();
        watchdog.signal.throwIfAborted();
        const diagnostics = new GatewayDiagnostics({
          provider: String(options.provider),
          model: model.id,
          apiKey,
          proxyURL: config.proxyURL,
          fetch: this.transport.forProxy(config.proxyURL),
          directory: this.options.debugDirectory ? this.options.debugDirectory() : process.env.DSH_OPENCODE_GO_DEBUG_DIR,
          callId: trace.callId,
          attempt: trace.attempts,
          onResponse: (status, requestId) => trace.response(status, requestId)
        });
        const events = catalog.provider.streamSimple(model, normalizeContext(context), {
          apiKey,
          fetch: diagnostics.fetch,
          ...reasoningRequest(reasoningIntent(model, reasoning)),
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
            const result = await trace.measure("stream", () => waitWithSignal(() => watchdog.next(iterator), watchdog.signal));
            if (timeoutOf(watchdog.signal, "LLM_REQUEST_TIMEOUT")) throw new LlmError8("opencode-go whole request timeout", "TIMEOUT");
            if (timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT") !== void 0) {
              throw new LlmError8("opencode-go stream idle timeout", "TIMEOUT");
            }
            if (result.done) {
              exhausted = true;
              return;
            }
            const chunk = result.value;
            if ((chunk.type === "text-delta" || chunk.type === "reasoning-delta") && chunk.text.length > 0 || chunk.type === "tool-call-delta" && chunk.argumentsDelta.length > 0) trace.firstOutput();
            if (chunk.type === "finish" && chunk.reason.kind === "error") {
              const failure = chunk.reason.failure;
              const message = await waitWithSignal(() => diagnostics.failureMessage(failure.message), watchdog.signal);
              const code = await waitWithSignal(() => diagnostics.failureCode(failure.code), watchdog.signal);
              yield { ...chunk, reason: options.signal?.aborted ? { kind: "aborted", failure: { code: "ABORTED", message: "opencode-go request aborted by caller" } } : { ...chunk.reason, failure: { ...chunk.reason.failure, message, code } } };
            } else yield chunk;
          }
        } finally {
          if (!exhausted) {
            consumer.abort("opencode-go stream consumer stopped");
            try {
              void iterator.return(void 0).catch(() => {
              });
            } catch (_abortedSdkTeardown) {
            }
          }
        }
      } catch (error) {
        if (timeoutOf(preparation.signal, "LLM_PREPARATION_TIMEOUT")) {
          throw new LlmError8("opencode-go credential/image preparation timeout", "TIMEOUT", { cause: error });
        }
        if (timeoutOf(watchdog.signal, "LLM_REQUEST_TIMEOUT")) {
          throw new LlmError8("opencode-go whole request timeout", "TIMEOUT", { cause: error });
        }
        if (timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT") !== void 0) {
          throw new LlmError8("opencode-go stream idle timeout", "TIMEOUT", { cause: error });
        }
        if (options.signal?.aborted) {
          throw new LlmError8("opencode-go request aborted by caller", "ABORTED", { cause: error });
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
import { randomUUID as randomUUID5 } from "node:crypto";
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
    let identity2 = this.identities.get(identityKey);
    if (identity2?.baseURL !== baseURL || identity2.proxyURL !== proxyURL || identity2.key !== key) {
      identity2 = { baseURL, proxyURL, key, source: randomUUID5() };
      this.identities.set(identityKey, identity2);
    }
    const { source } = identity2;
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

// src/account-selection.ts
function identity(config) {
  return JSON.stringify([config.enabled, accountRefOf(config), config.accounts, config.autoSwitch, config.baseURL, config.proxyURL]);
}
var GoAccountSelection = class {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }
  settings;
  connection = 0;
  credentials = 0;
  version = 0;
  signature = "";
  latestSeq = -1;
  notice;
  connect(settings) {
    this.settings = settings;
    this.connection++;
    this.capture();
    return () => {
      if (this.settings !== settings) return;
      this.settings = void 0;
      this.connection++;
      this.capture();
    };
  }
  row() {
    try {
      const rows = this.settings?.describe() ?? [];
      return rows.find((row) => row.ns === "opencode-go") ?? rows.find((row) => row.ns === "llm-opencode-go");
    } catch {
      return void 0;
    }
  }
  /** Reading the revision also catches A → C → A before async change watchers run. */
  capture() {
    const row = this.row();
    const signature = JSON.stringify([identity(this.config()), this.connection, this.credentials, row?.ns, row?.revision]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.version++;
      this.notice = void 0;
    }
    return this.version;
  }
  credentialChanged() {
    this.credentials++;
    this.capture();
  }
  lastSwitch() {
    this.capture();
    return this.notice;
  }
  /** One freshness decision governs both side effects of a request's outcome. */
  settle(event) {
    if (event.generation !== this.capture() || event.seq < this.latestSeq) return;
    const config = this.config();
    if (identity(config) !== identity(event.config) || !accountsOf(config).some((account) => account.apiKeyEnv === event.ref)) return;
    this.latestSeq = event.seq;
    this.notice = event.notice;
    if (event.notice && config.enabled && config.autoSwitch) void this.adopt(event);
  }
  async adopt(event) {
    const settings = this.settings;
    if (!settings) return;
    const connection = this.connection;
    const credentials = this.credentials;
    try {
      const row = this.row();
      if (!row) {
        this.logger.debug("llm-opencode-go: no editable account settings row; the fallback stays per request");
        return;
      }
      const selected = row.value?.apiKeyEnv;
      if (event.generation !== this.capture() || event.seq !== this.latestSeq || selected !== accountRefOf(event.config)) return;
      const expected = identity({ ...event.config, apiKeyEnv: event.ref });
      const result = await settings.mutate(row.ns, [{ op: "set", path: ["apiKeyEnv"], value: event.ref }], row.revision);
      this.capture();
      const committed = this.row();
      if (result !== false && this.connection === connection && this.credentials === credentials && event.seq === this.latestSeq && committed?.ns === row.ns && committed.revision === row.revision + 1 && identity(this.config()) === expected) this.notice = event.notice;
    } catch (error) {
      this.logger.warn(`llm-opencode-go: could not make "${event.ref}" the current account (${String(error)})`);
    }
  }
};

// src/account-operations.ts
function ownsAccountCredential(account) {
  return /^[a-f0-9]{32}$/.test(account.id) && account.apiKeyEnv === ACCOUNT_REF_PREFIX + account.id.toUpperCase();
}
function assertAccountOperations(value) {
  if (value === void 0) return;
  if (!Array.isArray(value) || value.length > MAX_ACCOUNTS) throw new Error("Too many pending OpenCode Go account operations");
  const ids = /* @__PURE__ */ new Set(), refs = /* @__PURE__ */ new Set();
  for (const operation of value) {
    if (!operation || typeof operation.id !== "string" || !/^[a-f0-9]{32}$/.test(operation.id) || ids.has(operation.id) || !["add", "remove"].includes(operation.kind)) throw new Error("Invalid OpenCode Go account operation");
    const fields2 = operation.kind === "add" ? ["id", "kind", "account", "previousRef", "select"] : ["id", "kind", "account"];
    if (Object.keys(operation).some((key) => !fields2.includes(key)) || !operation.account || Object.keys(operation.account).some((key) => !["id", "name", "apiKeyEnv"].includes(key))) {
      throw new Error("Unexpected OpenCode Go account operation fields");
    }
    assertAccounts([operation.account]);
    if (refs.has(operation.account.apiKeyEnv)) throw new Error("Duplicate OpenCode Go account operation");
    if (operation.kind === "add" && (!ownsAccountCredential(operation.account) || typeof operation.select !== "boolean" || !ACCOUNT_REF_PATTERN.test(operation.previousRef))) {
      throw new Error("Invalid OpenCode Go account addition");
    }
    ids.add(operation.id);
    refs.add(operation.account.apiKeyEnv);
  }
}

// src/account-recovery.ts
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { deadline as deadline2 } from "@deepseek-ai/dsh-timeout";
var ACCOUNT_RECOVERY_TIMEOUT_MS = 3e4;
var GoAccountRecovery = class {
  constructor(logger) {
    this.logger = logger;
  }
  connection;
  pending;
  again = false;
  connect(settings, credentials) {
    this.connection?.cancel.abort("Account recovery connection replaced");
    const connection = this.connection = { settings, credentials, cancel: new AbortController() };
    this.trigger();
    return () => {
      if (this.connection !== connection) return;
      this.connection = void 0;
      connection.cancel.abort("Account recovery connection closed");
    };
  }
  trigger() {
    void this.recover().catch(() => {
      this.logger.warn("llm-opencode-go: account recovery is waiting for writable settings and credentials");
    });
  }
  recover() {
    this.again = true;
    if (this.pending) return this.pending;
    this.pending = Promise.resolve().then(() => this.run()).finally(() => {
      this.pending = void 0;
      if (this.again) this.trigger();
    });
    return this.pending;
  }
  row(connection) {
    const rows = connection.settings.describe();
    return rows.find((row) => row.ns === "opencode-go") ?? rows.find((row) => row.ns === "llm-opencode-go");
  }
  async run() {
    for (let pass = 0; this.again && pass < 4; pass++) {
      this.again = false;
      const connection = this.connection;
      if (!connection) return;
      const row = this.row(connection);
      const value = row?.value;
      assertAccountOperations(value?.accountOperations);
      for (const operation of value?.accountOperations ?? []) {
        if (this.connection !== connection) return;
        try {
          await this.complete(connection, operation);
        } catch {
          this.logger.warn(`llm-opencode-go: account operation ${operation.id} remains pending; it will retry on settings/credential reconnect or update`);
        }
      }
    }
    this.again = false;
  }
  async complete(connection, operation) {
    var _stack = [];
    try {
      const timeout = __using(_stack, deadline2(connection.cancel.signal, ACCOUNT_RECOVERY_TIMEOUT_MS, "OPENCODE_ACCOUNT_RECOVERY_TIMEOUT"));
      const wait = (work) => waitWithSignal(work, timeout.signal);
      const get = () => {
        if (this.connection !== connection) return void 0;
        const row = this.row(connection);
        if (!row) return void 0;
        const value = row.value;
        assertAccountOperations(value.accountOperations);
        const current = value.accountOperations?.find((entry) => entry.id === operation.id);
        if (JSON.stringify(current) !== JSON.stringify(operation)) return void 0;
        return { row, value };
      };
      let state = get();
      if (!state) return;
      const ref = operation.account.apiKeyEnv;
      const info = await wait(() => connection.credentials.describe(credentialRef(ref)));
      state = get();
      if (!state) return;
      const occupied = accountsOf(state.value).find((account) => account.apiKeyEnv === ref || account.id === operation.account.id);
      if (occupied && (occupied.id !== operation.account.id || occupied.apiKeyEnv !== ref)) {
        throw new Error("Account identity changed while recovery was pending");
      }
      if (operation.kind === "add" && !info.configured) return;
      if (operation.kind === "remove" && ownsAccountCredential(operation.account) && info.configured) {
        if (!info.writable) throw new Error("Credential is read-only");
        await wait(() => connection.credentials.unset(credentialRef(ref)));
      }
      let dropLegacyRef;
      if (operation.kind === "add" && state.value.accounts == null) {
        const legacyRef = accountRefOf(state.value);
        try {
          if (!(await wait(() => connection.credentials.describe(credentialRef(legacyRef)))).configured) dropLegacyRef = legacyRef;
        } catch {
        }
      }
      state = get();
      if (!state) return;
      timeout.signal.throwIfAborted();
      let accounts = [...accountsOf(state.value)];
      let selected;
      if (operation.kind === "add") {
        if (!accounts.some((account) => account.id === operation.account.id)) {
          if (state.value.accounts == null && dropLegacyRef) accounts = accounts.filter((account) => account.apiKeyEnv !== dropLegacyRef);
          if (accounts.length >= MAX_ACCOUNTS) throw new Error("Account limit reached");
          accounts.push(operation.account);
        }
        if (operation.select && accountRefOf(state.value) === operation.previousRef) selected = ref;
      } else {
        accounts = accounts.filter((account) => account.apiKeyEnv !== ref);
        if (accountRefOf(state.value) === ref && accounts.length) selected = accounts[0].apiKeyEnv;
      }
      assertAccounts(accounts, selected ?? accountRefOf(state.value));
      const target = state;
      const result = await wait(() => connection.settings.mutate(target.row.ns, [
        { op: "set", path: ["accounts"], value: accounts },
        ...selected ? [{ op: "set", path: ["apiKeyEnv"], value: selected }] : [],
        { op: "set", path: ["accountOperations"], value: target.value.accountOperations.filter((entry) => entry.id !== operation.id) }
      ], target.row.revision));
      const committed = get();
      if (result === false || committed) {
        this.again = true;
        throw new Error("Account settings have not committed");
      }
    } catch (_) {
      var _error = _, _hasError = true;
    } finally {
      __callDispose(_stack, _error, _hasError);
    }
  }
};

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
  assertAccountOperations(entry.accountOperations);
  let current = () => readConfig(config);
  const resolveApiKey = async (config2 = current()) => {
    const ref = accountRefOf(config2);
    if (!accountsOf(config2).some((account) => account.apiKeyEnv === ref)) {
      throw new LlmError9("OpenCode Go has no selected account", "MISSING_CREDENTIAL");
    }
    const credentials = ctx.get("credentials");
    const hit = credentials !== void 0 ? (await credentials.resolve(credentialRef2(ref)))?.value : launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== void 0 && hit.length > 0) return assertUsableApiKey(hit, name, ref);
    throw new LlmError9(
      `llm-opencode-go: no credential; the profile resolves ${ref}, which is not set \u2014 store ${ref} through the credentials service or export it`,
      "MISSING_CREDENTIAL"
    );
  };
  registerGoRemotes(ctx);
  const selection = new GoAccountSelection(() => current(), ctx.logger);
  const recovery = new GoAccountRecovery(ctx.logger);
  ctx.inject(["settings", "credentials"], (ready) => {
    ready.effect(() => recovery.connect(ready.settings, ready.credentials));
  });
  const transport = new ProxyTransport();
  ctx.effect(() => () => transport.dispose());
  ctx.plugin(GoUsageService, {
    baseURL: () => current().baseURL,
    proxyURL: () => current().proxyURL,
    transport,
    resolveApiKey: (ref) => resolveApiKey({ ...current(), apiKeyEnv: ref ?? current().apiKeyEnv }),
    activeRef: () => accountRefOf(current()),
    accountRefs: () => accountsOf(current()).map((account) => account.apiKeyEnv),
    lastSwitch: () => selection.lastSwitch()
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
    debugDirectory: () => launchEnvironmentOf(ctx).get("DSH_OPENCODE_GO_DEBUG_DIR")?.value,
    config: () => current(),
    resolveApiKey,
    onCallTrace: (trace) => {
      ctx.logger.debug(`llm-opencode-go call: ${JSON.stringify(trace)}`);
    },
    onCatalogWarning: (warning) => {
      ctx.logger.warn(`llm-opencode-go: ${warning}`);
    },
    accountGeneration: () => selection.capture(),
    onAccountSettled: (event) => {
      selection.settle(event);
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
  let selectedRef = accountRefOf(current());
  const syncRoute = () => {
    recovery.trigger();
    const check = ++routeCheck;
    const config2 = current();
    selection.capture();
    const visibility = pickerVisibilityOf();
    if (pickerVisibility !== visibility) {
      pickerVisibility = visibility;
      registration?.replace([PROVIDER_ID]);
    }
    const credentials = ctx.get("credentials");
    const selected = accountRefOf(config2);
    if (selected !== selectedRef) {
      selectedRef = selected;
      adapter.forgetRejectedKey(selected);
    }
    const refs = accountsOf(config2).filter((account) => config2.autoSwitch || account.apiKeyEnv === selected).map((account) => account.apiKeyEnv);
    if (credentials === void 0) {
      applyRoute(refs.some((ref) => Boolean(launchEnvironmentOf(ctx).get(ref)?.value)));
      return;
    }
    void Promise.all(refs.map((ref) => credentials.describe(credentialRef2(ref)))).then((infos) => {
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
        throw new LlmError9(
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
    settingsCtx.effect(() => selection.connect(settingsCtx.settings));
    if ("configure" in settingsCtx.settings) {
      const settings = settingsCtx.settings;
      settingsCtx.effect(() => {
        const dispose = settings.configure({ auto: false }, ctx.fiber);
        recovery.trigger();
        return dispose;
      });
      return;
    }
    settingsCtx.settings.installSection(ctx, NS, PlainConfig, entry, {
      validate: (value) => {
        assertBaseURL(value.baseURL);
        assertProxyURL(value.proxyURL);
        if (typeof value.apiKeyEnv === "string") assertApiKeyEnv(value.apiKeyEnv);
        assertAccounts(value.accounts, value.apiKeyEnv);
        assertAccountOperations(value.accountOperations);
      },
      setSource: (source) => {
        current = source;
      },
      onChange: () => {
        syncRoute();
      }
    });
    recovery.trigger();
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
      assertAccountOperations(config2.accountOperations);
    }
    return value;
  });
  ctx.on("loader/volatile-update", syncRoute);
  ctx.inject(["credentials"], (credentialsCtx) => {
    credentialsCtx.on("credentials/reference-updated", (ref) => {
      recovery.trigger();
      adapter.forgetRejectedKey(ref);
      if (accountsOf(current()).some((account) => account.apiKeyEnv === ref)) {
        selection.credentialChanged();
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
