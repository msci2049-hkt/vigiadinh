import { describe, expect, it } from "vitest";
import { makeLoginSchema } from "./login-schema";

// Identity translator: message = key (translation isn't what we're testing here).
const loginSchema = makeLoginSchema((k) => k);

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "12345678" });
    expect(result.success).toBe(true);
  });

  // D-052: login không lặp ngưỡng độ dài của BE (Better Auth không validate
  // minPasswordLength ở sign-in) — mật khẩu ngắn vẫn được gửi đi để BE trả
  // "sai email hoặc mật khẩu", thay vì FE chặn bằng ngưỡng tự bịa.
  it("accepts a short password (length rules belong to sign-up/reset)", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "123" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "12345678" });
    expect(result.success).toBe(false);
  });
});
