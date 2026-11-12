# GitHub 集成

## 1. GitHub App 是什么

LaunchPad 以 GitHub App 的身份工作，而不是某个人的 PAT：

- 控制面用 App 私钥签发 JWT，再换取目标仓库的 **installation token**。
- 安装范围、仓库列表和权限由 GitHub 授予；控制面每 10 分钟全量对账，安装事件即时更新。
- 用户 OAuth 只用于登录与身份核验；用户 token 只读 `/user`，不进入模型上下文。

官方要求的 App 权限（`docs/admin.md`）：

| 类别 | 权限 |
| --- | --- |
| 写 | Contents、Issues、Pull requests、Commit statuses、Actions、Checks |
| 读 | Metadata、Members |
| 订阅事件 | `issues`、`pull_request`、`issue_comment`、`pull_request_review`、`pull_request_review_comment`、`organization` |

Actions/Checks 的写权限用于发布状态、检查结果和重跑 CI；读权限让任务能用只读令牌查看 CI。

## 2. Webhook

- 入口：`https://<你的域名>/hooks/github/<account_id>/<endpoint_id>`。
- 验签：`X-Hub-Signature-256`，HMAC-SHA256，`sha256=` + 64 位十六进制；用 `timingSafeEqual` 比较（`src/core/security.ts:41-45`）。
- 幂等：先落库，再确认；重复投递按事件键去重。
- 只接受与项目相关的范围；仓库外人员、bot 自己写的内容（bot PR 上其他检视机器人的评论/检视除外）、草稿和已关闭对象会被过滤。

## 3. 检视行为

- 新 Issue 收到一条检视总结评论；之后再检视**改写同一条评论**，不刷屏。
- PR 在打开、Ready for review、head 更新时检视；草稿不检视。
- 管理员可以按仓库关掉某类触发。
- Bot 只发评论：**不批准、不请求变更、不合并**。
- 开发开关关闭时，bot 不会按 Issue 改代码；打开后，需要有人（不是 App）加开发标签（默认 `bot-develop`），Manager 再判断能不能开发；不能时在 Issue 上说明缺什么。

## 4. 用仓库文件覆盖规则

仓库默认分支可放 `.bot/` 文件，覆盖检视、标签、开发规则和虚拟电脑配置。**仓库文件优先于内置默认和管理员在控制台的设置**；路径、格式和限制见上游 `docs/rules.md`。这让一个组织可以按仓库调整策略，而不必改控制面代码。

## 5. 仓库自动化：模块化的门禁

`src/automation/` 是“框架 + 可插拔能力模块 + 仓库级配置”（`docs/automation.md`）：

- 模块是**纯函数**：输入事件、仓库 YAML、可核实的事实，输出动作列表；不访问网络、不写库。
- 内置模块：`labels.ts`（label-lint、pr-status）、`gate.ts`（ready 标签守卫、merge-gate 状态）、`merge-queue.ts`。
- 仓库配置：`config/repositories/<owner>__<repo>.yml`；启动时加载，文件名非法、重复或字段拼错会让**启动失败**。
- 规则可以用固定事件回放测试，不会因为一条规则写坏 GitHub 状态。
- 执行结果写入 `automation_runs`，失败逐模块记录。

## 6. CI 门禁与合并队列

“接入门禁”先介绍几条 lane：

| lane | 何时跑 |
| --- | --- |
| `pr-ready` | 每次 PR 提交：构建和基础检查 |
| `pr-merge` | 合入门禁：有 merge queue 时在队列里；没有时在合入后先重跑 pr-ready，再跑昂贵检查 |
| `daily` | 每日 |
| `release` | 版本标签触发 |

接入流程不是“一键覆盖”：agent 先审视现有 CI，和人一起定下每条 lane 的命令；人在预览里确认新增/修改的文件后，控制面才创建门禁 PR，包含门禁 job、`.github/ci-gates.json`，缺少时的 `scripts/gate/gate.mjs` 和由版本标签触发的 `release.yml`。已有文件只按方案合并修改。

空 lane 的 `not_applicable` **不代表**实际检查通过；控制面不发布 PyPI、npm 包或镜像。

## 7. 发版

见[生命周期 · 发版](lifecycle.md#6-发版)。要点：注释标签、跟踪 Release 工作流、准备草稿、人点击正式发布；同名标签不移动、不删除；没有新提交时跳过。

## 8. 限流与额度

“全局设置 → 机器人账号 → GitHub 请求额度”按账号列出每小时额度：

- GitHub App 每个组织/个人账号上的安装各一份，由该组织下所有仓库和任务 agent 共用。
- Token 账号按 Token 所属用户一份。
- 每行显示额度、已用、剩余、窗口重置时间、流控中等待的任务数。
- “探测”立即读一次；读窗口本身不计入额度，但列出安装、签发临时令牌会消耗 App 自身（JWT）的请求。

额度用完时任务等到窗口重置再继续，不占重试次数。

## 9. 身份与授权

- 一个租户对应 GitHub 上的一个数字 owner account ID；一个项目对应数字 repository ID。名称只用于展示。
- GitHub 身份按 provider + host + 数字 user ID 关联；同名/同邮箱不会自动合并。
- 派生授权有效期 5 分钟；登录、刷新和写操作重新核验；进程每分钟对账。
- 授权变化递增 `authorization_revision`；陈旧写请求返回 `409 authorization_changed`。
- 平台超级管理员有恢复与显式委派能力；org_admin / project_admin 不会取得平台能力。
- 组织 owner 必须是 `active/admin` 成员证明；App 自身权限、安装事件和历史操作者**不构成**人类管理权限。

这套模型的核心是：**人类权限来自 GitHub 的可核实证明，不来自 bot 的安装令牌**。
