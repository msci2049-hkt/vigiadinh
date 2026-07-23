// Integration test ở tầng HTTP cho hashGuard (acceptance Phase 4 a/c/d):
//  (a) burst → /health vẫn nhanh, hash đồng thời ≤ cap;
//  (c) quá tải → 503 sạch (HASH_CAPACITY + Retry-After), KHÔNG 500/treo;
//  (d) đúng allowlist endpoint scrypt bị gate, endpoint khác KHÔNG.
// KHÔNG cần Postgres/Dragonfly: hashGuard chỉ phụ thuộc env + Semaphore.
// Tính non-blocking của scrypt được chứng minh riêng bằng bench (báo cáo Phase 1/3);
// ở đây dùng sleep mô phỏng "công việc hash" để test GUARD tất định & nhanh.
import { beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

type HashGuardModule = typeof import("./hash-guard");
let hashGuard: HashGuardModule["hashGuard"];
let hashSemaphore: HashGuardModule["hashSemaphore"];
let hashPaths: HashGuardModule["HASH_PATHS"];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

beforeAll(async () => {
  // Set env TRƯỚC khi import module phụ thuộc @/env (createEnv validate lúc import).
  const e = process.env;
  e.DATABASE_URL ??= "postgres://app:app@localhost:5432/app";
  e.REDIS_URL ??= "redis://localhost:3699";
  e.BETTER_AUTH_SECRET ??= "test-secret-do-not-use-in-prod-0123456789";
  e.BETTER_AUTH_URL ??= "http://localhost:3000";
  e.TRUSTED_ORIGINS ??= "http://localhost:3000";
  e.RESEND_API_KEY ??= "re_test";
  e.EMAIL_FROM ??= "test@example.com";
  e.R2_ACCOUNT_ID ??= "x";
  e.R2_ACCESS_KEY_ID ??= "x";
  e.R2_SECRET_ACCESS_KEY ??= "x";
  e.R2_BUCKET ??= "x";
  const mod = await import("./hash-guard");
  hashGuard = mod.hashGuard;
  hashSemaphore = mod.hashSemaphore;
  hashPaths = mod.HASH_PATHS;
});

// App test: hashGuard trên /api/auth/*, 1 stub "auth.handler" mô phỏng hash bằng
// sleep. Đo active của semaphore để xác minh gating + cap.
function buildApp() {
  const app = new Hono();
  let maxActive = 0;
  let sawActive = -1;
  // CORS step 0 (như app.ts) → xác minh 503 vẫn mang CORS header (requirement F).
  app.use("*", cors({ origin: "http://localhost:3000", credentials: true }));
  app.use("/api/auth/*", hashGuard);
  app.get("/health", (c) => c.json({ ok: true }));
  app.all("/api/auth/*", async (c) => {
    sawActive = hashSemaphore.active;
    maxActive = Math.max(maxActive, hashSemaphore.active);
    await sleep(50); // mô phỏng scrypt (non-blocking — đã chứng minh bằng bench)
    return c.json({ ok: true });
  });
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ code: err.message }, err.status);
    return c.json({ code: "INTERNAL" }, 500);
  });
  return { app, getMax: () => maxActive, getSaw: () => sawActive };
}

const GATED = [
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
  "/api/auth/reset-password",
  "/api/auth/change-password",
  "/api/auth/verify-password",
  "/api/auth/delete-user",
  // admin plugin (grep call-site ctx.password.hash trong plugins/admin/routes):
  "/api/auth/admin/create-user",
  "/api/auth/admin/set-user-password",
  // emailOTP plugin (grep call-site ctx.context.password.hash trong plugins/email-otp/routes.mjs):
  "/api/auth/email-otp/reset-password",
];

describe("hashGuard (acceptance d: allowlist gating)", () => {
  it("completeness-lock: HASH_PATHS = ĐÚNG tập endpoint scrypt-HTTP (BA 1.6.10)", () => {
    // Nếu BA đổi route / thêm path scrypt (vd bật plugin username sign-in) mà
    // quên cập nhật → test GÃY (drift cả thêm LẪN bớt). GATED = nguồn-sự-thật
    // đã verify bằng grep call-site password.hash(/.verify(/validatePassword(.
    expect([...hashPaths].sort()).toEqual([...GATED].sort());
  });

  it("MỌI endpoint scrypt (POST) đều bị gate (đi qua semaphore)", async () => {
    for (const path of GATED) {
      const { app, getSaw } = buildApp();
      const res = await app.request(path, { method: "POST" });
      expect(res.status).toBe(200);
      expect(getSaw()).toBe(1); // đã vào semaphore → active=1 lúc handler chạy
    }
  });

  it("endpoint KHÔNG scrypt / GET / OPTIONS preflight → KHÔNG gate (ungated là CỐ Ý)", async () => {
    // KHÔNG có call-site password.hash(/.verify(/validatePassword( ở các path này
    // (verify bằng grep source BA 1.6.10) → ungated là đúng, không phải bỏ sót.
    const cases: Array<[string, string]> = [
      ["/api/auth/change-email", "POST"], // body chỉ newEmail; KHÔNG verify mật khẩu hiện tại
      ["/api/auth/update-user", "POST"], // cập nhật profile, KHÔNG scrypt
      ["/api/auth/get-session", "POST"], // đọc session, KHÔNG scrypt
      ["/api/auth/request-password-reset", "POST"], // chỉ gửi email
      ["/api/auth/reset-password", "GET"], // GET callback redirect, KHÔNG scrypt
      ["/api/auth/sign-in/email", "OPTIONS"], // preflight, KHÔNG scrypt
    ];
    for (const [path, method] of cases) {
      const { app, getSaw } = buildApp();
      const res = await app.request(path, { method });
      // "không gate" = KHÔNG vào semaphore: sawActive==0 (qua stub) hoặc ==-1
      // (cors short-circuit OPTIONS preflight). Chỉ ==1 mới là đã gate.
      expect(getSaw()).not.toBe(1);
      expect(res.status).not.toBe(503);
    }
  });

  it("trailing slash được chuẩn hoá (vẫn gate)", async () => {
    const { app, getSaw } = buildApp();
    await app.request("/api/auth/sign-in/email/", { method: "POST" });
    expect(getSaw()).toBe(1);
  });
});

describe("hashGuard (acceptance a: cap + /health responsiveness)", () => {
  it("burst 50 → hash đồng thời ≤ cap, /health vẫn nhanh, KHÔNG 500", async () => {
    const { app, getMax } = buildApp();
    const burst = Array.from({ length: 50 }, () =>
      app.request("/api/auth/sign-in/email", { method: "POST" }),
    );
    const t = performance.now();
    const health = await app.request("/health"); // giữa lúc burst đang chạy
    const healthMs = performance.now() - t;
    const results = await Promise.all(burst);

    expect(health.status).toBe(200);
    expect(healthMs).toBeLessThan(100); // /health KHÔNG xếp hàng sau burst
    expect(getMax()).toBeLessThanOrEqual(hashSemaphore.capacity); // cap tôn trọng
    expect(getMax()).toBeGreaterThan(0);
    const err5 = results.filter((r) => r.status >= 500 && r.status !== 503).length;
    expect(err5).toBe(0); // không 500
    const handled = results.filter((r) => r.status === 200 || r.status === 503).length;
    expect(handled).toBe(50); // mọi request đều có kết cục (không treo)
  });
});

describe("hashGuard (acceptance c: overload → 503 sạch)", () => {
  it("quá tải → một số 503 HASH_CAPACITY + Retry-After, không 500", async () => {
    const { app } = buildApp();
    // 100 > maxConcurrent + maxQueue ở mọi cấu hình hợp lý → chắc chắn có shed.
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        app.request("/api/auth/sign-in/email", {
          method: "POST",
          headers: { Origin: "http://localhost:3000" },
        }),
      ),
    );
    const shed = results.filter((r) => r.status === 503);
    const err5 = results.filter((r) => r.status >= 500 && r.status !== 503).length;
    expect(shed.length).toBeGreaterThan(0);
    expect(err5).toBe(0);
    const body = (await shed[0]?.json()) as { code?: string };
    expect(body.code).toBe("HASH_CAPACITY");
    // requirement F: 503 mang CORS header → browser đọc được lỗi.
    expect(shed[0]?.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(shed[0]?.headers.get("Retry-After")).toBeTruthy();
  });
});
