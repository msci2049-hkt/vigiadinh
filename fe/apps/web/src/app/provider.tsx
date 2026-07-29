import { sessionQueryKey } from "@repo/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster, useThemeInit } from "@/components/family/ui";
import { UpdateToast } from "@/components/update-toast";
import { unauthorizedNavigation } from "@/features/auth/lib/redirect-param";
import { attachSentryRouterTracing } from "@/instrument";
import { setUnauthorizedHandler } from "@/lib/api-client";
import { env } from "@/lib/env";
import "@/lib/i18n"; // side-effect: initialize i18next before any component renders
import { createQueryClient } from "@/lib/query-client";
import { validationLimitsOptions } from "@/lib/validation-limits";
import { createAppRouter } from "./router";

// Created once at module scope (stable across renders).
const queryClient = createQueryClient();
// D-052: warm ngưỡng validate từ BE lúc boot (không block render — queryFn tự
// fallback khi BE chưa reachable). Form schema đọc qua useValidationLimits().
void queryClient.prefetchQuery(validationLimitsOptions);
const router = createAppRouter(queryClient);
// Sentry tracing cần router instance → gắn ngay sau khi tạo (no-op nếu Sentry tắt).
attachSentryRouterTracing(router);

export function AppProvider() {
  useThemeInit();

  useEffect(() => {
    // Route apiClient 401s through the router (SPA nav) instead of a hard reload.
    // Drop the cached session first so route guards re-check instead of trusting
    // a stale "authenticated" entry.
    setUnauthorizedHandler(() => {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      // Quyết định nằm ở hàm THUẦN (test được, không cần router): đang đứng trên
      // trang auth mà nhận 401 thì Ở LẠI — đá tiếp chỉ lồng thêm một tầng
      // `?redirect=` vào chính nó (sự cố 29/07).
      const nav = unauthorizedNavigation(window.location);
      if (!nav.navigate) return;
      void router.navigate({ to: "/login", search: { redirect: nav.redirect } });
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
      {/* D-052: báo user khi có bản deploy mới (SW prompt-mode → toast Tải lại). */}
      <UpdateToast />
      {env.VITE_ENABLE_DEVTOOLS ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
