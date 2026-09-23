import type { OpencodeGoConfig } from '../src/config.ts'

/**
 * One resolved configuration for direct adapter construction or a plugin
 * mount: every field the schema would default is spelled out, so a test's
 * effective values never depend on defaults it never read.
 */
export function configOf(baseURL: string, overrides: Partial<OpencodeGoConfig> = {}): OpencodeGoConfig {
  return {
    enabled: true,
    modelVisibility: {},
    apiKeyEnv: 'OPENCODE_API_KEY',
    baseURL,
    refreshMinutes: 60,
    streamIdleTimeoutMs: 5_000,
    maxRequestImageBytes: 20 * 1024 * 1024,
    requestImagePixelBudget: 2048 * 2048,
    requestImageMaxBytes: 1024 * 1024,
    modelLimits: {},
    ...overrides,
  }
}
