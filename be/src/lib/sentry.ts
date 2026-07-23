// WHY: Sentry init PHẢI chạy TRƯỚC mọi instrumentation. Side-effect init ở
// top-level module — `import "@/lib/sentry"` (không gọi function) đã đủ kích
// hoạt. `src/index.ts` và `src/workers/index.ts` MUST có dòng này ở đầu, TRƯỚC
// mọi import khác.
//
// `sendDefaultPii: false` — tránh leak email/IP qua breadcrumb. Cần PII cho
// debug thì set per-request scope ở middleware.
import * as Sentry from "@sentry/bun";
import { env } from "@/env";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Prod: sample 10% transaction để khỏi cháy quota. Dev: full để debug.
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}

// Không có DSN → no-op (dev/test). Sentry.captureException ở error handler
// vẫn safe gọi: trả undefined event id, không throw.

export { Sentry };
