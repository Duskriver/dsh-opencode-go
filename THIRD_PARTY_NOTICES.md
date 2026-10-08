# Third-party notices

The adapter, settings UI, and `src/conversion/{context,stream,replay}.ts` derive from DeepSeek Harness, copyright (c) 2026 DeepSeek, under the MIT license included in LICENSE. The conversion modules are maintained in this package because the published DSH pi-ai package does not export its conversion helpers.

The host bundle includes the required portions of `@earendil-works/pi-ai@0.87.1` and `partial-json`; SDK declarations include pi-ai, pi-telemetry and TypeBox types. Their original MIT licenses are reproduced in `lib/vendor-licenses.txt`. The pi packages' license comes from the [upstream v0.87.1 license](https://github.com/earendil-works/pi/blob/v0.87.1/LICENSE), which their npm distributions omit. OpenAI and Anthropic transport SDKs remain separate runtime dependencies.

The GitHub icon in the settings footer comes from Simple Icons, distributed under CC0 1.0 Universal.
