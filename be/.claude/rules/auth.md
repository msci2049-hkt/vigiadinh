---
globs: src/lib/auth.ts,src/middlewares/auth.ts,src/modules/auth/**,src/db/schema/auth.ts
description: Better Auth patterns. Mount order, plugin imports, type augmentation.
---

# Rule: Better Auth

Áp dụng khi đụng vào file auth.

## Production-grade defaults (đã có sẵn template)

Mặc định mọi dự án clone về:

- **Cookie cache 5 phút** — giảm ~90% query DB cho session lookup.
- **Rate limit per route** (storage Dragonfly prod, memory dev):
  - `/sign-in/email`: 5 req/phút
  - `/sign-up/email`: 3 req/phút
  - `/email-otp/send-verification-otp`: 2 req/phút (chống spam gửi OTP)
  - `/email-otp/verify-email`: 10 req/phút (nới — guard thật là `allowedAttempts`)
  - `/email-otp/request-password-reset`: 3 req / 5 phút
  - `/email-otp/reset-password`: 5 req / 5 phút
- **Email verification** — bắt buộc trong production (`requireEmailVerification: isProd`),
  xác minh bằng **OTP 6 số** (emailOTP plugin), KHÔNG dùng link.
- **Quên mật khẩu** — **OTP 6 số** (emailOTP `request-password-reset` + `reset-password`),
  KHÔNG dùng link. `sendResetPassword` (link) đã gỡ khỏi `emailAndPassword`.
- **Secondary storage** Dragonfly — CHỈ bật production (dev memory).
- **`useSecureCookies` + `sameSite=lax`** — cookie chỉ HTTPS prod.
- **Cleanup cron**: `bun run auth:cleanup` (xoá session + verification expired > 1 ngày).
- **9 perf index**: `drizzle/auth-indexes.sql` (apply 1 lần lúc init).

Mailhog UI: http://localhost:8025 — đọc email gửi ra trong dev.

Skill nâng cao khi cần: `add-oauth`, `add-2fa`, `add-passkey`.

## Email verification + reset mật khẩu bằng OTP 6 số (emailOTP plugin)

Xác minh email và quên-mật-khẩu dùng **OTP 6 số** (không link) qua `emailOTP()` plugin
(`src/lib/auth.ts`). Cấu hình BẤT BIẾN:

- `overrideDefaultEmailVerification: true` — **BẮT BUỘC**. Không có nó, BA gửi CẢ link
  (`emailVerification.sendVerificationEmail`) LẪN OTP → user nhận 2 email. Bật `true` →
  plugin override sender thành OTP. Vì vậy `emailVerification` block CHỈ giữ
  `sendOnSignUp: true` + `autoSignInAfterVerification: true`, **bỏ** `sendVerificationEmail`.
  KHÔNG cần `sendVerificationOnSignUp` (thừa & vô hiệu khi override=true).
- `storeOTP: "hashed"` — OTP lưu HASH trong `verification.value`, KHÔNG plaintext.
- `otpLength: 6`, `expiresIn: 300` (5 phút).
- `allowedAttempts: 5` — sai 5 lần → OTP bị huỷ, lần thử tiếp trả **403 `TOO_MANY_ATTEMPTS`**
  (phải xin OTP mới). Đây là guard chính chống dò OTP (6 số = 10⁶ tổ hợp).
  ⚠️ Từ BA 1.6.21, **rate limit chạy TRƯỚC plugin handler** → với endpoint có limit
  chặt hơn allowedAttempts (vd `reset-password` 5/5phút), brute-force bị chặn bằng
  **429 Too Many Requests** trước khi kịp thấy 403 TOO_MANY_ATTEMPTS (PoC 2026-07-10:
  lần sai thứ 6 → 429). Cùng một lớp bảo vệ, khác mã lỗi — FE phải xử lý CẢ 429 lẫn 403.
- `sendVerificationOTP({ email, otp, type })` — điểm wiring gọi `sendEmail`. `type` ∈
  `email-verification | forget-password | sign-in | change-email` → subject/body khác nhau.

**3 lớp chống brute-force OTP** (OTP dò được, khác token link dài): `allowedAttempts: 5`
(huỷ OTP sau 5 sai) + `expiresIn: 300` (hết hạn 5 phút) + rate-limit `send-verification-otp`
2/phút & `request-password-reset` 3/5phút (rotate OTP mới phải qua đây). `verify-email` để
nới (10/phút) để `allowedAttempts` là ràng buộc thật, tránh khoá user gõ nhầm.

**Privacy-preserving forget** — `request-password-reset` với email KHÔNG tồn tại vẫn trả
`200 {success:true}` (BA không lộ user-enumeration). **GIỮ NGUYÊN**, đừng thêm nhánh "user
not found". Đây là chống enumeration có chủ đích.

**Endpoint** (base `/api/auth`): `email-otp/send-verification-otp`, `email-otp/verify-email`,
`email-otp/request-password-reset` (KHÔNG dùng `forget-password/email-otp` — deprecated ở
BA 1.6.x), `email-otp/reset-password`. Reset qua OTP chạy scrypt → xem hash-guard dưới.

### hash-guard: `/api/auth/email-otp/reset-password` (BẮT BUỘC)

CHỈ `email-otp/reset-password` (đặt mật khẩu mới) chạy scrypt trong emailOTP →
**BẮT BUỘC** có trong `HASH_PATHS` (`src/middlewares/hash-guard.ts`) **VÀ** mảng `GATED`
(`hash-guard.test.ts`). `send-verification-otp` + `verify-email` KHÔNG hash → KHÔNG gate.
⚠️ Completeness-lock chỉ so 2 literal (HASH_PATHS vs GATED), KHÔNG probe router thật, và
`bun run validate` KHÔNG chạy test → phải cập nhật CẢ HAI list bằng tay + chạy
`bun test src/middlewares/hash-guard.test.ts`.

### Schema — KHÔNG cần migration mới

emailOTP KHÔNG khai `schema` riêng — tái dùng bảng `verification` (id/identifier/value/
expiresAt) sẵn có. `bun run auth:generate` → no-op; `bun run db:generate` → "No schema
changes". (auth:generate có thể fail node-gyp trên Windows — nếu diff no-op thì bỏ qua.)

## Role = server sở hữu — KHÔNG tự-phong qua sign-up (BẤT BIẾN)

Lỗ hổng kinh điển của Better Auth: `additionalFields` mặc định `input:true` → client POST
`{"role":"admin"}` vào `/sign-up/email` có thể tự lên admin (mass-assignment / privilege
escalation). Template này chặn **3 lớp defense-in-depth** — giữ đủ cả 3, đừng gỡ lớp nào:

- **Lớp 1 (schema, `src/lib/auth.ts`):** `user.additionalFields.role = { type:"string",
  input:false, defaultValue:"user" }`. `input:false` → BA loại role khỏi body sign-up; BA 1.6.x
  còn HARD-REJECT `400 FIELD_NOT_ALLOWED` nếu body có role. `admin()` plugin cũng khai role
  `input:false` — ta khai LẠI tường minh để bất biến sống sót cả khi admin plugin bị gỡ.
- **Lớp 2 (`databaseHooks.user.create.before`):** bảo hiểm KHÔNG phụ thuộc `input:false`.
  Gọi `enforcePublicSignupRole(userData, ctx?.path)` (`src/lib/signup-role-guard.ts`): CHỈ ép
  role về whitelist (`PUBLIC_SIGNUP_ROLES = {"user"}`) khi `ctx.path ∈ PUBLIC_SIGNUP_PATHS`
  (`/sign-up/email`). Đường khác giữ nguyên → admin.createUser + seed KHÔNG bị đụng.
- **Lớp 3 (rule này):** các BẤT BIẾN dưới.

### BẤT BIẾN

- Role nhạy cảm (`admin`, `staff`, `super_admin`, …) **KHÔNG BAO GIỜ** đến từ client sign-up.
- `additionalFields.role` **BẮT BUỘC** `input:false`.
- `databaseHooks.user.create.before` phải whitelist role cho public sign-up (default `"user"`),
  phân biệt admin API qua `ctx.path`. Bật OAuth → thêm callback social sign-up vào
  `PUBLIC_SIGNUP_PATHS` (skill `add-oauth`).

### Anti-pattern CẤM

- ❌ Thêm `additionalField` role với `input:true`.
- ❌ Tin `ctx.body.role` ở public sign-up.
- ❌ Ép role **VÔ ĐIỀU KIỆN** trong hook (không check `ctx.path`) → **PHÁ admin.createUser**
  (ép cả user do admin tạo về `"user"`).

### Test BẮT BUỘC khi đụng auth (4 ca)

1. sign-up `{role:"admin"}` → DB role ≠ admin (bị chặn: `400 FIELD_NOT_ALLOWED` hoặc `"user"`). ✅
2. sign-up `{role:"staff"}` / `{data:{role:"admin"}}` → không leo thang. ✅
3. admin.createUser `{role:"admin"}` với session ADMIN → role = `admin` (**KHÔNG phá admin** — ca
   dễ sập nhất; nhớ gửi header `Origin ∈ trustedOrigins` nếu test bằng curl/Request thủ công). ✅
4. `bun run seed:admin` → role = `admin` (bootstrap vẫn chạy). ✅

Unit test lớp 2: `bun test src/lib/signup-role-guard.test.ts`.

## Cookie-cache: cửa sổ thu hồi (revocation window) — OPTIONAL

`cookieCache` (TTL 5 phút, `src/lib/auth.ts`) ký session vào cookie → đỡ ~90% query DB.
Đánh đổi: **thu hồi trễ**. Logout / ban / hạ quyền chỉ chắc chắn có hiệu lực sau khi cookie-cache
hết hạn (tới TTL) — đặc biệt **across-process**: N web instance không share state in-memory.

- Đa số route: chấp nhận trễ ≤ TTL → KHÔNG cần làm gì.
- Route **nhạy** (logout-all, ban user, hạ quyền, xoá tài khoản): check **denylist Dragonfly**
  để thu hồi tức thời thay vì đợi TTL.

```ts
// Khi ban / logout-all: set cờ trong Dragonfly, TTL = cookieCache.maxAge.
await rateLimitConnection.set(`revoked:session:${sessionId}`, "1", "EX", 5 * 60);

// Middleware route nhạy: chặn nếu session nằm trong denylist.
if (await rateLimitConnection.get(`revoked:session:${sessionId}`)) {
  throw new HTTPException(401, { message: "SESSION_REVOKED" });
}
```

- TTL denylist = `cookieCache.maxAge` là đủ (hết hạn → tự đọc DB lại).
- **OPTIONAL**: chỉ bật khi nghiệp vụ cần thu hồi tức thời. Template mặc định KHÔNG bật.
- Giảm `cookieCache.maxAge` cũng thu hẹp cửa sổ nhưng tăng query DB — đánh đổi ngược.

## Mount order TUYỆT ĐỐI (trong `src/app.ts` — đây là order THẬT của code)

```
cors → secureHeaders → csrf(/api/*) → requestId → request-logger
  → hashGuard(/api/auth/*) → auth.handler(/api/auth/*) → session-populate
  → /health · /ready → /api/config/validation → module routes → onError
```

```ts
// 1) CORS với credentials: true (bắt buộc cho cookie). PHẢI trước csrf:
//    cors trả OPTIONS 204 và không gọi next(); OPTIONS không nằm trong
//    safe-list của csrf → đảo thứ tự là preflight 403.
app.use("*", cors({ origin: env.TRUSTED_ORIGINS, credentials: true, ... }));

// 1.5) secureHeaders cho MỌI response — SAU cors, TRƯỚC mọi thứ khác.
app.use("*", secureHeaders({ ... }));

// 1.6) CSRF origin-check trên /api/* (phủ cả /api/auth/*).
app.use("/api/*", csrf({ origin: env.TRUSTED_ORIGINS }));

// 2) requestId + child logger; 3) request logger (start/end + duration).

// 3.5) hashGuard trên /api/auth/* — TRƯỚC auth.handler, SAU cors
//     (để 503 mang CORS header). Chống login self-DoS scrypt.
app.use("/api/auth/*", hashGuard);

// 4) Better Auth handler — SAU hashGuard, TRƯỚC session populate.
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// 5) Session populate cho mọi request còn lại.
// 6-7) /health, /ready; 7.5) /api/config/validation; 8) module routes.
// 9) app.onError(errorHandler) CUỐI.
```

⚠️ **CẤM nâng `auth.handler` lên "ngay sau CORS"** (phiên bản cũ của rule này từng vẽ
`CORS → auth.handler → session`): làm vậy là `/api/auth/*` **mất secureHeaders + csrf +
requestId/logger + hashGuard** — gỡ hardening khỏi đúng nhóm endpoint nhạy cảm nhất.
Đặt `auth.handler` SAU session middleware cũng sai → sign-in 404/401.

## Plugin imports — bug v1.4

```ts
// ❌ SAI — bug v1.4: passkey đã tách ra
import { passkey } from "better-auth/plugins/passkey";

// ✅ ĐÚNG — package riêng
import { passkey } from "@better-auth/passkey";
```

```bash
bun add @better-auth/passkey
```

Plugin khác (`twoFactor`, `organization`, `magicLink`, `openAPI`) vẫn từ `better-auth/plugins`.

## Schema generated, KHÔNG sửa tay

`src/db/schema/auth.ts` do CLI sinh:

```bash
bun run auth:generate  # = bunx @better-auth/cli@latest generate --config src/lib/auth.ts --output src/db/schema/auth.ts
```

Thêm field user → sửa `auth.ts` với `user.additionalFields`, chạy lại CLI. KHÔNG edit file schema.

## Sau khi sửa `src/lib/auth.ts`

Order BẮT BUỘC:
1. `bun run auth:generate` (sinh lại schema)
2. `bun run db:generate` (sinh migration)
3. `bun run db:migrate` (apply)

Đảo thứ tự → migration không có bảng mới của plugin.

## Type augmentation BẮT BUỘC

`src/types/hono.d.ts`:
```ts
import type { auth } from "@/lib/auth";
type S = typeof auth.$Infer.Session;

declare module "hono" {
  interface ContextVariableMap {
    user: S["user"] | null;
    session: S["session"] | null;
    activeOrgId: string | null;
    rawBody: string;
  }
}
```

Không có file này → `c.get("user")` type là `unknown` khắp nơi.

## Middleware throw — KHÔNG return

```ts
// ✅
export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!c.get("user")) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  await next();
};

// ❌ — bypass error handler + observability
async (c, next) => {
  if (!c.get("user")) return c.json({ error: "..." }, 401);
};
```

## Ownership check NẰM TRONG handler

```ts
// ❌ — không thể, chưa có resource
const requireOwnership = async (c, next) => { /* ??? */ };

// ✅ — helper, gọi trong handler sau khi load
const post = await postService.getById(id);
if (!post) throw new HTTPException(404, ...);
assertOwnership(post, user.id);  // throw 403 NOT_OWNER
```

## Khi sửa file ở đây, MUST verify

- [ ] Mount order đúng như code thật: cors → secureHeaders → csrf(/api/*) → requestId → logger → hashGuard(/api/auth/*) → auth.handler → session → /health /ready → routes → onError.
- [ ] Passkey import từ `@better-auth/passkey`.
- [ ] CLI generate chạy SAU mỗi lần sửa `auth.ts`.
- [ ] `src/types/hono.d.ts` đã có augmentation.
- [ ] Middleware throw HTTPException, không return.
- [ ] Curl `/api/auth/get-session` trả `{ user, session }` (có thể null).
- [ ] `additionalFields.role` vẫn `input:false` + `databaseHooks` còn dùng `enforcePublicSignupRole`.
- [ ] Chạy 4 ca test role (mục "Role = server sở hữu") — đặc biệt ca #3 admin.createUser.
- [ ] emailOTP: `overrideDefaultEmailVerification:true` + `storeOTP:"hashed"` + `allowedAttempts:5`.
- [ ] `/api/auth/email-otp/reset-password` có trong CẢ `HASH_PATHS` LẪN `GATED` (chạy hash-guard test).
- [ ] `emailVerification` chỉ còn `sendOnSignUp` + `autoSignInAfterVerification` (bỏ `sendVerificationEmail`).
- [ ] Forget-password OTP: email không tồn tại vẫn trả `success` (privacy-preserving — KHÔNG "sửa").
