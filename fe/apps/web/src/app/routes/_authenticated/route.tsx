import { sessionQueryOptions } from "@repo/auth";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

/**
 * Pathless auth gate: every child route requires a session. The session is
 * fetched ONCE through TanStack Query (ensureQueryData → cached 30s) and put
 * into router context, so child guards (e.g. requireRoles in _admin) read
 * `context.session` without another network call.
 *
 * F5 safe: beforeLoad awaits the session BEFORE children render — no flash of
 * a wrong redirect while the session is still loading.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions(authClient));
    if (!session?.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { session };
  },
  component: Outlet,
});
