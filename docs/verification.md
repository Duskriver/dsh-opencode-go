# Verification

## Issue #9: usage progress bar painting (plugin 0.1.12, 2026-09-24)

The progress elements retained `appearance: auto`, preventing the custom WebKit fill from taking effect ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-webkit-progress-value)). The fix sets `appearance: none`, removes the native border, and gives the progress element the rounded track background. The WebKit track stays transparent to avoid applying the translucent track color twice; the existing WebKit and Firefox fill rules remain green. Percentage values and accessible progress semantics are unchanged.

An isolated browser fixture mounted the actual `lib/client.js` usage slot with local usage data. On macOS / Chrome 153, the original artifact drew a thin native line with a faint fill rather than the intended 5px custom bar; this is not a reproduction of the reporter's completely gray Windows rendering. A screenshot pixel check failed before the fix (zero pixels of the intended fill color) and passed afterward, measuring 59, 101, and 84 filled pixels for 24%, 41%, and 34% of a 246px track, with the expected fill height.

Browser checks also passed for light/dark themes, 0%, 50%, 100%, and a 120% usage reading clamped to a full bar, including a 320px viewport without horizontal overflow. The dialog opened and closed with Escape, and no browser errors were recorded. These checks used the production client artifact with fixture host services, not a full DSH installation; Windows, Firefox, and Safari were not exercised. The complete `npm test` run passed the Host/Client type checks, production build, and **295 tests in 22 files**.

## Issue #8: DSH 0.1.7-rc.1 / rc.2 bundle admission (plugin 0.1.12, 2026-09-24)

The published `@deepseek-ai/dsh-app-boot@0.1.7-rc.1` reproduced the reported `skipping profile bundle` diagnostic with the 0.1.11 manifest: all 19 DSH peer ranges exclude rc.1, so `loadProfileDirectory` removes the bundle before the provider or settings can load. The engine declaration also excluded rc.1. The subsequently published [rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.7-rc.2) still rejects a manifest that only declares through rc.1. Adding both exact versions to the engine and DSH peer ranges fixes admission without profile version exemptions; unverified rc.3 and 0.1.7 stable remain outside the declared range.

`node --expose-internals tests/fixtures/bundle-compatibility.mjs v017-rc1` and the corresponding `v017-rc2` command failed before their manifest changes and pass afterward. They use the real startup gates against temporary Web and Headless profiles, asserting that the bundle and provider insertion survive. The rc.2 gate now returns skipped bundles for later reporting; the fixture also checks that this list is empty. Independently pinned rc.1 and rc.2 workspaces extend the existing built Host/Client tests for provider activation, catalog and usage RPC, streaming, image resizing and tool results, default/explicit reasoning, live profile settings, and client settings registration/rendering. The rc.2 UI primitives additionally require the host's new `dsh-util-code-language` module, which is supplied by the rc.2 test workspace.

`npm test` passed Host/Client type checks, the production build, and **301 tests in 22 files**, covering all eight supported host fixtures on macOS / Node.js 24.14.1. The existing upstream UI source-map warnings remain. Tests use local gateways and fake credentials; they do not exercise a full running DSH Web/Desktop shell or make paid model requests.

## Individual model switches and cached Settings discovery (2026-09-23)

`modelVisibility` stores explicit booleans by model ID. An absent override enables an ordinary model and disables a model marked deprecated. A `true` override can enable a deprecated model without a second global condition; `false` can hide an ordinary model. The Host and Client share `isModelEnabled`, including own-property checks for IDs that match JavaScript prototype keys. Older `showDeprecatedModels` and `visibleModelIds` fields remain loadable as unknown configuration but no longer impose a visibility condition.

Each model has one switch that writes immediately and refreshes conversation pickers. Capacity and credential edits retain Save/Discard behavior. Hidden models stay available in Settings and existing conversations can continue requesting models the gateway serves. Newly discovered models follow their lifecycle default unless an override already exists for their ID.

Picker reads now reuse the catalog for `refreshMinutes`, so visibility changes do not trigger another network refresh while that snapshot is cached. `GoModelsService.read()` still forces discovery, then notifies any registered picker on both successful and failed refreshes. The picker consumes the same committed or retained snapshot; explicit Settings refreshes discover new and removed models, and direct requests for unknown IDs retain their immediate discovery behavior.

Settings discovery now returns `GoModelCatalog` with `models`, `stale`, and an optional safe error message. If a refresh fails after a successful listing, Settings keeps the cached entries and shows a warning with the failure cause. Client transport failures also retain the last successful view. A failure without any cached listing shows an error; a successful empty listing stays empty. Explicit generic discovery retains its strict failure behavior.

The final `npm test` run passed Host/Client type checks, the production build, and **246 tests in 20 files**. Coverage includes lifecycle defaults, individual overrides, returning and newly discovered models, non-boolean configuration rejection, unchanged existing-model requests, TTL expiry, and real Settings RPC notifications without redundant picker requests, including failed refreshes. The 0.1.7 profile fixtures verify the new switches and retained legacy fields without remounting; client tests verify immediate switches and cached-list warnings. The earlier browser result below predates this UI revision and does not establish its visual behavior in a live DSH installation.

## Issue #7: transport verification, usage, diagnostics and model selection (2026-09-23)

An isolated local HTTPS/HTTP2 reproduction used the reporter's exact Node 24.19.0 (bundled Undici 7.29.0) and npm Undici 8.11.0 global dispatcher. The server supplied correctly labeled compressed JSON. HTTP/1.1 worked; HTTP/2 lost all response headers and native `response.json()` failed on compressed bytes. The same failure occurred on Node 24.14.1 (bundled Undici 7.24.4). These tests ran on macOS, not WSL2, and used local fixtures without real credentials or paid requests.

Undici 8's HTTP/2 path passes a header object through the legacy dispatcher bridge where the older fetch expects an alternating header array ([request.js](https://github.com/nodejs/undici/blob/v8.11.0/lib/core/request.js#L328), [dispatcher1-wrapper.js](https://github.com/nodejs/undici/blob/v8.11.0/lib/dispatcher/dispatcher1-wrapper.js#L24)). The 0.1.10 reader was verified to recover this payload, but the final implementation adopts the issue reporter's simpler recommendation: `/models`, models.dev and `/usage` explicitly request `accept-encoding: identity`. The manual Brotli/gzip/deflate guessing loop has been removed. The reader only bounds delivered bytes and parses JSON; normally labeled compressed responses remain Fetch's responsibility. Requests keep using the host's global fetch and dispatcher.

The final identity implementation passed actual catalog and usage RPC reads through one unchanged Undici 8.11.0 global ProxyAgent and a CONNECT tunnel to a real TLS/HTTP2 server, under Node 24.19.0. The control request without identity failed; identity returned plain JSON and all three code paths succeeded. Public read-only identity requests also succeeded: `/models` returned HTTP 200, 3,309 bytes and 40 model IDs; models.dev returned HTTP 200, 4,884,187 bytes and valid metadata. Neither response was compressed. The tradeoff is the larger metadata transfer; identity does not fix the underlying loss of ETag headers. No observed endpoint required manually decoding compressed responses despite identity, so an artificial server ignoring the header is not used to justify that fallback.

Usage uses the shared reader with a 1 MiB limit on delivered bytes; listing and metadata limits remain 1 MiB and 16 MiB. Real HTTP regressions model an upstream that honors identity and a host that loses encoding headers: removing identity breaks the actual catalog/usage read, while identity succeeds. Correctly labeled Fetch-decoded compression and oversized responses remain covered. Model discovery retains the failure cause and gives both discovery entry points a URL plus HTTP status, network error code, JSON decoding failure or invalid listing shape. Public messages omit response bodies; a successful refresh clears the previous failure.

The initial picker-selection implementation used a saved allowlist and a separate deprecated-model option. It has been replaced by the individual switches described above.

Before the individual-switch and cached-discovery revision, the identity implementation passed `npm test`: Host/Client type checks, the production build and **240 tests in 19 files**, including all six supported host fixtures. Obsolete manual-decompression tests were replaced by request-negotiation and bounded JSON parsing coverage. Browser verification at that checkpoint used the actual settings component and controller with a local in-memory settings scope: selecting one model, saving, restoring all, and discarding behaved correctly; the 390 px viewport had no horizontal overflow and no browser errors were reported. This preview was not a live DSH Web deployment. The existing upstream missing-source-map warnings remain.

## Unknown profile fields during activation (2026-09-23)

A real Loader composition reproduced `TypeError: value.get is not a function` when the plugin entry contained an additional configuration field. Schemastery preserves fields outside the schema as plain values; the plugin incorrectly called `.get()` on every entry. Configuration reads now dereference only declared schema fields, preserving their live references and leaving stored profile data intact.

The regression failed before the fix and passes afterward, covering extra scalar, null, array, and object values alongside a working endpoint and model-capacity override. The built artifact also mounts with an extra field across all six supported host fixtures; both 0.1.7 fixtures verify live settings changes still work without remounting and retain the extra profile field. The build's Host/Client type checks and all **234 tests in 18 files** pass on macOS / Node.js 24.14.1. Upstream UI primitives still emit missing-source-map warnings. No live model requests were made during those tests.

The reported failure was subsequently reproduced by disabling and enabling the component in the user's running DSH Web process. A debugger breakpoint identified `showDeprecatedModels` as the failing field: its value was a boolean and its `get` property was undefined. The process's loaded plugin source matched the local `dsh-opencode-go-0.1.7.tgz` artifact byte for byte (SHA-256 `07422ad73df69896e2c3eafa1a07481cedd2945ed53dc59f09657abf1c8faa27`), including stack lines 1007 and 1305; that schema predates this field. The installed files were already 0.1.10 and recognized it. The process started at 18:30:41, before the replacement package directory was created at 18:31:45. Component toggles reimport the same cached module; the host's package manager requires a restart after replacing an installed dependency. Thus the actual trigger was a newer saved setting reaching an older module still loaded in memory, not a manually added invalid setting. A complete DSH restart loaded the existing 0.1.10 files with the same configuration: the component changed from failed to running, and the selected model and subscription usage became available. No package replacement or settings removal was needed, and no paid generation was sent.

## Default reasoning effort (plugin 0.1.10, 2026-09-23)

PR #6 declares a default effort for the pi-ai transports that explicitly disable thinking when the effort is unset: `deepseek`, `zai`, `qwen`, and `qwen-chat-template`. Models offering `high` default to it; otherwise the highest supported non-`off` effort is selected. Explicit choices, including `off`, still take precedence. Other transports and models without adjustable efforts retain their existing behavior.

Review found that the original fallback selected the first non-`off` effort from pi-ai's ascending list. End-to-end regressions failed with `low` in the outgoing request for models offering `low/medium` or `low/max`, then passed after selecting the last supported effort. The same cases cover `low` alone and the preference for `high` over `max` when both are offered.

Host/Client type checks, the build, and all **233 tests in 18 files** pass on macOS / Node.js 24.14.1 using the existing installed dependencies. Permanent compatibility coverage adds 42 local HTTP requests through the built plugin and all six supported DSH runtimes, verifying default effort resolution, explicit `low` and `off`, Qwen's thinking switch, provider-decides models, and reasoning/text stream conversion. Published UI primitives still emit missing-source-map warnings; all assertions pass. Completion requests use local fixtures and test credentials, with no paid model calls or manual Web/Desktop verification.

This release also includes PR #5's bounded compressed-response recovery described below, which was merged after the 0.1.9 release.

## Bounded model discovery responses (0.1.10; superseded by identity requests above)

Model discovery accepts ordinary JSON and Brotli, gzip, or deflate JSON whose `Content-Encoding` header is missing. Correctly labeled responses continue through Fetch's automatic decoding. The shared reader counts actual streamed bytes and cancels oversized bodies; fallback decoders run asynchronously with `maxOutputLength`. Both delivered bytes and fallback output are limited to 1 MiB for the gateway listing and 16 MiB for models.dev metadata. These are payload limits, not total process-memory or CPU-time budgets. Failed recovery preserves the original JSON error and each decoder's cause.

Host/Client type checks and the build passed, followed by all **222 tests in 18 files**, on macOS / Node.js 24.14.1 using the existing installed dependencies. Ten new resource-limit and diagnostic tests failed against the original parser before passing with the bounded reader. Real local HTTP tests cover both discovery sources, correctly labeled and unlabeled compression, corruption, cached fallback, and each source's limit exceeded by exactly one byte. The upstream UI primitives packages still emit missing-source-map warnings; all assertions pass.

The missing-header failure is reproduced with controlled HTTP fixtures. A read-only direct check of the two public endpoints returned HTTP 200 with correct `Content-Encoding: br` headers and valid JSON after Node's automatic decoding; models.dev was approximately 4.6 MiB decoded. This does not establish why the original reporter's proxy environment failed: response headers, a raw response sample, and the relevant proxy/runtime configuration are still needed. Curl's automatic decoding also relies on `Content-Encoding`, so successful curl access alone does not establish the reported root cause. Usage fetching is outside this change.

## DSH 0.1.7-alpha.2 compatibility (plugin 0.1.9, 2026-09-23)

The package now declares DSH `0.1.7-alpha.2` and Cordis `4.0.4` support while retaining the five previously supported hosts. Before the change, the SemVer regression rejected the new host in `engines.dsh`; the DSH and Cordis peer ranges also excluded its published versions. `engines.dsh` is declarative in the current upstream installer, so it must not be confused with an enforced loader check. The peer ranges affect dependency resolution. Unverified future prereleases remain outside the declared range.

Review of the [upstream release diff](https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v0.1.7-alpha.1...dsh-v0.1.7-alpha.2) and tests with the published packages found no required change to the adapter or settings implementation. The new `tests/hosts/v017-alpha2` workspace pins the DSH services, Cordis `4.0.4`, Loader `1.0.5`, Include `1.0.9`, and Schemastery `3.18.4` separately from the older host fixtures.

Validation on macOS / Node.js 24.14.1:

- Host/client type checks, build, and **191 tests in 17 files** pass. The six-host matrix covers artifact loading, Loader activation, catalog and usage RPCs on modern hosts, streaming, capacities, real image resizing, offload limits, and immutable history. Modern hosts also verify mixed tool-result text and image delivery.
- Both `0.1.7` prereleases pass the real profile settings fixture, including live updates without remounting, visibility changes, capacity reset, route toggling, and validation.
- The distributed browser factory renders against the legacy UI packages and both `0.1.7` prereleases' actual store and primitives packages. Model loading, settings registration, CSS composition, and cleanup pass. Published UI primitives still emit missing-source-map warnings.
- The tarball installs into a separate official `@deepseek-ai/dsh@0.1.7-alpha.2` npm consumer without `--force` or `--legacy-peer-deps`. Its resolved Cordis, LLM, settings, and attachment packages match the target versions. `verify:installed` passes package resolution, catalog, streaming, session headers, authorization, and unload checks.
- `verify:headless` passes through the official launcher with the installed bundle selected in an isolated profile. The first `dsh plugin add` stopped on pnpm's build-policy decisions for `@google/genai` and `protobufjs`. Both were explicitly disabled in that temporary profile's `allowBuilds`, then installation was retried. Because the interrupted operation had already written the dependency, the retry retained its disabled state; adding `dsh-opencode-go` to that profile's existing `dsh.profile.bundles` enabled it before the successful smoke test.

Development dependencies are reproducible with `npm ci --legacy-peer-deps --ignore-scripts`. Completion requests use a loopback gateway and fake credentials. This verification does not cover the full Web/Desktop UI, other operating systems, or live paid model calls.

## Release 0.1.8 (2026-09-22)

Host/client type checks, the build, and all **181 tests in 16 files** pass on macOS / Node.js 24.14.1. Coverage includes the five supported host versions, deprecated-model visibility, model remote injection, and CSS composition in the distributed client. The upstream UI primitives packages still emit missing-source-map warnings; all assertions pass. This release also synchronizes the English README with the simplified Chinese guide and updates installation examples to 0.1.8.

## Model settings layout and deprecated visibility (2026-09-22; superseded by individual switches above)

The settings page uses the selected list/detail layout, real gateway membership, models.dev release dates and deprecation flags, and a default-off `showDeprecatedModels` switch. Deprecated models stay configurable in settings; only conversation picker membership is filtered. Existing conversations can still call a hidden model that the gateway serves. Models found only in metadata or saved overrides are not displayed. Before any successful gateway response, a network failure does not advertise built-in models.

Host/client type checks, the build, and all **181 tests in 16 files** passed. Added checks cover lifecycle date boundaries and ordering, gateway removals, deprecation during metadata outages, real model RPC serialization, immediate visibility changes and picker notifications on legacy settings and the 0.1.7 profile service, and failed toggle writes without discarding other edits. All five published host targets pass the compatibility fixture. Model and usage endpoints share one package contribution so 0.1.7's registry retains both.

The actual React settings component was also rendered in a separate local preview with public live API data. Preview settings remain in memory, and credentials are not read or changed. This is a component/browser check, not a manual five-version host UI matrix. No paid completion or publication was performed.

## Per-model capacities on five hosts (2026-09-22)

PR #3's capacity editor is integrated on main commit `b093842`, preserving both legacy settings and the `0.1.7` profile configuration bridge. Each operation applies its captured overrides to original catalog metadata. The catalog cache remains available during outages, discovery shows the original reference values, and configured output caps also constrain explicit request budgets. Null model entries or fields explicitly restore catalog values over inherited configuration.

The built Host artifact passes the existing compatibility fixture with real published LLM/attachment packages for all five targets:

| DSH target | Capacities, output caps, hot update and reset | Text, image resizing and history checks |
| --- | --- | --- |
| 0.1.5-rc.1 | Pass | Pass |
| 0.1.5-rc.2 | Pass | Pass |
| 0.1.6-alpha.1 | Pass | Pass |
| 0.1.6-alpha.2 | Pass | Pass |
| 0.1.7-alpha.1 | Pass | Pass |

The `0.1.7` fixture uses its actual Loader and settings service to edit and reset capacities without replacing the plugin fiber. Legacy settings tests verify null overrides of inherited capacities. Regressions also cover catalog references, metadata outages, concurrent configuration changes, and explicit output caps across Chat Completions, Responses and Anthropic Messages. Client tests cover Save/Discard, reset followed by another edit, customized counts, and offline reset; the distributed client mounts against both UI primitive generations.

Validation: Host/Client type checks, all **175 tests in 15 files**, build and `npm pack` pass on macOS / Node.js 24.14.1. Dependencies install with `npm ci --legacy-peer-deps` using main's unchanged lock. The older host matrix selects matching LLM/attachment packages through resolution hooks, with other services from the development tree; the `0.1.7` host uses its separately pinned workspace. UI validation is automated component/factory testing, not a manual five-version browser or Desktop matrix. All completions use a loopback fixture and fake credentials; no paid generation or npm publication was performed.

## DSH 0.1.7 compatibility (plugin 0.1.7)

Verified on macOS / Node.js 24.14.1 against published DSH `0.1.7-alpha.1`, while retaining the four previously tested hosts (`0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.6-alpha.1`, `0.1.6-alpha.2`). The independent npm workspace at `tests/hosts/v017` keeps the new Cordis/Loader and DSH service identities separate from the legacy test dependencies. Install development dependencies with `npm ci --legacy-peer-deps`; the aliases deliberately contain incompatible peer ranges from different host generations.

The failures reproduced before their fixes were:

- `engines.dsh` rejected `0.1.7-alpha.1`.
- The real new settings service did not expose OpenCode Go because `installSection` was removed and the profile form requires volatile Config fields.
- New `role: 'tool'` history was sent as user text, losing its tool-call identity; tool-result images were rejected.
- The real Web settings page crashed with React error 130 because the host removed `IconChevronDownOutline14`.

Validation: Host/Client type checks and all **151 tests in 14 files** pass. The fresh-process host matrix exercises the built artifact, real LLM/attachment implementations, text streaming, tool history, image resizing and offload limits. The modern fixture additionally exercises the real usage RPC gateway. The profile-settings fixture uses the real Loader and settings service with an in-memory editor, and verifies live updates without remounting, toggling the route, and invalid-URL rejection. The browser artifact test now renders the actual page against both published UI primitive generations; merely checking registration had missed the removed icon.

An isolated npm consumer with the official `0.1.7-alpha.1` CLI passed `verify:installed` and `verify:headless` against a local fixture gateway. The final browser factory was also checked in that consumer's Web profile: the settings page renders, advanced fields are editable, saving `refreshMinutes: 30` and switching `enabled: false` persist in the real profile patch and survive a full page reload, with no new console errors. No real API key or paid model generation was used. Older custom settings may require the explicit migration described in README because the upstream importer does not map this plugin's legacy namespace to its bundle entry id.

The verification history below describes earlier releases; their live-provider results do not imply live-provider testing of this release.

Verified on macOS with Node.js 24.14.1 and npm-installed DSH 0.1.6-alpha.1. The plugin's dependencies came from npm, with no workspace aliases, symlinks into a checkout, or unpublished DSH exports.

## Local checks

- `npm run typecheck`: strict Host and Client programs against installed declarations.
- `npm test`: builds both artifacts, then runs the adapter, catalog, configuration, settings, loader, image/history conversion, and browser-factory suites.
- `npm pack`: builds a distributable tarball containing the bundle patch, Host ESM, browser module factory, type declarations, license, and documentation.

The published UI primitives bundle references a missing source map. Vitest prints an upstream missing-map warning; it does not affect execution or assertions.

## Isolated installed checks

Create an empty temporary consumer directory and install the compatible CLI plus the tarball there:

```sh
npm init -y
npm install --ignore-scripts @deepseek-ai/dsh@0.1.6-alpha.1 /absolute/path/to/dsh-opencode-go-0.1.0.tgz
```

Set `DSH_HOME` to that consumer's `home` directory before invoking its CLI. Install the bundle into the headless profile:

```sh
DSH_HOME="$PWD/home" ./node_modules/.bin/dsh plugin --profile headless add /absolute/path/to/dsh-opencode-go-0.1.0.tgz
DSH_HOME="$PWD/home" ./node_modules/.bin/dsh --profile headless --dump-config
```

The tested pnpm installation initially stopped for dependency build-policy decisions. In the temporary profile's `pnpm-workspace.yaml`, set `allowBuilds` entries for `@google/genai` and `protobufjs` to `false`, preserving other generated fields, then repeat installation. This keeps those scripts disabled. The second installation completed and added the bundle to the profile manifest.

From this plugin project, run:

```sh
npm run verify:installed -- /absolute/path/to/consumer
npm run verify:headless -- /absolute/path/to/consumer
```

The installed smoke resolves the tarball's module and its shared DSH services from the consumer, mounts them through the actual Cordis Loader without an import mock, queries the catalog, streams three requests, checks session-header stability and isolation, checks authorization and User-Agent, and disposes the adapter to verify route removal. The fixture gateway binds an OS-allocated loopback port and closes it after the test.

The headless smoke invokes the consumer's official `dsh --profile headless` launcher with a temporary profile overlay and a local gateway. It selects the OpenCode Go provider, completes a task with `standalone-ok`, checks the outgoing session header, and removes the temporary overlay. The test has a bounded child-process timeout and waits for teardown.

## Browser verification

The tarball was installed into a separate Web profile in the same temporary Harness home. The official `dsh web` server started on an OS-allocated port. Browser inspection confirmed the OpenCode Go settings entry, API-key field, advanced configuration, and a successful model-list response. Toggling the provider off and on updated the page through the Host settings service. No real API key was entered, and no real paid model completion was requested.

The browser-factory test additionally evaluates the distributed `lib/client.js` against the published React/store/UI module table, checks the package ID, mounts the settings section, and verifies CSS insertion.

## Subscription usage verification (0.1.1)

The usage tests invoke the actual published Typert Host gateway against a local HTTP fixture, checking the Bearer credential, credential changes, all three windows, and failure handling. Browser component tests check provider switching, polling cleanup, monthly details, and failed-refresh behavior. Adapter tests cover non-zero cached input in OpenAI, DeepSeek, and Kimi usage fields.

The local Web profile was also checked against the real read-only OpenCode Go usage endpoint. The button renders immediately before the model selector, and its details show rolling, weekly, and monthly percentages and local reset times. This check sends no model-generation request. The manual Remote codec supports both the published DSH `schema` shape and the current source build's `create()` shape.

## Dynamic model catalog verification

The dynamic catalog change passes all 140 tests plus the Host/Client build. Its offline regression fixtures cover Union Alpha and an arbitrary future id absent from pi-ai, immediate discovery and picker refresh, metadata arriving after a model id, HTTP ETag revalidation, concurrent refreshes, metadata outages, gateway outages, removal of retired models, malformed metadata, and supported reasoning controls. Real SDK streams against a local HTTP gateway verify Chat Completions, Responses, and Anthropic Messages paths for models with no built-in entry, including the Anthropic SDK's `/v1/messages` suffix.

A read-only check against the live OpenCode Go listing and models.dev resolved 36 of 38 advertised ids, including `union-alpha`; `deepseek-flash` and `hy3-preview` had no metadata. Those ids remain visible with a configuration diagnostic. This check did not send a generation request or establish that every advertised id is currently callable for an account.

## Remaining limits

Desktop, non-macOS platforms, and DSH releases outside the versions documented here are not verified. Live OpenCode Go verification is limited to the four image requests and four text-only code-generation requests documented below. The automated gateway tests preserve the adapter's request and replay semantics but cannot establish account validity or live provider availability.

## DSH 0.1.5 compatibility (plugin 0.1.5)

Issue #1 reproduced as an ESM import failure before plugin activation: DSH 0.1.5 lacks `IMAGE_OFFLOAD_REQUIRED_CODE`, `requiredImageOffload`, and `projectOffloadedImages`. The regression test failed against both actual published `dsh-llm` 0.1.5 release candidates before the fix.

`npm test` builds the distributed artifact and runs `tests/host-compatibility.spec.ts` in fresh Node processes against the published LLM packages `0.1.5-rc.1`, `0.1.5-rc.2`, and `0.1.6-alpha.1`. The two older versions are pinned npm aliases in development dependencies. A resolution hook selects the LLM package for both the plugin and Cordis Loader; it does not mock that package's exports. This focused matrix does not replace full CLI/profile checks.

The original fixture verifies native ESM loading, Loader activation, model listing, streamed text, image transport with a mock attachment store, repeated-image byte accounting, nested oldest-image offloading, immutable history, and a second check against encoded image sizes. It did not validate the real attachment service's request policy (see Issue #2 below). All external model metadata is replaced by an offline fixture, and completions go to a loopback gateway with a fake credential.

The compatibility bridge uses the host's own functions. On 0.1.5 it preserves the stock adapter's two-pass transient projection (estimated bytes before reading images, exact encoded bytes afterward). On 0.1.6 it preserves durable offload marks and the `IMAGE_OFFLOAD_REQUIRED` retry signal; it never silently substitutes legacy offloading on a modern host. The existing conversion suite additionally checks surface-marked images, path descriptions, and unsupported image roles.

Validation: 146 tests passed, Host and Client type checks passed, and the package built successfully on Node.js 24.14.1.

Full installed checks also passed against separate npm CLI installations whose entire DSH dependency closures were pinned to `0.1.5-rc.1` and `0.1.5-rc.2` respectively (not just the CLI version). The `0.1.5` plugin tarball was installed through `dsh plugin` into each installation's Web and Headless profiles under isolated `DSH_HOME` directories. Both versions passed `verify:installed` for package resolution, catalog, streaming, request headers, and unload; both passed `verify:headless` through the official launcher and loopback gateway. Browser checks confirmed the Web shell and OpenCode Go settings section load, including the API-key field, advanced settings, and enable switch, with no page errors.

## Image policy compatibility (plugin 0.1.6, Issue #2)

The real published `dsh-attachment-local` 0.1.5-rc.2 reproduced `Image request maxPixels must be a positive integer.` with an 800×600 PNG before the fix. The adapter passed `{ width, height, maxBytes }`, but DSH 0.1.5 requires `{ maxPixels, maxBytes }`. DSH 0.1.6 requires explicit dimensions, so replacing dimensions with only the old policy would break the newer hosts. The adapter now supplies both the computed dimensions and the original pixel/byte budgets; each host consumes its own contract.

The automated matrix now covers four matching sets of published `dsh-llm`, `dsh-attachment`, and `dsh-attachment-local` packages:

| Host packages | Real image requests | Existing loading, text, and offload checks |
| --- | --- | --- |
| 0.1.5-rc.1 | Pass | Pass |
| 0.1.5-rc.2 | Pass | Pass |
| 0.1.6-alpha.1 | Pass | Pass |
| 0.1.6-alpha.2 | Pass | Pass |

`tests/fixtures/host-compatibility.mjs` saves actual PNGs in a temporary local attachment store, streams them through the built adapter to a loopback gateway, and decodes the transmitted bytes. It checks an unchanged 800×600 image, a 3000×2000 image downscaled under the default pixel budget, and a custom pixel/byte budget. Storage admission keeps the original dimensions so resizing is exercised in the request path. Temporary storage is removed after each run. The mock attachment checks remain for exact byte-bound and offload scenarios.

Run `npm test -- tests/host-compatibility.spec.ts` for the focused matrix. The aliases intentionally install multiple host generations; use `npm ci --force` to retain the pinned development dependency tree despite their conflicting peer ranges. Resolution hooks select the matching LLM and attachment API at runtime. Other services use the development dependency tree, so this is not a full four-version CLI/Desktop or browser matrix, and no live paid completion is sent.

Additional isolated-install checks passed on macOS/Node.js 24.14.1 for all four versions. The built tarball was npm-installed into four temporary consumers with all DSH packages in each dependency closure pinned to the target version (38, 38, 39, and 40 DSH packages respectively; no version mismatches). A copy of the fixture loaded the installed plugin and packages directly, without resolution hooks, and passed ESM loading, Cordis Loader activation, model listing, streamed text, real image resizing, custom budgets, and image-offload/history assertions. These checks exercise the installed dependency combinations, not the official CLI launcher, Desktop, or browser UI.

Validation: 147 tests passed, Host/Client type checks and builds passed, and the focused four-version matrix passed again after adding custom-budget checks. Windows Desktop remains unverified.

## Live image verification (2026-09-21)

With the user's authorization, the fixed tarball was tested against the real OpenCode Go endpoint `https://opencode.ai/zen/go/v1` using model `deepseek-v4.1-flash`. Each of the four isolated consumers above used its actual Cordis Loader, LLM service, local attachment service, and installed plugin, with no mocked metadata or gateway response. SHA-256 comparisons confirmed all four installed Host artifacts matched the current built fix.

Each consumer sent exactly one completion request containing an 800×600 solid red PNG and a 3000×2000 solid blue PNG. Admission preserved the original dimensions, so the larger image exercised the adapter's request-size preparation. The prompt asked for the two dominant colors in order without naming them. Every outgoing completion contained both image parts, received HTTP 200, returned `red, blue`, and ended with `finish.kind: stop`.

| DSH dependency version | Result | Elapsed time including setup/discovery | Reported input/output tokens |
| --- | --- | --- | --- |
| 0.1.5-rc.1 | Pass | 2.586 s | 1501 / 26 |
| 0.1.5-rc.2 | Pass | 2.503 s | 1501 / 70 |
| 0.1.6-alpha.1 | Pass | 2.993 s | 1501 / 128 |
| 0.1.6-alpha.2 | Pass | 2.686 s | 1501 / 53 |

Total: four live completion requests and 6,281 reported tokens (including reasoning output). The credential was supplied through hidden stdin, passed to child processes through their environment, and never saved in repository files or test logs. Temporary image storage was removed. These checks verify the real model/attachment request path on macOS; they do not exercise Windows Desktop's UI or establish compatibility for every other model.

## Live text-only code verification (2026-09-21)

The same four isolated consumers and `deepseek-v4.1-flash` model were then tested with one ordinary text-only code-generation request each. No attachment service was mounted for these requests. The task was to implement a JavaScript `mergeIntervals(intervals)` function that handles unsorted closed intervals, merges overlaps/shared endpoints, and returns new arrays without mutating its input. Each outgoing completion contained zero image parts and used the actual installed Loader, LLM service, and plugin against the live gateway.

All four requests returned HTTP 200 and `finish.kind: stop`. After inspecting each generated function, it was executed in a time-bounded VM context without process, filesystem, module-loading, or credential bindings. Eight cases covered empty input, overlaps, chains sharing endpoints, negative bounds, nested intervals, duplicate points, unsorted disjoint intervals, and distinct adjacent integer points. Inputs were frozen; every case checked the expected result, unchanged inputs, and independent output arrays.

| DSH dependency version | Code checks | Elapsed time including setup/discovery | Reported input/output tokens |
| --- | --- | --- | --- |
| 0.1.5-rc.1 | 8/8 passed | 4.278 s | 133 / 599 |
| 0.1.5-rc.2 | 8/8 passed | 4.487 s | 133 / 670 |
| 0.1.6-alpha.1 | 8/8 passed | 3.882 s | 133 / 589 |
| 0.1.6-alpha.2 | 8/8 passed | 4.759 s | 133 / 702 |

Total: four additional live completion requests and 3,092 reported tokens, including reasoning output. No code corrections or retries were needed. This verifies ordinary text-only code generation and executable output; it does not exercise an agent's multi-turn tool-call workflow. Credential handling was identical to the live image checks above.

The settings build was also loaded in the user's running local `0.1.7-alpha.1` Web profile. This exposed a missing `remote.opencodeGoModels` injection in the browser settings scope; both legacy and modern settings bindings now declare it, and the distributed-client regression checks exercise model loading under that injection requirement. After rebuilding and restarting the Host, the real settings page loaded 40 gateway models, including 3 recent releases and 8 deprecated entries, with the deprecated-model switch off. No completion request was sent during this check.

Local Web layout checks also cover the settings panel's independent scroll body and reserved save/discard footer. The model panel now uses the settings container's available height and stacks at narrow container widths. At a 600×780 viewport, browser geometry confirmed no footer overlap or horizontal overflow and a visible action row. The client artifact test checks inherited disclosure styles because the CSS-module build previously omitted `composes` entries.


## Per-model switches in the installed Web profile (2026-09-23)

The revised local package was installed into the user's Web profile and the source Harness restarted. Installed host and client JavaScript matched the local build byte for byte. In the authenticated page, settings displayed 40 gateway entries, including 8 deprecated entries whose switches were off by default. Disabling MiMo-V2.6-Pro removed it from both the live session model catalog and the actual conversation picker; enabling the deprecated MiniMax-M2.5 added it to both without pressing Save. The temporary overrides were then removed through the revision-fenced settings API, restoring normal-model visibility and deprecated-model defaults. No completion was submitted. Browser errors were empty, and the settings layout was visually checked at the user's 1077×1324 viewport.

Timeout retention was verified deterministically through the real Host RPC and component/controller tests: success, timeout with retained entries and an explicit warning, then recovery. The installed live check does not establish that upstream network timeouts can no longer occur.


## Missing model configuration (2026-09-23)

Settings now carries `configurationMissing` as structured model state. Models without usable Go configuration retain their raw names, show “配置缺失”, and have an unchecked, disabled switch even if an earlier visibility override is true. A real Host RPC regression covers missing configuration followed by metadata recovery, and the component regression covers the disabled switch and its recovery. The complete suite passed 248 tests in 20 files, along with the host and client type checks.

After installing and restarting the user's Web profile, the actual `deepseek-flash` and `hy3-preview` rows both displayed “配置缺失”, `aria-checked=false`, and a disabled switch. Neither name contained the previous English diagnostic. No user settings or model generations were changed during this check.

## Intermittent network resets and usage recovery (2026-09-23)

The subsequent `ECONNRESET` report is distinct from Issue #7's compressed JSON failure. Public `/models` probes with `accept-encoding: identity` reproduced resets before response headers, including in Node 24.14.1's unmodified built-in fetch without Harness or an Undici 8 dispatcher. Fifteen sequential native requests produced ten successes, one reset and four 10-second timeouts. A separate five-request probe through the configured local proxy with HTTP/2 disabled produced two successes, one reset and two timeouts. Successful responses were HTTP/1.1, HTTP 200 and 40 models. This rules out JSON parsing and HTTP/2 as necessary causes of this failure; it does not identify whether the local forwarding layer or the upstream path caused each reset. No proxy setting was changed and no completion was sent.

Read-only JSON requests now retry connection reset/socket closure/temporary DNS errors at most once after 150 ms, including failures during body reading. Both attempts and the delay share the original timeout signal. HTTP failures, malformed or oversized JSON, and TLS certificate errors are not automatically retried. Loopback HTTP tests exercise a dropped first connection followed by recovery, persistent failures, body truncation, HTTP failures, and cancellation during backoff. The real catalog and usage RPC paths also exercise recovery.

Usage failures now carry safe Host diagnostics through the Remote error contract. The UI retains a prior reading only when its opaque account/endpoint source matches the failed request, labels it as old data, and shows its original timestamp and a manual retry. Authentication failures and different/missing source identities clear old data. A source is a Host-generated random identifier, never a credential or credential hash. Polling and manual retries coalesce. These changes improve recovery and diagnostics; they cannot guarantee availability during a network outage.

Validation: 289 tests in 22 files and both Host/Client type checks passed, including the published-host compatibility fixtures and the real usage RPC codec.
