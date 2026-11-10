import { createRequire as __createRequire } from 'node:module'; var require = __createRequire(import.meta.url);

// src/contracts.ts
var PROVIDER_ID = "dsh-opencode-go";
var DISPLAY_NAME = "DSH OpenCode Go";
var FREE_PROVIDER_ID = "dsh-opencode-free";
var FREE_DISPLAY_NAME = "DSH OpenCode Free";
function modelSettingsKey(model) {
  return model.source === "free" ? `${FREE_PROVIDER_ID}/${model.id}` : model.id;
}
var SDK_PROVIDER_ID = "opencode-go";
var DEFAULT_BASE_URL = "https://opencode.ai/inference/go/v1";
var DEFAULT_FREE_BASE_URL = "https://opencode.ai/inference/v1";
function migrateGatewayBaseURL(baseURL) {
  return baseURL.replace(/\/+$/, "") === "https://opencode.ai/zen/go/v1" ? "https://opencode.ai/inference/go/v1" : baseURL;
}
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
var USAGE_DISPLAY_MODES = ["auto", "always", "off"];
var DEFAULT_USAGE_DISPLAY = "auto";
var USAGE_PILL_STYLES = ["badge", "plain"];
var DEFAULT_USAGE_PILL_STYLE = "badge";
var OPENCODE_GO_THEMES = ["native", "classic"];
var DEFAULT_OPENCODE_GO_THEME = "native";
var MAX_ACCOUNTS = 20;
var MAX_THINKING_BUDGET_TOKENS = 1e6;
var ACCOUNT_REF_PREFIX = "DSH_OPENCODE_GO_ACCOUNT_";
var DEFAULT_ACCOUNT_REF = "OPENCODE_API_KEY";
var ACCOUNT_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function accountRefOf(settings) {
  return settings.apiKeyEnv || DEFAULT_ACCOUNT_REF;
}
function moveAccountFirst(accounts, ref) {
  const index = accounts.findIndex((account) => account.apiKeyEnv === ref);
  return index <= 0 ? accounts : [accounts[index], ...accounts.slice(0, index), ...accounts.slice(index + 1)];
}
function accountsOf(settings) {
  const ref = accountRefOf(settings);
  if (settings.accounts?.length === 0) return [];
  const accounts = settings.accounts ?? [];
  return accounts.some((account) => account.apiKeyEnv === ref) ? moveAccountFirst(accounts, ref) : [
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
var SETTINGS_NAMESPACE = "llm-opencode-go";
var PROFILE_ENTRY_ID = "opencode-go";
var INPUT_MODALITIES = ["text", "image", "audio", "video", "pdf"];
function normalizeInputModalities(value) {
  if (!Array.isArray(value)) return void 0;
  const declared = new Set(value.filter((item) => typeof item === "string").map((item) => item.trim().toLowerCase().split(";")[0]).map((item) => item.startsWith("image/") ? "image" : item.startsWith("audio/") ? "audio" : item.startsWith("video/") ? "video" : item === "application/pdf" ? "pdf" : item.startsWith("text/") ? "text" : item));
  const ordered = INPUT_MODALITIES.filter((modality) => declared.has(modality));
  return ordered.length === 0 ? void 0 : ordered;
}
function isModelEnabled(model, modelVisibility) {
  if (model.configurationMissing) return false;
  const key = modelSettingsKey(model);
  const enabled = modelVisibility && Object.hasOwn(modelVisibility, key) ? modelVisibility[key] : void 0;
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
    if (row.source !== void 0) {
      if (row.source !== "go" && row.source !== "free") throw new Error("Invalid OpenCode model source");
      model.source = row.source;
    }
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
  return { go: parse(sources.go), free: parse(sources.free) };
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
function parseAccountCommand(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid account command");
  const row = value;
  const fields = {
    add: ["kind", "id", "name", "key"],
    remove: ["kind", "ref"],
    select: ["kind", "ref"],
    rename: ["kind", "ref", "name"],
    "replace-key": ["kind", "ref", "key"],
    move: ["kind", "ref", "toIndex"],
    "auto-switch": ["kind", "value"]
  };
  if (typeof row.kind !== "string" || !Object.hasOwn(fields, row.kind) || Object.keys(row).some((key) => !fields[row.kind].includes(key)) || fields[row.kind].some((key) => !Object.hasOwn(row, key))) throw new Error("Invalid account command");
  if ("ref" in row && (typeof row.ref !== "string" || !ACCOUNT_REF_PATTERN.test(row.ref))) throw new Error("Invalid account reference");
  if ("name" in row && (typeof row.name !== "string" || !row.name.trim() || row.name.trim().length > 80)) throw new Error("Invalid account name");
  if ("key" in row && (typeof row.key !== "string" || !row.key.trim())) throw new Error("Missing account credential");
  if (row.kind === "add" && (typeof row.id !== "string" || !/^[a-f0-9]{32}$/.test(row.id))) throw new Error("Invalid account operation ID");
  if (row.kind === "move" && (!Number.isInteger(row.toIndex) || row.toIndex < 0)) throw new Error("Invalid account position");
  if (row.kind === "auto-switch" && typeof row.value !== "boolean") throw new Error("Invalid account switch");
  return { ...row };
}
function parseResult(value) {
  if (value !== "applied" && value !== "rejected" && value !== "unknown") throw new Error("Invalid account command result");
  return value;
}
var commandCodec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#AccountCommand",
  schema: { parse: parseAccountCommand },
  create: () => ({ parse: parseAccountCommand })
};
var resultCodec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#AccountCommandResult",
  schema: { parse: parseResult },
  create: () => ({ parse: parseResult })
};
var accountsRemote = {
  package: "dsh-opencode-go",
  descriptors: [{
    id: "dsh-opencode-go#opencodeGoAccounts/execute",
    service: "opencodeGoAccounts",
    namespace: "opencodeGoAccounts",
    method: "execute",
    invocation: { kind: "direct" },
    parameters: [{ name: "command", wire: "command", source: "json", codec: commandCodec }],
    result: resultCodec
  }]
};
var ANALYTICS_RANGES = ["today", "7d", "30d", "90d"];
var ANALYTICS_TOTAL_FIELDS = [
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
function object(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid analytics " + field);
  return value;
}
function integer(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 864e13) {
    throw new Error("Invalid analytics " + field);
  }
  return value;
}
function text(value, field, max = 128) {
  if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Invalid analytics " + field);
  }
  return value;
}
function parseAnalyticsQuery(value) {
  const row = object(value, "query");
  const accountRef = parseRef(row.accountRef);
  if (!ANALYTICS_RANGES.includes(row.range)) throw new Error("Invalid analytics range");
  if (row.refresh !== void 0 && typeof row.refresh !== "boolean") throw new Error("Invalid analytics refresh");
  return { accountRef, range: row.range, ...row.refresh === void 0 ? {} : { refresh: row.refresh } };
}
function analyticsTotals(value) {
  const row = object(value, "totals");
  const totals = {};
  for (const field of ANALYTICS_TOTAL_FIELDS) {
    if (typeof row[field] !== "string" || !/^(?:0|[1-9]\d*)$/.test(row[field])) {
      throw new Error("Invalid analytics " + field);
    }
    totals[field] = row[field];
  }
  return totals;
}
function parseAnalyticsReport(value) {
  const row = object(value, "report");
  const range = object(row.range, "range");
  const from = integer(range.from, "range.from"), to = integer(range.to, "range.to");
  if (from > to || row.timeZone !== "UTC" || !ANALYTICS_RANGES.includes(row.period) || !Array.isArray(row.byModel) || !Array.isArray(row.byDay)) {
    throw new Error("Invalid analytics report");
  }
  return {
    accountRef: parseRef(row.accountRef),
    source: text(row.source, "source"),
    generatedAt: integer(row.generatedAt, "generatedAt"),
    period: row.period,
    range: { from, to },
    timeZone: "UTC",
    totals: analyticsTotals(row.totals),
    byModel: row.byModel.map((value2) => {
      const model = object(value2, "model");
      return { provider: text(model.provider, "provider", 1024), model: text(model.model, "model", 1024), ...analyticsTotals(model) };
    }),
    byDay: row.byDay.map((value2) => {
      const day = object(value2, "day");
      if (!validReleaseDate(day.day)) throw new Error("Invalid analytics day");
      return { day: day.day, ...analyticsTotals(day) };
    })
  };
}
function parseAnalyticsExport(value) {
  const row = object(value, "export");
  const filename = text(row.filename, "filename", 256);
  if (!/^[A-Za-z0-9_.-]+\.csv$/.test(filename) || typeof row.csv !== "string") throw new Error("Invalid analytics export");
  return { filename, csv: row.csv };
}
var queryCodec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#AnalyticsQuery",
  schema: { parse: parseAnalyticsQuery },
  create: () => ({ parse: parseAnalyticsQuery })
};
var reportCodec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#AnalyticsReport",
  schema: { parse: parseAnalyticsReport },
  create: () => ({ parse: parseAnalyticsReport })
};
var exportCodec = {
  mode: "strict",
  typeSymbol: "dsh-opencode-go#AnalyticsExport",
  schema: { parse: parseAnalyticsExport },
  create: () => ({ parse: parseAnalyticsExport })
};
var analyticsRemote = {
  package: "dsh-opencode-go",
  descriptors: [{
    id: "dsh-opencode-go#opencodeGoAnalytics/read",
    service: "opencodeGoAnalytics",
    namespace: "opencodeGoAnalytics",
    method: "read",
    invocation: { kind: "direct" },
    parameters: [{ name: "query", wire: "query", source: "json", codec: queryCodec }],
    cancellation: { parameter: "signal" },
    result: reportCodec
  }, {
    id: "dsh-opencode-go#opencodeGoAnalytics/exportCsv",
    service: "opencodeGoAnalytics",
    namespace: "opencodeGoAnalytics",
    method: "exportCsv",
    invocation: { kind: "direct" },
    parameters: [{ name: "query", wire: "query", source: "json", codec: queryCodec }],
    cancellation: { parameter: "signal" },
    result: exportCodec
  }]
};
var goRemote = {
  package: "dsh-opencode-go",
  descriptors: [...usageRemote.descriptors, ...modelsRemote.descriptors, ...accountsRemote.descriptors, ...analyticsRemote.descriptors]
};
var DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;

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
    this.finalResultPromise = new Promise((resolve) => {
      this.resolveFinalResult = resolve;
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
        const result = await new Promise((resolve) => this.waiting.enqueue(resolve));
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

// node_modules/opencode-go-pi-ai/dist/utils/text.js
function contentText(content, separator = "\n") {
  if (typeof content === "string")
    return content;
  return content.filter((block) => block.type === "text").map((block) => block.text).join(separator);
}
function getSystemMessageText(message) {
  const parts = [contentText(message.content)];
  for (const text2 of Object.values(message.sections ?? {})) {
    if (text2 !== null)
      parts.push(text2);
  }
  return parts.filter((part) => part.length > 0).join("\n\n");
}
function renderSystemMessageUpdate(message) {
  const parts = [];
  const text2 = contentText(message.content);
  if (text2.length > 0)
    parts.push(text2);
  for (const [name, value] of Object.entries(message.sections ?? {})) {
    parts.push(value === null ? `Removed system prompt section "${name}".` : `Updated system prompt section "${name}":

${value}`);
  }
  return parts.join("\n\n");
}
function ownedSlice(text2, start, end = text2.length) {
  return `${text2.slice(start, end)} `.slice(0, -1);
}

// node_modules/opencode-go-pi-ai/dist/utils/version.js
var PI_AI_VERSION = "1.5.0";

// node_modules/opencode-go-pi-ai/dist/utils/identity.js
var NVIDIA_NIM_HOST = "integrate.api.nvidia.com";
var OPENCODE_HOST = "opencode.ai";
function getClientVersion(identity) {
  return identity?.version ?? PI_AI_VERSION;
}
function runtimeDescription() {
  if (typeof process === "undefined")
    return void 0;
  const versions = process.versions;
  if (versions?.bun)
    return `bun/${versions.bun}`;
  if (versions?.node)
    return `node/${process.version}`;
  return void 0;
}
function formatUserAgent(identity) {
  const mode = identity?.userAgent ?? "detailed";
  if (typeof mode === "object")
    return mode.custom;
  if (mode === "short")
    return "pi";
  const product = `pi/${getClientVersion(identity)}`;
  const runtime = runtimeDescription();
  return runtime ? `${product} (${process.platform}; ${runtime}; ${process.arch})` : `${product} (browser)`;
}
function matchesHost(baseUrl, expectedHost) {
  try {
    return new URL(baseUrl).hostname === expectedHost;
  } catch {
    return false;
  }
}
function isOpenRouter(target) {
  return target.provider === "openrouter" || target.baseUrl.includes("openrouter.ai");
}
function isNvidiaNim(target) {
  return target.provider === "nvidia" || matchesHost(target.baseUrl, NVIDIA_NIM_HOST);
}
function isOpenCode(target) {
  return target.provider === "opencode" || target.provider === "opencode-go" || matchesHost(target.baseUrl, OPENCODE_HOST);
}
function getAttributionHeaders(target, identity) {
  const attribution = identity?.attribution;
  if (!attribution)
    return {};
  const { name, url, categories } = attribution;
  if (isOpenRouter(target)) {
    return {
      "HTTP-Referer": url,
      "X-OpenRouter-Title": name,
      ...categories === void 0 || categories.length === 0 ? {} : { "X-OpenRouter-Categories": categories.join(",") }
    };
  }
  if (isNvidiaNim(target))
    return { "X-BILLING-INVOKE-ORIGIN": name.charAt(0).toUpperCase() + name.slice(1) };
  if (isOpenCode(target))
    return { "x-opencode-client": name };
  return {};
}
function getIdentityHeaders(target, identity) {
  return { "User-Agent": formatUserAgent(identity), ...getAttributionHeaders(target, identity) };
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
function withoutInitialSystemMessage(messages) {
  return getInitialSystemMessage(messages) ? messages.slice(1) : messages;
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
    const text2 = contentText(message.content);
    if (text2.length > 0)
      content.push(text2);
    for (const [name, value] of Object.entries(message.sections ?? {})) {
      if (value === null)
        sections.delete(name);
      else
        sections.set(name, value);
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
function findLastNonAdditiveToolChange(systemMessages) {
  const declared = /* @__PURE__ */ new Set();
  let last = -1;
  for (let index = 0; index < systemMessages.length; index++) {
    const message = systemMessages[index];
    if ((message.toolsRemoved?.length ?? 0) > 0)
      last = index;
    for (const tool of message.toolsAdded ?? []) {
      if (declared.has(tool.name))
        last = index;
      declared.add(tool.name);
    }
  }
  return last;
}
function resolveTranscriptTools(messages, support) {
  const systemMessages = messages.filter(isSystemMessage);
  if (support === "none") {
    return { requestTools: getCurrentTools(systemMessages), foldedSystemMessages: systemMessages.length };
  }
  if (support === "changes")
    return { requestTools: [], foldedSystemMessages: 0 };
  const folded = Math.max(getInitialSystemMessage(messages) ? 1 : 0, findLastNonAdditiveToolChange(systemMessages) + 1);
  return { requestTools: getCurrentTools(systemMessages.slice(0, folded)), foldedSystemMessages: folded };
}

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
async function forwardStream(target, source, observer, observeResult) {
  let result;
  for await (const event of source) {
    target.push(event);
    observer?.onEvent?.(event);
    if (event.type === "done")
      result = event.message;
    else if (event.type === "error")
      result = event.error;
  }
  if (hasResult(source))
    result = await source.result();
  target.end(result);
  observeResult(result);
}
function lazyStream(model, setup, observer) {
  const startedAt = Date.now();
  const outer = new AssistantMessageEventStream();
  let observedResult = false;
  const observeResult = (result) => {
    if (observedResult)
      return;
    observedResult = true;
    observer?.onResult?.(result);
  };
  setup().then((inner) => forwardStream(outer, inner, observer, observeResult)).catch((error) => {
    const message = createSetupErrorMessage(model, error, startedAt);
    const event = { type: "error", reason: "error", error: message };
    outer.push(event);
    observer?.onEvent?.(event);
    outer.end(message);
    observeResult(message);
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
  let rates = model.cost;
  let matchedThreshold = -1;
  for (const tier of model.cost.tiers ?? []) {
    if (inputTokens > tier.inputTokensAbove && tier.inputTokensAbove > matchedThreshold) {
      rates = tier;
      matchedThreshold = tier.inputTokensAbove;
    }
  }
  const longWrite = usage.cacheWrite1h ?? 0;
  const shortWrite = usage.cacheWrite - longWrite;
  usage.cost.input = rates.input / 1e6 * usage.input;
  usage.cost.output = rates.output / 1e6 * usage.output;
  usage.cost.cacheRead = rates.cacheRead / 1e6 * usage.cacheRead;
  usage.cost.cacheWrite = (rates.cacheWrite * shortWrite + rates.input * 2 * longWrite) / 1e6;
  usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
  usage.cost.totalFromProvider = false;
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

// src/transport.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { ProxyAgent, Socks5ProxyAgent } from "undici";
import { setTimeout as delay } from "node:timers/promises";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { isContextWindowExceededError, isQuotaExceededError } from "@deepseek-ai/dsh-llm";

// src/free-policy.ts
function classifyFreeGatewayError(status, body) {
  let error = {};
  try {
    const parsed = JSON.parse(body);
    error = parsed?.error && typeof parsed.error === "object" ? parsed.error : parsed ?? {};
  } catch {
  }
  const types = [error.type, error.code].filter((value) => typeof value === "string").map((value) => value.replace(/[^a-z0-9]/gi, "").toLowerCase());
  if (types.includes("freeusagelimiterror")) return "FREE_QUOTA";
  if (types.some((type) => [
    "creditserror",
    "monthlylimiterror",
    "userlimiterror",
    "gousagelimiterror",
    "insufficientquota",
    "quotaexceeded",
    "autherror",
    "authenticationerror",
    "invalidapikey",
    "invalidkey",
    "regionerror",
    "datapolicyerror",
    "modelerror",
    "modelnotfound",
    "unknownmodel"
  ].includes(type))) return void 0;
  const message = typeof error.message === "string" ? error.message : body;
  if (status === 429) return /free (?:usage |daily )?(?:limit|quota)/i.test(message) ? "FREE_QUOTA" : "FREE_RATE_LIMIT";
  if (status === 403) {
    if (/(?:invalid|incorrect|expired)[ _-]?(?:api[ _-]?)?key|invalid credential/i.test(message)) return void 0;
    if (/free[\s\S]{0,100}(?:only|work|available)[\s\S]{0,100}opencode|opencode[\s\S]{0,60}(?:client|only)/i.test(message)) {
      return "FREE_CLIENT_RESTRICTED";
    }
    return "FREE_ACCESS_DENIED";
  }
  return void 0;
}
function retryAfterDeadline(value, now = Date.now(), serverDate) {
  if (value === null) return void 0;
  const raw = value.trim();
  let delay2;
  if (/^\d+$/.test(raw)) delay2 = Number(raw) * 1e3;
  else {
    if (!/^(?:[A-Za-z]{3},|[A-Za-z]+,|[A-Za-z]{3} [A-Za-z]{3} )/.test(raw)) return void 0;
    const date = Date.parse(raw);
    const server = serverDate ? Date.parse(serverDate) : NaN;
    delay2 = Math.max(0, date - (Number.isFinite(server) ? server : now));
  }
  const until = now + delay2;
  return Number.isSafeInteger(until) && until >= now && until <= 864e13 ? until : void 0;
}

// src/transport.ts
function waitWithSignal(work, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
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
      resolve(value);
    }, (error) => {
      cleanup();
      reject(error);
    });
  });
}
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
async function fetchJsonResponse(url, init, maxBytes, encoding = "identity", fetcher = globalThis.fetch, readError) {
  if ((init.method ?? "GET").toUpperCase() !== "GET") throw new TypeError("JSON requests must use GET");
  const headers = new Headers(init.headers);
  headers.set("accept-encoding", encoding);
  const options = { ...init, method: "GET", headers };
  const signal = init.signal ?? void 0;
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    try {
      const response = await waitWithSignal(async () => {
        const response2 = await fetcher(url, options);
        if (signal?.aborted) {
          cancelResponse(response2, signal.reason);
          signal.throwIfAborted();
        }
        return response2;
      }, signal);
      if (!response.ok) {
        if (readError) {
          let body2;
          try {
            body2 = await waitWithSignal(() => readError(response), signal);
          } catch {
            signal?.throwIfAborted();
          } finally {
            cancelResponse(response);
          }
          signal?.throwIfAborted();
          return { response, body: body2 };
        }
        cancelResponse(response);
        signal?.throwIfAborted();
        return { response, body: void 0 };
      }
      const body = await readJsonResponse(response, maxBytes, { gzip: encoding === "gzip", signal });
      signal?.throwIfAborted();
      return { response, body };
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt > 0 || !retryableTransportFailure(error)) throw error;
      await delay(150, void 0, { signal });
    }
  }
}
function cancelResponse(response, reason) {
  void response.body?.cancel(reason).catch(() => {
  });
}
async function readBoundedBody(response, maxBytes, signal) {
  if (signal?.aborted) {
    cancelResponse(response, signal.reason);
    signal.throwIfAborted();
  }
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await waitWithSignal(() => reader.read(), signal);
      signal?.throwIfAborted();
      if (done) return Buffer.concat(chunks, size);
      if (value.byteLength > maxBytes - size) {
        throw new RangeError(`Response body exceeds ${maxBytes} byte limit`);
      }
      size += value.byteLength;
      chunks.push(value);
    }
  } catch (error) {
    void reader.cancel(error).catch(() => {
    });
    throw error;
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
  const signal = options.signal ?? void 0;
  let bytes = await readBoundedBody(response, maxBytes, signal);
  if (options.gzip && bytes[0] === 31 && bytes[1] === 139) {
    try {
      bytes = await readGzipBody(bytes, maxBytes, signal);
    } catch (error) {
      options.signal?.throwIfAborted();
      if (error instanceof RangeError) throw error;
      throw new SyntaxError("Response is not valid gzip", { cause: error });
    }
  }
  const body = await (() => {
    signal?.throwIfAborted();
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      throw new SyntaxError("Response is not valid JSON", { cause: error });
    }
  })();
  signal?.throwIfAborted();
  return body;
}
function classifyGatewayError(status, body, fallback, budget = {}) {
  let error;
  let modelOnly = false;
  try {
    const parsed = JSON.parse(body);
    error = parsed?.error && typeof parsed.error === "object" ? parsed.error : parsed;
    modelOnly = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.model === "string" && Object.keys(parsed).length === 1;
  } catch {
  }
  const types = [error?.type, error?.code].filter((value) => typeof value === "string").map((value) => value.replace(/[^a-z0-9]/gi, "").toLowerCase());
  if (types.some((type) => ["modelerror", "modelnotfound", "unknownmodel"].includes(type))) return "UNKNOWN_MODEL";
  if (types.some((type) => [
    "creditserror",
    "monthlylimiterror",
    "userlimiterror",
    "gousagelimiterror",
    "freeusagelimiterror",
    "insufficientquota",
    "quotaexceeded"
  ].includes(type))) return "QUOTA";
  if (types.some((type) => ["autherror", "authenticationerror", "invalidapikey", "invalidkey"].includes(type))) return "INVALID_CREDENTIAL";
  if (types.some((type) => ["regionerror", "datapolicyerror", "permissionerror", "permissiondenied"].includes(type))) return "PERMISSION_DENIED";
  if (types.some((type) => ["ratelimiterror", "ratelimitexceeded"].includes(type))) return "RATE_LIMIT";
  const message = typeof error?.message === "string" ? error.message : body;
  if ([401, 402, 403, 429].includes(status) && isQuotaExceededError(message)) return "QUOTA";
  if ([401, 402, 403].includes(status) && /(?:invalid|incorrect|expired)[ _-]?(?:api[ _-]?)?key|invalid credential/i.test(message)) return "INVALID_CREDENTIAL";
  if (status === 401) return "AUTH";
  if (status === 402 || status === 403) return "PERMISSION_DENIED";
  if (status === 404) return "UNKNOWN_MODEL";
  if (status === 429) return "RATE_LIMIT";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status >= 500) return "SERVER";
  if (status === 400 || status === 413 || status === 422) {
    if (isContextWindowExceededError([error?.type, error?.code, message].join(" "))) return "CONTEXT_WINDOW_EXCEEDED";
    const { contextWindow, estimatedContextTokens, maxTokens = 0 } = budget;
    if (status === 400 && modelOnly && contextWindow !== void 0 && Number.isFinite(contextWindow) && contextWindow > 0 && estimatedContextTokens !== void 0 && Number.isFinite(estimatedContextTokens) && estimatedContextTokens >= 0 && Number.isFinite(maxTokens) && maxTokens >= 0 && estimatedContextTokens + maxTokens >= contextWindow * 0.8) return "CONTEXT_WINDOW_EXCEEDED";
    return fallback === "CONTEXT_WINDOW_EXCEEDED" ? fallback : "INVALID_REQUEST";
  }
  return fallback;
}
var MAX_BODY_BYTES = 16 * 1024;
var BODY_READ_TIMEOUT_MS = 1e3;
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
  retryAt;
  transportFailed = false;
  evidence;
  code;
  secrets;
  redact(text2, truncated = false) {
    for (const secret of this.secrets) {
      if (!secret) continue;
      text2 = text2.replaceAll(secret, "[REDACTED]");
      if (truncated) for (let length = Math.min(secret.length - 1, text2.length); length > 0; length--) {
        if (text2.endsWith(secret.slice(0, length))) {
          text2 = text2.slice(0, -length) + "[REDACTED]";
          break;
        }
      }
    }
    return text2;
  }
  fetch = async (input, init) => {
    let response;
    try {
      response = await (this.options.fetch ?? globalThis.fetch)(input, init);
    } catch (error) {
      this.transportFailed = true;
      throw error;
    }
    if (!response.ok) {
      this.retryAt = retryAfterDeadline(response.headers.get("retry-after"), Date.now(), response.headers.get("date"));
      const signal = init?.signal ?? (input instanceof Request ? input.signal : void 0);
      const preview = previewBody(response, signal);
      this.code = preview.then((body) => (this.options.free ? classifyFreeGatewayError(response.status, body.text) : void 0) ?? classifyGatewayError(response.status, body.text, "PI_AI_ERROR", this.options));
      this.evidence = preview.then((body) => ({
        status: response.status,
        body: { ...body, text: this.redact(body.text, body.truncated || body.readFailed) }
      }));
    }
    return response;
  };
  async failureCode(fallback) {
    if (this.options.free && this.transportFailed) return "NETWORK";
    const code = await this.code;
    return code === void 0 || code === "PI_AI_ERROR" || code === "INVALID_REQUEST" && fallback === "CONTEXT_WINDOW_EXCEEDED" ? fallback : code;
  }
  /** Upstream deadline consumed by passive Free backoff. */
  retryDeadline() {
    return this.retryAt;
  }
  async failureMessage(original) {
    let message = this.redact(original);
    const evidence = await this.evidence;
    if (!evidence) return `${this.options.provider}/${this.options.model}: ${message}`;
    const { status, body } = evidence;
    if (body.bytes > 0 && message.includes("status code (no body)")) message = `${status} ${body.text.slice(0, 1024)}`;
    const presence = body.bytes > 0 ? "nonempty" : body.readFailed ? "unavailable" : "empty";
    message += ` [HTTP ${status}; response body: ${presence}${body.truncated ? ", truncated" : ""}${body.readFailed ? ", incomplete read" : ""}]`;
    if ([400, 413, 422].includes(status)) {
      const { maxTokens, contextWindow } = this.options;
      const allowance = typeof maxTokens === "number" ? `max_tokens=${maxTokens}` : "output allowance unavailable";
      const window = typeof contextWindow === "number" ? `; context window=${contextWindow}` : "";
      message += ` [${allowance}${window}. For context capacity failures, compact the conversation (/compact) or lower this model's Max output in OpenCode Go settings, then retry.]`;
    }
    return `${this.options.provider}/${this.options.model}: ${message}`;
  }
};
var MAX_ERROR_BYTES = 16 * 1024;
var ERROR_READ_TIMEOUT_MS = 1e3;
var MAX_REASON_CHARS = 256;
function errorMessage(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  const error = value;
  for (const field of ["message", "detail", "reason", "error_description"]) {
    if (typeof error[field] === "string" && error[field].trim()) return error[field];
  }
  return errorMessage(error.data) ?? (typeof error.type === "string" ? error.type : typeof error.code === "string" ? error.code : void 0);
}
function redact(text2, options, incomplete) {
  const secrets = [options.apiKey];
  for (const endpoint of [options.baseURL, options.proxyURL]) {
    if (!endpoint) continue;
    const url = new URL(endpoint);
    for (const credential of [url.username, url.password]) {
      if (credential) secrets.push(credential, decodeURIComponent(credential));
    }
    if (url.username || url.password) {
      secrets.push(Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString("base64"));
    }
  }
  const variants = [...new Set(secrets.filter(Boolean).flatMap((secret) => [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret)]))].sort((left, right) => right.length - left.length);
  for (const secret of variants) {
    text2 = text2.replaceAll(secret, "[REDACTED]");
    if (incomplete) for (let length = Math.min(secret.length - 1, text2.length); length > 0; length--) {
      if (text2.endsWith(secret.slice(0, length))) {
        text2 = text2.slice(0, -length) + "[REDACTED]";
        break;
      }
    }
  }
  return text2.replace(/\b(Bearer|Basic)\s+[\w.~+/=-]+/gi, "$1 [REDACTED]").replace(
    /\b(authorization|proxy-authorization|cookie|set-cookie)\b(["']?\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]+)/gi,
    "$1$2[REDACTED]"
  ).replace(
    /\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|token|password|secret|authorization|cookie)\b(["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;<>]+)/gi,
    "$1$2[REDACTED]"
  ).replace(/https?:\/\/[^\s<>"']+/gi, (raw) => {
    try {
      const url = new URL(raw);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return "[REDACTED URL]";
    }
  });
}
async function readUsageError(response, options) {
  const reader = response.body?.getReader();
  if (!reader) return void 0;
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(ERROR_READ_TIMEOUT_MS)]);
  const abort = Promise.withResolvers();
  const onAbort = () => {
    abort.reject(signal.reason);
  };
  const chunks = [];
  let bytes = 0;
  let incomplete = false;
  try {
    signal.throwIfAborted();
    signal.addEventListener("abort", onAbort, { once: true });
    while (true) {
      const part = await Promise.race([reader.read(), abort.promise]);
      if (part.done) break;
      const remaining = MAX_ERROR_BYTES - bytes;
      chunks.push(part.value.slice(0, remaining));
      bytes += Math.min(part.value.byteLength, remaining);
      if (bytes === MAX_ERROR_BYTES) {
        incomplete = true;
        break;
      }
    }
  } catch {
    incomplete = true;
  } finally {
    signal.removeEventListener("abort", onAbort);
    void reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
  let text2 = Buffer.concat(chunks, bytes).toString("utf8").replace(/\uFFFD$/, "");
  try {
    const body = JSON.parse(text2);
    text2 = errorMessage(body && typeof body === "object" && "error" in body ? body.error : void 0) ?? errorMessage(body) ?? "";
  } catch {
    if (/^\s*[\[{]/.test(text2)) return void 0;
  }
  text2 = redact(text2, options, incomplete).replace(/<!--[\s\S]*?(?:-->|$)|<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, " ").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  return text2 ? text2.slice(0, MAX_REASON_CHARS) + (text2.length > MAX_REASON_CHARS || incomplete ? "\u2026" : "") : void 0;
}
var requests = new AsyncLocalStorage();
function withGoogleFetch(options, request) {
  const userAgent = Object.entries(options?.headers ?? {}).find(([key]) => key.toLowerCase() === "user-agent")?.[1];
  return requests.run({
    fetch: options?.fetch ?? globalThis.fetch,
    ...typeof userAgent === "string" ? { userAgent } : {}
  }, request);
}
var googleFetch = (input, init) => {
  const request = requests.getStore();
  if (request?.userAgent) {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : void 0));
    headers.set("user-agent", request.userAgent);
    init = { ...init, headers };
  }
  return (request?.fetch ?? globalThis.fetch)(input, init);
};

// node_modules/opencode-go-pi-ai/dist/utils/headers.js
function headersToRecord(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}
function providerHeadersToRecord(...headerSources) {
  const merged = /* @__PURE__ */ new Map();
  for (const source of headerSources) {
    for (const [name, value] of Object.entries(source ?? {})) {
      const normalizedName = name.toLowerCase();
      merged.delete(normalizedName);
      if (value !== null)
        merged.set(normalizedName, [name, value]);
    }
  }
  return merged.size > 0 ? Object.fromEntries(merged.values()) : void 0;
}

// node_modules/opencode-go-pi-ai/dist/utils/sanitize-unicode.js
function sanitizeSurrogates(text2) {
  return text2.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
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
function estimateTextTokens(text2) {
  return Math.ceil(text2.length / CHARS_PER_TOKEN);
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
    telemetry: options?.telemetry,
    apiKey: apiKey || options?.apiKey,
    fetch: options?.fetch,
    transport: options?.transport,
    cacheRetention: options?.cacheRetention,
    sessionId: options?.sessionId,
    headers: options?.headers,
    identity: options?.identity,
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
function truncateErrorText(text2, maxChars) {
  if (text2.length <= maxChars)
    return text2;
  return `${ownedSlice(text2, 0, maxChars)}... [truncated ${text2.length - maxChars} chars]`;
}
function safeJsonStringify2(value) {
  try {
    const serialized = JSON.stringify(value);
    return serialized === void 0 ? String(value) : serialized;
  } catch {
    return String(value);
  }
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
  return new Promise((resolve, reject) => {
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
      resolve();
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
function prefersJsonSchemaStrictSampling(tool) {
  const config = tool.constrainedSampling;
  return !!config && config.type === "json_schema" && config.strict === "prefer";
}
var STRICT_TOOL_LIMIT_ERROR_MESSAGES = [
  "The compiled grammar is too large",
  "Too many strict tools (",
  "Schemas contains too many parameters with union types ("
];
function isStrictToolLimitErrorMessage(message) {
  return STRICT_TOOL_LIMIT_ERROR_MESSAGES.some((limitMessage) => message.includes(limitMessage));
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
function appendGrammarToolInputJsonDelta(buffer, inputProperty, inputDelta) {
  if (buffer.closed) {
    throw new Error(`grammar tool input for property "${inputProperty}" changed after it was closed`);
  }
  if (inputDelta.length === 0)
    return void 0;
  buffer.input += inputDelta;
  return grammarToolInputJsonStart(buffer, inputProperty) + JSON.stringify(inputDelta).slice(1, -1);
}
function closeGrammarToolInputJson(buffer, inputProperty, finalInput) {
  if (buffer.closed) {
    if (finalInput === void 0 || finalInput === buffer.input)
      return void 0;
    throw new Error(`grammar tool input for property "${inputProperty}" changed after it was closed`);
  }
  if (finalInput !== void 0 && !finalInput.startsWith(buffer.input)) {
    throw new Error(`grammar tool input for property "${inputProperty}" changed non-monotonically`);
  }
  const rest = finalInput === void 0 ? "" : finalInput.slice(buffer.input.length);
  if (finalInput !== void 0)
    buffer.input = finalInput;
  buffer.closed = true;
  return `${grammarToolInputJsonStart(buffer, inputProperty)}${JSON.stringify(rest).slice(1, -1)}"}`;
}
function grammarToolInputJsonStart(buffer, inputProperty) {
  if (buffer.started)
    return "";
  buffer.started = true;
  return `{${JSON.stringify(inputProperty)}:"`;
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

// node_modules/opencode-go-pi-ai/dist/api/transform-messages.js
var NON_VISION_USER_IMAGE_PLACEHOLDER = "(image omitted: model does not support images)";
var NON_VISION_TOOL_IMAGE_PLACEHOLDER = "(tool image omitted: model does not support images)";
var ERROR_TOOL_IMAGE_PLACEHOLDER = "(image attached after the tool results)";
function splitErrorToolResultImages(msg) {
  if (!msg.isError)
    return void 0;
  const images = msg.content.filter((block) => block.type === "image");
  if (images.length === 0)
    return void 0;
  return {
    content: replaceImagesWithPlaceholder(msg.content, ERROR_TOOL_IMAGE_PLACEHOLDER),
    caption: `Images from the error result of tool call ${msg.toolCallId} (${msg.toolName}):`,
    images
  };
}
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
function transformMessages(messages, model, normalizeToolCallId) {
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
          if (!isSameModel)
            return [];
          if (block.redacted || block.thinkingSignature)
            return block;
          if (!block.thinking || block.thinking.trim() === "")
            return [];
          return block;
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
          if (!isSameModel && normalizeToolCallId) {
            const normalizedId = normalizeToolCallId(toolCall.id, model, assistantMsg);
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

export {
  PROVIDER_ID,
  DISPLAY_NAME,
  FREE_PROVIDER_ID,
  FREE_DISPLAY_NAME,
  modelSettingsKey,
  SDK_PROVIDER_ID,
  DEFAULT_BASE_URL,
  DEFAULT_FREE_BASE_URL,
  migrateGatewayBaseURL,
  assertProxyURL,
  USAGE_DISPLAY_MODES,
  DEFAULT_USAGE_DISPLAY,
  USAGE_PILL_STYLES,
  DEFAULT_USAGE_PILL_STYLE,
  OPENCODE_GO_THEMES,
  DEFAULT_OPENCODE_GO_THEME,
  MAX_ACCOUNTS,
  MAX_THINKING_BUDGET_TOKENS,
  ACCOUNT_REF_PREFIX,
  DEFAULT_ACCOUNT_REF,
  ACCOUNT_REF_PATTERN,
  accountRefOf,
  moveAccountFirst,
  accountsOf,
  assertAccounts,
  SETTINGS_NAMESPACE,
  PROFILE_ENTRY_ID,
  normalizeInputModalities,
  isModelEnabled,
  validReleaseDate,
  sortModels,
  parseGoUsage,
  parseAccountCommand,
  parseAnalyticsQuery,
  goRemote,
  DEFAULT_MAX_REQUEST_IMAGE_BYTES,
  DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET,
  DEFAULT_REQUEST_IMAGE_MAX_BYTES,
  AssistantMessageEventStream,
  lazyStream,
  appendAssistantMessageDiagnostic,
  getSystemMessageText,
  renderSystemMessageUpdate,
  getIdentityHeaders,
  normalizeContext,
  getInitialSystemMessage,
  withoutInitialSystemMessage,
  getCurrentTools,
  collapseSystemMessages,
  resolveTranscript,
  getDeclaredTools,
  resolveTranscriptTools,
  createProvider,
  calculateCost,
  getSupportedThinkingLevels,
  clampThinkingLevel,
  estimateContextTokens,
  waitWithSignal,
  ProxyTransport,
  transportFailure,
  diagnosticURL,
  fetchJsonResponse,
  GatewayDiagnostics,
  readUsageError,
  withGoogleFetch,
  googleFetch,
  headersToRecord,
  providerHeadersToRecord,
  retryProviderRequest,
  sanitizeSurrogates,
  prefersJsonSchemaStrictSampling,
  isStrictToolLimitErrorMessage,
  getJsonSchemaToolParameters,
  getGrammarToolInput,
  appendGrammarToolInputJsonDelta,
  closeGrammarToolInputJson,
  resolveJsonSchemaStrictSampling,
  resolveGrammarConstrainedSampling,
  createGrammarToolInputProperties,
  clampMaxTokensToContext,
  resolveSamplingParams,
  buildBaseOptions,
  thinkingBudgetForLevel,
  clampThinkingBudgetToAnswerRoom,
  adjustMaxTokensForThinking,
  splitErrorToolResultImages,
  transformMessages,
  normalizeProviderError,
  formatProviderError
};
