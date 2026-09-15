# Independent package decision

The plugin owns its Host adapter, Web settings entry, build, package manifest, activation layer, and tests. It consumes DSH through published npm exports. The source tree and build have no reference to a DSH checkout.

The Host depends on DSH services through peer dependencies so Cordis service classes and LLM error identities remain shared with the application. The Client resolves React, the store, and UI primitives through the DSH module table. UI type packages are optional peers because headless installations do not mount those services; this project's development dependencies supply the types and test runtime libraries.

The package's bundle inserts `id: opencode-go`. The original fork's `llm-opencode-go` row can be disabled by a profile patch. Plugin registration does not select the user's default model or replace another provider automatically.

Published `@deepseek-ai/dsh-llm-pi-ai` versions `0.1.5-rc.2` and `0.1.6-alpha.1` do not export `./conversion`. This package therefore carries the request-history, stream, and replay conversion modules under `src/conversion`, with the upstream MIT license. It does not import unpublished files or bundle the whole adapter. Protocol transport remains implemented by pi-ai. Conversion maintenance is now this project's responsibility; a future public conversion library can replace these modules once published and tested.

The build uses esbuild and lightningcss directly. Node imports stay external; the browser factory follows DSH's `window.__ModuleLoader__.load` format, embeds CSS Modules, and allows only the declared platform module imports. A package-level builder is sufficient for this single external plugin; extracting a general DSH build-tool package would require a separate release and is not a prerequisite for installation.

The initial source derives from the user's working copy of DeepSeek Harness on branch `oh-my-dsh`, whose HEAD was `2c8555b323f3b49eac743bafd527f9f3238bf548`, including the uncommitted OpenCode Go settings changes present when this project was created. Runtime conversion modules retain their published behavior. The original checkout is unchanged by this extraction.
