---
name: hono-api-patterns
description: Viết route/API Hono đúng chuẩn template — error envelope nhất quán qua app.onError, validate MỌI input bằng zv() (không zValidator trực tiếp), middleware throw HTTPException (không return c.json), mount order cố định (CORS→secureHeaders→csrf→requestId→logger→hashGuard→auth→session→routes→onError), typed c.get('user'). Dùng khi user gõ "thêm route/API", "trả lỗi API", "onError Hono", "validate request", "middleware Hono", "sign-in bị 404", "preflight 403", "response lỗi khác nhau", "Hono RPC / hc AppType", "body limit / timeout". Đọc TRƯỚC khi thêm endpoint hay đụng middleware để giữ contract lỗi FE↔BE nhất quán.
---

# Hono API patterns: envelope + validate + mount order

> **Luật vàng BE (error envelope)**: mọi lỗi ra CÙNG shape `{ error: { code, message, details? } }` qua
> `app.onError`. Service `throw "DOMAIN_STRING"` (hoặc `new Error("X")`) → middleware map → route **KHÔNG**
> try/catch. Thêm route cơ học → skill `new-route`; bảo vệ route → `protect-route`.

## Error envelope — 1 nơi map, thứ tự match quan trọng

`src/middlewares/error.ts` `errorHandler` map theo thứ tự: **HTTPException → ZodError(422/400) →
ERROR_MAP → `*_NOT_FOUND`(404) → `*_ALREADY_EXISTS`(409) → BrokenCircuitError(503) → PG 23505/23503(409) →
Unknown(500 + Sentry)**. Chỉ nhánh **Unknown** mới `Sentry.captureException` (capture HTTPException/Zod = noise).

- Domain string mới cần status riêng → thêm vào `ERROR_MAP` (vd `INSUFFICIENT_BALANCE: 400`). Đừng
  `c.json({error},4xx)` tay trong route (lệch shape).
- `app.onError(errorHandler)` + `app.notFound(...)` đăng ký **cuối** `app.ts`.

## Validate MỌI input bằng `zv()` — KHÔNG `zValidator` trực tiếp (BUG-001)

```ts
import { zv } from "@/middlewares/validator";
routes.post("/", zv("json", createDto), async (c) => { const body = c.req.valid("json"); /* ... */ });
```

`@hono/zod-validator` mặc định short-circuit với shape riêng `{success:false,error}` → **bypass onError** → lỗi
khác envelope chuẩn. `zv()` throw ZodError thật để `onError` map. Mọi target: `zv("json"|"query"|"param"|...)`.

## Middleware: throw HTTPException, KHÔNG return

```ts
if (!c.get("user")) throw new HTTPException(401, { message: "UNAUTHENTICATED" }); // ✅ tới onError + observability
// ❌ return c.json({error:"..."},401) — bypass error handler, shape lệch
```

Ownership/role check nằm TRONG handler sau khi load resource (`assertOwnership(...)` → throw). Xem
`.claude/rules/auth.md` + skill `protect-route`.

## Mount order (cố định trong `src/app.ts` — đặt sai = 403/404 khó hiểu)

`CORS → secureHeaders → csrf(/api/*) → requestId → request logger → hashGuard(/api/auth/*) → auth.handler(/api/auth/*)
→ session-populate → module routes → onError`.

- **cors PHẢI trước csrf**: cors trả OPTIONS 204 và KHÔNG gọi `next()`; OPTIONS không nằm trong safe-list GET|HEAD
  của csrf → csrf sẽ 403 cả preflight nếu đứng trước. Chi tiết: skill `hono-secure-headers`.
- `auth.handler` sau hashGuard nhưng **trước** session-populate. Nâng `auth.handler` lên ngay sau cors = mất
  hardening trên `/api/auth/*` (rule auth.md cũ vẽ sai — code thắng).
- Header key **lowercase** khi đọc (`c.req.header("x-request-id")`).

## Typed context

`c.get("user")`/`c.get("session")`/`c.get("requestId")` typed nhờ `src/types/hono.d.ts` (`ContextVariableMap`).
Thêm biến context mới → khai ở đó, nếu không type là `unknown`.

## GOTCHAS

- **Hono RPC (`hc<AppType>`) là SCAFFOLD, chưa dùng thật**: BE **không export `AppType`** → FE gọi **plain fetch**
  (`apiClient`), không type end-to-end. Đừng "nối RPC" nửa vời rồi tưởng có type an toàn — hoặc export AppType đầy
  đủ, hoặc để nguyên plain fetch. (CLAUDE.md §8, FE `rpc.ts`.)
- **body-limit/timeout/etag** không bật mặc định — thêm `bodyLimit`/`timeout` middleware cho route nhận payload
  lớn/chậm (chống DoS), đừng để mặc định vô hạn.
- **`@hono/zod-validator` vs Zod 4**: repo dùng `^0.8.0` + `zod ^4` — kiểm bản validator hỗ trợ Zod 4 khi nâng.

## Cross-reference

`.claude/rules/auth.md` (mount order, role) · `.claude/rules/module-boundary.md` (Layered vs Slice) · `error-handler`
+ `hono-secure-headers` + `rate-limit-route` + `new-route` + `protect-route` (skill) · `postgres-drizzle-data` (PG error→envelope).
