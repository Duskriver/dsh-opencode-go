# Verification

This document summarizes the automated and manual verification gates for `dsh-opencode-go`. For the full command list and module breakdown, see [development](development.md).

## Automated verification pipeline (`npm run verify`)

Every push and pull request runs the full acceptance pipeline on Ubuntu and Windows across Node `22.19.0` and Node `24`:

| Gate | Command | Scope |
| --- | --- | --- |
| TypeScript check | `npm run typecheck` | Separate Host (`tsconfig.host.json`) and Web Client (`tsconfig.client.json`) strict type checks |
| Source hygiene | `npm run check:hygiene` | Asserts all tracked source files use UTF-8 without BOM, LF line endings, no trailing whitespace, and a single final newline |
| Build parity | `npm run check:dist` | Rebuilds `lib/` in an isolated temporary directory and compares every emitted file byte-for-byte against the committed `lib/` directory |
| Unit & integration tests | `npm test` | Full Vitest suite covering Host adapters, multi-account fallback & cooldowns, retry policies, Free channel transport, SOCKS5/HTTP proxy tunnels, pricing & quota estimation, CSV analytics, theme contrast (WCAG 1.4.11 3:1), and React client components |
| Installed package smoke | `npm run verify:installed` | Loads the built package through Cordis's real package resolver in an isolated `DSH_HOME`, exercising dual route discovery, streaming inference, session/attribution headers, and clean plugin unload |
| Release archive parity | `npm run check:pack` | Verifies the required file manifest and asserts that the tracked root `dsh-opencode-go-<version>.tgz` matches the workspace files byte-for-byte |
| Strict pnpm install | `npm run check:install:pnpm` | Installs the packed tarball in an isolated pnpm 11.28.5 consumer with strict dependency build failures and no inherited build approvals, then executes the platform `@oven/bun-*` binary |

## Isolation guarantees

- **Zero external network access in tests**: `tests/setup.ts` assigns each test an isolated temporary `DSH_HOME`, supplies synthetic `/models` fixtures, permits only loopback (`127.0.0.1` / `[::1]`) and `.invalid` test endpoints, and blocks external network calls.
- **No real credentials in automated tests**: All account, usage and analytics tests run against local loopback HTTP/SOCKS fixtures using synthetic keys.
- **Host compatibility probe**: The CI workflow `.github/workflows/verify.yml` enforces the pinned `0.2.1-rc.5` baseline on `core` and `install-pnpm`, and includes an advisory `compat-dsh-0-2-2` job that installs the packed tarball against the `0.2.2` host stack and runs `scripts/installed-smoke.mjs`.
