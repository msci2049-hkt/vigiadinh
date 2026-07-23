import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

// email đến từ trang forgot-password (?email=...). Thiếu → về /forgot-password.
const searchSchema = z.object({
  email: z.email().optional().catch(undefined),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.email) throw redirect({ to: "/forgot-password" });
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { email } = Route.useSearch();
  if (!email) return null; // beforeLoad đã redirect
  return <ResetPasswordForm email={email} />;
}
