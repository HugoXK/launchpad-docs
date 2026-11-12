# Architecture

## 1. Processes and entry points

The control plane is one process, `src/main.ts`. It assembles:

1. Reads `BOT_MASTER_KEY_FILE` (32-byte master key) and opens `Store` (SQLite) (`src/main.ts:22-27`).
2. Builds `GitHubLogin` and validates the deployment default; a saved wizard configuration wins (`src/main.ts:29-40`).
3. Reads the manager token and builds `ManagerClient` and `ProjectService` (`src/main.ts:43-47`).
4. Loads repository automation YAML (`config/repositories/<owner>__<repo>.yml`); a malformed file **fails startup** instead of silently using defaults (`src/main.ts:49-52`).
5. Starts `TaskEngine`, `ExternalService`, installation sync, `ReleaseService`, `ActionsFailures`, public boards and the gate onboarding (`src/main.ts:53-66`).
6. `createControlPlane(...)` returns the only HTTP listener; `server.listen(8791, '0.0.0.0')` (`src/main.ts:67-69`). The host port is mapped by Compose and defaults to loopback.

All business paths share this listener: console, `/api/*`, GitHub OAuth, App callbacks, webhooks, external executors and public boards (`src/server.ts:130-326`). There is no second public port.

## 2. The path of one GitHub event

```
GitHub webhook
  → /hooks/github/<account>/<endpoint>   (verify signature; persist before ack)
  → deliveries / processed_deliveries    (deduplicate)
  → filtering (installation scope, project enabled, author identity,
               draft/closed object, head check, disabled event kind,
               no actionable work)
  → dispatch_events (unique event_key)
  → one Manager dispatch (create / continue / ignore, with a reason)
  → tasks + task_events
  → queue / claim → RoleRun → candidate → independent QA → Publisher
  → PR / comment / check / release record
```

Key points:

- **Persist before ack**: the delivery is stored before the webhook response; `event_key` makes it idempotent.
- **Manager only dispatches**: it creates, continues or ignores, and cannot widen the write scope or bypass control-plane conditions (`docs/workflows.md`).
- **Success comes only from a validated submit tool**, never from prose or an exit code (`docs/role-run.md`).
- **Reviews are `COMMENT` only**: no approve, no request changes, no merge.

## 3. Execution plane

`manager` is the only gateway between the control plane and Docker:

- It listens only on the container network at **8793**; the control plane calls it with `Bearer <base64(manager token)>` (`manager/server.mjs:8-30`).
- `/ready` is the only unauthenticated probe and returns `{ready}`; project APIs return `503 manager_not_ready` until recovery finishes.
- One long-lived container per repository; `dbot-<deployment>-<repo>-g<generation>` (`manager/projects.mjs:166`).
- `deployment` is the first 16 hex characters of the manager token's SHA-256 (`manager/main.mjs:11`), so two deployments on one host never take over each other's containers.
- Every RoleRun can also get its own container and network (`manager/run-environments.mjs`).

The `runner` inside a project computer is a **one-shot fixed entry with no network listener**: manager sends validated requests via `docker exec`; the caller cannot choose argv or a user. Limits: 48 KiB per write, 1 MiB per read, 1 MiB of command output.

## 4. Credentials and trust boundaries

| Credential | Where | Who can use it |
| --- | --- | --- |
| master key | `bot-keys` volume, read-only in the control plane | decrypts database secrets only |
| GitHub App private key / bot token / model key | SQLite ciphertext (AES-256-GCM + AAD) | control plane; project containers never see them |
| manager token | `internal-keys` volume | control plane → manager |
| run token `rrt_…` | hash only | the TaskToolGateway of one RoleRun |
| GitHub read-only token | issued on demand, short-lived | the model when it must read issues/PRs/CI |
| user OAuth token | encrypted | reads `/user` and binds identity |

The design rule: **the credentials that can write GitHub and the model keys stay in the control plane**. A project container asks the control plane over a loopback mailbox for a read-only token or a proxied model request.

## 5. Invariants

1. **One business entry**: console, login, callbacks and webhooks share one origin; there is no separate "admin port".
2. **Persist first, ack later**: webhooks and external forwards are written before they are confirmed.
3. **Idempotency**: `event_key`, `operation_id`, `request_id` and the task claim token are fencing points.
4. **Lease fencing**: the task claim, the RoleRun lease epoch and the run token stop an old execution from writing new state.
5. **No fabrication**: unknown cost stays unknown (not 0); missing capabilities are reported; failures are classified, not swallowed.
6. **No overreach**: reviews only comment; releases are drafts; external executors get no control-plane authority.

## 6. Data model

About 50 tables, grouped by responsibility:

| Group | Tables |
| --- | --- |
| Accounts and identity | `accounts`, `users`, `sessions`, `endpoints`, installation tables, `installed_repositories` |
| GitHub events | `deliveries`, `processed_deliveries`, `review_objects`, `review_sessions`, `review_summaries`, `review_updates` |
| Tasks and execution | `tasks`, `task_claims`, `task_logs`, `task_tools`, `task_metrics` |
| Projects and policy | `repositories`, `policies`, `project_environments`, `environment_operations` |
| Models and cost | `models`, `model_projects`, `model_requests`, `model_pricing` |
| Releases and automation | `bot_branches`, `bot_pull_requests`, `bot_pr_requests`, `project_releases`, `automation_runs` |
| Collaboration and external | `channels`, `external_identities`, `external_clients`, `schedules` |

SQLite runs in WAL with `synchronous=FULL`; writes are serialised in one process. It fits a single-host control plane, not a distributed database.

## 7. Relation to upstream docs

This page is a structured restatement with independent annotations of the upstream `docs/architecture.md`, `docs/workflows.md` and `docs/role-run.md`. The upstream pages are deeper, especially on the RoleRun protocol, Harness Runtime, identity authorisation and onboarding.
