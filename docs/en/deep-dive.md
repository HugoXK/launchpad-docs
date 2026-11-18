# Deep dive

This page follows one event from dispatch to delivery and names the boundaries behind it.

## Dispatch and the project manager

- Incoming events are filtered; eligible events are recorded in `dispatch_events`.
- The dispatcher evaluates standing rules first. If none matches, the project Manager chooses `create_task`, `continue_task` or `ignore_event`. The control plane validates the choice and records refusals instead of creating disallowed work.
- A task keeps its goal, acceptance criteria, candidate and delivery authority in its records.

## Tasks, roles and the runtime

- A task proceeds through the existing task engine. For development and ordinary requests, the project controller delegates role runs, nominates a delivery, then independent QA evaluates it before the existing publisher path.
- A role run ending is not task completion. Delivery still depends on a formal candidate, independent QA and the publication flow.
- Role definitions are revision-checked full definitions that reference pinned model, skill, harness, environment, budget and output-schema versions. A run stores an immutable snapshot.
- A `(task, role)` `RoleInstance` persists across assignments; each delegation is an `assignment_id`, and each attempt is a `task_runs` row. Assignment alone does not grant write authority; revocation blocks the next capability call.

## Project computers and infrastructure

- Each repository has one long-lived project computer/container and work volume, reused across tasks rather than created per task. Tasks run concurrently up to the configured project parallelism.
- The manager serializes lifecycle operations such as stop, reset and configure against runner calls.
- Task workspaces use task directories and Git worktree selection: write tasks get their own worktree; read-only work may reuse a clean matching one. Worktree bindings record the task, workspace and commit.
- Containers use a read-only root filesystem and dropped capabilities, with a writable project volume and explicit mounts. Readiness is verified through the runner protocol, not just Docker's running state.

## Scheduling, actions and releases

The schedule service and subscriptions decide when work starts. Actions failure analysis turns a failing workflow into a trigger, and releases feed the public board.

## Management plane

- The management assistant is a service role, distinct from a project task role. Its console and Feishu direct messages share the same agent and tool catalog; group assistants use their own service-role bindings and scopes.
- `ManagementService` checks the actor's current authority and project scope, validates project, installation and credential state, revision-checks commands and returns receipts. Uncertain external effects are reconciled rather than blindly repeated.
- Management reads query existing task and configuration records. Writes go through the command service, not direct SQL or shell access.

## Web console

The console splits into the app shell (routing and scope), the project/board/task views, and settings for identity and installations.

## Testing

Unit and integration tests cover the dispatch and role contracts; end-to-end and UI tests cover the console.

## Glossary

- **Project**: one repository's long-lived work environment.
- **Task**: one unit of work with a goal, acceptance criteria and delivery authority.
- **Role**: a pinned configuration for one kind of run.
- **Role instance**: the persistent `(task, role)` record across assignments.
- **Task run**: one attempt with its recovery mode and snapshot.
- **Candidate**: the artifact independent QA evaluates.
- **Project computer**: the container and work volume behind one repository.
- **Management plane**: the service role and command path, separate from project tasks.
