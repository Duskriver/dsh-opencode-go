# 与 DeepSeek Harness v0.2.0-rc.2 原生调用的对照

研究日期：2026-09-30。插件：当前工作区 `dsh-opencode-go@0.1.17`，基线提交 `03c482369f400ae786a251a5df265309e5341bb1`。原生：固定 tag `dsh-v0.2.0-rc.2`，提交 `639ed015397290b3745d163aafe02ffee4aa3f84`。上游源码只读检出在系统临时目录；没有读取真实 API key，也没有发出收费推理请求。版本出处：[官方 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)、[插件 package.json](../package.json)。

后续修复（2026-09-30）：当前工作区已修复下文基线中的配置/credential 引用漂移与 Anthropic alias 回放缺陷，并重建 `lib/`。请求在目录等待前复制配置，准备与发送使用同一份模型/目录/密钥引用；回放以请求模型 ID 匹配签名，返回别名仅作为说明信息保留。371 项测试、32 个产物检查、九个宿主版本兼容检查及原始请求对照均通过，见[修复验证](verification.md#prepared-call-configuration-and-anthropic-alias-replay-2026-09-30)。下文保留修复前的对照证据；默认思考和输出上限等策略差异仍适用。

## 结论

插件与 rc.2 的原生 OpenCode Go 使用同一版 pi-ai 0.87.1，常规文本、工具、流式与用量转换大体一致，但不是完全等价的调用。原生现在也会自动添加会话路由 header；这已不再是插件独有能力。插件的主要额外价值是在线模型目录、独立设置与额度界面，以及针对部分模型自动启用思考的默认策略。

本地 HTTP mock 已复现两个应优先修复的问题：**插件没有完整冻结一次调用的配置，准备后改 endpoint 会从 A 改发 B，目录刷新期间改 endpoint 与 key 引用还会组合旧 endpoint A 和新 fixture key B；Anthropic 响应 model 与请求 alias 不同时，原生下一轮保留 thinking 签名，插件把 thinking 降为普通文本并丢失签名。** 另有两项明确策略差异：未选思考档位时插件为部分模型默认启用 high；配置输出上限 128、显式请求 512 时，原生发送 512，插件发送 128。统一 effort、maxTokens 与 temperature 后，DeepSeek V4 Flash、Qwen3.6-plus、GLM5.3 的完整请求 JSON、会话 header、User-Agent 均一致。详见后文证据。

这里有两种“原生”：

| 对照对象 | 调用路径 | 是否与插件使用同一网关 |
| --- | --- | --- |
| 原生 OpenCode Go | `@deepseek-ai/dsh-llm-pi-ai` → pi-ai `opencode-go` provider → OpenCode Go | 是；这是主要对照对象 |
| 原生 DeepSeek 官方直连 | `@deepseek-ai/dsh-llm-deepseek-api-key` / account → `dsh-llm-deepseek` → DeepSeek Messages API | 否；协议、认证和能力均有差异 |

原生 pi-ai 会复用安装包内置 provider，插件则构建私有的 `opencode-go` SDK provider，并以 `dsh-opencode-go` 注册到 DSH。官方直连默认端点为 `https://api.deepseek.com/anthropic`。来源：[原生 provider 构建](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/provider.ts#L144-L172)、[插件 provider 构建](../src/catalog.ts#L125)、[插件身份](../src/provider-identity.ts)、[官方直连配置](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/config.ts#L106)。

## 原生 OpenCode Go 与插件

### 请求协议、会话 header 与认证

| 项目 | 插件 | rc.2 原生 OpenCode Go | 影响 |
| --- | --- | --- | --- |
| SDK | 私有 npm alias `opencode-go-pi-ai` → pi-ai 0.87.1 | `@earendil-works/pi-ai` 0.87.1 | 同版基线；原生源码构建另有流式性能补丁，见后文 |
| DSH provider ID | `dsh-opencode-go` | `opencode-go` | 可以共存，DSH 持久历史来源名称不同 |
| 带 sessionId | 显式发 `x-opencode-session: sessionId` | 内置 `withOpenCodeSessionHeader` 自动补同一值 | 常规 DSH 会话一致 |
| 无 sessionId | 每个请求生成随机 UUID header | 不自动补 header | 插件为无会话调用提供隔离的路由值 |
| User-Agent | `attributionHeaders()` | `attributionHeaders()`，覆盖 profile 中同名 header | 都归因到当前 Harness |
| API key | 每次通过 DSH credentials / launch environment 解析 `OPENCODE_API_KEY` 引用 | 可通过 profile 显式引用，也可使用 pi-ai 原生认证、存储与登录机制 | OpenCode Go 都能用同一环境引用；原生通用 adapter 认证范围更广 |
| 自定义 HTTP header | 没有对应配置项 | profile `headers` | 原生部署可配置附加 header |

来源：[插件依赖](../package.json)、[原生依赖](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/package.json)、[插件请求选项](../src/adapter.ts#L317)、[插件 credential resolver](../src/index.ts#L92)、[原生 header 合并](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/adapter.ts#L204-L211)、[原生 auth](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/auth.ts)。SDK 原始代码：[本地 pi-ai 0.87.1 provider](../node_modules/opencode-go-pi-ai/dist/providers/opencode-go.js)、[会话 header wrapper](../node_modules/opencode-go-pi-ai/dist/providers/opencode-headers.js)。

插件 [src/index.ts](../src/index.ts#L7) 仍称 generic pi-ai 不能表达该路由 header，这段说明对 rc.2 的内置 `opencode-go` 已过时。只有手工定义通用协议 provider、没有复用内置 OpenCode provider 时，不能直接套用上述自动 header 结论。

### 模型目录与思考默认值

原生使用 pi-ai 随安装包发布的模型目录；显式 `models` 替换目录，`modelOverrides` 修正单个条目。原生对已知 provider 的“发现模型”直接返回内置目录，不查询网关。插件则以网关 `${baseURL}/models` 决定可用 ID，以 `https://models.dev/api.json` 的 `opencode-go` 条目决定名称、协议、容量、模态和价格；内置目录作为兼容提示，已知历史数据用于故障时保留。插件还有磁盘元数据缓存、ETag、刷新与可见性开关。首次网关 listing 失败且没有已服务快照时，不会仅靠内置目录猜测可用模型。来源：[原生配置](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/config.ts#L105-L127)、[原生 discovery](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/discovery.ts#L269-L285)、[插件目录](../src/catalog.ts#L162)、[插件 membership 与故障策略](../src/catalog.ts#L263)、[插件元数据转换](../src/model-metadata.ts#L73)。

插件接受线上目录中的新 ID，前提是能解析为三种支持协议之一，且容量、模态、思考声明可用；缺少元数据的模型会显示诊断，不进入可选模型列表。这也意味着同一 pi-ai 版本并不保证同一模型描述：线上更新可以让插件与原生在容量、协议或思考选项上发生差别。插件只读取 `opencode-go` 元数据，忽略在线端点、header 与 credential，实际模型流量仍使用配置的网关。来源：[插件目录构建](../src/catalog.ts#L285)、[metadata 读取规则](../src/model-metadata.ts#L68)、[picker 过滤](../src/adapter.ts#L166)。

默认思考是明确的策略差异。原生只在 profile 指定 `reasoning` 时给模型提供 `defaultEffort`；插件遇到 `deepseek`、`zai`、`qwen`、`qwen-chat-template` 这类未指定 effort 会显式关闭思考的格式，会提供 `high`，或模型支持的最高非 off 档。DSH 正常调用会把该默认值补入请求。本地 mock 确认：DeepSeek V4 Flash 原生发 `thinking: disabled`，插件发 `thinking: enabled` 与 high；Qwen3.6-plus 在 fixture 声明 toggle 时原生发 `enable_thinking: false`，插件发 true 与 high；GLM5.3 两边都未默认指定 effort。该结果验证默认策略，不能视为真实服务推理质量对比。若直接调用 adapter.stream 而绕过 DSH 的默认值补齐，两边默认行为还会有所不同。来源：[插件默认 effort](../src/adapter.ts#L198)、[原生 reasoningInfo](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/adapter.ts#L187-L201)、[DSH 默认值补齐](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm/src/index.ts#L892-L924)、[pi-ai thinking 序列化](../node_modules/opencode-go-pi-ai/dist/api/openai-completions.js#L619)、本文验证表。

### 输出 cap 与调用配置冻结

原生将显式配置的 model `maxTokens` 暴露为 `defaultMaxTokens`：只有请求没有 cap 时 DSH 才补默认值，调用方显式值优先。插件不暴露 `defaultMaxTokens`，而在发送时对 modelLimits 的 `maxTokens` 做 `Math.min(requested, configured)`，因此它是强制上限。本地 mock 设配置 128、请求 512，原生实际发送 512，插件实际发送 128；原生模型信息返回 defaultMaxTokens=128，插件没有该字段。这属于可见语义差异，且 DSH 准备的调用配置可能没有反映插件最终上限。两边都不会仅因为内置目录有 `maxTokens` 就在 adapter 层自动填入整个容量；SDK 在无显式 cap 时仍可能自行采用模型容量。本次默认请求中原生与插件的容量数值来自不同 fixture 目录，不能用那组数值认定额外缺陷。来源：[原生 modelInfo](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/adapter.ts#L300-L315)、[DSH defaultMaxTokens](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm/src/index.ts#L896-L898)、[插件 cap](../src/adapter.ts#L266)、[插件 modelInfo](../src/adapter.ts#L223)、本文验证表。

rc.2 原生 `PiAiAdapter.prepareCall` 绑定不可变 profile/models 快照；`DeepSeekAdapter.prepareCall` 也绑定 connection。插件继承 base `LlmAdapter.prepareCall`，仅先 resolveModel，随后调用普通 stream 再读配置。本地 mock 已验证：在 endpoint A prepareCall 后将配置改到 B，原生发送到 A，插件发送到 B。这违背 rc.2 动态 adapter 应把能力解析与发送绑定同一配置代的要求；普通 stream 入口开始后捕获一次 config，不能覆盖准备到发送的时间段。来源：[rc.2 base prepareCall 要求](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm/src/index.ts#L269-L282)、[原生 pi-ai prepareCall](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/adapter.ts#L318-L347)、[原生 DeepSeek prepareCall](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/adapter.ts#L43-L48)、[插件 stream](../src/adapter.ts#L247)、本文验证表。

另一个独立窗口是 credential 引用。插件 capture config 后先 await catalog，再调用零参数 resolveApiKey；该 resolver 重新读取 `current().apiKeyEnv`。本地 mock 使用真实 plugin.apply、live config 和两个固定假 key：阻塞 models.dev 元数据请求，期间将 endpoint A→B、key 引用 A→B，再释放目录请求，实际捕获到 **endpoint A 与 fixture key B**。这证明旧 endpoint 与新 credential 引用会组合，修复应把 credential 引用也绑定到同一次调用配置。原生 pi-ai 将已捕获的 profile 传给 credential resolver，官方直连将 connection 传给 resolveAuth。没有读取或使用真实 credential。来源：[插件等待与 credential](../src/adapter.ts#L251)、[插件 resolver](../src/index.ts#L92)、[原生 resolver](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/index.ts#L187-L205)、本文验证表。

### 历史、回放与流式

插件 context 基于原生 pi-ai 转换：相同的单一 systemPrompt 分离、assistant text/reasoning/tool-call、工具名恢复与图像引用转换。插件保留旧 DSH user 内嵌 `tool-result` 的兼容处理；rc.2 原生使用独立 `tool` role。两边都拒绝 developer 历史、tool-addition/tool-removal、deferred tool loading、assistant/system 图片以及 `GenerateOptions.stop`。来源：[插件 context](../src/conversion/context.ts#L51)、[旧 tool result 兼容](../src/conversion/context.ts#L232)、[原生 context](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/context.ts#L49-L64)、[原生 tools](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/context.ts#L129-L141)、[原生 stop](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/adapter.ts#L334-L336)。

两边都用 `kind: pi-ai, version: 2` 回放，保存原生 responseId、thinking/text/tool 签名、providerThinkingLevel；不再可用的回放元数据会降级为 provider-neutral 内容并告警。插件额外保存 `sdkProvider`：持久来源为 `dsh-opencode-go`，SDK 同模型判断时恢复 `opencode-go`，解决私有 DSH 路由与 SDK provider 的身份差别。来源：[插件 replay](../src/conversion/replay.ts#L82)、[插件恢复](../src/conversion/replay.ts#L196)、[原生 replay](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/replay.ts#L79)。

**Anthropic model 别名导致思考签名回放丢失，已用 mock 复现。** 插件将 Anthropic 响应的 native `message.model` 存为 responseModel，回放时以 responseModel 恢复 assistant.model；原生始终以请求 model 恢复。pi-ai `transformMessages` 的同模型判断要求 provider、api 与 model.id 三者相同，跨模型时会将普通 thinking 转 text、去掉签名。本地 mock 请求 minimax-m3、响应 minimax-m3-returned-alias，将回放 envelope 经 JSON 往返后续聊同一请求 ID：原生发送 thinking 与 fixture-signature，插件发送包含相同思考文本的普通 text，签名消失。该验证证明明确条件下的回放缺陷，未证明真实 OpenCode 网关当前是否返回不同 alias。来源：[插件 responseModel 与恢复](../src/conversion/replay.ts#L82)、[插件恢复 model](../src/conversion/replay.ts#L231)、[原生恢复 model](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/replay.ts#L218-L226)、[SDK 同模型判断](../node_modules/opencode-go-pi-ai/dist/api/transform-messages.js#L65)、本文验证表。

流式与用量映射的代码对照显示：除传入 requestedProvider 的回放差别，两边相同地发 text/reasoning/tool 参数增量、block-end、usage、finish；相同地处理空输出、上下文超限、401/403、quota/rate-limit、413、服务器错误、超时、截断和 abort。插件与原生都按 pi-ai 原值映射 input/output/total/cacheRead/cacheWrite，reasoning token 由 pi-ai 计入 output；不能把 cacheRead 字段等同于一定命中网关缓存。来源：[插件 stream](../src/conversion/stream.ts)、[原生 stream](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/stream.ts)。

同版 SDK 仍有构建差异：上游源码维护 pi-ai 0.87.1 patch，删除工具参数每个 delta 对累计 JSON 的重复解析，保留完成时处理；插件私有 npm alias 不带该 patch。源码/应用构建采用此补丁时，长工具参数流式有额外性能优化；本次 npm 临时 host 不能自动代表补丁已应用，也没有进行性能基准测试。该项不能定性为正确性差异。来源：[上游 pi-ai patch](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/patches/%40earendil-works__pi-ai%400.87.1.patch)、[插件依赖](../package.json)。

### 图片、超时、重试与额度

两边均只允许模型声明 image modality 且挂载 durable attachment service 时发送图片，以 base64 内联，每张默认 2048×2048 像素预算、1 MiB 原始编码目标，整个请求 20 MiB base64 上限。在 rc.2 上，超预算都会发 `IMAGE_OFFLOAD_REQUIRED`，由宿主记录卸载后重试，已卸载图片转文字占位。插件额外可配置 `maxImages`，并保留 0.1.5 旧宿主临时投影逻辑；这不是 rc.2 原生图像方案缺失。来源：[插件预算](../src/conversion/config.ts)、[插件 offload bridge](../src/conversion/image-offload.ts)、[原生预算](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/config.ts#L46-L62)、[原生图像处理](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/context.ts#L294-L338)。

两边 stream idle timeout 默认均为 300,000 ms，并把 SDK `maxRetries` 设为 0，由 Harness agent recovery 拥有可见重试。原生额外配置 `timeoutMs`、`websocketConnectTimeoutMs`、`transport`、`cacheRetention`、`thinkingBudgets` 和 provider `retryPolicy`；插件只暴露 streamIdleTimeoutMs 等专用选项，没有覆写 providerRetryPolicy，使用 DSH base 的正常默认策略。因此 SDK retry=0 不意味着整个 agent 不重试。来源：[原生配置选项](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/config.ts#L153-L182)、[原生 stream options](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-pi-ai/src/adapter.ts#L114-L131)、[插件选项](../src/adapter.ts#L317)、[base retryPolicy](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm/src/index.ts#L218-L224)。

插件额度服务另外读取 `${baseURL}/usage`，在 Host 发送 Bearer key，展示账户额度；这是账户统计，与每次推理的 token usage 分开。原生 llm-pi-ai 没有这个专用 GoUsageService。来源：[插件 usage](../src/usage.ts#L24)、[usage UI](../src/client/UsagePill.tsx)。

## 与 DeepSeek 官方直连的补充对照

rc.2 `dsh-llm-deepseek` 是独立 Messages transport，API key 官方路由由 `dsh-llm-deepseek-api-key` 挂载为 `deepseek-official`，使用 `x-api-key`；另外有 account 认证入口。它直接 fetch `/messages`，发送 `anthropic-version`、匿名 Harness user ID、Harness session ID 与 compaction header，支持官方 API extensions。插件通过 OpenCode Go 调用 DeepSeek 模型时走 OpenAI Completions 兼容协议，因此请求并不相同。来源：[官方 route 与 auth](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek-api-key/src/index.ts#L15-L41)、[Messages fetch](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/adapter.ts#L103-L147)。

| 能力 | 插件 / 原生 pi-ai | 官方 Messages 直连 |
| --- | --- | --- |
| 思考默认 | 插件针对指定格式补 high；原生由 profile 控制 | 默认 high，支持 off / low / high / max；session-title 强制 off |
| 默认输出 cap | 取决于显式配置，不自动使用全目录容量 | 连接默认 256,000，模型项和显式请求值优先；对 DSH 暴露 defaultMaxTokens |
| 中途 system/developer 更新 | context 转换拒绝 developer / tool-change | 按模型声明处理 system in-history 与 developer 更新 |
| 延迟工具加载与增删 | 拒绝 deferred loading | 序列化 defer_loading、tool_addition、tool_removal |
| stop | adapter 拒绝 | 序列化 stop_sequences |
| 图片上传与复用 | base64 内联 | 优先 Files API，保存/复用 file_id；文件解析失败可退回 base64 |
| 图像 token 估算 | 未声明 provider 专用 pricing | DeepSeek token-grid pricing 与模型像素策略 |
| 原生回放 | pi-ai v2，多 provider 格式 | deepseek-messages v1，thinking signature |

来源：[官方 serialize](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/serialize.ts#L56-L167)、[官方 modelInfo](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/model-info.ts#L61-L99)、[官方图片](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/images.ts#L38-L110)、[file fallback](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/adapter.ts#L84-L105)、[官方 image pricing](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/request-pricing.ts)、[官方 replay](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/replay.ts#L29-L64)。

官方 Messages 流式解析独立校验块、JSON 与 SSE 结束事件；其 totalTokens 在 translator 中按输入、输出、cache read/write 相加。插件/原生 pi-ai 使用 SDK 提供的 usage.totalTokens。不同协议可能把 cache 字段包含在哪个输入字段中的语义不同，不能直接凭字段名推断账单差异；需要同一服务实际 usage 证据。来源：[官方 translator](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/llm/llm-deepseek/src/translate.ts#L143-L165)、[插件 mapUsage](../src/conversion/stream.ts#L24)。

## 验证与建议

已完成固定 tag 源码和本地 npm 0.87.1 实现的只读对照。`npm run test:compat -- v020-rc2` 全部通过，`npm run check:dist` 32 个产物通过；另在临时目录安装真实 rc.2 npm 包与插件 tarball，启动两个 loopback HTTP mock，以假 key 和固定 SSE 响应运行对照，实际捕获 URL、body、会话 header 与 User-Agent。模型目录和 models.dev 响应由 fixture 提供，probe 阻止其他网络推理请求。所有断言通过，结果如下。

| 验证场景 | 原生结果 | 插件结果 |
| --- | --- | --- |
| DeepSeek V4 Flash 不选 effort | thinking disabled | thinking enabled / high |
| Qwen3.6-plus，fixture 声明 toggle | enable_thinking=false | enable_thinking=true / high |
| GLM5.3 不选 effort | 无默认 effort | 无默认 effort |
| 上述三模型统一显式 effort / maxTokens=512 / temperature=0.2 | 完整 body、session header、User-Agent | 与原生 deepEqual |
| 指定 comparison-session | x-opencode-session 同值、Harness User-Agent | 两项完全一致 |
| 不指定 sessionId | 无会话 header | 随机 UUID 会话 header |
| 配置 cap=128，请求 cap=512 | 模型 defaultMaxTokens=128，实际 512 | 无 defaultMaxTokens，实际 128 |
| prepareCall 后 A→B | 实际请求 A | 实际请求 B |
| 插件目录请求期间改 endpoint/key 引用 | 原生源码绑定已捕获 profile | 实际组合旧 endpoint A 与 fixture key B |
| Anthropic model alias，经 JSON 往返后续聊 | thinking 与签名保留 | thinking 变 text，签名丢失 |

临时验证证据：[results.json](/tmp/dsh-native-call-probe.b3lfUG/results.json)、[probe.mjs](/tmp/dsh-native-call-probe.b3lfUG/probe.mjs)。这些是本次运行的临时诊断材料，没有加入永久测试；临时目录清理后链接可能失效。没有真实网关推理质量、缓存命中率、延迟或计费对比结果。

验证准备过程中，首轮临时 probe 未设置隔离的 DSH_HOME，曾将默认公共 models.dev 元数据缓存写为仅含 4 个模型的 fixture。随后脚本改为按 PID 隔离临时目录，并从官方 `https://models.dev/api.json` 成功恢复公共缓存，校验源 URL、33 个 OpenCode Go 模型、ETag 存在与正确缓存格式。用户配置和凭据未修改。

建议优先修复调用配置及 credential 引用冻结与 Anthropic alias replay；随后决定 modelLimits.maxTokens 是强制 cap 还是默认值，并确保 DSH 记录与实际发送一致。文档应更新原生 OpenCode Go 已支持 x-opencode-session 的事实。是否继续使用插件主要取决于是否需要动态目录和额度/专用设置；仅为添加会话 header，rc.2 已无需单独插件。
