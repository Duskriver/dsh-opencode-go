<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.png">
    <img src="docs/assets/logo-light.png" alt="DSH-OCGO" width="480">
  </picture>
</p>

<h1 align="center">dsh-opencode-go</h1>

<p align="center">
  <a href="README.en.md">English</a> · <a href="#常见问题-faq">常见问题</a> · <a href="docs/advanced.md">高级指南</a> · <a href="docs/development.md">开发与测试</a>
</p>

为 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 量身打造的 **OpenCode Go 专属接入与多账号管理插件**。

DSH 原生支持接入 OpenCode Go，但原生模式无法满足复杂的生产与日常开发需求（如多账号无感容灾、会话级 Prompt 缓存绑定、会话内实时额度透视等）。本插件基于 Cordis 微内核架构，在提供完整模型协议转换的同时，带来了流畅的客户端 UI 与企业级容灾体验。

---

## ✨ 核心特性

- 🛡️ **多账号无感容灾**：支持最多 20 个账号集中管理与拖拽排序。当主账号额度耗尽或 Key 失效时，**在输出前自动尝试备用账号**，成功后自动扶正，告别“聊到一半额度没了”的打断感。
- ⚡ **会话级 Prompt 缓存绑定**：严格遵循网关协议注入专有 `x-opencode-session` 路由头，稳定复用网关上下文缓存，显著降低响应首字延迟。
- 📊 **会话内额度实时透视**：在聊天输入框旁常驻“用量胶囊”，直观展示 5 小时滚动、每周、每月的额度百分比及重置时间倒计时；支持休眠节能与静默刷新。
- 💰 **本地离线用量看板**：完全在本地离线扫描会话历史，按模型与官方峰谷时段智能统计 Token 消耗与估算开销，零数据上传，保护隐私。
- 🎛️ **模型与热配置**：无需重启 DSH！随时在线调整模型上下文窗口、最大输出上限、思考预算（Thinking Budget），并支持 HTTP/HTTPS/SOCKS5 代理。

---

## 🚀 快速开始

适用于 DSH `0.1.5-rc.1` 及以上版本（完整支持矩阵见[兼容矩阵](docs/development.md#installed-package-matrix)）。

### 1. 安装插件

#### 方式 A：在 DSH 界面中一键安装（推荐）
1. 打开 DSH，进入 **插件 → 添加插件**。
2. 输入 `dsh-opencode-go`（或填入仓库地址 `https://github.com/Duskriver/dsh-opencode-go`），点击 **安装**。
3. 安装完成后点击 **立即启用**。

![在 DSH 中安装插件](docs/assets/install-via-dsh.gif)

#### 方式 B：命令行安装
```sh
dsh plugin --profile web add dsh-opencode-go
```
*命令行安装后请重启 `dsh web`。Headless 用户请使用 `--profile headless`。*

### 2. 配置与使用
1. 打开 **设置 → OpenCode Go**，填入你的 OpenCode Go API Key；若有多个账号，可在 **账号** 卡片中点击添加。
2. 在任意会话的模型选择器中，选择 **DSH OpenCode Go** 目录下的模型。
3. 开始对话，输入区右下角即可看到实时的用量胶囊。

---

## 💡 深度功能与运行机制

### 1. 多账号管理与无感容灾（Auto-failover）

在 **设置 → OpenCode Go → 账号** 中集中管理你的所有账号：

![账号管理：账号排序、额度详情、Key 操作和自动使用备用账号](docs/assets/accounts.png)

- **拖拽排序即优先级**：列表第一项为当前主账号；鼠标拖拽左侧手柄调整顺序，这个顺序也是自动尝试备用账号的优先次序。
- **出词前无感切换**：开启“自动使用备用账号”后，若当前账号在发出请求后遇到了 **401/403 鉴权失败、429 限流或 Quota 额度耗尽**：
  - 插件会在**开始向你输出文字前**，静默挑出下一个备用账号重新发送请求。
  - 成功出词的备用账号会自动移至首位成为新主账号，并在会话面板给出切换提示。
  - *防御机制*：若模型已经开始吐字或已产生计费，插件不会切换，避免拼接乱码或重复扣费。
- **防雪崩冷却黑名单**：被网关拒绝的 Key 会进入 5 分钟的内存冷却名单，避免短时间内反复向已失效的账号发起无意义的重试。
- **凭据安全隔离**：Key 直接存储至 DSH 底层凭据系统，前端界面永远不会回显明文密钥。

### 2. 会话内订阅额度透视（UsagePill）

在聊天输入区旁，常驻有直观的“用量胶囊”。点击即可展开完整的用量卡片：

![订阅用量面板：当前账号、三个额度窗口及重置时间](docs/assets/usage-panel.png)

- **三窗口精准监控**：
  - 🟢 **5 小时滚动配额**：短周期高频使用的健康度。
  - 🟡 **每周配额**：本周累计使用进度。
  - 🔴 **每月配额**：月度套餐消耗百分比。
  每个窗口均显示精确的重置倒计时；进度条会随着接近上限变黄，耗尽时变红。
- **节能与防抖机制**：默认每分钟静默刷新；当页面切入后台或浏览器最小化时**自动暂停轮询**，切换回前台时即时刷新。
- **账号全名与快速切换**：多账号时直接显示当前账号全名（名字过长以省略号截断），展开面板点击“切换”即可直接提拔目标账号为主账号。
- **显示模式**（在 **高级设置 → 额度显示** 中配置）：
  - **自动（默认）**：仅在使用 DSH OpenCode Go 模型时显示。
  - **常驻**：切换到其他厂商模型时，仍然保持胶囊显示。
  - **关闭**：隐藏胶囊并停止后台用量轮询。

### 3. 用量与开销看板（Analytics）

点击用量面板底部的 **用量统计**，或进入 **设置 → OpenCode Go → 用量统计** 即可唤出看板：

- **纯本地扫描，零隐私外泄**：直接调用 DSH 宿主 `sessionQuery` 离线扫描本地历史会话，统计本插件产生的 Token 消耗，绝不上传任何对话内容。已关闭会话的折叠结果会按日志 revision 缓存在本地，重启后再次打开只需读取变更过的会话。
- **峰谷电价式开销估算**：内置 models.dev 的官方基准价格表；自动识别 DeepSeek V4.1 Flash / V4 Pro 等模型的官方峰时时段（UTC 周一至周五 01:00–04:00、06:00–10:00）并按双倍费率估算金额。
- **四款专属主题**：支持在 **寂静黑 / 石墨（默认）/ 海盐青 / 暖砂** 之间切换，自动适配系统的亮色/暗色模式。

---

## 🛠️ 架构设计与工作原理

本插件采用严格的宿主-客户端分离（Host-Client Separation）架构：

```
[ DSH 前端 UI (React + Slots) ]
   ├── UsagePill.tsx (会话胶囊组件)
   ├── AccountsCard.tsx (账号拖拽与管理卡片)
   ├── ModelEditor.tsx (模型自定义编辑器)
   └── AnalyticsDialog.tsx (本地用量与费用看板)
               │ (通过 DSH Typert RPC 双向通讯)
               ▼
[ DSH 宿主服务 (Node.js ESM) ]
   ├── OpencodeGoAdapter (核心适配器，实现 LlmAdapter 协议)
   │     ├── rejectedKeys (5分钟失败 Key 冷却熔断器)
   │     └── autoSwitch (出词前备用账号轮询状态机)
   ├── OpencodeGoRequestExecutor (请求执行器)
   │     ├── x-opencode-session (稳定会话 ID 哈希，绑定网关 Prompt 缓存)
   │     ├── ImagePayloadLease (图片尺寸预算池，防止高并发 OOM)
   │     └── idleWatchdog (流空闲超时看门狗，防长连接挂死)
   ├── GoUsageService (配额查询服务，代理 /usage 接口)
   └── Conversion 层 (上下文与流事件双向映射)
               │
               ▼
   [ OpenCode Go 在线网关 API ]
```

### 为什么必须要携带 `x-opencode-session`？
OpenCode Go 网关具有会话粘性路由与上下文缓存共享能力。插件会自动将你的 DSH 对话 ID 经过单向哈希（保留可读字符并在需要时转为安全散列），以稳定的形式放入 `x-opencode-session` 请求头中。这样不仅能让多轮对话始终落在同一推理节点上，还能最大化命中网关的 Prompt Cache，显著节省思考与生成时间。

---

## ⚙️ 模型自定义与高级配置

### 模型参数覆盖
进入 **设置 → OpenCode Go → 可用模型**：

![模型设置：搜索、分类筛选、显示开关和参数编辑](docs/assets/model-settings.png)

- **显示开关**：自由隐藏不常用的模型，净化聊天选择器。
- **容量与上下文覆盖**：可手动指定上下文窗口（Context Window）与单次最大输出 Token。
- **思考预算（Thinking Budget）**：对支持深度思考的模型，可自定义思考强度等级或 Token 预算。
- *特别规则*：`deepseek-v4.1-flash` 默认自动配置 **64k (65,536 tokens)** 输出预算，并将该上限通知 DSH 宿主，用于计算上下文压缩时机。

### 分组高级设置
支持在 **设置 → OpenCode Go → 高级设置** 中按需微调：

![高级设置：分组配置、提示入口和统一恢复默认](docs/assets/advanced-settings.png)

- **网络代理**：支持填入 HTTP、HTTPS 或 SOCKS5 代理地址（如 `socks5://127.0.0.1:1080`），保存后即时应用于对话、用量查询与模型刷新。
- **超时控制**：分别支持配置请求准备超时（`requestPreparationTimeoutMs`）、整轮请求超时（`requestTimeoutMs`）以及流空闲看门狗阈值（`streamIdleTimeoutMs`）。
- **一键恢复默认**：点击每张卡片的“全部恢复默认”可一键清空自定义覆盖，不影响已保存的账号 Key。

---

## ❓ 常见问题 (FAQ)

<details>
<summary><strong>Q: 为什么聊天输入区没有出现用量胶囊？</strong></summary>

1. 检查当前会话选中的模型是否为 **DSH OpenCode Go** 分组下的模型。默认“自动”模式仅在选择本插件模型时展示；若希望在使用其他模型时也看到配额，可在 **高级设置 → 额度显示** 中切为“常驻”。
2. 检查是否已在设置中填入有效 API Key 且插件已处于启用状态。
</details>

<details>
<summary><strong>Q: 为什么长会话中偶尔会报 400 错误？</strong></summary>

通常是因为单次上下文加输出预算超过了模型允许的 Context Window。建议：
1. 在会话中执行 `/compact` 指令压缩历史消息。
2. 或在 **可用模型** 设置中，适度调低该模型的“最大输出”上限。
明确的上下文超限错误会被插件捕获并交由 DSH 原生恢复机制处理。
</details>

<details>
<summary><strong>Q: 升级插件后，旧会话找不到模型怎么办？</strong></summary>

从 `0.1.16` 及更早版本升级时，底层 Provider ID 进行了规范化统一。只需在旧会话或 Agent 配置的模型下拉框中，重新选择一次 **DSH OpenCode Go** 下的模型即可。
</details>

<details>
<summary><strong>Q: 插件在执行过程中会自动将我的数据上传到第三方吗？</strong></summary>

**绝对不会**。本插件只与 OpenCode Go 官方网关直接通信；用量看板统计也完全基于本地会话记录离线分析，没有任何外部打点或分析服务。
</details>

---

## 📦 更新与卸载

### 更新插件
```sh
dsh plugin --profile web update dsh-opencode-go --latest
```
更新后重启 `dsh web` 并刷新浏览器页面（桌面客户端请完全退出后重新打开）。

### 卸载插件
```sh
dsh plugin --profile web remove dsh-opencode-go
```

---

## 📚 更多文档与链接

- 📖 [高级使用指南（Headless 部署、代理策略与错误排查）](docs/advanced.md)
- 📊 [用量看板统计说明（计价口径与扫描策略）](docs/usage-analytics.md)
- 🛠️ [开发与贡献指南](docs/development.md)
- 🧪 [多版本兼容性与验证记录](docs/verification.md)
- 🐛 [提交 Issue 与建议](https://github.com/Duskriver/dsh-opencode-go/issues)
- 📄 [MIT 开源许可证](LICENSE)
