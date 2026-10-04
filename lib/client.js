window.__ModuleLoader__.load({ id: "dsh-opencode-go", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  OPENCODE_GO_NS: () => OPENCODE_GO_NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/Section.tsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var primitives2 = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);

// src/client/ModelEditor.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

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

// plugin-css:src/client/Section.module.css
var id = "dsh-opencode-go/Section.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id;
  style.textContent = ".N807zW_accounts{gap:10px;margin:12px 0;display:grid}.N807zW_accountRow{border:.5px solid var(--dsw-alias-border-l2);border-radius:10px}.N807zW_accountRow[data-dragging=true]{opacity:.55}.N807zW_accountMain{align-items:center;gap:9px;padding:9px 11px;display:flex}.N807zW_accountHandle{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);cursor:grab;background:0 0;border:0;flex:none;place-items:center;padding:0;display:grid}.N807zW_accountHandle:disabled{cursor:default;opacity:.5}.N807zW_accountHandle:focus-visible,.N807zW_accountToggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:4px}.N807zW_accountName{color:var(--dsw-alias-label-primary);flex:none;font-size:12.5px;font-weight:600}.N807zW_accountState{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:5px;font-size:11.5px;display:inline-flex}.N807zW_accountDot{background:#39a878;border-radius:50%;flex:none;width:6px;height:6px}.N807zW_accountDot[data-off=true]{background:#d9a441}.N807zW_accountSpacer{flex:1;min-width:8px}.N807zW_accountPercent{text-align:right;font-variant-numeric:tabular-nums;width:40px;color:var(--dsw-alias-label-secondary);flex:none;font-size:11.5px}.N807zW_accountProgress{accent-color:#39a878;flex:none;width:132px;height:6px}.N807zW_accountReset{text-align:right;width:106px;color:var(--dsw-alias-label-tertiary);flex:none;font-size:11.5px}.N807zW_accountToggle{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;flex:none;place-items:center;padding:0;display:grid}.N807zW_accountProblems{padding:0 11px 8px 36px}.N807zW_accountDetail{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;padding:9px 11px 10px 36px;display:flex}.N807zW_accountDropLine{background:var(--dsw-alias-brand-primary);border-radius:2px;height:2px}.N807zW_accountUsage{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;font-size:12px;display:grid}.N807zW_accountUsage progress{accent-color:#39a878;width:100%;height:6px;margin:6px 0;display:block}.N807zW_accountUsage .N807zW_hint{overflow-wrap:anywhere;display:block}.N807zW_accountActions{flex-wrap:wrap;gap:8px;margin-top:10px;display:flex}.N807zW_accountEditor{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;margin-top:12px;padding:12px}.N807zW_accountSubmit{border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:6px;padding:5px 12px}.N807zW_accountSubmit:disabled{opacity:.5;cursor:default}@media (width<=480px){.N807zW_accountUsage{grid-template-columns:1fr}}.N807zW_page{flex-direction:column;min-width:0;height:100%;min-height:0;display:flex;container-type:size}.N807zW_pageBody{scrollbar-gutter:stable;flex-direction:column;flex:1;min-height:0;padding:0 4px 16px 0;display:flex;overflow-y:auto}.N807zW_pageBody,.N807zW_modelList,.N807zW_modelDetails{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l3) transparent}.N807zW_pageBody::-webkit-scrollbar,.N807zW_modelList::-webkit-scrollbar,.N807zW_modelDetails::-webkit-scrollbar{width:8px;height:8px}.N807zW_pageBody::-webkit-scrollbar-track,.N807zW_modelList::-webkit-scrollbar-track,.N807zW_modelDetails::-webkit-scrollbar-track{background:0 0}.N807zW_pageBody::-webkit-scrollbar-thumb,.N807zW_modelList::-webkit-scrollbar-thumb,.N807zW_modelDetails::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l3);background-clip:content-box;border:2px solid #0000;border-radius:999px}.N807zW_pageBody:hover::-webkit-scrollbar-thumb,.N807zW_modelList:hover::-webkit-scrollbar-thumb,.N807zW_modelDetails:hover::-webkit-scrollbar-thumb{background:var(--dsw-alias-label-tertiary);background-clip:content-box}.N807zW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.N807zW_field+.N807zW_field{border-top:.5px solid var(--dsw-alias-border-l2)}.N807zW_head{align-items:center;gap:8px;display:flex}.N807zW_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.N807zW_badges{align-items:center;gap:8px;display:inline-flex}.N807zW_trailing{flex:none;align-items:center;gap:8px;display:inline-flex}.N807zW_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.N807zW_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.N807zW_reset:disabled{cursor:default}.N807zW_reset:focus-visible,.N807zW_cardTrigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.N807zW_input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.N807zW_input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;border-color:var(--dsw-alias-brand-primary)}.N807zW_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.N807zW_inputInvalid{border-color:var(--dsw-alias-label-error);}.N807zW_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.N807zW_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}.N807zW_pageTop{flex-direction:column;gap:3px;padding:2px 0 12px;display:flex}.N807zW_title{color:var(--dsw-alias-label-primary);margin:0;font-size:15px;font-weight:600;line-height:1.4}.N807zW_intro{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:1.5}.N807zW_card,.N807zW_cardModels{border:.5px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-bg-layer-3) 40%, transparent);border-radius:12px;padding:8px 0 10px}.N807zW_card{flex:none}.N807zW_card+.N807zW_card,.N807zW_card+.N807zW_cardModels,.N807zW_cardModels+.N807zW_card{margin-top:8px}.N807zW_cardModels{flex-direction:column;flex:1 0 auto;display:flex}.N807zW_cardFolded{flex:none}.N807zW_cardHead{align-items:center;gap:8px;min-height:24px;padding:0 14px;display:flex}.N807zW_cardTitle{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13.5px;font-weight:600;line-height:1.5}.N807zW_cardSub{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11.5px;line-height:1.5}.N807zW_cardBody{flex-direction:column;gap:8px;padding:4px 14px 0;display:flex}.N807zW_cardBody>.N807zW_input{box-sizing:border-box;width:100%}.N807zW_cardModels>.N807zW_cardBody{flex:1 0 auto}.N807zW_cardNotes{flex-direction:column;gap:8px;padding:6px 14px 2px;display:flex}.N807zW_cardNotes:empty{display:none}.N807zW_cardDivider{border-top:.5px solid var(--dsw-alias-border-l2);margin:10px 14px}.N807zW_cardTrigger{width:100%;min-height:24px;font:inherit;text-align:left;color:inherit;cursor:pointer;background:0 0;border:none;align-items:center;gap:8px;margin:0;padding:0 14px;display:flex}.N807zW_cardTrigger:hover .N807zW_cardTitle{color:var(--dsw-alias-brand-primary)}.N807zW_cardHead>.N807zW_cardTrigger{padding:0}.N807zW_advancedGrid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 18px;display:grid}.N807zW_advancedGrid .N807zW_field{padding:0}.N807zW_advancedGrid .N807zW_field+.N807zW_field{border-top:none}.N807zW_limitsEditor{flex-direction:column;flex:1 0 auto;gap:10px;padding-top:4px;display:flex}.N807zW_limitsFoot{border-top:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;margin:2px -14px 0;padding:10px 14px 0;display:flex}.N807zW_limitsSummary{min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:1;font-size:12px;line-height:1.5}.N807zW_modelMeta{align-items:baseline;gap:10px;display:flex}.N807zW_modelMeta .N807zW_limitsModelId{flex:1;min-width:0}.N807zW_releaseDate{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:1.4}.N807zW_limitsModelId{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.4;display:block;overflow:hidden}.N807zW_visuallyHidden{clip:rect(0, 0, 0, 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.N807zW_actions{border-top:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap;flex:none;align-items:center;gap:8px;padding:12px 0;display:flex}.N807zW_starLink{max-width:100%;color:var(--dsw-alias-label-secondary);border-radius:4px;align-items:center;gap:7px;margin-left:auto;padding:6px 0;font-size:12px;line-height:1.5;text-decoration:none;display:inline-flex}.N807zW_starLink svg{flex:none}.N807zW_starLink:hover{color:var(--dsw-alias-brand-primary)}.N807zW_starLink:hover span{text-underline-offset:3px;text-decoration:underline}.N807zW_starLink:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.N807zW_failedNote{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.N807zW_slot{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}.N807zW_slot svg{width:15px;height:15px}.N807zW_chevron,.N807zW_chevronOpen{width:14px;height:14px;color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .15s}.N807zW_chevron{transform:rotate(-90deg)}.N807zW_filters{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.N807zW_filterAction{align-items:center;margin-left:auto;display:inline-flex}.N807zW_filter{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:6px 9px;font-size:12px}.N807zW_filter[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3)}.N807zW_filter span{color:var(--dsw-alias-label-tertiary);margin-left:4px}.N807zW_modelLayout{border:.5px solid var(--dsw-alias-border-l4);border-radius:10px;flex:auto;grid-template-columns:minmax(0,45fr) minmax(0,55fr);min-height:260px;max-height:560px;display:grid;overflow:hidden}.N807zW_modelList{border-right:.5px solid var(--dsw-alias-border-l2);min-height:0;padding:4px 6px;overflow-y:auto}.N807zW_modelRow{align-items:center;gap:8px;padding-right:6px;display:flex}.N807zW_modelRow+.N807zW_modelRow{border-top:.5px solid var(--dsw-alias-border-l2)}.N807zW_modelRowSelected{background:var(--dsw-alias-bg-layer-3);border-top-color:#0000;border-radius:6px}.N807zW_modelRow>[role=switch]{flex-shrink:0}.N807zW_modelChoice{text-align:left;min-width:0;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:0;border-radius:6px;flex:1;align-items:baseline;padding:9px 3px 9px 6px;display:flex}.N807zW_modelRow:hover:not(.N807zW_modelRowSelected){background:color-mix(in srgb, var(--dsw-alias-bg-layer-3) 92%, var(--dsw-alias-label-primary));border-top-color:#0000;border-radius:6px}.N807zW_modelName{overflow-wrap:anywhere;flex-wrap:wrap;flex:0 auto;align-items:center;gap:5px;min-width:0;font-size:13px;display:flex}.N807zW_overrideDot{background:var(--dsw-alias-brand-primary);border-radius:50%;flex:none;width:6px;height:6px}.N807zW_modelDetails{flex-direction:column;gap:10px;min-height:0;padding:14px;display:flex;overflow-y:auto}.N807zW_modelDetails h3{overflow-wrap:anywhere;margin:0;font-size:14px}.N807zW_modelHeading{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.N807zW_stats{flex-direction:column;gap:10px;display:flex}.N807zW_stat{flex-direction:column;gap:4px;display:flex}.N807zW_statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}.N807zW_modelDetails .N807zW_input{box-sizing:border-box;width:100%;min-width:0;height:30px;padding:0 9px;font-size:12px}.N807zW_modalities{flex-wrap:wrap;gap:4px;display:flex}.N807zW_modality,.N807zW_modalityOff{border-radius:6px;padding:2px 7px;font-size:11px;line-height:1.5}.N807zW_modality{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary)}.N807zW_modalityOff{border:.5px dashed var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary)}.N807zW_modelDetails .N807zW_reset{align-self:flex-start}.N807zW_paneFoot{color:var(--dsw-alias-label-tertiary);margin:auto 0 0;font-size:11px;line-height:1.5}.N807zW_newBadge{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);border-radius:4px;padding:2px 4px;font-size:9px}.N807zW_modelChoice:focus-visible,.N807zW_filter:focus-visible,.N807zW_cardTrigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}@container (width<=440px){.N807zW_advancedGrid{grid-template-columns:minmax(0,1fr)}.N807zW_modelLayout{flex:none;grid-template-columns:minmax(0,1fr);max-height:none}.N807zW_modelList{border-right:0;border-bottom:.5px solid var(--dsw-alias-border-l2);max-height:240px}.N807zW_modelDetails{max-height:460px}}@media (prefers-reduced-motion:reduce){.N807zW_chevron,.N807zW_chevronOpen{transition:none}}";
  document.head.appendChild(style);
}
var Section_default = { "accountActions": "N807zW_accountActions", "accountDetail": "N807zW_accountDetail", "accountDot": "N807zW_accountDot", "accountDropLine": "N807zW_accountDropLine", "accountEditor": "N807zW_accountEditor", "accountHandle": "N807zW_accountHandle", "accountMain": "N807zW_accountMain", "accountName": "N807zW_accountName", "accountPercent": "N807zW_accountPercent", "accountProblems": "N807zW_accountProblems", "accountProgress": "N807zW_accountProgress", "accountReset": "N807zW_accountReset", "accountRow": "N807zW_accountRow", "accountSpacer": "N807zW_accountSpacer", "accountState": "N807zW_accountState", "accountSubmit": "N807zW_accountSubmit", "accountToggle": "N807zW_accountToggle", "accountUsage": "N807zW_accountUsage", "accounts": "N807zW_accounts", "actions": "N807zW_actions", "advancedGrid": "N807zW_advancedGrid", "badges": "N807zW_badges", "card": "N807zW_card", "cardBody": "N807zW_cardBody", "cardDivider": "N807zW_cardDivider", "cardFolded": "N807zW_cardFolded", "cardHead": "N807zW_cardHead", "cardModels": "N807zW_cardModels", "cardNotes": "N807zW_cardNotes", "cardSub": "N807zW_cardSub", "cardTitle": "N807zW_cardTitle", "cardTrigger": "N807zW_cardTrigger", "chevron": "N807zW_chevron", "chevronOpen": "N807zW_chevronOpen", "failedNote": "N807zW_failedNote", "field": "N807zW_field", "filter": "N807zW_filter", "filterAction": "N807zW_filterAction", "filters": "N807zW_filters", "head": "N807zW_head", "hint": "N807zW_hint", "input": "N807zW_input", "inputInvalid": "N807zW_inputInvalid N807zW_input", "intro": "N807zW_intro", "invalid": "N807zW_invalid", "label": "N807zW_label", "limitsEditor": "N807zW_limitsEditor", "limitsFoot": "N807zW_limitsFoot", "limitsModelId": "N807zW_limitsModelId", "limitsSummary": "N807zW_limitsSummary", "modalities": "N807zW_modalities", "modality": "N807zW_modality", "modalityOff": "N807zW_modalityOff", "modelChoice": "N807zW_modelChoice", "modelDetails": "N807zW_modelDetails", "modelHeading": "N807zW_modelHeading", "modelLayout": "N807zW_modelLayout", "modelList": "N807zW_modelList", "modelMeta": "N807zW_modelMeta", "modelName": "N807zW_modelName", "modelRow": "N807zW_modelRow", "modelRowSelected": "N807zW_modelRowSelected", "newBadge": "N807zW_newBadge", "overrideDot": "N807zW_overrideDot", "page": "N807zW_page", "pageBody": "N807zW_pageBody", "pageTop": "N807zW_pageTop", "paneFoot": "N807zW_paneFoot", "releaseDate": "N807zW_releaseDate", "reset": "N807zW_reset", "slot": "N807zW_slot", "starLink": "N807zW_starLink", "stat": "N807zW_stat", "statLabel": "N807zW_statLabel", "stats": "N807zW_stats", "title": "N807zW_title", "trailing": "N807zW_trailing", "visuallyHidden": "N807zW_visuallyHidden" };

// src/client/ModelEditor.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var MODALITY_COPY = {
  text: "modalityText",
  image: "modalityImage",
  audio: "modalityAudio",
  video: "modalityVideo",
  pdf: "modalityPdf"
};
function hasCapacityOverride(limit) {
  return limit?.contextWindow != null || limit?.maxTokens != null;
}
function ModelEditor({ models, draft, modelVisibility, t, locale, disabled, visibilitySaving, filterAction, onEdit, onModelEnabled }) {
  const [query, setQuery] = (0, import_react.useState)("");
  const [filter, setFilter] = (0, import_react.useState)("all");
  const [selected, setSelected] = (0, import_react.useState)();
  const [now, setNow] = (0, import_react.useState)(Date.now);
  (0, import_react.useEffect)(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 6e4);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const all = sortModels(models.status === "ready" ? models.entries : [], now);
  const normalized = query.trim().toLocaleLowerCase();
  const entries = all.filter((model2) => `${model2.name ?? ""} ${model2.id}`.toLocaleLowerCase().includes(normalized) && (filter === "all" || filter === "new" && isNewModel(model2, now) || filter === "custom" && hasCapacityOverride(draft[model2.id]) || filter === "deprecated" && model2.deprecated));
  const model = entries.find((entry) => entry.id === selected) ?? entries[0];
  const visibilityDisabled = disabled || visibilitySaving;
  const metadataUnavailable = models.status === "ready" && models.sources?.metadata.error !== void 0;
  const customized = all.filter((entry) => hasCapacityOverride(draft[entry.id])).length;
  const filters = [
    ["all", "filterAll", all.length],
    ["new", "filterNew", all.filter((entry) => isNewModel(entry, now)).length],
    ["custom", "filterCustom", customized],
    ["deprecated", "filterDeprecated", all.filter((entry) => entry.deprecated).length]
  ];
  const write = (id3, field, value) => {
    const current = draft[id3] === null ? { contextWindow: null, maxTokens: null } : draft[id3] ?? {};
    onEdit({ ...draft, [id3]: { ...current, [field]: value ?? null } });
  };
  const badges = (entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    entry.configurationMissing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "warning", children: t(metadataUnavailable ? "configurationUnavailable" : "configurationMissing") }) : null,
    isNewModel(entry, now) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.newBadge, title: t("newHint"), children: t("newBadge") }) : null,
    entry.deprecated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "warning", children: t("deprecatedBadge") }) : null
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.limitsEditor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("visibilityHint") }),
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.filters, role: "group", "aria-label": t("filterLabel"), children: [
      filters.map(([key, label, count]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
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
      )),
      filterAction ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.filterAction, children: filterAction }) : null
    ] }),
    model ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.modelLayout, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", { className: Section_default.modelList, "aria-label": t("modelsLabel"), children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
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
                  badges(entry)
                ] })
              }
            ),
            hasCapacityOverride(draft[entry.id]) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.overrideDot, title: t("overridden"), "aria-hidden": "true" }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              import_dsh_client_ui_primitives.Switch,
              {
                label: t("modelVisibleLabel", { name: entry.name ?? entry.id }),
                checked: isModelEnabled(entry, modelVisibility),
                disabled: visibilityDisabled || entry.configurationMissing,
                onChange: (enabled) => {
                  onModelEnabled(entry.id, enabled);
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
        model.configurationMissing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t(metadataUnavailable ? "configurationUnavailableHint" : "configurationMissingHint") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          model.deprecated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: Section_default.hint, children: t("deprecatedHint") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.stats, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Capacity, { model, field: "contextWindow", limit: draft[model.id], t, locale, disabled, onChange: write }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Capacity, { model, field: "maxTokens", limit: draft[model.id], t, locale, disabled, onChange: write }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.stat, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.statLabel, children: t("modalityLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modalities, { model, t })
            ] })
          ] }),
          hasCapacityOverride(draft[model.id]) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: Section_default.reset,
              disabled,
              onClick: () => {
                onEdit({ ...draft, [model.id]: null });
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
      Object.values(draft).some(hasCapacityOverride) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "outline",
          size: "sm",
          disabled,
          onClick: () => {
            onEdit(Object.fromEntries(Object.keys(draft).map((id3) => [id3, null])));
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
  const id3 = `opencode-go-${field}-${encodeURIComponent(model.id)}`;
  const defaultValue = model[field];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: Section_default.stat, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: Section_default.statLabel, htmlFor: id3, children: t(field === "contextWindow" ? "limitsContext" : "limitsOutput") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        id: id3,
        className: Section_default.input,
        type: "number",
        min: 1,
        step: 1,
        inputMode: "numeric",
        "aria-label": t(field === "contextWindow" ? "limitsContextLabel" : "limitsOutputLabel", { name: model.name ?? model.id }),
        "aria-describedby": `${id3}-default`,
        value: limit?.[field] ?? "",
        placeholder: defaultValue === void 0 ? t("capacityMissing") : String(defaultValue),
        disabled,
        onChange: (event) => {
          const text = event.target.value.trim();
          const value = Number(text);
          if (text === "") onChange(model.id, field, void 0);
          else if (Number.isSafeInteger(value) && value > 0) onChange(model.id, field, value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { id: `${id3}-default`, className: Section_default.hint, children: [
      t("capacityDefault", { value: defaultValue === void 0 ? t("capacityMissing") : defaultValue.toLocaleString(locale) }),
      limit?.[field] != null ? ` \xB7 ${t("overridden")}` : ""
    ] })
  ] });
}

// src/client/AccountsCard.tsx
var import_react2 = require("react");
var primitives = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/accounts.ts
var MAX_ACCOUNTS = 20;
var ACCOUNT_REF_PREFIX = "DSH_OPENCODE_GO_ACCOUNT_";
var DEFAULT_ACCOUNT_REF = "OPENCODE_API_KEY";
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

// src/client/AccountsCard.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var WINDOWS = ["rolling", "weekly", "monthly"];
var ChevronDown = primitives.IconChevronDownOutlineRegular ?? primitives.IconChevronDownOutline14;
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
function GripIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "10", height: "14", viewBox: "0 0 10 14", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "2.5", cy: "2.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "7.5", cy: "2.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "2.5", cy: "7", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "7.5", cy: "7", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "2.5", cy: "11.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "7.5", cy: "11.5", r: "1.3" })
  ] });
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
  const preferred = state.entries.find((entry) => entry.apiKeyEnv === state.activeRef);
  const reorderable = !disabled && total > 1;
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
    setEditor(next);
    setName(label);
    setKey("");
  };
  const cancel = () => {
    setEditor(null);
    setName("");
    setKey("");
  };
  const submit = async () => {
    if (!editor) return;
    const accepted = editor.kind === "add" ? await actions.addAccount(name, key) : editor.kind === "rename" ? await actions.renameAccount(editor.ref, name) : editor.kind === "key" ? await actions.replaceAccountKey(editor.ref, key) : await actions.removeAccount(editor.ref);
    if (accepted) cancel();
  };
  const move = (ref, toIndex) => {
    void actions.moveAccount(ref, toIndex);
  };
  const summary = total ? t("accountsSummary", { count: total, name: preferred ? preferred.name || t("accountDefault") : "" }) : t("accountsSummaryEmpty");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: open ? Section_default.card : Section_default.card + " " + Section_default.cardFolded, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.cardHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.cardTitle, children: t("accountsTitle") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.cardSub, children: summary }),
            total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { tone: ready === total ? "success" : "warning", children: t("accountsAvailability", { ready, total }) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDown, { className: open ? Section_default.chevronOpen : Section_default.chevron })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.trailing, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_dsh_client_ui_primitives2.Button,
        {
          variant: "outline",
          size: "sm",
          disabled: state.refreshing,
          onClick: actions.loadAccounts,
          children: t(state.refreshing ? "usageRefreshing" : "accountsRefresh")
        }
      ) })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { id: "opencode-go-accounts", className: Section_default.cardBody, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("accountsHint") }),
      total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("accountsOrderHint") }) : null,
      state.blocked ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("accountsBlocked") }) : null,
      state.failure ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t(state.failure === "cleanup" ? "accountsCleanupFailed" : state.failure === "read" ? "accountsReadFailed" : "accountsWriteFailed") }) : null,
      !total ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("accountsEmpty") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.accounts, children: [
        state.entries.map((account, index) => {
          const label = account.name || t("accountDefault");
          const rolling = account.usage?.rolling;
          const expanded = details === account.apiKeyEnv;
          const panelId = `opencode-go-account-${index}`;
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react2.Fragment, { children: [
            reorderable && dropAt === index ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: Section_default.accountDropLine }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "div",
              {
                className: Section_default.accountRow,
                "data-dragging": dragging === account.apiKeyEnv ? "true" : void 0,
                onDragStart: (event) => {
                  if (!reorderable || event.target?.closest?.("[data-account-handle]") == null) {
                    event.preventDefault();
                    return;
                  }
                  if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", account.apiKeyEnv);
                  }
                  setDragging(account.apiKeyEnv);
                },
                onDragOver: (event) => {
                  if (!reorderable || dragging === null || dragging === account.apiKeyEnv) return;
                  event.preventDefault();
                  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                  const box = event.currentTarget.getBoundingClientRect();
                  setDropAt(event.clientY < box.top + box.height / 2 ? index : index + 1);
                },
                onDrop: (event) => {
                  const source = dragging;
                  const slot = dropAt;
                  setDragging(null);
                  setDropAt(null);
                  if (source === null || slot === null) return;
                  event.preventDefault();
                  const from = state.entries.findIndex((entry) => entry.apiKeyEnv === source);
                  if (from >= 0) move(source, slot > from ? slot - 1 : slot);
                },
                onDragEnd: () => {
                  setDragging(null);
                  setDropAt(null);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.accountMain, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                      "button",
                      {
                        type: "button",
                        className: Section_default.accountHandle,
                        "data-account-handle": "",
                        disabled: !reorderable,
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
                        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GripIcon, {})
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { className: Section_default.accountName, children: label }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: Section_default.accountState, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.accountDot, "data-off": account.configured === false ? "true" : void 0 }),
                      account.configured === void 0 ? t("usageLoading") : account.configured ? t("keyConfigured") : t("keyMissing")
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.accountSpacer }),
                    rolling ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: Section_default.accountPercent, children: [
                        rolling.percent,
                        "%"
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        "progress",
                        {
                          className: Section_default.accountProgress,
                          max: 100,
                          value: Math.min(100, rolling.percent),
                          "aria-label": `${label} ${t("usage_rolling")}`
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.accountReset, children: resetText(rolling.resetsAt, t) })
                    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.accountReset, children: account.configured === false ? t("accountConfigureHint") : t(account.loading ? "usageLoading" : "usageUnavailable") }),
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
                        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChevronDown, { className: expanded ? Section_default.chevronOpen : Section_default.chevron })
                      }
                    )
                  ] }),
                  account.failed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: Section_default.accountProblems, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.failedNote, children: t(account.stale ? "usageStaleHint" : "usageRefreshFailed") }) }) : null,
                  expanded ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { id: panelId, className: Section_default.accountDetail, children: [
                    account.usage ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: Section_default.accountUsage, children: WINDOWS.map((window) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
                        t(`usage_${window}`),
                        " \xB7 ",
                        account.usage[window].percent,
                        "%"
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("progress", { "aria-label": `${label} ${t(`usage_${window}`)}`, max: 100, value: Math.min(100, account.usage[window].percent) }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: Section_default.hint, children: [
                        t("usageResets"),
                        " ",
                        new Date(account.usage[window].resetsAt).toLocaleString(locale)
                      ] })
                    ] }, window)) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t(account.loading ? "usageLoading" : "usageUnavailable") }),
                    account.updatedAt ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: Section_default.hint, children: [
                      t("usageLastUpdated"),
                      " ",
                      new Date(account.updatedAt).toLocaleString(locale)
                    ] }) : null,
                    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.accountActions, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        import_dsh_client_ui_primitives2.Button,
                        {
                          variant: "outline",
                          size: "sm",
                          disabled: !reorderable || index === 0,
                          onClick: () => {
                            move(account.apiKeyEnv, index - 1);
                          },
                          children: t("accountMoveUp")
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                        import_dsh_client_ui_primitives2.Button,
                        {
                          variant: "outline",
                          size: "sm",
                          disabled: !reorderable || index === total - 1,
                          onClick: () => {
                            move(account.apiKeyEnv, index + 1);
                          },
                          children: t("accountMoveDown")
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", disabled, onClick: () => {
                        start({ kind: "rename", ref: account.apiKeyEnv }, label);
                      }, children: t("accountRename") }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", disabled: state.busy || state.blocked || account.writable === false, onClick: () => {
                        start({ kind: "key", ref: account.apiKeyEnv }, label);
                      }, children: t("accountReplaceKey") }),
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", disabled, onClick: () => {
                        start({ kind: "remove", ref: account.apiKeyEnv }, label);
                      }, children: t("accountRemove") })
                    ] })
                  ] }) : null
                ]
              }
            )
          ] }, account.id);
        }),
        reorderable && dropAt === total ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: Section_default.accountDropLine }) : null
      ] }),
      editor ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: Section_default.accountEditor, onSubmit: (event) => {
        event.preventDefault();
        void submit();
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: t(editor.kind === "add" ? "accountAdd" : editor.kind === "rename" ? "accountRename" : editor.kind === "key" ? "accountReplaceKey" : "accountRemove") }),
        editor.kind === "remove" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("accountRemoveHint", { name }) }) : null,
        editor.kind === "add" || editor.kind === "rename" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: Section_default.field, children: [
          t("accountName"),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              className: Section_default.input,
              value: name,
              maxLength: 80,
              required: true,
              disabled: state.busy,
              onChange: (event) => {
                setName(event.target.value);
              }
            }
          )
        ] }) : null,
        editor.kind === "add" || editor.kind === "key" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: Section_default.field, children: [
            t("keyLabel"),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                className: Section_default.input,
                type: "password",
                autoComplete: "off",
                value: key,
                required: true,
                disabled: state.busy,
                onChange: (event) => {
                  setKey(event.target.value);
                }
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("accountKeyHint") })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.accountActions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: Section_default.accountSubmit, type: "submit", disabled: editor.kind === "key" ? state.busy || state.blocked : disabled, children: t(state.busy ? "saving" : "accountConfirm") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", disabled: state.busy, onClick: cancel, children: t("accountCancel") })
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_dsh_client_ui_primitives2.Button,
        {
          variant: "outline",
          size: "sm",
          disabled: disabled || total >= MAX_ACCOUNTS,
          onClick: () => {
            start({ kind: "add" });
          },
          children: t("accountAdd")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.field, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.head, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.label, children: t("accountAutoSwitch") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            import_dsh_client_ui_primitives2.Switch,
            {
              checked: state.autoSwitch,
              disabled,
              label: t("accountAutoSwitch"),
              onChange: (next) => {
                void actions.setAutoSwitch(next);
              }
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("accountAutoSwitchHint") })
      ] })
    ] }) : null
  ] });
}

// src/usage-display.ts
var USAGE_DISPLAY_MODES = ["auto", "always", "off"];
var DEFAULT_USAGE_DISPLAY = "auto";

// src/client/Section.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var ChevronDown2 = primitives2.IconChevronDownOutlineRegular ?? primitives2.IconChevronDownOutline14;
function ValueField(props) {
  const hintId = props.id + "-hint";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: Section_default.label, htmlFor: props.id, children: props.label }),
      props.field.overridden ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: Section_default.badges, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: props.overriddenLabel }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: Section_default.reset,
            disabled: props.disabled,
            onClick: props.onReset,
            children: props.resetLabel
          }
        )
      ] }) : null
    ] }),
    props.options ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "select",
      {
        id: props.id,
        name: props.id,
        "aria-describedby": hintId,
        className: props.field.invalid ? Section_default.inputInvalid : Section_default.input,
        "aria-invalid": props.field.invalid || void 0,
        value: props.field.text,
        disabled: props.disabled,
        onChange: (event) => {
          props.onEdit(event.target.value);
        },
        children: props.options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: option.value, children: option.label }, option.value))
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "input",
      {
        id: props.id,
        name: props.id,
        autoComplete: "off",
        "aria-describedby": hintId,
        className: props.field.invalid ? Section_default.inputInvalid : Section_default.input,
        type: props.numeric === true ? "number" : "text",
        ...props.numeric === true ? { inputMode: "numeric" } : {},
        ...props.field.invalid ? { "aria-invalid": true } : {},
        value: props.field.text,
        disabled: props.disabled,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { id: hintId, className: props.field.invalid ? Section_default.invalid : Section_default.hint, children: props.field.invalid ? props.invalidLabel : props.hint })
  ] });
}
function ModelsBody({ models, t, locale }) {
  const sources = models.status === "ready" || models.status === "failed" ? models.sources : void 0;
  const metadataOnlyFailure = sources?.metadata.error !== void 0 && sources.listing.error === void 0;
  const sourceStatus = sources ? ["listing", "metadata"].map((source) => {
    const status = sources[source];
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: Section_default.hint, children: [
      t(source === "listing" ? "modelsListingSource" : "modelsMetadataSource"),
      ": ",
      " ",
      status.error ? t("modelsSourceFailed") : t("modelsSourceCurrent"),
      ". ",
      " ",
      status.updatedAt === void 0 ? t("modelsSourceNeverFetched") : t("modelsSourceUpdated", { time: new Date(status.updatedAt).toLocaleString(locale) })
    ] }, source);
  }) : null;
  if (models.status === "failed") {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t(metadataOnlyFailure ? "modelsMetadataFailed" : "modelsFailed") }),
      models.message ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: models.message }) : null,
      sourceStatus
    ] });
  }
  if (models.status !== "ready") return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, role: "status", "aria-live": "polite", children: t("modelsLoading") });
  const progress = models.refreshing ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, role: "status", children: t("modelsRefreshing") }) : null;
  if (models.stale) return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    progress,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t(metadataOnlyFailure ? "modelsMetadataFailed" : "modelsStale") }),
    models.message ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: models.message }) : null,
    sourceStatus
  ] });
  if (models.refreshing) return progress;
  if (models.count === 0) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t("modelsEmpty") });
  return null;
}
function OpencodeGoSection(props) {
  const { useOpencodeGo, edit, resetField, save, discard, loadModels, setEnabled, setModelEnabled, t } = props;
  if (useOpencodeGo === void 0 || edit === void 0 || resetField === void 0 || save === void 0 || discard === void 0 || loadModels === void 0 || setEnabled === void 0 || setModelEnabled === void 0 || t === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    Loaded,
    {
      state: useOpencodeGo((snapshot) => snapshot),
      t,
      locale: props.getLocale?.(),
      edit,
      resetField,
      save,
      discard,
      loadModels,
      setEnabled,
      setModelEnabled,
      accountActions: props.loadAccounts && props.addAccount && props.renameAccount && props.removeAccount && props.selectAccount && props.setAutoSwitch && props.replaceAccountKey && props.moveAccount ? {
        loadAccounts: props.loadAccounts,
        addAccount: props.addAccount,
        renameAccount: props.renameAccount,
        removeAccount: props.removeAccount,
        selectAccount: props.selectAccount,
        setAutoSwitch: props.setAutoSwitch,
        replaceAccountKey: props.replaceAccountKey,
        moveAccount: props.moveAccount
      } : void 0
    }
  );
}
function Loaded(props) {
  const { t, state, loadModels } = props;
  const [advanced, setAdvanced] = (0, import_react3.useState)(false);
  const [modelsOpen, setModelsOpen] = (0, import_react3.useState)(false);
  const modelNotices = /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ModelsBody, { models: state.models, t, locale: props.locale }),
    state.pickerFailed ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t("pickerFailed") }) : null
  ] });
  (0, import_react3.useEffect)(() => {
    if (state.available && state.models.status === "idle") loadModels();
  }, [state.available, state.models.status, loadModels]);
  if (!state.available) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.intro, children: t("unavailable") });
  }
  const disabled = !state.writable;
  const fieldProps = {
    invalidLabel: t("invalidValue"),
    overriddenLabel: t("overridden"),
    resetLabel: t("reset"),
    disabled
  };
  const advancedOverridden = state.usageDisplay.overridden || state.apiKeyEnv.overridden || state.baseURL.overridden || state.refreshMinutes.overridden || state.streamIdleTimeoutMs.overridden || state.maxImages.overridden || state.maxRequestImageBytes.overridden || state.requestImagePixelBudget.overridden || state.requestImageMaxBytes.overridden;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.page, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.pageBody, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.pageTop, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { className: Section_default.title, children: t("titleLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.intro, children: t("intro") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: Section_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.cardHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: Section_default.cardTitle, children: t("enabledLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_dsh_client_ui_primitives3.Switch,
            {
              checked: state.enabled,
              label: t("enabledLabel"),
              disabled: disabled || state.saving || state.pickerSaving,
              onChange: props.setEnabled
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: Section_default.cardBody, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: state.enabled ? t("enabledHint") : t("enabledOff") }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: Section_default.cardDivider }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.cardHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.slot, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", focusable: "false", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "5.4", cy: "8", r: "3.1" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M8.5 8h5.3M11.9 8v2.2M10.2 8v1.6" })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: Section_default.label, htmlFor: "opencode-go-key", children: t("keyLabel") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.trailing, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: state.apiKeyConfigured ? "success" : "warning", children: state.apiKeyConfigured ? t("keyConfigured") : t("keyMissing") }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.cardBody, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              id: "opencode-go-key",
              name: "api-key",
              className: Section_default.input,
              type: "password",
              autoComplete: "off",
              "aria-describedby": "opencode-go-key-hint",
              value: state.apiKey.text,
              disabled: !state.apiKeyWritable,
              onChange: (event) => {
                props.edit("apiKey", event.target.value);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { id: "opencode-go-key-hint", className: Section_default.hint, children: state.apiKeyWritable ? t("keyHint") : t("keyNotWritable") })
        ] })
      ] }),
      state.accounts && props.accountActions ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        AccountsCard,
        {
          state: state.accounts,
          actions: props.accountActions,
          writable: state.writable,
          t,
          locale: props.locale
        }
      ) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: modelsOpen ? Section_default.cardModels : Section_default.cardModels + " " + Section_default.cardFolded, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            type: "button",
            className: Section_default.cardTrigger,
            "aria-expanded": modelsOpen,
            "aria-controls": "opencode-go-models",
            onClick: () => {
              setModelsOpen(!modelsOpen);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.cardTitle, children: t("modelsLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronDown2, { className: modelsOpen ? Section_default.chevronOpen : Section_default.chevron })
            ]
          }
        ),
        modelsOpen ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { id: "opencode-go-models", className: Section_default.cardBody, children: [
          modelNotices,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            ModelEditor,
            {
              models: state.models,
              draft: state.modelLimitDraft,
              t,
              locale: props.locale,
              disabled: disabled || state.saving,
              modelVisibility: state.modelVisibility,
              visibilitySaving: state.pickerSaving,
              filterAction: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_dsh_client_ui_primitives3.Button,
                {
                  variant: "outline",
                  size: "sm",
                  disabled: state.models.status === "loading" || state.models.status === "ready" && state.models.refreshing,
                  onClick: loadModels,
                  children: t("modelsRefresh")
                }
              ),
              onModelEnabled: props.setModelEnabled,
              onEdit: (next) => {
                props.edit("modelLimits", JSON.stringify(next));
              }
            }
          )
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: Section_default.cardNotes, children: modelNotices })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: Section_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            type: "button",
            className: Section_default.cardTrigger,
            "aria-expanded": advanced,
            "aria-controls": "opencode-go-advanced",
            onClick: () => {
              setAdvanced(!advanced);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.cardTitle, children: t("advancedLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.cardSub, children: t("advancedSummary") }),
              advancedOverridden ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: t("overridden") }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronDown2, { className: advanced ? Section_default.chevronOpen : Section_default.chevron })
            ]
          }
        ),
        advanced ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { id: "opencode-go-advanced", className: Section_default.cardBody, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t("advancedHint") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.advancedGrid, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-usage-display",
                label: t("usageDisplayLabel"),
                hint: t("usageDisplayHint"),
                field: state.usageDisplay,
                options: USAGE_DISPLAY_MODES.map((value) => ({ value, label: t(`usageDisplay_${value}`) })),
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("usageDisplay", text);
                },
                onReset: () => {
                  props.resetField("usageDisplay");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-api-key-env",
                label: t("apiKeyEnvLabel"),
                hint: t("apiKeyEnvHint"),
                field: state.apiKeyEnv,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("apiKeyEnv", text);
                },
                onReset: () => {
                  props.resetField("apiKeyEnv");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-base-url",
                label: t("baseURLLabel"),
                hint: t("baseURLHint"),
                field: state.baseURL,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("baseURL", text);
                },
                onReset: () => {
                  props.resetField("baseURL");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-refresh-minutes",
                label: t("refreshMinutesLabel"),
                hint: t("refreshMinutesHint"),
                field: state.refreshMinutes,
                numeric: true,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("refreshMinutes", text);
                },
                onReset: () => {
                  props.resetField("refreshMinutes");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-stream-idle",
                label: t("streamIdleTimeoutMsLabel"),
                hint: t("streamIdleTimeoutMsHint"),
                field: state.streamIdleTimeoutMs,
                numeric: true,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("streamIdleTimeoutMs", text);
                },
                onReset: () => {
                  props.resetField("streamIdleTimeoutMs");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-max-images",
                label: t("maxImagesLabel"),
                hint: t("maxImagesHint"),
                field: state.maxImages,
                numeric: true,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("maxImages", text);
                },
                onReset: () => {
                  props.resetField("maxImages");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-max-request-image-bytes",
                label: t("maxRequestImageBytesLabel"),
                hint: t("maxRequestImageBytesHint"),
                field: state.maxRequestImageBytes,
                numeric: true,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("maxRequestImageBytes", text);
                },
                onReset: () => {
                  props.resetField("maxRequestImageBytes");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-image-pixel-budget",
                label: t("requestImagePixelBudgetLabel"),
                hint: t("requestImagePixelBudgetHint"),
                field: state.requestImagePixelBudget,
                numeric: true,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("requestImagePixelBudget", text);
                },
                onReset: () => {
                  props.resetField("requestImagePixelBudget");
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              ValueField,
              {
                id: "opencode-go-image-max-bytes",
                label: t("requestImageMaxBytesLabel"),
                hint: t("requestImageMaxBytesHint"),
                field: state.requestImageMaxBytes,
                numeric: true,
                ...fieldProps,
                onEdit: (text) => {
                  props.edit("requestImageMaxBytes", text);
                },
                onReset: () => {
                  props.resetField("requestImageMaxBytes");
                }
              }
            )
          ] })
        ] }) : null
      ] }),
      disabled ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t("readOnly") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.actions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", size: "md", disabled: disabled || !state.dirty || state.invalid || state.saving || state.pickerSaving, onClick: props.save, children: state.saving ? t("saving") : t("save") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", size: "md", disabled: disabled || !state.dirty || state.saving, onClick: props.discard, children: t("discard") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "a",
        {
          className: Section_default.starLink,
          href: "https://github.com/Duskriver/dsh-opencode-go",
          target: "_blank",
          rel: "noopener noreferrer",
          title: t("starProjectTitle"),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("starProject") })
          ]
        }
      ),
      state.failed ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.failedNote, children: t("savedFailed") }) : null
    ] })
  ] });
}

// src/provider-identity.ts
var PROVIDER_ID = "dsh-opencode-go";

// src/client/accounts-controller.ts
var GoAccountsController = class {
  constructor(scope, ctx, readUsage, publish, blocked) {
    this.scope = scope;
    this.ctx = ctx;
    this.readUsage = readUsage;
    this.publish = publish;
    this.blocked = blocked;
    this.sync();
  }
  rows = /* @__PURE__ */ new Map();
  busy = false;
  refreshing = false;
  failure;
  epoch = 0;
  identity = "";
  loaded = false;
  disposed = false;
  snapshot() {
    const config = this.scope.getSnapshot().value ?? {};
    return {
      entries: accountsOf(config).map((account) => ({ ...this.rows.get(account.apiKeyEnv), ...account })),
      activeRef: accountRefOf(config),
      autoSwitch: config.autoSwitch === true,
      busy: this.busy,
      blocked: this.blocked(),
      refreshing: this.refreshing,
      failure: this.failure
    };
  }
  sync() {
    const config = this.scope.getSnapshot().value ?? {};
    const identity = JSON.stringify([
      accountsOf(config).map((account) => [account.id, account.name, account.apiKeyEnv]).sort((left, right) => left[2] < right[2] ? -1 : left[2] > right[2] ? 1 : 0),
      config.baseURL
    ]);
    if (identity === this.identity) return;
    this.identity = identity;
    this.epoch++;
    this.rows.clear();
    this.refreshing = false;
    if (this.loaded) void this.refresh();
  }
  dispose() {
    this.disposed = true;
    this.epoch++;
  }
  invalidate(ref) {
    if (!accountsOf(this.scope.getSnapshot().value ?? {}).some((account) => account.apiKeyEnv === ref)) return;
    this.epoch++;
    this.rows.delete(ref);
    if (this.loaded) void this.refresh();
  }
  async refresh() {
    this.loaded = true;
    const epoch = ++this.epoch;
    const accounts = [...accountsOf(this.scope.getSnapshot().value ?? {})];
    this.refreshing = true;
    this.publish();
    try {
      const described = await this.ctx.remote.credentials.describe(accounts.map((account) => account.apiKeyEnv));
      if (this.disposed || epoch !== this.epoch) return;
      if (!described.ok) {
        this.failure = "read";
        return;
      }
      this.failure = void 0;
      await Promise.all(accounts.map(async (account) => {
        const ref = account.apiKeyEnv;
        const info = described.value[ref];
        const previous = this.rows.get(ref);
        this.rows.set(ref, {
          ...previous,
          ...account,
          configured: info?.configured ?? false,
          writable: info?.writable ?? true,
          loading: info?.configured === true,
          failed: false
        });
        this.publish();
        if (!info?.configured) {
          this.rows.set(ref, { ...account, configured: false, writable: info?.writable ?? true });
          return;
        }
        try {
          const usage = await this.readUsage(ref);
          if (this.disposed || epoch !== this.epoch) return;
          this.rows.set(ref, { ...account, configured: true, writable: info.writable, usage, updatedAt: Date.now() });
        } catch (error) {
          if (this.disposed || epoch !== this.epoch) return;
          const details = error && typeof error === "object" && "code" in error && error.code === "opencode-go/usage-unavailable" && "details" in error && error.details && typeof error.details === "object" ? error.details : void 0;
          const retain = details?.retryable === true && details.retainPrevious === true && previous?.usage?.source && previous.usage.source === details.source;
          this.rows.set(ref, {
            ...account,
            configured: true,
            writable: info.writable,
            failed: true,
            ...retain ? { usage: previous.usage, updatedAt: previous.updatedAt, stale: true } : {}
          });
        }
        this.publish();
      }));
    } catch {
      if (epoch === this.epoch) this.failure = "read";
    } finally {
      if (!this.disposed && epoch === this.epoch) {
        this.refreshing = false;
        this.publish();
      }
    }
  }
  actions() {
    return {
      loadAccounts: () => {
        void this.refresh();
      },
      addAccount: (name, key) => this.add(name, key),
      renameAccount: (ref, name) => this.rename(ref, name),
      removeAccount: (ref) => this.remove(ref),
      selectAccount: (ref) => this.select(ref),
      setAutoSwitch: (next) => this.run(async () => {
        await this.scope.set("autoSwitch", next);
        return this.scope.getSnapshot().value?.autoSwitch === next;
      }),
      replaceAccountKey: (ref, key) => this.run(async () => {
        if (!key.trim() || !this.account(ref) || this.rows.get(ref)?.writable === false) return false;
        const response = await this.ctx.remote.credentials.set(ref, key.trim());
        if (!response.ok) return false;
        this.invalidate(ref);
        return true;
      }, false),
      moveAccount: (ref, toIndex) => this.move(ref, toIndex)
    };
  }
  /**
   * Reorder the visible accounts and keep the preferred reference on the first row.
   * The adapter tries the preferred reference first and the rest in array order, so
   * one write is what makes top-to-bottom the real call order. A placeholder row the
   * settings never stored is materialized here, which its `legacy:` id admits.
   */
  move(ref, toIndex) {
    return this.run(async () => {
      const snapshot = this.scope.getSnapshot();
      const entries = [...accountsOf(snapshot.value ?? {})];
      const from = entries.findIndex((account) => account.apiKeyEnv === ref);
      if (from < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= entries.length || toIndex === from) return false;
      const [moved] = entries.splice(from, 1);
      entries.splice(toIndex, 0, moved);
      await this.mutate([
        { op: "set", path: ["accounts"], value: entries },
        { op: "set", path: ["apiKeyEnv"], value: entries[0].apiKeyEnv }
      ], snapshot.revision);
      const after = this.scope.getSnapshot().value;
      return after?.apiKeyEnv === entries[0].apiKeyEnv && after.accounts?.[toIndex]?.apiKeyEnv === ref;
    });
  }
  account(ref) {
    return accountsOf(this.scope.getSnapshot().value ?? {}).find((account) => account.apiKeyEnv === ref);
  }
  async mutate(ops, revision = this.scope.getSnapshot().revision) {
    await this.scope.mutate(ops, revision);
  }
  add(name, key) {
    return this.run(async () => {
      const snapshot = this.scope.getSnapshot();
      const existing = accountsOf(snapshot.value ?? {});
      const accounts = existing.filter((account2) => !(snapshot.value?.accounts == null && !account2.name && this.rows.get(account2.apiKeyEnv)?.configured === false));
      if (!name.trim() || name.trim().length > 80 || !key.trim() || accounts.length >= MAX_ACCOUNTS) return false;
      const id3 = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const ref = ACCOUNT_REF_PREFIX + id3.replaceAll("-", "").toUpperCase();
      const account = { id: id3, name: name.trim(), apiKeyEnv: ref };
      const response = await this.ctx.remote.credentials.set(ref, key.trim());
      if (!response.ok) return false;
      const first = accounts.length === 0 || accounts.length === 1 && this.rows.get(accounts[0].apiKeyEnv)?.configured === false;
      try {
        await this.mutate([
          { op: "set", path: ["accounts"], value: [...accounts, account] },
          ...first ? [{ op: "set", path: ["apiKeyEnv"], value: ref }] : []
        ], snapshot.revision);
        if (this.scope.getSnapshot().value?.accounts?.some((entry) => entry.id === id3)) return true;
      } catch {
        return false;
      }
      try {
        if (!(await this.ctx.remote.credentials.unset(ref)).ok) this.failure = "cleanup";
      } catch {
        this.failure = "cleanup";
      }
      return false;
    });
  }
  rename(ref, name) {
    return this.run(async () => {
      if (!this.account(ref) || !name.trim() || name.trim().length > 80) return false;
      const accounts = accountsOf(this.scope.getSnapshot().value ?? {}).map((account) => account.apiKeyEnv === ref ? { ...account, name: name.trim() } : account);
      await this.mutate([{ op: "set", path: ["accounts"], value: accounts }]);
      return this.scope.getSnapshot().value?.accounts?.find((account) => account.apiKeyEnv === ref)?.name === name.trim();
    });
  }
  select(ref) {
    return this.run(async () => {
      if (!this.account(ref)) return false;
      await this.mutate([{ op: "set", path: ["apiKeyEnv"], value: ref }]);
      return accountRefOf(this.scope.getSnapshot().value ?? {}) === ref;
    });
  }
  remove(ref) {
    return this.run(async () => {
      if (!this.account(ref)) return false;
      const config = this.scope.getSnapshot().value ?? {};
      const remaining = accountsOf(config).filter((account) => account.apiKeyEnv !== ref);
      await this.mutate([
        { op: "set", path: ["accounts"], value: remaining },
        ...accountRefOf(config) === ref && remaining.length ? [{ op: "set", path: ["apiKeyEnv"], value: remaining[0].apiKeyEnv }] : []
      ]);
      if (this.account(ref)) return false;
      if (ref.startsWith(ACCOUNT_REF_PREFIX)) {
        const removed = await this.ctx.remote.credentials.unset(ref);
        if (!removed.ok) {
          this.failure = "cleanup";
          return false;
        }
      }
      return true;
    });
  }
  async run(action, requiresSettings = true) {
    if (this.busy || this.blocked() || requiresSettings && !this.scope.getSnapshot().writable) return false;
    this.busy = true;
    this.failure = void 0;
    this.publish();
    try {
      const accepted = await action();
      if (!accepted && !this.failure) this.failure = "write";
      return accepted;
    } catch {
      this.failure ??= "write";
      return false;
    } finally {
      this.busy = false;
      this.publish();
    }
  }
};

// src/client/staged-form.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function numberField(field, validate = () => true) {
  return {
    field,
    format: (value) => typeof value === "number" ? String(value) : "",
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "clear" };
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) && validate(parsed) ? { kind: "set", value: parsed } : void 0;
    }
  };
}
function booleanField(field) {
  return {
    field,
    format: (value) => typeof value === "boolean" ? String(value) : "",
    parse: (text) => {
      if (text === "true") return { kind: "set", value: true };
      if (text === "false") return { kind: "set", value: false };
      return void 0;
    }
  };
}
function textField(field) {
  return {
    field,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
function jsonField(field) {
  return {
    field,
    format: (value) => value === void 0 || value === null ? "" : JSON.stringify(value, void 0, 2),
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "clear" };
      try {
        return { kind: "set", value: JSON.parse(trimmed) };
      } catch {
        return void 0;
      }
    }
  };
}
var StagedForm = class {
  /**
   * @param scope - the bound settings scope for this page's namespace.
   * @param specs - the section fields this page edits.
   * @param secrets - the page's write-only controls, written outside the section.
   */
  constructor(scope, specs, secrets = []) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    this.secretSpecs = new Map(secrets.map((spec) => [spec.field, spec]));
    this.unsubscribe = scope.subscribe(() => {
      this.publish();
    });
  }
  specs;
  secretSpecs;
  staged = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  unsubscribe;
  saving = false;
  failed = false;
  /** Shared 0.1.7 forms outlive individual settings pages. */
  dispose() {
    this.unsubscribe();
    this.listeners.clear();
  }
  /**
   * Publish a projection of this form, rebuilt whenever the scope or a draft changes.
   * @param project - build the page state from the form's current reads.
   * @returns the store the component reads through its bound selector.
   */
  bind(project) {
    const store = (0, import_dsh_client_store.createSnapshotStore)(project());
    this.listeners.add(() => {
      store.set(project());
    });
    return store;
  }
  /**
   * Read the page-level state: what the Host serves, and what a save would do.
   * @returns the form state the page shell shares.
   */
  shell() {
    const snapshot = this.scope.getSnapshot();
    const plan = this.plan();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.run === void 0),
      saving: this.saving,
      failed: this.failed
    };
  }
  /**
   * Read one control's state.
   * @param field - field name of a section field or of a write-only control.
   * @returns the draft text, whether a save would leave an override, and whether it is invalid.
   */
  field(field) {
    const staged = this.staged.get(field);
    if (this.secretSpecs.has(field)) {
      return { text: staged?.text ?? "", overridden: false, invalid: false };
    }
    const spec = this.spec(field);
    if (staged === void 0) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
    }
    const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
    return {
      text: staged.text,
      // A draft a save would skip leaves the user layer exactly as it stands, so
      // the badge answers for that standing override instead of the edit.
      overridden: this.unchangedDraft(field, staged) ? this.stored(field) : write?.kind === "set",
      invalid: write === void 0
    };
  }
  /**
   * Build the edit, reset, save, and discard actions bound to this form.
   * @returns the actions the page's slot entry injects.
   */
  actions() {
    return {
      edit: (field, text) => {
        this.stage(field, { text, clear: false });
      },
      resetField: (field) => {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true });
      },
      save: () => {
        void this.save();
      },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return;
        this.staged.clear();
        this.failed = false;
        this.publish();
      }
    };
  }
  /**
   * Write every staged edit, then re-seed from what the Host accepted.
   *
   * The Host is the only authority on whether a value was accepted — its
   * validators own the constraints no schema can express — so the outcome is
   * read back from the section rather than predicted here. A save that did not
   * land keeps its drafts, so the user can correct them instead of retyping.
   */
  async save() {
    const plan = this.plan();
    const writes = plan.flatMap((item) => item.run === void 0 ? [] : [item.run]);
    if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
    this.saving = true;
    this.failed = false;
    this.publish();
    let landed = true;
    for (const write of writes) {
      try {
        landed = await write() && landed;
      } catch {
        landed = false;
      }
    }
    if (landed) this.staged.clear();
    this.saving = false;
    this.failed = !landed;
    this.publish();
  }
  /**
   * Every staged edit a save would write. An entry whose draft is not a value
   * its field accepts carries no write: the form is still dirty, and the save
   * refuses rather than dropping the edit.
   * @returns the planned writes, in the order the fields were staged.
   */
  plan() {
    const plan = [];
    for (const [field, staged] of this.staged) {
      const secret = this.secretSpecs.get(field);
      if (secret !== void 0) {
        const value = staged.text.trim();
        if (value !== "") plan.push({ field, run: () => secret.write(value) });
        continue;
      }
      const spec = this.spec(field);
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, run: () => this.clear(field) });
        continue;
      }
      if (this.unchangedDraft(field, staged)) continue;
      const write = spec.parse(staged.text);
      if (write === void 0) plan.push({ field, run: void 0 });
      else if (write.kind === "clear") plan.push({ field, run: () => this.clear(field) });
      else plan.push({ field, run: () => this.store(field, write.value) });
    }
    return plan;
  }
  async clear(field) {
    await this.scope.unset(field);
    return !this.stored(field);
  }
  async store(field, value) {
    await this.scope.set(field, value);
    return sameJsonValue(this.userLayer()?.[field], value);
  }
  stage(field, edit) {
    this.staged.set(field, edit);
    this.failed = false;
    this.publish();
  }
  spec(field) {
    const spec = this.specs.get(field);
    if (spec === void 0) throw new Error(`opencode-go settings page has no field ${field}`);
    return spec;
  }
  snapshotOf() {
    return this.scope.getSnapshot();
  }
  sectionValue(field) {
    return this.snapshotOf().value?.[field];
  }
  baseValue(field) {
    return this.snapshotOf().base?.[field];
  }
  userLayer() {
    return this.snapshotOf().user;
  }
  stored(field) {
    const user = this.userLayer();
    return user !== void 0 && Object.hasOwn(user, field);
  }
  /**
   * Whether a draft already equals the field's effective value, so a save would
   * write nothing. The save plan and the override badge both answer for it.
   * @param field - field name inside the namespace section.
   * @param staged - the staged edit to test.
   * @returns true when the draft is a no-op; a clear is never one.
   */
  unchangedDraft(field, staged) {
    return !staged.clear && staged.text === this.spec(field).format(this.sectionValue(field));
  }
  publish() {
    for (const listener of this.listeners) listener();
  }
};
function sameJsonValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => sameJsonValue(value, right[index]));
  }
  const leftRecord = left;
  const rightRecord = right;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(rightRecord, key) && sameJsonValue(leftRecord[key], rightRecord[key]));
}

// src/client/section-controller.ts
var OPENCODE_GO_NS = "llm-opencode-go";
var DEFAULT_API_KEY_REF = "OPENCODE_API_KEY";
var API_KEY_FIELD = "apiKey";
var OpencodeGoSectionController = class {
  /**
   * @param scope - the bound settings scope for the `llm-opencode-go` namespace.
   * @param ctx - the page plugin's context, whose `remote.credentials` namespace
   *   answers for the credential the section references.
   */
  constructor(scope, ctx, readModels = async () => {
    const result = await ctx.remote.llm.discoverModels(OPENCODE_GO_NS, { provider: PROVIDER_ID });
    return result.ok ? { ok: true, value: { models: result.value, stale: false } } : result;
  }, readUsage = async (ref) => {
    const result = await ctx.remote.opencodeGoUsage.readAccount(ref);
    if (!result.ok) throw result.error;
    return result.value;
  }) {
    this.scope = scope;
    this.ctx = ctx;
    this.readModels = readModels;
    this.form = new StagedForm(
      scope,
      [
        // Present so the shared override/reset machinery tracks the field; the
        // page's switch writes it directly instead of staging it.
        booleanField("enabled"),
        {
          field: "usageDisplay",
          format: (value) => typeof value === "string" ? value : DEFAULT_USAGE_DISPLAY,
          parse: (text) => USAGE_DISPLAY_MODES.some((mode) => mode === text) ? { kind: "set", value: text } : void 0
        },
        textField("apiKeyEnv"),
        textField("baseURL"),
        numberField("refreshMinutes"),
        numberField("streamIdleTimeoutMs"),
        numberField("maxImages", (value) => Number.isSafeInteger(value) && value > 0),
        numberField("maxRequestImageBytes"),
        numberField("requestImagePixelBudget"),
        numberField("requestImageMaxBytes"),
        jsonField("modelLimits")
      ],
      [{ field: API_KEY_FIELD, write: (text) => this.writeKey(text) }]
    );
    this.store = this.form.bind(() => this.projection());
    this.accounts = new GoAccountsController(
      scope,
      ctx,
      readUsage,
      () => {
        this.store.set(this.projection());
      },
      () => this.form.shell().saving || this.pickerSaving || Boolean(this.form.field(API_KEY_FIELD).text.trim())
    );
    this.store.set(this.projection());
    let modelsEndpoint = scope.getSnapshot().value?.baseURL;
    this.unsubscribe = scope.subscribe(() => {
      this.accounts?.sync();
      this.store.set(this.projection());
      const endpoint = scope.getSnapshot().value?.baseURL;
      if (endpoint !== modelsEndpoint) {
        modelsEndpoint = endpoint;
        this.modelsRequest++;
        this.models = { status: "idle" };
        this.store.set(this.projection());
      }
      void this.readCredential();
    });
    void this.readCredential();
  }
  form;
  store;
  credential = { ref: "", configured: false, writable: true };
  models = { status: "idle" };
  modelsRequest = 0;
  pickerSaving = false;
  pickerFailed = false;
  face;
  unsubscribe;
  accounts;
  credentialRequest = 0;
  keyDraftRef;
  /** Release subscriptions without disposing the host's shared form. */
  dispose() {
    this.credentialRequest++;
    this.accounts?.dispose();
    this.modelsRequest++;
    this.unsubscribe();
    this.form.dispose();
  }
  projection() {
    return {
      ...this.form.shell(),
      saving: this.form.shell().saving || this.accounts?.snapshot().busy === true,
      accounts: this.accounts?.snapshot(),
      enabled: this.enabled(),
      usageDisplay: this.form.field("usageDisplay"),
      modelVisibility: this.scope.getSnapshot().value?.modelVisibility ?? {},
      pickerSaving: this.pickerSaving,
      pickerFailed: this.pickerFailed,
      apiKeyEnv: this.form.field("apiKeyEnv"),
      baseURL: this.form.field("baseURL"),
      refreshMinutes: this.form.field("refreshMinutes"),
      streamIdleTimeoutMs: this.form.field("streamIdleTimeoutMs"),
      maxImages: this.form.field("maxImages"),
      maxRequestImageBytes: this.form.field("maxRequestImageBytes"),
      requestImagePixelBudget: this.form.field("requestImagePixelBudget"),
      requestImageMaxBytes: this.form.field("requestImageMaxBytes"),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.ref === refOf(this.scope.getSnapshot()) && this.credential.configured && accountsOf(this.scope.getSnapshot().value ?? {}).length > 0,
      apiKeyWritable: this.credential.writable,
      models: this.models,
      modelLimits: this.form.field("modelLimits"),
      modelLimitDraft: this.limitDraft()
    };
  }
  /**
   * Read the overrides as the page currently shows them. A staged JSON draft
   * wins while it is valid; malformed text falls back to the last accepted
   * settings value so the table never renders phantom rows.
   */
  limitDraft() {
    const staged = this.form.field("modelLimits");
    if (staged.invalid) return modelLimitsOf(this.scope.getSnapshot().value?.modelLimits);
    if (staged.overridden || this.form.shell().dirty) {
      try {
        return modelLimitsOf(JSON.parse(staged.text));
      } catch {
        return modelLimitsOf(this.scope.getSnapshot().value?.modelLimits);
      }
    }
    return modelLimitsOf(this.scope.getSnapshot().value?.modelLimits);
  }
  /**
   * The adapter's effective switch state: the resolved section's value, over
   * the Host's own default when the section carries none.
   * @returns whether the route is currently served.
   */
  enabled() {
    return this.scope.getSnapshot().value?.enabled ?? true;
  }
  /**
   * Flip the switch by writing the field on the click itself.
   *
   * Like the per-model switches, this control does not wait for Save: the point
   * of turning it off is to watch the models leave the pickers, and the point
   * of turning it back on is to use the route again — staging either behind a
   * second gesture would report a state the Host does not hold. The write is
   * revision-fenced by the scope like every other, and a refusal surfaces as a
   * failed save through the shared shell rather than a silent revert.
   * @param next - the state the switch asks for.
   */
  async setEnabled(next) {
    await this.writePickerSetting("enabled", next, () => this.enabled() === next);
  }
  /** Each model switch has one committed value and takes effect without Save. */
  async setModelEnabled(id3, next) {
    if (this.models.status === "ready" && this.models.entries.some((model) => model.id === id3 && model.configurationMissing)) return;
    await this.writePickerSetting(
      "modelVisibility",
      { ...this.scope.getSnapshot().value?.modelVisibility, [id3]: next },
      () => this.scope.getSnapshot().value?.modelVisibility?.[id3] === next
    );
  }
  /** Serialize immediate switches with form saves; refused writes retain committed values. */
  async writePickerSetting(field, value, accepted) {
    if (this.pickerSaving || this.form.shell().saving || this.accounts?.snapshot().busy || !this.scope.getSnapshot().writable) return;
    this.pickerSaving = true;
    this.pickerFailed = false;
    this.store.set(this.projection());
    try {
      await this.scope.set(field, value);
      this.pickerFailed = !accepted();
    } catch {
      this.pickerFailed = true;
    } finally {
      this.pickerSaving = false;
      this.store.set(this.projection());
    }
  }
  /**
   * Read the gateway's model listing through the Host's discovery for this
   * adapter. Called when the page mounts and again from its refresh control.
   * A rejection settles as a failure too: the refresh control is disabled
   * while loading and the next read starts only from `idle`, so leaving the
   * state loading would strand the page with no way to ask the gateway again.
   */
  loadModels() {
    const request = ++this.modelsRequest;
    const previous = this.models.status === "ready" ? this.models : void 0;
    this.models = previous ? { ...previous, refreshing: true } : { status: "loading" };
    this.store.set(this.projection());
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
      this.store.set(this.projection());
    }).catch((error) => {
      if (request !== this.modelsRequest) return;
      failed(error instanceof Error ? error.message : String(error));
      this.store.set(this.projection());
    });
  }
  /**
   * Ask the credentials domain about the reference the section currently names.
   *
   * The answer is stored with the reference it describes: `apiKeyEnv` can
   * change between the request and its response, and two reads can settle out
   * of order, so a response is published only while it still answers for the
   * reference in force.
   */
  async readCredential() {
    const request = ++this.credentialRequest;
    const ref = refOf(this.scope.getSnapshot());
    if (accountsOf(this.scope.getSnapshot().value ?? {}).length === 0) {
      this.credential = { ref, configured: false, writable: false };
      this.store.set(this.projection());
      return;
    }
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true };
      this.store.set(this.projection());
    }
    const response = await this.ctx.remote.credentials.describe([ref]).catch(() => void 0);
    if (!response?.ok || request !== this.credentialRequest || ref !== refOf(this.scope.getSnapshot())) return;
    const view = response.value[ref];
    const next = {
      ref,
      configured: view?.configured ?? false,
      // An unknown reference is treated as writable: the control stays usable
      // and the Host is what refuses, rather than the page guessing a refusal.
      writable: view?.writable ?? true
    };
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return;
    this.credential = next;
    this.store.set(this.projection());
  }
  /**
   * Re-read after the Host reports a change to the reference this page watches.
   *
   * A key can be written from somewhere else — the Models page addresses the
   * same reference — and the settings section does not change when it is, so
   * without this the badge keeps reporting a state the Host already replaced.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref) {
    this.accounts?.invalidate(ref);
    if (ref !== this.credential.ref) return;
    void this.readCredential();
  }
  /**
   * Build the face the page's slot registration injects. Built once: the store
   * is what changes, and the renderer binds the same callbacks across renders.
   * @returns the page snapshot and its form actions.
   */
  inject() {
    this.face ??= {
      hooks: { opencodeGo: this.store },
      loadModels: () => {
        this.loadModels();
      },
      setEnabled: (next) => {
        void this.setEnabled(next);
      },
      setModelEnabled: (id3, next) => {
        void this.setModelEnabled(id3, next);
      },
      ...this.form.actions(),
      ...this.accounts.actions(),
      edit: (field, text) => {
        if (field === API_KEY_FIELD) {
          if (text.trim()) this.keyDraftRef ??= refOf(this.scope.getSnapshot());
          else this.keyDraftRef = void 0;
        }
        this.form.actions().edit(field, text);
      },
      discard: () => {
        this.keyDraftRef = void 0;
        this.form.actions().discard();
      },
      save: () => {
        if (!this.accounts?.snapshot().busy) void this.form.save().then(() => {
          if (!this.form.field(API_KEY_FIELD).text.trim()) this.keyDraftRef = void 0;
        });
      }
    };
    return this.face;
  }
  /**
   * Write the staged key, then re-read whether the Host now holds one.
   * @param value - the staged credential literal.
   * @returns whether the Host reports a configured credential afterwards.
   */
  async writeKey(value) {
    const ref = this.keyDraftRef ?? refOf(this.scope.getSnapshot());
    const response = await this.ctx.remote.credentials.set(ref, value);
    if (!response.ok) return false;
    this.accounts?.invalidate(ref);
    await this.readCredential();
    return ref === this.credential.ref ? this.credential.configured : true;
  }
};
function modelLimitsOf(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const limits = {};
  for (const [id3, entry] of Object.entries(value)) {
    if (entry === null) {
      limits[id3] = null;
      continue;
    }
    if (typeof entry !== "object" || Array.isArray(entry)) continue;
    const fields = entry;
    const limit = {};
    if (fields.contextWindow === null) limit.contextWindow = null;
    if (fields.maxTokens === null) limit.maxTokens = null;
    if (typeof fields.contextWindow === "number" && Number.isSafeInteger(fields.contextWindow) && fields.contextWindow > 0) {
      limit.contextWindow = fields.contextWindow;
    }
    if (typeof fields.maxTokens === "number" && Number.isSafeInteger(fields.maxTokens) && fields.maxTokens > 0) {
      limit.maxTokens = fields.maxTokens;
    }
    if (limit.contextWindow !== void 0 || limit.maxTokens !== void 0) limits[id3] = limit;
  }
  return limits;
}
function refOf(snapshot) {
  const declared = snapshot.value?.apiKeyEnv;
  return declared !== void 0 && declared.length > 0 ? declared : DEFAULT_API_KEY_REF;
}

// src/client/locales.ts
var en = {
  accountsTitle: "Accounts",
  accountsRefresh: "Refresh accounts",
  accountsHint: "Account changes apply immediately to new requests in this profile. Requests already generating keep their key. Usage refreshes every minute while this page is visible.",
  accountsBlocked: "Save or discard the API key draft before changing accounts.",
  accountsEmpty: "Add an account to use OpenCode Go.",
  accountsWriteFailed: "Could not apply the account change. Your input is kept; please retry.",
  accountsReadFailed: "Could not read account status. Please refresh.",
  accountsCleanupFailed: "The account entry was removed, but its stored key could not be deleted. Remove the unused reference through the host credential service.",
  accountDefault: "Default account",
  accountAdd: "Add account",
  accountRename: "Rename",
  accountReplaceKey: "Replace key",
  accountRemove: "Remove account",
  accountRemoveHint: "Remove \u201C{name}\u201D? If it is selected, the next account becomes preferred. Keys added here are deleted from the credential service; existing external references are kept.",
  accountName: "Account name",
  accountKeyHint: "The key is saved through the host credential service and is never returned to this page.",
  accountConfirm: "Confirm",
  accountCancel: "Cancel",
  accountAutoSwitch: "Automatic fallback",
  accountAutoSwitchHint: "Off by default. On quota exhaustion or a rejected key, try the other accounts in order before any content or tool call is emitted. Each account is tried at most once. Your preferred account stays selected; ordinary rate limits and network failures use host recovery.",
  accountSwitchLabel: "Account",
  accountSwitchFailed: "Could not switch account. Please retry.",
  accountFallbackQuota: "The preferred account reached its quota; automatically used",
  accountFallbackCredential: "The preferred key was unavailable or rejected; automatically used",
  accountsSummary: "{count} accounts \xB7 Preferred {name}",
  accountsSummaryEmpty: "No accounts yet",
  accountsAvailability: "{ready}/{total} ready",
  accountsOrderHint: "Drag a row\u2019s handle to reorder. The first row is the preferred account; the adapter tries the rest in that order.",
  accountsDetails: "Details for {name}",
  accountsDetailsHide: "Hide details for {name}",
  accountDragHandle: "Reorder {name}",
  accountMoveUp: "Move up",
  accountMoveDown: "Move down",
  accountConfigureHint: "Add a key to read usage",
  usageResetMinutes: "resets in {minutes} min",
  usageResetHours: "resets in {hours} h",
  usageResetDays: "resets in {days} d",
  usageResetDue: "resets now",
  usageResetUnknown: "reset time unknown",
  usageTitle: "OpenCode Go usage",
  usageRollingShort: "5h",
  usageHint: "Account usage \xB7 used percentage \xB7 refreshes every minute",
  usageWeekShort: "week",
  usage_rolling: "5 hours",
  usage_weekly: "Weekly",
  usage_monthly: "Monthly",
  usageResets: "Resets",
  usageLimited: "Limit reached",
  usageLoading: "Loading usage\u2026",
  usageUnavailable: "Unavailable",
  usageStaleShort: "Last data",
  usageStaleHint: "Showing the last successful usage reading. Current usage may have changed.",
  usageRefreshFailed: "Refresh failed",
  usageLastUpdated: "Last updated",
  usageRetry: "Retry now",
  usageRefreshing: "Refreshing\u2026",
  nav: "OpenCode Go",
  title: "OpenCode Go",
  titleLabel: "OpenCode Go",
  intro: "Choose the OpenCode Go models shown in conversations and adjust their capacities.",
  starProject: "Enjoying the plugin? Star it on GitHub",
  starProjectTitle: "Open the GitHub project in a new tab",
  enabledLabel: "Enable OpenCode Go",
  enabledHint: "While this is on, OpenCode Go appears in every model picker and can serve requests. Turning it off withdraws the provider and its models immediately; this page stays reachable so you can turn it back on.",
  enabledOff: "OpenCode Go is off. Its models are withdrawn from every picker and no request reaches the gateway. Turn the switch back on to use it again.",
  enabledUnavailable: "This deployment pins the switch on in its composition, so it cannot be changed here.",
  keyLabel: "API key",
  keyHint: "From your OpenCode Go subscription (opencode.ai). Leaving this blank keeps the key already saved, and a saved key applies to the next request without a restart.",
  keyConfigured: "Key saved",
  keyMissing: "No key yet",
  keyNotWritable: "This key is supplied from outside the settings document (an environment variable, for example), so it cannot be changed here.",
  modelsLabel: "Available models",
  modelsRefresh: "Refresh",
  modelsLoading: "Reading the gateway model list\u2026",
  modelsFailed: "Could not read the gateway model list.",
  modelsStale: "Some model data could not be refreshed. Available cached or built-in data is still in use, including in conversation pickers.",
  modelsMetadataFailed: "Could not load model configuration from models.dev. Models with usable cached or built-in configuration remain available. See the error details below, check network access from the machine running DSH, then refresh.",
  modelsListingSource: "Model availability",
  modelsMetadataSource: "Model configuration",
  modelsSourceFailed: "Refresh failed",
  modelsSourceCurrent: "Up to date",
  modelsSourceNeverFetched: "No successful fetch yet",
  modelsSourceUpdated: "Last successful check: {time}",
  modelsRefreshing: "Refreshing\u2026 Keeping the last fetched models visible.",
  modelsEmpty: "The gateway currently serves no model this adapter can route.",
  limitsLabel: "Model capacities",
  limitsHint: "Capacities come from the online configuration; blank keeps the default and Save applies your overrides.",
  limitsFilterLabel: "Find a model",
  limitsFilterPlaceholder: "Search by model name or id\u2026",
  limitsSummary: "{count} customized",
  limitsModel: "Model",
  limitsContext: "Context window",
  limitsOutput: "Max output",
  capacityDefault: "Default: {value} tokens",
  capacityMissing: "API did not provide a value",
  modalityLabel: "Input modalities",
  modalityText: "Text",
  modalityImage: "Image",
  modalityAudio: "Audio",
  modalityVideo: "Video",
  modalityPdf: "PDF",
  modalityUnknown: "Not declared",
  modalitiesSource: "Input modalities come from the online models.dev configuration.",
  modalitiesForwarding: "This plugin converts and forwards image attachments only.",
  visibilityHint: "Only enabled models appear in conversation pickers. Changes apply immediately. Deprecated models are off by default and can be enabled individually.",
  modelVisibleLabel: "Show {name} in conversations",
  configurationMissing: "Configuration missing",
  configurationMissingHint: "The gateway lists this model, but no usable OpenCode Go configuration is available. Once the upstream configuration is supplied or corrected, refresh the list to enable it.",
  configurationUnavailable: "Configuration unavailable",
  configurationUnavailableHint: "The model configuration could not be loaded, and no usable cached or built-in configuration is available for this model. Check network access to models.dev from the machine running DSH and the error details above, then refresh.",
  pickerFailed: "Could not update model visibility. Please retry.",
  deprecatedBadge: "Deprecated",
  deprecatedHint: "Marked deprecated by models.dev, but still provided by this gateway.",
  newHint: "Released within the last seven UTC calendar days, according to models.dev.",
  newBadge: "NEW",
  releaseSource: "Release date: {date} \xB7 models.dev",
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
  advancedSummary: "Usage display \xB7 Credential name \xB7 Gateway URL \xB7 Refresh \xB7 Idle timeout \xB7 Image limits",
  advancedLabel: "Advanced settings",
  advancedHint: "Usage display, credential name, gateway URL, and adapter tuning. The inherited values work as they are; change them only if you know you need to.",
  usageDisplayLabel: "Usage display",
  usageDisplayHint: "Auto shows usage only when a DSH OpenCode Go model is selected. Always keeps it visible with any model, including the built-in OpenCode Go provider. Off hides it and stops polling. While visible, usage refreshes every minute and the panel opens on click. Disabling OpenCode Go hides it in every mode. Save to apply.",
  usageDisplay_auto: "Auto (default)",
  usageDisplay_always: "Always",
  usageDisplay_off: "Off",
  apiKeyEnvLabel: "Credential reference",
  apiKeyEnvHint: "The name the key is resolved from, addressed through the credentials service.",
  baseURLLabel: "Gateway URL",
  baseURLHint: "The endpoint that serves requests and the live model list.",
  refreshMinutesLabel: "Catalog refresh (minutes)",
  refreshMinutesHint: "Catalog cache lifetime for conversations and model pickers. Opening this settings page or clicking Refresh checks the gateway and online model metadata immediately.",
  streamIdleTimeoutMsLabel: "Stream idle timeout (ms)",
  streamIdleTimeoutMsHint: "Largest quiet gap between stream events before the request fails.",
  maxImagesLabel: "Request image count cap (maxImages)",
  maxImagesHint: "Optional positive integer; no count cap by default. Excess oldest images become text placeholders so the conversation can continue. Original attachments are kept. On DSH 0.1.6+, raising or clearing the cap does not restore images already offloaded. Clearing inherits the base configuration.",
  maxRequestImageBytesLabel: "Request image payload cap (bytes)",
  maxRequestImageBytesHint: "Accumulated base64 image payload bound for one request.",
  requestImagePixelBudgetLabel: "Image pixel budget",
  requestImagePixelBudgetHint: "Total-pixel budget for one converted request image.",
  requestImageMaxBytesLabel: "Image byte target (bytes)",
  requestImageMaxBytesHint: "Raw encoded-byte target for one request image before base64 expansion.",
  overridden: "Customized",
  reset: "Reset to default",
  invalidValue: "Not a valid value",
  save: "Save",
  discard: "Discard",
  saving: "Saving\u2026",
  savedFailed: "The last save did not land as staged; correct the values or discard.",
  readOnly: "The settings document is read-only in this deployment.",
  unavailable: "The OpenCode Go settings are not served in this deployment."
};
var zh = {
  accountsTitle: "\u8D26\u53F7",
  accountsRefresh: "\u5237\u65B0\u989D\u5EA6",
  accountsHint: "\u8D26\u53F7\u64CD\u4F5C\u7ACB\u5373\u751F\u6548\uFF0C\u5F71\u54CD\u672C profile \u7684\u540E\u7EED\u65B0\u8BF7\u6C42\uFF1B\u6B63\u5728\u751F\u6210\u7684\u8BF7\u6C42\u7EE7\u7EED\u4F7F\u7528\u539F Key\u3002\u9875\u9762\u53EF\u89C1\u65F6\u6BCF\u5206\u949F\u5237\u65B0\u989D\u5EA6\u3002",
  accountsBlocked: "\u8BF7\u5148\u4FDD\u5B58\u6216\u653E\u5F03 API Key \u8349\u7A3F\uFF0C\u518D\u5207\u6362\u6216\u4FEE\u6539\u8D26\u53F7\u3002",
  accountsEmpty: "\u6DFB\u52A0\u8D26\u53F7\u540E\u5373\u53EF\u4F7F\u7528 OpenCode Go\u3002",
  accountsWriteFailed: "\u8D26\u53F7\u4FEE\u6539\u672A\u751F\u6548\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  accountsReadFailed: "\u672A\u80FD\u8BFB\u53D6\u8D26\u53F7\u72B6\u6001\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002",
  accountsCleanupFailed: "\u8D26\u53F7\u6761\u76EE\u5DF2\u79FB\u9664\uFF0C\u4F46\u4FDD\u5B58\u7684 Key \u672A\u80FD\u5220\u9664\u3002\u8BF7\u901A\u8FC7\u5BBF\u4E3B\u51ED\u636E\u670D\u52A1\u5220\u9664\u672A\u4F7F\u7528\u7684\u5F15\u7528\u3002",
  accountDefault: "\u9ED8\u8BA4\u8D26\u53F7",
  accountAdd: "\u6DFB\u52A0\u8D26\u53F7",
  accountRename: "\u91CD\u547D\u540D",
  accountReplaceKey: "\u66FF\u6362 Key",
  accountRemove: "\u5220\u9664\u8D26\u53F7",
  accountRemoveHint: "\u5220\u9664\u201C{name}\u201D\uFF1F\u82E5\u5B83\u662F\u5F53\u524D\u9996\u9009\uFF0C\u5C06\u4F7F\u7528\u4E0B\u4E00\u4E2A\u8D26\u53F7\u3002\u5728\u8FD9\u91CC\u6DFB\u52A0\u7684 Key \u4F1A\u4ECE\u51ED\u636E\u670D\u52A1\u5220\u9664\uFF1B\u5DF2\u6709\u5916\u90E8\u5F15\u7528\u4F1A\u4FDD\u7559\u3002",
  accountName: "\u8D26\u53F7\u540D\u79F0",
  accountKeyHint: "Key \u901A\u8FC7\u5BBF\u4E3B\u51ED\u636E\u670D\u52A1\u4FDD\u5B58\uFF0C\u9875\u9762\u4E0D\u4F1A\u56DE\u663E\u5DF2\u4FDD\u5B58\u7684\u5BC6\u94A5\u3002",
  accountConfirm: "\u786E\u8BA4",
  accountCancel: "\u53D6\u6D88",
  accountAutoSwitch: "\u81EA\u52A8\u4F7F\u7528\u5907\u7528\u8D26\u53F7",
  accountAutoSwitchHint: "\u9ED8\u8BA4\u5173\u95ED\u3002\u989D\u5EA6\u8017\u5C3D\u6216 Key \u4E0D\u53EF\u7528\u65F6\uFF0C\u5728\u5C1A\u672A\u8F93\u51FA\u5185\u5BB9\u6216\u5DE5\u5177\u8C03\u7528\u524D\u6309\u987A\u5E8F\u5C1D\u8BD5\u5176\u4ED6\u8D26\u53F7\uFF0C\u6BCF\u4E2A\u8D26\u53F7\u6700\u591A\u4E00\u6B21\u3002\u624B\u52A8\u9009\u5B9A\u7684\u9996\u9009\u8D26\u53F7\u4FDD\u6301\u4E0D\u53D8\uFF1B\u666E\u901A\u9650\u6D41\u548C\u7F51\u7EDC\u9519\u8BEF\u4EA4\u7531\u5BBF\u4E3B\u6062\u590D\u3002",
  accountSwitchLabel: "\u8D26\u53F7",
  accountSwitchFailed: "\u8D26\u53F7\u5207\u6362\u672A\u751F\u6548\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  accountFallbackQuota: "\u9996\u9009\u8D26\u53F7\u989D\u5EA6\u8017\u5C3D\uFF0C\u5DF2\u81EA\u52A8\u4F7F\u7528\u5907\u7528\u8D26\u53F7\uFF1A",
  accountFallbackCredential: "\u9996\u9009 Key \u4E0D\u53EF\u7528\u6216\u88AB\u62D2\u7EDD\uFF0C\u5DF2\u81EA\u52A8\u4F7F\u7528\u5907\u7528\u8D26\u53F7\uFF1A",
  accountsSummary: "{count} \u4E2A \xB7 \u9996\u9009 {name}",
  accountsSummaryEmpty: "\u5C1A\u672A\u6DFB\u52A0\u8D26\u53F7",
  accountsAvailability: "{ready}/{total} \u53EF\u7528",
  accountsOrderHint: "\u6309\u4F4F\u884C\u9996\u624B\u67C4\u62D6\u52A8\u53EF\u8C03\u6574\u987A\u5E8F\uFF1A\u7B2C\u4E00\u884C\u662F\u9996\u9009\u8D26\u53F7\uFF0C\u5176\u4F59\u6309\u6B64\u987A\u5E8F\u4F9D\u6B21\u5C1D\u8BD5\u3002",
  accountsDetails: "{name} \u7684\u8BE6\u60C5",
  accountsDetailsHide: "\u6536\u8D77 {name} \u7684\u8BE6\u60C5",
  accountDragHandle: "\u62D6\u52A8 {name} \u8C03\u6574\u987A\u5E8F",
  accountMoveUp: "\u4E0A\u79FB",
  accountMoveDown: "\u4E0B\u79FB",
  accountConfigureHint: "\u914D\u7F6E Key \u540E\u663E\u793A\u989D\u5EA6",
  usageResetMinutes: "{minutes} \u5206\u949F\u540E\u91CD\u7F6E",
  usageResetHours: "{hours} \u5C0F\u65F6\u540E\u91CD\u7F6E",
  usageResetDays: "{days} \u5929\u540E\u91CD\u7F6E",
  usageResetDue: "\u5373\u5C06\u91CD\u7F6E",
  usageResetUnknown: "\u91CD\u7F6E\u65F6\u95F4\u672A\u77E5",
  usageTitle: "OpenCode Go \u7528\u91CF",
  usageRollingShort: "5\u5C0F\u65F6",
  usageHint: "\u8D26\u53F7\u989D\u5EA6 \xB7 \u5DF2\u7528\u767E\u5206\u6BD4 \xB7 \u6BCF\u5206\u949F\u5237\u65B0",
  usageWeekShort: "\u5468",
  usage_rolling: "5 \u5C0F\u65F6",
  usage_weekly: "\u6BCF\u5468",
  usage_monthly: "\u6BCF\u6708",
  usageResets: "\u91CD\u7F6E\u4E8E",
  usageLimited: "\u5DF2\u8FBE\u9650\u989D",
  usageLoading: "\u6B63\u5728\u8BFB\u53D6\u7528\u91CF\u2026",
  usageUnavailable: "\u6682\u4E0D\u53EF\u7528",
  usageStaleShort: "\u4E0A\u6B21\u6570\u636E",
  usageStaleHint: "\u5F53\u524D\u663E\u793A\u4E0A\u6B21\u6210\u529F\u8BFB\u53D6\u7684\u7528\u91CF\uFF0C\u5B9E\u9645\u7528\u91CF\u53EF\u80FD\u5DF2\u53D8\u5316\u3002",
  usageRefreshFailed: "\u5237\u65B0\u5931\u8D25",
  usageLastUpdated: "\u66F4\u65B0\u4E8E",
  usageRetry: "\u7ACB\u5373\u91CD\u8BD5",
  usageRefreshing: "\u6B63\u5728\u5237\u65B0\u2026",
  nav: "OpenCode Go",
  title: "OpenCode Go",
  titleLabel: "OpenCode Go",
  intro: "\u9009\u62E9\u4F1A\u8BDD\u4E2D\u663E\u793A\u7684 OpenCode Go \u6A21\u578B\uFF0C\u5E76\u8C03\u6574\u5176\u5BB9\u91CF\u3002",
  starProject: "\u559C\u6B22\u8FD9\u4E2A\u63D2\u4EF6\uFF1F\u53BB GitHub \u70B9\u4E2A Star",
  starProjectTitle: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00 GitHub \u9879\u76EE",
  enabledLabel: "\u542F\u7528 OpenCode Go",
  enabledHint: "\u5F00\u542F\u65F6\uFF0COpenCode Go \u4F1A\u51FA\u73B0\u5728\u6240\u6709\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u5E76\u53EF\u5904\u7406\u8BF7\u6C42\u3002\u5173\u95ED\u540E\u5C06\u7ACB\u5373\u64A4\u4E0B\u8BE5\u63D0\u4F9B\u65B9\u53CA\u5176\u6A21\u578B\uFF1B\u672C\u9875\u4ECD\u53EF\u8BBF\u95EE\uFF0C\u65B9\u4FBF\u4F60\u968F\u65F6\u91CD\u65B0\u5F00\u542F\u3002",
  enabledOff: "OpenCode Go \u5DF2\u5173\u95ED\u3002\u5176\u6A21\u578B\u5DF2\u4ECE\u6240\u6709\u9009\u62E9\u5668\u4E2D\u64A4\u4E0B\uFF0C\u4E5F\u4E0D\u4F1A\u6709\u8BF7\u6C42\u53D1\u5F80\u7F51\u5173\u3002\u9700\u8981\u65F6\u628A\u5F00\u5173\u91CD\u65B0\u6253\u5F00\u5373\u53EF\u3002",
  enabledUnavailable: "\u6B64\u90E8\u7F72\u5728\u7EC4\u5408\u5C42\u56FA\u5B9A\u5F00\u542F\u4E86\u8BE5\u5F00\u5173\uFF0C\u65E0\u6CD5\u5728\u6B64\u4FEE\u6539\u3002",
  keyLabel: "API key",
  keyHint: "\u6765\u81EA\u4F60\u7684 OpenCode Go \u8BA2\u9605\uFF08opencode.ai\uFF09\u3002\u7559\u7A7A\u8868\u793A\u4FDD\u6301\u5DF2\u4FDD\u5B58\u7684 key\uFF1B\u4FDD\u5B58\u540E\u4E0B\u4E00\u6B21\u8BF7\u6C42\u5373\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002",
  keyConfigured: "\u5DF2\u914D\u7F6E key",
  keyMissing: "\u5C1A\u672A\u914D\u7F6E",
  keyNotWritable: "\u8BE5 key \u7531\u8BBE\u7F6E\u6587\u6863\u4E4B\u5916\u7684\u6765\u6E90\u63D0\u4F9B\uFF08\u4F8B\u5982\u73AF\u5883\u53D8\u91CF\uFF09\uFF0C\u65E0\u6CD5\u5728\u6B64\u4FEE\u6539\u3002",
  modelsLabel: "\u53EF\u7528\u6A21\u578B",
  modelsRefresh: "\u5237\u65B0",
  modelsLoading: "\u6B63\u5728\u8BFB\u53D6\u7F51\u5173\u6A21\u578B\u5217\u8868\u2026",
  modelsFailed: "\u672A\u80FD\u8BFB\u53D6\u7F51\u5173\u6A21\u578B\u5217\u8868\u3002",
  modelsStale: "\u90E8\u5206\u6A21\u578B\u6570\u636E\u5237\u65B0\u5931\u8D25\uFF0C\u6B63\u5728\u7EE7\u7EED\u4F7F\u7528\u53EF\u7528\u7684\u7F13\u5B58\u6216\u5185\u7F6E\u914D\u7F6E\uFF1B\u4F1A\u8BDD\u9009\u62E9\u5668\u4E5F\u4F7F\u7528\u8FD9\u4EFD\u6570\u636E\u3002",
  modelsMetadataFailed: "\u672A\u80FD\u4ECE models.dev \u83B7\u53D6\u6709\u6548\u7684\u6A21\u578B\u914D\u7F6E\u3002\u5DF2\u6709\u53EF\u7528\u7F13\u5B58\u6216\u5185\u7F6E\u914D\u7F6E\u7684\u6A21\u578B\u4ECD\u53EF\u4F7F\u7528\u3002\u8BF7\u67E5\u770B\u4E0B\u65B9\u9519\u8BEF\u8BE6\u60C5\uFF0C\u68C0\u67E5\u8FD0\u884C DSH \u7684\u8BBE\u5907\u7684\u7F51\u7EDC\u8FDE\u63A5\uFF0C\u7136\u540E\u5237\u65B0\u91CD\u8BD5\u3002",
  modelsListingSource: "\u6A21\u578B\u540D\u5355",
  modelsMetadataSource: "\u6A21\u578B\u914D\u7F6E",
  modelsSourceFailed: "\u5237\u65B0\u5931\u8D25",
  modelsSourceCurrent: "\u5DF2\u66F4\u65B0",
  modelsSourceNeverFetched: "\u5C1A\u672A\u6210\u529F\u83B7\u53D6",
  modelsSourceUpdated: "\u4E0A\u6B21\u6210\u529F\u68C0\u67E5\uFF1A{time}",
  modelsRefreshing: "\u6B63\u5728\u5237\u65B0\uFF0C\u6682\u65F6\u4FDD\u7559\u4E0A\u6B21\u83B7\u53D6\u7684\u6A21\u578B\u3002",
  modelsEmpty: "\u7F51\u5173\u5F53\u524D\u6CA1\u6709\u672C\u9002\u914D\u5668\u53EF\u8DEF\u7531\u7684\u6A21\u578B\u3002",
  limitsLabel: "\u6A21\u578B\u5BB9\u91CF",
  limitsHint: "\u5BB9\u91CF\u6765\u81EA\u5728\u7EBF\u6A21\u578B\u914D\u7F6E\uFF1B\u7559\u7A7A\u7528\u9ED8\u8BA4\u503C\uFF0C\u4FDD\u5B58\u540E\u751F\u6548\u3002",
  limitsFilterLabel: "\u67E5\u627E\u6A21\u578B",
  limitsFilterPlaceholder: "\u6309\u6A21\u578B\u540D\u79F0\u6216 ID \u641C\u7D22\u2026",
  limitsSummary: "{count} \u4E2A\u5DF2\u81EA\u5B9A\u4E49",
  limitsModel: "\u6A21\u578B",
  limitsContext: "\u4E0A\u4E0B\u6587\u7A97\u53E3",
  limitsOutput: "\u6700\u5927\u8F93\u51FA",
  capacityDefault: "\u9ED8\u8BA4\uFF1A{value} tokens",
  capacityMissing: "API \u672A\u63D0\u4F9B",
  modalityLabel: "\u8F93\u5165\u6A21\u6001",
  modalityText: "\u6587\u672C",
  modalityImage: "\u56FE\u50CF",
  modalityAudio: "\u97F3\u9891",
  modalityVideo: "\u89C6\u9891",
  modalityPdf: "PDF",
  modalityUnknown: "\u672A\u58F0\u660E",
  modalitiesSource: "\u8F93\u5165\u6A21\u6001\u6765\u81EA models.dev \u7684\u5728\u7EBF\u914D\u7F6E\u3002",
  modalitiesForwarding: "\u672C\u63D2\u4EF6\u76EE\u524D\u4EC5\u8F6C\u6362\u5E76\u8F6C\u53D1\u56FE\u50CF\u9644\u4EF6\u3002",
  visibilityHint: "\u5F00\u542F\u7684\u6A21\u578B\u624D\u4F1A\u663E\u793A\u5728\u4F1A\u8BDD\u9009\u62E9\u5668\u4E2D\uFF0C\u4FEE\u6539\u7ACB\u5373\u751F\u6548\u3002\u8FC7\u65F6\u6A21\u578B\u9ED8\u8BA4\u5173\u95ED\uFF0C\u53EF\u5355\u72EC\u5F00\u542F\u3002",
  modelVisibleLabel: "\u5728\u4F1A\u8BDD\u4E2D\u663E\u793A {name}",
  configurationMissing: "\u914D\u7F6E\u7F3A\u5931",
  configurationMissingHint: "\u7F51\u5173\u5DF2\u5217\u51FA\u6B64\u6A21\u578B\uFF0C\u4F46\u6682\u672A\u83B7\u5F97\u53EF\u7528\u7684 OpenCode Go \u914D\u7F6E\u3002\u4E0A\u6E38\u8865\u9F50\u6216\u4FEE\u6B63\u914D\u7F6E\u540E\uFF0C\u5237\u65B0\u5217\u8868\u5373\u53EF\u5F00\u542F\u3002",
  configurationUnavailable: "\u914D\u7F6E\u6682\u4E0D\u53EF\u7528",
  configurationUnavailableHint: "\u6682\u672A\u80FD\u83B7\u53D6\u6709\u6548\u7684\u6A21\u578B\u914D\u7F6E\uFF0C\u4E14\u6CA1\u6709\u6B64\u6A21\u578B\u7684\u53EF\u7528\u7F13\u5B58\u6216\u5185\u7F6E\u914D\u7F6E\u3002\u8BF7\u67E5\u770B\u4E0A\u65B9\u9519\u8BEF\u8BE6\u60C5\uFF0C\u68C0\u67E5\u8FD0\u884C DSH \u7684\u8BBE\u5907\u80FD\u5426\u8BBF\u95EE models.dev\uFF0C\u7136\u540E\u5237\u65B0\u91CD\u8BD5\u3002",
  pickerFailed: "\u6A21\u578B\u663E\u793A\u8BBE\u7F6E\u672A\u66F4\u65B0\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  deprecatedBadge: "\u5DF2\u5F03\u7528",
  deprecatedHint: "models.dev \u6807\u8BB0\u4E3A\u5DF2\u5F03\u7528\uFF0C\u5F53\u524D\u7F51\u5173\u4ECD\u63D0\u4F9B\u6B64\u6A21\u578B\u3002",
  newHint: "\u4F9D\u636E models.dev \u53D1\u5E03\u65E5\u671F\uFF0C\u8FD1\u4E03\u4E2A UTC \u65E5\u5386\u65E5\u5185\u53D1\u5E03\u3002",
  newBadge: "\u65B0",
  releaseSource: "\u53D1\u5E03\u65E5\u671F\uFF1A{date} \xB7 models.dev",
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
  advancedSummary: "\u989D\u5EA6\u663E\u793A \xB7 \u51ED\u8BC1\u5F15\u7528\u540D \xB7 \u7F51\u5173\u5730\u5740 \xB7 \u76EE\u5F55\u5237\u65B0 \xB7 \u6D41\u7A7A\u95F2\u8D85\u65F6 \xB7 \u56FE\u7247 4 \u9879",
  advancedLabel: "\u9AD8\u7EA7\u8BBE\u7F6E",
  advancedHint: "\u989D\u5EA6\u663E\u793A\u3001\u51ED\u8BC1\u540D\u79F0\u3001\u7F51\u5173\u5730\u5740\u4E0E\u9002\u914D\u5668\u8C03\u4F18\u53C2\u6570\u3002\u7EE7\u627F\u6765\u7684\u53D6\u503C\u5373\u53EF\u6B63\u5E38\u4F7F\u7528\uFF0C\u6309\u9700\u4FEE\u6539\u3002",
  usageDisplayLabel: "\u989D\u5EA6\u663E\u793A",
  usageDisplayHint: "\u81EA\u52A8\uFF1A\u4EC5\u9009\u4E2D DSH OpenCode Go \u6A21\u578B\u65F6\u663E\u793A\u3002\u5E38\u9A7B\uFF1A\u4F7F\u7528\u4EFB\u610F\u6A21\u578B\u65F6\u5747\u663E\u793A\uFF0C\u5305\u62EC\u5BBF\u4E3B\u81EA\u5E26\u7684 OpenCode Go\u3002\u5173\u95ED\uFF1A\u9690\u85CF\u5E76\u505C\u6B62\u8F6E\u8BE2\u3002\u663E\u793A\u65F6\u6BCF\u5206\u949F\u5237\u65B0\uFF0C\u70B9\u51FB\u80F6\u56CA\u624D\u5C55\u5F00\u9762\u677F\uFF1B\u505C\u7528 OpenCode Go \u540E\u6240\u6709\u6A21\u5F0F\u5747\u9690\u85CF\u3002\u4FDD\u5B58\u540E\u751F\u6548\u3002",
  usageDisplay_auto: "\u81EA\u52A8\uFF08\u9ED8\u8BA4\uFF09",
  usageDisplay_always: "\u5E38\u9A7B",
  usageDisplay_off: "\u5173\u95ED",
  apiKeyEnvLabel: "\u51ED\u8BC1\u5F15\u7528\u540D",
  apiKeyEnvHint: "key \u89E3\u6790\u6240\u4F9D\u636E\u7684\u5F15\u7528\u540D\uFF0C\u7ECF\u51ED\u8BC1\u670D\u52A1\u5BFB\u5740\u3002",
  baseURLLabel: "\u7F51\u5173\u5730\u5740",
  baseURLHint: "\u540C\u65F6\u63D0\u4F9B\u6A21\u578B\u8BF7\u6C42\u4E0E\u5B9E\u65F6\u6A21\u578B\u5217\u8868\u7684\u7AEF\u70B9\u3002",
  refreshMinutesLabel: "\u76EE\u5F55\u5237\u65B0\uFF08\u5206\u949F\uFF09",
  refreshMinutesHint: "\u4F1A\u8BDD\u8BF7\u6C42\u548C\u6A21\u578B\u9009\u62E9\u5668\u7684\u76EE\u5F55\u7F13\u5B58\u65F6\u957F\u3002\u6253\u5F00\u672C\u8BBE\u7F6E\u9875\u6216\u70B9\u51FB\u5237\u65B0\u65F6\uFF0C\u4F1A\u7ACB\u5373\u6838\u5BF9\u7F51\u5173\u4E0E\u5728\u7EBF\u6A21\u578B\u914D\u7F6E\u3002",
  streamIdleTimeoutMsLabel: "\u6D41\u7A7A\u95F2\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  streamIdleTimeoutMsHint: "\u6D41\u4E8B\u4EF6\u95F4\u5141\u8BB8\u7684\u6700\u5927\u9759\u9ED8\u95F4\u9694\uFF0C\u8D85\u51FA\u540E\u8BF7\u6C42\u5931\u8D25\u3002",
  maxImagesLabel: "\u8BF7\u6C42\u56FE\u7247\u6570\u91CF\u4E0A\u9650\uFF08maxImages\uFF09",
  maxImagesHint: "\u53EF\u9009\u6B63\u6574\u6570\uFF0C\u9ED8\u8BA4\u4E0D\u9650\u5236\u5F20\u6570\u3002\u8D85\u9650\u65F6\u5C06\u6700\u65E7\u56FE\u7247\u66FF\u6362\u4E3A\u6587\u5B57\u5360\u4F4D\u5E76\u7EE7\u7EED\u4F1A\u8BDD\uFF0C\u539F\u59CB\u9644\u4EF6\u4FDD\u7559\u3002DSH 0.1.6 \u53CA\u4EE5\u4E0A\u7248\u672C\u5DF2\u5378\u8F7D\u7684\u56FE\u7247\u4E0D\u4F1A\u56E0\u8C03\u9AD8\u6216\u6E05\u7A7A\u4E0A\u9650\u81EA\u52A8\u6062\u590D\u3002\u6E05\u7A7A\u540E\u7EE7\u627F\u57FA\u7840\u914D\u7F6E\u3002",
  maxRequestImageBytesLabel: "\u8BF7\u6C42\u56FE\u7247\u8F7D\u8377\u4E0A\u9650\uFF08\u5B57\u8282\uFF09",
  maxRequestImageBytesHint: "\u5355\u4E2A\u8BF7\u6C42\u7D2F\u8BA1 base64 \u56FE\u7247\u8F7D\u8377\u7684\u4E0A\u9650\u3002",
  requestImagePixelBudgetLabel: "\u56FE\u7247\u50CF\u7D20\u9884\u7B97",
  requestImagePixelBudgetHint: "\u5355\u5F20\u8F6C\u6362\u540E\u8BF7\u6C42\u56FE\u7247\u7684\u603B\u50CF\u7D20\u9884\u7B97\u3002",
  requestImageMaxBytesLabel: "\u56FE\u7247\u5B57\u8282\u76EE\u6807\uFF08\u5B57\u8282\uFF09",
  requestImageMaxBytesHint: "\u5355\u5F20\u8BF7\u6C42\u56FE\u7247 base64 \u6269\u5C55\u524D\u7684\u539F\u59CB\u7F16\u7801\u5B57\u8282\u76EE\u6807\u3002",
  overridden: "\u5DF2\u81EA\u5B9A\u4E49",
  reset: "\u6062\u590D\u9ED8\u8BA4",
  invalidValue: "\u4E0D\u662F\u6709\u6548\u503C",
  save: "\u4FDD\u5B58",
  discard: "\u653E\u5F03",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  savedFailed: "\u4E0A\u6B21\u4FDD\u5B58\u672A\u6309\u8349\u7A3F\u751F\u6548\uFF1B\u8BF7\u4FEE\u6B63\u6570\u503C\u6216\u653E\u5F03\u4FEE\u6539\u3002",
  readOnly: "\u6B64\u90E8\u7F72\u4E2D\u8BBE\u7F6E\u6587\u6863\u4E3A\u53EA\u8BFB\u3002",
  unavailable: "\u6B64\u90E8\u7F72\u672A\u63D0\u4F9B OpenCode Go \u8BBE\u7F6E\u3002"
};

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

// src/remote-contract.ts
var goRemote = {
  package: "dsh-opencode-go",
  descriptors: [...usageRemote.descriptors, ...modelsRemote.descriptors]
};

// src/client/UsagePill.tsx
var import_react4 = require("react");

// plugin-css:src/client/UsagePill.module.css
var id2 = "dsh-opencode-go/UsagePill.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id2) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id2;
  style.textContent = '.mAjYhq_root{min-width:0;display:inline-flex;position:relative}.mAjYhq_accountSelector{align-items:center;gap:8px;margin:10px 0;display:flex}.mAjYhq_accountSelector select{min-width:0;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2,Canvas);border:1px solid color-mix(in srgb, currentColor 25%, transparent);border-radius:6px;flex:1;padding:5px}.mAjYhq_trigger{color:inherit;opacity:.75;font:inherit;cursor:pointer;white-space:nowrap;background:0 0;border:0;border-radius:6px;padding:4px 6px;font-size:12px}.mAjYhq_trigger:hover,.mAjYhq_trigger:focus-visible{opacity:1;background:color-mix(in srgb, currentColor 8%, transparent)}.mAjYhq_account{text-overflow:ellipsis;vertical-align:bottom;max-width:12ch;display:inline-block;overflow:hidden}@container (width<=460px){.mAjYhq_brand,.mAjYhq_stale,.mAjYhq_account{display:none}.mAjYhq_reading[data-stale]:after{content:"*"}}@container (width<=360px){.mAjYhq_unit{display:none}}.mAjYhq_panel{z-index:100;box-sizing:border-box;border:1px solid color-mix(in srgb, currentColor 18%, transparent);width:280px;max-width:calc(100vw - 32px);max-height:70vh;color:var(--dsw-alias-label-primary,CanvasText);isolation:isolate;background-color:canvas;background-image:linear-gradient(var(--dsw-specific-menu,transparent), var(--dsw-specific-menu,transparent)), linear-gradient(var(--dsw-alias-bg-layer-2,Canvas), var(--dsw-alias-bg-layer-2,Canvas));border-radius:12px;padding:16px;font-size:12px;position:absolute;bottom:calc(100% + 12px);right:0;overflow-y:auto;box-shadow:0 8px 30px #0003}.mAjYhq_hint{opacity:.65;font-size:11px;line-height:1.6}.mAjYhq_warning{background:color-mix(in srgb, currentColor 6%, transparent);overflow-wrap:anywhere;border-radius:6px;margin:10px 0;padding:10px;line-height:1.5}.mAjYhq_warning p{margin:5px 0 0}.mAjYhq_retry{border:1px solid color-mix(in srgb, currentColor 25%, transparent);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:5px 9px}.mAjYhq_retry:disabled{opacity:.6;cursor:default}.mAjYhq_retry:focus-visible{outline-offset:2px;outline:2px solid}.mAjYhq_window{margin-top:14px}.mAjYhq_row{justify-content:space-between;margin-bottom:5px;display:flex}.mAjYhq_window progress{appearance:none;background:color-mix(in srgb, currentColor 15%, transparent);border:0;border-radius:4px;width:100%;height:5px;margin-bottom:5px;display:block}.mAjYhq_window progress::-webkit-progress-bar{background:0 0;border-radius:4px}.mAjYhq_window progress::-webkit-progress-value{background:#39a878;border-radius:4px}.mAjYhq_window progress::-moz-progress-bar{background:#39a878;border-radius:4px}.mAjYhq_window progress.mAjYhq_high::-webkit-progress-value{background:#e0a100}.mAjYhq_window progress.mAjYhq_high::-moz-progress-bar{background:#e0a100}.mAjYhq_window progress.mAjYhq_limited::-webkit-progress-value{background:#e5484d}.mAjYhq_window progress.mAjYhq_limited::-moz-progress-bar{background:#e5484d}.mAjYhq_limitedText{color:#e5484d;margin-top:2px;font-weight:600}';
  document.head.appendChild(style);
}
var UsagePill_default = { "account": "mAjYhq_account", "accountSelector": "mAjYhq_accountSelector", "brand": "mAjYhq_brand", "high": "mAjYhq_high", "hint": "mAjYhq_hint", "limited": "mAjYhq_limited", "limitedText": "mAjYhq_limitedText", "panel": "mAjYhq_panel", "reading": "mAjYhq_reading", "retry": "mAjYhq_retry", "root": "mAjYhq_root", "row": "mAjYhq_row", "stale": "mAjYhq_stale", "trigger": "mAjYhq_trigger", "unit": "mAjYhq_unit", "warning": "mAjYhq_warning", "window": "mAjYhq_window" };

// src/client/UsagePill.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
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
function usageLevel(window) {
  if (window.status === "rate-limited" || window.percent >= 100) return UsagePill_default.limited;
  return window.percent >= 80 ? UsagePill_default.high : void 0;
}
function UsagePill({ directory, settings, credentialChanges, ...props }) {
  const state = (0, import_react4.useSyncExternalStore)(directory.subscribe, directory.getSnapshot, directory.getSnapshot);
  const readSettings = (0, import_react4.useCallback)(() => settings.getSnapshot(), [settings]);
  const subscribeSettings = (0, import_react4.useCallback)((listener) => settings.subscribe(listener), [settings]);
  const config = (0, import_react4.useSyncExternalStore)(subscribeSettings, readSettings, readSettings);
  const readChanges = (0, import_react4.useCallback)(() => credentialChanges?.getSnapshot() ?? unchanged(), [credentialChanges]);
  const subscribeChanges = (0, import_react4.useCallback)((listener) => credentialChanges?.subscribe(listener) ?? noSubscription(), [credentialChanges]);
  const credentialRevision = (0, import_react4.useSyncExternalStore)(subscribeChanges, readChanges, readChanges);
  const mode = config.value?.usageDisplay ?? DEFAULT_USAGE_DISPLAY;
  const visible = config.status === "ready" && config.value?.enabled !== false && (mode === "always" || mode === "auto" && state.current?.provider === PROVIDER_ID);
  const accounts = accountsOf(config.value ?? {});
  const activeRef = accountRefOf(config.value ?? {});
  return visible ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    ActiveUsage,
    {
      ...props,
      accounts,
      activeRef,
      writable: config.writable
    },
    JSON.stringify([activeRef, config.value?.baseURL, credentialRevision, accounts])
  ) : null;
}
function ActiveUsage({ readUsage, t, getLocale, accounts, activeRef, writable, selectAccount }) {
  const [snapshot, setSnapshot] = (0, import_react4.useState)(null);
  const [failed, setFailed] = (0, import_react4.useState)(null);
  const [refreshing, setRefreshing] = (0, import_react4.useState)(false);
  const [open, setOpen] = (0, import_react4.useState)(false);
  const [switching, setSwitching] = (0, import_react4.useState)(false);
  const [switchFailed, setSwitchFailed] = (0, import_react4.useState)(false);
  const root = (0, import_react4.useRef)(null);
  const retry = (0, import_react4.useRef)(() => {
  });
  (0, import_react4.useEffect)(() => {
    let alive = true;
    let busy = false;
    setSnapshot(null);
    setFailed(null);
    setRefreshing(false);
    const refresh = async (manual = false) => {
      if (busy || !manual && document.visibilityState === "hidden") return;
      busy = true;
      setRefreshing(true);
      try {
        const value = await readUsage();
        if (alive) {
          setSnapshot({ reader: readUsage, usage: value, updatedAt: Date.now() });
          setFailed(null);
        }
      } catch (error) {
        if (alive) {
          const failure2 = usageFailure(error);
          setFailed({ reader: readUsage, failure: failure2 });
          setSnapshot((previous) => previous?.reader === readUsage && failure2.retainPrevious && typeof previous.usage.source === "string" && previous.usage.source.length > 0 && previous.usage.source === failure2.source ? previous : null);
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
  }, [readUsage]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    const click = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const key = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const current = snapshot?.reader === readUsage ? snapshot : null;
  const usage = current?.usage;
  const failure = failed?.reader === readUsage ? failed.failure : null;
  const notice = usage?.lastSwitch ?? failure?.lastSwitch;
  const accountName = accounts.find((account) => account.apiKeyEnv === activeRef)?.name || t("accountDefault");
  const label = usage ? `Go \xB7 ${t("usageRollingShort")} ${usage.rolling.percent}% \xB7 ${t("usageWeekShort")} ${usage.weekly.percent}%${failure ? ` \xB7 ${t("usageStaleShort")}` : ""}${accounts.length > 1 ? ` \xB7 ${accountName}` : ""}` : `Go \xB7 ${failure ? t("usageUnavailable") : "\u2026"}${accounts.length > 1 ? ` \xB7 ${accountName}` : ""}`;
  const segments = usage ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: UsagePill_default.brand, children: "Go \xB7 " }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: UsagePill_default.reading, "data-stale": failure ? "" : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: UsagePill_default.unit, children: [
        t("usageRollingShort"),
        " "
      ] }),
      usage.rolling.percent,
      "%",
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: UsagePill_default.unit, children: [
        t("usageWeekShort"),
        " "
      ] }),
      usage.weekly.percent,
      "%"
    ] }),
    failure ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: UsagePill_default.stale, children: [
      " \xB7 ",
      t("usageStaleShort")
    ] }) : null,
    accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: UsagePill_default.account, children: [
      " \xB7 ",
      accountName
    ] }) : null
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: UsagePill_default.brand, children: "Go \xB7 " }),
    failure ? t("usageUnavailable") : "\u2026",
    accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: UsagePill_default.account, children: [
      " \xB7 ",
      accountName
    ] }) : null
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: UsagePill_default.root, ref: root, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: UsagePill_default.trigger,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        "aria-label": `${t("usageTitle")}: ${label}`,
        title: label,
        onClick: () => {
          setOpen(!open);
        },
        children: segments
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: UsagePill_default.panel, role: "dialog", "aria-label": t("usageTitle"), "aria-busy": refreshing, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("usageTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: UsagePill_default.hint, children: t("usageHint") }),
      accounts.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: UsagePill_default.accountSelector, children: [
        t("accountSwitchLabel"),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("select", { value: activeRef, disabled: !writable || switching || !selectAccount, onChange: (event) => {
          const ref = event.target.value;
          setSwitching(true);
          setSwitchFailed(false);
          void selectAccount?.(ref).then((accepted) => {
            setSwitchFailed(!accepted);
          }).catch(() => {
            setSwitchFailed(true);
          }).finally(() => {
            setSwitching(false);
          });
        }, children: accounts.map((account) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: account.apiKeyEnv, children: account.name || t("accountDefault") }, account.id)) })
      ] }) : null,
      switchFailed ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: UsagePill_default.warning, role: "alert", children: t("accountSwitchFailed") }) : null,
      notice ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: UsagePill_default.warning, role: "status", children: [
        t(notice.reason === "quota" ? "accountFallbackQuota" : "accountFallbackCredential"),
        " ",
        accounts.find((account) => account.apiKeyEnv === notice.toRef)?.name || t("accountDefault"),
        " \xB7 ",
        new Date(notice.at).toLocaleString(getLocale?.())
      ] }) : null,
      failure ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: UsagePill_default.warning, role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("usageRefreshFailed") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: failure.message ?? t("usageUnavailable") }),
        usage ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("usageStaleHint") }) : null
      ] }) : null,
      failure ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
      current ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: UsagePill_default.hint, children: [
        t("usageLastUpdated"),
        " ",
        new Date(current.updatedAt).toLocaleString(getLocale?.())
      ] }) : null,
      usage ? ["rolling", "weekly", "monthly"].map((key) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: UsagePill_default.window, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: UsagePill_default.row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t(`usage_${key}`) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("strong", { children: [
            usage[key].percent,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("progress", { className: usageLevel(usage[key]), "aria-label": t(`usage_${key}`), max: 100, value: Math.min(100, usage[key].percent) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: UsagePill_default.hint, children: [
          t("usageResets"),
          " ",
          new Date(usage[key].resetsAt).toLocaleString(getLocale?.())
        ] }),
        usage[key].status === "rate-limited" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: UsagePill_default.limitedText, children: t("usageLimited") })
      ] }, key)) : failure ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("usageLoading") })
    ] })
  ] });
}

// src/client/usage.ts
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
function registerUsagePill(ctx, settings) {
  ctx.inject(["modelDirectories", "sessions", "remote.session"], (scope) => {
    scope.inject(["remote.opencodeGoUsage"], (ready) => {
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
      const translate = ready.locale.bind("settings.opencode-go");
      ready.slots.inject("conversation.input.right", () => ready.slots.register({
        name: "conversation.input.right",
        id: "opencode-go-usage",
        order: 1e3,
        inject: (sessionId) => ({
          directory: ready.modelDirectories.directoryFor(sessionId).store,
          settings,
          credentialChanges,
          selectAccount: async (ref) => {
            const snapshot = settings.getSnapshot();
            if (!snapshot.writable || !accountsOf(snapshot.value ?? {}).some((account) => account.apiKeyEnv === ref)) return false;
            try {
              await settings.mutate([{ op: "set", path: ["apiKeyEnv"], value: ref }], snapshot.revision);
              return accountRefOf(settings.getSnapshot().value ?? {}) === ref;
            } catch {
              return false;
            }
          },
          readUsage,
          getLocale: () => ready.locale.getLocale().active,
          t: (key) => translate(key)
        })
      }, UsagePill));
    });
  });
}

// src/client/index.ts
var NS = "settings.opencode-go";
var inject = ["slots", "locale", "remote", "remote.credentials", "remote.llm"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "llm-opencode-go: copy dictionaries");
  const modelsReady = ctx.remote.$mount(goRemote);
  ctx.effect(async () => await modelsReady);
  ctx.inject(["configForms", "remote.opencodeGoModels"], (child) => {
    const forms = child.get("configForms");
    mountSettings(child, forms.get("opencode-go"), modelsReady);
  });
  ctx.inject(["settingsScope", "remote.opencodeGoModels"], (child) => {
    mountSettings(child, child.settingsScope.bind({
      namespace: "llm-opencode-go",
      decode: (section) => typeof section === "object" && section !== null ? section : void 0
    }), modelsReady);
  });
}
function mountSettings(ctx, scope, modelsReady) {
  registerUsagePill(ctx, scope);
  const controller = new OpencodeGoSectionController(scope, ctx, async () => {
    await modelsReady;
    return ctx.remote.opencodeGoModels.read();
  });
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
return module.exports; } });
