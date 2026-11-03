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

`dsh-opencode-go`（DSH OpenCode Go）从 `baseURL` 的 `/models` 动态发现全部聊天模型，需要至少一个可用 API Key 才激活。`dsh-opencode-free`（DSH OpenCode Free）从 `freeBaseURL` 的 `/models` 筛选已声明合法价格、且文本输入、输出、缓存及所有上下文阶梯均为零的聊天模型；缺失或非法价格不会被视为免费。插件开启即激活 Free 路由。

Free 共用账号列表，优先使用已配置的可用 Key，并遵循多账号自动切换设置；没有可用 Key 时使用 `Bearer public`。两个路由分别保留原始模型 ID，同名模型可同时存在。设置页顶部的两个模型 Tab 分别编辑各自列表；Go 沿用原 ID 设置键，Free 使用 `dsh-opencode-free/<模型 ID>`。

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
| `usageDisplay` | 额度显示模式：`auto`、`always` 或 `off` |
| `proxyURL` | 网络代理；空字符串使用默认网络设置 |
| `refreshMinutes` | 模型目录缓存时长，默认 60 分钟；设置页可随时手动刷新 |
| `modelVisibility` | Go 用原模型 ID；Free 用 `dsh-opencode-free/<模型 ID>`，分别控制显示 |
| `modelLimits` | 按模型覆盖 `contextWindow`、`maxTokens`，或用 `thinkingBudgets` 添加思考预算选项；空值使用默认设置 |
| `maxImages` | 单次请求历史中的图片数量上限，默认不设上限；超过时先卸载最旧图片 |
| `streamIdleTimeoutMs` | 等待下一个流事件的最长时间，默认 300000 毫秒 |
| `requestPreparationTimeoutMs` | 目录查询及每次尝试的凭据、图片准备时限，默认 60000 毫秒 |
| `requestTimeoutMs` | 一次发送的完整时限，包含目录查询、账号切换和流式输出，默认 1800000 毫秒；预先准备的调用从发送时计时 |

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
