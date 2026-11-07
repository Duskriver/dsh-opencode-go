import type { AnalyticsQuery, AnalyticsReport, AnalyticsTotals } from '../../src/contracts.ts'

export const analyticsCounts: AnalyticsTotals = {
  requests: '12', inputTokens: '1000', outputTokens: '2000', cacheReadTokens: '3000',
  cacheWrite5mTokens: '300', cacheWrite1hTokens: '200', cacheWriteTokens: '500',
  tokens: '6500', costMicroCents: '123400000',
}

export function createAnalyticsReport(query: Partial<AnalyticsQuery> = {}, overrides: Partial<AnalyticsReport> = {}): AnalyticsReport {
  return {
    accountRef: query.accountRef ?? 'OPENCODE_API_KEY', source: 'fixture-identity',
    generatedAt: Date.UTC(2026, 10, 6, 12), period: query.range ?? '30d',
    range: { from: Date.UTC(2026, 10, 5), to: Date.UTC(2026, 10, 6, 12) }, timeZone: 'UTC',
    totals: { ...analyticsCounts },
    byModel: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash', ...analyticsCounts }],
    byDay: [{ day: '2026-11-05', ...analyticsCounts }, { day: '2026-11-06', ...Object.fromEntries(Object.keys(analyticsCounts).map(key => [key, '0'])) as AnalyticsTotals }],
    ...overrides,
  }
}
