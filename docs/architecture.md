# 架构

## 1. 进程与入口

控制面只有一个进程 `src/main.ts`，它依次装配：

1. 读取 `BOT_MASTER_KEY_FILE`（32 字节主密钥），打开 `Store`（SQLite）（`src/main.ts:22-27`）。
2. 构造 `GitHubLogin`，校验部署默认值；已保存的向导配置优先（`src/main.ts:29-40`）。
3. 读取 manager 令牌，构造 `ManagerClient` 与 `ProjectService`（`src/main.ts:43-47`）。
4. 加载仓库级自动化 YAML（`config/repositories/<owner>__<repo>.yml`），配置非法时**启动失败**而不是静默使用默认值（`src/main.ts:49-52`）。
5. 启动 `TaskEngine`、`ExternalService`、安装同步、`ReleaseService`、`ActionsFailures`、公共看板、门禁向导（`src/main.ts:53-66`）。
6. `createControlPlane(...)` 返回唯一的 HTTP 监听器，`server.listen(8791, '0.0.0.0')`（`src/main.ts:67-69`）。容器外的宿主端口由 Compose 映射，默认只绑 `127.0.0.1`。

所有业务路径共用这一个监听：控制台、`/api/*`、GitHub OAuth、App 回调、Webhook、外部执行端、公共看板（`src/server.ts:130-326`）。没有第二个公网端口。

## 2. 一次 GitHub 事件的路径

```
GitHub webhook
  → /hooks/github/<account>/<endpoint>   (验签 + 先落库再确认)
  → deliveries / processed_deliveries    (重复投递去重)
  → 事件过滤（安装范围、项目启用、作者身份、草稿/关闭、head 校验、
             项目关闭的事件、没有任何可处理方式的事件）
  → dispatch_events (event_key 唯一)
  → Manager 一次分派 (create / continue / ignore，必须写理由)
  → tasks + task_events
  → 队列 / claim → RoleRun → 候选 → 独立 QA → Publisher
  → PR / 评论 / 检查 / 发版记录
```

关键点：

- **先落库再确认**：Webhook 响应成功前投递已持久化；重复投递按 `event_key` 只记一次。
- **Manager 只做分派**：它决定新建、续接或忽略，不能扩大写入范围或绕过控制面条件（`docs/workflows.md`）。
- **业务成功只来自通过校验的提交工具**：不从模型文字或退出码推断（`docs/role-run.md`）。
- **Review 只允许 `COMMENT`**：不批准、不请求变更、不合并。

## 3. 执行面

`manager` 是控制面与 Docker 之间唯一的网关：

- 只监听容器网络内的 **8793**；控制面用 `Bearer <base64(manager token)>` 调用（`manager/server.mjs:8-30`）。
- `/ready` 是唯一不鉴权的探针，只返回 `{ready}`；项目 API 在恢复完成前返回 `503 manager_not_ready`。
- 每仓库一台长期容器；`dbot-<deployment>-<repo>-g<generation>` 是命名规则（`manager/projects.mjs:166`）。
- `deployment` 是 manager 令牌的 SHA-256 前 16 位（`manager/main.mjs:11`），所以同一台宿主上的两个部署不会互相接管容器。
- 每次 RoleRun 还可以有独立容器与网络（`manager/run-environments.mjs`），用于更强的每次运行隔离。

虚拟电脑内的 `runner` 是**无网络监听**的一次性固定入口：manager 通过 `docker exec` 发送校验后的请求，返回 JSON 与持久 journal；调用者不能指定 exec argv 或用户（`docs/architecture.md`）。工作区读写有大小上限：单次写入 48 KiB、读取 1 MiB、命令输出 1 MiB。

## 4. 凭据与信任边界

| 凭据 | 在哪里 | 谁能用 |
| --- | --- | --- |
| 主密钥（master.key） | `bot-keys` 卷，只读挂进控制面 | 只用于解密数据库中的凭据 |
| GitHub App 私钥 / 机器人 Token / 模型 Key | SQLite 密文（AES-256-GCM + AAD） | 控制面；任务容器拿不到 |
| manager 令牌 | `internal-keys` 卷 | 控制面 → manager |
| 运行令牌 `rrt_…` | 只存哈希 | 单次 RoleRun 的任务工具网关 |
| GitHub 只读令牌 | 控制面按需签发，短时 | 模型需要读 Issue/PR/CI 时 |
| 用户 OAuth token | 加密保存 | 只读 `/user` 与身份绑定 |

控制面的设计原则是：**能写 GitHub 的凭据和模型 Key 只在控制面**；项目容器通过 loopback 邮箱向控制面兑换只读令牌或代理模型请求。容器不直接持有长期凭据（`docs/architecture.md`）。

## 5. 关键不变量

1. **单一业务入口**：控制台、登录、回调、Webhook 都走同一个 Origin；没有独立的“管理端口”。
2. **先持久化，后确认**：Webhook 与外部转发都先写库。
3. **幂等**：`event_key`、`operation_id`、`request_id`、任务 claim token 都有唯一性/租约围栏。
4. **租约围栏**：任务 claim、RoleRun 的 lease epoch 和运行令牌共同阻止旧执行写新状态。
5. **不伪造**：未知费用记为 unknown，不记 0；缺失能力返回缺失；失败分类不吞。
6. **不越权**：Review 只评论；发布只准备草稿；外部执行端不获得控制面权限。

## 6. 数据模型（按职责分组）

约 50 张表，核心分组：

| 分组 | 代表表 |
| --- | --- |
| 账号与身份 | `accounts`, `users`, `sessions`, `endpoints`, `installations/installation_syncs`, `installed_repositories` |
| GitHub 事件 | `deliveries`, `processed_deliveries`, `review_objects`, `review_sessions`, `review_summaries`, `review_updates` |
| 任务与执行 | `tasks`, `task_claims`, `task_logs`, `task_tools`, `task_metrics` |
| 项目与策略 | `repositories`, `policies`, `project_environments`, `environment_operations`, `repository_configs` |
| 模型与费用 | `models`, `model_projects`, `model_requests`, `model_pricing` |
| 发布与自动化 | `bot_branches`, `bot_pull_requests`, `bot_pr_requests`, `project_releases`, `automation_runs` |
| 协作与外部 | `channels`, `external_identities`, `external_clients`, `schedules` |

SQLite 用 WAL + `synchronous=FULL`；写入在一个进程内串行化。它适合单机控制面，不是分布式数据库。

## 7. 与上游文档的关系

本页是对 `docs/architecture.md`、`docs/workflows.md`、`docs/role-run.md` 的**结构化重述 + 独立注解**。上游文档更细，尤其是 RoleRun 协议、Harness Runtime、身份授权和接入向导；本页只给系统级心智模型。
