/** English and Chinese copy, palette tokens and local theme preferences. */
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'

/** Copy dictionaries for the OpenCode Go settings page. English is the key-set source of truth. */

export const en = {
  accountsTitle: 'Accounts',
  accountsRefresh: 'Refresh accounts',
  accountsBlocked: 'Wait for the current settings change to finish before changing accounts.',
  accountsEmpty: 'Add an account to use OpenCode Go.',
  accountsWriteFailed: 'Could not apply the account change. Your input is kept; please retry.',
  accountsReadFailed: 'Could not read account status. Please refresh.',
  accountsCleanupFailed: 'The account entry was removed, but its stored key could not be deleted. Remove the unused reference through the host credential service.',
  accountsRemoveKeyFailed: 'The stored key could not be deleted, so the account was kept. Please retry.',
  accountsStatusUnknown: 'Status unknown',
  accountDefault: 'Default account',
  accountAdd: 'Add account',
  accountRename: 'Rename',
  accountReplaceKey: 'Replace key',
  accountRemove: 'Remove account',
  accountRemoveHint: 'Remove “{name}”? If it is the current account, the next account takes over. Keys added here are deleted from the credential service; existing external references are kept.',
  accountName: 'Account name',
  accountKeyHint: 'The key is saved through the host credential service and is never returned to this page.',
  accountConfirm: 'Confirm',
  accountCancel: 'Cancel',
  accountAutoSwitch: 'Automatic fallback',
  accountAutoSwitchHint: 'When a quota runs out or a key is unusable, the other accounts are tried in order; the account that starts producing output moves to the first position and becomes current.',
  accountPreferredTag: 'Current',
  accountSwitchAction: 'Switch',
  accountSwitchTitle: 'Switch account',
  accountSwitchBack: 'Back to usage',
  accountSwitchHint: 'This account moves to the first position and serves later requests in this profile. The other accounts keep their relative order.',
  accountSwitchFailed: 'Could not switch account. Please retry.',
  accountFallbackQuota: 'The current account reached its quota; switched to',
  accountFallbackCredential: 'The current key was unavailable or rejected; switched to',
  accountsSummary: '{count} accounts · Current {name}',
  accountsSummaryEmpty: 'No accounts yet',
  accountsAvailability: '{ready}/{total} configured',
  accountsAvailabilityFailed: '{ready}/{total} configured · {failed} unreadable',
  accountsDetails: 'Details for {name}',
  accountsDetailsHide: 'Hide details for {name}',
  accountDragHandle: 'Reorder {name}',
  accountConfigureHint: 'Add a key to read usage',
  usageResetMinutes: 'resets in {minutes} min',
  usageResetHours: 'resets in {hours} h',
  usageResetDays: 'resets in {days} d',
  usageResetDue: 'resets now',
  usageResetUnknown: 'reset time unknown',
  usageTitle: 'OpenCode Go usage',
  usageRollingShort: '5h',
  usageWeekShort: 'week',
  usage_rolling: '5 hours',
  usage_weekly: 'Weekly',
  usage_monthly: 'Monthly',
  usageResets: 'Resets',
  usageLimited: 'Limit reached',
  usageLoading: 'Loading usage…',
  usageUnavailable: 'Unavailable',
  usageStaleShort: 'Last data',
  usageFallbackShort: 'fallback',
  usageStaleHint: 'Showing the last successful usage reading. Current usage may have changed.',
  usageRefreshFailed: 'Refresh failed',
  usageLastUpdated: 'Last updated',
  usageRetry: 'Retry now',
  usageRefreshing: 'Refreshing…',
  analyticsOpen: 'Usage analytics',
  analyticsTitle: 'Usage analytics',
  analyticsSubtitle: 'This plugin’s requests · includes closed sessions · estimates, not an invoice',
  analyticsClose: 'Close usage analytics',
  analyticsRange: 'Date range',
  analyticsRangeToday: 'Today',
  analyticsRange7d: '7 days',
  analyticsRange30d: '30 days',
  analyticsRange90d: '90 days',
  analyticsRefresh: 'Refresh',
  analyticsRetry: 'Retry',
  analyticsLoading: 'Scanning local sessions…',
  analyticsEmpty: 'No requests from this plugin in the selected range.',
  analyticsUnsupported: 'This DSH version cannot read local session history.',
  analyticsFailed: 'Could not read usage analytics.',
  analyticsRequests: 'Requests',
  analyticsTokens: 'Tokens',
  analyticsSpend: 'Estimated spend',
  analyticsCoverage: 'Coverage',
  analyticsSessions: 'sessions',
  analyticsSeconds: 'scan',
  analyticsSummaries: 'summaries',
  analyticsUnsettled: 'unsettled',
  analyticsByModel: 'By model',
  analyticsByDay: 'By day',
  analyticsInput: 'in',
  analyticsOutput: 'out',
  analyticsCacheRead: 'cache',
  analyticsPriced: 'priced',
  analyticsUnpriced: 'unpriced',
  analyticsMissing: 'missing usage',
  analyticsFailedSessions: 'unreadable',
  analyticsUnattributed: 'Unattributed activity:',
  analyticsUnread: 'Sessions left unread at the budget or cap:',
  analyticsScanSegments: 'Time spent in ms, list / scan / pricing:',
  analyticsStaleResults: 'Showing the previous scan; the new one is running.',
  analyticsTruncated: 'Only the most recent history was scanned.',
  analyticsScanMore: 'Scan more history',
  analyticsPriceSource: 'Prices:',
  analyticsNotInvoice: 'Estimates are not an invoice; official percentages remain authoritative; spend applies current OpenCode /models prices across all history.',
  analyticsPricingUnavailable: 'prices unavailable',
  analyticsLegacy: 'Includes pre-0.1.16 route requests:',
  analyticsCardTitle: 'Usage analytics',
  analyticsCardHint: 'Requests from this plugin, including closed sessions, with per-model cost estimates. Opening scans local sessions; nothing is uploaded.',
  analyticsBoardLabel: 'Dashboard',
  analyticsOpenBoard: 'Open dashboard',
  analyticsQuota: 'Quota',
  analyticsQuotaHint: 'Official percentages · refreshed every minute',
  analyticsQuotaFailed: 'Quota is temporarily unavailable; usage statistics are still shown.',
  analyticsChartSpend: 'Cost',
  analyticsChartTokens: 'Tokens',
  analyticsKicker: 'Usage report',
  analyticsLead: 'In the selected range, this plugin made {requests} requests, used {tokens} tokens and an estimated {spend}.',
  analyticsLeadTop: '{model} accounts for {share} of that estimate.',
  analyticsComposition: 'Spend composition',
  analyticsCompositionHint: 'Estimated amount · priced models only',
  analyticsCompositionOther: 'Other {count}',
  analyticsCompositionFree: 'Also free or unpriced:',
  analyticsModel: 'Model',
  analyticsCost: 'Cost',
  analyticsShare: 'Share',
  analyticsCacheHit: 'cache hit',
  analyticsDailyAverage: 'Daily avg',
  analyticsPeak: 'Peak',
  analyticsTotal: 'Total',
  themeLabel: 'Theme',
  themeSilentBlack: 'Silent Black',
  themeGraphite: 'Graphite',
  themeSeaSalt: 'Sea Salt',
  themeWarmSand: 'Warm Sand',
  themeHint: 'Applies to the pill and the dashboard only.',
  nav: 'OpenCode Go',
  title: 'OpenCode Go',
  titleLabel: 'OpenCode Go',
  intro: 'Choose the OpenCode Go and platform free models shown in conversations and adjust their capacities.',
  starProject: 'Enjoying the plugin? Star it on GitHub',
  starProjectTitle: 'Open the GitHub project in a new tab',
  enabledLabel: 'Enable OpenCode Go and Free',
  enabledHint: 'Enables the Free route; Go also requires a usable API key. Turning this off withdraws both routes immediately.',
  enabledOff: 'OpenCode Go and Free are off: their models are withdrawn from every picker.',
  enabledUnavailable: 'This deployment pins the switch on in its composition, so it cannot be changed here.',
  keyLabel: 'API key',
  keyHint: 'From your OpenCode Go subscription (opencode.ai). Leaving this blank keeps the key already saved, and a saved key applies to the next request without a restart.',
  keyConfigured: 'Key saved',
  keyMissing: 'No key yet',
  keyNotWritable: 'This key is supplied from outside the settings document (an environment variable, for example), so it cannot be changed here.',
  modelsLabel: 'Available models',
  modelSourcesLabel: 'Model source',
  modelsGoTab: 'OpenCode Go models',
  modelsFreeTab: 'OpenCode platform free models',
  modelsGoSource: 'Go model source',
  modelsFreeSource: 'Free model source',
  modelsRefresh: 'Refresh',
  modelsLoading: 'Reading the gateway model list…',
  modelsFailed: 'Could not read the gateway model list.',
  modelsStale: 'Some model data could not be refreshed. Available cached data is still in use, including in conversation pickers.',
  modelsSourceFailed: 'Refresh failed',
  modelsSourceCurrent: 'Up to date',
  modelsSourceNeverFetched: 'No successful fetch yet',
  modelsSourceUpdated: 'Last successful check: {time}',
  modelsRefreshing: 'Refreshing… Keeping the last fetched models visible.',
  modelsEmpty: 'The gateway currently serves no model this adapter can route.',
  limitsLabel: 'Model capacities',
  limitsHint: 'Capacities come from the online configuration; blank keeps the default and Save applies your overrides.',
  limitsFilterLabel: 'Find a model',
  limitsFilterPlaceholder: 'Search by model name or id…',
  limitsSummary: '{count} customized',
  limitsModel: 'Model',
  limitsContext: 'Context window',
  limitsOutput: 'Max output',
  thinkingBudgets: 'Thinking budgets',
  thinkingBudgetsHint: 'Add token budgets to the conversation picker, then Save. Range: {min}–{max} tokens. Existing reasoning choices stay available; Default uses the service settings. The SDK may reduce a budget to leave room for the answer.',
  thinkingBudgetAddLabel: 'New thinking budget for {name}',
  thinkingBudgetAdd: 'Add',
  thinkingBudgetRemove: 'Remove {value} token budget',
  capacityDefault: 'Default: {value} tokens',
  capacityMissing: 'API did not provide a value',
  modalityLabel: 'Input modalities',
  modalityText: 'Text',
  modalityImage: 'Image',
  modalityAudio: 'Audio',
  modalityVideo: 'Video',
  modalityPdf: 'PDF',
  modalityUnknown: 'Not declared',
  modalitiesSource: 'Input modalities come from the online /models configuration.',
  modalitiesForwarding: 'This plugin converts and forwards image attachments only.',
  visibilityHint: 'Only enabled models appear in conversation pickers. Changes apply immediately. Deprecated models are off by default and can be enabled individually.',
  modelVisibleLabel: 'Show {name} in conversations',
  configurationMissing: 'Configuration missing',
  configurationMissingHint: 'The gateway lists this model, but no usable OpenCode Go configuration is available. Once the upstream configuration is supplied or corrected, refresh the list to enable it.',
  configurationUnavailable: 'Configuration unavailable',
  pickerFailed: 'Could not update model visibility. Please retry.',
  deprecatedBadge: 'Deprecated',
  deprecatedHint: 'Marked deprecated by /models, but still provided by this gateway.',
  newHint: 'Released within the last seven UTC calendar days, according to /models.',
  newBadge: 'NEW',
  releaseSource: 'Release date: {date} · /models',
  modelDetails: 'Model configuration',
  filterLabel: 'Filter models',
  filterAll: 'All',
  filterNew: 'New in 7 days',
  filterCustom: 'Customized',
  filterDeprecated: 'Deprecated',
  limitsResetModel: 'Use catalog',
  limitsResetAll: 'Clear all overrides',
  limitsNoMatches: 'No models match “{query}”. Try a different name or id.',
  limitsEmpty: 'Read the model list first; capacities are edited per model the gateway serves.',
  limitsContextLabel: 'Context window for {name}',
  limitsOutputLabel: 'Max output for {name}',
  advancedResetAll: 'Reset all to defaults',
  advancedLabel: 'Advanced settings',
  groupUsage: 'Usage settings',
  groupConnection: 'Connection',
  groupCacheTimeouts: 'Cache and timeouts',
  groupImages: 'Image handling',
  advancedHint: 'The inherited values work as they are; below are only the settings you may need to change.',
  usageDisplayLabel: 'Usage display',
  usageDisplayHint: 'Auto shows it only for DSH OpenCode Go models; Always keeps it visible with any model; Off hides it and stops polling. While visible it refreshes every minute.',
  usageDisplay_auto: 'Auto (default)',
  usageDisplay_always: 'Always',
  usageDisplay_off: 'Off',
  freeBaseURLLabel: 'Free gateway URL',
  freeBaseURLHint: 'Discovers platform chat models with explicitly zero text, cache and tier prices. Without a saved key, requests use public access.',
  baseURLLabel: 'Go gateway URL',
  baseURLHint: 'The official Go gateway selects each model’s protocol endpoint automatically. Custom gateways use the configured prefix.',
  proxyURLLabel: 'Proxy address',
  proxyURLHint: 'The HTTP(S) or SOCKS5 proxy for conversations, catalog refreshes and usage queries; leave empty for the default network.',
  proxyURLInvalid: 'Enter an http://, https:// or socks5:// proxy address without a path, query or fragment.',
  refreshMinutesLabel: 'Catalog refresh (minutes)',
  refreshMinutesHint: 'How long the model catalog is cached; opening this page or refreshing re-checks it immediately.',
  streamIdleTimeoutMsLabel: 'Stream idle timeout (ms)',
  streamIdleTimeoutMsHint: 'The longest silence between stream events; a longer gap fails the request.',
  maxImagesLabel: 'Request image count cap (maxImages)',
  maxImagesHint: 'Leave empty to inherit the base configuration (uncapped only when the base sets none); above the cap the oldest images become text placeholders.',
  maxRequestImageBytesLabel: 'Request image payload cap (bytes)',
  maxRequestImageBytesHint: 'The cap on the accumulated base64 image payload in one request.',
  requestImagePixelBudgetLabel: 'Image pixel budget',
  requestImagePixelBudgetHint: 'The total pixel budget of one image after conversion.',
  requestImageMaxBytesLabel: 'Image byte target (bytes)',
  requestImageMaxBytesHint: 'The original byte target of one image before base64 expansion.',
  overridden: 'Customized',
  reset: 'Reset to default',
  invalidValue: 'Not a valid value',
  save: 'Save',
  discard: 'Discard',
  saving: 'Saving…',
  savedFailed: 'The last save did not land as staged; correct the values or discard.',
  readOnly: 'The settings document is read-only in this deployment.',
  unavailable: 'The OpenCode Go settings are not served in this deployment.',
}

/** Chinese copy; the key set mirrors {@link en}. */
export const zh: typeof en = {
  accountsTitle: '账号',
  accountsRefresh: '刷新额度',
  accountsBlocked: '请等待当前设置保存完成，再切换或修改账号。',
  accountsEmpty: '添加账号后即可使用 OpenCode Go。',
  accountsWriteFailed: '账号修改未生效，输入已保留，请重试。',
  accountsReadFailed: '未能读取账号状态，请刷新重试。',
  accountsCleanupFailed: '账号条目已移除，但保存的 Key 未能删除。请通过宿主凭据服务删除未使用的引用。',
  accountsRemoveKeyFailed: '未能删除已保存的 Key，账号暂时保留，请重试。',
  accountsStatusUnknown: '状态未知',
  accountDefault: '默认账号',
  accountAdd: '添加账号',
  accountRename: '重命名',
  accountReplaceKey: '替换 Key',
  accountRemove: '删除账号',
  accountRemoveHint: '删除“{name}”？若它是当前账号，将使用下一个账号。在这里添加的 Key 会从凭据服务删除；已有外部引用会保留。',
  accountName: '账号名称',
  accountKeyHint: 'Key 通过宿主凭据服务保存，页面不会回显已保存的密钥。',
  accountConfirm: '确认',
  accountCancel: '取消',
  accountAutoSwitch: '自动使用备用账号',
  accountAutoSwitchHint: '额度耗尽或 Key 不可用时，按顺序尝试其他账号；开始正常输出的账号会移至首位并成为当前账号。',
  accountPreferredTag: '当前账号',
  accountSwitchAction: '切换',
  accountSwitchTitle: '切换账号',
  accountSwitchBack: '返回额度',
  accountSwitchHint: '切换后，该账号移至首位，供本 profile 的后续请求使用；其他账号的相对顺序保持不变。',
  accountSwitchFailed: '账号切换未生效，请重试。',
  accountFallbackQuota: '当前账号额度耗尽，已自动切换为：',
  accountFallbackCredential: '当前 Key 不可用或被拒绝，已自动切换为：',
  accountsSummary: '{count} 个 · 当前 {name}',
  accountsSummaryEmpty: '尚未添加账号',
  accountsAvailability: '{ready}/{total} 已配置',
  accountsAvailabilityFailed: '{ready}/{total} 已配置 · {failed} 个读取失败',
  accountsDetails: '{name} 的详情',
  accountsDetailsHide: '收起 {name} 的详情',
  accountDragHandle: '拖动 {name} 调整顺序',
  accountConfigureHint: '配置 Key 后显示额度',
  usageResetMinutes: '{minutes} 分钟后重置',
  usageResetHours: '{hours} 小时后重置',
  usageResetDays: '{days} 天后重置',
  usageResetDue: '即将重置',
  usageResetUnknown: '重置时间未知',
  usageTitle: 'OpenCode Go 用量',
  usageRollingShort: '5小时',
  usageWeekShort: '周',
  usage_rolling: '5 小时',
  usage_weekly: '每周',
  usage_monthly: '每月',
  usageResets: '重置于',
  usageLimited: '已达限额',
  usageLoading: '正在读取用量…',
  usageUnavailable: '暂不可用',
  usageStaleShort: '上次数据',
  usageFallbackShort: '已回退',
  usageStaleHint: '当前显示上次成功读取的用量，实际用量可能已变化。',
  usageRefreshFailed: '刷新失败',
  usageLastUpdated: '更新于',
  usageRetry: '立即重试',
  usageRefreshing: '正在刷新…',
  analyticsOpen: '用量统计',
  analyticsTitle: '用量统计',
  analyticsSubtitle: '本插件请求 · 含已关闭会话 · 估算金额非账单',
  analyticsClose: '关闭用量统计',
  analyticsRange: '时间范围',
  analyticsRangeToday: '今天',
  analyticsRange7d: '7 天',
  analyticsRange30d: '30 天',
  analyticsRange90d: '90 天',
  analyticsRefresh: '刷新',
  analyticsRetry: '重试',
  analyticsLoading: '正在扫描本地会话…',
  analyticsEmpty: '所选区间内没有本插件的请求。',
  analyticsUnsupported: '当前 DSH 版本无法读取本地会话历史。',
  analyticsFailed: '未能读取用量统计。',
  analyticsRequests: '请求',
  analyticsTokens: 'Token',
  analyticsSpend: '估算花费',
  analyticsCoverage: '覆盖',
  analyticsSessions: '个会话',
  analyticsSeconds: '扫描',
  analyticsSummaries: '压缩摘要',
  analyticsUnsettled: '未结算',
  analyticsByModel: '按模型',
  analyticsByDay: '按天',
  analyticsInput: '输入',
  analyticsOutput: '输出',
  analyticsCacheRead: '缓存',
  analyticsPriced: '已计价',
  analyticsUnpriced: '未计价',
  analyticsMissing: '缺用量',
  analyticsFailedSessions: '读取失败',
  analyticsUnattributed: '未归属活动：',
  analyticsUnread: '预算或上限截止时未读取的会话：',
  analyticsScanSegments: '耗时毫秒，列表 / 扫描 / 定价：',
  analyticsStaleResults: '以下为上一轮结果，新一轮扫描进行中。',
  analyticsTruncated: '仅扫描了最近的部分历史。',
  analyticsScanMore: '扫描更多历史',
  analyticsPriceSource: '价格来源：',
  analyticsNotInvoice: '估算金额非账单；官方额度百分比仍为权威值；费用按当前 /models 价目对全部历史请求估算。',
  analyticsPricingUnavailable: '价格暂不可用',
  analyticsLegacy: '含 0.1.16 之前的旧路由请求：',
  analyticsCardTitle: '用量统计',
  analyticsCardHint: '统计本插件的请求（含已关闭会话），按模型估算金额。打开时扫描本地会话，不上传。',
  analyticsBoardLabel: '看板',
  analyticsOpenBoard: '打开看板',
  analyticsQuota: '额度',
  analyticsQuotaHint: '官方百分比 · 每分钟刷新',
  analyticsQuotaFailed: '额度暂不可用，统计结果仍会显示。',
  analyticsChartSpend: '金额',
  analyticsChartTokens: 'Token',
  analyticsKicker: '用量报告',
  analyticsLead: '所选区间内，本插件发起了 {requests} 次请求，消耗 {tokens} Token，估算 {spend}。',
  analyticsLeadTop: '其中 {model} 占 {share}。',
  analyticsComposition: '花费构成',
  analyticsCompositionHint: '按估算金额 · 仅含已计价模型',
  analyticsCompositionOther: '其他 {count}',
  analyticsCompositionFree: '另有免费或未计价模型：',
  analyticsModel: '模型',
  analyticsCost: '花费',
  analyticsShare: '占比',
  analyticsCacheHit: '缓存命中',
  analyticsDailyAverage: '日均',
  analyticsPeak: '峰值',
  analyticsTotal: '合计',
  themeLabel: '主题',
  themeSilentBlack: '寂静黑',
  themeGraphite: '石墨',
  themeSeaSalt: '海盐青',
  themeWarmSand: '暖砂',
  themeHint: '仅作用于额度胶囊和用量看板。',
  nav: 'OpenCode Go',
  title: 'OpenCode Go',
  titleLabel: 'OpenCode Go',
  intro: '分别选择会话中显示的 OpenCode Go 与平台免费模型，并调整其容量。',
  starProject: '喜欢这个插件？去 GitHub 点个 Star',
  starProjectTitle: '在新标签页打开 GitHub 项目',
  enabledLabel: '启用 OpenCode Go 与 Free',
  enabledHint: '开启后启用 Free 路由；Go 路由还需要可用的 API Key。关闭后立即撤下两个路由。',
  enabledOff: 'OpenCode Go 与 Free 已关闭：两个路由的模型均已从选择器撤下。',
  enabledUnavailable: '此部署在组合层固定开启了该开关，无法在此修改。',
  keyLabel: 'API key',
  keyHint: '来自你的 OpenCode Go 订阅（opencode.ai）。留空表示保持已保存的 key；保存后下一次请求即生效，无需重启。',
  keyConfigured: '已配置 key',
  keyMissing: '尚未配置',
  keyNotWritable: '该 key 由设置文档之外的来源提供（例如环境变量），无法在此修改。',
  modelsLabel: '可用模型',
  modelSourcesLabel: '模型来源',
  modelsGoTab: 'OpenCode Go 模型',
  modelsFreeTab: 'OpenCode 平台免费模型',
  modelsGoSource: 'Go 模型源',
  modelsFreeSource: 'Free 模型源',
  modelsRefresh: '刷新',
  modelsLoading: '正在读取网关模型列表…',
  modelsFailed: '未能读取网关模型列表。',
  modelsStale: '部分模型数据刷新失败，正在继续使用可用的缓存配置；会话选择器也使用这份数据。',
  modelsSourceFailed: '刷新失败',
  modelsSourceCurrent: '已更新',
  modelsSourceNeverFetched: '尚未成功获取',
  modelsSourceUpdated: '上次成功检查：{time}',
  modelsRefreshing: '正在刷新，暂时保留上次获取的模型。',
  modelsEmpty: '网关当前没有本适配器可路由的模型。',
  limitsLabel: '模型容量',
  limitsHint: '容量来自在线模型配置；留空用默认值，保存后生效。',
  limitsFilterLabel: '查找模型',
  limitsFilterPlaceholder: '按模型名称或 ID 搜索…',
  limitsSummary: '{count} 个已自定义',
  limitsModel: '模型',
  limitsContext: '上下文窗口',
  limitsOutput: '最大输出',
  thinkingBudgets: '思考预算',
  thinkingBudgetsHint: '添加 token 预算并保存，即可在会话中选择。范围：{min}–{max} tokens。保留原有思考选项；“默认”使用服务商设置。SDK 会按剩余输出空间缩小预算，为回答留出空间。',
  thinkingBudgetAddLabel: '为 {name} 添加思考预算',
  thinkingBudgetAdd: '添加',
  thinkingBudgetRemove: '移除 {value} token 预算',
  capacityDefault: '默认：{value} tokens',
  capacityMissing: 'API 未提供',
  modalityLabel: '输入模态',
  modalityText: '文本',
  modalityImage: '图像',
  modalityAudio: '音频',
  modalityVideo: '视频',
  modalityPdf: 'PDF',
  modalityUnknown: '未声明',
  modalitiesSource: '输入模态来自 /models 的在线配置。',
  modalitiesForwarding: '本插件目前仅转换并转发图像附件。',
  visibilityHint: '开启的模型才会显示在会话选择器中，修改立即生效。过时模型默认关闭，可单独开启。',
  modelVisibleLabel: '在会话中显示 {name}',
  configurationMissing: '配置缺失',
  configurationMissingHint: '网关已列出此模型，但暂未获得可用的 OpenCode Go 配置。上游补齐或修正配置后，刷新列表即可开启。',
  configurationUnavailable: '配置暂不可用',
  pickerFailed: '模型显示设置未更新，请重试。',
  deprecatedBadge: '已弃用',
  deprecatedHint: '/models 标记为已弃用，当前网关仍提供此模型。',
  newHint: '依据 /models 发布日期，近七个 UTC 日历日内发布。',
  newBadge: '新',
  releaseSource: '发布日期：{date} · /models',
  modelDetails: '模型配置',
  filterLabel: '筛选模型',
  filterAll: '全部',
  filterNew: '近 7 天发布',
  filterCustom: '已自定义',
  filterDeprecated: '过时模型',
  limitsResetModel: '使用目录值',
  limitsResetAll: '清除全部覆盖',
  limitsNoMatches: '没有匹配“{query}”的模型。请尝试其他名称或 ID。',
  limitsEmpty: '请先读取模型列表；容量按网关提供的模型逐个编辑。',
  limitsContextLabel: '{name} 的上下文窗口',
  limitsOutputLabel: '{name} 的最大输出',
  advancedResetAll: '全部恢复默认',
  advancedLabel: '高级设置',
  groupUsage: '用量设置',
  groupConnection: '连接',
  groupCacheTimeouts: '缓存与超时',
  groupImages: '图片处理',
  advancedHint: '继承来的取值即可正常使用；下面只列需要改的项。',
  usageDisplayLabel: '额度显示',
  usageDisplayHint: '自动：仅选中 DSH OpenCode Go 模型时显示；常驻：任意模型都显示；关闭：隐藏并停止刷新。显示时每分钟刷新。',
  usageDisplay_auto: '自动（默认）',
  usageDisplay_always: '常驻',
  usageDisplay_off: '关闭',
  freeBaseURLLabel: '免费网关地址',
  freeBaseURLHint: '发现已明确声明文本、缓存及阶梯价格全为零的平台聊天模型。未配置可用 Key 时使用公共访问。',
  baseURLLabel: 'Go 网关地址',
  baseURLHint: '官方 Go 网关自动选择模型对应的协议端点；自定义网关使用填写的请求前缀。',
  proxyURLLabel: '代理地址',
  proxyURLHint: '对话、目录刷新与用量查询使用的 HTTP(S)/SOCKS5 代理；留空使用默认网络。',
  proxyURLInvalid: '请输入 http://、https:// 或 socks5:// 代理地址，不包含路径、查询参数或片段。',
  refreshMinutesLabel: '目录刷新（分钟）',
  refreshMinutesHint: '模型目录的缓存时长；打开本页或点击刷新会立即重新核对。',
  streamIdleTimeoutMsLabel: '流空闲超时（毫秒）',
  streamIdleTimeoutMsHint: '流事件之间的最大静默间隔，超出则请求失败。',
  maxImagesLabel: '请求图片数量上限（maxImages）',
  maxImagesHint: '留空继承基础配置（基础未设上限时才不限制张数）；超限时最旧的图片会被替换为文字占位。',
  maxRequestImageBytesLabel: '请求图片载荷上限（字节）',
  maxRequestImageBytesHint: '单个请求累计 base64 图片载荷的上限。',
  requestImagePixelBudgetLabel: '图片像素预算',
  requestImagePixelBudgetHint: '单张图片转换后的总像素预算。',
  requestImageMaxBytesLabel: '图片字节目标（字节）',
  requestImageMaxBytesHint: '单张图片 base64 扩展前的原始编码字节目标。',
  overridden: '已自定义',
  reset: '恢复默认',
  invalidValue: '不是有效值',
  save: '保存',
  discard: '放弃',
  saving: '保存中…',
  savedFailed: '上次保存未按草稿生效；请修正数值或放弃修改。',
  readOnly: '此部署中设置文档为只读。',
  unavailable: '此部署未提供 OpenCode Go 设置。',
}

/** Every copy key this page's dictionaries must supply. */
export type OpencodeGoKey = keyof typeof en

/** One palette's six theme colors plus the neutral surface steps. */
export interface GoThemeTokens {
  readonly bg: string
  readonly surface: string
  readonly surface2: string
  readonly border: string
  readonly text: string
  readonly muted: string
  readonly accent: string
  readonly accent2: string
  readonly success: string
  readonly warning: string
  readonly danger: string
}

/** The four selectable styles. */
export const GO_THEMES = ['silent-black', 'graphite', 'sea-salt', 'warm-sand'] as const

export type GoThemeId = typeof GO_THEMES[number]

/** Graphite is the default: it is the quietest match for the Host chrome. */
export const DEFAULT_GO_THEME: GoThemeId = 'graphite'

/** Locale key carrying each theme's display name. */
export const GO_THEME_LABELS: Record<GoThemeId, keyof typeof en> = {
  'silent-black': 'themeSilentBlack',
  graphite: 'themeGraphite',
  'sea-salt': 'themeSeaSalt',
  'warm-sand': 'themeWarmSand',
}

/** Each style in both Host color schemes. */
export const GO_THEME_TOKENS: Record<GoThemeId, { dark: GoThemeTokens; light: GoThemeTokens }> = {
  'silent-black': {
    dark: {
      bg: '#101010', surface: '#181818', surface2: '#202020', border: '#2b2b2b',
      text: '#e8e8e8', muted: '#8c8c8c', accent: '#4098f8', accent2: '#8b5cf6',
      success: '#40b870', warning: '#f88830', danger: '#e5484d',
    },
    light: {
      bg: '#f8f8f8', surface: '#ffffff', surface2: '#f0f0f0', border: '#e4e4e4',
      text: '#1c1c1c', muted: '#757575', accent: '#0878f8', accent2: '#8250df',
      success: '#188838', warning: '#e07800', danger: '#d9363e',
    },
  },
  graphite: {
    dark: {
      bg: '#111214', surface: '#181a1e', surface2: '#202329', border: '#2a2e36',
      text: '#edeff3', muted: '#9aa1ac', accent: '#6e8bff', accent2: '#a371f7',
      success: '#3fb950', warning: '#d29922', danger: '#f85149',
    },
    light: {
      bg: '#f6f7f9', surface: '#ffffff', surface2: '#f0f2f5', border: '#e3e6ea',
      text: '#1f2328', muted: '#6e7781', accent: '#4f6bed', accent2: '#8250df',
      success: '#1a7f37', warning: '#9a6700', danger: '#cf222e',
    },
  },
  'sea-salt': {
    dark: {
      bg: '#0b1416', surface: '#111d20', surface2: '#182a2e', border: '#24383c',
      text: '#e6f0f1', muted: '#8fa6ab', accent: '#2dd4bf', accent2: '#60a5fa',
      success: '#34d399', warning: '#fbbf24', danger: '#fb7185',
    },
    light: {
      bg: '#f3f8f8', surface: '#ffffff', surface2: '#eaf3f3', border: '#d8e6e6',
      text: '#13262b', muted: '#5f7478', accent: '#0e8c8f', accent2: '#3b82f6',
      success: '#2f9e6b', warning: '#c98a2b', danger: '#d9534f',
    },
  },
  'warm-sand': {
    dark: {
      bg: '#14110e', surface: '#1d1915', surface2: '#27211a', border: '#352d24',
      text: '#f4eee6', muted: '#a99c8d', accent: '#e08a62', accent2: '#7c9eff',
      success: '#4ade80', warning: '#fbbf24', danger: '#fb7185',
    },
    light: {
      bg: '#f7f3ec', surface: '#fffdf9', surface2: '#f1eae0', border: '#e6dccd',
      text: '#241f1a', muted: '#7a6f63', accent: '#c96f4a', accent2: '#4f7cff',
      success: '#3e8e63', warning: '#c98a2b', danger: '#c0504d',
    },
  },
}

const STORAGE_KEY = 'dsh-opencode-go.theme'

const listeners = new Set<() => void>()

function isGoTheme(value: unknown): value is GoThemeId {
  return typeof value === 'string' && (GO_THEMES as readonly string[]).includes(value)
}

function readStored(): GoThemeId {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)
    return isGoTheme(value) ? value : DEFAULT_GO_THEME
  } catch {
    return DEFAULT_GO_THEME
  }
}

let currentTheme: GoThemeId = readStored()

/** The selected style, stable until the next write. */
export function getGoTheme(): GoThemeId {
  return currentTheme
}

/**
 * Select a style and persist it for this browser.
 * @param id - one of {@link GO_THEMES}; unknown ids are ignored.
 */
export function setGoTheme(id: GoThemeId): void {
  if (!isGoTheme(id) || id === currentTheme) return
  currentTheme = id
  try { globalThis.localStorage?.setItem(STORAGE_KEY, id) } catch { /* private mode */ }
  for (const listener of listeners) listener()
}

/** Subscribe to style changes (for useSyncExternalStore). */
export function subscribeGoTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Read the selected style in a component. */
export function useGoTheme(): GoThemeId {
  return useSyncExternalStore(subscribeGoTheme, getGoTheme, () => DEFAULT_GO_THEME)
}

/**
 * Follow the Host's light/dark scheme. The layout presenter marks a dark body
 * with `data-ds-dark-theme`; the attribute is observed so switching the Host
 * theme updates the surfaces without a reload.
 */
export function useHostScheme(): 'dark' | 'light' {
  const [scheme, setScheme] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    if (body === null) return
    const update = (): void => {
      setScheme(body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light')
    }
    update()
    // The SSR/client fixture ships a minimal DOM; observing is an enhancement.
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(update)
    observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => { observer.disconnect() }
  }, [])
  return scheme
}

/** The active style's tokens for the Host's current scheme. */
export function useGoThemeTokens(): GoThemeTokens {
  const id = useGoTheme()
  const scheme = useHostScheme()
  return GO_THEME_TOKENS[id][scheme]
}

/**
 * Inline custom properties consumed by the pill and dialog styles.
 * @param tokens - the active palette.
 * @returns a style object carrying every `--go-*` variable.
 */
export function themeStyle(tokens: GoThemeTokens): CSSProperties {
  return {
    '--go-bg': tokens.bg,
    '--go-surface': tokens.surface,
    '--go-surface-2': tokens.surface2,
    '--go-border': tokens.border,
    '--go-text': tokens.text,
    '--go-muted': tokens.muted,
    '--go-accent': tokens.accent,
    '--go-accent-2': tokens.accent2,
    '--go-success': tokens.success,
    '--go-warning': tokens.warning,
    '--go-danger': tokens.danger,
  } as CSSProperties
}
