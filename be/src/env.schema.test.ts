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
    // Mainnet migration 2026-07-26: 4 biến Stellar/SEP-45 hết default (fail-closed).
    STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    SEP45_HOME_DOMAIN: "localhost:5173",
    SEP45_WEB_AUTH_DOMAIN: "localhost:3000",
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
  // 11 → 7 khi gỡ R2_* (B-ENV-1, 2026-07-26): 4 biến bắt-buộc-nhưng-không-dùng.
  // 7 → 11 mainnet migration (2026-07-26): STELLAR_RPC_URL + STELLAR_NETWORK_PASSPHRASE
  // + SEP45_HOME_DOMAIN + SEP45_WEB_AUTH_DOMAIN hết default (fail-closed, chống
  // production im lặng chạy testnet/localhost).
  // Đây là completeness-lock: thêm biến bắt buộc mới phải sửa con số Ở ĐÂY một cách
  // có chủ đích, không để nó trôi vào tập PROD-REQUIRED mà không ai nhận ra.
  test("đúng 11 biến bắt buộc — biến optional/default KHÔNG chui vào tập bắt buộc", () => {
    const keys = requiredEnvKeys();
    expect(keys).toHaveLength(11);
    expect(keys).toContain("STELLAR_RPC_URL");
    expect(keys).toContain("STELLAR_NETWORK_PASSPHRASE");
    expect(keys).toContain("SEP45_HOME_DOMAIN");
    expect(keys).toContain("SEP45_WEB_AUTH_DOMAIN");
    // Key provider là OPTIONAL — không được trôi vào tập bắt buộc (provider có
    // thể nhúng key trong URL).
    expect(keys).not.toContain("STELLAR_RPC_API_KEY");
    expect(keys).not.toContain("COOKIE_PREFIX");
    // R2_* đã gỡ — không được quay lại tập bắt buộc mà không sửa B-ENV-1.
    expect(keys).not.toContain("R2_BUCKET");
  });
});
