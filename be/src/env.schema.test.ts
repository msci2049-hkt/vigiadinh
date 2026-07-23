// Test hành vi emptyStringAsUndefined SAU KHI gỡ @t3-oss/env-core (BƯỚC 0 audit
// 2026-07): `FOO=` (chuỗi rỗng) với biến optional/có-default PHẢI rơi về
// default/undefined, KHÔNG được thành "". normalizeRawEnv là lớp thay thế
// `emptyStringAsUndefined: true` của t3-env cũ — gãy lớp này là boot nhận
// PORT="" → NaN, SMTP_HOST="" → gửi mail vào host rỗng.
import { describe, expect, test } from "bun:test";
import { envSchema, normalizeRawEnv, requiredEnvKeys } from "./env.schema";

function validRecord(): Record<string, string> {
  return {
    DATABASE_URL: "postgres://app:app@localhost:5432/app",
    REDIS_URL: "redis://localhost:3699",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3000",
    TRUSTED_ORIGINS: "http://localhost:3000",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "noreply@example.com",
    R2_ACCOUNT_ID: "a",
    R2_ACCESS_KEY_ID: "b",
    R2_SECRET_ACCESS_KEY: "c",
    R2_BUCKET: "d",
  };
}

describe("normalizeRawEnv (emptyStringAsUndefined)", () => {
  test('"" → undefined, giá trị thật giữ nguyên', () => {
    const out = normalizeRawEnv({ A: "", B: "x", C: undefined });
    expect(out.A).toBeUndefined();
    expect(out.B).toBe("x");
    expect(out.C).toBeUndefined();
  });
});

describe("biến có DEFAULT bị set rỗng → rơi về default (không thành '')", () => {
  test("PORT= → 3000, NODE_ENV= → development, WEB_INSTANCES= → 1", () => {
    const raw = normalizeRawEnv({ ...validRecord(), PORT: "", NODE_ENV: "", WEB_INSTANCES: "" });
    const parsed = envSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.PORT).toBe(3000);
    expect(parsed.data.NODE_ENV).toBe("development");
    expect(parsed.data.WEB_INSTANCES).toBe(1);
  });

  test("biến OPTIONAL bị set rỗng → undefined (không phải '')", () => {
    const raw = normalizeRawEnv({ ...validRecord(), SMTP_HOST: "", SENTRY_DSN: "" });
    const parsed = envSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.SMTP_HOST).toBeUndefined();
    expect(parsed.data.SENTRY_DSN).toBeUndefined();
  });

  test("KHÔNG normalize (mô phỏng quên lớp emptyStringAsUndefined) → PORT='' phải FAIL, không lặng lẽ thành NaN/''", () => {
    const parsed = envSchema.safeParse({ ...validRecord(), PORT: "" });
    // z.coerce.number()("") === 0 → fail positive() — chứng minh không có
    // đường nào cho "" lọt qua thành giá trị chạy được.
    expect(parsed.success).toBe(false);
  });
});

describe("requiredEnvKeys ổn định", () => {
  test("chỉ 11 biến bắt buộc — biến optional/default KHÔNG chui vào tập bắt buộc", () => {
    const keys = requiredEnvKeys();
    expect(keys).toHaveLength(11);
    expect(keys).not.toContain("COOKIE_PREFIX");
  });
});
