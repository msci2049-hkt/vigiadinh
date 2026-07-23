import { z } from "zod";
import type { ValidationLimits } from "@/lib/validation-limits";

/**
 * Narrow translator for sign-up field errors. Pass `t` from useTranslation("auth").
 * `values` BẮT BUỘC (không optional): optional param thêm `undefined` vào args
 * tuple → TFunction của i18next không assignable dưới exactOptionalPropertyTypes
 * (gotcha CLAUDE.md §10). Key không cần interpolate thì truyền `{}`.
 */
type SignupMessages = (
  key:
    | "signup.errors.name"
    | "signup.errors.email"
    | "signup.errors.password"
    | "signup.errors.passwordMax",
  values: Record<string, unknown>,
) => string;

/**
 * Public sign-up schema. Ngưỡng password đến từ BE (GET /api/config/validation
 * qua useValidationLimits() — D-052), KHÔNG hardcode số ở đây.
 * INVARIANT: NO `role` field — the server owns role (see @repo/auth
 * auth-client + .claude/rules/auth.md).
 */
export function makeSignupSchema(t: SignupMessages, limits: ValidationLimits) {
  const { minLength, maxLength } = limits.password;
  return z.object({
    name: z.string().min(1, { error: t("signup.errors.name", {}) }),
    email: z.email({ error: t("signup.errors.email", {}) }),
    password: z
      .string()
      .min(minLength, { error: t("signup.errors.password", { min: minLength }) })
      .max(maxLength, { error: t("signup.errors.passwordMax", { max: maxLength }) }),
  });
}

export type SignupInput = z.infer<ReturnType<typeof makeSignupSchema>>;
