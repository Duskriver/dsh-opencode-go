# Changelog

本文件记录 dsh-opencode-go 的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.4.3] - 2026-11-13

### Changed

- 设置对话框左侧导航的「OpenCode Go」行图标改为手绘 go 标记：优先通过宿主 DSH 0.2.2+ 新增的 `settings.section.icon` 图标 seat 注册（普通/选中态跟随宿主文字颜色）；对未声明该 seat 的旧宿主退回 DOM 兜底——按本地化 label 认行、隐藏兜底齿轮、用 CSS mask 画同款图标，宿主 DOM 变化时保留齿轮且不报错。
- 图标几何抽成 `GO_ROW_GEOMETRY` 单一来源：侧栏入口组件与设置导航 mask 共用同一份路径，避免两处图形漂移；新增 `tests/settings-nav-icon.client.spec.tsx`（图标 seat、旧宿主兜底、locale 切换、卸载清理、无 `MutationObserver` 降级）。

## [0.4.2] - 2026-11-13

### Changed

- 侧边栏入口图标改为手绘轮廓的「go」标记：由手绘 `g` 轮廓、实心棋石与空心棋石组成（`GoRowIcon` 独立实现并继承 `currentColor`），16px 展开栏与 18px 收起栏下渲染一致；页面头部、关于页品牌方块（`GoMark` / `GoLogo`）仍保留原波浪标记。
- 新增 `tests/icon.client.spec.tsx` 图标契约测试（24 viewBox、手绘路径与描边、实心/空心棋石、`currentColor`、16/18/24px 尺寸）；侧栏注册测试同时断言入口行使用该图标，避免后续重构回退成旧波形。

## [0.4.1] - 2026-11-13

### Added

- 新增侧边栏控制台入口：通过 `sidebar.panellist` + `main` 槽位在宿主侧边栏（插件市场之后）注册「OpenCode Go」入口行，点击在主内容区打开整页控制台；宿主未声明该槽位时保持原有设置页入口不变，不影响旧宿主。
- 控制台页包含 6 个子页：概览、用量看板、账号、模型、外观、关于。用量看板由原弹窗 `AnalyticsDialog` 抽出为可复用的 `AnalyticsDashboard`（对话输入框用量胶囊与侧栏配额卡的「用量历史」改为跳转页面；没有页面入口的宿主仍回退到原弹窗）。
- 设置页新增「打开完整页面」入口；账号卡片与模型/外观/高级设置拆分为可复用组件（`AccountsCard` / `ModelsSettings` / `AppearanceSettings` / `AdvancedSettings`），设置页与控制台共用同一套控制器，避免双份状态。
- 新增「侧边栏入口」开关（配置项 `sidebarEntry`，默认 `false`）：位于 **设置 → OpenCode Go → 概览**。开启后插件才在宿主侧边栏（插件市场之后）注册入口行与完整控制台页面；默认关闭，安装插件不会自动增加侧边栏条目。旧宿主或未声明 `sidebar.panellist` 槽位的客户端组合保持原有设置页与对话内弹窗入口不变。
- 控制台页「关于」页签显示入口状态：开启时展示 `sidebar.panellist · order 2`，关闭时提示在设置中开启。

### Changed

- **设置改为单一保存手势**：只有「高级设置」保留保存 / 放弃，其余开关与选项（启用、侧边栏入口、免费通道、额度显示、界面主题、侧边栏额度、输入栏额度样式、模型可见性与容量、全部账号操作）在修改时立即写入并生效。高级设置卡新增一行说明，外观、模型容量与可见性等相关提示语同步改写，不再暗示这些页面需要保存；页签上的外观草稿标记随之移除。
- 侧边栏入口与控制台页跟随开关动态注册：关闭开关时先离开页面再注销 `main` + `sidebar.panellist` 这一对槽位，重新开启时再注册。设置页的「打开完整页面」按钮随入口一起出现或消失；对话内用量胶囊在页面不可用时回退到内置用量历史弹窗。
- 控制台概览页的服务状态卡在免费通道写入被拒绝时显示即时失败提示（`immediateWriteFailed`）；页面底部的保存条只对高级设置草稿出现（`dirty || failed`），不再为其他页面的即时修改出现。
- 设置页底部操作条统一高度：保存 / 放弃只出现在高级设置页签，其余页签保留同样的 `size="md"` 控件行高度（36px），切换页签时面板与滚动区高度不再跳动。

### Fixed

- 修复第三方外壳（如 DS Bot 0.3.2 设置面板）不向设置节传递确定高度时，`dsh-opencode-go` 设置页高度塌陷、四个页签与内容被裁成一条的问题（#94）：页面容器查询改为仅约束行内尺寸，滚动主体在页面高度由内容决定时按内容高度展开；在 DSH 官方设置面板中布局、滚动与宽度断点行为保持不变。

## [0.4.0] - 2026-11-10

### Added

- 新增 `appearanceTheme` 界面主题设置（`native` / `classic`），默认 `native`；未设置该字段的旧配置缺省使用 Native。
- 新增 `npm run check:install:pnpm`：用 pnpm 11.28.5 在隔离 consumer 中安装实际 tarball，禁用已有构建批准并启用严格构建失败策略，同时验证匹配平台的 Bun 二进制可以执行；CI 以非 advisory job 运行该安装检查。
- 测试加固：全量 Vitest 测试套件扩展至 21 个文件 / 1075 个测试用例。

### Changed

- 版本号提升到 `0.4.0`：新增 Native / Classic 主题选择，输入栏额度弹层与设置页全方位紧凑布局改版，并收录 0.3.0 之后的安装、兼容性与 Gemini 工具历史修复。
- **输入栏额度弹层改版**：标题行右侧合并当前账号入口（点击进入账号切换）；三档额度改为「标签 · 重置时间 · 百分比」一行 + 通栏进度条；底部合并为「用量历史 ｜ 更新于 ｜ 刷新额度」操作条。352px 宽、双账号下实测高度由约 434px 降至约 244px；显式声明 `line-height`，消除单行文本被撑高一倍的隐性高度；所有时间戳统一显示到分钟。
- **设置页改为顶部分页与紧凑结构**：顶部四个页签（概览 / 模型 / 外观 / 高级）在内容滚动时保持固定（`position: sticky`）；删除页面说明行与模型 / 外观 / 高级设置三个子页重复的标题，「恢复默认外观」「重置参数」移至各卡片底部；概览的两个开关文案收窄为「启用 OpenCode Go」与「免费通道」，与账号摘要整合为统一行距的列表；模型页列表与参数框限高整体收敛至 448px；四大页签顶部起始间距对齐。
- **账号区改为紧凑两行**：第一行状态点 + 名称 + Key 状态 + 百分比 + 展开箭头，第二行通栏额度条 + 重置倒计时；去掉每行的大圆角描边盒子，行间只用发丝线；添加账号与自动切换合并到底部一行，拖动把手改为悬停显示（键盘仍可直接聚焦）。
- 设置页、用量胶囊、侧栏与历史看板共用布局和内部主题 token：Native 通过 Host 公开语义 token 跟随 DSH 与第三方主题的颜色、字体、圆角等，无法解析时使用中性 fallback；Classic 保留暖纸 / 炭灰、陶土色与衬线风格，不跟随 Host 或第三方主题覆盖这些品牌 token。
- 主题切换不再改变组件布局；样式边界收敛到插件自有组件与共享 token 层，移除对宿主私有样式的越界覆盖。输入栏 `badge` / `plain` 样式及侧栏额度设置行为不变。

### Fixed

- 修复 Gemini 3+ / 4 在旧会话或缺少回放元数据时，历史 `functionCall` 因没有 `thoughtSignature` 而被上游以 HTTP 400 拒绝的问题（#90）。真实签名及带签名的并行工具调用保持原样；完全无签名的工具轮次使用 Google 兼容占位标记跳过校验。
- 修复评审问题：历史看板额度重置提示恢复 UTC 日期与时间；账户列表在 `readUsage` 未返回时即发布 `configured / loading` 状态（未配置 Key 不再等待所有网络读取），各账户读取完成后逐行更新；Google SDK 懒加载失败后不再永久缓存 rejected Promise；`GoAccountManager.capture()` 继续避免热路径调用 `settings.describe()`，同时通过 `settings/document-updated` 事件围栏外部 `A -> C -> A` 编辑，过期的回退结算会被拒绝（新增回归测试）。
- 修复设置页额度进度条在 Native 浅色主题下不可见：轨道原本使用宿主 `layer-2` 表面色，默认 Native 浅色下与卡片同为白色（约 1.0:1，中性 fallback 也只有约 1.1:1），1% 等小幅值时只剩一小段填充，像散落的色块。现统一为派生 `--go-track`（主题文字色 18% 混入背景），设置页行内额度条与展开的三档额度条、用量弹层、侧栏和历史看板的额度条与模型占比条共用；轨道在浅色下约 1.4:1、深色下约 1.7:1，受检的 Native/Classic fallback 调色板中填充与轨道保持 ≥2.5:1 可分辨（Native accent 会跟随 Host，第三方主题 accent 不在该断言范围内），`theme.client.spec.ts` 新增轨道可见性与样式表漂移断言。同时去掉行内额度条原有的 25% / 50% / 75% 白色刻度：轨道不可见时它们也看不见，轨道可见后却把整条切成了四段。
- 修复 Native 主题的对比度回退：强控件边界（`borderStrong`）与图表状态系列（`accent2` / `cacheRead` / `cacheWrite`）不再映射 Host 的 `border-l2` 发丝线与 `state-*` 状态点色（它们不保证控件边界与图表所需的非文本对比度），改为使用插件受控静态值，恢复 WCAG 1.4.11 3:1；`theme.client.spec.ts` 新增对 Host 实际表面范围（浅色白、深色 `#151517` / `#232324` / `#2c2c2e`）的断言，防止默认主题再次静默回退。
- Free 运行时改为直接声明版本锁定的官方 `@oven/bun-*` 可选平台包，移除带 `postinstall` 的 `bun` 包装依赖，修复 pnpm 11 在未批准构建脚本时安装或升级失败并回滚的问题（#87）。平台运行时仍会下载；Go 与现有 `MISSING_BUN_RUNTIME` 降级语义不变。
- 修复 Free 凭据绑定：官方 host 分支现在同时要求 `https:` 与默认端口，`http://opencode.ai` 与 `https://opencode.ai:8443` 不再复用已保存的付费 Key，改为匿名 `Bearer public`，避免明文或非官方监听路径收到账号凭据（其它自定义 host 原本就不复用）。
- 修复 SOCKS 中继空闲上限短于流空闲预算的问题：中继上限改由请求的 `streamIdleTimeoutMs` 派生并保留 30 秒余量（默认 330 秒，原为固定 120 秒），`FreeBunTransport.forProxy` 透传该预算，使排队或大上下文 prefill 期间的静默先由插件自身判定为 `LLM_STREAM_IDLE_TIMEOUT`，而不是被中继拆连后归为 `NETWORK` 并触发 Free 冷却。
- 修复 Classic 浅色图表的实绘对比度：`cacheWrite` 在三个浅色表面上、`cacheRead` 在 `surface2` 上按柱体 88% 不透明度合成后低于 WCAG 1.4.11 3:1，分别调整为 `#787c6b` / `#8a7766`；柱体不透明度发布为 `--go-chart-bar-opacity` token，主题测试在原有原始 token 断言之外增加按合成后实际颜色的断言。
- 「切换账号」列表行高 44 → 38px 并增加上下留白；选中态改用不透明 `--go-accent-soft` 底色并叠加 1px 内描边，分隔线左右内缩，修复半透明底色导致的圆角发灰与圆角贴线问题。
- 修复分页后卡片顶部出现多余浅色分隔线的问题；同时清零卡片标题（h3 默认外边距）并收紧页头/页签间距，减少外观 / 模型 / 高级页的空白。
- 修复模型页左侧列表无法独立滚动：分页面板恢复为纵向 flex 容器，模型卡片重新获得剩余高度，左侧列表与右侧参数面板各自滚动。

## [0.3.0] - 2026-11-07

### Added

- Free 通道（`dsh-opencode-free`）改为**显式 opt-in**：新增 `freeEnabled` 设置并默认关闭；未开启时不注册 Free 路由、不拉取 Free 目录、不在模型发现与设置页暴露 Free 模型，关闭开关并保存后撤回路由且允许进行中的请求完成。
- 用量看板图表补充键盘行为：Escape 仅在存在已固定/激活日期时消费，否则保留宿主弹窗的关闭行为。
- 发布防护：新增 `scripts/check-pack.mjs` 与 `npm run check:pack`，断言 npm tarball 包含运行期、类型、文档与第三方通知所需文件；CI 的 `core` job 增加该步骤。
- `lib/build-info.json` 记录包版本；tarball 随包发布 `scripts/licenses/pi-1.5.0-LICENSE`，使 `THIRD_PARTY_NOTICES.md` 的引用在安装包内可解析。
- 仓库新增 `CHANGELOG.md` 与 `SECURITY.md`；CI 新增 advisory 兼容 job，在临时 consumer 中对 DSH `0.2.2-rc.1` 的 Host 路径运行 installed-package 冒烟（允许失败）。
- 本批新增 65 个回归测试。
- 发布内容：`CHANGELOG.md` 与 `SECURITY.md` 纳入 npm tarball，`check:pack` 同步断言。
- 仓库卫生：删除未被引用的跟踪资产（根目录 `image.png`、`.github/assets/*.png`）；新增 `npm run check:hygiene`（`scripts/check-source.mjs`），检查跟踪源文件的 BOM/LF/行尾空白/文件末尾单换行，并要求 `src`/`scripts` 无 tab，已接入 `verify` 链。

### Changed

- 版本号提升到 `0.3.0`：本次包含破坏性行为变化（Free 默认关闭、peer 依赖调整、Free worker 环境 allowlist）。
- devDependencies 评估后**不裁剪**：DSH 客户端包（如 `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-store`）在运行期直接 import 了一部分未写进其自身清单的依赖（`clsx`、`shiki`/`@shikijs/langs`、`katex`、markdown/micromark 链、`zustand`/`immer`、`simple-icons`、`@deepseek-ai/dsh-util-workspace-path` 等），根 `devDependencies` 是这些隐式运行期与类型依赖的唯一供给，因此保留原有 devDependencies 不变；CI 的干净 `npm ci` 是唯一可靠验证。
- 依赖：`@deepseek-ai/dsh-brand` 与 `@deepseek-ai/schemastery` 从 `dependencies` 调整为宿主提供的 `peerDependencies`（`>=0.2.1-rc.5` / `>=3.18.5 <4`），避免 profile 内重复安装；Cordis peer 范围由 `~4.0.5` 放宽为 `^4.0.5`，覆盖 DSH 0.2.2 携带的 Cordis 4.1.0。
- Free Bun worker 改为使用显式环境 allowlist，不再继承 `process.env`：`NODE_EXTRA_CA_CERTS`、`NODE_TLS_REJECT_UNAUTHORIZED`、`NODE_OPTIONS`、`LD_PRELOAD`/`DYLD_INSERT_LIBRARIES` 与代理变量不再跨进程传递。
- 请求生命周期：插件卸载时释放两条路由的 adapter；adapter 不再 dispose 注入的共享 `ProxyTransport`，Free worker 与 SOCKS 隧道因此有回收路径，同时不破坏 Host 拥有的传输。
- `LlmFailure` 从实际 HTTP 响应与 `Retry-After` 回填 `status` / `providerRetryAfterMs`；实现 `imageRequestTarget`，使 token meter 按实际序列化的图片计价。
- 官方历史 CSV 容忍空行与多余尾列；`cost_usd` 仅用于展示，`cost_micro_cents` 继续精确汇总。
- 模型目录 discovery 拒绝重定向并脱敏失败 URL；Host 与浏览器设置表单均拒绝内嵌凭据的 `baseURL`。
- thinking budgets 的非法值改为过滤/钳制，不再使模型解析整体失败；浏览器与 Host 共享 `MAX_THINKING_BUDGET_TOKENS`。
- 客户端：移除未使用的 inject 服务，区分加载中与不可用，数值输入与 Host 边界一致（字段级错误、`min` / `max` / `step`），并区分 provider 切换失败与模型可见性失败。
- Free IPC 边界：请求体在读入前按 `Content-Length`、读入后按真实字节数受 64 MiB 上限保护；worker 在 `JSON.parse` 前对 stdin 累计 256 MiB 上限做检查。
- 发布流程：`prepack` 重新执行 `check:dist`，`prepublishOnly` 执行类型检查与 `test:ci`，避免陈旧 `lib/` 被发布；`scripts/headless-smoke.mjs` 现在要求显式传入 consumer 参数（缺省打印用法并以退出码 2 结束）。
- 文档：`x-opencode-session` 措辞精确化为“常见可打印 ASCII 会话 ID 原样透传，仅非常规/保留前缀 ID 做 sha256 + base64url”；补充 Bun 可选依赖 postinstall 行为、发布检查说明与验证矩阵。

### Fixed

- 官方 CSV 遇到空行或额外尾列时会解析失败。
- discovery 跟随重定向、错误信息携带目录 URL、`baseURL` 内嵌凭据等诊断与凭据问题。
- 非法 thinking budget 导致模型解析失败。
- 插件卸载后 Free Bun worker 与 SOCKS 隧道缺少释放路径。

## [0.2.1] - 2026-11-06

### Added

- 官方 Console 每日 CSV 历史用量看板：按所选 Key 的工作区汇总，provider + model 分组，UTC 日序列补零，`cost_micro_cents` 精确汇总，并明确官方用量口径与隐私边界。
- 侧栏月额度与账号预览：三个额度窗口常驻展示，账号徽标可循环查看只读额度并记住查看账号，不可用读数明确报错。
- Go 与平台 Free 双路由动态模型目录：分别从各自 `/models` 发现模型与价格，保留同名模型，路由级开关与容量设置独立；内置 pi-ai 升级到 1.5.0。
- 统一 Claude 风格的插件接口，并紧凑化模型设置布局。

### Changed

- 历史看板从本地统计切换为官方 Console 每日 CSV 数据源。
- 模型与价格元数据改由各网关 `/models` 声明提供，不再依赖 models.dev 刷新。
- Free 限流处理移入插件内部；对外错误分类保持 `FREE_QUOTA`、`FREE_RATE_LIMIT` 等稳定语义。
- 改进 Free 传输、额度 UI 与 token 预算。

### Fixed

- 上下文变化后，回放用量不再沿用旧值。
- CI 兼容 npm 10 与 Windows 权限设置。
- POSIX 上接受 Bun 启动器路径。
