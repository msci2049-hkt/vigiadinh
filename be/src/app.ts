// WHY: Mount order BẮT BUỘC (xem .claude/rules/auth.md):
//   CORS → secureHeaders → csrf(/api/*) → requestId → request logger → hashGuard
//   → auth.handler → session → routes → onError
// Đặt sai = sign-in 404/401, auth handler không thấy Cookie qua CORS, hoặc csrf
// 403 cả preflight (cors PHẢI đứng trước csrf — cors trả OPTIONS 204 ngay,
// không gọi next(), còn OPTIONS KHÔNG nằm trong safe-list GET|HEAD của csrf).
//
// File này KHÔNG start server — chỉ build Hono app. Entry là src/index.ts.

import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { ulid } from "ulid";
import { db } from "@/db";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimitConnection } from "@/lib/redis";
import { VALIDATION_LIMITS } from "@/lib/validation-limits";
import { errorHandler } from "@/middlewares/error";
import { hashGuard } from "@/middlewares/hash-guard";
import { guardiansRoutes } from "@/modules/guardians/routes";
import { indexerRoutes } from "@/modules/indexer/routes";
import { inheritanceRoutes } from "@/modules/inheritance/routes";
import { intentsRoutes } from "@/modules/intents";
import { notificationsRoutes } from "@/modules/notifications/routes";
import { presenceRoutes } from "@/modules/presence/routes";
import { realtimeRoutes } from "@/modules/realtime/routes";
import { recoveryRoutes } from "@/modules/recovery/routes";
import { riskRoutes } from "@/modules/risk/routes";
import { sep45Routes } from "@/modules/sep45";
import { walletsRoutes } from "@/modules/wallets/routes";

export const app = new Hono();

// 1) CORS — credentials: true bắt buộc cho cookie auth.
// sentry-trace + baggage: FE (@sentry/react browserTracing) gắn 2 header này
// vào request để NỐI distributed trace FE→BE. Thiếu chúng trong allowHeaders,
// preflight từ chối → browser bỏ header → trace đứt (không lỗi, chỉ mất trace).
app.use(
  "*",
  cors({
    origin: env.TRUSTED_ORIGINS,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "sentry-trace", "baggage"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// 1.5) Security headers cho MỌI response — SAU CORS, TRƯỚC middleware/route khác.
// API JSON-only, không render HTML → CSP khoá chặt default-src 'none'. Nếu sau
// này thêm route trả HTML (docs/preview) → mở CSP RIÊNG cho route đó, không nới
// toàn cục. secureHeaders tự xoá x-powered-by (removePoweredBy mặc định true);
// xContentTypeOptions (nosniff) + COOP + CORP nằm trong default của Hono.
app.use(
  "*",
  secureHeaders({
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
    crossOriginResourcePolicy: "same-site",
  }),
);

// 1.6) CSRF origin-check cho /api/* — chặn form-POST cross-site (content-type
// form-urlencoded / multipart / text-plain, VÀ request THIẾU content-type — Hono
// coi như text/plain, vá GHSA-2234-fmw7-43wr). JSON được bỏ qua: cross-site JSON
// đã bị CORS + cookie sameSite chặn. Pass khi Origin ∈ TRUSTED_ORIGINS HOẶC
// Sec-Fetch-Site: same-origin. Better Auth có trustedOrigins riêng cho
// /api/auth/*; lớp này phủ toàn bộ /api/*.
// LƯU Ý dev: curl POST /api/* không có Content-Type sẽ 403 — thêm
// -H "Content-Type: application/json" hoặc -H "Origin: <TRUSTED_ORIGIN>".
app.use("/api/*", csrf({ origin: env.TRUSTED_ORIGINS }));

// 2) Request ID + child logger. Bind sớm để mọi log sau đó tự có reqId.
// WHY length cap: client có thể inject x-request-id 10MB → bind vào mọi log
// line → log storage phình. Cap 64 ký tự (đủ cho UUID/ULID/Trace-ID format).
app.use("*", async (c, next) => {
  const raw = c.req.header("x-request-id");
  const id = raw && raw.length <= 64 ? raw : ulid();
  c.set("requestId", id);
  c.set("log", logger.child({ reqId: id }));
  c.header("x-request-id", id);
  await next();
});

// 3) Request logger — start/end với duration + level theo status.
app.use("*", async (c, next) => {
  const log = c.get("log");
  const start = performance.now();
  log.info({ method: c.req.method, path: c.req.path }, "req.start");
  await next();
  const durationMs = Math.round(performance.now() - start);
  const status = c.res.status;
  const meta = { status, durationMs };
  if (status >= 500) log.error(meta, "req.end");
  else if (status >= 400) log.warn(meta, "req.end");
  else log.info(meta, "req.end");
});

// 3.5) Hash concurrency guard — SAU CORS (để 503 mang CORS header browser đọc
// được), TRƯỚC auth.handler. Chỉ gate các endpoint chạy scrypt (allowlist trong
// hash-guard.ts); endpoint auth khác đi thẳng. Chống login self-DoS.
app.use("/api/auth/*", hashGuard);

// 4) Better Auth handler — NGAY trước session populate (rule auth.md).
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// 5) Session populate — c.var.user / .session / .activeOrgId cho mọi request.
app.use("*", async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", result?.user ?? null);
  c.set("session", result?.session ?? null);
  // Cast: organization plugin chưa enable → field không có ở type. Bỏ cast
  // khi thêm plugin (skill add-auth-plugin).
  const orgId = (result?.session as unknown as { activeOrganizationId?: string } | undefined)
    ?.activeOrganizationId;
  c.set("activeOrgId", orgId ?? null);
  await next();
});

// 6) Liveness — process còn sống. KHÔNG check downstream.
app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// 7) Readiness — DB + Redis có sẵn sàng phục vụ traffic. K8s readinessProbe.
app.get("/ready", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    await rateLimitConnection.ping();
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 503);
  }
});

// 7.5) Ngưỡng validate cho FE (D-052) — public, KHÔNG cần auth: form login/
// sign-up cần ngưỡng TRƯỚC khi user đăng nhập. BE là nguồn sự thật duy nhất
// (lib/validation-limits.ts); FE fetch lúc boot và build Zod schema từ đây —
// lệch ngưỡng = user bị chặn ở tầng sau với thông báo khó hiểu.
app.get("/api/config/validation", (c) => {
  c.header("Cache-Control", "public, max-age=300");
  return c.json(VALIDATION_LIMITS);
});

// 8) Mount module routes here (e.g., app.route('/api/payments', paymentRoutes))
// `modules/product` GIỮ LẠI làm KHUÔN Vertical Slice (đọc khi tạo module mới)
// nhưng KHÔNG mount: list/get của nó không có requireAuth → route ẩn danh +
// /:id enumerate được, không có lý do gì phơi ra trong FamilyWallet
// (security review 2026-07-20, P1-1). Cần chạy lại thì bỏ comment + thêm auth.
// app.route("/api/products", productRoutes);
// SSE fan-out — auth-gated, chỉ stream kênh của user đăng nhập (xem skill add-sse).
app.route("/api/events", realtimeRoutes);
// FamilyWallet — 8 module khung (route + schema + repo, logic dựng theo skill fw-*).
app.route("/api/wallets", walletsRoutes);
app.route("/api/guardians", guardiansRoutes);
app.route("/api/presence", presenceRoutes);
app.route("/api/recovery", recoveryRoutes);
app.route("/api/inheritance", inheritanceRoutes);
app.route("/api/audit", indexerRoutes);
app.route("/api/notifications", notificationsRoutes);
app.route("/api/risk", riskRoutes);
// SEP-45 — đăng nhập bằng ví contract (public có chủ đích: đây là cửa login;
// rate-limit failOpen=false + nonce single-use bên trong module).
app.route("/api/sep45", sep45Routes);
// Pipeline intent (PHA 3) — trục mọi luồng tiền, requireAuth trong feature.
app.route("/api/intents", intentsRoutes);

// 9) Global error handler CUỐI — map domain string + HTTPException + ZodError.
app.onError(errorHandler);
