import { adminClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "./access-control";

/**
 * Better Auth client factory (matches BE Better Auth ~1.6.x + admin plugin).
 *
 * - `baseURL` is the BE ROOT — Better Auth appends `/api/auth/*` itself.
 * - Session is a cookie; we never store tokens. Every call uses
 *   `credentials: "include"` so the cookie rides along cross-origin.
 *   (BE must allow CORS credentials + trustedOrigins = the FE URL.)
 * - `adminClient({ ac, roles })` — typed `authClient.admin.*` (listUsers,
 *   setRole, ban, impersonate, …) + `checkRolePermission` using the SAME
 *   access-control statements as the BE plugin. NO CASTS: passing ac/roles here
 *   is what makes permission checks type-safe end to end.
 * - Cookie-cache revocation window: logout / role changes may lag up to the
 *   session cookie-cache TTL, so re-check the session on sensitive routes.
 * - INVARIANT: `signUp.email()` NEVER sends `role` (or other sensitive fields) —
 *   the server owns role. A public sign-up form must not offer an admin/staff
 *   option. Elevate only via `admin.setRole` / `admin.createUser` (admin session,
 *   server-enforced). BE rejects role at sign-up hard (400 FIELD_NOT_ALLOWED).
 *   See .claude/rules/auth.md.
 * - `emailOTPClient()` — typed `authClient.emailOtp.*` (sendVerificationOtp,
 *   verifyEmail, requestPasswordReset, resetPassword) for the 6-digit OTP flows
 *   (email verification after sign-up + forgot-password). Mirrors the BE
 *   emailOTP plugin. Auto-refreshes the session on verify-email/sign-in-otp.
 *
 * Each app creates ONE client in its own `src/lib/auth-client.ts` wrapper
 * (passing its `env.VITE_API_URL`) and re-exports the bound methods.
 */
export function createAppAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    fetchOptions: {
      credentials: "include",
    },
    plugins: [adminClient({ ac, roles }), emailOTPClient()],
  });
}

export type AppAuthClient = ReturnType<typeof createAppAuthClient>;

/** `{ user, session }` as inferred from the client (role/banned fields included). */
export type SessionData = AppAuthClient["$Infer"]["Session"];
export type SessionUser = SessionData["user"];
