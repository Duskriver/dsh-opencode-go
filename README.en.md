# dsh-opencode-go

[中文](README.md)

Use OpenCode Go subscription models in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with streaming replies, tool calls, and image input.

The plugin automatically adds the session headers required by OpenCode Go, reads the gateway model catalog, and displays subscription usage. There is no need to configure model protocols, modalities, context windows, or maximum output tokens manually.

## Features

- **Session headers**: Every request includes the Harness User-Agent and `x-opencode-session`. A session keeps a stable ID to support gateway routing and prompt-cache optimization; actual cache hits depend on the upstream service.
- **Streaming and history**: Supports streaming output, tool calls, and history replay through pi-ai.
- **Image input**: Supports models that advertise image capability in the catalog.
- **Model capacity overrides**: Override the context window and maximum output per model, with blank values inheriting the online catalog.
- **Per-model switches**: Control which models appear in conversations, with changes applied immediately. Ordinary models default to on and deprecated models default to off; any model can be enabled individually.
- **Prompt and caching**: The plugin does not add hidden system prompts; the session ID is used for gateway routing.

## Installation and usage

Supports DSH `0.1.5-rc.1` and later, including alpha, rc, and stable releases. Compatibility will be maintained as new host versions are released.

Verified versions: `0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.6-alpha.1`, `0.1.6-alpha.2`, `0.1.7-alpha.1`, `0.1.7-alpha.2`, `0.1.7-rc.1`, and `0.1.7-rc.2`.

### Install from DSH (recommended)

1. Open the **Plugins** page in DSH and click **Add plugin** in the top-right corner.
2. Enter `dsh-opencode-go` and click **Install**.
3. If prompted after installation, click **Enable now**.

![Add, install, and enable dsh-opencode-go from DSH (Chinese UI)](docs/assets/install-via-dsh.gif)

Then open **Settings → OpenCode Go**, enter and save your API key, and select an OpenCode Go model in a conversation.

If your DSH version does not have an **Add plugin** entry, use the command-line method below.

### Command-line installation (alternative)

```sh
dsh plugin --profile web add dsh-opencode-go@0.1.14
```

Start or restart `dsh web`, then:

1. Open **Settings → OpenCode Go**.
2. Enter and save your OpenCode Go API key.
3. Select an OpenCode Go model from the conversation model picker.

### Headless

Install the plugin into the Headless profile:

```sh
dsh plugin --profile headless add dsh-opencode-go@0.1.14
```

Save the following as `headless.patch.yml` to select a default model:

```yaml
- id: agent-default-model
  config:
    provider: opencode-go
    model: deepseek-v4.1-flash
```

Read the API key in Bash or Zsh, then run a task:

```sh
read -s OPENCODE_API_KEY
export OPENCODE_API_KEY
dsh --profile headless --patch ./headless.patch.yml "Hello"
```

The model ID must be available in the current gateway catalog. Web and Headless use separate profiles, so install the plugin in each profile you use.

To build from source and install a local package:

```sh
npm ci --legacy-peer-deps
npm pack
dsh plugin --profile web add ./dsh-opencode-go-0.1.14.tgz
```

The development dependencies include real test packages from multiple DSH generations, so installation requires `--legacy-peer-deps`. For Headless, replace `web` with `headless`.

## Updating the plugin

Update the plugin in the Web profile to the latest npm version:

```sh
dsh plugin --profile web update dsh-opencode-go --latest
```

Restart `dsh web` and refresh the browser afterwards. For Headless, replace `web` with `headless`; if both profiles have the plugin installed, update each one separately.

## Subscription usage display

Usage refreshes every minute. Temporary network or service errors retain the last reading for the same account, with a failure notice, timestamp, and reason; the usage panel offers an immediate retry. Initial and authentication failures do not show old usage. Catalog, metadata, and usage JSON requests retry a transient connection reset once within the original timeout budget; this cannot guarantee recovery while the network is failing.

![OpenCode Go usage display](image.png)

## Interface language

The plugin follows Harness and supplies Chinese and English copy without storing a separate language preference. With no explicit choice, the Web client matches the browser's preferred languages (usually inherited from the system); native shells with a system-language bridge supply their operating-system languages. English is used when no supported language matches.

A language explicitly selected in Harness takes precedence and updates the plugin immediately without discarding form drafts. Model names and IDs stay unchanged; usage dates and capacity numbers follow the active interface language. Automatic language detection runs at startup: reload the Web page after changing browser languages, or restart desktop Harness after changing system languages.

## Model switches

In **Settings → OpenCode Go**, the switch beside each model controls whether it appears in conversation model pickers. Switch changes are saved immediately; capacity and API key edits still require **Save**. Ordinary models default to on and deprecated models default to off. You can enable a deprecated model individually or disable an ordinary model. Newly discovered models follow the same defaults unless configured individually.

For manual configuration, add `modelVisibility` under the plugin's `config`, replacing the example placeholders with actual model IDs:

```yaml
modelVisibility:
  your-model-id: false
  your-deprecated-model-id: true
```

Only the listed IDs receive explicit overrides. Switches affect model pickers only: existing conversations can still call hidden models served by the gateway, and Settings retains the complete model list.

The older `showDeprecatedModels` and `visibleModelIds` fields no longer control visibility. Use the individual switches or `modelVisibility`; retaining old fields does not prevent the plugin from loading.

## FAQ

### The `opencode-go` route is already in use

Only one adapter in a profile can provide the `opencode-go` route. If another plugin or a generic pi-ai configuration already connects OpenCode Go, disable that configuration first. Other providers can continue to run.

### An expected model is missing

Check that the model's switch is on in **Settings → OpenCode Go**. Deprecated models default to off; turning on an individual model makes it available in conversation pickers without another global option.

Confirm that the plugin is enabled and an API key is configured, then refresh the model list in Settings. Settings reads and refreshes request the gateway's `/models` endpoint and synchronize the OpenCode Go configuration from [models.dev](https://models.dev/api.json). Conversation pickers respect the catalog cache lifetime, so model switch changes do not force another gateway request. Protocol support, context length, output limit, and image capability come from the online configuration, so new models do not require a release of this plugin or pi-ai.

Models that are present in the gateway and have an entry using Anthropic Messages, OpenAI Chat Completions, or OpenAI Responses are discovered on the next Settings refresh or after the catalog cache expires. A Settings refresh bypasses the cache and notifies open conversation pickers to use the same updated catalog; a direct request for a previously unseen model also triggers an immediate resynchronization. The Settings page shows the complete discovery result.

A gateway model ID with no usable protocol or capability configuration is marked “Configuration missing” in Settings, with its switch off and disabled, and is kept out of the conversation picker, so one unconfigured model cannot block the rest of the list. Direct requests report the reason. Refresh after the upstream configuration is corrected. A model ID alone is not enough to reliably infer its transport; new protocols or protocol-specific exceptions may still require adapter changes.

If online configuration cannot be loaded, models without usable cached or built-in configuration are marked “Configuration unavailable”, with the configuration source error shown on the page. Check access to `https://models.dev/api.json` from the machine running DSH and review the error details, then refresh. When retrying a retained model list, its previous failure stays visible until a successful refresh clears it; configured models remain usable.

A reasoning-capable model without adjustable reasoning levels (for example, `union-alpha`) remains selectable and usable; it simply has no reasoning-strength control.

A model that does offer adjustable levels also declares a default effort (`high` when the model offers it, otherwise the highest level it offers) whenever its transport would answer an unset effort with an explicit disable (`deepseek`, `zai`, `qwen`, `qwen-chat-template`). DSH uses that default when no level has been chosen, so leaving the control unset still sends a reasoning level instead of turning thinking off. Transports that leave the choice to the provider declare no default and are unchanged, and an explicitly chosen level always wins.

If the online configuration is temporarily unavailable, the plugin prefers a configuration fetched successfully earlier in the process and falls back to pi-ai's built-in metadata. If a gateway catalog refresh fails, ongoing requests and Settings retain the last successful list. A failure from either source shows a warning, its cause, and the last successful checks of the model listing and model configuration separately. An initial failure without a cache never invents a model list.

`refreshMinutes` controls the cache lifetime after a successful refresh. Failed refreshes become eligible for retry on the next read after 5, 10, 20, 40, then at most 60 seconds; there is no background polling when nothing reads the catalog. Explicit Settings refreshes and previously unknown model requests bypass this delay. Cancelling model resolution or generation immediately ends that caller's catalog wait while other callers can continue sharing the same refresh.

Verified model configurations can serve generation immediately for five minutes after their cache lifetime expires, while triggering one shared background refresh. This window is measured from each source's last successful check; failed retries do not extend it. Beyond that window, requests wait for the next due refresh, retaining the existing fallback behavior if it fails. Initial loads, unknown models, and manual refreshes wait for results. Listing requests have a 10-second deadline; the larger model metadata download has its own 30-second deadline.

Continuation, retries, and restored sessions reuse the Host's durable session ID. Forks and subagent sessions use their own IDs, separate from the parent. Standalone requests without a session ID receive a fresh random identifier each time.

## Uninstall

Remove the plugin from the relevant profile and restart the application:

```sh
dsh plugin --profile web remove dsh-opencode-go
# or
dsh plugin --profile headless remove dsh-opencode-go
```

## Feedback

Please open an issue for bugs or feature requests.

## License

[MIT](LICENSE)
