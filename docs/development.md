# Build and compatibility environments

The root package contains one coherent DSH 0.1.6-alpha.1 development environment, the plugin's runtime dependencies, build tools, and core test tools. The published runtime peer ranges remain unchanged. `tests/hosts/*` are independent fixture packages, not npm workspaces. Their dependencies and lockfiles are never installed by root `npm install`, `npm ci`, `prepare`, or `npm pack`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked root dependencies and build through `prepare` |
| `npm run build` | Type-check and produce host, client, and declaration artifacts |
| `npm test` | Rebuild, then run the core Vitest suite |
| `npm run test:compat` | Pack once and test the installed artifact across every supported host fixture |
| `npm run test:compat -- v015-rc1 v017-rc2` | Test only the named fixtures; unknown names fail |
| `npm run test:install` | Test npm and pnpm 11.7.0 Git installs from a fresh source fixture |
| `npm run verify` | Run core, compatibility, and Git-installation checks |

The checks use loopback gateways and local fixtures, not paid inference or an installed user profile. Compatibility and installation checks need registry access; installation checks also require Git. Temporary consumers are created outside the repository and removed on success or failure. Tests never implicitly skip a missing host environment.

`prepare` owns package construction. There is no duplicate `prepack` build. The Git-installation regression creates a repository without `lib/`, `node_modules/`, or even the `tests/` directory, then installs it with both package managers. Each installed package must expose its host and client entrypoints, declarations, build metadata, and importable host module. pnpm permits only the exact Git fixture's build and records that unrelated Google/protobuf scripts are skipped.

## Installed-package matrix

`scripts/compatibility-hosts.mjs` lists the eight host generations. Each `tests/hosts/<id>` has a private manifest and its own lockfile. DSH packages and their required DSH peer/dependency closure are pinned to that host generation, together with compatible Cordis packages. This prevents a broad upstream peer range from silently selecting a later host generation.

The runner performs these steps for each host:

1. Copy the manifest and lockfile into a fresh consumer outside the checkout.
2. Run `npm ci --strict-peer-deps` to validate that host's dependency contracts.
3. Install the same plugin tarball used by every other host.
4. Check that the host's pinned packages retained their versions and the plugin is an actual installed directory.
5. Copy the fixtures into the consumer and run them in separate Node processes.

All host JavaScript imports use ordinary Node resolution. The fixtures do not redirect DSH imports to alternate packages or load the plugin from the source checkout. The client fixture uses the consumer's React, store, and UI primitives, with a CSS loader for published host styles. It verifies the installed browser factory, settings registration, catalog injection, rendering, CSS, and cleanup. Host fixtures retain text streaming, real image processing, history/offload, limits, reasoning, live settings, and profile-bundle checks.

There is one explicit npm prerelease exception: DSH evaluates plugin ranges with prereleases included, whereas npm does not generally accept a future prerelease under `>=0.1.5-rc.1`. Only the tarball-install step uses `--legacy-peer-deps` after the host has passed strict installation. This is not a project `.npmrc` policy and does not affect root installs. The post-install version assertions ensure npm did not replace pinned host packages. Changing the plugin's published version policy is a separate decision.

## Updating a fixture

Add or update the entry in `scripts/compatibility-hosts.mjs`, its private manifest, and its lockfile together. Pin each DSH package reached through dependencies and required peers to the intended host generation; do not upgrade an old host merely to satisfy a newer package. Keep compatible Cordis versions and the client fixture's React, DOM, CSS, and UI dependencies explicit.

Generate a lockfile in a clean temporary directory containing that fixture's manifest:

```sh
npm install --package-lock-only --ignore-scripts --strict-peer-deps
```

Copy the resulting lockfile back to its fixture directory. Generating it outside the checkout prevents an existing root `node_modules` from influencing resolution. Then run the selected compatibility check and the full verification before release. Root development dependency changes require the same strict resolution discipline.

The GitHub workflow runs core and Git-installation checks on Linux and Windows with Node 22.19.0 and 24. The complete installed-host matrix runs separately on Linux/Node 24.
