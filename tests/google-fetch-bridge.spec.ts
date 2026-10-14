import { expect, it } from 'vitest'
import { matchesGoogleModuleId } from '../scripts/google-fetch-bridge.mjs'

const sdk = String.raw`C:\work\node_modules\@google\genai\dist\node\index.mjs`
const adapter = String.raw`C:\work\node_modules\opencode-go-pi-ai\dist\api\google-generative-ai.js`

it.each([
  ['C:/work/node_modules/@google/genai/dist/node/index.mjs', sdk],
  ['/C:/work/node_modules/@google/genai/dist/node/index.mjs?v=hash', sdk],
  ['C:/work/node_modules/opencode-go-pi-ai/dist/api/google-generative-ai.js', adapter],
  ['/project/node_modules/@google/genai/dist/node/index.mjs?import', '/project/node_modules/@google/genai/dist/node/index.mjs'],
  ['//server/share/node_modules/@google/genai/dist/node/index.mjs', String.raw`\\server\share\node_modules\@google\genai\dist\node\index.mjs`],
])('binds normalized loader ID %s to its native module path', (id, filename) => {
  expect(matchesGoogleModuleId(id, filename)).toBe(true)
})

it.each([
  'C:/other/node_modules/@google/genai/dist/node/index.mjs',
  'D:/work/node_modules/@google/genai/dist/node/index.mjs',
  'C:/work/node_modules/@google/genai/dist/web/index.mjs',
])('leaves other Google SDK modules untouched: %s', id => {
  expect(matchesGoogleModuleId(id, sdk)).toBe(false)
})
