# LaunchPad 文档与深度分析

[agent-CI-Infra/bot](https://github.com/agent-CI-Infra/bot) 的独立分析、架构说明与运维文档。

- 在线阅读：<https://launchpad-docs.hugoxk.online/>
- 服务入口：<https://launchpad.hugoxk.online/>
- 上游仓库：<https://github.com/agent-CI-Infra/bot>
- 分析基线：`main@95231e8`（2026-11-12，浅克隆），并对照官方 `docs/` 与源码目录。

## 这套文档是什么

这不是上游 README 的副本。它回答四个问题：

1. **它是什么**：部门公共 GitHub App、控制面和每仓库一台虚拟电脑如何组成一个系统。
2. **它怎样工作**：一个 Issue/PR 事件如何变成任务、角色运行、候选、QA、PR 和发布。
3. **它安全吗**：凭据、令牌、容器、GitHub 权限与信任边界分别在哪里。
4. **它哪里还不够**：独立的风险清单、成熟度评估和下一步建议。

## 文档地图

| 文档 | 内容 |
| --- | --- |
| [概览](docs/index.md) | 产品定位、三个平面、关键数字 |
| [架构](docs/architecture.md) | 组件、请求流、数据流、关键不变量 |
| [代码地图](docs/modules.md) | `src/`、`manager/`、`runner/` 的职责 |
| [生命周期](docs/lifecycle.md) | 事件、任务、RoleRun、环境、发布 |
| [GitHub 集成](docs/github.md) | App 权限、Webhook、门禁、合并队列、发版 |
| [安全模型](docs/security.md) | 凭据、令牌、隔离、威胁与风险 |
| [部署与运维](docs/deployment.md) | Compose、卷、端口、变量、备份、本实例 |
| [独立分析](docs/analysis.md) | 优势、边界、风险、对比、成熟度与建议 |

## 构建

```sh
npm install
npm run build          # 生成 site/
```

站点是纯静态 HTML，无前端框架。

## 许可

上游 `agent-CI-Infra/bot` 采用 Apache-2.0。本仓库只包含独立撰写的分析与文档；引用上游代码时保留出处。
