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
import {
  type ChainRecoveryRequest,
  type ChainVerdict,
  chainSaysRequestIsDead,
  classifyReadFailure,
  parseRecoveryStatus,
} from "@/modules/recovery";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { simulateRead } from "@/services/stellar/stellar.service";
import { expireStaleMirrorRows } from "./recovery-watch-reconcile";

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

export type WatchResult = {
  checked: number;
  alerted: number;
  /** R7 — số dòng mirror chết đã dọn ở tick này. */
  expired: number;
  /** R7 — số ví KHÔNG đọc được chain (mù). Không dọn ví nào trong số này. */
  unreadable: number;
  skipped: boolean;
};

/**
 * Đọc trạng thái khôi phục của MỘT ví từ chain và PHÂN LOẠI kết quả.
 *
 * Trước R7 chỗ này là một `catch {}` rỗng với chú thích "ví chưa từng có yêu cầu
 * nào → bỏ qua, không log ồn". Chú thích đó đúng với MỘT trong hai loại lỗi rơi
 * vào đây; loại kia là RPC chết. Gộp chúng nghĩa là job không bao giờ phân biệt
 * được "chain nói không có" với "tôi không đọc được chain" — mà toàn bộ tính an
 * toàn của việc dọn mirror nằm ở đúng chỗ phân biệt ấy.
 */
async function readChainVerdict(
  registryId: string,
  walletAddress: string,
): Promise<ChainVerdict<ChainRecoveryRequest>> {
  try {
    const [raw, remaining] = await Promise.all([
      simulateRead({
        contractId: registryId,
        method: "get_recovery_status",
        args: [nativeToScVal(new Address(walletAddress))],
      }),
      simulateRead({
        contractId: registryId,
        method: "timelock_remaining",
        args: [nativeToScVal(new Address(walletAddress))],
      }),
    ]);
    return { kind: "request", request: parseRecoveryStatus(raw, remaining) };
  } catch (err) {
    // `no-request` CHỈ khi contract panic NoActiveRecovery. Mọi thứ khác — mạng,
    // timeout, 5xx, mã lỗi lạ, shape lạ — là `unreadable` và sẽ KHÔNG dọn gì.
    return { kind: classifyReadFailure(err) };
  }
}

export async function runRecoveryWatchTick(): Promise<WatchResult> {
  if (!env.CONTRACT_ID_RECOVERY) {
    // Skip là ĐÚNG (chưa có contract thì không có gì để hỏi) nhưng phải ỒN ÀO.
    // Im lặng ở đây nghĩa là cron chạy mỗi 10 phút, không kiểm ví nào, không lỗi
    // — nhìn mọi mặt đều "khoẻ" trong khi phòng tuyến báo-cho-chủ-ví đang TẮT.
    // Cờ đọc-bằng-máy tương ứng nằm ở `/ready` → watchers.recoveryWatch.
    logger.warn(
      "recovery.watch.disabled: CONTRACT_ID_RECOVERY chưa set — KHÔNG ví nào được canh recovery",
    );
    return { checked: 0, alerted: 0, expired: 0, unreadable: 0, skipped: true };
  }
  const registryId = env.CONTRACT_ID_RECOVERY;

  const rows = await db
    .select({ id: wallets.id, userId: wallets.userId, address: wallets.stellarAddress })
    .from(wallets);

  let checked = 0;
  let alerted = 0;
  let expired = 0;
  let unreadable = 0;
  for (const row of rows) {
    if (!row.address?.startsWith("C")) continue;
    checked += 1;
    const verdict = await readChainVerdict(registryId, row.address);
    if (verdict.kind === "unreadable") {
      // 🔴 Mù về ví này ở tick này. KHÔNG dọn, KHÔNG báo, KHÔNG kết luận gì.
      // Tick sau đọc lại; dòng ma sống thêm 10 phút là cái giá rẻ hơn nhiều so
      // với việc xoá một yêu cầu khôi phục thật vì RPC chập một nhịp.
      unreadable += 1;
      continue;
    }

    try {
      // R7 (C3) — chain đã trả lời DỨT KHOÁT. Nếu câu trả lời đó nghĩa là "yêu
      // cầu này chết rồi", dọn mirror rồi đi tiếp: không còn gì để cảnh báo.
      if (chainSaysRequestIsDead(verdict, Math.floor(Date.now() / 1000))) {
        expired += await expireStaleMirrorRows({
          walletId: row.id,
          ownerUserId: row.userId,
          reason:
            verdict.kind === "no-request" ? "chain:no-request" : `chain:${verdict.request.status}`,
        });
        continue;
      }
      if (verdict.kind !== "request") continue;

      const req = verdict.request;
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
    } catch (err) {
      // DB/Dragonfly/hàng đợi hỏng cho MỘT ví — không được kéo theo cả tick (còn
      // ví khác đang chờ được canh). Nhưng KHÔNG im lặng: `catch {}` rỗng ở đúng
      // file này chính là thứ R7 vừa gỡ ra.
      logger.error({ err, walletId: row.id }, "recovery.watch.wallet-failed");
    }
  }
  return { checked, alerted, expired, unreadable, skipped: false };
}

export function createRecoveryWatchWorker(): Worker {
  return new Worker(
    RECOVERY_WATCH_QUEUE,
    async () => {
      await redlock.using(["lock:recovery-watch"], 5 * 60_000, async () => {
        const result = await runRecoveryWatchTick();
        if (result.alerted > 0) logger.warn(result, "recovery.watch.alerted");
        // R7 — hai con số này phải đọc được từ log: `expired` để biết cơ chế dọn
        // có chạy không, `unreadable` để biết ta đang mù bao nhiêu ví (mù nhiều
        // = mirror sẽ không bao giờ được dọn, và không ai nhận cảnh báo nào).
        if (result.expired > 0) logger.warn(result, "recovery.watch.expired-stale-mirror");
        if (result.unreadable > 0) logger.warn(result, "recovery.watch.chain-unreadable");
      });
    },
    { connection: bullConnection },
  );
}
