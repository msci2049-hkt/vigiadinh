// Cron presence (PHA 4.1): chạy MỖI GIỜ (phút 0, UTC) —
//  1. Ví có giờ ĐỊA PHƯƠNG 12:00 (tz chủ ví) → tạo silent ping cho guardian
//     (giao push thật nối ở tầng notify PHA 4.3 — hàng notifications đã ghi).
//  2. Sweep ladder toàn hệ: đổi bậc → notify CHỦ VÍ (template_key theo bậc,
//     debounce tự nhiên vì chỉ bắn khi GIÁ TRỊ đổi) + audit (repo lo).
// Queue {hashtag} (Dragonfly) · attempts 1 · redlock chống trùng tick.
import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { enqueueNotification } from "@/modules/notifications";
import {
  sendDailyPings,
  sweepLadder,
  walletsAtLocalHour,
} from "@/modules/presence/infra/ladder.repository";

export const PRESENCE_QUEUE = "{presence-ping}";
const NOON_LOCAL_HOUR = 12;

export const presenceQueue = new Queue(PRESENCE_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function schedulePresencePing(): Promise<void> {
  await presenceQueue.add(
    "tick",
    {},
    { repeat: { pattern: "0 * * * *", tz: "UTC" }, jobId: "presence-ping-cron" },
  );
}

export async function runPresenceTick(now: Date): Promise<{ pings: number; transitions: number }> {
  const noonWallets = await walletsAtLocalHour(NOON_LOCAL_HOUR, now);
  const pings = await sendDailyPings(noonWallets, now);

  const transitions = await sweepLadder(now);
  for (const t of transitions) {
    // Chỉ chủ ví được biết (luật riêng tư) — notify theo bậc mới.
    await enqueueNotification({
      userId: t.ownerUserId,
      templateKey:
        t.to === "offline"
          ? "presence.guardian_offline"
          : t.to === "slow"
            ? "presence.guardian_slow"
            : "presence.guardian_back",
      params: { guardianId: t.guardianId, walletId: t.walletId, from: t.from },
      channel: "push",
    });
  }
  return { pings, transitions: transitions.length };
}

export function createPresenceWorker(): Worker {
  return new Worker(
    PRESENCE_QUEUE,
    async () => {
      await redlock.using(["lock:presence-ping"], 4 * 60_000, async () => {
        const result = await runPresenceTick(new Date());
        if (result.pings > 0 || result.transitions > 0) {
          logger.info(result, "presence.tick");
        }
      });
    },
    { connection: bullConnection },
  );
}
