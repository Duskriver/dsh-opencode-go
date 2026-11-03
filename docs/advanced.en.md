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

### Experimental Responses protocol

Open **Settings → OpenCode Go → Advanced settings → DeepSeek V4.1 Flash protocol** to select Responses (experimental). Automatic remains the default and follows the gateway's declared protocol. This setting applies only to `deepseek-v4.1-flash` and to new requests. Existing conversation history can continue with either selection; a failed request does not automatically retry through another protocol.

To configure the experiment manually:

```yaml
- id: opencode-go
  config:
    protocolOverrides:
      deepseek-v4.1-flash: openai-responses
```

Select Automatic to revert. A null value for this model also clears an inherited override. Gateway routing and performance may change; Responses does not guarantee a particular provider or faster responses.

### Manual configuration

Add an `opencode-go` configuration block to a patch file. It can be combined with the default-model configuration above:

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
    proxyURL: http://127.0.0.1:7890
    refreshMinutes: 60
    modelVisibility:
      deepseek-v4-pro: false
    modelLimits:
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
| `usageDisplay` | Usage display mode: `auto`, `always`, or `off` |
| `proxyURL` | Network proxy; an empty string uses the default network settings |
| `refreshMinutes` | Model catalog cache lifetime; defaults to 60 minutes, with manual refresh available in Settings |
| `modelVisibility` | Control model picker visibility by model ID |
| `protocolOverrides` | Experimental `deepseek-v4.1-flash: openai-responses`; unset or null follows the gateway |
| `modelLimits` | Per-model `contextWindow` and `maxTokens` overrides, plus additional `thinkingBudgets` options; null uses defaults |
| `maxImages` | Maximum images in one request's history; unset by default, with oldest images offloaded when exceeded |
| `streamIdleTimeoutMs` | Maximum wait for the next stream event; defaults to 300000 milliseconds |
| `requestPreparationTimeoutMs` | Deadline for discovery and each attempt's credential/image preparation; defaults to 60000 milliseconds |
| `requestTimeoutMs` | Whole dispatch deadline, including discovery, account fallback and streaming; defaults to 1800000 milliseconds. Prepared calls start this timer at dispatch |

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
