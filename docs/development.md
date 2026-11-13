# Development

The development and full-acceptance baseline is DSH `0.2.1-rc.5`, Cordis `4.0.5` and Schemastery `3.18.5`. The published package requires DSH `>=0.2.1-rc.5`, Cordis `^4.0.5`, `@deepseek-ai/dsh-brand >=0.2.1-rc.5` and `@deepseek-ai/schemastery >=3.18.5 <4` as Host-provided peer dependencies. The installed DSH `0.2.2-rc.1` runtime (Cordis `4.1.0`, Schemastery `3.19.0`) has only been smoke-tested through the headless CLI; its Web/client surface is unverified, as the [verification matrix](verification.md#verification-matrix) records. Install the locked dependencies with `npm ci`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check the host and browser TypeScript projects |
| `npm run compile` | Rebuild the host bundle, browser factory and declarations in `lib/` |
| `npm run check:dist` | Compare an independent rebuild with every shipped artifact |
| `npm run check:pack` | Assert the npm tarball contains every required runtime, docs and notice file |
| `npm run check:install:pnpm` | Install the real tarball in an isolated pnpm 11.28.5 consumer with strict build failures and no inherited approvals, then execute the selected Bun platform binary |
| `npm run check:hygiene` | Check tracked source hygiene: UTF-8 without BOM, LF endings, no trailing whitespace, single final newline, and no tabs in `src/`/`scripts/` |
| `npm test` | Run the Vitest suite |
| `npm run test:ci` | Check artifacts, then run the Vitest suite |
| `npm run verify:installed -- /path/to/consumer` | Exercise a built package through the consumer's real Cordis resolver; defaults to this checkout |
| `npm run verify:headless -- /path/to/consumer` | Exercise a consumer containing the official DSH CLI and the installed plugin, with an isolated profile and loopback gateway |
| `npm run verify` | Run type checks, artifact comparison, the complete Vitest suite and installed-package smoke |

`test:ci` runs `check:dist` followed by `npm test`. `verify` runs `typecheck`, `check:hygiene`, `test:ci` and `verify:installed`. CI uses `npm ci --strict-peer-deps` and `npm run verify` on Linux and Windows with Node 22.19 and 24. The separate blocking `install-pnpm` job runs `check:install:pnpm` against the packed plugin to prevent the #87 build-approval regression. Inference smoke checks use synthetic credentials and a loopback gateway. `verify:headless` additionally requires the official DSH CLI in the supplied consumer; it creates an isolated home and profile. CI enforces the 0.2.1-rc.5 baseline; an advisory 0.2.2-rc.1 compatibility job probes that Host path (see the verification matrix).

## Test suite

Vitest tests are organized by domain. Results for the history-dashboard migration are tracked separately in [verification notes](verification.md); the table below is a scope reference, not a passing-run claim.

| Test file | Coverage |
| --- | --- |
| `plugin.spec.ts` | Cordis mounting/unloading, native SettingsForms/profile writes, hot configuration, RPC and public exports |
| `accounts.spec.ts` | Account CRUD, 20-account cap, serial writes, failed-write cleanup, fallback/promotion, stale calls and five-minute cooldown |
| `free.spec.ts` | Dual route lifecycle, public Bearer fallback, official-HTTPS-only saved-key binding, account retry and credential deadlines |
| `free-channel.spec.ts`, `free-transport.spec.ts` | Free failure classification, Retry-After/backoff, cancellation, transport isolation, stream-budget-derived SOCKS relay idle limits and coexistence with Go |
| `pricing.spec.ts` | Catalog tariff validation and Free-model eligibility; historical amounts come from official CSV |
| `catalog.spec.ts` | Discovery, model limits/visibility, dual directories, ETag/disk cache, endpoint isolation and bounded transport |
| `config-validation.spec.ts` | Base-URL credential rejection with redacted diagnostics, proxy userinfo acceptance and thinking-budget schema bounds |
| `socks-tunnel.spec.ts` | Loopback SOCKS relay: allowed-target enforcement, authentication, stream-budget-derived idle budget, idle teardown/reset and IPv4/IPv6 normalisation |
| `theme.client.spec.ts` | Native/Classic token resolution, neutral Host-token fallbacks, host font inheritance, Host-independent chart series and strong control boundaries at WCAG 1.4.11 3:1, including the composited rendered bar opacity, plus the derived quota track's visibility against every surface and the stylesheet rules that must paint it |
| `sidebar-page.client.spec.tsx` | Console page tabs, staged-only save bar, immediate provider failure alerts, overview/about content and locale copy |
| `sidebar-page-registration.client.spec.tsx` | Opt-in pair registration: entry off by default, switching on registers both slots, switching off leaves the page and disposes both, openPage availability |
| `adapter.spec.ts` | Requests, capacity limits, session/attribution headers, immutable request snapshots, cancellation and timeouts |
| `protocols.spec.ts` | Reasoning levels, protocol overrides, OpenAI/Anthropic/Google serialization and signed Google parts |
| `conversion.spec.ts` | Independent tool messages, replay signatures, context conversion, durable image offload, per-request budgets and stream contracts |
| `usage.spec.ts` | Official quota reads, current-account selection, native gateway access and safe error responses |
| `analytics.spec.ts` | Official daily CSV parsing/aggregation, UTC ranges, provider/model grouping, account isolation, short cache and cancellation |
| `analytics.client.spec.tsx` | Dashboard totals/locale/theme rendering, dated bar keyboard and pointer selection, focused-Escape precedence, exports and permission failures |
| `transport.spec.ts` | Bounded JSON/gzip, classified/redacted HTTP errors, real CONNECT/SOCKS5 proxies and SDK bridge matching |
| `settings.client.spec.tsx` | Page configuration, typed Save/Reset/refused writes, locale changes, registration and subscription/cancellation lifecycle |
| `appearance-theme.spec.ts` | `appearanceTheme` controller defaults (Native, invalid drafts), staged Classic draft vs applied theme and inherited-reset preview |
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
| Browser registration and state | `client/index.ts`, `client/controller.ts`, `client/host-slots.ts`, `client/pages/nav.ts` |
| Sidebar console page | `client/pages/Page.tsx`, `client/pages/OverviewPage.tsx`, `client/pages/UsagePage.tsx`, `client/pages/AccountsPage.tsx`, `client/pages/ModelsPage.tsx`, `client/pages/AppearancePage.tsx`, `client/pages/AboutPage.tsx`, `client/pages/types.ts`, `client/GoMark.tsx`, `client/build-info.ts` |
| UI and presentation | `client/Section.tsx`, `client/UsagePill.tsx`, `client/AnalyticsDialog.tsx`, `client/presentation.ts` |

The console page is registered as a pair of host slots: `sidebar.panellist` publishes the global row (id `opencode-go`, order 2) and `main` publishes the keyed panel with the same id, so the host owns the click, the active state, the label and the column geometry. `client/host-slots.ts` declares both slot contracts locally because the two host UI packages are not devDependencies; `ctx.slots.inject('sidebar.panellist', ...)` is the support probe. The pair is gated at runtime: it is registered only while the opt-in `sidebarEntry` setting is `true` and the host declares the list slot. Either gate going away disposes both entries, and disposal leaves the active panel first so the central column never points at a missing key. `openPage` reaches the settings section only while the pair is registered, and the composer pill's `openUsagePage()` reports the miss at click time so the pill falls back to its in-place usage dialog; hosts without the slot keep the settings section and never register the page. The page's tab lives in a module-level store because the host unmounts the panel on every return to the conversation. One controller and one reader set are created in `apply()` and shared by the settings section, the composer pill, the sidebar quota card and the page, so no surface owns a second draft or a second definition of the remote calls. Cards on the page use the `surface='page'` variant of the reusable settings components (`AccountsCard`, `ModelsSettings`, `AppearanceSettings`, `AdvancedSettings`), which swaps the settings page's hairline rows for real card surfaces without changing their behaviour.

The host uses `settings.configure()` and volatile configuration fields; the browser binds the official `configForms` contract. The settings have exactly one save gesture: only the **Advanced settings** card stages a draft behind Save/Discard. Every other control writes immediately through `scope.set`/`unset` — the provider and sidebar-entry switches, the Free channel, usage display, interface theme, sidebar quota, input quota style, model visibility, model capacities and every account action. The controller therefore scopes `dirty`, `invalid` and `failed` to the advanced draft, `saving` also covers in-flight immediate writes, and `writeFailed` names the immediate field whose write was refused so each surface can report its own refusal. The accounts card owns all credential entry and replacement.

| Surface | Fields |
| --- | --- |
| Writes on change (no Save) | `enabled`, `sidebarEntry`, `freeEnabled`, `usageDisplay`, `appearanceTheme`, `showSidebarQuota`, `usagePillStyle`, `modelVisibility`, `modelLimits`, every account action |
| Staged until Advanced Save | `baseURL`, `freeBaseURL`, `proxyURL`, `refreshMinutes`, `streamIdleTimeoutMs`, `requestPreparationTimeoutMs`, `requestTimeoutMs`, `maxImages`, `maxRequestImageBytes`, `requestImagePixelBudget`, `requestImageMaxBytes` |

Account commands and automatic primary-account promotion share one in-memory serial queue. Credential writes settle before the next command starts. Metadata changes use a single revision-guarded write; no WAL, startup recovery or conflict retry loop is maintained. Only credentials owned by the removed generated account are deleted. Request generations prevent late fallback outcomes from replacing a newer user selection. Credential, quota and rate-limit failures can try the next account only before output or positive usage, and rejected gateway keys cool down for five minutes. Changing a key or explicitly selecting an account clears its rejection state.

Analytics requests `https://opencode.ai/console/api/v2/usage/export?range=7d|30d|90d` from the Host with the selected account's key. One daily CSV snapshot supplies totals, UTC daily buckets and provider/model detail. Today filters the 7-day snapshot to the current UTC date; absent dates are filled with zero. Input, output, cache read and both 5-minute/1-hour cache-write fields are summed without repricing. Integer `cost_micro_cents` use `1 USD = 100,000,000` units and are presented as the official usage amount, which does not establish extra Go charges.

History queries occur only on open, account/range changes and manual refresh. Official reports and CSVs have a 30-second Host cache isolated by credential, account, network configuration, range and UTC date; forced refresh bypasses it. Queries retain the configured proxy path, cancellation, timeouts and response-size limits. Only official gateway configurations may send keys to Console. Third-party gateways, permission failures, network failures and invalid data produce explicit errors, without a local-history fallback.

The browser receives only aggregate numbers and provider/model/day groups. The user's explicit CSV download may contain official member fields. The independent viewing-account selector defaults to the inference account and scopes all three dashboard quota windows to the selected workspace, including other clients; anonymous Free coverage is not guaranteed.

Settings, the dashboard, pill and expanded sidebar share the same component layouts and internal `--go-*` token contract. `appearanceTheme` selects `native` (the default) or `classic`; existing profiles without the field also resolve to Native. Both themes use the Host's light/dark scheme. Native resolves colors, typography, radii, elevation and focus metrics through public Host semantic tokens, allowing DSH and third-party themes to propagate across every plugin surface, and uses neutral fallbacks for unresolved tokens. Every quota bar track uses one derived `--go-track` property: `QUOTA_TRACK_PERCENT` of the theme's text color mixed into the backdrop, instead of a Host surface layer. Native light's layer-2 can be the card's own colour (1.0:1 in the default Host palette; about 1.1:1 against the neutral fallback surface), so a surface-colored track left the bar's fill floating with no frame — the reported 1% reading was a stray dot. The mix keeps the track near 1.4:1 against light surfaces and 1.7:1 in dark; in the checked Native/Classic fallback palettes the fill stays at least 2.5:1 against the track (Native's accent follows the Host, so a third-party accent is not covered by that bound). `theme.client.spec.ts` composites exactly that percentage and asserts every quota track rule paints the token. The row bar stays one continuous track: its former 1px surface-coloured quarter marks are gone, because on a visible track they read as gaps that split one bar into four. Native's strong control boundary and its state-derived chart series (output, cache read, cache write) deliberately keep checked local values instead of following the Host palette: the Host's `border-l2` is a hairline divider and its `state-*` colors are status dots, neither contrast-managed for control boundaries or data-viz, so following them would break the plugin's WCAG 1.4.11 3:1 contract. The brand-accent chart series still follows the Host accent. Classic instead keeps its own warm paper/charcoal, terracotta and serif token sets, independent of Host and third-party theme overrides. Classic typography prefers locally installed Anthropic Serif Web, Sans Web and Mono Web families, with system fallbacks and CJK serif headings; no font binaries or external font requests are added.

Theme selection changes token resolution rather than component layout. Styling stays within plugin-owned components and the shared token layer; overrides that reached into Host-private styles have been removed instead of depending on undocumented Host internals. `usagePillStyle` still supports `badge` (default) and `plain`, while `showSidebarQuota` remains an independent switch, off by default.

Backend history tests use synthetic CSVs, synthetic keys and loopback services; real user keys are not used in automated tests. The separately recorded Console check establishes source availability for the checked account; automated migration results are recorded separately in the verification notes.

Image count limits are checked before reads. Each request prepares up to four images concurrently and checks its own encoded-payload budget. The host's `requiredImageOffload` / `projectOffloadedImages` protocol owns durable offload marks. There is no plugin-wide preparation queue or payload pool. HTTP failure classification, credential redaction, context-capacity hints, stream deadlines and cancellation remain active; internal call tracing and diagnostic file capture are removed.

## Distribution

The `.` and `./client` exports continue to point to the built host entry and browser factory. Rebuild `lib/` with source changes, then run `npm run check:dist`. Builds do not execute during dependency installation. Free declares the official `@oven/bun-*` platform packages directly as optional dependencies pinned to 1.4.4, so installing the runtime does not require the script-bearing `bun` wrapper or a build approval. The Host supplies `@deepseek-ai/dsh-brand` and `@deepseek-ai/schemastery` as peers so the installation keeps one copy of each; the lockfile still records both because the pinned DSH development packages depend on them transitively. The private `opencode-go-pi-ai` alias uses `@earendil-works/pi-ai@1.5.0`, which pins `@earendil-works/pi-telemetry@1.5.0` and `@earendil-works/pi-schema@1.5.0` exactly; `package.json` no longer needs `overrides`.

The Google transport bridge is version-guarded for pi-ai 1.5.0 and `@google/genai@2.21.0`. `src/google.ts` delegates simple streaming to the upstream adapter through the request-scoped fetch binding; pi-ai now selects discrete thinking levels for Gemini 4 natively.

SDK declarations bundle pi-schema in place of TypeBox. `scripts/licenses/pi-1.5.0-LICENSE` supplies the pi packages' upstream MIT license omitted from their npm distributions. pi-schema's format checks and value conversion rules include code adapted from TypeBox 1.3.27 (MIT); the build appends the package's `LICENSES/typebox-LICENSE` to its pi-schema notice in `lib/vendor-licenses.txt`.

## Publishing

`npm publish` is guarded by two lifecycle hooks. `prepack` re-runs `npm run check:dist`, so a stale `lib/` fails before a tarball is produced; `prepublishOnly` runs `npm run typecheck && npm run test:ci` (artifact comparison plus the complete Vitest suite). `verify:installed` is deliberately absent from both hooks because it needs a consumer installation; run it separately before a release when one is available. `check:install:pnpm` is likewise outside the lifecycle hooks because it downloads pnpm and installs the tarball; its dedicated CI job is blocking. `npm run check:pack` (also a CI step) runs `npm pack --dry-run --json --ignore-scripts` and asserts the tarball contains the runtime entries, types, docs, examples, icons and third-party notice files. `lib/build-info.json` records the package version, so bumping `package.json` requires rebuilding `lib/` before release. The tarball ships `scripts/licenses/pi-1.5.0-LICENSE` next to `lib/vendor-licenses.txt` so the reference in `THIRD_PARTY_NOTICES.md` resolves inside the installed package. `CHANGELOG.md` and `SECURITY.md` are part of the tarball as well, so release notes and the security policy install with the package. The current release line is `0.6.0`; its minor bump makes the sidebar console entry an opt-in that is off by default and reduces settings to one Save gesture on the Advanced tab, on top of the 0.5.0 sidebar console page (six tabs through `sidebar.panellist` + `main`), the 0.4.0 Native and Classic UI themes, the compact settings page, and Gemini unsigned tool-history replay compatibility. `npm run check:hygiene` runs inside `verify`, so CI enforces source hygiene without a separate workflow step.
