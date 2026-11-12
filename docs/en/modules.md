# Code map

Baseline: `main@95231e8`. `src/` is about 22,000 lines of TypeScript (excluding the `public-board/dashboard` and `static/` assets). Below is the directory map and the files worth reading first.

## `src/` — control plane

| Directory | Responsibility | Read first |
| --- | --- | --- |
| `core/` | primitives: random ID, SHA-256, password hashing, HMAC, `SecretBox` | `security.ts` |
| `storage/` | SQLite open, PRAGMAs, migrations, transactions, audit | `database.ts` |
| `main.ts` / `server.ts` | assembly and the only HTTP entry; routing, auth, CSP, static assets | `main.ts`, `server.ts` |
| `app/` | accounts/login, installation sync, models and project list, webhook normalisation, management API | `installations.ts`, `webhook.ts`, `models.ts` |
| `agent/` | task engine, model loop, tool gateway, Git mirror cache, read tokens, workspace, failure taxonomy | `engine.ts`, `loop.ts`, `gateway.ts`, `read-token.ts` |
| `tasks/` | tasks, task runs, candidates, contracts, records, acceptance and publish preconditions | `records.ts`, `contract.ts`, `candidate.ts` |
| `roles/` | role definitions, RoleRun protocol, leases/tokens/events/checkpoints, TaskToolGateway, scheduling | `protocol.ts`, `role-run.ts`, `run.ts`, `gateway.ts` |
| `harness/` | executor adapters: Native, Process, ACP, Codex app-server, Claude Code | `session.ts`, `acp.ts`, `app-server.ts`, `claude-code.ts` |
| `dispatch/` | project Manager event dispatch (create/continue/ignore) | `manager.ts`, `worker.ts`, `store.ts` |
| `review/` | review triggers, queue, position validation, one summary comment | `queue.ts` |
| `github/` | GitHub client, publish outbox, rate limits, release labels, text cleanup | `client.ts`, `publisher.ts`, `rate-limits.ts` |
| `automation/` | pure-function modules: labels, gates, merge queue; repository YAML | `engine.ts`, `registry.ts`, `config.ts`, `modules/*` |
| `projects/` | environment gateway (manager calls), gate onboarding, integration checks | `service.ts`, `gate-onboarding.ts`, `gate-plan.ts` |
| `identity/` | GitHub login, derived authorisation, external identity binding, permission checks | `authorization.ts`, `github-login.ts`, `github-permissions.ts` |
| `installations/` | installation archive, projection and sync | `archive.ts`, `projection.ts` |
| `external/` | external executors: signing, forwarding, identity, targets, events | `broker.ts`, `forward.ts`, `identity.ts` |
| `releases/` | release: tags, Release workflow tracking, notes, state | `service.ts`, `worker.ts` |
| `actions/` | Actions failure scan, classification, one retry, reporting | `service.ts`, `classifier.ts`, `safety.ts` |
| `board/` | work board API and storage | `api.ts`, `storage.ts` |
| `channels/` | Feishu and other message channels, binding, connections, send queue | `service.ts`, `feishu.ts`, `binding.ts` |
| `schedules/` | scheduled plans and worker | `service.ts`, `worker.ts` |
| `memory/` | project memory, scopes, retrieval | `store.ts` and peers |
| `metrics/` | task duration, tokens, cost | `*.ts` |
| `public-board/` | public board (single repository) | `service.ts` |
| `onboarding/` | seven-step wizard, public URL, Tunnel checks | `service.ts`, `public-url.ts` |
| `work/` | work kinds, settings, migration, events | `settings.ts`, `migration.ts` |
| `management/` | management conversation/service | `service.ts` |
| `rules/` | built-in rule text and version | `*.ts` |

## `manager/` — execution gateway (~1,500 lines of JavaScript)

| File | Responsibility |
| --- | --- |
| `main.mjs` | read manager token, compute deployment id, start HTTP |
| `server.mjs` | `/ready` probe, Bearer auth, project/file/note/stats/run-environment APIs |
| `docker.mjs` | thin Docker Engine wrapper with controlled errors |
| `projects.mjs` | per-repository container create/stop/reset/execute, generations, volumes, derived images, recovery |
| `run-environments.mjs` | isolated container and network per RoleRun |

The manager is the only component with `/var/run/docker.sock`. **This is the largest privilege surface in the system**; see [Security](security.md).

## `runner/` — inside the project computer (~1,100 lines)

| File | Responsibility |
| --- | --- |
| `runner.mjs` | one-shot, no-listener entry; validate, execute, write a journal |
| `workspace.mjs` | relative paths, reads/writes, commands, Git candidates |
| `store.mjs` | journal and output files |
| `pi-entry.mjs` | Pi SDK entry |
| `repository-context.mjs` / `repository-tool.mjs` | controlled repository reads |
| `token-exchange.mjs` | exchange for a read-only token at the control plane |

## Other

| Path | Content |
| --- | --- |
| `static/` | console front end (plain JS/CSS, no framework) |
| `public-board/dashboard/` | dashboard workspace for the public board |
| `config/repositories/` | repository YAML: labels, gates, merge queue, CI lanes |
| `webhook/` | fixed gateway between the tunnel and the control plane |
| `images/project/` | project-computer image build context |
| `scripts/` | test-set runner, API docs generation, protocol lock, checks |
| `test/` | `node:test` suites, fixtures, fake GitHub/fake model |
| `e2e/` | Playwright browser acceptance |

## Suggested reading order

1. `src/main.ts` → `src/server.ts`: assembly and the only entry.
2. `src/storage/database.ts`: tables and migrations; understand "persist first".
3. `src/app/webhook.ts` → `src/dispatch/*`: how an event becomes a task.
4. `src/agent/engine.ts` → `src/tasks/*` → `src/github/publisher.ts`: how a task becomes a PR.
5. `src/roles/*`: RoleRun, leases and isolation.
6. `src/identity/*` and `src/core/security.ts`: trust boundaries.
