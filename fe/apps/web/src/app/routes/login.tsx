import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoginForm } from "@/features/auth/components/login-form";
import { sanitizeRedirect } from "@/features/auth/lib/redirect-param";

// Search params validated with Zod (Standard Schema → no adapter needed).
// `redirect` đi qua `sanitizeRedirect` DÙNG CHUNG với /sign-up và /verify-email.
// Trước 29/07 màn này giữ một BẢN SAO inline của luật chống open-redirect, nên
// khi luật được siết thêm (chặn redirect tự trỏ vào trang auth) thì đúng màn
// đọc `?redirect` lại là màn không được vá — link vòng lặp dán tay vẫn lồng tiếp.
const loginSearchSchema = z.object({
  redirect: z.string().optional().transform(sanitizeRedirect),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  // No explicit redirect → LoginForm lands on the role's post-auth home
  // (postAuthPath) after sign-in; plain users go to "/wallet".
  return <LoginForm redirectTo={redirect} />;
}
