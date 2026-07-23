import { describe, expect, it } from "vitest";
import type { ValidationLimits } from "@/lib/validation-limits";
import { makeSignupSchema } from "./signup-schema";

// D-052: ngưỡng đến từ BE (/api/config/validation) — schema phải tôn trọng
// GIÁ TRỊ ĐƯỢC TRUYỀN, không nuốt ngưỡng cứng nào khác.
const limits: ValidationLimits = {
  password: { minLength: 12, maxLength: 128 },
  otp: { length: 6 },
};

const signupSchema = makeSignupSchema((k) => k, limits);

describe("signupSchema", () => {
  it("accepts a password at the BE minimum", () => {
    const result = signupSchema.safeParse({
      name: "A",
      email: "a@b.com",
      password: "x".repeat(limits.password.minLength),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password below the BE minimum", () => {
    const result = signupSchema.safeParse({
      name: "A",
      email: "a@b.com",
      password: "x".repeat(limits.password.minLength - 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password above the BE maximum", () => {
    const result = signupSchema.safeParse({
      name: "A",
      email: "a@b.com",
      password: "x".repeat(limits.password.maxLength + 1),
    });
    expect(result.success).toBe(false);
  });

  it("follows the limits object, not a baked-in number", () => {
    const stricter = makeSignupSchema((k) => k, {
      ...limits,
      password: { minLength: 20, maxLength: 128 },
    });
    const result = stricter.safeParse({ name: "A", email: "a@b.com", password: "x".repeat(12) });
    expect(result.success).toBe(false);
  });
});
