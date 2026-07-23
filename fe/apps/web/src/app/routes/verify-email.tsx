import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";

// email đến từ trang sign-up (?email=...). Không hợp lệ/thiếu → về /sign-up.
const searchSchema = z.object({
  email: z.email().optional().catch(undefined),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.email) throw redirect({ to: "/sign-up" });
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();
  if (!email) return null; // beforeLoad đã redirect
  return <VerifyEmailForm email={email} />;
}
