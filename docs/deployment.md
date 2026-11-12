# 部署与运维

## 1. 前置条件

- Linux + Docker Engine + Compose v2。
- 一个公网 HTTPS 入口（本部署用 Cloudflare Tunnel）。
- 一个能在组织里创建/安装 GitHub App 的账号。
- 一个兼容 Chat Completions 的模型：URL、Key、模型名。

官方推荐**不在本机构建**：下载 `compose.yaml`，`docker compose up -d` 拉 GHCR 镜像。要改代码才从源码构建（`compose.build.yaml`）。

## 2. Compose 服务

| 服务 | 作用 | 端口/网络 |
| --- | --- | --- |
| `key-init` | 生成 master.key 与 manager token，然后退出 | 无网络 |
| `bot` | 控制面：控制台、API、OAuth、Webhook、模型代理 | 宿主 `BOT_PORT` → 容器 8791 |
| `manager` | Docker 网关：项目电脑、RoleRun 容器 | 容器网络 8793 |
| `webhook` | tunnel 到 `bot:8791` 的固定网关 | `control` + `edge` |
| `tunnel` | Cloudflare Tunnel（可选） | `edge` |
| `project-image` | 拉取项目电脑镜像后退出 | 无网络 |

卷：

| 卷 | 内容 | 丢了会怎样 |
| --- | --- | --- |
| `bot-data` | SQLite、Git 镜像、公共看板 | 控制面数据全丢 |
| `bot-keys` | `master.key` | 已保存凭据无法解密 |
| `internal-keys` | manager token | 控制面与 manager 失联 |
| `manager-data` | 虚拟电脑账本、笔记卷 | 环境记录与笔记丢失 |
| `tunnel-keys` | Tunnel token | 需重新配置隧道 |

**永远不要 `docker compose down -v`。**

## 3. 关键环境变量

| 变量 | 本部署 | 说明 |
| --- | --- | --- |
| `BOT_PORT` | `8793` | 宿主端口 → 容器 8791 |
| `BOT_BIND_ADDRESS` | `127.0.0.1` | 只让本机隧道访问 |
| `BOT_PUBLIC_ORIGIN` | `https://launchpad.hugoxk.online` | 唯一公网入口 |
| `BOT_COOKIE_SECURE` | `true` | HTTPS cookie |
| `BOT_IMAGE_TAG` | `latest` | 生产建议固定版本 |
| `BOT_PROJECT_EGRESS` | 默认 `true` | 项目容器是否出网 |
| `BOT_MENTION_NAMES` | 默认 `bot,agent-ci-infra-bot` | 评论 @ 谁触发 |
| `BOT_GITHUB_API_URL` | 默认 `https://api.github.com` | GitHub Enterprise 时可改 |
| `BOT_FORWARD_PRIVATE_HOSTS` | 空 | 外部转发私网白名单 |

完整变量见上游 `docs/deployment.md`。

## 4. 第一次配置（七步向导）

部署起来后打开首页，会看到：

1. **创建超级管理员**：用户名 + 12–256 位密码；只成功一次。
2. **公网 HTTPS**：自建反代或 Cloudflare Tunnel；本部署用 Tunnel。
3. **GitHub App**：填组织与 App 名 → GitHub 确认页创建 → 回填。权限固定；Webhook 地址由向导写入。
4. **GitHub 登录**：复用同一个 App 的 Client ID/Secret；回调地址 `https://<域名>/auth/github/callback`。
5. **安装**：在 GitHub 安装 App，回来重新检查。
6. **模型**：URL、Key、模型名；可先“获取模型列表”或“测试模型”。
7. **规则与项目**：看内置规则 → 同步已安装仓库 → 启动并启用检视。

**本部署目前停在向导之前**：控制面已启动，但 GitHub App 需要人在浏览器里点 GitHub 的确认页创建；模型 Key 也需要管理员填写。这是唯一必须人工完成的一步。

## 5. 本部署的落地记录（2026-11-12）

| 步骤 | 结果 |
| --- | --- |
| 上游检出 | `~/work/launchpad-upstream`，`main@95231e8` |
| 控制面镜像 | 从 `ghcr.nju.edu.cn` 镜像拉取后重新打 `ghcr.io` 标签；**amd64 manifest digest 与官方一致**（control-plane `sha256:f59678a6…`，manager `sha256:4a28bd00…`） |
| 启动 | `docker compose -p launchpad up -d`：`bot`、`manager`、`webhook`、`tunnel` 运行；`key-init` 与 `project-image` 正常退出 |
| 健康 | `manager` healthy；`bot` healthy；`127.0.0.1:8793/` 返回 200 |
| 公网 | `https://launchpad.hugoxk.online/` 返回 200；`/api/setup` 返回 `{"initialized":false}`；标题 `launchpad 管理` |
| 首次配置 | **待人工完成**：在浏览器打开公网地址，创建超级管理员，走七步向导（GitHub App 创建、GitHub 登录、安装、模型） |
| 项目电脑镜像 | 新版本在后台从镜像站拉取并重打标签；旧镜像仍可用于首次配置，但不建议启动项目电脑直到刷新完成 |

为什么有 `compose.override.yaml`：第一次启动时本地只有两周前的旧镜像，旧 manager 的 `/ready` 需要鉴权，Compose 的默认探针会一直 `starting`。override 把探针改成“读取 `/internal/manager.token` 的原始字节，base64 后请求 `/v1/projects`”；新 manager 同样支持，所以保留它不影响升级。

镜像站只用于传输：拉取前比对官方与镜像的 amd64 manifest digest，一致才重新打标签。生产升级仍以 `BOT_IMAGE_TAG` 固定版本为准。

## 6. 本部署（launchpad.hugoxk.online）

| 项 | 值 |
| --- | --- |
| 服务器 | `123.60.231.41:10050`（用户 `xuke`） |
| 上游检出 | `~/work/launchpad-upstream`（`main@95231e8`，浅克隆） |
| 部署目录 | `~/work/launchpad-deploy`（`compose.yaml` + `.env`） |
| Compose 项目 | `launchpad`（容器名 `launchpad-*`） |
| 宿主端口 | `127.0.0.1:8793` → 容器 `8791` |
| 公网入口 | `https://launchpad.hugoxk.online`（Cloudflare Tunnel → `127.0.0.1:8793`） |
| 文档站 | `https://launchpad-docs.hugoxk.online`（静态站点，端口 `3098`） |
| 文档源 | `HugoXK/launchpad-docs` |
| 与已有实例的关系 | 同宿主上已有 `department-bot`（`/home/zhouhongye/department-bot`，8791）。**不要动它**；本实例用独立 Compose 项目、卷和端口 |

常用命令：

```sh
cd ~/work/launchpad-deploy
docker compose -p launchpad ps
docker compose -p launchpad logs --tail 100 bot manager
docker compose -p launchpad restart bot
# 升级（固定版本时先改 BOT_IMAGE_TAG）
docker compose -p launchpad pull && docker compose -p launchpad up -d
```

健康检查：

```sh
curl -s http://127.0.0.1:8793/healthz          # {"ok":true}
curl -s http://127.0.0.1:8793/api/setup        # {"initialized":false}
```

`/healthz` 只证明数据库可读；第一次配置前页面显示“创建第一名超级管理员”才是最终验证。

## 7. 升级、备份、恢复

- **升级**：`docker compose pull` → `up -d`；镜像标签固定时先改 `BOT_IMAGE_TAG`。
- **备份**：停写或直接备份四个卷（`bot-data`、`bot-keys`、`internal-keys`、`manager-data`）。只备份数据库而丢了 `bot-keys`，凭据仍不可用。
- **恢复**：把卷恢复到同一部署（同一 Compose 项目名）；主密钥必须与数据库配套。
- **回滚**：改回 `BOT_IMAGE_TAG` → `up -d`；数据库迁移是向前的，回滚前先备份。

## 8. 故障排查

| 现象 | 先看 |
| --- | --- |
| 页面打不开 | `docker compose ps`、`curl 127.0.0.1:8793/healthz`、Tunnel 日志 |
| manager 不健康 | `docker logs launchpad-manager-1`、`docker inspect` 的 health；`/ready` 是否 503 |
| 任务卡住 | 任务详情的时间线与“原因”；项目“机器配置 → 故障”；manager 日志 |
| Webhook 没到 | “Webhook 投递”页：是否到达、验签是否通过 |
| 模型失败 | 模型页“测试模型”；模型 URL 是否以 `/v1` 结尾；限流窗口 |
| 限流 | “机器人账号 → GitHub 请求额度”的探测与窗口 |

## 9. 本实例的注意事项

1. **同宿主已有另一个控制面**（`department-bot`，8791）。两者都挂 Docker socket，但 manager 的 deployment id 不同、Compose 项目不同。不要复用它的卷或项目名。
2. 服务器负载很高（`load average` 长期 30–50）。拉镜像、构建项目电脑会变慢；不要在高峰期做重操作。
3. 公网入口走共享 Cloudflare Tunnel；新增 hostname 时先校验配置再重启隧道，避免影响其他站点。
4. 生产使用前把 `BOT_IMAGE_TAG` 从 `latest` 固定到具体版本。
