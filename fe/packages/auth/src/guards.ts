import { redirect } from "@tanstack/react-router";

/**
 * Structural view of what a role guard needs from TanStack Router's
 * `beforeLoad` args. Typed structurally (NOT `any`) so the guard composes with
 * any app's router: the parent `_authenticated` route puts `session` into
 * context; `location.href` feeds the post-login redirect.
 */
export interface RoleGuardArgs {
  /** `unknown` on purpose: every app's router context type must be accepted
   * (beforeLoad params are contravariant). The guard narrows structurally. */
  context: unknown;
  location: { href: string };
}

function roleOf(context: unknown): string | null | undefined {
  return (context as { session?: { user?: { role?: string | null } | null } | null }).session?.user
    ?.role;
}

/**
 * Route guard: only the listed roles may enter; everyone else → /unauthorized
 * (403 page) carrying the attempted URL + reason.
 *
 * ⚠️ Route guards are UX, not security — the BE re-checks permissions on every
 * API call (Better Auth admin plugin). Never rely on this alone.
 *
 * Usage (route group):
 *   export const Route = createFileRoute("/_authenticated/_admin")({
 *     beforeLoad: requireRoles(["admin"]),
 *     component: AdminPanelShell,
 *   });
 */
export function requireRoles(allowed: readonly string[]) {
  return ({ context, location }: RoleGuardArgs): void => {
    const role = roleOf(context);
    if (!role || !allowed.includes(role)) {
      // `href` (not `to`) — typed `to` unions are per-app (Register), but this
      // guard is shared by every app; only apps that mount panels have /unauthorized.
      const search = new URLSearchParams({ redirect: location.href, reason: "insufficient_role" });
      throw redirect({ href: `/unauthorized?${search.toString()}` });
    }
  };
}
