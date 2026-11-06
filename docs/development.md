# Development

The development baseline is DSH `0.2.1-rc.5`, Cordis `4.0.5` and Schemastery `3.18.5`. Runtime DSH peers require `>=0.2.1-rc.5`; Cordis requires `~4.0.5`. Install the locked dependencies with `npm ci`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check the host and browser TypeScript projects |
| `npm run compile` | Rebuild the host bundle, browser factory and declarations in `lib/` |
| `npm run check:dist` | Compare an independent rebuild with every shipped artifact |
| `npm test` | Run the Vitest suite |
| `npm run test:ci` | Check artifacts, then run the Vitest suite |
| `npm run verify:installed -- /path/to/consumer` | Exercise a built package through the consumer's real Cordis resolver; defaults to this checkout |
| `npm run verify:headless -- /path/to/consumer` | Exercise a consumer containing the official DSH CLI and the installed plugin, with an isolated profile and loopback gateway |
| `npm run verify` | Run type checks, artifact comparison, the complete Vitest suite and installed-package smoke |

`test:ci` runs `check:dist` followed by `npm test`. `verify` runs `typecheck`, `test:ci` and `verify:installed`. CI uses `npm ci --strict-peer-deps` and `npm run verify` on Linux and Windows with Node 22.19 and 24. Inference smoke checks use synthetic credentials and a loopback gateway. `verify:headless` additionally requires the official DSH CLI in the supplied consumer; it creates an isolated home and profile.

## Test suite

Vitest tests are organized by domain. Results for the history-dashboard migration are tracked separately in [verification notes](verification.md); the table below is a scope reference, not a passing-run claim.

| Test file | Coverage |
| --- | --- |
| `plugin.spec.ts` | Cordis mounting/unloading, native SettingsForms/profile writes, hot configuration, RPC and public exports |
| `accounts.spec.ts` | Account CRUD, 20-account cap, serial writes, failed-write cleanup, fallback/promotion, stale calls and five-minute cooldown |
| `free.spec.ts` | Dual route lifecycle, public Bearer fallback, saved keys, account retry and credential deadlines |
| `free-channel.spec.ts`, `free-transport.spec.ts` | Free failure classification, Retry-After/backoff, cancellation, transport isolation and coexistence with Go |
| `pricing.spec.ts` | Catalog tariff validation and Free-model eligibility; historical amounts come from official CSV |
| `catalog.spec.ts` | Discovery, model limits/visibility, dual directories, ETag/disk cache, endpoint isolation and bounded transport |
| `adapter.spec.ts` | Requests, capacity limits, session/attribution headers, immutable request snapshots, cancellation and timeouts |
| `protocols.spec.ts` | Reasoning levels, protocol overrides, OpenAI/Anthropic/Google serialization and signed Google parts |
| `conversion.spec.ts` | Independent tool messages, replay signatures, context conversion, durable image offload, per-request budgets and stream contracts |
| `usage.spec.ts` | Official quota reads, current-account selection, native gateway access and safe error responses |
| `analytics.spec.ts` | Official daily CSV parsing/aggregation, UTC ranges, provider/model grouping, account isolation, short cache and cancellation |
| `transport.spec.ts` | Bounded JSON/gzip, classified/redacted HTTP errors, real CONNECT/SOCKS5 proxies and SDK bridge matching |
| `settings.client.spec.tsx` | Page configuration, typed Save/Reset/refused writes, locale changes, registration and subscription/cancellation lifecycle |
| `accounts-models.client.spec.tsx` | AccountsCard forms/status/quota, drag/keyboard ordering, model visibility, metadata failures and refresh races |
| `usage.client.spec.tsx` | Conversation pill, dashboard account/range controls, official amount presentation, quota refresh/visibility and accessibility |

All test imports target current modules directly. `vitest.config.ts` has no aliases or compatibility resolver. Its Google SDK loader is the same version-guarded transport patch used by the production build. The UI tests load the published DSH primitives and the installed locale bundle.

`tests/setup.ts` gives each test a temporary `DSH_HOME`, provides complete synthetic `/models` entries, allows loopback HTTP fixtures and explicit `.invalid` destinations through the local proxy fixture, and rejects other network requests. `tests/support/` provides current host/account services, ConfigForm/React fixtures, metadata data, loopback gateways and proxies. Fixtures clean up contexts, sockets, timers and temporary homes.

## Modules

Implementation modules are grouped by domain, with browser CSS and its ambient declaration:

| Domain | Modules |
| --- | --- |
| Host composition and settings | `index.ts`, `config.ts` |
| Inference and model discovery | `adapter.ts`, `catalog.ts`, `conversion.ts`, `google.ts`, `sdk-types.ts` |
| Account commands and official quota | `accounts.ts` |
| Official daily CSV history and aggregation | `analytics.ts` |
| Free backoff, error classification and transport | `free-channel.ts`, `free-policy.ts`, `free-transport.ts` |
| Browser-safe configuration and RPC contracts | `contracts.ts` |
| HTTP, proxy transport and redacted errors | `transport.ts` |
| Browser registration and state | `client/index.ts`, `client/controller.ts` |
| UI and presentation | `client/Section.tsx`, `client/UsagePill.tsx`, `client/AnalyticsDialog.tsx`, `client/presentation.ts` |

The host uses `settings.configure()` and volatile configuration fields; the browser binds the official `configForms` contract. The page keeps text drafts until Save, model capacities stay typed objects throughout editing, and immediate switches retain their existing behavior. The accounts card owns all credential entry and replacement.

Account commands and automatic primary-account promotion share one in-memory serial queue. Credential writes settle before the next command starts. Metadata changes use a single revision-guarded write; no WAL, startup recovery or conflict retry loop is maintained. Only credentials owned by the removed generated account are deleted. Request generations prevent late fallback outcomes from replacing a newer user selection. Credential, quota and rate-limit failures can try the next account only before output or positive usage, and rejected gateway keys cool down for five minutes. Changing a key or explicitly selecting an account clears its rejection state.

Analytics requests `https://opencode.ai/console/api/v2/usage/export?range=7d|30d|90d` from the Host with the selected account's key. One daily CSV snapshot supplies totals, UTC daily buckets and provider/model detail. Today filters the 7-day snapshot to the current UTC date; absent dates are filled with zero. Input, output, cache read and both 5-minute/1-hour cache-write fields are summed without repricing. Integer `cost_micro_cents` use `1 USD = 100,000,000` units and are presented as the official usage amount, which does not establish extra Go charges.

History queries occur only on open, account/range changes and manual refresh. Official reports and CSVs have a 30-second Host cache isolated by credential, account, network configuration, range and UTC date; forced refresh bypasses it. Queries retain the configured proxy path, cancellation, timeouts and response-size limits. Only official gateway configurations may send keys to Console. Third-party gateways, permission failures, network failures and invalid data produce explicit errors, without a local-history fallback.

The browser receives only aggregate numbers and provider/model/day groups. The user's explicit CSV download may contain official member fields. The independent viewing-account selector defaults to the inference account and scopes all three dashboard quota windows to the selected workspace, including other clients; anonymous Free coverage is not guaranteed. Settings, the dashboard, pill and expanded sidebar share warm paper/charcoal surfaces and terracotta accents, following the Host's light/dark mode. Settings map Host control tokens only within the plugin section. Typography prefers locally installed Anthropic Serif Web, Sans Web and Mono Web families, with system fallbacks and CJK serif headings; no font binaries or external font requests are added.

Backend history tests use synthetic CSVs, synthetic keys and loopback services; real user keys are not used in automated tests. The separately recorded Console check establishes source availability for the checked account; automated migration results are recorded separately in the verification notes.

Image count limits are checked before reads. Each request prepares up to four images concurrently and checks its own encoded-payload budget. The host's `requiredImageOffload` / `projectOffloadedImages` protocol owns durable offload marks. There is no plugin-wide preparation queue or payload pool. HTTP failure classification, credential redaction, context-capacity hints, stream deadlines and cancellation remain active; internal call tracing and diagnostic file capture are removed.

## Distribution

The `.` and `./client` exports continue to point to the built host entry and browser factory. Rebuild `lib/` with source changes, then run `npm run check:dist`. Builds do not execute during dependency installation. The private `opencode-go-pi-ai` alias uses `@earendil-works/pi-ai@1.5.0`, which pins `@earendil-works/pi-telemetry@1.5.0` and `@earendil-works/pi-schema@1.5.0` exactly; `package.json` no longer needs `overrides`.

The Google transport bridge is version-guarded for pi-ai 1.5.0 and `@google/genai@2.21.0`. `src/google.ts` delegates simple streaming to the upstream adapter through the request-scoped fetch binding; pi-ai now selects discrete thinking levels for Gemini 4 natively.

SDK declarations bundle pi-schema in place of TypeBox. `scripts/licenses/pi-1.5.0-LICENSE` supplies the pi packages' upstream MIT license omitted from their npm distributions. pi-schema's format checks and value conversion rules include code adapted from TypeBox 1.3.27 (MIT); the build appends the package's `LICENSES/typebox-LICENSE` to its pi-schema notice in `lib/vendor-licenses.txt`.
