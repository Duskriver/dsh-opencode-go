/** Public Go gateway shared by discovery, inference and usage. */
export const DEFAULT_BASE_URL = 'https://opencode.ai/inference/go/v1'

/**
 * Migrate the legacy official address before any request is constructed.
 */
export function migrateGatewayBaseURL(baseURL: string): string {
  return baseURL.replace(/\/+$/, '') === 'https://opencode.ai/zen/go/v1'
    ? 'https://opencode.ai/inference/go/v1' : baseURL
}
