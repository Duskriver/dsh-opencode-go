/** Small, offline models.dev fixtures. New ids deliberately do not come from pi-ai. */
export const MODELS_METADATA_URL = 'https://models.dev/api.json'

export function modelMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Future model',
    reasoning: true,
    reasoning_options: [{ type: 'effort', values: ['low', 'high', 'max'] }],
    modalities: { input: ['text', 'image'], output: ['text'] },
    limit: { context: 262144, output: 131072 },
    cost: { input: 0, output: 0, cache_read: 0 },
    ...overrides,
  }
}

export function metadataDocument(models?: Record<string, unknown>): Record<string, unknown> {
  return {
    'opencode-go': {
      npm: '@ai-sdk/openai-compatible',
      models: models ?? {
        'deepseek-v4-flash': modelMetadata({ name: 'DeepSeek V4 Flash', family: 'deepseek-flash', modalities: { input: ['text'] } }),
        'deepseek-v4.1-flash': modelMetadata({ name: 'DeepSeek V4.1 Flash', family: 'deepseek-flash' }),
        'kimi-k3': modelMetadata({ name: 'Kimi K3' }),
        'minimax-m3': modelMetadata({ name: 'MiniMax-M3', provider: { npm: '@ai-sdk/anthropic' } }),
        'union-alpha': modelMetadata({ name: 'Union Alpha Free', provider: { npm: '@ai-sdk/anthropic' }, reasoning_options: [] }),
      },
    },
  }
}
