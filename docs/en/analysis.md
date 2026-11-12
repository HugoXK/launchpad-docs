# Independent analysis

> Baseline: `agent-CI-Infra/bot` `main@95231e8` (2026-11-12). Method: read the official `docs/`, inspect the entry points, security primitives, migrations, task engine, RoleRun, manager and runner, and deploy it on a server. **Not** a line-by-line audit and not a penetration test.

## 1. What problem it solves

Most "AI changes code" products stop at "give an Agent a repository and let it open a PR". LaunchPad does three more things:

1. **Keeps authority in the control plane**: repository containers hold no GitHub write credentials and no model keys; when the model needs GitHub it exchanges a short-lived read-only token.
2. **Separates "finished" from "accepted"**: a normal executor exit is not acceptance. A candidate passes independent QA, the contract, publish preconditions and GitHub write validation.
3. **Makes the flow an auditable state machine**: persist before ack, task claims, a lease epoch per execution, a record per action.

It is closer to a **department-level engineering pipeline** than to a chat bot.

## 2. What is genuinely good

### 2.1 One entry + one source of truth

- One HTTP listener serves console, login, callbacks and webhooks (`src/main.ts:67-69`); no second admin port.
- SQLite + persist before ack; `deliveries` / `processed_deliveries` / `dispatch_events` form an idempotent chain.
- Cost, tasks, board and audit project from the same database instead of maintaining separate stores.

### 2.2 Credential layers

- `SecretBox`: AES-256-GCM + AAD bound to the record (`src/core/security.ts:47-61`). Stronger than "encrypt the key", because it stops ciphertext from moving between records.
- Master key, manager token, run token, read-only token and user OAuth token each have their own lifetime and exposure.
- Run tokens are stored as hashes, bound to epoch and capabilities; an old epoch is invalid immediately.

### 2.3 Fencing instead of trust

- The task claim token is written into SQL fences; an old execution cannot overwrite new state (`src/agent/engine.ts:189-214`).
- The RoleRun lease epoch makes "restart/takeover" provable; sequence rollback, gaps, duplicates and late events are rejected.
- Publishing pins one workspace snapshot; tests run after the snapshot and test artifacts never enter the PR.

### 2.4 Automation modules are pure functions

`src/automation/` modules for labels, gates and merge queue do not reach the network or write the database; they emit actions. Rules can be replayed against fixed events. That is the right shape for testable operations policy; many similar systems write rules into YAML + scripts and lose replayability.

### 2.5 Honest failure taxonomy

Failures are classified as external fluctuation / GitHub permission / GitHub rejection / model / project computer / repository content / condition changed / unknown write result / the Bot itself. The class decides retry, stop point and what a person sees. That is closer to operability than "retry three times".

### 2.6 Documentation density

Upstream `docs/` covers onboarding, rules, deployment, identity, RoleRun, Harness, gates, releases, external executors, management conversations and Feishu. For a system this size, that is rare.

## 3. Boundaries and weaknesses

### 3.1 It still trusts the host

The manager mounts `/var/run/docker.sock`. **A compromised manager equals host root.** Container isolation, read-only roots and non-root users matter, but they do not change that fact. It is a reasonable trade-off for a single team's self-hosting; it is not enough for multi-tenant SaaS.

### 3.2 The model remains the largest uncertainty

The system can constrain untrusted output behind `create_pull_request` and QA, but it cannot guarantee the model never makes a wrong, syntactically valid change. Prompt injection, overfitting to tests and wrong abstractions remain. Pinned commits, snapshots, contracts and independent QA reduce probability, they do not eliminate it.

### 3.3 Single-host SQLite

WAL + FULL fits one control plane. It has no distributed lock, no read replica and no online-migration guarantee. As projects and events grow, write amplification and WAL growth become operational issues. That is a choice boundary, not a defect.

### 3.4 Complexity concentrates in `src/agent/engine.ts`

About 965 lines handling task state, the model loop, tools, GitHub publishing and recovery. It is the heart and the hardest file to change. Splitting publishing, recovery and the tool gateway further would reduce cognitive load.

### 3.5 Supply chain and images

Default `latest` is convenient, but production should pin digests/versions. The docs do not emphasise image signature verification; executors (Pi, Claude Code, ACP, Codex) also need pinned versions and checksums.

### 3.6 Operational threshold

It requires Docker, a public HTTPS entry, permission to create a GitHub App, a model key and a tunnel/reverse proxy. The seven-step wizard is good, but it is still not "one click". For a non-engineering team the threshold is high.

## 4. Maturity score (subjective, evidence-based)

| Dimension | Score | Reason |
| --- | --- | --- |
| Architectural clarity | 8/10 | clear planes, one entry, explicit state machine; `engine.ts` is large |
| Security design | 7/10 | credential layers, AAD, tokens, fencing; Docker socket is a hard boundary |
| Testability | 8/10 | pure-function automation, offline tests, fake GitHub/model, Playwright |
| Operability | 7/10 | health checks, failure taxonomy, logs, backups; single-host SQLite |
| Documentation | 9/10 | broad and current; some pages are long |
| Scalability | 6/10 | one control plane, one host; multiple instances need manual isolation |
| Onboarding cost | 6/10 | seven-step wizard + infrastructure requirements |
| Product completeness | 7/10 | review/develop/release/gates are complete; UI and boundaries still evolving |

**Overall: 7.3/10.** A serious, runnable, auditable engineering Bot for one team; not an out-of-the-box multi-tenant platform.

## 5. Positioning vs FlyBot and Fledge

| | LaunchPad (this project) | FlyBot | Fledge |
| --- | --- | --- | --- |
| Core | department GitHub App + control plane | a team of long-lived Bots on DSH | hosted repositories that grow themselves |
| Unit of work | issue/PR event → task → role run | Bot sessions, groups, tasks | Job → reviewable PR |
| Authority | GitHub App installation + derived human grants | human owner, Main Bot, tree | GitHub login + repo connection |
| Isolation | per-repo computer + per-run container | DSH Session/tools | container Job |
| Strongest | engineering pipeline, audit, gates | multi-Bot collaboration and memory | self-service onboarding, one PR per job |
| Largest risk | Docker socket / model | multi-Bot authority and context bleed | hosted multi-tenant isolation |

They are complementary: LaunchPad is closer to an organisation-level CI/Bot control plane, FlyBot to a Bot-team runtime, Fledge to a hosted self-iterating service.

## 6. Recommendations (by priority)

### P0 (before adoption)

1. **Pin images and executors**: `BOT_IMAGE_TAG`, Pi/Claude/ACP versions, checksums; review upgrades.
2. **Treat the manager as T0**: a dedicated host or at least a dedicated Docker daemon; restrict host access; audit container operations.
3. **Rehearse backups**: back up the four volumes together and restore once; a database backup without `bot-keys` is useless.
4. **Egress allowlist**: restrict model URLs and external forwarding away from private networks/redirects; prevent SSRF.

### P1 (soon after adoption)

5. **Split `engine.ts`**: publishing, recovery and the tool gateway; add state-machine invariant tests.
6. **Prompt-injection red team**: add "repository content tricks the model into commands or leaking context" cases to CI.
7. **WAL and write-amplification monitoring**: observe before task volume grows; move read projections out if needed.
8. **Audit retention**: define retention, export and tamper-evident storage.

### P2 (productisation)

9. **Multi-instance deployment template**: health checks, tunnel, resource limits and upgrade scripts in one place.
10. **Public-board preview before publish**: off by default + an explicit consent UI.
11. **Finer per-repository budgets**: model/CI/container cost caps.
12. **A visible "why it did not develop"**: make the Manager's `ignore` reasons a filterable metric.

## 7. Open questions

- How many organisations/repositories is one control plane meant to serve? At what tasks/day does SQLite need replacing?
- Should project admins provide their own model URLs? If so, where is the SSRF boundary?
- Should external executors have trust levels (read-only review vs write-capable development)?
- Will the public board become a "public by default" privacy risk?
- Should releases allow automatic prerelease publishing, or always keep the human click?

## 8. Conclusion

The value of LaunchPad is not "letting a model write code"; it is **turning model-written code into an auditable, revocable, refusable engineering process**. Its choices — one entry, credential layers, persist-first, fencing, pure-function automation, honest failure taxonomy — are mature. The price is operational overhead and the Docker-socket hard boundary.

**For an engineering team willing to run a Docker host and a GitHub App, it is worth adopting. If you want multi-tenant SaaS or zero operations, it is not that product yet.**
