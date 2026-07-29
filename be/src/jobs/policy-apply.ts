// Cron ÁP ĐỀ NGHỊ NÂNG NGƯỠNG hết 24h chờ (B6, lô policy 2026-07-29) — khuôn
// intent-sweeper: BullMQ repeatable 5 phút, {hashtag} queue, attempts=1
// (idempotent tự nhiên — flip có điều kiện WHERE status, tick sau quét lại),
// redlock chống 2 worker cùng tick. Mỗi bản áp xong: audit + email + SSE
// (notify tự nuốt lỗi — không chặn các ví còn lại).
import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import {
  appendPolicyAudit,
  notifyRaiseApplied,
} from "@/modules/wallets/features/spending-policy/notify";
import { applyDuePending } from "@/modules/wallets/infra/wallet-policies.repository";

export const POLICY_APPLY_QUEUE = "{policy-apply}";

export const policyApplyQueue = new Queue(POLICY_APPLY_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/** Đăng ký lịch lặp — gọi MỘT lần từ worker boot (jobId cố định = dedup). */
export async function schedulePolicyApply(): Promise<void> {
  await policyApplyQueue.add(
    "apply",
    {},
    {
      repeat: { pattern: "*/5 * * * *", tz: "Asia/Ho_Chi_Minh" },
      jobId: "policy-apply-cron",
    },
  );
}

export async function runPolicyApplyTick(now: Date): Promise<number> {
  const applied = await applyDuePending(now);
  for (const policy of applied) {
    await appendPolicyAudit({
      walletId: policy.walletId,
      kind: "policy.change_applied",
      actorType: "system",
      payload: {
        perTxLimit: policy.perTxLimit.toString(),
        dailyLimit: policy.dailyLimit.toString(),
        version: policy.version,
        mode: "raise_after_delay",
      },
    });
    await notifyRaiseApplied({
      walletId: policy.walletId,
      perTxLimit: policy.perTxLimit,
      dailyLimit: policy.dailyLimit,
    });
  }
  return applied.length;
}

export function createPolicyApplyWorker(): Worker {
  return new Worker(
    POLICY_APPLY_QUEUE,
    async () => {
      await redlock.using(["lock:policy-apply"], 4 * 60_000, async () => {
        const appliedCount = await runPolicyApplyTick(new Date());
        if (appliedCount > 0) {
          logger.info({ appliedCount }, "policy-apply.applied");
        }
      });
    },
    { connection: bullConnection },
  );
}
