# Deploy VPS (Docker) — map runbook 14 PHASE / 6 GATE → file trong folder này

> **Nguồn authoritative:** `docs/HUONG-DAN-DEPLOY-DOCKER-VPS.md` — runbook đầy đủ
> (14 phase, 6 gate, catalog lỗi, checklist cô lập). Folder này chứa file THỰC THI;
> README chỉ map phase → file, không copy runbook.

| Phase | Việc | Gate | File / lệnh ở đây |
|---|---|---|---|
| 1-2 | SSH đúng máy/user + check AVX2 + scan VPS (chỉ đọc) | — | — (runbook) |
| 3 | Cài Docker Compose v2 + buildx (additive, không gỡ gì) | — | — (runbook) |
| 4 | Scan xung đột port host / subnet | **GATE 1** | port bận → đổi `APP_HOST_PORT` trong env, KHÔNG sửa repo |
| 5 | Clone code qua GitHub SSH deploy key | — | — (runbook) |
| 6 | Tạo env prod: `cp deploy/env.production.example deploy/.env.production` → điền theo nhãn `[TỰ SINH]`/`[BẮT BUỘC THẬT]`/`[PLACEHOLDER-ĐƯỢC]` (openssl ghi cạnh biến, secret sinh THẲNG vào file — không dán vào chat) | — | `env.production.example` (header = tập PROD-REQUIRED) |
| 7 | **Preflight**: `bun run env:check --env-file deploy/.env.production` + Resend key thật + pool budget + no-localhost | **GATE 2** | `scripts/env-check.ts` (❌ = DỪNG, không up) |
| 8 | Build + migrate + up: `bash deploy/deploy.sh` — thứ tự GATE cứng bên trong: env:check → build → **GATE migrate** (`migrate.ts --dry-run` liệt kê pending → apply, fail = DỪNG không up app) → up | **GATE 3** | `deploy.sh`, `scripts/migrate.ts`, `docker-compose.prod.yml` (`<proj>-app-1 healthy` + worker ×1) |
| 9 | Test loopback: `/health` (liveness, không đụng DB) + `/ready` (DB+Dragonfly, fail→503) + PID count = WEB_INSTANCES — deploy.sh đã curl 2 endpoint | **GATE 4** | `deploy.sh` |
| 10 | Reverse proxy: **Caddy ưu tiên** (auto-TLS); VPS đã có nginx → thêm vhost | — | `Caddyfile.example` (ưu tiên) / `nginx.vhost.example` (phụ lục A) |
| 11 | DNS + TLS: Cloudflare GREY → cert → verify → bật CAM Full Strict | **GATE 5** | — (🖐️ runbook) |
| 12 | Khóa origin: firewall chỉ nhận IP Cloudflare (giữ SSH!) | — | — (🖐️ runbook) |
| 13 | Nối FE `app.<domain>` same-site + build lại FE | — | — (🖐️ runbook) |
| 14 | Smoke thật: SSE cross-process + burst login + dọn dẹp secret | **GATE 6** | — (runbook §14 + master guide §9.3) |
| ↻ | Ra bản mới: máy dev `bash deploy/release.sh` (validate+test+push) → VPS `bash deploy/deploy.sh` | GATE 2 lặp lại | `release.sh`, `deploy.sh` |

## Vì sao GATE env:check tồn tại (GATE 2 — "khâu cứu mạng")

Sự cố thực tế ở một dự án trước: flip `NODE_ENV=production` → env thiếu biến → `src/env.ts` fail-fast
lúc boot → pm2 crash-loop (restart 0→16, health 000), lỗi chôn trong logs, phải
auto-rollback. GATE kiểm **đúng schema boot** (`src/env.schema.ts` — import chung,
không duplicate) **trước khi** đụng container: env sai thì bản cũ vẫn chạy,
stderr liệt kê từng biến sai TÊN + LÝ DO. Chi tiết: `.claude/ERRORS.md` BUG-011.

## Vận hành sau go-live (backup + chống đầy disk)

- **Backup mỗi ngày** (dump + retention 7 ngày — `deploy/backup.sh`):
  ```
  0 3 * * * cd /home/<user>/apps/<proj> && COMPOSE_PROJECT=<proj> bash deploy/backup.sh >> /var/log/<proj>-backup.log 2>&1
  ```
- **Restore thử định kỳ** (backup chưa từng restore = KHÔNG có backup):
  `bash deploy/restore.sh <file.sql.gz>` — có confirm prompt, backup bản hiện tại trước.
- **Dọn image cũ hàng tuần** (chống đầy disk — deploy.sh đã prune dangling mỗi lần deploy):
  ```
  0 4 * * 0 docker system prune -af --filter "until=168h" >> /var/log/docker-prune.log 2>&1
  ```
  ⚠ `prune -af` xoá MỌI image không dùng bởi container đang chạy (mọi project trên VPS) — image project đang chạy an toàn, nhưng image project đã stop sẽ mất (build lại được).
- **Check disk**: `df -h /` + `docker system df`. Log container đã rotate sẵn (json-file 10m×3 trong compose).

## Ghi chú

- **Reverse proxy mặc định của template = Caddy** (`Caddyfile.example`, auto-TLS).
  Chỉ dùng nginx (`nginx.vhost.example`) khi VPS ĐÃ có nginx phục vụ app khác —
  đừng cài Caddy chồng lên (tranh port 80/443).
- `env.production.example` **không có chấm đầu** (khác `.env.production` thật):
  tránh bị gitignore/permission-rule (`.env.*`) quét nhầm; file thật
  `deploy/.env.production` đã nằm trong `.gitignore`, CHỈ sống trên VPS.
- Service tên `app` (không phải `api`) — khớp GATE 3 runbook (`<proj>-app-1`).
- Healthcheck container (Dockerfile) trỏ `/health` — liveness, để DB chập chờn
  không làm docker giết oan app. `/ready` chỉ dùng verify sau deploy + LB.
- Đa project 1 VPS: mỗi project 1 `APP_HOST_PORT` + `COMPOSE_PROJECT=<proj> bash
  deploy/deploy.sh` (network/volume tự tách theo `-p`). DB/cache KHÔNG publish ra host.
- Cần Postgres có extension (pgvector/PostGIS): set `POSTGRES_IMAGE` trong env,
  không sửa compose.
