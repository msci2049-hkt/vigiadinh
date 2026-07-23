---
name: testing-be
description: Viết & chạy test BE đúng cho template — bun test, gọi Hono qua app.request (không cần TCP, né Bun.serve hỏng trên WSL), Postgres thật qua docker-compose với pgReachable() skip-nêu-lý-do, và kỷ luật phân biệt pass thật / skip / fail-env. Dùng khi user gõ "viết test BE", "test service / handler", "bun test", "test integration Postgres", "test đỏ mà code đúng", "app.request", "test cần DB", "test skip", "mock hay DB thật". Đọc TRƯỚC khi kết luận "test fail" — nhiều lỗi ở đây là fail-env (thiếu DB / port sai / WSL), không phải regress.
---

# Testing BE: bun test + app.request + pgReachable

> **Kỷ luật số 1**: **pass thật ≠ skip ≠ fail-env**. Skip (thiếu infra) KHÔNG phải pass; đừng nới test cho hết
> đỏ. Thao tác cơ học (viết test cho service) → skill `new-test`.

## Gọi HTTP qua `app.request` — KHÔNG dựng server

```ts
import { app } from "@/app";
const res = await app.request("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({...}),
  headers: { "content-type": "application/json", origin: "http://localhost:5173" } });
```

Cùng code path như `Bun.serve({ fetch: app.fetch })`, không cần TCP. **Bắt buộc trên WSL2** (Bun.serve inbound
hỏng — log "listening" nhưng không bind socket tới được). Mẫu thật: `src/middlewares/hash-guard.test.ts`.
⚠️ Test thủ công `/api/auth/*` bằng Request phải gửi header `Origin ∈ TRUSTED_ORIGINS` (nếu không csrf 403).

## Postgres thật: `pgReachable()` skip-nêu-lý-do

```ts
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
const reachable = await pgReachable();
// suite integration: if (!reachable) skip + in SKIP_REASON — KHÔNG fail
```

Template test integration dùng **Postgres thật** (docker-compose của repo), KHÔNG testcontainers. Khi DB không
tới được → **skip có lý do**, không fail giả. `src/test-support/pg.ts` cấp `pgReachable`/`SKIP_REASON`/`pgErrorCode`
(generic; fixtures demo tách ở `carbon-fixtures.ts`).

## Test lõi thuần trước (không cần stack)

Ưu tiên tách lõi thuần để unit-test không cần infra: `evaluatePoolBudget` (pool-budget.test.ts), `createRealtime`
(fan-out với transport fake — realtime-core.test.ts), `Semaphore` (semaphore.test.ts), `enforcePublicSignupRole`
(signup-role-guard.test.ts). Chỉ integration mới cần PG/Dragonfly thật.

## GOTCHAS (đã trả giá thật — đọc trước khi báo "test fail")

- **Test "(Postgres thật)" đỏ giả khi port 5432 là DB dự án khác** (BUG-012/014): máy dev chạy nhiều project →
  5432 có thể là Postgres schema khác → lỗi kiểu `null value in column "org_id"` (cột KHÔNG có trong template).
  **fail-env**, KHÔNG lỗi code. Trỏ `DATABASE_URL` vào đúng stack template hoặc dựng stack cô lập. Xem
  `.claude/rules/docker.md`.
- **Docker daemon không tới được từ WSL** → integration test "(Postgres thật)" skip đúng khi port unreachable;
  nhưng nếu port có DB khác → fail-env (trên). Verify thật: CI hoặc stack cô lập.
- **`bun run validate` KHÔNG chạy test** — typecheck+biome+boundaries+env-parity thôi. Sửa `hash-guard.ts`/service
  → chạy tay `bun test <file>`. Completeness-lock (HASH_PATHS vs GATED) chỉ so 2 literal, KHÔNG probe router →
  cập nhật CẢ HAI list bằng tay + chạy test.
- **Test cross-tenant** (nếu dự án multi-tenant): user A gọi resource B phải 403/404 — là gate bắt buộc. Template
  core single-tenant (chỉ demo carbon có officer-scope) nên chưa có suite này sẵn; thêm khi có tenant.
- **Signal test (SIGTERM) trên Windows vô nghĩa** → PoC graceful shutdown phải trên Docker cô lập (skill
  `graceful-shutdown-readiness`).

## Bằng chứng phải phân loại

Báo kết quả: **N pass / M skip (lý do) / K fail-env (lý do)**. Ví dụ phiên trước: `bun test` copy tạm → 71 pass /
7 skip / 0 fail. Skip vì thiếu PostGIS/DB là hợp lệ, KHÔNG phải pass.

## Cross-reference

skill `new-test` · `bun-runtime` (app.request, Bun.serve WSL) · `postgres-drizzle-data` (test query/lock) ·
`.claude/rules/docker.md` (DATABASE_URL đúng stack) · `graceful-shutdown-readiness`. Bug: `.claude/ERRORS.md` + `ERRORS.md`.
