/** Synthetic /models entries; no built-in model table or public network is used. */
export function protocolEntry(protocol = 'chat-completions', extra: Record<string, unknown> = {}) {
  return { [protocol]: { base_url: `https://opencode.ai/inference/go/${protocol === 'messages' ? 'anthropic/v1' : protocol === 'generate-content' ? 'google/v1beta' : 'openai/v1'}`,
    capabilities: { tools: { strict: true, updates: false } }, ...extra } }
}

export const zeroCost = () => ({ text: { input: { price: 0, cache: { read: 0 } }, output: { price: 0 } } })

export const peakMultipliers = [{ factor: 2, when: {
  utc_days: { in: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  any: [{ all: [{ utc_hours: { gte: '01:00' } }, { utc_hours: { lt: '04:00' } }] },
    { all: [{ utc_hours: { gte: '06:00' } }, { utc_hours: { lt: '10:00' } }] }],
} }]

export function modelEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'chat', name: 'Future model',
    capabilities: { reasoning: { supported: true, effort: ['low', 'high', 'max'] }, temperature: true },
    modalities: { input: ['text', 'image/jpeg'], output: ['text'] },
    limit: { context: 262144, output: 131072 },
    cost: zeroCost(), api: protocolEntry(),
    ...overrides,
  }
}

export function fixtureModels(): Record<string, Record<string, unknown>> {
  return {
    'deepseek-v4-pro': modelEntry({ name: 'DeepSeek V4 Pro', family: 'deepseek', modalities: { input: ['text'] },
      capabilities: { reasoning: { supported: true, effort: ['low', 'high', 'max'], toggle: true } } }),
    'deepseek-v4.1-flash': modelEntry({ name: 'DeepSeek V4.1 Flash', family: 'deepseek' }),
    'kimi-k3': modelEntry({ name: 'Kimi K3' }),
    'minimax-m3': modelEntry({ name: 'MiniMax-M3', api: protocolEntry('messages'),
      capabilities: { reasoning: { supported: true, toggle: true } } }),
    'claude-haiku-5-5': modelEntry({ name: 'Claude Haiku 5.5', api: protocolEntry('messages'),
      capabilities: { reasoning: { supported: true, toggle: true, effort: ['low', 'medium', 'high', 'xhigh', 'max'] }, temperature: false } }),
    'union-alpha': modelEntry({ name: 'Union Alpha Free', api: protocolEntry('messages'),
      capabilities: { reasoning: { supported: true } } }),
  }
}

export function modelsDocument(models = fixtureModels()): { data: Record<string, unknown>[] } {
  return { data: Object.entries(models).map(([id, data]) => ({ id, object: 'model', ...data })) }
}
