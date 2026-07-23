# SKILL: Global error handler (Hono)

## Dùng khi nào

- Setup 1 lần lúc init project — map domain error → HTTP response chuẩn.
- Khi service throw `new Error("PAYMENT_NOT_FOUND")` → cần auto thành 404.
- Khi muốn JSON response thống nhất + log Sentry tự động.

---

## Vì sao cần skill này

Trong codebase, service throw domain error string thay vì HTTPException:
```ts
throw new Error("PAYMENT_NOT_FOUND"); // service không biết HTTP
```

Nếu mỗi route phải `try/catch` map sang HTTP status → code lặp **N lần**:
```ts
try { ... } catch (e) {
  if (e.message === "PAYMENT_NOT_FOUND") return c.json(..., 404);
  if (e.message === "FORBIDDEN_ROLE") return c.json(..., 403);
  // ... 9 module x 5 error
}
```

→ 1 global handler ở `src/middlewares/error.ts` làm hết. Service chỉ throw, route chỉ orchestrate.

---

## Thứ tự làm

```
1. Tạo bảng map domain error → HTTP status.

2. src/middlewares/error.ts — onError handler.

3. Đăng ký trong src/app.ts: app.onError(errorHandler).

4. Tích hợp Sentry: capture mọi 5xx unhandled.

5. Service throw domain string. Route KHÔNG try/catch nữa.

6. Curl test 5 case: domain string, HTTPException, ZodError, unknown, Sentry capture.
```

---

## File tạo ở đâu

- `src/middlewares/error.ts`
- Sửa `src/app.ts` (đăng ký `onError`)

---

## Code mẫu

### 1. Bảng mapping (tham khảo)

| Domain error | HTTP | Khi nào throw |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Middleware `requireAuth` |
| `FORBIDDEN_ROLE` | 403 | Middleware `requireRole` |
| `NO_ACTIVE_ORG` | 403 | Middleware `requireOrg` |
| `NOT_OWNER` | 403 | Helper `assertOwnership` |
| `RATE_LIMITED` | 429 | Middleware rate-limit |
| `RATE_LIMIT_STORE_DOWN` | 429 | Rate-limit fail-closed |
| `*_NOT_FOUND` | 404 | Service getById trả null |
| `*_ALREADY_EXISTS` | 409 | Service insert PG 23505 |
| `BROKEN_CIRCUIT` | 503 | Circuit breaker open |
| `PERMANENT:*` | 422 | Worker domain validation |
| `TRANSIENT:*` | 503 | Worker retry-able |

Thêm mới: thêm entry vào `ERROR_MAP` ở handler.

### 2. `src/middlewares/error.ts`

```ts
/**
 * Global error handler — Hono onError.
 *
 * Thứ tự ưu tiên:
 *  1) HTTPException → dùng status trong exception.
 *  2) ZodError → 400 với details.
 *  3) Domain error string match ERROR_MAP → status tương ứng.
 *  4) Pattern `<TABLE>_NOT_FOUND` → 404 (đỡ phải list hết).
 *  5) Cockatiel BrokenCircuitError → 503.
 *  6) Postgres unique violation (23505) → 409.
 *  7) Unknown → 500 + Sentry capture.
 *
 * Response shape ổn định:
 *   { error: { code, message, details? } }
 */
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { BrokenCircuitError } from "cockatiel";
import * as Sentry from "@sentry/bun";
import { logger } from "@/lib/logger";

const ERROR_MAP: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN_ROLE: 403,
  NO_ACTIVE_ORG: 403,
  NOT_OWNER: 403,
  RATE_LIMITED: 429,
  RATE_LIMIT_STORE_DOWN: 429,
  MIME_NOT_ALLOWED: 400,
  FILE_TOO_LARGE: 413,
  MISSING_FILE: 400,
};

const PG_UNIQUE_VIOLATION = "23505";
const PG_FK_VIOLATION = "23503";

type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export const errorHandler: ErrorHandler = (err, c) => {
  const reqId = c.req.header("x-request-id") ?? null;

  // 1) HTTPException
  if (err instanceof HTTPException) {
    const code = err.message || "HTTP_ERROR";
    return c.json<ErrorBody>({ error: { code, message: code } }, err.status);
  }

  // 2) ZodError
  if (err instanceof ZodError) {
    return c.json<ErrorBody>({
      error: {
        code: "VALIDATION_ERROR",
        message: "Input validation failed",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    }, 400);
  }

  // 3) Domain string match map
  const msg = err.message ?? "";
  const code = msg.split(":")[0]; // strip "PERMANENT:xxx" → "PERMANENT"

  if (ERROR_MAP[msg] !== undefined) {
    return c.json<ErrorBody>({ error: { code: msg, message: msg } }, ERROR_MAP[msg] as never);
  }
  if (ERROR_MAP[code] !== undefined) {
    return c.json<ErrorBody>({ error: { code, message: msg } }, ERROR_MAP[code] as never);
  }

  // 4) *_NOT_FOUND pattern
  if (/_NOT_FOUND$/.test(msg)) {
    return c.json<ErrorBody>({ error: { code: msg, message: msg } }, 404);
  }
  if (/_ALREADY_EXISTS$/.test(msg)) {
    return c.json<ErrorBody>({ error: { code: msg, message: msg } }, 409);
  }

  // 5) BrokenCircuitError
  if (err instanceof BrokenCircuitError) {
    logger.warn({ err: err.message }, "circuit.open.refuse-request");
    return c.json<ErrorBody>({
      error: { code: "BROKEN_CIRCUIT", message: "Upstream unavailable" },
    }, 503);
  }

  // 6) Postgres error code
  const pgCode = (err as { code?: string }).code;
  if (pgCode === PG_UNIQUE_VIOLATION) {
    return c.json<ErrorBody>({
      error: { code: "ALREADY_EXISTS", message: "Resource already exists" },
    }, 409);
  }
  if (pgCode === PG_FK_VIOLATION) {
    return c.json<ErrorBody>({
      error: { code: "FK_VIOLATION", message: "Referenced resource not found" },
    }, 409);
  }

  // 7) Unknown → 500 + Sentry
  logger.error({ err, reqId, path: c.req.path, method: c.req.method }, "unhandled.error");
  const eventId = Sentry.captureException(err, {
    tags: { path: c.req.path, method: c.req.method },
    extra: { reqId },
  });
  return c.json<ErrorBody>({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      details: { sentryEventId: eventId },
    },
  }, 500);
};
```

### 3. Đăng ký trong `src/app.ts`

```ts
import { errorHandler } from "@/middlewares/error";

// Đặt CUỐI cùng (sau khi mount mọi route).
app.onError(errorHandler);
```

### 4. Service throw domain string

```ts
// ✅ ĐÚNG — service không biết HTTP
export async function getPayment(id: string) {
  const row = await db.select()...;
  if (!row) throw new Error("PAYMENT_NOT_FOUND");
  return row;
}

// Route — KHÔNG cần try/catch
.get("/:id", async (c) => {
  const p = await paymentService.getPayment(c.req.param("id"));
  return c.json({ data: p }); // throw tự động lên onError
});
```

---

## Curl test (BẮT BUỘC)

```bash
# 1. Domain error → 404 chuẩn
curl -i http://localhost:3000/api/payments/nonexistent -b cookie.txt
# HTTP/1.1 404
# { "error": { "code": "PAYMENT_NOT_FOUND", "message": "PAYMENT_NOT_FOUND" } }

# 2. HTTPException (auth) → 401 chuẩn
curl -i http://localhost:3000/api/payments
# HTTP/1.1 401
# { "error": { "code": "UNAUTHENTICATED", "message": "UNAUTHENTICATED" } }

# 3. ZodError → 400 với details
curl -i -X POST http://localhost:3000/api/payments \
  -b cookie.txt -H "Content-Type: application/json" \
  -d '{"amount": "abc"}'
# HTTP/1.1 400
# { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }

# 4. Unique violation → 409
# (Trigger bằng insert email duplicate trong DB)
# HTTP/1.1 409 { "error": { "code": "ALREADY_EXISTS", ... } }

# 5. Unknown error → 500 + Sentry
# (Trigger bằng throw new Error("xxx random") trong service)
# HTTP/1.1 500
# { "error": { "code": "INTERNAL_ERROR", "details": { "sentryEventId": "..." } } }
# Mở Sentry dashboard → có event mới.
```

---

## Checklist cuối

- [ ] `app.onError(errorHandler)` đăng ký SAU mọi route.
- [ ] Service throw domain string, KHÔNG `c.json(..., 404)`.
- [ ] Middleware throw HTTPException, KHÔNG return.
- [ ] ZodError có `details` cho client debug.
- [ ] Unknown error → Sentry capture + 500 với `sentryEventId`.
- [ ] Response shape thống nhất: `{ error: { code, message, details? } }`.
- [ ] Pattern `*_NOT_FOUND` auto map 404 (không cần list từng cái).
- [ ] PG error code (23505, 23503) map đúng.
- [ ] BrokenCircuitError → 503.
- [ ] File ≤ 300 dòng.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| Error trả `{ message: "..." }` không có code | Hono default handler | Đăng ký `app.onError`. |
| 500 không vào Sentry | Sentry init sau app | Init Sentry ở dòng đầu `src/index.ts`, TRƯỚC import app. |
| Domain error `PAYMENT_NOT_FOUND` trả 500 | Pattern không match | Đảm bảo suffix `_NOT_FOUND` HOẶC add vào ERROR_MAP. |
| ZodError leak path nhạy cảm | `i.path` lộ DB column | Custom mapper hoặc whitelist field. |
| Sentry capture mọi 4xx (noise) | Quên check `err.status` | Chỉ capture từ branch 7 (unknown), KHÔNG capture HTTPException. |
| `c.req.header("x-request-id")` undefined | Chưa có middleware sinh requestId | Thêm middleware: `c.req.raw.headers.set("x-request-id", ulid())`. |
| Test unit khó vì handler global | onError không trigger trong test isolated | Tạo `createApp()` factory để test cùng error handler. |
| Service throw `Error` rồi `console.error` riêng | Double log | Service KHÔNG log error tự throw — handler log đầy đủ. |
| Postgres error `code` không có | Driver khác (pg vs postgres.js) | postgres.js dùng `err.code`; pg dùng `err.code`. Test cả 2. |
| Multi-tenant context bị mất trong Sentry | Không set `Sentry.setUser` lúc auth | Thêm middleware sau `requireAuth`: `Sentry.setUser({ id: user.id })`. |
