# 概览

**LaunchPad**（本部署名；上游仓库名 `agent-CI-Infra/bot`）是一个面向 GitHub 组织的公共 Bot：它检视 Issue 和 PR；在管理员明确打开开关后，按 Issue 写代码、跑测试、开 PR；还可以接入 CI 门禁并协助发版。它不合并 PR，也不替人做发布决定。

## 一句话结构

> 一个控制面 + 每仓库一台长期 Docker 虚拟电脑 + 可选的独立执行器。

```
浏览器 / GitHub / 外部执行端
          │  HTTPS 单入口 :8791
          ▼
┌──────────────────────────────────────────────┐
│ 控制面 bot（Node 22 + TypeScript + SQLite）  │
│ 控制台 · OAuth · App 回调 · Webhook · API    │
│ 模型代理 · GitHub 写入 · 任务队列 · 看板      │
└───────┬───────────────────────────┬──────────┘
        │ manager 令牌 :8793        │ 模型/只读 GitHub 令牌
        ▼                           ▼
┌──────────────────────┐   ┌───────────────────────────┐
│ manager（Docker 网关）│   │ 每仓库一台虚拟电脑         │
│ 建/停/重置/执行       │──▶│ runner + 固定提交工作区    │
│ 每次 RoleRun 容器     │   │ 读代码 · 跑命令 · 改文件   │
└──────────────────────┘   └───────────────────────────┘
```

## 三个平面

| 平面 | 在哪里 | 负责 | 不负责 |
| --- | --- | --- | --- |
| 控制面 | `bot` 容器，端口 8791 | 账号、登录、GitHub App、模型、任务、队列、Webhook、看板、审计 | 不直接执行仓库命令 |
| 执行面 | `manager` + 每仓库虚拟电脑 | 容器生命周期、工作区、命令、文件、每次运行的独立容器 | 不持有 GitHub 写凭据或模型 Key |
| 外部面 | 外部执行端 / ACP / Codex / Claude Code | 在别处跑 Agent，经签名通道回传 | 不扩大控制面的权限 |

## 关键数字

- 控制面 `src/`：约 **22,000 行 TypeScript**（`main@95231e8`），最主要的文件是 `src/agent/engine.ts`（约 965 行）。
- 数据：单个 SQLite（`node:sqlite`），约 **50 张表**；WAL、`synchronous=FULL`、`foreign_keys=ON`、5 秒 busy timeout（`src/storage/database.ts:38`）。
- 镜像：4 个 GHCR 镜像——控制面、项目电脑、computer manager、Cloudflare tunnel；默认 `latest`，可用 `BOT_IMAGE_TAG` 固定到 `v1.2.3` 或 `sha-<commit>`。
- 端口：业务 **8791**；manager **8793**（仅容器网络）；tunnel metrics **8794**（仅容器网络）；旧管理端口 8792 不再对宿主发布。
- Node：**>= 22.13**；依赖包括 `@agentclientprotocol/sdk`、`@anthropic-ai/claude-code`、`@larksuiteoapi/node-sdk`、`jose`、`marked`、`dompurify`、`yaml`。
- 许可：Apache-2.0。

## 它不是什么

- **不是**一个新的 Agent 框架：Agent 循环来自固定版本的 Pi SDK / ACP / Codex / Claude Code。
- **不是**自动合并机器人：Review 只允许 `COMMENT`，PR 由人合并；发版也只准备草稿，正式发布由人点击。
- **不是**多租户 SaaS 的完整隔离：一个部署对应一个控制面，项目之间靠容器、卷和授权隔离；宿主 Docker socket 仍是最大的信任边界。

## 阅读顺序

第一次接触：先读[架构](architecture.md)，再读[生命周期](lifecycle.md)。
要部署/运维：直接读[部署与运维](deployment.md)和[安全模型](security.md)。
要评估是否值得采用：读[独立分析](analysis.md)。
