# Verification

## Account card owns credential editing (2026-10-06)

The settings page no longer shows the standalone preferred-account Key field when account management is available. The first card contains provider activation; adding or replacing credentials happens in the account card. Callers without account actions retain the standalone credential control. The production build, Host/Client type checks, all **466 tests in 30 files**, and the freshness check for **37 shipped artifacts** passed. Existing model-switch and locale-change draft checks now exercise the staged refresh interval, while account credential behavior remains covered by the account suite. The user tested the installed Desktop package and accepted the changes before requesting the merge.

## PR #38 account regressions (2026-10-06)

Adding an account now persists a configured legacy account, or one whose credential status is unknown, so selecting the new account cannot remove the old one from the list or fallback candidates. Only a confirmed empty legacy placeholder is discarded. Removing a managed account now retains its metadata and key when credential description fails or omits that reference, allowing the same operation to be retried. Gateway key rejections are cached by normalized endpoint and credential reference; switching endpoints rechecks the preferred account, returning to an endpoint retains its own rejection, and replacing a credential clears its rejections across endpoints.

On macOS / Node 24.14.1, the production build passed both Host and Client type checks. `npm run test:ci` passed **466 tests in 30 files** and the byte-for-byte freshness check for all **37 shipped artifacts**. Seven added regressions cover legacy default/custom references, rejected/thrown/missing credential descriptions with successful retries, endpoint isolation, equivalent trailing-slash URLs, and credential invalidation across endpoints; the existing unknown-credential test now verifies preservation through repeated additions and selection changes. `npm run test:compat -- v020-rc2` passed the installed Host, transcript, reasoning, client, profile and bundle fixtures for **DSH 0.2.0-rc.2** in **63.5 seconds** including cleanup. Automated checks used local gateway fixtures; the user subsequently accepted the installed Desktop package.

## Usage pill collapses under a narrow composer instead of wrapping or overflowing

The account usage pill in the composer's trailing control group rendered its whole label — brand prefix, both window readings with unit words, the optional stale suffix, and (with more than one account configured) the selected account name — as one unbreakable string. That group is `flex: none` by design, so below the Host's own ~460px composer-row breakpoint it already wraps onto its own line; the pill's own untruncated width then forced a *second* wrap inside that line. Narrower still, the pill's width exceeded the row's remaining content box and pushed the send/model controls past the composer card's right edge. The multi-account work made the worst case worse: the account name is the longest of the four segments and appears exactly where space is scarcest.

The fix keeps the label as one string for accessibility — `aria-label` and the newly added `title` carry the full text, and `textContent` still concatenates to exactly the old string — but renders it as addressable `<span>`s (a `brand` prefix, a `reading` group with a `data-stale` flag, `unit` words inside the reading, a `stale` suffix, and an `account` segment). The account segment is capped at `12ch` with an ellipsis to keep valid names of up to 80 characters from making the pill arbitrarily wide. Two anonymous `@container` tiers use the same composer row already used by `PermissionSelect.module.css`:

* **≤ 460px** — hide the `brand` prefix, `stale` suffix and account name. A bare `::after` asterisk on `[data-stale]` replaces the stale wording, so the signal survives without adding text. The popup's own account selector restates the account name in full.
* **≤ 360px** — additionally hide the `unit` words, leaving only the bare percentages.

Both tiers are CSS-only (`display: none`), so `textContent` — and every existing assertion built on it — is unaffected; jsdom does not evaluate container queries, so the unit tests exercise the unsegmented string in both states. The non-usage state (`···` / unavailable) gets the same treatment for the account segment and keeps the brand span, so a failure while a second account is selected does not reintroduce the overflow.

Validation: `npm ci --strict-peer-deps`, both TypeScript faces, and the production build passed on Linux / Node 22.23.3 / npm 10.9.9. `npm run test:ci` passed **431 tests in 30 files** and the freshness check for all **37 shipped build files**, including twelve added segment assertions in `tests/usage-pill.client.spec.tsx` (the `brand`/`unit`/`reading`/`stale` shape, the `title` attribute, the unsegmented non-usage state) and three new cases for the account segment — present and hideable with more than one account, present in the non-usage state, and absent with at most one. One pre-existing `tests/localization.client.spec.tsx` assertion moved from `getByText` to the trigger's `textContent`, because the label is no longer a single text node. `DSH_COMPAT_CONCURRENCY=4 npm run test:compat` passed **all nine installed-host generations** in **46.9 seconds** including cleanup, and `npm run test:install` passed for both **npm (4.7 s)** and **pnpm (2.5 s)** Git installations, loading the shipped artifacts without source builds or plugin build approval. Every check used loopback fixtures; the 460px and 360px cut points were not re-measured in a browser on this branch, and no installed user profile, GitHub issue or npm publication was changed.

## Release 0.1.20: usage pill and settings draft fixes (2026-10-02)

The release includes the Host scope receiver fix and shared no-op draft predicate from PR #34. The installed-client compatibility fixture now reads instance state and exercises both SSR snapshot reads and client subscription cleanup. Desktop follow-up confirmed that saving Always works after restarting a Host process that predated the installed plugin update; the upgrade instructions now explicitly require quitting and reopening desktop Harness.

On macOS / Node 24.14.1, `DSH_COMPAT_CONCURRENCY=4 npm run verify` passed **401 tests in 28 files**, freshness checks for **34 shipped build files**, **all nine installed-host generations**, and both **npm and pnpm Git installation checks**. The compatibility run took **87.9 seconds** including cleanup; installation checks took **11.8 seconds**. Both installation paths loaded the shipped artifacts without source builds or plugin build approval and retained the private pi-ai 0.87.1 alongside the independent peer's 0.85.1. The test suite used local gateways and isolated consumers.

## Usage pill rendering on a real Host and the staged override badge (2026-10-02)

The browser half no longer hands the Host settings scope's methods over as plain values. `UsagePill` subscribed with `useSyncExternalStore(settings.subscribe, settings.getSnapshot, ...)`, and a Host scope is a class instance whose methods read their own state (`ConfigFormController` behind `ctx.configForms.get(entryId)`, `SettingsScopeController` behind `ctx.settingsScope.bind(spec)`); both providers return that instance as-is. The detached reference lost its receiver, so the pill threw `TypeError: Cannot read properties of undefined (reading 'store')` on its first render, the slot's per-entry error boundary removed it, and no usage mode could ever show a pill — including Always, which is why a saved `usageDisplay: always` had no visible effect. React now reaches the scope through `useCallback` wrappers, the same shape the Host's own slot outlet uses.

The staged form's override badge now answers for the same state its save plan does. `plan` skipped a draft equal to the field's effective value while `field` reported it as an override, so a value typed back to its original (`60 → 59 → 60`) disabled Save and Discard yet kept the "overridden" badge, its reset button, and the advanced card's badge. Both paths now share one `unchangedDraft` predicate: a no-op draft reports whatever the user layer already holds, a clear still previews as not overridden, and an invalid draft still blocks the save.

Before the fix, `npx vitest run tests/usage-pill.client.spec.tsx tests/stores.client.spec.ts` failed 25 of 54 cases: all **24** usage-pill cases (including the new receiver case) with the detached-call `TypeError`, and the new no-op-draft case on `overridden`. The test double now keeps its scope methods on the prototype (`tests/support/settings-scope.ts`) and the installed-host fixture builds the same class shape, so a method passed as a value fails in tests exactly as it failed in a browser; before this change every double used arrow-function literals, which is what hid the regression from the suite and from the `v020-rc2` compatibility row.

Host/Client type checks and production compilation passed; `npm run test:ci` passed **401 tests in 28 files** and freshness checks for all **34 shipped artifacts** on Windows / Node 24.15.0. `DSH_COMPAT_CONCURRENCY=1 npm run test:compat -- v020-rc2 v017-rc2` passed both installed generations — 0.2.0-rc.2 and 0.1.7-rc.2 (both use the `configForms` path) — including the client fixture's module table, settings binding, rendering, CSS and cleanup. On this machine the client fixture also exceeded the runner's 30-second per-fixture limit before this change, so the two local rows ran with that limit temporarily raised to 180 seconds; the committed limit is unchanged. The other seven host generations, macOS and Linux, and a live Desktop session were not exercised. Every check used loopback fixtures; no installed user profile, GitHub issue or npm publication was changed.

Follow-up on macOS / Node 24.14.1: the installed-host fixture now reads `this.snapshot` and `this.listeners`; prototype methods that only closed over local variables still allowed detached calls. Its SSR checks exercise the snapshot reader, and a client mount/unmount now checks the scope subscription and cleanup while Auto keeps the pill hidden. The receiver unit case also checks a live display change and subscription disposal. Two temporary negative-control bundles failed as expected: the original detached snapshot reader threw on `snapshot`, and a client with only the subscription detached threw on `listeners`; the fixed bundle passed. Both type checks, **401 tests in 28 files**, all **34 shipped artifacts**, and **all nine installed-host generations** passed. The compatibility run took **88.2 seconds** including cleanup, with the committed 30-second fixture limit unchanged. The matrix exercises legacy `settingsScope` on 0.1.5/0.1.6 and `configForms` on 0.1.7/0.2. No live Desktop UI or installed user profile was exercised.

## Release 0.1.19: consolidate pending features (2026-10-02)

The prepared-call configuration, Anthropic alias replay and usage-display changes are now integrated with 0.1.18's MiMo controls. Prepared calls retain the captured endpoint, credential reference and nested capacities; later calls use updated settings. Anthropic replay preserves signed thinking against the requested model ID. Settings now offer Auto / Always / Off usage visibility, with Off and a disabled plugin stopping the poller. The existing default remains Auto.

Host/Client type checks, production compilation, **398 tests in 28 files**, and freshness checks for **34 shipped artifacts** passed on macOS / Node 24.14.1. All **nine installed-host generations** passed, including DSH 0.2.0-rc.2, prepared-call dispatch, signed alias replay, MiMo Default/Off controls and usage-display settings. The complete compatibility run took 73.8 seconds including cleanup. Both npm and pnpm 11.7.0 Git installations passed without plugin build approval, retaining the plugin's private pi-ai 0.87.1 and the independent peer's 0.85.1. This integration uses isolated local gateway fixtures; the earlier live MiMo observations are recorded in the 0.1.18 entry.

## Release 0.1.18 validation (2026-10-02)

The 0.1.18 manifest passed Host/Client type checks, production compilation, all **381 tests in 27 files**, and freshness checks for **33 shipped artifacts** on macOS / Node 24.14.1. Both npm and pnpm 11.7.0 Git installations passed with the new version, without plugin build approval; the plugin retains private pi-ai 0.87.1 and the independent peer retains public pi-ai 0.85.1. The nine-host compatibility checks and live OpenCode Go observations for this reasoning fix are recorded below.

## Issue #28: MiMo reasoning controls (2026-10-02)

The metadata reader no longer derives an `off` effort spelling from intrinsic reasoning or creates generic OpenAI effort levels from toggle/budget declarations. Established DeepSeek/Qwen native switches remain supported. An exact `mimo-v2.6-flash` / OpenAI Completions rule supplies **Off, Low, Medium, High** in both online metadata and built-in outage fallbacks. Off maps to `none`; an unset effort suppresses the SDK's implicit Off mapping on a request-local model copy, preserving gateway-default reasoning and the shared picker map. Other MiMo models do not inherit this rule.

Direct streaming requests to **OpenCode Go**, using the same TypeScript interval-merging prompt and a 4,096-token output cap, produced the following observations. Counts measure individual responses, not comparative reasoning quality or guaranteed effort ordering.

| Wire `reasoning_effort` | HTTP | Reasoning tokens | Finish |
| --- | ---: | ---: | --- |
| Omitted | 200 | 122 | stop |
| `none` | 200 | 0 | stop |
| `low` | 200 | 626 | stop |
| `medium` | 200 | 383 | stop |
| `high` | 200 | 71 | stop |
| `off` | 400 | — | Invalid request parameters |

Two further live calls went through the rebuilt plugin, DSH LLM runtime and actual SDK, using an isolated temporary metadata cache. Default omitted the wire field and returned **14 reasoning tokens**, 74 reasoning characters and 1,605 answer characters. Explicit Off sent `none` and returned **0 reasoning tokens**, no reasoning characters and 902 answer characters. Both returned HTTP 200 and finished with `stop`. This confirms Default remains distinct from Off through the implemented request path; the installed user profile was not changed.

Host/Client type checks and production compilation passed. `npm run test:ci` passed **381 tests in 27 files** and freshness checks for all **33 shipped artifacts**. New regressions cover online and outage paths, all four supported choices, rejection of unsupported choices before inference, Default/Off alternation without shared-map mutation, exact-model/protocol boundaries, future advertised `none`, and native controls. `DSH_COMPAT_CONCURRENCY=3 npm run test:compat` passed all **nine isolated installed-host generations**, from 0.1.5-rc.1 through **0.2.0-rc.2**, with 13 reasoning streams per generation plus the existing Host/Client/transcript/profile/bundle checks; total time including cleanup was 88.2 seconds. Other operating systems and a Desktop GUI session were not exercised for this change.

## Prepared-call configuration and Anthropic alias replay (2026-09-30)

The adapter now copies its configuration, including nested model limits, before catalog discovery. Its `prepareCall` binds the resolved model, catalog provider and that configuration to the eventual stream. Credential resolution receives the captured configuration instead of re-reading the current key reference. This keeps an already prepared request on its original endpoint and credential reference while later requests use changed settings. Direct streams use the same capture path. Existing credential values still resolve through the Host service at dispatch; the reference is the frozen fact.

Anthropic replay now reconstructs the assistant with the requested model ID. The provider-reported alias remains in `responseModel` as informational metadata, preserving envelope version 2 and previously saved history. pi-ai therefore retains signed thinking when continuing the same requested model, while an actual switch to another model still strips those signatures.

Before the fix, `npx vitest run tests/call-snapshot.spec.ts tests/provider-identity.spec.ts` failed all four new regressions: nested limits changed during discovery, a prepared request went to the new endpoint, a direct stream combined the old endpoint with the new key reference, and JSON-restored Anthropic alias history lost its thinking signature. The same tests pass after the fix, also checking that subsequent requests use the new endpoint/key/capacities and that actual model changes still remove incompatible signatures.

`npm test` passed Host/Client type checks, rebuilt the distributed artifacts and passed **371 tests in 27 files**. `npm run check:dist` confirmed all **32** shipped files match source. The installed-package matrix passed all **nine** host generations from `0.1.5-rc.1` through `0.2.0-rc.2`; each now checks prepared endpoint/key/limit retention and signed Anthropic alias replay through a streamed tool call, JSON restoration and tool-result continuation.

The original differential probe was rerun with the rebuilt tarball and real `0.2.0-rc.2` dependencies. Both native and plugin prepared requests stayed on endpoint A, the plugin paired endpoint A with fixture key A during a held catalog refresh, and both retained Anthropic thinking signatures. Existing reasoning defaults and forced output-cap behavior remained unchanged. All requests used isolated temporary caches, loopback gateways and dummy credentials; no paid inference or installed user profile was changed during this fix.

## Release 0.1.17 validation (2026-09-30)

After integrating the npm 10 lockfile correction, the 0.1.17 manifest passed Host/Client type checks, all **367 tests in 26 files**, and freshness checks for **32 shipped artifacts** on macOS / Node 24.14.1. Both npm and pnpm 11.7.0 Git installs passed without plugin build approval; the installed package uses private pi-ai 0.87.1 while the independent peer probe keeps public pi-ai 0.85.1. The nine-generation runtime compatibility results below remain applicable: the subsequent integration changes only lockfile metadata, documentation and the package version.

## Independent DSH provider route (2026-09-30)

The public LLM route is now `dsh-opencode-go`, shown as **DSH OpenCode Go**, and does not register an `opencode-go` alias. This permits the generic host adapter and the plugin to register in either order. The SDK's native provider remains `opencode-go`, preserving its OpenCode-specific reasoning serialization and models.dev lookup. Host and Client share the route constant; settings discovery and the usage badge follow the new route. The profile entry `opencode-go`, settings namespace, credentials and metadata cache retain their existing identities.

Durable replay still uses envelope version 2. Its `provider` matches the DSH assistant source; the optional `sdkProvider` restores the SDK's native identity. JSON-restored requests retain reasoning signatures and tool replay. A saved session or Agent/headless preset selecting the old route must explicitly select `dsh-opencode-go`; DSH's existing cross-adapter ownership rules strip old private replay metadata while keeping durable session content. The plugin does not rewrite user profiles or historical route selections.

Before the change, `npx vitest run tests/provider-identity.spec.ts` failed all three regressions: plugin-first registration prevented the host route from mounting, host-first registration left the plugin without its own route, and the independent route had no replay state. These now pass, including real loopback streams for both routes, JSON-restored reasoning continuation, and old-session content after switching. The usage badge also verifies that selecting the host's `opencode-go` starts no plugin polling.

Host/Client type checks, production compilation, all **367 tests in 26 files**, and freshness checks for all **32 shipped build files** passed on macOS / Node 24.14.1. `DSH_COMPAT_CONCURRENCY=3 npm run test:compat` passed all **nine isolated installed-host generations**, from 0.1.5-rc.1 through 0.2.0-rc.2, including three-protocol replay, reasoning, images, Client rendering, live settings and applicable Desktop/Web/Headless bundle gates. The run took 884 seconds, dominated by npm installation in the first three consumers. No live inference, installed user profile, GitHub issue or npm publication was changed. This addresses route collisions; the stale protocol dependency reported in Issue #26 remains a separate investigation.

## Issue #22: gzip metadata download on slow connections (2026-09-30)

Only the models.dev request now negotiates `accept-encoding: gzip`; listing and usage requests retain `identity`. Requests still use the host's global Fetch and dispatcher. Normally Fetch decodes gzip. If the Issue #7 HTTP/2 mismatch instead delivers raw gzip bytes, the metadata reader recognizes the gzip signature and asynchronously decompresses that one format. Both delivered input and decoded output remain bounded to 16 MiB. Download, connection retry, and recovery decompression share the original 30-second abort signal; corrupt gzip is not retried. No cache format, persistence policy, or proxy configuration changed.

Before the change, `vitest run tests/metadata-transport.spec.ts` failed both regressions: a cold catalog timed out transferring approximately 5.23 MB over a local bandwidth-limited HTTP connection, and raw gzip metadata with missing encoding headers failed JSON parsing. Both pass after the change. The bandwidth fixture gives both representations the same 16 KiB per 10 ms transfer budget and scales the deadline to 500 ms. Further regressions cover Fetch-decoded gzip, raw gzip with present or missing headers, input/output limits, corrupt data, cancellation, listing negotiation, and persisted ETag verification.

A separate real TLS/HTTP/2 fixture used Node 24.14.1's built-in Fetch with an Undici 8.11.0 global ProxyAgent through a local CONNECT tunnel. The control lost encoding headers and returned raw gzip that native JSON parsing rejected. The shared reader and an actual cold catalog both succeeded through the same proxy; all four reads used HTTP/2. The fixture trusted its own certificate and did not disable TLS verification. This recovers gzip bodies without changing the host's dispatcher; it does not repair the host's underlying header loss.

Host/Client type checks, production compilation, all **363 tests in 25 files**, and freshness checks for all **31 shipped build files** passed on macOS / Node 24.14.1. A public read-only probe through the updated reader received HTTP 200 with gzip and parsed 5,264,592 bytes of JSON, including 33 OpenCode Go models, in **6.83 seconds**. This measures decoded data, not wire transfer size; the response supplied no Content-Length. Existing upstream missing-source-map warnings remain. The local fixture and public probe do not guarantee connectivity on the reporter's network.

The updated package also passed `npm run test:compat -- v020-rc2` against isolated, real DSH **0.2.0-rc.2** dependencies: Host activation/RPC/streaming/images, all three transcript protocols, reasoning, Client settings/rendering/CSS, live profile settings, and bundle admission. The bundle fixture now explicitly checks **Desktop, Web and Headless** profile directories. The installed macOS Desktop app's manifest reports 0.2.0-rc.2, and a separate gzip-reader probe passed using its actual bundled **Node 24.21.0** executable. These are plugin compatibility and runtime checks, not an end-to-end Desktop GUI session; no installed user profile was updated. The npm latest version remains 0.1.16, which does not yet contain the repository's 0.2 adaptation or this gzip change.

## Node 22 bundled-npm clean installs (2026-09-30)

The [Issue #24 main-branch workflow](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36696633511) passed 11 of 13 jobs. Both Linux and Windows core jobs on Node 22.19.0 failed during `npm ci --strict-peer-deps`, before running tests, with `Missing: esbuild@0.28.2 from lock file`. Their bundled npm is 10.9.3. The previous local Node 22 checks used npm 11, so they did not cover that clean-install contract.

A fresh fixture containing only the manifest and lockfile reproduced the same error with Node 22.19.0 / npm 10.9.3 in offline dry-run mode, while npm 11 accepted the same files. Vite under Vitest declares an optional esbuild peer whose range excludes the root build tool's esbuild 0.25.12. npm 10 resolves a nested 0.28.2 and checks its lock entries; npm 11 can omit them. The fix records that optional peer and all 26 platform packages. All existing lock entries, package versions, and platform metadata are preserved.

The same isolated-fixture command rejects the original lockfile and accepts the corrected one. Clean strict installs and `npm run test:ci` passed on macOS with Node 22.19.0 / npm 10.9.3 and Node 24.14.1 / npm 11.11.0: **354 tests in 24 files** and all **31** shipped artifacts matching source in each environment. The existing Linux/Windows core jobs retain their clean-install check as the regression guard. Development guidance now requires each supported Node version's bundled npm when verifying a changed lockfile.

## Issue #24: DSH 0.2.0 and pi-ai transcript compatibility (2026-09-30)

The plugin now uses pi-ai **0.87.1** through the `opencode-go-pi-ai` npm alias. All runtime imports, lazy protocol factories, and declaration imports use that alias, leaving the host's public pi-ai dependency to resolve independently. Before a direct provider call, the adapter applies the official `normalizeContext` to the existing text or image conversion result. This preserves system prompts and tool declarations under the new transcript contract while retaining DSH `0.1.5-rc.1` as the minimum supported host. Tool argument replay uses the SDK's JSON object type; the persisted replay envelope remains version 2.

The installed-package matrix now includes **DSH 0.2.0-rc.2**, with all 50 DSH dependency/peer package entries pinned to that generation and its real `dsh-llm-pi-ai` adapter and public pi-ai 0.87.1 installed. Every host exercises all three protocols through leading system prompts, tool declarations and schemas, streamed tool calls, JSON-restored assistant replay, tool-result continuation, and one-shot prompts with no tool leakage. Existing real image preparation, offloading, reasoning, settings, client rendering, and Web/Headless admission checks remain enabled. A separate payload-only control confirmed that each direct API loses the prompt and tools without normalization and preserves both with it; the capture hook stopped execution before any network request.

Both npm and pnpm Git-installation fixtures now contain public pi-ai **0.85.1** and a plugin that declares only a broad pi-ai peer. Normal module resolution confirmed that the peer still receives 0.85.1 while this plugin receives its aliased 0.87.1. These checks use prebuilt Git artifacts without source files or plugin build approval. The updated SDK's built-in catalog now includes DeepSeek V4.1 and no longer offers its off effort; tests that need an unknown model use a deliberately fictional ID, and the off-effort transport test uses DeepSeek V4, which still declares that capability.

Validation passed on macOS: Host/Client type checks, all **31** shipped build artifacts matching source, **354 tests in 24 files** on Node **24.14.1** and minimum-version **22.19.0**, all **nine installed-host environments** on Node 24, npm and pnpm **11.7.0** Git installs on Node 24, and an additional npm Git install on Node 22.19.0. Existing upstream missing-source-map and peer warnings remain non-failing. Tests use isolated consumers and local fixture endpoints; no user profile, live inference, npm publication, or GitHub issue was changed. Developer messages, tool-change blocks, and deferred loading retain their explicit unsupported-content errors.

## Release 0.1.16 integration (2026-09-29)

The metadata-cache fix was rebased onto the merged settings-page changes from PR #21. The combined release passed Host/Client type checks and the production build, **347 tests in 24 files**, artifact freshness checks, all **eight installed-host generations**, and **npm/pnpm Git installation without plugin build approval**. Validation ran on macOS / Node 24.14.1 using isolated consumers and fixture endpoints. The earlier 336-test result below describes the cache change before integrating the latest main branch.

## Issue #22: persistent model metadata (2026-09-29)

Public models.dev metadata now survives process restarts in `DSH_HOME/cache/dsh-opencode-go/models.dev.api.json` (default home: `~/.dsh`). The versioned record contains the source URL, raw document, ETag, and last successful download/revalidation time. Reads validate the envelope, bound both the file size and bytes read, and run the document through the existing metadata converter for the current gateway. Unique temporary files and atomic rename prevent concurrent writers from publishing partial JSON. Cache read/write failures cannot discard a usable online result. Gateway listings and credentials are not persisted.

An ordinary cold catalog read with cached metadata waits for the live gateway listing and can then serve configured models while one shared online refresh completes. Manual discovery and unknown-model resolution wait for that refresh. The completed snapshot updates the picker; a late refresh from a replaced catalog cannot notify the current adapter, and unmount clears the registration. Disk reads do not mark metadata live or advance its success time. Failed revalidation preserves cached configuration and its previous timestamp, retains diagnostics, and follows the existing retry backoff. A successful HTTP 304 updates the persisted verification time and validator. The gateway still decides membership, including an empty listing; a cold gateway outage never advertises models solely from disk.

Regression coverage includes cross-instance recovery, nonblocking startup with a held metadata response, concurrent manual/unknown reads, cancellation, fast metadata versus delayed listings, background failure/backoff, picker notifications, changed gateways, HTTP 304, corrupt/oversized/unsupported cache records, invalid timestamps/validators, failed writes, concurrent writers, and empty/unreachable listings. Core tests and installed-host fixture processes use isolated DSH homes so they cannot read or modify a user's cache. The new cache tests failed against the original implementation before the fix.

Validation: `npm test` passed Host/Client type checks, regenerated the shipped artifacts, and passed **336 tests in 24 files**. The tightened response-ordering regression and all **21 cache tests** also passed. `npm run check:dist` verified the shipped artifacts. The installed tarball passed all **eight host generations** with `DSH_COMPAT_CONCURRENCY=4 npm_config_prefer_offline=true npm run test:compat`. A separate two-process check against `lib/index.js` downloaded fixture metadata in the first process, then recovered the model in a second process with the metadata endpoint offline; `metadataLive` remained false and the successful timestamp was unchanged. Checks ran on macOS / Node 24.14.1 with local or mocked endpoints and no inference calls. Existing upstream missing-source-map warnings remain.

Requests retain `accept-encoding: identity` to preserve the Issue #7 host compatibility fix. This change improves startup after a successful download; a first installation without cache still needs the online metadata request. Compression negotiation is a separate transport change.

## Settings page cards with the tuning fields last (2026-09-29)

The settings page now reads top to bottom as the values a user has to supply. The first card carries the connection: the enable switch and the API key together, because the switch decides whether the provider is served at all and the key is what it authenticates with. The second card carries the gateway listing and its capacity editor. The adapter tuning fields, the credential reference among them, sit in a collapsed card at the foot of the page instead of a disclosure in the title row, and the model card takes whatever height is left instead of a height guessed from the window.

Measured on the shipped client artifact rendered at the section's slot: the model area is **650 × 334 px**, where the previous layout held it at **378 px** in the same window, and that height is now the parameter card's own content rather than a constant subtracted from the container. The page content measures **887 px** against the reference window's **828 px** viewport, so the page scrolls about **59 px** to reach the tuning card; a taller window removes that scroll and gives the extra height to the model area, capped at 560 px. The tuning grid reports two equal **315.8 px** columns when opened. The collapsed card keeps one row whose `aria-controls` target the client compatibility fixture still holds to `display: flex` and `cursor: pointer`.

`npm test` passes **325 tests in 23 files** — the section suite grew by two, one holding the page order (switch, key, model list, tuning) and one holding the switch and the key control inside a single card — `npm run typecheck` passes, and `npm run check:dist` reports all **30** shipped build files matching the source.

## Git installation without plugin build approval (2026-09-28)

DSH Desktop's pnpm 11.7.0 rejected commit `68e5840` with `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`: the Git source declared `prepare`, while the desktop profile had no build approval for this plugin. The earlier CI explicitly approved its Git fixture, so it established installation after approval rather than the default user experience. Removing that approval from `npm run test:install -- pnpm` reproduced the same error in 1.4 seconds. This entry supersedes the earlier policy of building the plugin during Git installation.

The default branch now includes the 30 prebuilt Host/Client/declaration files under `lib/` and declares no Git-preparation or dependency-installation hooks. The explicit maintainer build is named `compile`, also avoiding npm's special treatment of a script named `build`. CI independently rebuilds into a temporary directory and compares every file before running the core suite; the npm publish hook performs the same check. CSS module paths and export ordering, plus declaration line endings, are deterministic across checkouts and operating systems. Controlled checks rejected changed content, a missing declaration, and an extra empty artifact without overwriting them.

Local validation passed **314 tests in 23 files**, all **eight installed-host environments**, and both npm and pnpm Git installations from a fixture with no source, build scripts, test fixtures, or plugin build approval. The [branch workflow](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36445611175) passed **13/13 jobs** in **89 seconds**, including artifact freshness and core checks on Linux/Windows with Node 22.19.0/24, plus the unchanged installation and compatibility matrix.

A separate cold-store test used Desktop's bundled Node 24.21.0 and pnpm 11.7.0 to install the real GitHub URL at commit `22c6d38`. Its temporary consumer copied the desktop profile's linker, peer-installation, and build-trust settings, with no `dsh-opencode-go` approval. Installation passed in **8.7 seconds**, and its Host/Client entrypoints, declarations, and build metadata matched the verified artifact byte for byte. The user's desktop profile was not changed. This fixes future default-branch Git installs; URLs pinned to older source-only commits retain the older behavior. No new npm version was published.

## Bounded parallel compatibility checks (2026-09-28)

The installed-host runner now tests up to four independent consumers at once in CI, using one shared package tarball. Each consumer still performs strict host installation, artifact installation, pinned-version checks, and every existing Host/Client/profile/bundle fixture. Local runs default to one worker; `DSH_COMPAT_CONCURRENCY` selects a positive worker count. The runner reports per-host results and timings, groups each host's logs, and waits for active and queued work to settle before removing temporary consumers, including after failures. CI prefers restored npm downloads and still fetches missing packages.

The [serial baseline](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36438860747) spent **113 seconds** in `npm run test:compat`. The [four-worker run](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36440959685) took **74 seconds** in that step; [adding cache preference](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36441411147) reduced the observed step to **66 seconds**, including build/pack, all eight hosts, and cleanup. That is a **42% reduction** from the baseline. The latter workflow passed **13/13 jobs** in **89 seconds** from creation to its final update, compared with **171 seconds** for the baseline. The baseline also had a longer runner-provisioning wait, so the full-workflow difference is not entirely a code speedup. These are individual hosted-runner observations, not guaranteed timings.

The Linux/Windows and Node 22.19.0/24 coverage, eight package-manager installation jobs, and eight compatibility hosts remain intact; no macOS CI job was added. Local validation passed the build and **314 tests in 23 files**, the full four-worker installed-host matrix, and a selected-host run with the default serial setting. Three scheduler regressions verify bounded concurrency with immediate slot reuse, draining active/queued work while preserving multiple failures, and rejecting invalid concurrency before work starts. CLI validation also rejected unknown hosts and invalid worker counts before package construction. Both measured branch workflows passed all 13 jobs.

## Parallel Git-installation CI and cache placement (2026-09-28)

The first [main-branch workflow](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36411675701) passed all core tests, the eight-host compatibility matrix, and both Git installs on Linux and Windows/Node 24. Windows/Node 22.19.0 passed its npm Git install after about ten minutes, then exceeded the shared 15-minute job limit during pnpm preparation. No installation assertion failed before cancellation.

Core tests, npm installs, and pnpm installs now run in independent jobs across the same Linux/Windows and Node 22.19.0/24 matrix. The installation runner accepts an optional package manager, uses no checkout dependencies, and reports preparation, installation, artifact validation, and cleanup times in job summaries. CI restores package downloads, adds a pnpm-store cache, prefers cached downloads, and uploads npm's internal timing JSON. The fresh Git source still excludes `tests/`, `node_modules/`, and `lib/`; all installed-artifact and ESM checks remain enabled.

The [first instrumented run](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36437774394) passed all 13 jobs. Its Windows/Node 22.19.0 npm preparation spent **129.1 seconds** unpacking dependencies in the system-drive cache, while builds took about six seconds. Moving only the installation jobs' npm cache to `RUNNER_TEMP` also moved npm's internal Git preparation onto the work volume. In the [subsequent run](https://github.com/Duskriver/dsh-opencode-go/actions/runs/36438357442), that unpack phase took **9.5 seconds**, the complete npm install phase took **38.4 seconds**, and the npm installation/validation/cleanup script took **40.1 seconds**. Its npm cache was a miss, so this reduction did not depend on an already-restored npm cache. The Windows/Node 22.19.0 pnpm check completed in **34.3 seconds**. These are individual hosted-runner observations; VM and cache conditions vary.

The subsequent run passed **13/13 jobs** in about **91 seconds** from the first job start to the last completion, including **311 core tests in 22 files** on all four OS/Node combinations, all eight installed-host environments, and all eight OS/Node/package-manager installation checks. The 15-minute per-job limit is unchanged. Local validation also passed both package managers with a new pnpm store, produced phase summaries and nested npm timing files, and rejected an unsupported package-manager argument before creating a fixture.

## Issue #19: isolate compatibility fixtures from plugin builds (2026-09-28)

The root package now has one coherent development dependency tree and installs with `npm ci --strict-peer-deps`. The eight published-Host fixtures have independent manifests and lockfiles outside npm workspaces. Git installation builds the plugin through `prepare`; it does not install the compatibility fixtures. This supersedes the workspace, dependency-alias, JavaScript resolution-hook, and root `--legacy-peer-deps` instructions in earlier entries.

`npm run test:compat` builds one tarball and installs that same artifact into eight temporary consumers outside the checkout. Each host dependency tree is first installed with strict peer validation. Only the subsequent plugin artifact installation uses `--legacy-peer-deps` to accommodate the difference between npm's prerelease range semantics and DSH's `includePrerelease` admission policy; the runner then checks that the pinned DSH versions have not changed. These checks establish runtime compatibility with those hosts, not strict npm peer-range acceptance for every prerelease host.

Validation passed on macOS with Node.js **22.19.0** and **24.14.1**: Host/Client type checks and build, **311 core tests in 22 files**, all **eight installed-package Host/Client compatibility environments**, and clean Git installations with **npm 11.11.0** and **pnpm 11.7.0**. The minimum-version Node 22.19.0 run passed the complete `npm run verify` command. Both installation regressions use a source repository with the entire `tests/` directory removed, then check the installed entrypoints, declarations, build metadata, and ESM loading. Existing compatibility assertions were moved into the isolated runners, and distributed-client coverage increased from five host versions to eight.

Published UI dependencies still emit missing-source-map warnings, and pnpm reports upstream peer warnings while installation and artifact checks pass. CI now covers Linux and Windows on Node 22.19.0 and 24, plus the eight-host matrix on Linux. Windows and the new GitHub workflow have not been executed locally. Tests use local fixtures; no live model request or package publication was performed.

## Optional request image count cap and usage panel polish (plugin 0.1.15, 2026-09-26)

The OpenCode Go settings page now exposes `maxImages` as an optional positive integer. It has no default count limit, so existing image capability is unchanged until a user configures the field after an upstream image-count error. Clearing the field restores the inherited base value, or no count limit when the base has none. Counts include repeated image occurrences and images nested in tool results. The existing byte, pixel, and per-image budgets continue to apply independently.

On DSH 0.1.5, excess oldest occurrences become request-local text placeholders. On newer hosts, the adapter requests durable offloading through the Host's `IMAGE_OFFLOAD_REQUIRED` protocol; raising the limit later does not restore occurrences already marked offloaded. Compatibility fixtures exercise the count boundary, nested oldest image, combined count and byte budgets, live settings updates, clearing, and both legacy and modern Host paths.

The usage panel also includes PR #17's opaque background and severity colors for high and rate-limited usage windows. Its component test checks that normal, high, and limited windows receive distinct bar styles.

Validation: `npm test` passed the Host/Client type checks, production build, and **338 tests in 24 files**, including the published-Host compatibility matrix. The published UI dependencies still emit missing-source-map warnings. Tests use local HTTP and attachment fixtures; no live model request was made.

## Account usage panel and unsupported-history guards (plugin 0.1.14, 2026-09-26)

The OpenCode Go usage panel again shows only the account's rolling, weekly, and monthly limits. Session cache statistics introduced in 0.1.13 have been removed, including their event subscription, component, styles, and translations; token statistics remain available in DSH's own interface. The original account polling, refresh failure handling, and retry behavior are retained. This supersedes the session-cache panel behavior described in the earlier verification entry below.

PR #11 adds explicit `UNSUPPORTED_CONTENT` errors for developer-role history, tool-addition/tool-removal blocks, and tools with `deferLoading: true`, on both text-only and image conversion paths. Existing image-role validation and normal tool conversion are retained. These guards are preventive hardening for inputs the adapter cannot represent; no known production source for those inputs was reproduced. Dependencies and the minimum Host version are unchanged.

Validation: `npm test` on the combined release changes passed both TypeScript checks, the production build, and **323 tests in 23 files**, including the existing Host compatibility and distributed client fixtures. Additional in-memory checks of PR #11 passed 15 scenarios on both conversion paths, covering tool-removal, empty history with deferred tools, ordinary tools, and `deferLoading: false`. The published UI dependencies still emit their existing missing-source-map warnings. These checks use local fixtures; no installed-profile update or live inference was performed.

## Issue #14: distinguish unavailable metadata from missing model configuration (2026-09-26)

The existing source diagnostics now drive a specific Settings warning when model configuration fails while the gateway listing succeeds, including an empty successful listing. Unconfigured models show “Configuration unavailable” during a metadata-source failure and explain how to check connectivity from the machine running DSH. A retained model list keeps its warning and source details visible while retrying. Successful metadata recovery clears the warning; models still absent from usable metadata return to “Configuration missing”, and models with newly usable configuration become selectable.

Two controller/component regressions failed before the UI changes and pass afterward. Four additional cases exercise the real Host RPC with cold-start HTTP 503, timeout, invalid JSON, and invalid configuration-document responses. They assert source-specific failures, continued availability of built-in models, and successful recovery of DeepSeek V4.1 Flash without restarting or changing credentials. Existing cached-data and legacy-response checks remain in place.

`npm test` passed the Host/Client type checks, production build, and **326 tests in 24 files**, including the existing host compatibility and distributed client fixtures. The installed upstream UI packages still emit their existing missing-source-map warnings. This verifies local fixture failures and recovery, not the issue reporter's network environment.

## Minimum-host compatibility policy (2026-09-25)

The compatibility policy is DSH `0.1.5-rc.1` and later, including alpha, rc, and stable releases, with continued maintenance as the host evolves. `engines.dsh` and all 19 DSH peers now use `>=0.1.5-rc.1`; the Cordis peer uses `>=4.0.2`. The eight existing host fixtures are verified versions, not an exhaustive allowlist. This supersedes the release-specific declaration limits recorded below.

DSH's published bundle gate and the market compare host ranges with `includePrerelease: true`. Declaration tests now follow that policy, rejecting hosts below the minimum and accepting later prereleases and stable releases. These checks do not use npm's default peer-range semantics. The published `0.1.7-rc.2` gate also accepted 16 current/future version strings and rejected three below the minimum; future strings check admission policy only. `npm test -- tests/package-compatibility.spec.ts tests/host-compatibility.spec.ts` passed the Host/Client build checks and all **31 tests**, including activation and streaming across the eight existing hosts and Web/Headless bundle admission on rc.1 and rc.2.

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

## Catalog failure recovery, cancellation, and source diagnostics (2026-09-25)

The catalog previously cached an initial failed listing for the normal successful refresh lifetime (60 minutes by default), ignored caller cancellation during model discovery, and reported fresh Settings data when the gateway listing succeeded but models.dev failed. Five new regressions reproduced these behaviors before the fix: two retry/recovery cases, one metadata diagnostic case, and independent cancellation of model resolution and generation while a second caller shared the pending refresh.

Failed catalog refreshes now use demand-driven backoff of 5, 10, 20, 40, then at most 60 seconds. Successful refreshes reset the failure count and restore `refreshMinutes`. Manual discovery bypasses backoff; existing immediate discovery for unknown models is preserved. Repeated failures retain usable models without resurrecting retired entries. No timer polls in the absence of catalog reads.

Cancellation ends the individual model-resolution or generation wait before metadata completes. Shared HTTP reads retain their own bounded timeout so other callers still complete and populate the cache. A generation cancelled before discovery starts sends no catalog or inference request. The regression holds the metadata response pending, observes cancellation, then releases it and verifies that the other caller succeeds using the same single listing fetch.

Settings RPC responses now optionally carry separate listing/configuration diagnostics and timestamps of their last successful checks, including 304 revalidation. A metadata-only failure marks the catalog stale, retains usable configuration, and shows the failed source and its previous timestamp. The controller/component integration test verifies the warning, enabled model switches, clearing source status after a failed Host RPC, and recovery. Older responses without source fields remain accepted. Malformed source timestamps are rejected by the codec.

Validation: `npm test` rebuilt the Host and Client (including both TypeScript checks) and passed **309 tests in 22 files**. The existing missing-source-map warnings from the published Harness UI dependencies remain. `git diff --check` passed. These checks use local fixtures and mock HTTP gateways; no paid inference, installed-profile update, or package publication was performed.

## Background catalog refresh, session cache diagnostics, and session identity (2026-09-26)

Known, verified models can now use the cached configuration for five minutes after its normal lifetime while one shared refresh runs. A held metadata response regression confirms that generation lookup returns the known configuration before the response arrives, concurrent lookups coalesce, and manual/unknown-model reads still wait. Once the refresh completes, retired models are no longer routed from the old snapshot. Another regression checks that failed attempts do not extend the grace window. The model listing retains its 10-second deadline; metadata downloads have a separate 30-second deadline. The nonblocking lookup and independent-deadline regressions failed before the change and passed afterward.

The usage panel derives session cache statistics from the Host's existing loaded event window, with no new RPC or persistent counters. Cached input share is `cacheReadTokens / (inputTokens + cacheReadTokens + cacheWriteTokens)`; output tokens do not contribute. Durable Go responses are counted once by sequence. Transient chunks, attempts without a settled message, other providers, malformed usage, and inherited fork responses are excluded. Missing attribution/accounting and incomplete history are indicated. A zero denominator shows no ratio. Statistics can be reconstructed from restored history and remain available when account-usage reads fail. Hosts without the optional event feed retain the existing account panel.

The derived store preserves its snapshot for transient-only updates, recomputes on settlement/history replacement, and subscribes only while the details panel is open. Unit/component tests cover token weighting, cache writes, omitted cache counts, malformed and missing usage, duplicate events, fork boundaries, serialized restoration, history replacement, account failure, switching sessions, and subscription cleanup. Session statistics describe the loaded, settled responses, not all billable gateway attempts or an account-wide cache metric.

Lifecycle tests use the real `@deepseek-ai/dsh-session` 0.1.6-alpha.1 Session/SessionStore and a local HTTP gateway. Continuation, a 503 followed by a caller retry, serialized Host header/log restoration, and adapter recreation retain the same `x-opencode-session`. Real forks and subagent-marked child sessions have distinct identities during concurrent calls and keep their own IDs after restoration. These are persistence-boundary tests, not a full installed agent-loop process restart. Existing protocol and published-host compatibility fixtures remain part of the full suite.

Validation: `npm test` rebuilt both artifacts and passed **320 tests in 24 files**, including both TypeScript checks. An isolated browser fixture loaded the actual built `lib/client.js` usage slot with local Host-service data. Chinese and English panels displayed the expected 70% ratio and 7,000 / 10,000 input-token counts; a 320px viewport had no horizontal overflow, and account errors did not hide session statistics. Escape closed the dialog; captured browser errors were empty. This validates the shipped client artifact with fixture services, not a live installed Host or upstream cache-hit rate. No paid inference or installed-profile update was required.

## Model area split, whole-row hover, and the model card's details (2026-09-28)

The selection list and the parameter card now split 45 : 55 instead of 3 : 1, and the card is taller (`clamp(260px, calc(100cqh - 380px), 560px)`). The former 3 : 1 rule never rendered as 3 : 1 at the reporting window: the right column's 180px floor bound first, so a 549 CSS px model area gave the card 180px while its content needed 464px inside a 286px viewport — the input-modality row started at 258px and its chips ended at 328px, entirely below the fold. The card now shows the model id, the release date on the id's line, both capacities and the modality chips without an inner scroll.

Hover and selection paint the same whole row. Previously `.modelChoice:hover` painted only the name button, so a hovered bar stopped where the switch began (measured on the reporter's screenshot: hover 25→392 device px against a full-row selection of 25→455); only the selected state was a whole-row bar. Hover is now `.modelRow:hover:not(.modelRowSelected)`, which covers the name, badges, override mark and switch, keeps the selection's 6px radius and hidden top separator, and mixes the surface one step lighter (`color-mix(in srgb, var(--dsw-alias-bg-layer-3) 92%, var(--dsw-alias-label-primary))`) so the two states stay distinguishable; a selected row keeps its own surface while hovered. The release date also moved onto the model-id line and the capacity hint was shortened, so the card spends its height on the details it exists for.

Geometry was measured in headless Microsoft Edge 154 (`--headless --remote-debugging-port`) rendering the shipped stylesheet extracted from the built `lib/client.js` at the reporting window's geometry (553 × 726 CSS px, the 125% display scaling their device pixels divide by). After the change: grid `241.6px 295.4px` (45 : 55), card 539 × 348, pane content 346px inside a 346px viewport, modality chips and the trailing note fully visible, and the deprecation hint's extra two lines still scroll 32px. With the pointer over a row's switch the hovered bar spans x 23→251, identical to the selected row's 23→251, at `rgb(69, 70, 72)` against the selection's `rgb(53, 54, 56)`; hovering the selected row keeps `rgb(53, 54, 56)`. These checks used a local headless browser and the repository's own fixtures; no paid inference was performed.

The stylesheet contract moved with the client fixture: `tests/fixtures/client-compatibility.mjs` now holds the distributed CSS to the whole-row hover rule and the 45 : 55 split, replacing the assertions that lived in the removed `tests/artifact.client.spec.ts`. The component test pins the model id and release date to one line with the date's provenance in its title.

One operational note came out of the installed-profile follow-up: a desktop Harness loads plugin code into its host process at startup, so installing a new package, reloading the browser, or reinstalling the plugin never reloads it. A build predating `inputModalities` therefore kept serving release dates and deprecation flags while every model still read "not declared", until Harness itself was restarted. Model membership, capacities, lifecycle data and modalities all ride that one process.

## Multi-account hardening: add/remove transactions, fallback notice, rejected-key cache (2026-10-05)

An adversarial review of the multi-account chain (dd0e4b4 plus the fold/reorder branch) confirmed the storage, fallback, and credential-isolation design, and found four client-side defects plus two host-side gaps. Every defect was reproduced by a regression written before its fix.

Adding the first account while the page's credential describe had not answered — or kept failing — materialized the legacy placeholder row into the stored accounts and left the new account unselected. The add now asks the credential service directly for any reference the loaded rows do not know: the legacy placeholder is never written (it stays a read-side view while the selection still names the legacy reference), and the new account becomes preferred only when every listed account is known to hold no key; an unanswered describe keeps the selection conservative.

Removing an account deleted its settings entry before its stored key, so any unset failure stranded an orphan plaintext credential with no retry path. The remove now unsets first (after a describe confirms the reference is configured) and keeps the row on refusal behind a new "key could not be deleted" notice; a refused settings write leaves a keyless, visible, retryable row instead of a dangling secret. An add whose revision was moved by a concurrent writer re-reads and re-applies the same account (same credential reference, up to three attempts) instead of stranding the key it just stored. A row editor whose row left the list (remove accepted, key cleanup failed) used to hide its own Cancel together with the Add button; the card now drops the stranded editor as soon as its row disappears.

On the Host side, the fallback notice's fromRef was pinned to the preferred reference rather than the first account that actually failed (visible with three or more accounts); it now names the real source, or the first reference skipped for a remembered rejection. A gateway-rejected key (401/invalid-key) is remembered for five minutes and skipped by later requests instead of re-sending a full transcript to a dead key; a locally missing credential is not remembered (it is re-checked for free), an all-rejected list still attempts in order so the gateway's own error surfaces, and any `credentials/reference-updated` event clears the entry. The collapsed usage pill now carries a fallback mark (and a bare `↳` marker under the 460px container tier) whenever a switch notice is active; a failed describe marks rows "Status unknown" instead of an eternal loading state; renaming an account no longer refetches every account's quota.

Validation: `npm test` rebuilt both artifacts and passed **450 tests in 30 files** with both TypeScript checks, including regressions for each fix: the placeholder race with and without a pending describe, the conservative unknown state, the conflict retry reusing one credential, key-first removal and its retry, stranded-editor recovery, multi-hop notice attribution, rejected-key skipping and credential-change clearing, and the collapsed-pill mark. These checks use local fixtures and mock gateways; no paid inference, installed-profile update, or package publication was performed. Known limits carried forward: concurrent settings writes from two Host processes can still lose updates inside the host watcher's observation window (a dsh-settings-level boundary), and the anthropic-messages error-body classification remains dormant until such models appear in the catalog.

## Accounts card: reorder-only rows, one refresh stamp, a wide quota bar (2026-10-05)

Three pieces of the card read as noise or as too small, and a rendered preset comparison (`mockups/row-quota/overview.png`, `presets.png`) settled the shape before any code moved. The two hint paragraphs under the card header are gone, and the per-row "Move up" / "Move down" buttons went with them: the drag handle already reorders the list. The deleted paragraph was the only place that explained the drag, so the handle now carries that sentence as its `title` as well as its accessible name, while ↑ / ↓ keeps the keyboard path; a regression test pins the tooltip.

The refresh stamp left every row's detail and moved into the card header. One pass reads every account, so the card was repeating N identical lines; it now renders one stamp, visible while the card is folded, showing the clock time on the day it happened and the date otherwise, with the complete local timestamp in its `title`. The detail keeps the weekly and monthly windows and the three row actions.

The rolling reading is now a 12px bar that fills the row's free width (about 330px where the old one was a fixed 132px) with quarter marks at 25 / 50 / 75%, its percentage moved to the bar's right in the card's own 12.5px semibold tabular figure. Colour follows the composer pill's rule — green below 80%, amber from 80%, red at 100% or rate-limited — through one `barLevel()` helper, and the opened windows keep the native `<progress>` element while gaining those tiers through `accent-color`, so a collapsed row and its own detail can never disagree. The bar keeps `role="progressbar"` with `aria-valuenow`, so replacing the native meter cost the row no semantics; row height is unchanged, because the taller bar sits inside the row's existing padding.

The row's summary line was content-driven: the name and key-state fields took their intrinsic widths, so two accounts whose names differ in length put their key state, their bar and their reading at different x positions. Measured in headless Edge at the settings column's 858px card width, the key-state column and the bar start moved by **112.1px** across four names, and the bar itself ranged from 181.3 to 237.3px. `Section.module.css` now lays the line out as a grid of fixed columns — 16px handle, 112px name, 92px key state, the bar's `minmax(0, 1fr)` track, 38px reading, 106px countdown, 14px disclosure — so only the bar absorbs slack. The flexible spacer is gone, the name column ellipsises with the full value in its `title`, and a row with nothing to read yet spans the bar, the reading and the countdown with one message instead of adding a column. The same measurement over the same four names now reports a **0px spread** for the key state, the bar, the reading, the countdown and the disclosure, with an identical 372px bar in every row.

Validation: `npm run compile` regenerated both artifacts and `npm run test:ci` passed with a byte-identical `check:dist` — **455 tests in 30 files** — with `tsc -p tsconfig.host.json` and `tsc -p tsconfig.client.json` clean. Five new client regressions cover the row's fixed columns (seven children in order, the bar's role there, the ellipsised name's `title`, and the same grid for a row with nothing to read yet), the single header stamp surviving both the unfolded card and every row opened, the row's actions being exactly rename / replace-key / remove with no move control left, the bar's `aria-valuenow` plus its three quarter marks and fill width, and the 79 / 80 / rate-limited level boundaries. One unrelated timing test (`tests/metadata-transport.spec.ts`, a bandwidth-limited catalog deadline) flaked once under full-suite load, then passed alone and in the repeat run.

The pull request's own CI then failed the installed-host matrix, and the failure was a client-side injection defect introduced by the first fix for the rows' quota reads. Naming `remote.opencodeGoUsage` in both settings injections is inert on a real host — the two lists are generation-exclusive, so only the applicable one fires — but `tests/fixtures/client-compatibility.mjs` fires an inject callback when `configForms`, `settingsScope` or `remote.opencodeGoUsage` appears in the service list, so both lists matched and the section mounted twice: all nine hosts failed `client-compatibility.mjs` with `1 !== 0` at the `bindScope` / `getForm` call-count assertion. The defect reproduced locally before the fix (`DSH_COMPAT_CONCURRENCY=4 npm run test:compat`: `AssertionError … at client-compatibility.mjs:110`, every host failing) and the same run passes after it (`PASS: installed-package compatibility across 9 host(s)`, 283.3s). The rows now leave upstream's two injection lists untouched and wait on the promise that publishes the namespace — `$mount(goRemote)`, the guard the catalog read already used — before reading a quota; that is the same context and the same call upstream's own default `readUsage` makes, with only the wait added.

The rows' quota reads then had to be re-plumbed, and both rejected shapes are worth recording because each was wrong in a different direction. A read needs a context that injected the plugin's own usage namespace: the shipped client answers `cannot get property "remote.opencodeGoUsage" without inject` when one is missing, and that is exactly what a desktop install showed — both rows reporting that sentence behind a retry button — after the namespace was dropped from the settings injections and the read merely waited on the mount. Naming it in both settings injections instead mounts the page twice wherever a host carries both service sets, which is what the installed-host matrix rejected. Waiting on `$mount(goRemote)` alone publishes the namespace but grants no context the right to open it, so it reproduces the runtime error rather than the double mount.

The shape that satisfies both is one injection of its own, the way the pill declares the namespace it reads: `mountSettings` captures a bound reader from `ctx.inject(['remote.opencodeGoUsage'], ready => …)`, the two generation-specific settings injections keep exactly the services upstream names, and a session that never injects the namespace reports "OpenCode Go account usage is unavailable in this session" on the row instead of reaching for a context that cannot open it. The fixture fires that callback too, so its proxy assertion — `usage service must be injected` — holds by construction, and the rows keep reading through the same namespace and the same call the pill uses.

Final-shape validation: `npm run test:ci` passes **455 tests in 30 files** with a byte-identical `check:dist`, and `DSH_COMPAT_CONCURRENCY=4 npm run test:compat` reports `PASS: installed-package compatibility across 9 host(s)` in 292.5s — the same command failed all nine hosts on the double-mounting revision and all nine again on the mount-waiting one.

## Usage pill panel: model-selector card, explicit account choice (2026-10-05)

The panel behind the composer's usage pill was rebuilt in the shape of the host's own model selector — a 320px card of 42px rows on a raised tile — after a rendered four-way comparison (`mockups/usage-pill/option-a…d.png`) picked the drill-down. The account now sits on a card row (state dot, name, `Preferred`, `Switch ›`), and `Switch ›` swaps the card's body for the account list, whose rows tick the current account and answer ↑ / ↓ or a click; Escape steps back to the reading instead of closing the panel, and a refused switch keeps the list open with the failure notice.

The switch view says what it does: "Later requests in this profile use this account. The consumption order stays on the Settings page." This list is the user's own choice of which account spends now; the ordered fallback belongs to the Settings card, which is why the panel offers no order affordance.

The modal hint line ("Account usage · used percentage · refreshes every minute") and its two copy keys are gone, and the native `<select>` went with them: an OS-rendered option list cannot be styled to match the host menu, which is what made the old picker look foreign. The three windows became one row each — label, 10px bar, reading — with the reset stamp under it and the refresh stamp in the card's foot. The bar stays the native `<progress>` element with its `high` / `limited` classes, so the colour tiers, their roles, and every existing bar assertion survive the redesign.

Validation: `npm run test:ci` passes **459 tests in 30 files** — four new cases cover the card row and the departed picker, a successful drill-down switch, a refused one, and the arrow / Escape keys — with a byte-identical `check:dist` and both TypeScript projects clean. The installed-host fixture was A/B'd against the pre-change bundle in the same warm consumer: 1.47s before, 1.52s after. Local `test:compat` runs before that measurement tripped the script's 30s per-fixture ceiling on cold Windows file scans (the same fixture runs in 1.5s warm), so the ubuntu CI job is the gate that settles that matrix.
