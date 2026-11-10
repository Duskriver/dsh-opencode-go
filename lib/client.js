window.__ModuleLoader__.load({ id: "dsh-opencode-go", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  OPENCODE_GO_NS: () => OPENCODE_GO_NS,
  accountCommands: () => accountCommands,
  apply: () => apply,
  inject: () => inject,
  registerUsagePill: () => registerUsagePill
});
module.exports = __toCommonJS(index_exports);

// src/contracts.ts
var PROVIDER_ID = "dsh-opencode-go";
var FREE_PROVIDER_ID = "dsh-opencode-free";
function modelSettingsKey(model) {
  return model.source === "free" ? `${FREE_PROVIDER_ID}/${model.id}` : model.id;
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

// plugin-css:src/client/Section.module.css
var id = "dsh-opencode-go/Section.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id;
  style.textContent = '.N807zW_accounts{flex-direction:column;gap:0;margin:10px 0 2px;padding:0;display:flex}.N807zW_accountRow{background:0 0;border:0;border-radius:0;position:relative}.N807zW_accountRow+.N807zW_accountRow{border-top:1px solid var(--go-border)}.N807zW_accountRow[data-dragging=true]{opacity:.55}.N807zW_accountMain{grid-template-columns:18px minmax(0,1fr);align-items:start;gap:10px;padding:10px 2px 9px;display:grid}.N807zW_accountBody{flex-direction:column;gap:6px;min-width:0;display:flex}.N807zW_accountTop{align-items:center;gap:8px;min-width:0;line-height:18px;display:flex}.N807zW_accountMeta{align-items:center;gap:10px;min-width:0;min-height:15px;line-height:15px;display:flex}.N807zW_accountHandle{border-radius:var(--go-radius-small);width:18px;height:18px;color:var(--go-muted);cursor:grab;opacity:.4;-webkit-user-drag:element;background:0 0;border:0;place-items:center;margin-top:1px;padding:0;transition:opacity .12s;display:grid}.N807zW_accountRow:hover .N807zW_accountHandle,.N807zW_accountHandle:focus-visible{opacity:1}.N807zW_accountHandle:disabled{cursor:default;opacity:.5}.N807zW_accountHandle:focus-visible,.N807zW_accountToggle:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px;border-radius:var(--go-radius-small)}.N807zW_accountName{white-space:nowrap;text-overflow:ellipsis;min-width:0;color:var(--go-text);flex:0 auto;font-size:12.5px;font-weight:600;overflow:hidden}.N807zW_accountState{min-width:0;color:var(--go-muted);flex:0 auto;align-items:center;gap:5px;font-size:11px;display:inline-flex;overflow:hidden}.N807zW_accountDot{background:var(--go-success);border-radius:50%;flex:none;width:6px;height:6px}.N807zW_accountDot[data-off=true]{background:var(--go-warning)}.N807zW_accountPercent{text-align:right;font-family:var(--go-number-font);font-variant-numeric:tabular-nums;color:var(--go-text);flex:none;margin-left:auto;font-size:12px;font-weight:600}.N807zW_accountBar{background:var(--go-surface-2);border-radius:99px;flex:1;min-width:0;height:5px;position:relative;overflow:hidden}.N807zW_accountBarFill{background:var(--go-accent);border-radius:99px;position:absolute;inset:0 auto 0 0}.N807zW_accountBar[data-level=high] .N807zW_accountBarFill{background:var(--go-warning)}.N807zW_accountBar[data-level=limited] .N807zW_accountBarFill{background:var(--go-danger)}.N807zW_accountBarTick{background:var(--go-surface);width:1px;position:absolute;top:0;bottom:0}.N807zW_accountReset{text-align:right;white-space:nowrap;color:var(--go-muted);flex:none;font-size:10.5px}.N807zW_accountIdle{color:var(--go-muted);font-size:11px;line-height:1.5}.N807zW_accountToggle{border-radius:var(--go-radius-small);width:20px;height:20px;color:var(--go-muted);cursor:pointer;background:0 0;border:0;flex:none;place-items:center;padding:0;display:grid}.N807zW_accountToggle:hover{background:var(--go-surface-2);color:var(--go-text)}.N807zW_accountProblems{align-items:baseline;gap:8px;padding:0 2px 9px 28px;display:flex}.N807zW_accountRetry{font:inherit;color:var(--go-accent);cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-size:11.5px;line-height:1.5}.N807zW_accountRetry:disabled{color:var(--go-muted);cursor:default}.N807zW_accountHandle:active{cursor:grabbing}.N807zW_accountDetail{border-top:1px solid var(--go-border);flex-direction:column;gap:10px;padding:12px 2px 14px 28px;display:flex}.N807zW_accountRow:after{content:"";background:var(--go-accent);opacity:0;pointer-events:none;border-radius:2px;height:2px;position:absolute;left:0;right:0}.N807zW_accountRow[data-drop=before]:after{opacity:1;top:-6px}.N807zW_accountRow[data-drop=after]:after{opacity:1;bottom:-6px}.N807zW_accountUsage{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;font-size:12px;display:grid}.N807zW_accountUsage progress{appearance:none;background:var(--go-surface-2);--go-progress:var(--go-accent);width:100%;height:5px;accent-color:var(--go-progress);border:0;border-radius:99px;margin:8px 0;display:block;overflow:hidden}.N807zW_accountUsage progress::-webkit-progress-bar{background:var(--go-surface-2)}.N807zW_accountUsage progress::-webkit-progress-value{background:var(--go-progress);border-radius:99px}.N807zW_accountUsage progress::-moz-progress-bar{background:var(--go-progress);border-radius:99px}.N807zW_accountUsage progress[data-level=high]{--go-progress:var(--go-warning)}.N807zW_accountUsage progress[data-level=limited]{--go-progress:var(--go-danger)}.N807zW_accountUsage .N807zW_hint{overflow-wrap:anywhere;display:block}.N807zW_accountActions{flex-wrap:wrap;gap:8px;margin-top:10px;display:flex}.N807zW_accountsFoot{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;display:flex}.N807zW_addAccount{align-self:center;min-height:30px}.N807zW_accountsFoot .N807zW_field{flex:0 auto;align-items:flex-end;padding:0}.N807zW_accountsFoot .N807zW_head{gap:8px}.N807zW_accountEditor{border:.5px solid var(--go-border);border-radius:var(--go-radius-card);background:var(--go-surface-2);flex-direction:column;gap:8px;margin:0 2px 10px 28px;padding:10px 12px;display:flex}.N807zW_accountEditorHead{align-items:baseline;gap:6px;min-width:0;display:flex}.N807zW_accountEditorTitle{color:var(--go-text);flex:none;font-size:12.5px;font-weight:600;line-height:1.5}.N807zW_accountEditorFor{min-width:0;color:var(--go-muted);overflow-wrap:anywhere;font-size:11.5px;line-height:1.5}.N807zW_accountField{color:var(--go-muted);flex-direction:column;gap:5px;font-size:11.5px;line-height:1.5;display:flex}.N807zW_accountEditorActions{align-items:center;gap:8px;margin-top:2px;display:flex}@media (width<=480px){.N807zW_accountUsage{grid-template-columns:1fr}}.N807zW_page{box-sizing:border-box;border-radius:var(--go-radius-popover);background:var(--go-bg);min-width:0;height:100%;min-height:0;color:var(--go-text);font-family:var(--go-font);flex-direction:column;padding:22px 24px 0;font-size:13px;line-height:1.6;display:flex;container-type:size}.N807zW_page button,.N807zW_page input,.N807zW_page select{font-family:var(--go-font)}.N807zW_pageBody{scrollbar-gutter:stable;flex-direction:column;flex:1;min-height:0;padding:0 4px 16px 0;display:flex;overflow-y:auto}.N807zW_pageBody,.N807zW_modelList,.N807zW_modelDetails{scrollbar-width:thin;scrollbar-color:var(--go-border) transparent}.N807zW_pageBody::-webkit-scrollbar,.N807zW_modelList::-webkit-scrollbar,.N807zW_modelDetails::-webkit-scrollbar{width:8px;height:8px}.N807zW_pageBody::-webkit-scrollbar-track,.N807zW_modelList::-webkit-scrollbar-track,.N807zW_modelDetails::-webkit-scrollbar-track{background:0 0}.N807zW_pageBody::-webkit-scrollbar-thumb,.N807zW_modelList::-webkit-scrollbar-thumb,.N807zW_modelDetails::-webkit-scrollbar-thumb{background:var(--go-border);background-clip:content-box;border:2px solid #0000;border-radius:999px}.N807zW_pageBody:hover::-webkit-scrollbar-thumb,.N807zW_modelList:hover::-webkit-scrollbar-thumb,.N807zW_modelDetails:hover::-webkit-scrollbar-thumb{background:var(--go-muted);background-clip:content-box}.N807zW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.N807zW_field+.N807zW_field{border-top:.5px solid var(--go-border)}.N807zW_head{align-items:center;gap:8px;display:flex}.N807zW_label{min-width:0;color:var(--go-text);flex:1;font-size:13px;font-weight:500;line-height:1.5}.N807zW_trailing{flex:none;align-items:center;gap:8px;display:inline-flex}.N807zW_reset{font:inherit;color:var(--go-muted);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.N807zW_reset:hover:not(:disabled){color:var(--go-text)}.N807zW_reset:disabled{color:var(--go-muted);cursor:default}.N807zW_reset:focus-visible,.N807zW_cardTrigger:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:3px}.N807zW_input{border:1px solid var(--go-border-strong);border-radius:var(--go-radius-control);background:var(--go-surface-2);height:36px;font:inherit;color:var(--go-text);padding:0 12px;font-size:13px;line-height:1.5}.N807zW_input:focus-visible{border-color:var(--go-accent);box-shadow:0 0 0 3px var(--go-accent-soft);outline:none}.N807zW_inputInvalid:focus-visible{border-color:var(--go-danger);box-shadow:0 0 0 3px color-mix(in srgb, var(--go-danger) 28%, transparent)}.N807zW_input:disabled{color:var(--go-muted);cursor:default}.N807zW_inputInvalid{border-color:var(--go-danger);}.N807zW_invalid{color:var(--go-danger);margin:0;font-size:12px;line-height:1.5}.N807zW_hint{color:var(--go-muted);margin:0;font-size:12px;line-height:1.5}.N807zW_rows{flex-direction:column;display:flex}.N807zW_row{grid-template-columns:minmax(0,1fr) 300px;align-items:center;gap:6px 14px;padding:10px 0;display:grid}.N807zW_rowLabel{align-items:center;gap:7px;min-width:0;display:flex}.N807zW_rowTitle{overflow-wrap:anywhere;-webkit-line-clamp:2;min-width:0;color:var(--go-text);-webkit-box-orient:vertical;font-size:13px;line-height:1.5;display:-webkit-box;overflow:hidden}.N807zW_rowControl{align-items:center;min-width:0;display:flex}.N807zW_rowControl>.N807zW_input{box-sizing:border-box;width:100%}.N807zW_advancedHead{flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 12px;display:flex}.N807zW_advancedHead .N807zW_hint{flex:auto;min-width:0}.N807zW_advancedHead .N807zW_reset{flex:none}.N807zW_rowHint,.N807zW_rowInvalid{grid-column:1/-1;margin:0;font-size:12px;line-height:1.5}.N807zW_rowHint{color:var(--go-muted)}.N807zW_rowInvalid{color:var(--go-danger)}.N807zW_groupHead{letter-spacing:.04em;color:var(--go-muted);align-items:center;gap:8px;margin:14px 0 0;font-size:11.5px;line-height:1.5;display:flex}.N807zW_groupHead:first-child{margin-top:4px}.N807zW_groupHead:after{content:"";background:var(--go-border);flex:1;height:.5px}.N807zW_appearanceGroup{min-width:0;margin-top:10px}.N807zW_appearanceHead:after{order:1}.N807zW_appearanceHead .N807zW_reset{letter-spacing:normal;flex:none;order:2}.N807zW_appearanceTitle{font:inherit;margin:0}.N807zW_appearanceToggle{justify-content:space-between;align-items:center;gap:16px;padding:12px 0 16px;display:flex}.N807zW_appearanceCopy{min-width:0}.N807zW_appearanceHint{color:var(--go-muted);margin:4px 0 0;font-size:12px;line-height:1.6}.N807zW_appearanceStyles{border:0;min-width:0;margin:0;padding:0 0 4px}.N807zW_appearanceLegend{align-items:center;gap:7px;padding:0;display:flex}.N807zW_appearanceChoices{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;display:grid}.N807zW_appearanceChoice{border:1px solid var(--go-border);border-radius:var(--go-radius-option);cursor:pointer;flex-direction:column;gap:10px;min-width:0;padding:10px 12px;display:flex}.N807zW_appearanceChoice:hover:not([data-disabled=true]){border-color:var(--go-border);background:color-mix(in srgb, var(--go-surface-2) 40%, transparent)}.N807zW_appearanceChoice[data-selected=true]{border-color:var(--go-accent);background:var(--go-accent-soft)}.N807zW_appearanceChoice:has(:focus-visible){outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.N807zW_appearanceChoice[data-disabled=true]{opacity:.5;cursor:default}.N807zW_appearanceChoiceHead{color:var(--go-text);justify-content:space-between;align-items:center;gap:8px;font-size:12px;line-height:1.5;display:flex}.N807zW_appearanceRadio{width:14px;height:14px;accent-color:var(--go-accent);cursor:inherit;flex:none;margin:0}.N807zW_appearancePreview{border-radius:var(--go-radius-small);background:var(--go-bg);min-width:0;min-height:42px;color:var(--go-text);justify-content:center;align-items:center;display:flex}.N807zW_appearanceSample{box-sizing:border-box;pointer-events:none;max-width:100%;overflow:hidden}.N807zW_info{width:16px;height:16px;font:inherit;color:var(--go-muted);cursor:help;background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:0;font-size:12px;line-height:1;display:inline-flex}.N807zW_info:hover,.N807zW_info:focus-visible{color:var(--go-text)}.N807zW_info:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px;border-radius:var(--go-radius-small)}.N807zW_info svg{width:13px;height:13px}.N807zW_label .N807zW_info,.N807zW_cardTitle .N807zW_info{vertical-align:middle;margin-left:6px}.N807zW_seg{box-sizing:border-box;border:1px solid var(--go-border);border-radius:var(--go-radius-control);background:var(--go-surface);flex:1;min-width:0;padding:3px;display:flex;position:relative}.N807zW_segThumb{border-radius:var(--go-radius-option);background:var(--go-surface-2);width:calc(50% - 3px);transition:transform .16s cubic-bezier(.2,0,0,1);position:absolute;top:3px;bottom:3px;left:3px}.N807zW_seg[data-count="3"] .N807zW_segThumb{width:calc(33.3333% - 2px)}.N807zW_seg[data-index="1"] .N807zW_segThumb{transform:translate(100%)}.N807zW_seg[data-index="2"] .N807zW_segThumb{transform:translate(200%)}.N807zW_segOption{border-radius:var(--go-radius-option);min-width:0;font:inherit;color:var(--go-muted);text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:0 0;border:0;flex:1 1 0;padding:4px 8px;font-size:12.5px;line-height:1.5;transition:color .16s;position:relative;overflow:hidden}.N807zW_segOption:hover:not(:disabled){color:var(--go-text)}.N807zW_segOption[aria-checked=true]{color:var(--go-text);font-weight:500}.N807zW_segOption:disabled{opacity:.55;cursor:default}.N807zW_segOption:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:1px}.N807zW_pageTop{flex-direction:column;gap:6px;padding:0 0 16px;display:flex}.N807zW_title{font-family:var(--go-display-font);font-size:29px;font-weight:var(--go-display-weight);letter-spacing:var(--go-display-tracking);color:var(--go-text);margin:0;line-height:1.25}.N807zW_intro{color:var(--go-muted);margin:0;font-size:13px;line-height:1.5}.N807zW_pageTabs{border:1px solid var(--go-border);border-radius:var(--go-radius-control);background:var(--go-surface-2);gap:2px;margin:0 0 10px;padding:3px;display:flex}.N807zW_pageTab{border-radius:calc(var(--go-radius-control) - 3px);min-width:0;color:var(--go-muted);font:inherit;white-space:nowrap;cursor:pointer;background:0 0;border:0;flex:1;justify-content:center;align-items:center;gap:6px;padding:7px 10px;font-size:12.5px;line-height:1.4;display:inline-flex}.N807zW_pageTab[aria-selected=true]{background:var(--go-surface);color:var(--go-text);font-weight:600;box-shadow:0 1px 2px #0000000f}.N807zW_pageTab:hover:not([aria-selected=true]){color:var(--go-text)}.N807zW_pageTab:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.N807zW_tabMark{background:var(--go-accent);border-radius:50%;width:5px;height:5px}.N807zW_tabPanel{flex-direction:column;flex:1 0 auto;min-height:0;display:flex}.N807zW_tabPanel .N807zW_card,.N807zW_tabPanel .N807zW_cardModels{border-top:0;padding-top:0}.N807zW_tabPanel .N807zW_card+.N807zW_card,.N807zW_tabPanel .N807zW_card+.N807zW_cardModels,.N807zW_tabPanel .N807zW_cardModels+.N807zW_card{margin-top:18px}.N807zW_card,.N807zW_cardModels{border:0;border-top:1px solid var(--go-border);border-radius:var(--go-radius-card);background:0 0;padding:16px 0}.N807zW_card{flex:none}.N807zW_card+.N807zW_card,.N807zW_card+.N807zW_cardModels,.N807zW_cardModels+.N807zW_card{margin-top:2px}.N807zW_cardModels{flex-direction:column;flex:1 0 auto;display:flex}.N807zW_cardFolded{flex:none}.N807zW_cardHead{align-items:center;gap:8px;min-height:24px;padding:0;display:flex}.N807zW_cardTitle{min-width:0;font-family:var(--go-display-font);color:var(--go-text);flex:1;margin:0;font-size:17px;font-weight:500;line-height:1.5}.N807zW_cardSub{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:50%;color:var(--go-muted);flex:0 auto;font-size:11.5px;line-height:1.5;overflow:hidden}.N807zW_cardStamp{white-space:nowrap;color:var(--go-muted);flex:none;font-size:11.5px;line-height:1.5}.N807zW_cardBody{flex-direction:column;gap:10px;padding:14px 0 0;display:flex}.N807zW_cardBody>.N807zW_input{box-sizing:border-box;width:100%}.N807zW_cardModels>.N807zW_cardBody{flex:1 0 auto}.N807zW_cardNotes{flex-direction:column;gap:8px;padding:10px 0 0;display:flex}.N807zW_cardNotes:empty{display:none}.N807zW_cardDivider{border-top:.5px solid var(--go-border);margin:16px 0}.N807zW_cardTrigger{width:100%;min-height:24px;font:inherit;text-align:left;color:inherit;cursor:pointer;background:0 0;border:none;align-items:center;gap:8px;margin:0;padding:0;display:flex}.N807zW_cardTrigger:hover .N807zW_cardTitle{color:var(--go-accent)}.N807zW_cardHead>.N807zW_cardTrigger{padding:0}.N807zW_limitsEditor{flex-direction:column;flex:1 0 auto;gap:10px;padding-top:2px;display:flex}.N807zW_modelSearchRow{flex-wrap:wrap;align-items:center;gap:8px 12px;display:flex}.N807zW_modelSearchRow>.N807zW_input{flex:180px;width:0;min-width:140px}.N807zW_modelSearchRow>.N807zW_filters{flex:0 auto}.N807zW_modelHelp{color:var(--go-muted);margin:-2px 0 0;font-size:11.5px;line-height:1.5}.N807zW_limitsFoot{border-top:.5px solid var(--go-border);align-items:center;gap:8px;margin:4px 0 0;padding:14px 0 0;display:flex}.N807zW_limitsSummary{min-width:0;color:var(--go-muted);white-space:nowrap;flex:1;font-size:12px;line-height:1.5}.N807zW_modelMeta{align-items:baseline;gap:10px;display:flex}.N807zW_modelMeta .N807zW_limitsModelId{flex:1;min-width:0}.N807zW_releaseDate{color:var(--go-muted);font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:1.4}.N807zW_limitsModelId{text-overflow:ellipsis;white-space:nowrap;font-family:var(--go-number-font);color:var(--go-muted);font-size:11px;line-height:1.4;display:block;overflow:hidden}.N807zW_visuallyHidden{clip:rect(0, 0, 0, 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.N807zW_actions{border-top:1px solid var(--go-border);flex-wrap:wrap;flex:none;align-items:center;gap:8px;padding:16px 0;display:flex}.N807zW_starLink{max-width:100%;color:var(--go-muted);border-radius:var(--go-radius-small);align-items:center;gap:7px;margin-left:auto;padding:6px 0;font-size:12px;line-height:1.5;text-decoration:none;display:inline-flex}.N807zW_starLink svg{flex:none}.N807zW_starLink:hover{color:var(--go-accent)}.N807zW_starLink:hover span{text-underline-offset:3px;text-decoration:underline}.N807zW_starLink:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:3px}.N807zW_failedNote{color:var(--go-danger);margin:0;font-size:12px;line-height:1.5}.N807zW_slot{width:16px;height:16px;color:var(--go-muted);flex:none;justify-content:center;align-items:center;display:inline-flex}.N807zW_slot svg{width:15px;height:15px}.N807zW_chevron,.N807zW_chevronOpen{width:14px;height:14px;color:var(--go-muted);flex:none;transition:transform .15s}.N807zW_chevron{transform:rotate(-90deg)}.N807zW_filters{flex-wrap:wrap;align-items:center;gap:2px;display:flex}.N807zW_filter{border-radius:var(--go-radius-option);font:inherit;color:var(--go-muted);cursor:pointer;background:0 0;border:0;padding:6px 9px;font-size:12px}.N807zW_filter[aria-pressed=true]{color:var(--go-accent);background:var(--go-accent-soft)}.N807zW_filter span{color:var(--go-muted);margin-left:4px}.N807zW_modelLayout{border:.5px solid var(--go-border);border-radius:var(--go-radius-card);flex:auto;grid-template-columns:minmax(0,45fr) minmax(0,55fr);min-height:260px;max-height:560px;display:grid;overflow:hidden}.N807zW_modelList{border-right:.5px solid var(--go-border);min-height:0;padding:4px 6px;overflow-y:auto}.N807zW_modelPanel{flex-direction:column;gap:8px;width:100%;min-width:0;display:flex}.N807zW_modelRow{grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding-right:6px;display:grid}.N807zW_modelRow+.N807zW_modelRow{border-top:.5px solid var(--go-border)}.N807zW_modelRowSelected{background:var(--go-accent-soft);border-radius:var(--go-radius-option);border-top-color:#0000}.N807zW_modelRow>[role=switch]{flex:0 0 36px;width:36px;min-width:36px}.N807zW_modelChoice{box-sizing:border-box;text-align:left;border-radius:var(--go-radius-option);width:100%;min-width:0;color:var(--go-text);cursor:pointer;background:0 0;border:0;align-items:baseline;padding:9px 3px 9px 6px;display:flex;overflow:hidden}.N807zW_modelRow:hover:not(.N807zW_modelRowSelected){background:color-mix(in srgb, var(--go-surface-2) 92%, var(--go-text));border-radius:var(--go-radius-option);border-top-color:#0000}.N807zW_modelName{overflow-wrap:normal;word-break:normal;flex-wrap:wrap;flex:0 auto;align-items:center;gap:5px;min-width:0;font-size:13px;display:flex;overflow:hidden}.N807zW_overrideDot{background:var(--go-accent);border-radius:50%;flex:none;width:6px;height:6px}.N807zW_modelDetails{background:var(--go-surface);flex-direction:column;gap:12px;min-height:0;padding:16px;display:flex;overflow-y:auto}.N807zW_modelDetails h3{font-family:var(--go-display-font);overflow-wrap:anywhere;margin:0;font-size:17px;font-weight:500}.N807zW_modelHeading{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.N807zW_stats{flex-direction:column;gap:10px;display:flex}.N807zW_stat{flex-direction:column;gap:4px;display:flex}.N807zW_statLabel{color:var(--go-muted);font-size:11px;line-height:1.5}.N807zW_budgetEditor{margin-top:12px;font-size:12px}.N807zW_budgetEditor summary{cursor:pointer}.N807zW_budgetInput{align-items:center;gap:8px;margin-top:4px;display:flex}.N807zW_budgetPresets{flex-wrap:wrap;gap:6px;margin-top:8px;display:flex}.N807zW_modelDetails .N807zW_input{box-sizing:border-box;width:100%;min-width:0;height:30px;padding:0 9px;font-size:12px}.N807zW_modalities{flex-wrap:wrap;gap:4px;display:flex}.N807zW_modality,.N807zW_modalityOff{border-radius:var(--go-radius-small);padding:2px 7px;font-size:11px;line-height:1.5}.N807zW_modality{background:var(--go-surface-2);color:var(--go-muted)}.N807zW_modalityOff{border:.5px dashed var(--go-border);color:var(--go-muted)}.N807zW_modelDetails .N807zW_reset{align-self:flex-start}.N807zW_paneFoot{color:var(--go-muted);margin:auto 0 0;font-size:11px;line-height:1.5}.N807zW_newBadge{color:var(--go-accent);background:var(--go-accent-soft);border-radius:var(--go-radius-small);padding:1px 5px;font-size:11px}.N807zW_modelChoice:focus-visible,.N807zW_filter:focus-visible,.N807zW_cardTrigger:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:-2px}@container (width<=620px){.N807zW_accountMain{grid-template-columns:16px minmax(0,1fr) auto 16px;gap:8px}.N807zW_accountHandle{grid-area:1/1/span 3;align-self:start;margin-top:3px}.N807zW_accountName{grid-area:1/2/auto/span 2}.N807zW_accountState{grid-area:2/2}.N807zW_accountReset{grid-area:2/3;font-size:11px}.N807zW_accountBar{grid-area:3/2}.N807zW_accountPercent{grid-area:3/3}.N807zW_accountToggle{grid-area:1/4/span 3;align-self:start;margin-top:3px}.N807zW_accountIdle{text-align:left;grid-area:3/2/auto/span 2}.N807zW_accountDetail{padding-left:12px}.N807zW_accountEditor{margin-left:12px}.N807zW_cardHead{flex-wrap:wrap}.N807zW_cardHead>.N807zW_cardTrigger{flex:180px;min-width:0}.N807zW_cardTrigger{flex-wrap:wrap}.N807zW_cardSub{white-space:normal;overflow-wrap:anywhere;flex:100%;order:2;max-width:none}.N807zW_cardHead>.N807zW_trailing{margin-left:auto}}@container (width<=440px){.N807zW_row{grid-template-columns:minmax(0,1fr);gap:6px}.N807zW_appearanceChoices{grid-template-columns:minmax(0,1fr)}.N807zW_modelLayout{flex:none;grid-template-columns:minmax(0,1fr);max-height:none}.N807zW_modelList{border-right:0;border-bottom:.5px solid var(--go-border);max-height:240px}.N807zW_modelDetails{max-height:460px}.N807zW_modelSearchRow>.N807zW_input{flex-basis:100%}.N807zW_modelToolbar .N807zW_modelTools{justify-content:space-between;width:100%;margin-left:0}.N807zW_cardStamp{display:none}.N807zW_accountUsage{grid-template-columns:minmax(0,1fr)}.N807zW_accountUsage>div{grid-template-columns:80px minmax(0,1fr);align-items:center;gap:2px 10px;display:grid}.N807zW_accountUsage progress{margin:0}.N807zW_accountUsage .N807zW_hint{grid-column:1/-1}}@media (width<=520px){.N807zW_page{padding:18px 14px 0}.N807zW_title{font-size:26px}.N807zW_intro{font-size:12px}}@media (prefers-reduced-motion:reduce){.N807zW_chevron,.N807zW_chevronOpen,.N807zW_segThumb,.N807zW_segOption{transition:none}}.N807zW_modelToolbar{border-bottom:.5px solid var(--go-border);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 16px;margin-bottom:2px;padding:4px 0 12px;display:flex}.N807zW_modelTabs{flex:none;align-items:center;gap:16px;padding:0;display:inline-flex}.N807zW_modelTab{min-height:34px;color:var(--go-muted);cursor:pointer;font:inherit;white-space:nowrap;background:0 0;border:0;border-bottom:2px solid #0000;border-radius:0;justify-content:center;align-items:center;gap:7px;padding:5px 0;font-size:12px;font-weight:500;line-height:20px;display:inline-flex}.N807zW_modelTab[aria-selected=true]{border-bottom-color:var(--go-accent);color:var(--go-accent);font-weight:500}.N807zW_modelTab:hover{color:var(--go-text)}.N807zW_modelTabCount{font-variant-numeric:tabular-nums;color:var(--go-muted);font-size:11px;font-weight:400;line-height:18px}.N807zW_modelTabWarning{background:var(--go-warning);border-radius:50%;width:5px;height:5px}.N807zW_modelTools{flex-wrap:wrap;flex:none;align-items:center;gap:10px;margin-left:auto;display:flex}.N807zW_modelSync{color:var(--go-muted);white-space:nowrap;align-items:center;gap:5px;font-size:11px;line-height:18px;display:inline-flex}.N807zW_modelSync time{font-variant-numeric:tabular-nums;margin-left:2px}.N807zW_modelSyncDot{opacity:.6;background:currentColor;border-radius:50%;flex:none;width:5px;height:5px}.N807zW_modelSync[data-state=ready] .N807zW_modelSyncDot{background:var(--go-success);opacity:1}.N807zW_modelSync[data-state=failed]{color:var(--go-warning)}.N807zW_modelSync[data-state=loading] .N807zW_modelSyncDot{background:var(--go-accent);opacity:1}.N807zW_modelTab:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}';
  document.head.appendChild(style);
}
var Section_default = { "accountActions": "N807zW_accountActions", "accountBar": "N807zW_accountBar", "accountBarFill": "N807zW_accountBarFill", "accountBarTick": "N807zW_accountBarTick", "accountBody": "N807zW_accountBody", "accountDetail": "N807zW_accountDetail", "accountDot": "N807zW_accountDot", "accountEditor": "N807zW_accountEditor", "accountEditorActions": "N807zW_accountEditorActions", "accountEditorFor": "N807zW_accountEditorFor", "accountEditorHead": "N807zW_accountEditorHead", "accountEditorTitle": "N807zW_accountEditorTitle", "accountField": "N807zW_accountField", "accountHandle": "N807zW_accountHandle", "accountIdle": "N807zW_accountIdle", "accountMain": "N807zW_accountMain", "accountMeta": "N807zW_accountMeta", "accountName": "N807zW_accountName", "accountPercent": "N807zW_accountPercent", "accountProblems": "N807zW_accountProblems", "accountReset": "N807zW_accountReset", "accountRetry": "N807zW_accountRetry", "accountRow": "N807zW_accountRow", "accountState": "N807zW_accountState", "accountToggle": "N807zW_accountToggle", "accountTop": "N807zW_accountTop", "accountUsage": "N807zW_accountUsage", "accounts": "N807zW_accounts", "accountsFoot": "N807zW_accountsFoot", "actions": "N807zW_actions", "addAccount": "N807zW_addAccount", "advancedHead": "N807zW_advancedHead", "appearanceChoice": "N807zW_appearanceChoice", "appearanceChoiceHead": "N807zW_appearanceChoiceHead", "appearanceChoices": "N807zW_appearanceChoices", "appearanceCopy": "N807zW_appearanceCopy", "appearanceGroup": "N807zW_appearanceGroup", "appearanceHead": "N807zW_appearanceHead", "appearanceHint": "N807zW_appearanceHint", "appearanceLegend": "N807zW_appearanceLegend", "appearancePreview": "N807zW_appearancePreview", "appearanceRadio": "N807zW_appearanceRadio", "appearanceSample": "N807zW_appearanceSample", "appearanceStyles": "N807zW_appearanceStyles", "appearanceTitle": "N807zW_appearanceTitle", "appearanceToggle": "N807zW_appearanceToggle", "budgetEditor": "N807zW_budgetEditor", "budgetInput": "N807zW_budgetInput", "budgetPresets": "N807zW_budgetPresets", "card": "N807zW_card", "cardBody": "N807zW_cardBody", "cardDivider": "N807zW_cardDivider", "cardFolded": "N807zW_cardFolded", "cardHead": "N807zW_cardHead", "cardModels": "N807zW_cardModels", "cardNotes": "N807zW_cardNotes", "cardStamp": "N807zW_cardStamp", "cardSub": "N807zW_cardSub", "cardTitle": "N807zW_cardTitle", "cardTrigger": "N807zW_cardTrigger", "chevron": "N807zW_chevron", "chevronOpen": "N807zW_chevronOpen", "failedNote": "N807zW_failedNote", "field": "N807zW_field", "filter": "N807zW_filter", "filters": "N807zW_filters", "groupHead": "N807zW_groupHead", "head": "N807zW_head", "hint": "N807zW_hint", "info": "N807zW_info", "input": "N807zW_input", "inputInvalid": "N807zW_inputInvalid N807zW_input", "intro": "N807zW_intro", "invalid": "N807zW_invalid", "label": "N807zW_label", "limitsEditor": "N807zW_limitsEditor", "limitsFoot": "N807zW_limitsFoot", "limitsModelId": "N807zW_limitsModelId", "limitsSummary": "N807zW_limitsSummary", "modalities": "N807zW_modalities", "modality": "N807zW_modality", "modalityOff": "N807zW_modalityOff", "modelChoice": "N807zW_modelChoice", "modelDetails": "N807zW_modelDetails", "modelHeading": "N807zW_modelHeading", "modelHelp": "N807zW_modelHelp", "modelLayout": "N807zW_modelLayout", "modelList": "N807zW_modelList", "modelMeta": "N807zW_modelMeta", "modelName": "N807zW_modelName", "modelPanel": "N807zW_modelPanel", "modelRow": "N807zW_modelRow", "modelRowSelected": "N807zW_modelRowSelected", "modelSearchRow": "N807zW_modelSearchRow", "modelSync": "N807zW_modelSync", "modelSyncDot": "N807zW_modelSyncDot", "modelTab": "N807zW_modelTab", "modelTabCount": "N807zW_modelTabCount", "modelTabWarning": "N807zW_modelTabWarning", "modelTabs": "N807zW_modelTabs", "modelToolbar": "N807zW_modelToolbar", "modelTools": "N807zW_modelTools", "newBadge": "N807zW_newBadge", "overrideDot": "N807zW_overrideDot", "page": "N807zW_page", "pageBody": "N807zW_pageBody", "pageTab": "N807zW_pageTab", "pageTabs": "N807zW_pageTabs", "pageTop": "N807zW_pageTop", "paneFoot": "N807zW_paneFoot", "releaseDate": "N807zW_releaseDate", "reset": "N807zW_reset", "row": "N807zW_row", "rowControl": "N807zW_rowControl", "rowHint": "N807zW_rowHint", "rowInvalid": "N807zW_rowInvalid", "rowLabel": "N807zW_rowLabel", "rowTitle": "N807zW_rowTitle", "rows": "N807zW_rows", "seg": "N807zW_seg", "segOption": "N807zW_segOption", "segThumb": "N807zW_segThumb", "slot": "N807zW_slot", "starLink": "N807zW_starLink", "stat": "N807zW_stat", "statLabel": "N807zW_statLabel", "stats": "N807zW_stats", "tabMark": "N807zW_tabMark", "tabPanel": "N807zW_tabPanel", "title": "N807zW_title", "trailing": "N807zW_trailing", "visuallyHidden": "N807zW_visuallyHidden" };

// plugin-css:src/client/UsagePill.module.css
var id2 = "dsh-opencode-go/UsagePill.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id2) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id2;
  style.textContent = '.mAjYhq_root{min-width:0;font-family:var(--go-font);color:var(--go-text);display:inline-flex;position:relative}.mAjYhq_trigger{box-sizing:border-box;border:1px solid var(--go-border);border-radius:var(--go-radius-pill);background:var(--go-surface);min-width:0;max-width:100%;color:var(--go-text);font:inherit;white-space:nowrap;cursor:pointer;align-items:center;gap:7px;padding:6px 10px;font-size:11.5px;line-height:1.5;display:inline-flex}.mAjYhq_trigger:hover,.mAjYhq_trigger:focus-visible{border-color:color-mix(in srgb, var(--go-accent) 65%, var(--go-border));background:var(--go-surface-2)}.mAjYhq_trigger.mAjYhq_plain{color:inherit;background:0 0;border-color:#0000;padding:4px 6px}.mAjYhq_trigger.mAjYhq_plain:hover,.mAjYhq_trigger.mAjYhq_plain:focus-visible{background:color-mix(in srgb, var(--go-accent) 7%, transparent)}.mAjYhq_trigger:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.mAjYhq_pillStatus{background:var(--go-success);border-radius:50%;flex:none;width:5px;height:5px}.mAjYhq_pillStatus[data-warning]{background:var(--go-warning)}.mAjYhq_reading{text-overflow:ellipsis;min-width:0;font-family:var(--go-number-font);font-variant-numeric:tabular-nums;letter-spacing:-.025em;flex:none;overflow:hidden}.mAjYhq_unit{color:var(--go-muted)}.mAjYhq_stale,.mAjYhq_fallback{color:var(--go-warning);font-size:11px}.mAjYhq_account{text-overflow:ellipsis;min-width:0;color:var(--go-muted);flex:0 100 auto;overflow:hidden}@container (width<=460px){.mAjYhq_stale,.mAjYhq_fallback{display:none}.mAjYhq_reading[data-stale]:after{content:"*"}.mAjYhq_trigger[data-fallback]:after{content:" \u21B3";color:var(--go-warning)}}@container (width<=360px){.mAjYhq_unit{display:none}}.mAjYhq_panel{z-index:100;box-sizing:border-box;border:1px solid var(--go-border);border-radius:var(--go-radius-popover);width:352px;max-width:calc(100vw - 48px);max-height:72vh;color:var(--go-text);box-shadow:var(--go-shadow);isolation:isolate;flex-direction:column;font-size:12px;line-height:1.45;display:flex;position:absolute;bottom:calc(100% + 9px);right:0}.mAjYhq_panel:focus{outline:none}.mAjYhq_panel:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.mAjYhq_material{z-index:-1;border-radius:inherit;background:var(--go-surface);pointer-events:none;position:absolute;inset:0}.mAjYhq_body{box-sizing:border-box;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--go-border) transparent;flex-direction:column;flex:1;gap:0;min-height:0;padding:10px 16px 14px;display:flex;overflow-y:auto}.mAjYhq_panelHead{min-height:36px;color:var(--go-text);flex:none;align-items:center;gap:8px;padding:0;display:flex}.mAjYhq_panelHead strong{font-family:var(--go-display-font);letter-spacing:0;color:var(--go-text);font-size:15px;font-weight:600;line-height:21px}.mAjYhq_back{border-radius:var(--go-radius-small);width:24px;height:26px;color:var(--go-muted);cursor:pointer;background:0 0;border:0;place-items:center;margin-left:-5px;padding:0;display:grid}.mAjYhq_back:hover{color:var(--go-text);background:var(--go-surface-2)}.mAjYhq_icon{flex:none;width:14px;height:14px}.mAjYhq_tick{width:14px;height:14px;color:var(--go-accent);flex:none}.mAjYhq_accChip{border-radius:var(--go-radius-small);min-width:0;max-width:100%;color:var(--go-muted);font-family:var(--go-font);text-align:left;cursor:default;background:0 0;border:0;align-items:center;gap:6px;margin-left:auto;padding:4px 7px;font-size:12px;line-height:17px;display:inline-flex}button.mAjYhq_accChip{cursor:pointer}button.mAjYhq_accChip:hover:not(:disabled){background:var(--go-surface-2)}button.mAjYhq_accChip:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:-2px}button.mAjYhq_accChip:disabled{opacity:.5;cursor:default}.mAjYhq_dot{background:var(--go-success);border-radius:50%;flex:none;width:5px;height:5px}.mAjYhq_tag{border-radius:var(--go-radius-small);background:var(--go-accent-soft);color:var(--go-accent);flex:none;padding:1px 5px;font-size:10.5px;line-height:16px}.mAjYhq_accChipName{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:104px;color:var(--go-text);font-weight:500;overflow:hidden}.mAjYhq_accChip .mAjYhq_icon{width:11px;height:11px}.mAjYhq_windows{flex-direction:column;flex:none;margin-top:4px;display:flex}.mAjYhq_win{flex-direction:column;gap:6px;padding:10px 0;display:flex}.mAjYhq_meta{align-items:baseline;gap:8px;min-width:0;line-height:17px;display:flex}.mAjYhq_winLabel{color:var(--go-muted);flex:none;font-size:11.5px}.mAjYhq_winReset{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--go-muted);flex:1;font-size:10.5px;line-height:15px;overflow:hidden}.mAjYhq_winPercent{text-align:right;width:36px;font-family:var(--go-number-font);font-variant-numeric:tabular-nums;flex:none;font-size:12.5px;font-weight:600}.mAjYhq_win progress{appearance:none;background:color-mix(in srgb, var(--go-text) 9%, var(--go-surface));border:0;border-radius:99px;width:100%;min-width:0;height:6px;display:block}.mAjYhq_win progress::-webkit-progress-bar{background:0 0;border-radius:99px}.mAjYhq_win progress::-webkit-progress-value{background:var(--go-progress,var(--go-accent));border-radius:99px}.mAjYhq_win progress::-moz-progress-bar{background:var(--go-progress,var(--go-accent));border-radius:99px}.mAjYhq_win progress.mAjYhq_high{--go-progress:var(--go-warning)}.mAjYhq_win progress.mAjYhq_limited{--go-progress:var(--go-danger)}.mAjYhq_progressRolling,.mAjYhq_progressWeekly,.mAjYhq_progressMonthly{--go-progress:var(--go-accent)}.mAjYhq_limitedText{color:var(--go-danger);font-size:10px;line-height:14px}.mAjYhq_actions{color:var(--go-muted);flex:none;align-items:center;gap:10px;margin-top:8px;font-size:11px;line-height:17px;display:flex}.mAjYhq_actions .mAjYhq_hist{border-radius:var(--go-radius-small);color:var(--go-text);font-family:var(--go-font);cursor:pointer;background:0 0;border:0;flex:none;align-items:center;gap:6px;margin-left:-4px;padding:2px 4px;font-size:11.5px;line-height:17px;display:inline-flex}.mAjYhq_actions .mAjYhq_hist .mAjYhq_icon{width:14px;height:14px;color:var(--go-accent)}.mAjYhq_actions .mAjYhq_hist:hover,.mAjYhq_actions .mAjYhq_hist:active{background:var(--go-surface-2)}.mAjYhq_actions .mAjYhq_hist:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.mAjYhq_actions .mAjYhq_updated{text-overflow:ellipsis;white-space:nowrap;text-align:right;flex:1;min-width:0;overflow:hidden}.mAjYhq_actions .mAjYhq_refresh{border-radius:var(--go-radius-small);color:var(--go-accent);font-family:var(--go-font);cursor:pointer;background:0 0;border:0;flex:none;padding:2px 4px;font-size:11px;line-height:17px}.mAjYhq_actions .mAjYhq_refresh:hover:not(:disabled){background:var(--go-surface-2)}.mAjYhq_actions .mAjYhq_refresh:disabled{opacity:.5;cursor:default}.mAjYhq_actions .mAjYhq_refresh:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.mAjYhq_list{flex:none;padding:6px 0 4px}.mAjYhq_divider{background:var(--go-border);height:1px}.mAjYhq_list .mAjYhq_divider{margin:4px 10px}.mAjYhq_option{border-radius:var(--go-radius-option);width:100%;min-height:40px;color:var(--go-text);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:10px;padding:0 11px;line-height:19px;display:flex}.mAjYhq_option:hover:not(:disabled):not([data-selected]){background:var(--go-surface-2)}.mAjYhq_option[data-selected]{background:var(--go-accent-soft);box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--go-accent) 22%, transparent)}.mAjYhq_option[data-selected]:hover{background:var(--go-accent-soft)}.mAjYhq_option:disabled{opacity:.5;cursor:default}.mAjYhq_option:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:-2px}.mAjYhq_optionName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:12px;overflow:hidden}.mAjYhq_option[data-selected] .mAjYhq_optionName{font-weight:500}.mAjYhq_hint{color:var(--go-muted);margin:10px 0 4px;font-size:11.5px;line-height:18px}.mAjYhq_warning{border-left:2px solid var(--go-warning);border-radius:0 var(--go-radius-small) var(--go-radius-small) 0;background:color-mix(in srgb, var(--go-warning) 7%, transparent);color:var(--go-text);overflow-wrap:anywhere;margin:8px 0;padding:8px 10px;font-size:11.5px;line-height:1.6}.mAjYhq_warning p{margin:4px 0 0}.mAjYhq_retry{border:1px solid var(--go-border);border-radius:var(--go-radius-small);color:var(--go-accent);font:inherit;cursor:pointer;background:0 0;align-self:flex-start;margin-bottom:8px;padding:4px 8px;font-size:11.5px}.mAjYhq_retry:disabled{opacity:.5;cursor:default}.mAjYhq_retry:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:-2px}.mAjYhq_sidebarRoot{width:100%;min-width:0;display:flex}.mAjYhq_sidebarRoot[data-wide=false]{flex:none;width:36px;min-width:36px}.mAjYhq_sidebarCard,.mAjYhq_sidebarIcon{box-sizing:border-box;border:1px solid var(--go-border);background:var(--go-surface);color:var(--go-text);font:inherit}.mAjYhq_sidebarCard{border-radius:var(--go-radius-card);text-align:left;flex-direction:column;align-items:stretch;gap:11px;width:100%;min-width:0;padding:14px 12px 6px;display:flex}.mAjYhq_sidebarHead{align-items:center;gap:6px;min-width:0;margin-bottom:1px;display:flex}.mAjYhq_sidebarHead>strong{font-family:var(--go-display-font);font-size:15px;font-weight:var(--go-display-weight);white-space:nowrap;letter-spacing:var(--go-display-tracking);flex:none}.mAjYhq_sidebarBadge{border:1px solid var(--go-border);border-radius:var(--go-radius-small);min-width:0;color:var(--go-muted);text-overflow:ellipsis;white-space:nowrap;background:0 0;margin-left:auto;padding:1px 5px;font-size:11px;line-height:1.7;overflow:hidden}.mAjYhq_sidebarAccountButton{cursor:pointer;font-family:inherit}.mAjYhq_sidebarAccountButton:hover{color:var(--go-accent);border-color:var(--go-accent)}.mAjYhq_sidebarAccountButton:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.mAjYhq_sidebarWindow{grid-template-columns:44px minmax(0,1fr) 36px;align-items:center;gap:7px;font-size:11px;line-height:1.5;display:grid}.mAjYhq_sidebarWindow>span{color:var(--go-muted);white-space:nowrap}.mAjYhq_sidebarWindow>strong{text-align:right;font-family:var(--go-number-font);font-variant-numeric:tabular-nums;font-size:11px;font-weight:400}.mAjYhq_sidebarWindow progress{appearance:none;background:var(--go-surface-2);border:0;border-radius:99px;flex:1;width:100%;min-width:0;height:5px;display:block}.mAjYhq_sidebarWindow progress::-webkit-progress-bar{background:0 0;border-radius:99px}.mAjYhq_sidebarWindow progress::-webkit-progress-value{background:var(--go-progress,var(--go-accent));border-radius:99px}.mAjYhq_sidebarWindow progress::-moz-progress-bar{background:var(--go-progress,var(--go-accent));border-radius:99px}.mAjYhq_sidebarWindow progress.mAjYhq_high{--go-progress:var(--go-warning)}.mAjYhq_sidebarWindow progress.mAjYhq_limited{--go-progress:var(--go-danger)}.mAjYhq_sidebarStatus{color:var(--go-warning);font-size:11px}.mAjYhq_sidebarHistory{border:0;border-top:1px solid var(--go-border);width:100%;min-height:33px;color:var(--go-muted);font:inherit;text-align:left;cursor:pointer;background:0 0;align-items:center;gap:7px;margin-top:2px;padding:0;font-size:11.5px;display:flex}.mAjYhq_sidebarHistory span{flex:1}.mAjYhq_sidebarHistory>.mAjYhq_icon:first-child{color:var(--go-accent)}.mAjYhq_sidebarHistory:hover{color:var(--go-text)}.mAjYhq_sidebarHistory:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:1px;border-radius:var(--go-radius-small)}.mAjYhq_sidebarIcon{border-radius:var(--go-radius-control);width:36px;min-width:36px;height:36px;color:var(--go-accent);place-items:center;padding:0;display:grid}button.mAjYhq_sidebarIcon{cursor:pointer}button.mAjYhq_sidebarIcon:hover{background:var(--go-surface-2);border-color:var(--go-accent)}button.mAjYhq_sidebarIcon:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:2px}.mAjYhq_sidebarIcon .mAjYhq_icon{width:17px;height:17px}';
  document.head.appendChild(style);
}
var UsagePill_default = { "accChip": "mAjYhq_accChip", "accChipName": "mAjYhq_accChipName", "account": "mAjYhq_account", "actions": "mAjYhq_actions", "back": "mAjYhq_back", "body": "mAjYhq_body", "divider": "mAjYhq_divider", "dot": "mAjYhq_dot", "fallback": "mAjYhq_fallback", "high": "mAjYhq_high", "hint": "mAjYhq_hint", "hist": "mAjYhq_hist", "icon": "mAjYhq_icon", "limited": "mAjYhq_limited", "limitedText": "mAjYhq_limitedText", "list": "mAjYhq_list", "material": "mAjYhq_material", "meta": "mAjYhq_meta", "option": "mAjYhq_option", "optionName": "mAjYhq_optionName", "panel": "mAjYhq_panel", "panelHead": "mAjYhq_panelHead", "pillStatus": "mAjYhq_pillStatus", "plain": "mAjYhq_plain", "progressMonthly": "mAjYhq_progressMonthly", "progressRolling": "mAjYhq_progressRolling", "progressWeekly": "mAjYhq_progressWeekly", "reading": "mAjYhq_reading", "refresh": "mAjYhq_refresh", "retry": "mAjYhq_retry", "root": "mAjYhq_root", "sidebarAccountButton": "mAjYhq_sidebarAccountButton", "sidebarBadge": "mAjYhq_sidebarBadge", "sidebarCard": "mAjYhq_sidebarCard", "sidebarHead": "mAjYhq_sidebarHead", "sidebarHistory": "mAjYhq_sidebarHistory", "sidebarIcon": "mAjYhq_sidebarIcon", "sidebarRoot": "mAjYhq_sidebarRoot", "sidebarStatus": "mAjYhq_sidebarStatus", "sidebarWindow": "mAjYhq_sidebarWindow", "stale": "mAjYhq_stale", "tag": "mAjYhq_tag", "tick": "mAjYhq_tick", "trigger": "mAjYhq_trigger", "unit": "mAjYhq_unit", "updated": "mAjYhq_updated", "warning": "mAjYhq_warning", "win": "mAjYhq_win", "winLabel": "mAjYhq_winLabel", "winPercent": "mAjYhq_winPercent", "winReset": "mAjYhq_winReset", "windows": "mAjYhq_windows" };

// src/client/Section.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/presentation.ts
var import_react = require("react");
var en = {
  accountsTitle: "Accounts",
  accountsRefresh: "Refresh accounts",
  accountsBlocked: "Wait for the current settings change to finish before changing accounts.",
  accountsEmpty: "Add an account to use OpenCode Go.",
  accountsWriteFailed: "Could not apply the account change. Your input is kept; please retry.",
  accountsReadFailed: "Could not read account status. Please refresh.",
  accountsCleanupFailed: "The account entry was removed, but its stored key could not be deleted. Remove the unused reference through the host credential service.",
  accountsRemoveKeyFailed: "The stored key could not be deleted, so the account was kept. Please retry.",
  accountsStatusUnknown: "Status unknown",
  accountDefault: "Default account",
  accountAdd: "Add account",
  accountRename: "Rename",
  accountReplaceKey: "Replace key",
  accountRemove: "Remove account",
  accountRemoveHint: "Remove \u201C{name}\u201D? If it is the current account, the next account takes over. Keys added here are deleted from the credential service; existing external references are kept.",
  accountName: "Account name",
  accountKeyHint: "The key is saved through the host credential service and is never returned to this page.",
  accountConfirm: "Confirm",
  accountCancel: "Cancel",
  accountAutoSwitch: "Automatic fallback",
  accountAutoSwitchHint: "When a quota runs out or a key is unusable, the other accounts are tried in order; the account that starts producing output moves to the first position and becomes current.",
  accountPreferredTag: "Current",
  accountSwitchAction: "Switch",
  accountSwitchTitle: "Switch account",
  accountSwitchBack: "Back to usage",
  accountSwitchHint: "This account moves to the first position and serves later requests in this profile. The other accounts keep their relative order.",
  accountSwitchFailed: "Could not switch account. Please retry.",
  sidebarNextAccount: "View the next account\u2019s quota",
  sidebarAnalytics: "Open usage history",
  accountFallbackQuota: "The current account reached its quota; switched to",
  accountFallbackCredential: "The current key was unavailable or rejected; switched to",
  accountsSummary: "{count} accounts \xB7 Current {name}",
  accountsSummaryEmpty: "No accounts yet",
  accountsAvailability: "{ready}/{total} configured",
  accountsAvailabilityFailed: "{ready}/{total} configured \xB7 {failed} unreadable",
  accountsDetails: "Details for {name}",
  accountsDetailsHide: "Hide details for {name}",
  accountDragHandle: "Reorder {name}",
  accountConfigureHint: "Add a key to read usage",
  usageResetMinutes: "resets in {minutes} min",
  usageResetHours: "resets in {hours} h",
  usageResetDays: "resets in {days} d",
  usageResetDue: "resets now",
  usageResetUnknown: "reset time unknown",
  usageTitle: "OpenCode Go quota",
  usageRollingShort: "5h",
  usageWeekShort: "week",
  usage_rolling: "5 hours",
  usage_weekly: "Weekly",
  usage_monthly: "Monthly",
  usageResets: "Resets",
  usageLimited: "Limit reached",
  usageLoading: "Loading usage\u2026",
  usageUnavailable: "Unavailable",
  usageStaleShort: "Last data",
  usageFallbackShort: "fallback",
  usageStaleHint: "Showing the last successful usage reading. Current usage may have changed.",
  usageRefreshFailed: "Refresh failed",
  usageLastUpdated: "Last updated",
  usageRetry: "Retry now",
  usageRefresh: "Refresh quota",
  usageRefreshing: "Refreshing\u2026",
  analyticsOpen: "Usage history",
  analyticsTitle: "Usage history",
  analyticsSubtitle: "All workspace clients \xB7 UTC calendar days",
  analyticsClose: "Close usage history",
  analyticsRange: "Date range",
  analyticsRangeToday: "Today",
  analyticsRange7d: "7 days",
  analyticsRange30d: "30 days",
  analyticsRange90d: "90 days",
  analyticsAccount: "Viewing account",
  analyticsNoAccounts: "Add an account to view workspace history.",
  analyticsRefresh: "Refresh history",
  analyticsRetry: "Try again",
  analyticsLoading: "Loading official workspace history\u2026",
  analyticsEmpty: "No recorded usage in this range.",
  analyticsFailed: "Could not load workspace history.",
  analyticsRefreshed: "Updated",
  analyticsRefreshing: "Refreshing official history\u2026",
  analyticsStale: "Refresh failed. Showing the last successful result for this account and range.",
  analyticsRequests: "Requests",
  analyticsTokens: "Tokens",
  analyticsSpend: "Usage amount",
  analyticsCacheHit: "Cache hit rate",
  analyticsInput: "Input",
  analyticsOutput: "Output",
  analyticsCacheRead: "Cache read",
  analyticsCacheWrite: "Cache write",
  analyticsDailyAverage: "Daily average",
  analyticsModels: "models",
  analyticsActiveDays: "active days",
  analyticsPerDay: "day",
  analyticsByDay: "Daily activity",
  analyticsTrendHint: "Select a day to inspect its usage.",
  analyticsTokensMode: "Token breakdown",
  analyticsRequestsMode: "Request count",
  analyticsChartHelp: "Arrow keys move between days. Click or tap to pin a day; Escape clears it.",
  analyticsSelectDay: "Hover, focus or tap a bar for daily details.",
  analyticsByModel: "Model distribution",
  analyticsRankingHint: "Compare models across this workspace.",
  analyticsDetails: "Model details",
  analyticsModel: "Model",
  analyticsShare: "Token share",
  analyticsAllModels: "Show all models",
  analyticsFewerModels: "Show fewer models",
  analyticsExport: "Export CSV",
  analyticsExporting: "Exporting\u2026",
  analyticsExportFailed: "Could not export this range. Please retry.",
  analyticsPermission: "This key cannot read history. Check its Usage read permission in OpenCode Console.",
  analyticsCredentials: "The selected account has no usable key. Update it in account settings.",
  analyticsUnsupported: "History is available for the official OpenCode gateway. This account uses another gateway.",
  analyticsPending: "OpenCode is still preparing daily summaries. Please try again shortly.",
  analyticsInvalid: "OpenCode returned an unreadable history response. Please retry.",
  analyticsQuota: "Current allowance",
  analyticsQuotaFailed: "Allowance unavailable",
  analyticsAmountHint: "Official usage amount is not a receipt or an extra charge for Go.",
  analyticsLagHint: "Daily summaries may lag recent requests. Anonymous Free usage may not appear.",
  analyticsExportHint: "CSV includes member and service-account fields supplied by Console.",
  analyticsKicker: "OpenCode Console",
  nav: "OpenCode Go",
  title: "OpenCode Go",
  titleLabel: "OpenCode Go",
  intro: "Choose the OpenCode Go and platform free models shown in conversations and adjust their capacities.",
  starProject: "Enjoying the plugin? Star it on GitHub",
  starProjectTitle: "Open the GitHub project in a new tab",
  enabledLabel: "Enable OpenCode Go",
  enabledHint: "Adds OpenCode Go models to conversations. The Free channel below has its own switch and also requires this one.",
  enabledOff: "OpenCode Go is off: its models are withdrawn from every picker.",
  enabledUnavailable: "This deployment pins the switch on in its composition, so it cannot be changed here.",
  enabledFailed: "Could not update the OpenCode Go switch. Please retry.",
  keyLabel: "API key",
  keyHint: "From your OpenCode Go subscription (opencode.ai). Leaving this blank keeps the key already saved, and a saved key applies to the next request without a restart.",
  keyConfigured: "Key saved",
  keyMissing: "No key yet",
  keyNotWritable: "This key is supplied from outside the settings document (an environment variable, for example), so it cannot be changed here.",
  modelsLabel: "Available models",
  modelSourcesLabel: "Model source",
  modelsGoTab: "OpenCode Go",
  modelsFreeTab: "Free models",
  modelsGoSource: "Go model source",
  modelsFreeSource: "Free model source",
  modelsRefresh: "Refresh",
  modelsLoading: "Reading the gateway model list\u2026",
  modelsFailed: "Could not read the gateway model list.",
  modelsStale: "Some model data could not be refreshed. Available cached data is still in use, including in conversation pickers.",
  modelsSourceFailed: "Refresh failed",
  modelsSourceCurrent: "Up to date",
  modelsSourceNeverFetched: "No successful fetch yet",
  modelsSourceUpdated: "Last successful check: {time}",
  modelsRefreshing: "Refreshing\u2026 Keeping the last fetched models visible.",
  modelsRefreshingShort: "Updating\u2026",
  modelsEmpty: "The gateway currently serves no model this adapter can route.",
  limitsLabel: "Model capacities",
  limitsHint: "Capacities come from the online configuration; blank keeps the default and Save applies your overrides.",
  limitsFilterLabel: "Find a model",
  limitsFilterPlaceholder: "Search by model name or id\u2026",
  limitsSummary: "{count} customized",
  limitsModel: "Model",
  limitsContext: "Context window",
  limitsOutput: "Max output",
  thinkingBudgets: "Thinking budgets",
  thinkingBudgetsHint: "Add token budgets to the conversation picker, then Save. Range: {min}\u2013{max} tokens. Existing reasoning choices stay available; Default uses the service settings. The SDK may reduce a budget to leave room for the answer.",
  thinkingBudgetAddLabel: "New thinking budget for {name}",
  thinkingBudgetAdd: "Add",
  thinkingBudgetRemove: "Remove {value} token budget",
  capacityDefault: "Default: {value} tokens",
  capacityDefaultCapped: "Default: {value} tokens (catalog max: {max} tokens)",
  capacityMissing: "API did not provide a value",
  modalityLabel: "Input modalities",
  modalityText: "Text",
  modalityImage: "Image",
  modalityAudio: "Audio",
  modalityVideo: "Video",
  modalityPdf: "PDF",
  modalityUnknown: "Not declared",
  modalitiesSource: "Input modalities come from the online /models configuration.",
  modalitiesForwarding: "This plugin converts and forwards image attachments only.",
  visibilityHint: "Model switches apply immediately. Save to apply capacity changes.",
  modelVisibleLabel: "Show {name} in conversations",
  configurationMissing: "Configuration missing",
  configurationMissingHint: "The gateway lists this model, but no usable OpenCode Go configuration is available. Once the upstream configuration is supplied or corrected, refresh the list to enable it.",
  configurationUnavailable: "Configuration unavailable",
  pickerFailed: "Could not update model visibility. Please retry.",
  deprecatedBadge: "Deprecated",
  deprecatedHint: "Marked deprecated by /models, but still provided by this gateway.",
  newHint: "Released within the last seven UTC calendar days, according to /models.",
  newBadge: "NEW",
  releaseSource: "Release date: {date} \xB7 /models",
  modelDetails: "Model configuration",
  filterLabel: "Filter models",
  filterAll: "All",
  filterNew: "New in 7 days",
  filterCustom: "Customized",
  filterDeprecated: "Deprecated",
  limitsResetModel: "Use catalog",
  limitsResetAll: "Clear all overrides",
  limitsNoMatches: "No models match \u201C{query}\u201D. Try a different name or id.",
  limitsEmpty: "Read the model list first; capacities are edited per model the gateway serves.",
  limitsContextLabel: "Context window for {name}",
  limitsOutputLabel: "Max output for {name}",
  advancedResetAll: "Reset parameter defaults",
  advancedLabel: "Advanced settings",
  groupUsage: "Usage settings",
  groupFree: "Free channel",
  freeEnabledLabel: "Enable the Free channel",
  freeEnabledHint: "Off by default. When enabled, the Free route reuses a saved account key; without a usable key it falls back to anonymous public access, and requests are sent with the official OpenCode CLI user agent. This may violate upstream terms or trigger rate limiting or risk controls.",
  settingsTabsLabel: "Settings sections",
  settingsTabOverview: "Overview",
  settingsTabModels: "Models",
  settingsTabAppearance: "Appearance",
  settingsTabAdvanced: "Advanced settings",
  usageAppearanceLabel: "Appearance",
  usageAppearanceReset: "Reset appearance",
  appearanceThemeLabel: "Interface theme",
  appearanceThemeHint: "DSH Native follows the Host and third-party themes through their public tokens. OpenCode Go Classic keeps the plugin\u2019s warm paper, terracotta and serif style.",
  appearanceThemePreviewHint: "Preview both themes below. Save to apply your choice to every OpenCode Go surface.",
  appearanceTheme_native: "DSH Native (default)",
  appearanceTheme_classic: "OpenCode Go Classic",
  showSidebarQuotaLabel: "Show quota in the sidebar",
  showSidebarQuotaSummary: "View account quotas in the sidebar, independently of the input indicator.",
  showSidebarQuotaHint: "Shows a quota card in the expanded sidebar and an icon when collapsed. Click the account name to cycle through account quotas without changing request order; the viewed account is remembered on this device. Refreshes every minute, independently of the input indicator.",
  usagePillStyleLabel: "Input quota style",
  usagePillStyleHint: "Choose a bordered badge or a plain, transparent quota indicator in the conversation input.",
  usagePillStylePreviewHint: "Sample usage is shown below. Save to apply your chosen style.",
  usagePillStyle_badge: "Badge (default)",
  usagePillStyle_plain: "Plain",
  groupConnection: "Connection",
  groupCacheTimeouts: "Cache and timeouts",
  groupImages: "Image handling",
  advancedHint: "The inherited values work as they are; below are only the settings you may need to change.",
  usageDisplayLabel: "Usage display",
  usageDisplayHint: "Auto shows the input indicator only for DSH OpenCode Go models; Always keeps it visible with any model; Off hides it and stops its polling. While visible it refreshes every minute. The sidebar has its own switch.",
  usageDisplay_auto: "Auto (default)",
  usageDisplay_always: "Always",
  usageDisplay_off: "Off",
  freeBaseURLLabel: "Free gateway URL",
  freeBaseURLHint: "Discovers platform chat models with explicitly zero text, cache and tier prices. Without a saved key, requests use public access.",
  baseURLLabel: "Go gateway URL",
  baseURLHint: "The official Go gateway selects each model\u2019s protocol endpoint automatically. Custom gateways use the configured prefix.",
  proxyURLLabel: "Proxy address",
  proxyURLHint: "The HTTP(S) or SOCKS5 proxy for conversations, catalog refreshes and usage queries; leave empty for the default network.",
  proxyURLInvalid: "Enter an http://, https:// or socks5:// proxy address without a path, query or fragment.",
  refreshMinutesLabel: "Catalog refresh (minutes)",
  refreshMinutesHint: "How long the model catalog is cached; opening this page or refreshing re-checks it immediately.",
  streamIdleTimeoutMsLabel: "Stream idle timeout (ms)",
  streamIdleTimeoutMsHint: "The longest silence between stream events; a longer gap fails the request.",
  requestPreparationTimeoutMsLabel: "Request preparation timeout (ms)",
  requestPreparationTimeoutMsHint: "Bounds route discovery and each attempt's credential and image preparation before dispatch.",
  requestTimeoutMsLabel: "Request timeout (ms)",
  requestTimeoutMsHint: "The whole dispatch deadline, including discovery, image preparation and account fallback.",
  maxImagesLabel: "Request image count cap (maxImages)",
  maxImagesHint: "Leave empty to inherit the base configuration (uncapped only when the base sets none); above the cap the oldest images become text placeholders.",
  maxRequestImageBytesLabel: "Request image payload cap (bytes)",
  maxRequestImageBytesHint: "The cap on the accumulated base64 image payload in one request.",
  requestImagePixelBudgetLabel: "Image pixel budget",
  requestImagePixelBudgetHint: "The total pixel budget of one image after conversion.",
  requestImageMaxBytesLabel: "Image byte target (bytes)",
  requestImageMaxBytesHint: "The original byte target of one image before base64 expansion.",
  overridden: "Customized",
  reset: "Reset to default",
  invalidValue: "Not a valid value",
  save: "Save",
  discard: "Discard",
  saving: "Saving\u2026",
  savedFailed: "The last save did not land as staged; correct the values or discard.",
  readOnly: "The settings document is read-only in this deployment.",
  settingsLoading: "Reading the OpenCode Go settings\u2026",
  unavailable: "The OpenCode Go settings are not served in this deployment."
};
var zh = {
  accountsTitle: "\u8D26\u53F7",
  accountsRefresh: "\u5237\u65B0\u989D\u5EA6",
  accountsBlocked: "\u8BF7\u7B49\u5F85\u5F53\u524D\u8BBE\u7F6E\u4FDD\u5B58\u5B8C\u6210\uFF0C\u518D\u5207\u6362\u6216\u4FEE\u6539\u8D26\u53F7\u3002",
  accountsEmpty: "\u6DFB\u52A0\u8D26\u53F7\u540E\u5373\u53EF\u4F7F\u7528 OpenCode Go\u3002",
  accountsWriteFailed: "\u8D26\u53F7\u4FEE\u6539\u672A\u751F\u6548\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  accountsReadFailed: "\u672A\u80FD\u8BFB\u53D6\u8D26\u53F7\u72B6\u6001\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002",
  accountsCleanupFailed: "\u8D26\u53F7\u6761\u76EE\u5DF2\u79FB\u9664\uFF0C\u4F46\u4FDD\u5B58\u7684 Key \u672A\u80FD\u5220\u9664\u3002\u8BF7\u901A\u8FC7\u5BBF\u4E3B\u51ED\u636E\u670D\u52A1\u5220\u9664\u672A\u4F7F\u7528\u7684\u5F15\u7528\u3002",
  accountsRemoveKeyFailed: "\u672A\u80FD\u5220\u9664\u5DF2\u4FDD\u5B58\u7684 Key\uFF0C\u8D26\u53F7\u6682\u65F6\u4FDD\u7559\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  accountsStatusUnknown: "\u72B6\u6001\u672A\u77E5",
  accountDefault: "\u9ED8\u8BA4\u8D26\u53F7",
  accountAdd: "\u6DFB\u52A0\u8D26\u53F7",
  accountRename: "\u91CD\u547D\u540D",
  accountReplaceKey: "\u66FF\u6362 Key",
  accountRemove: "\u5220\u9664\u8D26\u53F7",
  accountRemoveHint: "\u5220\u9664\u201C{name}\u201D\uFF1F\u82E5\u5B83\u662F\u5F53\u524D\u8D26\u53F7\uFF0C\u5C06\u4F7F\u7528\u4E0B\u4E00\u4E2A\u8D26\u53F7\u3002\u5728\u8FD9\u91CC\u6DFB\u52A0\u7684 Key \u4F1A\u4ECE\u51ED\u636E\u670D\u52A1\u5220\u9664\uFF1B\u5DF2\u6709\u5916\u90E8\u5F15\u7528\u4F1A\u4FDD\u7559\u3002",
  accountName: "\u8D26\u53F7\u540D\u79F0",
  accountKeyHint: "Key \u901A\u8FC7\u5BBF\u4E3B\u51ED\u636E\u670D\u52A1\u4FDD\u5B58\uFF0C\u9875\u9762\u4E0D\u4F1A\u56DE\u663E\u5DF2\u4FDD\u5B58\u7684\u5BC6\u94A5\u3002",
  accountConfirm: "\u786E\u8BA4",
  accountCancel: "\u53D6\u6D88",
  accountAutoSwitch: "\u81EA\u52A8\u4F7F\u7528\u5907\u7528\u8D26\u53F7",
  accountAutoSwitchHint: "\u989D\u5EA6\u8017\u5C3D\u6216 Key \u4E0D\u53EF\u7528\u65F6\uFF0C\u6309\u987A\u5E8F\u5C1D\u8BD5\u5176\u4ED6\u8D26\u53F7\uFF1B\u5F00\u59CB\u6B63\u5E38\u8F93\u51FA\u7684\u8D26\u53F7\u4F1A\u79FB\u81F3\u9996\u4F4D\u5E76\u6210\u4E3A\u5F53\u524D\u8D26\u53F7\u3002",
  accountPreferredTag: "\u5F53\u524D\u8D26\u53F7",
  accountSwitchAction: "\u5207\u6362",
  accountSwitchTitle: "\u5207\u6362\u8D26\u53F7",
  accountSwitchBack: "\u8FD4\u56DE\u989D\u5EA6",
  accountSwitchHint: "\u5207\u6362\u540E\uFF0C\u8BE5\u8D26\u53F7\u79FB\u81F3\u9996\u4F4D\uFF0C\u4F9B\u672C profile \u7684\u540E\u7EED\u8BF7\u6C42\u4F7F\u7528\uFF1B\u5176\u4ED6\u8D26\u53F7\u7684\u76F8\u5BF9\u987A\u5E8F\u4FDD\u6301\u4E0D\u53D8\u3002",
  accountSwitchFailed: "\u8D26\u53F7\u5207\u6362\u672A\u751F\u6548\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  sidebarNextAccount: "\u67E5\u770B\u4E0B\u4E00\u4E2A\u8D26\u53F7\u7684\u989D\u5EA6",
  sidebarAnalytics: "\u6253\u5F00\u7528\u91CF\u5386\u53F2",
  accountFallbackQuota: "\u5F53\u524D\u8D26\u53F7\u989D\u5EA6\u8017\u5C3D\uFF0C\u5DF2\u81EA\u52A8\u5207\u6362\u4E3A\uFF1A",
  accountFallbackCredential: "\u5F53\u524D Key \u4E0D\u53EF\u7528\u6216\u88AB\u62D2\u7EDD\uFF0C\u5DF2\u81EA\u52A8\u5207\u6362\u4E3A\uFF1A",
  accountsSummary: "{count} \u4E2A \xB7 \u5F53\u524D {name}",
  accountsSummaryEmpty: "\u5C1A\u672A\u6DFB\u52A0\u8D26\u53F7",
  accountsAvailability: "{ready}/{total} \u5DF2\u914D\u7F6E",
  accountsAvailabilityFailed: "{ready}/{total} \u5DF2\u914D\u7F6E \xB7 {failed} \u4E2A\u8BFB\u53D6\u5931\u8D25",
  accountsDetails: "{name} \u7684\u8BE6\u60C5",
  accountsDetailsHide: "\u6536\u8D77 {name} \u7684\u8BE6\u60C5",
  accountDragHandle: "\u62D6\u52A8 {name} \u8C03\u6574\u987A\u5E8F",
  accountConfigureHint: "\u914D\u7F6E Key \u540E\u663E\u793A\u989D\u5EA6",
  usageResetMinutes: "{minutes} \u5206\u949F\u540E\u91CD\u7F6E",
  usageResetHours: "{hours} \u5C0F\u65F6\u540E\u91CD\u7F6E",
  usageResetDays: "{days} \u5929\u540E\u91CD\u7F6E",
  usageResetDue: "\u5373\u5C06\u91CD\u7F6E",
  usageResetUnknown: "\u91CD\u7F6E\u65F6\u95F4\u672A\u77E5",
  usageTitle: "OpenCode Go \u989D\u5EA6",
  usageRollingShort: "5\u5C0F\u65F6",
  usageWeekShort: "\u5468",
  usage_rolling: "5 \u5C0F\u65F6",
  usage_weekly: "\u6BCF\u5468",
  usage_monthly: "\u6BCF\u6708",
  usageResets: "\u91CD\u7F6E\u4E8E",
  usageLimited: "\u5DF2\u8FBE\u9650\u989D",
  usageLoading: "\u6B63\u5728\u8BFB\u53D6\u7528\u91CF\u2026",
  usageUnavailable: "\u6682\u4E0D\u53EF\u7528",
  usageStaleShort: "\u4E0A\u6B21\u6570\u636E",
  usageFallbackShort: "\u5DF2\u56DE\u9000",
  usageStaleHint: "\u5F53\u524D\u663E\u793A\u4E0A\u6B21\u6210\u529F\u8BFB\u53D6\u7684\u7528\u91CF\uFF0C\u5B9E\u9645\u7528\u91CF\u53EF\u80FD\u5DF2\u53D8\u5316\u3002",
  usageRefreshFailed: "\u5237\u65B0\u5931\u8D25",
  usageLastUpdated: "\u66F4\u65B0\u4E8E",
  usageRetry: "\u7ACB\u5373\u91CD\u8BD5",
  usageRefresh: "\u5237\u65B0\u989D\u5EA6",
  usageRefreshing: "\u6B63\u5728\u5237\u65B0\u2026",
  analyticsOpen: "\u7528\u91CF\u5386\u53F2",
  analyticsTitle: "\u7528\u91CF\u5386\u53F2",
  analyticsSubtitle: "\u5305\u542B\u5DE5\u4F5C\u533A\u5185\u6240\u6709\u5BA2\u6237\u7AEF \xB7 \u6309 UTC \u65E5\u7EDF\u8BA1",
  analyticsClose: "\u5173\u95ED\u7528\u91CF\u5386\u53F2",
  analyticsRange: "\u65F6\u95F4\u8303\u56F4",
  analyticsRangeToday: "\u4ECA\u5929",
  analyticsRange7d: "7 \u5929",
  analyticsRange30d: "30 \u5929",
  analyticsRange90d: "90 \u5929",
  analyticsAccount: "\u67E5\u770B\u8D26\u53F7",
  analyticsNoAccounts: "\u6DFB\u52A0\u8D26\u53F7\u540E\u5373\u53EF\u67E5\u770B\u5DE5\u4F5C\u533A\u7684\u7528\u91CF\u5386\u53F2\u3002",
  analyticsRefresh: "\u5237\u65B0\u5386\u53F2",
  analyticsRetry: "\u91CD\u8BD5",
  analyticsLoading: "\u6B63\u5728\u8BFB\u53D6\u5B98\u65B9\u5DE5\u4F5C\u533A\u5386\u53F2\u2026",
  analyticsEmpty: "\u6240\u9009\u533A\u95F4\u6682\u65E0\u5DF2\u8BB0\u5F55\u7684\u7528\u91CF\u3002",
  analyticsFailed: "\u65E0\u6CD5\u8BFB\u53D6\u5DE5\u4F5C\u533A\u7528\u91CF\u5386\u53F2\u3002",
  analyticsRefreshed: "\u66F4\u65B0\u4E8E",
  analyticsRefreshing: "\u6B63\u5728\u5237\u65B0\u5B98\u65B9\u5386\u53F2\u2026",
  analyticsStale: "\u5237\u65B0\u5931\u8D25\uFF0C\u4EE5\u4E0B\u4E3A\u5F53\u524D\u8D26\u53F7\u4E0E\u533A\u95F4\u4E0A\u6B21\u6210\u529F\u8BFB\u53D6\u7684\u7ED3\u679C\u3002",
  analyticsRequests: "\u8BF7\u6C42\u6570",
  analyticsTokens: "Token",
  analyticsSpend: "\u7528\u91CF\u91D1\u989D",
  analyticsCacheHit: "\u7F13\u5B58\u547D\u4E2D\u7387",
  analyticsInput: "\u8F93\u5165",
  analyticsOutput: "\u8F93\u51FA",
  analyticsCacheRead: "\u7F13\u5B58\u8BFB",
  analyticsCacheWrite: "\u7F13\u5B58\u5199",
  analyticsDailyAverage: "\u65E5\u5747",
  analyticsModels: "\u4E2A\u6A21\u578B",
  analyticsActiveDays: "\u4E2A\u6D3B\u8DC3\u65E5",
  analyticsPerDay: "\u5929",
  analyticsByDay: "\u6BCF\u65E5\u6D3B\u52A8",
  analyticsTrendHint: "\u9009\u62E9\u4E00\u5929\uFF0C\u67E5\u770B\u5F53\u65E5\u7528\u91CF\u3002",
  analyticsTokensMode: "Token \u6784\u6210",
  analyticsRequestsMode: "\u8BF7\u6C42\u6570",
  analyticsChartHelp: "\u65B9\u5411\u952E\u5207\u6362\u65E5\u671F\uFF1B\u70B9\u51FB\u6216\u8F7B\u89E6\u56FA\u5B9A\u4E00\u5929\uFF0CEscape \u53D6\u6D88\u9009\u62E9\u3002",
  analyticsSelectDay: "\u60AC\u505C\u3001\u805A\u7126\u6216\u8F7B\u89E6\u67F1\u5F62\uFF0C\u67E5\u770B\u5F53\u65E5\u660E\u7EC6\u3002",
  analyticsByModel: "\u6A21\u578B\u7528\u91CF\u5206\u5E03",
  analyticsRankingHint: "\u6BD4\u8F83\u5DE5\u4F5C\u533A\u5185\u5404\u6A21\u578B\u7684\u6D88\u8017\u3002",
  analyticsDetails: "\u6A21\u578B\u660E\u7EC6",
  analyticsModel: "\u6A21\u578B",
  analyticsShare: "Token \u5360\u6BD4",
  analyticsAllModels: "\u5C55\u5F00\u5168\u90E8\u6A21\u578B",
  analyticsFewerModels: "\u6536\u8D77\u6A21\u578B",
  analyticsExport: "\u5BFC\u51FA CSV",
  analyticsExporting: "\u6B63\u5728\u5BFC\u51FA\u2026",
  analyticsExportFailed: "\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  analyticsPermission: "\u8BE5 Key \u65E0\u6CD5\u8BFB\u53D6\u5386\u53F2\uFF0C\u8BF7\u5728 OpenCode Console \u68C0\u67E5 Usage \u8BFB\u53D6\u6743\u9650\u3002",
  analyticsCredentials: "\u6240\u9009\u8D26\u53F7\u6CA1\u6709\u53EF\u7528 Key\uFF0C\u8BF7\u5728\u8D26\u53F7\u8BBE\u7F6E\u4E2D\u66F4\u65B0\u3002",
  analyticsUnsupported: "\u5386\u53F2\u67E5\u8BE2\u4EC5\u652F\u6301 OpenCode \u5B98\u65B9\u7F51\u5173\uFF0C\u5F53\u524D\u8D26\u53F7\u4F7F\u7528\u4E86\u5176\u4ED6\u7F51\u5173\u3002",
  analyticsPending: "OpenCode \u5C1A\u672A\u751F\u6210\u6BCF\u65E5\u6C47\u603B\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  analyticsInvalid: "OpenCode \u8FD4\u56DE\u7684\u5386\u53F2\u6570\u636E\u65E0\u6CD5\u89E3\u6790\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  analyticsQuota: "\u5F53\u524D\u989D\u5EA6",
  analyticsQuotaFailed: "\u989D\u5EA6\u6682\u4E0D\u53EF\u7528",
  analyticsAmountHint: "\u5B98\u65B9\u7528\u91CF\u91D1\u989D\u4E0D\u7B49\u540C\u8D26\u5355\u6216 Go \u5957\u9910\u5916\u7684\u5B9E\u9645\u6263\u6B3E\u3002",
  analyticsLagHint: "\u6BCF\u65E5\u6C47\u603B\u53EF\u80FD\u5EF6\u8FDF\uFF0C\u533F\u540D Free \u8C03\u7528\u53EF\u80FD\u4E0D\u5728\u5176\u4E2D\u3002",
  analyticsExportHint: "CSV \u5305\u542B Console \u63D0\u4F9B\u7684\u6210\u5458\u548C\u670D\u52A1\u8D26\u53F7\u5B57\u6BB5\u3002",
  analyticsKicker: "OpenCode Console",
  nav: "OpenCode Go",
  title: "OpenCode Go",
  titleLabel: "OpenCode Go",
  intro: "\u5206\u522B\u9009\u62E9\u4F1A\u8BDD\u4E2D\u663E\u793A\u7684 OpenCode Go \u4E0E\u5E73\u53F0\u514D\u8D39\u6A21\u578B\uFF0C\u5E76\u8C03\u6574\u5176\u5BB9\u91CF\u3002",
  starProject: "\u559C\u6B22\u8FD9\u4E2A\u63D2\u4EF6\uFF1F\u53BB GitHub \u70B9\u4E2A Star",
  starProjectTitle: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00 GitHub \u9879\u76EE",
  enabledLabel: "\u542F\u7528 OpenCode Go",
  enabledHint: "\u5F00\u542F\u540E\u4F1A\u5C06 OpenCode Go \u6A21\u578B\u52A0\u5165\u4F1A\u8BDD\u3002\u4E0B\u65B9\u300C\u514D\u8D39\u901A\u9053\u300D\u5355\u72EC\u5F00\u5173\uFF0C\u540C\u6837\u9700\u8981\u6B64\u5F00\u5173\u5F00\u542F\u3002",
  enabledOff: "OpenCode Go \u5DF2\u5173\u95ED\uFF1A\u5176\u6A21\u578B\u5DF2\u4ECE\u6240\u6709\u9009\u62E9\u5668\u64A4\u4E0B\u3002",
  enabledUnavailable: "\u6B64\u90E8\u7F72\u5728\u7EC4\u5408\u5C42\u56FA\u5B9A\u5F00\u542F\u4E86\u8BE5\u5F00\u5173\uFF0C\u65E0\u6CD5\u5728\u6B64\u4FEE\u6539\u3002",
  enabledFailed: "OpenCode Go \u5F00\u5173\u672A\u66F4\u65B0\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  keyLabel: "API key",
  keyHint: "\u6765\u81EA\u4F60\u7684 OpenCode Go \u8BA2\u9605\uFF08opencode.ai\uFF09\u3002\u7559\u7A7A\u8868\u793A\u4FDD\u6301\u5DF2\u4FDD\u5B58\u7684 key\uFF1B\u4FDD\u5B58\u540E\u4E0B\u4E00\u6B21\u8BF7\u6C42\u5373\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002",
  keyConfigured: "\u5DF2\u914D\u7F6E key",
  keyMissing: "\u5C1A\u672A\u914D\u7F6E",
  keyNotWritable: "\u8BE5 key \u7531\u8BBE\u7F6E\u6587\u6863\u4E4B\u5916\u7684\u6765\u6E90\u63D0\u4F9B\uFF08\u4F8B\u5982\u73AF\u5883\u53D8\u91CF\uFF09\uFF0C\u65E0\u6CD5\u5728\u6B64\u4FEE\u6539\u3002",
  modelsLabel: "\u53EF\u7528\u6A21\u578B",
  modelSourcesLabel: "\u6A21\u578B\u6765\u6E90",
  modelsGoTab: "OpenCode Go",
  modelsFreeTab: "\u514D\u8D39\u6A21\u578B",
  modelsGoSource: "Go \u6A21\u578B\u6E90",
  modelsFreeSource: "Free \u6A21\u578B\u6E90",
  modelsRefresh: "\u5237\u65B0",
  modelsLoading: "\u6B63\u5728\u8BFB\u53D6\u7F51\u5173\u6A21\u578B\u5217\u8868\u2026",
  modelsFailed: "\u672A\u80FD\u8BFB\u53D6\u7F51\u5173\u6A21\u578B\u5217\u8868\u3002",
  modelsStale: "\u90E8\u5206\u6A21\u578B\u6570\u636E\u5237\u65B0\u5931\u8D25\uFF0C\u6B63\u5728\u7EE7\u7EED\u4F7F\u7528\u53EF\u7528\u7684\u7F13\u5B58\u914D\u7F6E\uFF1B\u4F1A\u8BDD\u9009\u62E9\u5668\u4E5F\u4F7F\u7528\u8FD9\u4EFD\u6570\u636E\u3002",
  modelsSourceFailed: "\u5237\u65B0\u5931\u8D25",
  modelsSourceCurrent: "\u5DF2\u66F4\u65B0",
  modelsSourceNeverFetched: "\u5C1A\u672A\u6210\u529F\u83B7\u53D6",
  modelsSourceUpdated: "\u4E0A\u6B21\u6210\u529F\u68C0\u67E5\uFF1A{time}",
  modelsRefreshing: "\u6B63\u5728\u5237\u65B0\uFF0C\u6682\u65F6\u4FDD\u7559\u4E0A\u6B21\u83B7\u53D6\u7684\u6A21\u578B\u3002",
  modelsRefreshingShort: "\u66F4\u65B0\u4E2D\u2026",
  modelsEmpty: "\u7F51\u5173\u5F53\u524D\u6CA1\u6709\u672C\u9002\u914D\u5668\u53EF\u8DEF\u7531\u7684\u6A21\u578B\u3002",
  limitsLabel: "\u6A21\u578B\u5BB9\u91CF",
  limitsHint: "\u5BB9\u91CF\u6765\u81EA\u5728\u7EBF\u6A21\u578B\u914D\u7F6E\uFF1B\u7559\u7A7A\u7528\u9ED8\u8BA4\u503C\uFF0C\u4FDD\u5B58\u540E\u751F\u6548\u3002",
  limitsFilterLabel: "\u67E5\u627E\u6A21\u578B",
  limitsFilterPlaceholder: "\u6309\u6A21\u578B\u540D\u79F0\u6216 ID \u641C\u7D22\u2026",
  limitsSummary: "{count} \u4E2A\u5DF2\u81EA\u5B9A\u4E49",
  limitsModel: "\u6A21\u578B",
  limitsContext: "\u4E0A\u4E0B\u6587\u7A97\u53E3",
  limitsOutput: "\u6700\u5927\u8F93\u51FA",
  thinkingBudgets: "\u601D\u8003\u9884\u7B97",
  thinkingBudgetsHint: "\u6DFB\u52A0 token \u9884\u7B97\u5E76\u4FDD\u5B58\uFF0C\u5373\u53EF\u5728\u4F1A\u8BDD\u4E2D\u9009\u62E9\u3002\u8303\u56F4\uFF1A{min}\u2013{max} tokens\u3002\u4FDD\u7559\u539F\u6709\u601D\u8003\u9009\u9879\uFF1B\u201C\u9ED8\u8BA4\u201D\u4F7F\u7528\u670D\u52A1\u5546\u8BBE\u7F6E\u3002SDK \u4F1A\u6309\u5269\u4F59\u8F93\u51FA\u7A7A\u95F4\u7F29\u5C0F\u9884\u7B97\uFF0C\u4E3A\u56DE\u7B54\u7559\u51FA\u7A7A\u95F4\u3002",
  thinkingBudgetAddLabel: "\u4E3A {name} \u6DFB\u52A0\u601D\u8003\u9884\u7B97",
  thinkingBudgetAdd: "\u6DFB\u52A0",
  thinkingBudgetRemove: "\u79FB\u9664 {value} token \u9884\u7B97",
  capacityDefault: "\u9ED8\u8BA4\uFF1A{value} tokens",
  capacityDefaultCapped: "\u9ED8\u8BA4\uFF1A{value} tokens\uFF08\u6A21\u578B\u4E0A\u9650\uFF1A{max} tokens\uFF09",
  capacityMissing: "API \u672A\u63D0\u4F9B",
  modalityLabel: "\u8F93\u5165\u6A21\u6001",
  modalityText: "\u6587\u672C",
  modalityImage: "\u56FE\u50CF",
  modalityAudio: "\u97F3\u9891",
  modalityVideo: "\u89C6\u9891",
  modalityPdf: "PDF",
  modalityUnknown: "\u672A\u58F0\u660E",
  modalitiesSource: "\u8F93\u5165\u6A21\u6001\u6765\u81EA /models \u7684\u5728\u7EBF\u914D\u7F6E\u3002",
  modalitiesForwarding: "\u672C\u63D2\u4EF6\u76EE\u524D\u4EC5\u8F6C\u6362\u5E76\u8F6C\u53D1\u56FE\u50CF\u9644\u4EF6\u3002",
  visibilityHint: "\u6A21\u578B\u5F00\u5173\u7ACB\u5373\u751F\u6548\uFF0C\u5BB9\u91CF\u8C03\u6574\u540E\u4FDD\u5B58\u3002",
  modelVisibleLabel: "\u5728\u4F1A\u8BDD\u4E2D\u663E\u793A {name}",
  configurationMissing: "\u914D\u7F6E\u7F3A\u5931",
  configurationMissingHint: "\u7F51\u5173\u5DF2\u5217\u51FA\u6B64\u6A21\u578B\uFF0C\u4F46\u6682\u672A\u83B7\u5F97\u53EF\u7528\u7684 OpenCode Go \u914D\u7F6E\u3002\u4E0A\u6E38\u8865\u9F50\u6216\u4FEE\u6B63\u914D\u7F6E\u540E\uFF0C\u5237\u65B0\u5217\u8868\u5373\u53EF\u5F00\u542F\u3002",
  configurationUnavailable: "\u914D\u7F6E\u6682\u4E0D\u53EF\u7528",
  pickerFailed: "\u6A21\u578B\u663E\u793A\u8BBE\u7F6E\u672A\u66F4\u65B0\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  deprecatedBadge: "\u5DF2\u5F03\u7528",
  deprecatedHint: "/models \u6807\u8BB0\u4E3A\u5DF2\u5F03\u7528\uFF0C\u5F53\u524D\u7F51\u5173\u4ECD\u63D0\u4F9B\u6B64\u6A21\u578B\u3002",
  newHint: "\u4F9D\u636E /models \u53D1\u5E03\u65E5\u671F\uFF0C\u8FD1\u4E03\u4E2A UTC \u65E5\u5386\u65E5\u5185\u53D1\u5E03\u3002",
  newBadge: "\u65B0",
  releaseSource: "\u53D1\u5E03\u65E5\u671F\uFF1A{date} \xB7 /models",
  modelDetails: "\u6A21\u578B\u914D\u7F6E",
  filterLabel: "\u7B5B\u9009\u6A21\u578B",
  filterAll: "\u5168\u90E8",
  filterNew: "\u8FD1 7 \u5929\u53D1\u5E03",
  filterCustom: "\u5DF2\u81EA\u5B9A\u4E49",
  filterDeprecated: "\u8FC7\u65F6\u6A21\u578B",
  limitsResetModel: "\u4F7F\u7528\u76EE\u5F55\u503C",
  limitsResetAll: "\u6E05\u9664\u5168\u90E8\u8986\u76D6",
  limitsNoMatches: "\u6CA1\u6709\u5339\u914D\u201C{query}\u201D\u7684\u6A21\u578B\u3002\u8BF7\u5C1D\u8BD5\u5176\u4ED6\u540D\u79F0\u6216 ID\u3002",
  limitsEmpty: "\u8BF7\u5148\u8BFB\u53D6\u6A21\u578B\u5217\u8868\uFF1B\u5BB9\u91CF\u6309\u7F51\u5173\u63D0\u4F9B\u7684\u6A21\u578B\u9010\u4E2A\u7F16\u8F91\u3002",
  limitsContextLabel: "{name} \u7684\u4E0A\u4E0B\u6587\u7A97\u53E3",
  limitsOutputLabel: "{name} \u7684\u6700\u5927\u8F93\u51FA",
  advancedResetAll: "\u6062\u590D\u53C2\u6570\u9ED8\u8BA4\u503C",
  advancedLabel: "\u9AD8\u7EA7\u8BBE\u7F6E",
  groupUsage: "\u7528\u91CF\u8BBE\u7F6E",
  groupFree: "\u514D\u8D39\u901A\u9053",
  freeEnabledLabel: "\u542F\u7528\u514D\u8D39\u901A\u9053",
  freeEnabledHint: "\u9ED8\u8BA4\u5173\u95ED\u3002\u5F00\u542F\u540E\uFF0CFree \u8DEF\u7531\u590D\u7528\u5DF2\u4FDD\u5B58\u7684\u8D26\u53F7 Key\uFF1B\u6CA1\u6709\u53EF\u7528 Key \u65F6\u9000\u56DE\u533F\u540D\u516C\u5171\u8BBF\u95EE\uFF0C\u4E14\u8BF7\u6C42\u4EE5\u5B98\u65B9 OpenCode CLI \u7684 User-Agent \u53D1\u51FA\u3002\u8FD9\u53EF\u80FD\u8FDD\u53CD\u4E0A\u6E38\u6761\u6B3E\u6216\u89E6\u53D1\u9650\u6D41/\u98CE\u63A7\u3002",
  settingsTabsLabel: "\u8BBE\u7F6E\u5206\u533A",
  settingsTabOverview: "\u6982\u89C8",
  settingsTabModels: "\u6A21\u578B",
  settingsTabAppearance: "\u5916\u89C2",
  settingsTabAdvanced: "\u9AD8\u7EA7\u8BBE\u7F6E",
  usageAppearanceLabel: "\u5916\u89C2",
  usageAppearanceReset: "\u6062\u590D\u9ED8\u8BA4\u5916\u89C2",
  appearanceThemeLabel: "\u754C\u9762\u4E3B\u9898",
  appearanceThemeHint: "DSH Native \u901A\u8FC7\u516C\u5F00 token \u8DDF\u968F\u5BBF\u4E3B\u548C\u7B2C\u4E09\u65B9\u4E3B\u9898\uFF1BOpenCode Go Classic \u4FDD\u7559\u63D2\u4EF6\u81EA\u5DF1\u7684\u6696\u7EB8\u8272\u3001\u9676\u571F\u8272\u548C\u886C\u7EBF\u98CE\u683C\u3002",
  appearanceThemePreviewHint: "\u4E0B\u65B9\u53EF\u9884\u89C8\u4E24\u79CD\u4E3B\u9898\uFF0C\u4FDD\u5B58\u540E\u5C06\u9009\u62E9\u5E94\u7528\u5230\u6240\u6709 OpenCode Go \u754C\u9762\u3002",
  appearanceTheme_native: "DSH Native\uFF08\u9ED8\u8BA4\uFF09",
  appearanceTheme_classic: "OpenCode Go Classic",
  showSidebarQuotaLabel: "\u5728\u4FA7\u8FB9\u680F\u663E\u793A\u989D\u5EA6",
  showSidebarQuotaSummary: "\u5728\u4FA7\u8FB9\u680F\u67E5\u770B\u5404\u8D26\u53F7\u989D\u5EA6\uFF0C\u72EC\u7ACB\u4E8E\u8F93\u5165\u680F\u663E\u793A\u3002",
  showSidebarQuotaHint: "\u4FA7\u8FB9\u680F\u5C55\u5F00\u65F6\u663E\u793A\u989D\u5EA6\u5361\u7247\uFF0C\u6536\u8D77\u65F6\u663E\u793A\u56FE\u6807\u3002\u70B9\u51FB\u8D26\u53F7\u540D\u5FAA\u73AF\u67E5\u770B\u5404\u8D26\u53F7\u989D\u5EA6\uFF0C\u4E0D\u6539\u53D8\u8BF7\u6C42\u987A\u5E8F\uFF0C\u5E76\u5728\u672C\u673A\u8BB0\u4F4F\u67E5\u770B\u5BF9\u8C61\u3002\u5F00\u542F\u540E\u6BCF\u5206\u949F\u5237\u65B0\uFF0C\u72EC\u7ACB\u4E8E\u8F93\u5165\u680F\u989D\u5EA6\u663E\u793A\u3002",
  usagePillStyleLabel: "\u8F93\u5165\u680F\u989D\u5EA6\u6837\u5F0F",
  usagePillStyleHint: "\u9009\u62E9\u5E26\u8FB9\u6846\u7684\u5FBD\u7AE0\uFF0C\u6216\u65E0\u8FB9\u6846\u900F\u660E\u7684\u7CBE\u7B80\u989D\u5EA6\u6837\u5F0F\u3002",
  usagePillStylePreviewHint: "\u4E0B\u65B9\u4E3A\u793A\u4F8B\u989D\u5EA6\uFF0C\u4FDD\u5B58\u540E\u5E94\u7528\u6240\u9009\u6837\u5F0F\u3002",
  usagePillStyle_badge: "\u5FBD\u7AE0\uFF08\u9ED8\u8BA4\uFF09",
  usagePillStyle_plain: "\u7CBE\u7B80",
  groupConnection: "\u8FDE\u63A5",
  groupCacheTimeouts: "\u7F13\u5B58\u4E0E\u8D85\u65F6",
  groupImages: "\u56FE\u7247\u5904\u7406",
  advancedHint: "\u7EE7\u627F\u6765\u7684\u53D6\u503C\u5373\u53EF\u6B63\u5E38\u4F7F\u7528\uFF1B\u4E0B\u9762\u53EA\u5217\u9700\u8981\u6539\u7684\u9879\u3002",
  usageDisplayLabel: "\u989D\u5EA6\u663E\u793A",
  usageDisplayHint: "\u81EA\u52A8\uFF1A\u4EC5\u9009\u4E2D DSH OpenCode Go \u6A21\u578B\u65F6\u663E\u793A\u8F93\u5165\u680F\u989D\u5EA6\uFF1B\u5E38\u9A7B\uFF1A\u4EFB\u610F\u6A21\u578B\u90FD\u663E\u793A\uFF1B\u5173\u95ED\uFF1A\u9690\u85CF\u8F93\u5165\u680F\u989D\u5EA6\u5E76\u505C\u6B62\u5176\u5237\u65B0\u3002\u663E\u793A\u65F6\u6BCF\u5206\u949F\u5237\u65B0\u3002\u4FA7\u8FB9\u680F\u989D\u5EA6\u4F7F\u7528\u72EC\u7ACB\u5F00\u5173\u3002",
  usageDisplay_auto: "\u81EA\u52A8\uFF08\u9ED8\u8BA4\uFF09",
  usageDisplay_always: "\u5E38\u9A7B",
  usageDisplay_off: "\u5173\u95ED",
  freeBaseURLLabel: "\u514D\u8D39\u7F51\u5173\u5730\u5740",
  freeBaseURLHint: "\u53D1\u73B0\u5DF2\u660E\u786E\u58F0\u660E\u6587\u672C\u3001\u7F13\u5B58\u53CA\u9636\u68AF\u4EF7\u683C\u5168\u4E3A\u96F6\u7684\u5E73\u53F0\u804A\u5929\u6A21\u578B\u3002\u672A\u914D\u7F6E\u53EF\u7528 Key \u65F6\u4F7F\u7528\u516C\u5171\u8BBF\u95EE\u3002",
  baseURLLabel: "Go \u7F51\u5173\u5730\u5740",
  baseURLHint: "\u5B98\u65B9 Go \u7F51\u5173\u81EA\u52A8\u9009\u62E9\u6A21\u578B\u5BF9\u5E94\u7684\u534F\u8BAE\u7AEF\u70B9\uFF1B\u81EA\u5B9A\u4E49\u7F51\u5173\u4F7F\u7528\u586B\u5199\u7684\u8BF7\u6C42\u524D\u7F00\u3002",
  proxyURLLabel: "\u4EE3\u7406\u5730\u5740",
  proxyURLHint: "\u5BF9\u8BDD\u3001\u76EE\u5F55\u5237\u65B0\u4E0E\u7528\u91CF\u67E5\u8BE2\u4F7F\u7528\u7684 HTTP(S)/SOCKS5 \u4EE3\u7406\uFF1B\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\u7F51\u7EDC\u3002",
  proxyURLInvalid: "\u8BF7\u8F93\u5165 http://\u3001https:// \u6216 socks5:// \u4EE3\u7406\u5730\u5740\uFF0C\u4E0D\u5305\u542B\u8DEF\u5F84\u3001\u67E5\u8BE2\u53C2\u6570\u6216\u7247\u6BB5\u3002",
  refreshMinutesLabel: "\u76EE\u5F55\u5237\u65B0\uFF08\u5206\u949F\uFF09",
  refreshMinutesHint: "\u6A21\u578B\u76EE\u5F55\u7684\u7F13\u5B58\u65F6\u957F\uFF1B\u6253\u5F00\u672C\u9875\u6216\u70B9\u51FB\u5237\u65B0\u4F1A\u7ACB\u5373\u91CD\u65B0\u6838\u5BF9\u3002",
  streamIdleTimeoutMsLabel: "\u6D41\u7A7A\u95F2\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  streamIdleTimeoutMsHint: "\u6D41\u4E8B\u4EF6\u4E4B\u95F4\u7684\u6700\u5927\u9759\u9ED8\u95F4\u9694\uFF0C\u8D85\u51FA\u5219\u8BF7\u6C42\u5931\u8D25\u3002",
  requestPreparationTimeoutMsLabel: "\u8BF7\u6C42\u51C6\u5907\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  requestPreparationTimeoutMsHint: "\u9650\u5236\u8DEF\u7531\u53D1\u73B0\u4EE5\u53CA\u6BCF\u6B21\u5C1D\u8BD5\u5728\u6D3E\u53D1\u524D\u7684\u51ED\u636E\u4E0E\u56FE\u7247\u51C6\u5907\u65F6\u95F4\u3002",
  requestTimeoutMsLabel: "\u8BF7\u6C42\u603B\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  requestTimeoutMsHint: "\u6574\u4E2A\u6D3E\u53D1\u671F\u9650\uFF0C\u5305\u62EC\u8DEF\u7531\u53D1\u73B0\u3001\u56FE\u7247\u51C6\u5907\u4E0E\u8D26\u53F7\u56DE\u9000\u3002",
  maxImagesLabel: "\u8BF7\u6C42\u56FE\u7247\u6570\u91CF\u4E0A\u9650\uFF08maxImages\uFF09",
  maxImagesHint: "\u7559\u7A7A\u7EE7\u627F\u57FA\u7840\u914D\u7F6E\uFF08\u57FA\u7840\u672A\u8BBE\u4E0A\u9650\u65F6\u624D\u4E0D\u9650\u5236\u5F20\u6570\uFF09\uFF1B\u8D85\u9650\u65F6\u6700\u65E7\u7684\u56FE\u7247\u4F1A\u88AB\u66FF\u6362\u4E3A\u6587\u5B57\u5360\u4F4D\u3002",
  maxRequestImageBytesLabel: "\u8BF7\u6C42\u56FE\u7247\u8F7D\u8377\u4E0A\u9650\uFF08\u5B57\u8282\uFF09",
  maxRequestImageBytesHint: "\u5355\u4E2A\u8BF7\u6C42\u7D2F\u8BA1 base64 \u56FE\u7247\u8F7D\u8377\u7684\u4E0A\u9650\u3002",
  requestImagePixelBudgetLabel: "\u56FE\u7247\u50CF\u7D20\u9884\u7B97",
  requestImagePixelBudgetHint: "\u5355\u5F20\u56FE\u7247\u8F6C\u6362\u540E\u7684\u603B\u50CF\u7D20\u9884\u7B97\u3002",
  requestImageMaxBytesLabel: "\u56FE\u7247\u5B57\u8282\u76EE\u6807\uFF08\u5B57\u8282\uFF09",
  requestImageMaxBytesHint: "\u5355\u5F20\u56FE\u7247 base64 \u6269\u5C55\u524D\u7684\u539F\u59CB\u7F16\u7801\u5B57\u8282\u76EE\u6807\u3002",
  overridden: "\u5DF2\u81EA\u5B9A\u4E49",
  reset: "\u6062\u590D\u9ED8\u8BA4",
  invalidValue: "\u4E0D\u662F\u6709\u6548\u503C",
  save: "\u4FDD\u5B58",
  discard: "\u653E\u5F03",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  savedFailed: "\u4E0A\u6B21\u4FDD\u5B58\u672A\u6309\u8349\u7A3F\u751F\u6548\uFF1B\u8BF7\u4FEE\u6B63\u6570\u503C\u6216\u653E\u5F03\u4FEE\u6539\u3002",
  readOnly: "\u6B64\u90E8\u7F72\u4E2D\u8BBE\u7F6E\u6587\u6863\u4E3A\u53EA\u8BFB\u3002",
  settingsLoading: "\u6B63\u5728\u8BFB\u53D6 OpenCode Go \u8BBE\u7F6E\u2026",
  unavailable: "\u6B64\u90E8\u7F72\u672A\u63D0\u4F9B OpenCode Go \u8BBE\u7F6E\u3002"
};
var CLASSIC_FONT = '"Anthropic Sans Web", "Anthropic Sans", "Styrene B", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
var CLASSIC_DISPLAY_FONT = '"Anthropic Serif Web", "Anthropic Serif", "Tiempos Text", Charter, "Songti SC", "Noto Serif SC", SimSun, Georgia, serif';
var CLASSIC_NUMBER_FONT = '"Anthropic Mono Web", "Anthropic Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';
var NATIVE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
var NATIVE_NUMBER_FONT = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
var GO_THEME_FALLBACKS = {
  dark: {
    bg: "#242422",
    surface: "#2d2c29",
    surface2: "#353430",
    border: "#49473f",
    borderStrong: "#8a877d",
    text: "#eceae3",
    muted: "#b7b4a8",
    accent: "#e7a18a",
    accent2: "#b09a87",
    accentSoft: "#49342b",
    onAccent: "#382017",
    cacheRead: "#8f8678",
    cacheWrite: "#a5aa8c",
    shadow: "0 18px 48px #00000040",
    success: "#9bc6a7",
    warning: "#d6b274",
    danger: "#e6a09c",
    font: CLASSIC_FONT,
    displayFont: CLASSIC_DISPLAY_FONT,
    numberFont: CLASSIC_NUMBER_FONT,
    radiusSmall: "4px",
    radiusControl: "8px",
    radiusPill: "99px",
    radiusOption: "6px",
    radiusCard: "10px",
    radiusPopover: "12px",
    radiusModal: "14px",
    focusWidth: "2px",
    displayWeight: "400",
    displayTracking: "-.025em"
  },
  light: {
    bg: "#faf9f5",
    surface: "#fffefb",
    surface2: "#f0eee7",
    border: "#dedbd2",
    borderStrong: "#736f66",
    text: "#30312e",
    muted: "#6b6a61",
    accent: "#a94e35",
    accent2: "#8a735f",
    accentSoft: "#f5e7df",
    onAccent: "#ffffff",
    cacheRead: "#8a7a66",
    cacheWrite: "#858c6b",
    shadow: "0 18px 48px #28261b18",
    success: "#38654c",
    warning: "#8c6526",
    danger: "#a83e42",
    font: CLASSIC_FONT,
    displayFont: CLASSIC_DISPLAY_FONT,
    numberFont: CLASSIC_NUMBER_FONT,
    radiusSmall: "4px",
    radiusControl: "8px",
    radiusPill: "99px",
    radiusOption: "6px",
    radiusCard: "10px",
    radiusPopover: "12px",
    radiusModal: "14px",
    focusWidth: "2px",
    displayWeight: "400",
    displayTracking: "-.025em"
  }
};
var NATIVE_THEME_FALLBACKS = {
  dark: {
    bg: "#0f0f0f",
    surface: "#212123",
    surface2: "#292929",
    border: "#3c3c3d",
    borderStrong: "#a2a4a6",
    text: "#f5f5f5",
    muted: "#a2a4a6",
    accent: "#7aaaff",
    accent2: "#4ed17e",
    accentSoft: "#1c2b45",
    onAccent: "#0f0f0f",
    cacheRead: "#a2a4a6",
    cacheWrite: "#f7ad31",
    shadow: "0 18px 48px #00000066",
    success: "#4ed17e",
    warning: "#f7ad31",
    danger: "#f87171",
    font: NATIVE_FONT,
    displayFont: NATIVE_FONT,
    numberFont: NATIVE_NUMBER_FONT,
    radiusSmall: "4px",
    radiusControl: "8px",
    radiusPill: "8px",
    radiusOption: "8px",
    radiusCard: "12px",
    radiusPopover: "12px",
    radiusModal: "16px",
    focusWidth: "2px",
    displayWeight: "600",
    displayTracking: "normal"
  },
  light: {
    bg: "#fafafa",
    surface: "#ffffff",
    surface2: "#f5f5f5",
    border: "#e5e5e5",
    borderStrong: "#7f8287",
    text: "#292929",
    muted: "#65676b",
    accent: "#4176e6",
    accent2: "#2f7d4f",
    accentSoft: "#edf3fe",
    onAccent: "#ffffff",
    cacheRead: "#65676b",
    cacheWrite: "#9a5b07",
    shadow: "0 18px 48px #00000026",
    success: "#2f7d4f",
    warning: "#9a5b07",
    danger: "#b4232d",
    font: NATIVE_FONT,
    displayFont: NATIVE_FONT,
    numberFont: NATIVE_NUMBER_FONT,
    radiusSmall: "4px",
    radiusControl: "8px",
    radiusPill: "8px",
    radiusOption: "8px",
    radiusCard: "12px",
    radiusPopover: "12px",
    radiusModal: "16px",
    focusWidth: "2px",
    displayWeight: "600",
    displayTracking: "normal"
  }
};
function nativeTheme(scheme) {
  const fallback = NATIVE_THEME_FALLBACKS[scheme];
  return {
    bg: `var(--dsw-alias-bg-base, ${fallback.bg})`,
    surface: `var(--dsw-alias-bg-layer-1, ${fallback.surface})`,
    surface2: `var(--dsw-alias-bg-layer-2, ${fallback.surface2})`,
    border: `var(--dsw-alias-border-l1, ${fallback.border})`,
    // Contrast-checked tokens stay Host-independent on purpose: Host's
    // border-l2 is a hairline divider and its state-* colors are status dots,
    // not data-viz series, so following them drops text inputs and chart bars
    // below the WCAG 1.4.11 3:1 contract this file and docs/development.md
    // promise. They are the only color tokens Native does not take from Host.
    borderStrong: fallback.borderStrong,
    text: `var(--dsw-alias-label-primary, ${fallback.text})`,
    muted: `var(--dsw-alias-label-secondary, ${fallback.muted})`,
    accent: `var(--dsw-alias-brand-primary, ${fallback.accent})`,
    accent2: fallback.accent2,
    accentSoft: `color-mix(in srgb, var(--dsw-alias-brand-primary, ${fallback.accent}) 16%, var(--dsw-alias-bg-base, ${fallback.bg}))`,
    onAccent: `var(--dsw-alias-bg-base, ${fallback.onAccent})`,
    cacheRead: fallback.cacheRead,
    cacheWrite: fallback.cacheWrite,
    shadow: `var(--dsw-elevation-prominent, ${fallback.shadow})`,
    success: `var(--dsw-alias-state-success-primary, ${fallback.success})`,
    warning: `var(--dsw-alias-state-warn-primary, ${fallback.warning})`,
    danger: `var(--dsw-alias-state-error-primary, ${fallback.danger})`,
    font: `var(--dsw-font-family, var(--dsh-font-family-text, ${fallback.font}))`,
    displayFont: `var(--dsw-font-family, var(--dsh-font-family-text, ${fallback.displayFont}))`,
    numberFont: `var(--ds-font-family-code, var(--dsh-font-family-code, ${fallback.numberFont}))`,
    radiusSmall: `var(--dsw-radius-xs, ${fallback.radiusSmall})`,
    radiusControl: `var(--dsw-radius-sm, ${fallback.radiusControl})`,
    radiusPill: `var(--dsw-radius-sm, ${fallback.radiusPill})`,
    radiusOption: `var(--dsw-radius-sm, ${fallback.radiusOption})`,
    radiusCard: `var(--dsw-radius-md, ${fallback.radiusCard})`,
    radiusPopover: `var(--dsw-radius-md, ${fallback.radiusPopover})`,
    radiusModal: `var(--dsw-radius-lg, ${fallback.radiusModal})`,
    focusWidth: `var(--dsw-focus-ring-width, ${fallback.focusWidth})`,
    displayWeight: fallback.displayWeight,
    displayTracking: fallback.displayTracking
  };
}
var GO_THEME_TOKENS = {
  native: { dark: nativeTheme("dark"), light: nativeTheme("light") },
  classic: { dark: GO_THEME_FALLBACKS.dark, light: GO_THEME_FALLBACKS.light }
};
function useHostScheme() {
  const [scheme, setScheme] = (0, import_react.useState)(() => typeof document === "undefined" || document.body?.hasAttribute("data-ds-dark-theme") ? "dark" : "light");
  (0, import_react.useEffect)(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (body === null) return;
    const update = () => {
      setScheme(body.hasAttribute("data-ds-dark-theme") ? "dark" : "light");
    };
    update();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(update);
    observer.observe(body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    return () => {
      observer.disconnect();
    };
  }, []);
  return scheme;
}
function useGoThemeTokens(theme = DEFAULT_OPENCODE_GO_THEME) {
  return GO_THEME_TOKENS[theme][useHostScheme()];
}
function themeStyle(tokens) {
  return {
    "--go-bg": tokens.bg,
    "--go-surface": tokens.surface,
    "--go-surface-2": tokens.surface2,
    "--go-border": tokens.border,
    "--go-border-strong": tokens.borderStrong,
    "--go-text": tokens.text,
    "--go-muted": tokens.muted,
    "--go-accent": tokens.accent,
    "--go-accent-2": tokens.accent2,
    "--go-accent-soft": tokens.accentSoft,
    "--go-on-accent": tokens.onAccent,
    "--go-cache-read": tokens.cacheRead,
    "--go-cache-write": tokens.cacheWrite,
    "--go-shadow": tokens.shadow,
    "--go-success": tokens.success,
    "--go-warning": tokens.warning,
    "--go-danger": tokens.danger,
    "--go-font": tokens.font,
    "--go-display-font": tokens.displayFont,
    "--go-number-font": tokens.numberFont,
    "--go-radius-small": tokens.radiusSmall,
    "--go-radius-control": tokens.radiusControl,
    "--go-radius-pill": tokens.radiusPill,
    "--go-radius-option": tokens.radiusOption,
    "--go-radius-card": tokens.radiusCard,
    "--go-radius-popover": tokens.radiusPopover,
    "--go-radius-modal": tokens.radiusModal,
    "--go-focus-width": tokens.focusWidth,
    "--go-display-weight": tokens.displayWeight,
    "--go-display-tracking": tokens.displayTracking
  };
}

// src/client/Section.tsx
var import_react2 = require("react");

// src/client/controller.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");

// node_modules/@deepseek-ai/dsh-timeout/lib/index.js
var MAX_TIMER_DELAY_MS = 2147483647;

// src/client/controller.ts
var OPENCODE_GO_NS = SETTINGS_NAMESPACE;
var TEXT_FIELDS = [
  "usageDisplay",
  "usagePillStyle",
  "appearanceTheme",
  "showSidebarQuota",
  "freeEnabled",
  "baseURL",
  "freeBaseURL",
  "proxyURL",
  "refreshMinutes",
  "streamIdleTimeoutMs",
  "requestPreparationTimeoutMs",
  "requestTimeoutMs",
  "maxImages",
  "maxRequestImageBytes",
  "requestImagePixelBudget",
  "requestImageMaxBytes"
];
var editableKeys = [...TEXT_FIELDS, "modelLimits"];
var NUMERIC_FIELD_LIMITS = {
  refreshMinutes: { integer: true, min: 1, max: 7 * 24 * 60 },
  streamIdleTimeoutMs: { integer: false, min: Number.MIN_VALUE, max: MAX_TIMER_DELAY_MS },
  requestPreparationTimeoutMs: { integer: true, min: 1, max: MAX_TIMER_DELAY_MS },
  requestTimeoutMs: { integer: true, min: 1, max: MAX_TIMER_DELAY_MS },
  maxImages: { integer: true, min: 1, max: Number.MAX_SAFE_INTEGER },
  maxRequestImageBytes: { integer: true, min: 1 },
  requestImagePixelBudget: { integer: true, min: 1 },
  requestImageMaxBytes: { integer: true, min: 1 }
};
function formatField(field, value) {
  if (field === "usageDisplay") return typeof value === "string" ? value : DEFAULT_USAGE_DISPLAY;
  if (field === "usagePillStyle") return typeof value === "string" ? value : DEFAULT_USAGE_PILL_STYLE;
  if (field === "appearanceTheme") return typeof value === "string" ? value : DEFAULT_OPENCODE_GO_THEME;
  if (field === "showSidebarQuota" || field === "freeEnabled") return String(value === true);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function parseField(field, text2) {
  if (field === "usageDisplay") return USAGE_DISPLAY_MODES.some((mode) => mode === text2) ? { kind: "set", value: text2 } : void 0;
  if (field === "usagePillStyle") return USAGE_PILL_STYLES.some((style) => style === text2) ? { kind: "set", value: text2 } : void 0;
  if (field === "appearanceTheme") return OPENCODE_GO_THEMES.some((theme) => theme === text2) ? { kind: "set", value: text2 } : void 0;
  if (field === "showSidebarQuota" || field === "freeEnabled") return text2 === "true" || text2 === "false" ? { kind: "set", value: text2 === "true" } : void 0;
  const trimmed = text2.trim();
  if (field === "proxyURL") {
    try {
      assertProxyURL(trimmed);
      return { kind: "set", value: trimmed };
    } catch {
      return void 0;
    }
  }
  if (!trimmed) return { kind: "clear" };
  if (field === "baseURL" || field === "freeBaseURL") {
    try {
      const url = new URL(trimmed);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash ? { kind: "set", value: trimmed } : void 0;
    } catch {
      return void 0;
    }
  }
  const limit = NUMERIC_FIELD_LIMITS[field];
  if (limit === void 0) return void 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || limit.integer && !Number.isSafeInteger(value) || value < limit.min || limit.max !== void 0 && value > limit.max) return void 0;
  return { kind: "set", value };
}
function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  const l = left, r = right;
  const keys = Object.keys(l);
  return keys.length === Object.keys(r).length && keys.every((key) => Object.hasOwn(r, key) && sameValue(l[key], r[key]));
}
function modelsForSource(models, source) {
  if (models.status !== "ready") return models;
  const entries = models.entries.filter((model) => (model.source ?? "go") === source);
  const status = models.sources?.[source];
  return {
    ...models,
    entries,
    count: entries.length,
    preview: entries.map((model) => model.name ?? model.id),
    ...status === void 0 ? {} : { stale: status.error !== void 0, message: status.error }
  };
}
function operationId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
var OpencodeGoSectionController = class {
  constructor(scope, ctx, readModels = async () => {
    return ctx.remote.opencodeGoModels.read();
  }, readUsage = async (ref) => {
    const result = await ctx.remote.opencodeGoUsage.readAccount(ref);
    if (!result.ok) throw result.error;
    return result.value;
  }, executeAccountCommand = async (command) => {
    const result = await ctx.remote.opencodeGoAccounts.execute(command);
    return result.ok ? result.value : "unknown";
  }) {
    this.scope = scope;
    this.ctx = ctx;
    this.readModels = readModels;
    this.readUsage = readUsage;
    this.executeAccountCommand = executeAccountCommand;
    this.syncAccounts();
    this.store = (0, import_dsh_client_store.createSnapshotStore)(this.projection());
    const endpoint = () => [scope.getSnapshot().value?.baseURL, scope.getSnapshot().value?.freeBaseURL, scope.getSnapshot().value?.proxyURL];
    let network = endpoint();
    this.unsubscribe = scope.subscribe(() => {
      this.syncAccounts();
      const next = endpoint();
      if (!sameValue(network, next)) {
        network = next;
        this.modelsRequest++;
        this.models = { status: "idle" };
      }
      this.publish();
    });
  }
  drafts = /* @__PURE__ */ new Map();
  store;
  unsubscribe;
  saving = false;
  failed = false;
  pickerSaving = false;
  pickerFailed = false;
  enabledFailed = false;
  models = { status: "idle" };
  modelsRequest = 0;
  face;
  accountRows = /* @__PURE__ */ new Map();
  accountBusy = false;
  accountRefreshing = false;
  accountFailure;
  accountEpoch = 0;
  accountsIdentity = "";
  accountsLoaded = false;
  disposed = false;
  addition;
  dispose() {
    this.disposed = true;
    this.accountEpoch++;
    this.modelsRequest++;
    this.unsubscribe();
  }
  publish() {
    if (!this.disposed) this.store.set(this.projection());
  }
  blocked() {
    return this.saving || this.pickerSaving;
  }
  stored(field) {
    const user = this.scope.getSnapshot().user;
    return !!user && Object.hasOwn(user, field);
  }
  value(field) {
    const draft = this.drafts.get(field);
    if (draft?.kind === "limits") return draft.value;
    const snapshot = this.scope.getSnapshot();
    return draft?.kind === "clear" ? snapshot.base?.[field] : snapshot.value?.[field];
  }
  field(field) {
    const draft = this.drafts.get(field);
    const text2 = draft?.kind === "text" ? draft.text : formatField(field, this.value(field));
    const write = draft?.kind === "clear" ? { kind: "clear" } : parseField(field, text2);
    const changed = draft?.kind === "text" && text2 !== formatField(field, this.scope.getSnapshot().value?.[field]);
    return { text: text2, overridden: draft?.kind === "clear" ? false : changed ? write?.kind === "set" : this.stored(field), invalid: !!draft && !write };
  }
  plan() {
    const value = this.scope.getSnapshot().value;
    return [...this.drafts].flatMap(([field, draft]) => {
      if (draft.kind === "clear") return this.stored(field) ? [{ field, draft, write: { kind: "clear" } }] : [];
      if (draft.kind === "limits") return sameValue(draft.value, value?.modelLimits) ? [] : [{ field, draft, write: { kind: "set", value: draft.value } }];
      if (field === "modelLimits" || draft.text === formatField(field, value?.[field])) return [];
      return [{ field, draft, write: parseField(field, draft.text) }];
    });
  }
  projection() {
    const snapshot = this.scope.getSnapshot();
    const plan = this.plan();
    return {
      status: snapshot.status,
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => !item.write),
      saving: this.saving || this.accountBusy,
      failed: this.failed,
      accounts: this.accountState(),
      enabled: snapshot.value?.enabled ?? true,
      ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, this.field(field)])),
      appliedAppearanceTheme: snapshot.value?.appearanceTheme ?? DEFAULT_OPENCODE_GO_THEME,
      modelVisibility: snapshot.value?.modelVisibility ?? {},
      pickerSaving: this.pickerSaving,
      pickerFailed: this.pickerFailed,
      enabledFailed: this.enabledFailed,
      models: this.models,
      modelLimits: { overridden: this.drafts.get("modelLimits")?.kind === "limits" || !this.drafts.has("modelLimits") && this.stored("modelLimits"), invalid: false },
      modelLimitDraft: modelLimitsOf(this.value("modelLimits"))
    };
  }
  edit(field, draft) {
    this.drafts.set(field, draft);
    this.failed = false;
    this.publish();
  }
  async save() {
    const plan = this.plan();
    if (!plan.length || this.blocked() || this.accountBusy || !this.scope.getSnapshot().writable || plan.some((item) => !item.write)) return;
    const revision = this.scope.getSnapshot().revision;
    this.saving = true;
    this.failed = false;
    this.publish();
    try {
      const ops = plan.map(({ field, write }) => write.kind === "clear" ? { op: "unset", path: [field] } : { op: "set", path: [field], value: write.value });
      const accepted = await this.scope.mutate(ops, revision);
      this.failed = !accepted;
      if (accepted) {
        for (const { field, draft } of plan) if (this.drafts.get(field) === draft) this.drafts.delete(field);
      }
    } catch {
      this.failed = true;
    } finally {
      this.saving = false;
      this.publish();
    }
  }
  async setEnabled(next) {
    await this.writePickerSetting("enabled", next);
  }
  async setModelEnabled(id4, next) {
    if (this.models.status === "ready" && this.models.entries.some((model) => modelSettingsKey(model) === id4 && model.configurationMissing)) return;
    await this.writePickerSetting("modelVisibility", { ...this.scope.getSnapshot().value?.modelVisibility, [id4]: next });
  }
  async writePickerSetting(field, value) {
    if (this.blocked() || this.accountBusy || !this.scope.getSnapshot().writable) return;
    this.pickerSaving = true;
    if (field === "enabled") this.enabledFailed = false;
    else this.pickerFailed = false;
    this.publish();
    try {
      const accepted = await this.scope.set(field, value);
      if (field === "enabled") this.enabledFailed = !accepted;
      else this.pickerFailed = !accepted;
    } catch {
      if (field === "enabled") this.enabledFailed = true;
      else this.pickerFailed = true;
    } finally {
      this.pickerSaving = false;
      this.publish();
    }
  }
  inject() {
    this.face ??= {
      hooks: { opencodeGo: this.store },
      loadModels: () => this.loadModels(),
      setEnabled: (next) => {
        void this.setEnabled(next);
      },
      setModelEnabled: (id4, next) => {
        void this.setModelEnabled(id4, next);
      },
      edit: (field, text2) => this.edit(field, { kind: "text", text: text2 }),
      editModelLimits: (value) => this.edit("modelLimits", { kind: "limits", value: structuredClone(value) }),
      resetField: (field) => this.edit(field, { kind: "clear" }),
      save: () => {
        void this.save();
      },
      discard: () => {
        this.drafts.clear();
        this.failed = false;
        this.publish();
      },
      ...this.accountActions()
    };
    return this.face;
  }
  loadModels() {
    const request = ++this.modelsRequest;
    const previous = this.models.status === "ready" ? this.models : void 0;
    this.models = previous ? { ...previous, refreshing: true } : { status: "loading" };
    this.publish();
    const failed = (message) => {
      this.models = previous ? { ...previous, refreshing: false, stale: true, message, sources: void 0 } : { status: "failed", message };
    };
    void this.readModels().then((response) => {
      if (request !== this.modelsRequest) return;
      if (!response.ok) failed(response.error.message);
      else if (response.value.stale && response.value.models.length === 0) {
        this.models = {
          status: "failed",
          ...response.value.error ? { message: response.value.error } : {},
          ...response.value.sources ? { sources: response.value.sources } : {}
        };
      } else {
        this.models = {
          status: "ready",
          count: response.value.models.length,
          preview: response.value.models.map((model) => model.name ?? model.id),
          entries: response.value.models,
          stale: response.value.stale,
          ...response.value.sources ? { sources: response.value.sources } : {},
          ...response.value.error ? { message: response.value.error } : {}
        };
      }
      this.publish();
    }).catch((error) => {
      if (request !== this.modelsRequest) return;
      failed(error instanceof Error ? error.message : String(error));
      this.publish();
    });
  }
  accountState() {
    const config = this.scope.getSnapshot().value ?? {};
    return {
      entries: accountsOf(config).map((account) => ({ ...this.accountRows.get(account.apiKeyEnv), ...account })),
      activeRef: accountRefOf(config),
      autoSwitch: config.autoSwitch === true,
      busy: this.accountBusy,
      blocked: this.blocked(),
      refreshing: this.accountRefreshing,
      failure: this.accountFailure
    };
  }
  syncAccounts() {
    const config = this.scope.getSnapshot().value ?? {};
    const identity = JSON.stringify([
      accountsOf(config).map((account) => [account.id, account.apiKeyEnv]).sort((left, right) => left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0),
      config.baseURL,
      config.proxyURL
    ]);
    if (identity === this.accountsIdentity) return;
    this.accountsIdentity = identity;
    this.accountEpoch++;
    this.accountRows.clear();
    this.accountRefreshing = false;
    if (this.accountsLoaded) void this.refreshAccounts();
  }
  refreshCredential(ref) {
    if (!accountsOf(this.scope.getSnapshot().value ?? {}).some((account) => account.apiKeyEnv === ref)) return;
    this.accountEpoch++;
    this.accountRows.delete(ref);
    this.publish();
    if (this.accountsLoaded) void this.refreshAccounts();
  }
  async refreshAccounts() {
    this.accountsLoaded = true;
    const epoch = ++this.accountEpoch;
    const accounts = [...accountsOf(this.scope.getSnapshot().value ?? {})];
    this.accountRefreshing = true;
    this.publish();
    try {
      const described = await this.ctx.remote.credentials.describe(accounts.map((account) => account.apiKeyEnv));
      if (this.disposed || epoch !== this.accountEpoch) return;
      if (!described.ok) {
        this.accountFailure = "read";
        this.markUnreadable(accounts, described.error instanceof Error ? described.error.message : String(described.error));
        return;
      }
      this.accountFailure = void 0;
      await Promise.all(accounts.map(async (account) => {
        const ref = account.apiKeyEnv;
        const info = described.value[ref];
        const previous = this.accountRows.get(ref);
        this.accountRows.set(ref, {
          ...previous,
          ...account,
          configured: info?.configured ?? false,
          writable: info?.writable ?? true,
          loading: info?.configured === true,
          failed: false
        });
        this.publish();
        if (!info?.configured) {
          this.accountRows.set(ref, { ...account, configured: false, writable: info?.writable ?? true });
          return;
        }
        try {
          const usage = await this.readUsage(ref);
          if (this.disposed || epoch !== this.accountEpoch) return;
          this.accountRows.set(ref, { ...account, configured: true, writable: info.writable, usage, updatedAt: Date.now() });
        } catch (error) {
          if (this.disposed || epoch !== this.accountEpoch) return;
          const details = error && typeof error === "object" && "code" in error && error.code === "opencode-go/usage-unavailable" && "details" in error && error.details && typeof error.details === "object" ? error.details : void 0;
          const retain = details?.retryable === true && details.retainPrevious === true && previous?.usage?.source && previous.usage.source === details.source;
          const message = error instanceof Error ? error.message : String(error);
          this.accountRows.set(ref, {
            ...account,
            configured: true,
            writable: info.writable,
            failed: true,
            problem: message.length > 512 ? message.slice(0, 512) + "\u2026" : message,
            ...retain ? { usage: previous.usage, updatedAt: previous.updatedAt, stale: true } : {}
          });
        }
        this.publish();
      }));
    } catch (error) {
      if (epoch === this.accountEpoch) {
        this.accountFailure = "read";
        this.markUnreadable(accounts, error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (!this.disposed && epoch === this.accountEpoch) {
        this.accountRefreshing = false;
        this.publish();
      }
    }
  }
  /** Mark every account row as unreadable with the Host's own diagnostic. */
  markUnreadable(accounts, message) {
    const problem = message.length > 200 ? message.slice(0, 200) + "\u2026" : message;
    for (const account of accounts) this.accountRows.set(account.apiKeyEnv, { ...account, failed: true, problem });
    this.publish();
  }
  accountActions() {
    const command = (request) => this.executeAccountCommand(request).then((status) => status === "applied");
    return {
      loadAccounts: () => {
        void this.refreshAccounts();
      },
      resetAddition: () => {
        this.addition = void 0;
      },
      addAccount: (name, key) => this.runAccountAction(async () => {
        if (!name.trim() || name.trim().length > 80 || !key.trim()) return false;
        if (this.addition?.name !== name.trim()) this.addition = { name: name.trim(), id: operationId() };
        const accepted = await command({ kind: "add", id: this.addition.id, name, key });
        if (accepted) this.addition = void 0;
        return accepted;
      }),
      renameAccount: (ref, name) => this.runAccountAction(() => command({ kind: "rename", ref, name })),
      removeAccount: (ref) => this.runAccountAction(async () => {
        const accepted = await command({ kind: "remove", ref });
        if (!accepted) this.accountFailure = "remove";
        return accepted;
      }),
      selectAccount: (ref) => this.runAccountAction(() => command({ kind: "select", ref })),
      setAutoSwitch: (value) => this.runAccountAction(() => command({ kind: "auto-switch", value })),
      replaceAccountKey: (ref, key) => this.runAccountAction(async () => {
        if (!key.trim() || this.accountRows.get(ref)?.writable === false) return false;
        const accepted = await command({ kind: "replace-key", ref, key });
        if (accepted) this.refreshCredential(ref);
        return accepted;
      }, false),
      moveAccount: (ref, toIndex) => this.runAccountAction(() => command({ kind: "move", ref, toIndex }))
    };
  }
  async runAccountAction(action, requiresSettings = true) {
    if (this.accountBusy || this.blocked() || requiresSettings && !this.scope.getSnapshot().writable) return false;
    this.accountBusy = true;
    this.accountFailure = void 0;
    this.publish();
    try {
      const accepted = await action();
      if (!accepted && !this.accountFailure) this.accountFailure = "write";
      return accepted;
    } catch {
      this.accountFailure ??= "write";
      return false;
    } finally {
      this.accountBusy = false;
      this.publish();
    }
  }
};
function modelLimitsOf(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const limits = {};
  for (const [id4, entry] of Object.entries(value)) {
    if (entry === null) {
      limits[id4] = null;
      continue;
    }
    if (typeof entry !== "object" || Array.isArray(entry)) continue;
    const fields = entry;
    const limit = {};
    if (fields.contextWindow === null) limit.contextWindow = null;
    if (fields.maxTokens === null) limit.maxTokens = null;
    if (fields.thinkingBudgets === null) limit.thinkingBudgets = null;
    if (Array.isArray(fields.thinkingBudgets) && fields.thinkingBudgets.length <= 16 && fields.thinkingBudgets.every((value2) => typeof value2 === "number" && Number.isSafeInteger(value2) && value2 > 0)) {
      limit.thinkingBudgets = fields.thinkingBudgets;
    }
    if (typeof fields.contextWindow === "number" && Number.isSafeInteger(fields.contextWindow) && fields.contextWindow > 0) {
      limit.contextWindow = fields.contextWindow;
    }
    if (typeof fields.maxTokens === "number" && Number.isSafeInteger(fields.maxTokens) && fields.maxTokens > 0) {
      limit.maxTokens = fields.maxTokens;
    }
    if (limit.contextWindow !== void 0 || limit.maxTokens !== void 0 || limit.thinkingBudgets !== void 0) limits[id4] = limit;
  }
  return limits;
}

// src/client/Section.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function HintMark(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: props.hint, side: "bottom", maxWidth: 280, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: Section_default.info, "aria-label": props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconQuestionOutlineRegular, {}) }) }) });
}
function HintText(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: props.id, className: Section_default.visuallyHidden, children: props.hint });
}
var WINDOWS = ["rolling", "weekly", "monthly"];
var TICKS = [25, 50, 75];
function resetText(resetsAt, t) {
  const remaining = Date.parse(resetsAt) - Date.now();
  if (!Number.isFinite(remaining)) return t("usageResetUnknown");
  if (remaining <= 0) return t("usageResetDue");
  const minutes = Math.max(1, Math.round(remaining / 6e4));
  if (minutes < 60) return t("usageResetMinutes", { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("usageResetHours", { hours });
  return t("usageResetDays", { days: Math.round(hours / 24) });
}
function barLevel(window) {
  if (window.status === "rate-limited" || window.percent >= 100) return "limited";
  return window.percent >= 80 ? "high" : "ok";
}
function stampText(at, locale) {
  const date = new Date(at);
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? time : `${date.toLocaleDateString(locale)} ${time}`;
}
function GripIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "10", height: "14", viewBox: "0 0 10 14", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "2.5", cy: "2.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7.5", cy: "2.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "2.5", cy: "7", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7.5", cy: "7", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "2.5", cy: "11.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "7.5", cy: "11.5", r: "1.3" })
  ] });
}
function slotAt(container, clientY) {
  const rows = container.querySelectorAll("[data-account-row]");
  for (let index = 0; index < rows.length; index++) {
    const box = rows[index].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) return index;
  }
  return rows.length;
}
function AccountsCard({ state, actions, writable, t, locale }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [details, setDetails] = (0, import_react2.useState)(null);
  const [dragging, setDragging] = (0, import_react2.useState)(null);
  const [dropAt, setDropAt] = (0, import_react2.useState)(null);
  const [editor, setEditor] = (0, import_react2.useState)(null);
  const [name, setName] = (0, import_react2.useState)("");
  const [key, setKey] = (0, import_react2.useState)("");
  const disabled = state.busy || state.blocked || !writable;
  const total = state.entries.length;
  const ready = state.entries.filter((entry) => entry.configured === true).length;
  const unreadable = state.entries.filter((entry) => entry.failed === true).length;
  const preferred = state.entries.find((entry) => entry.apiKeyEnv === state.activeRef);
  const reorderable = !disabled && total > 1;
  const draggingFrom = dragging === null ? -1 : state.entries.findIndex((entry) => entry.apiKeyEnv === dragging);
  const noopSlot = draggingFrom >= 0 && (dropAt === draggingFrom || dropAt === draggingFrom + 1);
  const markAt = (index) => {
    if (!reorderable || dropAt === null || noopSlot) return void 0;
    if (dropAt === index) return "before";
    return dropAt === total && index === total - 1 ? "after" : void 0;
  };
  const updatedAt = state.entries.reduce((latest, entry) => Math.max(latest, entry.updatedAt ?? 0), 0);
  (0, import_react2.useEffect)(() => {
    actions.loadAccounts();
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") actions.loadAccounts();
    }, 6e4);
    return () => {
      clearInterval(timer);
    };
  }, [actions.loadAccounts]);
  const start = (next, label = "") => {
    if (next.kind === "add") actions.resetAddition?.();
    setEditor(next);
    setName(label);
    setKey("");
  };
  const cancel = () => {
    if (editor?.kind === "add") actions.resetAddition?.();
    setEditor(null);
    setName("");
    setKey("");
  };
  (0, import_react2.useEffect)(() => {
    if (editor?.ref != null && !state.entries.some((entry) => entry.apiKeyEnv === editor.ref)) cancel();
  }, [state.entries, editor]);
  (0, import_react2.useEffect)(() => {
    if (dragging !== null && !state.entries.some((entry) => entry.apiKeyEnv === dragging)) {
      setDragging(null);
      setDropAt(null);
    }
  }, [state.entries, dragging]);
  const submit = async () => {
    if (!editor) return;
    const accepted = editor.kind === "add" ? await actions.addAccount(name, key) : editor.kind === "rename" ? await actions.renameAccount(editor.ref, name) : editor.kind === "key" ? await actions.replaceAccountKey(editor.ref, key) : await actions.removeAccount(editor.ref);
    if (accepted) cancel();
  };
  const move = (ref, toIndex) => {
    void actions.moveAccount(ref, toIndex);
  };
  const summary = total ? t("accountsSummary", { count: total, name: preferred ? preferred.name || t("accountDefault") : "" }) : t("accountsSummaryEmpty");
  const editorTitle = (kind) => t(kind === "add" ? "accountAdd" : kind === "rename" ? "accountRename" : kind === "key" ? "accountReplaceKey" : "accountRemove");
  const editorForm = (label = "") => editor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "form",
    {
      className: Section_default.accountEditor,
      onSubmit: (event) => {
        event.preventDefault();
        void submit();
      },
      onKeyDown: (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountEditorHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.accountEditorTitle, children: editorTitle(editor.kind) }),
          label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.accountEditorFor, children: label }) : null
        ] }),
        editor.kind === "remove" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("accountRemoveHint", { name }) }) : null,
        editor.kind === "add" || editor.kind === "rename" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: Section_default.accountField, children: [
          t("accountName"),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              className: Section_default.input,
              value: name,
              maxLength: 80,
              required: true,
              disabled: state.busy,
              autoFocus: true,
              onChange: (event) => {
                setName(event.target.value);
              }
            }
          )
        ] }) : null,
        editor.kind === "add" || editor.kind === "key" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: Section_default.accountField, children: [
            t("keyLabel"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                className: Section_default.input,
                type: "password",
                autoComplete: "off",
                value: key,
                required: true,
                disabled: state.busy,
                autoFocus: true,
                onChange: (event) => {
                  setKey(event.target.value);
                }
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("accountKeyHint") })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountEditorActions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Button,
            {
              variant: "primary",
              size: "sm",
              type: "submit",
              disabled: editor.kind === "key" ? state.busy || state.blocked : disabled,
              children: t(state.busy ? "saving" : "accountConfirm")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", type: "button", disabled: state.busy, onClick: cancel, children: t("accountCancel") })
        ] })
      ]
    }
  ) : null;
  const detail = (account, label) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountDetail, children: [
    account.usage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.accountUsage, children: WINDOWS.map((window) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t(`usage_${window}`),
        " \xB7 ",
        account.usage[window].percent,
        "%"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "progress",
        {
          "data-level": barLevel(account.usage[window]),
          max: 100,
          value: Math.min(100, account.usage[window].percent),
          "aria-label": `${label} ${t(`usage_${window}`)}`
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.hint, children: [
        t("usageResets"),
        " ",
        new Date(account.usage[window].resetsAt).toLocaleString(locale)
      ] })
    ] }, window)) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t(account.loading ? "usageLoading" : "usageUnavailable") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountActions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", disabled, onClick: () => {
        start({ kind: "rename", ref: account.apiKeyEnv }, label);
      }, children: t("accountRename") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", disabled: state.busy || state.blocked || account.writable === false, onClick: () => {
        start({ kind: "key", ref: account.apiKeyEnv }, label);
      }, children: t("accountReplaceKey") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", disabled, onClick: () => {
        start({ kind: "remove", ref: account.apiKeyEnv }, label);
      }, children: t("accountRemove") })
    ] })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: open ? Section_default.card : Section_default.card + " " + Section_default.cardFolded, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.cardHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          className: Section_default.cardTrigger,
          "aria-expanded": open,
          "aria-controls": "opencode-go-accounts",
          onClick: () => {
            setOpen(!open);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.cardTitle, children: t("accountsTitle") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.cardSub, children: summary }),
            total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: unreadable > 0 || ready < total ? "warning" : "success", children: t(unreadable > 0 ? "accountsAvailabilityFailed" : "accountsAvailability", { ready, total, failed: unreadable }) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: open ? Section_default.chevronOpen : Section_default.chevron })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.trailing, children: [
        updatedAt > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.cardStamp, title: new Date(updatedAt).toLocaleString(locale), children: [
          t("usageLastUpdated"),
          " ",
          stampText(updatedAt, locale)
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_dsh_client_ui_primitives.Button,
          {
            variant: "outline",
            size: "sm",
            disabled: state.refreshing,
            onClick: actions.loadAccounts,
            children: t(state.refreshing ? "usageRefreshing" : "accountsRefresh")
          }
        )
      ] })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { id: "opencode-go-accounts", className: Section_default.cardBody, children: [
      state.blocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("accountsBlocked") }) : null,
      state.failure ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t(state.failure === "cleanup" ? "accountsCleanupFailed" : state.failure === "remove" ? "accountsRemoveKeyFailed" : state.failure === "read" ? "accountsReadFailed" : "accountsWriteFailed") }) : null,
      !total ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("accountsEmpty") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          className: Section_default.accounts,
          onDragEnter: (event) => {
            if (reorderable && dragging !== null) event.preventDefault();
          },
          onDragOver: (event) => {
            if (!reorderable || dragging === null) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
            setDropAt(slotAt(event.currentTarget, event.clientY));
          },
          onDrop: (event) => {
            const source = dragging;
            setDragging(null);
            setDropAt(null);
            if (source === null) return;
            event.preventDefault();
            const from = state.entries.findIndex((entry) => entry.apiKeyEnv === source);
            if (from < 0) return;
            const slot = Number.isFinite(event.clientY) ? slotAt(event.currentTarget, event.clientY) : dropAt;
            if (slot === null) return;
            const to = slot > from ? slot - 1 : slot;
            if (to !== from) move(source, to);
          },
          onDragEnd: () => {
            setDragging(null);
            setDropAt(null);
          },
          children: state.entries.map((account, index) => {
            const label = account.name || t("accountDefault");
            const rolling = account.usage?.rolling;
            const expanded = details === account.apiKeyEnv;
            const panelId = `opencode-go-account-${index}`;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                className: Section_default.accountRow,
                "data-account-row": account.apiKeyEnv,
                "data-dragging": dragging === account.apiKeyEnv ? "true" : void 0,
                "data-drop": markAt(index),
                onDragStart: (event) => {
                  if (!reorderable || event.target?.closest?.("[data-account-handle]") == null) {
                    event.preventDefault();
                    return;
                  }
                  if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", account.apiKeyEnv);
                    if (typeof event.dataTransfer.setDragImage === "function") {
                      event.dataTransfer.setDragImage(event.currentTarget, 16, 16);
                    }
                  }
                  setDragging(account.apiKeyEnv);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountMain, "data-account-main": "", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: Section_default.accountHandle,
                        "data-account-handle": "",
                        draggable: reorderable,
                        disabled: !reorderable,
                        title: t("accountDragHandle", { name: label }),
                        "aria-label": t("accountDragHandle", { name: label }),
                        onKeyDown: (event) => {
                          if (event.key === "ArrowUp" && index > 0) {
                            event.preventDefault();
                            move(account.apiKeyEnv, index - 1);
                          }
                          if (event.key === "ArrowDown" && index < total - 1) {
                            event.preventDefault();
                            move(account.apiKeyEnv, index + 1);
                          }
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GripIcon, {})
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountBody, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountTop, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { className: Section_default.accountName, title: label, children: label }),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.accountState, children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.accountDot, "data-off": account.configured === false ? "true" : void 0 }),
                          account.configured === void 0 ? t(account.failed ? "accountsStatusUnknown" : "usageLoading") : account.configured ? t("keyConfigured") : t("keyMissing")
                        ] }),
                        rolling ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.accountPercent, children: [
                          rolling.percent,
                          "%"
                        ] }) : null,
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "button",
                          {
                            type: "button",
                            className: Section_default.accountToggle,
                            "aria-expanded": expanded,
                            "aria-controls": panelId,
                            "aria-label": t(expanded ? "accountsDetailsHide" : "accountsDetails", { name: label }),
                            onClick: () => {
                              setDetails(expanded ? null : account.apiKeyEnv);
                            },
                            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: expanded ? Section_default.chevronOpen : Section_default.chevron })
                          }
                        )
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.accountMeta, children: rolling ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                          "span",
                          {
                            className: Section_default.accountBar,
                            role: "progressbar",
                            "data-level": barLevel(rolling),
                            "aria-valuemin": 0,
                            "aria-valuemax": 100,
                            "aria-valuenow": Math.min(100, rolling.percent),
                            "aria-label": `${label} ${t("usage_rolling")}`,
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.accountBarFill, style: { width: `${Math.min(100, rolling.percent)}%` } }),
                              TICKS.map((at) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.accountBarTick, style: { left: `${at}%` } }, at))
                            ]
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.accountReset, children: resetText(rolling.resetsAt, t) })
                      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.accountIdle, children: account.configured === false ? t("accountConfigureHint") : t(account.loading ? "usageLoading" : "usageUnavailable") }) })
                    ] })
                  ] }),
                  account.failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountProblems, role: "alert", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, children: account.problem ?? t(account.stale ? "usageStaleHint" : "usageRefreshFailed") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: Section_default.accountRetry,
                        disabled: state.refreshing,
                        onClick: actions.loadAccounts,
                        children: t("usageRetry")
                      }
                    )
                  ] }) : null,
                  expanded ? detail(account, label) : null,
                  editor?.ref === account.apiKeyEnv ? editorForm(label) : null
                ]
              }
            ) }, account.id);
          })
        }
      ),
      editor ? editor.kind === "add" ? editorForm() : null : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.accountsFoot, children: [
        editor ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_dsh_client_ui_primitives.Button,
          {
            className: Section_default.addAccount,
            variant: "outline",
            size: "sm",
            disabled: disabled || total >= MAX_ACCOUNTS,
            onClick: () => {
              start({ kind: "add" });
            },
            children: t("accountAdd")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.field, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.head, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.label, children: [
            t("accountAutoSwitch"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintMark, { hint: t("accountAutoSwitchHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Switch,
            {
              checked: state.autoSwitch,
              disabled,
              label: t("accountAutoSwitch"),
              title: t("accountAutoSwitchHint"),
              onChange: (next) => {
                void actions.setAutoSwitch(next);
              }
            }
          )
        ] }) })
      ] })
    ] }) : null
  ] });
}
var MODALITY_COPY = {
  text: "modalityText",
  image: "modalityImage",
  audio: "modalityAudio",
  video: "modalityVideo",
  pdf: "modalityPdf"
};
function hasCapacityOverride(limit) {
  return limit?.contextWindow != null || limit?.maxTokens != null || (limit?.thinkingBudgets?.length ?? 0) > 0;
}
function ModelEditor({ source = "go", models, draft, modelVisibility, t, locale, disabled, visibilitySaving, onEdit, onModelEnabled }) {
  const [query, setQuery] = (0, import_react2.useState)("");
  const [filter, setFilter] = (0, import_react2.useState)("all");
  const [selected, setSelected] = (0, import_react2.useState)();
  const [now, setNow] = (0, import_react2.useState)(Date.now);
  (0, import_react2.useEffect)(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 6e4);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const all = sortModels(models.status === "ready" ? models.entries : [], now);
  const normalized = query.trim().toLocaleLowerCase();
  const entries = all.filter((model2) => `${model2.name ?? ""} ${model2.id}`.toLocaleLowerCase().includes(normalized) && (filter === "all" || filter === "new" && isNewModel(model2, now) || filter === "custom" && hasCapacityOverride(draft[modelSettingsKey(model2)]) || filter === "deprecated" && model2.deprecated));
  const model = entries.find((entry) => entry.id === selected) ?? entries[0];
  const visibilityDisabled = disabled || visibilitySaving;
  const customized = all.filter((entry) => hasCapacityOverride(draft[modelSettingsKey(entry)])).length;
  const ownKeys = Object.keys(draft).filter((key) => key.startsWith(`${FREE_PROVIDER_ID}/`) === (source === "free"));
  const filters = [
    ["all", "filterAll", all.length],
    ["new", "filterNew", all.filter((entry) => isNewModel(entry, now)).length],
    ["custom", "filterCustom", customized],
    ["deprecated", "filterDeprecated", all.filter((entry) => entry.deprecated).length]
  ];
  const write = (id4, field, value) => {
    const current = draft[id4] === null ? { contextWindow: null, maxTokens: null, thinkingBudgets: null } : draft[id4] ?? {};
    onEdit({ ...draft, [id4]: { ...current, [field]: value ?? null } });
  };
  const badges = (entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    entry.configurationMissing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "warning", children: t("configurationMissing") }) : null,
    isNewModel(entry, now) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.newBadge, title: t("newHint"), children: t("newBadge") }) : null,
    entry.deprecated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "warning", children: t("deprecatedBadge") }) : null
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.limitsEditor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.modelSearchRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: Section_default.visuallyHidden, htmlFor: "opencode-go-model-filter", children: t("limitsFilterLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          id: "opencode-go-model-filter",
          className: Section_default.input,
          type: "search",
          autoComplete: "off",
          placeholder: t("limitsFilterPlaceholder"),
          value: query,
          onChange: (event) => {
            setQuery(event.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.filters, role: "group", "aria-label": t("filterLabel"), children: filters.map(([key, label, count]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          className: Section_default.filter,
          "aria-pressed": filter === key,
          onClick: () => {
            setFilter(key);
          },
          children: [
            t(label),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: count })
          ]
        },
        key
      )) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.modelHelp, children: t("visibilityHint") }),
    model ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.modelLayout, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.modelList, role: "group", "aria-label": t("modelsLabel"), children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: entry.id === model.id ? `${Section_default.modelRow} ${Section_default.modelRowSelected}` : Section_default.modelRow,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: Section_default.modelChoice,
                "aria-pressed": entry.id === model.id,
                onClick: () => {
                  setSelected(entry.id);
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.modelName, children: [
                  entry.name ?? entry.id,
                  " ",
                  badges(entry),
                  hasCapacityOverride(draft[modelSettingsKey(entry)]) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.overrideDot, title: t("overridden"), "aria-hidden": "true" }) : null
                ] })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              import_dsh_client_ui_primitives.Switch,
              {
                label: t("modelVisibleLabel", { name: entry.name ?? entry.id }),
                checked: isModelEnabled(entry, modelVisibility),
                disabled: visibilityDisabled || entry.configurationMissing,
                onChange: (enabled) => {
                  onModelEnabled(modelSettingsKey(entry), enabled);
                }
              }
            )
          ]
        },
        entry.id
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: Section_default.modelDetails, "aria-label": t("modelDetails"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.modelHeading, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: model.name ?? model.id }),
          badges(model)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.modelMeta, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: Section_default.limitsModelId, translate: "no", children: model.id }),
          model.releaseDate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.releaseDate, title: t("releaseSource", { date: model.releaseDate }), children: model.releaseDate }) : null
        ] }),
        model.configurationMissing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("configurationMissingHint") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          model.deprecated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("deprecatedHint") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.stats, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Capacity, { model, field: "contextWindow", limit: draft[modelSettingsKey(model)], t, locale, disabled, onChange: write }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Capacity, { model, field: "maxTokens", limit: draft[modelSettingsKey(model)], t, locale, disabled, onChange: write }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.stat, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.statLabel, children: t("modalityLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modalities, { model, t })
            ] })
          ] }),
          model.reasoningBudget ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            BudgetPresets,
            {
              model,
              limit: draft[modelSettingsKey(model)],
              t,
              locale,
              disabled,
              onChange: (values) => {
                write(modelSettingsKey(model), "thinkingBudgets", values);
              }
            },
            model.id
          ) : null,
          hasCapacityOverride(draft[modelSettingsKey(model)]) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: Section_default.reset,
              disabled,
              onClick: () => {
                onEdit({ ...draft, [modelSettingsKey(model)]: null });
              },
              children: t("limitsResetModel")
            }
          ) : null,
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: Section_default.paneFoot, children: [
            t("limitsHint"),
            " ",
            t("modalitiesSource"),
            model.inputModalities?.some((modality) => modality !== "text" && modality !== "image") === true ? ` ${t("modalitiesForwarding")}` : ""
          ] })
        ] })
      ] })
    ] }) : models.status === "ready" && all.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("limitsNoMatches", { query }) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.limitsFoot, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.limitsSummary, children: t("limitsSummary", { count: customized }) }),
      ownKeys.some((key) => hasCapacityOverride(draft[key])) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "outline",
          size: "sm",
          disabled,
          onClick: () => {
            onEdit({ ...draft, ...Object.fromEntries(ownKeys.map((id4) => [id4, null])) });
          },
          children: t("limitsResetAll")
        }
      ) : null
    ] })
  ] });
}
function Modalities({ model, t }) {
  const declared = model.inputModalities;
  if (declared === void 0 || declared.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.hint, children: t("modalityUnknown") });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.modalities, children: INPUT_MODALITIES.map((modality) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "span",
    {
      className: declared.includes(modality) ? Section_default.modality : Section_default.modalityOff,
      children: t(MODALITY_COPY[modality])
    },
    modality
  )) });
}
function Capacity({ model, field, limit, disabled, t, locale, onChange }) {
  const id4 = `opencode-go-${field}-${encodeURIComponent(model.id)}`;
  const catalogValue = model[field];
  const defaultValue = field === "maxTokens" && catalogValue !== void 0 ? Math.min(catalogValue, 65536) : catalogValue;
  const cappedOutput = field === "maxTokens" && catalogValue !== void 0 && catalogValue > 65536;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.stat, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: Section_default.statLabel, htmlFor: id4, children: t(field === "contextWindow" ? "limitsContext" : "limitsOutput") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        id: id4,
        className: Section_default.input,
        type: "number",
        min: 1,
        max: field === "maxTokens" ? model.maxTokens : void 0,
        step: 1,
        inputMode: "numeric",
        "aria-label": t(field === "contextWindow" ? "limitsContextLabel" : "limitsOutputLabel", { name: model.name ?? model.id }),
        "aria-describedby": `${id4}-default`,
        value: limit?.[field] ?? "",
        placeholder: defaultValue === void 0 ? t("capacityMissing") : String(defaultValue),
        disabled,
        onChange: (event) => {
          const text2 = event.target.value.trim();
          const value = Number(text2);
          if (text2 === "") onChange(modelSettingsKey(model), field, void 0);
          else if (Number.isSafeInteger(value) && value > 0) onChange(modelSettingsKey(model), field, value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { id: `${id4}-default`, className: Section_default.hint, children: [
      cappedOutput ? t("capacityDefaultCapped", { value: defaultValue.toLocaleString(locale), max: catalogValue.toLocaleString(locale) }) : t("capacityDefault", { value: defaultValue === void 0 ? t("capacityMissing") : defaultValue.toLocaleString(locale) }),
      limit?.[field] != null ? ` \xB7 ${t("overridden")}` : ""
    ] })
  ] });
}
function BudgetPresets({ model, limit, disabled, t, locale, onChange }) {
  const [text2, setText] = (0, import_react2.useState)("");
  const range = model.reasoningBudget;
  const max = Math.min(range.max, MAX_THINKING_BUDGET_TOKENS, (limit?.maxTokens ?? model.maxTokens ?? range.max + 1024) - 1024);
  const values = limit?.thinkingBudgets ?? [];
  const tokens = Number(text2);
  const valid = text2.trim() !== "" && Number.isSafeInteger(tokens) && tokens >= range.min && tokens <= max;
  const id4 = `opencode-go-thinking-budget-${encodeURIComponent(model.id)}`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: Section_default.budgetEditor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("thinkingBudgets") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("thinkingBudgetsHint", { min: range.min.toLocaleString(locale), max: max.toLocaleString(locale) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: Section_default.statLabel, htmlFor: id4, children: t("thinkingBudgetAddLabel", { name: model.name ?? model.id }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.budgetInput, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          id: id4,
          className: Section_default.input,
          type: "number",
          step: 1,
          min: range.min,
          max,
          inputMode: "numeric",
          value: text2,
          placeholder: "4096",
          disabled,
          "aria-invalid": text2 !== "" && !valid,
          onChange: (event) => {
            setText(event.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "outline",
          size: "sm",
          disabled: disabled || !valid || values.includes(tokens) || values.length >= 16,
          onClick: () => {
            onChange([...values, tokens].sort((a, b) => a - b));
            setText("");
          },
          children: t("thinkingBudgetAdd")
        }
      )
    ] }),
    values.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.budgetPresets, children: values.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        className: Section_default.filter,
        disabled,
        "aria-label": t("thinkingBudgetRemove", { value }),
        onClick: () => {
          const next = values.filter((tokens2) => tokens2 !== value);
          onChange(next.length > 0 ? next : void 0);
        },
        children: [
          value.toLocaleString(locale),
          " tokens \xD7"
        ]
      },
      value
    )) }) : null
  ] });
}
var ADVANCED_FIELDS = [
  "baseURL",
  "freeBaseURL",
  "proxyURL",
  "refreshMinutes",
  "streamIdleTimeoutMs",
  "requestPreparationTimeoutMs",
  "requestTimeoutMs",
  "maxImages",
  "maxRequestImageBytes",
  "requestImagePixelBudget",
  "requestImageMaxBytes"
];
function numericBounds(field) {
  const limit = NUMERIC_FIELD_LIMITS[field];
  return {
    numeric: true,
    ...limit !== void 0 && limit.min !== void 0 ? { min: limit.min } : {},
    ...limit?.max === void 0 ? {} : { max: limit.max },
    step: limit !== void 0 && !limit.integer ? "any" : 1
  };
}
var APPEARANCE_FIELDS = ["appearanceTheme", "showSidebarQuota", "usagePillStyle"];
var APPEARANCE_TAB_FIELDS = [...APPEARANCE_FIELDS, "usageDisplay"];
var SETTINGS_TABS = ["overview", "models", "appearance", "advanced"];
function ValueField(props) {
  const hintId = props.id + "-hint";
  const errorId = props.id + "-error";
  const labelId = props.id + "-label";
  const options = props.options;
  const selected = options ? options.findIndex((option) => option.value === props.field.text) : -1;
  const describedBy = props.field.invalid ? `${errorId} ${hintId}` : hintId;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.rowLabel, children: [
      options ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { id: labelId, className: Section_default.rowTitle, children: props.label }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: props.id, className: Section_default.rowTitle, children: props.label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintMark, { hint: props.hint })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.rowControl, children: options ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        className: Section_default.seg,
        role: "radiogroup",
        "aria-labelledby": labelId,
        "aria-describedby": describedBy,
        "data-count": options.length,
        "data-index": selected < 0 ? 0 : selected,
        ...props.field.invalid ? { "aria-invalid": true } : {},
        onKeyDown: (event) => {
          const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
          if (step === 0) return;
          event.preventDefault();
          const next = (Math.max(0, selected) + step + options.length) % options.length;
          props.onEdit(options[next].value);
          event.currentTarget.querySelectorAll('[role="radio"]')[next]?.focus();
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.segThumb, "aria-hidden": "true" }),
          options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              role: "radio",
              "aria-checked": option.value === props.field.text,
              tabIndex: option.value === props.field.text ? 0 : -1,
              className: Section_default.segOption,
              disabled: props.disabled,
              onClick: () => {
                props.onEdit(option.value);
              },
              children: option.label
            },
            option.value
          ))
        ]
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        id: props.id,
        name: props.id,
        autoComplete: "off",
        placeholder: props.placeholder,
        "aria-describedby": describedBy,
        className: props.field.invalid ? Section_default.inputInvalid : Section_default.input,
        type: props.numeric === true ? "number" : "text",
        ...props.numeric === true ? { inputMode: "numeric" } : {},
        ...props.numeric === true && props.min !== void 0 ? { min: props.min } : {},
        ...props.numeric === true && props.max !== void 0 ? { max: props.max } : {},
        ...props.numeric === true && props.step !== void 0 ? { step: props.step } : {},
        ...props.field.invalid ? { "aria-invalid": true } : {},
        value: props.field.text,
        disabled: props.disabled,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintText, { id: hintId, hint: props.hint }),
    props.field.invalid ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: errorId, className: Section_default.rowInvalid, role: "alert", children: props.invalidLabel }) : null
  ] });
}
function QuotaAppearance({ state, t, disabled, onEdit }) {
  const scheme = useHostScheme();
  const draftTheme = state.appearanceTheme.text === "classic" ? "classic" : "native";
  const tokens = GO_THEME_TOKENS[draftTheme][scheme];
  const locked = disabled || state.saving;
  const themeId = "opencode-go-appearance-theme";
  const themeDescribedBy = state.appearanceTheme.invalid ? `${themeId}-hint ${themeId}-error` : `${themeId}-hint`;
  const styleId = "opencode-go-usage-pill-style";
  const describedBy = state.usagePillStyle.invalid ? `${styleId}-hint ${styleId}-error` : `${styleId}-hint`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.appearanceGroup, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.rows, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "fieldset",
      {
        className: Section_default.appearanceStyles,
        role: "radiogroup",
        "aria-labelledby": `${themeId}-label`,
        "aria-describedby": themeDescribedBy,
        "aria-invalid": state.appearanceTheme.invalid || void 0,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("legend", { className: Section_default.appearanceLegend, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { id: `${themeId}-label`, className: Section_default.rowTitle, children: t("appearanceThemeLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintMark, { hint: t("appearanceThemeHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: `${themeId}-hint`, className: Section_default.appearanceHint, children: t("appearanceThemePreviewHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.appearanceChoices, children: OPENCODE_GO_THEMES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "label",
            {
              className: Section_default.appearanceChoice,
              "data-selected": state.appearanceTheme.text === value,
              "data-disabled": locked,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.appearanceChoiceHead, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(`appearanceTheme_${value}`) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "input",
                    {
                      type: "radio",
                      name: themeId,
                      value,
                      className: Section_default.appearanceRadio,
                      checked: state.appearanceTheme.text === value,
                      disabled: locked,
                      "aria-describedby": themeDescribedBy,
                      onChange: () => {
                        onEdit("appearanceTheme", value);
                      }
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.appearancePreview, style: themeStyle(GO_THEME_TOKENS[value][scheme]), "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `${UsagePill_default.trigger} ${Section_default.appearanceSample}`, children: [
                  t("usageRollingShort"),
                  " 24% \xB7 ",
                  t("usageWeekShort"),
                  " 48%"
                ] }) })
              ]
            },
            value
          )) }),
          state.appearanceTheme.invalid ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: `${themeId}-error`, className: Section_default.rowInvalid, role: "alert", children: t("invalidValue") }) : null
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.appearanceToggle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.appearanceCopy, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.rowLabel, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.rowTitle, children: t("showSidebarQuotaLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintMark, { hint: t("showSidebarQuotaHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.appearanceHint, children: t("showSidebarQuotaSummary") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Switch,
        {
          checked: state.showSidebarQuota.text === "true",
          label: t("showSidebarQuotaLabel"),
          title: t("showSidebarQuotaHint"),
          disabled: locked,
          onChange: (next) => {
            onEdit("showSidebarQuota", String(next));
          }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "fieldset",
      {
        className: Section_default.appearanceStyles,
        role: "radiogroup",
        "aria-labelledby": `${styleId}-label`,
        "aria-describedby": describedBy,
        "aria-invalid": state.usagePillStyle.invalid || void 0,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("legend", { className: Section_default.appearanceLegend, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { id: `${styleId}-label`, className: Section_default.rowTitle, children: t("usagePillStyleLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintMark, { hint: t("usagePillStyleHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: `${styleId}-hint`, className: Section_default.appearanceHint, children: t("usagePillStylePreviewHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.appearanceChoices, children: USAGE_PILL_STYLES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "label",
            {
              className: Section_default.appearanceChoice,
              "data-selected": state.usagePillStyle.text === value,
              "data-disabled": locked,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: Section_default.appearanceChoiceHead, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(`usagePillStyle_${value}`) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "input",
                    {
                      type: "radio",
                      name: styleId,
                      value,
                      className: Section_default.appearanceRadio,
                      checked: state.usagePillStyle.text === value,
                      disabled: locked,
                      "aria-describedby": describedBy,
                      onChange: () => {
                        onEdit("usagePillStyle", value);
                      }
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.appearancePreview, style: themeStyle(tokens), "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `${UsagePill_default.trigger} ${value === "plain" ? UsagePill_default.plain : ""} ${Section_default.appearanceSample}`, children: [
                  t("usageRollingShort"),
                  " 24% \xB7 ",
                  t("usageWeekShort"),
                  " 48%"
                ] }) })
              ]
            },
            value
          )) }),
          state.usagePillStyle.invalid ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: `${styleId}-error`, className: Section_default.rowInvalid, role: "alert", children: t("invalidValue") }) : null
        ]
      }
    )
  ] }) });
}
function ModelSourceStatus({ models, source, t, locale }) {
  const status = models.status === "ready" || models.status === "failed" ? models.sources?.[source] : void 0;
  const busy = models.status === "idle" || models.status === "loading" || models.status === "ready" && models.refreshing;
  const failed = models.status === "failed" || models.status === "ready" && models.stale;
  const label = busy ? t("modelsRefreshingShort") : failed ? t("modelsSourceFailed") : status?.updatedAt === void 0 && status !== void 0 ? t("modelsSourceNeverFetched") : t("modelsSourceCurrent");
  const updated = status?.updatedAt === void 0 ? void 0 : new Date(status.updatedAt);
  const fullTime = updated ? t("modelsSourceUpdated", { time: updated.toLocaleString(locale) }) : void 0;
  const detail = `${t(source === "go" ? "modelsGoSource" : "modelsFreeSource")}: ${label}${fullTime ? `. ${fullTime}` : ""}`;
  const sameDay = updated?.toDateString() === (/* @__PURE__ */ new Date()).toDateString();
  const progressLabel = models.status === "ready" ? t("modelsRefreshing") : t("modelsLoading");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "span",
    {
      className: Section_default.modelSync,
      role: "status",
      "aria-label": busy ? progressLabel : detail,
      "data-state": busy ? "loading" : failed ? "failed" : updated ? "ready" : "idle",
      title: detail,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.modelSyncDot, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }),
        updated && !busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { dateTime: updated.toISOString(), children: updated.toLocaleString(locale, {
          ...sameDay ? {} : { month: "short", day: "numeric" },
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }) }) : null
      ]
    }
  );
}
function ModelsBody({ models, t, source, showProgress = true }) {
  const sources = models.status === "ready" || models.status === "failed" ? models.sources : void 0;
  if (models.status === "failed") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t("modelsFailed") }),
      models.message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: models.message }) : null
    ] });
  }
  if (models.status !== "ready") return showProgress ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, role: "status", "aria-live": "polite", children: t("modelsLoading") }) : null;
  const progress = showProgress && models.refreshing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, role: "status", children: t("modelsRefreshing") }) : null;
  if (models.stale) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    progress,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t("modelsStale") }),
    models.message ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: models.message }) : null
  ] });
  const warnings = (source ? [source] : ["go", "free"]).map((key) => sources?.[key]?.warning).filter((warning) => Boolean(warning));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    progress,
    warnings.map((warning, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, role: "alert", children: warning }, index)),
    models.count === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("modelsEmpty") }) : null
  ] });
}
function OpencodeGoSection(props) {
  const { useOpencodeGo, edit, resetField, save, discard, loadModels, setEnabled, setModelEnabled, t } = props;
  if (useOpencodeGo === void 0 || edit === void 0 || resetField === void 0 || save === void 0 || discard === void 0 || loadModels === void 0 || setEnabled === void 0 || setModelEnabled === void 0 || props.editModelLimits === void 0 || t === void 0 || !props.loadAccounts || !props.addAccount || !props.renameAccount || !props.removeAccount || !props.selectAccount || !props.setAutoSwitch || !props.replaceAccountKey || !props.moveAccount) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    Loaded,
    {
      state: useOpencodeGo((snapshot) => snapshot),
      t,
      locale: props.getLocale?.(),
      edit,
      editModelLimits: props.editModelLimits,
      resetField,
      save,
      discard,
      loadModels,
      setEnabled,
      setModelEnabled,
      accountActions: {
        loadAccounts: props.loadAccounts,
        addAccount: props.addAccount,
        renameAccount: props.renameAccount,
        resetAddition: props.resetAddition,
        removeAccount: props.removeAccount,
        selectAccount: props.selectAccount,
        setAutoSwitch: props.setAutoSwitch,
        replaceAccountKey: props.replaceAccountKey,
        moveAccount: props.moveAccount
      }
    }
  );
}
function Loaded(props) {
  const { t, state, loadModels } = props;
  const tokens = useGoThemeTokens(state.appliedAppearanceTheme);
  const [tab, setTab] = (0, import_react2.useState)("overview");
  const [modelSource, setModelSource] = (0, import_react2.useState)("go");
  const models = modelsForSource(state.models, modelSource);
  const modelNotices = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelsBody, { models, source: modelSource, t }),
    state.pickerFailed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t("pickerFailed") }) : null
  ] });
  (0, import_react2.useEffect)(() => {
    if (state.status === "ready" && state.models.status === "idle") loadModels();
  }, [state.status, state.models.status, loadModels]);
  if (state.status === "loading") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.page, style: themeStyle(tokens), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.intro, role: "status", children: t("settingsLoading") }) });
  }
  if (state.status === "unavailable") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.page, style: themeStyle(tokens), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.intro, children: t("unavailable") }) });
  }
  const disabled = !state.writable;
  const enabledHint = state.enabled ? t("enabledHint") : t("enabledOff");
  const accountCard = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    AccountsCard,
    {
      state: state.accounts,
      actions: props.accountActions,
      writable: state.writable,
      t,
      locale: props.locale
    }
  );
  const fieldProps = {
    invalidLabel: t("invalidValue"),
    disabled
  };
  const advancedOverridden = ADVANCED_FIELDS.some((field) => state[field].overridden);
  const canResetAdvanced = ADVANCED_FIELDS.some((field) => state[field].overridden || state[field].invalid);
  const appearanceOverridden = APPEARANCE_TAB_FIELDS.some((field) => state[field].overridden);
  const canResetAppearance = APPEARANCE_TAB_FIELDS.some((field) => state[field].overridden || state[field].invalid);
  const tabs = [
    { id: "overview", label: t("settingsTabOverview") },
    { id: "models", label: t("settingsTabModels"), marked: state.pickerFailed || state.models.status === "failed" || state.models.status === "ready" && state.models.stale },
    { id: "appearance", label: t("settingsTabAppearance"), marked: appearanceOverridden },
    { id: "advanced", label: t("settingsTabAdvanced"), marked: advancedOverridden }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.page, style: themeStyle(tokens), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.pageBody, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.pageTop, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: Section_default.title, children: t("titleLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.intro, children: t("intro") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.pageTabs, role: "tablist", "aria-label": t("settingsTabsLabel"), children: tabs.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          role: "tab",
          id: `opencode-go-tab-${item.id}`,
          "aria-selected": tab === item.id,
          "aria-controls": `opencode-go-panel-${item.id}`,
          "data-marked": item.marked ? "" : void 0,
          tabIndex: tab === item.id ? 0 : -1,
          className: Section_default.pageTab,
          onClick: () => {
            setTab(item.id);
          },
          onKeyDown: (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? SETTINGS_TABS[0] : event.key === "End" ? SETTINGS_TABS[SETTINGS_TABS.length - 1] : SETTINGS_TABS[(index + (event.key === "ArrowRight" ? 1 : SETTINGS_TABS.length - 1)) % SETTINGS_TABS.length];
            setTab(next);
            document.getElementById(`opencode-go-tab-${next}`)?.focus();
          },
          children: [
            item.label,
            item.marked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.tabMark, title: t("overridden"), "aria-hidden": "true" }) : null
          ]
        },
        item.id
      )) }),
      tab === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.tabPanel, role: "tabpanel", id: "opencode-go-panel-overview", "aria-labelledby": "opencode-go-tab-overview", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: Section_default.card, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.cardHead, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: Section_default.cardTitle, children: [
              t("enabledLabel"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintMark, { hint: enabledHint })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              import_dsh_client_ui_primitives.Switch,
              {
                checked: state.enabled,
                label: t("enabledLabel"),
                title: enabledHint,
                disabled: disabled || state.saving || state.pickerSaving,
                onChange: props.setEnabled
              }
            )
          ] }),
          state.enabledFailed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t("enabledFailed") }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: Section_default.card, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.cardHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: Section_default.cardTitle, children: [
            t("freeEnabledLabel"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintMark, { hint: t("freeEnabledHint") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Switch,
            {
              checked: state.freeEnabled.text === "true",
              label: t("freeEnabledLabel"),
              title: t("freeEnabledHint"),
              disabled: disabled || state.saving,
              onChange: (next) => {
                props.edit("freeEnabled", String(next));
              }
            }
          )
        ] }) }),
        accountCard
      ] }) : null,
      tab === "models" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.tabPanel, role: "tabpanel", id: "opencode-go-panel-models", "aria-labelledby": "opencode-go-tab-models", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: Section_default.cardModels, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.cardHead, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: Section_default.cardTitle, children: t("modelsLabel") }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { id: "opencode-go-models", className: Section_default.cardBody, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.modelToolbar, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.modelTabs, role: "tablist", "aria-label": t("modelSourcesLabel"), children: ["go", "free"].map((source) => {
              const catalog = modelsForSource(state.models, source);
              const status = catalog.status === "ready" || catalog.status === "failed" ? catalog.sources?.[source] : void 0;
              const label = t(source === "go" ? "modelsGoTab" : "modelsFreeTab");
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "button",
                {
                  type: "button",
                  role: "tab",
                  "aria-label": label,
                  title: status?.error ?? status?.warning,
                  id: `opencode-model-tab-${source}`,
                  "aria-selected": modelSource === source,
                  tabIndex: modelSource === source ? 0 : -1,
                  "aria-controls": "opencode-model-panel",
                  className: Section_default.modelTab,
                  onKeyDown: (event) => {
                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const next = event.key === "Home" ? "go" : event.key === "End" ? "free" : source === "go" ? "free" : "go";
                    setModelSource(next);
                    document.getElementById(`opencode-model-tab-${next}`)?.focus();
                  },
                  onClick: () => {
                    setModelSource(source);
                  },
                  children: [
                    label,
                    catalog.status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.modelTabCount, "aria-hidden": "true", children: catalog.count }) : null,
                    status?.error || status?.warning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.modelTabWarning, "aria-hidden": "true" }) : null
                  ]
                },
                source
              );
            }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.modelTools, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelSourceStatus, { models, source: modelSource, t, locale: props.locale }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                import_dsh_client_ui_primitives.Button,
                {
                  variant: "outline",
                  size: "sm",
                  disabled: state.models.status === "loading" || state.models.status === "ready" && state.models.refreshing,
                  onClick: loadModels,
                  children: t("modelsRefresh")
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { role: "tabpanel", id: "opencode-model-panel", className: Section_default.modelPanel, "aria-labelledby": `opencode-model-tab-${modelSource}`, children: [
            modelNotices,
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              ModelEditor,
              {
                source: modelSource,
                models,
                draft: state.modelLimitDraft,
                t,
                locale: props.locale,
                disabled: disabled || state.saving,
                modelVisibility: state.modelVisibility,
                visibilitySaving: state.pickerSaving,
                onModelEnabled: props.setModelEnabled,
                onEdit: props.editModelLimits
              },
              modelSource
            )
          ] })
        ] })
      ] }) }) : null,
      tab === "appearance" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.tabPanel, role: "tabpanel", id: "opencode-go-panel-appearance", "aria-labelledby": "opencode-go-tab-appearance", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: Section_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.cardHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: Section_default.cardTitle, children: t("usageAppearanceLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: Section_default.reset,
              disabled: disabled || state.saving || !canResetAppearance,
              onClick: () => {
                for (const field of APPEARANCE_TAB_FIELDS) {
                  if (state[field].overridden || state[field].invalid) props.resetField(field);
                }
              },
              children: t("usageAppearanceReset")
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.cardBody, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.rows, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-usage-display",
              label: t("usageDisplayLabel"),
              hint: t("usageDisplayHint"),
              field: state.usageDisplay,
              options: USAGE_DISPLAY_MODES.map((value) => ({ value, label: t(`usageDisplay_${value}`) })),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("usageDisplay", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuotaAppearance, { state, t, disabled, onEdit: props.edit })
        ] }) })
      ] }) }) : null,
      tab === "advanced" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.tabPanel, role: "tabpanel", id: "opencode-go-panel-advanced", "aria-labelledby": "opencode-go-tab-advanced", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: Section_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.cardHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: Section_default.cardTitle, children: t("advancedLabel") }),
          advancedOverridden ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "neutral", children: t("overridden") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: Section_default.reset,
              disabled: disabled || state.saving || !canResetAdvanced,
              onClick: () => {
                for (const field of ADVANCED_FIELDS) {
                  if (state[field].overridden || state[field].invalid) props.resetField(field);
                }
              },
              children: t("advancedResetAll")
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.cardBody, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.rows, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.groupHead, children: t("groupConnection") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-base-url",
              label: t("baseURLLabel"),
              hint: t("baseURLHint"),
              field: state.baseURL,
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("baseURL", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-free-base-url",
              label: t("freeBaseURLLabel"),
              hint: t("freeBaseURLHint"),
              field: state.freeBaseURL,
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("freeBaseURL", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-proxy-url",
              label: t("proxyURLLabel"),
              hint: t("proxyURLHint"),
              placeholder: "http://127.0.0.1:7890",
              field: state.proxyURL,
              ...fieldProps,
              invalidLabel: t("proxyURLInvalid"),
              onEdit: (text2) => {
                props.edit("proxyURL", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.groupHead, children: t("groupCacheTimeouts") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-refresh-minutes",
              label: t("refreshMinutesLabel"),
              hint: t("refreshMinutesHint"),
              field: state.refreshMinutes,
              ...numericBounds("refreshMinutes"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("refreshMinutes", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-stream-idle",
              label: t("streamIdleTimeoutMsLabel"),
              hint: t("streamIdleTimeoutMsHint"),
              field: state.streamIdleTimeoutMs,
              ...numericBounds("streamIdleTimeoutMs"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("streamIdleTimeoutMs", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-request-preparation-timeout",
              label: t("requestPreparationTimeoutMsLabel"),
              hint: t("requestPreparationTimeoutMsHint"),
              field: state.requestPreparationTimeoutMs,
              ...numericBounds("requestPreparationTimeoutMs"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("requestPreparationTimeoutMs", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-request-timeout",
              label: t("requestTimeoutMsLabel"),
              hint: t("requestTimeoutMsHint"),
              field: state.requestTimeoutMs,
              ...numericBounds("requestTimeoutMs"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("requestTimeoutMs", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: Section_default.groupHead, children: t("groupImages") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-max-images",
              label: t("maxImagesLabel"),
              hint: t("maxImagesHint"),
              field: state.maxImages,
              ...numericBounds("maxImages"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("maxImages", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-max-request-image-bytes",
              label: t("maxRequestImageBytesLabel"),
              hint: t("maxRequestImageBytesHint"),
              field: state.maxRequestImageBytes,
              ...numericBounds("maxRequestImageBytes"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("maxRequestImageBytes", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-image-pixel-budget",
              label: t("requestImagePixelBudgetLabel"),
              hint: t("requestImagePixelBudgetHint"),
              field: state.requestImagePixelBudget,
              ...numericBounds("requestImagePixelBudget"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("requestImagePixelBudget", text2);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ValueField,
            {
              id: "opencode-go-image-max-bytes",
              label: t("requestImageMaxBytesLabel"),
              hint: t("requestImageMaxBytesHint"),
              field: state.requestImageMaxBytes,
              ...numericBounds("requestImageMaxBytes"),
              ...fieldProps,
              onEdit: (text2) => {
                props.edit("requestImageMaxBytes", text2);
              }
            }
          )
        ] }) })
      ] }) }) : null,
      disabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("readOnly") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.actions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", size: "md", disabled: disabled || !state.dirty || state.invalid || state.saving || state.pickerSaving, onClick: props.save, children: state.saving ? t("saving") : t("save") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "md", disabled: disabled || !state.dirty || state.saving, onClick: props.discard, children: t("discard") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "a",
        {
          className: Section_default.starLink,
          href: "https://github.com/Duskriver/dsh-opencode-go",
          target: "_blank",
          rel: "noopener noreferrer",
          title: t("starProjectTitle"),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("starProject") })
          ]
        }
      ),
      state.failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.failedNote, children: t("savedFailed") }) : null
    ] })
  ] });
}

// src/client/UsagePill.tsx
var import_react4 = require("react");

// src/client/AnalyticsDialog.tsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// plugin-css:src/client/AnalyticsDialog.module.css
var id3 = "dsh-opencode-go/AnalyticsDialog.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id3) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id3;
  style.textContent = ".SgUYaG_shell{border-radius:var(--go-radius-modal);scrollbar-width:thin;gap:0;width:min(1100px,100%);max-height:100%;padding:0;overflow:auto}.SgUYaG_dashboard{color:var(--go-text);background:var(--go-bg);font-family:var(--go-font);flex-shrink:0;padding:26px 32px 24px;font-size:13px;line-height:1.6}.SgUYaG_dashboard,.SgUYaG_dashboard *{box-sizing:border-box}.SgUYaG_dashboard button,.SgUYaG_dashboard select{font:inherit}.SgUYaG_dashboard button{cursor:pointer;color:inherit}.SgUYaG_dashboard button:disabled{cursor:default;opacity:.45}.SgUYaG_dashboard button:focus-visible,.SgUYaG_dashboard select:focus-visible,.SgUYaG_tableScroll:focus-visible{outline:var(--go-focus-width) solid var(--go-accent);outline-offset:3px}.SgUYaG_header{justify-content:space-between;align-items:center;gap:12px;margin-bottom:30px;display:flex}.SgUYaG_brand{font-family:var(--go-display-font);font-size:23px;font-weight:var(--go-display-weight);letter-spacing:var(--go-display-tracking);align-items:center;gap:11px;display:flex}.SgUYaG_brandIcon{background:var(--go-accent-soft);border-radius:var(--go-radius-control);width:33px;height:33px;color:var(--go-accent);flex:none;place-items:center;display:grid}.SgUYaG_brandIcon svg,.SgUYaG_iconButton svg,.SgUYaG_exportButton svg{width:17px;height:17px}.SgUYaG_iconButton{border-radius:var(--go-radius-control);background:0 0;border:0;place-items:center;width:34px;height:34px;padding:7px;display:inline-grid}.SgUYaG_iconButton:hover{background:var(--go-surface-2)}.SgUYaG_heading{justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px;display:flex}.SgUYaG_heading h1{font-family:var(--go-display-font);font-size:30px;line-height:1.3;font-weight:var(--go-display-weight);letter-spacing:var(--go-display-tracking);margin:0 0 8px}.SgUYaG_heading p,.SgUYaG_sectionHead p{color:var(--go-muted);margin:0;font-size:12px}.SgUYaG_source{color:var(--go-muted);white-space:nowrap;align-items:center;gap:7px;font-size:11px;display:flex}.SgUYaG_source i{background:var(--go-success);border-radius:50%;width:5px;height:5px}.SgUYaG_toolbar{flex-wrap:wrap;align-items:center;gap:10px;padding:0;display:flex}.SgUYaG_accountSelect{align-items:center;gap:9px;min-width:0;display:flex}.SgUYaG_accountSelect>span{color:var(--go-muted);font-size:12px}.SgUYaG_accountSelect select{color:var(--go-text);background:var(--go-surface);border:1px solid var(--go-border-strong);border-radius:var(--go-radius-control);text-overflow:ellipsis;min-width:0;max-width:205px;height:34px;padding:0 26px 0 10px}.SgUYaG_rangeGroup,.SgUYaG_segmented{align-items:center;gap:3px;display:inline-flex}.SgUYaG_rangeGroup{margin-left:auto}.SgUYaG_rangeGroup button,.SgUYaG_segmented button{border-radius:var(--go-radius-option);min-height:31px;color:var(--go-muted);white-space:nowrap;background:0 0;border:0;padding:5px 10px;font-size:12px}.SgUYaG_rangeGroup button:hover,.SgUYaG_segmented button:hover{color:var(--go-text)}.SgUYaG_rangeGroup button[aria-pressed=true],.SgUYaG_segmented button[aria-pressed=true]{background:var(--go-surface-2);color:var(--go-text)}.SgUYaG_utc{color:var(--go-muted);font-size:11px;font-family:var(--go-number-font)}.SgUYaG_toolbarActions{align-items:center;gap:7px;display:flex}.SgUYaG_dashboard .SgUYaG_exportButton{border:1px solid var(--go-border-strong);background:var(--go-surface);border-radius:var(--go-radius-control);align-items:center;gap:7px;min-height:34px;padding:6px 11px;font-size:12px;display:inline-flex}.SgUYaG_exportButton:hover{background:var(--go-surface-2)}.SgUYaG_statusRow{min-height:35px;color:var(--go-muted);flex-wrap:wrap;justify-content:space-between;gap:5px 14px;padding:8px 0;font-size:11px;display:flex}.SgUYaG_kpis{grid-template-columns:repeat(4,minmax(0,1fr));margin:12px 0 27px;display:grid}.SgUYaG_kpis>div{border-left:1px solid var(--go-border);flex-direction:column;min-width:0;padding:0 20px;display:flex}.SgUYaG_kpis>div:first-child{border-left:0;padding-left:0}.SgUYaG_kpis>div:last-child{padding-right:0}.SgUYaG_kpis>div>span{color:var(--go-muted);font-size:12px}.SgUYaG_kpis strong{font:400 clamp(24px, 2.6vw, 32px)/1.5 var(--go-number-font);font-variant-numeric:tabular-nums;letter-spacing:-.055em;white-space:nowrap;text-overflow:ellipsis;display:block;overflow:hidden}.SgUYaG_kpis strong em{margin-left:2px;font-size:18px;font-style:normal}.SgUYaG_kpis small{color:var(--go-muted);font-size:11px}.SgUYaG_amountKpi strong{color:var(--go-text)}.SgUYaG_quotaStrip{border-block:1px solid var(--go-border);grid-template-columns:repeat(3,minmax(0,1fr));gap:9px 24px;padding:17px 0 19px;display:grid}.SgUYaG_quotaTitle{color:var(--go-muted);grid-column:1/-1;font-size:11px}.SgUYaG_quotaWindow{min-width:0}.SgUYaG_quotaWindow>span{color:var(--go-muted);justify-content:space-between;gap:10px;font-size:12px;display:flex}.SgUYaG_quotaWindow b{font-weight:400;font-family:var(--go-number-font);color:var(--go-text);font-variant-numeric:tabular-nums}.SgUYaG_quotaWindow progress{appearance:none;background:var(--go-surface-2);--go-progress:var(--go-accent);width:100%;height:5px;accent-color:var(--go-progress);border:0;border-radius:99px;margin-top:8px;display:block;overflow:hidden}.SgUYaG_quotaWindow progress::-webkit-progress-bar{background:var(--go-surface-2)}.SgUYaG_quotaWindow progress::-webkit-progress-value{background:var(--go-progress);border-radius:99px}.SgUYaG_quotaWindow progress::-moz-progress-bar{background:var(--go-progress);border-radius:99px}.SgUYaG_quotaWindow[data-level=high] progress{--go-progress:var(--go-warning)}.SgUYaG_quotaWindow[data-level=limited] progress{--go-progress:var(--go-danger)}.SgUYaG_quotaUnavailable{color:var(--go-muted);margin:0;font-size:12px}.SgUYaG_sectionHead{justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px;display:flex}.SgUYaG_sectionHead h2{font-family:var(--go-display-font);margin:0 0 4px;font-size:18px;font-weight:500}.SgUYaG_sectionHead>span{color:var(--go-muted);font-size:11px}.SgUYaG_trend,.SgUYaG_models,.SgUYaG_details{margin-top:6px;padding-top:27px}.SgUYaG_models,.SgUYaG_details{border-top:1px solid var(--go-border);margin-top:24px}.SgUYaG_legend{color:var(--go-muted);flex-wrap:wrap;gap:16px;margin-bottom:16px;font-size:11px;display:flex}.SgUYaG_legend span{align-items:center;gap:6px;display:inline-flex}.SgUYaG_legend i{border-radius:2px;width:7px;height:7px}.SgUYaG_dashboard [data-part=inputTokens],.SgUYaG_dashboard [data-part=requests]{background:var(--go-accent)}.SgUYaG_dashboard [data-part=outputTokens]{background:var(--go-accent-2)}.SgUYaG_dashboard [data-part=cacheReadTokens]{background:var(--go-cache-read)}.SgUYaG_dashboard [data-part=cacheWriteTokens]{background:var(--go-cache-write)}.SgUYaG_chartScroll{scrollbar-width:thin;scrollbar-color:var(--go-border) transparent;overflow-x:auto}.SgUYaG_chart{grid-template-rows:210px 31px;grid-template-columns:64px 1fr;padding-top:6px;display:grid}.SgUYaG_yAxis{color:var(--go-muted);font:11px var(--go-number-font);white-space:nowrap;flex-direction:column;grid-column:1;justify-content:space-between;padding-right:9px;display:flex}.SgUYaG_plot{isolation:isolate;grid-column:2;gap:4px;display:grid;position:relative}.SgUYaG_gridlines{pointer-events:none;z-index:-1;flex-direction:column;justify-content:space-between;display:flex;position:absolute;inset:0}.SgUYaG_gridlines i{border-top:1px solid var(--go-border);width:100%}.SgUYaG_dayBar{background:0 0;border:0;border-radius:3px;flex-direction:column;justify-content:flex-end;align-items:stretch;min-width:0;height:100%;padding:0;display:flex;position:relative}.SgUYaG_dayBar:hover,.SgUYaG_dayBar[data-selected=true]{background:var(--go-accent-soft)}.SgUYaG_barStack{opacity:.88;border-radius:3px 3px 0 0;flex-direction:column-reverse;width:100%;min-height:0;transition:opacity .12s;display:flex;overflow:hidden}.SgUYaG_dayBar[data-selected=true] .SgUYaG_barStack,.SgUYaG_dayBar:hover .SgUYaG_barStack{opacity:1}.SgUYaG_barStack i{min-height:0;display:block}.SgUYaG_zeroDot{background:var(--go-border);z-index:-1;width:100%;height:2px;position:absolute;bottom:0}.SgUYaG_xAxis{color:var(--go-muted);grid-column:2;justify-content:space-between;padding-top:10px;font-size:11px;display:flex}.SgUYaG_dayDetail{background:var(--go-surface-2);border-radius:var(--go-radius-control);flex-wrap:wrap;align-items:center;gap:20px;min-height:68px;margin-top:12px;padding:14px 16px;display:flex}.SgUYaG_dayDetail>div{flex-direction:column;margin-right:auto;display:flex}.SgUYaG_dayDetail strong{font-size:13px;font-weight:500}.SgUYaG_dayDetail small,.SgUYaG_dayDetail>span{color:var(--go-muted);font-size:11px}.SgUYaG_dayDetail b{font:400 12px var(--go-number-font);color:var(--go-text);margin-top:4px;display:block}.SgUYaG_dayDetail p{color:var(--go-muted);margin:0;font-size:12px}.SgUYaG_rankList{flex-direction:column;gap:16px;display:flex}.SgUYaG_rankRow{grid-template-columns:24px minmax(145px,1fr) minmax(60px,1.8fr) 88px 48px;align-items:center;gap:14px;display:grid}.SgUYaG_rankIndex{color:var(--go-muted);font:11px var(--go-number-font)}.SgUYaG_rankIdentity{flex-direction:column;min-width:0;display:flex}.SgUYaG_rankIdentity>span{text-overflow:ellipsis;white-space:nowrap;font-size:13px;overflow:hidden}.SgUYaG_rankIdentity>small{color:var(--go-muted);font-size:11px}.SgUYaG_rankTrack{background:var(--go-surface-2);border-radius:99px;height:5px;overflow:hidden}.SgUYaG_rankTrack i{background:var(--go-accent);border-radius:inherit;height:100%;display:block}.SgUYaG_rankRow>b,.SgUYaG_rankRow>small{font-family:var(--go-number-font);text-align:right}.SgUYaG_rankRow>b{font-size:12px;font-weight:400}.SgUYaG_rankRow>small{color:var(--go-muted);font-size:11px}.SgUYaG_dashboard .SgUYaG_expandButton{color:var(--go-accent);background:0 0;border:0;margin:16px auto 0;padding:6px 9px;font-size:12px;display:block}.SgUYaG_tableScroll{scrollbar-width:thin;scrollbar-color:var(--go-border) transparent;overflow:auto}.SgUYaG_details table{border-collapse:collapse;width:100%;min-width:890px;font-size:12px}.SgUYaG_details th{color:var(--go-muted);text-align:right;border-bottom:1px solid var(--go-border);white-space:nowrap;padding:9px 10px;font-weight:400}.SgUYaG_details th:first-child{text-align:left;padding-left:0}.SgUYaG_details th button{color:inherit;background:0 0;border:0;padding:3px 0}.SgUYaG_details td{text-align:right;border-bottom:1px solid var(--go-border);font-family:var(--go-number-font);white-space:nowrap;padding:13px 10px}.SgUYaG_details td:first-child{text-align:left;padding-left:0;font-family:inherit}.SgUYaG_details td strong{font-weight:500;display:block}.SgUYaG_details td small{color:var(--go-muted);font-size:11px}.SgUYaG_details tbody tr:hover{background:var(--go-surface-2)}.SgUYaG_footer{color:var(--go-muted);flex-direction:column;gap:5px;margin-top:24px;font-size:11px;display:flex}.SgUYaG_notice{background:color-mix(in srgb, var(--go-warning) 8%, var(--go-bg));color:var(--go-text);border:1px solid color-mix(in srgb, var(--go-warning) 35%, var(--go-border));border-radius:var(--go-radius-control);justify-content:space-between;align-items:center;gap:15px;margin:0 0 18px;padding:12px 14px;font-size:12px;display:flex}.SgUYaG_notice button{color:var(--go-accent);white-space:nowrap;background:0 0;border:0;padding:4px}.SgUYaG_state{min-height:240px;color:var(--go-muted);flex-direction:column;justify-content:center;align-items:center;display:flex}.SgUYaG_state>svg,.SgUYaG_empty>svg{opacity:.5;width:30px;height:30px}.SgUYaG_empty{color:var(--go-muted);justify-content:center;align-items:center;gap:12px;padding:20px 0 0;font-size:12px;display:flex}.SgUYaG_spinner{border:2px solid var(--go-border);border-top-color:var(--go-accent);border-radius:50%;width:20px;height:20px;animation:.8s linear infinite SgUYaG_spin}@keyframes SgUYaG_spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.SgUYaG_spinner{animation:none}.SgUYaG_barStack{transition:none}}@media (width<=760px){.SgUYaG_shell{inset:var(--dsh-frame-overlay-top,0px) 0 0;border-radius:0;flex-shrink:0;width:auto;max-width:none;height:auto;max-height:none;position:fixed}.SgUYaG_dashboard{min-height:100%;padding:22px 20px}.SgUYaG_header{margin-bottom:25px}.SgUYaG_heading{margin-bottom:21px}.SgUYaG_heading h1{font-size:27px}.SgUYaG_heading .SgUYaG_source{display:none}.SgUYaG_toolbar{gap:8px}.SgUYaG_accountSelect{flex:1;min-width:120px}.SgUYaG_accountSelect select{width:100%;max-width:100%}.SgUYaG_accountSelect>span{display:none}.SgUYaG_toolbarActions{margin-left:auto}.SgUYaG_rangeGroup{order:3;margin-left:0}.SgUYaG_utc{order:4}.SgUYaG_kpis{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:22px}.SgUYaG_kpis>div{padding:0 18px}.SgUYaG_kpis>div:nth-child(3){border-left:0;padding-left:0}.SgUYaG_kpis strong{font-size:28px}.SgUYaG_quotaStrip{gap:10px 16px}.SgUYaG_sectionHead{flex-wrap:wrap;align-items:flex-start;gap:10px}.SgUYaG_dayDetail{gap:13px 20px}.SgUYaG_dayDetail>div{width:100%}.SgUYaG_rankRow{grid-template-columns:20px minmax(120px,1fr) minmax(30px,1fr) 74px;gap:10px}.SgUYaG_rankRow>small{display:none}}@media (width<=420px){.SgUYaG_dashboard{padding-inline:16px}.SgUYaG_rangeGroup button{padding-inline:9px}.SgUYaG_kpis strong{font-size:25px}.SgUYaG_quotaStrip{grid-template-columns:minmax(0,1fr)}.SgUYaG_quotaWindow{grid-template-columns:95px minmax(0,1fr);align-items:center;gap:12px;display:grid}.SgUYaG_quotaWindow progress{margin:0}.SgUYaG_rankRow{grid-template-columns:18px minmax(0,1fr) 70px;gap:9px}.SgUYaG_rankTrack{display:none}}@media (pointer:coarse){.SgUYaG_iconButton,.SgUYaG_exportButton,.SgUYaG_rangeGroup button,.SgUYaG_segmented button,.SgUYaG_accountSelect select,.SgUYaG_expandButton{min-height:44px}.SgUYaG_iconButton{min-width:44px}}";
  document.head.appendChild(style);
}
var AnalyticsDialog_default = { "accountSelect": "SgUYaG_accountSelect", "amountKpi": "SgUYaG_amountKpi", "barStack": "SgUYaG_barStack", "brand": "SgUYaG_brand", "brandIcon": "SgUYaG_brandIcon", "chart": "SgUYaG_chart", "chartScroll": "SgUYaG_chartScroll", "dashboard": "SgUYaG_dashboard", "dayBar": "SgUYaG_dayBar", "dayDetail": "SgUYaG_dayDetail", "details": "SgUYaG_details", "empty": "SgUYaG_empty", "expandButton": "SgUYaG_expandButton", "exportButton": "SgUYaG_exportButton", "footer": "SgUYaG_footer", "gridlines": "SgUYaG_gridlines", "header": "SgUYaG_header", "heading": "SgUYaG_heading", "iconButton": "SgUYaG_iconButton", "kpis": "SgUYaG_kpis", "legend": "SgUYaG_legend", "models": "SgUYaG_models", "notice": "SgUYaG_notice", "plot": "SgUYaG_plot", "quotaStrip": "SgUYaG_quotaStrip", "quotaTitle": "SgUYaG_quotaTitle", "quotaUnavailable": "SgUYaG_quotaUnavailable", "quotaWindow": "SgUYaG_quotaWindow", "rangeGroup": "SgUYaG_rangeGroup", "rankIdentity": "SgUYaG_rankIdentity", "rankIndex": "SgUYaG_rankIndex", "rankList": "SgUYaG_rankList", "rankRow": "SgUYaG_rankRow", "rankTrack": "SgUYaG_rankTrack", "sectionHead": "SgUYaG_sectionHead", "segmented": "SgUYaG_segmented", "shell": "SgUYaG_shell", "source": "SgUYaG_source", "spin": "SgUYaG_spin", "spinner": "SgUYaG_spinner", "state": "SgUYaG_state", "statusRow": "SgUYaG_statusRow", "tableScroll": "SgUYaG_tableScroll", "toolbar": "SgUYaG_toolbar", "toolbarActions": "SgUYaG_toolbarActions", "trend": "SgUYaG_trend", "utc": "SgUYaG_utc", "xAxis": "SgUYaG_xAxis", "yAxis": "SgUYaG_yAxis", "zeroDot": "SgUYaG_zeroDot" };

// src/client/AnalyticsDialog.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var RANGES = ["today", "7d", "30d", "90d"];
var RANGE_LABELS = { today: "analyticsRangeToday", "7d": "analyticsRange7d", "30d": "analyticsRange30d", "90d": "analyticsRange90d" };
var PARTS = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"];
var LABELS = {
  inputTokens: "analyticsInput",
  outputTokens: "analyticsOutput",
  cacheReadTokens: "analyticsCacheRead",
  cacheWriteTokens: "analyticsCacheWrite"
};
var WINDOW_LABELS = { rolling: "usage_rolling", weekly: "usage_weekly", monthly: "usage_monthly" };
function historyNumber(value, locale, compact = false) {
  return new Intl.NumberFormat(locale, compact ? { notation: "compact", maximumFractionDigits: 1 } : {}).format(BigInt(value));
}
function historyMoney(value, locale) {
  const raw = BigInt(value), digits = raw < 10000000n ? 4 : 2;
  const unit = 10n ** BigInt(8 - digits), base = 10n ** BigInt(digits);
  const rounded = (raw + unit / 2n) / unit;
  const fraction = String(rounded % base).padStart(digits, "0");
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).formatToParts(rounded / base).map((part) => part.type === "fraction" ? fraction : part.value).join("");
}
function percent(part, total) {
  return BigInt(total) === 0n ? 0 : Number(BigInt(part) * 100000n / BigInt(total)) / 1e3;
}
function metricText(row, metric, locale) {
  return metric === "costMicroCents" ? historyMoney(row[metric], locale) : historyNumber(row[metric], locale, true);
}
function dayText(day, locale) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(day + "T00:00:00Z"));
}
function errorDetails(error) {
  return error && typeof error === "object" && "code" in error && error.code === "opencode-go/analytics-unavailable" && "details" in error && error.details && typeof error.details === "object" ? error.details : {};
}
function errorText(error, t) {
  const reason = errorDetails(error).reason;
  if (reason === "permission-denied") return t("analyticsPermission");
  if (reason === "missing-credential" || reason === "credential-unavailable" || reason === "unknown-account") return t("analyticsCredentials");
  if (reason === "unsupported-gateway") return t("analyticsUnsupported");
  if (reason === "invalid-response") return t("analyticsInvalid");
  return t("analyticsFailed");
}
function Icon({ name }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: name === "close" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "m5 5 10 10M15 5 5 15" }) : name === "refresh" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M16.5 9A6.5 6.5 0 1 1 14 4.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M16.5 3v4h-4" })
  ] }) : name === "download" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M10 3v9m-3-3 3 3 3-3M4 13v4h12v-4" }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 3v14h14M6 13V9m4 4V5m4 8V7" }) }) });
}
function AnalyticsDialog(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Modal, { open: props.open, onClose: props.onClose, title: props.t("analyticsTitle"), headless: true, className: AnalyticsDialog_default.shell, children: props.open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Dashboard, { ...props }, props.contextKey) : null });
}
function Dashboard({ activeRef, accounts, readAnalytics, exportAnalytics, readQuota, onClose, t, getLocale, theme = DEFAULT_OPENCODE_GO_THEME }) {
  const [selected, setSelected] = (0, import_react3.useState)(activeRef);
  const accountRef = accounts.some((a) => a.apiKeyEnv === selected) ? selected : accounts.find((a) => a.apiKeyEnv === activeRef)?.apiKeyEnv ?? accounts[0]?.apiKeyEnv ?? "";
  const [range, setRange] = (0, import_react3.useState)("30d"), [revision, setRevision] = (0, import_react3.useState)(0);
  const [snapshot, setSnapshot] = (0, import_react3.useState)(null);
  const [failure, setFailure] = (0, import_react3.useState)(null);
  const [loading, setLoading] = (0, import_react3.useState)(false);
  const [quota, setQuota] = (0, import_react3.useState)(null), [quotaFailed, setQuotaFailed] = (0, import_react3.useState)(false);
  const [exporting, setExporting] = (0, import_react3.useState)(false), [exportFailed, setExportFailed] = (0, import_react3.useState)(false);
  const force = (0, import_react3.useRef)(false), exporter = (0, import_react3.useRef)(null);
  const readers = (0, import_react3.useRef)({ readAnalytics, readQuota, exportAnalytics });
  readers.current = { readAnalytics, readQuota, exportAnalytics };
  const tokens = useGoThemeTokens(theme), locale = getLocale?.();
  const key = JSON.stringify([accountRef, range]), report = snapshot?.key === key ? snapshot.value : null, error = failure?.key === key ? failure.error : null;
  (0, import_react3.useEffect)(() => {
    if (!accountRef) {
      setLoading(false);
      setSnapshot(null);
      setFailure(null);
      return;
    }
    const controller = new AbortController();
    let stopped = false;
    const query = { accountRef, range, ...force.current ? { refresh: true } : {} };
    force.current = false;
    setLoading(true);
    setFailure(null);
    void readers.current.readAnalytics(query, controller.signal).then((next) => {
      if (stopped) return;
      if (next.accountRef !== accountRef || next.period !== range) throw new Error("History identity mismatch");
      setSnapshot({ key, value: next });
    }).catch((reason) => {
      if (stopped || controller.signal.aborted) return;
      const details = errorDetails(reason);
      setSnapshot((previous) => details.retryable === true && details.retainPrevious === true && previous?.key === key && previous.value.source === details.source ? previous : null);
      setFailure({ key, error: reason });
    }).finally(() => {
      if (!stopped) setLoading(false);
    });
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [accountRef, range, revision, key]);
  (0, import_react3.useEffect)(() => {
    setQuota(null);
    setQuotaFailed(false);
    if (!accountRef || !readers.current.readQuota) return;
    let stopped = false;
    void readers.current.readQuota(accountRef).then((value) => {
      if (!stopped) setQuota({ ref: accountRef, value });
    }, () => {
      if (!stopped) setQuotaFailed(true);
    });
    return () => {
      stopped = true;
    };
  }, [accountRef, revision]);
  (0, import_react3.useEffect)(() => {
    setExporting(false);
    setExportFailed(false);
    return () => {
      exporter.current?.abort();
    };
  }, [accountRef, range]);
  const refresh = () => {
    force.current = true;
    setRevision((value) => value + 1);
  };
  const download = async () => {
    if (!readers.current.exportAnalytics || exporting || !accountRef) return;
    const controller = new AbortController();
    exporter.current = controller;
    setExporting(true);
    setExportFailed(false);
    try {
      const result = await readers.current.exportAnalytics({ accountRef, range }, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" })), anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1e3);
    } catch {
      if (!controller.signal.aborted) setExportFailed(true);
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.dashboard, style: themeStyle(tokens), "aria-busy": loading, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: AnalyticsDialog_default.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.brand, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: AnalyticsDialog_default.brandIcon, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: "chart" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("titleLabel") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: AnalyticsDialog_default.iconButton, onClick: onClose, "aria-label": t("analyticsClose"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: "close" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.heading, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h1", { children: t("analyticsTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("analyticsSubtitle") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: AnalyticsDialog_default.source, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", {}),
        t("analyticsKicker")
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.toolbar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: AnalyticsDialog_default.accountSelect, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("analyticsAccount") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("select", { "aria-label": t("analyticsAccount"), value: accountRef, onChange: (event) => {
          setSelected(event.target.value);
        }, disabled: !accounts.length, children: accounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: a.apiKeyEnv, children: a.name || t("accountDefault") }, a.apiKeyEnv)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.rangeGroup, role: "group", "aria-label": t("analyticsRange"), children: RANGES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", "aria-pressed": value === range, onClick: () => {
        setRange(value);
      }, children: t(RANGE_LABELS[value]) }, value)) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: AnalyticsDialog_default.utc, children: "UTC" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.toolbarActions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: AnalyticsDialog_default.iconButton, onClick: refresh, disabled: loading || !accountRef, "aria-label": t("analyticsRefresh"), title: t("analyticsRefresh"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: "refresh" }) }),
        exportAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: AnalyticsDialog_default.exportButton, onClick: () => {
          void download();
        }, disabled: exporting || !report, title: t("analyticsExportHint"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: "download" }),
          exporting ? t("analyticsExporting") : t("analyticsExport")
        ] }) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.statusRow, "aria-live": "polite", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: report ? `${t("analyticsRefreshed")} ${new Date(report.generatedAt).toLocaleTimeString(locale, { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC` : "" }),
      loading && report ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("analyticsRefreshing") }) : null
    ] }),
    exportFailed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: AnalyticsDialog_default.notice, role: "alert", children: t("analyticsExportFailed") }) : null,
    !accountRef ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.state, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: "chart" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("analyticsNoAccounts") })
    ] }) : null,
    error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.notice, role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: report ? t("analyticsStale") : errorText(error, t) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: refresh, disabled: loading, children: t("analyticsRetry") })
    ] }) : null,
    loading && !report && accountRef ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.state, role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: AnalyticsDialog_default.spinner }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("analyticsLoading") })
    ] }) : null,
    report ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Kpis, { report, t, locale }) : null,
    quota?.ref === accountRef ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(QuotaStrip, { quota: quota.value, t, locale }) : quotaFailed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: AnalyticsDialog_default.quotaUnavailable, children: t("analyticsQuotaFailed") }) : null,
    report ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      report.totals.requests === "0" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.empty, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: "chart" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("analyticsEmpty") })
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Trend, { days: report.byDay, t, locale }, key),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Models, { rows: report.byModel, totals: report.totals, t, locale })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("footer", { className: AnalyticsDialog_default.footer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("analyticsKicker"),
        " \xB7 ",
        t("analyticsLagHint")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("analyticsAmountHint") })
    ] })
  ] });
}
function Kpis({ report, t, locale }) {
  const c = report.totals, days = Math.max(1, report.byDay.length), input = String(BigInt(c.inputTokens) + BigInt(c.cacheReadTokens) + BigInt(c.cacheWriteTokens));
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: AnalyticsDialog_default.kpis, "aria-label": t("analyticsSubtitle"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("analyticsRequests") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: historyNumber(c.requests, locale) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("small", { children: [
        t("analyticsDailyAverage"),
        " ",
        historyNumber(String(BigInt(c.requests) / BigInt(days)), locale),
        " / ",
        t("analyticsPerDay")
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("analyticsTokens") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { title: historyNumber(c.tokens, locale), children: historyNumber(c.tokens, locale, true) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("small", { children: [
        report.byModel.length,
        " ",
        t("analyticsModels"),
        " \xB7 ",
        report.byDay.filter((d) => d.requests !== "0").length,
        " ",
        t("analyticsActiveDays")
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("analyticsCacheHit") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("strong", { children: [
        percent(c.cacheReadTokens, input).toFixed(1),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("em", { children: "%" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("small", { children: [
        historyNumber(c.cacheReadTokens, locale, true),
        " ",
        t("analyticsCacheRead")
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.amountKpi, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("analyticsSpend") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: historyMoney(c.costMicroCents, locale) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("small", { children: [
        "USD \xB7 ",
        t("analyticsKicker")
      ] })
    ] })
  ] });
}
function QuotaStrip({ quota, t, locale }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: AnalyticsDialog_default.quotaStrip, "aria-label": t("analyticsQuota"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: AnalyticsDialog_default.quotaTitle, children: t("analyticsQuota") }),
    ["rolling", "weekly", "monthly"].map((key) => {
      const item = quota[key];
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.quotaWindow, "data-level": item.status === "rate-limited" || item.percent >= 100 ? "limited" : item.percent >= 80 ? "high" : "ok", title: `${t("usageResets")} ${new Date(item.resetsAt).toLocaleString(locale, { timeZone: "UTC" })} UTC`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          t(WINDOW_LABELS[key]),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("b", { children: [
            item.percent,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("progress", { max: 100, value: item.percent, "aria-label": t(WINDOW_LABELS[key]) })
      ] }, key);
    })
  ] });
}
function Trend({ days, t, locale }) {
  const [mode, setMode] = (0, import_react3.useState)("tokens"), [active, setActive] = (0, import_react3.useState)(null), [pinned, setPinned] = (0, import_react3.useState)(null);
  const buttons = (0, import_react3.useRef)([]);
  const maximum = days.reduce((max, day) => BigInt(day[mode]) > max ? BigInt(day[mode]) : max, 0n), selected = days[active ?? pinned ?? -1];
  const focusDay = (index) => {
    const next = Math.max(0, Math.min(days.length - 1, index));
    setActive(next);
    buttons.current[next]?.focus();
  };
  const keyboard = (event, index) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      focusDay(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusDay(event.key === "Home" ? 0 : days.length - 1);
    }
    if (event.key === "Escape" && (pinned !== null || active !== null)) {
      event.stopPropagation();
      setPinned(null);
      setActive(null);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: AnalyticsDialog_default.trend, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.sectionHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("analyticsByDay") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("analyticsTrendHint") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.segmented, role: "group", "aria-label": t("analyticsByDay"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", "aria-pressed": mode === "tokens", onClick: () => {
          setMode("tokens");
        }, children: t("analyticsTokensMode") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", "aria-pressed": mode === "requests", onClick: () => {
          setMode("requests");
        }, children: t("analyticsRequestsMode") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.legend, children: mode === "tokens" ? PARTS.map((part) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { "data-part": part }),
      t(LABELS[part])
    ] }, part)) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { "data-part": "requests" }),
      t("analyticsRequests")
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.chartScroll, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.chart, style: { minWidth: `${Math.max(380, days.length * 11)}px` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.yAxis, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: historyNumber(String(maximum), locale, true) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: historyNumber(String(maximum / 2n), locale, true) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "0" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.plot, role: "group", "aria-label": t("analyticsChartHelp"), style: { gridTemplateColumns: `repeat(${Math.max(1, days.length)}, minmax(3px, 1fr))` }, onPointerLeave: () => {
        setActive(pinned);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.gridlines, "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", {}),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", {}),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", {})
        ] }),
        days.map((day, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            ref: (node) => {
              buttons.current[index] = node;
            },
            className: AnalyticsDialog_default.dayBar,
            "data-day": day.day,
            "data-selected": selected?.day === day.day || void 0,
            "aria-pressed": pinned === index,
            tabIndex: index === (active ?? pinned ?? days.length - 1) ? 0 : -1,
            "aria-label": `${day.day} \xB7 ${historyNumber(day.requests, locale)} ${t("analyticsRequests")} \xB7 ${historyNumber(day.tokens, locale)} ${t("analyticsTokens")}`,
            onPointerEnter: () => {
              setActive(index);
            },
            onFocus: () => {
              setActive(index);
            },
            onKeyDown: (event) => {
              keyboard(event, index);
            },
            onClick: () => {
              setPinned(pinned === index ? null : index);
              setActive(index);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: AnalyticsDialog_default.barStack, style: { height: `${Math.max(day[mode] === "0" ? 0 : 0.6, percent(day[mode], String(maximum)))}%` }, children: mode === "requests" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { "data-part": "requests", style: { flex: 1 } }) : PARTS.map((part) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { "data-part": part, style: { flex: percent(day[part], day.tokens) } }, part)) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: AnalyticsDialog_default.zeroDot })
            ]
          },
          day.day
        ))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.xAxis, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: days[0] ? dayText(days[0].day, locale) : "\u2014" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: days.length > 2 ? dayText(days[Math.floor(days.length / 2)].day, locale) : "" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: days.length > 1 ? dayText(days.at(-1).day, locale) : "" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.dayDetail, "aria-live": pinned === null ? "off" : "polite", children: selected ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: dayText(selected.day, locale) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: "UTC" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("analyticsRequests"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: historyNumber(selected.requests, locale) })
      ] }),
      PARTS.map((part) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t(LABELS[part]),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: historyNumber(selected[part], locale, true) })
      ] }, part)),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("analyticsSpend"),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: historyMoney(selected.costMicroCents, locale) })
      ] })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("analyticsSelectDay") }) })
  ] });
}
function Models({ rows, totals, t, locale }) {
  const [metric, setMetric] = (0, import_react3.useState)("tokens"), [expanded, setExpanded] = (0, import_react3.useState)(false), [sort, setSort] = (0, import_react3.useState)({ field: "tokens", ascending: false });
  const compare = (a, b, field, asc = false) => {
    const left = BigInt(a[field]), right = BigInt(b[field]);
    return (left === right ? a.model.localeCompare(b.model) || a.provider.localeCompare(b.provider) : left > right ? -1 : 1) * (asc ? -1 : 1);
  };
  const ranked = [...rows].sort((a, b) => compare(a, b, metric)), visible = expanded ? ranked : ranked.slice(0, 6);
  const fields = [
    ["requests", "analyticsRequests"],
    ["tokens", "analyticsTokens"],
    ["inputTokens", "analyticsInput"],
    ["outputTokens", "analyticsOutput"],
    ["cacheReadTokens", "analyticsCacheRead"],
    ["cacheWriteTokens", "analyticsCacheWrite"],
    ["costMicroCents", "analyticsSpend"]
  ];
  const METRIC_LABELS = { tokens: "analyticsTokens", requests: "analyticsRequests", costMicroCents: "analyticsSpend" };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: AnalyticsDialog_default.models, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.sectionHead, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("analyticsByModel") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t("analyticsRankingHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.segmented, role: "group", "aria-label": t("analyticsByModel"), children: ["tokens", "requests", "costMicroCents"].map((value) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", "aria-pressed": metric === value, onClick: () => {
          setMetric(value);
        }, children: t(METRIC_LABELS[value]) }, value)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.rankList, children: visible.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.rankRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: AnalyticsDialog_default.rankIndex, children: String(index + 1).padStart(2, "0") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.rankIdentity, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: row.model }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: row.provider })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.rankTrack, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { style: { width: `${percent(row[metric], ranked[0]?.[metric] ?? "0")}%` } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("b", { children: metricText(row, metric, locale) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("small", { children: [
          percent(row[metric], totals[metric]).toFixed(1),
          "%"
        ] })
      ] }, JSON.stringify([row.provider, row.model]))) }),
      rows.length > 6 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: AnalyticsDialog_default.expandButton, onClick: () => {
        setExpanded((value) => !value);
      }, children: expanded ? t("analyticsFewerModels") : `${t("analyticsAllModels")} (${rows.length})` }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: AnalyticsDialog_default.details, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: AnalyticsDialog_default.sectionHead, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("analyticsDetails") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          rows.length,
          " ",
          t("analyticsModels")
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: AnalyticsDialog_default.tableScroll, tabIndex: 0, role: "region", "aria-label": t("analyticsDetails"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("table", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { children: t("analyticsModel") }),
          fields.map(([field, label]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { "aria-sort": sort.field === field ? sort.ascending ? "ascending" : "descending" : "none", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", onClick: () => {
            setSort({ field, ascending: sort.field === field ? !sort.ascending : false });
          }, children: [
            t(label),
            sort.field === field ? sort.ascending ? " \u2191" : " \u2193" : ""
          ] }) }, field)),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("th", { children: t("analyticsShare") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("tbody", { children: [...rows].sort((a, b) => compare(a, b, sort.field, sort.ascending)).map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("td", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: row.model }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: row.provider })
          ] }),
          fields.map(([field]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("td", { title: field === "costMicroCents" ? void 0 : historyNumber(row[field], locale), children: field === "costMicroCents" ? historyMoney(row[field], locale) : historyNumber(row[field], locale, true) }, field)),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("td", { children: [
            percent(row.tokens, totals.tokens).toFixed(1),
            "%"
          ] })
        ] }, JSON.stringify([row.provider, row.model]))) })
      ] }) })
    ] })
  ] });
}

// src/client/UsagePill.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var sidebarAccountStorageKey = "dsh-opencode-go.sidebar-account";
var unchanged = () => 0;
var noSubscription = () => () => {
};
function usageFailure(error) {
  if (error && typeof error === "object" && "code" in error && error.code === "opencode-go/usage-unavailable" && "details" in error && error.details && typeof error.details === "object") {
    const details = error.details;
    let lastSwitch;
    try {
      if (details.lastSwitch) lastSwitch = parseAccountSwitch(details.lastSwitch);
    } catch {
    }
    return {
      ..."message" in error && typeof error.message === "string" ? { message: error.message } : {},
      retainPrevious: details.retryable === true && details.retainPrevious === true,
      ...typeof details.source === "string" ? { source: details.source } : {},
      ...lastSwitch ? { lastSwitch } : {}
    };
  }
  return { retainPrevious: false };
}
var usageRefreshTimeoutMs = 3e4;
var refreshTimedOut = Symbol("usage-refresh-timed-out");
var focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function withRefreshTimeout(read) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(refreshTimedOut), usageRefreshTimeoutMs);
    read().then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
function panelDateTime(value, locale) {
  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function usageLevel(window) {
  if (window.status === "rate-limited" || window.percent >= 100) return UsagePill_default.limited;
  return window.percent >= 80 ? UsagePill_default.high : void 0;
}
function ChevronLeft() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { className: UsagePill_default.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M10 4 6 8l4 4" }) });
}
function ChevronRight() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { className: UsagePill_default.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M6 4l4 4-4 4" }) });
}
function ChevronDown2() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { className: UsagePill_default.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M4 6l4 4 4-4" }) });
}
function ChartIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { className: UsagePill_default.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M2.5 13.5h11M4.5 11V8M8 11V4M11.5 11V6" }) });
}
function Tick() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { className: UsagePill_default.tick, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M3.5 8.5 6.5 11.5 12.5 4.5" }) });
}
function UsagePill({ directory, ...props }) {
  const state = (0, import_react4.useSyncExternalStore)(directory.subscribe, directory.getSnapshot, directory.getSnapshot);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(UsageSurface, { ...props, variant: "pill", provider: state.current?.provider });
}
function SidebarQuota({ wide, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(UsageSurface, { ...props, variant: wide ? "sidebar" : "sidebar-icon" });
}
function UsageSurface({ settings, credentialChanges, variant, provider, readAccountUsage, ...props }) {
  const readSettings = (0, import_react4.useCallback)(() => settings.getSnapshot(), [settings]);
  const subscribeSettings = (0, import_react4.useCallback)((listener) => settings.subscribe(listener), [settings]);
  const config = (0, import_react4.useSyncExternalStore)(subscribeSettings, readSettings, readSettings);
  const readChanges = (0, import_react4.useCallback)(() => credentialChanges?.getSnapshot() ?? unchanged(), [credentialChanges]);
  const subscribeChanges = (0, import_react4.useCallback)((listener) => credentialChanges?.subscribe(listener) ?? noSubscription(), [credentialChanges]);
  const credentialRevision = (0, import_react4.useSyncExternalStore)(subscribeChanges, readChanges, readChanges);
  const [analyticsOpen, setAnalyticsOpen] = (0, import_react4.useState)(false);
  const [viewedAccountId, setViewedAccountId] = (0, import_react4.useState)(() => {
    if (variant === "pill") return null;
    try {
      return globalThis.localStorage?.getItem(sidebarAccountStorageKey) ?? null;
    } catch {
      return null;
    }
  });
  const mode = config.value?.usageDisplay ?? DEFAULT_USAGE_DISPLAY;
  const appearanceTheme = config.value?.appearanceTheme ?? DEFAULT_OPENCODE_GO_THEME;
  const visible = config.status === "ready" && config.value?.enabled !== false && (variant === "pill" ? mode === "always" || mode === "auto" && provider === PROVIDER_ID : config.value?.showSidebarQuota === true);
  const accounts = accountsOf(config.value ?? {});
  const viewedAccount = variant !== "pill" && readAccountUsage ? accounts.find((account) => account.id === viewedAccountId) ?? accounts[0] : void 0;
  const viewedRef = viewedAccount?.apiKeyEnv;
  const callingRef = accountRefOf(config.value ?? {});
  const activeRef = viewedRef ?? callingRef;
  const readSidebarUsage = (0, import_react4.useCallback)(() => viewedRef && readAccountUsage ? readAccountUsage(viewedRef) : props.readUsage(), [viewedRef, readAccountUsage, props.readUsage]);
  const readDialogQuota = (0, import_react4.useCallback)((ref) => {
    if (readAccountUsage) return readAccountUsage(ref);
    if (ref === callingRef) return props.readUsage();
    return Promise.reject(new Error("Quota is unavailable for the selected account"));
  }, [readAccountUsage, callingRef, props.readUsage]);
  (0, import_react4.useEffect)(() => {
    if (!visible || !viewedAccount) return;
    setViewedAccountId(viewedAccount.id);
    try {
      globalThis.localStorage?.setItem(sidebarAccountStorageKey, viewedAccount.id);
    } catch {
    }
  }, [visible, viewedAccount?.id]);
  const nextAccount = () => {
    setViewedAccountId((previous) => {
      const index = Math.max(0, accounts.findIndex((account) => account.id === previous));
      return accounts[(index + 1) % accounts.length].id;
    });
  };
  return visible ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      ActiveUsage,
      {
        ...props,
        readUsage: variant === "pill" ? props.readUsage : readSidebarUsage,
        accounts,
        activeRef,
        writable: config.writable,
        onNextAccount: viewedAccount && accounts.length > 1 ? nextAccount : void 0,
        variant,
        pillStyle: config.value?.usagePillStyle ?? DEFAULT_USAGE_PILL_STYLE,
        appearanceTheme,
        analyticsOpen,
        onAnalyticsOpenChange: setAnalyticsOpen
      },
      JSON.stringify([activeRef, config.value?.baseURL, config.value?.proxyURL, credentialRevision, accounts])
    ),
    props.readAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      AnalyticsDialog,
      {
        open: analyticsOpen,
        onClose: () => {
          setAnalyticsOpen(false);
        },
        readAnalytics: props.readAnalytics,
        exportAnalytics: props.exportAnalytics,
        readQuota: readDialogQuota,
        accounts,
        activeRef: callingRef,
        contextKey: JSON.stringify([credentialRevision, config.value?.baseURL, config.value?.proxyURL]),
        theme: appearanceTheme,
        t: props.t,
        getLocale: props.getLocale
      }
    ) : null
  ] }) : null;
}
function ActiveUsage({ readUsage, readAnalytics, t, getLocale, accounts, activeRef, writable, selectAccount, analyticsOpen, onAnalyticsOpenChange, onNextAccount, variant, pillStyle, appearanceTheme }) {
  const sidebar = variant !== "pill";
  const [snapshot, setSnapshot] = (0, import_react4.useState)(null);
  const [failed, setFailed] = (0, import_react4.useState)(null);
  const [stale, setStale] = (0, import_react4.useState)(false);
  const [refreshing, setRefreshing] = (0, import_react4.useState)(false);
  const [open, setOpen] = (0, import_react4.useState)(false);
  const [switching, setSwitching] = (0, import_react4.useState)(false);
  const [switchFailed, setSwitchFailed] = (0, import_react4.useState)(false);
  const [view, setView] = (0, import_react4.useState)("usage");
  const [rovingIndex, setRovingIndex] = (0, import_react4.useState)(0);
  const tokens = useGoThemeTokens(appearanceTheme);
  const root = (0, import_react4.useRef)(null);
  const triggerRef = (0, import_react4.useRef)(null);
  const panelRef = (0, import_react4.useRef)(null);
  const panelId = (0, import_react4.useId)();
  const retry = (0, import_react4.useRef)(() => {
  });
  const focusTrigger = (0, import_react4.useCallback)(() => {
    triggerRef.current?.focus();
  }, []);
  const current = snapshot?.reader === readUsage ? snapshot : null;
  const usage = current?.usage;
  const failure = failed?.reader === readUsage ? failed.failure : null;
  const notice = usage?.lastSwitch ?? failure?.lastSwitch;
  const accountName = accounts.find((account) => account.apiKeyEnv === activeRef)?.name || t("accountDefault");
  const accountsView = view === "accounts" && accounts.length > 1;
  const selectedIndex = Math.max(0, accounts.findIndex((account) => account.apiKeyEnv === activeRef));
  const roving = Math.min(rovingIndex, Math.max(0, accounts.length - 1));
  (0, import_react4.useEffect)(() => {
    let alive = true;
    let busy = false;
    setSnapshot(null);
    setFailed(null);
    setStale(false);
    setRefreshing(false);
    const refresh = async (manual = false) => {
      if (busy || !manual && document.visibilityState === "hidden") return;
      busy = true;
      setRefreshing(true);
      try {
        const value = await withRefreshTimeout(readUsage);
        if (alive) {
          setSnapshot({ reader: readUsage, usage: value, updatedAt: Date.now() });
          setFailed(null);
          setStale(false);
        }
      } catch (error) {
        if (alive) {
          if (error === refreshTimedOut) {
            setStale(true);
          } else {
            const failure2 = usageFailure(error);
            setFailed({ reader: readUsage, failure: failure2 });
            setSnapshot((previous) => !sidebar && previous?.reader === readUsage && failure2.retainPrevious && typeof previous.usage.source === "string" && previous.usage.source.length > 0 && previous.usage.source === failure2.source ? previous : null);
            setStale(false);
          }
        }
      } finally {
        busy = false;
        if (alive) setRefreshing(false);
      }
    };
    retry.current = () => {
      void refresh(true);
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 6e4);
    const visible = () => {
      void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      retry.current = () => {
      };
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [readUsage, sidebar]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    const click = (event) => {
      if (root.current?.contains(event.target)) return;
      setOpen(false);
      focusTrigger();
    };
    const key = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      focusTrigger();
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open, focusTrigger]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector(focusableSelector);
    (first ?? panel).focus();
  }, [open]);
  (0, import_react4.useEffect)(() => {
    if (!open || !accountsView) return;
    const panel = panelRef.current;
    if (!panel) return;
    const options = Array.from(panel.querySelectorAll('[role="option"]'));
    const index = Math.max(0, Math.min(selectedIndex, options.length - 1));
    setRovingIndex(index);
    (options[index] ?? panel).focus();
  }, [open, accountsView, selectedIndex]);
  const switchable = accounts.length > 1 && writable && selectAccount !== void 0;
  const switchTo = (ref) => {
    if (ref === activeRef) {
      setView("usage");
      focusTrigger();
      return;
    }
    setSwitching(true);
    setSwitchFailed(false);
    void selectAccount?.(ref).then((accepted) => {
      setSwitchFailed(!accepted);
      if (accepted) setView("usage");
      focusTrigger();
    }).catch(() => {
      setSwitchFailed(true);
      focusTrigger();
    }).finally(() => {
      setSwitching(false);
    });
  };
  const staleUpdated = stale && !failure && current ? ` \xB7 ${t("usageLastUpdated")} ${new Date(current.updatedAt).toLocaleTimeString(getLocale?.(), { hour: "2-digit", minute: "2-digit" })}` : "";
  const label = usage ? `${t("usageRollingShort")} ${usage.rolling.percent}% \xB7 ${t("usageWeekShort")} ${usage.weekly.percent}%${sidebar ? ` \xB7 ${t("usage_monthly")} ${usage.monthly.percent}%` : ""}${failure || stale ? ` \xB7 ${t("usageStaleShort")}` : ""}${staleUpdated}${notice ? ` \xB7 ${t("usageFallbackShort")}` : ""}${accounts.length > 1 ? ` \xB7 ${accountName}` : ""}` : `${failure ? t("usageUnavailable") : "\u2026"}${notice ? ` \xB7 ${t("usageFallbackShort")}` : ""}${accounts.length > 1 ? ` \xB7 ${accountName}` : ""}`;
  const segments = usage ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.reading, "data-stale": failure || stale ? "" : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.unit, children: [
        t("usageRollingShort"),
        " "
      ] }),
      usage.rolling.percent,
      "%",
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.unit, children: [
        t("usageWeekShort"),
        " "
      ] }),
      usage.weekly.percent,
      "%"
    ] }),
    failure || stale ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.stale, children: [
      " \xB7 ",
      t("usageStaleShort")
    ] }) : null,
    notice ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.fallback, children: [
      " \xB7 ",
      t("usageFallbackShort")
    ] }) : null,
    accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.account, children: accountName })
    ] }) : null
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    failure ? t("usageUnavailable") : "\u2026",
    notice ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.fallback, children: [
      " \xB7 ",
      t("usageFallbackShort")
    ] }) : null,
    accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.account, children: accountName })
    ] }) : null
  ] });
  const triggerClass = variant === "sidebar" ? UsagePill_default.sidebarCard : variant === "sidebar-icon" ? UsagePill_default.sidebarIcon : [UsagePill_default.trigger, pillStyle === "plain" ? UsagePill_default.plain : void 0].filter(Boolean).join(" ");
  const iconOpensHistory = variant === "sidebar-icon" && readAnalytics !== void 0;
  const Trigger = !sidebar || iconOpensHistory ? "button" : "span";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "span",
    {
      className: [UsagePill_default.root, sidebar ? UsagePill_default.sidebarRoot : void 0].filter(Boolean).join(" "),
      "data-wide": sidebar ? String(variant === "sidebar") : void 0,
      ref: root,
      style: themeStyle(tokens),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          Trigger,
          {
            type: !sidebar || iconOpensHistory ? "button" : void 0,
            role: sidebar && !iconOpensHistory ? "group" : void 0,
            ref: !sidebar ? triggerRef : void 0,
            className: triggerClass,
            "aria-expanded": iconOpensHistory ? analyticsOpen : sidebar ? void 0 : open,
            "aria-controls": !sidebar ? panelId : void 0,
            "aria-haspopup": !sidebar || iconOpensHistory ? "dialog" : void 0,
            "data-fallback": notice ? "" : void 0,
            "data-stale": failure || stale ? "" : void 0,
            "aria-label": iconOpensHistory ? t("sidebarAnalytics") : `${t("usageTitle")}: ${label}`,
            title: label,
            onClick: iconOpensHistory ? () => {
              onAnalyticsOpenChange(true);
            } : sidebar ? void 0 : () => {
              if (open) {
                setOpen(false);
                focusTrigger();
              } else {
                setView("usage");
                setOpen(true);
              }
            },
            children: variant === "sidebar" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.sidebarHead, children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "OpenCode Go" }),
                onNextAccount ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: `${UsagePill_default.sidebarBadge} ${UsagePill_default.sidebarAccountButton}`,
                    "aria-label": `${t("sidebarNextAccount")}: ${accountName}`,
                    title: `${accountName} \xB7 ${t("sidebarNextAccount")}`,
                    onClick: onNextAccount,
                    children: accountName
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.sidebarBadge, title: accountName, children: accounts.length ? accountName : "Go" })
              ] }),
              ["rolling", "weekly", "monthly"].map((key) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.sidebarWindow, children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t(`usage_${key}`) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "progress",
                  {
                    "aria-label": t(`usage_${key}`),
                    max: 100,
                    value: usage ? Math.min(100, Math.max(0, usage[key].percent)) : 0,
                    className: [key === "rolling" ? UsagePill_default.progressRolling : key === "weekly" ? UsagePill_default.progressWeekly : UsagePill_default.progressMonthly, usage ? usageLevel(usage[key]) : void 0].filter(Boolean).join(" ")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: usage ? `${usage[key].percent}%` : failure ? "\u2014" : "\u2026" })
              ] }, key)),
              failure ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.sidebarStatus, role: "status", title: failure.message, children: t("usageUnavailable") }) : null,
              !failure && stale && current ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.sidebarStatus, "data-stale": "", children: t("usageStaleShort") }) : null,
              readAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "button",
                {
                  type: "button",
                  className: UsagePill_default.sidebarHistory,
                  "aria-label": t("sidebarAnalytics"),
                  "aria-haspopup": "dialog",
                  onClick: () => {
                    onAnalyticsOpenChange(true);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChartIcon, {}),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("analyticsOpen") }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronRight, {})
                  ]
                }
              ) : null
            ] }) : variant === "sidebar-icon" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChartIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.pillStatus, "data-warning": failure || stale || notice ? "" : void 0, "aria-hidden": "true" }),
              segments
            ] })
          }
        ),
        !sidebar && open && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "div",
          {
            className: UsagePill_default.panel,
            id: panelId,
            ref: panelRef,
            role: "dialog",
            "aria-label": t("usageTitle"),
            "aria-busy": refreshing,
            tabIndex: -1,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: UsagePill_default.material, "aria-hidden": "true" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: UsagePill_default.body, children: accountsView ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: UsagePill_default.panelHead, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: UsagePill_default.back,
                      "aria-label": t("accountSwitchBack"),
                      onClick: () => {
                        setView("usage");
                        focusTrigger();
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronLeft, {})
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: t("accountSwitchTitle") })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "div",
                  {
                    className: UsagePill_default.list,
                    role: "listbox",
                    "aria-label": t("accountSwitchTitle"),
                    "aria-orientation": "vertical",
                    onKeyDown: (event) => {
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        setView("usage");
                        focusTrigger();
                        return;
                      }
                      const options = Array.from(event.currentTarget.querySelectorAll('[role="option"]'));
                      if (!options.length) return;
                      const focused = options.findIndex((option) => option === document.activeElement);
                      const at = focused >= 0 ? focused : Math.min(roving, options.length - 1);
                      const next = event.key === "ArrowDown" ? (at + 1) % options.length : event.key === "ArrowUp" ? (at - 1 + options.length) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
                      if (next < 0) return;
                      event.preventDefault();
                      setRovingIndex(next);
                      options[next]?.focus();
                    },
                    children: accounts.map((account, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react4.Fragment, { children: [
                      index ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: UsagePill_default.divider }) : null,
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                        "button",
                        {
                          type: "button",
                          role: "option",
                          "aria-selected": account.apiKeyEnv === activeRef,
                          "data-selected": account.apiKeyEnv === activeRef ? "" : void 0,
                          className: UsagePill_default.option,
                          disabled: switching,
                          tabIndex: index === roving ? 0 : -1,
                          onFocus: () => {
                            setRovingIndex(index);
                          },
                          onClick: () => {
                            switchTo(account.apiKeyEnv);
                          },
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.optionName, children: account.name || t("accountDefault") }),
                            account.apiKeyEnv === activeRef ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tick, {}) : null
                          ]
                        }
                      )
                    ] }, account.id))
                  }
                ),
                switchFailed ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: UsagePill_default.warning, role: "alert", children: t("accountSwitchFailed") }) : null,
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: UsagePill_default.hint, children: t("accountSwitchHint") })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: UsagePill_default.panelHead, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: t("usageTitle") }),
                  accounts.length ? switchable ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                    "button",
                    {
                      type: "button",
                      className: UsagePill_default.accChip,
                      "aria-haspopup": "listbox",
                      disabled: switching,
                      "aria-label": `${t("accountSwitchAction")} \xB7 ${accountName} \xB7 ${t("accountPreferredTag")}`,
                      onClick: () => {
                        setView("accounts");
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.dot }),
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.accChipName, children: accountName }),
                        accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.tag, children: t("accountPreferredTag") }) : null,
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronDown2, {})
                      ]
                    }
                  ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.accChip, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.dot }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.accChipName, children: accountName }),
                    accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.tag, children: t("accountPreferredTag") }) : null
                  ] }) : null
                ] }),
                switchFailed ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: UsagePill_default.warning, role: "alert", children: t("accountSwitchFailed") }) : null,
                notice ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: UsagePill_default.warning, role: "status", children: [
                  t(notice.reason === "quota" ? "accountFallbackQuota" : "accountFallbackCredential"),
                  " ",
                  accounts.find((account) => account.apiKeyEnv === notice.toRef)?.name || t("accountDefault"),
                  " \xB7 ",
                  panelDateTime(notice.at, getLocale?.())
                ] }) : null,
                failure ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: UsagePill_default.warning, role: "alert", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: t("usageRefreshFailed") }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: failure.message ?? t("usageUnavailable") }),
                  usage ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: t("usageStaleHint") }) : null
                ] }) : null,
                failure ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: UsagePill_default.retry,
                    disabled: refreshing,
                    onClick: () => {
                      retry.current();
                    },
                    children: t(refreshing ? "usageRefreshing" : "usageRetry")
                  }
                ) : null,
                usage ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: UsagePill_default.windows, children: ["rolling", "weekly", "monthly"].map((key) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: UsagePill_default.win, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: UsagePill_default.meta, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.winLabel, children: t(`usage_${key}`) }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.winReset, children: [
                      t("usageResets"),
                      " ",
                      panelDateTime(usage[key].resetsAt, getLocale?.())
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("strong", { className: UsagePill_default.winPercent, children: [
                      usage[key].percent,
                      "%"
                    ] })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "progress",
                    {
                      className: [usageLevel(usage[key]), key === "rolling" ? UsagePill_default.progressRolling : key === "weekly" ? UsagePill_default.progressWeekly : UsagePill_default.progressMonthly].filter(Boolean).join(" "),
                      "aria-label": t(`usage_${key}`),
                      max: 100,
                      value: Math.min(100, usage[key].percent)
                    }
                  ),
                  usage[key].status === "rate-limited" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: UsagePill_default.limitedText, children: t("usageLimited") })
                ] }, key)) }) : failure ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: UsagePill_default.hint, children: t("usageLoading") }),
                readAnalytics || current ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: UsagePill_default.actions, children: [
                  readAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                    "button",
                    {
                      type: "button",
                      className: UsagePill_default.hist,
                      "aria-haspopup": "dialog",
                      onClick: () => {
                        setOpen(false);
                        onAnalyticsOpenChange(true);
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChartIcon, {}),
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("analyticsOpen") })
                      ]
                    }
                  ) : null,
                  current ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: UsagePill_default.updated, children: [
                    t("usageLastUpdated"),
                    " ",
                    panelDateTime(current.updatedAt, getLocale?.())
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: UsagePill_default.updated }),
                  current && !failure ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: UsagePill_default.refresh,
                      disabled: refreshing,
                      onClick: () => {
                        retry.current();
                      },
                      children: t(refreshing ? "usageRefreshing" : "usageRefresh")
                    }
                  ) : null
                ] }) : null
              ] }) })
            ]
          }
        )
      ]
    }
  );
}

// src/client/index.ts
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
var NS = "settings.opencode-go";
var inject = ["slots", "locale", "remote", "remote.credentials"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "llm-opencode-go: copy dictionaries");
  const modelsReady = ctx.remote.$mount(goRemote);
  ctx.effect(async () => await modelsReady);
  ctx.inject(["configForms", "remote.opencodeGoModels"], (child) => {
    mountSettings(child, child.configForms.get(PROFILE_ENTRY_ID), modelsReady);
  });
}
function mountSettings(ctx, scope, modelsReady) {
  const executeAccountCommand = accountCommands(ctx);
  registerUsagePill(ctx, scope, async (ref) => await executeAccountCommand({ kind: "select", ref }) === "applied");
  let readAccount;
  ctx.inject(["remote.opencodeGoUsage"], (ready) => {
    readAccount = async (ref) => {
      const result = await ready.remote.opencodeGoUsage.readAccount(ref);
      if (!result.ok) throw result.error;
      return result.value;
    };
  });
  const controller = new OpencodeGoSectionController(scope, ctx, async () => {
    await modelsReady;
    return ctx.remote.opencodeGoModels.read();
  }, async (ref) => {
    await modelsReady;
    if (readAccount === void 0) throw new Error("OpenCode Go account usage is unavailable in this session");
    return readAccount(ref);
  }, executeAccountCommand);
  ctx.effect(() => () => controller.dispose());
  const t = ctx.locale.bind(NS);
  const injected = () => ({ ...controller.inject(), t, getLocale: () => ctx.locale.getLocale().active });
  ctx.effect(() => {
    const refresh = (ref) => {
      controller.refreshCredential(ref);
    };
    const dispose = ctx.remote.$on("credentials/reference-updated", refresh);
    return () => {
      dispose();
    };
  }, "llm-opencode-go: pushed credential invalidations");
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "opencode-go",
    order: 20,
    label: () => t("nav"),
    inject: injected
  }, OpencodeGoSection));
}
function accountCommands(ctx) {
  const unavailable = async () => "unknown";
  let execute = unavailable;
  ctx.inject(["remote.opencodeGoAccounts"], (ready) => {
    ready.effect(() => {
      const connected = async (command) => {
        const result = await ready.remote.opencodeGoAccounts.execute(command);
        return result.ok ? result.value : "unknown";
      };
      execute = connected;
      return () => {
        if (execute === connected) execute = unavailable;
      };
    });
  });
  return (command) => execute(command);
}
function registerUsagePill(ctx, settings, selectAccount) {
  ctx.inject(["remote.opencodeGoUsage"], (ready) => {
    const credentialChanges = (0, import_dsh_client_store2.createSnapshotStore)(0);
    ready.effect(() => ready.remote.$on("credentials/reference-updated", (ref) => {
      if (accountsOf(settings.getSnapshot().value ?? {}).some((account) => account.apiKeyEnv === ref)) {
        credentialChanges.set(credentialChanges.getSnapshot() + 1);
      }
    }));
    const readUsage = async () => {
      const result = await ready.remote.opencodeGoUsage.read();
      if (!result.ok) throw result.error;
      return result.value;
    };
    const readAccountUsage = async (ref) => {
      const result = await ready.remote.opencodeGoUsage.readAccount(ref);
      if (!result.ok) throw result.error;
      return result.value;
    };
    let analytics;
    let exportCsv;
    ready.inject(["remote.opencodeGoAnalytics"], (withAnalytics) => {
      analytics = async (query, signal) => {
        const result = await withAnalytics.remote.opencodeGoAnalytics.read(query, signal);
        if (!result.ok) throw result.error;
        return result.value;
      };
      exportCsv = async (query, signal) => {
        const result = await withAnalytics.remote.opencodeGoAnalytics.exportCsv(query, signal);
        if (!result.ok) throw result.error;
        return result.value;
      };
    });
    const readAnalytics = async (query, signal) => {
      if (analytics === void 0) throw Object.assign(new Error("OpenCode Go analytics is unavailable in this session"), {
        code: "opencode-go/analytics-unavailable",
        details: { reason: "unavailable", retryable: false }
      });
      return analytics(query, signal);
    };
    const exportAnalytics = async (query, signal) => {
      if (exportCsv === void 0) throw new Error("OpenCode Console export is unavailable in this session");
      return exportCsv(query, signal);
    };
    const translate = ready.locale.bind("settings.opencode-go");
    const usageProps = () => ({
      settings,
      credentialChanges,
      selectAccount: async (ref) => {
        const snapshot = settings.getSnapshot();
        if (!snapshot.writable || !accountsOf(snapshot.value ?? {}).some((account) => account.apiKeyEnv === ref)) return false;
        return selectAccount ? selectAccount(ref).catch(() => false) : false;
      },
      readUsage,
      readAccountUsage,
      readAnalytics,
      exportAnalytics,
      getLocale: () => ready.locale.getLocale().active,
      t: (key) => translate(key)
    });
    ready.slots.inject("sidebar.footer.action", () => ready.slots.register({
      name: "sidebar.footer.action",
      id: "opencode-go-sidebar-quota",
      order: 1e3,
      inject: () => ({ ...usageProps(), readAccountUsage })
    }, SidebarQuota));
    ready.inject(["modelDirectories"], (scope) => {
      scope.slots.inject("conversation.input.right", () => scope.slots.register({
        name: "conversation.input.right",
        id: "opencode-go-usage",
        order: 1e3,
        inject: (sessionId) => ({ ...usageProps(), directory: scope.modelDirectories.directoryFor(sessionId).store })
      }, UsagePill));
    });
  });
}
return module.exports; } });
