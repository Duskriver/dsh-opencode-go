# dsh-opencode-go

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中使用 OpenCode Go 订阅模型，支持流式回复、工具调用、图片输入和 Web 设置页。

插件自动添加 OpenCode Go 所需的会话请求头，并从网关获取可用模型目录。通过 DSH 插件命令安装，无需修改 DSH 源码。

## 安装与使用

已验证兼容 **DSH `0.1.6-alpha.1`**。其他版本尚未验证。

### Web

```sh
dsh plugin --profile web add dsh-opencode-go
```

安装后启动或重启 `dsh web`：

1. 打开 **设置 → OpenCode Go**。
2. 填入 OpenCode Go API Key 并保存。
3. 在会话的模型选择器中选择 OpenCode Go 模型。

API Key 来自你的 OpenCode Go 订阅。安装插件不会自动更改默认模型。

### Headless

安装到 Headless profile：

```sh
dsh plugin --profile headless add dsh-opencode-go
```

将以下内容保存为 `headless.patch.yml`，选择默认模型：

```yaml
- id: agent-default-model
  config:
    provider: opencode-go
    model: deepseek-v4.1-flash
```

在 Bash 或 Zsh 中读取 API Key，然后运行任务：

```sh
read -s OPENCODE_API_KEY
export OPENCODE_API_KEY
dsh --profile headless --patch ./headless.patch.yml "你好"
```

模型 ID 须在当前网关目录中可用。Web 和 Headless 使用各自的 profile，需要分别安装插件。

## 订阅用量

Web 中选择 `opencode-go` 提供方的模型后，模型名左侧显示 **Go · 5h 已用百分比 · 周已用百分比**。点击可查看 5 小时、每周、每月用量和本地时区的重置时间。

数据通过 Host 使用已配置的 API Key 查询 `GET /zen/go/v1/usage`，每分钟刷新；浏览器不接收 API Key。切换到其他提供方后隐藏，页面不可见时暂停查询。接口失败或响应缺失时显示“暂不可用”，不会填成 0%。接口返回的是账号订阅额度，不是当前会话 token 数。

这个接口可在 [OpenCode 官方源码](https://github.com/anomalyco/opencode/blob/dev/packages/console/app/src/routes/zen/go/v1/usage.ts) 中查到；当前返回 `rolling`、`weekly`、`monthly` 各窗口的 `status`、`percent` 和 `resetsAt`，不返回缓存命中率。

底部的缓存命中率由每次模型响应的缓存 token 统计计算。插件支持 `prompt_tokens_details.cached_tokens`、`prompt_cache_hit_tokens` 和顶层 `cached_tokens`。上游未返回缓存统计时，当前 pi-ai / Harness 统计链路也可能显示 0；可在 OpenCode 控制台的使用历史中展开对应请求的输入明细进行核对。新会话首次请求出现 0 命中是可能的，同一会话后续有可复用的提示前缀才可能命中。

## 配置

Web 用户可直接在 **设置 → OpenCode Go** 中修改配置。启用开关立即生效；保存其他配置后，后续请求使用新值。

需要通过文件配置时，在对应 profile 的 `cordis.patch.yml` 中添加以下内容。所有字段均有默认值，通常只需配置 API Key。

```yaml
- id: opencode-go
  config:
    enabled: true
    apiKeyEnv: OPENCODE_API_KEY
    baseURL: https://opencode.ai/zen/go/v1
    refreshMinutes: 60
    streamIdleTimeoutMs: 300000
    maxRequestImageBytes: 20971520
    requestImagePixelBudget: 4194304
    requestImageMaxBytes: 1048576
```

`apiKeyEnv` 是凭据引用名，不是密钥。插件通过 DSH credentials 服务解析凭据；未挂载该服务时读取进程环境。Web 保存的设置可覆盖文件中的基础配置。

关闭插件开关或移除密钥会撤下提供方路由，设置页仍可访问。

## 常见问题

### 安装提示依赖构建脚本被拦截

按安装器提示，在该 profile 的 `pnpm-workspace.yaml` 中逐项设置 `allowBuilds`。OpenCode Go 已验证的运行路径不需要执行 `@google/genai` 和 `protobufjs` 的安装脚本，可以将这两项设为 `false` 后重试。保留文件中的其他配置，无需全局放开安装脚本。

### 提示 `opencode-go` 路由已被占用

同一 profile 中只能有一个适配器提供 `opencode-go` 路由。如果已经通过其他插件或通用 pi-ai 配置接入 OpenCode Go，请先停用那一项配置。其他提供方可以继续使用。

### 没有出现预期的模型

先确认插件已启用且 API Key 已配置，再刷新设置页中的模型列表。插件仅展示本地适配表与网关实时目录的交集；尚未适配协议的新模型不会自动加入。

实时目录获取失败时，适配器可使用本地表继续处理请求；设置页中的模型发现会显示失败，便于重新尝试。

## 功能说明

- **会话请求头**：每次请求包含 Harness User-Agent 和 `x-opencode-session`。同一会话保持相同 ID，无会话 ID 的请求使用独立随机值。
- **流式与历史**：支持流式输出、工具调用及历史回放，协议请求由 pi-ai 执行。
- **图片输入**：支持目录中声明图片能力的模型，需要 DSH attachment 服务。
- **提示与缓存**：插件不增加隐藏系统提示；会话 ID 用于网关路由，历史前缀及图片编码影响缓存复用。

## 卸载

从对应 profile 移除插件，再重启应用：

```sh
dsh plugin --profile web remove dsh-opencode-go
# 或
dsh plugin --profile headless remove dsh-opencode-go
```

如果默认模型仍指向 `opencode-go`，请改选其他提供方。凭据和历史会话由 DSH 管理。

## 开发

需要 Node.js `^22.19.0 || >=24.0.0` 和 npm。

```sh
npm ci
npm run typecheck
npm test
npm pack
```

`npm test` 会先构建再执行测试；`npm pack` 生成可安装的 `.tgz` 包。依赖均通过 npm 安装，不需要 DSH 源码仓库。

- [验证说明](docs/verification.md)：测试范围、隔离安装与 Headless 验证方法。
- [架构与依赖](docs/independent-package.md)：Host、Client 构建方式和转换代码的维护方式。
- [第三方声明](THIRD_PARTY_NOTICES.md)：代码来源与许可。

自动化测试使用本地模拟网关，不会发起付费模型请求。真实账号、Desktop 和其他操作系统尚未验证。

## 许可证

[MIT](LICENSE)
