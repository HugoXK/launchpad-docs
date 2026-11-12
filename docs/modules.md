# 代码地图

分析基线：`main@95231e8`。`src/` 约 22,000 行 TypeScript（不含 `public-board/dashboard` 与 `static/` 前端资源）。下面按目录给职责，并列出最值得先读的文件。

## `src/` 控制面

| 目录 | 职责 | 先读 |
| --- | --- | --- |
| `core/` | 通用安全原语：随机 ID、SHA-256、密码哈希、HMAC 验签、`SecretBox` | `security.ts` |
| `storage/` | SQLite 打开、PRAGMA、增量迁移、事务、审计 | `database.ts` |
| `main.ts` / `server.ts` | 装配和唯一 HTTP 入口；路径分派、认证、CSP、静态资源 | `main.ts`, `server.ts` |
| `app/` | 账号/登录、安装同步、模型与项目列表、Webhook 归一化、管理 API | `installations.ts`, `webhook.ts`, `models.ts` |
| `agent/` | 任务引擎、模型循环、工具网关、Git 镜像缓存、只读令牌、工作区、失败分类 | `engine.ts`, `loop.ts`, `gateway.ts`, `read-token.ts` |
| `tasks/` | 任务、task run、候选、契约、记录、验收与发布前置 | `records.ts`, `contract.ts`, `candidate.ts` |
| `roles/` | 角色定义、RoleRun 协议、租约/令牌/事件/检查点、TaskToolGateway、调度 | `protocol.ts`, `role-run.ts`, `run.ts`, `gateway.ts` |
| `harness/` | 执行器适配：Native、Process、ACP、Codex app-server、Claude Code | `session.ts`, `acp.ts`, `app-server.ts`, `claude-code.ts` |
| `dispatch/` | 项目 Manager 的事件分派（create/continue/ignore） | `manager.ts`, `worker.ts`, `store.ts` |
| `review/` | 检视触发、队列、位置校验、摘要单评论 | `queue.ts` |
| `github/` | GitHub 客户端、发布 outbox、限流、Release 标签、文本清理 | `client.ts`, `publisher.ts`, `rate-limits.ts` |
| `automation/` | 纯函数模块：标签规范、门禁、合并队列；仓库 YAML 配置 | `engine.ts`, `registry.ts`, `config.ts`, `modules/*` |
| `projects/` | 环境网关（manager 调用）、门禁接入向导、集成检查 | `service.ts`, `gate-onboarding.ts`, `gate-plan.ts` |
| `identity/` | GitHub 登录、派生授权、外部身份绑定、权限核验 | `authorization.ts`, `github-login.ts`, `github-permissions.ts` |
| `installations/` | 安装档案、投影与同步 | `archive.ts`, `projection.ts` |
| `external/` | 外部执行端：签名、转发、身份、目标、事件 | `broker.ts`, `forward.ts`, `identity.ts` |
| `releases/` | 发版：标签、Release 工作流跟踪、发行说明、状态 | `service.ts`, `worker.ts` |
| `actions/` | Actions 失败扫描、分类、一次重跑与提报 | `service.ts`, `classifier.ts`, `safety.ts` |
| `board/` | 工作看板 API 与存储 | `api.ts`, `storage.ts` |
| `channels/` | 飞书等消息渠道、绑定、连接、发送队列 | `service.ts`, `feishu.ts`, `binding.ts` |
| `schedules/` | 定时计划与服务 | `service.ts`, `worker.ts` |
| `memory/` | 项目记忆、作用域、检索 | `store.ts` 等 |
| `metrics/` | 任务耗时、token、费用 | `*.ts` |
| `public-board/` | 公共看板（单仓库） | `service.ts` |
| `onboarding/` | 七步接入向导、公网 URL、Tunnel 检查 | `service.ts`, `public-url.ts` |
| `work/` | 工作类型、设置、迁移与事件 | `settings.ts`, `migration.ts` |
| `management/` | 管理对话/管理服务 | `service.ts` |
| `rules/` | 内置规则文本与版本 | `*.ts` |

## `manager/` 执行网关（约 1,500 行 JavaScript）

| 文件 | 职责 |
| --- | --- |
| `main.mjs` | 读取 manager 令牌、计算 deployment id、启动 HTTP |
| `server.mjs` | `/ready` 探针、Bearer 鉴权、项目/文件/笔记/统计/运行环境 API |
| `docker.mjs` | 对 Docker Engine 的薄封装、受控错误 |
| `projects.mjs` | 每仓库容器的建/停/重置/执行、代次、卷、派生镜像、恢复 |
| `run-environments.mjs` | 每次 RoleRun 的独立容器与网络 |

manager 是唯一持有 `/var/run/docker.sock` 的组件；**这是整个系统最大的权限面**，见[安全模型](security.md)。

## `runner/` 项目电脑内入口（约 1,100 行）

| 文件 | 职责 |
| --- | --- |
| `runner.mjs` | 无网络监听的固定入口；校验请求、执行、写 journal |
| `workspace.mjs` | 工作区相对路径、读写、命令、Git 候选 |
| `store.mjs` | journal 与输出文件 |
| `pi-entry.mjs` | Pi SDK 入口 |
| `repository-context.mjs` / `repository-tool.mjs` | 受控仓库读取 |
| `token-exchange.mjs` | 向控制面兑换只读令牌 |

## 其他

| 路径 | 内容 |
| --- | --- |
| `static/` | 控制台前端资源（原生 JS/CSS，无框架） |
| `public-board/dashboard/` | 公共看板的 dashboard workspace |
| `config/repositories/` | 仓库级 YAML：标签、门禁、合并队列、CI lane |
| `webhook/` | tunnel 与控制面之间的固定网关进程 |
| `images/project/` | 项目电脑镜像的构建上下文 |
| `scripts/` | 测试集运行器、API 文档生成、协议锁定、检查脚本 |
| `test/` | `node:test` 测试、夹具、假 GitHub/假模型 |
| `e2e/` | Playwright 浏览器验收 |

## 读代码的建议顺序

1. `src/main.ts` → `src/server.ts`：先看资源装配和唯一入口。
2. `src/storage/database.ts`：看表与迁移，理解“先落库”。
3. `src/app/webhook.ts` → `src/dispatch/*`：事件如何变成任务。
4. `src/agent/engine.ts` → `src/tasks/*` → `src/github/publisher.ts`：任务如何变成 PR。
5. `src/roles/*`：需要理解 RoleRun、租约与隔离时再读。
6. `src/identity/*` 与 `src/core/security.ts`：评估信任边界时读。
