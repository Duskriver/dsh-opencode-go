# dsh-opencode-go

可独立构建、打包和安装的 DeepSeek Harness OpenCode Go 插件。包含模型适配器和 Web 设置页，无需修改 DSH 源码或重新构建 DSH。

## 兼容版本

当前适配并验证 **DSH `0.1.6-alpha.1`**，依赖使用明确版本。npm 的 DSH `latest` 标签仍指向较旧版本，请勿省略版本号后假定兼容。未验证其他 DSH 版本、Desktop 或其他操作系统。

插件依赖 DSH 的公开服务接口；OpenCode Go 的请求头、模型目录和转换逻辑由本项目维护。无需安装或挂载 `dsh-llm-pi-ai` 才能使用本适配器；DSH 默认组合可以继续挂载它以服务其他提供方。

## 构建与打包

需要 Node.js `^22.19.0 || >=24.0.0` 和 npm。所有依赖从 npm 获取，不使用 `workspace:`、本机路径或 DSH 源码别名。

```sh
npm ci
npm test
npm pack
```

`npm test` 先构建，再执行测试；`npm pack` 也会构建。产物是 `dsh-opencode-go-0.1.0.tgz`，包含 Host、Client、声明文件及 bundle 配置，不包含源码、测试或密钥。

## 安装

在已经安装兼容版本 DSH 的环境执行：

```sh
dsh plugin --profile web add ./dsh-opencode-go-0.1.0.tgz
dsh --profile web --dump-config
dsh web
```

配置树应出现 `dsh-opencode-go` 层和 `id: opencode-go`。Web 设置中打开 **OpenCode Go**，保存 API Key，再在模型选择器选择该提供方的模型。安装插件不会自动更改默认模型。

Headless 独立安装到它自己的 profile：

```sh
dsh plugin --profile headless add ./dsh-opencode-go-0.1.0.tgz
read -s OPENCODE_API_KEY
export OPENCODE_API_KEY
dsh --profile headless --patch ./examples/headless.patch.yml "你好"
```

安装器若提示 pnpm 拦截依赖构建脚本，按提示在该 profile 的 `pnpm-workspace.yaml` 中逐项声明 `allowBuilds`。本次测试对 `@google/genai` 和 `protobufjs` 均设置为 `false`，未执行这些脚本；OpenCode Go 测试路径不需要它们。无需全局放开安装脚本。

### 从已有二次开发版本迁移

本插件使用配置行 `id: opencode-go`，设置命名空间仍是 `llm-opencode-go`，凭据引用仍是 `OPENCODE_API_KEY`。现有二次开发版内置行 `id: llm-opencode-go` 必须停用，避免两个适配器竞争同一个提供方路由。

把 `examples/migrate-from-fork.patch.yml` 中的停用行合并进对应 profile 的 `cordis.patch.yml`，或启动时传入该文件作为 `--patch`。已有配置文件的其他行须保留。无需删除原仓库代码；停用旧行后由外部安装包提供功能。

如果通用 pi-ai 的配置也声明了 `opencode-go` 路由，请移除该路由配置。其他提供方可继续使用。

## 配置

修改对应 profile 的 `cordis.patch.yml`：

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

所有字段均有默认值。`apiKeyEnv` 是凭据引用名，不是密钥；存在 credentials 服务时使用该服务，否则读取进程环境。Web 设置可覆盖基础配置，后续请求读取新值。禁用开关或移除密钥会撤销路由，设置页仍可访问。

## 请求与模型行为

- 每次请求包含 Harness User-Agent 和 `x-opencode-session`；同一会话保持相同值，无会话 ID 的请求使用独立随机值。
- 模型目录取 pi-ai 目录及本项目补充表与网关 `/models` 的交集。未知协议的模型不会猜测加入。
- 实时目录获取失败时，请求目录可回退到本地表；显式模型发现会报告失败。
- 保留流式输出、工具调用、历史回放及支持图片的模型转换；输入图片须有 DSH attachment 服务。
- 模型看到会话内容和工具定义，不增加隐藏系统提示。会话请求头用于网关路由；图片编码和历史前缀影响缓存复用。

## 验证与维护

```sh
npm run typecheck
npm test
npm run verify:installed -- /path/to/isolated-consumer
npm run verify:headless -- /path/to/isolated-consumer
```

后两项使用隔离目录中的已安装包。准备方式和实际验证记录见 [验证说明](docs/verification.md)。架构与代码来源见 [独立发布决策](docs/independent-package.md)和 [第三方声明](THIRD_PARTY_NOTICES.md)。

测试使用本地模拟网关，不会发送真实 OpenCode Go API 请求。真实账号、额度和网关当前模型可用性须在配置自己的密钥后验证。

## 卸载

```sh
dsh plugin --profile web remove dsh-opencode-go
dsh plugin --profile headless remove dsh-opencode-go
```

重启相应应用后移除插件；如默认模型仍指向 `opencode-go`，请选择其他提供方。凭据和历史会话由 DSH 管理。

## 发布

包名暂定 `dsh-opencode-go`，尚未发布到 npm。确认目标包名可用且账号拥有发布权限后，可按 npm 常规流程发布；如改名，同时更新 `cordis.patch.yml` 和测试中的包名。构建脚本从 `package.json` 读取 Client 模块 ID。
