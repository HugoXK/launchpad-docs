# GitHub integration

## 1. What the GitHub App is

LaunchPad works as a GitHub App, not as a personal PAT:

- The control plane signs a JWT with the App private key and exchanges it for an **installation token** scoped to the target repository.
- Installation scope, repository list and permissions come from GitHub. The control plane reconciles every 10 minutes; installation events update it immediately.
- User OAuth is only for login and identity verification; the user token reads `/user` only and never enters the model context.

Permissions the App expects (`docs/admin.md`):

| Kind | Permission |
| --- | --- |
| write | Contents, Issues, Pull requests, Commit statuses, Actions, Checks |
| read | Metadata, Members |
| events | `issues`, `pull_request`, `issue_comment`, `pull_request_review`, `pull_request_review_comment`, `organization` |

Actions/Checks write is used to publish statuses, checks and re-runs; read access lets a task inspect CI through a read-only token.

## 2. Webhooks

- Entry: `https://<your-domain>/hooks/github/<account_id>/<endpoint_id>`.
- Signature: `X-Hub-Signature-256`, HMAC-SHA256, `sha256=` + 64 hex, compared with `timingSafeEqual` (`src/core/security.ts:41-45`).
- Idempotency: persist before ack; duplicate deliveries are deduplicated by event key.
- Only project-relevant scope is accepted; outsiders, content the bot wrote itself (except another review bot on the bot's own PR), drafts and closed objects are filtered out.

## 3. Review behaviour

- A new issue receives one review summary comment; later reviews **edit that comment** instead of posting again.
- A PR is reviewed when opened, when marked ready for review, and when the head moves; drafts are not reviewed.
- An administrator can disable a trigger per repository.
- The bot only comments: **no approve, no request changes, no merge**.
- With development disabled, the bot never edits code for an issue. With it enabled, a person (not the App) adds the development label (default `bot-develop`) and the Manager decides whether it can develop; if not, the issue says what is missing.

## 4. Overriding rules from the repository

The default branch may carry `.bot/` files that override review, label, development rules and virtual-computer configuration. **Repository files win over built-in defaults and over the administrator's console settings**; paths, formats and limits are in upstream `docs/rules.md`. An organisation can tune one repository without changing control-plane code.

## 5. Repository automation: modular gates

`src/automation/` is "framework + pluggable modules + per-repository config" (`docs/automation.md`):

- Modules are **pure functions**: input is the event, the repository YAML and verifiable facts; output is a list of actions. They do not reach the network or write the database.
- Built-in modules: `labels.ts` (label lint, PR status), `gate.ts` (ready-label guard, merge-gate status), `merge-queue.ts`.
- Repository config: `config/repositories/<owner>__<repo>.yml`; loaded at startup. A bad filename, a duplicate or a misspelled field **fails startup**.
- Rules can be replayed against fixed events and cannot corrupt GitHub state by accident.
- Results go to `automation_runs`; a module failure is recorded per module.

## 6. CI gates and the merge queue

"Onboard gates" introduces the lanes:

| Lane | When |
| --- | --- |
| `pr-ready` | every PR commit: build and basic checks |
| `pr-merge` | merge gate: inside the merge queue when present; otherwise after merge, re-running pr-ready before expensive checks |
| `daily` | daily |
| `release` | triggered by a version tag |

The onboarding is not a blind overwrite: an agent examines the existing CI and agrees each lane's commands with a person. After the person previews the added/changed files, the control plane creates the gate PR with the gate job, `.github/ci-gates.json`, missing `scripts/gate/gate.mjs` and a tag-triggered `release.yml`. Existing files are merged according to the plan.

An empty lane's `not_applicable` **does not** mean the check passed. The control plane does not publish PyPI, npm packages or images.

## 7. Releases

See [Lifecycle · Releases](lifecycle.md#6-releases). In short: annotated tag, track the Release workflow, prepare a draft, a person publishes; a tag is never moved or deleted; no new commits means skip.

## 8. Rate limits and quota

"Global settings → bot accounts → GitHub request quota" lists the hourly quota per account:

- One per GitHub App installation per organisation/personal account, shared by all repositories and task agents in that organisation.
- One per Token account, by the token owner.
- Each row shows quota, used, remaining, window reset and the number of tasks waiting on the rate limit.
- "Probe" reads once immediately; the read window itself does not count, but listing installations and minting installation tokens spend App (JWT) requests.

When the quota is exhausted the task waits for the window reset; it does not consume a retry.

## 9. Identity and authorisation

- One tenant is one numeric GitHub owner account ID; one project is one numeric repository ID. Names are display only.
- GitHub identity is keyed by provider + host + numeric user ID; same name or email never auto-merges.
- A derived grant is valid for 5 minutes; login, refresh and writes re-verify; a reconciliation runs every minute.
- An authorisation change bumps `authorization_revision`; a stale write returns `409 authorization_changed`.
- Platform super admins have recovery and explicit delegation; `org_admin` / `project_admin` never gain platform capabilities.
- An organisation owner must be proved as `active/admin`; App permissions, installation events and historical actors **never** constitute human authority.

The core of the model: **human authority comes from verifiable GitHub evidence, not from the bot's installation token.**
