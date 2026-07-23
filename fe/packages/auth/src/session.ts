import { queryOptions } from "@tanstack/react-query";
import type { AppAuthClient, SessionData } from "./auth-client";

export const sessionQueryKey = ["auth", "session"] as const;

/**
 * Session as TanStack Query options — the single source the ROUTER reads
 * (beforeLoad guards via `queryClient.ensureQueryData`). Components keep using
 * the reactive `useSession()` store; after sign-in/sign-out/impersonation the
 * app must invalidate this key so guards re-check.
 *
 * A failed getSession (no BE, network down, 401) resolves to `null` =
 * unauthenticated — same behavior as the old inline guard
 * (`getSession().catch(() => ({ data: null }))`).
 */
export function sessionQueryOptions(client: AppAuthClient) {
  return queryOptions<SessionData | null>({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      try {
        const { data } = await client.getSession();
        return data ?? null;
      } catch {
        return null;
      }
    },
    // Guards run on every navigation — don't hammer the BE. The BE cookie-cache
    // (5 min) already makes sessions eventually-consistent; 30s here is noise-free
    // while staying well inside that revocation window.
    staleTime: 30_000,
  });
}
