import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Reactive current-user/session. Wraps Better Auth's `useSession` so feature
 * code never imports the auth client directly. Session is cookie-backed; due to
 * the cookie-cache revocation window, treat this as eventually-consistent and
 * re-check on sensitive actions (see .claude/rules/auth.md).
 */
export function useCurrentUser() {
  const { data, isPending, error, refetch } = useSession();

  // Sentry user sync TẬP TRUNG tại đây (UserMenu mount ở root layout mọi trang)
  // → phủ login/logout/hết hạn session, không phải rải setUser theo từng form.
  // Chỉ id + role — KHÔNG email/tên (sendDefaultPii=false, giữ PII ngoài Sentry).
  const userId = data?.user?.id ?? null;
  const userRole = data?.user?.role ?? undefined;
  useEffect(() => {
    if (isPending) return;
    Sentry.setUser(userId ? { id: userId, role: userRole } : null);
  }, [userId, userRole, isPending]);

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    isAuthenticated: Boolean(data?.user),
    isPending,
    error,
    refetch,
  };
}
