---
name: deploy-vps
description: Deploy code lên VPS production qua SSH. Dùng khi user gõ "deploy", "deploy production", "lên prod", "đẩy lên server".
---

# Deploy VPS workflow

> **Flow chuẩn (Docker compose)**: runbook `docs/HUONG-DAN-DEPLOY-DOCKER-VPS.md`
> (14 PHASE / 6 GATE — nguồn authoritative) + `deploy/README.md` (map phase → file).
> Local: `bash deploy/release.sh` → VPS: `bash deploy/deploy.sh`.
> Skill dưới đây là flow pm2-qua-SSH (legacy/không-Docker) — vẫn PHẢI qua GATE env:check.

ENV cần có trong `.env` (LOCAL của user, KHÔNG commit):

- `DEPLOY_HOST` — IP/domain VPS
- `DEPLOY_USER` — user SSH (vd `deploy`)
- `DEPLOY_PATH` — folder app trên VPS (vd `/var/www/app`)
- `DEPLOY_PM2_NAME` — tên process pm2 (vd `app-be`)
- `DEPLOY_HEALTH_URL` — vd `https://api.shop.com/health`

Khi user yêu cầu deploy:

1. **Pre-check**:
   - `git status` — phải clean (no uncommitted changes)
   - `git branch --show-current` — phải là `main`
   - `git log origin/main..HEAD` — phải rỗng (đã push hết)
   - Kiểm env `DEPLOY_*` có set chưa (đọc qua user, KHÔNG cat `.env`)

2. **SSH test**:
   - `ssh -o ConnectTimeout=5 $DEPLOY_USER@$DEPLOY_HOST "echo ok"`
   - Fail → STOP

3. **Deploy steps trên VPS** (qua SSH):
   - `cd $DEPLOY_PATH`
   - `git fetch origin main`
   - Hiển thị commit sắp deploy: `git log HEAD..origin/main --oneline`
   - Hỏi user confirm: "Deploy commits trên? (y/n)"
   - `git pull origin main`
   - `bun install --frozen-lockfile`
   - **GATE env:check (BẮT BUỘC — chống crash-loop mù từng gặp ở dự án trước)**:
     `bun run env:check` (hoặc `--env-file <file env prod>`) — **FAIL là DỪNG,
     KHÔNG restart**; bản đang chạy vẫn sống. In từng biến sai TÊN + LÝ DO.
   - **GATE migrate**: `bun run db:migrate --dry-run` (liệt kê pending) →
     `bun run db:migrate` — FAIL là DỪNG, KHÔNG restart (batch tự rollback, in
     đúng file gãy). KHÔNG drop column (xem `.claude/rules/db-schema.md`)
   - `pm2 restart $DEPLOY_PM2_NAME`

4. **Verify production**:
   - Wait 5s
   - `curl -f -m 10 $DEPLOY_HEALTH_URL` → expect HTTP 200 (`/health` = liveness)
   - `curl -f -m 10 <base>/ready` → expect HTTP 200 (`/ready` = DB + Dragonfly nối được)
   - Fail → CẢNH BÁO user, gợi ý rollback (xem skill `rollback`)

5. **Báo cáo**:
   - Commit deployed (SHA)
   - Timestamp
   - Health check result
   - PM2 status: `pm2 list | grep $DEPLOY_PM2_NAME`

## Quy tắc

- ❌ KHÔNG tự rollback. Nếu fail → user quyết định.
- ❌ KHÔNG deploy từ branch ≠ `main`.
- ❌ KHÔNG deploy khi local có uncommitted change.
- ❌ Migration KHÔNG drop column — đọc `.claude/rules/db-schema.md`.
- ✅ Trước mọi deploy có migration nặng → backup DB (skill `db-backup`).
