# Deployment and operations

## 1. Prerequisites

- Linux + Docker Engine + Compose v2.
- A public HTTPS entry (this deployment uses Cloudflare Tunnel).
- An account that can create/install a GitHub App in the organisation.
- A Chat Completions-compatible model: URL, key, model name.

The official recommendation is **not to build on this machine**: download `compose.yaml` and `docker compose up -d` to pull GHCR images. Build from source only when changing code (`compose.build.yaml`).

## 2. Compose services

| Service | Purpose | Port/network |
| --- | --- | --- |
| `key-init` | generate master.key and manager token, then exit | no network |
| `bot` | control plane: console, API, OAuth, webhooks, model proxy | host `BOT_PORT` → container 8791 |
| `manager` | Docker gateway: project computers, RoleRun containers | container network 8793 |
| `webhook` | fixed gateway from the tunnel to `bot:8791` | `control` + `edge` |
| `tunnel` | Cloudflare Tunnel (optional) | `edge` |
| `project-image` | pull the project-computer image, then exit | no network |

Volumes:

| Volume | Content | If lost |
| --- | --- | --- |
| `bot-data` | SQLite, Git mirrors, public boards | all control-plane data |
| `bot-keys` | `master.key` | saved credentials cannot be decrypted |
| `internal-keys` | manager token | control plane cannot reach manager |
| `manager-data` | virtual-computer ledger, note volumes | environment records and notes |
| `tunnel-keys` | Tunnel token | reconfigure the tunnel |

**Never `docker compose down -v`.**

## 3. Key environment variables

| Variable | This deployment | Meaning |
| --- | --- | --- |
| `BOT_PORT` | `8793` | host port → container 8791 |
| `BOT_BIND_ADDRESS` | `127.0.0.1` | reachable only through the local tunnel |
| `BOT_PUBLIC_ORIGIN` | `https://launchpad.hugoxk.online` | the only public entry |
| `BOT_COOKIE_SECURE` | `true` | HTTPS cookies |
| `BOT_IMAGE_TAG` | `latest` | pin a version in production |
| `BOT_PROJECT_EGRESS` | `true` (default) | project-container egress |
| `BOT_MENTION_NAMES` | `bot,agent-ci-infra-bot` | comment @-mentions |
| `BOT_GITHUB_API_URL` | `https://api.github.com` | change for GitHub Enterprise |
| `BOT_FORWARD_PRIVATE_HOSTS` | empty | external-forward private allowlist |

See upstream `docs/deployment.md` for the full list.

## 4. First configuration (seven-step wizard)

After the deployment is up, the home page shows:

1. **Create the first super admin**: username + 12–256 character password; succeeds once.
2. **Public HTTPS**: reverse proxy or Cloudflare Tunnel (this deployment uses the Tunnel).
3. **GitHub App**: organisation and app name → GitHub confirmation → back. Permissions are fixed; the webhook URL is written by the wizard.
4. **GitHub login**: reuse the same App's Client ID/secret; callback `https://<domain>/auth/github/callback`.
5. **Install**: install the App on GitHub, then re-check.
6. **Model**: URL, key, model name; "fetch models" or "test model".
7. **Rules and projects**: review built-in rules → sync installed repositories → start and enable review.

**This deployment is before the wizard**: the control plane is running, but the GitHub App has to be confirmed by a person in the browser, and the model key must be entered by an administrator. This is the only mandatory manual step.

## 5. This deployment (launchpad.hugoxk.online)

| Item | Value |
| --- | --- |
| Server | `123.60.231.41:10050` (user `xuke`) |
| Origin checkout | `~/work/launchpad-origin` — `HugoXK/LaunchPad`, upstream `agent-CI-Infra/bot` |
| Upstream checkout (analysis) | `~/work/launchpad-upstream` — `agent-CI-Infra/bot` `main@95231e8` |
| Deployment directory | `~/work/launchpad-deploy` (`compose.yaml`, `compose.override.yaml`, `.env`) |
| Compose project | `launchpad` (containers `launchpad-*`) |
| Host port | `127.0.0.1:8793` → container `8791` |
| Public entry | `https://launchpad.hugoxk.online` (Cloudflare Tunnel → `127.0.0.1:8793`) |
| Docs site | `https://launchpad-docs.hugoxk.online` (static site, port `3098`) |
| Docs source | `HugoXK/launchpad-docs` |
| Existing instance | `department-bot` at `/home/zhouhongye/department-bot` on 8791. **Do not touch it**; this instance has its own Compose project, volumes and port |

Common commands:

```sh
cd ~/work/launchpad-deploy
docker compose -p launchpad ps
docker compose -p launchpad logs --tail 100 bot manager
docker compose -p launchpad restart bot
docker compose -p launchpad pull && docker compose -p launchpad up -d
```

Health:

```sh
curl -s http://127.0.0.1:8793/healthz          # {"ok":true}
curl -s http://127.0.0.1:8793/api/setup        # {"initialized":false}
```

`/healthz` only proves the database is readable; "create the first super admin" is the real end-to-end check.

## 6. Origin, upstream and daily updates

`agent-CI-Infra/bot` is the **upstream**; `HugoXK/LaunchPad` is the **origin** fork under the owner's account. The docs site is built from the origin, not pinned to an upstream snapshot:

- `~/work/launchpad-origin` is a dedicated clone (`origin` = `HugoXK/LaunchPad`, `upstream` = `agent-CI-Infra/bot`).
- `~/work/launchpad-docs-update.sh` runs daily (UTC `18:40`, about 02:40 Beijing), pulls both the origin and `HugoXK/launchpad-docs`, rebuilds the static site and `rsync`s it to `~/work/landing/launchpad-docs`.
- The build mirrors the origin's `docs/` at `/origin/` and regenerates `/docs/snapshot/` (origin SHA, commits behind upstream, source size, dependencies, services). So a new upstream doc or a new origin commit appears on the site after the next daily run.
- The script is logged to `~/work/launchpad-docs-update.log`; it is safe to run by hand.

## 7. Deployment record (2026-11-12)

| Step | Result |
| --- | --- |
| Control-plane image | pulled from the `ghcr.nju.edu.cn` mirror and re-tagged to `ghcr.io`; **amd64 manifest digest matches the official registry** (control-plane `sha256:f59678a6…`, manager `sha256:4a28bd00…`) |
| Start | `docker compose -p launchpad up -d`: `bot`, `manager`, `webhook`, `tunnel` running; `key-init` and `project-image` exited 0 |
| Health | `manager` healthy; `bot` healthy; `127.0.0.1:8793/` returns 200 |
| Public | `https://launchpad.hugoxk.online/` returns 200; `/api/setup` returns `{"initialized":false}`; title `launchpad 管理` |
| First configuration | **manual**: open the public URL, create the super admin, walk the seven steps |
| Project computer / tunnel images | pulled from the mirror and re-tagged; ready |

Why `compose.override.yaml`: the first attempt used a two-week-old local image whose manager `/ready` required authentication, so the default probe stayed `starting`. The override reads `/internal/manager.token` as raw bytes and calls `/v1/projects` with `Bearer <base64>`. It also works with the new manager, so it can stay.

The mirror was used for transport only: the amd64 manifest digest was compared with the official registry before re-tagging. Production upgrades should still pin `BOT_IMAGE_TAG`.

## 8. Upgrade, backup, restore

- **Upgrade**: `docker compose pull` → `up -d`; pin `BOT_IMAGE_TAG` first when versioned.
- **Backup**: back up the four volumes (`bot-data`, `bot-keys`, `internal-keys`, `manager-data`). A database backup without `bot-keys` still cannot decrypt credentials.
- **Restore**: restore the volumes into the same deployment (same Compose project name); the master key must match the database.
- **Rollback**: change `BOT_IMAGE_TAG` back → `up -d`; migrations move forward, so back up before rolling back.

## 9. Troubleshooting

| Symptom | Look at |
| --- | --- |
| Page does not open | `docker compose ps`, `curl 127.0.0.1:8793/healthz`, Tunnel logs |
| manager unhealthy | `docker logs launchpad-manager-1`, health inspect, `/ready` |
| Task stuck | task detail timeline and "reason"; project "machine" failure; manager logs |
| Webhook missing | "Webhook deliveries": arrived? signature verified? |
| Model failure | "test model"; whether the URL ends in `/v1`; rate-limit window |
| Rate limited | "bot accounts → GitHub request quota" probe and window |

## 10. Notes for this instance

1. **Another control plane already runs on the same host** (`department-bot`, 8791). Both mount the Docker socket, but the manager deployment ids and Compose projects differ. Never reuse its volumes or project name.
2. The host is heavily loaded (`load average` often 30–55). Pulling images and building project computers is slow; avoid heavy operations at peak.
3. The public entry shares one Cloudflare Tunnel; validate the config before restarting it so other sites are not affected.
4. Pin `BOT_IMAGE_TAG` from `latest` to a specific version before production use.
