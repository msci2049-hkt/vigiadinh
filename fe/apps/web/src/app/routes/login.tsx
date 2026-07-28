import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoginForm } from "@/features/auth/components/login-form";

// Search params validated with Zod (Standard Schema → no adapter needed).
// `redirect` is sanitized to an internal absolute path only: external or
// protocol-relative URLs (?redirect=https://evil.com, //evil.com) are dropped
// to prevent an open redirect after login.
const loginSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .transform((to) =>
      to?.startsWith("/") && !to.startsWith("//") && !to.startsWith("/\\") ? to : undefined,
    ),
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
