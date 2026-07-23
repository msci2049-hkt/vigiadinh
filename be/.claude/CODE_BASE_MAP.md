# Code Base Map

> **Cập nhật MỖI khi tạo/xoá/đổi tên file.** Đây là bảng tổng hợp cho Claude (và người mới) hiểu codebase trong 30 giây.

Last updated: `2026-07-20` (bootstrap FamilyWallet — lớp demo carbon đã xóa)

## 0. Meta workflow (.claude/, docs/)

| File | Mục đích | Cập nhật |
|---|---|---|
| `.claude/skills/commit-push/` | Skill commit + push Git an toàn (validate, no `.env`, conventional commits). | 2026-05-13 |
| `.claude/skills/deploy-vps/` | Skill deploy VPS qua SSH + health check. | 2026-05-13 |
| `.claude/skills/rollback/` | Skill rollback production + cảnh báo migration. | 2026-05-13 |
| `.claude/skills/setup-monitoring/` | Skill Sentry/Uptime Robot/Better Stack/Cronitor. | 2026-05-13 |
| `.claude/skills/new-test/` | Skill viết unit test `bun test` cho service. | 2026-05-13 |
| `.claude/skills/update-dependencies/` | Skill bump deps theo nhóm patch/minor/major. | 2026-05-13 |
| `.claude/skills/seed-data/` | Skill tạo `scripts/seed.ts` cho dev. | 2026-05-13 |
| `.claude/skills/db-backup/` | Skill pg_dump → R2 retention 30 ngày. | 2026-05-13 |
| `.claude/skills/new-feature/` | Skill thêm 1 vertical slice vào module có sẵn. | 2026-05-13 |
| `.claude/skills/add-sse/` | Skill thêm kênh SSE realtime (publishToUser, auth-gated, at-most-once caveat). | 2026-06-13 |
| `.claude/hooks/pre-commit-validate.sh` | Hook chặn `git commit` khi `bun run validate` fail. | 2026-05-13 |
| `.claude/rules/module-boundary.md` | Rule Layered vs Slice + cấm cross-module deep import. | 2026-05-13 |
| `.claude/rules/events.md` | Rule eventBus = sync in-process; I/O/durable đi BullMQ (enforce ở check:boundaries). | 2026-06-13 |
| `scripts/check-boundaries.ts` | 3 guardrail: cross-module deep import + eventBus-no-I/O + BullMQ `{}` queue name. | 2026-06-13 |
| `scripts/check-env-parity.ts` (+`.test.ts`) | Guardrail #4 (trong `validate`): so key schema env ↔ `.env.example` ↔ `deploy/env.production.example` — chặn drift (BUG-003). | 2026-07-06 |
| `scripts/init-project.mjs` | Chạy Ở DỰ ÁN MỚI sau degit (guard chống chạy trên mẫu): xoá lớp demo carbon (file list + block `[TEMPLATE-DEMO:carbon]`), đổi danh tính, sinh `.env` (secret mới + slug + port rảnh), reset git, install + baseline migration. | 2026-07-11 |
| `.claude/rules/new-project.md` | Rule degit: PHẢI chạy init-project trước; cấm tái dùng secret/port/danh tính mẫu; access-control mirror FE. | 2026-07-11 |
| `.claude/rules/docker.md` | Rule compose: cấm host port cứng + `container_name`; `COMPOSE_PROJECT_NAME` + port env-driven (`DB_PORT`…), bind 127.0.0.1. | 2026-07-11 |
| `scripts/env-check.ts` (+`.test.ts`) | `bun run env:check [--env-file]` — kiểm env theo đúng schema boot, không mở app/DB. GATE trong deploy.sh (BUG-003). | 2026-07-06 |
| `scripts/cleanup-sessions.ts` | Cron dọn session + verification expired > 1 ngày. | 2026-05-13 |
| `docs/HUONG-DAN-DEPLOY-DOCKER-VPS.md` | Runbook deploy Docker VPS 14 PHASE / 6 GATE (nguồn authoritative, đúc từ sự cố thật). | 2026-07-06 |
| `deploy/README.md` | Map runbook 14 PHASE / 6 GATE → file thực thi trong `deploy/`. | 2026-07-06 |
| `deploy/env.production.example` | Template env prod (nhãn TỰ SINH / BẮT BUỘC THẬT / PLACEHOLDER-ĐƯỢC, placeholder `<...>` bị env:check chặn). | 2026-07-06 |
| `deploy/docker-compose.prod.yml` | Compose prod project-name-agnostic (-p, profile prod): DB/cache không publish, app bind 127.0.0.1:${APP_HOST_PORT}, POSTGRES_IMAGE override. | 2026-07-06 |
| `deploy/Caddyfile.example` | Reverse proxy ƯU TIÊN (auto-TLS): X-Real-IP ghi đè + flush_interval -1 (SSE). | 2026-07-06 |
| `deploy/nginx.vhost.example` | Vhost nginx (phụ lục A runbook): SSE buffering off, X-Forwarded-For ghi đè $remote_addr (chống spoof rate-limit). | 2026-07-06 |
| `deploy/deploy.sh` | Chạy trên VPS: pull → install → GATE env:check → build → GATE migrate (dry-run + apply) → up → curl /health + /ready → prune dangling. | 2026-07-06 |
| `deploy/backup.sh` (+`backup.test.ts`) | pg_dump → gzip → BACKUP_DIR, retention RETENTION_DAYS (test tmp dir), `--prune-only` cho cron. | 2026-07-06 |
| `deploy/restore.sh` | Restore .sql.gz vào DB prod (confirm = gõ đúng tên DB). Backup chưa restore thử = không có backup. | 2026-07-06 |
| `deploy/release.sh` | Chạy máy dev: validate → test → push origin main. | 2026-07-06 |
| `drizzle/auth-indexes.sql` | 9 perf index bổ sung cho auth tables (apply 1 lần). | 2026-05-13 |
| `.claude/skills/add-oauth/` | Skill thêm OAuth provider (Google/GitHub/...). | 2026-05-13 |
| `.claude/skills/add-2fa/` | Skill thêm TOTP 2FA. | 2026-05-13 |
| `.claude/skills/add-passkey/` | Skill thêm Passkey (WebAuthn). | 2026-05-13 |
| `docs/adr/README.md` | Index Architecture Decision Records. | 2026-05-13 |
| `docs/adr/0001-stack-choices.md` | ADR 0001: chọn Bun, Hono, Drizzle, Better Auth, Dragonfly. | 2026-05-13 |
| `docs/architecture/MODULE-PATTERN.md` | Hybrid module pattern: Layered vs Vertical Slice. | 2026-05-13 |
| `docs/SCALE-RUNBOOK.md` | Scale theo core: WEB_INSTANCES/DB_POOL_MAX/PgBouncer + login CPU guard + Dragonfly SPOF. | 2026-06-13 |

---

## 1. Entry & Config

| File | Mục đích | Cập nhật |
|---|---|---|
| `src/index.ts` | Entry HTTP server. Sentry init đầu tiên. | |
| `src/app.ts` | Hono app setup + middleware order + mount routes. | |
| `src/env.ts` | Validate env khi boot — fail in báo cáo biến sai (TÊN + LÝ DO) ra stderr rồi exit 1. | 2026-07-06 |
| `src/env.schema.ts` (+`.test.ts`) | Schema env DUY NHẤT (zod thuần, không I/O) — import chung bởi env.ts + env-check + parity. Test chốt emptyStringAsUndefined (""→default). | 2026-07-06 |
| `src/workers/index.ts` | Entry worker process. Graceful shutdown SIGTERM/SIGINT. | |
| `src/cluster.ts` | Supervisor spawn WEB_INSTANCES bản server (reusePort) + pool-budget guard. CMD prod. | 2026-06-13 |

## 2. Type augmentation

| File | Mục đích | Cập nhật |
|---|---|---|
| `src/types/hono.d.ts` | Module augmentation cho `c.get/c.set` type-safe. | |

## 3. Database

| File | Mục đích | Cập nhật |
|---|---|---|
| `src/db/index.ts` | Drizzle client + postgres pool. Export `db` + `client`. | 2026-05-12 |
| `src/db/schema/index.ts` | Re-export auth + products schema (products schema sống trong module). | 2026-05-13 |
| `src/db/schema/auth.ts` | Better Auth CLI generated (user, session, account, verification). KHÔNG sửa tay. | 2026-05-12 |
| `drizzle/` | Reset khi bootstrap FamilyWallet (init-project xóa SQL demo + meta, giữ `auth-indexes.sql`). Baseline `0000_init` sinh lại từ schema sạch (auth + product + 8 module FamilyWallet). | 2026-07-20 |
| `scripts/migrate.ts` (+`.test.ts`) | Migrate GATE: pending từ journal Drizzle + `--dry-run` + báo đúng file gãy (batch rollback) + advisory lock, max:1. deploy.sh gọi TRƯỚC up. | 2026-07-06 |

## 4. Lib (helper dùng chung)

| File | Mục đích | Cập nhật |
|---|---|---|
| `src/lib/db.ts` | Drizzle client export. | |
| `src/lib/redis.ts` | 2 ioredis connection tới Dragonfly (bull + rate-limit). | |
| `src/lib/auth.ts` | Better Auth instance + plugin config. Role hardening: `additionalFields.role input:false` + `databaseHooks` gọi `enforcePublicSignupRole`. | 2026-07-09 |
| `src/lib/signup-role-guard.ts` | Chống tự-phong-role qua public sign-up (Lớp 2). `enforcePublicSignupRole` + whitelist/paths. Test cùng folder. | 2026-07-09 |
| `src/lib/validation-limits.ts` | Nguồn sự thật DUY NHẤT cho ngưỡng validate FE cần (password min/max, OTP length). `auth.ts` đọc từ đây; expose qua `GET /api/config/validation` (app.ts) cho FE fetch lúc boot (D-052). | 2026-07-13 |
| `src/lib/redlock.ts` | Redlock instance shared cho mọi cron. | |
| `src/lib/storage.ts` | Bun.S3Client trỏ R2. | |
| `src/lib/logger.ts` | Pino instance + redact PII. | |
| `src/lib/sentry.ts` | Sentry init. | |
| `src/lib/resend.ts` | Resend client. | |
| `src/lib/email.ts` | sendEmail helper. Mailhog SMTP dev (port 1025) / Resend prod. | 2026-05-13 |
| `src/lib/events.ts` | Type-safe in-memory event bus cho cross-module domain event. | 2026-05-13 |
| `src/lib/semaphore.ts` | Counting semaphore (trần đồng thời + queue timeout) cho hash login. | 2026-06-13 |
| `src/lib/password-hash.ts` | Pin node:crypto.scrypt (params BA) — non-blocking, backward-compat hash. | 2026-06-13 |
| `src/lib/realtime-core.ts` | Lõi fan-out SSE THUẦN (transport injectable) — unit-test không cần stack. | 2026-06-13 |
| `src/lib/realtime.ts` | SSE fan-out cross-process: 2 ioredis pub/sub RIÊNG + `publishToUser` + `closeRealtime`. | 2026-06-13 |
| `src/lib/realtime-core.test.ts` | Unit test fan-out (fake transport): đúng user nhận, cleanup không leak. | 2026-06-13 |
| `src/lib/realtime.integration.test.ts` | Cross-process acceptance (skip trừ khi `RUN_REALTIME_IT=1` + Dragonfly sống). | 2026-06-13 |
| `src/lib/pool-budget.ts` | Ngân sách kết nối Postgres — refuse boot nếu over-commit + warn login CPU guard. | 2026-06-13 |
| `src/lib/pool-budget.test.ts` | Unit test evaluatePoolBudget (refuse/warn fire đúng). | 2026-06-13 |

## 5. Middlewares

| File | Mục đích | Cập nhật |
|---|---|---|
| `src/middlewares/auth.ts` | requireAuth / requireRole / requireOrg / assertOwnership. | |
| `src/middlewares/rate-limit.ts` | Factory rateLimit({...}) qua rate-limiter-flexible. | |
| `src/middlewares/raw-body.ts` | captureRawBody cho webhook HMAC verify. | |
| `src/middlewares/error.ts` | Global onError mapper (domain error → HTTP status). | |
| `src/middlewares/validator.ts` | `zv()` wrapper @hono/zod-validator → throw ZodError để onError xử lý đồng nhất. | 2026-05-13 |
| `src/middlewares/hash-guard.ts` | Trần CPU hashing toàn cục (semaphore) + 503 fail-fast cho auth scrypt-path. | 2026-06-13 |

## 6. Modules (business domain)

| Module | Mô tả | Files | Cập nhật |
|---|---|---|---|
| `product` | Catalog product (smoke test, Vertical Slice). 5 feature: list/get/create/update/delete. Emit `product.created/updated/deleted` qua eventBus. | `index.ts`, `routes.ts`, `integration-events.ts`, `domain/{product.entity,validators,errors}`, `infra/{products.schema,product.repository}`, `features/{create,get,list,update,delete}-product/{dto,handler,handler.test}` | 2026-05-13 |
| `realtime` | SSE fan-out realtime. Endpoint GET `/api/events` (auth-gated, kênh `sse:user:{id}`). Push qua `@/lib/realtime`. | `routes.ts` | 2026-06-13 |
| `wallets` | KHUNG FamilyWallet — ví Stellar của user. GET `/api/wallets` + `/:id` (ownership-scoped). Bảng `wallets`. | khuôn slice đầy đủ (index/routes/domain/infra/features) | 2026-07-20 |
| `guardians` | KHUNG — người bảo hộ. GET `/api/guardians/wallet/:walletId` (chỉ chủ ví). Bảng `guardians` (status CHECK invited/active/slow/offline/removed). | khuôn slice | 2026-07-20 |
| `presence` | KHUNG — theo dõi kết nối. GET `/api/presence/guardian/:guardianId` (chỉ chủ ví). Bảng `devices` + `presence_pings`. Ping 12:00 cần cron BullMQ repeatable — CHƯA dựng (skill new-cron). | khuôn slice | 2026-07-20 |
| `recovery` | KHUNG — mirror yêu cầu khôi phục on-chain. GET `/api/recovery/wallet/:walletId`. Bảng `recovery_requests` (status CHECK, risk_score 0..100, signals jsonb). | khuôn slice | 2026-07-20 |
| `inheritance` | KHUNG — thừa kế chia %. GET `/api/inheritance/wallet/:walletId`. Bảng `heirs` (bps CHECK 0..10000; tổng=10000 enforce tầng service) + `heartbeats`. | khuôn slice | 2026-07-20 |
| `indexer` | KHUNG — audit log append-only (wallet_id SOFT ref). GET `/api/audit/wallet/:walletId`. Bảng `audit_log`. Checkpoint getEvents thêm khi dựng thật (fw-indexer-notify). | khuôn slice | 2026-07-20 |
| `notifications` | KHUNG — hộp thông báo (template_key + params jsonb, render theo locale lúc gửi). GET `/api/notifications`. Bảng `notifications` (status/channel CHECK). | khuôn slice | 2026-07-20 |
| `risk` | KHUNG — risk engine rules thuần, KHÔNG bảng riêng (score ghi vào recovery_requests). GET `/api/risk`. Score chỉ trì hoãn, không tự cancel. | routes + domain + feature | 2026-07-20 |

## 7. Jobs (BullMQ)

| Job | Mô tả | Files | Cập nhật |
|---|---|---|---|
| `<job>` | <Mô tả ngắn> | schema, queue, worker | |

## 8. Emails (React Email)

| Template | Mô tả | Cập nhật |
|---|---|---|
| `src/emails/<name>.tsx` | <Mô tả> | |

## 9. Integrations (external API)

| Provider | Mô tả | Files | Cập nhật |
|---|---|---|---|
| `<provider>` | <Mô tả> | client, schemas | |

## 10. Services (cross-cutting)

| File | Mục đích | Cập nhật |
|---|---|---|
| `src/services/email/render.ts` | Discriminated union → render html/text/subject. | |
| `src/services/email/send.ts` | Idempotent send qua Resend + log. | |
| `src/services/uploads.ts` | presignUpload / proxyUploadImage / signedDownloadUrl. | |
| `src/services/webhooks/verify.ts` | HMAC verifier cho từng provider. | |

---

## 11. FamilyWallet bootstrap (2026-07-20)

Lớp demo carbon (9 module + jobs + integrations + lib geo/chain/sentinel/gpt/cdhc-jwt/officer-scope
+ middleware carbon-auth + seed + e2e script + PostGIS) đã xóa bằng `scripts/init-project.mjs
familywallet-api`. Giữ: `modules/product` (khuôn Vertical Slice), `modules/realtime` (SSE),
toàn bộ `lib/` core (gồm `pool-budget` — guard connection budget, KHÔNG phải demo).

Config FamilyWallet overlay: `.claude/rules/{security,stellar,code-style}.md` ·
`.claude/agents/{e2e-verifier,security-reviewer,soroban-auditor,ux-writer}.md` ·
`.claude/skills/fw-*` + `stellar-mainnet-deploy` · `docs/PROJECT-BRIEF.md` ·
`docs/TEMPLATE-PRIMER-BE.md` (primer template cũ) · `docs/TEMPLATE-DEVIATIONS.md`.

8 module FamilyWallet (khuôn theo `product`, xem CLAUDE.md):
`wallets` `guardians` `presence` `recovery` `inheritance` `indexer` `notifications` `risk`.

## Quy tắc cập nhật

1. **Tạo file mới** → thêm 1 dòng vào bảng tương ứng cùng lượt code đó.
2. **Xoá/đổi tên** → cập nhật/xoá dòng cũ.
3. **File > 300 dòng** → tách trước khi commit. Cập nhật lại map.
4. **Trước khi code** → đọc map. Nếu file trên disk không match map → đồng bộ trước.

## Hardening 2026-07 (feat/core-hardening)

| Khu vực | File | Vai trò |
|---|---|---|
| Security headers + CSRF | `src/app.ts` (§1.5–1.6) | secureHeaders (HSTS/XFO/CSP 'none'/CORP, xoá x-powered-by) + csrf origin-check /api/* — cors PHẢI trước csrf (preflight). |
| Shutdown drain | `src/index.ts` | Trần drain 10s (`SHUTDOWN_DRAIN_MS`) + `server.stop(true)` force-close SSE treo; PoC Docker: exit 0. |
| Hooks | `lefthook.yml` + `package.json` prepare | pre-commit: biome staged + gitleaks + boundaries; pre-push: validate. Thay husky/lint-staged (chưa từng wire — đã gỡ devDeps). |
| Secrets | `.gitleaks.toml` | default rules + SePay pattern + allowlist fixture `test-secret-*` (theo GIÁ TRỊ). |
| CI | `.github/workflows/ci.yml` | validate (bun pin 1.3.11) + audit report-only (flip blocking sau update deps — HUMAN-TODO) + gitleaks full-history CLI. |
| Supply chain | `renovate.json` | recommended + cron T2, KHÔNG auto-bump better-auth. |
| EOL | `.gitattributes` | eol=lf — chặn CRLF Windows làm biome đỏ repo. |
| Docs | `docs/HARDENING.md`, `docs/HUMAN-TODO.md` | cách hoạt động/verify + việc con người. |
| Skills | `.claude/skills/{hono-secure-headers,graceful-shutdown-readiness,supply-chain-guard}` | tái dùng cho dự án khác. |
