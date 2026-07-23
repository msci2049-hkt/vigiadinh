# familywallet-api — Backend FamilyWallet

**FamilyWallet**: ví Stellar mà gia đình khôi phục được — social recovery (người bảo hộ +
ngưỡng + thời gian chờ + veto), thừa kế chia % (heartbeat "tôi vẫn khỏe" + heir claim),
theo dõi kết nối người bảo hộ (ping 12:00), AI người gác đêm (chỉ cảnh báo, không cầm khóa).
Sản phẩm toàn cầu, en mặc định. Custody nằm TRÊN CHUỖI — backend này chỉ mirror/notify/presence/risk.

| Repo | Ở đâu | Là gì |
|---|---|---|
| **repo này** | `stellaer-be/` | Backend: Bun + Hono + Drizzle + Postgres + Dragonfly + Better Auth (+ Resend, R2) |
| Frontend | `../stellar-fe-vite/` | React 19 + Vite + TanStack (pnpm 9 + Node 20 — KHÔNG bun) |
| Contract | `../vigiadinh-main/` (tạm) | Soroban `recovery-registry` đã chạy testnet + scripts — repo riêng, chốt sau |

Hai repo nói chuyện **chỉ qua HTTP**. Contract BE↔FE (access-control, types): `docs/CONTRACT-SYNC.md`
(gác bằng `bun run contract:check` trong `validate`). Đọc trước khi code: `CLAUDE.md` → `docs/PROJECT-BRIEF.md`.

## Production hardening (đã dựng sẵn)

secureHeaders + CSRF origin-check (`src/app.ts`) · graceful shutdown drain ≤10s
+ force-close SSE (`src/index.ts`) · `/health` (liveness) vs `/ready` (readiness,
503 khi DB/Dragonfly chết) · lefthook pre-commit (biome + gitleaks + boundaries)
/ pre-push (validate) · CI validate + audit + gitleaks full-history
(`.github/workflows/ci.yml`) · Renovate (`renovate.json`).
Chi tiết + cách verify: **`docs/HARDENING.md`** · việc con người còn lại:
**`docs/HUMAN-TODO.md`** · skill tái dùng: `.claude/skills/{hono-secure-headers,
graceful-shutdown-readiness, supply-chain-guard}`.

## Quick start

```bash
# Bước 1 khi degit template về dự án MỚI (đổi tên, sinh .env + secret, dọn demo):
node scripts/init-project.mjs <ten-du-an>

bun install
cp .env.example .env                      # rồi điền giá trị thật (init-project đã làm hộ nếu chạy bước 1)
bun run env:check                         # kiểm env đủ/đúng TRƯỚC khi chạy app
docker compose up -d                      # postgres + dragonfly + mailhog (email dev: http://localhost:8025)
bun run auth:generate                     # sinh src/db/schema/auth.ts
bun run db:migrate                        # apply migration
bun run dev                               # HTTP server (port 3000)
bun run worker                            # worker process (BullMQ)
```

## Scripts

| Command | Mô tả |
|---|---|
| `bun run dev` | HTTP server với `--watch` (hot reload). |
| `bun run start` | HTTP server production-mode (không watch). |
| `bun run worker` | BullMQ worker process. |
| `bun run worker:dev` | Worker với `--watch`. |
| `bun run build` | Bundle single file `dist/index.js` (Bun target + minify). |
| `bun run typecheck` | `tsc --noEmit` — check type-only. |
| `bun run check` | Biome lint + format check. |
| `bun run check:fix` | Biome auto-fix. |
| `bun run format` | Biome format only. |
| `bun run db:generate` | Sinh migration SQL từ schema thay đổi. |
| `bun run db:migrate` | Apply migration (advisory lock, liệt kê pending trước khi chạy). Thêm `--dry-run` chỉ liệt kê pending — là GATE trong `deploy/deploy.sh`. |
| `bun run db:studio` | Drizzle Studio UI. |
| `bun run db:drop` | Drop migration (hỏi xác nhận). |
| `bun run auth:generate` | Better Auth CLI sinh schema. Chạy sau khi sửa `src/lib/auth.ts`. |
| `bun run env:check` | Kiểm env theo đúng schema boot, KHÔNG mở app/DB/Redis. `--env-file <path>` để kiểm file prod trước khi deploy (GATE trong `deploy/deploy.sh`). |
| `bun run check:env-parity` | So key schema `src/env.schema.ts` ↔ `.env.example` ↔ `deploy/env.production.example` — chặn drift. |
| `bun run validate` | typecheck + biome + check:boundaries + check:env-parity (chạy trước commit). |

## Cấu trúc

Xem `.claude/CLAUDE.md` để biết cấu trúc chuẩn + 10 rule không thoả hiệp.

## Claude Code

Project có `.claude/` template đầy đủ:
- `.claude/CLAUDE.md` — master rules
- `.claude/skills/` — 15 workflow on-demand
- `.claude/rules/` — 5 rule scoped theo loại file
- `.claude/agents/` — 5 subagent (code-reviewer, security-auditor, ...)
- `.claude/hooks/` — auto format + guard destructive command
- `.mcp.json` — 5 MCP server (postgres, sentry, github, context7, playwright)

Chạy `claude` trong root project để start. Hooks chạy được trên Git Bash / WSL (Windows cần `winget install jqlang.jq`).

## Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `connect ECONNREFUSED 127.0.0.1:5432` | Postgres chưa chạy → `docker compose up -d postgres`. |
| `connect ECONNREFUSED 127.0.0.1:6379` | Dragonfly/Redis chưa chạy → `docker compose up -d dragonfly`. |
| `/ready` trả 503 | Check 2 service trên đã up: `docker compose ps`. |
| `bun run db:generate` báo "no schema files" | Đảm bảo `src/db/schema/index.ts` re-export bảng. |
| `bun run auth:generate` báo "Invalid env" | Copy `.env.example` → `.env` và điền placeholder hợp lệ. |
| Better Auth sign-in 404/401 | Mount order sai — xem `.claude/rules/auth.md`. |

## Production

- **Deploy VPS (Docker)**: xem `deploy/README.md` — env prod (`deploy/env.production.example`),
  compose prod, nginx vhost, và GATE `bun run env:check --env-file deploy/.env.production`
  (env sai → DỪNG trước khi up, chống pm2/docker crash-loop mù).
- Health: `/health` = liveness (200 ngay, không đụng DB/Redis — cho docker/pm2 healthcheck);
  `/ready` = readiness (check DB + Dragonfly, fail → 503 — verify sau deploy).
- Tất cả env qua `src/env.ts` (Zod validate khi boot — fail in danh sách biến sai TÊN + LÝ DO).
- Docker image pin `oven/bun:1.3.8` (khớp bun dev — không `:latest`); Postgres `16.6-alpine`,
  Dragonfly `v1.25.2` (override qua `POSTGRES_IMAGE`/`DRAGONFLY_IMAGE`). Bump = sửa tag + full test.
- Migration prod chạy qua **GATE** trong `deploy/deploy.sh` (dry-run pending → apply → mới up app;
  fail = DỪNG, batch tự rollback). App production KHÔNG tự migrate lúc boot (`RUN_MIGRATIONS=false`).
- Migration: KHÔNG drop column trực tiếp — workflow 3 release + additive-first (xem `.claude/rules/db-schema.md`).
- Payment: KHÔNG dùng Redlock, dùng DB transaction + idempotency (xem `.claude/rules/payment.md`).

### Hash concurrency guard (chống login self-DoS)

Better Auth hash mật khẩu bằng scrypt (CPU-nặng, ~60–80ms/lần). `src/middlewares/hash-guard.ts`
cap số hash đồng thời mỗi process; quá tải → trả **503** (không treo). Thêm các biến env (mặc định
chạy được, chỉ tinh chỉnh khi cluster/đổi core):

| Biến | Default | Ý nghĩa |
|---|---|---|
| `HASH_MAX_CONCURRENT` | `2` | Số scrypt đồng thời tối đa **mỗi process** |
| `HASH_ACQUIRE_TIMEOUT_MS` | `2000` | Chờ slot quá hạn → 503 (kèm `Retry-After`) |
| `HASH_MAX_QUEUE` | `64` | Hàng đợi đầy → 503 ngay (load-shed) |

> **Trần thực BOX-WIDE = `WEB_INSTANCES × HASH_MAX_CONCURRENT`.** Giữ `≤ ~2×số core`
> (ví dụ 4-core + `WEB_INSTANCES=4` → đặt `HASH_MAX_CONCURRENT=1`, hoặc giữ 2 và chấp nhận
> 2× oversubscription). Bộ nhớ: mỗi scrypt ~32MB → peak ≈ `WEB_INSTANCES × HASH_MAX_CONCURRENT × 32MB`.
