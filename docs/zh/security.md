# 安全模型与风险

> 结论先说：**这是一个把“凭据留在控制面、执行放进容器”做得相当认真的系统；但它不是多租户强隔离系统。** 最大的单一风险是 manager 持有宿主 Docker socket。

## 1. 密码学原语

`src/core/security.ts` 的实现是可核查的、没有自创算法：

| 用途 | 实现 |
| --- | --- |
| 密码哈希 | `scrypt(N=16384, r=8, p=1)`，16 字节随机盐，格式 `scrypt$16384$salt$hash`（`:28-39`） |
| 密码比较 | `timingSafeEqual`（`:39`） |
| Webhook 验签 | HMAC-SHA256，要求 `sha256=` + 64 hex，`timingSafeEqual`（`:41-45`） |
| 凭据加密 | AES-256-GCM，12 字节随机 IV，AAD 绑定记录 scope（`:47-61`） |
| 随机 ID | 24 字节随机 → 48 hex（`:3`） |

`SecretBox` 的 AAD 绑定是关键：密文不能从一条账号/模型记录搬到另一条记录上解密。主密钥是 32 字节，由 `key-init` 生成到 `bot-keys` 卷；**丢了主密钥，已保存的 App 私钥和模型 Key 都解不开**。

## 2. 凭据分层

| 凭据 | 存储 | 生命周期 | 暴露面 |
| --- | --- | --- | --- |
| master.key | `bot-keys` 卷，只读 | 部署期 | 仅控制面 |
| GitHub App 私钥 / Token / 模型 Key | SQLite 密文 | 管理员更新 | 仅控制面 |
| manager token | `internal-keys` 卷 | 部署期 | 控制面 → manager |
| installation token | 内存 | 短时 | 控制面；按需签发给任务只读令牌 |
| run token `rrt_…` | 只存哈希 | 15 分钟，可续期 | 单次 RoleRun |
| 用户 OAuth token | 密文 | 登录期 | 只读 `/user` 与身份绑定 |

任务容器拿不到长期 GitHub 写凭据或模型 Key。模型需要读 GitHub 时，通过 loopback 邮箱向控制面兑换**只读**令牌（`github_read_token`）；运行令牌绑定 tenant/project/task/run/epoch/能力。

## 3. 隔离

### 3.1 容器

- 项目电脑：只读根文件系统、非 root 用户 10001、`cap_drop: [ALL]`、`no-new-privileges`、受控工作卷。
- 每次 RoleRun 可再起独立容器与网络（`manager/run-environments.mjs`）。
- 资源限额：默认 2 CPU、4096 MiB、1024 进程、1024 MiB `/tmp`，可按仓库调整。
- 外网：`BOT_PROJECT_EGRESS=false` 可关闭项目容器出网。
- 网络：`control` 与 `edge` 分离；tunnel 只连 `edge`，通过 `webhook` 网关访问 `bot:8791`，**不能直接到 manager**。

### 3.2 路径与命令

runner 只接受受控 JSON，调用者不能指定 exec argv 或用户；工作区相对路径、单次写入 48 KiB / 读取 1 MiB / 输出 1 MiB；路径越界、哈希不一致或工作区被替换时任务停止。

### 3.3 密钥不落日志

- 写入 RunContext、事件、检查点前 `assertSecretFree`：密钥形状的键/值直接拒绝，不靠事后脱敏。
- trace 再按形状脱敏；日志只写错误码、异常消息和位置，不写请求正文或凭据。
- 费用账本只存模型名、token 数、单价快照和估算费用，不存 prompt/response 全文。

## 4. 信任边界

```
[不可信] 仓库内容、Issue/PR 文本、评论、CI 日志、外部执行端输入
   │
   ▼ 过滤 + 只读令牌 + 受控工具
[半可信] 模型输出（可能被注入）
   │  create_pull_request 校验 / 策略测试 / QA
   ▼
[可信] 控制面（凭据、授权、发布）
   │  Bearer manager token
   ▼
[高权限] manager（Docker socket）
   │
   ▼
[隔离] 项目容器（无长期凭据）
```

**边界上的事实：**

- 模型输出不可信。它不能直接写 GitHub，必须经 `create_pull_request`；控制面校验 diff、head、分支归属，再推送。
- 仓库内容不可信。它可能包含提示注入；过滤作者身份、只读令牌、受控工具和 QA 是缓解，不是形式化保证。
- 外部执行端不可信。签名、临时令牌、身份绑定和转发白名单是边界；它不获得控制面权限。

## 5. 威胁与风险清单

| # | 风险 | 影响 | 现状 | 建议 |
| --- | --- | --- | --- | --- |
| 1 | **manager 持有 `/var/run/docker.sock`** | 攻破 manager ≈ 宿主 root | 仅内网、Bearer、deployment 标签与路径校验 | 独立主机/用户命名空间；只暴露必要 Docker API；审计所有容器操作；把 manager 视为 T0 资产 |
| 2 | **提示注入**（Issue/PR/代码/日志） | 模型被诱导扩大改动或泄露上下文 | 作者过滤、只读令牌、工具白名单、`create_pull_request` 校验、QA | 在 prompt 中显式隔离不可信内容；对“读取后立即执行”的命令做策略阻断；保留红队用例 |
| 3 | **模型供应商 URL 是 SSRF 面** | 控制面访问任意 URL | URL 由管理员/项目管理员填写；表单校验 | 限制 scheme/私网/重定向；DNS 重新解析防护；出站代理与 allowlist |
| 4 | **镜像供应链** | 恶意镜像窃取卷/凭据 | GHCR 官方镜像，可固定 `BOT_IMAGE_TAG` | 生产固定 digest、镜像签名/校验、升级前审阅 diff |
| 5 | **执行器供应链** | 第三方 Agent/桥接获得工具访问 | ACP/Codex/Claude Code 版本锁定 | 固定版本与校验和；外部执行器跑在独立主机；最小权限 |
| 6 | **SQLite 单写者** | 高并发下写阻塞/损坏风险 | WAL + FULL + busy timeout | 控制面单实例；定期备份；监控 WAL 增长 |
| 7 | **公共看板** | 误把私有仓库信息发布 | 需要显式 consent 表与设置 | 默认关闭；发布前人工预览；审计 |
| 8 | **发版自动化** | 误发/错版本 | 版本必须高于上一枚可达标签；准备草稿，人点击发布 | 保留人工发布点击；限制谁能操作 |
| 9 | **审计范围** | 事故后无法还原 | `audit` / `audit_records` + 投递记录 | 明确保留期、导出与不可篡改存储 |
| 10 | **多实例共宿主** | 资源争抢/误操作 | deployment 隔离命名；Compose 项目隔离 | 每实例独立 Docker daemon 或独立主机；资源限额 |

## 6. 运维层面的安全默认

- `BOT_COOKIE_SECURE=true` + HTTPS 单入口。
- `BOT_BIND_ADDRESS=127.0.0.1`，只让反向代理/隧道访问。
- `BOT_IMAGE_TAG` 固定到版本，不用浮动 `latest`。
- 不把 `.env`、私钥、模型 Key 提交到仓库；不打印 secret。
- 定期备份四个卷：`bot-data`、`bot-keys`、`internal-keys`、`manager-data`；`tunnel-keys` 只放 Tunnel token。
- 升级用 `pull` + `up -d`；**不要** `down -v`，它会删掉主密钥和数据库。

## 7. 安全结论

- **做得好**：凭据分层、AES-GCM + AAD、先落库、幂等、租约围栏、只读令牌、纯函数自动化、秘密扫描、审计。
- **必须接受的前提**：你信任这台宿主的 Docker；你信任部署的镜像和执行器；你接受模型可能被仓库内容影响。
- **不能宣称的**：它不是 OS 级沙箱，不是多租户硬隔离，不是“模型不会做错事”的保证。
