# OpenCode Go advanced guide

[Back to README](../README.en.md) · [简体中文](advanced.md)

## Advanced usage

### Headless mode

Install the plugin:

```sh
dsh plugin --profile headless add dsh-opencode-go
```

Save this as `headless.patch.yml`:

```yaml
- id: agent-default-model
  config:
    provider: dsh-opencode-go
    model: deepseek-v4.1-flash
```

Enter your key in Bash or Zsh, then run a task:

```sh
read -s OPENCODE_API_KEY
export OPENCODE_API_KEY
dsh --profile headless --patch ./headless.patch.yml "Hello"
```

Replace `model` with an available model ID from Settings. See [examples/headless.patch.yml](../examples/headless.patch.yml).

### Network proxy

Open **Settings → OpenCode Go → Advanced settings → Proxy address**, enter a URL, and save. Examples:

```text
http://127.0.0.1:7890
socks5://127.0.0.1:1080
```

HTTP, HTTPS, SOCKS5, and URLs containing a username and password are supported. Subsequent conversations, catalog updates, and usage queries use the saved proxy. Connections originate from the machine running DSH; on a remote deployment, `127.0.0.1` refers to that server.

### Dual routes and manual configuration

`dsh-opencode-go` (DSH OpenCode Go) discovers all chat models from `baseURL/models` and activates when at least one usable API key is configured. `dsh-opencode-free` (DSH OpenCode Free) discovers only chat models with a valid declared tariff whose text input, output, cache and every context tier are all zero, from `freeBaseURL/models`. Missing or invalid prices never qualify as free. The Free route is an **explicit opt-in and off by default**: only after `freeEnabled` is enabled in **Settings → OpenCode Go → Advanced settings → Free channel** (or `freeEnabled: true` in the profile patch) does the plugin register the route, fetch the Free catalog and advertise Free models. The default configuration never contacts `freeBaseURL`. Turning the switch off withdraws the route on the next settings update; requests already streaming are allowed to finish. Go behavior is unchanged.

Saved-key reuse is endpoint-bound: Free shares the account roster, but only reuses saved keys when `freeBaseURL` is the official HTTPS endpoint (`opencode.ai` over `https:` on its default port) or shares the Go gateway's origin (same scheme, host and port, e.g. one self-hosted reverse proxy serving both routes); it then follows automatic account retry settings. `http://opencode.ai`, an `opencode.ai` URL on a custom port, and any other custom `freeBaseURL` fall back to anonymous public access (`Bearer public`): no saved key is read or sent, and a credential-free info/debug diagnostic is produced. Both routes preserve original model IDs, including overlapping names. Settings provides separate model tabs; Go keeps existing ID keys, while Free uses `dsh-opencode-free/<model ID>` in visibility and capacity settings.

> ⚠️ **Risk**: the Free channel is off by default and is not a supported stable capability. Once enabled it sends requests to the platform's public Free entry point while identifying as the official CLI, which may violate OpenCode/upstream terms of service and may trigger upstream risk controls, rate limits or account restrictions. Whether and how often to use it is your own decision and risk; it is not recommended for production or large-scale automation.

Free inference sends direct API requests through the bundled standalone Bun 1.4.4 HTTP worker, with no local OpenCode dependency. The existing Node SDK still handles discovery, message/tool conversion and response parsing; Go retains its transport. Free uses the observed `opencode/latest/2.2.5/cli` user agent and the existing host-session normalization (printable ASCII session IDs pass through unchanged; only non-printable or plugin-reserved IDs are sha256 + base64url hashed, and neither form contains message content), without placeholder tools or captured account/project/session values. Compatibility does not guarantee upstream free access.

Free requests handle rate limits automatically. `FreeUsageLimitError` becomes `FREE_QUOTA`, a generic 429 becomes `FREE_RATE_LIMIT`, an explicit OpenCode client restriction becomes `FREE_CLIENT_RESTRICTED`, and an otherwise unclassified 403 becomes `FREE_ACCESS_DENIED`. Go error codes and account switching retain their behavior. Explicit Go account quota/authentication failures on Free still follow existing account fallback settings; shared Free limits neither rotate accounts nor fall back to paid Go.

Shared Free restrictions and network, timeout or server errors honor `Retry-After` delta-seconds or HTTP-date, including delays of many hours. Without a valid header, exponential backoff starts at 60 seconds and caps at 15 minutes. Cooldowns are isolated by Free gateway and proxy configuration. New calls during cooldown return `FREE_COOLDOWN` without inference traffic; no automatic retry is scheduled. Users can retry after expiry; success resets the fallback counter. State is held in the plugin instance and starts fresh after restart.

Bun 1.4.4 installs through the plugin's direct `@oven/bun-<platform>` npm optional platform packages. These packages carry native binaries directly, without the `bun` wrapper or an install script, so pnpm does not request approval for a Bun `postinstall`. The package manager selects the package for the current OS, CPU and libc. If no runtime is available (for example `--omit=optional` or a failed install), Free reports `MISSING_BUN_RUNTIME`; reinstall with optional dependencies enabled. Go remains available. Leaving Free disabled does not automatically omit the optional runtime download. Supported operating systems and CPUs follow these official Bun platform packages.

Each Free HTTP request owns a worker, with at most four concurrent workers and cancellable queueing. Requests use stdin; response headers and raw SSE bytes use stdout. Keys never enter argv or temporary files. Consumer cancellation, timeouts and plugin unload stop requests and reap workers. Each request body is limited to 64 MiB and the encoded worker IPC packet to 256 MiB; the worker also enforces the stdin packet limit while reading. Bun handles HTTP/HTTPS proxies; SOCKS5 uses a per-request loopback byte tunnel with random authentication credentials, restricted to the request's own target host (case-insensitive, IP-normalized); its idle limit is the request's stream idle budget plus a 30-second margin (330 seconds by default), so a queued or large-context prefill stall is classified by the plugin's own stream watchdog first, while Bun still performs target TLS. A proxy failure never falls back to a direct connection.

Protocols, capabilities, reasoning controls and tariffs come directly from each gateway’s `/models` entries. Official gateways prefer declared protocol URLs; custom gateways keep their configured prefix. Separate `go.models.json` and `free.models.json` files under `~/.dsh/cache/dsh-opencode-go/` support ETag revalidation and offline retention. Cache documents identify their source URL and cannot be reused for another gateway.

The following patch configures shared accounts and per-model settings:

```yaml
- id: opencode-go
  config:
    apiKeyEnv: OPENCODE_API_KEY
    accounts:
      - id: primary
        name: Primary
        apiKeyEnv: OPENCODE_API_KEY
      - id: backup
        name: Backup
        apiKeyEnv: OPENCODE_GO_BACKUP_KEY
    autoSwitch: true
    # Free is off by default; opt in to the platform's free models
    # (same as Settings → Advanced settings → Free channel).
    freeEnabled: true
    freeBaseURL: https://opencode.ai/inference/v1
    proxyURL: http://127.0.0.1:7890
    refreshMinutes: 60
    modelVisibility:
      deepseek-v4-pro: false
    modelLimits:
      dsh-opencode-free/beam-free:
        maxTokens: 8192
      deepseek-v4.1-flash:
        maxTokens: 8192
      qwen3.7-plus:
        thinkingBudgets: [4096, 6000]
    maxImages: 30
```

Keep the options you need and supply the corresponding keys through DSH credentials or environment variables. The first entry in `accounts` is current; the remaining entries are tried in order. The legacy `apiKeyEnv` reference must match the first entry. Manual and automatic switches move the target account first while preserving the other accounts' relative order. Existing configurations retain their selected account by moving it first.

| Option | Purpose |
| --- | --- |
| `baseURL` | OpenCode Go gateway address; defaults to `https://opencode.ai/inference/go/v1`, with official inference endpoints selected by model protocol |
| `freeBaseURL` | Platform free gateway, default `https://opencode.ai/inference/v1`; editable with URL validation in advanced settings |
| `freeEnabled` | Explicit opt-in for the Free route, default `false`; only when `true` does the plugin register the Free route, fetch its catalog and discover Free models |
| `usageDisplay` | Usage display mode: `auto`, `always`, or `off` |
| `proxyURL` | Network proxy; an empty string uses the default network settings |
| `refreshMinutes` | Model catalog cache lifetime; defaults to 60 minutes, with manual refresh available in Settings |
| `modelVisibility` | Control model picker visibility by model ID |
| `modelLimits` | Per-model `contextWindow` and `maxTokens` overrides, plus additional `thinkingBudgets` options; null uses defaults |
| `maxImages` | Maximum images in one request's history; unset by default, with oldest images offloaded when exceeded |
| `streamIdleTimeoutMs` | Maximum wait for the next stream event; defaults to 300000 milliseconds |
| `requestPreparationTimeoutMs` | Deadline for discovery and each attempt's credential/image preparation; defaults to 60000 milliseconds |
| `requestTimeoutMs` | Whole dispatch deadline, including discovery, account fallback and streaming; defaults to 1800000 milliseconds. Prepared calls start this timer at dispatch |

Profiles that never set `freeEnabled` keep the default `false`: after upgrading, the Free route stays off until it is enabled in advanced settings. Sessions that selected a `DSH OpenCode Free` model before the upgrade need to select a Go model or enable Free first.

The default official gateway lists models at `GET https://opencode.ai/inference/go/v1/models` and reads usage at `GET https://opencode.ai/inference/go/v1/usage`. Inference follows each model's declared protocol and the [official endpoint documentation](https://opencode.ai/v2/docs/console/go/#endpoints). The following paths share the prefix `https://opencode.ai/inference/go`:

| Model protocol | Inference path |
| --- | --- |
| OpenAI Chat Completions, such as GLM-5.3-Flash | `/openai/v1/chat/completions` |
| OpenAI Responses, such as Grok 4.7 and GPT 6 Luna | `/openai/v1/responses` |
| Anthropic Messages, such as Claude Haiku 5.5 | `/anthropic/v1/messages` |
| Google, such as Gemini 4 Argon Contributor | `/google/v1beta/models/{model}:streamGenerateContent` |

The legacy official base `https://opencode.ai/zen/go/v1` migrates automatically, and settings writes store the new address. There is no need to change the gateway for each model. Custom gateways keep the configured `baseURL` prefix and let each protocol SDK append its resource path; official protocol segments are not added automatically. A working listing does not verify every inference route.

Usage failures retain the HTTP status and show a redacted summary when the upstream provides a readable reason. HTTP 403 includes a reminder to check the API key and Go subscription permissions. “Key saved” only confirms local credential storage; check the subscription for the account or workspace that owns the key, along with the gateway and proxy settings.

Image offloading keeps the original attachment and replaces the old image in the request with a text placeholder. Raising the limit does not automatically restore previously offloaded images.

Image count overflow is detected before attachment reads. Each request prepares at most four images concurrently and stops when known encoded bytes exceed its payload budget. There is no plugin-wide image queue or shared payload pool.


A cold catalog outage reports `DISCOVERY_FAILED`; a warm catalog retains previously verified models. Only an explicit empty gateway listing clears membership. A partially malformed listing keeps its valid models and reports the ignored row count in settings and logs. Ordinary advanced form settings commit in one revision-checked batch. Credentials use a separate service; failed credential drafts remain, and retry submits only uncommitted parts.

Request failures retain HTTP classification, redacted upstream summaries and applicable context-capacity hints. The plugin no longer writes internal diagnostic files or per-call traces.

## Account operations and saving

Account operations run in a host-owned memory queue, with credential writes completed before settings updates. Closing the page does not cancel a storage write already in progress. There is no transaction journal or startup recovery loop; retry an unsuccessful operation from the accounts card.

Reset all to defaults in advanced settings removes overrides at the current layer and restores inherited values; save to apply the reset. It does not remove accounts or keys, or clear model limit overrides.
