# 多账号功能审查与优化方案

> 审查范围：分支 `feat/accounts-card-fold-reorder`（基线 main = f3a77f8），涵盖 dd0e4b4（多账号+可选回退）、091a2e5（折叠+重排）、01e10c6（拖拽修复+行内编辑+读失败上报）。
> 方法：4 个并行探查 agent（后端持久化 / OpenCode Go API 链路 / 客户端契约与测试 / 设计意图与上游）+ 3 个对抗核验 agent（1 个运行时写临时测试实际复现、2 个静态找反证）。所有结论均有代码证据；运行时复现的临时用例已删除，工作区干净。
> 日期：2026-10-05

---

## 一、总体结论

多账号功能的设计（首选账号 + 按列表顺序的有序回退，**不是轮询/负载均衡**）在文档、实现、测试三层一致落地，工程质量整体扎实。核验确认以下方面**无需改动**：

- 进程内持久化：settings 写走 revision CAS + 每命名空间写队列 + 原子落盘；凭据文件 0600 + 原子写 + 跨进程锁。
- 凭据与日志分离干净：key 不进设置文档、不进日志、不进错误文案，测试显式锁定。
- fallback 有界且防重复计费：每账号至多一次尝试、部分输出后禁止换号、失败 attempt 的 usage chunk 丢弃、abort 即停、SDK 层 maxRetries=0。
- 用量按账号隔离正确：identities 按 ref 键控、pending 按身份 UUID 去重、key 轮换强制重拉。
- `GET /models` 无凭据 + catalog 按 baseURL 键控：实测上游该端点本就是公共全局目录（无凭据返回 200），设计一致，无正确性损失。
- 宿主恢复层整请求重发：与原生 llm-pi-ai 适配器行为一致（作者已在 docs/native-call-comparison-v020-rc2.md 记录），且有上述护栏。

核验后确认需要修的问题按优先级列于下文。**无高危缺陷。**

---

## 二、问题清单（对抗核验后定级）

### P0 — 合并前应修（正确性/可用性直接受损）

**P0-1【中，运行时证实】add() 与首次 describe 竞态：物化 legacy 占位行 + 新账号不成为首选**
- `src/client/accounts-controller.ts:196-204`：过滤未配置 legacy 占位行依赖 `this.rows.get(ref)?.configured === false`，而 rows 只有 describe 返回后才填充。
- 运行时复现三种场景全部中招：(a) 未 refresh 直接 add；(b) describe 挂起中 add；(c) describe 持续失败（如宿主未挂 credential provider）时**每次 add 都中招且累积**——accounts 变成 `[空名占位行, 新账号...]`，apiKeyEnv 不变，且占位行一旦物化（`accounts != null`）就永久留在设置里。
- 修复方向：过滤逻辑改为不依赖 describe 结果——`accounts == null` 时先 `await` 一次 `credentials.describe(legacyRef)` 再决定是否保留占位行；或 add() 入口处若 rows 未初始化则先完成一次 refresh。

**P0-2【中，运行时证实，核验新发现】remove() cleanup 失败后行内编辑器卡死，"添加账号"入口永久消失**
- `src/client/AccountsCard.tsx:80-87` + 控制器 `remove()` 返回 false 时 editor 状态 `{kind:'remove', ref}` 不清理；该行已随删除消失，而底部 Add 按钮的渲染条件是 `editor ? (editor.kind==='add' ? form : null) : <AddButton>` → Add 与 Cancel 都不可见，只能刷新页面恢复。
- 修复方向：remove 返回 false 且目标行已不存在时调用 `cancel()`；或行不存在时编辑器回退为可见的孤立表单。

**P0-3【中，证实+补强】add/remove 跨两个文档（.credentials.yaml 与 settings.yaml）非事务 → 孤儿明文 key，且无任何对账/清理机制**
- add：先 `credentials.set` 再 mutate；mutate 抛错（传输失败 **或更常见的 SettingsConflictError——两个标签页同时加账号必有一个中招**）时保守保留 key，且用户重试会生成新的随机 ref，旧孤儿永存。
- remove：先删 settings 再 unset，unset 失败仅 `failure='cleanup'`，无任何 UI 动作可重试 unset。
- 全仓确认：`DSH_OPENCODE_GO_ACCOUNT_*` 无清理逻辑；宿主凭据 seam 无列举 env 型 refs 的 API（`listRecords()` 只枚举 OAuth records），插件侧无法自助对账。
- 修复方向（组合）：
  1. **反转 remove 顺序**：describe 确认 ref 已配置后先 `unset` 再 mutate。失败时账号留在列表（显示"未配置"，可重试/可重填 key），严格优于孤儿明文 key。legacy 的环境变量 ref（describe 不存在）直接跳过 unset。
  2. **add 冲突重试**：mutate 抛 SettingsConflictError 时重拉快照、复用同一 ref 重试（2~3 次）——add 是幂等的追加操作，绝大多数冲突可就地解决，孤儿大幅减少。
  3. 可选：remove 失败提示文案已指引手动删凭据，保留。

### P1 — 发布前建议

**P1-1【低】describe 失败时所有行永远显示 loading**
`failure='read'` 时 rows 永不填充，行级 `configured===undefined` → "loading" 与"读取失败"并存，误导。改为失败态显示。

**P1-2【低】闭合状态的 UsagePill 无任何 fallback 迹象（核验后 F 从"中"降级，残余缺口仅此）**
fallback 后用户实际看到：对话正常；打开 pill 面板有通知（原因/目标账号/时间）+ 手动切换下拉 + 首选账号耗尽红条；设置页 AccountsCard 每账号额度逐行可见。**唯一盲区是闭合 pill**。修复：`usage.lastSwitch` 存在时闭合 pill 加一个小徽标/圆点。

**P1-3【低】rename 触发整表额度重拉**
`accounts-controller.ts:75-79` 身份指纹含 `account.name`。name 是纯展示字段，从指纹中剔除（reorder 已被排序比较排除），rename 不再引发 N 次 `/usage` 请求。

**P1-4【低】fallback 通知 fromRef 恒为 refs[0]**
`adapter.ts:307`。attempt≥2 的多级跳归因失真（UI 目前不渲染 fromRef，但契约数据错误）。改为 `refs[attempt]`（真正失败的那个）。

**P1-5【低，核验新发现】坏首选凭据无负缓存：每条消息先向首选账号重发一次注定失败的全量 transcript**
refs 每次请求从 `config.apiKeyEnv` 重建，测试断言 bodies 完全相等——首选 key 被撤销/持续 401 时，每条用户消息多一次整包 POST 浪费（N 账号全配额耗尽时一条消息最多 N 次）。修复：INVALID_CREDENTIAL/AUTH 失败后对 ref 做带 TTL 的跳过（或持续到 `credentials/reference-updated` 事件），announce 提示已跳过。

**P1-6【中】测试盲区与流程收尾**
- 补测试（本轮临时用例可直接转正）：describe 失败分支（`failure='read'`/`accountsReadFailed`）、cleanup 失败、add 未 refresh 竞态、add 冲突重试、move/replace 拒绝路径、setAutoSwitch 客户端动作、blocked 拦截。
- `docs/verification.md` 缺 dd0e4b4 / 091a2e5 / 01e10c6 三个提交的验证条目（该文档是仓库的发布验证惯例，101KB 均如此维护）。
- 091a2e5 自认未完成项：usage-pill 460px/360px 断点未在真实浏览器复测。
- 上游 issue #36 已查明为第三方平台推广 spam（GithubStarMate 邀请），与多账号无关，可请作者关闭。

### P2 — 跟进 / 上游协同

**P2-1【中，宿主层】跨进程 lost update（观察窗口内整段回滚）**
- 机制（已代码级证实）：dsh-settings 的 write 在**锁前**从本进程内存算好整个 namespace section，persistSection 持锁后 reconcileFromDisk 只刷新文本不重算 section；`accounts` 数组是 patchNode 整体替换。另一 Host 进程写盘后、本进程 watcher 观察到之前（≥100ms + 轮询延迟）的窗口内，本进程任何写（哪怕 `setAutoSwitch` 单键）都会把外部新增/删除的账号整段回滚，且被回滚账号的 key 沦为孤儿。
- 缓解已存在：revision CAS + chokidar 热发布，单 Host 多客户端完全安全。插件侧无法根治（根因在 dsh-settings-file 的锁前计算）。
- 行动：向 dsh 上游报告（建议 persistSection 在锁内重算 section 或按 key 合并）；README 注明"多 Host 进程共享同一 DSH_HOME 属非支持配置"。

**P2-2【低，休眠】anthropic-messages 线路非 SSE 错误体误分类为 TRANSPORT**
- pi-ai 用 `.asResponse()` 绕过 SDK 错误解析，非 2xx 的 JSON 错误体导致 "stream ended without a stop reason" → 插件归为 TRANSPORT（`conversion/stream.ts:58`）→ 不触发换账号且宿主白白重试。当前 48 个模型无 anthropic 系，但 `model-metadata.ts` 的 npm 映射一旦引入即激活。
- 行动：`classifyPiAiError` 对该措辞增加兜底解析（尝试从错误体提取 status/message），或向上游提 issue。

**P2-3【低-中，风险待观察】quota 措辞覆盖不确定**
纯 429（无 quota 措辞）不换账号是有意设计（避免 RPM 限流误切），合理。但第三方证据显示上游限流/配额至少两类形态并存；`FreeUsageLimitError` 这类驼峰串不命中宿主 `isQuotaExceededError` 任何分支。行动：`accountFailureReason` 加一条保守的插件侧正则（含 `usage.?limit`、`FreeUsageLimit` 等），并在分类边界打日志观察真实形态后再放宽。

**P2-4【低，语义未定义】fallback 复用同一 `x-opencode-session`，prompt cache 桶跨账号共享**
头注释自认网关用它路由会话并共享 prompt cache；fallback 后账号 B 的流量进入账号 A 写过的同一缓存桶，命中/隔离/计费语义完全取决于上游未定义行为。行动：向上游求证；必要时按 ref 派生会话头（`sessionId + ':' + hash(ref)`）隔离。

**P2-5【低】metadata-cache 自实现原子写无 Windows EBUSY/EACCES 重试**
`metadata-cache.ts:56-68` 裸 rename，失败静默吞（影响仅缓存 miss）。复用或模仿 dsh-atomic-write 的 win32 8 次退避重试。

**P2-6【微】轮询细节**
AccountsCard 折叠时仍 60s 全量轮询（改为展开时刷新）；无 visibilitychange 即时刷新（pill 有）；pill 与卡片双定时器对 active 账号的重复请求（相位独立，基本不命中 pending 去重，量约 2 次/分钟，可忽略或统一）。

**P2-7【低】账号名允许重复**
仅 id/apiKeyEnv 去重；重名时拖拽手柄 aria-label 与测试选择器歧义。可加 ref 短后缀或软性去重提示。

---

## 三、建议实施顺序

1. **P0-1 / P0-2 / P0-3**（三个客户端控制器/卡片修复 + remove 反转 + add 重试），连同转正的回归测试，作为一个修复提交。
2. **P1 全部**（小 UX/契约修复 + 负缓存 + 测试补齐 + verification.md + 浏览器复测），作为发布准备提交。
3. **P2-1 报上游、P2-3 加观察日志**随发布带上；P2-2/4 等 anthropic 模型上线或上游答复后再动。
4. 分支当前仅存在于 fork（origin），相对 upstream/main 无分叉，修完后开 PR 合回上游。

## 附：核验中被证伪/降级的原始判断

- "fallback 后用量数字错误" → 降为低：面板有通知+切换下拉，设置页每账号可见，仅闭合 pill 无提示。
- "宿主重试重复计费" → 降为低：可选插件执行 + 与原生一致 + 有护栏。
- "坏配置打挂宿主" → 修正：cordis fiber 级错误包含，仅本插件失活+日志，宿主存活；坏 settings.yaml 到不了 apply:91（写路径 validate 拒绝、读路径 keep-last-good），能打到的只有手改 profile/cordis.yml。
- "run() 早退静默无反馈" → 基本证伪：三种早退条件在 UI 层均已禁用入口，属防御性护栏。
