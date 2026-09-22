# dsh-opencode-go

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中使用 OpenCode Go 订阅模型，支持流式回复、工具调用、图片输入。

插件自动添加 OpenCode Go 所需的会话请求头，并自动获取可用模型目录，显示套餐剩余额度。

无需任何设置，一key开始


## 安装与使用

插件 `0.1.7` 兼容 DSH `0.1.5-rc.1`、`0.1.5-rc.2`、`0.1.6-alpha.1`、`0.1.6-alpha.2` 和 `0.1.7-alpha.1`，旧版 DSH 用户无需升级宿主。

`0.1.7` 为本次源码中的待发布版本；npm 发布前可在本项目构建后安装本地包：

```sh
npm ci --legacy-peer-deps
npm pack
dsh plugin --profile web add ./dsh-opencode-go-0.1.7.tgz
```

开发依赖包含多代 DSH 的真实测试包，安装时需要 `--legacy-peer-deps`。Headless 用户将 `web` 换成 `headless`。


### Web

```sh
dsh plugin --profile web add dsh-opencode-go
```

安装后启动或重启 `dsh web`：

1. 打开 **设置 → OpenCode Go**。
2. 填入 OpenCode Go API Key 并保存。
3. 在会话的模型选择器中选择 OpenCode Go 模型。



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


## 订阅用量显示

![alt text](image.png)

## 配置

Web 用户可直接在 **设置 → OpenCode Go** 中修改配置。

## 常见问题

### 升级到 DSH 0.1.7 后的高级设置

DSH `0.1.7` 将设置改存到当前 profile 的 `cordis.patch.yml`，本插件的条目 ID 为 `opencode-go`；旧宿主继续使用 `settings.yaml` 中的 `llm-opencode-go` 分区。API Key 仍由 credentials 服务保存。

上游的一次性设置导入无法自动把第三方插件的旧分区名映射到不同的条目 ID。如果升级后高级配置恢复默认值，可从 DSH home 下的 `settings.yaml.imported`（尚未导入时为 `settings.yaml`）找到 `llm-opencode-go`，在新设置页重新保存其中的配置；也可以将这些字段合并到目标 profile 的已有条目中，保留其他配置：

```yaml
- id: opencode-go
  config:
    # 将旧 llm-opencode-go 分区中需要保留的字段放在这里
    apiKeyEnv: OPENCODE_API_KEY
    refreshMinutes: 60
```

如果使用了自定义 API Key 引用，须保留原来的 `apiKeyEnv` 值。Web 和 Headless 的配置现在各自独立。

### DSH 0.1.5 安装插件后无法启动

插件 `0.1.0`–`0.1.4` 使用了 DSH `0.1.6` 新增的图片接口，在旧版 DSH 上可能出现 `IMAGE_OFFLOAD_REQUIRED_CODE` 导出不存在的启动错误。升级插件到 `0.1.5` 或更新版本后重启即可：

```sh
dsh plugin --profile web add dsh-opencode-go@0.1.6
```

Headless 用户将 `web` 换成 `headless`。修复保留了两版宿主的图片处理方式：DSH `0.1.5` 在请求超过图片预算时将最旧图片转成占位文本，DSH `0.1.6` 继续由宿主记录并处理图片卸载。



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
