# Security Policy

## 支持的版本

| 版本 | 支持状态 |
| --- | --- |
| 最新发布版本（`0.3.x`） | 接收安全修复 |
| 更早版本（`<= 0.1.x`） | 不再支持，请升级到最新版本 |

安全修复通常以补丁版本发布。无法升级的旧版本可能需要先迁移配置或凭据引用。

## 报告漏洞

请**不要**在公开 Issue 中披露漏洞细节、利用方式或任何真实凭据。

- 首选：通过 GitHub 的私密报告渠道——仓库 **Security → Report a vulnerability**（GitHub Security Advisory）。
- 若无法使用 Security Advisory：可以开一个**不含细节**的公开 Issue（仅说明“存在安全问题，需要私密沟通渠道”），维护者会建立后续私密沟通。
- 报告中请包含：受影响版本、DSH/Host 版本与操作系统、最小复现步骤、影响评估；如可能，附上修复建议。
- 请勿附带真实 API Key、代理用户名/密码、`Authorization` 头、会话正文或 `.credentials.yaml` 内容；确需展示时使用占位符替换。
- 维护者会确认收到、评估影响并协调修复与披露时间。本项目由社区维护，尽力而为，不提供 SLA。
- 范围：本仓库只覆盖 `dsh-opencode-go` 插件。DSH 本体（`@deepseek-ai/dsh*`）、OpenCode 网关或上游服务自身的问题，请报告给各自的维护方。

## 安全相关配置与行为

### 凭据

- OpenCode API Key 保存在 DSH 凭据服务中，不写入插件的 settings 文档；设置页不会回显已保存的密钥。
- 代理 URL 可携带用户名/密码：这些凭据会随代理连接发送给该代理；代理不可信时凭据可能暴露。插件错误信息会脱敏，但无法阻止代理自身记录流量。
- 不要在截图、日志、公开 Issue 或 CI 输出中粘贴 Key、代理密码或凭据文件内容。

### 网络与代理

- 支持 HTTP、HTTPS、SOCKS5 代理；代理运行在 DSH 所在机器上，远程部署时 `127.0.0.1` 指服务器自身。
- Free 的 SOCKS5 使用每请求专属的本机字节隧道与随机认证凭据；代理失败不会回退到直连。
- Free IPC 边界：单个请求体上限 64 MiB（读入前后各校验一次），base64 编码后的 worker 包上限 256 MiB；worker 另对 stdin 累计 256 MiB 做上限检查。

### Free 通道（默认关闭）

- Free 通道是显式 opt-in。开启后请求会以官方 OpenCode CLI 的 User-Agent 发往平台公共免费入口，可能违反上游条款，也可能触发风控、限流或账号限制；风险由使用者自行承担，不建议用于生产或大规模自动化。
- Free 通过版本锁定为 1.4.4 的官方 `@oven/bun-*` npm 可选平台包启动独立 worker。平台包直接提供原生二进制，不使用 `bun` 包装包或安装期脚本，因此不需要批准 Bun 的 `postinstall`；原生运行时仍属于上游供应链信任范围。若可选依赖不可用，Free 报 `MISSING_BUN_RUNTIME`，Go 通道不受影响。
- Free worker 以独立进程运行，并从显式环境 allowlist 启动，**不再继承宿主 `process.env`**：`NODE_EXTRA_CA_CERTS`、`NODE_TLS_REJECT_UNAUTHORIZED`、`NODE_OPTIONS`、`LD_PRELOAD`、`DYLD_INSERT_LIBRARIES` 以及代理环境变量不会传入 worker。依赖这些环境变量注入自定义 CA 或 TLS 覆盖的部署需要改用其他受支持方式，不要依赖该行为。

### 插件模型

- 本插件在 DSH Host 进程内以用户权限运行（DSH 插件模型不属于沙箱）；只安装可信任来源的插件。
- 工具调用、网络访问与文件访问的授权由 DSH 的沙箱与审批策略决定，插件不会绕过这些策略。
