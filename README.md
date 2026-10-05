# dsh-opencode-go

[English](README.en.md)

功能：让你在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 中完美使用 OpenCode Go 订阅模型，支持流式回复、工具调用和图片输入。

插件会自动添加 OpenCode Go 所需的会话请求头、读取网关模型目录，并显示订阅用量，无需给模型配置协议、模态、上下文长度、最大输出token

## 功能说明

- **会话请求头**：每次请求包含 Harness User-Agent 和 `x-opencode-session`。同一会话保持稳定 ID，支持网关路由和提示词缓存优化；实际命中率取决于上游服务。
- **流式与历史**：支持流式输出、工具调用及历史回放，协议请求由 pi-ai 执行。
- **图片输入**：支持目录中声明图片能力的模型。
- **模型容量覆盖**：可按模型覆盖上下文窗口和最大输出，空值继承在线目录。
- **逐模型开关**：每个模型独立控制会话中的显示状态，修改立即生效；普通模型默认开启，过时模型默认关闭，也可单独开启。
- **提示与缓存**：插件不增加隐藏系统提示；会话 ID 用于网关路由。

## 安装与使用

支持 DSH `0.1.5-rc.1` 及以上版本，包括 alpha、rc 和正式版，并持续跟随宿主版本更新维护兼容性。

已验证版本：`0.1.5-rc.1`、`0.1.5-rc.2`、`0.1.6-alpha.1`、`0.1.6-alpha.2`、`0.1.7-alpha.1`、`0.1.7-alpha.2`、`0.1.7-rc.1`、`0.1.7-rc.2` 和 `0.2.0-rc.2`。

### 在 DSH 中安装（推荐）

1. 打开 DSH 的 **插件** 页面，点击右上角 **添加插件**。
2. 输入 `dsh-opencode-go`，点击 **安装**。
3. 安装成功后，如果出现 **立即启用**，点击即可。

![在 DSH 插件页添加、安装并启用 dsh-opencode-go](docs/assets/install-via-dsh.gif)

然后打开 **设置 → OpenCode Go**，填入 API Key 并保存，或在「账号」中添加账号，即可在会话中选择 OpenCode Go 模型。

也支持在添加插件时直接输入 Git 仓库地址：

```text
https://github.com/Duskriver/dsh-opencode-go
```

当前主分支附带编译好的插件，安装时无需本地构建，也无需为本插件修改 `allowBuilds`。固定到旧提交的 Git 地址仍沿用旧提交的安装方式，请更新到当前主分支。

若当前 DSH 没有「添加插件」入口，可使用下面的命令行方式。

### 命令行安装（备选）

```sh
dsh plugin --profile web add dsh-opencode-go
```

安装后启动或重启 `dsh web`，然后：

1. 打开 **设置 → OpenCode Go**。
2. 填入 OpenCode Go API Key 并保存。
3. 在会话的模型选择器中选择 OpenCode Go 模型。

### 无头模式

安装到 Headless profile：

```sh
dsh plugin --profile headless add dsh-opencode-go
```

将以下内容保存为 `headless.patch.yml`，选择默认模型：

```yaml
- id: agent-default-model
  config:
    provider: dsh-opencode-go
    model: deepseek-v4.1-flash
```

在 Bash 或 Zsh 中读取 API Key，然后运行任务：

```sh
read -s OPENCODE_API_KEY
export OPENCODE_API_KEY
dsh --profile headless --patch ./headless.patch.yml "你好"
```

模型 ID 须在当前网关目录中可用。Web 和 Headless 使用各自的 profile，需要分别安装插件。

如需从源码构建并安装本地包：

```sh
npm ci
npm run compile
npm pack
dsh plugin --profile web add ./dsh-opencode-go-0.1.20.tgz
```

源码开发时显式运行 `npm run compile`；普通用户直接安装预编译产物，无需 `--legacy-peer-deps`。多版本 DSH 兼容性测试使用独立环境，不参与普通安装或构建。Headless 用户将 `web` 换成 `headless`。

### 开发与验证

```sh
npm run compile       # 更新 lib/，与源码一起提交
npm test              # 基础功能测试（自动重新构建）
npm run check:dist    # 检查已提交产物是否与源码一致
npm run test:compat   # 同一安装包在 9 套独立 DSH 环境中测试
npm run test:install  # npm / pnpm 无额外构建授权的 Git 安装检查
npm run verify        # 执行以上全部检查
```

兼容性与安装检查会下载依赖，使用系统临时目录并在结束后清理。只检查一个宿主可运行 `npm run test:compat -- v017-rc2`。维护测试版本的方式见[开发与测试说明](docs/development.md)。

## 升级插件

更新 Web profile 中的插件到 npm 最新版本：

```sh
dsh plugin --profile web update dsh-opencode-go --latest
```

完成后重启 `dsh web` 并刷新浏览器。Headless 用户将 `web` 换成 `headless`；如果两个 profile 都安装了插件，需要分别升级。

桌面版升级后，请完全退出并重新打开 DeepSeek Harness，以加载更新后的插件代码。



Headless 或手动配置可在插件的 `config` 中填写：

```yaml
apiKeyEnv: OPENCODE_API_KEY
accounts:
  - id: primary
    name: 主账号
    apiKeyEnv: OPENCODE_API_KEY
  - id: backup
    name: 备用账号
    apiKeyEnv: OPENCODE_GO_BACKUP_KEY
autoSwitch: false
```

分别通过凭据服务或环境变量提供两个引用的 Key。`apiKeyEnv` 指向首选账号；省略 `accounts` 保留旧版单 Key 行为，`accounts: []` 表示已移除全部账号。

「账号」卡片默认可收起：折叠时显示账号数量、首选账号、可用数量与统一的刷新时间（当天只显示时刻，悬停给出完整日期时间）。展开后每个账号占一行，行内显示 Key 状态、加粗的 5 小时额度条（12px 通栏，25%/50%/75% 刻度，≥80% 转琥珀、满额转红）与重置倒计时；各列位置固定（手柄 / 名称 / Key 状态 / 额度条 / 百分比 / 重置倒计时 / 详情箭头），账号名过长时省略并悬停显示全名，因此不同长度的账号名不会挪动后面的列；点开行尾箭头可查看周/月额度，以及重命名、替换 Key、删除操作。按住行首手柄上下拖动（或聚焦手柄后按 ↑ / ↓）即可调整顺序，**从上到下依次尝试**：第一行即首选账号，松手后它同时成为新的首选；自动回退开启时按同一顺序尝试其他账号。

## 订阅用量显示

在「设置 → OpenCode Go → 高级设置 → 额度显示」中选择并保存：**自动（默认）**仅在选中本插件的 DSH OpenCode Go 模型时显示；**常驻**在使用其他模型（包括宿主自带的 `opencode-go`）时也显示；**关闭**隐藏胶囊并停止轮询。停用 OpenCode Go 后所有模式均隐藏。显示时点击胶囊展开用量面板：首行是当前使用的账号（状态点 + 名称 + 首选标签 + 「切换」），点「切换」后卡片内容变为账号列表（当前账号带勾，↑ / ↓ 或点击选择，Esc 返回额度视图）；这里切换的是"现在用哪个账号的额度"，额度消耗顺序仍由设置页那列顺序决定。三个窗口各占一行（名称、进度条、百分比），重置时间在下方，刷新时间在卡片底部。

用量每分钟刷新。临时网络或服务错误会保留同一账号的上次数据，并标明刷新失败、更新时间和错误原因；可在用量弹层中立即重试。首次获取失败或鉴权失败时不显示旧额度。模型目录、模型配置和用量的 JSON 请求遇到短暂连接重置时会在原有超时范围内额外重试一次；这不能保证故障中的网络恢复可用。

![OpenCode Go usage display](image.png)

## 界面语言

插件跟随 Harness 的界面语言，提供中文和英文文案，不另存一套语言设置。未手动指定语言时，Web 版按浏览器语言列表匹配中英文（浏览器通常跟随系统）；支持系统语言桥接的桌面版由宿主提供系统语言。没有匹配的语言时使用英文。

在 Harness 中手动选择的语言优先，切换后插件即时更新，保留未保存的表单内容。模型名称和 ID 保留原名；用量日期和容量数字按当前界面语言格式化。自动语言在启动时识别：Web 版更改浏览器语言后需刷新页面，桌面版更改系统语言后需重启 Harness。

## 模型开关

在 **设置 → OpenCode Go** 中，每个模型右侧的开关决定它是否出现在会话模型选择器中。开关立即保存，无需再点“保存”；容量和 API Key 的修改仍需保存。普通模型默认开启，过时模型默认关闭。你可以单独开启任意过时模型，也可以关闭普通模型。新出现且未单独配置的模型同样按此规则处理。

手动配置时，在插件的 `config` 下添加 `modelVisibility`，使用真实模型 ID 替换示例中的占位符：

```yaml
modelVisibility:
  your-model-id: false
  your-deprecated-model-id: true
```

只有列出的 ID 被显式覆盖。开关只影响模型选择器；已有会话仍可调用网关提供的隐藏模型，设置页也保留完整模型列表。

旧配置中的 `showDeprecatedModels` 和 `visibleModelIds` 不再控制显示状态。请使用逐模型开关或 `modelVisibility`；旧字段可以保留，不会妨碍插件加载。

## 图片数量上限

在「设置 → OpenCode Go → 高级设置」中可以设置 `maxImages`，填写正整数后保存即可生效，无需重启。默认不设置，不限制图片张数；清空或重置会移除用户覆盖，重新继承基础配置（基础配置也未设置时没有张数上限）。

数量按单次请求携带的完整历史统计，包括工具输出里的图片；同一附件出现多次也分别计数。例如设置为 `30` 时，30 张正常发送，31 张会先卸载最旧的 1 张，再继续请求。卸载将图片内容替换为文字占位，原始附件仍保留，但模型在该次请求中看不到被卸载图片的内容。

DSH 0.1.5 的卸载只影响本次请求；DSH 0.1.6 及以上版本通过宿主的图片卸载机制记录卸载状态并重试，调高或清空上限不会自动恢复已卸载的历史图片。现有图片载荷、像素和单图字节预算仍独立生效，可能需要卸载更多图片。`maxImages` 是可选的兼容设置，不会改变上游服务自身的限制。

## 常见问题

### 与宿主的 OpenCode Go 共存及升级迁移

从 0.1.17 起使用独立的 `dsh-opencode-go` provider，模型选择器中显示为 **DSH OpenCode Go**；宿主 pi-ai 的 `opencode-go` 可以同时使用。请在插件设置页配置 API Key，然后选择 **DSH OpenCode Go** 下的模型。0.1.16 及以前版本使用 `opencode-go`，这些版本的 headless 配置也应使用旧标识。

升级前保存为 `provider: opencode-go` 的会话、Agent 预设和 headless 默认模型，需要重新选择 **DSH OpenCode Go**，或将 provider 改为 `dsh-opencode-go`。API Key、模型设置和元数据缓存继续沿用。旧会话内容保留；跨 provider 切换时，DSH 会按其规则去除旧适配器的专用回放元数据。

### 没有出现预期的模型

先在 **设置 → OpenCode Go** 检查该模型的开关是否开启。过时模型默认关闭，单独打开它的开关后即可出现在会话模型选择器中，无需开启其他全局选项。

先确认插件已启用且 API Key 已配置，再刷新设置页中的模型列表。设置页读取或刷新列表时会请求网关 `/models`，并同步 [models.dev 的 OpenCode Go 配置](https://models.dev/api.json)。会话模型选择器遵守目录缓存时长，切换模型开关不会强制重新请求网关。模型的协议、上下文长度、输出上限和图片能力来自在线配置，新模型无需等待本插件或 pi-ai 发布新版本。

网关和在线配置已收录、且使用 Anthropic Messages、OpenAI Chat Completions 或 OpenAI Responses 协议的新模型，在下次设置页刷新或目录缓存到期后即可被发现。设置页刷新会绕过已有缓存，并通知已打开的会话模型选择器使用同一份新目录；直接请求尚未缓存的新模型也会立即重新同步。设置页显示完整模型列表。

网关已公布 ID 但尚无有效协议/能力配置的模型会在设置页标注“配置缺失”，开关保持关闭且不可操作，不进入对话模型选择器，避免一个未配置的模型阻断整个列表；直接调用时会说明原因。配置补齐后，刷新列表即可使用。仅凭模型 ID 无法可靠推断调用方式。上游新增全新协议或协议特例时，仍可能需要适配。

如果在线配置获取失败，没有可用缓存或内置配置的模型会标注“配置暂不可用”，页面会显示配置源错误。请检查运行 DSH 的设备能否访问 `https://models.dev/api.json`，并查看具体错误后刷新重试。已有模型列表在重试期间保留上次的失败提示，成功后自动清除；已配置的模型继续可用。

模型具有推理能力但没有可调节的推理档位时（如 `union-alpha`），仍可正常选择和使用，只是不显示推理强度选项。

MiMo V2.6 Flash 的网关目录尚未列出可调节档位，插件按 OpenCode Go 实测提供 **Off / Low / Medium / High**：默认不发送 `reasoning_effort`，保留网关默认思考；Off 发送 `none`，其余发送对应值。仅对这个已验证的型号和协议补充映射，不扩展到其他 MiMo 型号。Low / Medium / High 已验证可正常请求并返回思考内容，但不保证实际思考量随档位递增。

在线目录中的 effort 列表决定可选强度。仅有 toggle 或 budget 声明时，插件只对已有原生开关或预算协议提供相应控件，不为普通 OpenAI 兼容协议猜测 `off` 或 `high` 参数。明确的空控制列表不会因为模型具有推理能力就自动增加 Off。

提供可调节档位的模型，如果其传输协议在未选择档位时会显式关闭思考（`deepseek`、`zai`、`qwen`、`qwen-chat-template`），还会声明一个默认档位（模型支持 `high` 时用 `high`，否则用它提供的最高档位）。用户未选择档位时 DSH 使用该默认值，因此留空也会带上推理档位，而不是关闭思考。由服务商自行决定的协议不声明默认值，行为不变；显式选择的档位始终优先。

在线配置暂时不可达时，优先复用之前成功获取的配置（包括重启前的磁盘缓存），以 pi-ai 内置配置作为备用。网关目录刷新失败时，已有请求和设置页均保留本次运行中上次成功获取的列表。任一来源刷新失败，设置页都会显示警告、失败原因，以及模型名单和模型配置各自上次成功检查的时间。首次读取网关失败时，不会仅凭元数据缓存生成模型列表。

模型配置自动保存到 `$DSH_HOME/cache/dsh-opencode-go/models.dev.api.json`，未设置 `DSH_HOME` 时位于 `~/.dsh/cache/dsh-opencode-go/models.dev.api.json`。缓存仅包含公共元数据、ETag 和上次成功检查时间，不包含 API Key 或网关模型名单。重启后的普通读取先确认网关名单，再使用磁盘中的配置，同时后台校验元数据；后台完成后同步模型选择器。缓存损坏时重新联网获取，无法写入时仍可使用在线结果。设置页刷新始终等待在线校验，失败会保留旧配置并显示原因，不会把缓存命中标记为在线刷新成功。需要清除磁盘缓存时，可退出 DSH 后删除该文件。

`refreshMinutes` 控制成功刷新后的目录缓存时长。刷新失败后，下一次读取会按 5、10、20、40、60 秒的退避间隔尝试恢复，最长等待间隔为 60 秒；没有读取时不会后台轮询。设置页主动刷新和未知模型的即时发现不受这个间隔限制。取消模型解析或生成时，会立即结束当前调用的目录等待，其他调用仍可继续使用同一次共享刷新。

已验证的模型配置在缓存到期后的 5 分钟内可直接用于生成，同时触发一次共享后台刷新。这个窗口按两种来源各自上次成功检查的时间计算，失败重试不会延长它；超过窗口后，请求等待下一次到期刷新，刷新仍失败时保留已有回退行为。没有磁盘缓存的首次加载、未知模型和手动刷新会等待在线结果。模型名单请求限时 10 秒，体积更大的模型配置下载单独限时 30 秒，并协商 gzip 压缩以减少慢速连接的传输量。若宿主因 HTTP/2 兼容问题返回未解压的 gzip 数据，插件会在同一超时预算内异步解压，原始数据和解压结果均受 16 MiB 限制。模型名单和用量接口继续使用非压缩传输。

同一会话继续、重试以及恢复后的请求沿用宿主保存的会话 ID。分叉和子会话使用各自的 ID，不复用父会话标识；没有会话 ID 的独立请求每次生成随机标识。

## 卸载

从对应 profile 移除插件，再重启应用：

```sh
dsh plugin --profile web remove dsh-opencode-go
# 或
dsh plugin --profile headless remove dsh-opencode-go
```

## 反馈

遇到 bug 或有功能建议请提 issue。

## 许可证

[MIT](LICENSE)
