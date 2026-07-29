import { sessionQueryOptions } from "@repo/auth";
import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRealtimeUpdates } from "@/app/use-realtime-updates";
import { sanitizeRedirect } from "@/features/auth/lib/redirect-param";
import { authClient } from "@/lib/auth-client";
import i18n from "@/lib/i18n";

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
      // `location.href` của TanStack Router là đường TƯƠNG ĐỐI (vd `/login?redirect=/`),
      // nên nếu không lọc thì nó tự lồng vào chính nó — đúng vòng lặp 29/07.
      throw redirect({ to: "/login", search: { redirect: sanitizeRedirect(location.href) } });
    }
    return { session };
  },
  component: AuthenticatedShell,
});

// Các đích chính trong vùng authenticated — preload CHUNK (code) lúc rảnh để
// lần bấm đầu tiên không phải chờ mạng tải chunk. CHỈ code, KHÔNG data: các màn
// này fetch qua useQuery lúc mount, preloadRoute không đụng query nào (không có
// loader data) — đúng lằn ranh "prefetch code, không prefetch data" của ví.
const IDLE_PRELOAD_PATHS = [
  "/wallet",
  "/wallet/send",
  "/wallet/receive",
  "/wallet/history",
  "/night-watch",
  "/guardians",
  "/block",
  "/guardian",
  "/protecting",
  "/inheritance",
] as const;

/**
 * Outlet + preload-on-idle: đứng SAU cổng session (chỉ chạy khi đã đăng nhập,
 * beforeLoad của các route con không bị gọi oan khi chưa có phiên). Nạp thêm
 * namespace i18n `fw` để màn đầu tiên không nháy chuỗi rỗng chờ catalog.
 */
function AuthenticatedShell() {
  const router = useRouter();
  // MỘT kết nối SSE cho cả vỏ đã đăng nhập — realtime guardian/intent (LÔ 3).
  useRealtimeUpdates();
  useEffect(() => {
    // jsdom/test không có requestIdleCallback — rơi về setTimeout.
    const idle: (cb: () => void) => number =
      typeof window.requestIdleCallback === "function"
        ? (cb) => window.requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 300);
    const cancel: (id: number) => void =
      typeof window.cancelIdleCallback === "function"
        ? (id) => window.cancelIdleCallback(id)
        : (id) => window.clearTimeout(id);
    const id = idle(() => {
      void i18n.loadNamespaces("fw");
      for (const to of IDLE_PRELOAD_PATHS) {
        void router.preloadRoute({ to }).catch(() => {
          // Preload là tối ưu, không phải chức năng — hỏng thì bấm vẫn tải như cũ.
        });
      }
    });
    return () => cancel(id);
  }, [router]);
  return <Outlet />;
}
