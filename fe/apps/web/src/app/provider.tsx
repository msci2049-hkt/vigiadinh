import { sessionQueryKey } from "@repo/auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster, useThemeInit } from "@/components/family/ui";
import { UpdateToast } from "@/components/update-toast";
import { unauthorizedNavigation } from "@/features/auth/lib/redirect-param";
import { isWalletSessionRevokedError } from "@/features/wallet/lib/session-revoked";
import { clearWalletToken } from "@/features/wallet/lib/wallet-token";
import { attachSentryRouterTracing } from "@/instrument";
import { setUnauthorizedHandler } from "@/lib/api-client";
import { env } from "@/lib/env";
import i18n from "@/lib/i18n"; // import cũng là side-effect: init i18next trước khi render
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
    setUnauthorizedHandler((error) => {
      // JWT ví đã thu hồi (ví bị xoá/xoay khoá) còn nằm trong localStorage →
      // MỌI request /api/* dính 401 bất kể cookie session còn tốt, người dùng
      // kẹt tới hết TTL 24h (sự cố 30/07). Dọn ĐÚNG token đó rồi bảo apiClient
      // thử lại MỘT lần — cookie vốn hợp lệ nên retry hết 401 ngay, không đá
      // về /login. CHỈ mã WALLET_SESSION_REVOKED được dọn: dọn trên mọi 401 là
      // đăng xuất oan phiên ví Bearer-first của WebView/APK khi chỉ session
      // app hết hạn. Toast id cố định — N query song song cùng dính 401 chỉ
      // hiện MỘT thông báo.
      if (isWalletSessionRevokedError(error)) {
        clearWalletToken();
        toast.info(i18n.t("session.walletRevoked", { ns: "common" }), {
          id: "wallet-session-revoked",
        });
        return true;
      }
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
