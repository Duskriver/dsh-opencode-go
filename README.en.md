# dsh-opencode-go

[中文](README.md)

Use OpenCode Go subscription models in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with streaming replies, tool calls, and image input.

The plugin adds the session headers required by OpenCode Go, reads the gateway model catalog, and displays subscription usage.

## Installation and usage

Compatible with DSH `0.1.5-rc.1`, `0.1.5-rc.2`, `0.1.6-alpha.1`, and `0.1.6-alpha.2`.

### Web

```sh
dsh plugin --profile web add dsh-opencode-go
```

Start or restart `dsh web`, then:

1. Open **Settings → OpenCode Go**.
2. Enter and save your OpenCode Go API key.
3. Select an OpenCode Go model from the conversation model picker.

### Headless

Install the plugin into the Headless profile:

```sh
dsh plugin --profile headless add dsh-opencode-go
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

## Model capacity settings

In Web, open **Settings → OpenCode Go → Model capacities** to override capacities per model. The section is collapsed by default and lets you:

- Search by model name or ID.
- Set the **context window** and **maximum output**.
- See the catalog-advertised capacities as a reference.
- Click **Use catalog** for one model or clear all overrides.

Blank fields inherit the catalog values. Positive integers are passed directly to the adapter; the plugin does not clamp them to the provider's actual capabilities, so values above the upstream limit may be rejected by the gateway. Changes use the settings page's **Save** / **Discard** flow and take effect on the next request or model read without a restart.

Headless or profile patches can also configure `modelLimits` directly:

```yaml
- id: llm-opencode-go
  config:
    modelLimits:
      deepseek-v4.1-flash:
        contextWindow: 262144
        maxTokens: 32768
```

Each model may set only one field; an omitted field continues to use the catalog value.

## Updating the plugin

Update the plugin in the Web profile to the latest npm version:

```sh
dsh plugin --profile web update dsh-opencode-go --latest
```

Restart `dsh web` and refresh the browser afterwards. For Headless, replace `web` with `headless`; if both profiles have the plugin installed, update each one separately.

## Subscription usage display

![OpenCode Go usage display](image.png)

## FAQ

### DSH 0.1.5 cannot start after installing the plugin

Plugin versions `0.1.0`–`0.1.4` used an image API introduced in DSH `0.1.6`. On an older DSH version this could produce an `IMAGE_OFFLOAD_REQUIRED_CODE` startup error for a missing export. Upgrade to plugin `0.1.5` or newer and restart:

```sh
dsh plugin --profile web add dsh-opencode-go@0.1.6
```

For Headless, replace `web` with `headless`. The fix preserves both host behaviors: DSH `0.1.5` turns the oldest image into placeholder text when the request exceeds the image budget, while DSH `0.1.6` continues to record and handle image offloading through the host.

### The `opencode-go` route is already in use

Only one adapter in a profile can provide the `opencode-go` route. If another plugin or a generic pi-ai configuration already connects OpenCode Go, disable that configuration first. Other providers can continue to run.

### An expected model is missing

Confirm that the plugin is enabled and an API key is configured, then refresh the model list in Settings. Each model-list read requests the gateway's `/models` endpoint and synchronizes the OpenCode Go configuration from [models.dev](https://models.dev/api.json). Protocol support, context length, output limit, and image capability come from the online configuration, so new models do not require a release of this plugin or pi-ai.

Models that are present in the gateway and have an entry using Anthropic Messages, OpenAI Chat Completions, or OpenAI Responses become available on the next list read or refresh. Refresh bypasses the existing catalog cache; a direct request for a previously unseen model also triggers an immediate resynchronization. The Settings page shows the complete discovery result.

A gateway model ID with no usable protocol or capability configuration is shown in Settings with a configuration-unavailable diagnostic and is kept out of the conversation picker, so one unconfigured model cannot block the rest of the list. Direct requests report the reason. Refresh after the upstream configuration is corrected. A model ID alone is not enough to reliably infer its transport; new protocols or protocol-specific exceptions may still require adapter changes.

A reasoning-capable model without adjustable reasoning levels (for example, `union-alpha`) remains selectable and usable; it simply has no reasoning-strength control.

If the online configuration is temporarily unavailable, the plugin prefers a configuration fetched successfully earlier in the process and falls back to pi-ai's built-in metadata. If the gateway catalog is unavailable, existing requests can use the last catalog; a Settings refresh reports the failure instead of presenting stale data as current. `refreshMinutes` controls the cache lifetime for ongoing model requests, but does not prevent an explicit model-list read from fetching fresh data.

## Features

- **Session headers**: Every request includes the Harness User-Agent and `x-opencode-session`. A session keeps one ID; requests without a session ID receive an independent random value.
- **Streaming and history**: Supports streaming output, tool calls, and history replay through pi-ai.
- **Image input**: Supports models that advertise image capability; the DSH attachment service is required.
- **Model capacity overrides**: Override the context window and maximum output per model, with blank values inheriting the online catalog.
- **Prompt and caching**: The plugin does not add hidden system prompts; the session ID is used for gateway routing.

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
