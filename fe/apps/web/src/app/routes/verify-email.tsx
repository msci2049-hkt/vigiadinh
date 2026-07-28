import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";
import { sanitizeRedirect } from "@/features/auth/lib/redirect-param";

// email đến từ trang sign-up (?email=...). Không hợp lệ/thiếu → về /sign-up.
// redirect (A.4.3): mang tiếp đích sau OTP — người nhận lời mời guardian phải
// quay về ĐÚNG trang lời mời, không rơi về /wallet.
const searchSchema = z.object({
  email: z.email().optional().catch(undefined),
  redirect: z.string().optional().transform(sanitizeRedirect),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.email) throw redirect({ to: "/sign-up" });
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email, redirect: redirectTo } = Route.useSearch();
  if (!email) return null; // beforeLoad đã redirect
  return <VerifyEmailForm email={email} redirectTo={redirectTo} />;
}
