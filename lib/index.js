import { createRequire as __createRequire } from 'node:module'; var require = __createRequire(import.meta.url);
import {
  ACCOUNT_REF_PATTERN,
  ACCOUNT_REF_PREFIX,
  AssistantMessageEventStream,
  DEFAULT_ACCOUNT_REF,
  DEFAULT_BASE_URL,
  DEFAULT_FREE_BASE_URL,
  DEFAULT_MAX_REQUEST_IMAGE_BYTES,
  DEFAULT_OPENCODE_GO_THEME,
  DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
  DEFAULT_USAGE_DISPLAY,
  DEFAULT_USAGE_PILL_STYLE,
  DISPLAY_NAME,
  FREE_DISPLAY_NAME,
  FREE_PROVIDER_ID,
  GatewayDiagnostics,
  MAX_ACCOUNTS,
  MAX_THINKING_BUDGET_TOKENS,
  OPENCODE_GO_THEMES,
  PROFILE_ENTRY_ID,
  PROVIDER_ID,
  ProxyTransport,
  SDK_PROVIDER_ID,
  SETTINGS_NAMESPACE,
  USAGE_DISPLAY_MODES,
  USAGE_PILL_STYLES,
  accountRefOf,
  accountsOf,
  adjustMaxTokensForThinking,
  appendAssistantMessageDiagnostic,
  appendGrammarToolInputJsonDelta,
  assertAccounts,
  assertProxyURL,
  buildBaseOptions,
  calculateCost,
  clampMaxTokensToContext,
  clampThinkingBudgetToAnswerRoom,
  clampThinkingLevel,
  closeGrammarToolInputJson,
  createGrammarToolInputProperties,
  createProvider,
  diagnosticURL,
  estimateContextTokens,
  fetchJsonResponse,
  formatProviderError,
  getCurrentTools,
  getDeclaredTools,
  getGrammarToolInput,
  getIdentityHeaders,
  getInitialSystemMessage,
  getJsonSchemaToolParameters,
  getSupportedThinkingLevels,
  getSystemMessageText,
  goRemote,
  headersToRecord,
  isModelEnabled,
  isStrictToolLimitErrorMessage,
  lazyStream,
  migrateGatewayBaseURL,
  modelSettingsKey,
  moveAccountFirst,
  normalizeContext,
  normalizeInputModalities,
  normalizeProviderError,
  parseAccountCommand,
  parseAnalyticsQuery,
  parseGoUsage,
  prefersJsonSchemaStrictSampling,
  readUsageError,
  renderSystemMessageUpdate,
  resolveGrammarConstrainedSampling,
  resolveJsonSchemaStrictSampling,
  resolveSamplingParams,
  resolveTranscript,
  resolveTranscriptTools,
  retryProviderRequest,
  sanitizeSurrogates,
  sortModels,
  splitErrorToolResultImages,
  thinkingBudgetForLevel,
  transformMessages,
  transportFailure,
  validReleaseDate,
  waitWithSignal,
  withGoogleFetch
} from "./chunk-3QRO6PF4.js";
import {
  __callDispose,
  __commonJS,
  __export,
  __require,
  __toESM,
  __using
} from "./chunk-FVGOWUVG.js";

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
import {
  LlmError as LlmError6,
  assertUsableApiKey,
  resolveImageAttachmentAccess
} from "@deepseek-ai/dsh-llm";

// node_modules/opencode-go-pi-ai/dist/utils/json-parse.js
var import_partial_json = __toESM(require_dist(), 1);
var VALID_JSON_ESCAPES = /* @__PURE__ */ new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
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
function parseToolCallArguments(json) {
  if (!json?.trim())
    return { arguments: {} };
  try {
    const parsed = parseJsonWithRepair(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Tool arguments must be a JSON object");
    }
    return { arguments: parsed };
  } catch (error) {
    return {
      arguments: {},
      argumentsError: `${error instanceof Error ? error.message : String(error)}

Received arguments:
${json}`
    };
  }
}

// node_modules/opencode-go-pi-ai/dist/utils/streaming-json.js
var MAX_REPORTED_DEPTH = 32;
var ROOT_SLOT = { kind: "root" };
var CREDIT_PER_APPEND = 256;
var CREDIT_PER_CHARACTER = 8;
var MAX_PENDING_SCALAR_LENGTH = 64;
var NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
var NUMBER_WITHOUT_EXPONENT_DIGITS = /^(-?(?:0|[1-9]\d*)(?:\.\d+)?)[eE][+-]?$/;
var LITERALS = [
  ["true", true],
  ["false", false],
  ["null", null]
];
var QUOTE = 34;
var BACKSLASH = 92;
var StreamingJsonParser = class {
  #root = void 0;
  #done = false;
  #stack = [];
  #string = void 0;
  #scalar = "";
  #scalarSlot = void 0;
  /** Sum of `size + 1` over the open path: what a fresh snapshot copies. */
  #pathCost = 0;
  #credit = 0;
  #dirty = false;
  #snapshot = void 0;
  /** Changes of the piece being read. */
  #changes = [];
  /**
   * Read the next piece of text; returns the changes it made, in order. Costs time linear in `text.length`.
   */
  append(text) {
    this.#credit += CREDIT_PER_APPEND + CREDIT_PER_CHARACTER * text.length;
    this.#changes = [];
    if (this.#string !== void 0)
      this.#string.change = void 0;
    let index = 0;
    while (index < text.length && !this.#done) {
      const open = this.#string;
      if (open !== void 0)
        index = this.#readString(open, text, index);
      else if (this.#scalar !== "")
        index = this.#readScalar(text, index);
      else
        this.#structural(text[index++]);
    }
    return this.#changes;
  }
  /**
   * The value of the text read so far: `undefined` before a value starts, otherwise a plain JSON value that never
   * changes afterwards. Returns the previous snapshot while the text read since did not change the value, or while a
   * fresh copy of the open path is not yet paid for (see the module comment).
   */
  snapshot() {
    if (!this.#dirty)
      return this.#snapshot;
    const pending = this.#pendingScalar();
    const cost = this.#pathCost + (pending === void 0 ? 0 : 1);
    if (cost > this.#credit)
      return this.#snapshot;
    this.#credit -= cost;
    this.#dirty = false;
    this.#snapshot = this.#copyOpenPath(pending);
    return this.#snapshot;
  }
  /** Read string characters from `start` until the string ends or the text does; returns the next index. */
  #readString(open, text, start) {
    let runStart = start;
    for (let index = start; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (open.escape !== "") {
        if (this.#continueEscape(open, text[index])) {
          runStart = index + 1;
          continue;
        }
        runStart = index;
      }
      if (code === QUOTE) {
        if (index > runStart)
          this.#appendString(open, text.slice(runStart, index));
        this.#endString(open);
        return index + 1;
      }
      if (code === BACKSLASH) {
        if (index > runStart)
          this.#appendString(open, text.slice(runStart, index));
        open.escape = "\\";
        runStart = index + 1;
      }
    }
    if (text.length > runStart)
      this.#appendString(open, text.slice(runStart));
    return text.length;
  }
  /** Read number or literal characters from `start` up to the next delimiter; returns the delimiter's index. */
  #readScalar(text, start) {
    let end = start;
    while (end < text.length && !isDelimiter(text[end]))
      end++;
    if (end > start) {
      this.#scalar += text.slice(start, end);
      if (this.#scalarSlot !== void 0)
        this.#dirty = true;
    }
    if (end < text.length)
      this.#endScalar();
    return end;
  }
  /** Handle one character outside strings. */
  #structural(char) {
    switch (char) {
      case " ":
      case "	":
      case "\n":
      case "\r":
        return;
      case '"':
        this.#startString();
        return;
      case "{":
      case "[":
        this.#openContainer(char === "{" ? {} : []);
        return;
      case "}":
      case "]":
        this.#closeContainer();
        return;
      case ":": {
        const frame = this.#stack.at(-1);
        if (frame !== void 0 && !Array.isArray(frame.container) && frame.phase === "colon")
          frame.phase = "value";
        return;
      }
      case ",": {
        const frame = this.#stack.at(-1);
        if (frame !== void 0)
          frame.phase = Array.isArray(frame.container) ? "value" : "key";
        return;
      }
      default:
        this.#scalar = char;
        this.#scalarSlot = this.#valueSlot();
        if (this.#scalarSlot !== void 0)
          this.#dirty = true;
    }
  }
  /** Where a value starting now goes, or `undefined` when this position takes no value. */
  #valueSlot() {
    const frame = this.#stack.at(-1);
    if (frame === void 0)
      return this.#root === void 0 ? ROOT_SLOT : void 0;
    if (Array.isArray(frame.container))
      return { kind: "element", index: frame.container.length };
    if ((frame.phase === "value" || frame.phase === "colon") && frame.key !== void 0) {
      return { kind: "member", key: frame.key };
    }
    return void 0;
  }
  #startString() {
    const frame = this.#stack.at(-1);
    if (frame !== void 0 && !Array.isArray(frame.container) && (frame.phase === "key" || frame.phase === "comma")) {
      this.#string = { target: "key", slot: void 0, text: "", escape: "", path: void 0, change: void 0 };
      return;
    }
    const slot = this.#valueSlot();
    const path = this.#reportedPath(slot);
    this.#string = { target: "value", slot, text: "", escape: "", path, change: void 0 };
    this.#place(slot, "");
    if (path !== void 0)
      this.#string.change = this.#report({ kind: "set", path, value: "" });
  }
  /** The path of a value at `slot` in the innermost open container, when its changes are reported. */
  #reportedPath(slot) {
    if (slot === void 0)
      return void 0;
    if (slot.kind === "root")
      return [];
    const frame = this.#stack.at(-1);
    if (!frame.reportsInside)
      return void 0;
    return [...frame.path, slot.kind === "member" ? slot.key : slot.index];
  }
  #report(change) {
    this.#changes.push(change);
    return change;
  }
  /** Continue an escape with `char`; returns false when `char` is not part of it and must be read normally. */
  #continueEscape(open, char) {
    if (open.escape === "\\") {
      const decoded = SIMPLE_ESCAPES[char];
      if (decoded !== void 0) {
        open.escape = "";
        this.#appendString(open, decoded);
        return true;
      }
      if (char === "u") {
        open.escape = "\\u";
        return true;
      }
      open.escape = "";
      this.#appendString(open, "\\");
      return false;
    }
    if (isHexDigit(char)) {
      open.escape += char;
      if (open.escape.length < 6)
        return true;
      const decoded = String.fromCharCode(Number.parseInt(open.escape.slice(2), 16));
      open.escape = "";
      this.#appendString(open, decoded);
      return true;
    }
    const literal = open.escape;
    open.escape = "";
    this.#appendString(open, literal);
    return false;
  }
  #appendString(open, text) {
    open.text += text;
    if (open.target !== "value")
      return;
    this.#place(open.slot, open.text);
    if (open.path === void 0)
      return;
    const change = open.change;
    if (change !== void 0 && this.#changes.at(-1) === change) {
      if (change.kind === "set")
        change.value = change.value + text;
      else
        change.text += text;
      return;
    }
    open.change = this.#report({ kind: "append", path: open.path, text });
  }
  #endString(open) {
    this.#string = void 0;
    const frame = this.#stack.at(-1);
    if (open.target === "key") {
      if (frame === void 0)
        return;
      frame.key = open.text;
      frame.phase = "colon";
      return;
    }
    this.#valueEnded(frame);
  }
  #endScalar() {
    const token = this.#scalar;
    const slot = this.#scalarSlot;
    this.#scalar = "";
    this.#scalarSlot = void 0;
    const value = scalarValue(token);
    if (value !== void 0) {
      this.#place(slot, value);
      const path = this.#reportedPath(slot);
      if (path !== void 0)
        this.#report({ kind: "set", path, value });
    }
    this.#valueEnded(this.#stack.at(-1));
  }
  /** The value of the unterminated scalar at the end of the text, if it shows. */
  #pendingScalar() {
    const slot = this.#scalarSlot;
    const token = this.#scalar;
    if (slot === void 0 || token === "" || token.length > MAX_PENDING_SCALAR_LENGTH)
      return void 0;
    const value = pendingScalarValue(token);
    return value === void 0 ? void 0 : { slot, value };
  }
  #openContainer(container) {
    const slot = this.#valueSlot();
    const path = this.#reportedPath(slot);
    this.#place(slot, container);
    this.#stack.push({
      container,
      slot,
      path,
      reportsInside: path !== void 0 && path.length < MAX_REPORTED_DEPTH,
      size: 0,
      key: void 0,
      phase: Array.isArray(container) ? "value" : "key"
    });
    this.#pathCost += 1;
    this.#dirty = true;
    if (path !== void 0)
      this.#report({ kind: "set", path, value: Array.isArray(container) ? [] : {} });
  }
  #closeContainer() {
    const frame = this.#stack.pop();
    if (frame === void 0)
      return;
    this.#pathCost -= frame.size + 1;
    this.#dirty = true;
    if (frame.path !== void 0 && !frame.reportsInside) {
      this.#report({ kind: "set", path: frame.path, value: frame.container });
    }
    this.#valueEnded(this.#stack.at(-1));
  }
  /** A value in `frame`, or the root value when there is no frame, has ended. */
  #valueEnded(frame) {
    if (frame === void 0) {
      if (this.#root !== void 0)
        this.#done = true;
      return;
    }
    frame.phase = "comma";
  }
  /** Set the value at `slot` in the open path; nothing for a value in an invalid position. */
  #place(slot, value) {
    if (slot === void 0)
      return;
    this.#dirty = true;
    if (slot.kind === "root") {
      this.#root = value;
      return;
    }
    const frame = this.#stack.at(-1);
    if (slot.kind === "element") {
      const elements = frame.container;
      if (slot.index === elements.length) {
        frame.size++;
        this.#pathCost++;
      }
      elements[slot.index] = value;
      return;
    }
    const members = frame.container;
    if (!Object.hasOwn(members, slot.key)) {
      frame.size++;
      this.#pathCost++;
    }
    setMember(members, slot.key, value);
  }
  /** A fresh snapshot: copies of the open containers, innermost first, each holding the copy of its open child. */
  #copyOpenPath(pending) {
    if (this.#stack.length === 0)
      return pending?.slot.kind === "root" ? pending.value : this.#root;
    let child;
    let childSlot;
    for (let depth = this.#stack.length - 1; depth >= 0; depth--) {
      const frame = this.#stack[depth];
      const copy = Array.isArray(frame.container) ? frame.container.slice() : { ...frame.container };
      if (depth === this.#stack.length - 1 && pending !== void 0)
        setSlot(copy, pending.slot, pending.value);
      if (child !== void 0 && childSlot !== void 0)
        setSlot(copy, childSlot, child);
      child = copy;
      childSlot = frame.slot;
    }
    return childSlot?.kind === "root" ? child : this.#root;
  }
};
var ToolCallArgumentsStream = class {
  #text = "";
  #parser = new StreamingJsonParser();
  #snapshot = void 0;
  #arguments = {};
  /** The raw argument text received so far. */
  get text() {
    return this.#text;
  }
  /** Append a piece of argument text; returns the partial arguments, a new object whenever they changed. */
  append(delta) {
    this.#text += delta;
    this.#parser.append(delta);
    return this.#partial();
  }
  /**
   * Take the provider's complete argument text. When it continues the text so far, returns the missing piece as
   * `delta`; otherwise starts over with `text`. Either way returns the partial arguments of `text`.
   */
  replace(text) {
    if (text.startsWith(this.#text)) {
      const delta = text.slice(this.#text.length);
      return { delta, arguments: delta === "" ? this.#partial() : this.append(delta) };
    }
    this.#text = "";
    this.#parser = new StreamingJsonParser();
    return { delta: void 0, arguments: this.append(text) };
  }
  /** The final arguments: one full parse of the complete text, which reports malformed arguments. */
  finish() {
    return parseToolCallArguments(this.#text);
  }
  #partial() {
    const snapshot = this.#parser.snapshot();
    if (snapshot === this.#snapshot)
      return this.#arguments;
    this.#snapshot = snapshot;
    this.#arguments = typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot) ? snapshot : {};
    return this.#arguments;
  }
};
var SIMPLE_ESCAPES = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "	"
};
function isDelimiter(char) {
  return char === " " || char === "	" || char === "\n" || char === "\r" || char === "," || char === ":" || char === "{" || char === "}" || char === "[" || char === "]" || char === '"';
}
function isHexDigit(char) {
  return char >= "0" && char <= "9" || char >= "a" && char <= "f" || char >= "A" && char <= "F";
}
function scalarValue(token) {
  for (const [literal, value] of LITERALS)
    if (token === literal)
      return value;
  return NUMBER.test(token) ? Number(token) : void 0;
}
function pendingScalarValue(token) {
  for (const [literal, value] of LITERALS)
    if (literal.startsWith(token))
      return value;
  if (NUMBER.test(token))
    return Number(token);
  const mantissa = NUMBER_WITHOUT_EXPONENT_DIGITS.exec(token);
  return mantissa === null ? void 0 : Number(mantissa[1]);
}
function setSlot(container, slot, value) {
  if (slot.kind === "element")
    container[slot.index] = value;
  else if (slot.kind === "member")
    setMember(container, slot.key, value);
}
function setMember(members, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(members, key, { value, writable: true, enumerable: true, configurable: true });
  } else {
    members[key] = value;
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
  /context window exceeded/i,
  // LiteLLM pre-call check (ContextWindowExceededError)
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
  /token limit exceeded/i,
  // Generic fallback
  // HTTP 413 means request-size overflow regardless of provider or body text.
  // Match raw SDK errors and formatProviderError's prefix, not a status mentioned in the body.
  /^(?:[\w -]+ API error \(413\):|413(?:\s|:|$))/i
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
  LlmError as LlmError5,
  attributionHeaders as attributionHeaders3,
  contentHasImage as contentHasImage2,
  LlmAdapter,
  ReasoningEffortId
} from "@deepseek-ai/dsh-llm";
import { deadline, idleWatchdog, timeoutOf } from "@deepseek-ai/dsh-timeout";

// src/config.ts
import z from "@deepseek-ai/schemastery";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
var DEFAULT_API_KEY_ENV = DEFAULT_ACCOUNT_REF;
var DEFAULT_REFRESH_MINUTES = 60;
var DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
var DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS = 6e4;
var DEFAULT_REQUEST_TIMEOUT_MS = 30 * 6e4;
var fields = {
  enabled: z.boolean().default(true),
  // Free access is deliberately off unless the user opts in: requests are sent
  // as the official OpenCode CLI user agent and may violate upstream terms.
  freeEnabled: z.boolean().default(false),
  // The console page is opt-in: a plugin install must not grow the sidebar.
  sidebarEntry: z.boolean().default(false),
  usageDisplay: z.union(USAGE_DISPLAY_MODES.map((mode) => z.const(mode))).default(DEFAULT_USAGE_DISPLAY),
  showSidebarQuota: z.boolean().default(false),
  usagePillStyle: z.union(USAGE_PILL_STYLES.map((style) => z.const(style))).default(DEFAULT_USAGE_PILL_STYLE),
  appearanceTheme: z.union(OPENCODE_GO_THEMES.map((theme) => z.const(theme))).default(DEFAULT_OPENCODE_GO_THEME),
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
  // Settings rebuild and serialize this schema before sending it to clients.
  // Keep it data-only: a rehydrated transform loses its callback on forwarding.
  baseURL: z.string().default(DEFAULT_BASE_URL),
  freeBaseURL: z.string().default(DEFAULT_FREE_BASE_URL),
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
    thinkingBudgets: z.union([z.const(null), z.array(z.number().step(1).min(1).max(MAX_THINKING_BUDGET_TOKENS).required()).max(16)])
  })])).default({})
};
var PlainConfig = z.object(fields);
var DEFAULT_CONFIG = PlainConfig();
var Config = z.object(Object.fromEntries(
  Object.entries(fields).map(([key, schema]) => [key, schema.volatile()])
));
function readConfig(config) {
  const value = Object.fromEntries(Object.keys(fields).map((key) => [key, config[key].get()]));
  return { ...value, baseURL: migrateGatewayBaseURL(value.baseURL) };
}
function diagnosticBaseURL(raw) {
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return raw.includes("@") ? "[redacted URL]" : raw;
  }
}
function assertBaseURL(raw, field = "baseURL") {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`llm-opencode-go: ${field} "${diagnosticBaseURL(raw)}" is not a valid URL`);
  }
  if (url.username || url.password) {
    throw new Error(`llm-opencode-go: ${field} must not embed credentials; remove the user:password@ part`);
  }
  const display = diagnosticBaseURL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`llm-opencode-go: ${field} "${display}" must be http or https`);
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`llm-opencode-go: ${field} "${display}" must not carry a query or fragment`);
  }
  const normalized = url.toString().replace(/\/+$/, "");
  return field === "baseURL" ? migrateGatewayBaseURL(normalized) : normalized;
}
function assertApiKeyEnv(raw) {
  if (!ACCOUNT_REF_PATTERN.test(raw)) {
    throw new Error(`llm-opencode-go: apiKeyEnv "${raw}" must be an environment variable name ([A-Za-z_][A-Za-z0-9_]*)`);
  }
}
function validateGoConfig(value) {
  assertBaseURL(value.baseURL);
  assertBaseURL(value.freeBaseURL, "freeBaseURL");
  assertProxyURL(value.proxyURL);
  assertApiKeyEnv(value.apiKeyEnv);
  assertAccounts(value.accounts, value.apiKeyEnv);
}
function installHostSettings(ctx) {
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber));
    let migrating = false;
    const migrateSavedGateway = () => {
      if (migrating || !settingsCtx.settings.writable) return;
      const row = settingsCtx.settings.describe().find((row2) => row2.ns === PROFILE_ENTRY_ID);
      const raw = row?.user?.baseURL;
      if (typeof raw !== "string" || migrateGatewayBaseURL(raw) === raw) return;
      migrating = true;
      void settingsCtx.settings.mutate(
        PROFILE_ENTRY_ID,
        [{ op: "set", path: ["baseURL"], value: migrateGatewayBaseURL(raw) }],
        row.revision
      ).catch(() => {
        ctx.logger.warn("llm-opencode-go: could not save the migrated gateway address");
      }).finally(() => {
        migrating = false;
      });
    };
    settingsCtx.on("settings/document-updated", (ns) => {
      if (ns === PROFILE_ENTRY_ID) migrateSavedGateway();
    });
    migrateSavedGateway();
  });
  ctx.on("internal/config", function(_raw, next) {
    const value = next();
    if (this !== ctx.fiber) return value;
    const raw = value;
    if (typeof raw.apiKeyEnv === "string") assertApiKeyEnv(raw.apiKeyEnv);
    validateGoConfig(PlainConfig(value));
    return typeof raw.baseURL === "string" ? { ...value, baseURL: migrateGatewayBaseURL(raw.baseURL) } : value;
  });
}

// src/conversion.ts
import {
  LlmError,
  requiredImageOffload,
  projectOffloadedImages,
  IMAGE_OFFLOAD_REQUIRED_CODE,
  contentHasImage,
  offloadedImageText,
  requestImageHandleText,
  CONTEXT_WINDOW_EXCEEDED_CODE,
  EMPTY_RESPONSE_CODE,
  isContextWindowExceededError,
  isQuotaExceededError,
  QUOTA_EXCEEDED_CODE
} from "@deepseek-ai/dsh-llm";
import {
  requestImageDimensions
} from "@deepseek-ai/dsh-attachment";
import { brandString } from "@deepseek-ai/dsh-brand";
import { createHash } from "node:crypto";
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
function contextFingerprint(value) {
  const serialized = JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
  return createHash("sha256").update(serialized).digest("hex");
}
function usageContextSeed(context, provider, model) {
  return contextFingerprint([provider, model, context.systemPrompt ?? "", context.tools ?? []]);
}
function appendUsageContext(prefix, message) {
  if (message.role === "assistant") return contextFingerprint([prefix, {
    role: message.role,
    api: message.api,
    provider: message.provider,
    model: message.model,
    content: message.content,
    responseId: message.responseId,
    providerThinkingLevel: message.providerThinkingLevel
  }]);
  const { timestamp: _timestamp, ...content } = message;
  return contextFingerprint([prefix, content]);
}
var usageKeys = /* @__PURE__ */ new WeakMap();
function piContextUsageKey(context, provider, model) {
  const cached2 = usageKeys.get(context);
  if (cached2 && cached2.provider === provider && cached2.model === model) return cached2.key;
  const key = context.messages.reduce(appendUsageContext, usageContextSeed(context, provider, model));
  usageKeys.set(context, { provider, model, key });
  return key;
}
function toPiReplayState(message, requestedModel = message.model, requestedProvider = message.provider, usageContext) {
  const responseModel = message.api === "anthropic-messages" && message.model !== requestedModel ? message.model : message.responseModel;
  const { input, output, cacheRead, cacheWrite, totalTokens } = message.usage;
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
  if (hasUsage(message.usage)) {
    response.usage = { input, output, cacheRead, cacheWrite, totalTokens };
    if (usageContext !== void 0) response.usageContext = appendUsageContext(usageContext, { ...message, model: requestedModel });
  }
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
  if (response["usageContext"] !== void 0 && (typeof response["usageContext"] !== "string" || !/^[a-f0-9]{64}$/.test(response["usageContext"]))) {
    return invalidReplay("usageContext must be a SHA-256 fingerprint");
  }
  if (response["usage"] !== void 0) {
    const usage = response["usage"];
    if (typeof usage !== "object" || usage === null || Array.isArray(usage)) return invalidReplay("usage must be an object");
    for (const field of ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]) {
      const tokens = usage[field];
      if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens < 0) return invalidReplay(`usage ${field} must be a non-negative finite number`);
    }
  }
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
    usage: { ...emptyPiUsage(), ...state.response.usage },
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
function projectRequestImages(messages, policy) {
  if (policy.exact && policy.maxBytes !== void 0 || policy.maxImages !== void 0) {
    const offloadImages = requiredImageOffload(
      messages,
      { representation: "base64", maxBytes: policy.exact ? policy.maxBytes : void 0, maxImages: policy.maxImages, countQuantum: 1 },
      (block) => policy.exact ? policy.byteLength(block.attachment) : 0
    );
    if (offloadImages > 0) throw new LlmError(
      `pi-ai request images exceed the configured image count or base64 payload bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
      IMAGE_OFFLOAD_REQUIRED_CODE,
      { offloadImages }
    );
  }
  return policy.exact ? projectOffloadedImages(messages, policy.placeholder) : messages;
}
function flattenText(message) {
  return message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
}
function assertSupportedHistory(messages) {
  for (const message of messages) {
    if (message.role === "developer") throw new LlmError("Developer messages are not supported yet", "UNSUPPORTED_CONTENT");
    if (!["system", "user", "assistant", "tool"].includes(message.role)) {
      throw new LlmError(`Unsupported message role: ${message.role}`, "UNSUPPORTED_CONTENT");
    }
    if (message.content.some((block) => block.type === "tool-addition" || block.type === "tool-removal")) {
      throw new LlmError("Tool-change blocks require developer role", "UNSUPPORTED_CONTENT");
    }
    if (message.role !== "user" && message.role !== "tool" && contentHasImage(message.content)) {
      throw new LlmError(
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
    }
  }
}
async function prepareRequestImages(messages, attachments, budget, signal, maxEncodedBytes, checkBudget) {
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
        const image = await waitWithSignal(() => attachments.readImageRequest(ref, requestImageTargetFor(ref, budget), preparationSignal), preparationSignal);
        preparationSignal.throwIfAborted();
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
  await Promise.all(Array.from({ length: Math.min(4, orderedRefs.length) }, worker));
  if (failed) throw failure;
  return versions;
}
function toolsOf(options) {
  if (options.tools?.some((tool) => tool.deferLoading === true)) {
    throw new LlmError("Deferred tool loading is not supported yet", "UNSUPPORTED_CONTENT");
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
function piContext(systemPrompt, options, messages, usageContexts) {
  const tools = toolsOf(options);
  const context = {
    ...systemPrompt !== void 0 ? { systemPrompt } : {},
    messages,
    ...tools !== void 0 && tools.length > 0 ? { tools } : {}
  };
  if (usageContexts.size === 0) {
    for (const message of messages) {
      if (message.role === "assistant") message.usage = emptyPiUsage();
    }
    return context;
  }
  let prefix = usageContextSeed(context, options.provider, options.model);
  for (const message of messages) {
    prefix = appendUsageContext(prefix, message);
    if (message.role === "assistant" && usageContexts.get(message) !== prefix) message.usage = emptyPiUsage();
  }
  usageKeys.set(context, { provider: options.provider, model: options.model, key: prefix });
  return context;
}
function appendAssistant(message, messages, toolNames, usageContexts, onReplayDegrade) {
  const assistant = toPiAssistant(message, onReplayDegrade);
  const replay = message.source.replayState;
  const usageContext = replay?.response?.usageContext;
  if (typeof usageContext === "string") usageContexts.set(assistant, usageContext);
  for (const block of assistant.content) {
    if (block.type === "toolCall") toolNames.set(brandString(block.id), block.name);
  }
  messages.push(assistant);
}
function textOnlyContext(options, onReplayDegrade) {
  assertSupportedHistory(options.messages);
  const split = splitSystemPrompt(options);
  const toolNames = /* @__PURE__ */ new Map();
  const usageContexts = /* @__PURE__ */ new Map();
  const messages = [];
  for (const message of split.messages) {
    if (contentHasImage(message.content)) {
      throw new LlmError("pi-ai image conversion requires the durable attachment service", "UNSUPPORTED_CONTENT");
    }
    if (message.role === "tool") {
      const tool = message;
      messages.push({
        role: "toolResult",
        toolCallId: tool.toolCallId,
        toolName: toolNames.get(tool.toolCallId) ?? "unknown",
        content: [{ type: "text", text: flattenText(tool) || "(no output)" }],
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
      appendAssistant(message, messages, toolNames, usageContexts, onReplayDegrade);
      continue;
    }
    messages.push({ role: "user", content: flattenText(message), timestamp: 0 });
  }
  return piContext(split.systemPrompt, options, messages, usageContexts);
}
function requestImageTargetFor(ref, budget) {
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
  const requestImages = await prepareRequestImages(requestMessages, attachments, requestImagePolicy, options.signal, maxRequestImageBytes, (versions) => {
    projectRequestImages(requestMessages, {
      ...projection,
      exact: true,
      byteLength: (ref) => versions.get(ref.attachmentId)?.bytes ?? 0
    });
  });
  const exactMessages = projectRequestImages(requestMessages, {
    ...projection,
    exact: true,
    byteLength: (ref) => requestImages.get(ref.attachmentId).bytes
  });
  const toolNames = /* @__PURE__ */ new Map();
  const usageContexts = /* @__PURE__ */ new Map();
  const messages = [];
  for (const message of exactMessages) {
    if (message.role === "tool") {
      const tool = message;
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
      appendAssistant(message, messages, toolNames, usageContexts, onReplayDegrade);
      continue;
    }
    const content = await userContent(message.content, requestImages, resolveImageAccess);
    messages.push({ role: "user", content, timestamp: 0 });
  }
  return piContext(split.systemPrompt, options, messages, usageContexts);
}
function mapUsage(usage) {
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.totalTokens,
    ...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
    ...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {}
  };
}
function hasUsage(usage) {
  return usage.input > 0 || usage.output > 0 || usage.cacheRead > 0 || usage.cacheWrite > 0 || usage.totalTokens > 0;
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
var MIN_ANSWER_ALLOWANCE = 1024;
function mapStopReason(message, contextWindow, reservedMaxTokens) {
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
      if (message.content.length === 0) {
        const raiseOutputLimit = reservedMaxTokens !== void 0 && (reservedMaxTokens <= MIN_ANSWER_ALLOWANCE || message.usage.output >= reservedMaxTokens);
        return {
          kind: "error",
          failure: {
            message: raiseOutputLimit ? `model "${message.model}" produced no content at its ${reservedMaxTokens}-token output allowance. Increase this model's "max output" in the plugin settings, then retry` : `model "${message.model}" produced no content at the output cap${contextWindow === void 0 ? "" : ` in a ${contextWindow}-token window`}. The prompt may leave too little room for an answer. Compact the context (/compact) or lower this model's "max output" in the plugin settings, then retry`,
            code: "INVALID_REQUEST"
          }
        };
      }
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
async function* toStreamChunks(events, contextWindow, callerSignal, requestedModel, requestedProvider, reservedMaxTokens, usageContext) {
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
          id: brandString(known?.id ?? ""),
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
            id: brandString(event.toolCall.id),
            name: event.toolCall.name,
            // pi-ai hands back the PARSED arguments; the harness vocabulary
            // keeps the raw string.
            arguments: JSON.stringify(event.toolCall.arguments)
          }
        };
        break;
      case "done": {
        const reason = mapStopReason(event.message, contextWindow, reservedMaxTokens);
        if (reason.kind !== "error" || hasUsage(event.message.usage)) {
          yield { type: "usage", usage: mapUsage(event.message.usage) };
        }
        yield {
          type: "finish",
          reason,
          replayState: toPiReplayState(event.message, requestedModel, requestedProvider, usageContext)
        };
        return;
      }
      case "error":
        if (hasUsage(event.error.usage)) yield { type: "usage", usage: mapUsage(event.error.usage) };
        yield {
          type: "finish",
          reason: mapStopReason(
            callerSignal?.aborted ? { ...event.error, stopReason: "aborted" } : event.error,
            contextWindow,
            reservedMaxTokens
          )
        };
        return;
      default: {
        const unsupported = event;
        throw new LlmError(`Unsupported pi-ai stream event: ${unsupported.type}`, "UNSUPPORTED_CONTENT");
      }
    }
  }
  throw new LlmError("pi-ai event stream ended without done/error", "STREAM_CLOSED");
}

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

// node_modules/opencode-go-pi-ai/dist/utils/openrouter-cost.js
function isValidCost(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function isOpenRouterModel(model) {
  return model.provider === "openrouter" || model.baseUrl.includes("openrouter.ai");
}
function applyOpenRouterReportedCost(usage, reported) {
  if (!isValidCost(reported.cost))
    return;
  if (reported.is_byok === false) {
    usage.cost.total = reported.cost;
    usage.cost.totalFromProvider = true;
    return;
  }
  if (reported.is_byok === true) {
    const details = reported.cost_details;
    if (!details)
      return;
    let upstreamCost = details.upstream_inference_cost;
    if (upstreamCost === null) {
      if (!isValidCost(details.upstream_inference_prompt_cost) || !isValidCost(details.upstream_inference_completions_cost)) {
        return;
      }
      upstreamCost = details.upstream_inference_prompt_cost + details.upstream_inference_completions_cost;
    }
    if (!isValidCost(upstreamCost))
      return;
    usage.cost.total = reported.cost + upstreamCost;
    usage.cost.totalFromProvider = true;
  }
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
function convertImageBlock(image) {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: image.mimeType,
      data: image.data
    }
  };
}
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
    return convertImageBlock(block);
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
  const stream5 = new AssistantMessageEventStream();
  const normalizedContext = resolveTranscript(context, getAnthropicCompat(model).supportsMidConvoSystemMessages);
  const currentTools = getCurrentTools(normalizedContext.messages);
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
        const created = createClient(model, apiKey, options?.headers, options?.fetch, copilotDynamicHeaders, cacheSessionId, federation, options?.identity);
        client = created.client;
        isOAuth = created.isOAuthToken;
      }
      const requestOptions = {
        ...options?.signal ? { signal: options.signal } : {},
        ...options?.timeoutMs !== void 0 ? { timeout: options.timeoutMs } : {},
        maxRetries: 0
      };
      let disablePreferredStrictTools = false;
      let response;
      for (; ; ) {
        options?.signal?.throwIfAborted();
        const built = buildParams(model, normalizedContext, isOAuth, options, disablePreferredStrictTools);
        if (built.providerThinkingLevel)
          output.providerThinkingLevel = built.providerThinkingLevel;
        let params = built.params;
        const nextParams = await options?.onPayload?.(params, model);
        if (nextParams !== void 0) {
          params = { ...nextParams, stream: true };
        }
        try {
          response = await retryProviderRequest(() => client.beta.messages.create(params, requestOptions).asResponse(), {
            maxRetries: options?.maxRetries,
            maxRetryDelayMs: options?.maxRetryDelayMs,
            signal: options?.signal
          });
          break;
        } catch (error) {
          if (options?.signal?.aborted || disablePreferredStrictTools || !built.hasPreferredStrictTools || !(error instanceof Anthropic.APIError) || error.status !== 400 || error.type !== "invalid_request_error" || !isStrictToolLimitErrorMessage(error.message)) {
            throw error;
          }
          disablePreferredStrictTools = true;
          appendAssistantMessageDiagnostic(output, {
            type: "anthropic_strict_tools_fallback",
            timestamp: Date.now(),
            error: { message: error.message },
            details: { reason: "strict_tool_limits_exceeded" }
          });
        }
      }
      await options?.onResponse?.({ status: response.status, headers: headersToRecord(response.headers) }, model);
      stream5.push({ type: "start", partial: output });
      const openBlocks = /* @__PURE__ */ new Map();
      const openBlock = (anthropicIndex) => {
        const open = openBlocks.get(anthropicIndex);
        return open === void 0 ? void 0 : { ...open, block: output.content[open.contentIndex] };
      };
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
            output.content.push({ type: "text", text: event.content_block.text ?? "" });
            openBlocks.set(event.index, { contentIndex: output.content.length - 1 });
            stream5.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output });
          } else if (event.content_block.type === "thinking") {
            output.content.push({
              type: "thinking",
              thinking: event.content_block.thinking ?? "",
              thinkingSignature: event.content_block.signature ?? ""
            });
            openBlocks.set(event.index, { contentIndex: output.content.length - 1 });
            stream5.push({ type: "thinking_start", contentIndex: output.content.length - 1, partial: output });
          } else if (event.content_block.type === "redacted_thinking") {
            output.content.push({
              type: "thinking",
              thinking: "[Reasoning redacted]",
              thinkingSignature: event.content_block.data,
              redacted: true
            });
            openBlocks.set(event.index, { contentIndex: output.content.length - 1 });
            stream5.push({ type: "thinking_start", contentIndex: output.content.length - 1, partial: output });
          } else if (event.content_block.type === "tool_use") {
            output.content.push({
              type: "toolCall",
              id: event.content_block.id,
              name: isOAuth ? fromClaudeCodeName(event.content_block.name, currentTools) : event.content_block.name,
              arguments: event.content_block.input ?? {}
            });
            openBlocks.set(event.index, {
              contentIndex: output.content.length - 1,
              arguments: new ToolCallArgumentsStream()
            });
            stream5.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output });
          }
        } else if (event.type === "content_block_delta") {
          const open = openBlock(event.index);
          if (event.delta.type === "text_delta") {
            if (open?.block.type === "text") {
              open.block.text += event.delta.text;
              stream5.push({
                type: "text_delta",
                contentIndex: open.contentIndex,
                delta: event.delta.text,
                partial: output
              });
            }
          } else if (event.delta.type === "thinking_delta") {
            if (open?.block.type === "thinking") {
              open.block.thinking += event.delta.thinking;
              stream5.push({
                type: "thinking_delta",
                contentIndex: open.contentIndex,
                delta: event.delta.thinking,
                partial: output
              });
            }
          } else if (event.delta.type === "input_json_delta") {
            if (open?.block.type === "toolCall" && open.arguments !== void 0) {
              open.block.arguments = open.arguments.append(event.delta.partial_json);
              stream5.push({
                type: "toolcall_delta",
                contentIndex: open.contentIndex,
                delta: event.delta.partial_json,
                partial: output
              });
            }
          } else if (event.delta.type === "signature_delta") {
            if (open?.block.type === "thinking") {
              open.block.thinkingSignature = open.block.thinkingSignature || "";
              open.block.thinkingSignature += event.delta.signature;
            }
          }
        } else if (event.type === "content_block_stop") {
          const open = openBlock(event.index);
          openBlocks.delete(event.index);
          if (open) {
            const { block, contentIndex: index } = open;
            if (block.type === "text") {
              stream5.push({
                type: "text_end",
                contentIndex: index,
                content: block.text,
                partial: output
              });
            } else if (block.type === "thinking") {
              stream5.push({
                type: "thinking_end",
                contentIndex: index,
                content: block.thinking,
                partial: output
              });
            } else if (block.type === "toolCall" && open.arguments !== void 0) {
              Object.assign(block, open.arguments.finish());
              stream5.push({
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
          if (isOpenRouterModel(model) && event.usage) {
            applyOpenRouterReportedCost(output.usage, event.usage);
          }
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
      stream5.push({ type: "done", reason: output.stopReason, message: output });
      stream5.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      stream5.push({ type: "error", reason: output.stopReason, error: output });
      stream5.end();
    }
  })();
  return stream5;
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
function createClient(model, apiKey, optionsHeaders, fetch, dynamicHeaders, sessionId, federation, identity) {
  if (model.provider === "github-copilot") {
    const client2 = new PiAnthropic({
      apiKey: null,
      authToken: apiKey ?? null,
      baseURL: model.baseUrl,
      dangerouslyAllowBrowser: true,
      fetch,
      defaultHeaders: mergeHeaders(getIdentityHeaders(model, identity), {
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
      defaultHeaders: mergeHeaders({
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
  const defaultHeaders = mergeHeaders(getIdentityHeaders(model, identity), {
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
function buildParams(model, context, isOAuthToken2, options, disablePreferredStrictTools = false) {
  const { cacheControl } = getCacheControl(model, options?.cacheRetention, options?.env);
  const compat = getAnthropicCompat(model);
  const initialSystemMessage = getInitialSystemMessage(context.messages);
  const initialSystemText = initialSystemMessage ? getSystemMessageText(initialSystemMessage) : "";
  const transformedMessages = transformMessages(context.messages, model, normalizeToolCallId);
  const conversationMessages = initialSystemMessage ? transformedMessages.slice(1) : transformedMessages;
  let hasPreferredStrictTools = false;
  const convertToolDefinitions = (tools, toolCacheControl2) => {
    const definitions = convertTools(tools, isOAuthToken2, compat.supportsEagerToolInputStreaming, compat.supportsStrictTools, toolCacheControl2, disablePreferredStrictTools);
    if (definitions.some((definition, index) => definition.strict === true && prefersJsonSchemaStrictSampling(tools[index]))) {
      hasPreferredStrictTools = true;
    }
    return definitions;
  };
  const initialTools = initialSystemMessage?.toolsAdded ?? [];
  const nativeToolChanges = compat.supportsMidConvoSystemMessages && compat.supportsMidConvoToolChanges && initialTools.length > 0;
  const thinkingDisabled = model.reasoning && options?.thinkingEnabled === false && model.thinkingLevelMap?.off !== null;
  const effortMessages = model.compat?.supportsMidConvoEffort === true && !thinkingDisabled;
  const converted = convertMessages(conversationMessages, isOAuthToken2, cacheControl, compat.allowEmptySignature, effortMessages ? model.provider : void 0, nativeToolChanges ? convertToolDefinitions : void 0);
  const activeEffort = options?.effort ?? "high";
  const betaFeatures = getBetaFeatures(model, context, isOAuthToken2, nativeToolChanges, options);
  const params = {
    model: model.id,
    messages: effortMessages ? insertThinkingLevelMessages(converted, activeEffort) : converted.messages,
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
    params.tools = [...convertToolDefinitions(initialTools, toolCacheControl), DEFERRED_TOOL_PLACEHOLDER];
  } else {
    const tools = getCurrentTools(context.messages);
    if (tools.length > 0) {
      params.tools = convertToolDefinitions(tools, toolCacheControl);
    }
  }
  if (thinkingDisabled) {
    params.thinking = { type: "disabled" };
  } else if (effortMessages) {
    params.thinking = {
      type: "adaptive",
      display: options?.thinkingDisplay ?? "summarized",
      block_binding: { prefix_mismatch_behavior: "drop_block" }
    };
    params.output_config = { effort: "low" };
  } else if (model.reasoning && options?.thinkingEnabled) {
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
  return { params, hasPreferredStrictTools, providerThinkingLevel: effortMessages ? activeEffort : void 0 };
}
function normalizeToolCallId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}
function convertToolResult(msg, content = msg.content) {
  return {
    type: "tool_result",
    tool_use_id: msg.toolCallId,
    content: convertContentBlocks(content),
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
            return convertImageBlock(item);
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
      flushPendingSystemMessages();
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
      const errorImages = [];
      let j = i;
      while (j < transformedMessages.length && transformedMessages[j].role === "toolResult") {
        const toolMsg = transformedMessages[j];
        const split = splitErrorToolResultImages(toolMsg);
        toolResults.push(convertToolResult(toolMsg, split?.content));
        if (split) {
          errorImages.push({ type: "text", text: split.caption }, ...split.images.map(convertImageBlock));
        }
        j++;
      }
      i = j - 1;
      params.push({
        role: "user",
        content: [...toolResults, ...errorImages]
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
function convertTools(tools, isOAuthToken2, supportsEagerToolInputStreaming, supportsStrictTools, cacheControl, disablePreferredStrictTools = false) {
  if (!tools)
    return [];
  return tools.map((tool, index) => {
    const strict = disablePreferredStrictTools && prefersJsonSchemaStrictSampling(tool) ? void 0 : resolveJsonSchemaStrictSampling(tool, supportsStrictTools, isAnthropicStrictUnsupportedKeyword);
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
  const stream5 = new AssistantMessageEventStream();
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
      const client = createClient2(model, normalizedContext, apiKey, options?.headers, options?.identity, options?.fetch, cacheSessionId, compat);
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
      stream5.push({ type: "start", partial: output });
      let textBlock = null;
      let thinkingBlock = null;
      let hasFinishReason = false;
      const toolCallBlocksByIndex = /* @__PURE__ */ new Map();
      const toolCallBlocksById = /* @__PURE__ */ new Map();
      const toolCallStates = /* @__PURE__ */ new Map();
      const blocks = output.content;
      const getContentIndex = (block) => blocks.indexOf(block);
      const customInput2 = (property) => ({
        kind: "custom",
        property,
        buffer: { input: "", started: false, closed: false }
      });
      const finishBlock = (block) => {
        const contentIndex = getContentIndex(block);
        if (contentIndex === -1) {
          return;
        }
        if (block.type === "text") {
          stream5.push({
            type: "text_end",
            contentIndex,
            content: block.text,
            partial: output
          });
        } else if (block.type === "thinking") {
          applyStreamedReasoningDetails(block);
          stream5.push({
            type: "thinking_end",
            contentIndex,
            content: block.thinking,
            partial: output
          });
        } else if (block.type === "toolCall") {
          const input = toolCallStates.get(block).input;
          toolCallStates.delete(block);
          if (input.kind === "custom") {
            const delta = closeGrammarToolInputJson(input.buffer, input.property, void 0);
            if (delta !== void 0) {
              stream5.push({
                type: "toolcall_delta",
                contentIndex,
                delta,
                partial: output
              });
            }
          } else {
            Object.assign(block, input.arguments.finish());
          }
          stream5.push({
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
          stream5.push({ type: "text_start", contentIndex: getContentIndex(textBlock), partial: output });
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
          stream5.push({ type: "thinking_start", contentIndex: getContentIndex(thinkingBlock), partial: output });
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
          block = {
            type: "toolCall",
            id: toolCall.id || "",
            name: name2,
            arguments: customInputProperty !== void 0 ? { [customInputProperty]: "" } : {}
          };
          toolCallStates.set(block, {
            streamIndex,
            input: customInputProperty !== void 0 ? customInput2(customInputProperty) : { kind: "json", arguments: new ToolCallArgumentsStream() }
          });
          if (streamIndex !== void 0) {
            toolCallBlocksByIndex.set(streamIndex, block);
          }
          if (toolCall.id) {
            toolCallBlocksById.set(toolCall.id, block);
          }
          blocks.push(block);
          stream5.push({
            type: "toolcall_start",
            contentIndex: getContentIndex(block),
            partial: output
          });
        }
        const state = toolCallStates.get(block);
        if (streamIndex !== void 0 && state.streamIndex === void 0) {
          state.streamIndex = streamIndex;
          toolCallBlocksByIndex.set(streamIndex, block);
        }
        if (toolCall.id) {
          toolCallBlocksById.set(toolCall.id, block);
        }
        if (!block.name && name2) {
          block.name = name2;
        }
        if (toolCall.custom && !toolCall.function && state.input.kind !== "custom") {
          const customInputProperty = grammarToolInputProperties.get(block.name) ?? "input";
          block.arguments = { [customInputProperty]: "" };
          state.input = customInput2(customInputProperty);
        }
        return { block, state };
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
              stream5.push({
                type: "thinking_delta",
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
          if (choice.delta.content !== null && choice.delta.content !== void 0 && choice.delta.content.length > 0) {
            const block = ensureTextBlock();
            block.text += choice.delta.content;
            stream5.push({
              type: "text_delta",
              contentIndex: getContentIndex(block),
              delta: choice.delta.content,
              partial: output
            });
          }
          if (choice?.delta?.tool_calls) {
            for (const toolCall of choice.delta.tool_calls) {
              const { block, state } = ensureToolCallBlock(toolCall);
              if (!block.id && toolCall.id) {
                block.id = toolCall.id;
                toolCallBlocksById.set(toolCall.id, block);
              }
              const name2 = toolCall.function?.name ?? toolCall.custom?.name;
              if (!block.name && name2) {
                block.name = name2;
              }
              let delta = "";
              const input = state.input;
              if (toolCall.function?.arguments && input.kind === "json") {
                delta = toolCall.function.arguments;
                block.arguments = input.arguments.append(delta);
              } else if (toolCall.custom?.input && input.kind === "custom") {
                delta = appendGrammarToolInputJsonDelta(input.buffer, input.property, toolCall.custom.input) ?? "";
                block.arguments = { [input.property]: input.buffer.input };
              }
              stream5.push({
                type: "toolcall_delta",
                contentIndex: getContentIndex(block),
                delta,
                partial: output
              });
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
      stream5.push({ type: "done", reason: output.stopReason, message: output });
      stream5.end();
    } catch (error) {
      for (const block of output.content) {
        if (block.type === "thinking") {
          applyStreamedReasoningDetails(block);
        }
      }
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = formatProviderError(normalizeProviderError(error));
      const rawMetadata = error?.error?.metadata?.raw;
      if (rawMetadata && !output.errorMessage.includes(String(rawMetadata))) {
        output.errorMessage += `
${rawMetadata}`;
      }
      stream5.push({ type: "error", reason: output.stopReason, error: output });
      stream5.end();
    }
  })();
  return stream5;
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
function createClient2(model, context, apiKey, optionsHeaders, identity, fetch, sessionId, compat = getCompat(model)) {
  const headers = { ...getIdentityHeaders(model, identity), ...model.headers };
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
  const transcriptTools = resolveTranscriptTools(context.messages, compat.supportsMidConvoSystemMessages === true && compat.supportsMidConvoToolAdditions === true ? "additions" : "none");
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
  const transcriptTools = resolveTranscriptTools(normalizedContext.messages, compat.supportsMidConvoSystemMessages === true && compat.supportsMidConvoToolAdditions === true ? "additions" : "none");
  const instructionRole = model.reasoning && compat.supportsDeveloperRole ? "developer" : "system";
  let lastRole = null;
  let systemIndex = 0;
  for (let i = 0; i < transformedMessages.length; i++) {
    const msg = transformedMessages[i];
    if (compat.requiresAssistantAfterToolResult && lastRole === "toolResult" && msg.role === "user") {
      params.push({
        role: "assistant",
        content: "I have processed the tool results."
      });
    }
    if (msg.role === "system") {
      const addedTools = systemIndex++ >= transcriptTools.foldedSystemMessages ? msg.toolsAdded ?? [] : [];
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
        const hasText = textResult.trim().length > 0;
        const toolResultText = hasText ? textResult : hasImages ? "(see attached image)" : "(no tool output)";
        const toolResultMsg = {
          role: "tool",
          content: sanitizeSurrogates(toolResultText),
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
  if (isOpenRouterModel(model)) {
    applyOpenRouterReportedCost(usage, rawUsage);
  }
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
  const hasText = textResult.trim().length > 0;
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
function getResponsesToolSupport(options) {
  if (options.supportsMidConvoSystemMessages && options.supportsAdditionalTools)
    return "changes";
  return options.supportsToolSearch ? "additions" : "none";
}
function renderIncrementalToolsNotice(unavailable) {
  const notice = "This is an incremental tools update. Previously declared tools remain available unless explicitly marked unavailable. A tool declared again here is available again, and its latest definition replaces the earlier one.";
  return unavailable.size > 0 ? `${notice}
Still unavailable: ${[...unavailable].join(", ")}.` : notice;
}
function renderToolRemovalNotice(names) {
  return `The following tools are no longer available. Do not call them:
${names.map((name2) => `- ${name2}`).join("\n")}`;
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
  const toolSupport = getResponsesToolSupport(options ?? {});
  const transcriptTools = resolveTranscriptTools(normalizedContext.messages, toolSupport);
  let declaredAdditionalTools = false;
  const unavailableTools = /* @__PURE__ */ new Set();
  const appendSystemToolAdditions = (message, seed) => {
    const tools = message.toolsAdded ?? [];
    for (const tool of tools)
      unavailableTools.delete(tool.name);
    if (tools.length === 0)
      return;
    if (toolSupport === "changes") {
      if (declaredAdditionalTools) {
        messages.push({ role: instructionRole, content: renderIncrementalToolsNotice(unavailableTools) });
      }
      declaredAdditionalTools = true;
      messages.push({
        type: "additional_tools",
        role: "developer",
        tools: convertResponsesTools(tools, options?.toolOptions)
      });
      return;
    }
    if (toolSupport !== "additions")
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
      tools: convertResponsesTools(tools, { ...options?.toolOptions, toolSearchResult: true })
    });
  };
  const includeInitialSystemMessage = options?.includeSystemPrompt ?? true;
  const pushConfigurationUpdate = (effort) => {
    messages.push({
      type: "configuration_update",
      reasoning: { effort }
    });
  };
  const compat = model.compat;
  const instructionRole = model.reasoning && compat?.supportsDeveloperRole !== false ? "developer" : "system";
  let msgIndex = 0;
  let sourceIndex = 0;
  let systemIndex = 0;
  for (const msg of transformedMessages) {
    const isLeadingSystemMessage = sourceIndex++ === 0 && msg.role === "system";
    if (msg.role === "system") {
      const anchorsToolChanges = systemIndex++ >= transcriptTools.foldedSystemMessages;
      if (anchorsToolChanges)
        appendSystemToolAdditions(msg, `system:${msgIndex}`);
      if (!isLeadingSystemMessage || includeInitialSystemMessage) {
        const parts = [isLeadingSystemMessage ? getSystemMessageText(msg) : renderSystemMessageUpdate(msg)];
        if (anchorsToolChanges) {
          const added = new Set((msg.toolsAdded ?? []).map((tool) => tool.name));
          const removed = (msg.toolsRemoved ?? []).map((tool) => tool.name).filter((name2) => !added.has(name2));
          if (removed.length > 0)
            parts.push(renderToolRemovalNotice(removed));
          for (const name2 of removed)
            unavailableTools.add(name2);
        }
        const text = parts.filter((part) => part.length > 0).join("\n\n");
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
      if (options?.configurationUpdateEffort !== void 0 && isSameModel && msg.providerThinkingLevel !== void 0) {
        pushConfigurationUpdate(msg.providerThinkingLevel);
      }
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
  if (options?.configurationUpdateEffort !== void 0)
    pushConfigurationUpdate(options.configurationUpdateEffort);
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
async function processResponsesStream(openaiStream, output, stream5, model, options) {
  let sawTerminalResponseEvent = false;
  const outputSlots = /* @__PURE__ */ new Map();
  const unfinishedToolCalls = /* @__PURE__ */ new Set();
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
    stream5.push({
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
      stream5.push({ type: "thinking_start", contentIndex: slot.contentIndex, partial: output });
      return slot;
    }
    if (item.type === "message") {
      applyMessagePhaseStopReason(item);
      const block = { type: "text", text: "" };
      output.content.push(block);
      const slot = { type: "text", block, contentIndex: output.content.length - 1 };
      outputSlots.set(outputIndex, slot);
      stream5.push({ type: "text_start", contentIndex: slot.contentIndex, partial: output });
      return slot;
    }
    if (item.type === "function_call") {
      const args = new ToolCallArgumentsStream();
      const block = {
        type: "toolCall",
        id: `${item.call_id}|${item.id}`,
        name: item.name,
        arguments: item.arguments ? args.append(item.arguments) : {},
        ...item.namespace !== void 0 ? { namespace: item.namespace } : {}
      };
      output.content.push(block);
      unfinishedToolCalls.add(block);
      const slot = {
        type: "toolCall",
        block,
        contentIndex: output.content.length - 1,
        input: { kind: "json", arguments: args }
      };
      outputSlots.set(outputIndex, slot);
      stream5.push({ type: "toolcall_start", contentIndex: slot.contentIndex, partial: output });
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
        ...item.namespace !== void 0 ? { namespace: item.namespace } : {}
      };
      output.content.push(block);
      unfinishedToolCalls.add(block);
      const slot = {
        type: "toolCall",
        block,
        contentIndex: output.content.length - 1,
        input: customInput(inputProperty, input)
      };
      outputSlots.set(outputIndex, slot);
      stream5.push({ type: "toolcall_start", contentIndex: slot.contentIndex, partial: output });
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
      stream5.push({
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
      stream5.push({
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
      stream5.push({
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
      stream5.push({
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
      stream5.push({
        type: "text_delta",
        contentIndex: slot.contentIndex,
        delta: event.delta,
        partial: output
      });
    } else if (event.type === "response.function_call_arguments.delta") {
      const slot = getSlot(event.output_index, "toolCall");
      if (slot?.input.kind !== "json")
        continue;
      slot.block.arguments = slot.input.arguments.append(event.delta);
      pushToolCallDelta(slot, event.delta);
    } else if (event.type === "response.function_call_arguments.done") {
      const slot = getSlot(event.output_index, "toolCall");
      if (slot?.input.kind !== "json")
        continue;
      const replaced = slot.input.arguments.replace(event.arguments);
      slot.block.arguments = replaced.arguments;
      if (replaced.delta)
        pushToolCallDelta(slot, replaced.delta);
    } else if (event.type === "response.custom_tool_call_input.delta") {
      const slot = getSlot(event.output_index, "toolCall");
      if (slot?.input.kind !== "custom")
        continue;
      pushToolCallDelta(slot, appendCustomInput(slot.block, slot.input, event.delta));
    } else if (event.type === "response.custom_tool_call_input.done") {
      const slot = getSlot(event.output_index, "toolCall");
      if (slot?.input.kind !== "custom")
        continue;
      pushToolCallDelta(slot, closeCustomInput(slot.block, slot.input, event.input));
    } else if (event.type === "response.output_item.done") {
      const item = event.item;
      applyMessagePhaseStopReason(item);
      const slot = getOrCreateSlot(event.output_index, item);
      if (item.type === "reasoning" && slot?.type === "thinking") {
        const summaryText = item.summary?.map((s) => s.text).join("\n\n") || "";
        const contentText = item.content?.map((c) => c.text).join("\n\n") || "";
        slot.block.thinking = summaryText || contentText || slot.block.thinking;
        slot.block.thinkingSignature = JSON.stringify(item);
        reasoningBlocksById.set(item.id, slot.block);
        stream5.push({
          type: "thinking_end",
          contentIndex: slot.contentIndex,
          content: slot.block.thinking,
          partial: output
        });
        outputSlots.delete(event.output_index);
      } else if (item.type === "message" && slot?.type === "text") {
        slot.block.text = item.content?.map((c) => c.type === "output_text" ? c.text : c.refusal).join("") || "";
        slot.block.textSignature = encodeTextSignatureV1(item.id, item.phase ?? void 0);
        stream5.push({
          type: "text_end",
          contentIndex: slot.contentIndex,
          content: slot.block.text,
          partial: output
        });
        outputSlots.delete(event.output_index);
      } else if (item.type === "function_call" && slot?.type === "toolCall" && slot.input.kind === "json") {
        if (item.arguments)
          slot.input.arguments.replace(item.arguments);
        Object.assign(slot.block, slot.input.arguments.finish());
        if (item.namespace !== void 0)
          slot.block.namespace = item.namespace;
        unfinishedToolCalls.delete(slot.block);
        stream5.push({
          type: "toolcall_end",
          contentIndex: slot.contentIndex,
          toolCall: slot.block,
          partial: output
        });
        outputSlots.delete(event.output_index);
      } else if (item.type === "custom_tool_call" && slot?.type === "toolCall" && slot.input.kind === "custom") {
        pushToolCallDelta(slot, closeCustomInput(slot.block, slot.input, item.input));
        if (item.namespace !== void 0)
          slot.block.namespace = item.namespace;
        unfinishedToolCalls.delete(slot.block);
        stream5.push({
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
    for (const toolCall of unfinishedToolCalls) {
      throw new Error(`OpenAI Responses stream completed with an unfinished tool call: ${toolCall.name} (${toolCall.id})`);
    }
  }
}
function customInput(property, initialInput) {
  const buffer = { input: "", started: false, closed: false };
  return {
    kind: "custom",
    property,
    buffer,
    unsent: appendGrammarToolInputJsonDelta(buffer, property, initialInput) ?? ""
  };
}
function appendCustomInput(block, input, delta) {
  return sendCustomInput(block, input, appendGrammarToolInputJsonDelta(input.buffer, input.property, delta));
}
function closeCustomInput(block, input, finalInput) {
  return sendCustomInput(block, input, closeGrammarToolInputJson(input.buffer, input.property, finalInput));
}
function sendCustomInput(block, input, jsonDelta) {
  block.arguments = { [input.property]: input.buffer.input };
  if (input.unsent === "")
    return jsonDelta;
  const sent = input.unsent + (jsonDelta ?? "");
  input.unsent = "";
  return sent;
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
var CHATGPT_WORKSPACE_LIMIT_HINT = "You've reached your ChatGPT workspace's usage limit. Ask your workspace admin to increase it at admin.openai.com \u2192 Workspace \u2192 Usage limits.";
var CONFIGURATION_UPDATE_REQUEST_EFFORT = "medium";
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
    supportsMaxOutputTokens: model.compat?.supportsMaxOutputTokens ?? true,
    supportsMidConvoEffort: model.compat?.supportsMidConvoEffort ?? false
  };
}
function getConfigurationUpdateEffort(model, options, compat) {
  if (!compat.supportsMidConvoEffort || !options?.reasoningEffort || // Sign in with ChatGPT rejects configuration_update items.
  isChatGPTSignIn(model, options.apiKey)) {
    return void 0;
  }
  return model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort;
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
  const stream5 = new AssistantMessageEventStream();
  const normalizedContext = resolveTranscript(context, getCompat2(model).supportsMidConvoSystemMessages);
  (async () => {
    const compat = getCompat2(model);
    const configurationUpdateEffort = getConfigurationUpdateEffort(model, options, compat);
    const output = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      ...configurationUpdateEffort === void 0 ? {} : { providerThinkingLevel: configurationUpdateEffort },
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
      const grammarToolInputProperties = createGrammarToolInputProperties(getDeclaredTools(normalizedContext.messages), compat.supportsOpenAIGrammarTools);
      const client = createClient3(model, normalizedContext, apiKey, options?.headers, options?.identity, options?.fetch, cacheSessionId);
      let params = buildParams3(model, normalizedContext, options, compat, grammarToolInputProperties, configurationUpdateEffort);
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
      stream5.push({ type: "start", partial: output });
      await processResponsesStream(openaiStream, output, stream5, model, {
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
      stream5.push({ type: "done", reason: output.stopReason, message: output });
      stream5.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      const errorMessage = formatProviderError(normalizeProviderError(error), `${model.provider === "openai" ? "OpenAI" : model.provider} API error`);
      if (errorMessage.includes("subscription_sharing_usage_limit_exceeded")) {
        output.errorMessage = `${errorMessage}
Check your ChatGPT usage: ${CHATGPT_USAGE_URL}`;
      } else if (errorMessage.includes("subscription_sharing_workplace_individual_usage_limit_exceeded")) {
        output.errorMessage = `${errorMessage}
${CHATGPT_WORKSPACE_LIMIT_HINT}`;
      } else {
        output.errorMessage = errorMessage;
      }
      stream5.push({ type: "error", reason: output.stopReason, error: output });
      stream5.end();
    }
  })();
  return stream5;
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
function createClient3(model, context, apiKey, optionsHeaders, identity, fetch, sessionId) {
  const compat = getCompat2(model);
  const headers = { ...getIdentityHeaders(model, identity), ...model.headers };
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
function buildParams3(model, context, options, compat, grammarToolInputProperties, configurationUpdateEffort) {
  const transcriptTools = resolveTranscriptTools(context.messages, getResponsesToolSupport(compat));
  const messages = convertResponsesMessages(model, context, OPENAI_TOOL_CALL_PROVIDERS, {
    grammarToolInputProperties,
    supportsMidConvoSystemMessages: compat.supportsMidConvoSystemMessages,
    supportsAdditionalTools: compat.supportsAdditionalTools,
    supportsToolSearch: compat.supportsToolSearch,
    toolOptions: {
      supportsStrictMode: compat.supportsStrictMode,
      supportsOpenAIGrammarTools: compat.supportsOpenAIGrammarTools
    },
    configurationUpdateEffort
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
      const requestedEffort = options?.reasoningEffort ? model.thinkingLevelMap?.[options.reasoningEffort] ?? options.reasoningEffort : reasoningEffort;
      const effort = configurationUpdateEffort === void 0 ? requestedEffort : CONFIGURATION_UPDATE_REQUEST_EFFORT;
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

// src/google.ts
var google_exports = {};
__export(google_exports, {
  stream: () => stream4,
  streamSimple: () => streamSimple4
});
var cached;
var load = () => cached ??= import("./chunk-CQPNNKSY.js").catch((error) => {
  cached = void 0;
  throw error;
});
var SKIP_THOUGHT_SIGNATURE = "skip_thought_signature_validator";
function addUnsignedToolCallFallbacks(payload, modelId) {
  const major = /^gemini(?:-live)?-(\d+)(?:-|$)/i.exec(modelId);
  if (major === null || Number(major[1]) < 3 || !payload || typeof payload !== "object") return;
  const contents = payload.contents;
  if (!Array.isArray(contents)) return;
  for (const content of contents) {
    if (!content || typeof content !== "object") continue;
    const parts = content.parts;
    if (!Array.isArray(parts)) continue;
    const calls = parts.filter((part) => !!part && typeof part === "object" && part.functionCall !== void 0);
    if (calls.some((part) => part.thoughtSignature !== void 0)) continue;
    for (const part of calls) part.thoughtSignature = SKIP_THOUGHT_SIGNATURE;
  }
}
var stream4 = (model, context, options) => lazyStream(model, async () => {
  const google = await load();
  return withGoogleFetch(options, () => google.stream(model, context, { ...options, fetch: void 0 }));
});
var streamSimple4 = (model, context, options) => lazyStream(model, async () => {
  const google = await load();
  return withGoogleFetch(options, () => google.streamSimple(model, context, {
    ...options,
    fetch: void 0,
    async onPayload(payload, wireModel) {
      addUnsignedToolCallFallbacks(payload, model.id);
      const control = model.reasoningControl;
      if (!control || !payload || typeof payload !== "object") return options?.onPayload?.(payload, wireModel);
      const body = payload;
      const level = options?.reasoning;
      const budget = level === "minimal" || level === "low" || level === "medium" || level === "high" ? options?.thinkingBudgets?.[level] : void 0;
      const thinkingConfig = level === void 0 ? { thinkingBudget: 0 } : budget !== void 0 ? {
        includeThoughts: true,
        thinkingBudget: Math.min(budget, Math.max(0, (body.config?.maxOutputTokens ?? model.maxTokens) - 1024))
      } : control === "toggle" ? { includeThoughts: true } : control === "effort" ? { includeThoughts: true, thinkingLevel: String(model.thinkingLevelMap?.[level] ?? level).toUpperCase() } : body.config?.thinkingConfig;
      const next = { ...body, config: { ...body.config, thinkingConfig } };
      return await options?.onPayload?.(next, wireModel) ?? next;
    }
  }));
});

// src/catalog.ts
import { LlmError as LlmError2, attributionHeaders } from "@deepseek-ai/dsh-llm";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// src/pricing.ts
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid pricing object");
  return value;
}
function rate(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("invalid price");
  return value;
}
var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
var OPERATORS = ["in", "eq", "gt", "gte", "lt", "lte"];
function condition(value, depth = 0) {
  if (depth > 16) throw new Error("pricing condition is too deep");
  const row = object(value);
  if (Object.keys(row).length === 0) throw new Error("empty pricing condition");
  for (const [key, raw] of Object.entries(row)) {
    if (key === "all" || key === "any") {
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > 64) throw new Error("invalid pricing condition list");
      raw.forEach((item) => condition(item, depth + 1));
      continue;
    }
    if (!["utc_days", "utc_hours", "date"].includes(key)) throw new Error("unknown pricing condition");
    const values = object(raw);
    if (Object.keys(values).length === 0) throw new Error("empty pricing comparison");
    const valid = (v) => typeof v === "string" && (key === "utc_days" ? DAYS.includes(v) : key === "utc_hours" ? /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(v) : validReleaseDate(v));
    for (const [op, arg] of Object.entries(values)) {
      if (!OPERATORS.includes(op) || key === "utc_days" && !["in", "eq"].includes(op) || (op === "in" ? !Array.isArray(arg) || arg.length === 0 || !arg.every(valid) : !valid(arg))) {
        throw new Error("invalid pricing comparison");
      }
    }
  }
  return row;
}
function readModelCost(value) {
  try {
    const raw = object(value), text = object(raw.text);
    const input = object(text.input), output = object(text.output);
    const cache = (raw2) => {
      if (raw2 === void 0) return {};
      const row = object(raw2);
      return {
        ...row.read === void 0 ? {} : { cacheRead: rate(row.read) },
        ...row.write === void 0 ? {} : { cacheWrite: rate(row.write) }
      };
    };
    const cost = { input: rate(input.price), output: rate(output.price), cacheRead: 0, cacheWrite: 0, ...cache(input.cache) };
    if (output.cache !== void 0) throw new Error("invalid output cache");
    const overrides = (raw2, side) => {
      if (raw2 === void 0) return [];
      if (!Array.isArray(raw2)) throw new Error("invalid context overrides");
      return raw2.map((value2) => {
        const row = object(value2), when = object(row.when), context = object(when.context);
        const keys = Object.keys(context);
        if (Object.keys(when).length !== 1 || keys.length !== 1 || !["gt", "gte"].includes(keys[0])) throw new Error("invalid context threshold");
        const threshold = context[keys[0]];
        if (typeof threshold !== "number" || !Number.isSafeInteger(threshold) || threshold <= 0) throw new Error("invalid context threshold");
        if (side === "output" && row.cache !== void 0) throw new Error("invalid output cache");
        if (row.price === void 0 && row.cache === void 0) throw new Error("empty context tariff");
        return {
          threshold: threshold - (keys[0] === "gte" ? 1 : 0),
          rates: { ...row.price === void 0 ? {} : { [side]: rate(row.price) }, ...cache(row.cache) }
        };
      });
    };
    const patches = [...overrides(input.overrides, "input"), ...overrides(output.overrides, "output")].sort((a, b) => a.threshold - b.threshold);
    let current = { ...cost };
    for (const patch of patches) {
      current = { ...current, ...patch.rates };
      const tier = { ...current, inputTokensAbove: patch.threshold };
      cost.tiers ??= [];
      if (cost.tiers.at(-1)?.inputTokensAbove === patch.threshold) cost.tiers[cost.tiers.length - 1] = tier;
      else cost.tiers.push(tier);
    }
    let multipliers;
    if (raw.multipliers !== void 0) {
      if (!Array.isArray(raw.multipliers)) throw new Error("invalid multipliers");
      multipliers = raw.multipliers.map((item) => {
        const row = object(item);
        return { when: condition(row.when), factor: rate(row.factor) };
      });
    }
    const zero2 = (rates) => rates.input === 0 && rates.output === 0 && rates.cacheRead === 0 && rates.cacheWrite === 0;
    return { cost, ...multipliers === void 0 ? {} : { multipliers }, free: zero2(cost) && (cost.tiers ?? []).every(zero2) };
  } catch {
    return void 0;
  }
}

// src/catalog.ts
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
var THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var NATIVE_THINKING_FLAGS = /* @__PURE__ */ new Set(["deepseek", "zai", "qwen", "qwen-chat-template"]);
var BUDGET_PRESETS = { minimal: 1024, low: 2048, medium: 8192, high: 16384 };
function supportsThinkingBudget(api, compat) {
  const options = compat;
  return api === "google-generative-ai" || (api === "anthropic-messages" ? options?.forceAdaptiveThinking !== true : api === "openai-completions" && Boolean(options?.thinkingTokenBudgetField || options?.supportsThinkingTokenBudget));
}
function reasoningBudgetRange(model) {
  if (!model.reasoning || !model.reasoningBudget) return void 0;
  const max = Math.min(model.reasoningBudget.max, model.maxTokens - 1024);
  return max >= model.reasoningBudget.min ? { min: model.reasoningBudget.min, max } : void 0;
}
function unsupportedThinkingLevels() {
  return Object.fromEntries(THINKING_LEVELS.map((level) => [level, null]));
}
function ignoredBudgetReason(model, tokens, range) {
  const value = Number.isFinite(tokens) ? String(tokens) : "non-numeric";
  if (tokens > MAX_THINKING_BUDGET_TOKENS) {
    return `configured thinking budget ${value} is ignored: it exceeds the ${MAX_THINKING_BUDGET_TOKENS}-token cap`;
  }
  if (range === void 0) {
    return `configured thinking budget ${value} is ignored: model "${model.id}" exposes no usable numeric thinking budget`;
  }
  return `configured thinking budget ${value} is ignored: model "${model.id}" accepts ${range.min}-${range.max} tokens`;
}
function reasoningChoices(model, onWarning) {
  if (!model.reasoning) {
    for (const tokens of new Set(model.reasoningBudgetPresets ?? [])) {
      onWarning?.(`configured thinking budget ${Number.isFinite(tokens) ? String(tokens) : "non-numeric"} is ignored: model "${model.id}" exposes no reasoning controls`);
    }
    return [];
  }
  const range = reasoningBudgetRange(model);
  const valid = (tokens) => range !== void 0 && Number.isSafeInteger(tokens) && tokens >= range.min && tokens <= range.max && tokens <= MAX_THINKING_BUDGET_TOKENS;
  const presets = [];
  for (const tokens of new Set(model.reasoningBudgetPresets ?? [])) {
    if (valid(tokens)) presets.push(tokens);
    else onWarning?.(ignoredBudgetReason(model, tokens, range));
  }
  presets.sort((a, b) => a - b);
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
  })), ...range === void 0 ? [] : presets.map((tokens) => ({ id: `budget:${tokens}`, name: `${tokens.toLocaleString("en-US")} tokens` }))];
}
function clampThinkingBudget(range, requested) {
  if (requested === void 0 || !Number.isFinite(requested)) return range.min;
  return Math.min(Math.max(Math.round(requested), range.min), range.max);
}
function reasoningIntent(model, level, onWarning) {
  if (level === void 0) return { kind: "default" };
  if (level === "off") return { kind: "off" };
  const range = reasoningBudgetRange(model);
  if (range && (model.reasoningControl === "budget" || level.startsWith("budget:"))) {
    const requested = level.startsWith("budget:") ? Number(level.slice(7)) : BUDGET_PRESETS[level];
    const usable = requested !== void 0 && Number.isSafeInteger(requested) && requested >= range.min && requested <= range.max;
    const tokens = usable ? requested : clampThinkingBudget(range, requested);
    if (!usable) {
      onWarning?.(`selected thinking budget ${requested === void 0 ? "unavailable" : String(requested)} was clamped to ${tokens} tokens for model "${model.id}"`);
    }
    return { kind: "budget", min: range.min, tokens };
  }
  return model.reasoningControl === "toggle" ? { kind: "on" } : { kind: "effort", level };
}
function object2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function withoutKeys(value, keys) {
  const source = object2(value);
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
      const source = object2(payload);
      if (!source) return payload;
      const body = { ...source };
      if (intent.kind === "budget") {
        const thinking = object2(body.thinking);
        const config = object2(body.config);
        const googleThinking = object2(config?.thinkingConfig);
        const actual = thinking?.budget_tokens ?? body.thinking_token_budget ?? body.thinking_budget ?? body.thinking_budget_tokens ?? googleThinking?.thinkingBudget;
        const ceiling = body.max_tokens ?? body.max_completion_tokens ?? config?.maxOutputTokens;
        if (typeof actual !== "number" || actual < intent.min || typeof ceiling === "number" && actual > ceiling - 1024) {
          throw new LlmError2(`opencode-go thinking budget requires at least ${intent.min} tokens of available thinking space`, "INVALID_REQUEST");
        }
      }
      delete body.reasoning_effort;
      body.reasoning = withoutKeys(body.reasoning, ["effort"]);
      body.output_config = withoutKeys(body.output_config, ["effort"]);
      if (intent.kind === "default") {
        delete body.thinking;
        delete body.enable_thinking;
        body.chat_template_kwargs = withoutKeys(body.chat_template_kwargs, ["enable_thinking"]);
        body.config = withoutKeys(body.config, ["thinkingConfig"]);
      }
      for (const key of ["reasoning", "output_config", "chat_template_kwargs", "config"]) {
        if (body[key] === void 0) delete body[key];
      }
      return body;
    }
  };
}
function record(value) {
  return object2(value) ?? {};
}
function positiveInteger(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`missing or invalid ${field}`);
  return value;
}
var PROTOCOLS = {
  "chat-completions": "openai-completions",
  responses: "openai-responses",
  messages: "anthropic-messages",
  "generate-content": "google-generative-ai"
};
function modelBaseURL(api, baseURL, declared, source = "go") {
  const base = assertBaseURL(baseURL, source === "free" ? "freeBaseURL" : "baseURL");
  const official = base === (source === "go" ? DEFAULT_BASE_URL : DEFAULT_FREE_BASE_URL);
  let endpoint = base;
  if (official) {
    if (typeof declared === "string") endpoint = assertBaseURL(declared);
    else {
      const prefix = base.replace(/\/v1$/, "");
      endpoint = api === "anthropic-messages" ? `${prefix}/anthropic/v1` : api === "google-generative-ai" ? `${prefix}/google/v1beta` : `${prefix}/openai/v1`;
    }
  }
  return api === "anthropic-messages" ? endpoint.replace(/\/v1$/, "") : endpoint;
}
function compatibility(api, data, endpoint) {
  const capabilities = record(data.capabilities);
  const tools = record(capabilities.tools);
  const wire = { ...record(data.compatibility), ...record(endpoint.compatibility) };
  const reasoning = record(capabilities.reasoning);
  const family = `${String(data.family ?? "")} ${String(data.canonical_id ?? "")}`.toLowerCase();
  const system = capabilities.system_updates === true;
  const updates = tools.updates === true;
  if (api === "openai-completions") {
    const format = /deepseek|moonshot|kimi|longcat|meituan/.test(family) ? "deepseek" : /zhipu|\bglm/.test(family) ? "zai" : /qwen|alibaba/.test(family) ? "qwen" : "openai";
    const budgetField = ["thinking_budget", "thinking_budget_tokens", "thinking_token_budget"].includes(String(wire.thinking_budget_field)) ? wire.thinking_budget_field : object2(reasoning.budget) ? "thinking_token_budget" : void 0;
    return {
      supportsStore: false,
      supportsDeveloperRole: false,
      maxTokensField: "max_tokens",
      supportsReasoningEffort: Array.isArray(reasoning.effort) && reasoning.effort.length > 0,
      supportsStrictMode: tools.strict === true,
      supportsMidConvoSystemMessages: system,
      supportsMidConvoToolAdditions: updates,
      requiresReasoningContentOnAssistantMessages: wire.reasoning_field === "reasoning_content",
      thinkingFormat: format,
      ...budgetField === void 0 ? {} : { thinkingTokenBudgetField: budgetField }
    };
  }
  if (api === "openai-responses") return {
    sessionAffinityFormat: "openai-nosession",
    supportsStrictMode: tools.strict === true,
    supportsMidConvoSystemMessages: system,
    supportsAdditionalTools: updates,
    supportsMidConvoEffort: capabilities.effort_updates === true
  };
  if (api === "anthropic-messages") return {
    forceAdaptiveThinking: reasoning.supported === true && Array.isArray(reasoning.effort) && reasoning.effort.length > 0 && !object2(reasoning.budget),
    supportsTemperature: capabilities.temperature !== false,
    supportsStrictTools: tools.strict === true,
    supportsMidConvoSystemMessages: system,
    supportsMidConvoToolChanges: updates,
    supportsMidConvoEffort: capabilities.effort_updates === true,
    .../qwen|alibaba/.test(family) ? { allowEmptySignature: true } : {}
  };
  return void 0;
}
function reasoningControls(api, data, compat) {
  const reasoning = record(record(data.capabilities).reasoning);
  const map = unsupportedThinkingLevels();
  if (reasoning.supported !== true) return { reasoning: false, thinkingLevelMap: map };
  const efforts = Array.isArray(reasoning.effort) ? reasoning.effort : [];
  for (const value of efforts) {
    const level = value === "none" ? "off" : value;
    if (THINKING_LEVELS.includes(level)) map[level] = String(value);
  }
  const format = compat?.thinkingFormat;
  const native = api === "anthropic-messages" || api === "google-generative-ai" || NATIVE_THINKING_FLAGS.has(format ?? "");
  const budget = object2(reasoning.budget);
  const tokenBudget = budget !== void 0 && supportsThinkingBudget(api, compat);
  if (efforts.length === 0 && (native && reasoning.toggle === true || tokenBudget)) map.high = "high";
  if (native && reasoning.toggle === true && map.off === null) delete map.off;
  return {
    reasoning: true,
    thinkingLevelMap: map,
    reasoningControl: tokenBudget && efforts.length === 0 ? "budget" : native && efforts.length === 0 && reasoning.toggle === true ? "toggle" : "effort",
    ...tokenBudget ? { reasoningBudget: {
      min: Math.max(api === "anthropic-messages" ? 1024 : 1, budget.min === void 0 ? 1 : positiveInteger(budget.min, "reasoning budget minimum")),
      max: budget.max === void 0 ? Number.MAX_SAFE_INTEGER : positiveInteger(budget.max, "reasoning budget maximum")
    } } : {}
  };
}
function listingRows(body, onInvalidRows) {
  const data = record(body).data;
  if (!Array.isArray(data)) throw new Error('the model listing has no "data" array');
  const rows = [], invalid = [];
  for (const [index, entry] of data.entries()) {
    const row = record(entry);
    if (typeof row.id === "string" && row.id.trim().length > 0) rows.push(row);
    else invalid.push(index + 1);
  }
  if (data.length > 0 && rows.length === 0) throw new Error("the nonempty model listing has no valid model ids");
  if (invalid.length > 0) onInvalidRows?.(`Model listing ignored ${invalid.length} of ${data.length} rows with invalid model ids (rows ${invalid.slice(0, 8).join(", ")}${invalid.length > 8 ? ", \u2026" : ""}); the listing may be incomplete`);
  return rows;
}
function readLiveModelIds(body, onInvalidRows) {
  return [...new Set(listingRows(body, onInvalidRows).filter((row) => row.type === "chat").map((row) => row.id))];
}
function readModelDirectory(body, baseURL, source = "go") {
  const models = /* @__PURE__ */ new Map(), details = /* @__PURE__ */ new Map(), errors = /* @__PURE__ */ new Map();
  let warning;
  for (const data of listingRows(body, (value) => {
    warning = value;
  })) {
    if (data.type !== "chat") continue;
    const id = data.id, pricing = readModelCost(data.cost);
    if (source === "free" && !pricing?.free) continue;
    if (details.has(id)) continue;
    const input = normalizeInputModalities(record(data.modalities).input);
    details.set(id, {
      deprecated: data.status === "deprecated" || data.deprecated === true,
      ...validReleaseDate(data.release_date) ? { releaseDate: data.release_date } : {},
      ...input === void 0 ? {} : { inputModalities: input },
      ...pricing === void 0 ? { costKnown: false } : {}
    });
    try {
      const declaration = record(data.api);
      const selected = Object.keys(declaration).find((key) => Object.hasOwn(PROTOCOLS, key) && object2(declaration[key]));
      if (!selected) throw new Error("missing or unsupported model protocol");
      const api = PROTOCOLS[selected], endpoint = record(declaration[selected]);
      const modelCapabilities = record(data.capabilities), endpointCapabilities = record(endpoint.capabilities);
      const capabilities = {
        ...modelCapabilities,
        ...endpointCapabilities,
        reasoning: { ...record(modelCapabilities.reasoning), ...record(endpointCapabilities.reasoning) },
        tools: { ...record(modelCapabilities.tools), ...record(endpointCapabilities.tools) }
      };
      const merged = { ...data, capabilities }, compat = compatibility(api, merged, endpoint);
      if (!input?.includes("text")) throw new Error("missing text input modality");
      const controls = reasoningControls(api, merged, compat);
      if (controls.reasoningBudget && controls.reasoningBudget.max < controls.reasoningBudget.min) throw new Error("invalid reasoning budget range");
      models.set(id, {
        id,
        source,
        name: typeof data.name === "string" && data.name.length > 0 ? data.name : id,
        provider: source === "go" ? SDK_PROVIDER_ID : "opencode-free",
        api,
        baseUrl: modelBaseURL(api, baseURL, endpoint.base_url, source),
        compat,
        ...controls,
        input: input.filter((modality) => modality === "text" || modality === "image"),
        contextWindow: positiveInteger(record(data.limit).context, "context limit"),
        maxTokens: positiveInteger(record(data.limit).output, "output limit"),
        cost: pricing?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        ...pricing?.multipliers === void 0 ? {} : { multipliers: pricing.multipliers }
      });
    } catch (error) {
      errors.set(id, error instanceof Error ? error.message : String(error));
    }
  }
  return { models, details, errors, ...warning === void 0 ? {} : { warning } };
}
var MODEL_LISTING_MAX_BYTES = 16 * 1024 * 1024;
var CACHE_MAX_BYTES = MODEL_LISTING_MAX_BYTES + 4096;
var FETCH_TIMEOUT_MS = 3e4;
var STALE_WHILE_REVALIDATE_MS = 5 * 6e4;
function catalogCachePath(source = "go") {
  return resolve(process.env.DSH_HOME?.trim() || join(homedir(), ".dsh"), "cache", "dsh-opencode-go", `${source}.models.json`);
}
function catalogETag(value) {
  return typeof value === "string" && value.length <= 1024 && /^(W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(value) ? value : void 0;
}
async function readCatalogCache(path, sourceURL) {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > CACHE_MAX_BYTES) return void 0;
    const chunks = [];
    let size = 0;
    for await (const chunk of createReadStream(path)) {
      size += chunk.length;
      if (size > CACHE_MAX_BYTES) return void 0;
      chunks.push(chunk);
    }
    const value = record(JSON.parse(Buffer.concat(chunks, size).toString("utf8")));
    if (value.version !== 1 || value.sourceURL !== sourceURL || typeof value.savedAtMs !== "number" || !Number.isSafeInteger(value.savedAtMs) || value.savedAtMs < 0 || value.savedAtMs > Date.now() || value.etag !== void 0 && catalogETag(value.etag) === void 0) return void 0;
    return { body: value.body, savedAtMs: value.savedAtMs, etag: catalogETag(value.etag) };
  } catch {
    return void 0;
  }
}
async function writeCatalogCache(path, sourceURL, value) {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    const content = JSON.stringify({ version: 1, sourceURL, ...value });
    if (Buffer.byteLength(content) > CACHE_MAX_BYTES) return false;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, content, { flag: "wx", mode: 384 });
    await rename(temporary, path);
    return true;
  } catch {
    return false;
  } finally {
    await rm(temporary, { force: true }).catch(() => {
    });
  }
}
function waitForSnapshot(pending, signal) {
  if (!signal) return pending;
  return new Promise((resolve2, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(new LlmError2("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason }));
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
function buildProvider(baseURL, models, source) {
  return createProvider({
    id: source === "go" ? SDK_PROVIDER_ID : "opencode-free",
    name: source === "go" ? DISPLAY_NAME : FREE_DISPLAY_NAME,
    baseUrl: baseURL,
    auth: { apiKey: { name: "OpenCode API key", resolve: () => Promise.resolve({ auth: {}, source: "OpenCode API key" }) } },
    models: [...models],
    api: {
      "anthropic-messages": anthropic_messages_exports,
      "openai-completions": openai_completions_exports,
      "openai-responses": openai_responses_exports,
      "google-generative-ai": google_exports
    }
  });
}
var OpencodeGoCatalog = class {
  constructor(baseURL, refreshMs, onFallback = () => {
  }, onOmitted = () => {
  }, onRefresh = () => {
  }, fetcher, onWarning, source = "go") {
    this.baseURL = baseURL;
    this.refreshMs = refreshMs;
    this.onFallback = onFallback;
    this.onOmitted = onOmitted;
    this.onRefresh = onRefresh;
    this.fetcher = fetcher;
    this.onWarning = onWarning;
    this.source = source;
    this.baseURL = assertBaseURL(baseURL, source === "go" ? "baseURL" : "freeBaseURL");
    this.url = `${this.baseURL}/models`;
    this.cachePath = catalogCachePath(source);
  }
  served;
  pending;
  initialized;
  cached;
  startupCache;
  refreshAtMs = 0;
  failures = 0;
  url;
  cachePath;
  async snapshot(force = false, signal) {
    if (signal?.aborted) throw new LlmError2("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason });
    await waitForSnapshot((this.initialized ??= this.restore()).then(() => this.served ?? this.empty()), signal);
    if (!force && this.served && Date.now() < this.refreshAtMs) return this.served;
    const background = !force && this.startupCache !== void 0 && this.served === this.startupCache;
    const pending = this.pending ??= this.refresh(!force && this.served !== void 0).finally(() => {
      this.pending = void 0;
      this.startupCache = void 0;
    });
    void pending.catch(() => {
    });
    return background ? this.served : waitForSnapshot(pending, signal);
  }
  empty() {
    return {
      source: this.source,
      details: /* @__PURE__ */ new Map(),
      models: /* @__PURE__ */ new Map(),
      unavailable: /* @__PURE__ */ new Map(),
      provider: buildProvider(this.baseURL, [], this.source),
      live: false,
      fetchedAtMs: Date.now()
    };
  }
  build(directory, live, updatedAtMs) {
    return {
      source: this.source,
      details: directory.details,
      models: directory.models,
      unavailable: directory.errors,
      provider: buildProvider(this.baseURL, [...directory.models.values()], this.source),
      live,
      updatedAtMs,
      fetchedAtMs: Date.now(),
      ...directory.warning === void 0 ? {} : { warning: directory.warning }
    };
  }
  async restore() {
    const cached2 = await readCatalogCache(this.cachePath, this.url);
    if (!cached2) return;
    try {
      this.served = this.build(readModelDirectory(cached2.body, this.baseURL, this.source), false, cached2.savedAtMs);
      this.startupCache = this.served;
      this.cached = cached2;
    } catch {
    }
  }
  async refresh(notify) {
    let snapshot;
    try {
      const { response, body } = await fetchJsonResponse(this.url, {
        method: "GET",
        cache: "no-cache",
        headers: {
          ...attributionHeaders(),
          accept: "application/json",
          ...this.cached?.etag === void 0 ? {} : { "if-none-match": this.cached.etag }
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        // Discovery is unauthenticated but must not be steered elsewhere: a
        // redirect to loopback or a metadata address is a failure, not a source.
        redirect: "error"
      }, MODEL_LISTING_MAX_BYTES, "gzip", this.fetcher);
      const notModified = response.status === 304 && this.cached !== void 0;
      if (!notModified && !response.ok) throw new LlmError2(`HTTP ${response.status}`, "DISCOVERY_FAILED");
      const document = notModified ? this.cached.body : body;
      let directory;
      try {
        directory = readModelDirectory(document, this.baseURL, this.source);
      } catch (error) {
        throw new LlmError2(`invalid model listing: ${error instanceof Error ? error.message : "invalid data"}`, "DISCOVERY_FAILED", { cause: error });
      }
      this.cached = {
        body: document,
        savedAtMs: Date.now(),
        etag: catalogETag(response.headers.get("etag")) ?? (notModified ? this.cached?.etag : void 0)
      };
      snapshot = this.build(directory, true, this.cached.savedAtMs);
      await writeCatalogCache(this.cachePath, this.url, this.cached);
      this.failures = 0;
    } catch (error) {
      const detail = error instanceof LlmError2 ? error.message : error instanceof SyntaxError ? "invalid JSON response" : error instanceof RangeError ? `response exceeds the ${MODEL_LISTING_MAX_BYTES} byte limit` : transportFailure(error);
      const failure = new LlmError2(`could not refresh ${diagnosticURL(this.url)}: ${detail}`, "DISCOVERY_FAILED", { cause: error });
      snapshot = { ...this.served ?? this.empty(), live: false, failure, fetchedAtMs: Date.now() };
      this.failures = Math.min(this.failures + 1, 5);
      try {
        this.onFallback({ url: diagnosticURL(this.url), error: failure, kept: snapshot.models.size });
      } catch {
      }
    }
    this.served = snapshot;
    this.refreshAtMs = snapshot.fetchedAtMs + (this.failures === 0 ? this.refreshMs : Math.min(this.refreshMs, 5e3 * 2 ** (this.failures - 1), 6e4));
    try {
      if (snapshot.warning && snapshot.live) this.onWarning?.(snapshot.warning);
      if (snapshot.unavailable.size) this.onOmitted([...snapshot.unavailable.keys()]);
      if (notify) this.onRefresh();
    } catch {
    }
    return snapshot;
  }
  async forModel(id, signal) {
    if (signal?.aborted) throw new LlmError2("opencode-go catalog request aborted by caller", "ABORTED", { cause: signal.reason });
    const cached2 = this.served;
    if (cached2?.models.has(id) && cached2.updatedAtMs !== void 0 && Date.now() < cached2.updatedAtMs + this.refreshMs + STALE_WHILE_REVALIDATE_MS) {
      void this.snapshot().catch(() => {
      });
      return cached2;
    }
    let snapshot = await this.snapshot(false, signal);
    if (!snapshot.models.has(id) && (snapshot === cached2 || this.pending !== void 0) || this.pending !== void 0 && snapshot.updatedAtMs !== void 0 && Date.now() >= snapshot.updatedAtMs + this.refreshMs + STALE_WHILE_REVALIDATE_MS) {
      snapshot = await this.snapshot(true, signal);
    }
    if (snapshot.unavailable.has(id)) throw new LlmError2(`opencode-go model "${id}" is advertised but cannot be configured: ${snapshot.unavailable.get(id)}; refresh the model list to retry`, "MODEL_METADATA_UNAVAILABLE");
    if (!snapshot.models.has(id) && !snapshot.live) throw listingError(snapshot);
    return snapshot;
  }
};
function listingError(snapshot) {
  return new LlmError2(`llm-opencode-go: ${snapshot.failure instanceof Error ? snapshot.failure.message : "the live model listing is unreachable"}; refresh the model list to retry`, "DISCOVERY_FAILED", { cause: snapshot.failure });
}
function describeCatalog(snapshot) {
  return sortModels([
    ...[...snapshot.models.values()].map((model) => ({
      id: model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      ...reasoningBudgetRange(model) === void 0 ? {} : { reasoningBudget: reasoningBudgetRange(model) }
    })),
    ...[...snapshot.unavailable.keys()].map((id) => ({ id, name: id, configurationMissing: true }))
  ].map((model) => ({ ...model, source: snapshot.source, ...snapshot.details.get(model.id) })));
}
async function discoverCatalogModels(catalog, signal) {
  const snapshot = await catalog.snapshot(true, signal);
  if (!snapshot.live) throw listingError(snapshot);
  return describeCatalog(snapshot).map(({ id, name: name2, contextWindow, maxTokens }) => ({
    id,
    name: snapshot.unavailable.has(id) ? `${id} (configuration unavailable: ${snapshot.unavailable.get(id)})` : name2,
    contextWindow,
    maxTokens
  }));
}
async function discoverSettingsModels(catalog, freeCatalog) {
  const snapshots = await Promise.all([catalog.snapshot(true), ...freeCatalog ? [freeCatalog.snapshot(true)] : []]);
  const sources = { go: {}, free: {} };
  for (const snapshot of snapshots) sources[snapshot.source] = {
    ...snapshot.updatedAtMs === void 0 ? {} : { updatedAt: snapshot.updatedAtMs },
    ...snapshot.live ? {} : { error: listingError(snapshot).message },
    ...snapshot.warning === void 0 ? {} : { warning: snapshot.warning }
  };
  const errors = snapshots.filter((snapshot) => !snapshot.live).map((snapshot) => listingError(snapshot).message);
  return {
    models: snapshots.flatMap(describeCatalog),
    stale: errors.length > 0,
    sources,
    ...errors.length > 0 ? { error: errors.join("; ") } : {}
  };
}
var GoCatalogManager = class {
  constructor(options) {
    this.options = options;
  }
  current = /* @__PURE__ */ new Map();
  forConfig(config, source = "go") {
    const baseURL = assertBaseURL(source === "go" ? config.baseURL : config.freeBaseURL, source === "go" ? "baseURL" : "freeBaseURL");
    const key = JSON.stringify([baseURL, config.refreshMinutes, assertProxyURL(config.proxyURL)]);
    if (this.current.get(source)?.key !== key) {
      const catalog = new OpencodeGoCatalog(
        baseURL,
        config.refreshMinutes * 6e4,
        this.options.onFallback,
        this.options.onOmitted,
        () => {
          if (this.current.get(source)?.catalog === catalog) this.options.onRefresh?.();
        },
        this.options.transport.forProxy(config.proxyURL),
        this.options.onWarning,
        source
      );
      this.current.set(source, { key, catalog });
    }
    return this.current.get(source).catalog;
  }
};
var GoModelsService = class extends TypertRemoteService {
  constructor(ctx, options) {
    super(ctx, "opencodeGoModels");
    this.options = options;
  }
  async read() {
    try {
      return await discoverSettingsModels(this.options.catalog(), this.options.freeCatalog?.());
    } finally {
      this.options.onRefresh?.();
    }
  }
};

// src/adapter.ts
import { createHash as createHash3, randomUUID as randomUUID3 } from "node:crypto";

// src/accounts.ts
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { TypertRemoteService as TypertRemoteService2, RemoteError } from "@deepseek-ai/dsh-typert-protocol";
import { randomUUID as randomUUID2 } from "node:crypto";
import { attributionHeaders as attributionHeaders2 } from "@deepseek-ai/dsh-llm";
function accountSettingsRow(settings) {
  const rows = settings.describe();
  return rows.find((row) => row.ns === PROFILE_ENTRY_ID);
}
function accountFallback(outcome) {
  if (outcome.emitted || outcome.totalTokens > 0 || outcome.aborted || !outcome.hasNext) return void 0;
  switch (outcome.failure?.code) {
    case "RATE_LIMIT":
    case "QUOTA":
      return "quota";
    case "AUTH":
    case "MISSING_CREDENTIAL":
    case "INVALID_CREDENTIAL":
      return "credential";
    default:
      return void 0;
  }
}
function isGatewayKeyRejection(failure) {
  return ["INVALID_CREDENTIAL", "AUTH", "RATE_LIMIT", "QUOTA"].includes(failure.code);
}
function accountIdentity(config) {
  return JSON.stringify([config.enabled, accountRefOf(config), config.accounts, config.autoSwitch, config.baseURL, config.proxyURL, config.freeBaseURL]);
}
function ownsAccountCredential(account) {
  return /^[a-f0-9]{32}$/.test(account.id) && account.apiKeyEnv === ACCOUNT_REF_PREFIX + account.id.toUpperCase();
}
var GoAccountManager = class {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }
  connection;
  queue = Promise.resolve();
  generation = 0;
  signature = "";
  credentialGeneration = 0;
  settingsGeneration = 0;
  latestSeq = -1;
  notice;
  connect(settings, credentials) {
    const connection = this.connection = { settings, credentials };
    this.signature = "";
    this.capture();
    return () => {
      if (this.connection !== connection) return;
      this.connection = void 0;
      this.signature = "";
      this.capture();
    };
  }
  enqueue(work) {
    const pending = this.queue.then(work);
    this.queue = pending.catch(() => {
    });
    return pending;
  }
  read(connection) {
    if (this.connection !== connection) throw new Error("Account connection changed");
    const row = accountSettingsRow(connection.settings);
    if (!row) throw new Error("Account settings are unavailable");
    return { ...row, value: row.value };
  }
  async write(connection, patch) {
    const row = this.read(connection);
    await connection.settings.mutate(row.ns, Object.entries(patch).map(([field, value]) => ({ op: "set", path: [field], value })), row.revision);
    this.settingsGeneration++;
    return "applied";
  }
  execute(raw) {
    const command = parseAccountCommand(raw);
    const connection = this.connection;
    return this.enqueue(async () => {
      if (!connection || this.connection !== connection) return "rejected";
      try {
        return await this.executeCommand(connection, command);
      } catch {
        this.logger.warn("llm-opencode-go: account command failed; reload settings and retry");
        return "unknown";
      }
    });
  }
  async executeCommand(connection, command) {
    const { credentials } = connection;
    let value = this.read(connection).value;
    if (command.kind === "auto-switch") return this.write(connection, { autoSwitch: command.value });
    if (command.kind === "add") {
      const ref = ACCOUNT_REF_PREFIX + command.id.toUpperCase();
      if (value.accounts?.some((account2) => account2.id === command.id && account2.apiKeyEnv === ref)) return "applied";
      const previousRef = accountRefOf(value);
      let accounts2 = [...accountsOf(value)];
      const configured = await Promise.all(accounts2.map((account2) => credentials.describe(credentialRef(account2.apiKeyEnv))));
      if (value.accounts == null) accounts2 = accounts2.filter((account2, index) => account2.name || configured[index]?.configured);
      if (accounts2.length >= MAX_ACCOUNTS || accounts2.some((account2) => account2.id === command.id || account2.apiKeyEnv === ref)) return "rejected";
      await credentials.set(credentialRef(ref), command.key.trim());
      try {
        value = this.read(connection).value;
        const retained = accountsOf(value).filter((account2) => value.accounts != null || account2.name || accounts2.some((saved) => saved.apiKeyEnv === account2.apiKeyEnv));
        if (retained.length >= MAX_ACCOUNTS || retained.some((account2) => account2.id === command.id || account2.apiKeyEnv === ref)) {
          throw new Error("Account list changed while storing the credential");
        }
        const added = { id: command.id, name: command.name.trim(), apiKeyEnv: ref };
        const selected = accountRefOf(value) === previousRef && configured.every((info) => !info.configured) ? ref : accountRefOf(value);
        const next = [...moveAccountFirst([...retained, added], selected)];
        return await this.write(connection, { accounts: next, apiKeyEnv: next[0].apiKeyEnv });
      } catch (error) {
        await credentials.unset(credentialRef(ref)).catch(() => {
          this.logger.warn("llm-opencode-go: could not clean up an unused account credential");
        });
        throw error;
      }
    }
    const account = accountsOf(value).find((account2) => account2.apiKeyEnv === command.ref);
    if (!account) return "rejected";
    if (command.kind === "replace-key") {
      const info = await credentials.describe(credentialRef(command.ref));
      if (!info.writable) return "rejected";
      if (!accountsOf(this.read(connection).value).some((entry) => entry.id === account.id && entry.apiKeyEnv === command.ref)) return "rejected";
      await credentials.set(credentialRef(command.ref), command.key.trim());
      return "applied";
    }
    if (command.kind === "remove") {
      let previous;
      if (ownsAccountCredential(account)) {
        const info = await credentials.describe(credentialRef(command.ref));
        if (info.configured && !info.writable) return "rejected";
        previous = await credentials.resolve(credentialRef(command.ref));
        if (!accountsOf(this.read(connection).value).some((entry) => entry.id === account.id && entry.apiKeyEnv === command.ref)) return "rejected";
        if (info.configured) await credentials.unset(credentialRef(command.ref));
      }
      try {
        value = this.read(connection).value;
        const accounts2 = accountsOf(value).filter((entry) => entry.apiKeyEnv !== command.ref);
        return await this.write(connection, { accounts: [...accounts2], apiKeyEnv: accounts2[0]?.apiKeyEnv ?? accountRefOf(value) });
      } catch (error) {
        if (previous && this.connection === connection && accountsOf(this.read(connection).value).some((entry) => entry.id === account.id && entry.apiKeyEnv === command.ref)) await credentials.set(credentialRef(command.ref), previous.value).catch(() => {
          this.logger.warn("llm-opencode-go: could not restore an account credential after a refused removal");
        });
        throw error;
      }
    }
    const accounts = [...accountsOf(this.read(connection).value)];
    if (command.kind === "rename") return this.write(connection, {
      accounts: accounts.map((account2) => account2.apiKeyEnv === command.ref ? { ...account2, name: command.name.trim() } : account2)
    });
    if (command.kind === "select") {
      const next = [...moveAccountFirst(accounts, command.ref)];
      return this.write(connection, { accounts: next, apiKeyEnv: command.ref });
    }
    const from = accounts.findIndex((account2) => account2.apiKeyEnv === command.ref);
    if (from < 0 || command.toIndex >= accounts.length) return "rejected";
    if (from === command.toIndex) return "applied";
    const [moved] = accounts.splice(from, 1);
    accounts.splice(command.toIndex, 0, moved);
    return this.write(connection, { accounts, apiKeyEnv: accounts[0].apiKeyEnv });
  }
  /**
   * The Host announces every revision of this profile entry, including edits
   * made outside this manager (forms, native config, `A -> C -> A` round
   * trips). Counting them keeps `capture()` free of `settings.describe()`,
   * which deep-clones every namespace, on request and usage-poll hot paths.
   */
  settingsChanged() {
    this.settingsGeneration++;
  }
  /** A freshness fence prevents an old request from overriding a later user choice. */
  capture() {
    const signature = JSON.stringify([accountIdentity(this.config()), this.credentialGeneration, this.settingsGeneration]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.generation++;
      this.notice = void 0;
    }
    return this.generation;
  }
  credentialChanged() {
    this.credentialGeneration++;
    this.capture();
  }
  lastSwitch() {
    this.capture();
    return this.notice;
  }
  settle(event) {
    if (event.generation !== this.capture() || event.seq < this.latestSeq) return;
    if (accountIdentity(this.config()) !== accountIdentity(event.config) || !accountsOf(this.config()).some((account) => account.apiKeyEnv === event.ref)) return;
    this.latestSeq = event.seq;
    this.notice = event.notice;
    if (!event.notice || !event.config.enabled || !event.config.autoSwitch) return;
    void this.enqueue(async () => {
      const connection = this.connection;
      if (!connection || event.generation !== this.capture() || event.seq !== this.latestSeq) return;
      try {
        const accounts = [...moveAccountFirst(accountsOf(this.read(connection).value), event.ref)];
        await this.write(connection, { accounts, apiKeyEnv: event.ref });
        this.capture();
        if (this.connection === connection && event.seq === this.latestSeq && accountRefOf(this.config()) === event.ref) this.notice = event.notice;
      } catch {
        this.logger.warn(`llm-opencode-go: could not make "${event.ref}" the current account`);
      }
    });
  }
};
var GoAccountsService = class extends TypertRemoteService2 {
  constructor(ctx, options) {
    super(ctx, "opencodeGoAccounts");
    this.options = options;
  }
  execute(command) {
    return this.options.manager.execute(command);
  }
};
var USAGE_MAX_BYTES = 1024 * 1024;
var GoUsageService = class extends TypertRemoteService2 {
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
    const refs = this.options.accountRefs?.();
    if (refs) for (const saved of this.identities.keys()) {
      if (saved && !refs.includes(saved)) this.identities.delete(saved);
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
      identity = { baseURL, proxyURL, key, source: randomUUID2() };
      this.identities.set(identityKey, identity);
    }
    const { source } = identity;
    const shared = this.pending.get(source);
    if (shared) return shared;
    const pending = this.fetchUsage(baseURL, key, source, proxyURL, this.transport.forProxy(proxyURL));
    this.pending.set(source, pending);
    try {
      return await pending;
    } finally {
      this.pending.delete(source);
    }
  }
  async fetchUsage(baseURL, key, source, proxyURL, fetcher) {
    const endpoint = diagnosticURL(`${baseURL}/usage`);
    const signal = AbortSignal.timeout(1e4);
    let result;
    try {
      result = await fetchJsonResponse(
        `${baseURL}/usage`,
        {
          headers: { ...attributionHeaders2(), Authorization: `Bearer ${key}`, Accept: "application/json" },
          signal,
          redirect: "error"
        },
        USAGE_MAX_BYTES,
        "identity",
        fetcher,
        (response2) => readUsageError(response2, { apiKey: key, baseURL, proxyURL, signal })
      );
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
      const hint = response.status === 403 ? ". Check your API key and Go subscription permissions." : "";
      const reason = typeof body === "string" && body ? ` Upstream: ${body}` : "";
      throw new RemoteError("opencode-go/usage-unavailable", `OpenCode Go usage unavailable (HTTP ${response.status})${hint}${reason}`, {
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

// src/free-transport.ts
import { spawn } from "node:child_process";
import { dirname as dirname3 } from "node:path";

// src/free-runtime.ts
import { closeSync, existsSync, openSync, readSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname as dirname2, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
import { LlmError as LlmError3 } from "@deepseek-ai/dsh-llm";
function nativeBinary(path) {
  let descriptor;
  try {
    descriptor = openSync(path, "r");
    const bytes = Buffer.alloc(4);
    if (readSync(descriptor, bytes, 0, 4, 0) !== 4) return false;
    const magic = bytes.toString("hex");
    return magic.startsWith("4d5a") || ["7f454c46", "cffaedfe", "cefaedfe", "feedfacf", "feedface", "cafebabe", "bebafeca", "cafebabf", "bfbafeca"].includes(magic);
  } catch {
    return false;
  } finally {
    if (descriptor !== void 0) closeSync(descriptor);
  }
}
function freeRuntimePackage(platform, arch, glibcVersionRuntime) {
  const runtimePlatform = platform === "win32" ? "windows" : platform === "android" ? "linux" : platform;
  const runtimeArch = arch === "arm64" ? "aarch64" : arch;
  const libc = platform === "android" ? "-android" : platform === "linux" && !glibcVersionRuntime ? "-musl" : "";
  return `@oven/bun-${runtimePlatform}-${runtimeArch}${libc}`;
}
function resolveFreeRuntime() {
  try {
    const require2 = createRequire(import.meta.url);
    const report = process.platform === "linux" ? process.report?.getReport() : void 0;
    const name2 = freeRuntimePackage(process.platform, process.arch, report?.header?.glibcVersionRuntime);
    const manifest = require2.resolve(`${name2}/package.json`);
    const binary = join2(dirname2(manifest), "bin", process.platform === "win32" ? "bun.exe" : "bun");
    if (nativeBinary(binary)) return binary;
  } catch {
  }
  throw new LlmError3("OpenCode Free requires the bundled Bun runtime. Reinstall dsh-opencode-go with optional dependencies enabled.", "MISSING_BUN_RUNTIME");
}
function freeWorkerPath() {
  const compiled = fileURLToPath(new URL("./free-http-worker.js", import.meta.url));
  if (existsSync(compiled)) return compiled;
  const source = fileURLToPath(new URL("./free-http-worker.ts", import.meta.url));
  if (existsSync(source)) return source;
  throw new LlmError3("OpenCode Free HTTP worker is missing from the installed package.", "MISSING_BUN_RUNTIME");
}

// src/free-socks-tunnel.ts
import { createServer, Agent, request as httpRequest } from "node:http";
import { connect, isIP } from "node:net";
import { randomBytes } from "node:crypto";
import { MAX_TIMER_DELAY_MS as MAX_TIMER_DELAY_MS2 } from "@deepseek-ai/dsh-timeout";
function hostname(url) {
  return url.hostname.replace(/^\[|\]$/g, "");
}
var TUNNEL_IDLE_MARGIN_MS = 3e4;
function tunnelIdleTimeoutMs(streamIdleTimeoutMs = DEFAULT_STREAM_IDLE_TIMEOUT_MS) {
  return Math.min(streamIdleTimeoutMs + TUNNEL_IDLE_MARGIN_MS, MAX_TIMER_DELAY_MS2);
}
function normalizeHost(host) {
  const plain = host.replace(/^\[|\]$/g, "").trim().toLowerCase();
  const candidate = plain.includes(":") ? `[${plain}]` : plain;
  try {
    return hostname(new URL(`http://${candidate}/`));
  } catch {
    return plain;
  }
}
async function read(socket, size) {
  for (; ; ) {
    const bytes = socket.read(size);
    if (bytes) {
      if (bytes.length !== size) throw new Error("Incomplete SOCKS reply");
      return bytes;
    }
    if (socket.destroyed || socket.readableEnded) throw new Error("SOCKS connection closed");
    await new Promise((resolve2, reject) => {
      const cleanup = () => {
        socket.off("readable", ready);
        socket.off("error", error);
        socket.off("end", end);
        socket.off("close", end);
      };
      const ready = () => {
        cleanup();
        resolve2();
      };
      const error = (cause) => {
        cleanup();
        reject(cause);
      };
      const end = () => {
        cleanup();
        reject(new Error("SOCKS connection closed"));
      };
      socket.once("readable", ready);
      socket.once("error", error);
      socket.once("end", end);
      socket.once("close", end);
    });
  }
}
function address(host) {
  if (isIP(host) === 4) return Buffer.from([1, ...host.split(".").map(Number)]);
  if (isIP(host) === 6) {
    const normalized = host.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) => `${(Number(a) * 256 + Number(b)).toString(16)}:${(Number(c) * 256 + Number(d)).toString(16)}`);
    const [left, right] = normalized.split("::");
    const head = left ? left.split(":") : [];
    const tail = right ? right.split(":") : [];
    const groups = right === void 0 ? head : [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail];
    const bytes2 = Buffer.alloc(17);
    bytes2[0] = 4;
    groups.forEach((group, i) => bytes2.writeUInt16BE(parseInt(group, 16), i * 2 + 1));
    return bytes2;
  }
  const bytes = Buffer.from(host);
  if (bytes.length > 255) throw new Error("SOCKS target hostname exceeds limit");
  return Buffer.concat([Buffer.from([3, bytes.length]), bytes]);
}
async function socksConnect(proxy, target, signal, track) {
  signal.throwIfAborted();
  const socket = track(connect({ host: hostname(proxy), port: Number(proxy.port) || 1080 }));
  const abort = () => {
    socket.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  socket.once("close", () => signal.removeEventListener("abort", abort));
  socket.setTimeout(1e4, () => socket.destroy(new Error("SOCKS handshake timed out")));
  try {
    const user = Buffer.from(decodeURIComponent(proxy.username));
    const password = Buffer.from(decodeURIComponent(proxy.password));
    socket.write(Buffer.from(user.length || password.length ? [5, 2, 0, 2] : [5, 1, 0]));
    const greeting = await read(socket, 2);
    if (greeting[0] !== 5 || ![0, 2].includes(greeting[1])) throw new Error("SOCKS authentication rejected");
    if (greeting[1] === 2) {
      if (!user.length || user.length > 255 || password.length > 255) throw new Error("SOCKS credentials exceed protocol limits");
      socket.write(Buffer.concat([Buffer.from([1, user.length]), user, Buffer.from([password.length]), password]));
      const auth = await read(socket, 2);
      if (auth[0] !== 1 || auth[1] !== 0) throw new Error("SOCKS authentication rejected");
    }
    const port = Buffer.alloc(2);
    port.writeUInt16BE(Number(target.port) || (target.protocol === "https:" ? 443 : 80));
    socket.write(Buffer.concat([Buffer.from([5, 1, 0]), address(hostname(target)), port]));
    const reply = await read(socket, 4);
    if (reply[0] !== 5 || reply[1] !== 0) throw new Error("SOCKS target connection rejected");
    const size = reply[3] === 1 ? 4 : reply[3] === 4 ? 16 : reply[3] === 3 ? (await read(socket, 1))[0] : -1;
    if (size < 0) throw new Error("Invalid SOCKS reply address");
    await read(socket, size + 2);
    socket.setTimeout(0);
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}
async function openSocksTunnel(raw, signal, options = {}) {
  const proxy = new URL(raw);
  const sockets = /* @__PURE__ */ new Set();
  const track = (socket) => {
    sockets.add(socket);
    socket.on("error", () => {
    });
    socket.once("close", () => sockets.delete(socket));
    return socket;
  };
  const password = randomBytes(24).toString("hex");
  const authorization = `Basic ${Buffer.from(`free:${password}`).toString("base64")}`;
  const authorized = (request) => request.headers["proxy-authorization"] === authorization;
  const allowedHost = options.allowedHost === void 0 ? void 0 : normalizeHost(options.allowedHost);
  const permitted = (target) => allowedHost === void 0 || normalizeHost(hostname(target)) === allowedHost;
  const idleTimeoutMs = options.idleTimeoutMs ?? tunnelIdleTimeoutMs();
  const idleTimers = /* @__PURE__ */ new Set();
  const idle = (first, second) => {
    if (!(idleTimeoutMs > 0)) return;
    let timer;
    const clear = () => {
      if (timer === void 0) return;
      clearTimeout(timer);
      idleTimers.delete(timer);
      timer = void 0;
    };
    const arm = () => {
      clear();
      timer = setTimeout(() => {
        idleTimers.delete(timer);
        timer = void 0;
        first.destroy();
        second.destroy();
      }, idleTimeoutMs);
      timer.unref();
      idleTimers.add(timer);
    };
    for (const socket of [first, second]) {
      socket.on("data", arm);
      socket.once("close", clear);
    }
    arm();
  };
  const server = createServer(async (request, response) => {
    let agent;
    try {
      const destination = new URL(request.url ?? "");
      if (!authorized(request) || destination.protocol !== "http:" || !permitted(destination)) {
        response.writeHead(403).end();
        return;
      }
      const socket = await socksConnect(proxy, destination, signal, track);
      if (request.destroyed || signal.aborted) {
        socket.destroy();
        response.destroy();
        return;
      }
      agent = new Agent({ keepAlive: false });
      agent.createConnection = () => socket;
      const headers = { ...request.headers, host: destination.host };
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      const upstream = httpRequest(destination, { method: request.method, headers, agent }, (incoming) => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(response);
      });
      upstream.on("error", () => response.destroy());
      request.on("aborted", () => upstream.destroy());
      response.once("close", () => {
        upstream.destroy();
        agent?.destroy();
      });
      request.pipe(upstream);
      idle(request.socket, socket);
    } catch {
      agent?.destroy();
      response.destroy();
    }
  });
  server.on("connection", (socket) => {
    track(socket);
  });
  server.on("connect", (request, client, head) => {
    void (async () => {
      try {
        const destination = new URL(`https://${request.url}`);
        if (!authorized(request) || !permitted(destination)) {
          client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
          return;
        }
        const upstream = await socksConnect(proxy, destination, signal, track);
        if (client.destroyed || signal.aborted) {
          upstream.destroy();
          client.destroy();
          return;
        }
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream).pipe(client);
        client.once("close", () => upstream.destroy());
        upstream.once("close", () => client.destroy());
        idle(client, upstream);
      } catch {
        client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      }
    })();
  });
  let closing;
  const close = () => closing ??= new Promise((resolve2) => {
    signal.removeEventListener("abort", abort);
    for (const timer of idleTimers) clearTimeout(timer);
    idleTimers.clear();
    for (const socket of sockets) socket.destroy();
    server.close(() => resolve2());
  });
  const abort = () => {
    void close();
  };
  try {
    signal.throwIfAborted();
    await new Promise((resolve2, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve2();
      });
    });
    server.on("error", () => {
      void close();
    });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      await close();
      signal.throwIfAborted();
    }
    const bound = server.address();
    if (!bound || typeof bound === "string") throw new Error("SOCKS relay did not bind");
    return { url: `http://free:${password}@127.0.0.1:${bound.port}`, close };
  } catch (error) {
    await close();
    throw error;
  }
}

// src/free-transport.ts
var OPENCODE_FREE_USER_AGENT = "opencode/latest/2.2.5/cli";
var MAX_METADATA_BYTES = 64 * 1024;
var MAX_PACKET_BYTES = 256 * 1024 * 1024;
var MAX_REQUEST_BODY_BYTES = 64 * 1024 * 1024;
var POSIX_WORKER_ENVIRONMENT = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ"];
var WINDOWS_WORKER_ENVIRONMENT = ["SystemRoot", "WINDIR", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC", "PATHEXT"];
function freeWorkerEnvironment(environment = process.env, platform = process.platform) {
  const names = platform === "win32" ? [...POSIX_WORKER_ENVIRONMENT, ...WINDOWS_WORKER_ENVIRONMENT] : POSIX_WORKER_ENVIRONMENT;
  const result = {};
  if (platform !== "win32") {
    for (const name2 of names) {
      const value = environment[name2];
      if (value !== void 0) result[name2] = value;
    }
    return result;
  }
  const keys = Object.keys(environment);
  for (const name2 of names) {
    const match = keys.find((key) => key === name2) ?? keys.find((key) => key.toUpperCase() === name2.toUpperCase());
    const value = match === void 0 ? void 0 : environment[match];
    if (match !== void 0 && value !== void 0) result[match] = value;
  }
  return result;
}
var FreeBunTransport = class {
  constructor(options = {}) {
    this.options = options;
    if (options.maxConcurrent !== void 0 && (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1)) {
      throw new RangeError("Free transport concurrency must be a positive integer");
    }
    if (options.maxRequestBodyBytes !== void 0 && (!Number.isSafeInteger(options.maxRequestBodyBytes) || options.maxRequestBodyBytes < 1)) {
      throw new RangeError("Free transport request body limit must be a positive integer");
    }
  }
  shutdown = new AbortController();
  workers = /* @__PURE__ */ new Set();
  requests = /* @__PURE__ */ new Set();
  waiters = /* @__PURE__ */ new Set();
  active = 0;
  /**
   * Build a fetch bound to one proxy URL.
   * @param raw - proxy URL; omitted or empty selects a direct connection.
   * @param streamIdleTimeoutMs - request stream idle budget the SOCKS relay must
   * outlive; omitted uses the default request stream budget.
   */
  forProxy(raw, streamIdleTimeoutMs) {
    const proxy = assertProxyURL(raw);
    const executable = (this.options.executable ?? resolveFreeRuntime)();
    const worker = (this.options.workerPath ?? freeWorkerPath)();
    return (input, init) => {
      const pending = this.fetchRequest(input, init, proxy, executable, worker, streamIdleTimeoutMs);
      this.requests.add(pending);
      void pending.then(() => this.requests.delete(pending), () => this.requests.delete(pending));
      return pending;
    };
  }
  async acquire(signal) {
    while (this.active >= (this.options.maxConcurrent ?? 4)) {
      await new Promise((resolve2, reject) => {
        const cleanup = () => {
          this.waiters.delete(wake);
          signal.removeEventListener("abort", abort);
        };
        const wake = () => {
          cleanup();
          resolve2();
        };
        const abort = () => {
          cleanup();
          reject(signal.reason);
        };
        this.waiters.add(wake);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
    }
    signal.throwIfAborted();
    this.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.waiters.values().next().value?.();
    };
  }
  async fetchRequest(input, init, proxy, executable, worker, streamIdleTimeoutMs) {
    const request = new Request(input, init);
    const signal = AbortSignal.any([request.signal, this.shutdown.signal]);
    signal.throwIfAborted();
    const url = new URL(request.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new TypeError("Free transport requires an HTTP URL");
    const maxBodyBytes = this.options.maxRequestBodyBytes ?? MAX_REQUEST_BODY_BYTES;
    const declaredLength = request.headers.get("content-length");
    if (declaredLength !== null && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBodyBytes) {
      throw new RangeError(`Free HTTP request body exceeds the ${maxBodyBytes} byte limit`);
    }
    const release = await this.acquire(signal);
    let relay;
    let started = false;
    try {
      let body;
      if (!["GET", "HEAD"].includes(request.method)) {
        const bytes = Buffer.from(await waitWithSignal(() => request.arrayBuffer(), signal));
        if (bytes.byteLength > maxBodyBytes) throw new RangeError(`Free HTTP request body exceeds the ${maxBodyBytes} byte limit`);
        if (bytes.byteLength > 0) body = bytes;
      }
      signal.throwIfAborted();
      if (proxy.startsWith("socks5:")) {
        relay = await openSocksTunnel(proxy, signal, {
          allowedHost: url.hostname,
          idleTimeoutMs: tunnelIdleTimeoutMs(streamIdleTimeoutMs)
        });
      }
      signal.throwIfAborted();
      const packet = {
        url: request.url,
        method: request.method,
        headers: [...request.headers],
        ...body ? { bodyLength: body.byteLength } : {},
        redirect: request.redirect,
        ...proxy ? { proxy: relay?.url ?? proxy } : {}
      };
      const serialized = JSON.stringify(packet) + "\n";
      const metadataBytes = Buffer.byteLength(serialized);
      if (metadataBytes + (body?.byteLength ?? 0) > MAX_PACKET_BYTES) throw new RangeError("Free HTTP request exceeds the 256 MiB IPC limit");
      const env = freeWorkerEnvironment();
      const child = spawn(executable, ["--no-env-file", worker], {
        env,
        cwd: dirname3(worker),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });
      started = true;
      const tunnel = relay;
      const closed = new Promise((resolve2) => child.once("close", () => {
        void tunnel?.close().finally(() => {
          release();
          resolve2();
        });
        if (!tunnel) {
          release();
          resolve2();
        }
      }));
      this.workers.add(closed);
      void closed.finally(() => this.workers.delete(closed));
      return await this.response(child, request, signal, serialized, body);
    } catch (error) {
      if (!started) {
        release();
        await relay?.close();
      }
      throw error;
    }
  }
  response(child, request, signal, packet, body) {
    return new Promise((resolve2, reject) => {
      let buffer = Buffer.alloc(0);
      let received = false;
      let finished = false;
      let controller;
      let killTimer;
      const cleanup = () => {
        signal.removeEventListener("abort", abort);
      };
      const stop = () => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");
          killTimer ??= setTimeout(() => child.kill("SIGKILL"), 1e3);
          killTimer.unref();
        }
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
      };
      const fail = (error) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (received) controller.error(error);
        else reject(error);
        stop();
      };
      const abort = () => fail(signal.reason);
      const stream5 = new ReadableStream({
        start(value) {
          controller = value;
        },
        pull() {
          child.stdout.resume();
        },
        cancel() {
          if (!finished) {
            finished = true;
            cleanup();
            stop();
          }
        }
      });
      child.stderr.resume();
      child.stdin.on("error", () => fail(new TypeError("Free HTTP worker input failed")));
      child.on("error", () => fail(new TypeError("Free HTTP worker could not start")));
      child.stdout.on("data", (bytes) => {
        if (finished) return;
        if (!received) {
          buffer = Buffer.concat([buffer, bytes]);
          const newline = buffer.indexOf(10);
          if (newline < 0) {
            if (buffer.length > MAX_METADATA_BYTES) fail(new TypeError("Free HTTP worker headers exceed limit"));
            return;
          }
          if (newline > MAX_METADATA_BYTES) return fail(new TypeError("Free HTTP worker headers exceed limit"));
          let metadata;
          try {
            metadata = JSON.parse(buffer.subarray(0, newline).toString());
            if (!Number.isInteger(metadata.status) || metadata.status < 200 || metadata.status > 599 || !Array.isArray(metadata.headers)) throw new Error();
            const noBody = request.method === "HEAD" || [204, 205, 304].includes(metadata.status);
            const response = new Response(noBody ? null : stream5, {
              status: metadata.status,
              statusText: metadata.statusText,
              headers: metadata.headers
            });
            Object.defineProperties(response, { url: { value: metadata.url }, redirected: { value: metadata.redirected } });
            received = true;
            resolve2(response);
          } catch {
            return fail(new TypeError("Free HTTP worker could not send the request"));
          }
          bytes = buffer.subarray(newline + 1);
          buffer = Buffer.alloc(0);
        }
        if (bytes.length) {
          controller.enqueue(new Uint8Array(bytes));
          if ((controller.desiredSize ?? 0) <= 0) child.stdout.pause();
        }
      });
      child.once("close", (code) => {
        if (killTimer) clearTimeout(killTimer);
        if (finished) return;
        if (code !== 0 || !received) return fail(new TypeError("Free HTTP worker stopped before the response completed"));
        finished = true;
        cleanup();
        controller.close();
      });
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      if (body) {
        child.stdin.write(packet);
        child.stdin.end(body);
      } else {
        child.stdin.end(packet);
      }
    });
  }
  async dispose() {
    this.shutdown.abort(new DOMException("Free transport disposed", "AbortError"));
    await Promise.allSettled([...this.requests, ...this.workers]);
  }
};

// src/free-channel.ts
import { createHash as createHash2 } from "node:crypto";
import { LlmError as LlmError4 } from "@deepseek-ai/dsh-llm";
var FreeChannelState = class {
  entries = /* @__PURE__ */ new Map();
  sequence = 0;
  key(config) {
    const endpoint = new URL(config.freeBaseURL).href.replace(/\/+$/, "");
    const proxy = config.proxyURL?.trim() ? new URL(config.proxyURL.trim()).href : "";
    return createHash2("sha256").update(JSON.stringify([endpoint, proxy])).digest("hex");
  }
  cooldownUntil(config) {
    const entry = this.entries.get(this.key(config));
    return entry?.cooldownUntil && entry.cooldownUntil > Date.now() ? entry.cooldownUntil : void 0;
  }
  assertReady(config) {
    const until = this.cooldownUntil(config);
    if (until !== void 0) throw new LlmError4(
      `OpenCode Free is cooling down until ${new Date(until).toISOString()} (${Math.ceil((until - Date.now()) / 1e3)}s remaining). Retry after the cooldown ends.`,
      "FREE_COOLDOWN"
    );
  }
  begin(config) {
    const key = this.key(config);
    if (!this.entries.has(key)) {
      if (this.entries.size >= 64) this.entries.delete(this.entries.keys().next().value);
      this.entries.set(key, { failures: 0, cooldownSequence: 0 });
    }
    return { key, sequence: ++this.sequence };
  }
  finish(ticket, result) {
    const entry = this.entries.get(ticket.key);
    if (!entry) return;
    const now = Date.now();
    if (result.outcome === "error") {
      const transient = ["FREE_QUOTA", "FREE_RATE_LIMIT", "FREE_CLIENT_RESTRICTED", "FREE_ACCESS_DENIED", "NETWORK", "TIMEOUT", "SERVER"].includes(result.code ?? "");
      if (transient) {
        entry.failures = Math.min(entry.failures + 1, 5);
        const retryAt = result.retryAt ?? now + Math.min(6e4 * 2 ** (entry.failures - 1), 15 * 6e4);
        entry.cooldownUntil = Math.max(entry.cooldownUntil ?? 0, retryAt);
        entry.cooldownSequence = Math.max(entry.cooldownSequence, ticket.sequence);
      }
    } else if (result.outcome === "success") {
      if (ticket.sequence >= entry.cooldownSequence) {
        entry.cooldownUntil = void 0;
        entry.failures = 0;
      }
    }
  }
};

// src/adapter.ts
var DEFAULT_MAX_TOKENS = 65536;
var MAX_REJECTED_KEY_REFS = 64;
var MAX_CREDENTIAL_VERSIONS = 64;
function observe(observer) {
  if (observer === void 0) return;
  try {
    observer();
  } catch {
  }
}
function endpointOrigin(raw) {
  try {
    return new URL(raw).origin;
  } catch {
    return "[invalid URL]";
  }
}
function freeReusesSavedKeys(config) {
  let free;
  try {
    free = new URL(config.freeBaseURL);
  } catch {
    return false;
  }
  if (free.hostname.toLowerCase() === "opencode.ai") return free.protocol === "https:" && free.port === "";
  try {
    return free.origin === new URL(config.baseURL).origin;
  } catch {
    return false;
  }
}
function requestMaxTokens(model, limits, requested) {
  const configured = limits[modelSettingsKey(model)]?.maxTokens ?? void 0;
  const allowance = configured === void 0 ? requested : Math.min(requested ?? configured, configured);
  return allowance ?? (model.maxTokens > DEFAULT_MAX_TOKENS ? DEFAULT_MAX_TOKENS : void 0);
}
function resolveReasoningLevel(model, effort, onWarning) {
  if (effort === void 0) return void 0;
  const supported = reasoningChoices(model, onWarning).map((choice) => choice.id);
  if (supported.some((level) => level === effort)) return effort;
  throw new LlmError5(
    `opencode-go model "${model.id}" does not support reasoning effort "${effort}"`,
    "UNSUPPORTED_REASONING_EFFORT"
  );
}
var OpencodeGoRequestExecutor = class {
  constructor(options, transport, freeTransport) {
    this.options = options;
    this.transport = transport;
    this.ownsFreeTransport = freeTransport === void 0;
    this.freeTransport = freeTransport ?? new FreeBunTransport();
  }
  freeTransport;
  ownsFreeTransport;
  /**
   * Release a Free transport this executor created itself. An injected
   * transport is released by its owner, so a direct construction is the only
   * caller for which this performs work.
   */
  async dispose() {
    if (this.ownsFreeTransport) await this.freeTransport.dispose();
  }
  /** One account, one SDK attempt; host recovery still owns failures after output. */
  async *stream(options, snapshot) {
    const state = snapshot.model.source === "free" ? this.options.freeChannel : void 0;
    if (!state) {
      yield* this.attempt(options, snapshot);
      return;
    }
    options.signal?.throwIfAborted();
    state.assertReady(snapshot.config);
    const ticket = state.begin(snapshot.config);
    let diagnostics;
    let finished = false;
    const record2 = async (outcome, code) => {
      if (finished) return;
      finished = true;
      const failureCode = code === "TIMEOUT" ? code : diagnostics ? await diagnostics.failureCode(code ?? "PI_AI_ERROR") : code ?? "UNKNOWN";
      state.finish(ticket, {
        outcome,
        code: outcome === "error" ? failureCode : void 0,
        retryAt: diagnostics?.retryDeadline()
      });
    };
    try {
      for await (const chunk of this.attempt(options, snapshot, (value) => {
        diagnostics = value;
      })) {
        if (chunk.type === "finish") {
          await record2(
            chunk.reason.kind === "error" ? "error" : chunk.reason.kind === "aborted" ? "aborted" : "success",
            chunk.reason.kind === "error" ? chunk.reason.failure.code : void 0
          );
        }
        yield chunk;
      }
      if (!finished) await record2("error", "PI_AI_ERROR");
    } catch (error) {
      await record2(
        options.signal?.aborted && !(error instanceof LlmError5 && error.code === "TIMEOUT") ? "aborted" : "error",
        error instanceof LlmError5 ? error.code : "UNKNOWN"
      );
      throw error;
    } finally {
      if (!finished) await record2("aborted");
    }
  }
  async *attempt(options, snapshot, onDiagnostics) {
    var _stack = [];
    try {
      if (options.stop !== void 0) {
        throw new LlmError5("llm-opencode-go does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
      }
      const { config, provider, model, sessionId } = snapshot;
      const maxTokens = requestMaxTokens(model, config.modelLimits, options.maxTokens);
      const reasoning = resolveReasoningLevel(model, options.reasoningEffort, (reason) => observe(() => this.options.onModelWarning?.({ model: model.id, reason })));
      const consumer = new AbortController();
      const upstream = options.signal === void 0 ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]);
      const watchdog = __using(_stack, idleWatchdog(upstream, config.streamIdleTimeoutMs, "LLM_STREAM_IDLE_TIMEOUT"));
      const preparation = __using(_stack, deadline(watchdog.signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, "LLM_PREPARATION_TIMEOUT"));
      try {
        const apiKey = snapshot.apiKey ?? await waitWithSignal(
          () => this.options.resolveApiKey(config, preparation.signal),
          preparation.signal
        );
        if (!apiKey) throw new LlmError5("llm-opencode-go: no credential resolved for the route", "MISSING_CREDENTIAL");
        const containsImage = options.messages.some((message) => contentHasImage2(message.content));
        if (containsImage && !model.input.includes("image")) {
          throw new LlmError5(`opencode-go model "${model.id}" does not support image input`, "UNSUPPORTED_CONTENT");
        }
        let imageRequest;
        if (containsImage) {
          const access = this.options.imageAccess;
          const store = access?.resolveAttachments();
          if (access === void 0 || store === void 0) {
            throw new LlmError5("llm-opencode-go image input requires the durable attachment service", "UNSUPPORTED_CONTENT");
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
        const onReplayDegrade = this.options.onReplayDegrade === void 0 ? void 0 : (reason) => {
          observe(() => this.options.onReplayDegrade?.(reason));
        };
        const context = await waitWithSignal(() => imageRequest === void 0 ? Promise.resolve(toPiContext(options, void 0, onReplayDegrade)) : toPiContext({ ...options, signal: preparation.signal }, imageRequest, onReplayDegrade), preparation.signal);
        preparation[Symbol.dispose]();
        watchdog.signal.throwIfAborted();
        const transcript = normalizeContext(context);
        const usageContext = piContextUsageKey(context, options.provider, model.id);
        const diagnostics = new GatewayDiagnostics({
          provider: String(options.provider),
          model: model.id,
          apiKey,
          proxyURL: config.proxyURL,
          free: model.source === "free",
          // Free's SOCKS relay must outlive this request's own stream idle budget:
          // the budget is user-configurable and the relay must not classify the
          // stall as a network error before the stream watchdog fires.
          fetch: model.source === "free" ? this.freeTransport.forProxy(config.proxyURL, config.streamIdleTimeoutMs) : this.transport.forProxy(config.proxyURL),
          contextWindow: model.contextWindow,
          maxTokens: maxTokens ?? model.maxTokens,
          get estimatedContextTokens() {
            return estimateContextTokens(transcript).tokens;
          }
        });
        onDiagnostics?.(diagnostics);
        const diagnosticsFetch = diagnostics.fetch;
        let httpStatus;
        const observedFetch = async (input, init) => {
          const response = await diagnosticsFetch(input, init);
          if (!response.ok) httpStatus = response.status;
          return response;
        };
        const failureFacts = () => {
          const retryAt = diagnostics.retryDeadline();
          const retryAfterMs = retryAt === void 0 ? void 0 : retryAt - Date.now();
          return {
            ...httpStatus === void 0 ? {} : { status: httpStatus },
            ...retryAfterMs === void 0 || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0 ? {} : { providerRetryAfterMs: retryAfterMs }
          };
        };
        const reasoningOptions = reasoningRequest(reasoningIntent(model, reasoning, (reason) => observe(() => this.options.onModelWarning?.({ model: model.id, reason }))));
        const events = provider.streamSimple(model, transcript, {
          apiKey,
          fetch: observedFetch,
          ...reasoningOptions,
          ...options.temperature === void 0 ? {} : { temperature: options.temperature },
          ...maxTokens === void 0 ? {} : { maxTokens },
          sessionId,
          signal: watchdog.signal,
          headers: model.source === "free" ? {
            "x-opencode-session": sessionId,
            "user-agent": OPENCODE_FREE_USER_AGENT,
            authorization: `Bearer ${apiKey}`
          } : {
            "x-opencode-session": sessionId,
            ...attributionHeaders3()
          },
          // The agent recovery layer owns visible attempts; one adapter call is
          // one SDK attempt.
          maxRetries: 0
        });
        const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id, options.provider, maxTokens, usageContext)[Symbol.asyncIterator]();
        let exhausted = false;
        try {
          while (true) {
            const result = await waitWithSignal(() => watchdog.next(iterator), watchdog.signal);
            if (timeoutOf(watchdog.signal, "LLM_REQUEST_TIMEOUT")) throw new LlmError5("opencode-go whole request timeout", "TIMEOUT");
            if (timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT") !== void 0) {
              throw new LlmError5("opencode-go stream idle timeout", "TIMEOUT");
            }
            if (result.done) {
              exhausted = true;
              return;
            }
            const chunk = result.value;
            if (chunk.type === "finish" && chunk.reason.kind === "error") {
              const failure = chunk.reason.failure;
              const message = await waitWithSignal(() => diagnostics.failureMessage(failure.message), watchdog.signal);
              const code = await waitWithSignal(() => diagnostics.failureCode(failure.code), watchdog.signal);
              const finished = { ...chunk, reason: options.signal?.aborted ? { kind: "aborted", failure: { code: "ABORTED", message: "opencode-go request aborted by caller" } } : { ...chunk.reason, failure: { ...chunk.reason.failure, message, code, ...failureFacts() } } };
              yield finished;
            } else {
              yield chunk;
            }
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
          throw new LlmError5("opencode-go credential/image preparation timeout", "TIMEOUT", { cause: error });
        }
        if (timeoutOf(watchdog.signal, "LLM_REQUEST_TIMEOUT")) {
          throw new LlmError5("opencode-go whole request timeout", "TIMEOUT", { cause: error });
        }
        if (timeoutOf(watchdog.signal, "LLM_STREAM_IDLE_TIMEOUT") !== void 0) {
          throw new LlmError5("opencode-go stream idle timeout", "TIMEOUT", { cause: error });
        }
        if (options.signal?.aborted) {
          throw new LlmError5("opencode-go request aborted by caller", "ABORTED", { cause: error });
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
var REJECTED_KEY_TTL_MS = 5 * 6e4;
function withModelLimit(model, limits) {
  const limit = limits[modelSettingsKey(model)];
  if (limit == null) return model;
  return {
    ...model,
    contextWindow: limit.contextWindow ?? model.contextWindow,
    maxTokens: limit.maxTokens ?? model.maxTokens,
    reasoningBudgetPresets: limit.thinkingBudgets ?? void 0
  };
}
var SESSION_HEADER_PREFIX = "dsh-go-session-v1-";
function opencodeSessionValue(sessionId) {
  if (sessionId === void 0 || sessionId.length === 0) return randomUUID3();
  if (!/[^\x21-\x7e]/.test(sessionId) && !sessionId.startsWith(SESSION_HEADER_PREFIX)) return sessionId;
  return SESSION_HEADER_PREFIX + createHash3("sha256").update(sessionId, "utf16le").digest("base64url");
}
var OpencodeGoAdapter = class extends LlmAdapter {
  constructor(options) {
    super();
    this.options = options;
    this.source = options.source ?? "go";
    this.freeChannel = options.freeChannel ?? new FreeChannelState();
    this.ownsTransport = options.transport === void 0;
    this.transport = options.transport ?? new ProxyTransport();
    this.requestExecutor = new OpencodeGoRequestExecutor({ ...options, freeChannel: this.freeChannel }, this.transport, this.freeTransport);
    const catalogs = options.catalog ? void 0 : new GoCatalogManager({
      transport: this.transport,
      onFallback: options.onFallback,
      onOmitted: options.onOmitted,
      onRefresh: options.onCatalogRefresh,
      onWarning: options.onCatalogWarning
    });
    this.resolveCatalog = options.catalog ?? ((config) => catalogs.forConfig(config, this.source));
  }
  source;
  resolveCatalog;
  transport;
  /** An injected transport is shared with the Host and must not be disposed here. */
  ownsTransport;
  requestExecutor;
  freeTransport = new FreeBunTransport();
  freeChannel;
  /** Per-reference rejection deadlines, isolated by the gateway that rejected it. */
  rejectedKeys = /* @__PURE__ */ new Map();
  /**
   * Reference updates invalidate rejections from attempts using an older key.
   * Values are globally monotonic epochs, so pruning never reuses a version.
   */
  credentialVersions = /* @__PURE__ */ new Map();
  credentialEpoch = 0;
  /** Monotonic sequence of the latest request this adapter started. */
  callSeq = 0;
  nextCallSequence() {
    return this.options.nextCallSequence?.() ?? ++this.callSeq;
  }
  /**
   * Release this adapter's own resources. The Host composition shares one
   * ProxyTransport across both adapters and its services, so only an
   * adapter-created transport is disposed here; the per-adapter Free transport
   * (Bun workers and SOCKS tunnels) always is.
   */
  async dispose() {
    await Promise.all([
      this.ownsTransport ? this.transport.dispose() : Promise.resolve(),
      this.freeTransport.dispose()
    ]);
  }
  /**
   * The catalog resolver for one configuration, rebuilding on the facts it
   * owns. Public for the plugin's discovery registration, which resolves the
   * current configuration the same way the adapter does.
   * @param config - the endpoint and refresh interval for the raw catalog.
   * @returns the resolver caching catalog values, independent of deployment limits.
   */
  catalogOf(config) {
    return this.resolveCatalog(config);
  }
  providerInfo(provider) {
    return { id: provider, name: this.source === "go" ? DISPLAY_NAME : FREE_DISPLAY_NAME };
  }
  /**
   * Report the exact request-image projection this route serializes: the
   * configured pixel budget decides the dimensions and the configured
   * encoded-byte target caps the bytes, matching conversion.ts's per-request
   * target. The token meter must price what is sent, not the normalized source.
   * Synchronous by contract; the live configuration is readable without I/O.
   */
  imageRequestTarget(_provider, _model, image) {
    const config = this.options.config();
    const target = requestImageTargetFor(image, {
      maxPixels: config.requestImagePixelBudget,
      maxBytes: config.requestImageMaxBytes
    });
    return { width: target.width, height: target.height, maxBytes: target.maxBytes };
  }
  async listModels(_provider) {
    const config = this.options.config();
    const snapshot = await this.catalogOf(config).snapshot();
    return [...snapshot.models.values()].filter((model) => isModelEnabled({ id: model.id, source: this.source, ...snapshot.details.get(model.id) }, config.modelVisibility)).map((model) => ({
      provider: this.source === "go" ? PROVIDER_ID : FREE_PROVIDER_ID,
      id: model.id,
      name: model.name,
      inputModalities: [...model.input]
    }));
  }
  async resolveModel(_provider, model, signal) {
    const snapshot = await this.modelSnapshot(model, signal);
    return this.modelInfo(snapshot.model, snapshot.config.modelLimits);
  }
  /** Capture limits and protocol before discovery can yield to a settings update. */
  async modelSnapshot(model, signal, config = structuredClone(this.options.config())) {
    var _stack = [];
    try {
      const preparation = __using(_stack, deadline(signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, "LLM_PREPARATION_TIMEOUT"));
      let catalog;
      try {
        catalog = await this.catalogOf(config).forModel(model, preparation.signal);
      } catch (error) {
        if (timeoutOf(preparation.signal, "LLM_PREPARATION_TIMEOUT")) throw new LlmError5("opencode-go discovery preparation timeout", "TIMEOUT", { cause: error });
        throw error;
      }
      const resolved = catalog.models.get(model);
      if (resolved === void 0) {
        throw new LlmError5(`opencode-go has no model "${model}"`, "UNKNOWN_MODEL");
      }
      return { config, catalog, model: withModelLimit(resolved, config.modelLimits) };
    } catch (_) {
      var _error = _, _hasError = true;
    } finally {
      __callDispose(_stack, _error, _hasError);
    }
  }
  /** Keep capability resolution and eventual dispatch on the same configuration. */
  async prepareCall(_provider, model, signal) {
    const seq = this.nextCallSequence();
    const generation = this.options.accountGeneration?.() ?? 0;
    const snapshot = { generation, ...await this.modelSnapshot(model, signal) };
    return {
      model: this.modelInfo(snapshot.model, snapshot.config.modelLimits),
      stream: (options) => this.streamWithSnapshot(options, snapshot, seq)
    };
  }
  /** Report the same default allowance used by dispatch so the host can budget compaction. */
  modelInfo(model, limits) {
    const defaultMaxTokens = requestMaxTokens(model, limits);
    const reasoning = {};
    const choices = reasoningChoices(model, (reason) => observe(() => this.options.onModelWarning?.({ model: model.id, reason })));
    if (choices.length > 0) {
      reasoning.reasoning = {
        efforts: choices.map((choice) => ({ ...choice, id: ReasoningEffortId(choice.id) }))
      };
    }
    return {
      provider: this.source === "go" ? PROVIDER_ID : FREE_PROVIDER_ID,
      id: model.id,
      name: model.name,
      inputModalities: [...model.input],
      context: { contextWindow: model.contextWindow },
      ...defaultMaxTokens === void 0 ? {} : { defaultMaxTokens },
      ...reasoning
    };
  }
  async *stream(options) {
    if (options.stop !== void 0) {
      throw new LlmError5("llm-opencode-go does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
    }
    yield* this.dispatch(options, this.nextCallSequence());
  }
  async *streamWithSnapshot(options, snapshot, seq) {
    yield* this.dispatch(options, seq, snapshot);
  }
  async *dispatch(options, seq, prepared) {
    var _stack = [];
    try {
      const captured = prepared ?? { generation: this.options.accountGeneration?.() ?? 0, config: structuredClone(this.options.config()) };
      const sessionId = opencodeSessionValue(options.sessionId === void 0 ? void 0 : String(options.sessionId));
      const whole = __using(_stack, deadline(options.signal, captured.config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, "LLM_REQUEST_TIMEOUT"));
      try {
        if (this.source === "free") {
          whole.signal.throwIfAborted();
          this.freeChannel.assertReady(captured.config);
        }
        const snapshot = prepared ?? {
          generation: captured.generation,
          ...await this.modelSnapshot(options.model, whole.signal, captured.config)
        };
        for await (const chunk of this.streamAccounts({ ...options, signal: whole.signal }, { ...snapshot, sessionId }, seq)) {
          yield chunk;
        }
      } catch (error) {
        if (timeoutOf(whole.signal, "LLM_REQUEST_TIMEOUT")) {
          throw new LlmError5("opencode-go whole request timeout", "TIMEOUT", { cause: error });
        }
        if (options.signal?.aborted) {
          yield { type: "finish", reason: { kind: "aborted", failure: { code: "ABORTED", message: "opencode-go request aborted by caller" } } };
          return;
        }
        throw error;
      }
    } catch (_) {
      var _error = _, _hasError = true;
    } finally {
      __callDispose(_stack, _error, _hasError);
    }
  }
  async *streamAccounts(options, snapshot, seq) {
    const streamPublic = () => this.requestExecutor.stream(options, {
      config: snapshot.config,
      model: snapshot.model,
      provider: snapshot.catalog.provider,
      sessionId: snapshot.sessionId,
      apiKey: "public"
    });
    if (this.source === "free" && !freeReusesSavedKeys(snapshot.config)) {
      observe(() => this.options.onFreeCredentialWithheld?.({
        reason: "unbound-free-endpoint",
        freeBaseURL: endpointOrigin(snapshot.config.freeBaseURL)
      }));
      yield* streamPublic();
      return;
    }
    const accounts = accountsOf(snapshot.config);
    if (this.source === "go" && accounts.length === 0) throw new LlmError5("OpenCode Go has no accounts", "MISSING_CREDENTIAL");
    const preferred = accountRefOf(snapshot.config);
    const ordered = this.source === "free" ? accounts.map((account) => account.apiKeyEnv) : snapshot.config.autoSwitch ? [.../* @__PURE__ */ new Set([preferred, ...accounts.map((account) => account.apiKeyEnv)])] : [preferred];
    const now = Date.now();
    const gateway = assertBaseURL(
      this.source === "go" ? snapshot.config.baseURL : snapshot.config.freeBaseURL,
      this.source === "go" ? "baseURL" : "freeBaseURL"
    );
    this.pruneRejectedKeys(now);
    const usable = ordered.filter((ref) => {
      const until = this.rejectedKeys.get(ref)?.get(gateway);
      return until === void 0 || now >= until;
    });
    const candidates = this.accountCandidates(snapshot.config, ordered, usable, options.signal);
    let candidate = await candidates.next();
    if (candidate.done) {
      if (this.source === "free") yield* streamPublic();
      return;
    }
    let switchReason;
    let failedRef;
    let publicFallback = false;
    while (!candidate.done && !publicFallback) {
      const { ref, apiKey, credentialVersion, skippedRef } = candidate.value;
      let emitted = false;
      let usage;
      let retry = false;
      const retryFailure = async (failure) => {
        const reason = accountFallback({
          failure,
          emitted,
          totalTokens: usage?.usage.totalTokens ?? 0,
          aborted: options.signal?.aborted === true,
          hasNext: snapshot.config.autoSwitch === true || this.source === "free"
        });
        if (!emitted && !options.signal?.aborted && !usage?.usage.totalTokens && failure && isGatewayKeyRejection(failure) && credentialVersion === (this.credentialVersions.get(ref) ?? 0)) this.rememberRejectedKey(ref, gateway);
        if (!reason || !failure) return false;
        if (snapshot.config.autoSwitch) {
          const next = await candidates.next();
          if (!next.done) {
            switchReason ??= reason;
            failedRef ??= ref;
            candidate = next;
            return true;
          }
        }
        publicFallback = this.source === "free" && ["INVALID_CREDENTIAL", "AUTH"].includes(failure.code);
        return publicFallback;
      };
      const announce = () => {
        if (emitted) return;
        const serving = ref;
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
        observe(() => this.options.onAccountSettled?.({ seq, generation: snapshot.generation, config: snapshot.config, ref: serving, notice }));
        observe(() => this.options.onAccountSwitch?.(notice, snapshot.config, seq));
      };
      try {
        for await (const chunk of this.requestExecutor.stream(options, {
          config: { ...snapshot.config, apiKeyEnv: ref },
          model: snapshot.model,
          provider: snapshot.catalog.provider,
          sessionId: snapshot.sessionId,
          ...apiKey === void 0 ? {} : { apiKey }
        })) {
          if (chunk.type === "usage") {
            usage = chunk;
            continue;
          }
          if (chunk.type === "finish") {
            const failure = chunk.reason.kind === "error" ? chunk.reason.failure : void 0;
            if (await retryFailure(failure)) {
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
        if (!await retryFailure(error instanceof LlmError5 ? error : void 0)) throw error;
      }
    }
    if (publicFallback) yield* streamPublic();
  }
  /** Resolve Free keys only when selecting an account or retrying a failed attempt. */
  async *accountCandidates(config, ordered, usable, signal) {
    if (this.source === "go") {
      const refs = usable.length > 0 ? usable : ordered;
      const skippedRef = ordered.find((ref) => !refs.includes(ref));
      for (const ref of refs) yield { ref, skippedRef, credentialVersion: this.credentialVersions.get(ref) ?? 0 };
      return;
    }
    const groups = config.autoSwitch ? [usable, ordered.filter((ref) => !usable.includes(ref))] : [ordered];
    for (const refs of groups) {
      let found = false;
      const skippedRef = refs === usable ? ordered.find((ref) => !usable.includes(ref)) : void 0;
      for (const ref of refs) {
        const credentialVersion = this.credentialVersions.get(ref) ?? 0;
        let apiKey;
        {
          var _stack = [];
          try {
            const preparation = __using(_stack, deadline(signal, config.requestPreparationTimeoutMs ?? DEFAULT_REQUEST_PREPARATION_TIMEOUT_MS, "LLM_PREPARATION_TIMEOUT"));
            try {
              apiKey = await waitWithSignal(() => this.options.resolveApiKey({ ...config, apiKeyEnv: ref }, preparation.signal), preparation.signal);
            } catch (error) {
              if (timeoutOf(preparation.signal, "LLM_PREPARATION_TIMEOUT")) throw new LlmError5("opencode-free credential preparation timeout", "TIMEOUT", { cause: error });
              if (!(error instanceof LlmError5) || !["MISSING_CREDENTIAL", "INVALID_CREDENTIAL"].includes(error.code)) throw error;
            }
          } catch (_) {
            var _error = _, _hasError = true;
          } finally {
            __callDispose(_stack, _error, _hasError);
          }
        }
        if (!apiKey?.trim()) continue;
        found = true;
        yield { ref, apiKey, credentialVersion, skippedRef };
        if (!config.autoSwitch) return;
      }
      if (found) return;
    }
  }
  /** Drop expired rejections so the maps stay bounded by the recent window. */
  pruneRejectedKeys(now) {
    for (const [ref, gateways] of this.rejectedKeys) {
      for (const [gateway, until] of gateways) if (now >= until) gateways.delete(gateway);
      if (gateways.size === 0) this.rejectedKeys.delete(ref);
    }
  }
  rememberRejectedKey(ref, gateway) {
    const now = Date.now();
    this.pruneRejectedKeys(now);
    const rejected = this.rejectedKeys.get(ref) ?? /* @__PURE__ */ new Map();
    rejected.set(gateway, now + REJECTED_KEY_TTL_MS);
    this.rejectedKeys.set(ref, rejected);
    while (this.rejectedKeys.size > MAX_REJECTED_KEY_REFS) {
      const oldest = this.rejectedKeys.keys().next().value;
      if (oldest === void 0 || oldest === ref) break;
      this.rejectedKeys.delete(oldest);
    }
  }
  /** A stored change to a reference outranks the gateway's last rejection of it. */
  forgetRejectedKey(ref) {
    this.credentialEpoch += 1;
    this.credentialVersions.set(ref, this.credentialEpoch);
    this.rejectedKeys.delete(ref);
    this.pruneCredentialVersions();
  }
  /**
   * Keep the version map bounded: account rosters are at most MAX_ACCOUNTS, so
   * only references that are not current accounts can push it over the cap.
   * Those are evicted first; the roster entries are kept. A pruned entry reads
   * as version 0 (unchanged), which cannot falsely match an attempt that saw a
   * real epoch (>= 1); requests started before a reference's first change keep
   * their 0 and are only reachable in the artificial overflow/rename window.
   */
  pruneCredentialVersions() {
    if (this.credentialVersions.size <= MAX_CREDENTIAL_VERSIONS) return;
    const roster = new Set(accountsOf(this.options.config()).map((account) => account.apiKeyEnv));
    for (const ref of this.credentialVersions.keys()) {
      if (this.credentialVersions.size <= MAX_CREDENTIAL_VERSIONS) return;
      if (!roster.has(ref)) this.credentialVersions.delete(ref);
    }
    while (this.credentialVersions.size > MAX_CREDENTIAL_VERSIONS) {
      const oldest = this.credentialVersions.keys().next().value;
      if (oldest === void 0) return;
      this.credentialVersions.delete(oldest);
    }
  }
};

// src/analytics.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { attributionHeaders as attributionHeaders4 } from "@deepseek-ai/dsh-llm";
import { RemoteError as RemoteError2, TypertRemoteService as TypertRemoteService3 } from "@deepseek-ai/dsh-typert-protocol";
var ANALYTICS_MAX_BYTES = 16 * 1024 * 1024;
var CACHE_MS = 3e4;
var REQUEST_TIMEOUT_MS = 3e4;
var CONSOLE_ORIGIN = "https://opencode.ai";
var DAY_MS = 864e5;
var CSV_COLUMNS = [
  "day",
  "user_type",
  "user_id",
  "user_name",
  "provider",
  "model",
  "requests",
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_write_5m_tokens",
  "cache_write_1h_tokens",
  "cost_micro_cents",
  "cost_usd"
];
var TOTAL_FIELDS = [
  "requests",
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWrite5mTokens",
  "cacheWrite1hTokens",
  "cacheWriteTokens",
  "tokens",
  "costMicroCents"
];
function invalidCsv() {
  throw new SyntaxError("Invalid official usage CSV");
}
function isAbortReason(error) {
  return error !== null && typeof error === "object" && "name" in error && String(error.name) === "AbortError";
}
function csvRecords(raw) {
  const csv = raw.replace(/^\uFEFF/, "");
  if (!csv || csv.includes("\0")) return invalidCsv();
  const records = [];
  let row = [], field = "";
  let state = "start";
  let ended = false;
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    ended = false;
    if (state === "quoted") {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index++;
        } else state = "closed";
      } else field += char;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      state = "start";
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r") {
        if (csv[index + 1] !== "\n") return invalidCsv();
        index++;
      }
      row.push(field);
      if (row.some((value) => value !== "")) records.push(row);
      row = [];
      field = "";
      state = "start";
      ended = true;
      continue;
    }
    if (state === "closed") return invalidCsv();
    if (char === '"') {
      if (state !== "start") return invalidCsv();
      state = "quoted";
    } else {
      field += char;
      state = "bare";
    }
  }
  if (state === "quoted") return invalidCsv();
  if (!ended) {
    row.push(field);
    if (row.some((value) => value !== "")) records.push(row);
  }
  return records;
}
function exactInteger(value) {
  if (!/^\d{1,100}$/.test(value)) return invalidCsv();
  return BigInt(value);
}
function zero() {
  return {
    requests: 0n,
    inputTokens: 0n,
    outputTokens: 0n,
    cacheReadTokens: 0n,
    cacheWrite5mTokens: 0n,
    cacheWrite1hTokens: 0n,
    cacheWriteTokens: 0n,
    tokens: 0n,
    costMicroCents: 0n
  };
}
function add(target, value) {
  for (const field of TOTAL_FIELDS) target[field] += value[field];
}
function strings(value) {
  return Object.fromEntries(TOTAL_FIELDS.map((field) => [field, value[field].toString()]));
}
function parseCsv(csv) {
  const [header, ...records] = csvRecords(csv);
  if (!header || header.length !== CSV_COLUMNS.length || new Set(header).size !== header.length || CSV_COLUMNS.some((column) => !header.includes(column))) return invalidCsv();
  const columns = Object.fromEntries(header.map((column, index) => [column, index]));
  const rows = records.map((fields2) => {
    const aligned = fields2.length > header.length ? fields2.slice(0, header.length) : fields2;
    if (aligned.length !== header.length) return invalidCsv();
    const get = (column) => aligned[columns[column]];
    const day = get("day"), provider = get("provider"), model = get("model");
    if (!validReleaseDate(day) || !provider.trim() || !model.trim() || provider.length > 1024 || model.length > 1024 || /[\u0000-\u001f\u007f]/.test(provider + model)) return invalidCsv();
    const totals = {
      requests: exactInteger(get("requests")),
      inputTokens: exactInteger(get("input_tokens")),
      outputTokens: exactInteger(get("output_tokens")),
      cacheReadTokens: exactInteger(get("cache_read_tokens")),
      cacheWrite5mTokens: exactInteger(get("cache_write_5m_tokens")),
      cacheWrite1hTokens: exactInteger(get("cache_write_1h_tokens")),
      cacheWriteTokens: 0n,
      tokens: 0n,
      costMicroCents: exactInteger(get("cost_micro_cents"))
    };
    totals.cacheWriteTokens = totals.cacheWrite5mTokens + totals.cacheWrite1hTokens;
    totals.tokens = totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
    return { fields: aligned, day, provider, model, totals };
  });
  return { header, rows };
}
function utcDay(now) {
  return new Date(now).toISOString().slice(0, 10);
}
function rangeOf(period, now) {
  const days = period === "today" ? 1 : Number(period.slice(0, -1));
  return { from: Math.floor(now / DAY_MS) * DAY_MS - (days - 1) * DAY_MS, to: now };
}
function rowsIn(data, period) {
  const range = rangeOf(period, data.generatedAt);
  const from = utcDay(range.from), to = utcDay(range.to);
  return data.rows.filter((row) => row.day >= from && row.day <= to);
}
function aggregate(data, query) {
  const totals = zero();
  const models = /* @__PURE__ */ new Map();
  const days = /* @__PURE__ */ new Map();
  const range = rangeOf(query.range, data.generatedAt);
  for (let time = range.from; time <= Math.floor(range.to / DAY_MS) * DAY_MS; time += DAY_MS) days.set(utcDay(time), zero());
  for (const row of rowsIn(data, query.range)) {
    add(totals, row.totals);
    add(days.get(row.day), row.totals);
    const id = JSON.stringify([row.provider, row.model]);
    let model = models.get(id);
    if (!model) {
      model = { provider: row.provider, model: row.model, totals: zero() };
      models.set(id, model);
    }
    add(model.totals, row.totals);
  }
  return {
    accountRef: query.accountRef,
    source: data.source,
    generatedAt: data.generatedAt,
    period: query.range,
    range,
    timeZone: "UTC",
    totals: strings(totals),
    byModel: [...models.values()].sort((a, b) => a.totals.costMicroCents > b.totals.costMicroCents ? -1 : a.totals.costMicroCents < b.totals.costMicroCents ? 1 : a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model)).map((row) => ({ provider: row.provider, model: row.model, ...strings(row.totals) })),
    byDay: [...days].map(([day, value]) => ({ day, ...strings(value) }))
  };
}
function encodeCsv(rows) {
  return rows.map((row) => row.map((value) => /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value).join(",")).join("\r\n") + "\r\n";
}
var GoAnalyticsService = class extends TypertRemoteService3 {
  constructor(ctx, options) {
    super(ctx, "opencodeGoAnalytics");
    this.options = options;
    this.transport = options.transport ?? new ProxyTransport();
    ctx.effect(() => () => {
      for (const pending of this.active) pending.controller.abort(this.cancelled(pending.source));
      this.active.clear();
      this.pending.clear();
      this.cache.clear();
      this.identities.clear();
      if (!options.transport) return this.transport.dispose();
    });
  }
  identities = /* @__PURE__ */ new Map();
  cache = /* @__PURE__ */ new Map();
  pending = /* @__PURE__ */ new Map();
  active = /* @__PURE__ */ new Set();
  transport;
  async read(raw, signal) {
    const query = this.query(raw);
    return aggregate(await this.dataset(query, signal), query);
  }
  async exportCsv(raw, signal) {
    const query = this.query(raw);
    const data = await this.dataset(query, signal);
    return {
      filename: "opencode-usage-" + query.range + "-" + data.day + ".csv",
      csv: encodeCsv([data.header, ...rowsIn(data, query.range).map((row) => row.fields)])
    };
  }
  now() {
    return this.options.now?.() ?? Date.now();
  }
  query(raw) {
    try {
      return parseAnalyticsQuery(raw);
    } catch {
      throw this.failure("invalid-query", "Invalid official usage history query", false);
    }
  }
  failure(reason, message, retryable, source, retainPrevious = retryable) {
    return new RemoteError2("opencode-go/analytics-unavailable", message, {
      reason,
      retryable,
      retainPrevious,
      ...source ? { source } : {}
    });
  }
  /** A shared task superseded by an identity/network change is not a caller cancellation. */
  cancelled(source) {
    return this.failure(
      "network",
      "The official usage history request was superseded by an account, credential or connection change; retry it",
      true,
      source,
      false
    );
  }
  forget(identity) {
    this.identities.delete(identity.accountRef);
    for (const [key, data] of this.cache) if (data.source === identity.source) this.cache.delete(key);
    for (const pending of this.active) if (pending.source === identity.source) pending.controller.abort(this.cancelled(pending.source));
    for (const [key, pending] of this.pending) if (pending.source === identity.source) this.pending.delete(key);
  }
  network() {
    let baseURL;
    try {
      const url = new URL(this.options.baseURL());
      if (url.origin !== CONSOLE_ORIGIN || url.username || url.password || url.search || url.hash) throw new Error();
      baseURL = url.href;
    } catch {
      throw this.failure("unsupported-gateway", "Official usage history is only available with the official OpenCode gateway", false);
    }
    let proxyURL;
    try {
      proxyURL = assertProxyURL(this.options.proxyURL?.());
    } catch {
      throw this.failure("invalid-proxy", "The OpenCode proxy address is invalid", false);
    }
    return { baseURL, proxyURL };
  }
  assertCurrentNetwork(identity) {
    const current = this.network();
    if (current.baseURL !== identity.baseURL || current.proxyURL !== identity.proxyURL) {
      throw this.failure("network", "The OpenCode connection changed; retry the usage history request", true, identity.source, false);
    }
  }
  async identity(query, signal) {
    signal?.throwIfAborted();
    const refs = this.options.accountRefs();
    for (const identity2 of this.identities.values()) if (!refs.includes(identity2.accountRef)) this.forget(identity2);
    if (!refs.includes(query.accountRef)) throw this.failure("unknown-account", "The selected OpenCode account no longer exists", false);
    let baseURL, proxyURL;
    try {
      ({ baseURL, proxyURL } = this.network());
    } catch (error) {
      const old = this.identities.get(query.accountRef);
      if (old) this.forget(old);
      throw error;
    }
    let key;
    try {
      key = await waitWithSignal(() => this.options.resolveApiKey(query.accountRef), signal);
    } catch (error) {
      signal?.throwIfAborted();
      const old = this.identities.get(query.accountRef);
      if (old) this.forget(old);
      const missing = error !== null && typeof error === "object" && "code" in error && error.code === "MISSING_CREDENTIAL";
      throw this.failure(
        missing ? "missing-credential" : "credential-unavailable",
        missing ? "The selected OpenCode account has no API key" : "Could not resolve the selected OpenCode account API key",
        !missing,
        void 0,
        false
      );
    }
    signal?.throwIfAborted();
    try {
      this.assertCurrentNetwork({ baseURL, proxyURL, source: "" });
    } catch (error) {
      const old = this.identities.get(query.accountRef);
      if (old) this.forget(old);
      throw error;
    }
    if (!this.options.accountRefs().includes(query.accountRef)) {
      const old = this.identities.get(query.accountRef);
      if (old) this.forget(old);
      throw this.failure("unknown-account", "The selected OpenCode account no longer exists", false);
    }
    if (!key || !key.trim() || /[\r\n\0]/.test(key)) {
      const old = this.identities.get(query.accountRef);
      if (old) this.forget(old);
      throw this.failure("missing-credential", "The selected OpenCode account has no usable API key", false);
    }
    let identity = this.identities.get(query.accountRef);
    if (!identity || identity.baseURL !== baseURL || identity.proxyURL !== proxyURL || identity.key !== key) {
      if (identity) this.forget(identity);
      identity = { accountRef: query.accountRef, baseURL, proxyURL, key, source: randomUUID4() };
      this.identities.set(query.accountRef, identity);
    }
    return identity;
  }
  async dataset(query, signal) {
    const identity = await this.identity(query, signal);
    const now = this.now(), day = utcDay(now);
    for (const [key, cached3] of this.cache) {
      if (cached3.day !== day || now < cached3.generatedAt || now - cached3.generatedAt >= CACHE_MS) this.cache.delete(key);
    }
    const period = query.range === "today" ? "7d" : query.range;
    const cacheKey = identity.source + ":" + day + ":" + period;
    const cached2 = this.cache.get(cacheKey);
    if (!query.refresh && cached2) return cached2;
    let pending = query.refresh ? void 0 : this.pending.get(cacheKey);
    if (!pending || pending.controller.signal.aborted) {
      const controller = new AbortController();
      const task2 = { controller, consumers: 0, source: identity.source, promise: void 0 };
      this.active.add(task2);
      task2.promise = this.fetchDataset(identity, period, now, controller.signal).then((data) => {
        if (this.pending.get(cacheKey) === task2 && this.identities.get(query.accountRef) === identity && this.options.accountRefs().includes(query.accountRef)) this.cache.set(cacheKey, data);
        return data;
      }).catch((error) => {
        if (this.pending.get(cacheKey) === task2 && error instanceof RemoteError2 && error.details && typeof error.details === "object" && "retryable" in error.details && error.details.retryable === false) this.cache.delete(cacheKey);
        throw error;
      }).finally(() => {
        this.active.delete(task2);
        if (this.pending.get(cacheKey) === task2) this.pending.delete(cacheKey);
      });
      this.pending.set(cacheKey, task2);
      pending = task2;
    }
    const task = pending;
    task.consumers++;
    try {
      return await waitWithSignal(() => task.promise, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (isAbortReason(error)) throw this.failure(
        "network",
        "The official usage history request was cancelled; retry it",
        true,
        identity.source,
        false
      );
      throw error;
    } finally {
      task.consumers--;
      if (!task.consumers) {
        task.controller.abort();
        if (this.pending.get(cacheKey) === task) this.pending.delete(cacheKey);
      }
    }
  }
  async fetchDataset(identity, period, now, caller) {
    const signal = AbortSignal.any([caller, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
    const url = CONSOLE_ORIGIN + "/console/api/v2/usage/export?range=" + period;
    const fetcher = this.options.fetch ?? this.transport.forProxy(identity.proxyURL) ?? globalThis.fetch;
    let response;
    try {
      response = await waitWithSignal(async () => {
        this.assertCurrentNetwork(identity);
        if (!this.options.accountRefs().includes(identity.accountRef)) {
          throw this.failure("unknown-account", "The selected OpenCode account no longer exists", false);
        }
        const result = await fetcher(url, {
          method: "GET",
          headers: {
            ...attributionHeaders4(),
            Authorization: "Bearer " + identity.key,
            Accept: "text/csv",
            "Accept-Encoding": "identity"
          },
          redirect: "error",
          signal
        });
        if (signal.aborted) {
          void result.body?.cancel().catch(() => {
          });
          signal.throwIfAborted();
        }
        return result;
      }, signal);
      if (!response.ok) {
        const reason = await readUsageError(response, {
          apiKey: identity.key,
          baseURL: identity.baseURL,
          proxyURL: identity.proxyURL,
          signal
        });
        signal.throwIfAborted();
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw this.failure(
          response.status === 401 || response.status === 403 ? "permission-denied" : "upstream",
          "Official usage history unavailable (HTTP " + response.status + ")" + (reason ? ": " + reason : ""),
          retryable,
          identity.source
        );
      }
      if (!/^text\/csv(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) throw new SyntaxError("Expected CSV");
      const bytes = [];
      let size = 0;
      const reader = response.body?.getReader();
      if (!reader) throw new SyntaxError("Missing CSV");
      try {
        while (true) {
          const part = await waitWithSignal(() => reader.read(), signal);
          signal.throwIfAborted();
          if (part.done) break;
          if (part.value.byteLength > ANALYTICS_MAX_BYTES - size) throw new RangeError("CSV response too large");
          size += part.value.byteLength;
          bytes.push(part.value);
        }
      } catch (error) {
        void reader.cancel(error).catch(() => {
        });
        throw error;
      } finally {
        reader.releaseLock();
      }
      const csv = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(bytes, size));
      const parsed = parseCsv(csv);
      signal.throwIfAborted();
      return { ...parsed, generatedAt: now, day: utcDay(now), source: identity.source };
    } catch (error) {
      caller.throwIfAborted();
      if (error instanceof RemoteError2) throw error;
      if (signal.aborted) throw this.failure("timeout", "Official usage history request timed out", true, identity.source);
      const invalid = error instanceof SyntaxError || error instanceof RangeError || error instanceof TypeError && "code" in error && error.code === "ERR_ENCODING_INVALID_ENCODED_DATA";
      throw this.failure(
        invalid ? "invalid-response" : "network",
        invalid ? "Official usage history returned invalid or oversized CSV" : "Could not read official usage history: " + transportFailure(error),
        !invalid,
        identity.source
      );
    } finally {
      void response?.body?.cancel().catch(() => {
      });
    }
  }
};

// src/index.ts
var name = "llm-opencode-go";
var inject = ["llm"];
var NS = SETTINGS_NAMESPACE;
function apply(ctx, raw) {
  const config = raw && typeof raw.enabled === "object" ? raw : Config(raw);
  const entry = readConfig(config);
  validateGoConfig(entry);
  const current = () => readConfig(config);
  const resolveApiKey = async (config2 = current()) => {
    const ref = accountRefOf(config2);
    if (!accountsOf(config2).some((account) => account.apiKeyEnv === ref)) {
      throw new LlmError6("OpenCode Go has no selected account", "MISSING_CREDENTIAL");
    }
    const credentials = ctx.get("credentials");
    const hit = credentials !== void 0 ? (await credentials.resolve(credentialRef2(ref)))?.value : launchEnvironmentOf(ctx).get(ref)?.value;
    if (hit !== void 0 && hit.length > 0) return assertUsableApiKey(hit, name, ref);
    throw new LlmError6(
      `llm-opencode-go: no credential; the profile resolves ${ref}, which is not set \u2014 store ${ref} through the credentials service or export it`,
      "MISSING_CREDENTIAL"
    );
  };
  registerGoRemotes(ctx);
  const accountManager = new GoAccountManager(current, ctx.logger);
  ctx.plugin(GoAccountsService, { manager: accountManager });
  ctx.inject(["settings", "credentials"], (ready) => {
    ready.effect(() => accountManager.connect(ready.settings, ready.credentials));
    ready.on("settings/document-updated", (ns) => {
      if (ns === PROFILE_ENTRY_ID) accountManager.settingsChanged();
    });
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
    lastSwitch: () => accountManager.lastSwitch()
  });
  const logger = {
    fallback: ({ url, error }) => {
      ctx.logger.warn(`llm-opencode-go: could not refresh ${url}; using last-known model data (${String(error)})`);
    },
    omitted: (ids) => {
      ctx.logger.warn(`llm-opencode-go: gateway models with unusable declarations: ${ids.join(", ")}`);
    }
  };
  let registration;
  let freeRegistration;
  const warnedModelSettings = /* @__PURE__ */ new Set();
  const refreshPickers = () => {
    registration?.replace([PROVIDER_ID]);
    freeRegistration?.replace([FREE_PROVIDER_ID]);
  };
  let callSequence = 0;
  const withheldFreeEndpoints = /* @__PURE__ */ new Set();
  const catalogs = new GoCatalogManager({
    transport,
    onFallback: logger.fallback,
    onOmitted: logger.omitted,
    onWarning: (warning) => {
      ctx.logger.warn(`llm-opencode-go: ${warning}`);
    },
    onRefresh: refreshPickers
  });
  const adapterOptions = {
    transport,
    config: () => current(),
    resolveApiKey,
    accountGeneration: () => accountManager.capture(),
    nextCallSequence: () => ++callSequence,
    onAccountSettled: (event) => {
      accountManager.settle(event);
    },
    imageAccess: {
      resolveAttachments: () => ctx.get("attachments"),
      resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
        attachments,
        (hostPath) => ctx.get("fs")?.processPathFromHostPath(hostPath),
        ref
      )
    },
    // One notice per withheld Free endpoint and mount: the Free route never
    // reuses saved credentials for an endpoint the accounts are not bound to,
    // and a request storm must not repeat the explanation. The value is the
    // endpoint origin only, never a key.
    onFreeCredentialWithheld: (detail) => {
      if (withheldFreeEndpoints.has(detail.freeBaseURL)) return;
      if (withheldFreeEndpoints.size >= 8) withheldFreeEndpoints.clear();
      withheldFreeEndpoints.add(detail.freeBaseURL);
      ctx.logger.info(`llm-opencode-go: not reusing saved credentials for the Free endpoint ${detail.freeBaseURL}; using public access`);
    },
    onReplayDegrade: (reason) => {
      ctx.logger.warn(`llm-opencode-go: unusable replay state on assistant history; sending provider-neutral content (${reason})`);
    },
    // Configured thinking budgets are filtered/clamped instead of failing the
    // model; surface each distinct dropped setting once so a stale profile can
    // be fixed without per-request log spam.
    onModelWarning: (detail) => {
      const key = detail.model + "\0" + detail.reason;
      if (warnedModelSettings.has(key)) return;
      if (warnedModelSettings.size >= 64) warnedModelSettings.clear();
      warnedModelSettings.add(key);
      ctx.logger.warn(`llm-opencode-go: model "${detail.model}": ${detail.reason}`);
    }
  };
  const adapter = new OpencodeGoAdapter({ ...adapterOptions, catalog: (config2) => catalogs.forConfig(config2) });
  const freeAdapter = new OpencodeGoAdapter({ ...adapterOptions, source: "free", catalog: (config2) => catalogs.forConfig(config2, "free") });
  ctx.plugin(GoModelsService, {
    catalog: () => catalogs.forConfig(current()),
    // Free is an explicit opt-in: while it is off, its catalog is neither
    // fetched nor included in the settings model directory.
    freeCatalog: () => {
      const config2 = current();
      return config2.freeEnabled ? catalogs.forConfig(config2, "free") : void 0;
    },
    onRefresh: refreshPickers
  });
  ctx.plugin(GoAnalyticsService, {
    baseURL: () => current().baseURL,
    proxyURL: () => current().proxyURL,
    transport,
    resolveApiKey: (ref) => resolveApiKey({ ...current(), apiKeyEnv: ref }),
    accountRefs: () => accountsOf(current()).map((account) => account.apiKeyEnv)
  });
  const pickerVisibilityOf = () => JSON.stringify([
    current().modelVisibility ?? {},
    current().modelLimits ?? {},
    current().baseURL,
    current().freeBaseURL,
    current().proxyURL
  ]);
  let pickerVisibility = pickerVisibilityOf();
  const applyRoute = (configured) => {
    for (const source of ["go", "free"]) {
      const id = source === "go" ? PROVIDER_ID : FREE_PROVIDER_ID;
      const handle = source === "go" ? registration : freeRegistration;
      const active = current().enabled && (source === "free" ? current().freeEnabled : configured);
      if (active && !handle) {
        try {
          const next = ctx.llm.registerAdapter([id], source === "go" ? adapter : freeAdapter);
          if (source === "go") registration = next;
          else freeRegistration = next;
          ctx.logger.info(`llm-opencode-go: route "${id}" registered as ${source === "go" ? DISPLAY_NAME : FREE_DISPLAY_NAME}`);
        } catch (error) {
          ctx.logger.error(`llm-opencode-go: not registering the "${id}" route (${String(error)})`);
        }
      } else if (!active && handle) {
        handle();
        if (source === "go") registration = void 0;
        else freeRegistration = void 0;
      }
    }
  };
  const syncFreeRoute = () => {
    const active = current().enabled && current().freeEnabled;
    if (active && !freeRegistration) {
      try {
        freeRegistration = ctx.llm.registerAdapter([FREE_PROVIDER_ID], freeAdapter);
        ctx.logger.info(`llm-opencode-go: route "${FREE_PROVIDER_ID}" registered as ${FREE_DISPLAY_NAME}`);
      } catch (error) {
        ctx.logger.error(`llm-opencode-go: not registering the "${FREE_PROVIDER_ID}" route (${String(error)})`);
      }
    } else if (!active && freeRegistration) {
      freeRegistration();
      freeRegistration = void 0;
      ctx.logger.info(`llm-opencode-go: route "${FREE_PROVIDER_ID}" withdrawn (Free channel disabled)`);
    }
  };
  let routeCheck = 0;
  let selectedRef = accountRefOf(current());
  const syncRoute = () => {
    const check = ++routeCheck;
    const config2 = current();
    accountManager.capture();
    const visibility = pickerVisibilityOf();
    if (pickerVisibility !== visibility) {
      pickerVisibility = visibility;
      refreshPickers();
    }
    const credentials = ctx.get("credentials");
    const selected = accountRefOf(config2);
    if (selected !== selectedRef) {
      selectedRef = selected;
      adapter.forgetRejectedKey(selected);
      freeAdapter.forgetRejectedKey(selected);
    }
    const refs = accountsOf(config2).map((account) => account.apiKeyEnv);
    if (!config2.enabled) {
      applyRoute(false);
      return;
    }
    syncFreeRoute();
    if (credentials === void 0) {
      applyRoute(refs.some((ref) => {
        const value = launchEnvironmentOf(ctx).get(ref)?.value;
        if (!value) return false;
        try {
          return Boolean(assertUsableApiKey(value, name, ref));
        } catch {
          return false;
        }
      }));
      return;
    }
    const checkCredential = async (ref) => {
      const info = await credentials.describe(credentialRef2(ref));
      if (!info.configured) return false;
      try {
        return Boolean(await resolveApiKey({ ...config2, apiKeyEnv: ref }));
      } catch (error) {
        if (error instanceof LlmError6 && ["MISSING_CREDENTIAL", "INVALID_CREDENTIAL"].includes(error.code)) return false;
        throw error;
      }
    };
    let remaining = refs.length, usable = false, failed = false;
    if (remaining === 0) applyRoute(false);
    for (const ref of refs) void checkCredential(ref).then((configured) => {
      if (check !== routeCheck) return;
      usable ||= configured;
      if (usable) applyRoute(true);
    }).catch((error) => {
      failed = true;
      if (check === routeCheck) ctx.logger.error(`llm-opencode-go: credential check failed; keeping the previous route state (${String(error)})`);
    }).finally(() => {
      remaining--;
      if (remaining === 0 && check === routeCheck && !usable && !failed) applyRoute(false);
    });
  };
  syncRoute();
  let undiscover = () => {
  };
  try {
    undiscover = ctx.llm.registerModelDiscovery(name, async (request, signal) => {
      if (request.provider !== PROVIDER_ID && request.provider !== FREE_PROVIDER_ID && !isOfficialEndpoint(request.baseURL)) {
        throw new LlmError6(
          "llm-opencode-go discovers only OpenCode Go and Free endpoints; enter this provider's models by hand",
          "DISCOVERY_UNSUPPORTED"
        );
      }
      const source = request.provider === FREE_PROVIDER_ID || request.provider !== PROVIDER_ID && request.baseURL !== void 0 && !new URL(request.baseURL).pathname.includes("/go/") ? "free" : "go";
      const config2 = current();
      if (source === "free" && !config2.freeEnabled) {
        throw new LlmError6(
          "llm-opencode-go: the Free channel is disabled; enable it in Settings \u2192 Advanced settings",
          "DISCOVERY_UNSUPPORTED"
        );
      }
      return discoverCatalogModels(catalogs.forConfig(config2, source), signal);
    });
  } catch (error) {
    ctx.logger.error(`llm-opencode-go: not registering model discovery for "${name}" (${String(error)})`);
  }
  ctx.effect(() => () => {
    registration?.();
    registration = void 0;
    freeRegistration?.();
    freeRegistration = void 0;
    undiscover();
    return Promise.all([adapter.dispose(), freeAdapter.dispose()]).then(() => {
    });
  });
  installHostSettings(ctx);
  ctx.on("loader/volatile-update", syncRoute);
  ctx.inject(["credentials"], (credentialsCtx) => {
    credentialsCtx.on("credentials/reference-updated", (ref) => {
      adapter.forgetRejectedKey(ref);
      freeAdapter.forgetRejectedKey(ref);
      if (accountsOf(current()).some((account) => account.apiKeyEnv === ref)) {
        accountManager.credentialChanged();
        syncRoute();
      }
    });
    syncRoute();
  });
}
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
function isOfficialEndpoint(raw) {
  try {
    return raw !== void 0 && new URL(raw).hostname === "opencode.ai";
  } catch {
    return false;
  }
}
export {
  Config,
  DEFAULT_BASE_URL,
  DEFAULT_FREE_BASE_URL,
  DISPLAY_NAME,
  FREE_DISPLAY_NAME,
  FREE_PROVIDER_ID,
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
  readLiveModelIds,
  registerGoRemotes
};
