# dsh-opencode-go

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中使用 OpenCode Go 订阅模型，支持流式回复、工具调用、图片输入和 Web 设置页。

插件自动添加 OpenCode Go 所需的会话请求头，并从网关获取可用模型目录，显示套餐剩余额度。通过 DSH 插件命令安装，无需修改 DSH 源码。

无需任何设置，一key开始


## 安装与使用

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

## 升级插件

更新 Web profile 中的插件到 npm 最新版本：

```sh
dsh plugin --profile web update dsh-opencode-go --latest
```

完成后重启 `dsh web` 并刷新浏览器。Headless 用户将 `web` 换成 `headless`；如果两个 profile 都安装了插件，需要分别升级。

如果此前安装的是本地目录或 `.tgz` 文件，用以下命令切换到 npm 最新版：

```sh
dsh plugin --profile web add dsh-opencode-go@latest
```

升级插件无需卸载，也无需重新填写 API Key。模型目录会自动同步，正常新增模型不需要再次升级插件。

## 订阅用量显示

![alt text](image.png)

## 配置

Web 用户可直接在 **设置 → OpenCode Go** 中修改配置。启用开关立即生效；

## 常见问题


### 提示 `opencode-go` 路由已被占用

同一 profile 中只能有一个适配器提供 `opencode-go` 路由。如果已经通过其他插件或通用 pi-ai 配置接入 OpenCode Go，请先停用那一项配置。其他提供方可以继续使用。

### 没有出现预期的模型

先确认插件已启用且 API Key 已配置，再刷新设置页中的模型列表。插件每次读取模型列表都会请求网关 `/models`，并同步 [models.dev 的 OpenCode Go 配置](https://models.dev/api.json)。模型的协议、上下文长度、输出上限和图片能力来自在线配置，新模型无需等待本插件或 pi-ai 发布新版本。

网关和在线配置已收录、且使用 Anthropic Messages、OpenAI Chat Completions 或 OpenAI Responses 协议的新模型，在下次读取或刷新列表时即可使用。刷新会绕过已有会话的目录缓存；直接请求尚未缓存的新模型也会立即重新同步。设置页显示完整模型列表。

网关已公布 ID 但尚无有效协议/能力配置的模型会在设置页的发现结果中标注配置暂不可用，暂不进入对话模型选择器，避免一个未配置的模型阻断整个列表；直接调用时会说明原因。配置补齐后，刷新列表即可使用。仅凭模型 ID 无法可靠推断调用方式。上游新增全新协议或协议特例时，仍可能需要适配。

模型具有推理能力但没有可调节的推理档位时（如 `union-alpha`），仍可正常选择和使用，只是不显示推理强度选项。

在线配置暂时不可达时，优先复用本次运行中成功获取的配置，以 pi-ai 内置配置作为备用。网关目录不可达时，已有请求可以使用上次目录；设置页刷新会显示失败，避免把旧目录误认为最新结果。`refreshMinutes` 只控制已有模型请求的缓存时长，不阻止主动读取列表获取新模型。

## 功能说明

- **会话请求头**：每次请求包含 Harness User-Agent 和 `x-opencode-session`。同一会话保持相同 ID，无会话 ID 的请求使用独立随机值。
- **流式与历史**：支持流式输出、工具调用及历史回放，协议请求由 pi-ai 执行。
- **图片输入**：支持目录中声明图片能力的模型，需要 DSH attachment 服务。
- **提示与缓存**：插件不增加隐藏系统提示；会话 ID 用于网关路由；

## 卸载

从对应 profile 移除插件，再重启应用：

```sh
dsh plugin --profile web remove dsh-opencode-go
# 或
dsh plugin --profile headless remove dsh-opencode-go
```



## 反馈

遇到bug或有功能建议请提issue

## 许可证

[MIT](LICENSE)
