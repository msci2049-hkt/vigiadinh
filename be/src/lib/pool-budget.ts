// WHY: Chặn over-commit kết nối Postgres lúc BOOT. Nhiều web instance × DB_POOL_MAX
// vượt max_connections → Postgres từ chối connection NGẪU NHIÊN ở tải cao (lỗi khó
// debug, sập rolling deploy). Refuse boot sớm + thông điệp actionable thay vì chết
// âm thầm trong prod. Cũng WARN khi login CPU guard over-commit
// (WEB_INSTANCES × HASH_MAX_CONCURRENT > ~2×core — xem middlewares/hash-guard.ts).
// Lõi `evaluatePoolBudget` THUẦN → unit-test không cần boot. Xem docs/SCALE-RUNBOOK.md.
import { env } from "@/env";
import { logger } from "@/lib/logger";

export interface PoolBudgetInput {
  webInstances: number;
  dbPoolMax: number;
  pgMaxConnections: number;
  hashMaxConcurrent: number;
  cores: number;
}

export interface PoolBudgetResult {
  refuse: boolean;
  dbConnections: number;
  budget: number;
  boxHash: number;
  hashCeiling: number;
  warnings: string[];
}

// +1: worker service cũng giữ 1 pool DB (DB_POOL_MAX) — tính vào ngân sách.
const WORKER_RESERVE = 1;
// Chừa 20% cho migration/studio/cron/superuser slot.
const SAFETY_RATIO = 0.8;

export function evaluatePoolBudget(i: PoolBudgetInput): PoolBudgetResult {
  const dbConnections = (i.webInstances + WORKER_RESERVE) * i.dbPoolMax;
  const budget = Math.floor(SAFETY_RATIO * i.pgMaxConnections);
  const boxHash = i.webInstances * i.hashMaxConcurrent;
  const hashCeiling = 2 * i.cores;
  const warnings: string[] = [];
  if (boxHash > hashCeiling) {
    warnings.push(
      `login CPU guard over-commit: WEB_INSTANCES×HASH_MAX_CONCURRENT=${boxHash} > ~2×core=${hashCeiling}`,
    );
  }
  return { refuse: dbConnections > budget, dbConnections, budget, boxHash, hashCeiling, warnings };
}

// Gọi 1 lần lúc boot (cluster.ts cho cả N, hoặc index.ts khi single-process).
// Refuse boot (exit 1) nếu vượt ngân sách kết nối — KHÔNG để prod tự sập sau.
export function assertPoolBudget(opts?: { webInstances?: number }): void {
  // CPU_CORES (--cpus thật) ưu tiên; navigator.hardwareConcurrency báo core HOST
  // trong container nên chỉ dùng làm fallback (cảnh báo hash khi đó hơi lỏng).
  const cores = env.CPU_CORES ?? navigator.hardwareConcurrency ?? 1;
  const input: PoolBudgetInput = {
    webInstances: opts?.webInstances ?? env.WEB_INSTANCES,
    dbPoolMax: env.DB_POOL_MAX,
    pgMaxConnections: env.PG_MAX_CONNECTIONS,
    hashMaxConcurrent: env.HASH_MAX_CONCURRENT,
    cores,
  };
  const r = evaluatePoolBudget(input);
  for (const w of r.warnings) {
    logger.warn(input, `pool-budget.warn: ${w} (xem docs/SCALE-RUNBOOK.md)`);
  }
  if (r.refuse) {
    logger.error(
      { ...input, dbConnections: r.dbConnections, budget: r.budget },
      "pool-budget.REFUSE-BOOT: (WEB_INSTANCES+1)×DB_POOL_MAX > 80%×max_connections — giảm DB_POOL_MAX/WEB_INSTANCES hoặc tăng PG max_connections (docs/SCALE-RUNBOOK.md)",
    );
    process.exit(1);
  }
  logger.info(
    {
      webInstances: input.webInstances,
      dbConnections: r.dbConnections,
      budget: r.budget,
      boxHash: r.boxHash,
    },
    "pool-budget.ok",
  );
}
