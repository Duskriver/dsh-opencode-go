/** Copy local to workspace history, following the active host locale. */
export const historyEn = {
  account: 'Viewing account', noAccounts: 'Add an account to view workspace history.', scope: 'All workspace clients · UTC calendar days',
  requests: 'Requests', tokens: 'Tokens', amount: 'Usage amount', cacheHit: 'Cache hit rate', input: 'Input', output: 'Output', cacheRead: 'Cache read', cacheWrite: 'Cache write',
  dailyAverage: 'Daily average', models: 'models', activeDays: 'active days',
  trend: 'Daily activity', trendHint: 'Select a day to inspect its usage.', tokensMode: 'Token breakdown', requestsMode: 'Request count',
  chartHelp: 'Arrow keys move between days. Click or tap to pin a day; Escape clears it.', selectDay: 'Hover, focus or tap a bar for daily details.',
  ranking: 'Model distribution', rankingHint: 'Compare models across this workspace.', details: 'Model details', model: 'Model', share: 'Token share',
  allModels: 'Show all models', fewerModels: 'Show fewer models', export: 'Export CSV', exporting: 'Exporting…', exportFailed: 'Could not export this range. Please retry.',
  refresh: 'Refresh history', refreshed: 'Updated', refreshing: 'Refreshing official history…', stale: 'Refresh failed. Showing the last successful result for this account and range.',
  loading: 'Loading official workspace history…', empty: 'No recorded usage in this range.', failed: 'Could not load workspace history.', retry: 'Try again',
  permission: 'This key cannot read history. Check its Usage read permission in OpenCode Console.', credentials: 'The selected account has no usable key. Update it in account settings.',
  unsupported: 'History is available for the official OpenCode gateway. This account uses another gateway.', pending: 'OpenCode is still preparing daily summaries. Please try again shortly.', invalid: 'OpenCode returned an unreadable history response. Please retry.',
  quota: 'Current allowance', quotaUnavailable: 'Allowance unavailable', rolling: '5 hours', weekly: 'Weekly', monthly: 'Monthly', resets: 'Resets',
  amountHint: 'Official usage amount is not a receipt or an extra charge for Go.', lagHint: 'Daily summaries may lag recent requests. Anonymous Free usage may not appear.',
  exportHint: 'CSV includes member and service-account fields supplied by Console.',
} as const
export type HistoryCopy = Record<keyof typeof historyEn, string>
export const historyZh: HistoryCopy = {
  account: '查看账号', noAccounts: '添加账号后即可查看工作区的用量历史。', scope: '包含工作区内所有客户端 · 按 UTC 日统计',
  requests: '请求数', tokens: 'Token', amount: '用量金额', cacheHit: '缓存命中率', input: '输入', output: '输出', cacheRead: '缓存读', cacheWrite: '缓存写',
  dailyAverage: '日均', models: '个模型', activeDays: '个活跃日', trend: '每日活动', trendHint: '选择一天，查看当日用量。', tokensMode: 'Token 构成', requestsMode: '请求数',
  chartHelp: '方向键切换日期；点击或轻触固定一天，Escape 取消选择。', selectDay: '悬停、聚焦或轻触柱形，查看当日明细。',
  ranking: '模型用量分布', rankingHint: '比较工作区内各模型的消耗。', details: '模型明细', model: '模型', share: 'Token 占比',
  allModels: '展开全部模型', fewerModels: '收起模型', export: '导出 CSV', exporting: '正在导出…', exportFailed: '导出失败，请重试。',
  refresh: '刷新历史', refreshed: '更新于', refreshing: '正在刷新官方历史…', stale: '刷新失败，以下为当前账号与区间上次成功读取的结果。',
  loading: '正在读取官方工作区历史…', empty: '所选区间暂无已记录的用量。', failed: '无法读取工作区用量历史。', retry: '重试',
  permission: '该 Key 无法读取历史，请在 OpenCode Console 检查 Usage 读取权限。', credentials: '所选账号没有可用 Key，请在账号设置中更新。',
  unsupported: '历史查询仅支持 OpenCode 官方网关，当前账号使用了其他网关。', pending: 'OpenCode 尚未生成每日汇总，请稍后重试。', invalid: 'OpenCode 返回的历史数据无法解析，请重试。',
  quota: '当前额度', quotaUnavailable: '额度暂不可用', rolling: '5 小时', weekly: '每周', monthly: '每月', resets: '重置于',
  amountHint: '官方用量金额不等同账单或 Go 套餐外的实际扣款。', lagHint: '每日汇总可能延迟，匿名 Free 调用可能不在其中。', exportHint: 'CSV 包含 Console 提供的成员和服务账号字段。',
}
export function historyCopy(locale?: string): HistoryCopy { return locale?.toLowerCase().startsWith('zh') ? historyZh : historyEn }
