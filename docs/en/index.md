# Overview

**LaunchPad** (the deployment name; upstream repository `agent-CI-Infra/bot`) is a public bot for a GitHub organisation. It reviews issues and pull requests. When an administrator explicitly enables development, it implements an issue, runs tests and opens a pull request. It can also onboard CI gates and help with releases. It never merges a pull request and never ships a release on its own.

## One sentence

> One control plane + one long-lived Docker "virtual computer" per repository + optional external executors.

```
Browser / GitHub / external executor
          │  single HTTPS entry :8791
          ▼
┌──────────────────────────────────────────────┐
│ control plane "bot" (Node 22 + TypeScript)   │
│ console · OAuth · App callbacks · webhooks   │
│ model proxy · GitHub writes · queue · board  │
└───────┬───────────────────────────┬──────────┘
        │ manager token :8793       │ model / read-only GitHub token
        ▼                           ▼
┌──────────────────────┐   ┌───────────────────────────┐
│ manager (Docker)     │──▶│ per-repository computer    │
│ create/stop/reset    │   │ runner + pinned workspace  │
│ per-run containers   │   │ read · run · edit          │
└──────────────────────┘   └───────────────────────────┘
```

## Three planes

| Plane | Where | Does | Does not |
| --- | --- | --- | --- |
| Control | `bot` container, port 8791 | accounts, login, GitHub App, models, tasks, queue, webhooks, board, audit | run repository commands |
| Execution | `manager` + per-repo computer | container lifecycle, workspace, commands, files, per-run containers | hold GitHub write credentials or model keys |
| External | external executor / ACP / Codex / Claude Code | run an Agent elsewhere and return over a signed channel | gain control-plane authority |

## Key numbers

- `src/`: about **22,000 lines of TypeScript** at `main@95231e8`; the largest file is `src/agent/engine.ts` (~965 lines).
- Data: one SQLite database (`node:sqlite`), about **50 tables**; WAL, `synchronous=FULL`, `foreign_keys=ON`, 5 s busy timeout (`src/storage/database.ts:38`).
- Images: four GHCR images — control plane, project computer, computer manager, Cloudflare tunnel. `latest` by default; pin `BOT_IMAGE_TAG` to `v1.2.3` or `sha-<commit>`.
- Ports: business **8791**; manager **8793** (container network only); tunnel metrics **8794** (container network only); the old admin port 8792 is no longer published by the compose file.
- Node **>= 22.13**. Dependencies include `@agentclientprotocol/sdk`, `@anthropic-ai/claude-code`, `@larksuiteoapi/node-sdk`, `jose`, `marked`, `dompurify`, `yaml`.
- Licence: Apache-2.0.

## What it is not

- Not a new agent framework: the agent loop comes from a pinned Pi SDK / ACP / Codex / Claude Code.
- Not an auto-merge bot: reviews are `COMMENT` only and a person merges; releases are prepared as drafts and a person publishes.
- Not a fully isolated multi-tenant SaaS: one deployment is one control plane; projects are separated by containers, volumes and grants, and the host Docker socket remains the hard boundary.

## Reading order

First time: [Architecture](architecture.md), then [Lifecycle](lifecycle.md).
Deploy or operate: [Deployment](deployment.md) and [Security](security.md).
Deciding whether to adopt it: [Independent analysis](analysis.md).
