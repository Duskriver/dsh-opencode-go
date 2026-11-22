# Development

The development and full-acceptance baseline is DSH `0.2.1-rc.5`, Cordis `4.0.5` and Schemastery `3.18.5`. The published package requires DSH `>=0.2.1-rc.5`, Cordis `^4.0.5`, `@deepseek-ai/dsh-brand >=0.2.1-rc.5` and `@deepseek-ai/schemastery >=3.18.5 <4` as Host-provided peer dependencies. Install the locked dependencies with `npm ci`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check the host and browser TypeScript projects |
| `npm run compile` | Rebuild the host bundle, browser factory and declarations in `lib/` |
| `npm run check:dist` | Compare an independent rebuild with every shipped artifact |
| `npm run pack:release` | Verify `check:dist`, remove stale root `dsh-opencode-go-*.tgz` archives, pack `dsh-opencode-go-<version>.tgz` at the repository root, and run `check:pack` |
| `npm run check:pack` | Assert the npm tarball contains every required runtime, docs and notice file, and assert the single tracked root `dsh-opencode-go-<version>.tgz` matches the workspace byte-for-byte |
| `npm run check:install:pnpm` | Install the real tarball in an isolated pnpm 11.28.5 consumer with strict build failures and no inherited approvals, then execute the selected Bun platform binary |
| `npm run check:hygiene` | Check tracked source hygiene: UTF-8 without BOM, LF endings, no trailing whitespace, single final newline, and no tabs in `src/`/`scripts/` |
| `npm test` | Run the Vitest suite |
| `npm run test:ci` | Check artifacts, then run the Vitest suite |
| `npm run verify:installed -- /path/to/consumer` | Exercise a built package through the consumer's real Cordis resolver; defaults to this checkout |
| `npm run verify:headless -- /path/to/consumer` | Exercise a consumer containing the official DSH CLI and the installed plugin, with an isolated profile and loopback gateway |
| `npm run verify` | Run type checks, source hygiene, artifact comparison, the complete Vitest suite and installed-package smoke |

`test:ci` runs `check:dist` followed by `npm test`. `verify` runs `typecheck`, `check:hygiene`, `test:ci` and `verify:installed`. CI uses `npm ci --strict-peer-deps` and `npm run verify` on Linux and Windows with Node 22.19 and 24. The separate blocking `install-pnpm` job runs `check:install:pnpm` against the packed plugin to prevent the #87 build-approval regression. Inference smoke checks use synthetic credentials and a loopback gateway.

## Test suite

Vitest tests are organized by domain:

| Test file | Coverage |
| --- | --- |
| `plugin.spec.ts` | Cordis mounting/unloading, native SettingsForms/profile writes, hot configuration (`retryPolicy`, visibility), RPC and public exports |
| `accounts.spec.ts` | Account CRUD, 20-account cap, serial writes, failed-write cleanup, fallback/promotion (`quota`/`credential` promote, transient `rate-limit` borrows backup without reordering), stale calls and per-failure cooldowns (`Retry-After`/15s for `RATE_LIMIT`, 5m for `QUOTA`/credential) |
| `free.spec.ts` | Dual route lifecycle, public Bearer fallback, official-HTTPS-only saved-key binding, account retry and credential deadlines |
| `free-channel.spec.ts`, `free-transport.spec.ts` | Free failure classification, Retry-After/backoff, cancellation, transport isolation, stream-budget-derived SOCKS relay idle limits and coexistence with Go |
| `pricing.spec.ts` | Catalog tariff validation, TTL-keyed cache write pricing, recurring peak vs effective-date multiplier breakdown, transition boundary timestamps and Free-model eligibility |
| `quota-estimate.spec.ts` | Per-plan request-budget estimation, active window bottleneck resolution, normalized quota multipliers and compact formatting |
| `catalog.spec.ts` | Discovery, model limits/visibility, gateway price projection, dual directories, ETag/disk cache, endpoint isolation and bounded transport |
| `config-validation.spec.ts` | Base-URL credential rejection with redacted diagnostics, proxy userinfo acceptance, thinking-budget and `retryPolicy` schema bounds |
| `socks-tunnel.spec.ts` | Loopback SOCKS relay: allowed-target enforcement, authentication, stream-budget-derived idle budget, idle teardown/reset and IPv4/IPv6 normalisation |
| `theme.client.spec.ts`, `appearance-theme.spec.ts` | Native/Classic token resolution, neutral Host-token fallbacks, host font inheritance, WCAG 1.4.11 3:1 control boundaries and `--go-track` quota bar contrast |
| `sidebar-page.client.spec.tsx`, `sidebar-page-registration.client.spec.tsx` | Opt-in 7-tab console page (`sidebar.panellist` + `main`), dynamic pair registration, staged-only save bar, immediate provider failure alerts and locale copy |
| `settings-nav-icon.client.spec.tsx`, `icon.client.spec.tsx` | `GO_ROW_GEOMETRY` hand-drawn `go` mark, DSH 0.2.2+ `settings.section.icon` seat and older-host CSS-mask DOM fallback |
| `model-label.client.spec.tsx` | Composer `conversation.input.model.label` slot registration at yielding priority `100`, shared catalog RPC deduplication, live peak transition clock and immediate slot disposal when `showModelMultiplier` is turned off |
| `adapter.spec.ts` | Requests, capacity limits, `providerRetryPolicy`, session/attribution headers, immutable request snapshots, cancellation and timeouts |
| `protocols.spec.ts` | Reasoning levels, protocol overrides, OpenAI/Anthropic/Google serialization and signed Google parts |
| `conversion.spec.ts` | Independent tool messages, replay signatures, context conversion, durable image offload, per-request budgets and stream contracts |
| `usage.spec.ts`, `usage.client.spec.tsx` | Official quota reads, current-account selection, 5 input pill styles + border toggle, active-model remaining call estimates, fallback notices and accessibility |
| `analytics.spec.ts`, `analytics.client.spec.tsx` | Official daily CSV parsing/aggregation, UTC ranges (including UTC Today), provider/model grouping, account isolation, 30s cache, charts and CSV export |
| `transport.spec.ts` | Bounded JSON/gzip, classified/redacted HTTP errors, real CONNECT/SOCKS5 proxies and SDK bridge matching |
| `settings.client.spec.tsx`, `accounts-models.client.spec.tsx` | Page configuration, single-save-gesture immediate vs staged writes, batch model switches, per-account plan selection, live model multipliers and drag/keyboard ordering |

All test imports target current modules directly. `tests/setup.ts` gives each test a temporary `DSH_HOME`, provides synthetic `/models` entries, allows loopback HTTP fixtures and explicit `.invalid` destinations, and rejects external network requests.

## Modules

| Domain | Modules |
| --- | --- |
| Host composition and settings | `index.ts`, `config.ts` |
| Inference and model discovery | `adapter.ts`, `catalog.ts`, `conversion.ts`, `google.ts`, `sdk-types.ts` |
| Pricing and quota estimation | `pricing.ts`, `quota-estimate.ts` |
| Account commands and official quota | `accounts.ts` |
| Official daily CSV history and aggregation | `analytics.ts` |
| Free backoff, error classification and transport | `free-channel.ts`, `free-policy.ts`, `free-transport.ts`, `free-http-worker.ts`, `socks-tunnel.ts` |
| Browser-safe configuration and RPC contracts | `contracts.ts` |
| HTTP, proxy transport and redacted errors | `transport.ts` |
| Browser registration and state | `client/index.ts`, `client/controller.ts`, `client/host-slots.ts`, `client/model-catalog-store.ts`, `client/quota-badge.ts`, `client/pages/nav.ts` |
| Sidebar console page (7 tabs) | `client/pages/Page.tsx`, `client/pages/OverviewPage.tsx`, `client/pages/UsagePage.tsx`, `client/pages/AccountsPage.tsx`, `client/pages/ModelsPage.tsx`, `client/pages/AppearancePage.tsx`, `client/pages/AdvancedPage.tsx`, `client/pages/AboutPage.tsx`, `client/pages/types.ts`, `client/GoMark.tsx`, `client/build-info.ts` |
| UI and presentation | `client/Section.tsx`, `client/UsagePill.tsx`, `client/ModelLabel.tsx`, `client/AnalyticsDialog.tsx`, `client/settings-nav-icon.tsx`, `client/presentation.ts` |

### Settings save model

The settings UI uses a single Save gesture: only the **Advanced settings** tab stages a draft behind Save/Discard. Every other control writes immediately through `scope.set`/`unset`.

| Surface | Fields |
| --- | --- |
| Writes on change (no Save) | `enabled`, `sidebarEntry`, `freeEnabled`, `usageDisplay`, `appearanceTheme`, `showSidebarQuota`, `showModelMultiplier`, `usagePillStyle` (`badge`, `concentric`, `fill`, `bars`, `rings`; legacy `plain` migrates to `badge` + `usagePillBorder: false`), `usagePillBorder`, `goPlan`, `modelVisibility`, `modelLimits`, every account action |
| Staged until Advanced Save | `baseURL`, `freeBaseURL`, `proxyURL`, `refreshMinutes`, `streamIdleTimeoutMs`, `requestPreparationTimeoutMs`, `requestTimeoutMs`, `retryPolicy` (`retryMode`, `retryMaxRetries`, `retryMaxDelayMs`), `maxImages`, `maxRequestImageBytes`, `requestImagePixelBudget`, `requestImageMaxBytes` |

### Account fallback and cooldowns

Account commands and automatic primary-account promotion share one in-memory serial queue. Credential, quota and rate-limit failures can try the next account only before output or positive token usage:

- **`QUOTA` / `AUTH` / `INVALID_CREDENTIAL`**: cools down the rejected key for 5 minutes (`REJECTED_KEY_TTL_MS`) and promotes the serving backup account to the first position when `autoSwitch` is enabled.
- **`RATE_LIMIT` (transient HTTP 429)**: cools down the key for upstream `providerRetryAfterMs` (defaulting to 15 seconds, bounded to `[1s, 5m]`) and borrows the backup account without rewriting the saved account order.

## Distribution and publishing

The `.` and `./client` exports point to the built host entry (`lib/index.js`) and browser factory (`lib/client.js`). Free declares official `@oven/bun-*` platform packages directly as optional dependencies pinned to `1.4.4`, so installing the runtime requires no `postinstall` build script or approval.

### Single tracked release tarball rule

Alongside npm releases (`npm publish`), the repository synchronously tracks **exactly one** prebuilt tarball at the repository root: `dsh-opencode-go-<version>.tgz` (matching `package.json`'s `version`) so users in desktop shells or offline environments can install any commit/release directly from a local `.tgz` file.

- `.gitignore` keeps `*.tgz` ignored globally except `!/dsh-opencode-go-*.tgz`, and `.gitattributes` marks `*.tgz binary`.
- Whenever a version is bumped (`package.json` and `src/client/build-info.ts`) or any packed file (`src/` → `lib/`, `README*.md`, `docs/*.md`, `CHANGELOG.md`, etc.) changes, run `npm run compile` and then `npm run pack:release`. `pack:release` deletes any previous `dsh-opencode-go-*.tgz` in the root, packs the new `dsh-opencode-go-<version>.tgz`, and runs `check:pack` to verify byte-for-byte parity with the workspace.
