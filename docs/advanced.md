# OpenCode Go 高级使用指南

[返回 README](../README.md) · [English](advanced.en.md)

## 高级用法

### Headless 模式

安装插件：

```sh
dsh plugin --profile headless add dsh-opencode-go
```

将以下内容保存为 `headless.patch.yml`：

```yaml
- id: agent-default-model
  config:
    provider: dsh-opencode-go
    model: deepseek-v4.1-flash
```

在 Bash 或 Zsh 中输入 Key 后运行任务：

```sh
read -s OPENCODE_API_KEY
export OPENCODE_API_KEY
dsh --profile headless --patch ./headless.patch.yml "你好"
```

将 `model` 换成设置页中可用的模型 ID。示例文件见 [examples/headless.patch.yml](../examples/headless.patch.yml)。

### 网络代理

在 **设置 → OpenCode Go → 高级设置 → 代理地址** 中填写并保存，例如：

```text
http://127.0.0.1:7890
socks5://127.0.0.1:1080
```

支持 HTTP、HTTPS、SOCKS5 和带用户名、密码的代理 URL。保存后，后续对话、模型目录更新和用量查询使用新代理。代理运行在 DSH 所在的机器上；远程部署中的 `127.0.0.1` 指服务器自身。

### 双路由与手动配置

`dsh-opencode-go`（DSH OpenCode Go）从 `baseURL` 的 `/models` 动态发现全部聊天模型，需要至少一个可用 API Key 才激活。`dsh-opencode-free`（DSH OpenCode Free）从 `freeBaseURL` 的 `/models` 筛选已声明合法价格、且文本输入、输出、缓存及所有上下文阶梯均为零的聊天模型；缺失或非法价格不会被视为免费。Free 是**默认关闭的显式 opt-in**：需在 **设置 → OpenCode Go → 高级设置 → 免费通道** 打开（或配置 `freeEnabled: true`）后，插件才会注册 Free 路由、拉取 Free 目录并在设置与模型发现中显示 Free 模型；默认配置下不会访问 `freeBaseURL`。关闭该开关并保存后 Free 路由立即撤回，进行中的请求允许完成；Go 通道行为不变。

Free 共用账号列表，但**已存 Key 与端点绑定**：只有 `freeBaseURL` 的 hostname 为 `opencode.ai`（官方平台地址），或与当前 `baseURL` 同 origin（协议 + 主机 + 端口完全一致，例如自建反向代理同时承载两个路由）时，才复用已存账号 Key 并遵循多账号自动切换设置；其它自定义 `freeBaseURL` 一律退回匿名公共访问（`Bearer public`），不读取也不发送任何已存 Key，并产生不含密钥的 info/debug 诊断。两个路由分别保留原始模型 ID，同名模型可同时存在。设置页顶部的两个模型 Tab 分别编辑各自列表；Go 沿用原 ID 设置键，Free 使用 `dsh-opencode-free/<模型 ID>`。

Free 推理通过插件附带的独立 Bun 1.4.4 HTTP worker 直接发送 API 请求；不依赖本机 OpenCode。模型发现、消息和工具转换、响应解析仍由现有 Node SDK 负责，Go 沿用原传输。Free 使用实测的 `opencode/latest/2.2.5/cli` UA（即官方 OpenCode CLI 身份，而非 DSH 自身的归属 UA），并沿用宿主会话 ID 的原有规范化：常见可打印 ASCII 会话 ID 原样透传，仅非可打印 ASCII 或占用插件内部保留前缀的 ID 才做 sha256 + base64url 单向散列（两种形式都不含对话正文）；不注入占位工具或抓包中的账号、项目和会话值。这些兼容行为不保证上游开放免费服务。

> ⚠️ **风险**：Free 通道默认关闭且不是受支持的稳定能力。开启后请求会以官方 CLI 身份发往平台公共免费入口，可能违反 OpenCode / 上游服务条款，也可能触发上游风控、限流或账号限制；是否开启以及使用频度由用户自行判断并自行承担风险，不建议用于生产环境或大规模自动化调用。

Free 请求自动处理限流：`FreeUsageLimitError` 返回 `FREE_QUOTA`，普通 429 返回 `FREE_RATE_LIMIT`，明确的 OpenCode 客户端限制返回 `FREE_CLIENT_RESTRICTED`，其他未明确分类的 403 返回 `FREE_ACCESS_DENIED`。Go 的错误码和账号切换保持原有规则；Free 中明确的 Go 账号额度或凭据错误仍可按既有设置切换账号，共享 Free 限制不会换号或回退到付费 Go。

对共享免费限制及网络、超时、服务端错误，优先遵循 `Retry-After` 秒数或 HTTP 日期（不会把数小时的退避缩短成几分钟）；没有有效头时，从 60 秒开始指数退避，最多 15 分钟。冷却按免费网关与代理配置隔离，冷却期间新调用返回 `FREE_COOLDOWN`，不发送推理请求，也不自动定时重试。到期后可由用户重试；成功请求重置本地退避计数。退避计数只保存在当前插件实例内，重启后清空。

Bun 通过 npm 可选依赖 `bun@1.4.4` 安装对应平台的二进制。`bun` 包自带 `postinstall`：正常安装时它会把平台二进制复制到 `bun/bin`，缺少平台包时还可能联网下载并解包；`--ignore-scripts` 只会跳过该 postinstall，插件会回退到随可选依赖安装的 `@oven/bun-<platform>` 平台包。若运行时仍不可用（例如可选依赖被 `--omit=optional` 省略或安装失败），Free 会报告 `MISSING_BUN_RUNTIME`，可重新安装插件并启用 optional dependencies；Go 通道不受影响。当前平台包支持的系统和 CPU 以 Bun 的官方发行包为准。

每个 Free HTTP 请求使用一个 worker，默认最多并发 4 个，其余请求可排队或取消。请求通过标准输入传递，响应头和原始 SSE 字节通过标准输出返回；Key 不进入命令行参数或临时文件。消费者停止、超时、取消或卸载插件都会终止相关请求并回收 worker。单个请求体上限为 64 MiB，base64 编码后的 worker IPC 包上限为 256 MiB；worker 自身在读取 stdin 时也会累计校验该包上限。HTTP/HTTPS 代理由 Bun 连接；SOCKS5 使用该请求专属、带随机认证凭据的本机字节隧道，中继只允许连接本次请求的目标 host（大小写不敏感、IP 规范化比较），对无数据往来的连接设 120 秒空闲超时，目标 TLS 握手仍由 Bun 完成。代理失败不会回退到直连。

协议、能力、思考控制与价格直接来自各自的 `/models` 条目。官方网关优先使用条目声明的协议地址；自定义网关保留配置的前缀。两个模型源分别缓存到 `~/.dsh/cache/dsh-opencode-go/go.models.json` 与 `free.models.json`，支持 ETag 与离线保留；缓存带有网关来源标记，不会用于其他地址。

在 patch 文件中添加 `opencode-go` 配置块，可与上面的默认模型配置一起使用：

```yaml
- id: opencode-go
  config:
    apiKeyEnv: OPENCODE_API_KEY
    accounts:
      - id: primary
        name: 主账号
        apiKeyEnv: OPENCODE_API_KEY
      - id: backup
        name: 备用账号
        apiKeyEnv: OPENCODE_GO_BACKUP_KEY
    autoSwitch: true
    # Free 默认关闭；需要平台免费模型时显式开启（等同于 高级设置 → 免费通道）
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

按需保留配置项，并通过 DSH 凭据服务或环境变量提供对应的 Key。`accounts` 的首项为当前账号，其余账号按顺序备用；`apiKeyEnv` 保留为兼容引用，应与首项一致。手动或自动切换都会将目标账号移至首位，保持其他账号的相对顺序。旧配置中当前账号不在首位时，会保留原来的选择并将它前移。

| 配置项 | 用途 |
| --- | --- |
| `baseURL` | OpenCode Go 网关地址，默认 `https://opencode.ai/inference/go/v1`；官方网关自动按模型协议选择推理端点 |
| `freeBaseURL` | 平台免费模型网关，默认 `https://opencode.ai/inference/v1`；高级设置可编辑并校验 URL |
| `freeEnabled` | Free 通道显式 opt-in，默认 `false`；为 `true` 时才注册 Free 路由、拉取 Free 目录并发现 Free 模型 |
| `usageDisplay` | 额度显示模式：`auto`、`always` 或 `off` |
| `proxyURL` | 网络代理；空字符串使用默认网络设置 |
| `refreshMinutes` | 模型目录缓存时长，默认 60 分钟；设置页可随时手动刷新 |
| `modelVisibility` | Go 用原模型 ID；Free 用 `dsh-opencode-free/<模型 ID>`，分别控制显示 |
| `modelLimits` | 按模型覆盖 `contextWindow`、`maxTokens`，或用 `thinkingBudgets` 添加思考预算选项；空值使用默认设置 |
| `maxImages` | 单次请求历史中的图片数量上限，默认不设上限；超过时先卸载最旧图片 |
| `streamIdleTimeoutMs` | 等待下一个流事件的最长时间，默认 300000 毫秒 |
| `requestPreparationTimeoutMs` | 目录查询及每次尝试的凭据、图片准备时限，默认 60000 毫秒 |
| `requestTimeoutMs` | 一次发送的完整时限，包含目录查询、账号切换和流式输出，默认 1800000 毫秒；预先准备的调用从发送时计时 |

未显式配置 `freeEnabled` 的旧 profile 按默认值 `false` 处理：升级后 Free 路由保持关闭，需要时在高级设置中开启；升级前已选择 `DSH OpenCode Free` 模型的旧会话，需要重新选择 Go 模型，或先开启 Free 再继续使用。

默认官方网关使用 `GET https://opencode.ai/inference/go/v1/models` 读取模型列表，使用 `GET https://opencode.ai/inference/go/v1/usage` 查询额度。推理端点按模型目录声明的协议选择，与[官方文档](https://opencode.ai/v2/docs/console/go/#endpoints)一致，以下路径均以 `https://opencode.ai/inference/go` 为前缀：

| 模型协议 | 推理路径 |
| --- | --- |
| OpenAI Chat Completions（如 GLM-5.3-Flash） | `/openai/v1/chat/completions` |
| OpenAI Responses（如 Grok 4.7、GPT 6 Luna） | `/openai/v1/responses` |
| Anthropic Messages（如 Claude Haiku 5.5） | `/anthropic/v1/messages` |
| Google（如 Gemini 4 Argon Contributor） | `/google/v1beta/models/{model}:streamGenerateContent` |

读取旧官方地址 `https://opencode.ai/zen/go/v1` 时，插件会自动迁移，保存设置时也会写入新地址。无需为每个模型手动修改网关。自定义网关继续使用填写的 `baseURL` 作为请求前缀，由各协议 SDK 拼接资源路径；不会自动添加官方网关的协议分段。列表可访问不代表所有推理接口都可用。

额度查询失败时，面板会保留 HTTP 状态码，并在上游提供可读原因时显示脱敏后的摘要。HTTP 403 会提示检查 API Key 和 Go 订阅权限；账号显示“已配置 key”仅代表本地保存了凭据。可同时核对 Key 所属账号或 workspace 的订阅状态，以及网关与代理配置。

图片卸载会保留原始附件，并将请求中的旧图片替换为文字占位；调高上限不会自动恢复已卸载的历史图片。

图片数量超限会在附件读取前检测。每个请求最多并发准备 4 张图片，并在已知编码大小超过单次请求预算时停止；插件不再维护全局图片队列或共享内存池。

首次查询目录失败会报告 `DISCOVERY_FAILED`；已有目录时保留之前确认过的模型。网关明确返回空列表才会清空目录。列表中仅部分行格式错误时，仍可使用有效模型，设置页与日志会提示被忽略的行数。高级表单的普通配置项一次提交并检查版本；凭据由独立服务保存，凭据保存失败时保留其草稿，重试只提交未成功的部分。

请求失败时，错误信息仍包含 HTTP 分类、脱敏后的上游摘要，以及适用的上下文容量提示。插件不再输出内部诊断文件或逐调用追踪。

## 账号操作与保存

账号操作按宿主内存队列顺序执行，凭据写入完成后再更新设置。页面中断不会取消已经开始的存储写入；进程重启后没有事务日志或自动恢复循环，未成功的操作可从账号卡片重新执行。

高级设置的“全部恢复默认”会清除当前层的自定义覆盖，恢复继承值；需要保存后才生效。它不删除账号或 Key，也不清除模型容量覆盖。
