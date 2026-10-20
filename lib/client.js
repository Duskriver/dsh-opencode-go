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
var import_react5 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var primitives3 = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);

// src/client/host-primitives.ts
function hostAtom(host, current, previous) {
  return host[current] ?? host[previous];
}

// src/client/hint-mark.tsx
var primitives = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);

// plugin-css:src/client/Section.module.css
var id = "dsh-opencode-go/Section.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id;
  style.textContent = '.N807zW_accounts{gap:10px;margin:6px 0;padding:6px 0;display:grid}.N807zW_accountRow{border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;position:relative}.N807zW_accountRow[data-dragging=true]{opacity:.55}.N807zW_accountMain{grid-template-columns:16px 112px 92px minmax(0,1fr) 38px 106px 14px;align-items:center;gap:9px;padding:9px 11px;display:grid}.N807zW_accountHandle{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);cursor:grab;-webkit-user-drag:element;background:0 0;border:0;place-items:center;padding:0;display:grid}.N807zW_accountHandle:disabled{cursor:default;opacity:.5}.N807zW_accountHandle:focus-visible,.N807zW_accountToggle:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:4px}.N807zW_accountName{white-space:nowrap;text-overflow:ellipsis;min-width:0;color:var(--dsw-alias-label-primary);font-size:12.5px;font-weight:600;overflow:hidden}.N807zW_accountState{min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;gap:5px;font-size:11.5px;display:inline-flex;overflow:hidden}.N807zW_accountDot{background:#39a878;border-radius:50%;flex:none;width:6px;height:6px}.N807zW_accountDot[data-off=true]{background:#d9a441}.N807zW_accountPercent{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);font-size:12.5px;font-weight:650}.N807zW_accountBar{background:#ffffff1a;border-radius:99px;height:12px;position:relative;overflow:hidden}.N807zW_accountBarFill{background:#39a878;border-radius:99px;position:absolute;inset:0 auto 0 0}.N807zW_accountBar[data-level=high] .N807zW_accountBarFill{background:#e0a100}.N807zW_accountBar[data-level=limited] .N807zW_accountBarFill{background:#e5484d}.N807zW_accountBarTick{background:#fff3;width:1px;position:absolute;top:0;bottom:0}.N807zW_accountReset{text-align:right;color:var(--dsw-alias-label-tertiary);font-size:11.5px}.N807zW_accountIdle{text-align:right;color:var(--dsw-alias-label-tertiary);grid-column:4/7;font-size:11.5px;line-height:1.5}.N807zW_accountToggle{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;place-items:center;padding:0;display:grid}.N807zW_accountProblems{align-items:baseline;gap:8px;padding:0 11px 9px 36px;display:flex}.N807zW_accountRetry{font:inherit;color:var(--dsw-alias-brand-primary);cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-size:11.5px;line-height:1.5}.N807zW_accountRetry:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.N807zW_accountHandle:active{cursor:grabbing}.N807zW_accountDetail{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;padding:9px 11px 10px 36px;display:flex}.N807zW_accountRow:after{content:"";background:var(--dsw-alias-brand-primary);opacity:0;pointer-events:none;border-radius:2px;height:2px;position:absolute;left:0;right:0}.N807zW_accountRow[data-drop=before]:after{opacity:1;top:-6px}.N807zW_accountRow[data-drop=after]:after{opacity:1;bottom:-6px}.N807zW_accountUsage{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;font-size:12px;display:grid}.N807zW_accountUsage progress{accent-color:#39a878;width:100%;height:8px;margin:6px 0;display:block}.N807zW_accountUsage progress[data-level=high]{accent-color:#e0a100}.N807zW_accountUsage progress[data-level=limited]{accent-color:#e5484d}.N807zW_accountUsage .N807zW_hint{overflow-wrap:anywhere;display:block}.N807zW_accountActions{flex-wrap:wrap;gap:8px;margin-top:10px;display:flex}.N807zW_accountEditor{border:.5px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-bg-layer-3) 25%, transparent);border-radius:10px;flex-direction:column;gap:8px;margin:0 11px 10px 36px;padding:10px 12px;display:flex}.N807zW_accountEditorHead{align-items:baseline;gap:6px;min-width:0;display:flex}.N807zW_accountEditorTitle{color:var(--dsw-alias-label-primary);flex:none;font-size:12.5px;font-weight:600;line-height:1.5}.N807zW_accountEditorFor{min-width:0;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;font-size:11.5px;line-height:1.5}.N807zW_accountField{color:var(--dsw-alias-label-tertiary);flex-direction:column;gap:5px;font-size:11.5px;line-height:1.5;display:flex}.N807zW_accountEditorActions{align-items:center;gap:8px;margin-top:2px;display:flex}@media (width<=480px){.N807zW_accountUsage{grid-template-columns:1fr}}.N807zW_page{flex-direction:column;min-width:0;height:100%;min-height:0;display:flex;container-type:size}.N807zW_pageBody{scrollbar-gutter:stable;flex-direction:column;flex:1;min-height:0;padding:0 4px 16px 0;display:flex;overflow-y:auto}.N807zW_pageBody,.N807zW_modelList,.N807zW_modelDetails{scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l3) transparent}.N807zW_pageBody::-webkit-scrollbar,.N807zW_modelList::-webkit-scrollbar,.N807zW_modelDetails::-webkit-scrollbar{width:8px;height:8px}.N807zW_pageBody::-webkit-scrollbar-track,.N807zW_modelList::-webkit-scrollbar-track,.N807zW_modelDetails::-webkit-scrollbar-track{background:0 0}.N807zW_pageBody::-webkit-scrollbar-thumb,.N807zW_modelList::-webkit-scrollbar-thumb,.N807zW_modelDetails::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l3);background-clip:content-box;border:2px solid #0000;border-radius:999px}.N807zW_pageBody:hover::-webkit-scrollbar-thumb,.N807zW_modelList:hover::-webkit-scrollbar-thumb,.N807zW_modelDetails:hover::-webkit-scrollbar-thumb{background:var(--dsw-alias-label-tertiary);background-clip:content-box}.N807zW_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.N807zW_field+.N807zW_field{border-top:.5px solid var(--dsw-alias-border-l2)}.N807zW_head{align-items:center;gap:8px;display:flex}.N807zW_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.N807zW_trailing{flex:none;align-items:center;gap:8px;display:inline-flex}.N807zW_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.N807zW_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.N807zW_reset:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.N807zW_reset:focus-visible,.N807zW_cardTrigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.N807zW_input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.N807zW_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.N807zW_inputInvalid:focus-visible{border-color:var(--dsw-alias-label-error);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-label-error) 28%, transparent)}.N807zW_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.N807zW_inputInvalid{border-color:var(--dsw-alias-label-error);}.N807zW_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.N807zW_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}.N807zW_rows{flex-direction:column;display:flex}.N807zW_row{grid-template-columns:minmax(0,1fr) 300px;align-items:center;gap:6px 14px;padding:10px 0;display:grid}.N807zW_rowLabel{align-items:center;gap:7px;min-width:0;display:flex}.N807zW_rowTitle{overflow-wrap:anywhere;-webkit-line-clamp:2;min-width:0;color:var(--dsw-alias-label-primary);-webkit-box-orient:vertical;font-size:13px;line-height:1.5;display:-webkit-box;overflow:hidden}.N807zW_rowControl{align-items:center;min-width:0;display:flex}.N807zW_rowControl>.N807zW_input{box-sizing:border-box;width:100%}.N807zW_advancedHead{flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px 12px;display:flex}.N807zW_advancedHead .N807zW_hint{flex:auto;min-width:0}.N807zW_advancedHead .N807zW_reset{flex:none}.N807zW_rowHint,.N807zW_rowInvalid{grid-column:1/-1;margin:0;font-size:12px;line-height:1.5}.N807zW_rowHint{color:var(--dsw-alias-label-tertiary)}.N807zW_rowInvalid{color:var(--dsw-alias-label-error)}.N807zW_groupHead{letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);align-items:center;gap:8px;margin:14px 0 0;font-size:11.5px;line-height:1.5;display:flex}.N807zW_groupHead:first-child{margin-top:4px}.N807zW_groupHead:after{content:"";background:var(--dsw-alias-border-l2);flex:1;height:.5px}.N807zW_info{width:16px;height:16px;font:inherit;color:var(--dsw-alias-label-tertiary);cursor:help;background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:0;font-size:12px;line-height:1;display:inline-flex}.N807zW_info:hover,.N807zW_info:focus-visible{color:var(--dsw-alias-label-primary)}.N807zW_info:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:3px}.N807zW_info svg{width:13px;height:13px}.N807zW_label .N807zW_info,.N807zW_cardTitle .N807zW_info{vertical-align:middle;margin-left:6px}.N807zW_seg{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:8px;flex:1;min-width:0;padding:2px;display:flex;position:relative}.N807zW_segThumb{background:color-mix(in srgb, var(--dsw-alias-label-primary) 16%, transparent);border-radius:6px;width:calc(50% - 2px);transition:transform .16s cubic-bezier(.2,0,0,1);position:absolute;top:2px;bottom:2px;left:2px}.N807zW_seg[data-count="3"] .N807zW_segThumb{width:calc(33.3333% - 1.33333px)}.N807zW_seg[data-index="1"] .N807zW_segThumb{transform:translate(100%)}.N807zW_seg[data-index="2"] .N807zW_segThumb{transform:translate(200%)}.N807zW_segOption{min-width:0;font:inherit;color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:0 0;border:0;border-radius:6px;flex:1 1 0;padding:4px 8px;font-size:12.5px;line-height:1.5;transition:color .16s;position:relative;overflow:hidden}.N807zW_segOption:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.N807zW_segOption[aria-checked=true]{color:var(--dsw-alias-label-primary);font-weight:600}.N807zW_segOption:disabled{opacity:.55;cursor:default}.N807zW_segOption:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.N807zW_pageTop{flex-direction:column;gap:3px;padding:2px 0 12px;display:flex}.N807zW_title{color:var(--dsw-alias-label-primary);margin:0;font-size:15px;font-weight:600;line-height:1.4}.N807zW_intro{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:1.5}.N807zW_card,.N807zW_cardModels{border:.5px solid var(--dsw-alias-border-l2);background:color-mix(in srgb, var(--dsw-alias-bg-layer-3) 40%, transparent);border-radius:12px;padding:8px 0 10px}.N807zW_card{flex:none}.N807zW_card+.N807zW_card,.N807zW_card+.N807zW_cardModels,.N807zW_cardModels+.N807zW_card{margin-top:8px}.N807zW_cardModels{flex-direction:column;flex:1 0 auto;display:flex}.N807zW_cardFolded{flex:none}.N807zW_cardHead{align-items:center;gap:8px;min-height:24px;padding:0 14px;display:flex}.N807zW_cardTitle{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13.5px;font-weight:600;line-height:1.5}.N807zW_cardSub{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11.5px;line-height:1.5}.N807zW_cardStamp{white-space:nowrap;color:var(--dsw-alias-label-tertiary);flex:none;font-size:11.5px;line-height:1.5}.N807zW_cardBody{flex-direction:column;gap:8px;padding:4px 14px 0;display:flex}.N807zW_analyticsPanel{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:10px;margin-top:8px;padding:10px 14px 4px;display:flex}.N807zW_analyticsSection{grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px 18px;display:grid}.N807zW_analyticsCopy{flex-direction:column;gap:2px;min-width:0;display:flex}.N807zW_analyticsLabel{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.5}.N807zW_analyticsDivider{background:var(--dsw-alias-border-l2);height:.5px}.N807zW_cardBody>.N807zW_input{box-sizing:border-box;width:100%}.N807zW_cardModels>.N807zW_cardBody{flex:1 0 auto}.N807zW_cardNotes{flex-direction:column;gap:8px;padding:6px 14px 2px;display:flex}.N807zW_cardNotes:empty{display:none}.N807zW_cardDivider{border-top:.5px solid var(--dsw-alias-border-l2);margin:10px 14px}.N807zW_cardTrigger{width:100%;min-height:24px;font:inherit;text-align:left;color:inherit;cursor:pointer;background:0 0;border:none;align-items:center;gap:8px;margin:0;padding:0 14px;display:flex}.N807zW_cardTrigger:hover .N807zW_cardTitle{color:var(--dsw-alias-brand-primary)}.N807zW_cardHead>.N807zW_cardTrigger{padding:0}.N807zW_limitsEditor{flex-direction:column;flex:1 0 auto;gap:10px;padding-top:4px;display:flex}.N807zW_limitsFoot{border-top:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;margin:2px -14px 0;padding:10px 14px 0;display:flex}.N807zW_limitsSummary{min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:1;font-size:12px;line-height:1.5}.N807zW_modelMeta{align-items:baseline;gap:10px;display:flex}.N807zW_modelMeta .N807zW_limitsModelId{flex:1;min-width:0}.N807zW_releaseDate{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;font-size:11px;line-height:1.4}.N807zW_limitsModelId{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.4;display:block;overflow:hidden}.N807zW_visuallyHidden{clip:rect(0, 0, 0, 0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.N807zW_actions{border-top:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap;flex:none;align-items:center;gap:8px;padding:12px 0;display:flex}.N807zW_starLink{max-width:100%;color:var(--dsw-alias-label-secondary);border-radius:4px;align-items:center;gap:7px;margin-left:auto;padding:6px 0;font-size:12px;line-height:1.5;text-decoration:none;display:inline-flex}.N807zW_starLink svg{flex:none}.N807zW_starLink:hover{color:var(--dsw-alias-brand-primary)}.N807zW_starLink:hover span{text-underline-offset:3px;text-decoration:underline}.N807zW_starLink:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}.N807zW_failedNote{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.N807zW_slot{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}.N807zW_slot svg{width:15px;height:15px}.N807zW_chevron,.N807zW_chevronOpen{width:14px;height:14px;color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .15s}.N807zW_chevron{transform:rotate(-90deg)}.N807zW_filters{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.N807zW_filterAction{align-items:center;margin-left:auto;display:inline-flex}.N807zW_filter{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:6px 9px;font-size:12px}.N807zW_filter[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3)}.N807zW_filter span{color:var(--dsw-alias-label-tertiary);margin-left:4px}.N807zW_modelLayout{border:.5px solid var(--dsw-alias-border-l4);border-radius:10px;flex:auto;grid-template-columns:minmax(0,45fr) minmax(0,55fr);min-height:260px;max-height:560px;display:grid;overflow:hidden}.N807zW_modelList{border-right:.5px solid var(--dsw-alias-border-l2);min-height:0;padding:4px 6px;overflow-y:auto}.N807zW_modelRow{align-items:center;gap:8px;padding-right:6px;display:flex}.N807zW_modelRow+.N807zW_modelRow{border-top:.5px solid var(--dsw-alias-border-l2)}.N807zW_modelRowSelected{background:var(--dsw-alias-bg-layer-3);border-top-color:#0000;border-radius:6px}.N807zW_modelRow>[role=switch]{flex-shrink:0}.N807zW_modelChoice{text-align:left;min-width:0;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:0;border-radius:6px;flex:1;align-items:baseline;padding:9px 3px 9px 6px;display:flex}.N807zW_modelRow:hover:not(.N807zW_modelRowSelected){background:color-mix(in srgb, var(--dsw-alias-bg-layer-3) 92%, var(--dsw-alias-label-primary));border-top-color:#0000;border-radius:6px}.N807zW_modelName{overflow-wrap:anywhere;flex-wrap:wrap;flex:0 auto;align-items:center;gap:5px;min-width:0;font-size:13px;display:flex}.N807zW_overrideDot{background:var(--dsw-alias-brand-primary);border-radius:50%;flex:none;width:6px;height:6px}.N807zW_modelDetails{flex-direction:column;gap:10px;min-height:0;padding:14px;display:flex;overflow-y:auto}.N807zW_modelDetails h3{overflow-wrap:anywhere;margin:0;font-size:14px}.N807zW_modelHeading{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.N807zW_stats{flex-direction:column;gap:10px;display:flex}.N807zW_stat{flex-direction:column;gap:4px;display:flex}.N807zW_statLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}.N807zW_budgetEditor{margin-top:12px;font-size:12px}.N807zW_budgetEditor summary{cursor:pointer}.N807zW_budgetInput{align-items:center;gap:8px;margin-top:4px;display:flex}.N807zW_budgetPresets{flex-wrap:wrap;gap:6px;margin-top:8px;display:flex}.N807zW_modelDetails .N807zW_input{box-sizing:border-box;width:100%;min-width:0;height:30px;padding:0 9px;font-size:12px}.N807zW_modalities{flex-wrap:wrap;gap:4px;display:flex}.N807zW_modality,.N807zW_modalityOff{border-radius:6px;padding:2px 7px;font-size:11px;line-height:1.5}.N807zW_modality{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary)}.N807zW_modalityOff{border:.5px dashed var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary)}.N807zW_modelDetails .N807zW_reset{align-self:flex-start}.N807zW_paneFoot{color:var(--dsw-alias-label-tertiary);margin:auto 0 0;font-size:11px;line-height:1.5}.N807zW_newBadge{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);border-radius:4px;padding:2px 4px;font-size:9px}.N807zW_modelChoice:focus-visible,.N807zW_filter:focus-visible,.N807zW_cardTrigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}@container (width<=440px){.N807zW_row{grid-template-columns:minmax(0,1fr);gap:6px}.N807zW_analyticsSection{grid-template-columns:minmax(0,1fr)}.N807zW_analyticsSection>:last-child{justify-self:start}.N807zW_modelLayout{flex:none;grid-template-columns:minmax(0,1fr);max-height:none}.N807zW_modelList{border-right:0;border-bottom:.5px solid var(--dsw-alias-border-l2);max-height:240px}.N807zW_modelDetails{max-height:460px}}@media (prefers-reduced-motion:reduce){.N807zW_chevron,.N807zW_chevronOpen,.N807zW_segThumb,.N807zW_segOption{transition:none}}';
  document.head.appendChild(style);
}
var Section_default = { "accountActions": "N807zW_accountActions", "accountBar": "N807zW_accountBar", "accountBarFill": "N807zW_accountBarFill", "accountBarTick": "N807zW_accountBarTick", "accountDetail": "N807zW_accountDetail", "accountDot": "N807zW_accountDot", "accountEditor": "N807zW_accountEditor", "accountEditorActions": "N807zW_accountEditorActions", "accountEditorFor": "N807zW_accountEditorFor", "accountEditorHead": "N807zW_accountEditorHead", "accountEditorTitle": "N807zW_accountEditorTitle", "accountField": "N807zW_accountField", "accountHandle": "N807zW_accountHandle", "accountIdle": "N807zW_accountIdle", "accountMain": "N807zW_accountMain", "accountName": "N807zW_accountName", "accountPercent": "N807zW_accountPercent", "accountProblems": "N807zW_accountProblems", "accountReset": "N807zW_accountReset", "accountRetry": "N807zW_accountRetry", "accountRow": "N807zW_accountRow", "accountState": "N807zW_accountState", "accountToggle": "N807zW_accountToggle", "accountUsage": "N807zW_accountUsage", "accounts": "N807zW_accounts", "actions": "N807zW_actions", "advancedHead": "N807zW_advancedHead", "analyticsCopy": "N807zW_analyticsCopy", "analyticsDivider": "N807zW_analyticsDivider", "analyticsLabel": "N807zW_analyticsLabel", "analyticsPanel": "N807zW_analyticsPanel", "analyticsSection": "N807zW_analyticsSection", "budgetEditor": "N807zW_budgetEditor", "budgetInput": "N807zW_budgetInput", "budgetPresets": "N807zW_budgetPresets", "card": "N807zW_card", "cardBody": "N807zW_cardBody", "cardDivider": "N807zW_cardDivider", "cardFolded": "N807zW_cardFolded", "cardHead": "N807zW_cardHead", "cardModels": "N807zW_cardModels", "cardNotes": "N807zW_cardNotes", "cardStamp": "N807zW_cardStamp", "cardSub": "N807zW_cardSub", "cardTitle": "N807zW_cardTitle", "cardTrigger": "N807zW_cardTrigger", "chevron": "N807zW_chevron", "chevronOpen": "N807zW_chevronOpen", "failedNote": "N807zW_failedNote", "field": "N807zW_field", "filter": "N807zW_filter", "filterAction": "N807zW_filterAction", "filters": "N807zW_filters", "groupHead": "N807zW_groupHead", "head": "N807zW_head", "hint": "N807zW_hint", "info": "N807zW_info", "input": "N807zW_input", "inputInvalid": "N807zW_inputInvalid N807zW_input", "intro": "N807zW_intro", "invalid": "N807zW_invalid", "label": "N807zW_label", "limitsEditor": "N807zW_limitsEditor", "limitsFoot": "N807zW_limitsFoot", "limitsModelId": "N807zW_limitsModelId", "limitsSummary": "N807zW_limitsSummary", "modalities": "N807zW_modalities", "modality": "N807zW_modality", "modalityOff": "N807zW_modalityOff", "modelChoice": "N807zW_modelChoice", "modelDetails": "N807zW_modelDetails", "modelHeading": "N807zW_modelHeading", "modelLayout": "N807zW_modelLayout", "modelList": "N807zW_modelList", "modelMeta": "N807zW_modelMeta", "modelName": "N807zW_modelName", "modelRow": "N807zW_modelRow", "modelRowSelected": "N807zW_modelRowSelected", "newBadge": "N807zW_newBadge", "overrideDot": "N807zW_overrideDot", "page": "N807zW_page", "pageBody": "N807zW_pageBody", "pageTop": "N807zW_pageTop", "paneFoot": "N807zW_paneFoot", "releaseDate": "N807zW_releaseDate", "reset": "N807zW_reset", "row": "N807zW_row", "rowControl": "N807zW_rowControl", "rowHint": "N807zW_rowHint", "rowInvalid": "N807zW_rowInvalid", "rowLabel": "N807zW_rowLabel", "rowTitle": "N807zW_rowTitle", "rows": "N807zW_rows", "seg": "N807zW_seg", "segOption": "N807zW_segOption", "segThumb": "N807zW_segThumb", "slot": "N807zW_slot", "starLink": "N807zW_starLink", "stat": "N807zW_stat", "statLabel": "N807zW_statLabel", "stats": "N807zW_stats", "title": "N807zW_title", "trailing": "N807zW_trailing", "visuallyHidden": "N807zW_visuallyHidden" };

// src/client/hint-mark.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var QuestionMark = hostAtom(
  primitives,
  "IconQuestionOutlineRegular",
  "IconQuestionOutline14"
);
var HintTooltip = primitives.Tooltip;
function HintMark(props) {
  const glyph = QuestionMark ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuestionMark, {}) : "?";
  if (!HintTooltip) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: Section_default.info, "aria-hidden": "true", children: glyph });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HintTooltip, { label: props.hint, side: "bottom", maxWidth: 280, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: Section_default.info, "aria-label": props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: glyph }) }) });
}
function HintText(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: props.id, className: HintTooltip ? Section_default.visuallyHidden : Section_default.rowHint, children: props.hint });
}

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

// src/client/ModelEditor.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  const write = (id5, field, value) => {
    const current = draft[id5] === null ? { contextWindow: null, maxTokens: null, thinkingBudgets: null } : draft[id5] ?? {};
    onEdit({ ...draft, [id5]: { ...current, [field]: value ?? null } });
  };
  const badges = (entry) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    entry.configurationMissing ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "warning", children: t(metadataUnavailable ? "configurationUnavailable" : "configurationMissing") }) : null,
    isNewModel(entry, now) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.newBadge, title: t("newHint"), children: t("newBadge") }) : null,
    entry.deprecated ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "warning", children: t("deprecatedBadge") }) : null
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.limitsEditor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("visibilityHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: Section_default.visuallyHidden, htmlFor: "opencode-go-model-filter", children: t("limitsFilterLabel") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.filters, role: "group", "aria-label": t("filterLabel"), children: [
      filters.map(([key, label, count]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: count })
          ]
        },
        key
      )),
      filterAction ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.filterAction, children: filterAction }) : null
    ] }),
    model ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.modelLayout, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("nav", { className: Section_default.modelList, "aria-label": t("modelsLabel"), children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          className: entry.id === model.id ? `${Section_default.modelRow} ${Section_default.modelRowSelected}` : Section_default.modelRow,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: Section_default.modelChoice,
                "aria-pressed": entry.id === model.id,
                onClick: () => {
                  setSelected(entry.id);
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: Section_default.modelName, children: [
                  entry.name ?? entry.id,
                  " ",
                  badges(entry)
                ] })
              }
            ),
            hasCapacityOverride(draft[entry.id]) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.overrideDot, title: t("overridden"), "aria-hidden": "true" }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: Section_default.modelDetails, "aria-label": t("modelDetails"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.modelHeading, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: model.name ?? model.id }),
          badges(model)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.modelMeta, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { className: Section_default.limitsModelId, translate: "no", children: model.id }),
          model.releaseDate ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.releaseDate, title: t("releaseSource", { date: model.releaseDate }), children: model.releaseDate }) : null
        ] }),
        model.configurationMissing ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t(metadataUnavailable ? "configurationUnavailableHint" : "configurationMissingHint") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          model.deprecated ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("deprecatedHint") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.stats, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Capacity, { model, field: "contextWindow", limit: draft[model.id], t, locale, disabled, onChange: write }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Capacity, { model, field: "maxTokens", limit: draft[model.id], t, locale, disabled, onChange: write }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.stat, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.statLabel, children: t("modalityLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Modalities, { model, t })
            ] })
          ] }),
          model.reasoningBudget ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            BudgetPresets,
            {
              model,
              limit: draft[model.id],
              t,
              locale,
              disabled,
              onChange: (values) => {
                write(model.id, "thinkingBudgets", values);
              }
            },
            model.id
          ) : null,
          hasCapacityOverride(draft[model.id]) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: Section_default.paneFoot, children: [
            t("limitsHint"),
            " ",
            t("modalitiesSource"),
            model.inputModalities?.some((modality) => modality !== "text" && modality !== "image") === true ? ` ${t("modalitiesForwarding")}` : ""
          ] })
        ] })
      ] })
    ] }) : models.status === "ready" && all.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("limitsNoMatches", { query }) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.limitsFoot, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.limitsSummary, children: t("limitsSummary", { count: customized }) }),
      Object.values(draft).some(hasCapacityOverride) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_dsh_client_ui_primitives.Button,
        {
          variant: "outline",
          size: "sm",
          disabled,
          onClick: () => {
            onEdit(Object.fromEntries(Object.keys(draft).map((id5) => [id5, null])));
          },
          children: t("limitsResetAll")
        }
      ) : null
    ] })
  ] });
}
function Modalities({ model, t }) {
  const declared = model.inputModalities;
  if (declared === void 0 || declared.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.hint, children: t("modalityUnknown") });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: Section_default.modalities, children: INPUT_MODALITIES.map((modality) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "span",
    {
      className: declared.includes(modality) ? Section_default.modality : Section_default.modalityOff,
      children: t(MODALITY_COPY[modality])
    },
    modality
  )) });
}
function Capacity({ model, field, limit, disabled, t, locale, onChange }) {
  const id5 = `opencode-go-${field}-${encodeURIComponent(model.id)}`;
  const defaultValue = model[field];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.stat, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: Section_default.statLabel, htmlFor: id5, children: t(field === "contextWindow" ? "limitsContext" : "limitsOutput") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "input",
      {
        id: id5,
        className: Section_default.input,
        type: "number",
        min: 1,
        step: 1,
        inputMode: "numeric",
        "aria-label": t(field === "contextWindow" ? "limitsContextLabel" : "limitsOutputLabel", { name: model.name ?? model.id }),
        "aria-describedby": `${id5}-default`,
        value: limit?.[field] ?? "",
        placeholder: defaultValue === void 0 ? t("capacityMissing") : String(defaultValue),
        disabled,
        onChange: (event) => {
          const text2 = event.target.value.trim();
          const value = Number(text2);
          if (text2 === "") onChange(model.id, field, void 0);
          else if (Number.isSafeInteger(value) && value > 0) onChange(model.id, field, value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { id: `${id5}-default`, className: Section_default.hint, children: [
      t("capacityDefault", { value: defaultValue === void 0 ? t("capacityMissing") : defaultValue.toLocaleString(locale) }),
      limit?.[field] != null ? ` \xB7 ${t("overridden")}` : ""
    ] })
  ] });
}
function BudgetPresets({ model, limit, disabled, t, locale, onChange }) {
  const [text2, setText] = (0, import_react.useState)("");
  const range = model.reasoningBudget;
  const max = Math.min(range.max, (limit?.maxTokens ?? model.maxTokens ?? range.max + 1024) - 1024);
  const values = limit?.thinkingBudgets ?? [];
  const tokens = Number(text2);
  const valid = text2.trim() !== "" && Number.isSafeInteger(tokens) && tokens >= range.min && tokens <= max;
  const id5 = `opencode-go-thinking-budget-${encodeURIComponent(model.id)}`;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { className: Section_default.budgetEditor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { children: t("thinkingBudgets") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: Section_default.hint, children: t("thinkingBudgetsHint", { min: range.min.toLocaleString(locale), max: max.toLocaleString(locale) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: Section_default.statLabel, htmlFor: id5, children: t("thinkingBudgetAddLabel", { name: model.name ?? model.id }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: Section_default.budgetInput, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          id: id5,
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
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    values.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: Section_default.budgetPresets, children: values.map((value) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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

// src/client/AccountsCard.tsx
var import_react2 = require("react");
var primitives2 = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/accounts.ts
var MAX_ACCOUNTS = 20;
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

// src/client/AccountsCard.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var WINDOWS = ["rolling", "weekly", "monthly"];
var TICKS = [25, 50, 75];
var ChevronDown = primitives2.IconChevronDownOutlineRegular ?? primitives2.IconChevronDownOutline14;
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "10", height: "14", viewBox: "0 0 10 14", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "2.5", cy: "2.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "7.5", cy: "2.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "2.5", cy: "7", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "7.5", cy: "7", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "2.5", cy: "11.5", r: "1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "7.5", cy: "11.5", r: "1.3" })
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
  const editorForm = (label = "") => editor ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.accountEditorHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.accountEditorTitle, children: editorTitle(editor.kind) }),
          label ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.accountEditorFor, children: label }) : null
        ] }),
        editor.kind === "remove" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t("accountRemoveHint", { name }) }) : null,
        editor.kind === "add" || editor.kind === "rename" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: Section_default.accountField, children: [
          t("accountName"),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
        editor.kind === "add" || editor.kind === "key" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: Section_default.accountField, children: [
            t("keyLabel"),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t("accountKeyHint") })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.accountEditorActions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            import_dsh_client_ui_primitives2.Button,
            {
              variant: "primary",
              size: "sm",
              type: "submit",
              disabled: editor.kind === "key" ? state.busy || state.blocked : disabled,
              children: t(state.busy ? "saving" : "accountConfirm")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", type: "button", disabled: state.busy, onClick: cancel, children: t("accountCancel") })
        ] })
      ]
    }
  ) : null;
  const detail = (account, label) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.accountDetail, children: [
    account.usage ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: Section_default.accountUsage, children: WINDOWS.map((window) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
        t(`usage_${window}`),
        " \xB7 ",
        account.usage[window].percent,
        "%"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "progress",
        {
          "data-level": barLevel(account.usage[window]),
          max: 100,
          value: Math.min(100, account.usage[window].percent),
          "aria-label": `${label} ${t(`usage_${window}`)}`
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: Section_default.hint, children: [
        t("usageResets"),
        " ",
        new Date(account.usage[window].resetsAt).toLocaleString(locale)
      ] })
    ] }, window)) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t(account.loading ? "usageLoading" : "usageUnavailable") }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.accountActions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", disabled, onClick: () => {
        start({ kind: "rename", ref: account.apiKeyEnv }, label);
      }, children: t("accountRename") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", disabled: state.busy || state.blocked || account.writable === false, onClick: () => {
        start({ kind: "key", ref: account.apiKeyEnv }, label);
      }, children: t("accountReplaceKey") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", size: "sm", disabled, onClick: () => {
        start({ kind: "remove", ref: account.apiKeyEnv }, label);
      }, children: t("accountRemove") })
    ] })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: open ? Section_default.card : Section_default.card + " " + Section_default.cardFolded, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.cardHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.cardTitle, children: t("accountsTitle") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.cardSub, children: summary }),
            total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Tag, { tone: unreadable > 0 || ready < total ? "warning" : "success", children: t(unreadable > 0 ? "accountsAvailabilityFailed" : "accountsAvailability", { ready, total, failed: unreadable }) }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronDown, { className: open ? Section_default.chevronOpen : Section_default.chevron })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: Section_default.trailing, children: [
        updatedAt > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: Section_default.cardStamp, title: new Date(updatedAt).toLocaleString(locale), children: [
          t("usageLastUpdated"),
          " ",
          stampText(updatedAt, locale)
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_dsh_client_ui_primitives2.Button,
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
    open ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { id: "opencode-go-accounts", className: Section_default.cardBody, children: [
      state.blocked ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t("accountsBlocked") }) : null,
      state.failure ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t(state.failure === "cleanup" ? "accountsCleanupFailed" : state.failure === "remove" ? "accountsRemoveKeyFailed" : state.failure === "read" ? "accountsReadFailed" : "accountsWriteFailed") }) : null,
      !total ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.hint, children: t("accountsEmpty") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
            return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.accountMain, "data-account-main": "", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
                        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GripIcon, {})
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { className: Section_default.accountName, title: label, children: label }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: Section_default.accountState, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.accountDot, "data-off": account.configured === false ? "true" : void 0 }),
                      account.configured === void 0 ? t(account.failed ? "accountsStatusUnknown" : "usageLoading") : account.configured ? t("keyConfigured") : t("keyMissing")
                    ] }),
                    rolling ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
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
                            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.accountBarFill, style: { width: `${Math.min(100, rolling.percent)}%` } }),
                            TICKS.map((at) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.accountBarTick, style: { left: `${at}%` } }, at))
                          ]
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: Section_default.accountPercent, children: [
                        rolling.percent,
                        "%"
                      ] }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.accountReset, children: resetText(rolling.resetsAt, t) })
                    ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: Section_default.accountIdle, children: account.configured === false ? t("accountConfigureHint") : t(account.loading ? "usageLoading" : "usageUnavailable") }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
                        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronDown, { className: expanded ? Section_default.chevronOpen : Section_default.chevron })
                      }
                    )
                  ] }),
                  account.failed ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.accountProblems, role: "alert", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: Section_default.failedNote, children: account.problem ?? t(account.stale ? "usageStaleHint" : "usageRefreshFailed") }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
      editor ? editor.kind === "add" ? editorForm() : null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: Section_default.field, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: Section_default.head, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: Section_default.label, children: [
          t("accountAutoSwitch"),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(HintMark, { hint: t("accountAutoSwitchHint") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_dsh_client_ui_primitives2.Switch,
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
    ] }) : null
  ] });
}

// src/client/AnalyticsDialog.tsx
var import_react4 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/theme.ts
var import_react3 = require("react");
var GO_THEMES = ["silent-black", "graphite", "sea-salt", "warm-sand"];
var DEFAULT_GO_THEME = "graphite";
var GO_THEME_LABELS = {
  "silent-black": "themeSilentBlack",
  graphite: "themeGraphite",
  "sea-salt": "themeSeaSalt",
  "warm-sand": "themeWarmSand"
};
var GO_THEME_TOKENS = {
  "silent-black": {
    dark: {
      bg: "#101010",
      surface: "#181818",
      surface2: "#202020",
      border: "#2b2b2b",
      text: "#e8e8e8",
      muted: "#8c8c8c",
      accent: "#4098f8",
      accent2: "#8b5cf6",
      success: "#40b870",
      warning: "#f88830",
      danger: "#e5484d"
    },
    light: {
      bg: "#f8f8f8",
      surface: "#ffffff",
      surface2: "#f0f0f0",
      border: "#e4e4e4",
      text: "#1c1c1c",
      muted: "#757575",
      accent: "#0878f8",
      accent2: "#8250df",
      success: "#188838",
      warning: "#e07800",
      danger: "#d9363e"
    }
  },
  graphite: {
    dark: {
      bg: "#111214",
      surface: "#181a1e",
      surface2: "#202329",
      border: "#2a2e36",
      text: "#edeff3",
      muted: "#9aa1ac",
      accent: "#6e8bff",
      accent2: "#a371f7",
      success: "#3fb950",
      warning: "#d29922",
      danger: "#f85149"
    },
    light: {
      bg: "#f6f7f9",
      surface: "#ffffff",
      surface2: "#f0f2f5",
      border: "#e3e6ea",
      text: "#1f2328",
      muted: "#6e7781",
      accent: "#4f6bed",
      accent2: "#8250df",
      success: "#1a7f37",
      warning: "#9a6700",
      danger: "#cf222e"
    }
  },
  "sea-salt": {
    dark: {
      bg: "#0b1416",
      surface: "#111d20",
      surface2: "#182a2e",
      border: "#24383c",
      text: "#e6f0f1",
      muted: "#8fa6ab",
      accent: "#2dd4bf",
      accent2: "#60a5fa",
      success: "#34d399",
      warning: "#fbbf24",
      danger: "#fb7185"
    },
    light: {
      bg: "#f3f8f8",
      surface: "#ffffff",
      surface2: "#eaf3f3",
      border: "#d8e6e6",
      text: "#13262b",
      muted: "#5f7478",
      accent: "#0e8c8f",
      accent2: "#3b82f6",
      success: "#2f9e6b",
      warning: "#c98a2b",
      danger: "#d9534f"
    }
  },
  "warm-sand": {
    dark: {
      bg: "#14110e",
      surface: "#1d1915",
      surface2: "#27211a",
      border: "#352d24",
      text: "#f4eee6",
      muted: "#a99c8d",
      accent: "#e08a62",
      accent2: "#7c9eff",
      success: "#4ade80",
      warning: "#fbbf24",
      danger: "#fb7185"
    },
    light: {
      bg: "#f7f3ec",
      surface: "#fffdf9",
      surface2: "#f1eae0",
      border: "#e6dccd",
      text: "#241f1a",
      muted: "#7a6f63",
      accent: "#c96f4a",
      accent2: "#4f7cff",
      success: "#3e8e63",
      warning: "#c98a2b",
      danger: "#c0504d"
    }
  }
};
var STORAGE_KEY = "dsh-opencode-go.theme";
var listeners = /* @__PURE__ */ new Set();
function isGoTheme(value) {
  return typeof value === "string" && GO_THEMES.includes(value);
}
function readStored() {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isGoTheme(value) ? value : DEFAULT_GO_THEME;
  } catch {
    return DEFAULT_GO_THEME;
  }
}
var currentTheme = readStored();
function getGoTheme() {
  return currentTheme;
}
function setGoTheme(id5) {
  if (!isGoTheme(id5) || id5 === currentTheme) return;
  currentTheme = id5;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id5);
  } catch {
  }
  for (const listener of listeners) listener();
}
function subscribeGoTheme(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function useGoTheme() {
  return (0, import_react3.useSyncExternalStore)(subscribeGoTheme, getGoTheme, () => DEFAULT_GO_THEME);
}
function useHostScheme() {
  const [scheme, setScheme] = (0, import_react3.useState)("dark");
  (0, import_react3.useEffect)(() => {
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
function useGoThemeTokens() {
  const id5 = useGoTheme();
  const scheme = useHostScheme();
  return GO_THEME_TOKENS[id5][scheme];
}
function themeStyle(tokens) {
  return {
    "--go-bg": tokens.bg,
    "--go-surface": tokens.surface,
    "--go-surface-2": tokens.surface2,
    "--go-border": tokens.border,
    "--go-text": tokens.text,
    "--go-muted": tokens.muted,
    "--go-accent": tokens.accent,
    "--go-accent-2": tokens.accent2,
    "--go-success": tokens.success,
    "--go-warning": tokens.warning,
    "--go-danger": tokens.danger
  };
}

// plugin-css:src/client/AnalyticsDialog.module.css
var id2 = "dsh-opencode-go/AnalyticsDialog.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id2) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id2;
  style.textContent = '.SgUYaG_shell{box-shadow:none!important;background:0 0!important;border:0!important;width:auto!important;max-width:none!important;padding:0!important}.SgUYaG_card{background:var(--go-surface,var(--dsw-alias-bg-layer-2,Canvas));width:min(900px,100vw - 24px);max-height:min(88vh,940px);color:var(--go-text,var(--dsw-alias-label-primary,CanvasText));border:1px solid var(--go-border,var(--dsw-alias-border-l2,transparent));border-radius:18px;flex-direction:column;font-size:12px;display:flex;overflow:hidden;box-shadow:0 26px 70px #0006}.SgUYaG_scroll{min-height:0;padding:24px 30px 18px;overflow-y:auto}.SgUYaG_top{justify-content:space-between;align-items:center;gap:16px;display:flex}.SgUYaG_kicker{letter-spacing:.2em;color:var(--go-accent);align-items:center;gap:8px;font-size:9.5px;font-weight:650;display:inline-flex}.SgUYaG_kicker:before{content:"";background:var(--go-accent);width:14px;height:1px}.SgUYaG_meta{color:var(--go-muted);font-variant-numeric:tabular-nums;font-size:10px}.SgUYaG_titleRow{justify-content:space-between;align-items:flex-start;gap:18px;margin-top:12px;display:flex}.SgUYaG_title{letter-spacing:-.045em;margin:0;font-size:38px;font-weight:600;line-height:1.04}.SgUYaG_actions{flex:none;align-items:center;gap:6px;margin-top:4px;display:flex}.SgUYaG_iconButton{cursor:pointer;border:1px solid var(--go-border);width:26px;height:26px;color:var(--go-muted);background:0 0;border-radius:7px;place-items:center;padding:0;display:grid}.SgUYaG_iconButton:hover:not(:disabled){color:var(--go-text);border-color:color-mix(in srgb, var(--go-accent) 45%, var(--go-border))}.SgUYaG_iconButton:disabled{opacity:.5;cursor:default}.SgUYaG_iconButton svg{width:13px;height:13px}.SgUYaG_iconButton:focus-visible{outline:2px solid var(--go-accent);outline-offset:2px}.SgUYaG_lead{max-width:720px;color:color-mix(in srgb, var(--go-text) 80%, var(--go-muted));margin:14px 0 0;font-size:14px;line-height:1.75}.SgUYaG_toolbar{border-bottom:1px solid color-mix(in srgb, var(--go-text) 55%, transparent);justify-content:space-between;align-items:flex-end;gap:16px;margin-top:20px;padding-bottom:9px;display:flex}.SgUYaG_tabs{gap:20px;display:flex}.SgUYaG_tabs button{cursor:pointer;font:inherit;color:var(--go-muted);background:0 0;border:0;padding:0 0 8px;font-size:11px;line-height:1.4;position:relative}.SgUYaG_tabs button:hover{color:var(--go-text)}.SgUYaG_tabs button[aria-pressed=true]{color:var(--go-text);font-weight:600}.SgUYaG_tabs button[aria-pressed=true]:after{content:"";background:var(--go-accent);height:2px;position:absolute;bottom:-10px;left:0;right:0}.SgUYaG_tabs button:focus-visible{outline:2px solid var(--go-accent);outline-offset:3px}.SgUYaG_period{color:var(--go-muted);font-variant-numeric:tabular-nums;letter-spacing:.02em;white-space:nowrap;font-size:10px}.SgUYaG_stale{color:var(--go-warning);white-space:nowrap;font-size:9.5px}.SgUYaG_band{border-bottom:1px solid var(--go-border);grid-template-columns:repeat(4,minmax(0,1fr));padding:18px 0 16px;display:grid}.SgUYaG_kpi{border-left:1px solid var(--go-border);min-width:0;padding:0 20px}.SgUYaG_kpi:first-child{border-left:0;padding-left:0}.SgUYaG_kpi:last-child{padding-right:0}.SgUYaG_kpiLabel{letter-spacing:.14em;text-transform:uppercase;color:var(--go-muted);font-size:9px;display:block}.SgUYaG_kpiValue{letter-spacing:-.035em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;margin-top:7px;font-size:28px;font-weight:600;line-height:1.1;display:block}.SgUYaG_kpiValue em{color:var(--go-muted);letter-spacing:0;font-size:14px;font-style:normal;font-weight:500}.SgUYaG_kpiNote{color:var(--go-muted);margin-top:6px;font-size:9.5px;line-height:1.55;display:block}.SgUYaG_kpiNote b{color:var(--go-text);font-weight:600}.SgUYaG_warn{color:var(--go-warning)}.SgUYaG_sec{border-bottom:1px solid var(--go-border);padding:20px 0 18px}.SgUYaG_secHead{justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:14px;display:flex}.SgUYaG_secHead h2{letter-spacing:-.01em;margin:0;font-size:13px;font-weight:650}.SgUYaG_secHint{color:var(--go-muted);letter-spacing:.02em;font-size:9.5px}.SgUYaG_quotaGrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:30px;display:grid}.SgUYaG_quota{--qcolor:var(--go-success);min-width:0}.SgUYaG_quota[data-state=high]{--qcolor:var(--go-warning)}.SgUYaG_quota[data-state=full]{--qcolor:var(--go-danger)}.SgUYaG_qTop{justify-content:space-between;align-items:baseline;gap:8px;display:flex}.SgUYaG_qLabel{font-size:11px;font-weight:600}.SgUYaG_qValue{letter-spacing:-.04em;font-variant-numeric:tabular-nums;margin-top:6px;font-size:30px;font-weight:600;line-height:1;display:block}.SgUYaG_quota[data-state=high] .SgUYaG_qValue,.SgUYaG_quota[data-state=full] .SgUYaG_qValue{color:var(--qcolor)}.SgUYaG_qTrack{background:var(--go-surface-2);border-radius:2px;height:3px;margin-top:12px;position:relative}.SgUYaG_qFill{background:var(--qcolor);border-radius:2px;position:absolute;inset:0 auto 0 0}.SgUYaG_quota[data-state=high] .SgUYaG_qFill{background:linear-gradient(90deg, var(--go-warning), var(--go-danger))}.SgUYaG_qTick{background:color-mix(in srgb, var(--go-text) 22%, transparent);width:1px;position:absolute;top:-3px;bottom:-3px;left:85%}.SgUYaG_qFoot{color:var(--go-muted);font-variant-numeric:tabular-nums;align-items:baseline;gap:8px;margin-top:9px;font-size:9.5px;display:flex}.SgUYaG_qWarn{color:var(--go-danger);margin-top:4px;font-size:9.5px;font-weight:600}.SgUYaG_quotaFailed{border-bottom:1px solid var(--go-border);color:var(--go-muted);margin:0;padding:18px 0 16px;font-size:10px}.SgUYaG_compBar{border-radius:3px;gap:2px;height:12px;display:flex;overflow:hidden}.SgUYaG_compSeg{min-width:2px;height:100%;display:block}.SgUYaG_compLegend{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px 16px;margin-top:12px;display:grid}.SgUYaG_compItem{grid-template-columns:7px minmax(0,1fr);align-items:start;gap:6px;min-width:0;display:grid}.SgUYaG_compDot{border-radius:2px;width:7px;height:7px;margin-top:4px}.SgUYaG_compText{min-width:0;color:var(--go-muted);overflow-wrap:anywhere;font-size:9.5px;line-height:1.4}.SgUYaG_compText b{color:var(--go-text);font-variant-numeric:tabular-nums;margin-top:2px;font-size:11px;font-weight:600;display:block}.SgUYaG_compText b em{color:var(--go-muted);margin-left:4px;font-size:9.5px;font-style:normal;font-weight:400}.SgUYaG_compNote{color:var(--go-muted);margin:10px 0 0;font-size:9.5px;line-height:1.6}.SgUYaG_table{border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums;width:100%}.SgUYaG_table th:first-child{width:30%}.SgUYaG_table th:nth-child(2){width:9%}.SgUYaG_table th:nth-child(3),.SgUYaG_table th:nth-child(4),.SgUYaG_table th:nth-child(5){width:11%}.SgUYaG_table th:nth-child(6){width:13%}.SgUYaG_table th:nth-child(7){width:15%}.SgUYaG_table th{letter-spacing:.12em;text-transform:uppercase;color:var(--go-muted);text-align:right;border-bottom:1px solid var(--go-border);white-space:nowrap;padding:0 0 8px;font-size:8.5px;font-weight:600}.SgUYaG_table th:first-child{text-align:left}.SgUYaG_table td{border-bottom:1px solid var(--go-border);text-align:right;padding:8px 0;font-size:11.5px}.SgUYaG_table tr:last-child td{border-bottom:0}.SgUYaG_table td:first-child{text-align:left}.SgUYaG_nameCell{align-items:center;gap:8px;min-width:0;display:flex}.SgUYaG_mDot{border-radius:2px;flex:none;width:6px;height:6px}.SgUYaG_mName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:11.5px;font-weight:550;overflow:hidden}.SgUYaG_dim{color:var(--go-muted)}.SgUYaG_spend{font-weight:600}.SgUYaG_tag{color:var(--go-warning);border:1px solid color-mix(in srgb, var(--go-warning) 35%, transparent);white-space:nowrap;border-radius:999px;padding:0 5px;font-size:8.5px;line-height:1.6;display:inline-block}.SgUYaG_shareCell{justify-content:flex-end;align-items:center;gap:8px;display:flex}.SgUYaG_shareBar{background:var(--go-surface-2);border-radius:2px;width:54px;height:3px;overflow:hidden}.SgUYaG_shareBar i{background:var(--go-accent);height:100%;display:block}.SgUYaG_shareValue{text-align:right;width:34px;color:var(--go-muted);font-size:10px}.SgUYaG_daysWrap{grid-template-columns:236px minmax(0,1fr);align-items:start;gap:30px;display:grid;position:relative}.SgUYaG_heat{grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;display:grid}.SgUYaG_heatDay{color:var(--go-muted);text-align:center;padding-bottom:3px;font-size:8px}.SgUYaG_heatCell{aspect-ratio:1;background:var(--go-surface-2);cursor:default;box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--go-text) 4%, transparent);border-radius:3px}.SgUYaG_heatCell[data-active]{outline:1.5px solid var(--go-text);outline-offset:1px}.SgUYaG_heatPad{aspect-ratio:1;background:color-mix(in srgb, var(--go-text) 3.5%, transparent);border-radius:3px}.SgUYaG_trend{cursor:crosshair;min-width:0}.SgUYaG_trendSvg{width:100%;height:auto;display:block}.SgUYaG_trendSvg text{fill:var(--go-muted);font-variant-numeric:tabular-nums;font-family:inherit;font-size:8px}.SgUYaG_trendGrid{stroke:var(--go-border);stroke-width:1px;stroke-dasharray:2 4}.SgUYaG_trendBase{stroke:var(--go-border);stroke-width:1px}.SgUYaG_trendArea{fill:url(#go-analytics-area)}.SgUYaG_trendLine{fill:none;stroke:var(--go-accent);stroke-width:1.4px;stroke-linejoin:round}.SgUYaG_trendPeak{fill:var(--go-accent-2);stroke:var(--go-surface);stroke-width:2px}.SgUYaG_trendHit{fill:#0000;pointer-events:all}.SgUYaG_trendGuide{stroke:color-mix(in srgb, var(--go-text) 32%, transparent);stroke-width:1px;stroke-dasharray:2 3;pointer-events:none}.SgUYaG_trendFocus{fill:var(--go-accent);stroke:var(--go-surface);stroke-width:2px;pointer-events:none}.SgUYaG_dayTip{z-index:6;pointer-events:none;background:color-mix(in srgb, var(--go-surface-2) 96%, transparent);border:1px solid var(--go-border);min-width:126px;color:var(--go-text);font-variant-numeric:tabular-nums;white-space:nowrap;border-radius:9px;padding:7px 10px 8px;font-size:10px;line-height:1.5;position:absolute;box-shadow:0 12px 30px #0000006b}.SgUYaG_dayTipHead{color:var(--go-muted);align-items:baseline;gap:6px;font-size:9px;display:flex}.SgUYaG_dayTipHead b{color:var(--go-text);font-size:10px;font-weight:600}.SgUYaG_dayTipValue{letter-spacing:-.02em;margin-top:2px;font-size:14px;font-weight:600}.SgUYaG_dayTipMeta{color:var(--go-muted);margin-top:1px;font-size:9.5px}.SgUYaG_trendFoot{color:var(--go-muted);justify-content:space-between;gap:12px;margin-top:8px;font-size:9.5px;display:flex}.SgUYaG_trendFoot b{color:var(--go-text);font-variant-numeric:tabular-nums;font-weight:600}.SgUYaG_seg{background:var(--go-surface-2);border:1px solid var(--go-border);border-radius:9px;gap:2px;padding:2px;display:inline-flex}.SgUYaG_seg button{cursor:pointer;font:inherit;color:var(--go-muted);background:0 0;border:0;border-radius:7px;padding:2px 9px;font-size:10px;line-height:1.6}.SgUYaG_seg button:focus-visible{outline:2px solid var(--go-accent);outline-offset:1px}.SgUYaG_seg button[aria-pressed=true]{background:var(--go-surface);color:var(--go-text)}.SgUYaG_foot{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:26px;padding-top:16px;display:grid}.SgUYaG_footCol{min-width:0;color:var(--go-muted);font-size:9px;line-height:1.75}.SgUYaG_footCol p{margin:0 0 3px}.SgUYaG_footCol p:last-child{margin-bottom:0}.SgUYaG_foot .SgUYaG_notice{grid-column:1/-1;margin:0 0 2px}.SgUYaG_notice{background:color-mix(in srgb, var(--go-warning) 10%, transparent);color:var(--go-text);border-radius:8px;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 8px;padding:8px 10px;font-size:10px;display:flex}.SgUYaG_action{border:1px solid color-mix(in srgb, var(--go-accent) 45%, transparent);background:color-mix(in srgb, var(--go-accent) 10%, transparent);color:var(--go-accent);font:inherit;cursor:pointer;border-radius:7px;padding:3px 8px;font-size:10px;line-height:1.6}.SgUYaG_action:hover:not(:disabled){background:color-mix(in srgb, var(--go-accent) 16%, transparent)}.SgUYaG_action:disabled{opacity:.55;cursor:default}.SgUYaG_action:focus-visible{outline:2px solid var(--go-accent);outline-offset:1px}.SgUYaG_error{background:color-mix(in srgb, var(--go-danger) 10%, transparent);border-radius:10px;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 0;padding:10px 12px;font-size:11px;display:flex}.SgUYaG_error p{margin:0}.SgUYaG_loading{color:var(--go-muted);margin:18px 0 0;font-size:12px}.SgUYaG_empty{color:var(--go-muted);margin:16px 0 0;padding:14px 0;font-size:12px}@media (width<=760px){.SgUYaG_card{width:calc(100vw - 16px);max-height:92vh}.SgUYaG_scroll{padding:18px 16px 14px}.SgUYaG_title{font-size:30px}.SgUYaG_band{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:16px}.SgUYaG_kpi{padding:0 14px}.SgUYaG_kpi:nth-child(3){border-left:0;padding-left:0}.SgUYaG_quotaGrid{grid-template-columns:1fr;gap:18px}.SgUYaG_compLegend{grid-template-columns:repeat(2,minmax(0,1fr))}.SgUYaG_daysWrap{grid-template-columns:1fr;gap:18px}.SgUYaG_heat{max-width:320px}.SgUYaG_table th:nth-child(3),.SgUYaG_table td:nth-child(3),.SgUYaG_table th:nth-child(4),.SgUYaG_table td:nth-child(4),.SgUYaG_table th:nth-child(5),.SgUYaG_table td:nth-child(5){display:none}.SgUYaG_foot{grid-template-columns:1fr;gap:10px}.SgUYaG_period{display:none}}@media (width<=420px){.SgUYaG_title{font-size:26px}.SgUYaG_kpiValue{font-size:22px}.SgUYaG_tabs{gap:14px}.SgUYaG_shareBar{display:none}.SgUYaG_compLegend{grid-template-columns:1fr}}';
  document.head.appendChild(style);
}
var AnalyticsDialog_default = { "action": "SgUYaG_action", "actions": "SgUYaG_actions", "band": "SgUYaG_band", "card": "SgUYaG_card", "compBar": "SgUYaG_compBar", "compDot": "SgUYaG_compDot", "compItem": "SgUYaG_compItem", "compLegend": "SgUYaG_compLegend", "compNote": "SgUYaG_compNote", "compSeg": "SgUYaG_compSeg", "compText": "SgUYaG_compText", "dayTip": "SgUYaG_dayTip", "dayTipHead": "SgUYaG_dayTipHead", "dayTipMeta": "SgUYaG_dayTipMeta", "dayTipValue": "SgUYaG_dayTipValue", "daysWrap": "SgUYaG_daysWrap", "dim": "SgUYaG_dim", "empty": "SgUYaG_empty", "error": "SgUYaG_error", "foot": "SgUYaG_foot", "footCol": "SgUYaG_footCol", "heat": "SgUYaG_heat", "heatCell": "SgUYaG_heatCell", "heatDay": "SgUYaG_heatDay", "heatPad": "SgUYaG_heatPad", "iconButton": "SgUYaG_iconButton", "kicker": "SgUYaG_kicker", "kpi": "SgUYaG_kpi", "kpiLabel": "SgUYaG_kpiLabel", "kpiNote": "SgUYaG_kpiNote", "kpiValue": "SgUYaG_kpiValue", "lead": "SgUYaG_lead", "loading": "SgUYaG_loading", "mDot": "SgUYaG_mDot", "mName": "SgUYaG_mName", "meta": "SgUYaG_meta", "nameCell": "SgUYaG_nameCell", "notice": "SgUYaG_notice", "period": "SgUYaG_period", "qFill": "SgUYaG_qFill", "qFoot": "SgUYaG_qFoot", "qLabel": "SgUYaG_qLabel", "qTick": "SgUYaG_qTick", "qTop": "SgUYaG_qTop", "qTrack": "SgUYaG_qTrack", "qValue": "SgUYaG_qValue", "qWarn": "SgUYaG_qWarn", "quota": "SgUYaG_quota", "quotaFailed": "SgUYaG_quotaFailed", "quotaGrid": "SgUYaG_quotaGrid", "scroll": "SgUYaG_scroll", "sec": "SgUYaG_sec", "secHead": "SgUYaG_secHead", "secHint": "SgUYaG_secHint", "seg": "SgUYaG_seg", "shareBar": "SgUYaG_shareBar", "shareCell": "SgUYaG_shareCell", "shareValue": "SgUYaG_shareValue", "shell": "SgUYaG_shell", "spend": "SgUYaG_spend", "stale": "SgUYaG_stale", "table": "SgUYaG_table", "tabs": "SgUYaG_tabs", "tag": "SgUYaG_tag", "title": "SgUYaG_title", "titleRow": "SgUYaG_titleRow", "toolbar": "SgUYaG_toolbar", "top": "SgUYaG_top", "trend": "SgUYaG_trend", "trendArea": "SgUYaG_trendArea", "trendBase": "SgUYaG_trendBase", "trendFocus": "SgUYaG_trendFocus", "trendFoot": "SgUYaG_trendFoot", "trendGrid": "SgUYaG_trendGrid", "trendGuide": "SgUYaG_trendGuide", "trendHit": "SgUYaG_trendHit", "trendLine": "SgUYaG_trendLine", "trendPeak": "SgUYaG_trendPeak", "trendSvg": "SgUYaG_trendSvg", "warn": "SgUYaG_warn" };

// src/client/AnalyticsDialog.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var RANGES = [
  { key: "today", label: "analyticsRangeToday", days: 0 },
  { key: "7d", label: "analyticsRange7d", days: 7 },
  { key: "30d", label: "analyticsRange30d", days: 30 },
  { key: "90d", label: "analyticsRange90d", days: 90 }
];
var MAX_SESSIONS_STORAGE_KEY = "opencode-go:analytics:maxSessions";
var DEFAULT_MAX_SESSIONS = 500;
var MAX_SESSIONS_CEILING = 2e3;
var TREND_FILL_ID = "opencode-go-analytics-trend-fill";
var MODEL_COLORS = [
  "var(--go-accent)",
  "var(--go-accent-2)",
  "var(--go-success)",
  "var(--go-warning)",
  "color-mix(in srgb, var(--go-accent) 52%, var(--go-accent-2))",
  "color-mix(in srgb, var(--go-accent-2) 52%, var(--go-danger))",
  "color-mix(in srgb, var(--go-accent) 45%, var(--go-success))",
  "color-mix(in srgb, var(--go-muted) 65%, transparent)"
];
function loadMaxSessions() {
  try {
    const raw = globalThis.localStorage?.getItem(MAX_SESSIONS_STORAGE_KEY);
    if (raw === null || raw === void 0) return DEFAULT_MAX_SESSIONS;
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) return DEFAULT_MAX_SESSIONS;
    return Math.min(MAX_SESSIONS_CEILING, Math.max(1, value));
  } catch {
    return DEFAULT_MAX_SESSIONS;
  }
}
function saveMaxSessions(value) {
  try {
    globalThis.localStorage?.setItem(MAX_SESSIONS_STORAGE_KEY, String(value));
  } catch {
  }
}
function startOfLocalDay(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}
function resolvedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
function queryFor(range, maxSessions, to) {
  const now = new Date(to);
  if (range === "today") return { from: startOfLocalDay(now), to, timeZone: resolvedTimeZone(), maxSessions };
  const days = RANGES.find((item) => item.key === range)?.days ?? 30;
  const from = new Date(startOfLocalDay(now));
  from.setDate(from.getDate() - (days - 1));
  return { from: from.getTime(), to, timeZone: resolvedTimeZone(), maxSessions };
}
function compact(value, locale) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
function number(value, locale) {
  return new Intl.NumberFormat(locale).format(value);
}
function usd(micro, locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: micro < 1e5 ? 4 : 2
  }).format(micro / 1e6);
}
function nearestIndexWithin(boxes, x, y, slop) {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    const dx = Math.max(box.left - x, 0, x - box.right);
    const dy = Math.max(box.top - y, 0, y - box.bottom);
    const distance = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best >= 0 && bestDistance <= slop ? best : null;
}
var HEAT_HOVER_SLOP = 5;
function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
function niceTop(value) {
  if (!(value > 0)) return 1;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exponent;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return step * exponent;
}
function dayOfWeek(day) {
  return ((/* @__PURE__ */ new Date(day + "T00:00:00Z")).getUTCDay() + 6) % 7;
}
function weekdayHeads(locale) {
  const format = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2026, 2, 2 + index))));
}
function weekdayLabel(day, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(day + "T00:00:00Z"));
}
function dayKeyOf(at, timeZone) {
  const shaped = (zone) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(at));
    const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return value("year") + "-" + value("month") + "-" + value("day");
  };
  try {
    return shaped(timeZone);
  } catch {
    return shaped("UTC");
  }
}
function nextDayKey(day) {
  return new Date(Date.parse(day + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
}
function denseDays(report) {
  const { from, to } = report.range;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  const buckets = new Map(report.byDay.map((row) => [row.day, row]));
  const end = dayKeyOf(Math.max(from, to - 1), report.timeZone);
  const series = [];
  let key = dayKeyOf(from, report.timeZone);
  while (series.length < 366) {
    series.push(buckets.get(key) ?? { day: key, requests: 0, tokens: 0, estimatedMicroUsd: 0 });
    if (key >= end) break;
    const next = nextDayKey(key);
    if (next <= key) break;
    key = next;
  }
  return series;
}
function isUnsupported(error) {
  if (error === null || typeof error !== "object" || !("code" in error) || !("details" in error)) return false;
  const details = error.details;
  return error.code === "opencode-go/analytics-unavailable" && details !== null && typeof details === "object" && "reason" in details && details.reason === "no-session-query";
}
function isCancellation(error) {
  if (error === null || typeof error !== "object") return false;
  if (error.name === "AbortError") return true;
  return error.code === "gateway/cancelled";
}
function RefreshIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M13.2 8.4A5.2 5.2 0 1 1 11.6 4.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M13.4 2.6v2.6h-2.6" })
  ] });
}
function CloseIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M4 4l8 8M12 4l-8 8" }) });
}
function leadFor(report, t, locale) {
  const totals = report.totals;
  const tokenTotal = totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
  const base = fill(t("analyticsLead"), {
    requests: number(totals.requests, locale),
    tokens: compact(tokenTotal, locale),
    spend: totals.pricedRequests === 0 ? "\u2014" : usd(totals.estimatedMicroUsd, locale)
  });
  if (totals.estimatedMicroUsd <= 0) return base;
  const top = [...report.byModel].sort((left, right) => right.estimatedMicroUsd - left.estimatedMicroUsd)[0];
  if (top === void 0 || top.estimatedMicroUsd <= 0) return base;
  return base + " " + fill(t("analyticsLeadTop"), {
    model: top.name ?? top.model,
    share: (top.estimatedMicroUsd / totals.estimatedMicroUsd * 100).toFixed(1) + "%"
  });
}
function AnalyticsDialog({ open, onClose, readAnalytics, readQuota, t, getLocale }) {
  const [range, setRange] = (0, import_react4.useState)("30d");
  const [maxSessions, setMaxSessions] = (0, import_react4.useState)(loadMaxSessions);
  const [revision, setRevision] = (0, import_react4.useState)(0);
  const [chartMode, setChartMode] = (0, import_react4.useState)("spend");
  const [report, setReport] = (0, import_react4.useState)(null);
  const [quota, setQuota] = (0, import_react4.useState)(null);
  const [quotaFailed, setQuotaFailed] = (0, import_react4.useState)(false);
  const [loading, setLoading] = (0, import_react4.useState)(false);
  const [error, setError] = (0, import_react4.useState)(null);
  const generation = (0, import_react4.useRef)(0);
  const toRef = (0, import_react4.useRef)(0);
  const forceRef = (0, import_react4.useRef)(false);
  const reportsRef = (0, import_react4.useRef)(/* @__PURE__ */ new Map());
  const analyticsRef = (0, import_react4.useRef)(readAnalytics);
  const quotaRef = (0, import_react4.useRef)(readQuota);
  analyticsRef.current = readAnalytics;
  quotaRef.current = readQuota;
  const tokens = useGoThemeTokens();
  const locale = getLocale?.();
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    toRef.current = Date.now();
    reportsRef.current.clear();
  }, [open]);
  (0, import_react4.useEffect)(() => {
    if (!open || quotaRef.current === void 0) return;
    let stopped = false;
    setQuotaFailed(false);
    void quotaRef.current().then((usage) => {
      if (!stopped) setQuota(usage);
    }, () => {
      if (!stopped) {
        setQuota(null);
        setQuotaFailed(true);
      }
    });
    return () => {
      stopped = true;
    };
  }, [open, revision]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    let stopped = false;
    const controller = new AbortController();
    const id5 = ++generation.current;
    const force = forceRef.current;
    forceRef.current = false;
    const query = queryFor(range, maxSessions, toRef.current);
    const key = JSON.stringify(query);
    const cached = reportsRef.current.get(key);
    if (cached !== void 0 && !force) setReport(cached);
    setError(null);
    setLoading(true);
    void analyticsRef.current(query, controller.signal).then((next) => {
      if (stopped || id5 !== generation.current) return;
      reportsRef.current.set(key, next);
      setReport(next);
    }).catch((reason) => {
      if (stopped || id5 !== generation.current) return;
      if (controller.signal.aborted || isCancellation(reason)) return;
      setError(reason);
    }).finally(() => {
      if (!stopped && id5 === generation.current) setLoading(false);
    });
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [open, range, maxSessions, revision]);
  const applyMaxSessions = (value) => {
    setMaxSessions(value);
    saveMaxSessions(value);
  };
  const counts = report?.totals;
  const unsupported = error !== null && isUnsupported(error);
  const empty = report !== null && report.totals.requests === 0;
  const selected = queryFor(range, maxSessions, toRef.current);
  const rangeText = new Date(selected.from).toLocaleDateString(locale) + " \u2013 " + new Date(selected.to - 1).toLocaleDateString(locale);
  const colorFor = (model) => {
    const index = report === null ? -1 : report.byModel.findIndex((row) => row.model === model);
    return MODEL_COLORS[(index < 0 ? 0 : index) % MODEL_COLORS.length];
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Modal, { open, onClose, title: t("analyticsTitle"), headless: true, className: AnalyticsDialog_default.shell, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: AnalyticsDialog_default.card, style: themeStyle(tokens), "aria-busy": loading, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.scroll, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.top, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.kicker, children: [
          "OpenCode Go \xB7 ",
          t("analyticsKicker")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.meta, children: report !== null ? t("usageLastUpdated") + " " + new Date(report.generatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.titleRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h1", { className: AnalyticsDialog_default.title, children: t("analyticsTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.actions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              className: AnalyticsDialog_default.iconButton,
              "aria-label": t("analyticsRefresh"),
              title: t("analyticsRefresh"),
              disabled: loading,
              onClick: () => {
                forceRef.current = true;
                toRef.current = Date.now();
                setRevision((value) => value + 1);
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RefreshIcon, {})
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              className: AnalyticsDialog_default.iconButton,
              "aria-label": t("analyticsClose"),
              title: t("analyticsClose"),
              onClick: onClose,
              children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CloseIcon, {})
            }
          )
        ] })
      ] }),
      report !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: AnalyticsDialog_default.lead, children: leadFor(report, t, locale) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.toolbar, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: AnalyticsDialog_default.tabs, role: "group", "aria-label": t("analyticsRange"), children: RANGES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            "aria-pressed": range === item.key,
            onClick: () => {
              setRange(item.key);
            },
            children: t(item.label)
          },
          item.key
        )) }),
        loading && report !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.stale, children: t("analyticsStaleResults") }) : null,
        toRef.current > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.period, children: rangeText }) : null
      ] })
    ] }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.error, role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: unsupported ? t("analyticsUnsupported") : t("analyticsFailed") }),
      !unsupported && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: AnalyticsDialog_default.action, onClick: () => {
        forceRef.current = true;
        toRef.current = Date.now();
        setRevision((value) => value + 1);
      }, children: t("analyticsRetry") })
    ] }),
    loading && report === null && error === null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: AnalyticsDialog_default.loading, role: "status", children: t("analyticsLoading") }),
    report !== null && counts !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(KpiBand, { report, locale, t }) : null,
    quota !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QuotaSection, { quota, locale, t }) : quotaFailed ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: AnalyticsDialog_default.quotaFailed, children: t("analyticsQuotaFailed") }) : null,
    report !== null && counts !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      empty ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: AnalyticsDialog_default.empty, children: t("analyticsEmpty") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Composition, { report, locale, t, colorFor }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ModelTable, { report, locale, t, colorFor }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DaySection, { report, mode: chartMode, onMode: setChartMode, locale, t }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Footer,
        {
          report,
          locale,
          t,
          maxSessions,
          loading,
          onScanMore: () => {
            applyMaxSessions(Math.min(maxSessions * 2, MAX_SESSIONS_CEILING));
          }
        }
      )
    ] })
  ] }) }) });
}
function KpiBand({ report, locale, t }) {
  const totals = report.totals;
  const coverage = report.coverage;
  const tokenTotal = totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
  const cachedInput = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
  const cacheShare = cachedInput === 0 ? 0 : totals.cacheReadTokens / cachedInput * 100;
  const spanDays = Math.max(1, Math.ceil((report.range.to - report.range.from) / 864e5));
  const daily = Math.round(totals.requests / spanDays);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: AnalyticsDialog_default.band, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.kpi, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.kpiLabel, children: t("analyticsRequests") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { className: AnalyticsDialog_default.kpiValue, children: number(totals.requests, locale) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.kpiNote, children: [
        t("analyticsDailyAverage"),
        " ",
        number(daily, locale),
        " \xB7 ",
        t("analyticsSummaries"),
        " ",
        number(totals.summaries, locale),
        " \xB7 ",
        t("analyticsUnsettled"),
        " ",
        number(totals.unsettledAttempts, locale)
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.kpi, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.kpiLabel, children: t("analyticsTokens") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { className: AnalyticsDialog_default.kpiValue, children: compact(tokenTotal, locale) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.kpiNote, children: [
        t("analyticsInput"),
        " ",
        compact(totals.inputTokens, locale),
        " \xB7 ",
        t("analyticsOutput"),
        " ",
        compact(totals.outputTokens, locale),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {}),
        t("analyticsCacheRead"),
        " ",
        compact(totals.cacheReadTokens, locale),
        " \xB7 ",
        cacheShare.toFixed(1),
        "% ",
        t("analyticsCacheHit")
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.kpi, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.kpiLabel, children: t("analyticsSpend") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { className: AnalyticsDialog_default.kpiValue, children: totals.pricedRequests === 0 ? "-" : usd(totals.estimatedMicroUsd, locale) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.kpiNote, children: [
        t("analyticsPriced"),
        " ",
        number(totals.pricedRequests, locale),
        " \xB7 ",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.warn, children: [
          t("analyticsUnpriced"),
          " ",
          number(totals.unpricedRequests, locale)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {}),
        t("analyticsMissing"),
        " ",
        number(totals.missingUsage, locale)
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.kpi, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.kpiLabel, children: t("analyticsCoverage") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("b", { className: AnalyticsDialog_default.kpiValue, children: [
        number(coverage.scannedSessions, locale),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("em", { children: [
          " / ",
          number(coverage.listedSessions, locale)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.kpiNote, children: [
        t("analyticsFailedSessions"),
        " ",
        number(coverage.failedSessions, locale),
        " \xB7 ",
        t("analyticsSeconds"),
        " ",
        (coverage.scanMs / 1e3).toFixed(1),
        "s"
      ] })
    ] })
  ] });
}
function QuotaSection({ quota, locale, t }) {
  const windows = [
    { key: "rolling", label: t("usage_rolling"), window: quota.rolling },
    { key: "weekly", label: t("usage_weekly"), window: quota.weekly },
    { key: "monthly", label: t("usage_monthly"), window: quota.monthly }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: AnalyticsDialog_default.sec, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.secHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("analyticsQuota") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.secHint, children: t("analyticsQuotaHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: AnalyticsDialog_default.quotaGrid, children: windows.map(({ key, label, window }) => {
      const limited = window.status === "rate-limited";
      const percent = Math.min(100, Math.max(0, window.percent));
      const state = limited || percent >= 100 ? "full" : percent >= 80 ? "high" : "ok";
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.quota, "data-state": state, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: AnalyticsDialog_default.qTop, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.qLabel, children: label }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("b", { className: AnalyticsDialog_default.qValue, children: [
          window.percent,
          "%"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "div",
          {
            className: AnalyticsDialog_default.qTrack,
            role: "progressbar",
            "aria-label": label,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-valuenow": Math.round(window.percent),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { className: AnalyticsDialog_default.qFill, style: { width: percent + "%" } }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.qTick })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: AnalyticsDialog_default.qFoot, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
          t("usageResets"),
          " ",
          new Date(window.resetsAt).toLocaleString(locale)
        ] }) }),
        limited ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: AnalyticsDialog_default.qWarn, children: t("usageLimited") }) : null
      ] }, key);
    }) })
  ] });
}
function Composition({ report, locale, t, colorFor }) {
  const total = report.totals.estimatedMicroUsd;
  const priced = report.byModel.filter((row) => row.estimatedMicroUsd > 0).sort((left, right) => right.estimatedMicroUsd - left.estimatedMicroUsd);
  if (total <= 0 || priced.length === 0) return null;
  const top = priced.slice(0, 5);
  const rest = priced.slice(5);
  const restValue = rest.reduce((sum, row) => sum + row.estimatedMicroUsd, 0);
  const unpriced = report.byModel.filter((row) => row.pricedRequests === 0 && row.unpricedRequests > 0);
  const unpricedNames = unpriced.slice(0, 4).map((row) => row.name ?? row.model);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: AnalyticsDialog_default.sec, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.secHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("analyticsComposition") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.secHint, children: t("analyticsCompositionHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.compBar, role: "img", "aria-label": t("analyticsComposition"), children: [
      top.map((row) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "i",
        {
          className: AnalyticsDialog_default.compSeg,
          style: { width: row.estimatedMicroUsd / total * 100 + "%", background: colorFor(row.model) },
          title: (row.name ?? row.model) + " \xB7 " + usd(row.estimatedMicroUsd, locale) + " \xB7 " + (row.estimatedMicroUsd / total * 100).toFixed(1) + "%"
        },
        row.model
      )),
      rest.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "i",
        {
          className: AnalyticsDialog_default.compSeg,
          style: { width: restValue / total * 100 + "%", background: "var(--go-muted)" },
          title: fill(t("analyticsCompositionOther"), { count: String(rest.length) }) + " \xB7 " + usd(restValue, locale)
        }
      ) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.compLegend, children: [
      top.map((row) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.compItem, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { className: AnalyticsDialog_default.compDot, style: { background: colorFor(row.model) } }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.compText, children: [
          row.name ?? row.model,
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("b", { children: [
            usd(row.estimatedMicroUsd, locale),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("em", { children: [
              (row.estimatedMicroUsd / total * 100).toFixed(1),
              "%"
            ] })
          ] })
        ] })
      ] }, row.model)),
      rest.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.compItem, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { className: AnalyticsDialog_default.compDot, style: { background: "var(--go-muted)" } }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.compText, children: [
          fill(t("analyticsCompositionOther"), { count: String(rest.length) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("b", { children: [
            usd(restValue, locale),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("em", { children: [
              (restValue / total * 100).toFixed(1),
              "%"
            ] })
          ] })
        ] })
      ] }) : null
    ] }),
    unpriced.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: AnalyticsDialog_default.compNote, children: [
      t("analyticsCompositionFree"),
      " ",
      unpricedNames.join(" \xB7 "),
      unpriced.length > unpricedNames.length ? " +" + (unpriced.length - unpricedNames.length) : ""
    ] }) : null
  ] });
}
function ModelTable({ report, locale, t, colorFor }) {
  if (report.byModel.length === 0) return null;
  const total = report.totals.estimatedMicroUsd;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: AnalyticsDialog_default.sec, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.secHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("analyticsByModel") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.secHint, children: number(report.byModel.length, locale) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { className: AnalyticsDialog_default.table, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("analyticsModel") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("analyticsRequests") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("analyticsInput") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("analyticsOutput") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("analyticsCacheRead") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("analyticsCost") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: t("analyticsShare") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: report.byModel.map((row) => {
        const share = total === 0 ? 0 : row.estimatedMicroUsd / total * 100;
        const unpriced = row.pricedRequests === 0 && row.unpricedRequests > 0;
        const missing = row.pricedRequests === 0 && row.unpricedRequests === 0 && row.requests > 0;
        const noAmount = unpriced || missing;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.nameCell, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { className: AnalyticsDialog_default.mDot, style: { background: colorFor(row.model) } }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { className: AnalyticsDialog_default.mName, children: row.name ?? row.model })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: number(row.requests, locale) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: AnalyticsDialog_default.dim, children: compact(row.inputTokens, locale) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: AnalyticsDialog_default.dim, children: compact(row.outputTokens, locale) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: AnalyticsDialog_default.dim, children: compact(row.cacheReadTokens, locale) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: AnalyticsDialog_default.spend, children: unpriced ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.tag, children: t("analyticsUnpriced") }) : missing ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.dim, children: "\u2014" }) : usd(row.estimatedMicroUsd, locale) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.shareCell, children: noAmount ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.dim, children: "\u2014" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.shareBar, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", { style: { width: share + "%" } }) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: AnalyticsDialog_default.shareValue, children: [
              share.toFixed(1),
              "%"
            ] })
          ] }) }) })
        ] }, row.model);
      }) })
    ] })
  ] });
}
function DaySection({ report, mode, onMode, locale, t }) {
  const series = report.byDay.length === 0 ? [] : denseDays(report);
  const days = series.length === 0 ? report.byDay : series;
  const [hover, setHover] = (0, import_react4.useState)(null);
  const wrapRef = (0, import_react4.useRef)(null);
  const heatRef = (0, import_react4.useRef)(null);
  if (days.length === 0) return null;
  const valueOf = (day) => mode === "spend" ? day.estimatedMicroUsd : day.tokens;
  const format = (value) => mode === "spend" ? usd(value, locale) : compact(value, locale);
  const values = days.map(valueOf);
  const max = Math.max(0, ...values);
  const top = niceTop(max);
  const total = values.reduce((sum, value) => sum + value, 0);
  const spanDays = Math.max(1, Math.ceil((report.range.to - report.range.from) / 864e5));
  const average = total / spanDays;
  const peakIndex = values.indexOf(max);
  const width = 560;
  const height = 132;
  const padLeft = 50;
  const padRight = 4;
  const axisY = 106;
  const xOf = (index) => days.length === 1 ? padLeft + (width - padLeft - padRight) / 2 : padLeft + index / (days.length - 1) * (width - padLeft - padRight);
  const yOf = (value) => axisY - (top === 0 ? 0 : value / top) * (axisY - 12);
  const showHover = (index, event) => {
    const box = wrapRef.current?.getBoundingClientRect();
    const wrapWidth = box === void 0 ? 0 : box.width;
    const x = box === void 0 ? 0 : event.clientX - box.left;
    const y = box === void 0 ? 0 : event.clientY - box.top;
    const below = y < 92;
    setHover({
      index,
      left: Math.min(Math.max(x + 12, 8), Math.max(wrapWidth - 190, 8)),
      top: below ? y + 18 : y - 12,
      below
    });
  };
  const showHeatHover = (event) => {
    const heat = heatRef.current;
    if (heat === null) {
      setHover(null);
      return;
    }
    const boxes = Array.from(heat.querySelectorAll("[data-day]"), (cell) => cell.getBoundingClientRect());
    const index = nearestIndexWithin(boxes, event.clientX, event.clientY, HEAT_HOVER_SLOP);
    if (index === null) setHover(null);
    else showHover(index, event);
  };
  const line = days.map((day, index) => (index === 0 ? "M" : "L") + xOf(index).toFixed(1) + " " + yOf(valueOf(day)).toFixed(1)).join(" ");
  const area = days.length > 1 ? line + " L" + xOf(days.length - 1).toFixed(1) + " " + axisY + " L" + xOf(0).toFixed(1) + " " + axisY + " Z" : "";
  const heatHeads = weekdayHeads(locale);
  const offset = dayOfWeek(days[0].day);
  const headCell = heatHeads.map((head, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.heatDay, children: head }, "h" + index));
  const pads = Array.from({ length: offset }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: AnalyticsDialog_default.heatPad }, "p" + index));
  const cells = days.map((day, index) => {
    const ratio = max === 0 ? 0 : valueOf(day) / max;
    const lightness = Math.round(12 + ratio * 88);
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "span",
      {
        className: AnalyticsDialog_default.heatCell,
        "data-day": day.day,
        "data-active": hover?.index === index ? "" : void 0,
        role: "img",
        "aria-label": day.day + " \xB7 " + usd(day.estimatedMicroUsd, locale) + " \xB7 " + compact(day.tokens, locale) + " tokens",
        style: { background: "color-mix(in srgb, var(--go-accent) " + lightness + "%, var(--go-surface-2))" }
      },
      day.day
    );
  });
  const labels = [0, 0.5, 1].map((ratio) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("text", { x: padLeft - 8, y: yOf(top * ratio) + 3, textAnchor: "end", children: format(ratio === 0 ? 0 : Math.round(top * ratio)) }, ratio));
  const xLabels = days.map((day, index) => {
    if (!(index === 0 || index === days.length - 1 || index % 6 === 0)) return null;
    const anchor = index === 0 ? "start" : index === days.length - 1 ? "end" : "middle";
    const x = index === 0 ? padLeft : index === days.length - 1 ? width - padRight : xOf(index);
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("text", { x, y: height - 4, textAnchor: anchor, children: day.day.slice(5).replace("-", "/") }, day.day);
  });
  const hovered = hover === null ? void 0 : days[hover.index];
  const hitWidth = Math.max((width - padLeft - padRight) / Math.max(days.length, 1), 6);
  const hitRects = days.map((day, index) => {
    const x = Math.min(Math.max(xOf(index) - hitWidth / 2, padLeft), width - padRight - hitWidth);
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "rect",
      {
        "data-day": day.day,
        className: AnalyticsDialog_default.trendHit,
        x,
        y: 8,
        width: hitWidth,
        height: axisY - 8,
        onMouseMove: (event) => showHover(index, event)
      },
      "hit-" + day.day
    );
  });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: AnalyticsDialog_default.sec, style: { borderBottom: "0", paddingBottom: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.secHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("analyticsByDay") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.seg, role: "group", "aria-label": t("analyticsByDay"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", "aria-pressed": mode === "spend", onClick: () => onMode("spend"), children: t("analyticsChartSpend") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", "aria-pressed": mode === "tokens", onClick: () => onMode("tokens"), children: t("analyticsChartTokens") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.daysWrap, ref: wrapRef, onMouseLeave: () => setHover(null), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          className: AnalyticsDialog_default.heat,
          role: "group",
          "aria-label": t("analyticsByDay"),
          ref: heatRef,
          onMouseMove: showHeatHover,
          onMouseLeave: () => setHover(null),
          children: [
            headCell,
            pads,
            cells
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.trend, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "svg",
          {
            className: AnalyticsDialog_default.trendSvg,
            viewBox: "0 0 " + width + " " + height,
            role: "img",
            "aria-label": t("analyticsByDay"),
            onMouseMove: (event) => {
              if (event.target.closest("[data-day]") === null) setHover(null);
            },
            onMouseLeave: () => setHover(null),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("linearGradient", { id: TREND_FILL_ID, x1: "0", y1: "0", x2: "0", y2: "1", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "0", stopColor: "var(--go-accent)", stopOpacity: "0.26" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("stop", { offset: "1", stopColor: "var(--go-accent)", stopOpacity: "0" })
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("line", { className: AnalyticsDialog_default.trendGrid, x1: padLeft, x2: width - padRight, y1: yOf(top * 0.5), y2: yOf(top * 0.5) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("line", { className: AnalyticsDialog_default.trendBase, x1: padLeft, x2: width - padRight, y1: axisY, y2: axisY }),
              labels,
              hover !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("line", { className: AnalyticsDialog_default.trendGuide, x1: xOf(hover.index), x2: xOf(hover.index), y1: 8, y2: axisY }) : null,
              area !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { className: AnalyticsDialog_default.trendArea, d: area, style: { fill: "url(#" + TREND_FILL_ID + ")" } }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { className: AnalyticsDialog_default.trendLine, d: line }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { className: AnalyticsDialog_default.trendPeak, cx: xOf(peakIndex), cy: yOf(max), r: "3" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("text", { x: xOf(peakIndex), y: yOf(max) - 8, textAnchor: "middle", style: { fill: "var(--go-text)", fontWeight: 600 }, children: format(max) }),
              hover !== null && hovered !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { className: AnalyticsDialog_default.trendFocus, cx: xOf(hover.index), cy: yOf(valueOf(hovered)), r: "3.2" }) : null,
              xLabels,
              hitRects
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.trendFoot, children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
            t("analyticsPeak"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: days[peakIndex].day.slice(5).replace("-", "/") }),
            " \xB7 ",
            format(max),
            " \xB7 ",
            number(days[peakIndex].requests, locale),
            " ",
            t("analyticsRequests")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
            t("analyticsTotal"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: format(total) }),
            " \xB7 ",
            t("analyticsDailyAverage"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: format(Math.round(average)) })
          ] })
        ] })
      ] }),
      hover !== null && hovered !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "div",
        {
          className: AnalyticsDialog_default.dayTip,
          role: "tooltip",
          style: { left: hover.left, top: hover.top, transform: hover.below ? "none" : "translateY(-100%)" },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.dayTipHead, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("b", { children: hovered.day.slice(5).replace("-", "/") }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: weekdayLabel(hovered.day, locale) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: AnalyticsDialog_default.dayTipValue, children: usd(hovered.estimatedMicroUsd, locale) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.dayTipMeta, children: [
              number(hovered.requests, locale),
              " ",
              t("analyticsRequests"),
              " \xB7 ",
              compact(hovered.tokens, locale),
              " ",
              t("analyticsTokens")
            ] })
          ]
        }
      ) : null
    ] })
  ] });
}
function Footer({ report, locale, t, maxSessions, loading, onScanMore }) {
  const coverage = report.coverage;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("footer", { className: AnalyticsDialog_default.foot, children: [
    coverage.truncated ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.notice, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("analyticsTruncated") }),
      maxSessions < MAX_SESSIONS_CEILING ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: AnalyticsDialog_default.action, disabled: loading, onClick: onScanMore, children: t("analyticsScanMore") }) : null
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.footCol, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
        t("analyticsPriceSource"),
        " models.dev",
        report.pricing.updatedAt === void 0 ? "" : " \xB7 " + new Date(report.pricing.updatedAt).toLocaleString(locale)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("analyticsNotInvoice") }),
      report.pricing.unavailable === true ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("analyticsPricingUnavailable") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: AnalyticsDialog_default.footCol, children: [
      coverage.listMs !== void 0 && coverage.pricingMs !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
        t("analyticsScanSegments"),
        " ",
        number(coverage.listMs, locale),
        " / ",
        number(coverage.scanMs, locale),
        " / ",
        number(coverage.pricingMs, locale),
        " ms"
      ] }) : null,
      coverage.legacyRequests > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
        t("analyticsLegacy"),
        " ",
        number(coverage.legacyRequests, locale)
      ] }) : null,
      coverage.unattributedRequests !== void 0 && coverage.unattributedRequests > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
        t("analyticsUnattributed"),
        " ",
        number(coverage.unattributedRequests, locale)
      ] }) : null,
      coverage.unreadSessions !== void 0 && coverage.unreadSessions > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
        t("analyticsUnread"),
        " ",
        number(coverage.unreadSessions, locale)
      ] }) : null
    ] })
  ] });
}

// plugin-css:src/client/ThemePicker.module.css
var id3 = "dsh-opencode-go/ThemePicker.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id3) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id3;
  style.textContent = ".S1w_sG_group{flex-wrap:wrap;gap:8px;display:flex}.S1w_sG_option{width:76px;font:inherit;cursor:pointer;background:0 0;border:1px solid #0000;border-radius:10px;flex-direction:column;align-items:center;gap:6px;padding:6px 6px 5px;display:flex}.S1w_sG_option:hover{background:color-mix(in srgb, var(--dsw-alias-bg-layer-3) 80%, transparent)}.S1w_sG_option[aria-pressed=true]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-bg-layer-3) 55%, transparent)}.S1w_sG_option:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.S1w_sG_swatch{box-sizing:border-box;border:1px solid;border-radius:6px;flex-direction:column;justify-content:center;gap:3px;width:100%;height:38px;padding:0 7px;display:flex;overflow:hidden}.S1w_sG_swatchRow{align-items:center;gap:4px;display:flex}.S1w_sG_swatchDot{border-radius:2px;flex:none;width:6px;height:6px}.S1w_sG_swatchBar{border-radius:2px;width:100%;height:3px;display:block}.S1w_sG_name{text-overflow:ellipsis;white-space:nowrap;max-width:100%;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.4;overflow:hidden}.S1w_sG_option[aria-pressed=true] .S1w_sG_name{color:var(--dsw-alias-label-primary);font-weight:600}";
  document.head.appendChild(style);
}
var ThemePicker_default = { "group": "S1w_sG_group", "name": "S1w_sG_name", "option": "S1w_sG_option", "swatch": "S1w_sG_swatch", "swatchBar": "S1w_sG_swatchBar", "swatchDot": "S1w_sG_swatchDot", "swatchRow": "S1w_sG_swatchRow" };

// src/client/ThemePicker.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function ThemePicker({ t }) {
  const active = useGoTheme();
  const scheme = useHostScheme();
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: ThemePicker_default.group, role: "group", "aria-label": t("themeLabel"), children: GO_THEMES.map((id5) => {
    const tokens = GO_THEME_TOKENS[id5][scheme];
    const name = t(GO_THEME_LABELS[id5]);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        className: ThemePicker_default.option,
        "aria-pressed": active === id5,
        "data-theme": id5,
        title: name,
        onClick: () => {
          setGoTheme(id5);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "span",
            {
              className: ThemePicker_default.swatch,
              "aria-hidden": "true",
              style: { background: tokens.surface, borderColor: tokens.border },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: ThemePicker_default.swatchRow, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: ThemePicker_default.swatchDot, style: { background: tokens.accent } }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: ThemePicker_default.swatchBar, style: { background: tokens.accent, opacity: 0.5, width: "18px" } })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: ThemePicker_default.swatchBar, style: { background: tokens.muted, opacity: 0.5 } }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: ThemePicker_default.swatchBar, style: { background: tokens.muted, opacity: 0.28, width: "62%" } })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: ThemePicker_default.name, children: name })
        ]
      },
      id5
    );
  }) });
}

// src/usage-display.ts
var USAGE_DISPLAY_MODES = ["auto", "always", "off"];
var DEFAULT_USAGE_DISPLAY = "auto";

// src/client/Section.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var ChevronDown2 = hostAtom(
  primitives3,
  "IconChevronDownOutlineRegular",
  "IconChevronDownOutline14"
) ?? primitives3.IconChevronDownOutline14;
var ADVANCED_FIELDS = [
  "usageDisplay",
  "protocolOverrides",
  "baseURL",
  "proxyURL",
  "refreshMinutes",
  "streamIdleTimeoutMs",
  "maxImages",
  "maxRequestImageBytes",
  "requestImagePixelBudget",
  "requestImageMaxBytes"
];
function ValueField(props) {
  const hintId = props.id + "-hint";
  const errorId = props.id + "-error";
  const labelId = props.id + "-label";
  const options = props.options;
  const selected = options ? options.findIndex((option) => option.value === props.field.text) : -1;
  const describedBy = props.field.invalid ? `${errorId} ${hintId}` : hintId;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.rowLabel, children: [
      options ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { id: labelId, className: Section_default.rowTitle, children: props.label }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { htmlFor: props.id, className: Section_default.rowTitle, children: props.label }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HintMark, { hint: props.hint })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.rowControl, children: options ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
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
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.segThumb, "aria-hidden": "true" }),
          options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
    ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
        ...props.field.invalid ? { "aria-invalid": true } : {},
        value: props.field.text,
        disabled: props.disabled,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HintText, { id: hintId, hint: props.hint }),
    props.field.invalid ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { id: errorId, className: Section_default.rowInvalid, role: "alert", children: props.invalidLabel }) : null
  ] });
}
function ModelsBody({ models, t, locale }) {
  const sources = models.status === "ready" || models.status === "failed" ? models.sources : void 0;
  const metadataOnlyFailure = sources?.metadata.error !== void 0 && sources.listing.error === void 0;
  const sourceStatus = sources ? ["listing", "metadata"].map((source) => {
    const status = sources[source];
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: Section_default.hint, children: [
      t(source === "listing" ? "modelsListingSource" : "modelsMetadataSource"),
      ": ",
      " ",
      status.error ? t("modelsSourceFailed") : t("modelsSourceCurrent"),
      ". ",
      " ",
      status.updatedAt === void 0 ? t("modelsSourceNeverFetched") : t("modelsSourceUpdated", { time: new Date(status.updatedAt).toLocaleString(locale) }),
      status.warning ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        " ",
        status.warning
      ] }) : null
    ] }, source);
  }) : null;
  if (models.status === "failed") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t(metadataOnlyFailure ? "modelsMetadataFailed" : "modelsFailed") }),
      models.message ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, children: models.message }) : null,
      sourceStatus
    ] });
  }
  if (models.status !== "ready") return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, role: "status", "aria-live": "polite", children: t("modelsLoading") });
  const progress = models.refreshing ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, role: "status", children: t("modelsRefreshing") }) : null;
  if (models.stale) return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    progress,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t(metadataOnlyFailure ? "modelsMetadataFailed" : "modelsStale") }),
    models.message ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, children: models.message }) : null,
    sourceStatus
  ] });
  const warning = sources?.listing.warning ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.failedNote, role: "alert", children: sources.listing.warning }) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    progress,
    warning,
    models.count === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, children: t("modelsEmpty") }) : null
  ] });
}
function OpencodeGoSection(props) {
  const { useOpencodeGo, edit, resetField, save, discard, loadModels, setEnabled, setModelEnabled, t } = props;
  if (useOpencodeGo === void 0 || edit === void 0 || resetField === void 0 || save === void 0 || discard === void 0 || loadModels === void 0 || setEnabled === void 0 || setModelEnabled === void 0 || t === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
      readAnalytics: props.readAnalytics,
      readQuota: props.readQuota,
      getLocale: props.getLocale,
      accountActions: props.loadAccounts && props.addAccount && props.renameAccount && props.removeAccount && props.selectAccount && props.setAutoSwitch && props.replaceAccountKey && props.moveAccount ? {
        loadAccounts: props.loadAccounts,
        addAccount: props.addAccount,
        renameAccount: props.renameAccount,
        resetAddition: props.resetAddition,
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
  const [advanced, setAdvanced] = (0, import_react5.useState)(false);
  const [modelsOpen, setModelsOpen] = (0, import_react5.useState)(false);
  const [analyticsOpen, setAnalyticsOpen] = (0, import_react5.useState)(false);
  const [analyticsPanel, setAnalyticsPanel] = (0, import_react5.useState)(false);
  const theme = useGoTheme();
  const modelNotices = /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ModelsBody, { models: state.models, t, locale: props.locale }),
    state.pickerFailed ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.failedNote, role: "alert", children: t("pickerFailed") }) : null
  ] });
  (0, import_react5.useEffect)(() => {
    if (state.available && state.models.status === "idle") loadModels();
  }, [state.available, state.models.status, loadModels]);
  if (!state.available) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.intro, children: t("unavailable") });
  }
  const disabled = !state.writable;
  const enabledHint = state.enabled ? t("enabledHint") : t("enabledOff");
  const accountCard = state.accounts && props.accountActions ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    AccountsCard,
    {
      state: state.accounts,
      actions: props.accountActions,
      writable: state.writable,
      t,
      locale: props.locale
    }
  ) : null;
  const fieldProps = {
    invalidLabel: t("invalidValue"),
    disabled
  };
  const advancedOverridden = ADVANCED_FIELDS.some((field) => state[field].overridden);
  const canResetAdvanced = ADVANCED_FIELDS.some((field) => state[field].overridden || state[field].invalid);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.page, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.pageBody, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.pageTop, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { className: Section_default.title, children: t("titleLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.intro, children: t("intro") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: Section_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.cardHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("h3", { className: Section_default.cardTitle, children: [
            t("enabledLabel"),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(HintMark, { hint: enabledHint })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            import_dsh_client_ui_primitives4.Switch,
            {
              checked: state.enabled,
              label: t("enabledLabel"),
              title: enabledHint,
              disabled: disabled || state.saving || state.pickerSaving,
              onChange: props.setEnabled
            }
          )
        ] }),
        accountCard ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.cardDivider }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.cardHead, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.slot, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("svg", { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", focusable: "false", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("circle", { cx: "5.4", cy: "8", r: "3.1" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M8.5 8h5.3M11.9 8v2.2M10.2 8v1.6" })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { className: Section_default.label, htmlFor: "opencode-go-key", children: t("keyLabel") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.trailing, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.Tag, { tone: state.apiKeyConfigured ? "success" : "warning", children: state.apiKeyConfigured ? t("keyConfigured") : t("keyMissing") }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.cardBody, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { id: "opencode-go-key-hint", className: Section_default.hint, children: state.apiKeyWritable ? t("keyHint") : t("keyNotWritable") })
          ] })
        ] })
      ] }),
      accountCard,
      props.readAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: Section_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "button",
          {
            type: "button",
            className: Section_default.cardTrigger,
            "aria-expanded": analyticsPanel,
            "aria-controls": "opencode-go-analytics",
            onClick: () => {
              setAnalyticsPanel(!analyticsPanel);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.cardTitle, children: t("analyticsCardTitle") }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.cardSub, children: t(GO_THEME_LABELS[theme]) }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ChevronDown2, { className: analyticsPanel ? Section_default.chevronOpen : Section_default.chevron })
            ]
          }
        ),
        analyticsPanel ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { id: "opencode-go-analytics", className: Section_default.analyticsPanel, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.analyticsSection, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.analyticsCopy, children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.analyticsLabel, children: t("analyticsBoardLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, children: t("analyticsCardHint") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", size: "md", onClick: () => {
              setAnalyticsOpen(true);
            }, children: t("analyticsOpenBoard") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.analyticsDivider }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.analyticsSection, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.analyticsCopy, children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.analyticsLabel, children: t("themeLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, children: t("themeHint") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ThemePicker, { t })
          ] })
        ] }) : null
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: modelsOpen ? Section_default.cardModels : Section_default.cardModels + " " + Section_default.cardFolded, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.cardTitle, children: t("modelsLabel") }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ChevronDown2, { className: modelsOpen ? Section_default.chevronOpen : Section_default.chevron })
            ]
          }
        ),
        modelsOpen ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { id: "opencode-go-models", className: Section_default.cardBody, children: [
          modelNotices,
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            ModelEditor,
            {
              models: state.models,
              draft: state.modelLimitDraft,
              t,
              locale: props.locale,
              disabled: disabled || state.saving,
              modelVisibility: state.modelVisibility,
              visibilitySaving: state.pickerSaving,
              filterAction: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                import_dsh_client_ui_primitives4.Button,
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
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.cardNotes, children: modelNotices })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: Section_default.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: Section_default.cardTitle, children: t("advancedLabel") }),
              advancedOverridden ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.Tag, { tone: "neutral", children: t("overridden") }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ChevronDown2, { className: advanced ? Section_default.chevronOpen : Section_default.chevron })
            ]
          }
        ),
        advanced ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { id: "opencode-go-advanced", className: Section_default.cardBody, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.advancedHead, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, children: t("advancedHint") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              "button",
              {
                type: "button",
                className: Section_default.reset,
                disabled: disabled || !canResetAdvanced,
                onClick: () => {
                  for (const field of ADVANCED_FIELDS) {
                    if (state[field].overridden || state[field].invalid) props.resetField(field);
                  }
                },
                children: t("advancedResetAll")
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.rows, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.groupHead, children: t("groupUsageProtocol") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              ValueField,
              {
                id: "opencode-go-protocol-overrides",
                label: t("protocolOverridesLabel"),
                hint: t("protocolOverridesHint"),
                field: state.protocolOverrides,
                options: [
                  { value: "auto", label: t("protocolOverridesAuto") },
                  { value: "openai-responses", label: t("protocolOverridesResponses") }
                ],
                ...fieldProps,
                onEdit: (text2) => {
                  props.edit("protocolOverrides", text2);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.groupHead, children: t("groupConnection") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.groupHead, children: t("groupCacheTimeouts") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              ValueField,
              {
                id: "opencode-go-refresh-minutes",
                label: t("refreshMinutesLabel"),
                hint: t("refreshMinutesHint"),
                field: state.refreshMinutes,
                numeric: true,
                ...fieldProps,
                onEdit: (text2) => {
                  props.edit("refreshMinutes", text2);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              ValueField,
              {
                id: "opencode-go-stream-idle",
                label: t("streamIdleTimeoutMsLabel"),
                hint: t("streamIdleTimeoutMsHint"),
                field: state.streamIdleTimeoutMs,
                numeric: true,
                ...fieldProps,
                onEdit: (text2) => {
                  props.edit("streamIdleTimeoutMs", text2);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: Section_default.groupHead, children: t("groupImages") }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              ValueField,
              {
                id: "opencode-go-max-images",
                label: t("maxImagesLabel"),
                hint: t("maxImagesHint"),
                field: state.maxImages,
                numeric: true,
                ...fieldProps,
                onEdit: (text2) => {
                  props.edit("maxImages", text2);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              ValueField,
              {
                id: "opencode-go-max-request-image-bytes",
                label: t("maxRequestImageBytesLabel"),
                hint: t("maxRequestImageBytesHint"),
                field: state.maxRequestImageBytes,
                numeric: true,
                ...fieldProps,
                onEdit: (text2) => {
                  props.edit("maxRequestImageBytes", text2);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              ValueField,
              {
                id: "opencode-go-image-pixel-budget",
                label: t("requestImagePixelBudgetLabel"),
                hint: t("requestImagePixelBudgetHint"),
                field: state.requestImagePixelBudget,
                numeric: true,
                ...fieldProps,
                onEdit: (text2) => {
                  props.edit("requestImagePixelBudget", text2);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
              ValueField,
              {
                id: "opencode-go-image-max-bytes",
                label: t("requestImageMaxBytesLabel"),
                hint: t("requestImageMaxBytesHint"),
                field: state.requestImageMaxBytes,
                numeric: true,
                ...fieldProps,
                onEdit: (text2) => {
                  props.edit("requestImageMaxBytes", text2);
                }
              }
            )
          ] })
        ] }) : null
      ] }),
      disabled ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.hint, children: t("readOnly") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: Section_default.actions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "primary", size: "md", disabled: disabled || !state.dirty || state.invalid || state.saving || state.pickerSaving, onClick: props.save, children: state.saving ? t("saving") : t("save") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", size: "md", disabled: disabled || !state.dirty || state.saving, onClick: props.discard, children: t("discard") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
        "a",
        {
          className: Section_default.starLink,
          href: "https://github.com/Duskriver/dsh-opencode-go",
          target: "_blank",
          rel: "noopener noreferrer",
          title: t("starProjectTitle"),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("path", { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t("starProject") })
          ]
        }
      ),
      state.failed ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: Section_default.failedNote, children: t("savedFailed") }) : null
    ] }),
    props.readAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      AnalyticsDialog,
      {
        open: analyticsOpen,
        onClose: () => {
          setAnalyticsOpen(false);
        },
        readAnalytics: props.readAnalytics,
        readQuota: props.readQuota && state.accounts ? () => props.readQuota(state.accounts.activeRef) : void 0,
        t,
        getLocale: props.getLocale
      }
    ) : null
  ] });
}

// src/provider-identity.ts
var PROVIDER_ID = "dsh-opencode-go";

// src/config-contract.ts
var SETTINGS_NAMESPACE = "llm-opencode-go";
var PROFILE_ENTRY_ID = "opencode-go";

// src/settings-bridge.ts
function settingsWriteResult(verdict, committed, confirmation = "acknowledged") {
  if (verdict === true && confirmation === "acknowledged") return "applied";
  if (verdict === false) return "rejected";
  return committed() ? "applied" : "unknown";
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

// src/protocol-contract.ts
var RESPONSES_OVERRIDE_MODEL = "deepseek-v4.1-flash";

// src/account-operations.ts
function visibleAccountsOf(settings) {
  const entries = [...accountsOf(settings)];
  for (const operation of settings.accountOperations ?? []) {
    if (!entries.some((account) => account.apiKeyEnv === operation.account.apiKeyEnv)) entries.push(operation.account);
  }
  return entries;
}

// src/client/accounts-controller.ts
function operationId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
var GoAccountsController = class {
  constructor(scope, ctx, readUsage, publish, blocked, execute = async (command) => {
    const response = await ctx.remote.opencodeGoAccounts.execute(command);
    return response.ok ? response.value : "unknown";
  }) {
    this.scope = scope;
    this.ctx = ctx;
    this.readUsage = readUsage;
    this.publish = publish;
    this.blocked = blocked;
    this.execute = execute;
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
  addition;
  snapshot() {
    const config = this.scope.getSnapshot().value ?? {};
    return {
      entries: visibleAccountsOf(config).map((account) => ({ ...this.rows.get(account.apiKeyEnv), ...account })),
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
      visibleAccountsOf(config).map((account) => [account.id, account.apiKeyEnv]).sort((left, right) => left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0),
      config.baseURL,
      config.proxyURL
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
    if (!visibleAccountsOf(this.scope.getSnapshot().value ?? {}).some((account) => account.apiKeyEnv === ref)) return;
    this.epoch++;
    this.rows.delete(ref);
    if (this.loaded) void this.refresh();
  }
  async refresh() {
    this.loaded = true;
    const epoch = ++this.epoch;
    const accounts = [...visibleAccountsOf(this.scope.getSnapshot().value ?? {})];
    this.refreshing = true;
    this.publish();
    try {
      const described = await this.ctx.remote.credentials.describe(accounts.map((account) => account.apiKeyEnv));
      if (this.disposed || epoch !== this.epoch) return;
      if (!described.ok) {
        this.failure = "read";
        this.markUnreadable(accounts, described.error instanceof Error ? described.error.message : String(described.error));
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
          const message = error instanceof Error ? error.message : String(error);
          this.rows.set(ref, {
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
      if (epoch === this.epoch) {
        this.failure = "read";
        this.markUnreadable(accounts, error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (!this.disposed && epoch === this.epoch) {
        this.refreshing = false;
        this.publish();
      }
    }
  }
  /** Mark every account row as unreadable with the Host's own diagnostic. */
  markUnreadable(accounts, message) {
    const problem = message.length > 200 ? message.slice(0, 200) + "\u2026" : message;
    for (const account of accounts) this.rows.set(account.apiKeyEnv, { ...account, failed: true, problem });
    this.publish();
  }
  actions() {
    const command = (request) => this.execute(request).then((status) => status === "applied");
    return {
      loadAccounts: () => {
        void this.refresh();
      },
      resetAddition: () => {
        this.addition = void 0;
      },
      addAccount: (name, key) => this.run(async () => {
        if (!name.trim() || name.trim().length > 80 || !key.trim()) return false;
        if (this.addition?.name !== name.trim()) this.addition = { name: name.trim(), id: operationId() };
        const accepted = await command({ kind: "add", id: this.addition.id, name, key });
        if (accepted) this.addition = void 0;
        return accepted;
      }),
      renameAccount: (ref, name) => this.run(() => command({ kind: "rename", ref, name })),
      removeAccount: (ref) => this.run(async () => {
        const accepted = await command({ kind: "remove", ref });
        if (!accepted) this.failure = "remove";
        return accepted;
      }),
      selectAccount: (ref) => this.run(() => command({ kind: "select", ref })),
      setAutoSwitch: (value) => this.run(() => command({ kind: "auto-switch", value })),
      replaceAccountKey: (ref, key) => this.run(async () => {
        if (!key.trim() || this.rows.get(ref)?.writable === false) return false;
        const accepted = await command({ kind: "replace-key", ref, key });
        if (accepted) this.invalidate(ref);
        return accepted;
      }, false),
      moveAccount: (ref, toIndex) => this.run(() => command({ kind: "move", ref, toIndex }))
    };
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
    parse: (text2) => {
      const trimmed = text2.trim();
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
    parse: (text2) => {
      if (text2 === "true") return { kind: "set", value: true };
      if (text2 === "false") return { kind: "set", value: false };
      return void 0;
    }
  };
}
function textField(field) {
  return {
    field,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text2) => {
      const trimmed = text2.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
function jsonField(field) {
  return {
    field,
    format: (value) => value === void 0 || value === null ? "" : JSON.stringify(value, void 0, 2),
    parse: (text2) => {
      const trimmed = text2.trim();
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
      invalid: plan.some((item) => item.run === void 0 && item.write === void 0),
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
      edit: (field, text2) => {
        this.stage(field, { text: text2, clear: false });
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
    if (plan.length === 0 || this.saving || plan.some((item) => !item.write && !item.run)) return;
    const revision = this.snapshotOf().revision;
    this.saving = true;
    this.failed = false;
    this.publish();
    let landed = true;
    const settings = plan.filter((item) => item.write !== void 0);
    const accept = (item) => {
      if (this.staged.get(item.field) === item.edit) this.staged.delete(item.field);
    };
    if (settings.length > 0) {
      const ops = settings.map(({ field, write }) => write.kind === "clear" ? { op: "unset", path: [field] } : { op: "set", path: [field], value: write.value });
      try {
        const accepted = await this.scope.mutate(ops, revision);
        landed = settingsWriteResult(accepted, () => settings.every((item) => item.write.kind === "clear" ? !this.stored(item.field) : sameJsonValue(this.userLayer()?.[item.field], item.write.value))) === "applied";
        if (landed) settings.forEach(accept);
      } catch {
        landed = false;
      }
    }
    if (landed) for (const item of plan.filter((item2) => item2.run !== void 0)) {
      try {
        if (await item.run()) accept(item);
        else landed = false;
      } catch {
        landed = false;
      }
    }
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
        if (value !== "") plan.push({ field, edit: staged, run: () => secret.write(value) });
        continue;
      }
      const spec = this.spec(field);
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, edit: staged, write: { kind: "clear" }, run: void 0 });
        continue;
      }
      if (this.unchangedDraft(field, staged)) continue;
      const write = spec.parse(staged.text);
      plan.push({ field, edit: staged, write, run: void 0 });
    }
    return plan;
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
var OPENCODE_GO_NS = SETTINGS_NAMESPACE;
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
  }, executeAccountCommand = async (command) => {
    const result = await ctx.remote.opencodeGoAccounts.execute(command);
    return result.ok ? result.value : "unknown";
  }, readAnalytics = async () => {
    throw Object.assign(new Error("OpenCode Go analytics is unavailable in this session"), {
      code: "opencode-go/analytics-unavailable",
      details: { reason: "no-session-query", retryable: false }
    });
  }) {
    this.scope = scope;
    this.ctx = ctx;
    this.readModels = readModels;
    this.readUsage = readUsage;
    this.executeAccountCommand = executeAccountCommand;
    this.readAnalytics = readAnalytics;
    this.form = new StagedForm(
      scope,
      [
        // Present so the shared override/reset machinery tracks the field; the
        // page's switch writes it directly instead of staging it.
        booleanField("enabled"),
        {
          field: "usageDisplay",
          format: (value) => typeof value === "string" ? value : DEFAULT_USAGE_DISPLAY,
          parse: (text2) => USAGE_DISPLAY_MODES.some((mode) => mode === text2) ? { kind: "set", value: text2 } : void 0
        },
        {
          field: "protocolOverrides",
          format: (value) => value?.[RESPONSES_OVERRIDE_MODEL] ?? "auto",
          parse: (text2) => text2 === "auto" || text2 === "openai-responses" ? { kind: "set", value: { [RESPONSES_OVERRIDE_MODEL]: text2 === "auto" ? null : text2 } } : void 0
        },
        textField("baseURL"),
        {
          ...textField("proxyURL"),
          // Blank explicitly disables an inherited proxy; Reset removes the override.
          parse: (text2) => {
            try {
              assertProxyURL(text2);
              return { kind: "set", value: text2.trim() };
            } catch {
              return void 0;
            }
          }
        },
        numberField("refreshMinutes"),
        numberField("streamIdleTimeoutMs"),
        numberField("maxImages", (value) => Number.isSafeInteger(value) && value > 0),
        numberField("maxRequestImageBytes"),
        numberField("requestImagePixelBudget"),
        numberField("requestImageMaxBytes"),
        jsonField("modelLimits")
      ],
      [{ field: API_KEY_FIELD, write: (text2) => this.writeKey(text2) }]
    );
    this.store = this.form.bind(() => this.projection());
    this.accounts = new GoAccountsController(
      scope,
      ctx,
      readUsage,
      () => {
        this.store.set(this.projection());
      },
      () => this.form.shell().saving || this.pickerSaving || Boolean(this.form.field(API_KEY_FIELD).text.trim()),
      this.executeAccountCommand
    );
    this.store.set(this.projection());
    const networkIdentity = () => JSON.stringify([
      scope.getSnapshot().value?.baseURL,
      scope.getSnapshot().value?.proxyURL
    ]);
    let modelsEndpoint = networkIdentity();
    this.unsubscribe = scope.subscribe(() => {
      this.accounts?.sync();
      this.store.set(this.projection());
      const endpoint = networkIdentity();
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
      protocolOverrides: this.form.field("protocolOverrides"),
      modelVisibility: this.scope.getSnapshot().value?.modelVisibility ?? {},
      pickerSaving: this.pickerSaving,
      pickerFailed: this.pickerFailed,
      baseURL: this.form.field("baseURL"),
      proxyURL: this.form.field("proxyURL"),
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
  async setModelEnabled(id5, next) {
    if (this.models.status === "ready" && this.models.entries.some((model) => model.id === id5 && model.configurationMissing)) return;
    await this.writePickerSetting(
      "modelVisibility",
      { ...this.scope.getSnapshot().value?.modelVisibility, [id5]: next },
      () => this.scope.getSnapshot().value?.modelVisibility?.[id5] === next
    );
  }
  /** Serialize immediate switches with form saves; refused writes retain committed values. */
  async writePickerSetting(field, value, accepted) {
    if (this.pickerSaving || this.form.shell().saving || this.accounts?.snapshot().busy || !this.scope.getSnapshot().writable) return;
    this.pickerSaving = true;
    this.pickerFailed = false;
    this.store.set(this.projection());
    try {
      const verdict = await this.scope.set(field, value);
      this.pickerFailed = settingsWriteResult(verdict, accepted) !== "applied";
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
      readAnalytics: (query) => this.readAnalytics(query),
      readQuota: (ref) => this.readUsage(ref),
      setEnabled: (next) => {
        void this.setEnabled(next);
      },
      setModelEnabled: (id5, next) => {
        void this.setModelEnabled(id5, next);
      },
      ...this.form.actions(),
      ...this.accounts.actions(),
      edit: (field, text2) => {
        if (field === API_KEY_FIELD) {
          if (text2.trim()) this.keyDraftRef ??= refOf(this.scope.getSnapshot());
          else this.keyDraftRef = void 0;
        }
        this.form.actions().edit(field, text2);
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
   * Ask the account service to write the staged key, then refresh its display.
   * @param value - the staged credential literal.
   * @returns whether the Host confirmed the write.
   */
  async writeKey(value) {
    const ref = this.keyDraftRef ?? refOf(this.scope.getSnapshot());
    if (await this.executeAccountCommand({ kind: "replace-key", ref, key: value }) !== "applied") return false;
    this.accounts?.invalidate(ref);
    await this.readCredential();
    return true;
  }
};
function modelLimitsOf(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const limits = {};
  for (const [id5, entry] of Object.entries(value)) {
    if (entry === null) {
      limits[id5] = null;
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
    if (limit.contextWindow !== void 0 || limit.maxTokens !== void 0 || limit.thinkingBudgets !== void 0) limits[id5] = limit;
  }
  return limits;
}
function refOf(snapshot) {
  return accountRefOf(snapshot.value ?? {});
}

// src/client/locales.ts
var en = {
  accountsTitle: "Accounts",
  accountsRefresh: "Refresh accounts",
  accountsBlocked: "Save or discard the API key draft before changing accounts.",
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
  usageTitle: "OpenCode Go usage",
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
  usageRefreshing: "Refreshing\u2026",
  analyticsOpen: "Usage analytics",
  analyticsTitle: "Usage analytics",
  analyticsSubtitle: "This plugin\u2019s requests \xB7 includes closed sessions \xB7 estimates, not an invoice",
  analyticsClose: "Close usage analytics",
  analyticsRange: "Date range",
  analyticsRangeToday: "Today",
  analyticsRange7d: "7 days",
  analyticsRange30d: "30 days",
  analyticsRange90d: "90 days",
  analyticsRefresh: "Refresh",
  analyticsRetry: "Retry",
  analyticsLoading: "Scanning local sessions\u2026",
  analyticsEmpty: "No requests from this plugin in the selected range.",
  analyticsUnsupported: "This DSH version cannot read local session history.",
  analyticsFailed: "Could not read usage analytics.",
  analyticsRequests: "Requests",
  analyticsTokens: "Tokens",
  analyticsSpend: "Estimated spend",
  analyticsCoverage: "Coverage",
  analyticsSessions: "sessions",
  analyticsSeconds: "scan",
  analyticsSummaries: "summaries",
  analyticsUnsettled: "unsettled",
  analyticsByModel: "By model",
  analyticsByDay: "By day",
  analyticsInput: "in",
  analyticsOutput: "out",
  analyticsCacheRead: "cache",
  analyticsPriced: "priced",
  analyticsUnpriced: "unpriced",
  analyticsMissing: "missing usage",
  analyticsFailedSessions: "unreadable",
  analyticsUnattributed: "Unattributed activity:",
  analyticsUnread: "Sessions left unread at the budget or cap:",
  analyticsScanSegments: "Time spent in ms, list / scan / pricing:",
  analyticsStaleResults: "Showing the previous scan; the new one is running.",
  analyticsTruncated: "Only the most recent history was scanned.",
  analyticsScanMore: "Scan more history",
  analyticsPriceSource: "Prices:",
  analyticsNotInvoice: "Estimates are not an invoice; official percentages remain authoritative; spend applies current models.dev prices across all history.",
  analyticsPricingUnavailable: "prices unavailable",
  analyticsLegacy: "Includes pre-0.1.16 route requests:",
  analyticsCardTitle: "Usage analytics",
  analyticsCardHint: "Requests from this plugin, including closed sessions, with per-model cost estimates. Opening scans local sessions; nothing is uploaded.",
  analyticsBoardLabel: "Dashboard",
  analyticsOpenBoard: "Open dashboard",
  analyticsQuota: "Quota",
  analyticsQuotaHint: "Official percentages \xB7 refreshed every minute",
  analyticsQuotaFailed: "Quota is temporarily unavailable; usage statistics are still shown.",
  analyticsChartSpend: "Cost",
  analyticsChartTokens: "Tokens",
  analyticsKicker: "Usage report",
  analyticsLead: "In the selected range, this plugin made {requests} requests, used {tokens} tokens and an estimated {spend}.",
  analyticsLeadTop: "{model} accounts for {share} of that estimate.",
  analyticsComposition: "Spend composition",
  analyticsCompositionHint: "Estimated amount \xB7 priced models only",
  analyticsCompositionOther: "Other {count}",
  analyticsCompositionFree: "Also free or unpriced:",
  analyticsModel: "Model",
  analyticsCost: "Cost",
  analyticsShare: "Share",
  analyticsCacheHit: "cache hit",
  analyticsDailyAverage: "Daily avg",
  analyticsPeak: "Peak",
  analyticsTotal: "Total",
  themeLabel: "Theme",
  themeSilentBlack: "Silent Black",
  themeGraphite: "Graphite",
  themeSeaSalt: "Sea Salt",
  themeWarmSand: "Warm Sand",
  themeHint: "Applies to the pill and the dashboard only.",
  nav: "OpenCode Go",
  title: "OpenCode Go",
  titleLabel: "OpenCode Go",
  intro: "Choose the OpenCode Go models shown in conversations and adjust their capacities.",
  starProject: "Enjoying the plugin? Star it on GitHub",
  starProjectTitle: "Open the GitHub project in a new tab",
  enabledLabel: "Enable OpenCode Go",
  enabledHint: "While on, it appears in every model picker and can serve requests; turning it off withdraws it immediately and this page stays reachable.",
  enabledOff: "OpenCode Go is off: its models are withdrawn from every picker and no request reaches the gateway.",
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
  thinkingBudgets: "Thinking budgets",
  thinkingBudgetsHint: "Add token budgets to the conversation picker, then Save. Range: {min}\u2013{max} tokens. Existing reasoning choices stay available; Default uses the service settings. The SDK may reduce a budget to leave room for the answer.",
  thinkingBudgetAddLabel: "New thinking budget for {name}",
  thinkingBudgetAdd: "Add",
  thinkingBudgetRemove: "Remove {value} token budget",
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
  advancedResetAll: "Reset all to defaults",
  advancedLabel: "Advanced settings",
  groupUsageProtocol: "Usage and protocol",
  groupConnection: "Connection",
  groupCacheTimeouts: "Cache and timeouts",
  groupImages: "Image handling",
  advancedHint: "The inherited values work as they are; below are only the settings you may need to change.",
  usageDisplayLabel: "Usage display",
  usageDisplayHint: "Auto shows it only for DSH OpenCode Go models; Always keeps it visible with any model; Off hides it and stops polling. While visible it refreshes every minute.",
  usageDisplay_auto: "Auto (default)",
  usageDisplay_always: "Always",
  usageDisplay_off: "Off",
  protocolOverridesLabel: "DeepSeek V4.1 Flash protocol",
  protocolOverridesHint: "Auto follows the model catalog; Responses is experimental and applies only to DeepSeek V4.1 Flash. Save to apply to new requests.",
  protocolOverridesAuto: "Auto (default)",
  protocolOverridesResponses: "Responses (experimental)",
  baseURLLabel: "Gateway URL",
  baseURLHint: "The official Go gateway selects each model\u2019s protocol endpoint automatically. Custom gateways use the configured prefix.",
  proxyURLLabel: "Proxy address",
  proxyURLHint: "The HTTP(S) or SOCKS5 proxy for conversations, catalog refreshes and usage queries; leave empty for the default network.",
  proxyURLInvalid: "Enter an http://, https:// or socks5:// proxy address without a path, query or fragment.",
  refreshMinutesLabel: "Catalog refresh (minutes)",
  refreshMinutesHint: "How long the model catalog is cached; opening this page or refreshing re-checks it immediately.",
  streamIdleTimeoutMsLabel: "Stream idle timeout (ms)",
  streamIdleTimeoutMsHint: "The longest silence between stream events; a longer gap fails the request.",
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
  unavailable: "The OpenCode Go settings are not served in this deployment."
};
var zh = {
  accountsTitle: "\u8D26\u53F7",
  accountsRefresh: "\u5237\u65B0\u989D\u5EA6",
  accountsBlocked: "\u8BF7\u5148\u4FDD\u5B58\u6216\u653E\u5F03 API Key \u8349\u7A3F\uFF0C\u518D\u5207\u6362\u6216\u4FEE\u6539\u8D26\u53F7\u3002",
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
  usageTitle: "OpenCode Go \u7528\u91CF",
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
  usageRefreshing: "\u6B63\u5728\u5237\u65B0\u2026",
  analyticsOpen: "\u7528\u91CF\u7EDF\u8BA1",
  analyticsTitle: "\u7528\u91CF\u7EDF\u8BA1",
  analyticsSubtitle: "\u672C\u63D2\u4EF6\u8BF7\u6C42 \xB7 \u542B\u5DF2\u5173\u95ED\u4F1A\u8BDD \xB7 \u4F30\u7B97\u91D1\u989D\u975E\u8D26\u5355",
  analyticsClose: "\u5173\u95ED\u7528\u91CF\u7EDF\u8BA1",
  analyticsRange: "\u65F6\u95F4\u8303\u56F4",
  analyticsRangeToday: "\u4ECA\u5929",
  analyticsRange7d: "7 \u5929",
  analyticsRange30d: "30 \u5929",
  analyticsRange90d: "90 \u5929",
  analyticsRefresh: "\u5237\u65B0",
  analyticsRetry: "\u91CD\u8BD5",
  analyticsLoading: "\u6B63\u5728\u626B\u63CF\u672C\u5730\u4F1A\u8BDD\u2026",
  analyticsEmpty: "\u6240\u9009\u533A\u95F4\u5185\u6CA1\u6709\u672C\u63D2\u4EF6\u7684\u8BF7\u6C42\u3002",
  analyticsUnsupported: "\u5F53\u524D DSH \u7248\u672C\u65E0\u6CD5\u8BFB\u53D6\u672C\u5730\u4F1A\u8BDD\u5386\u53F2\u3002",
  analyticsFailed: "\u672A\u80FD\u8BFB\u53D6\u7528\u91CF\u7EDF\u8BA1\u3002",
  analyticsRequests: "\u8BF7\u6C42",
  analyticsTokens: "Token",
  analyticsSpend: "\u4F30\u7B97\u82B1\u8D39",
  analyticsCoverage: "\u8986\u76D6",
  analyticsSessions: "\u4E2A\u4F1A\u8BDD",
  analyticsSeconds: "\u626B\u63CF",
  analyticsSummaries: "\u538B\u7F29\u6458\u8981",
  analyticsUnsettled: "\u672A\u7ED3\u7B97",
  analyticsByModel: "\u6309\u6A21\u578B",
  analyticsByDay: "\u6309\u5929",
  analyticsInput: "\u8F93\u5165",
  analyticsOutput: "\u8F93\u51FA",
  analyticsCacheRead: "\u7F13\u5B58",
  analyticsPriced: "\u5DF2\u8BA1\u4EF7",
  analyticsUnpriced: "\u672A\u8BA1\u4EF7",
  analyticsMissing: "\u7F3A\u7528\u91CF",
  analyticsFailedSessions: "\u8BFB\u53D6\u5931\u8D25",
  analyticsUnattributed: "\u672A\u5F52\u5C5E\u6D3B\u52A8\uFF1A",
  analyticsUnread: "\u9884\u7B97\u6216\u4E0A\u9650\u622A\u6B62\u65F6\u672A\u8BFB\u53D6\u7684\u4F1A\u8BDD\uFF1A",
  analyticsScanSegments: "\u8017\u65F6\u6BEB\u79D2\uFF0C\u5217\u8868 / \u626B\u63CF / \u5B9A\u4EF7\uFF1A",
  analyticsStaleResults: "\u4EE5\u4E0B\u4E3A\u4E0A\u4E00\u8F6E\u7ED3\u679C\uFF0C\u65B0\u4E00\u8F6E\u626B\u63CF\u8FDB\u884C\u4E2D\u3002",
  analyticsTruncated: "\u4EC5\u626B\u63CF\u4E86\u6700\u8FD1\u7684\u90E8\u5206\u5386\u53F2\u3002",
  analyticsScanMore: "\u626B\u63CF\u66F4\u591A\u5386\u53F2",
  analyticsPriceSource: "\u4EF7\u683C\u6765\u6E90\uFF1A",
  analyticsNotInvoice: "\u4F30\u7B97\u91D1\u989D\u975E\u8D26\u5355\uFF1B\u5B98\u65B9\u989D\u5EA6\u767E\u5206\u6BD4\u4ECD\u4E3A\u6743\u5A01\u503C\uFF1B\u8D39\u7528\u6309\u5F53\u524D models.dev \u4EF7\u76EE\u5BF9\u5168\u90E8\u5386\u53F2\u8BF7\u6C42\u4F30\u7B97\u3002",
  analyticsPricingUnavailable: "\u4EF7\u683C\u6682\u4E0D\u53EF\u7528",
  analyticsLegacy: "\u542B 0.1.16 \u4E4B\u524D\u7684\u65E7\u8DEF\u7531\u8BF7\u6C42\uFF1A",
  analyticsCardTitle: "\u7528\u91CF\u7EDF\u8BA1",
  analyticsCardHint: "\u7EDF\u8BA1\u672C\u63D2\u4EF6\u7684\u8BF7\u6C42\uFF08\u542B\u5DF2\u5173\u95ED\u4F1A\u8BDD\uFF09\uFF0C\u6309\u6A21\u578B\u4F30\u7B97\u91D1\u989D\u3002\u6253\u5F00\u65F6\u626B\u63CF\u672C\u5730\u4F1A\u8BDD\uFF0C\u4E0D\u4E0A\u4F20\u3002",
  analyticsBoardLabel: "\u770B\u677F",
  analyticsOpenBoard: "\u6253\u5F00\u770B\u677F",
  analyticsQuota: "\u989D\u5EA6",
  analyticsQuotaHint: "\u5B98\u65B9\u767E\u5206\u6BD4 \xB7 \u6BCF\u5206\u949F\u5237\u65B0",
  analyticsQuotaFailed: "\u989D\u5EA6\u6682\u4E0D\u53EF\u7528\uFF0C\u7EDF\u8BA1\u7ED3\u679C\u4ECD\u4F1A\u663E\u793A\u3002",
  analyticsChartSpend: "\u91D1\u989D",
  analyticsChartTokens: "Token",
  analyticsKicker: "\u7528\u91CF\u62A5\u544A",
  analyticsLead: "\u6240\u9009\u533A\u95F4\u5185\uFF0C\u672C\u63D2\u4EF6\u53D1\u8D77\u4E86 {requests} \u6B21\u8BF7\u6C42\uFF0C\u6D88\u8017 {tokens} Token\uFF0C\u4F30\u7B97 {spend}\u3002",
  analyticsLeadTop: "\u5176\u4E2D {model} \u5360 {share}\u3002",
  analyticsComposition: "\u82B1\u8D39\u6784\u6210",
  analyticsCompositionHint: "\u6309\u4F30\u7B97\u91D1\u989D \xB7 \u4EC5\u542B\u5DF2\u8BA1\u4EF7\u6A21\u578B",
  analyticsCompositionOther: "\u5176\u4ED6 {count}",
  analyticsCompositionFree: "\u53E6\u6709\u514D\u8D39\u6216\u672A\u8BA1\u4EF7\u6A21\u578B\uFF1A",
  analyticsModel: "\u6A21\u578B",
  analyticsCost: "\u82B1\u8D39",
  analyticsShare: "\u5360\u6BD4",
  analyticsCacheHit: "\u7F13\u5B58\u547D\u4E2D",
  analyticsDailyAverage: "\u65E5\u5747",
  analyticsPeak: "\u5CF0\u503C",
  analyticsTotal: "\u5408\u8BA1",
  themeLabel: "\u4E3B\u9898",
  themeSilentBlack: "\u5BC2\u9759\u9ED1",
  themeGraphite: "\u77F3\u58A8",
  themeSeaSalt: "\u6D77\u76D0\u9752",
  themeWarmSand: "\u6696\u7802",
  themeHint: "\u4EC5\u4F5C\u7528\u4E8E\u989D\u5EA6\u80F6\u56CA\u548C\u7528\u91CF\u770B\u677F\u3002",
  nav: "OpenCode Go",
  title: "OpenCode Go",
  titleLabel: "OpenCode Go",
  intro: "\u9009\u62E9\u4F1A\u8BDD\u4E2D\u663E\u793A\u7684 OpenCode Go \u6A21\u578B\uFF0C\u5E76\u8C03\u6574\u5176\u5BB9\u91CF\u3002",
  starProject: "\u559C\u6B22\u8FD9\u4E2A\u63D2\u4EF6\uFF1F\u53BB GitHub \u70B9\u4E2A Star",
  starProjectTitle: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00 GitHub \u9879\u76EE",
  enabledLabel: "\u542F\u7528 OpenCode Go",
  enabledHint: "\u5F00\u542F\u540E\u51FA\u73B0\u5728\u6240\u6709\u6A21\u578B\u9009\u62E9\u5668\u4E2D\u5E76\u53EF\u5904\u7406\u8BF7\u6C42\uFF1B\u5173\u95ED\u7ACB\u5373\u64A4\u4E0B\uFF0C\u672C\u9875\u4ECD\u53EF\u8BBF\u95EE\u3002",
  enabledOff: "OpenCode Go \u5DF2\u5173\u95ED\uFF1A\u6A21\u578B\u5DF2\u4ECE\u6240\u6709\u9009\u62E9\u5668\u64A4\u4E0B\uFF0C\u4E5F\u6CA1\u6709\u8BF7\u6C42\u53D1\u5F80\u7F51\u5173\u3002",
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
  thinkingBudgets: "\u601D\u8003\u9884\u7B97",
  thinkingBudgetsHint: "\u6DFB\u52A0 token \u9884\u7B97\u5E76\u4FDD\u5B58\uFF0C\u5373\u53EF\u5728\u4F1A\u8BDD\u4E2D\u9009\u62E9\u3002\u8303\u56F4\uFF1A{min}\u2013{max} tokens\u3002\u4FDD\u7559\u539F\u6709\u601D\u8003\u9009\u9879\uFF1B\u201C\u9ED8\u8BA4\u201D\u4F7F\u7528\u670D\u52A1\u5546\u8BBE\u7F6E\u3002SDK \u4F1A\u6309\u5269\u4F59\u8F93\u51FA\u7A7A\u95F4\u7F29\u5C0F\u9884\u7B97\uFF0C\u4E3A\u56DE\u7B54\u7559\u51FA\u7A7A\u95F4\u3002",
  thinkingBudgetAddLabel: "\u4E3A {name} \u6DFB\u52A0\u601D\u8003\u9884\u7B97",
  thinkingBudgetAdd: "\u6DFB\u52A0",
  thinkingBudgetRemove: "\u79FB\u9664 {value} token \u9884\u7B97",
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
  advancedResetAll: "\u5168\u90E8\u6062\u590D\u9ED8\u8BA4",
  advancedLabel: "\u9AD8\u7EA7\u8BBE\u7F6E",
  groupUsageProtocol: "\u7528\u91CF\u4E0E\u534F\u8BAE",
  groupConnection: "\u8FDE\u63A5",
  groupCacheTimeouts: "\u7F13\u5B58\u4E0E\u8D85\u65F6",
  groupImages: "\u56FE\u7247\u5904\u7406",
  advancedHint: "\u7EE7\u627F\u6765\u7684\u53D6\u503C\u5373\u53EF\u6B63\u5E38\u4F7F\u7528\uFF1B\u4E0B\u9762\u53EA\u5217\u9700\u8981\u6539\u7684\u9879\u3002",
  usageDisplayLabel: "\u989D\u5EA6\u663E\u793A",
  usageDisplayHint: "\u81EA\u52A8\uFF1A\u4EC5\u9009\u4E2D DSH OpenCode Go \u6A21\u578B\u65F6\u663E\u793A\uFF1B\u5E38\u9A7B\uFF1A\u4EFB\u610F\u6A21\u578B\u90FD\u663E\u793A\uFF1B\u5173\u95ED\uFF1A\u9690\u85CF\u5E76\u505C\u6B62\u5237\u65B0\u3002\u663E\u793A\u65F6\u6BCF\u5206\u949F\u5237\u65B0\u3002",
  usageDisplay_auto: "\u81EA\u52A8\uFF08\u9ED8\u8BA4\uFF09",
  usageDisplay_always: "\u5E38\u9A7B",
  usageDisplay_off: "\u5173\u95ED",
  protocolOverridesLabel: "DeepSeek V4.1 Flash \u534F\u8BAE",
  protocolOverridesHint: "\u81EA\u52A8\u8DDF\u968F\u6A21\u578B\u76EE\u5F55\uFF1BResponses \u4E3A\u5B9E\u9A8C\u6027\uFF0C\u4EC5\u5F71\u54CD DeepSeek V4.1 Flash\uFF0C\u4FDD\u5B58\u540E\u5BF9\u65B0\u8BF7\u6C42\u751F\u6548\u3002",
  protocolOverridesAuto: "\u81EA\u52A8\uFF08\u9ED8\u8BA4\uFF09",
  protocolOverridesResponses: "Responses\uFF08\u5B9E\u9A8C\u6027\uFF09",
  baseURLLabel: "\u7F51\u5173\u5730\u5740",
  baseURLHint: "\u5B98\u65B9 Go \u7F51\u5173\u81EA\u52A8\u9009\u62E9\u6A21\u578B\u5BF9\u5E94\u7684\u534F\u8BAE\u7AEF\u70B9\uFF1B\u81EA\u5B9A\u4E49\u7F51\u5173\u4F7F\u7528\u586B\u5199\u7684\u8BF7\u6C42\u524D\u7F00\u3002",
  proxyURLLabel: "\u4EE3\u7406\u5730\u5740",
  proxyURLHint: "\u5BF9\u8BDD\u3001\u76EE\u5F55\u5237\u65B0\u4E0E\u7528\u91CF\u67E5\u8BE2\u4F7F\u7528\u7684 HTTP(S)/SOCKS5 \u4EE3\u7406\uFF1B\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\u7F51\u7EDC\u3002",
  proxyURLInvalid: "\u8BF7\u8F93\u5165 http://\u3001https:// \u6216 socks5:// \u4EE3\u7406\u5730\u5740\uFF0C\u4E0D\u5305\u542B\u8DEF\u5F84\u3001\u67E5\u8BE2\u53C2\u6570\u6216\u7247\u6BB5\u3002",
  refreshMinutesLabel: "\u76EE\u5F55\u5237\u65B0\uFF08\u5206\u949F\uFF09",
  refreshMinutesHint: "\u6A21\u578B\u76EE\u5F55\u7684\u7F13\u5B58\u65F6\u957F\uFF1B\u6253\u5F00\u672C\u9875\u6216\u70B9\u51FB\u5237\u65B0\u4F1A\u7ACB\u5373\u91CD\u65B0\u6838\u5BF9\u3002",
  streamIdleTimeoutMsLabel: "\u6D41\u7A7A\u95F2\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  streamIdleTimeoutMsHint: "\u6D41\u4E8B\u4EF6\u4E4B\u95F4\u7684\u6700\u5927\u9759\u9ED8\u95F4\u9694\uFF0C\u8D85\u51FA\u5219\u8BF7\u6C42\u5931\u8D25\u3002",
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

// src/accounts-contract.ts
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

// src/analytics-contract.ts
var MAX_TIME = 864e13;
var MAX_RANGE_MS = 366 * 864e5;
var MAX_SESSIONS = 2e3;
function object(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid analytics " + field);
  return value;
}
function integer(value, field, min = 0, max = MAX_TIME) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error("Invalid analytics " + field);
  }
  return value;
}
function amount(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e12) {
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
function list(value, field, max) {
  if (!Array.isArray(value) || value.length > max) throw new Error("Invalid analytics " + field);
  return value;
}
function bool(value, field) {
  if (typeof value !== "boolean") throw new Error("Invalid analytics " + field);
  return value;
}
function optionalAmount(value, field) {
  return value === null ? null : amount(value, field);
}
var TRUNCATIONS = ["sessions", "events", "time"];
var NOTES = ["unlimited", "limited-time", "unknown"];
function parseAnalyticsQuery(value) {
  const row = object(value, "query");
  const from = integer(row.from, "query.from");
  const to = integer(row.to, "query.to", 1);
  if (from >= to) throw new Error("Invalid analytics range");
  if (to - from > MAX_RANGE_MS) throw new Error("Invalid analytics range");
  const timeZone = text(row.timeZone, "query.timeZone", 64);
  if (!/^[A-Za-z0-9_+\-/]+$/.test(timeZone)) throw new Error("Invalid analytics timezone");
  const maxSessions = row.maxSessions === void 0 ? void 0 : integer(row.maxSessions, "query.maxSessions", 1, MAX_SESSIONS);
  return { from, to, timeZone, ...maxSessions === void 0 ? {} : { maxSessions } };
}
function validateTotals(value) {
  const row = object(value, "totals");
  for (const key of [
    "requests",
    "unsettledAttempts",
    "summaries",
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "estimatedMicroUsd",
    "pricedRequests",
    "unpricedRequests",
    "missingUsage"
  ]) {
    integer(row[key], "totals." + key);
  }
}
function validateModel(value) {
  const row = object(value, "model");
  text(row.model, "model.model");
  if (row.name !== void 0) text(row.name, "model.name");
  for (const key of [
    "requests",
    "missingUsage",
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "estimatedMicroUsd",
    "pricedRequests",
    "unpricedRequests"
  ]) integer(row[key], "model." + key);
  optionalAmount(row.limitGoUsd, "model.limitGoUsd");
  optionalAmount(row.limitGoPlusUsd, "model.limitGoPlusUsd");
  if (row.limitNote !== void 0 && !NOTES.includes(row.limitNote)) throw new Error("Invalid analytics model.limitNote");
}
function validateDay(value) {
  const row = object(value, "day");
  const day = text(row.day, "day.day", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid analytics day");
  const parsed = /* @__PURE__ */ new Date(day + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) throw new Error("Invalid analytics day");
  integer(row.requests, "day.requests");
  integer(row.tokens, "day.tokens");
  integer(row.estimatedMicroUsd, "day.estimatedMicroUsd");
}
function validateCoverage(value) {
  const row = object(value, "coverage");
  for (const key of [
    "listedSessions",
    "scannedSessions",
    "matchedSessions",
    "failedSessions",
    "eventsScanned",
    "summaries",
    "legacyRequests",
    "missingUsage",
    "scanMs"
  ]) integer(row[key], "coverage." + key);
  for (const key of ["unreadSessions", "evictedSessions", "unattributedRequests", "listMs", "pricingMs"]) {
    if (row[key] !== void 0) integer(row[key], "coverage." + key);
  }
  bool(row.truncated, "coverage.truncated");
  if (row.truncation !== void 0 && !TRUNCATIONS.includes(row.truncation)) throw new Error("Invalid analytics truncation");
  if (row.timeZoneFallback !== void 0 && row.timeZoneFallback !== true) throw new Error("Invalid analytics timezone fallback");
}
function validatePricing(value) {
  const row = object(value, "pricing");
  if (row.source !== "models.dev") throw new Error("Invalid analytics pricing source");
  if (row.updatedAt !== void 0) integer(row.updatedAt, "pricing.updatedAt");
  if (row.unavailable !== void 0 && row.unavailable !== true) throw new Error("Invalid analytics pricing state");
  for (const model of list(row.unpricedModels, "pricing.unpricedModels", 256)) text(model, "pricing.unpricedModels", 128);
}
function parseAnalyticsReport(value) {
  const row = object(value, "report");
  integer(row.generatedAt, "generatedAt");
  const range = object(row.range, "range");
  const from = integer(range.from, "range.from");
  const to = integer(range.to, "range.to", 1);
  if (from >= to) throw new Error("Invalid analytics range");
  text(row.timeZone, "timeZone", 64);
  validateTotals(row.totals);
  for (const model of list(row.byModel, "byModel", 256)) validateModel(model);
  for (const day of list(row.byDay, "byDay", 366)) validateDay(day);
  validateCoverage(row.coverage);
  validatePricing(row.pricing);
  return value;
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
var analyticsRemote = {
  package: "dsh-opencode-go",
  descriptors: [{
    id: "dsh-opencode-go#opencodeGoAnalytics/read",
    service: "opencodeGoAnalytics",
    namespace: "opencodeGoAnalytics",
    method: "read",
    invocation: { kind: "direct" },
    parameters: [{ name: "query", wire: "query", source: "json", codec: queryCodec }],
    // Review M4: the signal is injected after the business parameters and
    // never enters the wire args, so single-argument callers keep working
    // (precedent: dsh-llm discoverModels, typert.remote-client.js:62).
    cancellation: { parameter: "signal" },
    result: reportCodec
  }]
};

// src/remote-contract.ts
var goRemote = {
  package: "dsh-opencode-go",
  descriptors: [...usageRemote.descriptors, ...modelsRemote.descriptors, ...accountsRemote.descriptors, ...analyticsRemote.descriptors]
};

// src/client/UsagePill.tsx
var import_react6 = require("react");

// plugin-css:src/client/UsagePill.module.css
var id4 = "dsh-opencode-go/UsagePill.module.css";
if (!document.querySelector("style[data-plugin-css=" + JSON.stringify(id4) + "]")) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-opencode-go";
  style.dataset.pluginCss = id4;
  style.textContent = '.mAjYhq_root{min-width:0;color:var(--go-text,var(--dsw-alias-label-primary,CanvasText));display:inline-flex;position:relative}.mAjYhq_trigger{border:1px solid var(--go-border,color-mix(in srgb, currentColor 16%, transparent));background:color-mix(in srgb, var(--go-surface,Canvas) 72%, transparent);min-width:0;color:inherit;font:inherit;cursor:pointer;white-space:nowrap;border-radius:12px;align-items:center;gap:6px;padding:4px 9px;font-size:12.5px;line-height:1.6;display:inline-flex}.mAjYhq_trigger:hover,.mAjYhq_trigger:focus-visible{background:var(--go-surface-2,color-mix(in srgb, currentColor 8%, transparent));border-color:color-mix(in srgb, var(--go-accent,currentColor) 42%, var(--go-border,transparent))}.mAjYhq_reading{text-overflow:ellipsis;flex:none;min-width:0;overflow:hidden}.mAjYhq_stale,.mAjYhq_fallback{color:var(--go-warning,currentColor)}.mAjYhq_account{text-overflow:ellipsis;flex:0 100 auto;min-width:0;overflow:hidden}@container (width<=460px){.mAjYhq_stale,.mAjYhq_fallback{display:none}.mAjYhq_reading[data-stale]:after{content:"*"}.mAjYhq_trigger[data-fallback]:after{content:" \u21B3"}}@container (width<=360px){.mAjYhq_unit{display:none}}.mAjYhq_panel{z-index:100;box-sizing:border-box;border:1px solid var(--go-border,color-mix(in srgb, currentColor 12%, transparent));width:340px;max-width:calc(100vw - 24px);max-height:72vh;color:var(--go-text,var(--dsw-alias-label-primary,CanvasText));isolation:isolate;border-radius:16px;flex-direction:column;font-size:12px;display:flex;position:absolute;bottom:calc(100% + 10px);right:0;box-shadow:0 20px 60px #0005}.mAjYhq_material{z-index:-1;border-radius:inherit;pointer-events:none;background:color-mix(in srgb, var(--go-surface,var(--dsw-specific-menu,#2a2a2c)) 88%, transparent);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));position:absolute;inset:0}@supports not (backdrop-filter:blur(1px)){.mAjYhq_material{background:var(--go-surface,var(--dsw-alias-bg-layer-2,Canvas))}}.mAjYhq_body{overscroll-behavior:contain;box-sizing:border-box;flex-direction:column;flex:1;gap:7px;min-height:0;padding:10px;display:flex;overflow-y:auto}.mAjYhq_panelTitle,.mAjYhq_panelHead{color:var(--go-muted,var(--dsw-alias-label-tertiary,currentColor));flex:none;padding:2px 6px 0;font-size:11.5px;line-height:1.6}.mAjYhq_panelHead{align-items:center;gap:6px;display:flex}.mAjYhq_panelHead strong{color:var(--go-text,var(--dsw-alias-label-primary,CanvasText));font-size:12px;font-weight:600}.mAjYhq_back{width:18px;height:18px;color:inherit;cursor:pointer;background:0 0;border:0;border-radius:5px;place-items:center;padding:0;display:grid}.mAjYhq_back:hover{background:color-mix(in srgb, var(--go-text,currentColor) 8%, transparent)}.mAjYhq_icon{flex:none;width:14px;height:14px}.mAjYhq_tick{width:14px;height:14px;color:var(--go-success,#39a878);flex:none}.mAjYhq_tile{background:var(--go-surface-2,color-mix(in srgb, currentColor 6%, transparent));border-radius:10px;flex:none;overflow:hidden}.mAjYhq_divider{background:var(--go-border,color-mix(in srgb, currentColor 10%, transparent));height:.5px;margin:0 12px}.mAjYhq_accHead{align-items:center;gap:8px;min-height:42px;padding:0 12px;display:flex}.mAjYhq_dot{background:var(--go-success,#39a878);border-radius:50%;flex:none;width:7px;height:7px}.mAjYhq_accName{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:13.5px;font-weight:600;overflow:hidden}.mAjYhq_tag{border:.5px solid color-mix(in srgb, var(--go-success,#39a878) 45%, transparent);background:color-mix(in srgb, var(--go-success,#39a878) 12%, transparent);color:var(--go-success,#39a878);border-radius:999px;flex:none;padding:0 7px;font-size:10.5px;line-height:1.7}.mAjYhq_switch{font:inherit;color:var(--go-muted,var(--dsw-alias-label-tertiary,currentColor));cursor:pointer;background:0 0;border:0;border-radius:6px;flex:none;align-items:center;gap:3px;padding:3px 6px;font-size:11.5px;display:inline-flex}.mAjYhq_switch:hover:not(:disabled){background:color-mix(in srgb, var(--go-text,currentColor) 8%, transparent)}.mAjYhq_switch:disabled{opacity:.55;cursor:default}.mAjYhq_switch svg{display:block;transform:translateY(.5px)}.mAjYhq_option{width:100%;min-height:38px;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:8px;padding:0 12px;display:flex}.mAjYhq_option:hover:not(:disabled){background:color-mix(in srgb, var(--go-text,currentColor) 6%, transparent)}.mAjYhq_option:disabled{opacity:.6;cursor:default}.mAjYhq_optionName{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--go-text,var(--dsw-alias-label-secondary,currentColor));flex:1;font-size:13px;overflow:hidden}.mAjYhq_option[data-selected] .mAjYhq_optionName{color:var(--go-text,var(--dsw-alias-label-primary,CanvasText));font-weight:600}.mAjYhq_hint{opacity:.65;font-size:11px;line-height:1.6}.mAjYhq_warning{background:color-mix(in srgb, var(--go-warning,currentColor) 8%, transparent);overflow-wrap:anywhere;border-radius:6px;margin:10px 0;padding:10px;line-height:1.5}.mAjYhq_warning p{margin:5px 0 0}.mAjYhq_retry{border:1px solid color-mix(in srgb, var(--go-text,currentColor) 25%, transparent);color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:5px 9px}.mAjYhq_retry:disabled{opacity:.6;cursor:default}.mAjYhq_back:focus-visible,.mAjYhq_switch:focus-visible,.mAjYhq_option:focus-visible,.mAjYhq_retry:focus-visible{outline:2px solid var(--go-accent,currentColor);outline-offset:2px}.mAjYhq_window{padding:10px 12px}.mAjYhq_windowRow{align-items:center;gap:10px;display:flex}.mAjYhq_windowLabel{width:48px;color:var(--go-muted,var(--dsw-alias-label-secondary,currentColor));flex:none;font-size:12.5px}.mAjYhq_windowPercent{text-align:right;font-variant-numeric:tabular-nums;flex:none;width:38px;font-size:13px;font-weight:650}.mAjYhq_window progress{appearance:none;background:color-mix(in srgb, var(--go-text,currentColor) 12%, transparent);border:0;border-radius:99px;flex:1;min-width:60px;height:8px;display:block}.mAjYhq_window progress::-webkit-progress-bar{background:0 0;border-radius:99px}.mAjYhq_window progress::-webkit-progress-value{background:var(--go-progress,var(--go-accent,#39a878));border-radius:99px}.mAjYhq_window progress::-moz-progress-bar{background:var(--go-progress,var(--go-accent,#39a878));border-radius:99px}.mAjYhq_windowReset{color:var(--go-muted,var(--dsw-alias-label-tertiary,currentColor));margin-top:6px;font-size:11px;line-height:1.6}.mAjYhq_progressRolling{--go-progress:var(--go-accent)}.mAjYhq_progressWeekly{--go-progress:var(--go-success)}.mAjYhq_progressMonthly,.mAjYhq_window progress.mAjYhq_high{--go-progress:var(--go-warning)}.mAjYhq_window progress.mAjYhq_limited{--go-progress:var(--go-danger)}.mAjYhq_limitedText{color:var(--go-danger,#e5484d);margin-top:2px;font-weight:600}.mAjYhq_foot{color:var(--go-muted,var(--dsw-alias-label-tertiary,currentColor));justify-content:space-between;align-items:center;gap:8px;padding:3px 6px 1px;font-size:10.5px;display:flex}.mAjYhq_analyticsEntry{background:var(--go-surface-2,color-mix(in srgb, currentColor 6%, transparent));width:100%;min-height:42px;color:var(--go-text,var(--dsw-alias-label-primary,CanvasText));font:inherit;text-align:left;cursor:pointer;border:0;border-radius:10px;flex:none;align-items:center;gap:7px;padding:0 12px;font-size:12.5px;font-weight:500;display:flex}.mAjYhq_analyticsEntry span{flex:1;min-width:0}.mAjYhq_analyticsEntry .mAjYhq_icon{color:var(--go-muted,var(--dsw-alias-label-tertiary,currentColor))}.mAjYhq_analyticsEntry:hover{background:color-mix(in srgb, var(--go-text,currentColor) 8%, var(--go-surface-2,transparent))}.mAjYhq_analyticsEntry:focus-visible{outline:2px solid var(--go-accent,currentColor);outline-offset:1px}';
  document.head.appendChild(style);
}
var UsagePill_default = { "accHead": "mAjYhq_accHead", "accName": "mAjYhq_accName", "account": "mAjYhq_account", "analyticsEntry": "mAjYhq_analyticsEntry", "back": "mAjYhq_back", "body": "mAjYhq_body", "divider": "mAjYhq_divider", "dot": "mAjYhq_dot", "fallback": "mAjYhq_fallback", "foot": "mAjYhq_foot", "high": "mAjYhq_high", "hint": "mAjYhq_hint", "icon": "mAjYhq_icon", "limited": "mAjYhq_limited", "limitedText": "mAjYhq_limitedText", "material": "mAjYhq_material", "option": "mAjYhq_option", "optionName": "mAjYhq_optionName", "panel": "mAjYhq_panel", "panelHead": "mAjYhq_panelHead", "panelTitle": "mAjYhq_panelTitle", "progressMonthly": "mAjYhq_progressMonthly", "progressRolling": "mAjYhq_progressRolling", "progressWeekly": "mAjYhq_progressWeekly", "reading": "mAjYhq_reading", "retry": "mAjYhq_retry", "root": "mAjYhq_root", "stale": "mAjYhq_stale", "switch": "mAjYhq_switch", "tag": "mAjYhq_tag", "tick": "mAjYhq_tick", "tile": "mAjYhq_tile", "trigger": "mAjYhq_trigger", "unit": "mAjYhq_unit", "warning": "mAjYhq_warning", "window": "mAjYhq_window", "windowLabel": "mAjYhq_windowLabel", "windowPercent": "mAjYhq_windowPercent", "windowReset": "mAjYhq_windowReset", "windowRow": "mAjYhq_windowRow" };

// src/client/UsagePill.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
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
function usageLevel(window) {
  if (window.status === "rate-limited" || window.percent >= 100) return UsagePill_default.limited;
  return window.percent >= 80 ? UsagePill_default.high : void 0;
}
function ChevronRight() {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { className: UsagePill_default.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M6 4l4 4-4 4" }) });
}
function ChevronLeft() {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { className: UsagePill_default.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M10 4 6 8l4 4" }) });
}
function ChartIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { className: UsagePill_default.icon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M2.5 13.5h11M4.5 11V8M8 11V4M11.5 11V6" }) });
}
function Tick() {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("svg", { className: UsagePill_default.tick, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M3.5 8.5 6.5 11.5 12.5 4.5" }) });
}
function UsagePill({ directory, settings, credentialChanges, ...props }) {
  const state = (0, import_react6.useSyncExternalStore)(directory.subscribe, directory.getSnapshot, directory.getSnapshot);
  const readSettings = (0, import_react6.useCallback)(() => settings.getSnapshot(), [settings]);
  const subscribeSettings = (0, import_react6.useCallback)((listener) => settings.subscribe(listener), [settings]);
  const config = (0, import_react6.useSyncExternalStore)(subscribeSettings, readSettings, readSettings);
  const readChanges = (0, import_react6.useCallback)(() => credentialChanges?.getSnapshot() ?? unchanged(), [credentialChanges]);
  const subscribeChanges = (0, import_react6.useCallback)((listener) => credentialChanges?.subscribe(listener) ?? noSubscription(), [credentialChanges]);
  const credentialRevision = (0, import_react6.useSyncExternalStore)(subscribeChanges, readChanges, readChanges);
  const [analyticsOpen, setAnalyticsOpen] = (0, import_react6.useState)(false);
  const mode = config.value?.usageDisplay ?? DEFAULT_USAGE_DISPLAY;
  const visible = config.status === "ready" && config.value?.enabled !== false && (mode === "always" || mode === "auto" && state.current?.provider === PROVIDER_ID);
  const accounts = accountsOf(config.value ?? {});
  const activeRef = accountRefOf(config.value ?? {});
  return visible ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      ActiveUsage,
      {
        ...props,
        accounts,
        activeRef,
        writable: config.writable,
        analyticsOpen,
        onAnalyticsOpenChange: setAnalyticsOpen
      },
      JSON.stringify([activeRef, config.value?.baseURL, config.value?.proxyURL, credentialRevision, accounts])
    ),
    props.readAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      AnalyticsDialog,
      {
        open: analyticsOpen,
        onClose: () => {
          setAnalyticsOpen(false);
        },
        readAnalytics: props.readAnalytics,
        readQuota: props.readUsage,
        t: props.t,
        getLocale: props.getLocale
      }
    ) : null
  ] }) : null;
}
function ActiveUsage({ readUsage, readAnalytics, t, getLocale, accounts, activeRef, writable, selectAccount, analyticsOpen, onAnalyticsOpenChange }) {
  const [snapshot, setSnapshot] = (0, import_react6.useState)(null);
  const [failed, setFailed] = (0, import_react6.useState)(null);
  const [refreshing, setRefreshing] = (0, import_react6.useState)(false);
  const [open, setOpen] = (0, import_react6.useState)(false);
  const [switching, setSwitching] = (0, import_react6.useState)(false);
  const [switchFailed, setSwitchFailed] = (0, import_react6.useState)(false);
  const [view, setView] = (0, import_react6.useState)("usage");
  const tokens = useGoThemeTokens();
  const root = (0, import_react6.useRef)(null);
  const retry = (0, import_react6.useRef)(() => {
  });
  (0, import_react6.useEffect)(() => {
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
        const value = await withRefreshTimeout(readUsage);
        if (alive) {
          setSnapshot({ reader: readUsage, usage: value, updatedAt: Date.now() });
          setFailed(null);
        }
      } catch (error) {
        if (error === refreshTimedOut) return;
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
  (0, import_react6.useEffect)(() => {
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
  const accountsView = view === "accounts" && accounts.length > 1;
  const switchable = accounts.length > 1 && writable && selectAccount !== void 0;
  const switchTo = (ref) => {
    if (ref === activeRef) {
      setView("usage");
      return;
    }
    setSwitching(true);
    setSwitchFailed(false);
    void selectAccount?.(ref).then((accepted) => {
      setSwitchFailed(!accepted);
      if (accepted) setView("usage");
    }).catch(() => {
      setSwitchFailed(true);
    }).finally(() => {
      setSwitching(false);
    });
  };
  const label = usage ? `${t("usageRollingShort")} ${usage.rolling.percent}% \xB7 ${t("usageWeekShort")} ${usage.weekly.percent}%${failure ? ` \xB7 ${t("usageStaleShort")}` : ""}${notice ? ` \xB7 ${t("usageFallbackShort")}` : ""}${accounts.length > 1 ? ` \xB7 ${accountName}` : ""}` : `${failure ? t("usageUnavailable") : "\u2026"}${notice ? ` \xB7 ${t("usageFallbackShort")}` : ""}${accounts.length > 1 ? ` \xB7 ${accountName}` : ""}`;
  const segments = usage ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: UsagePill_default.reading, "data-stale": failure ? "" : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: UsagePill_default.unit, children: [
        t("usageRollingShort"),
        " "
      ] }),
      usage.rolling.percent,
      "%",
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: UsagePill_default.unit, children: [
        t("usageWeekShort"),
        " "
      ] }),
      usage.weekly.percent,
      "%"
    ] }),
    failure ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: UsagePill_default.stale, children: [
      " \xB7 ",
      t("usageStaleShort")
    ] }) : null,
    notice ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: UsagePill_default.fallback, children: [
      " \xB7 ",
      t("usageFallbackShort")
    ] }) : null,
    accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: UsagePill_default.account, children: accountName })
    ] }) : null
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    failure ? t("usageUnavailable") : "\u2026",
    notice ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: UsagePill_default.fallback, children: [
      " \xB7 ",
      t("usageFallbackShort")
    ] }) : null,
    accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      " \xB7 ",
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: UsagePill_default.account, children: accountName })
    ] }) : null
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: UsagePill_default.root, ref: root, style: themeStyle(tokens), children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "button",
      {
        type: "button",
        className: UsagePill_default.trigger,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        "data-fallback": notice ? "" : void 0,
        "aria-label": `${t("usageTitle")}: ${label}`,
        title: label,
        onClick: () => {
          setOpen(!open);
          setView("usage");
        },
        children: segments
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: UsagePill_default.panel, role: "dialog", "aria-label": t("usageTitle"), "aria-busy": refreshing, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.material, "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.body, children: accountsView ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: UsagePill_default.panelHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: UsagePill_default.back, "aria-label": t("accountSwitchBack"), onClick: () => {
            setView("usage");
          }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ChevronLeft, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: t("accountSwitchTitle") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            className: UsagePill_default.tile,
            role: "listbox",
            "aria-label": t("accountSwitchTitle"),
            onKeyDown: (event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setView("usage");
                return;
              }
              const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
              if (step === 0) return;
              event.preventDefault();
              const options = Array.from(event.currentTarget.querySelectorAll('[role="option"]'));
              const at = options.indexOf(document.activeElement);
              options[(at + step + options.length) % options.length]?.focus();
            },
            children: accounts.map((account, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react6.Fragment, { children: [
              index ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.divider }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
                "button",
                {
                  type: "button",
                  role: "option",
                  "aria-selected": account.apiKeyEnv === activeRef,
                  "data-selected": account.apiKeyEnv === activeRef ? "" : void 0,
                  className: UsagePill_default.option,
                  disabled: switching,
                  onClick: () => {
                    switchTo(account.apiKeyEnv);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: UsagePill_default.optionName, children: account.name || t("accountDefault") }),
                    account.apiKeyEnv === activeRef ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tick, {}) : null
                  ]
                }
              )
            ] }, account.id))
          }
        ),
        switchFailed ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: UsagePill_default.warning, role: "alert", children: t("accountSwitchFailed") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: UsagePill_default.hint, children: t("accountSwitchHint") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.panelTitle, children: t("usageTitle") }),
        accounts.length ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.tile, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: UsagePill_default.accHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: UsagePill_default.dot }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: UsagePill_default.accName, children: accountName }),
          accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: UsagePill_default.tag, children: t("accountPreferredTag") }) : null,
          accounts.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "button",
            {
              type: "button",
              className: UsagePill_default.switch,
              disabled: !switchable || switching,
              "aria-haspopup": "listbox",
              onClick: () => {
                setView("accounts");
              },
              children: [
                t("accountSwitchAction"),
                accounts.length > 1 ? " \xB7 " + accounts.length : "",
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ChevronRight, {})
              ]
            }
          ) : null
        ] }) }) : null,
        switchFailed ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: UsagePill_default.warning, role: "alert", children: t("accountSwitchFailed") }) : null,
        notice ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: UsagePill_default.warning, role: "status", children: [
          t(notice.reason === "quota" ? "accountFallbackQuota" : "accountFallbackCredential"),
          " ",
          accounts.find((account) => account.apiKeyEnv === notice.toRef)?.name || t("accountDefault"),
          " \xB7 ",
          new Date(notice.at).toLocaleString(getLocale?.())
        ] }) : null,
        failure ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: UsagePill_default.warning, role: "alert", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: t("usageRefreshFailed") }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: failure.message ?? t("usageUnavailable") }),
          usage ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: t("usageStaleHint") }) : null
        ] }) : null,
        failure ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
        usage ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.tile, children: ["rolling", "weekly", "monthly"].map((key, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react6.Fragment, { children: [
          index ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.divider }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: UsagePill_default.window, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: UsagePill_default.windowRow, children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: UsagePill_default.windowLabel, children: t(`usage_${key}`) }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
                "progress",
                {
                  className: [usageLevel(usage[key]), key === "rolling" ? UsagePill_default.progressRolling : key === "weekly" ? UsagePill_default.progressWeekly : UsagePill_default.progressMonthly].filter(Boolean).join(" "),
                  "aria-label": t(`usage_${key}`),
                  max: 100,
                  value: Math.min(100, usage[key].percent)
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("strong", { className: UsagePill_default.windowPercent, children: [
                usage[key].percent,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: UsagePill_default.windowReset, children: [
              t("usageResets"),
              " ",
              new Date(usage[key].resetsAt).toLocaleString(getLocale?.())
            ] }),
            usage[key].status === "rate-limited" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.limitedText, children: t("usageLimited") })
          ] })
        ] }, key)) }) : failure ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: UsagePill_default.hint, children: t("usageLoading") }),
        readAnalytics ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
          "button",
          {
            type: "button",
            className: UsagePill_default.analyticsEntry,
            "aria-haspopup": "dialog",
            onClick: () => {
              setOpen(false);
              onAnalyticsOpenChange(true);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ChartIcon, {}),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: t("analyticsOpen") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ChevronRight, {})
            ]
          }
        ) : null,
        current ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: UsagePill_default.foot, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
          t("usageLastUpdated"),
          " ",
          new Date(current.updatedAt).toLocaleString(getLocale?.())
        ] }) }) : null
      ] }) })
    ] })
  ] });
}

// src/client/usage.ts
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
function registerUsagePill(ctx, settings, selectAccount) {
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
      let analytics;
      scope.inject(["remote.opencodeGoAnalytics"], (withAnalytics) => {
        analytics = async (query, signal) => {
          const result = await withAnalytics.remote.opencodeGoAnalytics.read(query, signal);
          if (!result.ok) throw result.error;
          return result.value;
        };
      });
      const readAnalytics = async (query, signal) => {
        if (analytics === void 0) throw Object.assign(new Error("OpenCode Go analytics is unavailable in this session"), {
          code: "opencode-go/analytics-unavailable",
          details: { reason: "no-session-query", retryable: false }
        });
        return analytics(query, signal);
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
            return selectAccount ? selectAccount(ref).catch(() => false) : false;
          },
          readUsage,
          readAnalytics,
          getLocale: () => ready.locale.getLocale().active,
          t: (key) => translate(key)
        })
      }, UsagePill));
    });
  });
}

// src/client/host-compat.ts
function mountSettingsScopes(ctx, mount) {
  ctx.inject(["configForms", "remote.opencodeGoModels"], (child) => {
    const forms = child.get("configForms");
    mount(child, forms.get(PROFILE_ENTRY_ID));
  });
  ctx.inject(["settingsScope", "remote.opencodeGoModels"], (child) => {
    mount(child, child.settingsScope.bind({
      namespace: SETTINGS_NAMESPACE,
      decode: (section) => typeof section === "object" && section !== null ? section : void 0
    }));
  });
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

// src/client/index.ts
var NS = "settings.opencode-go";
var inject = ["slots", "locale", "remote", "remote.credentials", "remote.llm"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "llm-opencode-go: copy dictionaries");
  const modelsReady = ctx.remote.$mount(goRemote);
  ctx.effect(async () => await modelsReady);
  mountSettingsScopes(ctx, (child, scope) => mountSettings(child, scope, modelsReady));
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
  let readAnalytics;
  ctx.inject(["remote.opencodeGoAnalytics"], (ready) => {
    readAnalytics = async (query, signal) => {
      const result = await ready.remote.opencodeGoAnalytics.read(query, signal);
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
  }, executeAccountCommand, async (query) => {
    if (readAnalytics === void 0) throw Object.assign(new Error("OpenCode Go analytics is unavailable in this session"), {
      code: "opencode-go/analytics-unavailable",
      details: { reason: "no-session-query", retryable: false }
    });
    return readAnalytics(query);
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
