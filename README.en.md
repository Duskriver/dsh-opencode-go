<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo-light.png" alt="DSH-OCGO" width="480">
  </picture>
</p>

<h1 align="center">dsh-opencode-go</h1>

<p align="center">
  <a href="README.md">简体中文</a>
</p>

**OpenCode Go subscription usage and multiple-account management** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with convenient access to quotas, reset times, and account switching.

DSH already supports OpenCode Go natively. This plugin focuses on usage inside conversations, managing multiple accounts, dedicated model and settings controls, and an optional full-page console that brings all of them together.

- **Independent Go and Free routes**: dynamically discover each gateway’s chat models, keep overlapping IDs, and edit them in separate settings tabs. The Free route is an explicit opt-in and is **off by default**; enable it in **Settings → OpenCode Go → Overview → Free channel** (applied immediately, with no Save) before it registers, fetches its catalog, or appears in model pickers.
- **Free rate-limit protection**: once enabled, honors upstream `Retry-After` and pauses new requests during cooldown. Shared Free quota/IP limits do not rotate Go accounts.
- **Usage at a glance**: see usage beside the conversation input, then open the panel for five-hour, weekly, and monthly percentages and reset times.
- **Accounts in one place**: inspect each account's quota and key status, drag to reorder, switch inside a conversation, or enable automatic fallback.
- **Sidebar console (opt-in, off by default)**: enable **Settings → OpenCode Go → Overview → Sidebar entry** to add an **OpenCode Go** row to the DSH sidebar after the plugin market. It opens a full-page console with six tabs — Overview, Usage, Accounts, Models, Appearance and About — that shares one controller with the Settings section. With the entry off (the default) no row is registered, and the Settings section and in-place history dialog keep working; hosts that do not declare `sidebar.panellist` never register the page and fall back to Settings automatically.
- **One save gesture**: only **Advanced settings** (gateway URLs, proxy, cache/timeouts and image limits) stages a draft behind Save/Discard. Every other control — the provider and sidebar-entry switches, the Free channel, usage display, interface theme, sidebar quota, input quota style, model visibility and capacities, and all account actions — applies as you change it.
- **Clearer model and settings controls**: search and filter models, adjust visibility, limits, and thinking budgets; advanced settings are grouped by purpose, with hints and a reset action.

Supports Chinese and English, following DSH's interface language. The existing screenshots below show the Chinese **Classic** theme; the default **Native** theme follows the active DSH color, typography, and geometry tokens.

## View subscription usage

Click the usage pill beside the conversation input to open the current account's subscription usage. Bars show the **percentage used**, turn amber near the limit, and red when exhausted. Each quota window shows its reset time.

While visible, usage refreshes every minute. Periodic queries pause while the page is hidden and resume with a refresh when it becomes visible. Temporary failures show a warning; retained readings are marked as previous data. Click **Retry now** after a failure, or **Refresh accounts** in the Settings account card.

Under **Settings → OpenCode Go → Appearance → Usage display** (applied immediately), choose:

| Mode | Behavior |
| --- | --- |
| Auto (default) | Show while a **DSH OpenCode Go** model is selected |
| Always | Also show configured OpenCode Go account usage while using other models |
| Off | Hide the conversation pill and stop its polling |

## Usage analytics

Open the dashboard from the conversation input's expanded usage pill, or from the **OpenCode Go** console entry in the sidebar (its **Usage** tab) once the opt-in sidebar entry is enabled. While the entry is off, or on hosts that do not declare `sidebar.panellist`, the pill's dashboard button falls back to the in-place history dialog with the same data. The Settings section keeps the full surface and offers **Open full page** only while the entry is registered.

![Official workspace history dashboard with sample data](docs/assets/usage-history-desktop.jpg)

[Narrow-screen light preview](docs/assets/usage-history-mobile.jpg) · [Model rankings and detail](docs/assets/usage-history-models.jpg), both using sample data.

- **One official source**: totals, daily charts and model detail use the same official daily CSV, covering requests, input/output/cache tokens and the official usage amount. Models are grouped by provider + model. Ranges are today, 7, 30 and 90 days; all dates use UTC.
- **Independent viewing account**: defaults to the current inference account and shows only the workspace belonging to the selected key, including calls from other clients. Changing the viewing account does not change the conversation account. All three dashboard quota windows follow the selection. Anonymous Free coverage is not guaranteed.
- **Official usage amount**: sums `cost_micro_cents` directly (`1 USD = 100,000,000` units); it does not mean an additional Go charge. Official daily aggregates may be delayed.
- **Two themes, shared layouts**: settings, the console page, the usage pill, sidebar and dashboard use the same component layouts. `appearanceTheme` selects **DSH Native (default)** or **OpenCode Go Classic**, with light/dark schemes following the Host; see [Appearance and advanced settings](#appearance-and-advanced-settings) for the theme behavior. On the console page the dashboard uses a full-page layout; the fallback dialog stays a dialog on wide screens and becomes full-screen on narrow screens. Both keep daily token/request bars, model rankings and details.
- **On-demand queries**: history loads when opening, changing account or range, or refreshing manually. The Host uses a 30-second cache; forced refresh bypasses it. History is not polled in the background. Only official model gateway configurations support it; errors remain explicit without falling back to local scans.

Keys stay on the Host. Normal reports send the browser only aggregate numbers and provider / model / day; an official CSV explicitly downloaded by the user may contain member fields. See [usage analytics notes](docs/usage-analytics.en.md) for accounting and privacy details.

## Manage multiple accounts

Open **Settings → OpenCode Go → Accounts** to manage accounts:

![Account management: ordering, usage details, key actions, and automatic fallback](docs/assets/accounts.png)

- Add, rename, replace keys, or remove accounts; up to 20 accounts are supported.
- See key status, five-hour usage, and a reset countdown in each row; expand it for full usage and account actions.
- Drag a row's handle to reorder accounts. The first row becomes current, and the order determines automatic fallback priority.
- Click **Switch** in the conversation usage panel to move the selected account first for subsequent requests in this profile. The other accounts keep their relative order.

With **Automatic fallback** enabled, HTTP 401/403/429 or exhausted quota causes the plugin to try other accounts in order before output begins. A fallback account that starts producing output moves first and becomes current, and the usage panel shows a switch notice. Requests that have already produced output, recorded token usage, or been canceled are not automatically resent through another account.

Gateway-rejected keys cool down in memory for five minutes. Account commands write credentials and settings through one serial host queue.

Keys are saved through DSH's credential service. Settings never displays an already saved key.

## Free channel (opt-in, off by default)

`DSH OpenCode Free` is not enabled by default. It is an explicit opt-in because it uses the upstream public Free entry point and sends requests as the official OpenCode CLI, which may violate upstream terms or trigger abuse controls.

Enable it in **Settings → OpenCode Go → Overview → Free channel** (applied immediately, with no Save; or set `freeEnabled: true` in the profile patch). While it is off, the plugin does not register the `dsh-opencode-free` route, does not fetch `freeBaseURL`'s model catalog, and does not advertise Free models through discovery or the Settings model list. Turning the switch off later withdraws the route immediately; requests already streaming are allowed to finish. Go behavior and account handling are unchanged.

Once enabled:

- **Saved-key reuse is endpoint-bound**: Free shares the account roster and follows the Automatic fallback setting, but only reuses saved keys when `freeBaseURL` is the official HTTPS endpoint (`opencode.ai` over `https:` on its default port) or shares the Go gateway's origin (same scheme, host and port, e.g. one self-hosted reverse proxy serving both routes). `http://opencode.ai`, an `opencode.ai` URL on a custom port, and any other custom `freeBaseURL` fall back to anonymous `Bearer public` — no saved key is read or sent — and the decision is logged without credentials.
- **Anonymous public access without a key**: with no usable key it sends `Bearer public`.
- **Official CLI identity**: requests use the official OpenCode CLI user agent (`opencode/latest/2.2.5/cli`) instead of DSH's own attribution.
- **Separate Bun runtime**: Free inference runs in its own HTTP worker started from the official `@oven/bun-*` optional platform packages, all pinned to 1.4.4. These packages ship the native binary directly, with no `bun` wrapper or `postinstall`, so no Bun build-script approval is needed. Missing optional dependencies can produce `MISSING_BUN_RUNTIME` while Go keeps working (see the FAQ).
- **Rate-limit protection**: honors upstream `Retry-After`; new calls during cooldown fail fast with `FREE_COOLDOWN`, and shared Free quota/IP limits never rotate Go accounts.

> ⚠️ **Risk**: the Free channel relies on the upstream public Free access point and an impersonated client user agent. It may violate OpenCode/upstream terms of service and may trigger rate limiting, risk controls, or account restrictions. Use it only if you understand and accept that risk; it is not intended for production or large-scale automation.

## Install and get started

Requires DSH `0.2.1-rc.5` or later. See [development](docs/development.md) for the current validation workflow.

### Install from DSH

1. Open **Plugins → Add plugin**.
2. Enter `dsh-opencode-go` and click **Install**.
3. Click **Enable now** after installation.

![Install the plugin in DSH](docs/assets/install-via-dsh.gif)

You can also enter the repository URL:

```text
https://github.com/Duskriver/dsh-opencode-go
```

Command-line installation:

```sh
dsh plugin --profile web add dsh-opencode-go
```

Start or restart `dsh web` after command-line installation. Web and Headless use separate profiles; install and update each individually.

### Get started

1. Open **Settings → OpenCode Go → Accounts**, click **Add account**, enter a name and your OpenCode Go subscription API key, and confirm.
2. (Optional) Open **Settings → OpenCode Go → Overview** and enable **Sidebar entry**. A row appears in the DSH sidebar and opens the full console; the entry is off by default, and the Settings section and in-place usage dialog keep working without it.
3. Select a model under **DSH OpenCode Go** in the conversation model picker.
4. Start chatting and check usage beside the input. With multiple accounts, open the panel to switch.

> Only **Advanced settings** keep Save/Discard; every other switch and option in this plugin applies immediately.

The plugin registers its own **DSH OpenCode Go** model provider. Selecting a native DSH provider does not automatically use this plugin's account switching. **Always** mode can still show usage for accounts configured in this plugin.

## Models and settings

### Select models and adjust parameters

Search **Available models** by name or ID, or filter by **New in 7 days**, **Customized**, or **Deprecated**. Click **Refresh** to check the latest catalog.

![Model settings: search, filters, visibility switches, and parameter editing](docs/assets/model-settings.png)

- Each model's switch controls its visibility in the conversation picker and takes effect immediately.
- Select a model to inspect its catalog context window, maximum output, and input modalities. Limit overrides apply as you edit them — committed on blur, Enter, or shortly after typing stops; empty values use defaults.
- Reasoning models offer the applicable switch, effort, or token budget options. Budget-based models also accept custom budgets, which apply immediately.

Any model with an output capacity above **65,536 tokens** defaults to that allowance when neither the caller nor settings specifies one. Smaller models retain their SDK defaults. DSH receives the same allowance for compaction budgeting. Set a model’s **Max output** override when a longer answer is needed.

Streaming, reasoning, tool calls, and image input depend on model capabilities. Input modalities shown in Settings come from online model metadata; this plugin currently converts and forwards only image attachments.

### Appearance and advanced settings

**Appearance** owns the usage display mode, the interface theme, the sidebar quota card and the input quota style; all four apply as you change them. **Advanced settings** is the only card with a Save gesture: it groups **Connection** (gateway URLs and proxy), **Cache and timeouts**, and **Image handling**, and its reset action clears that card's staged overrides; save to apply the reset. Hover over a question mark for help. The current account selection is preserved.

Under **Settings → OpenCode Go → Appearance**, set `appearanceTheme` to `native` or `classic`; the choice applies immediately. **Native (default)** follows DSH and third-party themes through public Host semantic tokens for colors, fonts, radii, shadows and focus styling, with neutral fallbacks when a Host token cannot be resolved. Its strong control boundary and state-derived chart series (output, cache read, cache write) stay on plugin-owned contrast-checked values instead of the Host palette: the Host's `border-l2` is a hairline divider and its `state-*` values are status-dot colors, neither guaranteed at the WCAG 1.4.11 3:1 that control boundaries and data-viz series need. The brand-accent chart series still follows the Host accent. Existing profiles without this field also default to Native. **Classic** retains warm paper / charcoal surfaces, terracotta accents, and preferred Anthropic Serif / Sans / Mono fonts with system and CJK serif fallbacks; Host and third-party themes do not override these brand tokens, while the Host's light/dark mode still selects the Classic scheme. **Input quota style** remains `badge` (default) or `plain`, and **Show quota in the sidebar** remains an independent switch, off by default; both apply immediately.

![Advanced settings: grouped controls, hints, and a shared reset action](docs/assets/advanced-settings.png)

Under **Advanced settings → Connection**, HTTP, HTTPS, and SOCKS5 proxies are supported. After saving, subsequent conversations, catalog updates, and usage queries use the proxy. Connections originate from the machine running DSH; on a remote deployment, `127.0.0.1` refers to that server.

Set `baseURL` and `freeBaseURL` independently under **Advanced settings → Connection**; both wait for Save. Protocol selection follows the gateway model declaration. The **Free channel** and **Sidebar entry** switches are the two opt-ins (both off by default) and live under **Overview**; see [Free channel](#free-channel-opt-in-off-by-default) for behavior and risks. See the [advanced guide](docs/advanced.en.md) for account, model-key and disk-cache details.

Screenshots illustrate the interface. Actual models, quotas, and timestamps depend on your account and the current online catalog.

## Updates and common questions

Update to the latest npm release:

```sh
dsh plugin --profile web update dsh-opencode-go --latest
```

Restart `dsh web` and reload the page afterward. For desktop DSH, quit and reopen the application. Headless users should replace `web` with `headless`. The repository's default branch may contain changes not yet released to npm. The current release line is `0.6.0`: the sidebar console entry is opt-in and off by default, and only Advanced settings keep Save/Discard.

**Why is usage hidden?** Auto mode shows it only for **DSH OpenCode Go** models. Check that the plugin is enabled, a key is configured, and the display mode is appropriate. The display mode lives under **Settings → OpenCode Go → Appearance → Usage display** and applies immediately; choose Always to show usage with other providers.

**Why is there no OpenCode Go row in the sidebar?** The sidebar entry is opt-in and off by default. Enable **Settings → OpenCode Go → Overview → Sidebar entry**; the row then appears after the plugin market and opens the full console. If your client does not declare the `sidebar.panellist` slot (older versions, or combinations without a sidebar), the row and page are not registered — keep using the Settings section and the usage pill's in-place history dialog.

**Where is DSH OpenCode Free?** The Free route is an explicit opt-in and is off by default. Enable it in **Settings → OpenCode Go → Overview → Free channel** (applied immediately); only then does the plugin register the route, fetch its catalog, and show Free models. See [Free channel](#free-channel-opt-in-off-by-default) for behavior and risks.

**Why does Free need a separate Bun runtime?** Free inference directly uses the official `@oven/bun-<platform>` optional packages, all pinned to 1.4.4. They carry native binaries without install scripts, so no `bun` `postinstall` approval is needed; the package manager installs only the runtime matching the current OS, CPU and libc. If optional dependencies are omitted with `--omit=optional` or cannot be installed, Free reports `MISSING_BUN_RUNTIME`; reinstall the plugin with optional dependencies enabled. Go is unaffected. Leaving Free disabled does not automatically omit this optional runtime download.

**What if usage queries or account additions fail?** Retry in the usage panel or refresh usage in the account card. Account actions run in a serial host queue; unsuccessful operations can be retried. See [account operations and saving](docs/advanced.en.md#account-operations-and-saving).

**What if a long conversation keeps returning 400?** Check the output allowance and context window in the error, then run `/compact` or lower that model's **Max output** before retrying. Explicit context overflow is passed to DSH's recovery mechanism; an unexplained 400 keeps its classification and includes troubleshooting guidance. Failed attempts without measured tokens omit zero usage so they do not report an empty context.

**Why does an old conversation need its model selected again?** When upgrading from `0.1.16` or earlier, select **DSH OpenCode Go** again in existing conversations or Agent presets. Manual configurations use `provider: dsh-opencode-go`.

**Which host is targeted?** The development baseline is DSH `0.2.1-rc.5`. Developer messages, dynamic tool additions/removals, and deferred tool loading are explicitly rejected; see [development and testing](docs/development.md).

Uninstall:

```sh
dsh plugin --profile web remove dsh-opencode-go
```

## Architecture and verification

The source is organized by domain:

| Domain | Modules |
| --- | --- |
| Plugin composition, settings and contracts | `index.ts`, `config.ts`, `contracts.ts` |
| Requests, model catalog and protocol conversion | `adapter.ts`, `catalog.ts`, `conversion.ts`, `google.ts`, `sdk-types.ts` |
| Accounts, official quota, official CSV history and transport | `accounts.ts`, `analytics.ts`, `transport.ts` |
| Browser registration, typed state and sidebar slots | `client/index.ts`, `client/controller.ts`, `client/host-slots.ts`, `client/pages/nav.ts` |
| Sidebar console page | `client/pages/Page.tsx`, `client/pages/OverviewPage.tsx`, `client/pages/UsagePage.tsx`, `client/pages/AccountsPage.tsx`, `client/pages/ModelsPage.tsx`, `client/pages/AppearancePage.tsx`, `client/pages/AboutPage.tsx`, `client/pages/types.ts`, `client/GoMark.tsx`, `client/build-info.ts` |
| Host settings, account/model controls, usage and Native/Classic presentation | `client/Section.tsx`, `client/UsagePill.tsx`, `client/AnalyticsDialog.tsx`, `client/presentation.ts` |

The `x-opencode-session` header carries a stable form of the conversation ID for gateway cache affinity: printable ASCII IDs pass through unchanged, and only non-printable or plugin-reserved IDs are hashed (sha256 + base64url); neither form contains message content. The browser uses DSH's `configForms`; only Advanced settings stage a draft, while every other setting and capacity commits immediately (capacities stay typed objects while editing). The sidebar console row and its `main` panel are registered as one pair only while the opt-in `sidebarEntry` setting is on and the host declares `sidebar.panellist`; turning it off leaves the page and disposes both. Images use per-request count and encoded-byte budgets, with at most four preparations per request. The package keeps its `.` and `./client` exports. Development dependencies pin DSH `0.2.1-rc.5` and Cordis `4.0.5`; runtime Cordis requires `^4.0.5`.

Use Node.js `^22.19.0 || >=24.0.0`:

```sh
npm ci
npm test
npm run typecheck
npm run check:dist
npm run check:pack
npm run verify
```

Tests cover host services, accounts, catalog, protocols, analytics, transport, Free backoff, and browser interactions. After changing source, run `npm run compile` to rebuild `lib/`. `verify` runs type checks, artifact comparison, the full test suite and the package-loading smoke. See [development](docs/development.md) for separate installed-consumer and Headless checks.

## More documentation

- [Advanced guide: Headless, proxies, manual configuration, and error diagnostics](docs/advanced.en.md)
- [Usage analytics: official source, accounting, and privacy](docs/usage-analytics.en.md)
- [Development and testing](docs/development.md)
- [Verification notes](docs/verification.md)
- [Issues and suggestions](https://github.com/Duskriver/dsh-opencode-go/issues)
- [MIT license](LICENSE)
