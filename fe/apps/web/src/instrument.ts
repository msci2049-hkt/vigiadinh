// ============================================================================
// Sentry bootstrap — PHẢI là import ĐẦU TIÊN trong main.tsx: init trước mọi
// module khác thì mới bắt được lỗi xảy ra ngay trong lúc import/boot.
// Chỉ bật ở PROD + có VITE_SENTRY_DSN — dev/test không đẩy noise lên Sentry.
// ============================================================================
import * as Sentry from "@sentry/react";
import { env } from "@/lib/env";

export const sentryEnabled = Boolean(import.meta.env.PROD && env.VITE_SENTRY_DSN);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (sentryEnabled) {
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    // Tracing integration gắn SAU (attachSentryRouterTracing) vì cần router
    // instance — chỉ tồn tại khi app/provider.tsx eval. Replay gắn ngay.
    integrations: [Sentry.replayIntegration()],
    // 20% transaction ở prod (chi phí). Web Vitals (LCP/CLS/INP/TTFB) đi kèm
    // browser tracing — KHÔNG cần package web-vitals riêng.
    tracesSampleRate: 0.2,
    // Chỉ inject sentry-trace/baggage vào request đi BE của mình — gắn bừa
    // sang domain thứ 3 sẽ vỡ CORS của họ. BE đã allow 2 header này (app.ts).
    tracePropagationTargets: [/^\//, new RegExp(`^${escapeRegExp(env.VITE_API_URL)}`)],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    // Không tự bơm PII (IP, cookie). User chỉ set id/role qua setUser chủ động.
    sendDefaultPii: false,
  });
}

/**
 * Gọi NGAY SAU createAppRouter (app/provider.tsx). tanstackRouter integration
 * THAY THẾ browserTracingIntegration (tự tạo pageload/navigation span với tên
 * route đã param-hoá) — không được gắn cả hai (double instrument).
 */
export function attachSentryRouterTracing(
  router: Parameters<typeof Sentry.tanstackRouterBrowserTracingIntegration>[0],
): void {
  if (!sentryEnabled) return;
  Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
}
