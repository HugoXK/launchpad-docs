# 深入实现

这一页跟着一个事件从派发走到交付，并标出背后的边界。

## 派发与项目 Manager

- 进入的事件先被过滤；合格事件记录在 `dispatch_events`。
- 派发器先看 standing rules。没有匹配时，项目 Manager 选择 `create_task`、`continue_task` 或 `ignore_event`。控制平面校验选择，并把拒绝记录下来，而不是创建不该创建的工作。
- 任务记录保留目标、验收标准、候选和交付权限。

## 任务、角色与运行时

- 任务走既有 task engine。开发和普通请求由项目 controller 委派角色运行、提名交付，然后独立 QA 评估，再进入既有 publisher 路径。
- 角色运行结束不等于任务完成。交付仍取决于正式候选、独立 QA 和发布流程。
- 角色定义是带 revision 的完整定义，引用固定版本的 model、skill、harness、environment、budget 和 output schema。每次运行保存不可变快照。
- `(task, role)` 的 `RoleInstance` 跨分配持久存在；每次委派是 `assignment_id`，每次尝试是 `task_runs` 行。分配本身不授予写权限；撤销会阻止下一次能力调用。

## 项目电脑与基础设施

- 每个仓库有一台长期存在的项目电脑/容器和工作卷，跨任务复用，而不是每个任务新建。任务在配置的项目并行度内并发。
- Manager 把 stop、reset、configure 等生命周期操作与 runner 调用串行化。
- 任务工作区用任务目录和 Git worktree：写任务有自己的 worktree；只读工作可以复用干净的匹配 worktree。worktree 绑定记录任务、工作区和提交。
- 容器使用只读根文件系统和丢弃的 capabilities，工作卷可写，挂载显式声明。就绪通过 runner 协议验证，而不只是 Docker 的 running 状态。

## 计划、Actions 与发布

计划服务和订阅决定工作何时开始。Actions 失败分析把失败的 workflow 变成触发器，发布则进入公开看板。

## 管理平面

- 管理助手是服务角色，独立于项目任务角色。它的控制台和飞书私信共享同一个 agent 和工具目录；群助手使用各自配置的服务角色绑定和范围。
- `ManagementService` 检查操作者当前权限和项目范围，校验项目、安装和凭据状态，命令带 revision 且幂等，并返回 receipt。不确定的外部效果会对账，而不是盲目重试。
- 管理读取查询既有任务和配置记录。写操作走命令服务，而不是直接 SQL 或 shell。

## Web 控制台

控制台分为 app shell（路由与范围）、项目/看板/任务视图，以及身份和安装设置。

## 测试

单元与集成测试覆盖派发和角色契约；端到端与 UI 测试覆盖控制台。

## 术语

- **Project**：一个仓库的长期工作环境。
- **Task**：一个带目标、验收标准和交付权限的工作单元。
- **Role**：一类运行的固定配置。
- **Role instance**：跨分配的 `(task, role)` 持久记录。
- **Task run**：一次带恢复模式和快照的尝试。
- **Candidate**：独立 QA 评估的产物。
- **Project computer**：一个仓库背后的容器和工作卷。
- **Management plane**：独立于项目任务的服务角色与命令路径。
