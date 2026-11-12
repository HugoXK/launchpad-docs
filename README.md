# LaunchPad Docs / LaunchPad 文档

Independent documentation and a deep analysis of [agent-CI-Infra/bot](https://github.com/agent-CI-Infra/bot) — the department GitHub App and control plane behind **LaunchPad**.

- Site / 站点: <https://launchpad-docs.hugoxk.online/>
- 中文: <https://launchpad-docs.hugoxk.online/>
- English: <https://launchpad-docs.hugoxk.online/en/>
- Service / 服务: <https://launchpad.hugoxk.online/>
- Upstream: <https://github.com/agent-CI-Infra/bot>
- Origin: <https://github.com/HugoXK/LaunchPad>
- Analysis baseline: origin `HugoXK/LaunchPad`, upstream `agent-CI-Infra/bot` `main@95231e8` (2026-11-12).

## What this is / 这是什么

Not a copy of the upstream README. It answers four questions / 这不是上游 README 的副本，它回答四个问题：

1. **What it is / 它是什么** — the GitHub App, control plane and one virtual computer per repository.
2. **How it works / 它怎样工作** — an issue/PR event becomes a task, role run, candidate, QA, PR and release.
3. **Is it safe / 它安全吗** — credentials, tokens, containers, GitHub permissions and trust boundaries.
4. **Where it falls short / 它哪里还不够** — an independent risk list, maturity assessment and next steps.

## Site map / 文档地图

| 中文 | English |
| --- | --- |
| [概览](docs/zh/index.md) | [Overview](docs/en/index.md) |
| [架构](docs/zh/architecture.md) | [Architecture](docs/en/architecture.md) |
| [代码地图](docs/zh/modules.md) | [Code map](docs/en/modules.md) |
| [生命周期](docs/zh/lifecycle.md) | [Lifecycle](docs/en/lifecycle.md) |
| [GitHub 集成](docs/zh/github.md) | [GitHub integration](docs/en/github.md) |
| [安全模型](docs/zh/security.md) | [Security](docs/en/security.md) |
| [部署与运维](docs/zh/deployment.md) | [Deployment](docs/en/deployment.md) |
| [独立分析](docs/zh/analysis.md) | [Analysis](docs/en/analysis.md) |

The built site also mirrors the origin's `docs/` at `/origin/` and regenerates `/docs/snapshot/` on every build.

## Build / 构建

```sh
npm install
LAUNCHPAD_DIR=../LaunchPad npm run build   # 需要 origin 检出；省略则跳过 upstream 镜像
```

The static site is written to `site/`.

## Update / 更新

The server rebuilds daily from the origin and this repository (`~/work/launchpad-docs-update.sh`); the site is not pinned to a snapshot. See [deployment](docs/zh/deployment.md#6-上游origin-与每日更新).

## Licence / 许可

Upstream `agent-CI-Infra/bot` is Apache-2.0. This repository contains independently written analysis and documentation; upstream code is quoted with attribution.
