// WHY: Trần CPU TOÀN CỤC cho các endpoint chạy scrypt (login/đăng ký/đổi mật
// khẩu...). Better Auth đã offload scrypt ra threadpool (không block event
// loop), NHƯNG threadpool queue vô hạn + CPU hữu hạn → flood login vẫn làm
// saturate core + latency phình. Middleware này cap số hash đồng thời/process;
// hết slot/hàng đợi → 503 SẠCH (thay vì treo). Bổ sung — KHÔNG thay — rate-limit
// per-IP (cái đó không cản credential-stuffing phân tán).
//
// Mount SAU CORS (để 503 mang CORS header browser đọc được), TRƯỚC auth.handler.
// Override hash KHÔNG ôm semaphore (tránh double-acquire deadlock) → trần CPU
// CHỈ ở đây.
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { Semaphore } from "@/lib/semaphore";

// Trần thực BOX-WIDE = WEB_INSTANCES × HASH_MAX_CONCURRENT (xem README). 1
// semaphore/process; cluster spawn N process → N× trần này.
export const hashSemaphore = new Semaphore({
  maxConcurrent: env.HASH_MAX_CONCURRENT,
  maxQueue: env.HASH_MAX_QUEUE,
  acquireTimeoutMs: env.HASH_ACQUIRE_TIMEOUT_MS,
});

// ⚓ Allowlist scrypt-path đã ver với better-auth@1.6.10 — bump version PHẢI chạy
// lại chẩn đoán call-site (grep verifyPassword|hashPassword|scrypt trong
// node_modules/better-auth). Completeness-lock test sẽ báo nếu set lệch.
//
// Endpoint Better Auth 1.6.10 THỰC SỰ chạy scrypt — xác minh bằng grep single
// call-site `password.hash(` / `password.verify(` / `validatePassword(` + router
// probe. KHÔNG đoán tay. scrypt chạy ở CẢ HASH (đặt mật khẩu mới) LẪN VERIFY
// (kiểm mật khẩu hiện tại = hash input rồi so) → gate đủ cả 2 loại.
//
// Loại trừ (đã verify KHÔNG có call-site scrypt nào):
//   /change-email (body chỉ `newEmail`; `sensitiveSessionMiddleware`=freshness, KHÔNG verify pw),
//   /update-user, /sign-in/social, /request-password-reset (chỉ gửi email),
//   /reset-password/:token (GET redirect), get-session/list-sessions/revoke/sign-out/account/...
//   /set-password: CHẠY hash nhưng path=undefined → probe POST 404 (server-only,
//     không có HTTP route) → không gate được & không attack được qua HTTP.
//
// ⚠️ Nếu bật plugin username/phone-number sign-in → endpoint sign-in mới CŨNG
//    verify mật khẩu → PHẢI thêm path đó vào set này (test completeness-lock sẽ báo).
//
// emailOTP plugin (bật 2026-07-10): CHỈ /email-otp/reset-password chạy scrypt
//   (ctx.context.password.hash — verify tại node_modules/.../email-otp/routes.mjs).
//   /email-otp/send-verification-otp + /email-otp/verify-email KHÔNG hash → KHÔNG gate.
//
// Path tương đối base mount "/api/auth". CHỈ method POST (OPTIONS preflight & GET bỏ qua).
// Export để test khoá completeness (drift 2 chiều).
export const HASH_PATHS: ReadonlySet<string> = new Set([
  "/api/auth/sign-in/email", // VERIFY (+ hash dummy chống user-enumeration)
  "/api/auth/sign-up/email", // HASH
  "/api/auth/reset-password", // HASH (đặt mật khẩu mới theo token — endpoint core vẫn tồn tại)
  "/api/auth/change-password", // VERIFY (mật khẩu cũ) + HASH (mật khẩu mới)
  "/api/auth/verify-password", // VERIFY (qua validatePassword)
  "/api/auth/delete-user", // VERIFY (khi body.password có)
  // === admin plugin (bật 2026-07-08) — cả 2 đều HASH qua ctx.password.hash ===
  "/api/auth/admin/create-user", // HASH (mật khẩu user mới do admin tạo)
  "/api/auth/admin/set-user-password", // HASH (admin đặt mật khẩu hộ)
  // === emailOTP plugin (bật 2026-07-10) — reset mật khẩu bằng OTP chạy scrypt ===
  "/api/auth/email-otp/reset-password", // HASH (đặt mật khẩu mới sau khi verify OTP)
]);

// c.req.path đã loại query. Chuẩn hoá trailing slash để match robust.
function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export const hashGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== "POST" || !HASH_PATHS.has(normalizePath(c.req.path))) {
    await next(); // convention: await next, không return next (rule middleware)
    return;
  }

  try {
    await hashSemaphore.acquire();
  } catch {
    // Hết slot + hàng đợi (HASH_QUEUE_FULL) hoặc chờ quá hạn (HASH_ACQUIRE_TIMEOUT).
    // Retry-After set TRƯỚC throw (như rate-limit.ts) → errorHandler c.json giữ header.
    c.header("Retry-After", String(Math.ceil(env.HASH_ACQUIRE_TIMEOUT_MS / 1000)));
    throw new HTTPException(503, { message: "HASH_CAPACITY" });
  }

  try {
    await next();
  } finally {
    // LUÔN nhả slot kể cả khi auth.handler ném (sai mật khẩu, validation...).
    hashSemaphore.release();
  }
};
