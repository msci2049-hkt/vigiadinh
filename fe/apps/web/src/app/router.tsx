import { Skeleton } from "@repo/ui";
import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Context every route can read (loaders/beforeLoad). `session` is added by
 * the `_authenticated` layout's beforeLoad (see routes/_authenticated/route.tsx). */
export interface RouterContext {
  queryClient: QueryClient;
}

/**
 * Fallback khi route chunk/loader chưa sẵn (mạng chậm): skeleton khớp khung màn
 * (title + rows) thay vì màn cũ đứng im không phản hồi. Chỉ hiện khi chờ vượt
 * `defaultPendingMs`; local/chunk đã preload thì không bao giờ thấy.
 */
function RoutePendingSkeleton() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6" aria-busy="true">
      <Skeleton className="h-8 w-2/3 rounded-lg" />
      <Skeleton className="h-4 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </main>
  );
}

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient } satisfies RouterContext,
    defaultPreload: "intent",
    // Let TanStack Query own caching/staleness; the router just triggers loads.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: RoutePendingSkeleton,
    // 150ms không feedback là ngưỡng người dùng bắt đầu nghi ngờ; minMs giữ
    // skeleton đủ lâu để không nháy (hiện <300ms rồi biến mất còn tệ hơn).
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
