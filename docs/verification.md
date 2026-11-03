# Verification

Validated on 2026-11-02 with macOS, Node `24.22.1`, npm `12.2.1`, DSH `0.2.1-rc.5`, Cordis `4.0.5` and Schemastery `3.18.5`.

The minimum supported Host is DSH `>=0.2.1-rc.5`, with Cordis `~4.0.5`. The source contains 17 implementation modules, and the package retains its `.` and `./client` export contracts. The current architecture and command reference are in [development](development.md).

## Acceptance commands

| Command | Result |
| --- | --- |
| `npm test` | 12 test files, 721 tests, zero failures or skipped tests |
| `npm run typecheck` | Host and browser TypeScript projects pass |
| `npm run check:dist` | All 21 shipped build artifacts match an independent rebuild |
| `npm run verify` | Types, artifact comparison, full Vitest suite and installed-package smoke pass |

`verify` includes `typecheck`, `test:ci` and `verify:installed`; `test:ci` includes `check:dist` and `npm test`. CI runs this same acceptance path after `npm ci --strict-peer-deps` on Linux and Windows with Node 22.19 and 24. Those CI jobs are configured; the local results above are from macOS.

## Regression scope

The 12 test files import current modules directly, without resolver aliases or temporary path substitutions. The five support helpers provide current host/account services, ConfigForm/React fixtures, offline model data, loopback gateways and proxies. Tests for removed journals, recovery state machines, disk analytics folds, diagnostic capture, global image pools and legacy host APIs are removed.

Coverage includes:

- Real Cordis/Loader lifecycle, native SettingsForms and owner-scoped RPC, hot profile changes without adapter remounts, coexistence with the native provider and durable signed continuations.
- Account CRUD, generated-key ownership, the 20-account limit, queue serialization across reconnects, failed-write cleanup, read-only keys, stale operations and primary promotion. Real HTTP 401/403/429 and quota responses verify fallback before output, cooldown/expiry, cancellation and prevention of replay after output or charged usage.
- Model catalog discovery, missing/invalid metadata, online refresh and ETag/disk caching, endpoint isolation, lifecycle visibility, typed capacities, request snapshots, reasoning choices and OpenAI/Anthropic/Google wire behavior.
- Stable session and attribution headers, stream outcomes/deadlines, independent tool-role conversion, replay signatures, image offload projection, exact encoded-byte/count budgets and request-local preparation concurrency.
- Official quota/error codecs; local event folding, pricing/context tiers, peak/off-peak periods, Go/Go Plus limits, five-second memory-cache expiry, scan limits, coverage and cancellation.
- Bounded JSON/gzip responses, safe gateway classification/redaction, actual HTTP CONNECT and SOCKS5 proxy paths, concurrent Google fetch binding and version-guarded SDK patch matching.
- Settings Save/Reset/Discard and rejected/concurrent writes; AccountsCard additions, quota states, row actions and drag/keyboard sorting; model editor/search/visibility and refresh races; usage pill polling, account switching and retained readings; complete AnalyticsDialog interactions; installed locale resolution, live Chinese/English changes and all four themes.

## Isolation and limits

Vitest gives each test a temporary `DSH_HOME`, serves complete synthetic `/models` declarations, uses loopback gateways/proxies and rejects other network requests. The installed-package smoke also uses a temporary home, synthetic credentials and metadata, and loopback inference. It resolves the built package through the consumer's ordinary Cordis resolver and verifies dual route discovery, streamed text, session headers, attribution, authorization and unload.

The pinned rc.5 UI primitives package references an unpublished `index.js.map`; Vite reports a non-fatal source-map warning. Undici also reports its experimental SOCKS5 notice during the real proxy test. Neither creates a failed test or nonzero command exit. The suite does not filter these messages or patch installed packages.

JSDOM verifies DOM interactions and accessible state. Its static ResizeObserver fixture does not establish browser layout geometry, real resizing or production latency. Loopback inference does not establish live gateway availability or paid model behavior. `npm run verify:headless -- /path/to/consumer` remains available for a consumer containing the official CLI; it is separate from the default acceptance path.

No git commit, publication, paid inference or installed user-profile changes were performed for this phase.
