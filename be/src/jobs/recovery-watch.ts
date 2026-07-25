// Cron CẢNH BÁO KHÔI PHỤC — hỏi THẲNG CHAIN, không đi qua indexer.
//
// Vì sao job này tồn tại dù đã có notify từ indexer: chủ ví chỉ chặn được nếu
// BIẾT có khôi phục đang mở. Nếu đường "biết" duy nhất đi qua indexer thì
// indexer chết trong cửa sổ timelock nghĩa là không ai báo, không ai chặn, và
// khôi phục hoàn tất. Kẻ tấn công không cần phá chữ ký nào — chỉ cần indexer
// nghỉ đúng một ngày. Đây là đường thứ HAI, cố ý không dùng chung phụ thuộc:
// đọc chain trực tiếp, gửi qua EMAIL (ngoài app).
//
// Chạy mỗi 10 phút. Chống spam bằng cờ Redis theo (ví, mốc bắt đầu yêu cầu) —
// một yêu cầu báo một lần, nhưng yêu cầu MỚI thì báo lại.
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { Queue, Worker } from "bullmq";
import { db } from "@/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { bullConnection, rateLimitConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { enqueueNotification } from "@/modules/notifications";
import { parseRecoveryStatus } from "@/modules/recovery";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { simulateRead } from "@/services/stellar/stellar.service";

export const RECOVERY_WATCH_QUEUE = "{recovery-watch}";

/** Cờ đã-báo sống lâu hơn timelock dài nhất (3 ngày) để không báo lại giữa chừng. */
const ALERT_FLAG_TTL_SECS = 4 * 24 * 3600;

export const recoveryWatchQueue = new Queue(RECOVERY_WATCH_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function scheduleRecoveryWatch(): Promise<void> {
  await recoveryWatchQueue.add(
    "tick",
    {},
    { repeat: { every: 600_000 }, jobId: "recovery-watch-cron" },
  );
}

export type WatchResult = { checked: number; alerted: number; skipped: boolean };

export async function runRecoveryWatchTick(): Promise<WatchResult> {
  if (!env.CONTRACT_ID_RECOVERY) return { checked: 0, alerted: 0, skipped: true };

  const rows = await db
    .select({ id: wallets.id, userId: wallets.userId, address: wallets.stellarAddress })
    .from(wallets);

  let checked = 0;
  let alerted = 0;
  for (const row of rows) {
    if (!row.address?.startsWith("C")) continue;
    checked += 1;
    try {
      const [raw, remaining] = await Promise.all([
        simulateRead({
          contractId: env.CONTRACT_ID_RECOVERY,
          method: "get_recovery_status",
          args: [nativeToScVal(new Address(row.address))],
        }),
        simulateRead({
          contractId: env.CONTRACT_ID_RECOVERY,
          method: "timelock_remaining",
          args: [nativeToScVal(new Address(row.address))],
        }),
      ]);
      const req = parseRecoveryStatus(raw, remaining);
      if (req.status !== "pending" && req.status !== "approved") continue;

      // Một yêu cầu báo một lần; yêu cầu mới (startedAt khác) báo lại.
      const flag = `recovery-alert:${row.id}:${req.startedAt}`;
      const fresh = await rateLimitConnection.set(flag, "1", "EX", ALERT_FLAG_TTL_SECS, "NX");
      if (fresh !== "OK") continue;

      await enqueueNotification({
        userId: row.userId,
        templateKey: "recovery.initiated",
        params: {
          walletId: row.id,
          approvals: req.approvals.length,
          hoursLeft: Math.ceil(req.timelockRemainingSecs / 3600),
        },
        channel: "email",
      });
      alerted += 1;
    } catch {
      // Ví chưa từng có yêu cầu nào → contract panic NoActiveRecovery. Đó là
      // trạng thái BÌNH THƯỜNG, không phải lỗi — bỏ qua, không log ồn.
    }
  }
  return { checked, alerted, skipped: false };
}

export function createRecoveryWatchWorker(): Worker {
  return new Worker(
    RECOVERY_WATCH_QUEUE,
    async () => {
      await redlock.using(["lock:recovery-watch"], 5 * 60_000, async () => {
        const result = await runRecoveryWatchTick();
        if (result.alerted > 0) logger.warn(result, "recovery.watch.alerted");
      });
    },
    { connection: bullConnection },
  );
}
