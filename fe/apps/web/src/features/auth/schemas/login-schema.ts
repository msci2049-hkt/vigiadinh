import { z } from "zod";

/** Narrow translator: just the two login error keys → message string. */
type LoginMessages = (key: "login.errors.email" | "login.errors.password") => string;

/**
 * Build the login schema with translated messages. Pass `t` from
 * `useTranslation("auth")` (the i18next TFunction is assignable to LoginMessages);
 * in tests pass a plain `(k) => k`.
 *
 * D-052: login CHỈ check "required" (min 1) — KHÔNG lặp ngưỡng độ dài của BE.
 * Better Auth không validate minPasswordLength ở sign-in (chỉ ở sign-up/reset),
 * nên chặn theo độ dài ở đây vừa sai UX vừa tạo nguồn sự thật thứ hai
 * (chính là bug FE min 8 vs BE min 12).
 */
export function makeLoginSchema(t: LoginMessages) {
  return z.object({
    email: z.email({ error: t("login.errors.email") }),
    password: z.string().min(1, { error: t("login.errors.password") }),
  });
}

export type LoginInput = z.infer<ReturnType<typeof makeLoginSchema>>;
