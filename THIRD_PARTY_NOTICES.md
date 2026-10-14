# Third-party notices

The initial adapter, settings UI, and `src/conversion/{context,stream,replay}.ts` were derived from DeepSeek Harness, copyright (c) 2026 DeepSeek, under the MIT license included in LICENSE. The original DeepSeek copyright notice is retained for these derived portions. The conversion modules are maintained in this package because the published DSH pi-ai package does not export its conversion helpers.

Original additions and subsequent modifications made in this project are copyright (c) 2026 dsh-opencode-go contributors and are also licensed under MIT. LICENSE records both the upstream attribution and this project's contributor attribution.

The host bundle includes the required portions of `@earendil-works/pi-ai@1.2.0`, `@google/genai@2.21.0` and their bundled dependencies; SDK declarations include pi-ai, pi-telemetry and TypeBox types. Their original licenses are reproduced in `lib/vendor-licenses.txt`, including the Google SDK's Apache-2.0 license and data-uri-to-buffer's MIT license from its published README. The pi packages' license comes from the [upstream v1.2.0 license](https://github.com/earendil-works/pi/blob/v1.2.0/LICENSE), which their npm distributions omit. OpenAI and Anthropic transport SDKs remain separate runtime dependencies.

The bundled Google SDK's HTTP fetch call is modified at build time to use the plugin's request-scoped fetch binding. Its message serialization and stream parser remain upstream implementations.

The GitHub icon in the settings footer comes from Simple Icons, distributed under CC0 1.0 Universal.
