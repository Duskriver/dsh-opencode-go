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
| `npm run test:compat -- v015-rc1 v017-rc2` | Test only the named fixtures; unknown names fail |
| `npm run test:install` | Test npm and pnpm 11.7.0 Git installs of prebuilt artifacts without plugin build approval |
| `npm run test:install -- npm` / `-- pnpm` | Run just one package manager; unknown names fail |
| `npm run verify` | Run core, compatibility, and Git-installation checks |

The checks use loopback gateways and local fixtures, not paid inference or an installed user profile. Compatibility and installation checks need registry access; installation checks also require Git. Temporary consumers are created outside the repository and removed on success or failure. Tests never implicitly skip a missing host environment.

## Build before distribution

The default Git branch ships `lib/` so a GitHub URL, an npm release, and an npm tarball all supply ready-to-load code. There are no `prepare`, `prepack`, `prepublish`, or dependency installation hooks. The explicit build command is named `compile` because npm also treats a script named `build` as a reason to prepare a Git dependency and install its development dependencies. `prepublishOnly` checks artifact freshness when a maintainer publishes to npm; it does not execute during dependency installation.

After source or build-tool changes, run `npm run compile` and commit the regenerated `lib/` with those changes. `npm run check:dist` checks missing, changed, and extra artifacts against an independent rebuild. CI uses `npm run test:ci` so it checks the committed files before running tests, instead of silently replacing stale files first. CSS module filenames are repository-relative, CSS export keys are sorted, and declaration line endings are fixed to LF so artifacts are independent of the checkout path and operating system.

The Git-installation regression creates a fresh repository containing the shipped artifacts but no `src/`, `scripts/`, `tests/`, or `node_modules/`, then installs it with both package managers. Each installed package must expose its host and client entrypoints, declarations, build metadata, and importable host module, and must not declare scripts that trigger Git preparation or dependency installation hooks. pnpm receives no approval for this plugin; only unrelated Google/protobuf scripts are explicitly skipped. The cold Git identity changes for each temporary repository, preventing a previously approved Git build from hiding a missing approval. Consumer profiles and their trust settings are never modified by these tests.

## Installed-package matrix

`scripts/compatibility-hosts.mjs` lists the eight host generations. Each `tests/hosts/<id>` has a private manifest and its own lockfile. DSH packages and their required DSH peer/dependency closure are pinned to that host generation, together with compatible Cordis packages. This prevents a broad upstream peer range from silently selecting a later host generation.

The runner performs these steps for each host:

1. Copy the manifest and lockfile into a fresh consumer outside the checkout.
2. Run `npm ci --strict-peer-deps` to validate that host's dependency contracts.
3. Install the same plugin tarball used by every other host.
4. Check that the host's pinned packages retained their versions and the plugin is an actual installed directory.
5. Copy the fixtures into the consumer and run them in separate Node processes.

Local compatibility runs are serial by default. Set `DSH_COMPAT_CONCURRENCY` to a positive integer to run that many isolated hosts at once; CI uses four workers and prefers its restored npm download cache, fetching missing packages as needed. Each host keeps its own dependency installation and fixture processes, and all workers consume the same tarball. A failed host does not skip queued hosts or delete files still used by running checks: the runner collects every result before cleanup. Logs are grouped by host, and the console and GitHub job summary report each result and elapsed time.

All host JavaScript imports use ordinary Node resolution. The fixtures do not redirect DSH imports to alternate packages or load the plugin from the source checkout. The client fixture uses the consumer's React, store, and UI primitives, with a CSS loader for published host styles. It verifies the installed browser factory, settings registration, catalog injection, rendering, CSS, and cleanup. Host fixtures retain text streaming, real image processing, history/offload, limits, reasoning, live settings, and profile-bundle checks.

There is one explicit npm prerelease exception: DSH evaluates plugin ranges with prereleases included, whereas npm does not generally accept a future prerelease under `>=0.1.5-rc.1`. Only the tarball-install step uses `--legacy-peer-deps` after the host has passed strict installation. This is not a project `.npmrc` policy and does not affect root installs. The post-install version assertions ensure npm did not replace pinned host packages. Changing the plugin's published version policy is a separate decision.

## Updating a fixture

Add or update the entry in `scripts/compatibility-hosts.mjs`, its private manifest, and its lockfile together. Pin each DSH package reached through dependencies and required peers to the intended host generation; do not upgrade an old host merely to satisfy a newer package. Keep compatible Cordis versions and the client fixture's React, DOM, CSS, and UI dependencies explicit.

Generate a lockfile in a clean temporary directory containing that fixture's manifest:

```sh
npm install --package-lock-only --ignore-scripts --strict-peer-deps
```

Copy the resulting lockfile back to its fixture directory. Generating it outside the checkout prevents an existing root `node_modules` from influencing resolution. Then run the selected compatibility check and the full verification before release. Root development dependency changes require the same strict resolution discipline.

The GitHub workflow runs core and Git-installation checks on Linux and Windows with Node 22.19.0 and 24. Core tests, npm installs, and pnpm installs run as independent jobs, so one slow installation does not consume another check's time allowance. Installation jobs need no root `npm ci`: their runner uses only Node built-ins, and the fresh Git fixture supplies committed artifacts and must not need build dependencies or plugin build approval. The complete installed-host matrix runs separately on Linux/Node 24.

Installation jobs reuse the npm download cache and a separate pnpm store, preferring cached packages while still fetching missing data. They never restore the checkout's `node_modules` or `lib/`. CI keeps the npm cache, isolated consumers, and the cached pnpm store under `RUNNER_TEMP`, on the runner's work volume. `DSH_PNPM_STORE_DIR` selects the pnpm store; local runs use the system temporary directory and the default package caches unless overridden.

Every Git-installation run reports fixture preparation, installation, artifact verification, cleanup, and total elapsed time. GitHub job summaries include a phase table. CI also enables npm's internal timing records and uploads the `*-timing.json` files for seven days, for diagnosing dependency resolution and extraction; a timeout may prevent the still-running process from writing its final timing file. The 15-minute job limit remains unchanged.
