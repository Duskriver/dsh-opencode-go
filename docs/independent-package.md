# Independent package architecture

`dsh-opencode-go` is a self-contained external plugin for DeepSeek Harness (DSH `>=0.2.1-rc.5`). It owns its Host adapter, Web client surfaces, build pipeline, manifest, activation layer and test suite, consuming DSH solely through published npm exports.

## Host and Client boundaries

- **Host peer dependencies**: The Host depends on `@deepseek-ai/*` services, `@deepseek-ai/dsh-brand`, `@deepseek-ai/schemastery` (`>=3.18.5 <4`) and `@deepseek-ai/cordis` (`^4.0.5`) as peer dependencies so service identities and `LlmError` instances stay shared with the host application.
- **Client module table**: The browser bundle (`lib/client.js`) follows DSH's `window.__ModuleLoader__.load` factory format, embeds scoped CSS Modules via `lightningcss`, and resolves only host-provided client externals (`react`, `react/jsx-runtime`, `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`).
- **Route identity**: The bundle keeps configuration entry `id: opencode-go` in `cordis.patch.yml`. It registers the paid route as `dsh-opencode-go` (`DSH OpenCode Go`) and the opt-in free route as `dsh-opencode-free` (`DSH OpenCode Free`), coexisting cleanly with built-in providers.
- **Bundled SDK & notices**: Protocol transport uses the pinned private `opencode-go-pi-ai` (`@earendil-works/pi-ai@1.5.0`) bundled into `lib/`, with flattened TypeScript declarations (`rollup-plugin-dts`) and third-party licenses emitted to `lib/vendor-licenses.txt` alongside `scripts/licenses/pi-1.5.0-LICENSE`.

## Release integrity guards

 `npm run check:dist` (and `prepack`) rebuilds into a temporary directory and asserts byte-for-byte parity with committed `lib/` files.
- `npm run check:pack` asserts that all required runtime, type, license and documentation files are included in the package and that the single tracked root `dsh-opencode-go-<version>.tgz` archive matches the workspace byte-for-byte.
- See [development](development.md) for commands, module layout and verification gates.
- The fork's current release line is `0.6.0`: it merges upstream 0.4.5 on top of the fork's multi-account request balancing (per-session affinity) and its opt-in local privacy guard.
