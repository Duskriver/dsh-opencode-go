# Verification

## Release 0.1.8 (2026-09-22)

Host/client type checks, the build, and all **181 tests in 16 files** pass on macOS / Node.js 24.14.1. Coverage includes the five supported host versions, deprecated-model visibility, model remote injection, and CSS composition in the distributed client. The upstream UI primitives packages still emit missing-source-map warnings; all assertions pass. This release also synchronizes the English README with the simplified Chinese guide and updates installation examples to 0.1.8.

## Model settings layout and deprecated visibility (2026-09-22)

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
