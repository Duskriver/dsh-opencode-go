# dsh-opencode-go

[English](README.en.md)

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中使用 OpenCode Go 订阅模型，支持流式回复、思考模式、工具调用和图片输入。插件自动同步模型列表与容量信息，并提供多账号管理、订阅用量显示和网络代理设置。

适用于 DSH `0.1.5-rc.1` 及以上版本。

## 安装

### 在 DSH 中安装

1. 打开 **插件 → 添加插件**。
2. 输入 `dsh-opencode-go`，点击 **安装**。
3. 安装完成后点击 **立即启用**。

![在 DSH 中安装插件](docs/assets/install-via-dsh.gif)

也可以在添加插件时输入 Git 仓库地址：

```text
https://github.com/Duskriver/dsh-opencode-go
```

### 命令行安装

```sh
dsh plugin --profile web add dsh-opencode-go
```

安装后启动或重启 `dsh web`。Web 和 Headless 使用各自的 profile，分别安装和更新。

## 开始使用

1. 打开 **设置 → OpenCode Go**，填入 API Key 并保存，或在「账号」中添加账号。
2. 在会话模型选择器中选择 **DSH OpenCode Go** 下的模型。
3. 开始对话；支持思考的模型可选择其提供的思考档位，支持图片的模型可直接接收图片。

在设置页刷新模型列表即可同步最新目录。每个模型旁的开关控制它是否出现在选择器中，修改后立即生效。模型的上下文窗口和最大输出默认使用目录配置，也可逐个修改并保存。

插件跟随 DSH 的界面语言，支持中文和英文。

### 查看订阅用量

点击会话输入区旁的用量胶囊，查看当前账号的 5 小时、周和月用量及重置时间。用量每分钟刷新，也可手动刷新。

在 **高级设置 → 额度显示** 中选择：

- **自动**：使用本插件的模型时显示，默认选项。
- **常驻**：使用其他模型时也显示。
- **关闭**：隐藏用量显示并停止轮询。

![订阅用量](image.png)

### 管理多个账号

在「账号」中添加、重命名或更换 Key，展开账号行可查看详细用量。拖动行首手柄调整顺序，第一行成为当前账号。

开启 **自动切换** 后，当前账号额度耗尽或 Key 不可用时，插件会在开始输出前按列表顺序尝试其他账号。也可以在用量胶囊中点击 **切换**，直接选择后续请求使用的账号。

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

将 `model` 换成设置页中可用的模型 ID。示例文件见 [examples/headless.patch.yml](examples/headless.patch.yml)。

### 网络代理

在 **设置 → OpenCode Go → 高级设置 → 代理地址** 中填写并保存，例如：

```text
http://127.0.0.1:7890
socks5://127.0.0.1:1080
```

支持 HTTP、HTTPS、SOCKS5 和带用户名、密码的代理 URL。保存后，后续对话、模型目录更新和用量查询使用新代理。代理运行在 DSH 所在的机器上；远程部署中的 `127.0.0.1` 指服务器自身。

### 手动配置

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
    proxyURL: http://127.0.0.1:7890
    refreshMinutes: 60
    modelVisibility:
      deepseek-v4-pro: false
    modelLimits:
      deepseek-v4.1-flash:
        maxTokens: 8192
    maxImages: 30
```

按需保留配置项，并通过 DSH 凭据服务或环境变量提供对应的 Key。`apiKeyEnv` 选择当前账号，`accounts` 的顺序决定自动切换顺序。

| 配置项 | 用途 |
| --- | --- |
| `baseURL` | OpenCode Go 网关地址，默认 `https://opencode.ai/zen/go/v1` |
| `usageDisplay` | 额度显示模式：`auto`、`always` 或 `off` |
| `proxyURL` | 网络代理；空字符串使用默认网络设置 |
| `refreshMinutes` | 模型目录缓存时长，默认 60 分钟；设置页可随时手动刷新 |
| `modelVisibility` | 按模型 ID 控制选择器中的显示状态 |
| `modelLimits` | 按模型覆盖 `contextWindow` 和 `maxTokens`；空值使用目录容量 |
| `maxImages` | 单次请求历史中的图片数量上限，默认不设上限；超过时先卸载最旧图片 |
| `streamIdleTimeoutMs` | 等待下一个流事件的最长时间，默认 300000 毫秒 |

图片卸载会保留原始附件，并将请求中的旧图片替换为文字占位；调高上限不会自动恢复已卸载的历史图片。

### 导出错误诊断

需要排查请求失败时，在启动 DSH 前设置诊断目录：

```sh
export DSH_OPENCODE_GO_DEBUG_DIR=/tmp/dsh-opencode-go-debug
dsh web
```

Windows PowerShell：

```powershell
$env:DSH_OPENCODE_GO_DEBUG_DIR = "$env:TEMP\dsh-opencode-go-debug"
dsh web
```

复现后，错误信息会给出 JSON 文件路径。记录包含模型、请求参数摘要、HTTP 状态、上游日志与路由编号及错误响应，便于提交 [问题反馈](https://github.com/Duskriver/dsh-opencode-go/issues)。分享前检查服务返回的错误内容；清空环境变量并重启 DSH 即可关闭诊断。

## 更新与卸载

更新到 npm 最新版本：

```sh
dsh plugin --profile web update dsh-opencode-go --latest
```

更新后重启 `dsh web` 并刷新页面；桌面版完全退出后重新打开。Headless 用户将 `web` 换成 `headless`。

卸载：

```sh
dsh plugin --profile web remove dsh-opencode-go
```

从 `0.1.16` 及更早版本升级时，在旧会话或 Agent 预设中重新选择 **DSH OpenCode Go**；手动配置使用 `provider: dsh-opencode-go`。

## 更多

- [开发与测试](docs/development.md)
- [验证记录](docs/verification.md)
- [问题与建议](https://github.com/Duskriver/dsh-opencode-go/issues)
- [MIT 许可证](LICENSE)
