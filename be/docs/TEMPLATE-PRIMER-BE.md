# CLAUDE.md — BE mẫu (Bun + Hono + Drizzle + Better Auth)

> Primer bắt buộc đọc trước mọi task. Bản đồ + luật ở đây; chi tiết sâu nằm ở
> `.claude/rules/` (auto-load) và `.claude/skills/<task>/SKILL.md`.
> **Mọi con số/path trong file này lấy từ code thật trên branch `main`.**
>
> Bản giới thiệu cho **người đọc** (ngôn ngữ · tính năng · điểm lưu ý): [`docs/GIOI-THIEU.md`](docs/GIOI-THIEU.md).

## 0. 4 LUẬT VÀNG (đọc trước — chi tiết ở skill tương ứng)

1. **API error envelope nhất quán.** Mọi lỗi ra CÙNG shape `{ error: { code, message, details? } }` qua
   `app.onError`; validate mọi input bằng `zv()` (không `zValidator` trực tiếp); middleware **throw**
   `HTTPException`, không `return c.json`. Tiền = số nguyên, migration additive-only, session = cookie
   (không JWT tay). → skill **`hono-api-patterns`**.
2. **Cluster = stateless.** Prod chạy N process (`src/cluster.ts`, SO_REUSEPORT); mọi state chia sẻ
   (rate-limit, SSE, lock, session, dedup, cache) phải qua **Dragonfly/Postgres**, KHÔNG để trong RAM một
   process. Cron không leader-lock = chạy N lần. → skill **`cluster-stateless`**.
3. **Scale đúng chiều, ĐO trước.** Read replica không cứu nghẽn ghi; thêm process không cứu nghẽn connection;
   cache không cứu query thiếu index. Đo (`pg_stat_statements`, p95, `pg_stat_activity`, cache-hit, lag) rồi
   chọn tier. → skill **`scaling-playbook`**.
4. **State = category-first (contract với FE).** Server state → TanStack Query (BE cấp envelope ổn định để FE
   cache được); form → RHF+Zod; URL/shareable → search params; UI toàn cục → Zustand. → FE skill
   **`state-management`**.

> Nguồn sự thật = **Postgres**; cache/queue/lock/rate-limit/pub-sub = **Dragonfly**. Fail-closed: nhánh lỗi
> KHÔNG được bypass authz/validation (cờ "mở cửa" default off). Chi tiết dữ liệu → skill `postgres-drizzle-data`.

## 1. TL;DR

Backend template production-grade: **Bun + Hono + Drizzle/Postgres + Better Auth + BullMQ/Dragonfly**.
Degit về là có sẵn: auth email+password, **xác minh email bằng OTP 6 số**, **quên mật khẩu bằng OTP**,
admin panel API + RBAC, SSE realtime cross-process, queue, graceful shutdown,
`/health` + `/ready`, secureHeaders + CSRF, Sentry, audit gate CVE, gitleaks.
(Webhook + cron **chưa nối dây** — chỉ có helper + skill, xem §5.)

Dùng làm nền cho: API nghiệp vụ có user/role, cần job nền + realtime, deploy Docker lên VPS.

⚠️ **Repo này chứa 2 lớp**: (a) **core template** (`modules/product`, `modules/realtime`, toàn bộ
`lib/`, `middlewares/`, `scripts/`) và (b) **demo nghiệp vụ "carbon"** (`modules/{admin,approval,
carbon,commune,me,plot,plot-document,pool,wallet}`, `jobs/*`, `lib/{geo,geo-pg,overlap-check,chain,
sentinel,gpt,cdhc-jwt,officer-scope}`, `middlewares/carbon-auth.ts`). Degit dự án mới → **xoá lớp (b)**.

## 2. Stack (version chính xác — `package.json`)

| Nhóm | Package | Version |
|---|---|---|
| Runtime | Bun (không có field `engines`) | CI pin `1.3.11`, Docker `oven/bun:1.3.8` |
| Framework | `hono` | `^4.12.28` |
| Auth | `better-auth` | `^1.6.23` |
| DB | `drizzle-orm` / `postgres` (postgres-js) | `^0.45.2` / `^3.4.9` |
| DB tool | `drizzle-kit` (dev) | `^0.31.10` |
| Queue | `bullmq` + `ioredis` | `^5.76.7` + `^5.10.1` |
| Rate limit | `rate-limiter-flexible` | `^11.1.0` |
| Lock | `redlock` | `^5.0.0-beta.2` |
| Validate | `zod` | `^4` |
| Log | `pino` | `^10.3.1` |
| Error | `@sentry/bun` | `^10.52.0` |
| Email | `resend` / `nodemailer` (dev→Mailhog) | `^6.12.3` / `^9.0.3` |
| HTTP out | `ofetch` + `cockatiel` (retry + circuit breaker) | `^1.5.1` + `^3.2.1` |
| Lint/format | `@biomejs/biome` | `^2.4.15` |
| TS | `typescript` (**peerDependency**) | `^5.9.3` |

`overrides` (pin CVE): `lodash 4.18.1`, `@grpc/grpc-js 1.14.4`, `protobufjs 7.6.5`, `tmp 0.2.7`, `undici 7.28.0`.

## 3. Cấu trúc

```
src/
  index.ts          entry: Sentry (import ĐẦU TIÊN) → Bun.serve(reusePort) → graceful shutdown
  cluster.ts        supervisor spawn WEB_INSTANCES process con (prod CMD)
  app.ts            build Hono app + mount order (KHÔNG start server)
  env.ts            parse env, fail-fast exit(1) + in tên biến sai
  env.schema.ts     Zod schema — 1 nguồn cho env.ts, env-check.ts, check-env-parity.ts
  db/               index.ts (pool) + schema/<table>.ts (1 file 1 bảng; auth.ts là ngoại lệ CLI sinh)
  modules/<name>/   business module — Layered hoặc Vertical Slice (xem §4)
  jobs/<name>/      {schema,queue,worker}.ts — BullMQ
  workers/index.ts  entry worker riêng (process tách), SIGTERM/SIGINT
  middlewares/      auth, error, rate-limit, validator(zv), raw-body, hash-guard
  lib/              auth, access-control, db, redis, realtime, events, storage, logger, sentry…
  services/         cross-cutting (webhooks/verify.ts)
  types/hono.d.ts   ContextVariableMap: user, session, activeOrgId, rawBody, requestId, log
scripts/            migrate, env-check, check-env-parity, check-boundaries, seed, seed-admin…
drizzle/            *.sql (drizzle-kit sinh) + auth-indexes.sql + postgis.sql
deploy/             deploy.sh, release.sh, backup.sh, restore.sh, docker-compose.prod.yml
.claude/            CLAUDE.md(stub) · rules/ · skills/ · agents/ · hooks/ · ERRORS.md · CODE_BASE_MAP.md
```

## 4. Kiến trúc & pattern

- **1 module = 1 bounded context.** `< 5 endpoint` → **Layered** (`types/dto/service/routes` + `service.test.ts`).
  `≥ 5 endpoint` → **Vertical Slice** (`index.ts` facade + `domain/` + `infra/` + `features/<f>/{dto,handler,handler.test}`).
  Reference slice: `src/modules/product/`.
- **Module KHÔNG import lẫn nhau.** Chỉ 3 đường: `eventBus` (sync, in-process) · BullMQ (async, retry) ·
  public facade `@/modules/<name>` (index.ts). Cấm deep import `features/` `infra/` `domain/`.
  Enforce: `bun run check:boundaries`.
- **Luồng lỗi**: service `throw "PAYMENT_NOT_FOUND"` (domain string) → middleware `throw HTTPException` →
  route **không** `try/catch` → `app.onError(errorHandler)` map ra `{ error: { code, message, details? } }`.
  Chỉ nhánh unknown mới `Sentry.captureException`.
- **Mount order thật trong `src/app.ts`** (đặt sai = 403 preflight hoặc sign-in 404):
  `cors` → `secureHeaders` → `csrf(/api/*)` → requestId → request logger → `hashGuard(/api/auth/*)`
  → `auth.handler(/api/auth/*)` → session-populate → `/health` `/ready` → module routes → `onError`.
  `cors` **phải** trước `csrf` (cors trả OPTIONS 204 và không gọi `next()`).
- **Server-state**: Postgres là nguồn sự thật; Dragonfly chỉ cache/queue/rate-limit/pub-sub.

## 5. Tính năng có sẵn

| Tính năng | Nơi ở | Ghi chú |
|---|---|---|
| Email + password | `lib/auth.ts` | ngưỡng password (min 12 / max 128) + OTP length ở **`lib/validation-limits.ts`** (nguồn duy nhất, D-052), scrypt pin ở `lib/password-hash.ts`, `autoSignIn: false` |
| **Xác minh email = OTP 6 số** | `lib/auth.ts` plugin `emailOTP` | `overrideDefaultEmailVerification: true` → BA gửi OTP thay link |
| **Quên mật khẩu = OTP 6 số** | cùng plugin | **KHÔNG có `sendResetPassword`**; `/reset-password` (token) còn tồn tại nhưng inert |
| Admin + RBAC | `lib/auth.ts` plugin `admin` + `lib/access-control.ts` | Better Auth có đúng **2 role**: `admin`, `user`. (Lớp demo carbon thêm role thứ 3 `commune_officer` qua env `OFFICER_ROLE`, guard riêng ở `middlewares/carbon-auth.ts`.) |
| Chống leo quyền qua sign-up | `lib/signup-role-guard.ts` | 3 lớp; xem `.claude/rules/auth.md` |
| Hash concurrency guard | `middlewares/hash-guard.ts` | Semaphore 2 slot; quá tải → `503 HASH_CAPACITY` |
| SSE realtime | `modules/realtime/` + `lib/realtime{,-core}.ts` | `GET /api/events`, kênh `sse:user:{id}`, fan-out qua Redis pub/sub |
| Queue (BullMQ) | `jobs/*`, `workers/index.ts` | Queue name **bắt buộc** `{curly-braces}`. 2 job, cả hai **enqueue theo sự kiện** |
| Hardening | `app.ts` (secureHeaders/csrf), `index.ts` (shutdown, `/ready`), `lib/sentry.ts`, `.github/workflows/ci.yml` | audit gate **chặn thật** |

🔴 **Có code nhưng CHƯA nối dây — đừng nói là "đã có":**
- **Webhook**: `services/webhooks/verify.ts` (HMAC `timingSafeEqual` cho Stripe/GitHub/SePay, tolerance 5 phút
  chỉ Stripe) và `middlewares/raw-body.ts` (`captureRawBody`) **tồn tại nhưng không route nào gọi**, và
  **không có bảng `webhook_events`**. Muốn nhận webhook thật → skill `webhook-receiver` (nó dựng đủ 3 lớp).
- **Cron**: `lib/redlock.ts` khai `redlock` nhưng **không file nào import**. **Không có repeatable job nào.**
  Muốn cron → skill `new-cron`.

**Auth endpoints** (base `/api/auth`): `POST sign-up/email` · `POST sign-in/email` · `POST sign-out` ·
`GET get-session` · `POST email-otp/send-verification-otp` · `POST email-otp/verify-email` ·
`POST email-otp/request-password-reset` · `POST email-otp/reset-password` · `POST admin/*`
(`list-users`, `create-user`, `set-role`, `ban-user`, `impersonate-user`, `revoke-user-sessions`…).

Rate limit **route auth** (Better Auth built-in, key **không** prefix `/api/auth`):
`sign-in/email` 5/60s · `sign-up/email` 3/60s · `email-otp/send-verification-otp` 2/60s ·
`email-otp/verify-email` 10/60s · `email-otp/request-password-reset` 3/300s · `email-otp/reset-password` 5/300s.

Rate limit **route nghiệp vụ** là cơ chế **khác**: factory `rateLimit({points, duration, keyPrefix, keyResolver})`
ở `src/middlewares/rate-limit.ts` (backing store Dragonfly). Mẫu duy nhất trong repo: `src/modules/plot/routes.ts:15`.
Skill: `rate-limit-route`.

## 6. Convention BẤT BIẾN (phá = CI đỏ hoặc mất data)

1. **File ≤ 300 dòng.** Service > 300 → tách Vertical Slice.
2. **Không `any`, không `@ts-ignore`.** Dùng `unknown` + narrow.
3. **Mọi HTTP input qua `zv()`** (`@/middlewares/validator`), **không** `zValidator` trực tiếp (BUG-001).
4. **Mọi env qua `@/env`.** Thêm biến → sửa `src/env.schema.ts` **và** `.env.example` **và**
   `deploy/env.production.example`, nếu không `check:env-parity` FAIL.
5. **Migration additive-only.** Không `DROP COLUMN` trực tiếp → workflow 3-release. Không sửa tay `drizzle/*.sql`.
6. **1 file 1 bảng** trong `src/db/schema/`; **PK = ULID `varchar(26)`**; "enum" = `varchar` + Zod (**không**
   `pgEnum`); timestamp **luôn** `withTimezone: true`; FK **phải** có `onDelete` + index.
   *Ngoại lệ duy nhất*: `src/db/schema/auth.ts` do Better Auth CLI sinh — gộp 4 bảng (`user`, `session`,
   `account`, `verification`), dùng `text` id, không `withTimezone`. **Không sửa tay file này.**
   ⚠️ **Tham chiếu tới user = soft ref, KHÔNG hard FK.** `user.id` là `text` (CLI sinh) nên bảng nghiệp vụ
   dùng `varchar("user_id", { length: 64 }).notNull()` + **index**, **không** `.references(() => user.id)`.
   Mẫu: `src/db/schema/plots.ts:7,39,58`. FK cứng chỉ dùng giữa các bảng **tự viết** với nhau.
7. **Tiền = số nguyên**, đơn vị nhỏ nhất. Không `real`/`float`/`numeric`. Rule `db-schema.md` viết `integer`
   (cents); code carbon thật dùng `bigint("amount", { mode: "number" })` cho VND (`wallet-txns`, `pool-*`).
   Chọn kiểu theo miền giá trị, nhưng **luôn là số nguyên**.
8. **Không Redlock cho payment** → DB transaction + idempotency key UNIQUE + `SELECT FOR UPDATE`.
9. **BullMQ queue name có `{hashtag}`** (Dragonfly). Enforce: `check:boundaries`.
10. **`eventBus.on` phải sync, không `await`, không I/O.** Việc durable → BullMQ.
11. **HMAC compare = `crypto.timingSafeEqual`**, không `===`.
12. **No-JWT cho session**: session là **cookie Better Auth**. (`lib/cdhc-jwt.ts` chỉ phục vụ demo carbon nhận JWT từ hệ thống ngoài — không phải cơ chế session của template.)
13. **Role do server sở hữu**: `additionalFields.role` phải `input: false` + `databaseHooks.user.create.before`
    gọi `enforcePublicSignupRole(...)` có phân biệt `ctx.path`. **Ép role vô điều kiện = phá `admin.createUser`.**
14. **Access-control phải mirror FE** `mau-demo-fe-vite/packages/auth/src/access-control.ts` (xem §8).

Gate: `bun run validate` = `typecheck` + `biome check` + `check:boundaries` + `check:env-parity`.
⚠️ **`validate` KHÔNG chạy test.** Sửa `hash-guard.ts` → chạy tay `bun test src/middlewares/hash-guard.test.ts`.

## 7. Chạy dev

```bash
bun install
cp .env.example .env          # rồi SỬA: xem cảnh báo TRUSTED_ORIGINS bên dưới
bun run env:check             # gate: in ra biến nào thiếu/sai
docker compose up -d          # postgres + dragonfly + mailhog (api/worker nằm sau profile "prod")
bun run auth:generate         # sinh src/db/schema/auth.ts
bun run db:migrate
bun run seed:admin            # dev: admin@example.com / admin123456789
bun run dev                   # http://localhost:3000
bun run worker                # process riêng cho BullMQ
```

- 📧 Đọc email dev tại Mailhog **http://localhost:8025** (`docker compose up -d` đã gồm mailhog).
- 🔴 **`TRUSTED_ORIGINS` nuôi cả 3**: `cors({origin})`, `csrf({origin})`, Better Auth `trustedOrigins`.
  `.env.example` mặc định đã chứa origin FE dev (`5173,5174`) — đổi port/origin FE thì PHẢI sửa theo,
  nếu không cookie không bao giờ được set → login/SSE/mọi API từ FE fail (không có lỗi rõ ràng).
- **11 biến bắt buộc** (thiếu = exit(1) lúc boot): `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (≥32),
  `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `RESEND_API_KEY`, `EMAIL_FROM`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. (Resend/R2 nhận placeholder — chỉ lỗi khi thực sự dùng.)
- `REDIS_URL` default port **3699** (né Redis Windows chiếm 6379).
- Sửa `src/lib/auth.ts` → **đúng thứ tự**: `auth:generate` → `db:generate` → `db:migrate`.

## 8. Mở rộng & contract BE↔FE

**Thêm gì → đọc skill nào**: module mới → `new-module` · endpoint → `new-route` · bảng → `new-schema` +
`new-migration` · job → `new-job` / `new-cron` · SSE event → `add-sse` · webhook → `webhook-receiver` ·
OAuth/2FA/passkey → `add-oauth` / `add-2fa` / `add-passkey` · upload → `upload-file` · deploy → `deploy-vps`.

**Contract với `mau-demo-fe-vite`** (mô tả này khớp §8 của CLAUDE.md bên FE):

| Mặt | Sự thật |
|---|---|
| Auth | Cookie Better Auth (`sameSite=lax`, `httpOnly`, `secure` chỉ prod). FE gửi `credentials:'include'`. **Không JWT, không Bearer.** |
| CORS | `origin: env.TRUSTED_ORIGINS`, `credentials: true`, `allowHeaders` gồm `sentry-trace` + `baggage`. |
| CSRF | `csrf({origin: env.TRUSTED_ORIGINS})` trên `/api/*`. JSON được bỏ qua; form/multipart/thiếu content-type bị chặn. |
| Access control | **Phần khai báo** (`statement`/`ac`/`roles`/`AppRole`) ở `src/lib/access-control.ts` **phải giống hệt** FE `packages/auth/src/access-control.ts`. Hiện **khớp 100%** (copy tay, không phải shared package; chỉ khác comment). Lệch = FE cho bấm nút server từ chối. |
| Realtime | `GET /api/events` (auth bằng cookie). Kênh `sse:user:{id}`. Event: `connected`, `ping` (20s), + domain event `{event,data,id}`. **At-most-once** — FE phải refetch bù khi reconnect. |
| API | FE gọi **plain fetch** (`packages/core/src/api-client.ts`), **không** Hono RPC (`rpc.ts` là scaffold, BE không export `AppType`). Base URL FE = `VITE_API_URL`. Prefix `/api/*`; `/health` + `/ready` không prefix. |
| Lỗi | Chưa auth → **401** (FE đá `/login`). Quá tải → **503 + `Retry-After`** (FE backoff). |
| Sentry | DSN tách: BE `SENTRY_DSN`, FE `VITE_SENTRY_DSN`. Trace FE→BE nối được nhờ `sentry-trace`+`baggage` trong `allowHeaders`. |
| Env phải khớp | BE `TRUSTED_ORIGINS` ⊇ origin FE · BE `BETTER_AUTH_URL` == FE `VITE_API_URL` |
| Validation limits | **`GET /api/config/validation`** (public, mount ở `app.ts` cạnh `/health`) trả `lib/validation-limits.ts` — FE fetch lúc boot và build Zod schema từ đây, KHÔNG hardcode ngưỡng (FE có guard `check-validation-parity.mjs`). Thêm ngưỡng form mới → thêm vào `validation-limits.ts`, đừng hardcode 2 nơi (D-052). |

## 9. Skills & rules

**Rules** (`.claude/rules/`, auto-load; frontmatter hiện dùng key `globs:` — key Claude Code tài liệu hoá là
`paths:`, nên thực tế **mọi rule đều luôn load**):

| Rule | Bất biến cốt lõi |
|---|---|
| `auth.md` | Mount order · role server-owned 3 lớp · emailOTP config bất biến · `email-otp/reset-password` phải có trong **cả** `HASH_PATHS` lẫn `GATED` |
| `db-schema.md` | 1 file 1 bảng · ULID · no `pgEnum` · `withTimezone` · FK onDelete+index · additive-only |
| `bullmq.md` | `{hashtag}` queue name · 2 ioredis connection tách · `removeOnComplete/Fail` · cron `attempts:1` + redlock |
| `events.md` | `eventBus.on` sync-only, no I/O · durable → BullMQ (guard là smell-detector, có gap) |
| `module-boundary.md` | Layered vs Slice theo số endpoint · chỉ 3 cách cross-module |
| `payment.md` | No Redlock · integer cents · transaction + `SELECT FOR UPDATE` + audit row |
| `webhook.md` | HMAC timingSafeEqual + timestamp tolerance + UNIQUE dedup · ack < 1s |

🔴 **Rule đã lạc hậu — CODE THẮNG** (rule auto-load nên dễ bị tin nhầm):
- `auth.md` §"Mount order TUYỆT ĐỐI" vẽ `CORS → auth.handler → session → routes`. **Sai.**
  `src/app.ts` thật chèn `secureHeaders → csrf → requestId → logger → hashGuard` **giữa** cors và `auth.handler` (§4).
  Nâng `auth.handler` lên ngay sau cors = mất hardening trên `/api/auth/*`.
- `db-schema.md` ví dụ FK `.references(() => users.id, ...)`. **Không có bảng `users` nghiệp vụ** — user do
  Better Auth CLI sinh, id là `text`. Với `user_id` dùng soft ref (§6.6).

**Skills** (`.claude/skills/`, 42 — đọc `SKILL.md` trước khi code). Hai lớp:

**(a) Decision skills — bản đồ tri thức 2026** (chọn *phương án*, đọc khi đứng trước quyết định):

| Skill | Khi nào dùng (trigger) |
|---|---|
| `postgres-drizzle-data` ⭐ | schema/query: pool theo process, keyset, N+1→inArray, index, khóa row, migration expand-contract, PG16 vs PG18 |
| `cluster-stateless` ⭐ | trước khi thêm state in-RAM; rate-limit/SSE/lock/session/cache khi đa-process; cron trùng |
| `scaling-playbook` ⭐ | scale, "too many connections", `/ready` 503, p95 cao, PgBouncer, read replica |
| `bun-runtime` | Bun.serve/build/spawn, giới hạn Bun 1.3 (redis/SQL), WSL app.request, graceful |
| `hono-api-patterns` | thêm route/API, error envelope, `zv()`, mount order, RPC scaffold |
| `bullmq-jobs` | job nền, dedup native, cron leader-lock, worker riêng |
| `caching-patterns` | thêm cache-aside Dragonfly, invalidation, stampede (chưa có helper) |
| `file-storage` | upload/serve R2, presign vs proxy, validate MIME/size |
| `email-delivery` | gửi email Mailhog/Resend, không await trong request, deliverability |
| `observability-be` | Sentry/pino/request-id có sẵn; thêm OTel/metrics/latency budget |
| `testing-be` | bun test, `app.request`, `pgReachable`, phân biệt pass/skip/fail-env |

**(b) Task skills — thao tác cơ học** (làm *việc cụ thể*, decision-skill ở trên là "chủ" cho phương án):

`new-module` `new-route` `new-schema` `new-migration` `new-feature` `new-test` `new-job` `new-cron`
`new-email` `add-sse` `protect-route` `rate-limit-route` `error-handler` `upload-file` `call-external-api`
`webhook-receiver` `seed-data` `setup-better-auth` `add-auth-plugin` `add-oauth` `add-2fa` `add-passkey`
`hono-secure-headers` `graceful-shutdown-readiness` `setup-monitoring` `supply-chain-guard`
`update-dependencies` `db-backup` `deploy-vps` `rollback` `commit-push`

**Agents** (`.claude/agents/`): `code-explorer` · `code-reviewer` · `security-auditor` · `migration-checker` · `test-curler`.

**Hooks** (`.claude/settings.json`): `pre-bash-guard.sh` chặn cứng `rm -rf`, `git push --force`, `DROP COLUMN/TABLE`,
đọc `.env`, `db:drop` · `pre-commit-validate.sh` chặn `git commit` nếu `bun run validate` fail · `post-edit.sh`
format + cảnh báo >300 dòng / `any` · `session-start.sh`, `stop-reminder.sh` nhắc `CODE_BASE_MAP.md`.

## 10. Gotchas đã trả giá

Chi tiết: **`.claude/ERRORS.md`** (BUG-001…013 + cheatsheet) và **`ERRORS.md`** ở root (BUG-014).
*Hai file này KHÔNG trùng nhau — đọc cả hai. Bug mới ghi vào `.claude/ERRORS.md`.*

| # | Chữ ký | Fix |
|---|---|---|
| BUG-008 | 2 request duyệt song song 2 lô đè nhau → **chia tiền 2 lần** (re-check TOCTOU không đủ) | `db.transaction` + `pg_advisory_xact_lock` theo đơn vị |
| MAJOR-1 | 2 polygon **trùng khít** không bị phát hiện overlap → claim đất 2 lần | thêm điểm mẫu trung điểm cạnh + tâm |
| BUG-011 | Flip `NODE_ENV=production` → pm2 crash-loop, không biết thiếu biến nào | `env:check` gate + boot in tên biến + `check:env-parity` |
| BUG-007 | BullMQ `jobId` chứa `":"` → `Custom Id cannot contain :`, **chỉ lộ khi Redis sống** | đổi separator `:` → `-` |
| MAJOR-3 | Dev token bật theo default → prod quên env = **mạo danh** | fail-closed: `CARBON_DEV_TOKENS` default `false` |
| BUG-005b | `err.code === "23505"` không match vì Drizzle **bọc** PostgresError | đi chuỗi `err.cause` |
| BUG-009 | Double-submit duyệt → lô **tự đè chính nó**, gắn cờ overlap oan | `excludePlotId` + status guard |
| BUG-013 | `docker build` fail: `better-sqlite3` chạy node-gyp trong image bun | stage `deps` cài `--ignore-scripts` |
| BUG-001 | `zValidator` short-circuit → lỗi không đúng shape chuẩn | dùng wrapper `zv()` |
| BUG-012/014 | Test đỏ **giả**: thiếu Postgres, hoặc port 5432 là DB **dự án khác** | `pgReachable()` → skip-nêu-lý-do; trỏ đúng DB template |

**Kỷ luật**: phân biệt **pass thật / skip / fail-env**. Skip ≠ pass. Đừng nới test để hết đỏ.

## 11. Deploy (Docker → VPS)

- CI (`.github/workflows/ci.yml`): `bun run validate` → **`bun audit --audit-level=high` (BLOCKING)** →
  job `secrets-scan` gitleaks full-history (BLOCKING). **CI không chạy test** (test chạy ở `deploy/release.sh`).
- Trên máy dev: `bash deploy/release.sh` = chặn nếu không ở `main` → `validate` → `bun test` → `git push`.
- Trên VPS: `bash deploy/deploy.sh` — gate theo thứ tự
  `git pull` → `bun install` → **`env:check --env-file deploy/.env.production`** → `compose build` →
  **`migrate --dry-run` rồi `migrate`** → `compose up -d` → verify `/health` (90s) + `/ready`.
  Fail ở bất kỳ gate nào → **dừng, container cũ vẫn sống**.
- Migration chỉ chạy ở gate này (`app`/`worker` set `RUN_MIGRATIONS=false`). Cả batch trong 1 transaction → fail = rollback sạch.
- **Không có `rollback.sh`** trong `deploy/`. Skill `rollback` mô tả rollback qua SSH và **không** revert migration đã apply.
- Backup: `deploy/backup.sh` (pg_dump → gzip, `RETENTION_DAYS` mặc định 7) · restore: `deploy/restore.sh <file.sql.gz>`.
- Runbook đầy đủ: `docs/HUONG-DAN-DEPLOY-DOCKER-VPS.md`. Skill: `deploy-vps`.

## 12. Degit sang dự án mới

**Bước 1 — BẮT BUỘC, trước mọi việc khác** (rule `new-project.md` auto-load sẽ nhắc):

```bash
npx degit <template-repo> <ten-du-an> && cd <ten-du-an>
node scripts/init-project.mjs <ten-du-an>     # KHÔNG chạy trên repo mẫu (script tự guard)
```

Script tự làm: xoá lớp demo carbon (danh sách file + block đánh dấu `[TEMPLATE-DEMO:carbon]`
trong 12 file wiring) → đổi `package.json.name` + README → sinh `.env` (secret MỚI, slug,
port rảnh) → reset git → `bun install` + sinh baseline migration mới → in checklist việc tay.
Cờ: `--keep-demo` (giữ lớp carbon) · `--no-install` · `--no-git`.

**Bảng CHỖ CẦN THAY** — script làm ✅, người/agent làm ✋:

| Nhóm | Chỗ thay | Ai |
|---|---|---|
| Danh tính | `package.json` `name` | ✅ script |
| Danh tính | `COMPOSE_PROJECT_NAME` trong `.env` (prefix container/network/volume) | ✅ script (= slug) |
| Danh tính | `COOKIE_PREFIX` trong `.env` (cookie không phân biệt port — trùng = đè session dự án khác) | ✅ script (= slug) |
| Danh tính | `README.md` tiêu đề + mô tả; `docs/GIOI-THIEU.md`, `.claude/CODE_BASE_MAP.md` (còn nhắc demo) | ✋ tiêu đề ✅ / nội dung ✋ |
| Secret | `BETTER_AUTH_SECRET` — **sinh mới, cấm tái dùng của mẫu** (trùng secret = session dự án này verify được ở dự án kia) | ✅ script |
| Secret | `RESEND_API_KEY`, `R2_*`, `SENTRY_DSN` (tạo project Sentry mới), webhook secret | ✋ |
| Hạ tầng | Host port docker (`DB_PORT`/`REDIS_PORT`/`MAILHOG_*`/`API_PORT`) + `DATABASE_URL`/`REDIS_URL` khớp | ✅ script (dò port rảnh) |
| Hạ tầng | `TRUSTED_ORIGINS` (dev đã đúng 5173/5174; prod = origin FE thật), `BETTER_AUTH_URL` public | ✋ khi lên prod |
| Hạ tầng | `deploy/env.production.example` → `deploy/.env.production` (mọi `<...>` phải thay — `env:check --env-file` chặn) | ✋ |
| DB | Migration: script xoá `drizzle/00*.sql` + `meta/` (chứa bảng demo) và sinh **baseline mới**; `drizzle/auth-indexes.sql` giữ | ✅ script |
| Git | `rm -rf .git && git init -b main`; tạo repo GitHub mới + `git remote add` + push | ✅ init / ✋ remote |
| CI/CD | Bật Renovate, cài gitleaks binary, xem run CI đầu xanh | ✋ |
| FE cặp đôi | Repo FE degit riêng, chạy init-project bên FE; `VITE_API_URL`==`BETTER_AUTH_URL`; **access-control 2 repo mirror** | ✋ |

Sau init: `bun run env:check && bun run validate && docker compose up -d && bun run db:migrate && bun run seed:admin`.

→ **auth (email+OTP+forgot), admin API + RBAC, SSE, queue, hardening chạy sẵn từ ngày 1.**
Việc con người còn lại: `docs/HUMAN-TODO.md`.
