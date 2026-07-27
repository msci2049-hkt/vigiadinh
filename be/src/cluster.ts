// WHY: Supervisor spawn WEB_INSTANCES bản server (mỗi bản Bun.serve reusePort,
// share PORT qua SO_REUSEPORT). KHÔNG node:cluster (Bun chưa battle-tested) —
// chỉ spawn process độc lập. 1 child chết → kill siblings + exit(1) để Docker
// `restart: unless-stopped` dựng lại container. Pool-budget kiểm 1 LẦN ở đây
// (child set CLUSTER_CHILD=1 → index.ts bỏ qua, tránh refuse/log N lần).
// CMD prod = `bun run dist/cluster.js`. Dev vẫn `bun run dev` (1 process).
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { assertPoolBudget } from "@/lib/pool-budget";

const N = env.WEB_INSTANCES;
assertPoolBudget({ webInstances: N }); // refuse boot trước khi spawn nếu vượt budget

// Child chạy bundle đã build (prod). Dockerized-dev có thể override = src/index.ts.
const childEntry = process.env.CLUSTER_CHILD_ENTRY ?? "dist/index.js";

const children = Array.from({ length: N }, (_, i) =>
  Bun.spawn(["bun", "run", childEntry], {
    env: { ...process.env, CLUSTER_CHILD: "1", CLUSTER_INDEX: String(i) },
    stdout: "inherit",
    stderr: "inherit",
  }),
);
logger.info({ instances: N, entry: childEntry }, "cluster.spawned");

let stopping = false;
// Audit 2026-07-25 (§7): 8s là SAI — nó thấp hơn ngân sách của chính child (10s,
// xem src/index.ts), nên supervisor SIGKILL con giữa lúc con đang drain và pool
// Postgres không kịp đóng. Chú thích cũ ("dưới Docker --stop-timeout mặc định 10s")
// đã lạc hậu: deploy/docker-compose.prod.yml:108 đặt stop_grace_period 15s.
// Thứ tự bắt buộc: 10s (child) < 13s (đây) < 15s (Docker).
const SHUTDOWN_TIMEOUT_MS = 13_000;
async function stopAll(signal: string, code: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.warn({ signal, code }, "cluster.shutdown");
  for (const child of children) child.kill();
  // Chờ child drain nhưng có TRẦN — child treo (DB/queue stuck) không kéo supervisor
  // quá hạn Docker (nếu không Docker SIGKILL cả container → mất exit code/cleanup).
  await Promise.race([
    Promise.all(children.map((child) => child.exited)),
    Bun.sleep(SHUTDOWN_TIMEOUT_MS).then(() => {
      logger.warn("cluster.shutdown.timeout — SIGKILL child còn lại");
      for (const child of children) child.kill("SIGKILL");
    }),
  ]);
  process.exit(code);
}

// Child chết ngoài ý muốn → coi là lỗi → restart cả container (exit 1).
for (const child of children) {
  void child.exited.then((code) => {
    if (!stopping) {
      logger.error({ code, pid: child.pid }, "cluster.child-exited — restarting container");
      void stopAll("CHILD_EXIT", 1);
    }
  });
}

process.on("SIGTERM", () => void stopAll("SIGTERM", 0));
process.on("SIGINT", () => void stopAll("SIGINT", 0));
