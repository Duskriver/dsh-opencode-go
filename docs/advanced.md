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

### 实验性协议与手动配置

在 **高级设置 → DeepSeek V4.1 Flash 协议** 中可选择 **Responses（实验性）** 并保存，便于比较同一模型的不同协议。默认 **自动** 跟随模型目录；改回自动即可恢复。选择只影响新请求，不会切换已准备或正在执行的调用，也不会在协议错误后自动改用另一协议。

目前仅支持 `deepseek-v4.1-flash` 的 Responses 覆盖，沿用当前账号、代理、会话标识与用量处理。[issue #45](https://github.com/Duskriver/dsh-opencode-go/issues/45) 报告了更低延迟，但它不是网关的稳定性能承诺，也不能据此确认底层服务商；是否更快请以自己的测试为准。无需覆盖时省略以下配置：

```yaml
- id: opencode-go
  config:
    protocolOverrides:
      deepseek-v4.1-flash: openai-responses
```

将该模型的值设为 `null` 会明确选择自动，即使继承的配置启用了 Responses；设置页的「恢复默认」会移除当前层覆盖，恢复继承值。其他模型或协议组合会被拒绝。

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
      qwen3.7-plus:
        thinkingBudgets: [4096, 6000]
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
| `protocolOverrides` | 实验性协议覆盖；目前仅支持 `deepseek-v4.1-flash: openai-responses`，省略或模型值为 `null` 时自动跟随目录 |
| `modelLimits` | 按模型覆盖 `contextWindow`、`maxTokens`，或用 `thinkingBudgets` 添加思考预算选项；空值使用默认设置 |
| `maxImages` | 单次请求历史中的图片数量上限，默认不设上限；超过时先卸载最旧图片 |
| `streamIdleTimeoutMs` | 等待下一个流事件的最长时间，默认 300000 毫秒 |
| `requestPreparationTimeoutMs` | 目录查询及每次尝试的凭据、图片准备时限，默认 60000 毫秒 |
| `requestTimeoutMs` | 一次发送的完整时限，包含目录查询、账号切换和流式输出，默认 1800000 毫秒；预先准备的调用从发送时计时 |

图片卸载会保留原始附件，并将请求中的旧图片替换为文字占位；调高上限不会自动恢复已卸载的历史图片。

图片数量超限会在读取附件前返回卸载请求；图片准备在同一插件模块内共享四个执行名额和最多 32 个等待名额，精确字节超限时停止安排剩余图片。正在发送的图片请求共享 128 MiB 的已准备原始数据与 base64 预算；这不是进程总内存上限。排队或共享预算超限会返回 `IMAGE_RESOURCE_BUSY`，可在其他请求结束后重试。数量与字节限制可能需要宿主分次卸载后重试。

首次查询目录失败会报告 `DISCOVERY_FAILED`；已有目录时保留之前确认过的模型。网关明确返回空列表才会清空目录。列表中仅部分行格式错误时，仍可使用有效模型，设置页与日志会提示被忽略的行数。高级表单的普通配置项一次提交并检查版本；凭据由独立服务保存，凭据保存失败时保留其草稿，重试只提交未成功的部分。

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

DSH debug 日志另有每次发送的调用编号，以及各次尝试的阶段耗时、HTTP 状态、上游请求编号、首次输出等待时间与错误码，包含 HTTP 200 后的流中断；图片请求还记录排队累计等待与资源占用峰值。错误文件带有相同调用编号与尝试序号，便于关联排查。这些摘要不记录提示词、Key、代理地址或原始会话编号。


## 账号操作与保存

新增或删除账号中途关闭页面、断开连接时，宿主会在后续启动或设置、凭据更新时继续恢复。未能写入 Key 的新增账号会保留在列表，可补填 Key 或删除；恢复不会覆盖期间手动选择的当前账号。

高级设置的“全部恢复默认”会清除当前层的自定义覆盖，恢复继承值；需要保存后才生效。它不删除账号或 Key，也不清除模型容量覆盖。
