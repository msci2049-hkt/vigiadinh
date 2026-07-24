// Cron GIA HẠN TTL (P0 §3 — 2026-07-24): Soroban ARCHIVE mọi entry hết TTL.
//
// Vì sao job này tồn tại, viết ra để đời sau đừng gỡ: OZ tự gia hạn entry
// persistent của nó mỗi lần ĐỌC, nên ví đang được dùng tự lành. Nhưng sản phẩm
// này có một loại ví được thiết kế để NẰM IM nhiều tháng — ví thừa kế. Không ai
// đọc thì không ai gia hạn; instance storage của ví (dây nối registry, owner
// rule id, mốc xoay khoá) thì KHÔNG có đường tự lành nào cả. Hết TTL = tiền còn
// nguyên trên chain nhưng không ai mở được, đúng vào lúc gia đình cần nhất.
// Đây là sự cố production kinh điển của Soroban, không phải rủi ro lý thuyết.
//
// Chạy MỖI NGÀY 03:00 UTC. Ví phí trả — người dùng không phải biết chuyện này.
// Lỗi MỘT ví không được làm hỏng lượt của ví khác (một ví chưa deploy/đã archive
// không phải lý do để 999 ví còn lại mất lượt gia hạn).

import { Address, xdr } from "@stellar/stellar-sdk";
import { Queue, Worker } from "bullmq";
import { db } from "@/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { invokeWithSignedEntries } from "@/services/stellar/stellar.service";

export const TTL_KEEPER_QUEUE = "{ttl-keeper}";

/** Ngưỡng/mốc gia hạn (ledger) — khớp hằng trong contract registry. */
const TTL_THRESHOLD = 300_000;
const TTL_EXTEND_TO = 3_110_400;

export const ttlKeeperQueue = new Queue(TTL_KEEPER_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
});

export async function scheduleTtlKeeper(): Promise<void> {
  await ttlKeeperQueue.add(
    "tick",
    {},
    { repeat: { pattern: "0 3 * * *", tz: "UTC" }, jobId: "ttl-keeper-cron" },
  );
}

export type TtlResult = { extended: number; failed: number; skipped: boolean };

/**
 * Một lượt gia hạn. Trả số ví gia hạn được / hỏng để log — KHÔNG throw khi một
 * ví hỏng, vì lượt sau phải chạy tiếp cho những ví còn lại.
 */
export async function runTtlKeeperTick(): Promise<TtlResult> {
  if (!env.CONTRACT_ID_RECOVERY) {
    // Chưa cấu hình chain → không có gì để gia hạn, app vẫn sống.
    return { extended: 0, failed: 0, skipped: true };
  }
  const rows = await db.select({ address: wallets.stellarAddress }).from(wallets);
  let extended = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.address?.startsWith("C")) continue; // chỉ ví hợp đồng
    try {
      // 1) instance + context rule của CHÍNH ví.
      await invokeWithSignedEntries({
        contractId: row.address,
        method: "extend_ttl",
        args: [xdr.ScVal.scvU32(TTL_THRESHOLD), xdr.ScVal.scvU32(TTL_EXTEND_TO)],
        authEntries: [],
      });
      // 2) cấu hình guardian của ví trong registry (archive cái này = mất
      //    danh sách người cứu, dù ví còn sống).
      await invokeWithSignedEntries({
        contractId: env.CONTRACT_ID_RECOVERY,
        method: "extend_ttl",
        args: [new Address(row.address).toScVal()],
        authEntries: [],
      });
      extended += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ err, wallet: row.address }, "ttl.extend.failed");
    }
  }
  return { extended, failed, skipped: false };
}

export function createTtlKeeperWorker(): Worker {
  return new Worker(
    TTL_KEEPER_QUEUE,
    async () => {
      await redlock.using(["lock:ttl-keeper"], 10 * 60_000, async () => {
        const result = await runTtlKeeperTick();
        logger.info(result, "ttl.tick");
      });
    },
    { connection: bullConnection },
  );
}
