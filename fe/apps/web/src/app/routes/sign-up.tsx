import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignupForm } from "@/features/auth/components/signup-form";
import { sanitizeRedirect } from "@/features/auth/lib/redirect-param";

// ?redirect sống qua CẢ đường đăng ký (A.4.3): người thân mở link mời đa số
// CHƯA có tài khoản — rơi token ở đây là hỏng cả luồng nhận lời. Sanitize cùng
// luật với /login (chỉ đường nội bộ).
const signUpSearchSchema = z.object({
  redirect: z.string().optional().transform(sanitizeRedirect),
});

export const Route = createFileRoute("/sign-up")({
  validateSearch: signUpSearchSchema,
  component: SignUpPage,
});

function SignUpPage() {
  const { redirect } = Route.useSearch();
  return <SignupForm redirectTo={redirect} />;
}
