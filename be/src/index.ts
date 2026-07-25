// WHY: Sentry init PHẢI là dòng đầu (side-effect import) — instrument các
// module Node/Bun trước khi `app.ts` load. Đảo thứ tự = miss exception ở boot.
import "@/lib/sentry";

import { app } from "@/app";
import { client as pgClient } from "@/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { assertPoolBudget } from "@/lib/pool-budget";
import { closeRealtime } from "@/lib/realtime";
import { authStoreConnection, bullConnection, rateLimitConnection } from "@/lib/redis";

// Cluster child bỏ qua — cluster.ts đã kiểm 1 lần cho cả N (tránh refuse/log N lần).
// Dev/single-process: kiểm tại đây, refuse boot nếu pool vượt ngân sách.
if (!process.env.CLUSTER_CHILD) {
  assertPoolBudget();
}

const server = Bun.serve({
  port: env.PORT,
  reusePort: true, // N process share PORT qua SO_REUSEPORT (Linux). Supervisor: src/cluster.ts.
  fetch: app.fetch,
});

logger.info({ port: env.PORT, env: env.NODE_ENV }, "server.listening");

// Trần thời gian drain. WHY: SSE (/api/events) là connection KHÔNG BAO GIỜ tự
// kết thúc → `await server.stop()` một mình sẽ treo vô hạn → orchestrator
// (docker/k8s) hết grace period phải SIGKILL = mất clean exit. Sau trần này,
// stop(true) đóng cứng connection còn lại — client SSE tự reconnect + refetch-bù
// (thiết kế at-most-once, xem FE useServerEvents), request thường đã có đủ
// SHUTDOWN_DRAIN_MS để xong.
//
// Audit 2026-07-25 (§7) — NGÂN SÁCH TẮT MÁY PHẢI LỒNG NHAU: child < supervisor <
// Docker. Trước phiên này thì ngược: child cần tới 10s drain + 5s đóng pool = 15s,
// nhưng cluster.ts SIGKILL con ở 8s, dưới hạn Docker 15s. Nghĩa là mỗi lần drain
// vượt 8s, request đang bay bị giết sớm ~7s và pool Postgres KHÔNG BAO GIỜ đóng
// sạch — đúng cái 500-lúc-rolling-deploy mà chú thích trên nói là đã tránh được.
// Nay: 7s drain + 3s đóng pool = 10s (đây) < 13s (cluster.ts) < 15s (compose).
// Đổi bất kỳ số nào thì phải đổi cả ba, cùng lúc.
const SHUTDOWN_DRAIN_MS = 7_000;

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn({ signal }, "server.shutdown.start");
  try {
    // await: ngừng nhận request MỚI + drain in-flight rồi mới đóng pool
    // (không await = pool đóng khi request đang chạy → 500 lúc rolling deploy).
    const drained = await Promise.race([
      server.stop().then(() => true),
      Bun.sleep(SHUTDOWN_DRAIN_MS).then(() => false),
    ]);
    if (!drained) {
      logger.warn({ signal, drainMs: SHUTDOWN_DRAIN_MS }, "server.shutdown.force-close");
      server.stop(true); // đóng cứng connection còn treo (SSE) — idempotent
    }
    await pgClient.end({ timeout: 3 });
    await Promise.all([
      bullConnection.quit(),
      rateLimitConnection.quit(),
      // Connection thứ ba (secondaryStorage của Better Auth) cũng phải đóng, nếu
      // không mỗi lần restart để lại một socket Dragonfly mồ côi.
      authStoreConnection.quit(),
      closeRealtime(),
    ]);
    logger.info({ signal, drained }, "server.shutdown.done");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "server.shutdown.error");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
