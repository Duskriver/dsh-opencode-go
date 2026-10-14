import { defineConfig } from 'vitest/config'
import { googleFetchVitePlugin } from './scripts/google-fetch-bridge.mjs'
export default defineConfig({
  plugins: [googleFetchVitePlugin()],
  test: {
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    testTimeout: 15000,
    server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives', 'opencode-go-pi-ai', '@google/genai'] } },
  },
})
