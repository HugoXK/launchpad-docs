# 生命周期

## 1. 事件：从 Webhook 到任务

一个 GitHub 事件先经过**确定性过滤**，再到 Manager：

1. **验签与落库**：`/hooks/github/<account>/<endpoint>` 校验 HMAC；投递先写入 `deliveries`，再确认。
2. **去重**：`processed_deliveries` 与 `dispatch_events.event_key` 保证同一事件只处理一次。
3. **范围过滤**：安装范围、项目是否启用、评论者是否是对象作者或 `OWNER`/`MEMBER`/`COLLABORATOR`、草稿/已关闭、PR head 是否变化。
4. **开关过滤**：项目关闭的事件类型；所有可处理方式都关闭的事件也不到 Manager。
5. **Manager 分派**：模型读事件摘要、最近任务和选项，返回 `create` / `continue` / `ignore`，**必须写理由**。
6. **事务落地**：新建任务、续接、记录理由、通知模块，一次完成。

Manager 只能选择控制面已经算好的选项，不能扩大写入范围，也不能绕过“一次一个修订”“修订预算”等条件（`docs/workflows.md`）。

## 2. 任务：队列、claim、执行

任务状态通常经历：

```
queued → preparing → running → implementing → validating
       → publishing → result_ready → done
              ↘ failed / cancelled / superseded / needs_replan
```

- **队列与 claim**：`task_claims` 记录 `(task_id, repo, token, claimed_at)`；执行前用 claim token 围栏，旧执行写入会被拒绝（`src/agent/engine.ts:119-126`）。
- **重试**：模型网络故障退避重试；持续失败进入每任务 8 小时重试周期；限流按自己的窗口等待。
- **取消/接管**：新 claim 使旧 token 失效；旧执行只能记录自己的取消（`src/agent/engine.ts:189-214`）。
- **业务成功**：只来自通过校验的提交工具，不从文字或退出码推断。

## 3. 角色执行：RoleRun

RoleRun 是**一个 assignment 的一次执行尝试**，不是新的任务系统（`docs/role-run.md`）。

| 阶段 | 做什么 |
| --- | --- |
| `prepare` | 组装快照、工具、预算；执行准入，返回必需/已声明/已验证/缺失的能力 |
| `start` | 分配租约 epoch、运行令牌；同一 operation id 幂等 |
| `events` | 至多 500 条规范化事件，带游标 |
| `checkpoint` | 会话引用、工具回执、工作区快照 |
| `cancel` | 先中断会话，有限等待；超时记 `stopped/cancel_timeout`，释放容器并撤销令牌 |
| `collect` | 校验结果、候选引用、RunContext |
| `recover` | 同一角色实例的新 run（新 id、新 epoch），从检查点续接 |

关键围栏：

- **lease epoch**：按任务单调递增；新 run 接管后旧令牌立即撤销，旧 epoch 的工具调用、事件、检查点和结果都以 `lease_epoch_stale` 拒绝。
- **运行令牌 `rrt_…`**：只存哈希，绑定 tenant/project/task/run/epoch/能力；默认 15 分钟，控制面持有期间每分钟续期。
- **TaskToolGateway**：每次调用复核令牌绑定、epoch、run 状态、租户/项目、发起人当前授权与角色策略。
- **秘密扫描**：写入前对 RunContext、事件和检查点执行 `assertSecretFree`；密钥形状的键/值直接拒绝。

## 4. 候选、QA 与发布

1. **候选**：写者通过受控提交产出 `CandidateRef`：`code`（commit + tree hash）、`artifact`（revision + content hash）或 `no_changes`。
2. **独立 QA**：QA 使用干净上下文评估被评估的候选；执行器正常结束不等于验收通过。
3. **发布前置**：`create_pull_request` 只在任务进入可发布阶段后可用；控制面固定一次工作树快照，然后按项目策略运行测试。
4. **发布**：控制面校验 diff 位置、head、bot 分支归属，推送并开 PR；同一 Issue 复用同一 bot 分支和 PR。
5. **Review**：只允许 `COMMENT`；不自动合并。另一个检视机器人的合理意见最多据此修改一次（`README` 与 `docs/rules.md`）。

## 5. 每仓库虚拟电脑

| 操作 | 行为 |
| --- | --- |
| 登记/启动 | manager 建容器、卷、网络；工作区从固定提交准备 |
| busy | 有执行请求；仍可接受新的执行请求（受并发度限制） |
| 停止 | 停容器、保留卷；再次启动复用代次与数据 |
| 重置 | 停旧代 → generation+1 → 新卷/新容器/新网络；失败进入 `reset_failed`，需人工重试 |
| 删除 | 只删受管容器和网络，保留工作卷与笔记卷 |
| 恢复 | manager 重启后先停止不确定执行，标记 interrupted，再用同一代容器与卷恢复 `ready` |

同一仓库仍只有一台电脑；并发任务共享 CPU/内存/进程数/`/tmp` 限额。项目笔记卷在停机、重建、禁用、重置代次后保留，删除项目时随环境删除。

## 6. 发版

1. 超级管理员或项目管理员在项目页填写版本号（`v1.2.3`、`v1.2.3-beta.1`）。
2. 校验版本高于上一枚可达标签，且仓库已接入门禁、有版本标签触发的 `release.yml`。
3. 控制面用 GitHub App 安装令牌创建**注释标签**，跟踪 Release 工作流。
4. 全部 job 成功后准备 **GitHub Release 草稿**；由人编辑并点击正式发布。
5. 预发布版本正式发布后仍保留预发布标记；仓库工作流自行发布的 Release 显示为外部已发布。
6. 没有新增提交时跳过；同名标签不会移动或删除。

## 7. 定时与失败处理

- `manager.check` 定时计划到期，作为一个可过滤事件交给 Manager。
- 默认分支的 Actions 失败可以被扫描、分类，并在安全时**只重跑一次**；失败不会无限重跑。
- 后台对账、待发送的容器操作、外部转发失败写入控制面日志；同一失败只在第一次、原因变化和恢复时各记一行。

## 8. 失败分类

失败详情会归入：外部服务/网络、GitHub 权限或配置、GitHub 拒绝、模型、项目电脑、仓库内容、任务条件变化、GitHub 写入结果未知、Bot 自身。这个分类不是装饰：它决定是否重试、在哪里停下、给人看什么下一步。
