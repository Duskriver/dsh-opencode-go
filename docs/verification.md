# Verification

The full acceptance baseline was recorded on 2026-11-06 on macOS with Node `24.22.1` and npm `12.2.1`, against the pinned development peers DSH `0.2.1-rc.5`, Cordis `4.0.5` and Schemastery `3.18.5`. A rebuilt plugin was also loaded by the installed DSH `0.2.2-rc.1` CLI in an isolated headless profile; that host-side smoke predates the official-history dashboard migration and does not verify the Web/client surface. The matrix below states the exact coverage.

The minimum supported Host is DSH `>=0.2.1-rc.5`, with Cordis `^4.0.5`. The Host installation supplies `@deepseek-ai/dsh-brand` (`>=0.2.1-rc.5`) and `@deepseek-ai/schemastery` (`>=3.18.5 <4`) as peer dependencies, so one copy of each is shared with the application. The package retains its `.` and `./client` export contracts. The current architecture and command reference are in [development](development.md).

## Verification matrix

| Surface | DSH / Cordis / Schemastery | Verification | Status |
| --- | --- | --- | --- |
| Full acceptance baseline | `0.2.1-rc.5` / `4.0.5` / `3.18.5` | `typecheck`, `check:dist`, 999 Vitest tests and `verify:installed` (Host route plus remote registration) | Pass, re-run 2026-11-07 after the P0/P1 hardening batches (886 tests at the original 2026-11-06 baseline) |
| Installed desktop CLI, Host side | `0.2.2-rc.1` / `4.1.0` / `3.19.0` | rebuilt plugin loaded in an isolated headless profile; one loopback inference completed | Partial: headless Host smoke only, recorded before the dashboard migration |
| Web/client surface (`dsh.client`) | `0.2.2-rc.1` / `4.1.0` / `3.19.0` | settings page, usage pill, model picker and history dashboard against a running 0.2.2 Web profile | **Not covered / pending** |

The Web/client surface is the part not yet verified on 0.2.2-rc.1. The client bundle contract (`window.__ModuleLoader__.load`, the baseline module table and `dsh.client.inject`) was only compared statically with the 0.2.2-rc.1 shipped client bundles; no browser session against a 0.2.2-rc.1 Web profile has been recorded.

### Pending

- Advisory CI job `compat-dsh-0.2.2` (job-level `continue-on-error: true`, push/manual-dispatch only) probes the installed DSH `0.2.2-rc.1` Host path: it packs this package, installs it together with the official `@deepseek-ai/dsh@0.2.2-rc.1` CLI and the pinned rc.1 host packages into a temporary consumer, then runs `node --expose-internals scripts/installed-smoke.mjs <consumer>`. A red run is a compatibility signal, not a merge blocker; promote it to a required check once the install path has stayed green for a release cycle and a stable 0.2.2 host exists. This covers the Host path only — the Web/client row above remains pending.
- Manual Web check on a 0.2.2-rc.1 server: enable the plugin, confirm the settings section and usage pill mount, then exercise the history dashboard with a real account.

## Recorded baseline before the dashboard migration

| Command | Result |
| --- | --- |
| `npm test` | 17 test files, 913 tests, zero failures or skipped tests |
| `npm run typecheck` | Host and browser TypeScript projects pass |
| `npm run check:dist` | All 30 shipped build artifacts match an independent rebuild |
| `npm run verify` | Types, artifact comparison, full Vitest suite and installed-package smoke pass |

`verify` includes `typecheck`, `test:ci` and `verify:installed`; `test:ci` includes `check:dist` and `npm test`. CI runs this same acceptance path after `npm ci --strict-peer-deps` on Linux and Windows with Node 22.19 and 24. Those CI jobs are configured and enforce the 0.2.1-rc.5 baseline only; the baseline results above are from macOS. The 0.2.2-rc.1 matrix row is not part of CI yet.

## Official-history source check

A manual read-only check on 2026-11-06 used the current desktop key without Cookie or organization headers. Four official Console history endpoints returned HTTP 200. Their 30-day totals agreed:

| Metric | Recorded value |
| --- | --- |
| Requests | 7,064 |
| Total tokens | 1,105,009,939 |
| `cost_micro_cents` | 3,152,640,453 |
| Official usage amount (`1 USD = 100,000,000` units) | $31.52640453 |

The daily CSV at `https://opencode.ai/console/api/v2/usage/export?range=30d` supplied the fields needed for totals, daily charts and provider/model detail. The implementation uses that single snapshot rather than combining multiple endpoint snapshots. The check establishes access and consistency for this account at that time; it does not establish every account's permissions, immediate publication of recent usage or complete anonymous Free coverage. The official usage amount does not establish additional Go subscription charges.

## This dashboard migration

| Check | Current result |
| --- | --- |
| Official CSV parsing, exact totals, UTC date filling and today filtering | Pass: strict CSV fixtures, large integers, unit conversion, provider/model grouping and exact reconciliation |
| Credential/account/network/date cache isolation, force refresh, proxy path, cancellation, timeout and response limits | Pass: Host service and RPC tests, including independent cancellation and connection-change races |
| Key/member-field boundary, third-party gateway rejection and explicit upstream failures | Pass: report excludes member fields and keys; explicit permission, credential, gateway and malformed-response failures |
| Dashboard account/range/refresh, selected-account quotas and responsive light/dark UI | Pass: browser interaction tests plus real-browser 1280×1000 dark / 390×844 light checks, Chinese and English |
| `npm test` | Pass: 20 files, 999 tests; zero failures or skipped tests |
| `npm run typecheck` / `npm run compile` | Pass: Host and browser types and distribution build |
| `npm run check:dist` | Pass: all 30 shipped artifacts match an independent rebuild |
| `npm run verify` | Pass: types, build comparison, all tests and installed-package smoke |

The user-facing Free status card, its copy/styles, status/probe RPCs and manual inference probe have been removed. Normal requests retain Free error classification and passive Retry-After/backoff, including account isolation, cancellation and coexistence with Go.

Backend migration checks use synthetic CSVs, synthetic keys and loopback services, never a real user's key. The manual Console source check above is separate from automated tests.

The rewritten `GoAnalyticsService` was also checked directly against Console with the current desktop key on 2026-11-06: both the 30-day report and CSV export succeeded. The report contained 30 calendar days and 13 provider/model rows, with no member fields or key; the explicitly requested CSV retained its 14 official columns and contained no key. This was a read-only check, with no inference or profile changes.

Real-browser layout checks used synthetic preview data. The narrow view fills 390×844 without horizontal page overflow; charts and detail tables scroll within their own regions. Account/range changes and model detail were exercised. Previews: [desktop](assets/usage-history-desktop.jpg), [narrow light](assets/usage-history-mobile.jpg), [models](assets/usage-history-models.jpg).

## Regression scope

The test files import current modules directly, without resolver aliases or temporary path substitutions. Support helpers provide current host/account services, ConfigForm/React fixtures, offline model data, loopback gateways and proxies. Tests for removed journals, recovery state machines, diagnostic capture, global image pools and legacy host APIs are removed.

The pre-migration baseline covered:

- Real Cordis/Loader lifecycle, native SettingsForms and owner-scoped RPC, hot profile changes without adapter remounts, coexistence with the native provider and durable signed continuations.
- Account CRUD, generated-key ownership, the 20-account limit, queue serialization across reconnects, failed-write cleanup, read-only keys, stale operations and primary promotion. Real HTTP 401/403/429 and quota responses verify fallback before output, cooldown/expiry, cancellation and prevention of replay after output or charged usage.
- Model catalog discovery, missing/invalid metadata, online refresh and ETag/disk caching, endpoint isolation, lifecycle visibility, typed capacities, request snapshots, reasoning choices and OpenAI/Anthropic/Google wire behavior.
- Stable session and attribution headers, stream outcomes/deadlines, independent tool-role conversion, replay signatures, image offload projection, exact encoded-byte/count budgets and request-local preparation concurrency.
- Official quota/error codecs. Official-history CSV behavior is covered by the migration checks above.
- Bounded JSON/gzip responses, safe gateway classification/redaction, actual HTTP CONNECT and SOCKS5 proxy paths, concurrent Google fetch binding and version-guarded SDK patch matching.
- Free-specific quota/client/access/rate-limit classification, Retry-After seconds and HTTP dates including clock skew, bounded exponential fallback, endpoint/proxy isolation, concurrent completion ordering and zero inference during cooldown. A normal Host request test limits Free and then completes Go streaming with its saved fixture key in the same mount.
- Settings Save/Reset/Discard and rejected/concurrent writes; AccountsCard additions, quota states, row actions and drag/keyboard sorting; model editor/search/visibility and refresh races; quota pill polling, account switching and retained readings; installed locale resolution and live Chinese/English changes. Dashboard and palette migration checks are listed separately above.

## Isolation and limits

Vitest gives each test a temporary `DSH_HOME`, serves complete synthetic `/models` declarations, uses loopback gateways/proxies and rejects other network requests. The installed-package smoke also uses a temporary home, synthetic credentials and metadata, and loopback inference. It resolves the built package through the consumer's ordinary Cordis resolver and verifies dual route discovery, streamed text, session headers, attribution, authorization and unload.

The pinned rc.5 UI primitives package references an unpublished `index.js.map`; Vite reports a non-fatal source-map warning. Undici also reports its experimental SOCKS5 notice during the real proxy test. Neither creates a failed test or nonzero command exit. The suite does not filter these messages or patch installed packages.

JSDOM verifies DOM interactions and accessible state. Its static ResizeObserver fixture does not establish browser layout geometry or production latency; the real-browser preview checks above cover the recorded layouts. Loopback inference does not establish live gateway availability or paid model behavior. `npm run verify:headless -- /path/to/consumer` remains available for a consumer containing the official CLI; it is separate from the default acceptance path.

The installed Harness CLI loaded the rebuilt package from an isolated `DSH_HOME`: Go completed one loopback request with the expected synthetic credential and session header (exit 0). A single public `beam-free` request to the real Free gateway returned HTTP 429 / `FreeUsageLimitError`, now surfaced as `FREE_QUOTA` (exit 1, expected upstream rejection). This validates error propagation, not live Free availability; no paid upstream inference was used. The 53,305-second backoff and Go coexistence were verified with deterministic HTTP/RPC fixtures.

No publication or paid upstream inference was performed for the dashboard migration.
