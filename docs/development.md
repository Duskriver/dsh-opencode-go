# Build and compatibility environments

The root package contains one coherent DSH 0.1.6-alpha.1 development environment, the plugin's runtime dependencies, build tools, and core test tools. The published runtime peer ranges remain unchanged. `tests/hosts/*` are independent fixture packages, not npm workspaces. Their dependencies and lockfiles are never installed by root `npm install`, `npm ci`, or `npm pack`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked development dependencies without rebuilding the plugin |
| `npm run compile` | Type-check and regenerate the committed host, client, and declaration artifacts in `lib/` |
| `npm run check:dist` | Rebuild in a temporary directory and compare every file against the shipped `lib/` without changing it |
| `npm run test:ci` | Verify shipped artifacts match source, then run the core suite |
| `npm test` | Rebuild, then run the core Vitest suite |
| `npm run test:compat` | Pack once and test the installed artifact across every supported host fixture |
| `npm run test:compat -- v015-rc1 v017-rc2 v021-alpha1` | Test only the named fixtures; unknown names fail |
| `npm run test:install` | Test npm Git installation and fresh pnpm 11.7.0 Git/tarball installs with no script approvals, plus consumer type resolution |
| `npm run test:install -- npm` / `-- pnpm` | Run just one package manager; unknown names fail |
| `npm run verify` | Run core, compatibility, and installation checks |

The checks use loopback gateways and local fixtures, not paid inference or an installed user profile. Compatibility and installation checks need registry access; installation checks also require Git. Temporary consumers are created outside the repository and removed on success or failure. Tests never implicitly skip a missing host environment.

## Build before distribution

The default Git branch ships `lib/` so a GitHub URL, an npm release, and an npm tarball all supply ready-to-load code. There are no `prepare`, `prepack`, `prepublish`, or dependency installation hooks. The explicit build command is named `compile` because npm also treats a script named `build` as a reason to prepare a Git dependency and install its development dependencies. `prepublishOnly` checks artifact freshness when a maintainer publishes to npm; it does not execute during dependency installation.

After source or build-tool changes, run `npm run compile` and commit the regenerated `lib/` with those changes. `npm run check:dist` checks missing, changed, and extra artifacts against an independent rebuild. CI uses `npm run test:ci` so it checks the committed files before running tests, instead of silently replacing stale files first. CSS module filenames are repository-relative, CSS export keys are sorted, and declaration line endings are fixed to LF so artifacts are independent of the checkout path and operating system.

The installation regression creates a fresh repository containing the shipped artifacts but no `src/`, `scripts/`, `tests/`, or `node_modules/`, then installs it with both package managers. Each installed package must expose its host and client entrypoints, declarations, build metadata, and importable host module, and must not declare scripts that trigger Git preparation or dependency installation hooks. Fresh pnpm consumers install both the Git artifact and a packed npm artifact with `strictDepBuilds=true`, separate empty stores and isolated user configuration. They receive no `allowBuilds` entries, including Google/protobuf skips. The fixtures assert that the private SDK alias, Google SDK and protobufjs are absent, and type-check exported model types without access to development dependencies. The cold Git identity changes for each temporary repository. Consumer profiles and their trust settings are never modified by these tests.

## Installed-package matrix

`scripts/compatibility-hosts.mjs` lists ten host generations, including DSH `0.2.0-rc.2` and `0.2.1-alpha.1`. Each `tests/hosts/<id>` has a private manifest and its own lockfile. DSH packages and their required DSH peer/dependency closure are pinned to that host generation, together with compatible Cordis packages. This prevents a broad upstream peer range from silently selecting a later host generation. The 0.2 fixtures also install their real `dsh-llm-pi-ai` adapter and public pi-ai dependency alongside this plugin.

The runner performs these steps for each host:

1. Copy the manifest and lockfile into a fresh consumer outside the checkout.
2. Run `npm ci --strict-peer-deps` to validate that host's dependency contracts.
3. Install the same plugin tarball used by every other host.
4. Check that the host's pinned packages retained their versions and the plugin is an actual installed directory.
5. Copy the fixtures into the consumer and run them in separate Node processes.

Local compatibility runs are serial by default. Set `DSH_COMPAT_CONCURRENCY` to a positive integer to run that many isolated hosts at once; CI uses four workers and prefers its restored npm download cache, fetching missing packages as needed. Each host keeps its own dependency installation and fixture processes, and all workers consume the same tarball. A failed host does not skip queued hosts or delete files still used by running checks: the runner collects every result before cleanup. Logs are grouped by host, and the console and GitHub job summary report each result and elapsed time.

All host JavaScript imports use ordinary Node resolution. The fixtures do not redirect DSH imports to alternate packages or load the plugin from the source checkout. The client fixture uses the consumer's React, store, and UI primitives, with a CSS loader for published host styles. It verifies the installed browser factory, settings registration, catalog injection, rendering, CSS, and cleanup. Host fixtures retain text streaming, real image processing, history/offload, limits, reasoning, live settings, and profile-bundle checks. Each host also runs all three wire protocols through prompt and tool declaration checks, a streamed tool call, JSON-restored assistant replay, tool-result continuation, and a one-shot request with no tools.

## Architecture and ownership

`src/index.ts` composes the host services. `src/config-contract.ts` is the browser-safe configuration vocabulary; both faces import it instead of maintaining separate interfaces. Version-dependent settings attachment lives in `src/host-settings.ts` and `src/client/host-compat.ts`. `src/settings-bridge.ts` owns section/profile selection and the applied/rejected/unknown write verdict: modern acknowledgments are authoritative, while older hosts require a committed-state check.

`GoCatalogManager` owns one configuration-keyed catalog per mount. Inference, model discovery and the settings model service share that catalog directly. The inference adapter retains its standalone catalog fallback for public callers. A superseded catalog cannot send a late route-refresh notification.

The browser sends typed `opencodeGoAccounts.execute` commands for account additions, removals, selection, naming, ordering, automatic switching and key replacement, including staged key drafts. `GoAccountManager` serializes these commands with recovery; both use `accountOperationPatch` to finish the same durable intention. A client-generated addition ID makes RPC retries idempotent. The UI owns drafts, busy state and quota display; the host owns credentials and revision-guarded metadata writes. Add account operations to the shared command contract and host manager, rather than creating another browser write path.

`src/account-policy.ts` decides whether a failed request may try another account and whether a gateway key should be remembered as rejected. Error classification stays in `src/gateway-error.ts`; stream lifecycle and dispatch stay in `src/adapter.ts`. Both terminal stream errors and thrown errors use the same policy, which blocks fallback after any output, positive token usage or cancellation.

## Failure boundaries and resource policy

The gateway uses HTTP 401 for model errors, subscription limits and authentication failures. `gateway-error.ts` classifies captured `error.type`/`error.code` first. Untyped quota text is admitted only on HTTP 401/402/403/429; untyped 5xx keeps `SERVER` (504 keeps `TIMEOUT`) even when diagnostics quote earlier quota failures. A generic 401/403 never proves a key is invalid. Only `INVALID_CREDENTIAL` is remembered as a gateway key rejection; quota failures can switch accounts before output but do not blacklist credentials. HTTP 200 stream errors continue through the stream mapper's fallback classification. Retry-After remains in bounded HTTP evidence for diagnosis; the host owns retry scheduling.

Discovery and credential/image preparation have a default 60-second deadline. Dispatch has a separate default 30-minute deadline spanning discovery, fallback and streaming. The existing idle watchdog still limits an outstanding stream read. Every external wait observes cancellation, including services that ignore their signal; canceling a catalog waiter does not abort the shared refresh. Prepared capability resolution has its own preparation deadline, and the dispatch timer starts when the prepared stream is consumed.

Image count preflight does not estimate encoded bytes on modern hosts. Four shared permits and a 32-task queue bound preparation across simultaneous calls; exact encoded sizes are checked incrementally with unknown sizes contributing zero. A shared 128 MiB lease budget charges each prepared raw image plus occurrence-weighted base64 bytes. Adapter leases last through streaming and release on completion, failure or consumer stop; standalone conversion only holds its lease during conversion. Queue/budget admission fails with `IMAGE_RESOURCE_BUSY`, without account switching. This logical budget excludes decoder RSS, JSON/SDK copies and retained history. A returned raw image exists before its charge is checked, so four active native operations can still produce transient overshoot. Failure aborts queued work. An in-flight service that ignores cancellation retains its permit until it really settles, so cancellation cannot accidentally admit unbounded native work. A permanently stuck service can therefore exhaust these slots and needs host/service recovery. DSH 0.1.5 retains its transient projection policy; later hosts retain durable `IMAGE_OFFLOAD_REQUIRED` retries.

`StagedForm` submits settings set/unset operations in one `scope.mutate` with the captured revision. A refused batch leaves drafts and does not write secrets. Successful settings drafts clear even if a separate secret write fails, allowing an idempotent retry. A newer draft typed during a save is retained. Settings and credentials remain separate stores, without a cross-store transaction.

Account additions and generated-account removals first confirm a durable `accountOperations` intention in the account's own section/profile. The hidden field stores operation ID, kind and account metadata, never a key. The Host reconciles it at startup, settings/credential connection and committed updates. Already stored addition keys gain their metadata; additions without keys remain visible and can be repaired or removed. Deletion intentions finish credential removal before atomically removing metadata and the intention. Revision guards preserve concurrent edits and later selections; a refused store retains the intention, with at most four passes per trigger and a 30-second deadline per operation. Closing or replacing the connection cancels its waits so a new service can resume. Credential deletion requires an exact generated ID/reference pairing; external or shared legacy references keep their values. Recovery acts only while its service connection is current. Cancelling a wait cannot roll back an already accepted storage write. It cannot recover a key that was never stored, provide isolation against arbitrary simultaneous writes in other profiles, or repair operations predating the journal. Manually sharing a generated reference across profiles also shares its deletion lifecycle.

A nonempty gateway listing with no valid model IDs is a discovery failure and preserves served membership. A confirmed empty list clears it. Missing models on a cold or failed listing report `DISCOVERY_FAILED`, while confirmed absence reports `UNKNOWN_MODEL` through the adapter. Mixed valid/invalid rows use valid IDs and expose a warning in `sources.listing.warning`, the settings page and Host logs. The warning includes counts and at most eight row positions, never malformed row contents, and clears after a clean listing. The choice favors usable partial data while making potential membership loss visible. Public disk metadata still does not establish gateway membership after a restart.

The public `onCallTrace` observer receives one content-free summary per dispatch: random call ID, model, elapsed and stage milliseconds, attempt count, outcome and final code. A bounded `attemptDetails` array includes each attempt's stages, outcome/code, HTTP status, selected redacted upstream request ID, first text/reasoning/tool-argument delta latency and image pool diagnostics. Queue wait is summed across image tasks and may exceed wall-clock image-stage time. HTTP evidence files carry the same call ID and attempt number. There is no stable account identity in this trace. The plugin forwards it to the host debug logger. Observer failures cannot alter inference. Compile-time `never` checking and runtime rejection guard the SDK event union; unknown host roles are explicitly rejected. The open peer range is an installation policy, while the installed matrix is the finite evidence of compatibility.

## Reasoning intent

`src/protocol-contract.ts` restricts the experimental `protocolOverrides` surface to DeepSeek V4.1 Flash → Responses. `src/protocol-policy.ts` resolves the wire API, base URL and fresh protocol compatibility profile together on the captured request config, before capacity overrides. The cached catalog remains unmodified. Effort choices stay those advertised by metadata; an unexpected native toggle/budget or source protocol is rejected before inference. Protocol errors do not trigger a second-protocol retry. The installed-host transcript matrix exercises the override as a Chat Completions-declared model through the real Responses SDK, including tool-result continuation and restored replay; focused tests also switch existing histories in both directions and retain only valid native reasoning state.

For latency comparisons, fix the account, proxy/network, prompt, model, reasoning effort, output cap and stable `x-opencode-session` header. Interleave protocols and report cold and warm samples separately. Measure first body-text delta, total time, output/reasoning tokens and failures; the existing `GoCallTrace.firstOutputMs` includes reasoning and tool deltas and is not body-text TTFT. Local fixtures establish compatibility, not live gateway speed or its underlying provider. Run paid live benchmarks only when requested.

`scripts/benchmark-protocols.mjs` compares the plugin already installed in the macOS desktop profile using the app's actual peer packages. It requires explicit `--live`, performs 20 bounded synthetic calls with a 4,096-token output cap, and writes JSON results under `opencode-protocol-benchmark-<runId>` without changing settings or stored credentials. Automatic fallback is disabled in memory. The output includes first and repeated samples, reasoning/output tokens, route headers, and failures; first-session samples do not prove an upstream cache miss. Run its offline observer/statistics check with `node scripts/benchmark-protocols.mjs --self-test`.

```sh
ELECTRON_RUN_AS_NODE=1 '/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness' scripts/benchmark-protocols.mjs --live
```

Use `--profile`, `--resources`, or `--out` to change the desktop profile, application resources directory, or report directory. The selected account's credential is read from the environment or the user's DSH credential store and stays in memory.

The model catalog records whether controls are a switch, adjustable effort, or a token budget, independently of pi-ai's wire compatibility hints. `src/reasoning.ts` owns the picker choices and translates a validated selection into Default, Off, On, an explicit effort, or a token budget. Model resolution declares no `defaultEffort`: an omitted user choice remains omitted through the DSH runtime.

Before the SDK sends a payload, the shared `onPayload` hook removes automatic thinking controls for Default. For On it retains the SDK's native enable/budget but removes synthetic effort fields. Off and explicit effort keep the SDK's serialization. Other output configuration, rendering and history options are retained, and payload edits do not mutate shared catalog models. Switches keep their previous opaque `high` ID for durable selection compatibility and display it as On. The verified MiMo Flash control override stays in the same reasoning module.

Token budgets use pi-ai's `thinkingBudgets` override; the SDK still handles the wire field, context ceiling, and answer room. Only SDK-supported budget protocols expose the control; adaptive Anthropic models retain effort controls. Models declaring both effort and budget keep their efforts and can add numeric budget choices. Standard budget presets retain the historical `minimal`/`low`/`medium`/`high` IDs. Additional presets use durable `budget:N` IDs and are configured in `modelLimits[modelId].thinkingBudgets`. Catalog bounds reach the settings page through the models RPC; numeric choices and request settings are captured together before dispatch.

## Bundled pi-ai implementation

The development dependency `opencode-go-pi-ai` is an npm alias for `@earendil-works/pi-ai@1.1.0`. esbuild retains the three supported protocol implementations and the OpenCode Go model table, and discards unrelated provider implementations. Public SDK types are flattened into `lib/types/sdk-types.d.ts`; consumers do not need the private alias to resolve them. OpenAI 7.19.0 and Anthropic 0.129.0 remain runtime dependencies at the same versions pi-ai uses. Bundled code and type licenses ship in `lib/vendor-licenses.txt`.

The published package does not depend on pi-ai, so it no longer introduces pi-ai's unrelated Google SDK and protobufjs install hooks. This avoids the pnpm 11 script-approval interruption that triggered issue #43 without changing the host's policy. An npm consumer separately includes public pi-ai 0.85.1 and a peer-only probe, plus OpenAI 6.40.0 and Anthropic 0.124.0. It verifies that the peer retains pi-ai 0.85.1, the consumer retains both older transport SDKs, and the plugin resolves its own OpenAI 7.19.0 and Anthropic 0.129.0. Other plugins' dependencies still follow the user's host trust settings.

DSH requests still convert through `toPiContext`, preserving the existing host input and durable replay contracts. Immediately before calling a provider directly, the adapter applies pi-ai's `normalizeContext`. In 1.1.0, direct providers require `TranscriptContext`; only `Models` streaming entry points normalize legacy Context automatically. Normalizing at this call site preserves the system prompt and tool declarations on both text and image paths without tying the SDK format to the DSH version.

This upgrade does not enable developer messages, tool-change blocks, or deferred tool loading. Their existing `UNSUPPORTED_CONTENT` errors remain explicit. The minimum DSH version and peer ranges stay unchanged; new host fixtures verify runtime compatibility rather than expanding the supported content vocabulary.

There is one explicit npm prerelease exception: DSH evaluates plugin ranges with prereleases included, whereas npm does not generally accept a future prerelease under `>=0.1.5-rc.1`. Only the tarball-install step uses `--legacy-peer-deps` after the host has passed strict installation. This is not a project `.npmrc` policy and does not affect root installs. The post-install version assertions ensure npm did not replace pinned host packages. Changing the plugin's published version policy is a separate decision.

DSH 0.2.1-alpha.1 uses Cordis 4.0.5-alpha.1 and Schemastery 3.18.5-alpha.1 and no longer publishes runtime invariant plugins. Its fixture pins that dependency generation without the removed package. The plugin does not import invariant entrypoints or replace the former composer statistics row; its quota pill uses the retained `conversation.input.right` list slot. The installed client check verifies that the published composer still declares that slot, and profile checks validate proxy writes, rejection, clearing and reset through each modern host's real settings service.

## Updating a fixture

Add or update the entry in `scripts/compatibility-hosts.mjs`, its private manifest, and its lockfile together. Pin each DSH package reached through dependencies and required peers to the intended host generation; do not upgrade an old host merely to satisfy a newer package. Keep compatible Cordis versions and the client fixture's React, DOM, CSS, and UI dependencies explicit.

Generate a lockfile in a clean temporary directory containing that fixture's manifest:

```sh
npm install --package-lock-only --ignore-scripts --strict-peer-deps
```

Copy the resulting lockfile back to its fixture directory. Generating it outside the checkout prevents an existing root `node_modules` from influencing resolution. Then run the selected compatibility check and the full verification before release. Root development dependency changes require the same strict resolution discipline.

After changing the root lockfile, verify a clean `npm ci --strict-peer-deps` and `npm run test:ci` with each supported Node version's bundled npm. Node 22.19.0 ships npm 10.9.3; running Node 22 with a newer npm does not check that install contract. In this dependency tree, npm 10 requires the optional esbuild peer used by Vite under Vitest to be recorded, even when npm 11 can install without that record. Keep its platform packages in the lockfile as well.

The GitHub workflow runs core and Git-installation checks on Linux and Windows with Node 22.19.0 and 24. Core tests, npm installs, and pnpm installs run as independent jobs, so one slow installation does not consume another check's time allowance. Installation jobs need no root `npm ci`: their runner uses only Node built-ins, and the fresh Git fixture supplies committed artifacts and must not need build dependencies or plugin build approval. The complete installed-host matrix runs separately on Linux/Node 24.

Installation jobs reuse the npm download cache and a separate pnpm store, preferring cached packages while still fetching missing data. They never restore the checkout's `node_modules` or `lib/`. CI keeps the npm cache, isolated consumers, and the cached pnpm store under `RUNNER_TEMP`, on the runner's work volume. `DSH_PNPM_STORE_DIR` selects the pnpm store; local runs use the system temporary directory and the default package caches unless overridden.

Every Git-installation run reports fixture preparation, installation, artifact verification, cleanup, and total elapsed time. GitHub job summaries include a phase table. CI also enables npm's internal timing records and uploads the `*-timing.json` files for seven days, for diagnosing dependency resolution and extraction; a timeout may prevent the still-running process from writing its final timing file. The 15-minute job limit remains unchanged.
