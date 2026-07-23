import { z } from "zod";
import type { ValidationLimits } from "@/lib/validation-limits";

/**
 * Narrow translators for the OTP flows. Pass `t` from useTranslation("auth").
 * `values` BẮT BUỘC (không optional) — optional param thêm `undefined` vào args
 * tuple → TFunction không assignable dưới exactOptionalPropertyTypes (CLAUDE.md §10).
 */
type VerifyMessages = (key: "verify.errors.otp", values: Record<string, unknown>) => string;
type ForgotMessages = (key: "forgot.errors.email") => string;
type ResetMessages = (
  key: "reset.errors.otp" | "reset.errors.password" | "reset.errors.passwordMax",
  values: Record<string, unknown>,
) => string;

// Độ dài OTP đến từ BE (emailOTP otpLength qua /api/config/validation — D-052).
const otpField = (length: number, msg: string) =>
  z.string().regex(new RegExp(`^\\d{${length}}$`), { error: msg });

/** Verify-email: the OTP (email comes from the route search param). */
export function makeVerifyOtpSchema(t: VerifyMessages, limits: ValidationLimits) {
  const { length } = limits.otp;
  return z.object({ otp: otpField(length, t("verify.errors.otp", { length })) });
}

/** Forgot-password: the email to send the reset OTP to. */
export function makeForgotSchema(t: ForgotMessages) {
  return z.object({ email: z.email({ error: t("forgot.errors.email") }) });
}

/** Reset-password: OTP + new password — ngưỡng từ BE, không hardcode (D-052). */
export function makeResetSchema(t: ResetMessages, limits: ValidationLimits) {
  const { length } = limits.otp;
  const { minLength, maxLength } = limits.password;
  return z.object({
    otp: otpField(length, t("reset.errors.otp", { length })),
    password: z
      .string()
      .min(minLength, { error: t("reset.errors.password", { min: minLength }) })
      .max(maxLength, { error: t("reset.errors.passwordMax", { max: maxLength }) }),
  });
}

export type VerifyOtpInput = z.infer<ReturnType<typeof makeVerifyOtpSchema>>;
export type ForgotInput = z.infer<ReturnType<typeof makeForgotSchema>>;
export type ResetInput = z.infer<ReturnType<typeof makeResetSchema>>;
