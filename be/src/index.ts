// WHY: Sentry init PHẢI là dòng đầu (side-effect import) — instrument các
// module Node/Bun trước khi `app.ts` load. Đảo thứ tự = miss exception ở boot.
import "@/lib/sentry";

import { app } from "@/app";
import { client as pgClient } from "@/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { assertPoolBudget } from "@/lib/pool-budget";
import { closeRealtime } from "@/lib/realtime";
import { bullConnection, rateLimitConnection } from "@/lib/redis";

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
const SHUTDOWN_DRAIN_MS = 10_000;

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
    await pgClient.end({ timeout: 5 });
    await Promise.all([bullConnection.quit(), rateLimitConnection.quit(), closeRealtime()]);
    logger.info({ signal, drained }, "server.shutdown.done");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "server.shutdown.error");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
