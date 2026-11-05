# Third-party notices

The initial adapter, settings UI, and `src/conversion.ts` were derived from DeepSeek Harness, copyright (c) 2026 DeepSeek, under the MIT license included in LICENSE. The original DeepSeek copyright notice is retained for these derived portions. The conversion code is maintained in this package because the published DSH pi-ai package does not export its conversion helpers.

Original additions and subsequent modifications made in this project are copyright (c) 2026 dsh-opencode-go contributors and are also licensed under MIT. LICENSE records both the upstream attribution and this project's contributor attribution.

The host bundle includes the required portions of `@earendil-works/pi-ai@1.5.0`, `@google/genai@2.21.0` and their bundled dependencies; SDK declarations include pi-ai, pi-telemetry and pi-schema types. Their original licenses are reproduced in `lib/vendor-licenses.txt`, including the Google SDK's Apache-2.0 license and data-uri-to-buffer's MIT license from its published README. The pi packages' license comes from the [upstream v1.5.0 license](https://github.com/earendil-works/pi/blob/v1.5.0/LICENSE), which their npm distributions omit, and is retained in `scripts/licenses/pi-1.5.0-LICENSE`. OpenAI and Anthropic transport SDKs remain separate runtime dependencies.

pi-ai 1.5.0 replaces its TypeBox dependency with `@earendil-works/pi-schema@1.5.0`. pi-schema includes format checks and value conversion rules adapted from TypeBox 1.3.27, copyright (c) 2017-2026 Haydn Paterson, under MIT. Its bundled `LICENSES/typebox-LICENSE` is also reproduced in `lib/vendor-licenses.txt`. pi-ai pins both pi-schema and pi-telemetry to 1.5.0, so this package no longer needs a dependency override.

The bundled Google SDK's HTTP fetch call is modified at build time to use the plugin's request-scoped fetch binding. Its message serialization and stream parser remain upstream implementations.

The GitHub icon in the settings footer comes from Simple Icons, distributed under CC0 1.0 Universal.

Free HTTP transport uses the official `bun@1.4.4` optional dependency and its platform packages. Bun is maintained by Oven and contributors and distributed under its upstream license and third-party notices; the runtime remains a separate npm dependency rather than part of this package's JavaScript bundle. See [Bun's license](https://github.com/oven-sh/bun/blob/bun-v1.4.4/LICENSE.md). The HTTP worker and Node bridge in this project are original code.
