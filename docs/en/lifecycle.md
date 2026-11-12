# Lifecycle

## 1. Event: from webhook to task

A GitHub event goes through **deterministic filtering** before it reaches the Manager:

1. **Verify and persist**: `/hooks/github/<account>/<endpoint>` checks the HMAC; the delivery is written to `deliveries` before the response.
2. **Deduplicate**: `processed_deliveries` and `dispatch_events.event_key`.
3. **Scope**: installation scope, project enabled, the commenter is the object author or `OWNER`/`MEMBER`/`COLLABORATOR`, draft/closed object, PR head change.
4. **Switches**: event kinds the project disabled; an event whose every possible work kind is off never reaches the Manager.
5. **Manager dispatch**: the model reads the event summary, recent tasks and options, and returns `create` / `continue` / `ignore`, **always with a reason**.
6. **One transaction**: create the task, continue, record the reason, notify the module.

The Manager can only choose options the control plane has computed. It cannot widen the write scope or bypass "one revision at a time" / revision budgets (`docs/workflows.md`).

## 2. Task: queue, claim, execution

Typical states:

```
queued → preparing → running → implementing → validating
       → publishing → result_ready → done
              ↘ failed / cancelled / superseded / needs_replan
```

- **Queue and claim**: `task_claims` holds `(task_id, repo, token, claimed_at)`; the claim token fences writes, so an old execution cannot overwrite new state (`src/agent/engine.ts:119-126`).
- **Retry**: model network failures back off; persistent failures enter an 8-hour per-task retry cycle; rate limits wait on their own window.
- **Cancel/takeover**: a new claim invalidates the old token; the old execution may only record its own cancellation (`src/agent/engine.ts:189-214`).
- **Business success** comes only from a validated submit tool, never from prose or an exit code.

## 3. Role execution: RoleRun

A RoleRun is **one execution attempt of one assignment**, not a second task system (`docs/role-run.md`).

| Stage | What happens |
| --- | --- |
| `prepare` | assemble snapshot, tools, budget; run admission; return required/declared/verified/missing capabilities |
| `start` | allocate lease epoch and run token; idempotent by operation id |
| `events` | up to 500 normalised events with a cursor |
| `checkpoint` | session reference, tool receipts, workspace snapshot |
| `cancel` | interrupt the session, wait briefly; on timeout record `stopped/cancel_timeout`, release the container and revoke the token |
| `collect` | validate result, candidate ref, RunContext |
| `recover` | a new run of the same role instance (new id, new epoch) from a checkpoint |

Fences:

- **lease epoch**: monotonic per task; a new run takes over and the old token is revoked immediately. Old-epoch tool calls, events, checkpoints and results are rejected with `lease_epoch_stale`.
- **run token `rrt_…`**: stored only as a hash, bound to tenant/project/task/run/epoch/capabilities; 15 minutes, renewed every minute while the control plane holds the run.
- **TaskToolGateway**: every call re-checks token binding, epoch, run state, tenant/project, the initiator's current authority and the role policy.
- **Secret scan**: `assertSecretFree` runs before writing RunContext, events and checkpoints; secret-shaped keys/values are rejected.

## 4. Candidates, QA and publishing

1. **Candidate**: a writer submits a `CandidateRef`: `code` (commit + tree hash), `artifact` (revision + content hash) or `no_changes`.
2. **Independent QA**: QA evaluates the candidate with a clean context; a normal executor exit is not acceptance.
3. **Publish preconditions**: `create_pull_request` is available only when the task reaches a publishable phase; the control plane pins one workspace snapshot and then runs the project's policy tests.
4. **Publish**: the control plane validates the diff position, head and bot-branch ownership, pushes and opens a PR; the same issue reuses the same bot branch and PR.
5. **Review**: `COMMENT` only; no automatic merge. Another review bot's reasonable finding may be addressed once (`README` and `docs/rules.md`).

## 5. Per-repository virtual computer

| Operation | Behaviour |
| --- | --- |
| register/start | manager creates container, volumes and network; workspace prepared from a pinned commit |
| busy | requests are executing; more requests may still arrive within the concurrency limit |
| stop | stop the container, keep the volumes; a later start reuses the generation and data |
| reset | stop old generation → generation+1 → new volumes/container/network; failure enters `reset_failed` and needs a manual retry |
| delete | remove managed containers and networks only; keep work and note volumes |
| recover | after a manager restart, stop uncertain executions, mark them interrupted, then recover `ready` on the same generation |

One repository still has one computer; concurrent tasks share CPU/memory/process/`/tmp` limits. The project notes volume survives stop, rebuild, disable and generation reset, and is deleted with the project.

## 6. Releases

1. A super admin or project admin enters a version (`v1.2.3`, `v1.2.3-beta.1`).
2. The version must be higher than the previous reachable tag, the repository must have CI gates and a tag-triggered `release.yml`.
3. The control plane creates an **annotated tag** with an installation token and tracks the Release workflow.
4. When every job succeeds it prepares a **GitHub Release draft**; a person edits and publishes it.
5. A prerelease stays marked as prerelease after publishing; a Release published by the repository's own workflow is shown as externally published.
6. No new commits → skip; a tag with the same name is never moved or deleted.

## 7. Schedules and failures

- A `manager.check` schedule due is a filterable event dispatched to the Manager.
- A failed default-branch Actions run can be scanned, classified and **retried once** when safe; it never loops.
- Reconciliation, pending container operations and external-forward failures are logged; the same failure is logged on first occurrence, on a reason change and on recovery, not every 5 seconds.

## 8. Failure taxonomy

Failure details are classified as: external service/network, GitHub permission or configuration, GitHub rejection, model, project computer, repository content, task condition changed, unknown GitHub write result, or the Bot itself. The class decides retry, stop point and what a person sees next.
