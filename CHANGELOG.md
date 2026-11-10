# Changelog

本文件记录 dsh-opencode-go 的显著变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 新增 `appearanceTheme` 界面主题设置（`native` / `classic`），默认 `native`；未设置该字段的旧配置缺省使用 Native。
- 新增 `npm run check:install:pnpm`：用 pnpm 11.28.5 在隔离 consumer 中安装实际 tarball，禁用已有构建批准并启用严格构建失败策略，同时验证匹配平台的 Bun 二进制可以执行；CI 以非 advisory job 运行该安装检查。

### Changed

- 设置页、用量胶囊、侧栏与历史看板共用布局和内部主题 token：Native 通过 Host 公开语义 token 跟随 DSH 与第三方主题的颜色、字体、圆角等，无法解析时使用中性 fallback；Classic 保留暖纸 / 炭灰、陶土色与衬线风格，不跟随 Host 或第三方主题覆盖这些品牌 token。
- 主题切换不再改变组件布局；样式边界收敛到插件自有组件与共享 token 层，移除对宿主私有样式的越界覆盖。输入栏 `badge` / `plain` 样式及侧栏额度设置行为不变。

### Fixed

- 修复 Native 主题的对比度回退：强控件边界（`borderStrong`）与图表状态系列（`accent2` / `cacheRead` / `cacheWrite`）不再映射 Host 的 `border-l2` 发丝线与 `state-*` 状态点色（它们不保证控件边界与图表所需的非文本对比度），改为使用插件受控静态值，恢复 WCAG 1.4.11 3:1；`theme.client.spec.ts` 新增对 Host 实际表面范围（浅色白、深色 `#151517` / `#232324` / `#2c2c2e`）的断言，防止默认主题再次静默回退。
- Free 运行时改为直接声明版本锁定的官方 `@oven/bun-*` 可选平台包，移除带 `postinstall` 的 `bun` 包装依赖，修复 pnpm 11 在未批准构建脚本时安装或升级失败并回滚的问题（#87）。平台运行时仍会下载；Go 与现有 `MISSING_BUN_RUNTIME` 降级语义不变。

## [0.3.1-pre] - 2026-11-10

### Changed

- 用量历史入口补充与「刷新额度」一致的 hover / active 背景反馈（含 1px 视觉留白），键盘焦点环保持不变。
- 额度弹层改用「通栏两行」布局：标题行右侧保留账号入口；每档额度一行「标签 · 重置时间 · 百分比」，下方为通栏进度条；底部合并为「用量历史 ｜ 更新于 ｜ 刷新额度」操作条（352px 双账号下高度约 244px）。
- 弹层时间戳统一只显示到分钟：重置时间与「更新于」不再显示秒。
- 移除标题行与底部操作条的分隔线，改用留白；进度条轨道在宿主浅色主题下用混色保持可见。

## [0.2.2-pre] - 2026-11-09

### Changed

- 输入栏额度弹层改为 2×2 仪表网格布局：标题行右侧合并当前账号入口（点击进入账号切换），三档额度改为三张卡片（标签 + 大号百分比 + 通栏进度条 + 重置时间），第四格为「用量历史」入口，底部合并为「更新于 + 刷新额度」操作条；352px 宽、双账号下实测高度由约 434px 降至约 211px。
- 面板显式声明 `line-height`，不再继承宿主 24px 行高，消除单行文本被撑高一倍的约 36px 隐性高度。
- 「切换账号」列表行高 44 → 38px，列表增加上下留白；选中态改用不透明 `--go-accent-soft` 底色并叠加 1px 内描边，分隔线左右内缩，修复半透明底色导致的圆角发灰与圆角贴线问题。
- 额度进度条轨道改用 `color-mix(text 9%, surface)`，避免宿主浅色主题下 layer-2 与面板同色导致轨道不可见。

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
